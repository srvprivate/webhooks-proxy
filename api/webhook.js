// Datto to Mattermost webhook proxy for Vercel
// File: api/webhook.js

export default async function handler(req, res) {
  // Enable CORS for testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Received webhook:', JSON.stringify(req.body, null, 2));
    
    const slackPayload = req.body;
    
    // Handle Slack blocks format from Datto
    if (!slackPayload.blocks || !Array.isArray(slackPayload.blocks)) {
      throw new Error('Invalid Slack payload format');
    }
    
    // Extract header info
    const headerBlock = slackPayload.blocks[0];
    const headerText = headerBlock?.text?.text || 'Alert';
    
    // Extract device and site from header: "New monitoring alert on [device] | [site]"
    const headerMatch = headerText.match(/New monitoring alert on (.+?) \| (.+)/);
    const deviceName = headerMatch?.[1] || 'Unknown Device';
    const siteName = headerMatch?.[2] || 'Unknown Site';
    
    // Find the section with fields (usually blocks[1])
    const fieldsBlock = slackPayload.blocks.find(block => 
      block.type === 'section' && block.fields && block.fields.length > 0
    );
    
    const fields = fieldsBlock?.fields || [];
    
    // Helper to extract field values
    const getFieldValue = (searchTerm) => {
      const field = fields.find(f => 
        f.text && f.text.includes(searchTerm)
      );
      if (!field) return 'N/A';
      
      // Remove markdown formatting and extract value
      return field.text.replace(/^\*[^*]+\*\s*/, '').trim();
    };
    
    // Extract all the alert data
    const category = getFieldValue('Category');
    const description = getFieldValue('Description');
    const alertType = getFieldValue('Alert Type');
    const triggerDetails = getFieldValue('Trigger Details');
    const deviceDescription = getFieldValue('Device Description');
    const lastUser = getFieldValue('Last User');
    const os = getFieldValue('OS');
    
    // Find links section
    const linksBlock = slackPayload.blocks.find(block => 
      block.type === 'section' && 
      block.fields && 
      block.fields.some(f => f.text && f.text.includes('View Device'))
    );
    
    const linkFields = linksBlock?.fields || [];
    
    // Extract URLs from markdown links
    const extractUrl = (fieldText) => {
      if (!fieldText) return '#';
      const match = fieldText.match(/<([^|>]+)/);
      return match?.[1] || '#';
    };
    
    const deviceUrl = extractUrl(linkFields.find(f => f.text?.includes('View Device'))?.text);
    const alertUrl = extractUrl(linkFields.find(f => f.text?.includes('View Alert'))?.text);
    const siteUrl = extractUrl(linkFields.find(f => f.text?.includes('View Site'))?.text);
    const remoteUrl = extractUrl(linkFields.find(f => f.text?.includes('Web Remote'))?.text);
    
    // Determine color and priority
    let color = '#ff6b35'; // default orange
    let priority = 'Medium';
    
    const alertLower = alertType.toLowerCase();
    const categoryLower = category.toLowerCase();
    
    if (alertLower.includes('critical') || categoryLower.includes('critical')) {
      color = '#d32f2f';
      priority = 'Critical';
    } else if (alertLower.includes('warning') || categoryLower.includes('warning')) {
      color = '#ffa000';
      priority = 'Warning';
    } else if (alertLower.includes('info') || categoryLower.includes('info')) {
      color = '#1976d2';
      priority = 'Info';
    }
    
    // Create rich Mattermost payload
    const mattermostPayload = {
      username: "Datto RMM",
      icon_url: "https://i.imgur.com/YJhsAgQ.png",
      text: `**${alertType}** Alert - ${priority}`,
      attachments: [
        {
          color: color,
          fallback: `${alertType} Alert on ${deviceName}: ${description}`,
          title: `Alert: ${deviceName}`,
          title_link: alertUrl,
          text: `**${description}**`,
          fields: [
            {
              title: "Site",
              value: siteName,
              short: true
            },
            {
              title: "Device",
              value: deviceName,
              short: true
            },
            {
              title: "Category",
              value: category,
              short: true
            },
            {
              title: "Priority", 
              value: priority,
              short: true
            },
            {
              title: "Last User",
              value: lastUser,
              short: true
            },
            {
              title: "OS",
              value: os,
              short: true
            },
            {
              title: "Trigger Details",
              value: triggerDetails,
              short: false
            }
          ],
          footer: "Datto RMM Alert System",
          footer_icon: "https://i.imgur.com/YJhsAgQ.png",
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
    
    // Add action buttons as text since Mattermost action buttons are limited
    const actionText = `\n**Quick Actions:** [Device](${deviceUrl}) • [Alert](${alertUrl}) • [Site](${siteUrl}) • [Remote](${remoteUrl})`;
    mattermostPayload.attachments[0].text += actionText;
    
    console.log('Sending to Mattermost:', JSON.stringify(mattermostPayload, null, 2));
    
    // Send to Mattermost
    const mattermostUrl = process.env.MATTERMOST_WEBHOOK_URL;
    if (!mattermostUrl) {
      throw new Error('MATTERMOST_WEBHOOK_URL environment variable not set');
    }
    
    const response = await fetch(mattermostUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mattermostPayload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mattermost webhook failed (${response.status}): ${errorText}`);
    }
    
    console.log('Successfully sent to Mattermost');
    res.status(200).json({ success: true, message: 'Alert forwarded to Mattermost' });
    
  } catch (error) {
    console.error('Webhook proxy error:', error);
    res.status(500).json({ 
      error: 'Webhook proxy failed', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

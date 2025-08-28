// Datto to Mattermost Webhook Proxy for Vercel (ES Modules)
// File: api/index.js

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed - use POST' });
  }

  try {
    console.log('Received Datto webhook payload:', JSON.stringify(req.body, null, 2));
    
    const slackPayload = req.body;
    
    // Validate Slack blocks format from Datto
    if (!slackPayload.blocks || !Array.isArray(slackPayload.blocks)) {
      console.error('Invalid payload - missing blocks array');
      throw new Error('Invalid Slack payload format - missing blocks');
    }
    
    // Extract header info (blocks[0])
    const headerBlock = slackPayload.blocks[0];
    const headerText = headerBlock?.text?.text || 'Monitoring Alert';
    console.log('Header text:', headerText);
    
    // Parse header: "New monitoring alert on [device] | [site]"
    const headerMatch = headerText.match(/New monitoring alert on (.+?) \| (.+)/);
    const deviceName = headerMatch?.[1]?.trim() || 'Unknown Device';
    const siteName = headerMatch?.[2]?.trim() || 'Unknown Site';
    
    // Find the main fields section (usually blocks[1])
    const fieldsBlock = slackPayload.blocks.find(block => 
      block.type === 'section' && 
      block.fields && 
      Array.isArray(block.fields) && 
      block.fields.length > 0
    );
    
    if (!fieldsBlock) {
      console.error('No fields block found in payload');
      throw new Error('No fields section found in Slack payload');
    }
    
    const fields = fieldsBlock.fields;
    console.log('Found fields:', fields.length);
    
    // Helper function to extract field values
    const getFieldValue = (searchTerm) => {
      const field = fields.find(f => 
        f.text && 
        f.type === 'mrkdwn' && 
        f.text.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (!field) {
        console.log(`Field not found: ${searchTerm}`);
        return 'N/A';
      }
      
      // Remove markdown formatting: *Category:* Value -> Value
      const value = field.text.replace(/^\*[^*]+\*\s*/, '').trim();
      console.log(`${searchTerm}: ${value}`);
      return value || 'N/A';
    };
    
    // Extract all alert data
    const category = getFieldValue('Category');
    const description = getFieldValue('Description');
    const alertType = getFieldValue('Alert Type');
    const triggerDetails = getFieldValue('Trigger Details');
    const deviceDescription = getFieldValue('Device Description');
    const lastUser = getFieldValue('Last User');
    const os = getFieldValue('OS');
    
    // Find the links section (usually has View Device, View Alert, etc.)
    const linksBlock = slackPayload.blocks.find(block => 
      block.type === 'section' && 
      block.fields && 
      block.fields.some(f => f.text && f.text.includes('View Device'))
    );
    
    let deviceUrl = '#', alertUrl = '#', siteUrl = '#', remoteUrl = '#';
    
    if (linksBlock) {
      const linkFields = linksBlock.fields;
      
      // Extract URLs from Slack markdown links: <https://url|Text>
      const extractUrl = (fieldText) => {
        if (!fieldText) return '#';
        const match = fieldText.match(/<([^|>]+)/);
        return match?.[1] || '#';
      };
      
      deviceUrl = extractUrl(linkFields.find(f => f.text?.includes('View Device'))?.text);
      alertUrl = extractUrl(linkFields.find(f => f.text?.includes('View Alert'))?.text);
      siteUrl = extractUrl(linkFields.find(f => f.text?.includes('View Site'))?.text);
      remoteUrl = extractUrl(linkFields.find(f => f.text?.includes('Web Remote'))?.text);
    }
    
    console.log('Extracted URLs:', { deviceUrl, alertUrl, siteUrl, remoteUrl });
    
    // Determine alert priority and color based on type/category
    let color = '#ff6b35'; // Default orange
    let priority = 'Medium';
    let priorityEmoji = '⚠️';
    
    const alertLower = alertType.toLowerCase();
    const categoryLower = category.toLowerCase();
    const descLower = description.toLowerCase();
    
    if (alertLower.includes('critical') || categoryLower.includes('critical') || descLower.includes('critical')) {
      color = '#ff0000'; // Bright red for maximum visibility
      priority = 'Critical';
      priorityEmoji = '🔥';
    } else if (alertLower.includes('warning') || categoryLower.includes('warning') || descLower.includes('warning')) {
      color = '#ff8c00'; // Bright orange
      priority = 'Warning';  
      priorityEmoji = '⚠️';
    } else if (alertLower.includes('info') || categoryLower.includes('info') || descLower.includes('info')) {
      color = '#00bfff'; // Bright blue
      priority = 'Info';
      priorityEmoji = '💡';
    } else if (alertLower.includes('success') || categoryLower.includes('success') || descLower.includes('resolved')) {
      color = '#32cd32'; // Bright green
      priority = 'Resolved';
      priorityEmoji = '✅';
    } else {
      color = '#ff6b35'; // Default bright orange
      priority = 'Medium';
      priorityEmoji = '📊';
    }
    
    // Create stunning Mattermost payload with enhanced formatting
    const mattermostPayload = {
      username: "🔔 Datto RMM Alert System",
      icon_url: "https://i.imgur.com/YJhsAgQ.png",
      text: `## ${priorityEmoji} **${alertType.toUpperCase()}** ALERT ${priorityEmoji}\n### 📍 **${deviceName}** at **${siteName}**`,
      attachments: [
        {
          color: color,
          fallback: `${priority} ${alertType} Alert on ${deviceName} at ${siteName}: ${description}`,
          title: `🖥️ ${deviceName} | 🏢 ${siteName}`,
          title_link: alertUrl,
          text: `### 📋 Alert Details\n> **${description}**\n\n📊 **Trigger Information:**\n> ${triggerDetails}`,
          fields: [
            {
              title: "🚨 Priority Level",
              value: `**${priorityEmoji} ${priority.toUpperCase()}**`,
              short: true
            },
            {
              title: "📂 Category", 
              value: `**${category}**`,
              short: true
            },
            {
              title: "🌐 Site Location",
              value: `📍 **${siteName}**`,
              short: true
            },
            {
              title: "💻 Device Name",
              value: `🖥️ **${deviceName}**`,
              short: true
            },
            {
              title: "👤 Last Active User",
              value: `👤 ${lastUser}`,
              short: true
            },
            {
              title: "⚙️ Operating System",
              value: `💿 ${os}`,
              short: true
            },
            {
              title: "📝 Device Description",
              value: deviceDescription !== 'N/A' ? `📄 ${deviceDescription}` : '📄 *No description available*',
              short: false
            }
          ],
          footer: "🛡️ Datto RMM Alert System • Real-time Monitoring",
          footer_icon: "https://i.imgur.com/YJhsAgQ.png",
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
    
    // Add enhanced action buttons section
    if (deviceUrl !== '#' || alertUrl !== '#') {
      const actionButtons = [];
      
      // Create styled action buttons with emojis
      if (deviceUrl !== '#') actionButtons.push(`🖥️ **[View Device Dashboard](${deviceUrl})**`);
      if (alertUrl !== '#') actionButtons.push(`🚨 **[Open Alert Details](${alertUrl})**`);
      if (siteUrl !== '#') actionButtons.push(`🏢 **[Manage Site](${siteUrl})**`);
      if (remoteUrl !== '#') actionButtons.push(`🖱️ **[Remote Access](${remoteUrl})**`);
      
      if (actionButtons.length > 0) {
        mattermostPayload.attachments[0].text += `\n\n---\n## 🎛️ **Quick Actions**\n${actionButtons.join(' **|** ')}`;
      }
    }
    
    // Add a second attachment for additional visual impact on critical alerts
    if (priority === 'Critical') {
      mattermostPayload.attachments.push({
        color: '#ff0000',
        text: `⚠️ **IMMEDIATE ATTENTION REQUIRED** ⚠️\n\n🚨 This is a **CRITICAL ALERT** that requires immediate investigation.\n🔥 Device: **${deviceName}**\n📍 Location: **${siteName}**\n⏰ Time: **${new Date().toLocaleString()}**`,
        footer: "🆘 Critical Alert Banner",
        footer_icon: "https://cdn-icons-png.flaticon.com/512/564/564619.png"
      });
    }
    
    console.log('Generated Mattermost payload:', JSON.stringify(mattermostPayload, null, 2));
    
    // Send to Mattermost
    const mattermostUrl = process.env.MATTERMOST_WEBHOOK_URL;
    if (!mattermostUrl) {
      console.error('MATTERMOST_WEBHOOK_URL environment variable not set');
      throw new Error('MATTERMOST_WEBHOOK_URL environment variable not configured');
    }
    
    console.log('Sending to Mattermost...');
    const response = await fetch(mattermostUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mattermostPayload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mattermost webhook failed:', response.status, errorText);
      throw new Error(`Mattermost webhook failed (${response.status}): ${errorText}`);
    }
    
    console.log('✅ Successfully forwarded alert to Mattermost');
    
    // Return success response
    return res.status(200).json({ 
      success: true, 
      message: 'Alert successfully forwarded to Mattermost',
      alert: {
        device: deviceName,
        site: siteName,
        type: alertType,
        priority: priority
      }
    });
    
  } catch (error) {
    console.error('❌ Webhook proxy error:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Return error response
    return res.status(500).json({ 
      error: 'Webhook proxy failed', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

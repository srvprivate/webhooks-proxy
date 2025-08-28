// OpenPhone to Mattermost Webhook Proxy for Vercel
// File: api/openphone.js

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
    console.log('Received OpenPhone webhook payload:');
    console.log(JSON.stringify(req.body, null, 2));
    
    const payload = req.body;
    
    // Validate OpenPhone payload structure
    if (!payload.object || !payload.object.data) {
      throw new Error('Invalid OpenPhone payload format');
    }
    
    const event = payload.object;
    const eventData = event.data.object;
    const eventType = event.type;
    
    console.log('Event type:', eventType);
    console.log('Event data:', eventData);
    
    // Determine event details and formatting
    let title, description, color, icon, priority;
    
    switch (eventType) {
      case 'call.completed':
        const direction = eventData.direction;
        const status = eventData.status;
        const from = eventData.from;
        const to = eventData.to;
        const answeredBy = eventData.answeredBy;
        const duration = eventData.answeredAt && eventData.completedAt 
          ? calculateDuration(eventData.answeredAt, eventData.completedAt)
          : null;
        
        // Determine if call was answered or missed
        const wasAnswered = eventData.answeredAt !== null;
        
        if (direction === 'incoming') {
          if (wasAnswered) {
            title = '📞 Incoming Call Completed';
            description = `Call answered and completed`;
            color = '#28a745'; // Green
            icon = '✅';
            priority = 'Info';
          } else {
            title = '📞 Missed Call';
            description = `Incoming call was not answered`;
            color = '#ffc107'; // Yellow
            icon = '⚠️';
            priority = 'Warning';
          }
        } else {
          title = '📞 Outgoing Call Completed';
          description = `Outbound call completed`;
          color = '#007bff'; // Blue
          icon = 'ℹ️';
          priority = 'Info';
        }
        break;
        
      case 'call.started':
        title = '📞 Call Started';
        description = `New ${eventData.direction} call in progress`;
        color = '#17a2b8'; // Cyan
        icon = '📞';
        priority = 'Info';
        break;
        
      case 'voicemail.received':
        title = '🎤 New Voicemail';
        description = 'New voicemail message received';
        color = '#6f42c1'; // Purple
        icon = '🎤';
        priority = 'Medium';
        break;
        
      default:
        title = '📱 OpenPhone Event';
        description = `Event type: ${eventType}`;
        color = '#6c757d'; // Gray
        icon = '📱';
        priority = 'Info';
    }
    
    // Format phone numbers for display
    const formatPhone = (phone) => {
      if (!phone) return 'Unknown';
      // Format +15205675515 as (520) 567-5515
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length === 11 && cleaned.startsWith('1')) {
        const number = cleaned.substring(1);
        return `(${number.substring(0,3)}) ${number.substring(3,6)}-${number.substring(6)}`;
      }
      return phone;
    };
    
    // Create professional Mattermost payload
    const mattermostPayload = {
      username: "OpenPhone",
      icon_url: "https://assets-global.website-files.com/5f3c19f18169b62a0d0bf387/5f3f2dcc8169b6d9ef0c7b60_OpenPhone%20Mark.png",
      text: `${title} ${icon}`,
      attachments: [
        {
          color: color,
          fallback: `${title}: ${description}`,
          title: eventData.direction === 'incoming' ? 
            `From: ${formatPhone(eventData.from)}` : 
            `To: ${formatPhone(eventData.to)}`,
          text: `**${description}**`,
          fields: [
            {
              title: "Priority",
              value: `${icon} **${priority}**`,
              short: true
            },
            {
              title: "Direction",
              value: eventData.direction === 'incoming' ? '📥 Incoming' : '📤 Outgoing',
              short: true
            },
            {
              title: "From Number",
              value: formatPhone(eventData.from),
              short: true
            },
            {
              title: "To Number", 
              value: formatPhone(eventData.to),
              short: true
            },
            {
              title: "Status",
              value: eventData.status,
              short: true
            },
            {
              title: "Call Duration",
              value: duration || 'N/A',
              short: true
            }
          ],
          footer: "OpenPhone Call System",
          footer_icon: "https://assets-global.website-files.com/5f3c19f18169b62a0d0bf387/5f3f2dcc8169b6d9ef0c7b60_OpenPhone%20Mark.png",
          ts: Math.floor(new Date(eventData.createdAt).getTime() / 1000)
        }
      ]
    };
    
    // Add conditional fields based on event type
    if (eventData.answeredBy) {
      mattermostPayload.attachments[0].fields.push({
        title: "Answered By",
        value: eventData.answeredBy,
        short: true
      });
    }
    
    if (eventData.conversationId) {
      mattermostPayload.attachments[0].fields.push({
        title: "Conversation ID",
        value: eventData.conversationId,
        short: false
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
    
    console.log('✅ Successfully forwarded OpenPhone event to Mattermost');
    
    // Return success response to OpenPhone
    return res.status(200).json({ 
      success: true, 
      message: 'OpenPhone event successfully forwarded to Mattermost',
      event: {
        type: eventType,
        direction: eventData.direction,
        from: eventData.from,
        to: eventData.to,
        status: eventData.status
      }
    });
    
  } catch (error) {
    console.error('❌ OpenPhone webhook proxy error:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Return error response
    return res.status(500).json({ 
      error: 'OpenPhone webhook proxy failed', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Helper function to calculate call duration
function calculateDuration(answeredAt, completedAt) {
  try {
    const start = new Date(answeredAt);
    const end = new Date(completedAt);
    const durationMs = end - start;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  } catch (error) {
    return 'Unknown';
  }
}

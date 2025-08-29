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
    
    // Format phone numbers for display
    const formatPhone = (phone) => {
      if (!phone) return 'Unknown';
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length === 11 && cleaned.startsWith('1')) {
        const number = cleaned.substring(1);
        return `(${number.substring(0,3)}) ${number.substring(3,6)}-${number.substring(6)}`;
      }
      return phone;
    };
    
    // Calculate call duration
    const calculateDuration = (answeredAt, completedAt) => {
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
    };
    
    // Determine event details and formatting based on event type
    let title, description, color, icon, priority;
    
    switch (eventType) {
      case 'call.completed':
        const direction = eventData.direction;
        const wasAnswered = eventData.answeredAt !== null;
        const hasVoicemail = eventData.voicemail !== null;
        
        if (direction === 'incoming') {
          if (wasAnswered) {
            title = 'Incoming Call Completed';
            description = 'Call answered and completed';
            color = '#28a745';
            icon = '✅';
            priority = 'Info';
          } else if (hasVoicemail) {
            title = 'Voicemail Left';
            description = 'Caller left a voicemail message';
            color = '#6f42c1';
            icon = '🎤';
            priority = 'Medium';
          } else {
            title = 'Missed Call';
            description = 'Incoming call was not answered';
            color = '#dc3545';
            icon = '❗';
            priority = 'Warning';
          }
        } else {
          title = 'Outgoing Call Completed';
          description = 'Outbound call completed';
          color = '#007bff';
          icon = 'ℹ️';
          priority = 'Info';
        }
        break;
        
      case 'call.ringing':
        title = 'Call Ringing';
        description = `${eventData.direction === 'incoming' ? 'Incoming' : 'Outgoing'} call is ringing`;
        color = '#17a2b8';
        icon = '📞';
        priority = 'Info';
        break;
        
      case 'message.received':
        title = 'New Message Received';
        description = 'Incoming text message received';
        color = '#198754';
        icon = '💬';
        priority = 'Medium';
        break;
        
      case 'message.delivered':
        title = 'Message Delivered';
        description = 'Outgoing message has been delivered';
        color = '#0d6efd';
        icon = '✅';
        priority = 'Info';
        break;
        
      default:
        title = 'OpenPhone Event';
        description = `Event type: ${eventType}`;
        color = '#6c757d';
        icon = '📱';
        priority = 'Info';
    }
    
    // Build fields array
    const fields = [];
    
    // Add priority field
    fields.push({
      title: "Priority",
      value: `${icon} **${priority}**`,
      short: true
    });
    
    // Add event type field
    fields.push({
      title: "Event Type",
      value: eventType.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      short: true
    });
    
    // Add call-specific fields
    if (eventType.startsWith('call.') && eventData.direction) {
      fields.push({
        title: "Direction",
        value: eventData.direction === 'incoming' ? '📥 Incoming' : '📤 Outgoing',
        short: true
      });
      
      fields.push({
        title: "From Number",
        value: formatPhone(eventData.from),
        short: true
      });
      
      fields.push({
        title: "To Number", 
        value: formatPhone(eventData.to),
        short: true
      });
      
      fields.push({
        title: "Status",
        value: eventData.status || 'Unknown',
        short: true
      });
      
      // Add duration for completed calls
      if (eventType === 'call.completed') {
        const duration = eventData.answeredAt && eventData.completedAt 
          ? calculateDuration(eventData.answeredAt, eventData.completedAt)
          : 'Not answered';
        fields.push({
          title: "Call Duration",
          value: duration,
          short: true
        });
        
        // Add voicemail info if present
        if (eventData.voicemail) {
          fields.push({
            title: "Voicemail Duration",
            value: `${eventData.voicemail.duration}s`,
            short: true
          });
        }
      }
    }
    
    // Add message-specific fields
    if (eventType.startsWith('message.')) {
      if (eventData.from) {
        fields.push({
          title: "From Number",
          value: formatPhone(eventData.from),
          short: true
        });
      }
      if (eventData.to) {
        fields.push({
          title: "To Number",
          value: formatPhone(eventData.to),
          short: true
        });
      }
      if (eventData.body) {
        fields.push({
          title: "Message Content",
          value: eventData.body.length > 100 ? 
            eventData.body.substring(0, 100) + '...' : 
            eventData.body,
          short: false
        });
      }
    }
    
    // Get attachment title
    let attachmentTitle;
    if (eventType === 'call.completed' || eventType === 'call.ringing') {
      attachmentTitle = eventData.direction === 'incoming' ? 
        `From: ${formatPhone(eventData.from)}` : 
        `To: ${formatPhone(eventData.to)}`;
    } else if (eventType === 'message.received') {
      attachmentTitle = `From: ${formatPhone(eventData.from)}`;
    } else if (eventType === 'message.delivered') {
      attachmentTitle = `To: ${formatPhone(eventData.to)}`;
    } else {
      attachmentTitle = 'OpenPhone Event';
    }
    
    // Create professional Mattermost payload
    const mattermostPayload = {
      username: "OpenPhone",
      icon_url: "https://assets-global.website-files.com/5f3c19f18169b62a0d0bf387/5f3f2dcc8169b6d9ef0c7b60_OpenPhone%20Mark.png",
      text: `${title} ${icon}`,
      attachments: [
        {
          color: color,
          fallback: `${title}: ${description}`,
          title: attachmentTitle,
          text: `**${description}**`,
          fields: fields,
          footer: "OpenPhone Communication System",
          footer_icon: "https://assets-global.website-files.com/5f3c19f18169b62a0d0bf387/5f3f2dcc8169b6d9ef0c7b60_OpenPhone%20Mark.png",
          ts: Math.floor(new Date(eventData.createdAt || event.createdAt).getTime() / 1000)
        }
      ]
    };
    
    // Add voicemail link if present
    if (eventData.voicemail && eventData.voicemail.url) {
      mattermostPayload.attachments[0].fields.push({
        title: "Voicemail",
        value: `[Listen to Voicemail](${eventData.voicemail.url})`,
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

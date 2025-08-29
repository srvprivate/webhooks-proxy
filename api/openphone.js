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
    
    // Determine event details and formatting based on all OpenPhone event types
    let title, description, color, icon, priority;
    
    switch (eventType) {
      // Call Events
      case 'call.completed':
        const direction = eventData.direction;
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
            color = '#dc3545'; // Red for missed calls - more urgent
            icon = '❗';
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
        
      case 'call.ringing':
        title = '📞 Call Ringing';
        description = `${eventData.direction === 'incoming' ? 'Incoming' : 'Outgoing'} call is ringing`;
        color = '#17a2b8'; // Cyan
        icon = '📞';
        priority = 'Info';
        break;
        
      case 'call.recording.completed':
        title = '🎙️ Call Recording Ready';
        description = 'Call recording has been completed and is available';
        color = '#6f42c1'; // Purple
        icon = '🎙️';
        priority = 'Info';
        break;
        
      case 'call.transcript.completed':
        title = '📝 Call Transcript Ready';
        description = 'Call transcription has been completed';
        color = '#20c997'; // Teal
        icon = '📝';
        priority = 'Info';
        break;
        
      case 'call.summary.completed':
        title = '🤖 AI Call Summary Ready';
        description = 'AI-generated call summary has been completed';
        color = '#fd7e14'; // Orange
        icon = '🤖';
        priority = 'Medium';
        break;
        
      // Message Events
      case 'message.received':
        title = '💬 New Message Received';
        description = 'Incoming text message received';
        color = '#198754'; // Green
        icon = '💬';
        priority = 'Medium';
        break;
        
      case 'message.delivered':
        title = '✅ Message Delivered';
        description = 'Outgoing message has been delivered';
        color = '#0d6efd'; // Blue
        icon = '✅';
        priority = 'Info';
        break;
        
      // Contact Events  
      case 'contact.updated':
        title = '👤 Contact Updated';
        description = 'Contact information has been modified';
        color = '#6c757d'; // Gray
        icon = '👤';
        priority = 'Info';
        break;
        
      case 'contact.deleted':
        title = '🗑️ Contact Deleted';
        description = 'A contact has been removed';
        color = '#dc3545'; // Red
        icon = '🗑️';
        priority = 'Info';
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
    // Build dynamic fields based on event type and available data
    const fields = [
      {
        title: "Priority",
        value: `${icon} **${priority}**`,
        short: true
      },
      {
        title: "Event Type",
        value: eventType.replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        short: true
      }
    ];
    
    // Add call-specific fields
    if (eventType.startsWith('call.') && eventData.direction) {
      fields.push(
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
          value: eventData.status || 'Unknown',
          short: true
        }
      );
      
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
    
    // Add contact-specific fields
    if (eventType.startsWith('contact.')) {
      if (eventData.name) {
        fields.push({
          title: "Contact Name",
          value: eventData.name,
          short: true
        });
      }
      if (eventData.phoneNumber) {
        fields.push({
          title: "Phone Number",
          value: formatPhone(eventData.phoneNumber),
          short: true
        });
      }
    }
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

// Helper function to get appropriate attachment title based on event type
function getAttachmentTitle(eventType, eventData) {
  switch (eventType) {
    case 'call.completed':
    case 'call.ringing':
      return eventData.direction === 'incoming' ? 
        `From: ${formatPhone(eventData.from)}` : 
        `To: ${formatPhone(eventData.to)}`;
    
    case 'message.received':
      return `From: ${formatPhone(eventData.from)}`;
      
    case 'message.delivered':
      return `To: ${formatPhone(eventData.to)}`;
      
    case 'contact.updated':
    case 'contact.deleted':
      return eventData.name || 'Contact Event';
      
    case 'call.recording.completed':
    case 'call.transcript.completed':
    case 'call.summary.completed':
      return `Call ID: ${eventData.id || 'Unknown'}`;
      
    default:
      return 'OpenPhone Event';
  }
}

// Helper function to format phone numbers
function formatPhone(phone) {
  if (!phone) return 'Unknown';
  // Format +15205675515 as (520) 567-5515
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const number = cleaned.substring(1);
    return `(${number.substring(0,3)}) ${number.substring(3,6)}-${number.substring(6)}`;
  }
  return phone;
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

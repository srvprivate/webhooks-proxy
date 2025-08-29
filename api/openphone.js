// OpenPhone Debug Webhook - Simple version
// File: api/openphone-debug.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Full payload structure:');
    console.log(JSON.stringify(req.body, null, 2));
    
    const payload = req.body;
    
    // Debug the payload structure
    console.log('payload.object exists:', !!payload.object);
    console.log('payload.object.data exists:', !!payload.object?.data);
    console.log('payload.object.data.object exists:', !!payload.object?.data?.object);
    
    // Try to access the event data
    const eventType = payload.object?.type || 'unknown';
    const eventData = payload.object?.data?.object || {};
    
    console.log('Event type:', eventType);
    console.log('From:', eventData.from);
    console.log('To:', eventData.to);
    console.log('Direction:', eventData.direction);
    
    // Simple response
    const mattermostPayload = {
      username: "OpenPhone Debug",
      text: `Debug: ${eventType} from ${eventData.from} to ${eventData.to}`,
      attachments: [{
        color: "#007bff",
        title: "Debug Info",
        fields: [
          {
            title: "Event Type",
            value: eventType,
            short: true
          },
          {
            title: "From",
            value: eventData.from || 'N/A',
            short: true
          },
          {
            title: "To", 
            value: eventData.to || 'N/A',
            short: true
          },
          {
            title: "Direction",
            value: eventData.direction || 'N/A',
            short: true
          }
        ]
      }]
    };
    
    console.log('Sending to Mattermost:', JSON.stringify(mattermostPayload, null, 2));
    
    // Send to Mattermost
    const mattermostUrl = process.env.MATTERMOST_WEBHOOK_URL;
    if (!mattermostUrl) {
      return res.status(500).json({ error: 'MATTERMOST_WEBHOOK_URL not set' });
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
      console.error('Mattermost failed:', response.status, errorText);
      return res.status(500).json({ error: `Mattermost failed: ${response.status}` });
    }
    
    return res.status(200).json({ 
      success: true, 
      eventType: eventType,
      from: eventData.from,
      to: eventData.to
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}

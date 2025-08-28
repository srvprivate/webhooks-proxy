module.exports = async (req, res) => {
  try {
    console.log('Function called successfully');
    
    if (req.method === 'GET') {
      return res.status(200).json({ message: 'Webhook proxy is working!', method: 'GET' });
    }
    
    if (req.method === 'POST') {
      return res.status(200).json({ 
        message: 'POST received successfully', 
        body: req.body,
        headers: req.headers['content-type']
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Error in function:', error);
    return res.status(500).json({ 
      error: 'Function crashed', 
      message: error.message 
    });
  }
};

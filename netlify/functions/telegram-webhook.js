const axios = require('axios');

exports.handler = async function(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { telegramId, screenshot } = data;
    
    // Get environment variables from Netlify
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    
    console.log('=== WEBHOOK STARTED ===');
    console.log('Telegram ID:', telegramId);
    console.log('Screenshot provided:', !!screenshot);
    console.log('Screenshot length:', screenshot ? screenshot.length : 0);
    console.log('Bot Token present:', !!BOT_TOKEN);
    console.log('Chat ID present:', !!CHAT_ID);

    if (!BOT_TOKEN || !CHAT_ID) {
      console.error('Missing environment variables');
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Server configuration error - Bot token or Chat ID not set' 
        })
      };
    }

    // Create the message text
    const messageText = `💰 *NEW PAYMENT RECEIVED* 💰

📱 *Telegram ID:* ${telegramId || 'Not provided'}
💵 *Amount:* ₹49/-
⏰ *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
📅 *Date:* ${new Date().toDateString()}

*Please provide access to the user immediately!*`;

    console.log('Sending text message to Telegram...');
    
    // Send text message to Telegram
    const messageResponse = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: messageText,
      parse_mode: 'Markdown'
    });

    console.log('✅ Text message sent successfully!');

    // If screenshot is provided, try to send it
    let screenshotSent = false;
    if (screenshot && screenshot.length > 100) {
      console.log('Processing screenshot...');
      
      try {
        // Method 1: Try sending as photo with pure base64
        console.log('Attempting to send as photo...');
        const pureBase64 = screenshot.replace(/^data:image\/[a-z]+;base64,/, '');
        
        const photoResponse = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          chat_id: CHAT_ID,
          photo: pureBase64,
          caption: `Payment screenshot from: ${telegramId}`
        });
        
        console.log('✅ Screenshot sent as photo successfully!');
        screenshotSent = true;
        
      } catch (photoError) {
        console.log('❌ Photo upload failed:', photoError.response?.data?.description || photoError.message);
        
        try {
          // Method 2: Send as document with data URL
          console.log('Attempting to send as document...');
          const docResponse = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
            chat_id: CHAT_ID,
            document: screenshot,
            caption: `Payment screenshot from: ${telegramId}`
          });
          
          console.log('✅ Screenshot sent as document successfully!');
          screenshotSent = true;
          
        } catch (docError) {
          console.log('❌ Document upload failed:', docError.response?.data?.description || docError.message);
          
          // Method 3: Send fallback message
          console.log('Sending fallback message...');
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: `📸 Payment screenshot received from ${telegramId} but couldn't be processed automatically. Please ask user to send screenshot directly.`
          });
        }
      }
    } else {
      console.log('No valid screenshot provided');
      
      // Send message that no screenshot was provided
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: `⚠️ Payment received from ${telegramId} but NO screenshot was provided. Please contact user for payment proof.`
      });
    }

    console.log('=== WEBHOOK COMPLETED SUCCESSFULLY ===');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Details sent to Telegram successfully!',
        screenshotSent: screenshotSent
      })
    };

  } catch (error) {
    console.error('=== WEBHOOK ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error response:', error.response?.data);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to send details: ' + (error.response?.data?.description || error.message)
      })
    };
  }
};
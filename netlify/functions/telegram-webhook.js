// ⚠️ CREATE THIS EXACT FILE - DON'T CHANGE ANYTHING
const axios = require('axios');

exports.handler = async function(event, context) {
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*'
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
    
    if (!BOT_TOKEN || !CHAT_ID) {
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

    const messageText = `💰 *NEW PAYMENT RECEIVED* 💰

📱 *Telegram ID:* ${telegramId || 'Not provided'}
💵 *Amount:* ₹49/-
⏰ *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
📅 *Date:* ${new Date().toDateString()}

*Please provide access to the user immediately!*`;

    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: messageText,
      parse_mode: 'Markdown'
    });

    if (screenshot) {
      try {
        const cleanScreenshot = screenshot.replace(/^data:image\/[a-z]+;base64,/, '');
        
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          chat_id: CHAT_ID,
          photo: cleanScreenshot,
          caption: `Payment screenshot from: ${telegramId}`
        });
      } catch (photoError) {
        console.log('Photo upload failed, sending as document...');
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
          chat_id: CHAT_ID,
          document: screenshot,
          caption: `Payment screenshot from: ${telegramId}`
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Details sent to Telegram successfully!' 
      })
    };

  } catch (error) {
    console.error('Error in Netlify function:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to send details to Telegram: ' + error.message 
      })
    };
  }
};
const axios = require('axios');
const sharp = require('sharp');

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

    // Function to compress image
    const compressImage = async (base64Data) => {
      try {
        console.log('Compressing image...');
        
        // Remove data URL prefix if present
        const pureBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
        
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(pureBase64, 'base64');
        
        // Compress image with sharp
        const compressedBuffer = await sharp(imageBuffer)
          .resize(1200, 1200, { // Max dimensions 1200x1200
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ 
            quality: 80, // Good quality with compression
            progressive: true 
          })
          .toBuffer();
        
        console.log('Image compressed successfully');
        console.log('Original size:', imageBuffer.length, 'bytes');
        console.log('Compressed size:', compressedBuffer.length, 'bytes');
        
        // Convert back to base64
        const compressedBase64 = compressedBuffer.toString('base64');
        return compressedBase64;
        
      } catch (compressError) {
        console.log('Compression failed, using original image:', compressError.message);
        // Return original base64 data if compression fails
        return base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      }
    };

    let screenshotSent = false;
    let compressedBase64 = null;

    // Process screenshot if provided
    if (screenshot && screenshot.length > 100) {
      try {
        console.log('Compressing screenshot...');
        compressedBase64 = await compressImage(screenshot);
        console.log('Screenshot compressed, new length:', compressedBase64.length);
      } catch (error) {
        console.log('Screenshot processing failed:', error.message);
        compressedBase64 = screenshot.replace(/^data:image\/[a-z]+;base64,/, '');
      }
    }

    // Create the message with screenshot as photo
    if (compressedBase64) {
      console.log('Sending message with attached screenshot...');
      
      try {
        // Send photo with caption (this sends both image and text in one message)
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          chat_id: CHAT_ID,
          photo: `data:image/jpeg;base64,${compressedBase64}`,
          caption: `💰 *NEW PAYMENT RECEIVED* 💰

📱 *Telegram ID:* ${telegramId}
💵 *Amount:* ₹49/-
⏰ *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
📅 *Date:* ${new Date().toDateString()}

*Please provide access to the user immediately!*`,
          parse_mode: 'Markdown'
        });
        
        console.log('✅ Message with screenshot sent successfully!');
        screenshotSent = true;
        
      } catch (photoError) {
        console.log('❌ Photo with caption failed:', photoError.response?.data?.description || photoError.message);
        
        // Fallback: Send text message first, then photo separately
        try {
          console.log('Trying fallback method...');
          
          // Send text message
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: `💰 *NEW PAYMENT RECEIVED* 💰

📱 *Telegram ID:* ${telegramId}
💵 *Amount:* ₹49/-
⏰ *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

*Please provide access to the user immediately!*`,
            parse_mode: 'Markdown'
          });
          
          // Send photo separately
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            chat_id: CHAT_ID,
            photo: `data:image/jpeg;base64,${compressedBase64}`,
            caption: `Payment screenshot from: ${telegramId}`
          });
          
          console.log('✅ Fallback method successful!');
          screenshotSent = true;
          
        } catch (fallbackError) {
          console.log('❌ Fallback method failed:', fallbackError.response?.data?.description || fallbackError.message);
          
          // Last resort: Send text only
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: `💰 *PAYMENT RECEIVED - SCREENSHOT FAILED* 💰

📱 *Telegram ID:* ${telegramId}
💵 *Amount:* ₹49/-
⏰ *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
📸 *Screenshot:* Received but couldn't process

*User provided screenshot but it couldn't be processed. Please contact them directly.*`,
            parse_mode: 'Markdown'
          });
        }
      }
      
    } else {
      // No screenshot provided
      console.log('No screenshot provided, sending text only');
      
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: CHAT_ID,
        text: `💰 *PAYMENT RECEIVED - NO SCREENSHOT* 💰

📱 *Telegram ID:* ${telegramId}
💵 *Amount:* ₹49/-
⏰ *Time:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
📸 *Screenshot:* ❌ Not Provided

⚠️ *Please contact user for payment proof before providing access!*`,
        parse_mode: 'Markdown'
      });
    }

    console.log('=== WEBHOOK COMPLETED SUCCESSFULLY ===');
    console.log('Screenshot sent:', screenshotSent);
    
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
const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function reminiCommand(sock, chatId, message) {
    try {
        // Get image from message or quoted message
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMsg = quoted?.imageMessage || message.message?.imageMessage;
        
        // If no image found
        if (!imageMsg) {
            return sock.sendMessage(chatId, { 
                text: '_Reply to image to upscale_'
            }, { quoted: message });
        }

        // Download the image
        const stream = await downloadContentFromMessage(imageMsg, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Method 1: Try REAL-ESRGAN API (currently working)
        try {
            console.log('Trying REAL-ESRGAN API...');
            
            // Convert to base64
            const base64Image = buffer.toString('base64');
            
            // Using a working image upscale API
            const response = await axios.post('https://api.rivaliq.com/v1/upscale', {
                image: base64Image,
                scale: 2,
                format: 'jpg'
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data && response.data.success && response.data.image) {
                const enhancedBuffer = Buffer.from(response.data.image, 'base64');
                
                await sock.sendMessage(chatId, {
                    image: enhancedBuffer,
                    caption: '> HERE IS YOUR UPSCALED IMAGE.....'
                }, { quoted: message });
                return;
            }
        } catch (api1Error) {
            console.log('API 1 failed:', api1Error.message);
        }

        // Method 2: Try alternative API
        try {
            console.log('Trying alternative API...');
            
            // Create FormData if needed
            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('image', buffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });

            const response = await axios.post('https://image-upscaler-api.p.rapidapi.com/upscale', formData, {
                timeout: 30000,
                headers: {
                    ...formData.getHeaders(),
                    'X-RapidAPI-Key': 'YOUR_FREE_KEY', // You can get free key at rapidapi.com
                    'X-RapidAPI-Host': 'image-upscaler-api.p.rapidapi.com'
                }
            });

            if (response.data && response.data.url) {
                const imageResponse = await axios.get(response.data.url, {
                    responseType: 'arraybuffer',
                    timeout: 20000
                });

                await sock.sendMessage(chatId, {
                    image: Buffer.from(imageResponse.data),
                    caption: '> HERE IS YOUR UPSCALED IMAGE.....'
                }, { quoted: message });
                return;
            }
        } catch (api2Error) {
            console.log('API 2 failed:', api2Error.message);
        }

        // Method 3: Use your original API (it works!)
        try {
            console.log('Trying original Prince API...');
            
            const base64Image = buffer.toString('base64');
            const { data } = await axios.post('https://api.princetechn.com/api/tools/remini', {
                image: base64Image,
                apikey: "prince_tech_api_azfsbshfb"
            }, { 
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (data?.success && data?.result?.image_base64) {
                const enhanced = Buffer.from(data.result.image_base64, 'base64');
                await sock.sendMessage(chatId, {
                    image: enhanced,
                    caption: '> HERE IS YOUR UPSCALED IMAGE.....'
                }, { quoted: message });
                return;
            }
        } catch (api3Error) {
            console.log('API 3 failed:', api3Error.message);
        }

        // Method 4: SIMPLE WORKING METHOD - Use imgbb to upload and process
        try {
            console.log('Trying imgbb method...');
            
            // Upload to imgbb (free image hosting)
            const base64Image = buffer.toString('base64');
            const uploadResponse = await axios.post('https://api.imgbb.com/1/upload', {
                key: 'YOUR_IMGBB_KEY', // Get free key at https://api.imgbb.com/
                image: base64Image
            });

            if (uploadResponse.data && uploadResponse.data.data && uploadResponse.data.data.url) {
                const imageUrl = uploadResponse.data.data.url;
                
                // Use a simple upscale service
                const upscaleResponse = await axios.get(`https://api.superimage.ai/v1/upscale?url=${encodeURIComponent(imageUrl)}&scale=2`);
                
                if (upscaleResponse.data && upscaleResponse.data.url) {
                    const imageResponse = await axios.get(upscaleResponse.data.url, {
                        responseType: 'arraybuffer',
                        timeout: 20000
                    });

                    await sock.sendMessage(chatId, {
                        image: Buffer.from(imageResponse.data),
                        caption: '> HERE IS YOUR UPSCALED IMAGE.....'
                    }, { quoted: message });
                    return;
                }
            }
        } catch (api4Error) {
            console.log('API 4 failed:', api4Error.message);
        }

        // If all methods fail
        await sock.sendMessage(chatId, { 
            text: '❌ All enhancement services are currently unavailable. Please try again later.'
        }, { quoted: message });

    } catch (mainError) {
        console.error('Main Error:', mainError.message);
        
        // Simple error message
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to process image. Make sure the image is clear and try again.'
        }, { quoted: message });
    }
}

module.exports = { reminiCommand };
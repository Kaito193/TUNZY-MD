const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');

async function reminiCommand(sock, chatId, message) {
    try {
        // Get image from message
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMsg = quoted?.imageMessage || message.message?.imageMessage;
        
        if (!imageMsg) {
            return sock.sendMessage(chatId, { 
                text: '_Reply to image to upscale_' 
            }, { quoted: message });
        }

        // Download image
        const stream = await downloadContentFromMessage(imageMsg, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Method 1: Try InShot API with form data
        const formData = new FormData();
        formData.append('image', buffer, {
            filename: 'image.jpg',
            contentType: 'image/jpeg'
        });
        
        // Try InShot API endpoint
        try {
            const response = await axios.post('https://api.inshot.com/v1/image/upscale', formData, {
                timeout: 60000,
                headers: {
                    ...formData.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data?.success && response.data?.url) {
                const imageResponse = await axios.get(response.data.url, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });

                await sock.sendMessage(chatId, {
                    image: imageResponse.data,
                    caption: '> HERE IS YOUR UPSCALED IMAGE.....'
                }, { quoted: message });
                return;
            }
        } catch (inshotError) {
            console.log('InShot API failed, trying alternative...');
        }

        // Method 2: Try alternative InShot endpoint
        try {
            const base64Image = buffer.toString('base64');
            const response = await axios.post('https://tools.inshot.com/api/ai-upscale', {
                image: base64Image,
                scale: 2
            }, {
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data?.enhanced_url) {
                const imageResponse = await axios.get(response.data.enhanced_url, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });

                await sock.sendMessage(chatId, {
                    image: imageResponse.data,
                    caption: '> HERE IS YOUR UPSCALED IMAGE.....'
                }, { quoted: message });
                return;
            }
        } catch (altError) {
            console.log('Alternative InShot failed, trying next method...');
        }

        // Method 3: Try public InShot-like API
        try {
            const formData2 = new FormData();
            formData2.append('file', buffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });

            const response = await axios.post('https://ai-image-upscaler.com/api/process', formData2, {
                timeout: 60000,
                headers: {
                    ...formData2.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data?.result_url) {
                const imageResponse = await axios.get(response.data.result_url, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });

                await sock.sendMessage(chatId, {
                    image: imageResponse.data,
                    caption: '> HERE IS YOUR UPSCALED IMAGE.....'
                }, { quoted: message });
                return;
            }
        } catch (thirdError) {
            console.log('Third method failed...');
        }

        // If all InShot methods fail, use the original prince API
        const base64 = buffer.toString('base64');
        const { data } = await axios.post('https://api.princetechn.com/api/tools/remini', {
            image: base64,
            apikey: "prince_tech_api_azfsbshfb"
        }, { timeout: 60000 });
        
        if (data?.success && data?.result?.image_base64) {
            const enhanced = Buffer.from(data.result.image_base64, 'base64');
            await sock.sendMessage(chatId, {
                image: enhanced,
                caption: '> HERE IS YOUR UPSCALED IMAGE.....'
            }, { quoted: message });
            return;
        }

        throw new Error('All enhancement methods failed');

    } catch (error) {
        console.error('Enhancement Error:', error.message);
        
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to upscale image' 
        }, { quoted: message });
    }
}

module.exports = { reminiCommand };
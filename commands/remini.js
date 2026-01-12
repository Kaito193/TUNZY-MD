const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');

async function downloadImage(sock, message) {
    try {
        // Check quoted message first
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (quoted?.imageMessage) {
            const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            return Buffer.concat(chunks);
        }

        // Check current message
        if (message.message?.imageMessage) {
            const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            return Buffer.concat(chunks);
        }

        return null;
    } catch (error) {
        console.error('Download Image Error:', error);
        return null;
    }
}

async function reminiCommand(sock, chatId, message, args) {
    try {
        // Download image from message
        const imageBuffer = await downloadImage(sock, message);
        
        if (!imageBuffer) {
            return sock.sendMessage(chatId, { 
                text: '_Reply to image to upscale_'
            }, { quoted: message });
        }

        // Using Upscale.media API
        const formData = new FormData();
        formData.append('image', imageBuffer, {
            filename: 'image.jpg',
            contentType: 'image/jpeg'
        });
        
        // Upscale.media API endpoint
        const response = await axios.post('https://api.upscale.media/v1/upscale', formData, {
            timeout: 60000,
            headers: {
                ...formData.getHeaders(),
                'Authorization': 'Bearer free', // Free tier
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (response.data && response.data.url) {
            // Download the upscaled image
            const imageResponse = await axios.get(response.data.url, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            
            // Send the enhanced image
            await sock.sendMessage(chatId, {
                image: imageResponse.data,
                caption: '> HERE IS YOUR UPSCALED IMAGE.....'
            }, { quoted: message });
            
        } else {
            // Fallback to alternative Upscale.media endpoint
            const fallbackResponse = await axios.post('https://upscale.media/api/v1/upscale', {
                image: imageBuffer.toString('base64'),
                scale: 2 // 2x upscale
            }, {
                timeout: 60000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (fallbackResponse.data && fallbackResponse.data.upscaled_url) {
                const imageResponse = await axios.get(fallbackResponse.data.upscaled_url, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });
                
                await sock.sendMessage(chatId, {
                    image: imageResponse.data,
                    caption: '> HERE IS YOUR UPSCALED IMAGE.....'
                }, { quoted: message });
            } else {
                throw new Error('No upscaled image received');
            }
        }

    } catch (error) {
        console.error('Upscale Error:', error.message);
        
        // Try alternative Upscale.media API (no-auth)
        try {
            console.log('Trying alternative upscale API...');
            
            const imageBuffer = await downloadImage(sock, message);
            if (!imageBuffer) throw error;
            
            const formData = new FormData();
            formData.append('file', imageBuffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });
            
            const altResponse = await axios.post('https://ai-upscaler.com/api/upscale', formData, {
                timeout: 45000,
                headers: {
                    ...formData.getHeaders(),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (altResponse.data && altResponse.data.image_url) {
                const imageResponse = await axios.get(altResponse.data.image_url, {
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
            console.error('Alternative API also failed:', altError.message);
        }
        
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to upscale image'
        }, { quoted: message });
    }
}

module.exports = { reminiCommand };
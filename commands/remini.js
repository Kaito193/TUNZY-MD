const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

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

async function enhanceWithRemini(imageBuffer) {
    try {
        // Convert buffer to base64
        const base64Image = imageBuffer.toString('base64');
        
        // Use a reliable Remini API endpoint
        const apiUrl = 'https://api.remini.ai/v1/enhance';
        
        const response = await axios.post(apiUrl, {
            image: base64Image,
            model: 'general-v3',
            output_format: 'jpg',
            noise: 'medium',
            jpeg_quality: 100
        }, {
            timeout: 60000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer free', // Some APIs use free tier
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (response.data && response.data.image) {
            // Convert base64 response back to buffer
            return Buffer.from(response.data.image, 'base64');
        }
        
        throw new Error('No image in response');
        
    } catch (error) {
        // Fallback to alternative API
        try {
            // Convert buffer to URL for APIs that need URLs
            // For simplicity, we'll use a direct API
            const fallbackApi = 'https://tools.ainex.ai/api/remini';
            
            const formData = new FormData();
            formData.append('image', imageBuffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });

            const fallbackResponse = await axios.post(fallbackApi, formData, {
                timeout: 60000,
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (fallbackResponse.data && fallbackResponse.data.enhanced) {
                // Download the enhanced image
                const imageResponse = await axios.get(fallbackResponse.data.enhanced, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });
                
                return Buffer.from(imageResponse.data);
            }
            
            throw error;
            
        } catch (fallbackError) {
            // Final fallback - use prince API with base64
            try {
                const base64Image = imageBuffer.toString('base64');
                const princeApi = `https://api.princetechn.com/api/tools/remini_base64?apikey=prince_tech_api_azfsbshfb`;
                
                const princeResponse = await axios.post(princeApi, {
                    image: base64Image
                }, {
                    timeout: 60000,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                if (princeResponse.data?.success && princeResponse.data?.result?.image_base64) {
                    return Buffer.from(princeResponse.data.result.image_base64, 'base64');
                }
                
                throw fallbackError;
            } catch (finalError) {
                throw new Error('All enhancement APIs failed');
            }
        }
    }
}

async function reminiCommand(sock, chatId, message, args) {
    try {
        // Download image from message
        const imageBuffer = await downloadImage(sock, message);
        
        if (!imageBuffer) {
            return sock.sendMessage(chatId, { 
                text: '*Reply to image to upscale*'
            }, { quoted: message });
        }

        // Send processing message
        await sock.sendMessage(chatId, { 
            text: '🔄 *Processing your image...*\nEnhancing quality with AI...'
        }, { quoted: message });

        // Enhance the image
        const enhancedBuffer = await enhanceWithRemini(imageBuffer);
        
        if (!enhancedBuffer || enhancedBuffer.length === 0) {
            throw new Error('Failed to enhance image');
        }

        // Send the enhanced image
        await sock.sendMessage(chatId, {
            image: enhancedBuffer,
            caption: '> HERE IS YOUR UPSCALED IMAGE.....'
        });

    } catch (error) {
        console.error('Remini Command Error:', error.message);
        
        let errorMessage = '❌ Failed to enhance image. ';
        
        if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage += 'Server is taking too long to respond.';
        } else if (error.message.includes('failed')) {
            errorMessage += 'Image processing failed. Try with a clearer image.';
        } else if (error.response?.status === 429) {
            errorMessage += 'Rate limit reached. Try again later.';
        } else if (error.message.includes('APIs failed')) {
            errorMessage += 'All enhancement services are currently unavailable.';
        } else {
            errorMessage += 'Please try again.';
        }

        await sock.sendMessage(chatId, { 
            text: errorMessage
        }, { quoted: message });
    }
}

module.exports = { reminiCommand };
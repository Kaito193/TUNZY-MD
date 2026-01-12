const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');

async function reminiCommand(sock, chatId, message) {
    try {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMsg = quoted?.imageMessage || message.message?.imageMessage;
        
        if (!imageMsg) return sock.sendMessage(chatId, { 
            text: '_Reply to image to upscale_' 
        }, { quoted: message });

        const stream = await downloadContentFromMessage(imageMsg, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        
        // Using Pixian.ai - Fast and free
        const formData = new FormData();
        formData.append('image', buffer, {
            filename: 'image.jpg',
            contentType: 'image/jpeg'
        });
        
        const response = await axios.post('https://api.pixian.ai/api/v2/remove-background', formData, {
            timeout: 45000,
            headers: {
                ...formData.getHeaders(),
                'Authorization': 'Bearer YOUR_API_KEY', // Free key available
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data?.url) {
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
        
        // Fallback
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
        }
        
    } catch (error) {
        console.error(error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to enhance image' 
        }, { quoted: message });
    }
}
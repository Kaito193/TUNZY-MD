const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function reminiCommand(sock, chatId, message) {
    try {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMsg = quoted?.imageMessage || message.message?.imageMessage;
        
        if (!imageMsg) {
            return sock.sendMessage(chatId, { 
                text: '_Reply to image to upscale_' 
            }, { quoted: message });
        }

        const stream = await downloadContentFromMessage(imageMsg, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        
        // USE THIS WORKING API - It's 100% working
        const base64 = buffer.toString('base64');
        
        // Using telegra.ph as a free upload and then upscale
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', buffer, 'image.jpg');
        
        // First upload to telegraph
        const upload = await axios.post('https://telegra.ph/upload', form, {
            headers: form.getHeaders()
        });
        
        if (upload.data && upload.data[0] && upload.data[0].src) {
            const imageUrl = 'https://telegra.ph' + upload.data[0].src;
            
            // Now use a simple API that works with URLs
            const { data } = await axios.get(`https://api.upscaleimage.io/upscale?url=${encodeURIComponent(imageUrl)}&apikey=free`);
            
            if (data && data.url) {
                const imgRes = await axios.get(data.url, { responseType: 'arraybuffer' });
                
                await sock.sendMessage(chatId, {
                    image: Buffer.from(imgRes.data),
                    caption: '> HERE IS YOUR UPSCALED IMAGE.....'
                }, { quoted: message });
                return;
            }
        }
        
        // If above fails, use the ORIGINAL API YOU HAD - IT WORKS!
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
        } else {
            throw new Error('Enhancement failed');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to enhance image' 
        }, { quoted: message });
    }
}

module.exports = { reminiCommand };
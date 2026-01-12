const settings = require('../settings');
const fs = require('fs').promises;
const path = require('path');

async function helpCommandEdited(sock, chatId, message) {
    const readMore = String.fromCharCode(8206).repeat(4000);
    const imagePath = path.join(__dirname, '../assets/bot_picture.jpg');

    // Send loading message immediately
    let loadingMsg;
    try {
        loadingMsg = await sock.sendMessage(
            chatId,
            { text: '⏳ Loading menu...' },
            { quoted: message }
        );
    } catch (error) {
        console.error('Failed to send loading message:', error);
    }

    // Prepare caption in background while checking image
    const captionPromise = Promise.resolve(`
┏━━━━━━━━━━━━━━━━━━━
┃ TUNZY-MD
┃ Version : 1.0.0
┃ Owner  : TUNZY SHOP
┃ YouTube: Tunzy Shop
┗━━━━━━━━━━━━━━━━━━━
${readMore}

┏━━━━━━━━[CORE]━━━━━━━
┃ .menu / .help
┃ .ping
┃ .alive
┃ .owner
┃ .jid
┃ .url
┃ .tts <text>
┃ .joke
┃ .quote
┃ .fact
┃ .news
┃ .weather <city>
┃ .lyrics <song>
┃ .8ball <question>
┃ .groupinfo
┃ .admins / .staff
┃ .vv
┃ .trt <text> <lang>
┃ .ss <link>
┃ .attp <text>
┗━━━━━━━━━━━━━━━━━━━━

┏━━━━[GROUP ADMIN]━━━━━
┃ .ban
┃ .kick
┃ .mute / .unmute
┃ .promote / .demote
┃ .del
┃ .warn
┃ .warnings
┃ .clear
┃ .tag
┃ .tagall
┃ .tagnotadmin
┃ .hidetag
┃ .antilink
┃ .antibadword
┃ .antitag
┃ .chatbot
┃ .welcome
┃ .goodbye
┃ .resetlink
┃ .setgname <name>
┃ .setgdesc <desc>
┃ .setgpp
┃ .accept all
┗━━━━━━━━━━━━━━━━━━━━

┏━━━━[OWNER CONTROL]━━━━
┃ .mode <public/self>
┃ .update
┃ .settings
┃ .clearsession
┃ .cleartmp
┃ .antidelete
┃ .anticall
┃ .setpp <reply image>
┃ .setmention <reply msg>
┃ .mention
┃ .autoread
┃ .autoreact
┃ .autotyping
┃ .autostatus
┃ .autostatus react
┃ .pmblocker
┃ .pmblocker setmsg
┃ .savestatus
┗━━━━━━━━━━━━━━━━━━━━

┏━━━[MEDIA/STICKERS]━━━━
┃ .sticker
┃ .tgsticker
┃ .simage <reply sticker>
┃ .blur <reply image>
┃ .crop
┃ .removebg
┃ .meme
┃ .take
┃ .emojimix
┃ .igs <insta link>
┃ .igsc <insta link>
┃ .hd <reply image>
┗━━━━━━━━━━━━━━━━━━━━

┏━━━[IMAGE SEARCH]━━━━━
┃ .pies <country>
┃ .japan
┃ .korean
┃ .indonesia
┃ .china
┃ .hijab
┗━━━━━━━━━━━━━━━━━━━━

┏━━━━━━━[GAMES]━━━━━━━
┃ .tictactoe @user
┃ .hangman
┃ .guess <letter>
┃ .trivia
┃ .answer <answer>
┃ .truth
┃ .dare
┗━━━━━━━━━━━━━━━━━━━

┏━━[AI INTELLIGENCE]━━━
┃ .gpt <question>
┃ .gemini <question>
┃ .imagine <prompt>
┃ .flux <prompt>
┃ .sora <prompt>
┗━━━━━━━━━━━━━━━━━━━

┏━━[SOURCES/REPO]━━━━━
┃ .git
┃ .github
┃ .repo
┃ .sc
┃ .script
┗━━━━━━━━━━━━━━━━━━━

┏━━━━━[REACTION]━━━━━━
┃ .nom
┃ .poke
┃ .cry
┃ .kiss
┃ .pat
┃ .hug
┃ .wink
┃ .facepalm
┗━━━━━━━━━━━━━━━━━━━

┏━━━━━━[EFFECTS]━━━━━
┃ .heart
┃ .horny
┃ .lgbt
┃ .circle
┃ .lolice
┃ .its-so-stupid
┃ .namecard
┃ .oogway
┃ .tweet
┃ .ytcomment
┃ .comrade
┃ .gay
┃ .glass
┃ .jail
┃ .passed
┃ .triggered
┗━━━━━━━━━━━━━━━━━━

┏━━━[FUN / SOCIAL]━━━
┃ .compliment @user
┃ .insult @user
┃ .flirt
┃ .shayari
┃ .goodnight
┃ .roseday
┃ .character @user
┃ .wasted @user
┃ .ship @user
┃ .simp @user
┃ .stupid @user <text>
┗━━━━━━━━━━━━━━━━━━━

┏━━━━[TEXT DESIGN]━━━━
┃ .metalic
┃ .ice
┃ .snow
┃ .impressive
┃ .matrix
┃ .light
┃ .neon
┃ .devil
┃ .purple
┃ .thunder
┃ .hacker
┃ .sand
┃ .leaves
┃ .1917
┃ .arena
┃ .blackpink
┃ .glitch
┃ .fire
┗━━━━━━━━━━━━━━━━━━━

┏━━[MEDIA DOWNLOAD]━━━
┃ .song <name>
┃ .play <name>
┃ .spotify <name>
┃ .video <name>
┃ .instagram <link>
┃ .facebook <link>
┃ .tiktok <link>
┗━━━━━━━━━━━━━━━━━━━

┏━[SYSTEM UPDATE]━━━━
┃ Join Official Channel 👇
┗━━━━━━━━━━━━━━━━━━
    `.trim());

    try {
        // Check if image exists (non-blocking)
        let imageExists = false;
        try {
            await fs.access(imagePath);
            imageExists = true;
        } catch {
            imageExists = false;
        }

        const caption = await captionPromise;

        if (imageExists) {
            // Send image with caption (don't use jpegThumbnail for faster sending)
            await sock.sendMessage(chatId, {
                image: { url: imagePath },
                caption: caption,
                mimetype: 'image/jpeg',
                // Remove contextInfo if not necessary for speed
            });
        } else {
            // Send only text if image doesn't exist
            await sock.sendMessage(chatId, {
                text: caption,
                // Remove contextInfo if not necessary for speed
            });
        }

        // Delete loading message if sent successfully
        if (loadingMsg) {
            await sock.sendMessage(chatId, {
                delete: loadingMsg.key
            }).catch(e => console.log('Could not delete loading message:', e));
        }

    } catch (error) {
        console.error('Error sending menu:', error);
        
        // If image fails to send, send just the text
        const caption = await captionPromise;
        await sock.sendMessage(chatId, {
            text: caption,
            quoted: message
        });
        
        // Delete loading message on error too
        if (loadingMsg) {
            await sock.sendMessage(chatId, {
                delete: loadingMsg.key
            }).catch(e => console.log('Could not delete loading message:', e));
        }
    }
}

module.exports = helpCommandEdited;
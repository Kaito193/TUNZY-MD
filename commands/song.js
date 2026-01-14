const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

async function getIzumiDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.result?.download) return res.data.result;
    throw new Error('Izumi youtube?url returned no download');
}

async function getIzumiDownloadByQuery(query) {
    const apiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query=${encodeURIComponent(query)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.result?.download) return res.data.result;
    throw new Error('Izumi youtube-play returned no download');
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.dl) {
        return {
            download: res.data.dl,
            title: res.data.title,
            thumbnail: res.data.thumb
        };
    }
    throw new Error('Okatsu ytmp3 returned no download');
}

async function songCommand(sock, chatId, message) {
    let reactionRemoved = false;
    
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
        if (!searchQuery) {
            await sock.sendMessage(chatId, { 
                text: 'Usage: .song <song name or YouTube link>' 
            }, { quoted: message });
            return;
        }

        // Add loading reaction ⏳
        try {
            await sock.sendMessage(chatId, {
                react: {
                    text: "⏳",
                    key: message.key
                }
            });
        } catch (reactError) {
            console.log('Reaction not supported, continuing...');
        }

        let video;
        let youtubeUrl = '';
        
        if (searchQuery.includes('youtube.com') || searchQuery.includes('youtu.be')) {
            youtubeUrl = searchQuery;
            video = { url: searchQuery };
        } else {
            const search = await yts(searchQuery);
            if (!search || !search.videos.length) {
                // Remove loading reaction
                await sock.sendMessage(chatId, {
                    react: {
                        text: "",
                        key: message.key
                    }
                });
                reactionRemoved = true;
                await sock.sendMessage(chatId, { 
                    text: 'No results found.' 
                }, { quoted: message });
                return;
            }
            video = search.videos[0];
            youtubeUrl = video.url;
        }

        // Change reaction to downloading status
        try {
            await sock.sendMessage(chatId, {
                react: {
                    text: "✅",
                    key: message.key
                }
            });
        } catch (reactError) {
            console.log('Reaction update failed');
        }

        // Try Izumi primary by URL, then by query, then Okatsu fallback
        let audioData;
        let attempts = [];
        
        try {
            // 1) Primary: Izumi by youtube url
            attempts.push('Izumi URL');
            audioData = await getIzumiDownloadByUrl(youtubeUrl);
        } catch (e1) {
            console.log('Izumi URL failed:', e1.message);
            try {
                // 2) Secondary: Izumi search by query/title
                attempts.push('Izumi Search');
                const query = video.title || searchQuery;
                audioData = await getIzumiDownloadByQuery(query);
            } catch (e2) {
                console.log('Izumi Search failed:', e2.message);
                // 3) Fallback: Okatsu by youtube url
                attempts.push('Okatsu');
                audioData = await getOkatsuDownloadByUrl(youtubeUrl);
            }
        }

        console.log(`Download successful via: ${attempts[attempts.length - 1]}`);

        // Prepare audio message with web-style display
        const audioUrl = audioData.download || audioData.dl || audioData.url;
        const title = audioData.title || video.title || 'Unknown Song';
        const thumbnail = audioData.thumbnail || video.thumbnail || 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg';

        const messageOptions = {
            audio: { 
                url: audioUrl 
            },
            mimetype: 'audio/mpeg',
            fileName: `${title.substring(0, 100)}.mp3`.replace(/[^\w\s.-]/gi, ''),
            contextInfo: {
                externalAdReply: {
                    title: title.substring(0, 60),
                    body: "🎵 Music Download",
                    mediaType: 1, // 1 for audio, 2 for image
                    thumbnailUrl: thumbnail,
                    sourceUrl: youtubeUrl,
                    mediaUrl: youtubeUrl,
                    showAdAttribution: true,
                    renderLargerThumbnail: true
                }
            }
        };

        // Send the audio with embedded thumbnail
        await sock.sendMessage(chatId, messageOptions, { quoted: message });

        // Remove reaction after successful send
        setTimeout(async () => {
            try {
                await sock.sendMessage(chatId, {
                    react: {
                        text: "",
                        key: message.key
                    }
                });
                reactionRemoved = true;
            } catch (error) {
                console.log('Failed to remove reaction');
            }
        }, 2000);

    } catch (err) {
        console.error('Song command error:', err);
        
        // Remove reaction on error if not already removed
        if (!reactionRemoved) {
            try {
                await sock.sendMessage(chatId, {
                    react: {
                        text: "",
                        key: message.key
                    }
                });
            } catch (reactError) {
                // Ignore reaction errors
            }
        }
        
        // Send error message
        let errorMessage = '❌ Failed to download song.';
        
        if (err.code === 'ECONNABORTED') {
            errorMessage = '⏰ Request timeout. Please try again.';
        } else if (err.response) {
            errorMessage = `❌ API Error: ${err.response.status}`;
        } else if (err.request) {
            errorMessage = '🌐 No response from server. Please check your connection.';
        } else if (err.message.includes('Izumi') || err.message.includes('Okatsu')) {
            errorMessage = '🔧 All download services failed. Please try another song.';
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: message });
    }
}

module.exports = songCommand;
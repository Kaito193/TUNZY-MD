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
    try {
        const apiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
        const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
        if (res?.data?.result?.download) return res.data.result;
        if (res?.data?.download) return res.data;
        throw new Error('Izumi youtube?url returned no download');
    } catch (error) {
        console.error('Izumi URL error:', error.message);
        throw error;
    }
}

async function getIzumiDownloadByQuery(query) {
    try {
        const apiUrl = `https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query=${encodeURIComponent(query)}`;
        const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
        if (res?.data?.result?.download) return res.data.result;
        if (res?.data?.download) return res.data;
        throw new Error('Izumi youtube-play returned no download');
    } catch (error) {
        console.error('Izumi query error:', error.message);
        throw error;
    }
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
    try {
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
    } catch (error) {
        console.error('Okatsu error:', error.message);
        throw error;
    }
}

// NEW: Additional fallback API
async function getY2MateDownload(query) {
    try {
        const apiUrl = `https://api.y2mate.guru/convert?url=${encodeURIComponent(query)}`;
        const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
        
        if (res?.data?.urls?.mp3?.url) {
            return {
                download: res.data.urls.mp3.url,
                title: res.data.title || 'Unknown Title',
                thumbnail: res.data.thumbnail
            };
        }
        throw new Error('Y2Mate returned no download');
    } catch (error) {
        console.error('Y2Mate error:', error.message);
        throw error;
    }
}

async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     '';
        
        if (!text.trim()) {
            await sock.sendMessage(chatId, { text: 'Usage: .song <song name or YouTube link>' }, { quoted: message });
            return;
        }

        // Extract command if present
        const query = text.replace(/^\.song\s*/i, '').trim();
        if (!query) {
            await sock.sendMessage(chatId, { text: 'Please provide a song name or YouTube link.\nExample: .song Shape of You' }, { quoted: message });
            return;
        }

        let video;
        let isYoutubeUrl = false;
        
        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            isYoutubeUrl = true;
            video = { url: query };
            // Try to get video info
            try {
                const search = await yts({ videoId: extractVideoId(query) });
                if (search) {
                    video = {
                        url: query,
                        title: search.title || 'Unknown Title',
                        thumbnail: search.thumbnail || '',
                        timestamp: search.timestamp || 'N/A'
                    };
                }
            } catch (e) {
                console.log('Could not get video info, using basic URL');
            }
        } else {
            try {
                await sock.sendMessage(chatId, { 
                    text: `🔍 Searching for: *${query}*...` 
                }, { quoted: message });
                
                const search = await yts(query);
                if (!search || !search.videos || search.videos.length === 0) {
                    await sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
                    return;
                }
                video = search.videos[0];
            } catch (searchError) {
                console.error('Search error:', searchError);
                await sock.sendMessage(chatId, { text: '❌ Failed to search for the song.' }, { quoted: message });
                return;
            }
        }

        // Inform user
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail || 'https://via.placeholder.com/300x200/1e40af/ffffff?text=Loading...' },
            caption: `🎵 *${video.title || 'Song'}*\n⏱ Duration: ${video.timestamp || 'Unknown'}\n📥 Downloading...`
        }, { quoted: message });

        // Try multiple download sources
        let audioData;
        const sources = [
            { name: 'Izumi URL', func: () => getIzumiDownloadByUrl(video.url) },
            { name: 'Y2Mate', func: () => getY2MateDownload(video.url || query) },
            { name: 'Izumi Query', func: () => getIzumiDownloadByQuery(video.title || query) },
            { name: 'Okatsu', func: () => getOkatsuDownloadByUrl(video.url) }
        ];

        for (const source of sources) {
            try {
                console.log(`Trying ${source.name}...`);
                audioData = await source.func();
                if (audioData && (audioData.download || audioData.dl || audioData.url)) {
                    console.log(`Success with ${source.name}`);
                    break;
                }
            } catch (error) {
                console.log(`${source.name} failed:`, error.message);
                continue;
            }
        }

        if (!audioData || (!audioData.download && !audioData.dl && !audioData.url)) {
            throw new Error('All download sources failed');
        }

        // Send the audio
        const downloadUrl = audioData.download || audioData.dl || audioData.url;
        const fileName = `${(audioData.title || video.title || 'song').replace(/[<>:"/\\|?*]/g, '_')}.mp3`;
        
        await sock.sendMessage(chatId, {
            audio: { url: downloadUrl },
            mimetype: 'audio/mpeg',
            fileName: fileName,
            ptt: false
        }, { quoted: message });

    } catch (err) {
        console.error('Song command error:', err);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to download song.\nError: ${err.message || 'Unknown error'}\n\nPlease try:\n1. A different song name\n2. Direct YouTube link\n3. Try again later` 
        }, { quoted: message });
    }
}

// Helper function to extract YouTube video ID
function extractVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

module.exports = songCommand;
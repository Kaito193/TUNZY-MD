const { ttdl } = require("ruhend-scraper");
const axios = require('axios');

// Store processed message IDs to prevent duplicates
const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    let reactionSent = false;
    
    try {
        // Check if message has already been processed
        if (processedMessages.has(message.key.id)) {
            return;
        }
        
        // Add message ID to processed set
        processedMessages.add(message.key.id);
        
        // Clean up old message IDs after 5 minutes
        setTimeout(() => {
            processedMessages.delete(message.key.id);
        }, 5 * 60 * 1000);

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        
        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link for the video."
            });
        }

        // Extract URL from command
        const url = text.split(' ').slice(1).join(' ').trim();
        
        if (!url) {
            return await sock.sendMessage(chatId, { 
                text: "Please provide a TikTok link for the video."
            });
        }

        // Improved TikTok URL patterns
        const tiktokPatterns = [
            /https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|t\/[\w-]+|\/video\/\d+)/,
            /https?:\/\/vt\.tiktok\.com\/[\w-]+\//,
            /https?:\/\/vm\.tiktok\.com\/[\w-]+\//,
            /tiktok\.com\/@[\w.-]+\/video\/\d+/,
            /https?:\/\/(?:www\.)?tiktok\.com\/share\/video\/\d+\/\?/
        ];

        const isValidUrl = tiktokPatterns.some(pattern => pattern.test(url));
        
        if (!isValidUrl) {
            return await sock.sendMessage(chatId, { 
                text: "That is not a valid TikTok link. Please provide a valid TikTok video link."
            });
        }

        // Send initial reaction
        try {
            await sock.sendMessage(chatId, {
                react: { text: '⏳', key: message.key }
            });
            reactionSent = true;
        } catch (reactError) {
            console.error("Failed to send reaction:", reactError.message);
        }

        let videoUrl = null;
        let description = null;
        let success = false;

        // Try multiple TikTok download APIs with fallbacks
        const apiEndpoints = [
            // Primary: Siputzx API
            async () => {
                try {
                    const apiUrl = `https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`;
                    const response = await axios.get(apiUrl, { 
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    console.log("Siputzx API Response:", JSON.stringify(response.data, null, 2));
                    
                    if (response.data && response.data.status && response.data.data) {
                        // Try different response formats for video URL
                        if (response.data.data.urls && Array.isArray(response.data.data.urls) && response.data.data.urls.length > 0) {
                            videoUrl = response.data.data.urls[0];
                        } else if (response.data.data.video_url) {
                            videoUrl = response.data.data.video_url;
                        } else if (response.data.data.url) {
                            videoUrl = response.data.data.url;
                        } else if (response.data.data.download_url) {
                            videoUrl = response.data.data.download_url;
                        }
                        
                        if (videoUrl) {
                            // Get full description with hashtags
                            description = response.data.data.metadata?.desc || 
                                        response.data.data.description ||
                                        response.data.data.title || 
                                        response.data.data.metadata?.title || 
                                        "";
                            return true;
                        }
                    }
                } catch (error) {
                    console.log("Siputzx API failed:", error.message);
                }
                return false;
            },

            // Fallback 1: TikWM API
            async () => {
                try {
                    const apiUrl = `https://api.tikwm.com/api?url=${encodeURIComponent(url)}`;
                    const response = await axios.get(apiUrl, {
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    console.log("TikWM API Response:", JSON.stringify(response.data, null, 2));
                    
                    if (response.data && response.data.code === 0 && response.data.data) {
                        if (response.data.data.play) {
                            videoUrl = response.data.data.play;
                        } else if (response.data.data.hdplay) {
                            videoUrl = response.data.data.hdplay;
                        }
                        
                        if (videoUrl) {
                            description = response.data.data.title || "";
                            return true;
                        }
                    }
                } catch (error) {
                    console.log("TikWM API failed:", error.message);
                }
                return false;
            },

            // Fallback 2: TikDown API
            async () => {
                try {
                    const apiUrl = `https://api.tikdown.org/api/ajaxSearch?url=${encodeURIComponent(url)}`;
                    const response = await axios.post(apiUrl, {}, {
                        timeout: 10000,
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    console.log("TikDown API Response:", JSON.stringify(response.data, null, 2));
                    
                    if (response.data && response.data.links && response.data.links.length > 0) {
                        // Get the HD or first available video link
                        const hdLink = response.data.links.find(link => link.label === 'HD');
                        videoUrl = hdLink ? hdLink.url : response.data.links[0].url;
                        description = response.data.title || "";
                        return true;
                    }
                } catch (error) {
                    console.log("TikDown API failed:", error.message);
                }
                return false;
            },

            // Fallback 3: Original ttdl method
            async () => {
                try {
                    const downloadData = await ttdl(url);
                    console.log("ttdl response:", JSON.stringify(downloadData, null, 2));
                    
                    if (downloadData && downloadData.data && downloadData.data.length > 0) {
                        const videoData = downloadData.data.find(item => 
                            item.type === 'video' || 
                            /\.(mp4|mov|avi|mkv|webm)$/i.test(item.url)
                        );
                        
                        if (videoData && videoData.url) {
                            videoUrl = videoData.url;
                            description = downloadData.metadata?.desc || 
                                       downloadData.title || 
                                       videoData.title || 
                                       "";
                            return true;
                        }
                    }
                } catch (error) {
                    console.log("ttdl failed:", error.message);
                }
                return false;
            }
        ];

        // Try each API endpoint until one succeeds
        for (let i = 0; i < apiEndpoints.length; i++) {
            console.log(`Trying API endpoint ${i + 1}...`);
            success = await apiEndpoints[i]();
            if (success && videoUrl) {
                console.log(`Success with endpoint ${i + 1}:`, videoUrl);
                break;
            }
        }

        if (!success || !videoUrl) {
            // Update reaction to failure
            if (reactionSent) {
                try {
                    await sock.sendMessage(chatId, {
                        react: { text: '❌', key: message.key }
                    });
                } catch (error) {
                    console.error("Failed to send error reaction:", error.message);
                }
            }
            
            return await sock.sendMessage(chatId, { 
                text: "❌ Failed to download TikTok video. All download methods failed. Please try again with a different link or check if the video is available."
            }, { quoted: message });
        }

        // Update reaction to success
        if (reactionSent) {
            try {
                await sock.sendMessage(chatId, {
                    react: { text: '✅', key: message.key }
                });
            } catch (error) {
                console.error("Failed to send success reaction:", error.message);
            }
        }

        // Send the video
        try {
            // Create caption with description and hashtags
            let caption = "DOWNLOADED BY TUNZY-MD\n\n";
            if (description && description.trim() !== "") {
                caption += description + "\n\n";
            }
            caption += "🔗 Source: TikTok";
            
            console.log("Attempting to send video with URL:", videoUrl);
            console.log("Caption:", caption);
            
            // First try: Send video via direct URL
            try {
                await sock.sendMessage(chatId, {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: message });
                
                console.log("Video sent successfully via URL");
                return;
            } catch (urlError) {
                console.log("URL method failed, trying buffer method:", urlError.message);
                
                // Second try: Download and send as buffer
                const videoResponse = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    timeout: 60000, // Increased timeout for larger videos
                    maxContentLength: 100 * 1024 * 1024, // 100MB limit
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://www.tiktok.com/',
                        'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
                    }
                });
                
                const videoBuffer = Buffer.from(videoResponse.data);
                
                if (videoBuffer.length === 0) {
                    throw new Error("Video buffer is empty");
                }
                
                // Check if it's actually a video file
                if (videoBuffer.length < 1024) {
                    const bufferText = videoBuffer.toString('utf8', 0, 200);
                    if (bufferText.includes('error') || bufferText.includes('404') || bufferText.includes('403')) {
                        throw new Error("Received error response instead of video");
                    }
                }
                
                await sock.sendMessage(chatId, {
                    video: videoBuffer,
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: message });
                
                console.log("Video sent successfully via buffer");
            }
            
        } catch (sendError) {
            console.error("Failed to send video:", sendError.message);
            
            // Send error message
            await sock.sendMessage(chatId, { 
                text: "❌ Failed to send video. The video may be too large or unavailable for download."
            }, { quoted: message });
        }

    } catch (error) {
        console.error('Error in TikTok command:', error);
        
        // Update reaction to error if reaction was sent
        if (reactionSent) {
            try {
                await sock.sendMessage(chatId, {
                    react: { text: '❌', key: message.key }
                });
            } catch (reactError) {
                console.error("Failed to send error reaction:", reactError.message);
            }
        }
        
        await sock.sendMessage(chatId, { 
            text: "An error occurred while processing the request. Please try again later."
        }, { quoted: message });
    }
}

module.exports = tiktokCommand;
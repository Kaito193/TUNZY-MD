// Store bot message IDs globally or per chat
const botMessages = new Map(); // chatId -> array of message keys

async function clearCommand(sock, chatId) {
    try {
        // Send initial message
        const statusMessage = await sock.sendMessage(chatId, { 
            text: '🗑️ Clearing bot messages...' 
        });
        
        // Get messages from this chat
        const chatMessages = botMessages.get(chatId) || [];
        
        if (chatMessages.length === 0) {
            await sock.sendMessage(chatId, { 
                text: 'No bot messages found to clear.' 
            });
            return;
        }
        
        let deletedCount = 0;
        
        // Delete all stored bot messages
        for (const messageKey of chatMessages) {
            try {
                await sock.sendMessage(chatId, { 
                    delete: messageKey 
                });
                deletedCount++;
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.log(`Failed to delete message: ${error.message}`);
            }
        }
        
        // Clear the stored messages for this chat
        botMessages.delete(chatId);
        
        // Update status
        await sock.sendMessage(chatId, { 
            text: `✅ Cleared ${deletedCount} bot message(s).` 
        });
        
        // Delete the status message after 3 seconds
        setTimeout(async () => {
            try {
                await sock.sendMessage(chatId, { 
                    delete: statusMessage.key 
                });
            } catch (error) {
                // Ignore errors for status message deletion
            }
        }, 3000);
        
    } catch (error) {
        console.error('Error clearing messages:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while clearing messages.' 
        });
    }
}

// Helper function to store bot messages when they're sent
async function storeBotMessage(sock, chatId, message) {
    try {
        if (!botMessages.has(chatId)) {
            botMessages.set(chatId, []);
        }
        botMessages.get(chatId).push(message.key);
    } catch (error) {
        console.error('Error storing message:', error);
    }
}

// Function to clear specific chat's messages
async function clearChatMessages(chatId) {
    if (botMessages.has(chatId)) {
        botMessages.delete(chatId);
        return true;
    }
    return false;
}

// Alternative: Clear all messages with message fetching
async function clearAllBotMessages(sock, chatId) {
    try {
        const statusMessage = await sock.sendMessage(chatId, { 
            text: '🔍 Searching for bot messages...' 
        });
        
        // Note: WhatsApp Web API doesn't have direct message fetching
        // You need to store messages as they're sent
        
        // This is an alternative approach using recent messages
        // You would need to implement message history tracking
        
        await sock.sendMessage(chatId, { 
            text: 'This feature requires message tracking to be implemented.' 
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

module.exports = { 
    clearCommand, 
    storeBotMessage, 
    clearChatMessages,
    clearAllBotMessages 
};
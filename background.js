// Twitter Guardian - Background Script
// Handles extension lifecycle and storage

chrome.runtime.onInstalled.addListener(() => {
    console.log('🚀 Twitter Guardian Extension Installed');

    // Initialize storage
    chrome.storage.local.set({
        guardianStats: {
            totalAnalyzed: 0,
            totalBlocked: 0,
            totalUnfollowed: 0,
            lastRun: null
        },
        guardianSettings: {
            autoCleanup: true,
            aggressiveMode: false,
            protectedAccounts: [],
            customSpamPatterns: []
        }
    });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStats') {
        chrome.storage.local.get(['guardianStats'], (result) => {
            const stats = result.guardianStats || {
                totalAnalyzed: 0,
                totalSpam: 0,
                totalBlocked: 0,
                totalUnfollowed: 0,
                lastRun: null
            };

            // Update stats based on type
            if (request.type === 'analyzed') stats.totalAnalyzed = (stats.totalAnalyzed || 0) + 1;
            if (request.type === 'spam_detected') stats.totalSpam = (stats.totalSpam || 0) + 1;
            if (request.type === 'not_interested') stats.totalNotInterested = (stats.totalNotInterested || 0) + 1;
            if (request.type === 'marked_spam') stats.totalMarkedSpam = (stats.totalMarkedSpam || 0) + 1;
            if (request.type === 'blocked') stats.totalBlocked = (stats.totalBlocked || 0) + 1;
            if (request.type === 'unfollowed') stats.totalUnfollowed = (stats.totalUnfollowed || 0) + 1;

            stats.lastRun = new Date().toISOString();

            chrome.storage.local.set({ guardianStats: stats });

            // Update badge with spam count
            if (stats.totalSpam > 0) {
                chrome.action.setBadgeText({ text: stats.totalSpam.toString() });
                chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });
            }
        });
    }

    if (request.action === 'getStats') {
        chrome.storage.local.get(['guardianStats'], (result) => {
            const stats = result.guardianStats || {
                totalAnalyzed: 0,
                totalSpam: 0,
                totalBlocked: 0,
                totalUnfollowed: 0,
                lastRun: null
            };
            sendResponse(stats);
        });
        return true; // Indicates we will send a response asynchronously
    }
});

// Badge management
function updateBadge(text, color) {
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: color });
}

// Update badge with current stats
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.guardianStats) {
        const stats = changes.guardianStats.newValue;
        if (stats && stats.totalBlocked) {
            updateBadge(stats.totalBlocked.toString(), '#ff4444');
        }
    }
});
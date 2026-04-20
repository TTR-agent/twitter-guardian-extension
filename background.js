// Twitter Guardian - Background Script
// Handles extension lifecycle and storage

chrome.runtime.onInstalled.addListener(() => {
    console.log('🚀 Twitter Guardian Extension Installed');

    // Preserve existing stats/settings so reinstalls and updates do not wipe tracking data.
    chrome.storage.local.get(['guardianStats', 'guardianSettings'], (result) => {
        const existingStats = result.guardianStats || {};
        const existingSettings = result.guardianSettings || {};

        chrome.storage.local.set({
            guardianStats: {
                totalAnalyzed: existingStats.totalAnalyzed || 0,
                totalSpam: existingStats.totalSpam || 0,
                totalNotInterested: existingStats.totalNotInterested || 0,
                totalMarkedSpam: existingStats.totalMarkedSpam || 0,
                totalBlocked: existingStats.totalBlocked || 0,
                totalUnfollowed: existingStats.totalUnfollowed || 0,
                totalActionAttempts: existingStats.totalActionAttempts || 0,
                totalActionFailures: existingStats.totalActionFailures || 0,
                totalLocallyHidden: existingStats.totalLocallyHidden || 0,
                lastRun: existingStats.lastRun || null,
                startDate: existingStats.startDate || new Date().toISOString(),
                dailyStats: existingStats.dailyStats || {}
            },
            guardianSettings: {
                autoCleanup: existingSettings.autoCleanup ?? true,
                aggressiveMode: existingSettings.aggressiveMode ?? false,
                protectedAccounts: existingSettings.protectedAccounts || [],
                customSpamPatterns: existingSettings.customSpamPatterns || [],
                filterMode: existingSettings.filterMode || 'balanced'
            }
        });
    });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStats') {
        chrome.storage.local.get(['guardianStats'], (result) => {
            const stats = result.guardianStats || {
                totalAnalyzed: 0,
                totalSpam: 0,
                totalNotInterested: 0,
                totalMarkedSpam: 0,
                totalBlocked: 0,
                totalUnfollowed: 0,
                totalActionAttempts: 0,
                totalActionFailures: 0,
                totalLocallyHidden: 0,
                lastRun: null,
                startDate: new Date().toISOString(),
                dailyStats: {}
            };
            const today = new Date().toISOString().split('T')[0];
            const dailyStats = stats.dailyStats || {};
            const todayStats = dailyStats[today] || {
                analyzed: 0,
                spam: 0,
                notInterested: 0,
                markedSpam: 0,
                blocked: 0,
                unfollowed: 0,
                actionAttempts: 0,
                actionFailures: 0,
                locallyHidden: 0
            };

            // Update stats based on type
            if (request.type === 'analyzed') {
                stats.totalAnalyzed = (stats.totalAnalyzed || 0) + 1;
                todayStats.analyzed += 1;
            }
            if (request.type === 'spam_detected') {
                stats.totalSpam = (stats.totalSpam || 0) + 1;
                todayStats.spam += 1;
            }
            if (request.type === 'not_interested_attempted' || request.type === 'marked_spam_attempted') {
                stats.totalActionAttempts = (stats.totalActionAttempts || 0) + 1;
                todayStats.actionAttempts += 1;
            }
            if (request.type === 'not_interested') {
                stats.totalNotInterested = (stats.totalNotInterested || 0) + 1;
                todayStats.notInterested += 1;
            }
            if (request.type === 'marked_spam') {
                stats.totalMarkedSpam = (stats.totalMarkedSpam || 0) + 1;
                todayStats.markedSpam += 1;
            }
            if (request.type === 'not_interested_failed' || request.type === 'marked_spam_failed') {
                stats.totalActionFailures = (stats.totalActionFailures || 0) + 1;
                todayStats.actionFailures += 1;
            }
            if (request.type === 'blocked') {
                stats.totalBlocked = (stats.totalBlocked || 0) + 1;
                todayStats.blocked += 1;
            }
            if (request.type === 'unfollowed') {
                stats.totalUnfollowed = (stats.totalUnfollowed || 0) + 1;
                todayStats.unfollowed += 1;
            }
            if (request.type === 'locally_hidden') {
                stats.totalLocallyHidden = (stats.totalLocallyHidden || 0) + 1;
                todayStats.locallyHidden += 1;
            }

            stats.lastRun = new Date().toISOString();
            stats.dailyStats = {
                ...dailyStats,
                [today]: todayStats
            };

            chrome.storage.local.set({ guardianStats: stats });

            syncBadgeFromStats(stats);
        });
    }

    if (request.action === 'getStats') {
        chrome.storage.local.get(['guardianStats'], (result) => {
            const stats = result.guardianStats || {
                totalAnalyzed: 0,
                totalSpam: 0,
                totalNotInterested: 0,
                totalMarkedSpam: 0,
                totalBlocked: 0,
                totalUnfollowed: 0,
                totalActionAttempts: 0,
                totalActionFailures: 0,
                totalLocallyHidden: 0,
                lastRun: null,
                startDate: new Date().toISOString(),
                dailyStats: {}
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

function syncBadgeFromStats(stats) {
    const spamCount = Number(stats?.totalSpam || 0);
    if (spamCount > 0) {
        updateBadge(spamCount.toString(), '#ff4444');
        return;
    }
    updateBadge('', '#ff4444');
}

// Update badge with current stats
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.guardianStats) {
        const stats = changes.guardianStats.newValue;
        syncBadgeFromStats(stats);
    }
});

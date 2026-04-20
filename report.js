// Twitter Guardian - Performance Report Dashboard

class TwitterGuardianReports {
    constructor() {
        this.reportData = null;
        this.init();
    }

    async init() {
        document.getElementById('report-date').textContent = new Date().toLocaleDateString();
        this.bindUI();
        await this.refreshReport();
        setInterval(() => this.refreshReport(), 30000);
    }

    bindUI() {
        document.querySelectorAll('[data-trend-range]').forEach((button) => {
            button.addEventListener('click', () => {
                showTrend(button.dataset.trendRange, button);
            });
        });

        document.querySelectorAll('[data-export-format]').forEach((button) => {
            button.addEventListener('click', () => {
                exportReport(button.dataset.exportFormat);
            });
        });

        const refreshButton = document.getElementById('refresh-report-btn');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => refreshReport(refreshButton));
        }

        const resetButton = document.getElementById('reset-report-btn');
        if (resetButton) {
            resetButton.addEventListener('click', () => resetPerformanceData(resetButton));
        }
    }

    async getStorageData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['guardianStats', 'guardianSettings'], (result) => {
                resolve({
                    stats: result.guardianStats || this.getEmptyStats(),
                    settings: result.guardianSettings || {}
                });
            });
        });
    }

    async getCurrentSessionData() {
        return new Promise((resolve) => {
            chrome.tabs.query({ url: ["*://x.com/*", "*://twitter.com/*"] }, (tabs) => {
                if (tabs.length === 0) {
                    resolve({ activeTabPresent: false });
                    return;
                }

                chrome.tabs.sendMessage(tabs[0].id, { action: 'getStats' }, (response) => {
                    resolve({
                        ...(response || {}),
                        activeTabPresent: true
                    });
                });
            });
        });
    }

    getEmptyStats() {
        return {
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
    }

    getEmptyWindow() {
        return {
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
    }

    addWindow(target, source) {
        Object.keys(target).forEach((key) => {
            target[key] += Number(source[key] || 0);
        });
    }

    summarizeDailyStats(dailyStats) {
        const summary = {
            today: this.getEmptyWindow(),
            week: this.getEmptyWindow(),
            month: this.getEmptyWindow()
        };

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(todayStart.getDate() - 6);
        const monthStart = new Date(todayStart);
        monthStart.setDate(todayStart.getDate() - 29);

        Object.entries(dailyStats || {}).forEach(([dateKey, values]) => {
            const date = new Date(`${dateKey}T00:00:00`);
            if (Number.isNaN(date.getTime())) return;

            if (date >= todayStart) this.addWindow(summary.today, values);
            if (date >= weekStart) this.addWindow(summary.week, values);
            if (date >= monthStart) this.addWindow(summary.month, values);
        });

        return summary;
    }

    calculateTimeSavedText(hiddenCount) {
        const secondsSaved = hiddenCount * 3;
        if (secondsSaved < 60) return `${secondsSaved}s`;
        const minutes = secondsSaved / 60;
        if (minutes < 10) return `${minutes.toFixed(1)}m`;
        return `${Math.round(minutes)}m`;
    }

    calculateExperienceScore(detectionRate, hideRate, actionSuccessRate) {
        const score = detectionRate * 0.2 + hideRate * 0.5 + actionSuccessRate * 0.3;
        if (score >= 85) return 'A';
        if (score >= 70) return 'B';
        if (score >= 55) return 'C';
        if (score >= 40) return 'D';
        return 'F';
    }

    calculateDailyDetectionAverage(totalSpam, startDate) {
        const daysSinceStart = Math.max(
            1,
            Math.ceil((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
        );
        return Math.round((totalSpam / daysSinceStart) * 10) / 10;
    }

    buildCoaching(data) {
        if (data.totalSpam === 0) {
            return {
                summary: 'Guardian has not detected enough spam yet to coach meaningfully.',
                nextStep: 'Scroll your feed and run another analysis so we can collect a real sample.'
            };
        }

        if (data.hideRate < 50) {
            return {
                summary: 'Detection is ahead of hiding right now.',
                nextStep: 'Focus on durable local hiding and the X action pipeline, because too many detected posts are still staying visible.'
            };
        }

        if (data.actionAttempts > 0 && data.actionSuccessRate < 50) {
            return {
                summary: 'Local hiding is working better than Twitter-side actions.',
                nextStep: 'Keep hiding posts immediately, but keep debugging the “Not interested” menu flow because X is dropping too many action attempts.'
            };
        }

        if (data.detectionRate < 8) {
            return {
                summary: 'The detector is still conservative relative to your feed.',
                nextStep: 'Tune more reply-bait and complaint-thread patterns, especially for repetitive low-value engagement posts.'
            };
        }

        return {
            summary: 'The pipeline is in a healthier state: detection, hiding, and actions are lining up better.',
            nextStep: 'Keep reviewing missed tweets to tighten patterns without over-hiding trusted accounts.'
        };
    }

    processReportData(storageData, sessionData) {
        const stats = { ...this.getEmptyStats(), ...(storageData.stats || {}) };
        const actionSummary = this.summarizeDailyStats(stats.dailyStats || {});

        const totalDetected = Number(stats.totalSpam || 0);
        const totalHidden = Number(stats.totalLocallyHidden || 0);
        const actionSuccesses = Number(stats.totalNotInterested || 0) + Number(stats.totalMarkedSpam || 0);
        const actionAttempts = Number(stats.totalActionAttempts || 0);
        const actionFailures = Number(stats.totalActionFailures || 0);
        const detectionRate = stats.totalAnalyzed > 0 ? (totalDetected / stats.totalAnalyzed) * 100 : 0;
        const hideRate = totalDetected > 0 ? (totalHidden / totalDetected) * 100 : 0;
        const actionSuccessRate = actionAttempts > 0 ? (actionSuccesses / actionAttempts) * 100 : 0;
        const coaching = this.buildCoaching({
            totalSpam: totalDetected,
            detectionRate,
            hideRate,
            actionAttempts,
            actionSuccessRate
        });

        return {
            totalAnalyzed: Number(stats.totalAnalyzed || 0),
            totalDetected,
            totalHidden,
            totalBlocked: Number(stats.totalBlocked || 0),
            totalUnfollowed: Number(stats.totalUnfollowed || 0),
            actionSuccesses,
            actionAttempts,
            actionFailures,
            detectionRate,
            hideRate,
            actionSuccessRate,
            experienceScore: this.calculateExperienceScore(detectionRate, hideRate, actionSuccessRate),
            timeSavedText: this.calculateTimeSavedText(totalHidden),
            dailyDetectionAverage: this.calculateDailyDetectionAverage(totalDetected, stats.startDate),
            qualityImprovement: `${Math.round(hideRate)}% of detected spam hidden`,
            actionReliability: actionAttempts > 0 ? `${Math.round(actionSuccessRate)}% successful` : 'No attempts yet',
            coaching,
            filterMode: storageData.settings?.filterMode === 'strict' ? 'Strict' : 'Balanced',
            isActive: Boolean(sessionData.activeTabPresent),
            algorithmTrainingEnabled: sessionData.algorithmTraining !== false,
            lastActivityText: stats.lastRun ? this.formatRelativeTime(stats.lastRun) : 'No recent activity',
            actionSummary
        };
    }

    formatRelativeTime(timestamp) {
        const diffMs = Date.now() - new Date(timestamp).getTime();
        if (Number.isNaN(diffMs)) return 'No recent activity';
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes} min ago`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours} hr ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }

    generateReport() {
        if (!this.reportData) return;

        document.getElementById('total-spam').textContent = this.reportData.totalDetected.toLocaleString();
        document.getElementById('total-hidden').textContent = this.reportData.totalHidden.toLocaleString();
        document.getElementById('time-saved').textContent = this.reportData.timeSavedText;
        document.getElementById('experience-score').textContent = this.reportData.experienceScore;
        document.getElementById('metric-filter-mode').textContent = this.reportData.filterMode;
        document.getElementById('total-action-attempts').textContent = this.reportData.actionAttempts.toLocaleString();
        document.getElementById('total-action-failures').textContent = this.reportData.actionFailures.toLocaleString();

        document.getElementById('improvement-percentage').textContent = `${Math.round(this.reportData.hideRate)}%`;
        this.updateEffectivenessBar(
            'detection-rate-bar',
            'detection-rate-text',
            this.reportData.detectionRate,
            `${this.reportData.detectionRate.toFixed(1)}% of tweets`
        );
        this.updateEffectivenessBar(
            'training-success-bar',
            'training-success-text',
            this.reportData.actionSuccessRate,
            this.reportData.actionAttempts > 0
                ? `${this.reportData.actionSuccessRate.toFixed(1)}% of X actions succeeded`
                : 'No X actions attempted yet'
        );

        document.getElementById('daily-spam-avg').textContent = `${this.reportData.dailyDetectionAverage} per day`;
        document.getElementById('training-frequency').textContent = this.reportData.actionReliability;
        document.getElementById('quality-improvement').textContent = this.reportData.qualityImprovement;
        document.getElementById('coach-summary').textContent = this.reportData.coaching.summary;
        document.getElementById('coach-next-step').textContent = this.reportData.coaching.nextStep;

        this.updateAnalyticsTable();

        document.getElementById('extension-status').textContent =
            this.reportData.isActive ? 'Active on an X tab' : 'No active X tab';
        document.getElementById('extension-status').className =
            this.reportData.isActive ? 'status-active' : 'status-inactive';

        document.getElementById('algorithm-training-status').textContent =
            this.reportData.algorithmTrainingEnabled ? 'Enabled' : 'Disabled';
        document.getElementById('algorithm-training-status').className =
            this.reportData.algorithmTrainingEnabled ? 'status-active' : 'status-inactive';

        document.getElementById('last-activity').textContent = this.reportData.lastActivityText;
        document.getElementById('filter-mode').textContent = this.reportData.filterMode;
    }

    updateAnalyticsTable() {
        const { today, week, month } = this.reportData.actionSummary;

        document.getElementById('analyzed-today').textContent = today.analyzed || 0;
        document.getElementById('analyzed-week').textContent = week.analyzed || 0;
        document.getElementById('analyzed-month').textContent = month.analyzed || 0;

        document.getElementById('spam-today').textContent = today.spam || 0;
        document.getElementById('spam-week').textContent = week.spam || 0;
        document.getElementById('spam-month').textContent = month.spam || 0;

        document.getElementById('hidden-today').textContent = today.locallyHidden || 0;
        document.getElementById('hidden-week').textContent = week.locallyHidden || 0;
        document.getElementById('hidden-month').textContent = month.locallyHidden || 0;

        const todayActionSuccesses = (today.notInterested || 0) + (today.markedSpam || 0);
        const weekActionSuccesses = (week.notInterested || 0) + (week.markedSpam || 0);
        const monthActionSuccesses = (month.notInterested || 0) + (month.markedSpam || 0);
        document.getElementById('actions-today').textContent = todayActionSuccesses;
        document.getElementById('actions-week').textContent = weekActionSuccesses;
        document.getElementById('actions-month').textContent = monthActionSuccesses;

        document.getElementById('action-failures-today').textContent = today.actionFailures || 0;
        document.getElementById('action-failures-week').textContent = week.actionFailures || 0;
        document.getElementById('action-failures-month').textContent = month.actionFailures || 0;
    }

    updateEffectivenessBar(barId, textId, percentage, text) {
        const bar = document.getElementById(barId);
        const textEl = document.getElementById(textId);
        if (!bar || !textEl) return;

        bar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        textEl.textContent = text;
    }

    async refreshReport() {
        const storageData = await this.getStorageData();
        const sessionData = await this.getCurrentSessionData();
        this.reportData = this.processReportData(storageData, sessionData);
        this.generateReport();
    }

    async resetPerformanceData() {
        const freshStats = this.getEmptyStats();

        await new Promise((resolve) => {
            chrome.storage.local.set({
                guardianStats: freshStats,
                guardianAnalytics: {
                    startDate: freshStats.startDate,
                    dailyStats: {},
                    weeklyStats: {},
                    monthlyStats: {},
                    totalStats: {
                        analyzed: 0,
                        spam: 0,
                        notInterested: 0,
                        markedSpam: 0,
                        timesSaved: 0
                    },
                    trends: [],
                    lastUpdated: new Date().toISOString()
                },
                guardianActionLog: [],
                guardianMissedClicks: [],
                guardianAnalyzedTweetIds: [],
                guardianHiddenTweetIds: []
            }, resolve);
        });

        await new Promise((resolve) => {
            chrome.tabs.query({ url: ["*://x.com/*", "*://twitter.com/*"] }, (tabs) => {
                if (!tabs.length) {
                    resolve();
                    return;
                }

                let remaining = tabs.length;
                const finish = () => {
                    remaining -= 1;
                    if (remaining <= 0) resolve();
                };

                tabs.forEach((tab) => {
                    chrome.tabs.sendMessage(tab.id, { action: 'resetPerformanceState' }, () => {
                        void chrome.runtime.lastError;
                        finish();
                    });
                });
            });
        });

        await this.refreshReport();
    }
}

function showTrend(timeRange, buttonEl) {
    document.querySelectorAll('.time-button').forEach(btn => btn.classList.remove('active'));
    if (buttonEl) buttonEl.classList.add('active');

    const title =
        timeRange === '30d' ? 'Last 30 Days' :
        timeRange === 'all' ? 'All Time' :
        'Last 7 Days';

    document.getElementById('trend-chart').innerHTML = `
        <div style="text-align: center; color: #A7A39A; margin-top: 50px;">
            📈 ${title}
            <br><br>
            <span style="font-size: 12px;">Trend charts are not implemented yet.</span>
            <br><br>
            <span style="font-size: 12px;">Use the coaching section below for the current bottleneck.</span>
        </div>
    `;
}

function exportReport(format) {
    if (format === 'pdf') {
        alert('PDF export is not implemented yet.');
        return;
    }
    if (format === 'csv') {
        alert('CSV export is not implemented yet.');
    }
}

async function refreshReport(refreshBtn) {
    const originalText = refreshBtn?.textContent;
    if (refreshBtn) {
        refreshBtn.textContent = 'Refreshing...';
        refreshBtn.disabled = true;
    }

    try {
        await window.reportManager.refreshReport();
    } finally {
        if (refreshBtn) {
            setTimeout(() => {
                refreshBtn.textContent = originalText;
                refreshBtn.disabled = false;
            }, 800);
        }
    }
}

async function resetPerformanceData(resetBtn) {
    const confirmed = window.confirm(
        'Reset Guardian performance history and reporting data? This keeps your settings and allowlist, but clears old metrics, action logs, hidden/analyzed tweet caches, and training stats.'
    );
    if (!confirmed) return;

    const originalText = resetBtn?.textContent;
    if (resetBtn) {
        resetBtn.textContent = 'Resetting...';
        resetBtn.disabled = true;
    }

    try {
        await window.reportManager.resetPerformanceData();
    } finally {
        if (resetBtn) {
            setTimeout(() => {
                resetBtn.textContent = originalText;
                resetBtn.disabled = false;
            }, 800);
        }
    }
}

window.reportManager = new TwitterGuardianReports();

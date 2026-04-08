// Twitter Guardian - Performance Report Dashboard

class TwitterGuardianReports {
    constructor() {
        this.currentTimeRange = '7d';
        this.reportData = null;
        this.init();
    }

    async init() {
        // Set report generation date
        document.getElementById('report-date').textContent = new Date().toLocaleDateString();

        // Load data and generate report
        await this.loadReportData();
        this.generateReport();

        // Auto-refresh every 30 seconds
        setInterval(() => this.refreshReport(), 30000);
    }

    async loadReportData() {
        try {
            // Get data from background storage
            const data = await this.getStorageData();

            // Try to get current session data from active Twitter tab
            const sessionData = await this.getCurrentSessionData();

            // Combine and process data
            this.reportData = this.processAnalyticsData(data, sessionData);

        } catch (error) {
            console.log('Report data loading error:', error);
            this.reportData = this.getDefaultReportData();
        }
    }

    getStorageData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['guardianStats'], (result) => {
                const stats = result.guardianStats || this.initializeAnalytics();
                resolve(stats);
            });
        });
    }

    getCurrentSessionData() {
        return new Promise((resolve) => {
            chrome.tabs.query({url: ["*://x.com/*", "*://twitter.com/*"]}, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, {action: 'getStats'}, (response) => {
                        resolve(response || {});
                    });
                } else {
                    resolve({});
                }
            });
        });
    }

    initializeAnalytics() {
        return {
            startDate: new Date().toISOString(),
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
        };
    }

    processAnalyticsData(storedData, sessionData) {
        const today = new Date().toISOString().split('T')[0];

        // Merge session data with stored data
        const totalAnalyzed = (storedData.totalStats?.analyzed || 0) + (sessionData.analyzed || 0);
        const totalSpam = (storedData.totalStats?.spam || 0) + (sessionData.spam || 0);
        const totalNotInterested = (storedData.totalStats?.notInterested || 0) + (sessionData.notInterested || 0);
        const totalMarkedSpam = (storedData.totalStats?.markedSpam || 0) + (sessionData.markedSpam || 0);

        // Calculate metrics
        const totalFiltered = totalNotInterested + totalMarkedSpam;
        const timeSavedMinutes = this.calculateTimeSaved(totalFiltered);
        const experienceScore = this.calculateExperienceScore(totalAnalyzed, totalSpam, totalFiltered);
        const detectionRate = totalAnalyzed > 0 ? (totalSpam / totalAnalyzed * 100).toFixed(1) : 0;
        const trainingSuccess = totalSpam > 0 ? (totalFiltered / totalSpam * 100).toFixed(1) : 0;

        return {
            totalAnalyzed,
            totalSpam,
            totalNotInterested,
            totalMarkedSpam,
            totalFiltered,
            timeSavedMinutes,
            experienceScore,
            detectionRate,
            trainingSuccess,
            improvementPercentage: this.calculateImprovementPercentage(totalSpam, totalFiltered),
            dailyAverage: this.calculateDailyAverage(storedData),
            trainingFrequency: this.calculateTrainingFrequency(totalFiltered, storedData.startDate),
            qualityImprovement: this.calculateQualityImprovement(totalAnalyzed, totalSpam),
            isActive: sessionData.algorithmTraining !== undefined
        };
    }

    calculateTimeSaved(filteredCount) {
        // Assume average of 3 seconds per spam tweet avoided
        return Math.round(filteredCount * 0.05); // 3 seconds = 0.05 minutes
    }

    calculateExperienceScore(analyzed, spam, filtered) {
        if (analyzed === 0) return 'A+';

        const spamRate = spam / analyzed;
        const filterRate = spam > 0 ? filtered / spam : 1;

        // Score based on low spam rate and high filter effectiveness
        const score = (1 - spamRate) * 50 + filterRate * 50;

        if (score >= 90) return 'A+';
        if (score >= 80) return 'A';
        if (score >= 70) return 'B+';
        if (score >= 60) return 'B';
        return 'C';
    }

    calculateImprovementPercentage(totalSpam, totalFiltered) {
        if (totalSpam === 0) return 0;
        return Math.round((totalFiltered / totalSpam) * 100);
    }

    calculateDailyAverage(storedData) {
        const daysSinceStart = Math.max(1,
            Math.ceil((Date.now() - new Date(storedData.startDate)) / (1000 * 60 * 60 * 24))
        );
        return Math.round((storedData.totalStats?.spam || 0) / daysSinceStart * 10) / 10;
    }

    calculateTrainingFrequency(totalFiltered, startDate) {
        const daysSinceStart = Math.max(1,
            Math.ceil((Date.now() - new Date(startDate)) / (1000 * 60 * 60 * 24))
        );
        const frequency = totalFiltered / daysSinceStart;

        if (frequency >= 10) return 'Very High';
        if (frequency >= 5) return 'High';
        if (frequency >= 2) return 'Moderate';
        if (frequency >= 0.5) return 'Low';
        return 'Just Started';
    }

    calculateQualityImprovement(analyzed, spam) {
        if (analyzed === 0) return 'No data yet';

        const cleanRate = ((analyzed - spam) / analyzed * 100).toFixed(1);
        return `${cleanRate}% clean content`;
    }

    getDefaultReportData() {
        return {
            totalAnalyzed: 0,
            totalSpam: 0,
            totalNotInterested: 0,
            totalMarkedSpam: 0,
            totalFiltered: 0,
            timeSavedMinutes: 0,
            experienceScore: '--',
            detectionRate: 0,
            trainingSuccess: 0,
            improvementPercentage: 0,
            dailyAverage: 0,
            trainingFrequency: 'Starting up',
            qualityImprovement: 'Collecting data...',
            isActive: false
        };
    }

    generateReport() {
        if (!this.reportData) return;

        // Update key metrics
        document.getElementById('total-spam').textContent = this.reportData.totalSpam.toLocaleString();
        document.getElementById('total-trained').textContent = this.reportData.totalFiltered.toLocaleString();
        document.getElementById('time-saved').textContent = this.reportData.timeSavedMinutes.toLocaleString();
        document.getElementById('experience-score').textContent = this.reportData.experienceScore;

        // Update ROI analysis
        document.getElementById('improvement-percentage').textContent =
            `${this.reportData.improvementPercentage}%`;

        // Update effectiveness bars
        this.updateEffectivenessBar('detection-rate-bar', 'detection-rate-text',
            this.reportData.detectionRate, `${this.reportData.detectionRate}% of tweets`);

        this.updateEffectivenessBar('training-success-bar', 'training-success-text',
            this.reportData.trainingSuccess, `${this.reportData.trainingSuccess}% trained`);

        // Update trends
        document.getElementById('daily-spam-avg').textContent =
            `${this.reportData.dailyAverage} per day`;
        document.getElementById('training-frequency').textContent =
            this.reportData.trainingFrequency;
        document.getElementById('quality-improvement').textContent =
            this.reportData.qualityImprovement;

        // Update analytics table
        this.updateAnalyticsTable();

        // Update system health
        document.getElementById('extension-status').textContent =
            this.reportData.isActive ? 'Active & Monitoring' : 'Inactive';
        document.getElementById('extension-status').className =
            this.reportData.isActive ? 'status-active' : 'status-inactive';

        document.getElementById('algorithm-training-status').textContent =
            this.reportData.isActive ? 'Enabled' : 'Disabled';
        document.getElementById('algorithm-training-status').className =
            this.reportData.isActive ? 'status-active' : 'status-inactive';

        document.getElementById('last-activity').textContent =
            this.reportData.isActive ? 'Just now' : 'No recent activity';
    }

    updateEffectivenessBar(barId, textId, percentage, text) {
        const bar = document.getElementById(barId);
        const textEl = document.getElementById(textId);

        if (bar && textEl) {
            bar.style.width = Math.min(100, Math.max(0, percentage)) + '%';
            textEl.textContent = text;
        }
    }

    updateAnalyticsTable() {
        // For now, show current session data
        // In a full implementation, this would show time-segmented data

        const sessionData = this.reportData;

        // Update today's data (current session)
        document.getElementById('analyzed-today').textContent = sessionData.totalAnalyzed || 0;
        document.getElementById('spam-today').textContent = sessionData.totalSpam || 0;
        document.getElementById('not-interested-today').textContent = sessionData.totalNotInterested || 0;
        document.getElementById('spam-reports-today').textContent = sessionData.totalMarkedSpam || 0;

        // For week/month, show totals (would be calculated from historical data)
        document.getElementById('analyzed-week').textContent = sessionData.totalAnalyzed || 0;
        document.getElementById('spam-week').textContent = sessionData.totalSpam || 0;
        document.getElementById('not-interested-week').textContent = sessionData.totalNotInterested || 0;
        document.getElementById('spam-reports-week').textContent = sessionData.totalMarkedSpam || 0;

        document.getElementById('analyzed-month').textContent = sessionData.totalAnalyzed || 0;
        document.getElementById('spam-month').textContent = sessionData.totalSpam || 0;
        document.getElementById('not-interested-month').textContent = sessionData.totalNotInterested || 0;
        document.getElementById('spam-reports-month').textContent = sessionData.totalMarkedSpam || 0;
    }

    async saveAnalyticsData() {
        if (!this.reportData) return;

        const today = new Date().toISOString().split('T')[0];

        const analyticsData = {
            startDate: this.reportData.startDate || new Date().toISOString(),
            totalStats: {
                analyzed: this.reportData.totalAnalyzed,
                spam: this.reportData.totalSpam,
                notInterested: this.reportData.totalNotInterested,
                markedSpam: this.reportData.totalMarkedSpam,
                timesSaved: this.reportData.timeSavedMinutes
            },
            dailyStats: {
                [today]: {
                    analyzed: this.reportData.totalAnalyzed,
                    spam: this.reportData.totalSpam,
                    filtered: this.reportData.totalFiltered
                }
            },
            lastUpdated: new Date().toISOString()
        };

        chrome.storage.local.set({ guardianAnalytics: analyticsData });
    }
}

// Global functions for UI interactions
function showTrend(timeRange) {
    // Update active button
    document.querySelectorAll('.time-button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Update chart (placeholder for now)
    const chartContainer = document.getElementById('trend-chart');
    chartContainer.innerHTML = `
        <div style="text-align: center; color: #A7A39A; margin-top: 60px;">
            📈 ${timeRange === '7d' ? 'Last 7 Days' : timeRange === '30d' ? 'Last 30 Days' : 'All Time'} Trends
            <br><br>
            <span style="font-size: 12px;">Advanced charts will be available after more data is collected</span>
            <br><br>
            <div style="color: #FFCC00;">
                Coming soon: Interactive charts showing spam detection trends,
                algorithm training effectiveness, and timeline quality improvements over time.
            </div>
        </div>
    `;
}

function exportReport(format) {
    if (format === 'pdf') {
        // In a full implementation, this would generate a PDF
        alert('📄 PDF export feature coming soon! This will generate a comprehensive report with all your Twitter improvement metrics.');
    } else if (format === 'csv') {
        // In a full implementation, this would export CSV data
        alert('📊 CSV export feature coming soon! This will provide raw data for your own analysis.');
    }
}

async function refreshReport() {
    const refreshBtn = event.target;
    const originalText = refreshBtn.textContent;

    refreshBtn.textContent = '🔄 Refreshing...';
    refreshBtn.disabled = true;

    try {
        await window.reportManager.loadReportData();
        window.reportManager.generateReport();
        await window.reportManager.saveAnalyticsData();
    } catch (error) {
        console.log('Refresh error:', error);
    }

    setTimeout(() => {
        refreshBtn.textContent = originalText;
        refreshBtn.disabled = false;
    }, 1000);
}

// Initialize the report manager
window.reportManager = new TwitterGuardianReports();
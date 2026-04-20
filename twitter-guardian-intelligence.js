const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables if .env file exists
try {
    require('dotenv').config();
} catch (error) {
    // dotenv not installed, use defaults
    console.log('💡 Note: Install dotenv for .env file support: npm install dotenv');
}

class TwitterGuardianIntelligence {
    constructor() {
        this.dataDir = './twitter-guardian-data';
        this.accountDatabase = path.join(this.dataDir, 'accounts.json');
        this.actionsLog = path.join(this.dataDir, 'actions.json');
        this.learningData = path.join(this.dataDir, 'learning.json');

        this.spamPatterns = [
            /\d+k?\s*stars?\s*in\s*\d+\s*hours?/i,
            /revolutionary\s*ai\s*breakthrough/i,
            /this\s*changes\s*everything/i,
            /dm\s*for/i,
            /100k\s*stars/i,
            /ai\s*will\s*revolutionize/i,
            /crypto\s*pump/i,
            /check\s*out\s*my\s*.*ai/i,
            /just\s*launched.*github/i,
            /get\s*rich\s*quick/i
        ];

        this.suspiciousAccountPatterns = {
            username: [
                /^[a-z]+\d{6,}$/i, // name123456
                /^[a-z]+_[a-z]+\d+$/i, // first_last123
                /crypto[a-z]*\d+/i,
                /ai[a-z]*\d+/i
            ],
            bio: [
                /dm\s*for/i,
                /crypto\s*expert/i,
                /ai\s*influencer/i,
                /follow\s*for\s*follow/i,
                /^\s*$/ // empty bio
            ]
        };

        // High-value account protection patterns
        this.highValueIndicators = {
            verified: true,
            keywords: [
                'engineer', 'developer', 'cto', 'ceo', 'founder',
                'professor', 'researcher', 'phd',
                'microsoft', 'google', 'apple', 'amazon', 'meta',
                'openai', 'anthropic', 'nvidia', 'tesla',
                'ycombinator', 'techcrunch', 'github'
            ],
            followerThresholds: {
                minimum: 10000, // Accounts with 10k+ followers get protection
                ratio: 0.1 // Following/followers ratio should be reasonable
            }
        };
    }

    async initialize() {
        // Create data directory
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }

        // Initialize data files if they don't exist
        const files = [
            { path: this.accountDatabase, data: { accounts: [], lastUpdated: new Date().toISOString() } },
            { path: this.actionsLog, data: { actions: [], stats: { blocked: 0, unfollowed: 0, analyzed: 0 } } },
            { path: this.learningData, data: { patterns: [], userPreferences: {}, timeline: [] } }
        ];

        for (const file of files) {
            try {
                await fs.access(file.path);
            } catch {
                await fs.writeFile(file.path, JSON.stringify(file.data, null, 2));
                console.log(`📁 Created ${path.basename(file.path)}`);
            }
        }
    }

    async startAnalysis() {
        console.log('🚀 Starting Twitter Guardian Intelligence System...');

        await this.initialize();

        // Try multiple browser contexts for better login compatibility
        let browser, page;
        const chromeProfilePath = process.env.CHROME_PROFILE_PATH || '/Users/tylerroessel/Library/Application Support/Google/Chrome/Default';
        const actionDelay = parseInt(process.env.ACTION_DELAY) || 1000;

        try {
            console.log(`🔧 Using Chrome profile: ${chromeProfilePath}`);
            browser = await chromium.launchPersistentContext(chromeProfilePath, {
                headless: false,
                args: ['--start-maximized', '--disable-blink-features=AutomationControlled', '--no-first-run']
            });
            page = await browser.newPage();
            console.log('✅ Using persistent context (should preserve login)');
        } catch (error) {
            console.log('⚠️ Persistent context failed, trying regular browser...');
            console.log('   This means you\'ll need to log in manually.');
            browser = await chromium.launch({
                headless: false,
                args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
            });
            page = await browser.newPage();
        }

        try {
            // Navigate to Twitter timeline
            console.log('📱 Navigating to Twitter timeline...');
            await page.goto('https://x.com/home');
            await page.waitForTimeout(5000);

            // Check if we need to login
            const loginNeeded = await page.$('a[href="/login"], a[href="/i/flow/login"]');
            if (loginNeeded) {
                console.log('🔐 Login required. Please log in manually...');
                console.log('⏳ Waiting for you to log in (60 seconds)...');
                await page.waitForTimeout(60000);

                // Try to navigate to home again after login
                await page.goto('https://x.com/home');
                await page.waitForTimeout(3000);
            }

            // Phase 1: Analyze current timeline
            console.log('\n🔍 Phase 1: Timeline Analysis...');
            const timelineAnalysis = await this.analyzeTimeline(page);

            // Phase 2: Analyze following list
            console.log('\n📊 Phase 2: Following List Analysis...');
            const followingAnalysis = await this.analyzeFollowing(page);

            // Phase 3: Generate action recommendations
            console.log('\n🎯 Phase 3: Generating Recommendations...');
            const recommendations = await this.generateRecommendations(timelineAnalysis, followingAnalysis);

            // Phase 4: Execute approved actions
            console.log('\n⚡ Phase 4: Executing Actions...');
            await this.executeRecommendations(page, recommendations);

            // Phase 5: Update learning data
            console.log('\n🧠 Phase 5: Learning Update...');
            await this.updateLearningData(timelineAnalysis, followingAnalysis, recommendations);

            console.log('\n✅ Analysis complete! Check the data files for detailed results.');

        } catch (error) {
            console.error('❌ Error during analysis:', error.message);
        }

        await browser.close();
    }

    async analyzeTimeline(page) {
        console.log('🔍 Analyzing timeline content...');

        const timelineData = await page.evaluate(({ spamPatterns }) => {
            const tweets = document.querySelectorAll('article[data-testid="tweet"], [data-testid="tweet"]');
            const analysis = [];

            tweets.forEach((tweet, index) => {
                try {
                    const textElement = tweet.querySelector('[data-testid="tweetText"]');
                    const text = textElement ? textElement.textContent : '';

                    const authorElement = tweet.querySelector('[data-testid="User-Name"]');
                    const author = authorElement ? authorElement.textContent.split('@')[0] : 'Unknown';

                    const handleElement = tweet.querySelector('a[role="link"][href*="/"]');
                    const handle = handleElement ? handleElement.href.split('/').pop() : '';

                    // Check for spam patterns
                    const spamScore = spamPatterns.reduce((score, pattern) => {
                        return score + (new RegExp(pattern, 'i').test(text) ? 1 : 0);
                    }, 0);

                    analysis.push({
                        index,
                        author,
                        handle,
                        text: text.substring(0, 200),
                        spamScore,
                        isSpam: spamScore > 0,
                        engagement: {
                            hasLikes: !!tweet.querySelector('[aria-label*="like"]'),
                            hasRetweets: !!tweet.querySelector('[aria-label*="repost"]'),
                            hasReplies: !!tweet.querySelector('[aria-label*="reply"]')
                        }
                    });

                } catch (error) {
                    console.log(`Error analyzing tweet ${index}:`, error.message);
                }
            });

            return analysis;
        }, {
            spamPatterns: this.spamPatterns.map(p => p.source)
        });

        console.log(`📊 Analyzed ${timelineData.length} tweets`);
        console.log(`🚩 Found ${timelineData.filter(t => t.isSpam).length} spam tweets`);

        return timelineData;
    }

    async analyzeFollowing(page) {
        console.log('👥 Analyzing following list...');

        // Navigate to following page
        await page.goto('https://x.com/following');
        await page.waitForTimeout(3000);

        // Scroll to load more accounts
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);
        }

        const followingData = await page.evaluate(({ suspiciousPatterns, highValueIndicators }) => {
            const accounts = document.querySelectorAll('[data-testid="UserCell"]');
            const analysis = [];

            accounts.forEach((account, index) => {
                try {
                    const nameElement = account.querySelector('[data-testid="UserName"]');
                    const name = nameElement ? nameElement.textContent : '';

                    const handleElement = account.querySelector('a[role="link"]');
                    const handle = handleElement ? handleElement.href.split('/').pop() : '';

                    const bioElement = account.querySelector('[data-testid="UserDescription"]');
                    const bio = bioElement ? bioElement.textContent : '';

                    const followersElement = account.querySelector('a[href*="/followers"]');
                    const followersText = followersElement ? followersElement.textContent : '0';

                    const isVerified = !!account.querySelector('[aria-label*="Verified"]');

                    // Parse follower count
                    const parseFollowerCount = (followersText) => {
                        const text = followersText.toLowerCase().replace(/,/g, '');
                        if (text.includes('m')) {
                            return parseFloat(text) * 1000000;
                        } else if (text.includes('k')) {
                            return parseFloat(text) * 1000;
                        } else {
                            return parseInt(text) || 0;
                        }
                    };

                    const followersCount = parseFollowerCount(followersText);

                    // Check for high-value account first (PROTECTION)
                    let isHighValue = false;

                    if (isVerified) isHighValue = true;

                    if (followersCount >= highValueIndicators.followerThresholds.minimum) {
                        isHighValue = true;
                    }

                    // Check for high-value keywords in name/bio
                    const textToCheck = (name + ' ' + bio).toLowerCase();
                    highValueIndicators.keywords.forEach(keyword => {
                        if (textToCheck.includes(keyword.toLowerCase())) {
                            isHighValue = true;
                        }
                    });

                    // Only analyze for suspicious patterns if NOT high-value
                    let suspicionScore = 0;
                    let shouldUnfollow = false;

                    if (!isHighValue) {
                        // Check username patterns
                        suspiciousPatterns.username.forEach(pattern => {
                            if (new RegExp(pattern, 'i').test(handle)) suspicionScore += 2;
                        });

                        // Check bio patterns
                        suspiciousPatterns.bio.forEach(pattern => {
                            if (new RegExp(pattern, 'i').test(bio)) suspicionScore += 1;
                        });

                        // Check for empty or generic bio
                        if (!bio || bio.length < 10) suspicionScore += 1;

                        // Low follower count + suspicious patterns = unfollow
                        if (followersCount < 1000 && suspicionScore >= 2) shouldUnfollow = true;

                        // Very suspicious regardless of followers
                        if (suspicionScore >= 4) shouldUnfollow = true;
                    }

                    analysis.push({
                        index,
                        name,
                        handle,
                        bio: bio.substring(0, 100),
                        followers: followersText,
                        followersCount,
                        isVerified,
                        isHighValue,
                        suspicionScore,
                        shouldUnfollow: shouldUnfollow && !isHighValue,
                        protectionReason: isHighValue ? 'HIGH_VALUE_ACCOUNT' : null
                    });

                } catch (error) {
                    console.log(`Error analyzing account ${index}:`, error.message);
                }
            });

            return analysis;
        }, {
            suspiciousPatterns: this.suspiciousAccountPatterns,
            highValueIndicators: this.highValueIndicators
        });

        console.log(`👥 Analyzed ${followingData.length} following accounts`);
        console.log(`⚠️ Found ${followingData.filter(a => a.isSuspicious).length} suspicious accounts`);

        return followingData;
    }

    parseFollowerCount(followersText) {
        // Parse "1.2M", "12K", "500" etc.
        const text = followersText.toLowerCase().replace(/,/g, '');
        if (text.includes('m')) {
            return parseFloat(text) * 1000000;
        } else if (text.includes('k')) {
            return parseFloat(text) * 1000;
        } else {
            return parseInt(text) || 0;
        }
    }

    async generateRecommendations(timelineAnalysis, followingAnalysis) {
        console.log('🎯 Generating autonomous action plan...');

        const recommendations = {
            block: [],
            unfollow: [],
            protected: [],
            whitelist: []
        };

        // BLOCK: Spam tweet authors (unless they're high-value)
        const spamAuthors = timelineAnalysis
            .filter(tweet => tweet.isSpam && tweet.spamScore >= 1) // More aggressive
            .map(tweet => tweet.handle)
            .filter(handle => !this.isHighValueHandle(handle, followingAnalysis));

        recommendations.block = [...new Set(spamAuthors)];

        // UNFOLLOW: Accounts marked for unfollowing (already filtered for high-value protection)
        recommendations.unfollow = followingAnalysis
            .filter(account => account.shouldUnfollow)
            .map(account => account.handle);

        // PROTECTED: High-value accounts that were considered but protected
        recommendations.protected = followingAnalysis
            .filter(account => account.isHighValue)
            .map(account => ({
                handle: account.handle,
                reason: account.protectionReason,
                followers: account.followersCount,
                verified: account.isVerified
            }));

        // WHITELIST: Active high-quality accounts for future protection
        recommendations.whitelist = timelineAnalysis
            .filter(tweet => !tweet.isSpam && tweet.text.length > 50 && tweet.engagement.hasLikes)
            .map(tweet => tweet.handle);

        console.log('\n📋 Autonomous Action Plan:');
        console.log(`🚫 Will block: ${recommendations.block.length} spam accounts`);
        console.log(`👋 Will unfollow: ${recommendations.unfollow.length} suspicious accounts`);
        console.log(`🛡️ Protected: ${recommendations.protected.length} high-value accounts`);
        console.log(`✅ Whitelisted: ${recommendations.whitelist.length} quality accounts`);

        // Show protected accounts for transparency
        if (recommendations.protected.length > 0) {
            console.log('\n🛡️ Protected high-value accounts:');
            recommendations.protected.slice(0, 5).forEach(account => {
                console.log(`   @${account.handle} (${account.followers} followers, verified: ${account.verified})`);
            });
        }

        return recommendations;
    }

    isHighValueHandle(handle, followingAnalysis) {
        const account = followingAnalysis.find(acc => acc.handle === handle);
        return account ? account.isHighValue : false;
    }

    async executeRecommendations(page, recommendations) {
        console.log('⚡ Executing autonomous actions...');

        const actionLog = [];
        const actionDelay = parseInt(process.env.ACTION_DELAY) || 1000;

        // Execute ALL blocks (spam is spam)
        console.log(`\n🚫 Blocking ${recommendations.block.length} spam accounts...`);
        for (const handle of recommendations.block) {
            try {
                console.log(`🚫 Blocking @${handle}...`);
                await this.blockAccount(page, handle);
                actionLog.push({ action: 'block', handle, timestamp: new Date().toISOString(), reason: 'spam_content' });
                await page.waitForTimeout(actionDelay);
            } catch (error) {
                console.log(`❌ Failed to block @${handle}:`, error.message);
                actionLog.push({ action: 'block_failed', handle, timestamp: new Date().toISOString(), error: error.message });
            }
        }

        // Execute ALL unfollows (they're already filtered for high-value protection)
        console.log(`\n👋 Unfollowing ${recommendations.unfollow.length} suspicious accounts...`);
        for (const handle of recommendations.unfollow) {
            try {
                console.log(`👋 Unfollowing @${handle}...`);
                await this.unfollowAccount(page, handle);
                actionLog.push({ action: 'unfollow', handle, timestamp: new Date().toISOString(), reason: 'suspicious_account' });
                await page.waitForTimeout(actionDelay);
            } catch (error) {
                console.log(`❌ Failed to unfollow @${handle}:`, error.message);
                actionLog.push({ action: 'unfollow_failed', handle, timestamp: new Date().toISOString(), error: error.message });
            }
        }

        // Save action log
        const existingLog = JSON.parse(await fs.readFile(this.actionsLog, 'utf8'));
        existingLog.actions.push(...actionLog);
        existingLog.stats.blocked += actionLog.filter(a => a.action === 'block').length;
        existingLog.stats.unfollowed += actionLog.filter(a => a.action === 'unfollow').length;
        existingLog.stats.protected = recommendations.protected.length;

        await fs.writeFile(this.actionsLog, JSON.stringify(existingLog, null, 2));

        console.log(`\n✅ Autonomous execution complete:`);
        console.log(`   🚫 Blocked: ${actionLog.filter(a => a.action === 'block').length} accounts`);
        console.log(`   👋 Unfollowed: ${actionLog.filter(a => a.action === 'unfollow').length} accounts`);
        console.log(`   🛡️ Protected: ${recommendations.protected.length} high-value accounts`);

        return actionLog;
    }

    async blockAccount(page, handle) {
        await page.goto(`https://x.com/${handle}`);
        await page.waitForTimeout(2000);

        // Click the more options menu
        const moreButton = page.locator('[aria-label="More"]').first();
        await moreButton.click();
        await page.waitForTimeout(1000);

        // Click block option
        const blockButton = page.getByText('Block').first();
        await blockButton.click();
        await page.waitForTimeout(1000);

        // Confirm block
        const confirmBlock = page.getByText('Block').first();
        await confirmBlock.click();
        await page.waitForTimeout(1000);
    }

    async unfollowAccount(page, handle) {
        await page.goto(`https://x.com/${handle}`);
        await page.waitForTimeout(2000);

        // Click the following button to unfollow
        const followingButton = page.locator('[data-testid*="follow"]').first();
        if (await followingButton.isVisible()) {
            await followingButton.click();
            await page.waitForTimeout(1000);

            // Confirm unfollow if prompted
            const confirmUnfollow = page.getByText('Unfollow').first();
            if (await confirmUnfollow.isVisible()) {
                await confirmUnfollow.click();
                await page.waitForTimeout(1000);
            }
        }
    }

    async updateLearningData(timelineAnalysis, followingAnalysis, recommendations) {
        console.log('🧠 Updating learning data...');

        const learningData = {
            timestamp: new Date().toISOString(),
            timeline: timelineAnalysis,
            following: followingAnalysis,
            recommendations,
            patterns: {
                spamKeywords: this.extractSpamKeywords(timelineAnalysis),
                suspiciousAccountFeatures: this.extractAccountFeatures(followingAnalysis)
            }
        };

        // Save learning data
        const existingData = JSON.parse(await fs.readFile(this.learningData, 'utf8'));
        existingData.timeline.push(learningData);

        // Keep only last 10 analyses
        if (existingData.timeline.length > 10) {
            existingData.timeline = existingData.timeline.slice(-10);
        }

        await fs.writeFile(this.learningData, JSON.stringify(existingData, null, 2));
        console.log('💾 Learning data updated');
    }

    extractSpamKeywords(timelineAnalysis) {
        return timelineAnalysis
            .filter(tweet => tweet.isSpam)
            .map(tweet => tweet.text.toLowerCase())
            .join(' ')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .slice(0, 50); // Top 50 words from spam content
    }

    extractAccountFeatures(followingAnalysis) {
        return followingAnalysis
            .filter(account => account.isSuspicious)
            .map(account => ({
                handlePattern: account.handle,
                bioLength: account.bio.length,
                suspicionScore: account.suspicionScore
            }));
    }
}

// Usage
const guardian = new TwitterGuardianIntelligence();
guardian.startAnalysis().catch(console.error);
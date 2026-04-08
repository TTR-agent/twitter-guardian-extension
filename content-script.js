// Twitter Guardian - Content Script
// Runs in your actual Twitter tab where you're logged in

console.log('🛡️ Twitter Guardian Extension Loaded');

class TwitterGuardian {
    constructor() {
        // Rage-bait / engagement-bait / low-quality content patterns.
        // Each pattern has a weight (1-3). Action threshold is summed weight >= this.actionThreshold.
        // Text is Unicode-normalized (math-bold -> ASCII) before matching.
        this.spamPatterns = [
            // --- STRONG signals (weight 3) ---
            { weight: 3, label: 'rageVocab',      re: /\b(TREASON|TRAITOR|OUTRAGEOUS|DISGRACE(?:FUL)?|DISGUSTING|SHAMEFUL|SHOCKING|EVIL|CORRUPT)\b/i },
            { weight: 3, label: 'breakingOpener', re: /(^|\s)(🚨|⚡|❗)+\s*BREAKING|^BREAKING[:\s]/i },
            { weight: 3, label: 'allCapsSentence',re: /(?:^|[.!?]\s)[A-Z][A-Z\s,'"]{20,}[!?.]/ },
            { weight: 3, label: 'dmForX',         re: /\bdm\s*(me\s*)?(for|to get|if)\b/i },
            { weight: 3, label: 'linkInBio',      re: /link\s*in\s*(my\s*)?bio/i },
            { weight: 3, label: 'youWontBelieve', re: /you\s*(won'?t|will not)\s*believe/i },
            { weight: 3, label: 'engageFarm',     re: /\b(retweet|rt|like|follow)\s+(if|and)\b/i },

            // --- MEDIUM signals (weight 2) ---
            { weight: 2, label: 'doubleShout',    re: /\b[A-Z]{5,}\b.*\b[A-Z]{5,}\b/ },
            { weight: 2, label: 'partisanLoaded', re: /\b(radical left|radical right|libtard|magat|woke mob|deep state|globalist|the left|the right)\s+(cast|are|is|wants|will|just|hate|love)/i },
            { weight: 2, label: 'engageBaitOpen', re: /^(who else|am i the only|unpopular opinion|hot take|thoughts\?|change my mind|fight me|prove me wrong|tell me i'?m wrong)/i },
            { weight: 2, label: 'threadFarm',     re: /(🧵|thread\s*👇|\(\s*1\s*\/\s*\d+\s*\)|a thread:|•\s*a thread)/i },
            { weight: 2, label: 'aiHype0Code',    re: /\b0\s*code\b/i },
            { weight: 2, label: 'builtInSeconds', re: /built\s+.{0,40}\s+in\s+\d+\s*(seconds|minutes|mins)/i },
            { weight: 2, label: 'clickbaitList',  re: /^\d+\s+(ways|things|reasons|signs|tips|tricks|secrets|lessons|mistakes)/i },
            { weight: 2, label: 'cryptoHype',     re: /\b(100x|to the moon|next\s*\w+coin|pumping)\b/i },
            { weight: 2, label: 'rageFraming',    re: /\b(trump|biden|democrat|republican|maga|liberal|conservative)s?\b.{0,60}\b(slam|destroy|shred|humiliat|owned|rekt|expose|demolish)/i },

            // --- WEAK signals (weight 1) ---
            { weight: 1, label: 'multiPunct',     re: /[!?]{2,}/ },
            { weight: 1, label: 'bitchAbout',     re: /\b(bitch|whine|cry)\s+about\b/i },
            { weight: 1, label: 'confrontVerb',   re: /\b(shut(?:ting)?\s+down|yelling at|fired back|clap(?:ped|s)?\s+back|destroys?)\b/i },
            { weight: 1, label: 'unbelievable',   re: /\bUNBELIEVABLE\b/ },
        ];

        // Minimum total weighted score required to auto-train the algorithm.
        // Visual flag still happens at any match (score >= 1).
        this.actionThreshold = 3;

        // Brand/org whitelist — display name must contain one of these to skip filtering.
        this.highValueKeywords = [
            'microsoft', 'google', 'apple', 'amazon', 'meta',
            'openai', 'anthropic', 'nvidia', 'tesla',
            'ycombinator', 'techcrunch', 'github'
        ];

        // User-editable handle allowlist (loaded from storage in init).
        this.userAllowlist = new Set();

        this.actionLog = [];
        this.isRunning = false;
        this.reviewQueue = [];
        this.missedClicks = []; // Tweets the user manually hit "Not interested" on that we didn't flag

        // Algorithm training settings
        this.algorithmTraining = {
            enabled: true,
            autoNotInterested: true,
            autoMarkSpam: false,
            actionDelay: 1500
        };

        // Rate-limiting queue: cap auto-actions at N per WINDOW_MS.
        this.actionQueue = [];
        this.actionQueueBusy = false;
        this.recentActionTimestamps = [];
        this.ACTION_WINDOW_MS = 10_000;
        this.MAX_ACTIONS_PER_WINDOW = 3;

        this.init();
    }

    async init() {
        console.log('🔍 Twitter Guardian initializing...');

        // Load persisted state + user allowlist from chrome.storage.local
        await this.loadPersistedState();

        // Install global capture listener to detect manual "Not interested" clicks
        this.installManualClickListener();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
    }

    async loadPersistedState() {
        return new Promise(resolve => {
            try {
                chrome.storage.local.get(['guardianAllowlist', 'guardianActionLog', 'guardianMissedClicks'], (data) => {
                    if (data.guardianAllowlist && Array.isArray(data.guardianAllowlist)) {
                        this.userAllowlist = new Set(data.guardianAllowlist.map(h => h.toLowerCase().replace(/^@/, '')));
                    }
                    if (data.guardianActionLog && Array.isArray(data.guardianActionLog)) {
                        // Only hydrate recent entries to cap memory
                        this.actionLog = data.guardianActionLog.slice(-500);
                    }
                    if (data.guardianMissedClicks && Array.isArray(data.guardianMissedClicks)) {
                        this.missedClicks = data.guardianMissedClicks.slice(-100);
                    }
                    resolve();
                });
            } catch (e) {
                console.log('⚠️ Could not load persisted state:', e.message);
                resolve();
            }
        });
    }

    persistState() {
        try {
            chrome.storage.local.set({
                guardianActionLog: this.actionLog.slice(-500),
                guardianMissedClicks: this.missedClicks.slice(-100),
            });
        } catch (e) {}
    }

    start() {
        console.log('✅ Twitter Guardian started on', window.location.href);
        this.monitorTimeline();
        this.waitForTweetsAndAnalyze();
    }

    waitForTweetsAndAnalyze() {
        const checkForTweets = () => {
            const tweets = document.querySelectorAll('article[data-testid="tweet"]');
            if (tweets.length > 0) {
                console.log(`📊 Initial analysis: Found ${tweets.length} tweets`);
                this.analyzeCurrentContent();
            } else {
                setTimeout(checkForTweets, 1000);
            }
        };
        setTimeout(checkForTweets, 500);
    }

    getStats() {
        return {
            analyzed: this.actionLog.filter(a => a.action === 'analyzed').length,
            spam: this.actionLog.filter(a => a.action === 'spam_detected').length,
            blocked: this.actionLog.filter(a => a.action === 'blocked').length,
            unfollowed: this.actionLog.filter(a => a.action === 'unfollowed').length,
            notInterested: this.actionLog.filter(a => a.action === 'not_interested').length,
            markedSpam: this.actionLog.filter(a => a.action === 'marked_spam').length,
            missedClicks: this.missedClicks.length,
            allowlistSize: this.userAllowlist.size,
            reviewQueue: this.reviewQueue.length,
            algorithmTraining: this.algorithmTraining.enabled
        };
    }

    monitorTimeline() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    const tweets = [];
                    if (node.matches?.('article[data-testid="tweet"]')) tweets.push(node);
                    tweets.push(...node.querySelectorAll('article[data-testid="tweet"]'));
                    tweets.forEach(tweet => this.analyzeTweet(tweet));
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    analyzeCurrentContent() {
        console.log('🔍 Analyzing current timeline content...');
        const tweets = document.querySelectorAll('article[data-testid="tweet"]');
        tweets.forEach(tweet => this.analyzeTweet(tweet));
        console.log(`📊 Analysis complete: ${tweets.length} tweets analyzed`);
    }

    // --- Text extraction: handles quoted tweets + signals media-only ---
    extractTweetContent(tweetElement) {
        // Grab ALL tweetText elements inside the article (outer + quoted inner tweet).
        const textNodes = tweetElement.querySelectorAll('[data-testid="tweetText"]');
        const parts = Array.from(textNodes).map(el => el.textContent || '').filter(Boolean);
        const text = parts.join('\n');

        // Media detection: image, video, or gif embedded in the tweet
        const hasImage = !!tweetElement.querySelector('[data-testid="tweetPhoto"], img[alt]:not([alt=""])[src*="twimg.com/media"]');
        const hasVideo = !!tweetElement.querySelector('[data-testid="videoPlayer"], video');
        const hasMedia = hasImage || hasVideo;

        return {
            text,
            hasQuotedTweet: parts.length >= 2,
            hasMedia,
            isMediaOnly: !text && hasMedia,
        };
    }

    analyzeTweet(tweetElement) {
        if (tweetElement.dataset.guardianAnalyzed) return;
        tweetElement.dataset.guardianAnalyzed = 'true';

        try {
            const { text, hasQuotedTweet, hasMedia, isMediaOnly } = this.extractTweetContent(tweetElement);

            const authorElement = tweetElement.querySelector('[data-testid="User-Name"]');
            const author = authorElement ? authorElement.textContent.split('@')[0] : 'Unknown';

            const statusLink = tweetElement.querySelector('a[role="link"][href*="/status/"]');
            let handle = '';
            if (statusLink) {
                const href = statusLink.getAttribute('href') || '';
                const pathParts = href.split('/').filter(part => part && part !== 'status');
                handle = pathParts[0] || '';
            }

            this.actionLog.push({ action: 'analyzed', handle, timestamp: new Date().toISOString() });
            chrome.runtime.sendMessage({ action: 'updateStats', type: 'analyzed' });

            // User allowlist — never filter accounts the user explicitly trusts
            if (handle && this.userAllowlist.has(handle.toLowerCase())) {
                tweetElement.dataset.guardianAllowlisted = 'true';
                return;
            }

            // Brand whitelist (by display name)
            if (this.isHighValueAccount(author, '')) return;

            // Score
            const normalizedText = this.normalizeText(text);
            const { score, matched } = this.detectSpam(normalizedText);

            if (score === 0) return;

            // Visual flag at any match; auto-action only at threshold
            const shouldAutoAction = score >= this.actionThreshold;

            this.markAsSpam(tweetElement, {
                handle, text, score, matched,
                hasQuotedTweet, hasMedia, isMediaOnly,
                severity: shouldAutoAction ? 'high' : 'low'
            });

            this.actionLog.push({
                action: 'spam_detected', handle,
                text: text.substring(0, 120),
                score, matched,
                timestamp: new Date().toISOString()
            });
            chrome.runtime.sendMessage({ action: 'updateStats', type: 'spam_detected' });

            if (shouldAutoAction && this.algorithmTraining.enabled) {
                this.enqueueAction(() => this.trainTwitterAlgorithm(tweetElement, score));
            }

            this.persistState();
        } catch (error) {
            console.log('Error analyzing tweet:', error);
        }
    }

    // Weighted scoring: returns {score, matched[]}
    detectSpam(text) {
        let score = 0;
        const matched = [];
        for (const p of this.spamPatterns) {
            if (p.re.test(text)) {
                score += p.weight;
                matched.push(p.label);
            }
        }
        return { score, matched };
    }

    // Normalize Unicode math-bold/italic letters back to ASCII
    normalizeText(s) {
        if (!s) return '';
        let out = '';
        for (const ch of s) {
            const cp = ch.codePointAt(0);
            if (cp >= 0x1D400 && cp <= 0x1D419) out += String.fromCharCode(65 + cp - 0x1D400);
            else if (cp >= 0x1D41A && cp <= 0x1D433) out += String.fromCharCode(97 + cp - 0x1D41A);
            else if (cp >= 0x1D434 && cp <= 0x1D44D) out += String.fromCharCode(65 + cp - 0x1D434);
            else if (cp >= 0x1D44E && cp <= 0x1D467) out += String.fromCharCode(97 + cp - 0x1D44E);
            else if (cp >= 0x1D5D4 && cp <= 0x1D5ED) out += String.fromCharCode(65 + cp - 0x1D5D4);
            else if (cp >= 0x1D5EE && cp <= 0x1D607) out += String.fromCharCode(97 + cp - 0x1D5EE);
            else out += ch;
        }
        return out.replace(/\s+/g, ' ').trim();
    }

    isHighValueAccount(author, bio) {
        const textToCheck = (author + ' ' + bio).toLowerCase();
        return this.highValueKeywords.some(keyword => textToCheck.includes(keyword));
    }

    // --- Visual flag (dark-mode aware via CSS custom properties) ---
    markAsSpam(tweetElement, spamData) {
        const isHigh = spamData.severity === 'high';
        tweetElement.style.border = `2px solid ${isHigh ? '#ff4444' : '#ffa500'}`;
        tweetElement.style.opacity = isHigh ? '0.35' : '0.7';
        tweetElement.style.position = 'relative';

        const warning = document.createElement('div');
        warning.className = 'guardian-warning-badge';
        warning.innerHTML = `${isHigh ? '🚩' : '⚠️'} ${isHigh ? 'SPAM' : 'LOW-Q'} (${spamData.score}) <span class="guardian-matched">${spamData.matched.slice(0,3).join(', ')}</span>`;
        warning.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: ${isHigh ? 'rgba(255,68,68,0.92)' : 'rgba(255,165,0,0.92)'};
            color: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            z-index: 1000;
            backdrop-filter: blur(4px);
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.2);
            pointer-events: none;
        `;
        tweetElement.appendChild(warning);
    }

    // --- Rate-limited action queue ---
    async enqueueAction(actionFn) {
        this.actionQueue.push(actionFn);
        if (!this.actionQueueBusy) this.drainActionQueue();
    }

    async drainActionQueue() {
        this.actionQueueBusy = true;
        while (this.actionQueue.length > 0) {
            // Pause if any menu is currently open — don't clobber the user's interaction
            if (document.querySelector('[role="menu"]')) {
                await this.delay(1000);
                continue;
            }

            // Enforce rate window
            const now = Date.now();
            this.recentActionTimestamps = this.recentActionTimestamps.filter(t => now - t < this.ACTION_WINDOW_MS);
            if (this.recentActionTimestamps.length >= this.MAX_ACTIONS_PER_WINDOW) {
                const waitMs = this.ACTION_WINDOW_MS - (now - this.recentActionTimestamps[0]) + 50;
                await this.delay(Math.max(waitMs, 500));
                continue;
            }

            const next = this.actionQueue.shift();
            this.recentActionTimestamps.push(Date.now());
            try { await next(); } catch (e) { console.log('Action error:', e); }
        }
        this.actionQueueBusy = false;
    }

    // --- Manual click detection: learn from the user ---
    installManualClickListener() {
        document.addEventListener('click', (ev) => {
            try {
                const menuitem = ev.target.closest?.('[role="menuitem"]');
                if (!menuitem) return;
                const txt = (menuitem.textContent || '').toLowerCase();
                if (!txt.includes('not interested')) return;

                // Find the tweet this menu belongs to. Menus are portal-rendered, so we
                // can't walk the DOM from the menu to the article. Use the most recently
                // opened article — whichever tweet has an open menu button aria-expanded=true.
                let article = null;
                const expandedMore = document.querySelector('article[data-testid="tweet"] [aria-label="More"][aria-expanded="true"]');
                if (expandedMore) article = expandedMore.closest('article[data-testid="tweet"]');

                // Fallback: the most recently hovered/focused article
                if (!article) {
                    const focused = document.activeElement?.closest?.('article[data-testid="tweet"]');
                    if (focused) article = focused;
                }

                if (!article) return;

                // Was it one WE flagged? If so, ignore. If NOT, record it as a miss.
                if (article.dataset.guardianFlagged === 'true') return;

                const { text } = this.extractTweetContent(article);
                if (!text) return;

                const normalized = this.normalizeText(text);
                const { score, matched } = this.detectSpam(normalized);
                if (score >= this.actionThreshold) return; // We would have caught it

                this.missedClicks.push({
                    text: text.substring(0, 200),
                    ourScore: score,
                    matched,
                    timestamp: new Date().toISOString()
                });
                console.log('📝 Guardian: recorded a missed tweet you hit "Not interested" on — text:', text.substring(0, 80));
                this.persistState();
            } catch (e) {}
        }, true); // capture phase so we see it before the menu closes
    }

    async autoCleanup() {
        if (this.isRunning) return;
        this.isRunning = true;
        try {
            const spamAuthors = this.getSpamAuthors();
            if (spamAuthors.length === 0) {
                console.log('✅ No spam accounts detected in current session');
            } else {
                this.reviewQueue = spamAuthors.map(handle => ({
                    handle,
                    reason: 'Spam content detected',
                    timestamp: new Date().toISOString()
                }));
            }
        } catch (e) {
            console.error('❌ Review queue error:', e);
        }
        this.isRunning = false;
        return { reviewQueue: this.reviewQueue || [] };
    }

    getSpamAuthors() {
        return [...new Set(
            this.actionLog
                .filter(log => log.action === 'spam_detected')
                .map(log => log.handle)
                .filter(handle => handle && handle !== '')
        )];
    }

    async blockAccount(handle) {
        console.log(`⚠️ SAFE MODE: Would block @${handle} but autonomous blocking is disabled`);
        this.actionLog.push({
            action: 'queued_for_review',
            handle,
            timestamp: new Date().toISOString(),
            reason: 'flagged_for_blocking'
        });
    }

    delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    async trainTwitterAlgorithm(tweetElement, spamScore) {
        try {
            await this.delay(this.algorithmTraining.actionDelay);
            console.log(`🧠 Training Twitter algorithm on spam (score: ${spamScore})...`);

            if (spamScore >= 6 && this.algorithmTraining.autoMarkSpam) {
                const success = await this.markTweetAsSpam(tweetElement);
                if (success) {
                    this.actionLog.push({ action: 'marked_spam', timestamp: new Date().toISOString(), spamScore });
                    chrome.runtime.sendMessage({ action: 'updateStats', type: 'marked_spam' });
                }
            } else if (this.algorithmTraining.autoNotInterested) {
                const success = await this.markNotInterested(tweetElement);
                if (success) {
                    tweetElement.dataset.guardianFlagged = 'true';
                    this.actionLog.push({ action: 'not_interested', timestamp: new Date().toISOString(), spamScore });
                    chrome.runtime.sendMessage({ action: 'updateStats', type: 'not_interested' });
                }
            }
            this.persistState();
        } catch (error) {
            console.log('⚠️ Algorithm training error:', error.message);
        }
    }

    async markNotInterested(tweetElement) {
        try {
            const moreButton = tweetElement.querySelector('[aria-label="More"]') ||
                               tweetElement.querySelector('[data-testid="caret"]');
            if (!moreButton) return false;

            moreButton.click();
            await this.delay(800);

            const menu = document.querySelector('[role="menu"]');
            if (!menu) return false;

            const notInterestedOptions = [
                'Not interested in this Tweet',
                'Not interested in this post',
                'Not interested',
                "I don't like this Tweet"
            ];

            for (const optionText of notInterestedOptions) {
                const option = Array.from(menu.querySelectorAll('[role="menuitem"]'))
                    .find(el => el.textContent?.includes(optionText));
                if (option) {
                    option.click();
                    await this.delay(500);
                    await this.selectNotInterestedReason();
                    return true;
                }
            }

            document.body.click();
            return false;
        } catch (error) {
            console.log('❌ Mark not interested failed:', error.message);
            return false;
        }
    }

    async selectNotInterestedReason() {
        try {
            await this.delay(300);
            const spamReasons = [
                "It's spam", 'Spam', 'Misleading', "It's suspicious or spam", "This Tweet is suspicious or spam"
            ];
            const menu = document.querySelector('[role="menu"]');
            if (!menu) return false;
            for (const reason of spamReasons) {
                const reasonOption = Array.from(menu.querySelectorAll('div[role="button"], [role="menuitem"]'))
                    .find(el => el.textContent?.includes(reason));
                if (reasonOption) {
                    reasonOption.click();
                    await this.delay(300);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.log('⚠️ Reason selection failed:', error.message);
            return false;
        }
    }

    async markTweetAsSpam(tweetElement) {
        // Still gated by autoMarkSpam=false in safe mode
        return false;
    }

    // --- Allowlist API called from popup ---
    setAllowlist(list) {
        this.userAllowlist = new Set((list || []).map(h => h.toLowerCase().replace(/^@/, '').trim()).filter(Boolean));
        chrome.storage.local.set({ guardianAllowlist: [...this.userAllowlist] });
    }

    getAllowlist() {
        return [...this.userAllowlist];
    }

    getMissedClicks() {
        return this.missedClicks;
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyzeTimeline') {
        guardian.analyzeCurrentContent();
        sendResponse({ success: true });
        return true;
    }
    if (request.action === 'startCleanup') {
        guardian.autoCleanup()
            .then(() => sendResponse({ success: true }))
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }
    if (request.action === 'getStats') {
        sendResponse(guardian.getStats());
        return true;
    }
    if (request.action === 'getAllowlist') {
        sendResponse({ allowlist: guardian.getAllowlist() });
        return true;
    }
    if (request.action === 'setAllowlist') {
        guardian.setAllowlist(request.list || []);
        sendResponse({ success: true, size: guardian.userAllowlist.size });
        return true;
    }
    if (request.action === 'getMissedClicks') {
        sendResponse({ missed: guardian.getMissedClicks() });
        return true;
    }
});

// Initialize
const guardian = new TwitterGuardian();

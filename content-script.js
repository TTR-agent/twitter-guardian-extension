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
            { weight: 3, label: 'commentForLink', re: /\b(comment|reply)\s+["“']?[\w\s$-]{1,30}["”']?\s+(and\s+)?(i('|’)ll|i will|to)\s+(send|dm|share|drop)\b/i },
            { weight: 3, label: 'spammyMoneyClaim', re: /\b(earn|made|make|generated|profit)\b.{0,25}\$\s?\d[\d,]*(?:\s*(a|per)\s*(day|week|month))?/i },
            { weight: 3, label: 'airdropGiveaway', re: /\b(airdrop|giveaway|whitelist|mint\s+live|free\s+mint)\b/i },
            { weight: 3, label: 'adultPromo',     re: /\b(onlyfans|of leak|nsfw|18\+|content\s*creator)\b/i },

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
            { weight: 2, label: 'replyBait',      re: /\b(drop|comment|reply|type)\s+["“']?[\w$-]{1,20}["”']?\b/i },
            { weight: 2, label: 'checkReplies',   re: /\b(check|see)\s+(the\s+)?repl(?:y|ies)\b/i },
            { weight: 2, label: 'joinChannel',    re: /\b(join|dm|message)\s+(my\s+)?(telegram|discord|whatsapp|signal|community)\b/i },
            { weight: 2, label: 'hustleBait',     re: /\b(dropshipping|faceless|smma|agency\s+owner|clipping\s+business|cashcow|appointment setting)\b/i },
            { weight: 2, label: 'freeResourceLeadMagnet', re: /\b(free\s+(guide|pdf|template|resource|cheat\s*sheet|course|ebook)|comment\s+[^\n]{0,20}\s+for\s+the\s+link)\b/i },
            { weight: 2, label: 'replySpamPitch', re: /^@\w{1,20}\s+.{0,80}\b(dm me|link in bio|follow me|join my|check my profile)\b/i },
            { weight: 2, label: 'fakeAuthority',  re: /\b(i made \$?\d|my students made|clients made|from 0 to \$?\d|guaranteed results?)\b/i },

            // --- WEAK signals (weight 1) ---
            { weight: 1, label: 'multiPunct',     re: /[!?]{2,}/ },
            { weight: 1, label: 'bitchAbout',     re: /\b(bitch|whine|cry)\s+about\b/i },
            { weight: 1, label: 'confrontVerb',   re: /\b(shut(?:ting)?\s+down|yelling at|fired back|clap(?:ped|s)?\s+back|destroys?)\b/i },
            { weight: 1, label: 'unbelievable',   re: /\bUNBELIEVABLE\b/ },
            { weight: 1, label: 'scarcityPitch',  re: /\b(limited spots|last chance|before it closes|don'?t miss|spots filling fast)\b/i },
            { weight: 1, label: 'ctaEnding',      re: /\b(dm me|follow me|bookmark this|save this post)\b/i },
        ];

        // Minimum total weighted score required to auto-train the algorithm.
        // Visual flag still happens at any match (score >= 1).
        this.actionThreshold = 3;
        this.filterMode = 'balanced';

        // Brand/org whitelist — display name must contain one of these to skip filtering.
        this.highValueKeywords = [
            'microsoft', 'google', 'apple', 'amazon', 'meta',
            'openai', 'anthropic', 'nvidia', 'tesla',
            'ycombinator', 'techcrunch', 'github'
        ];

        // User-editable handle allowlist (loaded from storage in init).
        this.userAllowlist = new Set();
        this.analyzedTweetIds = new Set();
        this.hiddenTweetIds = new Set();

        this.actionLog = [];
        this.isRunning = false;
        this.reviewQueue = [];
        this.missedClicks = []; // Tweets the user manually hit "Not interested" on that we didn't flag

        // Algorithm training settings
        this.algorithmTraining = {
            enabled: true,
            autoNotInterested: true,
            autoMarkSpam: false,
            actionDelay: 1200
        };

        // Rate-limiting queue: cap auto-actions at N per WINDOW_MS.
        this.actionQueue = [];
        this.actionQueueBusy = false;
        this.recentActionTimestamps = [];
        this.ACTION_WINDOW_MS = 10_000;
        this.MAX_ACTIONS_PER_WINDOW = 4;

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
                chrome.storage.local.get([
                    'guardianAllowlist',
                    'guardianActionLog',
                    'guardianMissedClicks',
                    'guardianSettings',
                    'guardianAnalyzedTweetIds',
                    'guardianHiddenTweetIds'
                ], (data) => {
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
                    if (Array.isArray(data.guardianAnalyzedTweetIds)) {
                        this.analyzedTweetIds = new Set(data.guardianAnalyzedTweetIds.slice(-3000));
                    }
                    if (Array.isArray(data.guardianHiddenTweetIds)) {
                        this.hiddenTweetIds = new Set(data.guardianHiddenTweetIds.slice(-3000));
                    }
                    if (data.guardianSettings?.filterMode === 'strict') {
                        this.filterMode = 'strict';
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
                guardianAnalyzedTweetIds: Array.from(this.analyzedTweetIds).slice(-3000),
                guardianHiddenTweetIds: Array.from(this.hiddenTweetIds).slice(-3000),
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
            actionAttempts: this.actionLog.filter(a => /_attempted$/.test(a.action)).length,
            actionFailures: this.actionLog.filter(a => /_failed$/.test(a.action)).length,
            hiddenLocally: this.hiddenTweetIds.size,
            missedClicks: this.missedClicks.length,
            allowlistSize: this.userAllowlist.size,
            reviewQueue: this.reviewQueue.length,
            algorithmTraining: this.algorithmTraining.enabled,
            filterMode: this.filterMode
        };
    }

    getAutoActionThreshold() {
        return this.filterMode === 'strict' ? 2 : this.actionThreshold;
    }

    getActionDelay() {
        return this.filterMode === 'strict' ? 750 : this.algorithmTraining.actionDelay;
    }

    getMaxActionsPerWindow() {
        return this.filterMode === 'strict' ? 6 : this.MAX_ACTIONS_PER_WINDOW;
    }

    shouldCollapseFlaggedTweet(score, shouldAutoAction) {
        if (this.filterMode !== 'strict') return false;
        return score >= 1 || shouldAutoAction;
    }

    extractTweetIdFromHref(href) {
        if (!href) return '';
        const match = href.match(/\/status\/(\d+)/);
        return match ? match[1] : '';
    }

    getHighConfidenceLabels() {
        return new Set([
            'commentForLink',
            'spammyMoneyClaim',
            'airdropGiveaway',
            'adultPromo',
            'replyBait',
            'checkReplies',
            'joinChannel',
            'freeResourceLeadMagnet',
            'replySpamPitch',
            'fakeAuthority',
            'spamReply',
            'lowFollowerPromo',
            'profileFunnel',
            'strictPromoBoost',
            'promoHandle',
            'suspiciousHandle'
        ]);
    }

    getAutoActionDecision(score, matched, context = {}) {
        const baseThreshold = this.getAutoActionThreshold();
        const highConfidenceLabels = this.getHighConfidenceLabels();
        const accountSignals = context.accountSignals || {};
        const highConfidenceMatches = matched.filter((label) => highConfidenceLabels.has(label));
        let effectiveThreshold = baseThreshold;

        if (highConfidenceMatches.length >= 2) {
            effectiveThreshold -= 1;
        }

        if (matched.includes('spamReply') || matched.includes('lowFollowerPromo')) {
            effectiveThreshold -= 1;
        }

        if (accountSignals.isReply && typeof accountSignals.followerCount === 'number' && accountSignals.followerCount < 250) {
            effectiveThreshold -= 1;
        }

        if (accountSignals.hasExternalProfileCue && highConfidenceMatches.length > 0) {
            effectiveThreshold -= 1;
        }

        effectiveThreshold = Math.max(2, effectiveThreshold);

        return {
            shouldAutoAction: score >= effectiveThreshold,
            effectiveThreshold,
            highConfidenceMatches
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

    analyzeTweet(tweetElement, options = {}) {
        const force = options.force === true;
        const suppressMetrics = options.suppressMetrics === true;
        const ignoreHiddenCache = options.ignoreHiddenCache === true;

        if (!force && tweetElement.dataset.guardianAnalyzed) return;
        tweetElement.dataset.guardianAnalyzed = 'true';

        try {
            const { text, hasQuotedTweet, hasMedia, isMediaOnly } = this.extractTweetContent(tweetElement);

            const authorElement = tweetElement.querySelector('[data-testid="User-Name"]');
            const author = authorElement ? authorElement.textContent.split('@')[0] : 'Unknown';

            const statusLink = tweetElement.querySelector('a[role="link"][href*="/status/"]');
            let handle = '';
            let tweetId = '';
            if (statusLink) {
                const href = statusLink.getAttribute('href') || '';
                tweetId = this.extractTweetIdFromHref(href);
                const pathParts = href.split('/').filter(part => part && part !== 'status');
                handle = pathParts[0] || '';
            }

            if (!ignoreHiddenCache && tweetId && this.hiddenTweetIds.has(tweetId)) {
                this.collapseTweet(tweetElement, 'Hidden by Twitter Guardian', { tweetId, countStats: false });
                return;
            }
            if (!force && tweetId && this.analyzedTweetIds.has(tweetId)) {
                return;
            }

            const accountSignals = this.extractAccountSignals(tweetElement, { author, handle, text });
            if (tweetId) {
                this.analyzedTweetIds.add(tweetId);
            }

            if (!suppressMetrics) {
                this.actionLog.push({ action: 'analyzed', handle, timestamp: new Date().toISOString() });
                chrome.runtime.sendMessage({ action: 'updateStats', type: 'analyzed' });
            }

            // User allowlist — never filter accounts the user explicitly trusts
            if (handle && this.userAllowlist.has(handle.toLowerCase())) {
                tweetElement.dataset.guardianAllowlisted = 'true';
                return;
            }

            // Trust visible verified / large / known accounts before scoring.
            if (this.isTrustedAccount(author, '', accountSignals)) return;

            // Score
            const normalizedText = this.normalizeText(text);
            const { score, matched } = this.detectSpam(normalizedText, {
                handle,
                author,
                accountSignals,
                hasQuotedTweet,
                hasMedia,
                isMediaOnly
            });

            if (score === 0) return;

            // Visual flag at any match; auto-action only at threshold
            const actionDecision = this.getAutoActionDecision(score, matched, {
                handle,
                author,
                accountSignals,
                hasQuotedTweet,
                hasMedia,
                isMediaOnly
            });
            const shouldAutoAction = actionDecision.shouldAutoAction;

            this.markAsSpam(tweetElement, {
                handle, text, score, matched,
                hasQuotedTweet, hasMedia, isMediaOnly,
                severity: shouldAutoAction ? 'high' : 'low'
            });

            if (this.shouldCollapseFlaggedTweet(score, shouldAutoAction)) {
                this.collapseTweet(tweetElement, 'Low-quality post hidden by Twitter Guardian', { tweetId });
            }

            if (!suppressMetrics) {
                this.actionLog.push({
                    action: 'spam_detected', handle,
                    text: text.substring(0, 120),
                    score, matched,
                    timestamp: new Date().toISOString()
                });
                chrome.runtime.sendMessage({ action: 'updateStats', type: 'spam_detected' });
            }

            if (shouldAutoAction && this.algorithmTraining.enabled) {
                this.enqueueAction(() => this.trainTwitterAlgorithm(tweetElement, score, tweetId, actionDecision));
            }

            this.persistState();
        } catch (error) {
            console.log('Error analyzing tweet:', error);
        }
    }

    // Weighted scoring: returns {score, matched[]}
    detectSpam(text, context = {}) {
        let score = 0;
        const matched = [];
        for (const p of this.spamPatterns) {
            if (p.re.test(text)) {
                score += p.weight;
                matched.push(p.label);
            }
        }
        const heuristicSignals = this.getHeuristicSignals(text, context);
        score += heuristicSignals.score;
        matched.push(...heuristicSignals.matched);
        return { score, matched };
    }

    getHeuristicSignals(text, context = {}) {
        let score = 0;
        const matched = [];
        const handle = (context.handle || '').toLowerCase();
        const author = (context.author || '').toLowerCase();
        const accountSignals = context.accountSignals || {};
        const trimmedText = (text || '').trim();
        const strictMode = this.filterMode === 'strict';

        const emojiCount = (text.match(/[\p{Extended_Pictographic}]/gu) || []).length;
        if (emojiCount >= 4) {
            score += 1;
            matched.push('emojiHeavy');
        }

        const hashtagCount = (text.match(/#[\p{L}\p{N}_]+/gu) || []).length;
        if (hashtagCount >= 4) {
            score += 1;
            matched.push('hashtagHeavy');
        }

        const cashMentions = (text.match(/\$\w+/g) || []).length;
        if (cashMentions >= 2) {
            score += 1;
            matched.push('multiCashtag');
        }

        if (/\b(free|win|giveaway|airdrop|bet|casino|trade|signals?)\b/i.test(`${handle} ${author}`)) {
            score += 1;
            matched.push('promoHandle');
        }

        if (/[0-9]{4,}$/.test(handle) || /(_|\.)(ai|crypto|alpha|alerts|news|tips)$/.test(handle)) {
            score += 1;
            matched.push('suspiciousHandle');
        }

        if (accountSignals.isReply && /\b(dm me|join|telegram|discord|airdrop|giveaway|follow me|check my profile)\b/i.test(trimmedText)) {
            score += 2;
            matched.push('spamReply');
        }

        if (accountSignals.isReply && /^(?:@\w{1,20}\s+){2,}/.test(trimmedText)) {
            score += 1;
            matched.push('multiMentionReply');
        }

        if (!accountSignals.isVerified && typeof accountSignals.followerCount === 'number' && accountSignals.followerCount < 150) {
            if (/\b(dm me|link in bio|airdrop|signals?|casino|bet|giveaway|follow for)\b/i.test(trimmedText)) {
                score += 2;
                matched.push('lowFollowerPromo');
            }
        }

        if (accountSignals.hasExternalProfileCue && /\b(comment|reply|dm me|link in bio|check replies)\b/i.test(trimmedText)) {
            score += 1;
            matched.push('profileFunnel');
        }

        if (context.hasMedia && !text) {
            score += 1;
            matched.push('mediaOnlyPromo');
        }

        if (strictMode && accountSignals.isReply && /^(?:@\w{1,20}\s+)?(agree|facts|this|wow|amazing|insane)\b/i.test(trimmedText)) {
            score += 1;
            matched.push('lowValueReply');
        }

        if (strictMode && /\b(check replies|comment below|reply below|dm me for|link in bio)\b/i.test(trimmedText)) {
            score += 1;
            matched.push('strictPromoBoost');
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

    isTrustedAccount(author, bio, accountSignals = {}) {
        if (this.isHighValueAccount(author, bio)) return true;
        if (this.filterMode === 'strict') return false;
        if (accountSignals.isVerified) return true;
        const trustedFollowerFloor = this.filterMode === 'strict' ? 25000 : 10000;
        if ((accountSignals.followerCount || 0) >= trustedFollowerFloor) return true;
        return false;
    }

    extractAccountSignals(tweetElement, { author = '', handle = '', text = '' } = {}) {
        const userBlock = tweetElement.querySelector('[data-testid="User-Name"]');
        const lowerText = (text || '').toLowerCase();
        const signals = {
            isVerified: false,
            followerCount: null,
            isReply: /^@\w{1,20}\b/.test((text || '').trim()),
            hasExternalProfileCue: false
        };

        if (userBlock) {
            const verifiedHint = userBlock.querySelector(
                '[aria-label*="Verified" i], [title*="Verified" i], [data-testid*="verified" i]'
            );
            signals.isVerified = Boolean(verifiedHint);

            const visibleText = userBlock.textContent || '';
            const followerMatch = visibleText.match(/(\d[\d.,]*\s*[KMB]?)\s+Followers?/i);
            if (followerMatch) {
                signals.followerCount = this.parseCompactNumber(followerMatch[1]);
            }
        }

        if (/\b(link in bio|newsletter|founder|ceo|engineer|researcher)\b/i.test(`${author} ${lowerText}`)) {
            signals.hasExternalProfileCue = true;
        }

        if (!signals.followerCount) {
            const articleText = tweetElement.textContent || '';
            const articleFollowerMatch = articleText.match(/(\d[\d.,]*\s*[KMB]?)\s+Followers?/i);
            if (articleFollowerMatch) {
                signals.followerCount = this.parseCompactNumber(articleFollowerMatch[1]);
            }
        }

        return signals;
    }

    parseCompactNumber(value) {
        if (!value) return null;
        const cleaned = value.replace(/,/g, '').trim();
        const match = cleaned.match(/^(\d+(?:\.\d+)?)([KMB])?$/i);
        if (!match) return null;

        const base = Number(match[1]);
        const suffix = (match[2] || '').toUpperCase();
        if (suffix === 'K') return Math.round(base * 1_000);
        if (suffix === 'M') return Math.round(base * 1_000_000);
        if (suffix === 'B') return Math.round(base * 1_000_000_000);
        return Math.round(base);
    }

    // --- Visual flag (dark-mode aware via CSS custom properties) ---
    markAsSpam(tweetElement, spamData) {
        const isHigh = spamData.severity === 'high';
        tweetElement.dataset.guardianFlagged = 'true';
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
            if (this.recentActionTimestamps.length >= this.getMaxActionsPerWindow()) {
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
                const statusLink = article.querySelector('a[role="link"][href*="/status/"]');
                let handle = '';
                if (statusLink) {
                    const href = statusLink.getAttribute('href') || '';
                    const pathParts = href.split('/').filter(part => part && part !== 'status');
                    handle = pathParts[0] || '';
                }

                const authorElement = article.querySelector('[data-testid="User-Name"]');
                const author = authorElement ? authorElement.textContent.split('@')[0] : '';
                const accountSignals = this.extractAccountSignals(article, { author, handle, text });

                const { score, matched } = this.detectSpam(normalized, { handle, author, accountSignals });
                const actionDecision = this.getAutoActionDecision(score, matched, { handle, author, accountSignals });
                if (actionDecision.shouldAutoAction) return; // We would have caught it

                this.missedClicks.push({
                    text: text.substring(0, 200),
                    ourScore: score,
                    matched,
                    threshold: actionDecision.effectiveThreshold,
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

    async trainTwitterAlgorithm(tweetElement, spamScore, tweetId = '', actionDecision = {}) {
        try {
            await this.delay(this.getActionDelay());
            console.log(`🧠 Training Twitter algorithm on spam (score: ${spamScore})...`);

            if (spamScore >= 6 && this.algorithmTraining.autoMarkSpam) {
                this.actionLog.push({
                    action: 'marked_spam_attempted',
                    timestamp: new Date().toISOString(),
                    spamScore,
                    effectiveThreshold: actionDecision.effectiveThreshold
                });
                chrome.runtime.sendMessage({ action: 'updateStats', type: 'marked_spam_attempted' });
                const success = await this.markTweetAsSpam(tweetElement);
                if (success) {
                    this.updateCollapsedPlaceholder(tweetElement, 'Reported as spam', { tweetId });
                    this.actionLog.push({ action: 'marked_spam', timestamp: new Date().toISOString(), spamScore });
                    chrome.runtime.sendMessage({ action: 'updateStats', type: 'marked_spam' });
                } else {
                    this.recordActionFailure('marked_spam', 'flow_failed', { spamScore });
                }
            } else if (this.algorithmTraining.autoNotInterested) {
                this.actionLog.push({
                    action: 'not_interested_attempted',
                    timestamp: new Date().toISOString(),
                    spamScore,
                    effectiveThreshold: actionDecision.effectiveThreshold
                });
                chrome.runtime.sendMessage({ action: 'updateStats', type: 'not_interested_attempted' });
                const success = await this.markNotInterested(tweetElement);
                if (success) {
                    this.updateCollapsedPlaceholder(tweetElement, 'Hidden and tuned by Twitter Guardian', { tweetId });
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
            const menu = await this.openTweetMenu(tweetElement);
            if (!menu) {
                this.recordActionFailure('not_interested', 'menu_not_opened');
                return false;
            }

            const notInterestedOptions = [
                'Not interested in this Tweet',
                'Not interested in this post',
                'Not interested',
                "I don't like this Tweet",
                'Show fewer posts like this',
                'See fewer posts like this'
            ];

            const option = this.findFirstMatchingOption(menu, notInterestedOptions);
            if (!option) {
                this.closeOpenMenus();
                this.recordActionFailure('not_interested', 'menu_option_missing');
                return false;
            }

            this.triggerClick(option);
            await this.delay(500);
            const reasonHandled = await this.selectNotInterestedReason();
            if (reasonHandled) return true;

            await this.delay(350);
            if (!document.querySelector('[role="menu"]')) return true;

            this.closeOpenMenus();
            this.recordActionFailure('not_interested', 'reason_not_selected');
            return false;
        } catch (error) {
            console.log('❌ Mark not interested failed:', error.message);
            this.recordActionFailure('not_interested', 'exception', { message: error.message });
            return false;
        }
    }

    async selectNotInterestedReason() {
        try {
            await this.delay(350);
            const spamReasons = [
                "It's spam", 'Spam', 'Misleading', "It's suspicious or spam", "This Tweet is suspicious or spam",
                'This post is suspicious or spam', 'This content is misleading'
            ];

            const surfaces = [
                document.querySelector('[role="menu"]'),
                document.querySelector('[role="dialog"]'),
                document.body
            ].filter(Boolean);

            for (const surface of surfaces) {
                const reasonOption = this.findFirstMatchingOption(surface, spamReasons);
                if (!reasonOption) continue;
                this.triggerClick(reasonOption);
                await this.delay(350);
                return true;
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

    collapseTweet(tweetElement, message = 'Hidden', options = {}) {
        if (!tweetElement || tweetElement.dataset.guardianCollapsed === 'true') return;

        const tweetId = options.tweetId || '';
        const shouldTrackHide = options.countStats !== false;
        const isNewHiddenTweet = tweetId ? !this.hiddenTweetIds.has(tweetId) : true;

        if (tweetId) {
            this.hiddenTweetIds.add(tweetId);
        }
        if (shouldTrackHide && isNewHiddenTweet) {
            chrome.runtime.sendMessage({ action: 'updateStats', type: 'locally_hidden' });
        }

        tweetElement.dataset.guardianCollapsed = 'true';
        tweetElement.style.transition = 'opacity 0.25s ease, max-height 0.25s ease, margin 0.25s ease, padding 0.25s ease';
        tweetElement.style.opacity = '0';
        tweetElement.style.overflow = 'hidden';
        tweetElement.style.maxHeight = `${tweetElement.offsetHeight || 120}px`;

        setTimeout(() => {
            tweetElement.style.maxHeight = '0px';
            tweetElement.style.margin = '0';
            tweetElement.style.paddingTop = '0';
            tweetElement.style.paddingBottom = '0';

            const placeholder = document.createElement('div');
            placeholder.className = 'guardian-collapsed-placeholder';
            placeholder.textContent = `🛡️ ${message}`;
            placeholder.style.cssText = `
                margin: 8px 0;
                padding: 8px 12px;
                border-radius: 8px;
                background: rgba(47, 62, 86, 0.5);
                color: #A7A39A;
                font-size: 12px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            `;

            if (!tweetElement.nextElementSibling?.classList?.contains('guardian-collapsed-placeholder')) {
                tweetElement.insertAdjacentElement('afterend', placeholder);
            }
        }, 50);

        this.persistState();
    }

    updateCollapsedPlaceholder(tweetElement, message, options = {}) {
        if (!tweetElement) return;
        const placeholder = tweetElement.nextElementSibling;
        if (placeholder?.classList?.contains('guardian-collapsed-placeholder')) {
            placeholder.textContent = `🛡️ ${message}`;
            return;
        }
        this.collapseTweet(tweetElement, message, options);
    }

    resetTweetPresentation(tweetElement) {
        if (!tweetElement) return;

        delete tweetElement.dataset.guardianAnalyzed;
        delete tweetElement.dataset.guardianCollapsed;
        delete tweetElement.dataset.guardianFlagged;
        delete tweetElement.dataset.guardianAllowlisted;

        tweetElement.style.border = '';
        tweetElement.style.opacity = '';
        tweetElement.style.position = '';
        tweetElement.style.transition = '';
        tweetElement.style.overflow = '';
        tweetElement.style.maxHeight = '';
        tweetElement.style.margin = '';
        tweetElement.style.paddingTop = '';
        tweetElement.style.paddingBottom = '';

        tweetElement.querySelectorAll('.guardian-warning-badge').forEach((badge) => badge.remove());
        const placeholder = tweetElement.nextElementSibling;
        if (placeholder?.classList?.contains('guardian-collapsed-placeholder')) {
            placeholder.remove();
        }
    }

    reprocessTimelineForModeChange(previousMode) {
        const tweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        const tweetIdsOnPage = new Set();

        tweets.forEach((tweetElement) => {
            const statusLink = tweetElement.querySelector('a[role="link"][href*="/status/"]');
            const href = statusLink?.getAttribute('href') || '';
            const tweetId = this.extractTweetIdFromHref(href);
            if (tweetId) tweetIdsOnPage.add(tweetId);
            this.resetTweetPresentation(tweetElement);
        });

        if (previousMode === 'strict' && this.filterMode === 'balanced') {
            this.hiddenTweetIds = new Set(
                Array.from(this.hiddenTweetIds).filter((tweetId) => !tweetIdsOnPage.has(tweetId))
            );
        }

        tweets.forEach((tweetElement) => {
            this.analyzeTweet(tweetElement, {
                force: true,
                suppressMetrics: true,
                ignoreHiddenCache: previousMode === 'strict' && this.filterMode === 'balanced'
            });
        });

        this.persistState();
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

    setFilterMode(mode) {
        const nextMode = mode === 'strict' ? 'strict' : 'balanced';
        const previousMode = this.filterMode;
        this.filterMode = nextMode;
        if (previousMode !== nextMode) {
            this.reprocessTimelineForModeChange(previousMode);
        }
    }

    resetPerformanceState() {
        this.actionLog = [];
        this.missedClicks = [];
        this.analyzedTweetIds = new Set();
        this.hiddenTweetIds = new Set();
    }

    findMenuOption(menu, label) {
        const target = (label || '').trim().toLowerCase();
        return Array.from(menu.querySelectorAll('[role="menuitem"], div[role="button"], button'))
            .find(el => (el.textContent || '').trim().toLowerCase().includes(target));
    }

    findFirstMatchingOption(root, labels) {
        for (const label of labels) {
            const option = this.findMenuOption(root, label);
            if (option) return option;
        }
        return null;
    }

    getTweetMenuButton(tweetElement) {
        return tweetElement.querySelector('[aria-label="More"]') ||
            tweetElement.querySelector('[data-testid="caret"]') ||
            tweetElement.querySelector('button[aria-haspopup="menu"]');
    }

    async openTweetMenu(tweetElement) {
        const moreButton = this.getTweetMenuButton(tweetElement);
        if (!moreButton) return null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
            moreButton.scrollIntoView({ block: 'center', behavior: 'auto' });
            this.triggerClick(moreButton);
            const menu = await this.waitForMenu(8, 250);
            if (menu) return menu;
            await this.delay(250);
        }

        return null;
    }

    closeOpenMenus() {
        document.body.click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }

    recordActionFailure(actionName, stage, details = {}) {
        this.actionLog.push({
            action: `${actionName}_failed`,
            stage,
            timestamp: new Date().toISOString(),
            ...details
        });
        chrome.runtime.sendMessage({ action: 'updateStats', type: `${actionName}_failed` });
    }

    triggerClick(el) {
        if (!el) return;
        el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        el.click();
    }

    async waitForMenu(retries = 6, delayMs = 250) {
        for (let i = 0; i < retries; i += 1) {
            const menu = document.querySelector('[role="menu"]');
            if (menu) return menu;
            await this.delay(delayMs);
        }
        return null;
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
    if (request.action === 'setFilterMode') {
        guardian.setFilterMode(request.mode);
        sendResponse({ success: true, mode: guardian.filterMode });
        return true;
    }
    if (request.action === 'resetPerformanceState') {
        guardian.resetPerformanceState();
        sendResponse({ success: true });
        return true;
    }
    if (request.action === 'getMissedClicks') {
        sendResponse({ missed: guardian.getMissedClicks() });
        return true;
    }
});

// Initialize
const guardian = new TwitterGuardian();

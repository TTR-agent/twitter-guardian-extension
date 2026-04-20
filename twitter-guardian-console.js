// Twitter Guardian - Browser Console Version
// Copy and paste this into your browser console while on Twitter/X

console.log('🚀 Twitter Guardian - Console Edition Loading...');

// Spam detection patterns
const spamPatterns = [
    /\d+k?\s*stars?\s*in\s*\d+\s*hours?/i,
    /revolutionary\s*ai\s*breakthrough/i,
    /this\s*changes\s*everything/i,
    /dm\s*for/i,
    /100k\s*stars/i,
    /ai\s*will\s*revolutionize/i,
    /just\s*launched.*repo/i,
    /check\s*out\s*my\s*.*ai/i
];

function detectSpam(text) {
    const matchedPatterns = spamPatterns.filter(pattern => pattern.test(text));
    return {
        isSpam: matchedPatterns.length > 0,
        confidence: matchedPatterns.length > 0 ? 'HIGH' : 'LOW',
        patterns: matchedPatterns.length
    };
}

function analyzeCurrentTweets() {
    console.log('🔍 Analyzing tweets on current page...');

    // Try multiple selectors to find tweets
    const tweetSelectors = [
        'article[data-testid="tweet"]',
        '[data-testid="tweet"]',
        'article[role="article"]',
        'div[data-testid="cellInnerDiv"]'
    ];

    let tweets = [];
    for (const selector of tweetSelectors) {
        tweets = document.querySelectorAll(selector);
        if (tweets.length > 0) {
            console.log(`📊 Found ${tweets.length} tweets using selector: ${selector}`);
            break;
        }
    }

    if (tweets.length === 0) {
        console.log('❌ No tweets found. Are you on the Twitter timeline?');
        return;
    }

    const results = [];

    tweets.forEach((tweet, index) => {
        try {
            // Extract text content
            const textElement = tweet.querySelector('[data-testid="tweetText"]') ||
                               tweet.querySelector('div[lang]') ||
                               tweet.querySelector('[role="text"]');

            const text = textElement ? textElement.textContent : tweet.textContent;

            // Extract author info
            const authorElement = tweet.querySelector('[data-testid="User-Name"]') ||
                                 tweet.querySelector('a[role="link"] span') ||
                                 tweet.querySelector('[role="link"]');

            const author = authorElement ? authorElement.textContent : 'Unknown';

            // Analyze for spam
            const spamAnalysis = detectSpam(text);

            results.push({
                index: index + 1,
                author: author.split('@')[0], // Clean up author name
                text: text.substring(0, 100),
                ...spamAnalysis,
                element: tweet
            });

            // Visual feedback - mark spam tweets
            if (spamAnalysis.isSpam) {
                tweet.style.border = '2px solid red';
                tweet.style.opacity = '0.3';

                // Add a warning badge
                if (!tweet.querySelector('.spam-warning')) {
                    const warning = document.createElement('div');
                    warning.className = 'spam-warning';
                    warning.innerHTML = '🚩 POTENTIAL SPAM';
                    warning.style.cssText = 'background: red; color: white; padding: 4px 8px; font-size: 12px; position: absolute; top: 10px; right: 10px; border-radius: 4px; z-index: 1000;';
                    tweet.style.position = 'relative';
                    tweet.appendChild(warning);
                }
            }

        } catch (error) {
            console.log(`⚠️ Could not analyze tweet ${index + 1}:`, error.message);
        }
    });

    // Summary
    const spamCount = results.filter(r => r.isSpam).length;
    const cleanCount = results.length - spamCount;

    console.log('\n📈 Analysis Results:');
    console.log(`✅ Clean tweets: ${cleanCount}`);
    console.log(`🚩 Spam detected: ${spamCount}`);
    console.log(`📊 Total analyzed: ${results.length}`);

    if (spamCount > 0) {
        console.log('\n🚩 Spam tweets found:');
        results.filter(r => r.isSpam).forEach(tweet => {
            console.log(`${tweet.index}. ${tweet.author}: "${tweet.text}..." (${tweet.patterns} patterns)`);
        });
    }

    return results;
}

// Auto-run the analysis
const results = analyzeCurrentTweets();

console.log('\n🎯 Twitter Guardian Console Edition Loaded!');
console.log('📝 Run analyzeCurrentTweets() again after scrolling to analyze new tweets');
console.log('🔄 Scroll down and run the function again to filter more content');

// Make function available globally
window.analyzeCurrentTweets = analyzeCurrentTweets;
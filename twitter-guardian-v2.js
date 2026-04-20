const { chromium } = require('playwright');

async function exploreTwitterStructure() {
    console.log('🚀 Starting Twitter Guardian v2 - Dynamic Detection...');

    const browser = await chromium.launchPersistentContext('/Users/tylerroessel/Library/Application Support/Google/Chrome/Default', {
        headless: false,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    try {
        console.log('📱 Navigating to X.com...');
        await page.goto('https://x.com');

        // Wait for page to fully load
        await page.waitForTimeout(5000);

        console.log('🔍 Exploring page structure...');

        // Try to find anything that looks like tweets by examining the DOM
        const possibleTweetElements = await page.evaluate(() => {
            // Look for elements that contain tweet-like content
            const allElements = document.querySelectorAll('div, article, section');
            const tweetCandidates = [];

            for (let element of allElements) {
                // Skip very small elements
                if (element.offsetHeight < 50) continue;

                // Look for elements with text content and some structure
                const textContent = element.textContent?.trim();
                if (!textContent || textContent.length < 10) continue;

                // Check if it has typical tweet structure indicators
                const hasUserInfo = element.querySelector('[href*="/"]') ||
                                  textContent.includes('@') ||
                                  element.querySelector('img[alt*="avatar"], img[src*="profile"]');

                const hasInteractionElements = element.querySelector('[aria-label*="like"], [aria-label*="reply"], [aria-label*="retweet"]') ||
                                             textContent.includes('Reply') ||
                                             textContent.includes('Retweet') ||
                                             textContent.includes('Like');

                if (hasUserInfo && textContent.length > 20) {
                    tweetCandidates.push({
                        tagName: element.tagName,
                        className: element.className,
                        textPreview: textContent.substring(0, 100),
                        hasInteractions: hasInteractionElements,
                        dataTestId: element.getAttribute('data-testid'),
                        role: element.getAttribute('role')
                    });
                }
            }

            return tweetCandidates.slice(0, 10); // Return top 10 candidates
        });

        console.log('\n📋 Found potential tweet elements:');
        possibleTweetElements.forEach((candidate, index) => {
            console.log(`\n${index + 1}. ${candidate.tagName} ${candidate.role ? `[role="${candidate.role}"]` : ''}`);
            console.log(`   Class: ${candidate.className.substring(0, 50)}...`);
            console.log(`   Data-testid: ${candidate.dataTestId || 'none'}`);
            console.log(`   Has interactions: ${candidate.hasInteractions}`);
            console.log(`   Preview: "${candidate.textPreview}..."`);
        });

        // Try scrolling to load more content
        console.log('\n🔄 Trying to scroll to load tweets...');
        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(3000);

        // Check for common timeline patterns
        const timelineInfo = await page.evaluate(() => {
            return {
                url: window.location.href,
                title: document.title,
                hasMainRole: !!document.querySelector('main[role="main"]'),
                hasTimeline: !!document.querySelector('[aria-label*="timeline"], [aria-label*="Timeline"]'),
                totalDivs: document.querySelectorAll('div').length,
                totalArticles: document.querySelectorAll('article').length
            };
        });

        console.log('\n📊 Page Analysis:');
        console.log(`URL: ${timelineInfo.url}`);
        console.log(`Title: ${timelineInfo.title}`);
        console.log(`Has main role: ${timelineInfo.hasMainRole}`);
        console.log(`Has timeline element: ${timelineInfo.hasTimeline}`);
        console.log(`Total divs: ${timelineInfo.totalDivs}`);
        console.log(`Total articles: ${timelineInfo.totalArticles}`);

        // If we found promising candidates, let's build a filter for them
        if (possibleTweetElements.length > 0) {
            console.log('\n🎯 Building spam filter for detected content...');

            // Test spam detection on the found content
            const spamResults = possibleTweetElements.map((tweet, index) => {
                const text = tweet.textPreview.toLowerCase();

                const spamPatterns = [
                    /\d+k?\s*stars?\s*in\s*\d+\s*hours?/i,
                    /revolutionary\s*ai\s*breakthrough/i,
                    /this\s*changes\s*everything/i,
                    /dm\s*for/i,
                    /100k\s*stars/i,
                    /ai\s*will\s*revolutionize/i,
                    /crypto\s*scam/i,
                    /click\s*here/i
                ];

                const matchedPatterns = spamPatterns.filter(pattern => pattern.test(text));

                return {
                    index: index + 1,
                    isSpam: matchedPatterns.length > 0,
                    matchedPatterns: matchedPatterns.length,
                    confidence: matchedPatterns.length > 0 ? 'HIGH' : 'LOW',
                    preview: tweet.textPreview
                };
            });

            console.log('\n🚩 Spam Detection Results:');
            spamResults.forEach(result => {
                const status = result.isSpam ? '🚩 SPAM DETECTED' : '✅ Looks clean';
                console.log(`${result.index}. ${status} (${result.confidence} confidence)`);
                if (result.matchedPatterns > 0) {
                    console.log(`   Matched ${result.matchedPatterns} spam pattern(s)`);
                }
                console.log(`   Preview: "${result.preview.substring(0, 80)}..."`);
            });
        }

        console.log('\n⏳ Keeping browser open for manual inspection (60 seconds)...');
        console.log('You can manually check what we detected and see the real timeline');

        await page.waitForTimeout(60000);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    await browser.close();
    console.log('\n✅ Analysis complete!');
}

// Run the exploration
exploreTwitterStructure().catch(console.error);
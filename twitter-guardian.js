const { chromium } = require('playwright');

async function testTwitterAccess() {
    console.log('🚀 Starting Twitter Guardian test...');

    // Launch browser with user data to use existing login
    const browser = await chromium.launchPersistentContext('/Users/tylerroessel/Library/Application Support/Google/Chrome/Default', {
        headless: false, // Keep visible for now
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    try {
        console.log('📱 Navigating to Twitter/X...');

        // Try x.com first (new Twitter)
        await page.goto('https://x.com');
        await page.waitForTimeout(5000);

        // Check multiple possible selectors for timeline
        const timelineSelectors = [
            '[data-testid="primaryColumn"]',
            '[aria-label="Timeline: Your Home Timeline"]',
            '[aria-label="Home timeline"]',
            'main[role="main"]'
        ];

        let timelineExists = null;
        for (const selector of timelineSelectors) {
            timelineExists = await page.$(selector);
            if (timelineExists) {
                console.log(`✅ Found timeline with selector: ${selector}`);
                break;
            }
        }

        // If not found on x.com, try twitter.com
        if (!timelineExists) {
            console.log('🔄 Trying twitter.com...');
            await page.goto('https://twitter.com');
            await page.waitForTimeout(5000);

            for (const selector of timelineSelectors) {
                timelineExists = await page.$(selector);
                if (timelineExists) {
                    console.log(`✅ Found timeline with selector: ${selector}`);
                    break;
                }
            }
        }

        if (timelineExists) {
            console.log('✅ Successfully accessed Twitter timeline!');

            // Try multiple selectors to find tweets
            const tweetSelectors = [
                '[data-testid="tweet"]',
                'article[data-testid="tweet"]',
                '[role="article"]',
                'div[data-testid="cellInnerDiv"]'
            ];

            let tweets = [];
            for (const selector of tweetSelectors) {
                tweets = await page.$$(selector);
                if (tweets.length > 0) {
                    console.log(`📊 Found ${tweets.length} tweets using selector: ${selector}`);
                    break;
                }
            }

            if (tweets.length === 0) {
                console.log('⚠️ No tweets found. Page might still be loading...');
                // Wait a bit more and try again
                await page.waitForTimeout(3000);
                tweets = await page.$$('[data-testid="tweet"], article[role="article"], div[data-testid="cellInnerDiv"]');
                console.log(`📊 After waiting: Found ${tweets.length} tweets`);
            }

            // Let's analyze the first few tweets for testing
            for (let i = 0; i < Math.min(3, tweets.length); i++) {
                try {
                    // Try multiple ways to get tweet text and author
                    const tweetText = await tweets[i].evaluate(el => {
                        // Try various selectors for tweet text
                        const textSelectors = [
                            '[data-testid="tweetText"]',
                            '.tweet-text',
                            '[role="text"]',
                            'div[lang]'
                        ];

                        for (const selector of textSelectors) {
                            const textEl = el.querySelector(selector);
                            if (textEl) return textEl.textContent;
                        }

                        // Fallback: get all text from the tweet
                        return el.textContent;
                    }).catch(() => 'No text found');

                    const authorName = await tweets[i].evaluate(el => {
                        const authorSelectors = [
                            '[data-testid="User-Name"]',
                            '.username',
                            '[role="link"] > div > div > span'
                        ];

                        for (const selector of authorSelectors) {
                            const authorEl = el.querySelector(selector);
                            if (authorEl) return authorEl.textContent;
                        }

                        return 'Unknown author';
                    }).catch(() => 'Unknown author');

                    console.log(`\n🐦 Tweet ${i + 1}:`);
                    console.log(`👤 Author: ${authorName}`);
                    console.log(`📝 Text: ${tweetText.substring(0, 150)}...`);

                    // Basic spam detection test
                    const spamIndicators = [
                        /\d+k?\s*stars?\s*in\s*\d+\s*hours?/i,
                        /revolutionary\s*ai\s*breakthrough/i,
                        /this\s*changes\s*everything/i,
                        /dm\s*for/i
                    ];

                    const isSpam = spamIndicators.some(pattern => pattern.test(tweetText));

                    if (isSpam) {
                        console.log(`🚩 SPAM DETECTED - Would filter this tweet`);
                    } else {
                        console.log(`✅ Looks legitimate`);
                    }

                } catch (error) {
                    console.log(`⚠️ Could not analyze tweet ${i + 1}: ${error.message}`);
                }
            }

        } else {
            // Check if we're on a login page
            const loginButton = await page.$('a[href="/login"], a[href="/i/flow/login"], [data-testid="loginButton"]');
            const signupButton = await page.$('a[href="/signup"], [data-testid="signupButton"]');

            if (loginButton || signupButton) {
                console.log('🔐 Twitter/X is showing login page. Please log in first.');
                console.log('💡 The browser will stay open so you can log in manually...');

                // Keep browser open longer for manual login
                console.log('⏳ Waiting 2 minutes for you to log in...');
                await page.waitForTimeout(120000);

                // Try again after manual login
                console.log('🔄 Trying to find timeline again...');
                for (const selector of timelineSelectors) {
                    timelineExists = await page.$(selector);
                    if (timelineExists) {
                        console.log(`✅ Found timeline after login: ${selector}`);

                        // Quick recount of tweets
                        const tweets = await page.$$('[data-testid="tweet"], article[role="article"]');
                        console.log(`📊 Found ${tweets.length} tweets in timeline`);
                        break;
                    }
                }

                if (!timelineExists) {
                    console.log('❌ Still could not find timeline. Try refreshing the page.');
                }

            } else {
                console.log('❌ Could not find Twitter timeline or login page. Unknown page state.');
                console.log('🌐 Current URL:', page.url());
                console.log('📄 Page title:', await page.title());
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('\n🎯 Test complete. Ready to build filtering system!');

    // Keep browser open for manual inspection
    console.log('Browser will stay open for 30 seconds...');
    await page.waitForTimeout(30000);

    await browser.close();
}

// Run the test
testTwitterAccess().catch(console.error);
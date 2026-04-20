const { chromium } = require('playwright');

async function openTwitterForLogin() {
    console.log('🚀 Opening browser for Twitter/X login...');

    const browser = await chromium.launchPersistentContext('/Users/tylerroessel/Library/Application Support/Google/Chrome/Default', {
        headless: false,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    console.log('📱 Navigating to X.com...');
    await page.goto('https://x.com');

    console.log('🔐 Please log in to your Twitter/X account in the browser window.');
    console.log('⏳ I\'ll wait here until you\'re done...');
    console.log('💬 Type anything in this terminal when you\'re logged in and ready to continue!');

    // Keep the browser open and wait
    await new Promise(resolve => {
        process.stdin.once('data', () => {
            console.log('✅ Got it! Proceeding with Twitter Guardian setup...');
            resolve();
        });
    });

    // Don't close the browser - we'll use it for the next step
    console.log('🎯 Browser staying open for Twitter Guardian testing...');

    return { browser, page };
}

// Run the login helper
openTwitterForLogin().then(({ browser, page }) => {
    console.log('🎉 Ready to build your Twitter Guardian!');
    console.log('🔧 Run: node twitter-guardian-v2.js to start analyzing your timeline');
}).catch(console.error);
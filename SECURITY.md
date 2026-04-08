# Twitter Guardian - Security & Privacy

## 🔒 Security Guarantee

**This extension NEVER accesses, stores, or transmits any login credentials, passwords, or personal authentication data.**

## What the Extension Does

### ✅ ONLY Accesses Public Data
- **Public tweets** visible on your timeline
- **Public usernames** (@handles) 
- **Public engagement metrics** (likes, retweets)
- **Public profile information** (bio, follower count)

### ✅ Local Processing Only
- **All analysis happens in your browser** - no external servers
- **No network requests** to third-party services
- **No data transmission** outside your local Chrome instance
- **Chrome security sandbox** - isolated from other browser data

## What the Extension NEVER Does

### ❌ NO Access To Private Data
- **No passwords** - cannot see or access password fields
- **No Google login data** - doesn't interact with authentication systems
- **No private messages** - only public timeline content
- **No personal information** - doesn't access private profile data
- **No financial information** - no access to payment methods
- **No browsing history** - only current Twitter/X tabs

### ❌ NO External Communication
- **No analytics tracking** - doesn't send usage data anywhere
- **No cloud storage** - everything stays on your device
- **No API calls** - doesn't communicate with external services
- **No data collection** - doesn't gather personal information

## Extension Permissions Explained

### Required Permissions
```json
"permissions": [
    "storage",      // Save spam patterns locally in YOUR browser
    "activeTab"     // Access current Twitter tab when you activate extension
],

"host_permissions": [
    "https://x.com/*",       // Only works on Twitter/X pages
    "https://twitter.com/*"  // Only works on Twitter/X pages
]
```

### What These Permissions Mean
- **"storage"**: Saves spam detection patterns locally in your browser (never transmitted)
- **"activeTab"**: Only accesses Twitter tabs, only when extension is active
- **"host_permissions"**: Only works on Twitter/X - cannot access other websites

## How Spam Detection Works

### 1. Text Pattern Matching
```javascript
// Example: looks for obvious spam patterns in tweet text
patterns = [
    "100k stars in 24 hours",  // Impossible GitHub claims
    "DM for access",           // Generic spam language
    "Revolutionary AI breakthrough" // Vague hype claims
]
```

### 2. Account Analysis
```javascript
// Example: analyzes public account characteristics  
if (account.followers < 100 && account.username.match(/random\d{6}/)) {
    // Likely bot account based on public data
}
```

### 3. Protective Filtering
```javascript
// Example: protects high-value accounts
if (account.verified || account.bio.includes("Google Engineer")) {
    // Never take action against this account
}
```

## Data Storage

### Local Browser Storage Only
- **Spam patterns**: Stored in Chrome's local storage (encrypted by Chrome)
- **Action logs**: Kept locally for your review
- **Settings**: Your preferences stored locally
- **Statistics**: Block/unfollow counts stored locally

### No External Storage
- **No cloud databases** - nothing uploaded anywhere
- **No user accounts** - no registration or login to external services
- **No analytics** - no tracking or monitoring

## Source Code Transparency

### Open Source
- **All code is readable** - you can inspect every line
- **No obfuscation** - clear, understandable JavaScript
- **No hidden functionality** - everything is documented

### Manual Review Recommended
- **Check manifest.json** - see exact permissions requested
- **Review content-script.js** - see what it does on Twitter pages
- **Inspect network tab** - verify no external requests

## Chrome Extension Security

### Browser Isolation
- **Sandboxed execution** - isolated from other browser data
- **Limited permissions** - only what's explicitly declared
- **Chrome oversight** - follows Chrome Web Store security policies

### User Control
- **Easy uninstall** - remove completely anytime
- **Toggle on/off** - disable extension without uninstalling  
- **Clear data** - remove all local data through Chrome settings

## Best Practices Followed

### Security Standards
- **Minimal permissions** - only requests what's absolutely necessary
- **Content Security Policy** - prevents code injection
- **No eval()** - no dynamic code execution
- **Input validation** - sanitizes all user data

### Privacy Standards  
- **No fingerprinting** - doesn't create unique user identifiers
- **No cross-site tracking** - only works on Twitter
- **No behavioral analysis** - doesn't profile user habits
- **No data mining** - doesn't collect personal information

## Verification Steps

### How to Verify Extension Security

1. **Check Permissions**:
   - Chrome → Extensions → Twitter Guardian → Details
   - Review "Site access" and "Permissions"
   - Confirm only Twitter access

2. **Monitor Network Activity**:
   - Open Chrome DevTools (F12)
   - Go to Network tab  
   - Verify no external requests when extension runs

3. **Review Local Storage**:
   - DevTools → Application → Storage → Extension
   - See only local spam patterns, no personal data

4. **Test in Incognito**:
   - Extension won't work (no login session)
   - Confirms it only works with existing login

## Support & Questions

If you have security concerns:
1. **Review the source code** in the extension files
2. **Check Chrome's extension security logs**
3. **Monitor network activity** during extension use
4. **Contact for clarification** on any functionality

**Remember**: This extension works exactly like manually browsing Twitter and deciding which tweets look like spam - it just automates that process. It has no special access beyond what you already see when browsing Twitter normally.
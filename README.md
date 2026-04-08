# Twitter Guardian Extension - Installation Guide

## 🚀 Quick Install (5 minutes)

### Step 1: Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Toggle "Developer mode" ON (top right)
3. Click "Load unpacked"
4. Select the `twitter-guardian-extension` folder
5. Extension should appear with green "ON" toggle

### Step 2: Test on Twitter
1. Go to `https://x.com` (where you're already logged in)
2. You should see a floating "🛡️ Twitter Guardian" panel (top right)
3. Click "Analyze Timeline" to test spam detection
4. Click "Auto Cleanup" to start autonomous blocking/unfollowing

### Step 3: Verify Security
1. Open Chrome DevTools (F12) → Network tab
2. Run the extension and confirm NO external network requests
3. Check extension permissions: only Twitter access, local storage

## 🎯 How It Works

**Real-time Monitoring**: Automatically scans tweets as you scroll
**Spam Detection**: Flags "100K stars in 24hrs" and similar impossible claims  
**Account Protection**: Never touches verified accounts or tech professionals
**Visual Feedback**: Red borders on spam, stats in control panel

## ⚙️ Controls

- **Analyze Timeline**: Manual scan of current visible tweets
- **Auto Cleanup**: Autonomous blocking and unfollowing 
- **Stats Panel**: Live count of analyzed/blocked/unfollowed accounts

## 🛡️ Safety Features

- **High-value Protection**: Won't touch accounts with 10K+ followers, verified accounts, or tech companies
- **Rate Limiting**: 2-second delays between actions to avoid detection
- **Action Logging**: Complete record of all actions taken
- **Manual Override**: Can disable or uninstall instantly

## 🔧 Troubleshooting

**Extension not working?**
- Refresh the Twitter page
- Check if you're logged into Twitter
- Verify extension is enabled in chrome://extensions/

**No spam detected?**
- Good news - your timeline might actually be clean!
- Try scrolling to load more content
- Extension learns patterns over time

**Want to stop it?**
- Toggle extension OFF in chrome://extensions/
- Or uninstall completely to remove all data

## 📊 What Gets Analyzed

✅ **Public tweet content** - text you can see on timeline
✅ **Public usernames** - @handles visible on posts
✅ **Public engagement** - like/retweet counts visible to you
✅ **Public account info** - follower counts, verification status

❌ **NO passwords, login data, private messages, personal information**
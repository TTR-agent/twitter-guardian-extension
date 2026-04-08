// Twitter Guardian - Popup Script

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadAllowlist();
    loadMissedClicks();

    document.getElementById('analyze-btn').addEventListener('click', analyzeTimeline);
    document.getElementById('report-btn').addEventListener('click', openReport);
    document.getElementById('save-allowlist-btn').addEventListener('click', saveAllowlist);

    checkActiveStatus();
});

function withActiveTwitterTab(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab && (tab.url.includes('x.com') || tab.url.includes('twitter.com'))) {
            cb(tab);
        } else {
            cb(null);
        }
    });
}

function loadStats() {
    withActiveTwitterTab((tab) => {
        if (!tab) {
            document.getElementById('analyzed-count').textContent = '0';
            document.getElementById('spam-count').textContent = '0';
            document.getElementById('not-interested-count').textContent = '0';
            document.getElementById('missed-count').textContent = '0';
            document.getElementById('allowlist-size').textContent = '0';
            document.getElementById('training-status').textContent = 'Inactive';
            return;
        }
        chrome.tabs.sendMessage(tab.id, { action: 'getStats' }, (response) => {
            if (chrome.runtime.lastError || !response) return;
            document.getElementById('analyzed-count').textContent = response.analyzed || 0;
            document.getElementById('spam-count').textContent = response.spam || 0;
            document.getElementById('not-interested-count').textContent = response.notInterested || 0;
            document.getElementById('missed-count').textContent = response.missedClicks || 0;
            document.getElementById('allowlist-size').textContent = response.allowlistSize || 0;
            document.getElementById('training-status').textContent = response.algorithmTraining ? 'Active' : 'Disabled';
        });
    });
}

function analyzeTimeline() {
    withActiveTwitterTab((tab) => {
        if (!tab) return;
        chrome.tabs.sendMessage(tab.id, { action: 'analyzeTimeline' });
        const btn = document.getElementById('analyze-btn');
        btn.textContent = 'Analyzing...';
        setTimeout(() => {
            btn.textContent = 'Analyze Current Timeline';
            loadStats();
            loadMissedClicks();
        }, 2500);
    });
}

function openReport() {
    chrome.tabs.create({ url: chrome.runtime.getURL('report.html') });
}

function loadAllowlist() {
    withActiveTwitterTab((tab) => {
        if (!tab) {
            // Fallback: read directly from storage
            chrome.storage.local.get(['guardianAllowlist'], (data) => {
                const list = data.guardianAllowlist || [];
                document.getElementById('allowlist-input').value = list.join('\n');
            });
            return;
        }
        chrome.tabs.sendMessage(tab.id, { action: 'getAllowlist' }, (response) => {
            if (chrome.runtime.lastError || !response) return;
            document.getElementById('allowlist-input').value = (response.allowlist || []).join('\n');
        });
    });
}

function saveAllowlist() {
    const raw = document.getElementById('allowlist-input').value || '';
    const list = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

    // Persist to storage directly so it works even without a Twitter tab
    chrome.storage.local.set({ guardianAllowlist: list.map(h => h.toLowerCase().replace(/^@/, '')) });

    // Also push live to the content script if we're on Twitter
    withActiveTwitterTab((tab) => {
        if (tab) {
            chrome.tabs.sendMessage(tab.id, { action: 'setAllowlist', list }, () => { loadStats(); });
        }
    });

    const btn = document.getElementById('save-allowlist-btn');
    const prev = btn.textContent;
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = prev; }, 1200);
}

function loadMissedClicks() {
    const render = (missed) => {
        const el = document.getElementById('missed-list');
        if (!missed || missed.length === 0) {
            el.innerHTML = '<div class="empty">None yet. Manually dismiss a tweet to populate this.</div>';
            return;
        }
        const recent = missed.slice(-20).reverse();
        el.innerHTML = recent.map(m => {
            const safe = (m.text || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
            const score = typeof m.ourScore === 'number' ? `score ${m.ourScore}` : '';
            return `<div class="item">${safe.substring(0,140)}${safe.length > 140 ? '…' : ''}<br><span style="color:#A7A39A">${score}</span></div>`;
        }).join('');
    };

    withActiveTwitterTab((tab) => {
        if (!tab) {
            chrome.storage.local.get(['guardianMissedClicks'], (data) => render(data.guardianMissedClicks || []));
            return;
        }
        chrome.tabs.sendMessage(tab.id, { action: 'getMissedClicks' }, (response) => {
            if (chrome.runtime.lastError || !response) {
                chrome.storage.local.get(['guardianMissedClicks'], (data) => render(data.guardianMissedClicks || []));
                return;
            }
            render(response.missed || []);
        });
    });
}

function checkActiveStatus() {
    withActiveTwitterTab((tab) => {
        const status = document.getElementById('status');
        if (tab) {
            status.textContent = '✅ Active on Twitter/X';
            status.className = 'status active';
        } else {
            status.textContent = '⚠️ Visit Twitter/X to activate';
            status.className = 'status inactive';
        }
    });
}

setInterval(loadStats, 5000);

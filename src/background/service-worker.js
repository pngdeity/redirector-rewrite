import { Engine } from '../core/engine.js';
import { Storage } from '../adapters/storage.js';
import { Interceptor } from '../adapters/interceptor.js';

console.log('Redirector MV3 Service Worker initialized.');

function isDarkMode() {
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

function getThemeIcon() {
  return isDarkMode() ? 'icon-light' : 'icon-dark';
}

function isChromeUA() {
  return navigator.userAgent.toLowerCase().includes('chrome')
    && !navigator.userAgent.toLowerCase().includes('opr');
}

function updateThemeIcon() {
  const prefix = getThemeIcon();
  chrome.action.setIcon({
    path: {
      16:  `assets/icons/${prefix}-16.png`,
      32:  `assets/icons/${prefix}-32.png`,
      48:  `assets/icons/${prefix}-48.png`,
      128: `assets/icons/${prefix}-128.png`
    }
  });
}

async function updateBadge() {
  const result = await chrome.storage.local.get({ disabled: false });
  if (result.disabled) {
    chrome.action.setBadgeText({ text: 'off' });
    chrome.action.setBadgeBackgroundColor({ color: '#fc5953' });
  } else {
    chrome.action.setBadgeText({ text: 'on' });
    chrome.action.setBadgeBackgroundColor({ color: '#35b44a' });
  }
}

updateThemeIcon();
updateBadge();

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeIcon);

chrome.storage.onChanged.addListener((changes) => {
  if (changes.disabled) {
    updateBadge();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  try {
    console.log('Redirector extension installed/updated.');
    await Storage.initDefaults();

    const rules = await Storage.getRules();
    if (rules.length === 0) {
      await Storage.saveRules([{
        id: crypto.randomUUID(),
        description: 'Example: Redirect Wikipedia to Wikipedia mobile',
        exampleUrl: 'https://en.wikipedia.org/wiki/Main_Page',
        includePattern: '*://en.wikipedia.org/wiki/*',
        excludePattern: '',
        patternDesc: 'The second wildcard group (*) is captured as $2 for the target URL.',
        targetUrl: 'https://en.m.wikipedia.org/wiki/$2',
        patternType: 'WILDCARD',
        matchProcessing: 'NONE',
        enabled: true,
        appliesTo: ['main_frame'],
        grouped: false
      }]);
    }

    await Interceptor.syncRulesWithBrowser();
  } catch (err) {
    console.error('[Service Worker] Installation/update failed:', err);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return;
  if (message.type === 'SYNC_RULES') {
    Interceptor.syncRulesWithBrowser()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }
});

/**
 * Triggers a native browser desktop toast notification when a redirect occurs.
 */
async function triggerRedirectNotification(sourceUrl, targetUrl) {
  try {
    const options = await Storage.getOptions();
    if (!options.enableNotifications) return;

    const isChrome = isChromeUA();
    const iconUrl = chrome.runtime.getURL(`assets/icons/${getThemeIcon()}-128.png`);

    if (isChrome) {
      chrome.notifications.create({
        type: 'list',
        iconUrl,
        title: 'Redirector Intercepted',
        message: 'Redirector Intercepted',
        items: [
          { title: 'Original: ', message: sourceUrl },
          { title: 'Redirected to: ', message: targetUrl }
        ],
        priority: 1
      });
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl,
        title: 'Redirector Intercepted',
        message: `Redirected:\nFrom: ${sourceUrl}\nTo: ${targetUrl}`,
        priority: 1
      });
    }
  } catch (err) {
    console.error('[Service Worker] Failed to trigger notification:', err);
  }
}

/**
 * Intercept Single-Page Application (SPA) HistoryState transitions (e.g. pushState / replaceState updates).
 */
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  try {
    if (details.frameId !== 0) return;

    const isDisabled = await Storage.isDisabled();
    if (isDisabled) return;

    const rules = await Storage.getRules();
    // Filter rules that explicitly apply to HistoryState
    const historyRules = rules.filter(r => r.enabled && r.appliesTo && r.appliesTo.includes('history'));
    if (historyRules.length === 0) return;

    const result = Engine.evaluateRules(historyRules, details.url);
    if (result && result.matched && result.resultUrl && result.resultUrl !== details.url) {
      console.log(`[HistoryState SPA] Intercepted navigation: ${details.url} -> ${result.resultUrl}`);

      chrome.tabs.update(details.tabId, { url: result.resultUrl });

      await triggerRedirectNotification(details.url, result.resultUrl);
    }
  } catch (err) {
    console.error('[Service Worker] HistoryState redirect error:', err);
  }
});

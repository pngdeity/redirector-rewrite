import { Storage } from '../../adapters/storage.js';

const toggleDisabledBtn = document.getElementById('toggle-disabled');
const openDashboardBtn = document.getElementById('open-dashboard');
const enableLoggingCheckbox = document.getElementById('enable-logging');
const enableNotificationsCheckbox = document.getElementById('enable-notifications');
const versionFooter = document.getElementById('version-footer');

/**
 * Sync UI representation with the storage model state
 */
let optionsState = {};

async function syncUI() {
  const disabled = await Storage.isDisabled();
  const options = await Storage.getOptions();
  optionsState = { ...options };

  if (disabled) {
    toggleDisabledBtn.className = 'btn btn-toggle disabled';
    toggleDisabledBtn.textContent = 'Disabled';
  } else {
    toggleDisabledBtn.className = 'btn btn-toggle enabled';
    toggleDisabledBtn.textContent = 'Enabled';
  }

  enableLoggingCheckbox.checked = options.logging;
  enableNotificationsCheckbox.checked = options.enableNotifications;
}

/**
 * Handle Global Toggle Click
 */
async function handleToggle() {
  const currentDisabled = await Storage.isDisabled();
  const newDisabled = !currentDisabled;
  
  await Storage.setDisabled(newDisabled);
  
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: 'SYNC_RULES' });
  }

  await syncUI();
}

/**
 * Handle individual option toggle
 */
async function handleOptionToggle(key, element) {
  optionsState[key] = element.checked;
  await Storage.saveOptions(optionsState);
}

/**
 * Open full Options Dashboard in a new or existing tab
 */
function openDashboard() {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    const url = chrome.runtime.getURL('ui/dashboard/dashboard.html');
    
    // Check if the dashboard is already open in a tab to avoid cluttering tabs
    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs.find(tab => tab.url === url);
      if (existingTab) {
        chrome.tabs.update(existingTab.id, { active: true });
        window.close();
      } else {
        chrome.tabs.create({ url, active: true });
      }
    });
  } else {
    console.log('[Popup] Extension context unavailable. Simulating opening dashboard page.');
  }
}

async function init() {
  await syncUI();

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    versionFooter.textContent = `Redirector Rewrite v${chrome.runtime.getManifest().version}`;
  }

  toggleDisabledBtn.addEventListener('click', handleToggle);
  openDashboardBtn.addEventListener('click', openDashboard);
  
  enableLoggingCheckbox.addEventListener('change', () => 
    handleOptionToggle('logging', enableLoggingCheckbox)
  );
  
  enableNotificationsCheckbox.addEventListener('change', () => 
    handleOptionToggle('enableNotifications', enableNotificationsCheckbox)
  );
}

document.addEventListener('DOMContentLoaded', init);

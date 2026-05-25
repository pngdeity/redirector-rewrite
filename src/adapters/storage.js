/**
 * Storage Adapter
 * Abstracts browser extension storage APIs to enable browser-independent testing and mocked defaults.
 */

const STORAGE_DEFAULTS = {
  rules: [],
  disabled: false,
  logging: false,
  enableNotifications: false,
  isSyncEnabled: false,
};

// Memory fallback for environments without chrome.storage (e.g. Node tests, mock runtime)
const mockStorage = {
  ...JSON.parse(JSON.stringify(STORAGE_DEFAULTS))
};

const isExtensionEnvironment = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

let _syncEnabled = false;

function getRulesStorageArea() {
  if (!isExtensionEnvironment) return null;
  return _syncEnabled ? chrome.storage.sync : chrome.storage.local;
}

export class Storage {
  /**
   * Initializes storage defaults if not already present in the browser store.
   */
  static async initDefaults() {
    if (isExtensionEnvironment) {
      const result = await chrome.storage.local.get(STORAGE_DEFAULTS);
      const missing = Object.entries(STORAGE_DEFAULTS).filter(([k]) => result[k] === undefined);
      if (missing.length > 0) {
        await chrome.storage.local.set(Object.fromEntries(missing));
      }
      _syncEnabled = result.isSyncEnabled || false;
    } else {
      console.log('[Storage] Extension API unavailable. Initializing mock memory storage.');
    }
  }

  /**
   * Retrieves all rules.
   * @returns {Promise<Array<Object>>}
   */
  static async getRules() {
    if (isExtensionEnvironment) {
      const result = await getRulesStorageArea().get({ rules: [] });
      return result.rules;
    }
    return [...mockStorage.rules];
  }

  /**
   * Saves rules array to storage.
   * @param {Array<Object>} rules
   * @returns {Promise<void>}
   */
  static async saveRules(rules) {
    if (isExtensionEnvironment) {
      await getRulesStorageArea().set({ rules });
    } else {
      mockStorage.rules = [...rules];
    }
  }

  /**
   * Retrieves the global disabled status of the extension.
   * @returns {Promise<boolean>}
   */
  static async isDisabled() {
    if (isExtensionEnvironment) {
      const result = await chrome.storage.local.get({ disabled: false });
      return result.disabled;
    }
    return mockStorage.disabled;
  }

  /**
   * Sets the global disabled status.
   * @param {boolean} disabled
   * @returns {Promise<void>}
   */
  static async setDisabled(disabled) {
    if (isExtensionEnvironment) {
      await chrome.storage.local.set({ disabled });
    } else {
      mockStorage.disabled = disabled;
    }
  }

  /**
   * Retrieves miscellaneous options (logging, notifications, sync).
   * @returns {Promise<Object>}
   */
  static async getOptions() {
    if (isExtensionEnvironment) {
      return await chrome.storage.local.get({ logging: false, enableNotifications: false, isSyncEnabled: false });
    }
    return {
      logging: mockStorage.logging,
      enableNotifications: mockStorage.enableNotifications,
      isSyncEnabled: mockStorage.isSyncEnabled,
    };
  }

  /**
   * Sets miscellaneous options.
   * @param {Object} options
   * @returns {Promise<void>}
   */
  static async saveOptions(options) {
    const validKeys = ['logging', 'enableNotifications', 'isSyncEnabled'];
    const clean = {};
    for (const key of validKeys) {
      if (key in options) clean[key] = options[key];
    }

    if (isExtensionEnvironment) {
      await chrome.storage.local.set(clean);
    } else {
      if ('logging' in clean) mockStorage.logging = clean.logging;
      if ('enableNotifications' in clean) mockStorage.enableNotifications = clean.enableNotifications;
      if ('isSyncEnabled' in clean) mockStorage.isSyncEnabled = clean.isSyncEnabled;
    }
  }

  static async _enableSync() {
    const rulesResult = await chrome.storage.local.get({ rules: [] });
    const rules = rulesResult.rules;

    const bytesResult = await chrome.storage.local.getBytesInUse('rules');
    const quota = chrome.storage.sync.QUOTA_BYTES_PER_ITEM;
    if (bytesResult > quota) {
      return {
        success: false,
        message: `Rules size (${bytesResult} bytes) exceeds sync quota (${quota} bytes). Use fewer rules or disable sync.`
      };
    }

    if (rules.length > 0) {
      await chrome.storage.sync.set({ rules });
      await chrome.storage.local.remove('rules');
    }

    await chrome.storage.local.set({ isSyncEnabled: true });
    _syncEnabled = true;
    return { success: true, message: 'Sync enabled — rules moved to sync storage.' };
  }

  static async _disableSync() {
    const rulesResult = await chrome.storage.sync.get({ rules: [] });
    const rules = rulesResult.rules;

    if (rules.length > 0) {
      await chrome.storage.local.set({ rules });
      await chrome.storage.sync.remove('rules');
    }

    await chrome.storage.local.set({ isSyncEnabled: false });
    _syncEnabled = false;
    return { success: true, message: 'Sync disabled — rules moved to local storage.' };
  }

  /**
   * Toggles between local and sync storage for rules.
   * Migrates existing rules to the target storage area.
   * @param {boolean} enableSync
   * @returns {Promise<{success: boolean, message: string}>}
   */
  static async toggleSync(enableSync) {
    if (!isExtensionEnvironment) {
      return { success: false, message: 'Extension API unavailable.' };
    }

    try {
      return enableSync ? await this._enableSync() : await this._disableSync();
    } catch (err) {
      return { success: false, message: `Sync toggle failed: ${err?.message || String(err)}` };
    }
  }
}

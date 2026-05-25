import { Storage } from './storage.js';
import { compileWildcardPattern } from '../core/engine.js';

/**
 * Interceptor Adapter
 * Handles registering, deregistering, and synchronization of rules with the browser's native Manifest V3 network interception APIs.
 */

const isExtensionEnvironment = typeof chrome !== 'undefined' && chrome.declarativeNetRequest;

export class Interceptor {
  /**
   * Syncs the rules stored in Local Storage with the browser's active Declarative Net Request rules registry.
   * @returns {Promise<void>}
   */
  static async syncRulesWithBrowser() {
    if (!isExtensionEnvironment) {
      console.log('[Interceptor] Extension API declarativeNetRequest unavailable. Skipping browser sync.');
      return;
    }

    const rules = await Storage.getRules();
    const isDisabled = await Storage.isDisabled();

    // In Manifest V3, we clear existing dynamic rules and register new ones.
    // 1. Get currently registered dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map(r => r.id);

    // If global kill-switch is active (disabled = true), do not register any rules (we clear them all).
    if (isDisabled) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules: []
      });
      console.log('[Interceptor] Extension disabled. Cleared all active redirect rules.');
      return;
    }

    // 2. Map user-defined custom rules to dynamic DNR rules
    const addRules = [];
    let ruleIdCounter = 1; // DNR rules require numeric IDs > 0

    for (const rule of rules) {
      if (!rule.enabled) continue;

      try {
        const dnrRule = await this.mapToDnrRule(rule, ruleIdCounter++);
        if (dnrRule) {
          addRules.push(dnrRule);
        }
      } catch (err) {
        console.error(`[Interceptor] Failed to compile rule "${rule.description}":`, err);
      }
    }

    // 3. Update dynamic rules in browser
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules
    });

    console.log(`[Interceptor] Synchronized ${addRules.length} active redirect rules with the browser.`);
  }

  /**
   * Maps our rule representation to a Chrome Declarative Net Request rule.
   * @param {Object} rule - Our internal rule schema
   * @param {number} numericId - Positive integer required by chrome.declarativeNetRequest
   * @returns {Object|null} DNR Rule object
   */
  static async mapToDnrRule(rule, numericId) {
    // Determine the matching condition
    const condition = {};

    // Map resource types (appliesTo)
    // DNR resource types include: "main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object", "xmlhttprequest", "media", "websocket", "other"
    if (rule.appliesTo && rule.appliesTo.length > 0) {
      condition.resourceTypes = rule.appliesTo
        .map(t => t.toLowerCase())
        .filter(type =>
          ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'media', 'websocket', 'other'].includes(type)
        );
    }

    // Pattern type compilation
    let regexStr;
    if (rule.patternType === 'REGEX') {
      regexStr = rule.includePattern;
    } else {
      regexStr = compileWildcardPattern(rule.includePattern);
    }

    const regexCheck = await chrome.declarativeNetRequest.isRegexSupported({ regex: regexStr });
    if (!regexCheck.isSupported) {
      console.warn(`[Interceptor] Skipping rule "${rule.description}": regex not supported by DNR`);
      return null;
    }
    condition.regexFilter = regexStr;

    if (rule.excludePattern) {
      console.warn(`[Interceptor] DNR does not support exclude patterns within a single rule. Skipping excludePattern "${rule.excludePattern}" for DNR rule. The JS engine will still evaluate excludes at runtime.`);
    }

    // Define redirect action
    const action = {
      type: 'redirect',
      redirect: {
        // Map target URL. DNR supports regex substitutions if using regexFilter.
        // We substitute user capture groups ($1, $2) with DNR capture groups (\1, \2)
        regexSubstitution: rule.targetUrl.replace(/\$(\d+)/g, '\\$1')
      }
    };

    return {
      id: numericId,
      priority: 1,
      action,
      condition
    };
  }
}

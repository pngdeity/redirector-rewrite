/**
 * Pure URL Rewrite Engine
 * This engine has NO browser dependencies (no chrome.*, no DOM) and is fully unit-testable.
 */

/**
 * Converts a user-supplied wildcard pattern to a regex string (shared with DNR interceptor).
 * Escapes all regex-special characters except `*`, then maps `*` to non-greedy `(.*?)`.
 * @param {string} pattern
 * @returns {string}
 */
export function compileWildcardPattern(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
  return '^' + escaped.replace(/\*/g, '(.*?)') + '$';
}

export class Engine {
  /**
   * Evaluates a URL against a set of redirect rules.
   * @param {Array<Object>} rules - Sorted array of redirect rules.
   * @param {string} url - Outbound URL string to intercept.
   * @returns {Object|null} Match result, or null if no rule matches.
   */
  static evaluateRules(rules, url) {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      
      const result = this.evaluateRule(rule, url);
      if (result && result.matched) {
        return result;
      }
    }
    return null;
  }

  /**
   * Evaluates a single rule against a URL.
   * @param {Object} rule - The redirect rule object.
   * @param {string} url - The URL to test.
   * @returns {Object} { matched: boolean, resultUrl: string|null, error: string|null }
   */
  static evaluateRule(rule, url) {
    try {
      // 1. Check Include Pattern
      const includeRegex = this.patternToRegex(rule.includePattern, rule.patternType);
      const match = url.match(includeRegex);
      if (!match) {
        return { matched: false };
      }

      // 2. Check Exclude Pattern (if present)
      if (rule.excludePattern) {
        const excludeRegex = this.patternToRegex(rule.excludePattern, rule.patternType);
        if (url.match(excludeRegex)) {
          return { matched: false };
        }
      }

      // 3. Process matches and substitute variables
      const substitutedUrl = this.substitute(rule.targetUrl, match, rule.matchProcessing);

      return {
        matched: true,
        resultUrl: substitutedUrl,
        error: null
      };
    } catch (err) {
      return {
        matched: false,
        resultUrl: null,
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Compiles wildcards or regex string to a RegExp object.
   * @param {string} pattern 
   * @param {string} type - 'REGEX' or 'WILDCARD'
   * @returns {RegExp}
   */
  static patternToRegex(pattern, type) {
    if (type === 'REGEX') {
      return new RegExp(pattern, 'i');
    }

    return new RegExp(compileWildcardPattern(pattern), 'i');
  }

  /**
   * Substitutes capture groups and processes them based on MatchProcessing mode.
   * @param {string} targetUrl 
   * @param {Array<string>} matches - regex matches array
   * @param {string} processing - 'NONE', 'URL_DECODE', etc.
   * @returns {string}
   */
  static substitute(targetUrl, matches, processing) {
    return targetUrl.replace(/\$(\d+)/g, (_, num) => {
      const val = matches[num] || '';
      return this.applyProcessing(val, processing);
    });
  }

  /**
   * Applies processing options to a match value before substitution.
   * @param {string} val 
   * @param {string} mode - 'NONE', 'URL_ENCODE', 'URL_DECODE', etc.
   * @returns {string}
   */
  static applyProcessing(val, mode) {
    switch (mode) {
      case 'URL_ENCODE':
        return encodeURIComponent(val);
      case 'URL_DECODE':
        return decodeURIComponent(val);
      case 'DOUBLE_URL_DECODE':
        try {
          return decodeURIComponent(decodeURIComponent(val));
        } catch {
          return decodeURIComponent(val);
        }
      case 'BASE64_DECODE':
        try {
          return atob(val);
        } catch {
          return val; // Fallback on decode failure
        }
      case 'NONE':
      default:
        return val;
    }
  }

  /**
   * Evaluates a URL recursively against a list of rules to detect infinite redirect loops.
   * @param {Array<Object>} rules - Sorted active rules.
   * @param {string} startUrl - Initial URL to test.
   * @param {Object} [currentRuleOverride] - Optional rule being edited to include in test cycle.
   * @param {number} [maxSteps=10] - Safe recursion limit depth.
   * @returns {Object} { matched: boolean, resultUrl: string|null, steps: number, error: string|null, loop: boolean }
   */
  static evaluateRedirectChain(rules, startUrl, currentRuleOverride = null, maxSteps = 10) {
    let currentUrl = startUrl;
    const visited = new Set([startUrl]);
    let steps = 0;
    let matched = false;

    // Compile rules list to include the override if provided (e.g. testing unsaved edits)
    let activeRules = [...rules];
    if (currentRuleOverride) {
      const idx = activeRules.findIndex(r => r.id === currentRuleOverride.id);
      if (idx !== -1) {
        activeRules[idx] = currentRuleOverride;
      } else {
        // Unsaved new rule: insert at the beginning for testing purposes
        activeRules.unshift(currentRuleOverride);
      }
    }

    while (steps < maxSteps) {
      const matchResult = this.evaluateRules(activeRules, currentUrl);
      if (!matchResult || !matchResult.matched) {
        break;
      }

      matched = true;
      const nextUrl = matchResult.resultUrl;
      steps++;

      // If next URL matches its own output or takes us back to a visited URL: LOOP!
      if (visited.has(nextUrl)) {
        return {
          matched: true,
          resultUrl: nextUrl,
          steps,
          loop: true,
          error: `Infinite loop: ${currentUrl} -> ${nextUrl}`
        };
      }

      currentUrl = nextUrl;
      visited.add(currentUrl);
    }

    return {
      matched,
      resultUrl: currentUrl,
      steps,
      loop: false,
      error: steps >= maxSteps ? 'Redirect limit exceeded (possible loop).' : null
    };
  }
}

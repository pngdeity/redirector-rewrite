/**
 * Rules data model and validation
 */
export const PatternType = {
  REGEX: 'REGEX',
  WILDCARD: 'WILDCARD'
};

export const MatchProcessing = {
  NONE: 'NONE',
  URL_ENCODE: 'URL_ENCODE',
  URL_DECODE: 'URL_DECODE',
  DOUBLE_URL_DECODE: 'DOUBLE_URL_DECODE',
  BASE64_DECODE: 'BASE64_DECODE'
};

export class Rule {
  /**
   * Generates a unique UUID version 4.
   * @returns {string}
   */
  static generateId() {
    return crypto.randomUUID();
  }

  /**
   * Validates a rule object against required schema properties.
   * @param {Object} rule 
   * @returns {Array<string>} List of validation errors (empty array if valid).
   */
  static validate(rule) {
    const errors = [];
    
    if (rule.grouped !== undefined && typeof rule.grouped !== 'boolean') {
      errors.push('Grouped property must be a boolean.');
    }

    if (!rule.description || rule.description.trim() === '') {
      errors.push('Description is required.');
    }
    
    if (!rule.includePattern || rule.includePattern.trim() === '') {
      errors.push('Include pattern is required.');
    } else {
      try {
        if (rule.patternType === PatternType.REGEX) {
          new RegExp(rule.includePattern);
        }
      } catch (err) {
        errors.push(`Invalid regular expression in Include pattern: ${err?.message || String(err)}`);
      }
    }

    if (!rule.targetUrl || rule.targetUrl.trim() === '') {
      errors.push('Redirect target URL is required.');
    }

    if (rule.excludePattern && rule.excludePattern.trim() !== '') {
      try {
        if (rule.patternType === PatternType.REGEX) {
          new RegExp(rule.excludePattern);
        }
      } catch (err) {
        errors.push(`Invalid regular expression in Exclude pattern: ${err?.message || String(err)}`);
      }
    }

    return errors;
  }
}

/**
 * Unit tests for rules logic and schema validation
 * Run this test using: node tests/core/rules.test.js
 */
import { Rule } from '../../src/core/rules.js';

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

const runTests = () => {
  console.log('Running Rules validation tests...');

  // Test 1: Valid rule passes
  const validRule = {
    id: 'test-uuid',
    description: 'Test rule description',
    exampleUrl: 'http://example.com',
    includePattern: 'http://example.com/*',
    targetUrl: 'http://redirected.com',
    patternType: 'WILDCARD',
    matchProcessing: 'NONE',
    enabled: true,
    appliesTo: ['main_frame']
  };

  const errors1 = Rule.validate(validRule);
  assert(errors1.length === 0, 'Valid rule should have no errors');

  // Test 2: Missing description
  const invalidRule1 = { ...validRule, description: '' };
  const errors2 = Rule.validate(invalidRule1);
  assert(errors2.includes('Description is required.'), 'Should catch missing description');

  // Test 3: Invalid Regex pattern compilation
  const invalidRegexRule = {
    ...validRule,
    patternType: 'REGEX',
    includePattern: '[' // invalid regex
  };
  const errors3 = Rule.validate(invalidRegexRule);
  assert(errors3.some(e => e.startsWith('Invalid regular expression in Include pattern')), 'Should catch bad regex patterns');

  // Test 4: Invalid grouped property type
  const invalidGroupedRule = {
    ...validRule,
    grouped: 'yes' // should be boolean
  };
  const errors4 = Rule.validate(invalidGroupedRule);
  assert(errors4.includes('Grouped property must be a boolean.'), 'Should catch invalid grouped property type');

  console.log('All Rules validation tests completed successfully!');
};

try {
  runTests();
} catch (err) {
  console.error('Test Execution Failed:', err.message);
  process.exit(1);
}

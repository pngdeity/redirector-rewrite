/**
 * Unit tests for the pure Redirector matching Engine
 * Run this test using: node tests/core/engine.test.js
 */
import { Engine } from '../../src/core/engine.js';

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

const runTests = () => {
  console.log('Running Engine unit tests...');

  // Test 1: Wildcard matching
  const wildcardRule = {
    enabled: true,
    includePattern: '*://*.wikipedia.org/wiki/*',
    patternType: 'WILDCARD',
    targetUrl: 'https://wikipedia.org/wiki/$3',
    matchProcessing: 'NONE'
  };

  const result1 = Engine.evaluateRule(wildcardRule, 'http://en.wikipedia.org/wiki/Main_Page');
  assert(result1.matched === true, 'Wildcard Wikipedia rule should match');
  assert(result1.resultUrl === 'https://wikipedia.org/wiki/Main_Page', 'Wildcard substitution failed');

  // Test 2: Regex matching
  const regexRule = {
    enabled: true,
    includePattern: '^https?:\\/\\/([^\\.]+)\\.slack\\.com\\/(.*)',
    patternType: 'REGEX',
    targetUrl: 'https://slack.com/workspace/$1/path/$2',
    matchProcessing: 'NONE'
  };

  const result2 = Engine.evaluateRule(regexRule, 'https://myorg.slack.com/messages/channel');
  assert(result2.matched === true, 'Regex Slack rule should match');
  assert(result2.resultUrl === 'https://slack.com/workspace/myorg/path/messages/channel', 'Regex substitution failed');

  // Test 3: Exclude Pattern
  const ruleWithExclude = {
    enabled: true,
    includePattern: 'http://example.com/*',
    patternType: 'WILDCARD',
    excludePattern: 'http://example.com/admin/*',
    targetUrl: 'http://newplace.com/$1',
    matchProcessing: 'NONE'
  };

  const matchNormal = Engine.evaluateRule(ruleWithExclude, 'http://example.com/posts/1');
  assert(matchNormal.matched === true, 'Normal path should match include pattern');
  
  const matchExclude = Engine.evaluateRule(ruleWithExclude, 'http://example.com/admin/settings');
  assert(matchExclude.matched === false, 'Admin path should be excluded');

  // Test 4: Match Processing (URL_DECODE)
  const decodeRule = {
    enabled: true,
    includePattern: 'http://tracking.com/redirect?to=*',
    patternType: 'WILDCARD',
    targetUrl: '$1',
    matchProcessing: 'URL_DECODE'
  };

  const resultDecode = Engine.evaluateRule(decodeRule, 'http://tracking.com/redirect?to=https%3A%2F%2Fgoogle.com%3Fq%3Dhello');
  assert(resultDecode.matched === true, 'Tracking URL should match');
  assert(resultDecode.resultUrl === 'https://google.com?q=hello', 'URL decoding failed');

  // Test 5: Infinite Loop Detection
  const ruleA = {
    id: 'rule-a',
    enabled: true,
    includePattern: 'http://a.com/*',
    patternType: 'WILDCARD',
    targetUrl: 'http://b.com/$1',
    matchProcessing: 'NONE'
  };

  const ruleB = {
    id: 'rule-b',
    enabled: true,
    includePattern: 'http://b.com/*',
    patternType: 'WILDCARD',
    targetUrl: 'http://a.com/$1',
    matchProcessing: 'NONE'
  };

  const circularResult = Engine.evaluateRedirectChain([ruleA, ruleB], 'http://a.com/start');
  assert(circularResult.loop === true, 'Circular chain should be detected as a loop');
  assert(circularResult.steps === 2, 'Circular chain should fail at step 2');
  assert(circularResult.error.startsWith('Infinite loop:'), 'Loop error message should report path');

  const selfLoopRule = {
    id: 'rule-c',
    enabled: true,
    includePattern: 'http://c.com/*',
    patternType: 'WILDCARD',
    targetUrl: 'http://c.com/$1',
    matchProcessing: 'NONE'
  };

  const selfLoopResult = Engine.evaluateRedirectChain([selfLoopRule], 'http://c.com/start');
  assert(selfLoopResult.loop === true, 'Self loop should be detected');
  assert(selfLoopResult.steps === 1, 'Self loop should fail at step 1');

  // Test 6: Multi-Wildcard Lazy Parameter Extraction (MDN non-greedy)
  const multiWildcardRule = {
    enabled: true,
    includePattern: '*://example.com/search?q=*&lang=*',
    patternType: 'WILDCARD',
    targetUrl: 'https://newsearch.com/?query=$2&l=$3',
    matchProcessing: 'NONE'
  };

  const resultLazy = Engine.evaluateRule(multiWildcardRule, 'https://example.com/search?q=apples&ref=tracker&lang=en');
  assert(resultLazy.matched === true, 'Multi-wildcard pattern should match');
  assert(resultLazy.resultUrl === 'https://newsearch.com/?query=apples&ref=tracker&l=en', 'Lazy matching failed to extract parameters correctly');

  console.log('All Engine unit tests completed successfully!');
};

try {
  runTests();
} catch (err) {
  console.error('Test Execution Failed:', err.message);
  process.exit(1);
}

import { Storage } from '../../adapters/storage.js';
import { Engine } from '../../core/engine.js';
import { Rule, PatternType, MatchProcessing } from '../../core/rules.js';
import { Dom } from '../../utils/dom.js';

// DOM Elements
const rulesList = document.getElementById('rules-list');
const rulesCount = document.getElementById('rules-count');
const emptyState = document.getElementById('empty-state');

// Dialog Elements
const ruleDialog = document.getElementById('rule-dialog');
const deleteDialog = document.getElementById('delete-dialog');
const modalBackdrop = document.getElementById('modal-backdrop');
const ruleForm = document.getElementById('rule-form');
const dialogTitle = document.getElementById('dialog-title');

// Form Inputs
const ruleIdInput = document.getElementById('rule-id');
const descriptionInput = document.getElementById('rule-description');
const exampleUrlInput = document.getElementById('rule-example-url');
const includePatternInput = document.getElementById('rule-include-pattern');
const targetUrlInput = document.getElementById('rule-target-url');
const excludePatternInput = document.getElementById('rule-exclude-pattern');
const patternDescInput = document.getElementById('rule-pattern-desc');
const processingSelect = document.getElementById('rule-processing');
const applyToCheckboxes = document.getElementById('apply-to-checkboxes');
const groupedInput = document.getElementById('rule-grouped');

// Testing inputs & outputs
const testUrlInput = document.getElementById('test-url');
const testStatusBadge = document.getElementById('test-status');
const testResultSpan = document.getElementById('test-result');

// Trigger Buttons
const btnCreateRule = document.getElementById('btn-create-rule');
const btnEmptyCreate = document.getElementById('btn-empty-create');
const btnCloseDialog = document.getElementById('btn-close-dialog');
const btnCancelRule = document.getElementById('btn-cancel-rule');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const btnExport = document.getElementById('btn-export');
const importFileInput = document.getElementById('import-file');
const alertBox = document.getElementById('alert-box');
const enableSyncCheckbox = document.getElementById('enable-sync');
const btnOrganize = document.getElementById('btn-organize');
const processingHint = document.getElementById('processing-hint');

// Global State
let allRules = [];
let deleteTargetId = null;
let organizeModeActive = false;

function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural || singular + 's');
}

const PROCESSING_HINTS = {
  NONE: 'Use matches as they are',
  URL_DECODE: 'E.g. turn %2Fbar%2Ffoo%3Fx%3D2 into /bar/foo?x=2',
  URL_ENCODE: 'E.g. turn /bar/foo?x=2 into %2Fbar%2Ffoo%3Fx%3D2',
  DOUBLE_URL_DECODE: 'E.g. turn %252Fbar%252Ffoo%253Fx%253D2 into /bar/foo?x=2',
  BASE64_DECODE: 'E.g. turn aHR0cDovL2Nubi5jb20= into http://cnn.com'
};

function updateProcessingHint() {
  const mode = processingSelect.value;
  processingHint.textContent = PROCESSING_HINTS[mode] || '';
}

function getGroupedIndices() {
  return allRules
    .map((r, i) => ({ index: i, grouped: r.grouped }))
    .filter(item => item.grouped)
    .map(item => item.index);
}

function isGroupAdjacent(indices) {
  if (indices.length < 2) return false;
  const sorted = [...indices].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] !== 1) return false;
  }
  return true;
}

function batchToggleDisabled(indices) {
  for (const idx of indices) {
    allRules[idx].enabled = !allRules[idx].enabled;
  }
}

function clearGroupings(indices) {
  for (const idx of indices) {
    allRules[idx].grouped = false;
  }
}

function toggleOrganizeMode() {
  organizeModeActive = !organizeModeActive;
  if (organizeModeActive) {
    btnOrganize.classList.add('active');
    showAlert("Use \u27F1 to move to bottom, \u27F0 to move to top, and checkboxes to link adjacent rules for batch operations.", 'success');
  } else {
    btnOrganize.classList.remove('active');
  }
  renderRules();
}

function toggleGrouping(index) {
  allRules[index].grouped = !allRules[index].grouped;
}

function extractBlock(indices) {
  const sorted = [...indices].sort((a, b) => a - b);
  const block = sorted.map(i => allRules[i]);
  for (let j = sorted.length - 1; j >= 0; j--) {
    allRules.splice(sorted[j], 1);
  }
  return block;
}

function moveToTop(index) {
  const groupedIndices = getGroupedIndices();
  if (groupedIndices.length > 1) {
    const block = extractBlock(groupedIndices);
    allRules.unshift(...block);
  } else {
    const item = allRules.splice(index, 1)[0];
    allRules.unshift(item);
  }
  syncAndRefresh();
}

function moveToBottom(index) {
  const groupedIndices = getGroupedIndices();
  if (groupedIndices.length > 1) {
    const block = extractBlock(groupedIndices);
    allRules.push(...block);
  } else {
    const item = allRules.splice(index, 1)[0];
    allRules.push(item);
  }
  syncAndRefresh();
}

/**
 * Show temporary alert message
 */
function showAlert(message, type = 'success') {
  alertBox.textContent = message;
  alertBox.className = `alert-box alert-${type}`;
  alertBox.classList.remove('hidden');
  setTimeout(() => alertBox.classList.add('hidden'), 5000);
}

/**
 * Sync all changes with browser and reload interface
 */
async function syncAndRefresh() {
  await Storage.saveRules(allRules);
  
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: 'SYNC_RULES' })
      .catch(() => console.warn('[Dashboard] Failed to trigger rule sync.'));
  }
  
  await loadRules();
}

/**
 * Load rules from Storage and render
 */
async function loadRules() {
  allRules = await Storage.getRules();
  rulesCount.textContent = `${allRules.length} ${pluralize(allRules.length, 'rule')}`;

  const options = await Storage.getOptions();
  enableSyncCheckbox.checked = options.isSyncEnabled;

  if (allRules.length === 0) {
    emptyState.classList.remove('hidden');
    rulesCount.textContent = '0 rules';
    rulesList.replaceChildren();
    return;
  }
  
  emptyState.classList.add('hidden');
  renderRules();
}

/**
 * Render rules list
 */
function renderRules() {
  rulesList.replaceChildren();
  allRules.forEach((rule, index) => {
    rulesList.appendChild(createRuleCard(rule, index));
  });
}

function createRuleCard(rule, index) {
  const card = document.createElement('div');
  card.className = `rule-card ${rule.enabled ? '' : 'disabled'} ${rule.grouped ? 'grouped' : ''}`;

  const info = document.createElement('div');
  info.className = 'rule-info';

  const titleRow = createRuleTitleRow(rule);
  info.appendChild(titleRow);
  info.appendChild(createRulePathway(rule));
  card.appendChild(info);

  const actions = document.createElement('div');
  actions.className = 'rule-actions';
  actions.appendChild(createRuleSwitch(rule, index));
  actions.appendChild(createRuleButtons(rule, index));
  card.appendChild(actions);

  return card;
}

function createRuleTitleRow(rule) {
  const titleRow = document.createElement('div');
  titleRow.className = 'rule-title-row';

  const title = document.createElement('h3');
  title.className = 'rule-title';
  title.textContent = rule.description || 'Unnamed Rule';
  titleRow.appendChild(title);

  const badge = document.createElement('span');
  badge.className = `badge-pattern-type badge-${rule.patternType.toLowerCase()}`;
  badge.textContent = rule.patternType;
  titleRow.appendChild(badge);

  if (rule.appliesTo && rule.appliesTo.includes('history')) {
    const historyBadge = document.createElement('span');
    historyBadge.className = 'badge-pattern-type badge-history';
    historyBadge.textContent = 'HistoryState';
    titleRow.appendChild(historyBadge);
  }

  return titleRow;
}

function createRulePathway(rule) {
  const pathway = Dom.create('div', { classes: ['rule-pathway'] });

  pathway.appendChild(Dom.create('div', {
    classes: ['path-step'],
    children: [
      Dom.create('span', { classes: ['path-label'], text: 'Redirect:' }),
      Dom.create('span', { classes: ['path-value'], text: rule.includePattern })
    ]
  }));

  pathway.appendChild(Dom.create('div', {
    classes: ['path-step'],
    children: [
      Dom.create('span', { classes: ['path-label'], text: 'to:' }),
      Dom.create('span', { classes: ['path-value'], text: rule.targetUrl })
    ]
  }));

  if (rule.excludePattern) {
    pathway.appendChild(Dom.create('div', {
      classes: ['path-step'],
      children: [
        Dom.create('span', { classes: ['path-label'], text: 'excluding:' }),
        Dom.create('span', { classes: ['path-value'], text: rule.excludePattern })
      ]
    }));
  }

  if (rule.patternDesc) {
    pathway.appendChild(Dom.create('div', {
      classes: ['path-step'],
      children: [
        Dom.create('span', { classes: ['path-label'], text: 'Hint:' }),
        Dom.create('span', { classes: ['path-value'], text: rule.patternDesc })
      ]
    }));
  }

  if (rule.exampleUrl) {
    const matchResult = Engine.evaluateRule(rule, rule.exampleUrl);
    let exampleText;
    if (matchResult && matchResult.matched) {
      exampleText = `${rule.exampleUrl} \u2192 ${matchResult.resultUrl}`;
    } else if (matchResult && matchResult.error) {
      exampleText = `${rule.exampleUrl} (${matchResult.error})`;
    } else {
      exampleText = `${rule.exampleUrl} (no match)`;
    }
    pathway.appendChild(Dom.create('div', {
      classes: ['path-step'],
      children: [
        Dom.create('span', { classes: ['path-label'], text: 'Example:' }),
        Dom.create('span', { classes: ['path-value'], text: exampleText })
      ]
    }));
  }

  return pathway;
}

function createRuleSwitch(rule, index) {
  const switchLabel = document.createElement('label');
  switchLabel.className = 'switch';

  const switchInput = document.createElement('input');
  switchInput.type = 'checkbox';
  switchInput.checked = rule.enabled;
  switchInput.addEventListener('change', async () => {
    const groupedIndices = getGroupedIndices();
    if (groupedIndices.length > 1 && groupedIndices.includes(index)) {
      batchToggleDisabled(groupedIndices);
    } else {
      rule.enabled = switchInput.checked;
    }
    await syncAndRefresh();
  });

  const slider = document.createElement('span');
  slider.className = 'slider';
  switchLabel.appendChild(switchInput);
  switchLabel.appendChild(slider);

  if (organizeModeActive) {
    const groupingLabel = document.createElement('label');
    groupingLabel.className = 'group-checkmark-label';
    const groupingCheck = document.createElement('input');
    groupingCheck.type = 'checkbox';
    groupingCheck.className = 'group-checkmark';
    groupingCheck.checked = rule.grouped;
    groupingCheck.addEventListener('change', () => {
      toggleGrouping(index);
      syncAndRefresh();
    });
    groupingLabel.appendChild(groupingCheck);
    switchLabel.appendChild(groupingLabel);
  }

  return switchLabel;
}

function createRuleButtons(rule, index) {
  const btnRow = document.createElement('div');
  btnRow.className = 'action-row';

  const btnUp = document.createElement('button');
  btnUp.className = 'btn btn-outline btn-icon';
  btnUp.textContent = '\u25B2';
  btnUp.disabled = index === 0;
  btnUp.addEventListener('click', () => moveRule(index, index - 1));

  const btnDown = document.createElement('button');
  btnDown.className = 'btn btn-outline btn-icon';
  btnDown.textContent = '\u25BC';
  btnDown.disabled = index === allRules.length - 1;
  btnDown.addEventListener('click', () => moveRule(index, index + 1));

  btnRow.appendChild(btnUp);
  btnRow.appendChild(btnDown);

  if (organizeModeActive) {
    const btnTop = document.createElement('button');
    btnTop.className = 'btn btn-outline btn-icon jump-btn';
    btnTop.textContent = '\u27F0';
    btnTop.disabled = index === 0;
    btnTop.addEventListener('click', () => moveToTop(index));

    const btnBottom = document.createElement('button');
    btnBottom.className = 'btn btn-outline btn-icon jump-btn';
    btnBottom.textContent = '\u27F1';
    btnBottom.disabled = index === allRules.length - 1;
    btnBottom.addEventListener('click', () => moveToBottom(index));

    btnRow.appendChild(btnTop);
    btnRow.appendChild(btnBottom);
  }

  const btnEdit = document.createElement('button');
  btnEdit.className = 'btn btn-outline btn-icon';
  btnEdit.textContent = 'Edit';
  btnEdit.addEventListener('click', () => openEditDialog(rule));

  const btnDup = document.createElement('button');
  btnDup.className = 'btn btn-outline btn-icon';
  btnDup.textContent = 'Duplicate';
  btnDup.addEventListener('click', () => duplicateRule(rule.id));

  const btnDel = document.createElement('button');
  btnDel.className = 'btn btn-outline btn-icon btn-danger-hover';
  btnDel.textContent = 'Delete';
  btnDel.addEventListener('click', () => openDeleteDialog(rule));

  btnRow.appendChild(btnEdit);
  btnRow.appendChild(btnDup);
  btnRow.appendChild(btnDel);

  return btnRow;
}

/**
 * Move rule ordering
 */
async function moveRule(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= allRules.length) return;

  const groupedIndices = getGroupedIndices();
  if (groupedIndices.length > 1 && groupedIndices.includes(fromIndex) && isGroupAdjacent(groupedIndices)) {
    const sorted = [...groupedIndices].sort((a, b) => a - b);
    const direction = toIndex > fromIndex ? 1 : -1;
    const jump = sorted.length;
    const targetIndex = direction === 1
      ? Math.min(toIndex + jump - 1, allRules.length - jump)
      : Math.max(toIndex - jump + 1, 0);

    const block = sorted.map(i => allRules[i]);
    for (let j = sorted.length - 1; j >= 0; j--) {
      allRules.splice(sorted[j], 1);
    }
    allRules.splice(targetIndex, 0, ...block);
    clearGroupings(groupedIndices);
  } else {
    const temp = allRules[fromIndex];
    allRules[fromIndex] = allRules[toIndex];
    allRules[toIndex] = temp;
  }

  await syncAndRefresh();
}

/**
 * Duplicate a rule
 */
async function duplicateRule(ruleId) {
  const sourceRule = allRules.find(r => r.id === ruleId);
  if (!sourceRule) return;
  
  const duplicated = {
    ...structuredClone(sourceRule),
    id: Rule.generateId(),
    description: `${sourceRule.description} (Copy)`
  };
  
  allRules.push(duplicated);
  await syncAndRefresh();
  showAlert('Rule duplicated successfully.');
}

/**
 * Dialog Form Control
 */
function openEditDialog(rule = null) {
  ruleForm.reset();
  
  if (rule) {
    dialogTitle.textContent = 'Edit Redirect';
    ruleIdInput.value = rule.id;
    descriptionInput.value = rule.description;
    exampleUrlInput.value = rule.exampleUrl || '';
    includePatternInput.value = rule.includePattern;
    targetUrlInput.value = rule.targetUrl;
      excludePatternInput.value = rule.excludePattern || '';
      patternDescInput.value = rule.patternDesc || '';
      processingSelect.value = rule.matchProcessing || MatchProcessing.NONE;
    updateProcessingHint();
    // Pattern type radio select
    const patternTypeRadio = ruleForm.querySelector(`input[name="pattern-type"][value="${rule.patternType}"]`);
    if (patternTypeRadio) patternTypeRadio.checked = true;

    // Checkboxes appliesTo
    const checkboxes = applyToCheckboxes.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(box => {
      box.checked = rule.appliesTo ? rule.appliesTo.includes(box.value) : false;
    });

    groupedInput.checked = rule.grouped || false;
    testUrlInput.value = rule.exampleUrl || '';
  } else {
    dialogTitle.textContent = 'Create Redirect';
    ruleIdInput.value = '';
    testUrlInput.value = '';
    groupedInput.checked = false;
    // select first radio button
    ruleForm.querySelector('input[name="pattern-type"][value="WILDCARD"]').checked = true;
  }
  
  modalBackdrop.classList.remove('hidden');
  ruleDialog.showModal();
  runLiveTest();
}

function closeDialog() {
  ruleDialog.close();
  modalBackdrop.classList.add('hidden');
}

/**
 * Open Delete dialog
 */
function openDeleteDialog(rule) {
  deleteTargetId = rule.id;
  document.getElementById('delete-rule-desc').textContent = rule.description;
  modalBackdrop.classList.remove('hidden');
  deleteDialog.showModal();
}

function closeDeleteDialog() {
  deleteDialog.close();
  modalBackdrop.classList.add('hidden');
  deleteTargetId = null;
}

/**
 * Confirm delete
 */
async function confirmDelete() {
  if (!deleteTargetId) return;
  allRules = allRules.filter(r => r.id !== deleteTargetId);
  await syncAndRefresh();
  closeDeleteDialog();
  showAlert('Rule deleted successfully.', 'error');
}

/**
 * Compile transient form state into a rule representation
 */
function getFormRuleState() {
  const patternTypeInput = ruleForm.querySelector('input[name="pattern-type"]:checked');
  const checkedBoxes = applyToCheckboxes.querySelectorAll('input[type="checkbox"]:checked');
  const appliesTo = Array.from(checkedBoxes).map(box => box.value);

  return {
    id: ruleIdInput.value || Rule.generateId(),
    description: descriptionInput.value.trim(),
    exampleUrl: exampleUrlInput.value.trim(),
    includePattern: includePatternInput.value.trim(),
    targetUrl: targetUrlInput.value.trim(),
    excludePattern: excludePatternInput.value.trim(),
    patternDesc: patternDescInput.value.trim(),
    patternType: patternTypeInput ? patternTypeInput.value : PatternType.WILDCARD,
    matchProcessing: processingSelect.value,
    appliesTo,
    enabled: true,
    grouped: groupedInput.checked
  };
}

/**
 * Live test matching
 */
function runLiveTest() {
  const currentRule = getFormRuleState();
  const testUrl = testUrlInput.value.trim();

  if (!testUrl || !currentRule.includePattern) {
    testStatusBadge.className = 'test-badge badge-neutral';
    testStatusBadge.textContent = 'Idle';
    testResultSpan.textContent = 'None';
    return;
  }

  // Evaluate the recursive redirect chain including the transient unsaved edits
  const result = Engine.evaluateRedirectChain(allRules, testUrl, currentRule);

  if (result.loop) {
    testStatusBadge.className = 'test-badge badge-nomatch';
    testStatusBadge.textContent = 'Loop';
    testResultSpan.textContent = result.error;
    testResultSpan.className = 'result-value error-text';
  } else if (result.error) {
    testStatusBadge.className = 'test-badge badge-nomatch';
    testStatusBadge.textContent = 'Error';
    testResultSpan.textContent = result.error;
    testResultSpan.className = 'result-value error-text';
  } else if (result.matched) {
    testStatusBadge.className = 'test-badge badge-match';
    testStatusBadge.textContent = 'Matches';
    testResultSpan.textContent = result.resultUrl + (result.steps > 1 ? ` (in ${result.steps} hops)` : '');
    testResultSpan.className = 'result-value success-text';
  } else {
    testStatusBadge.className = 'test-badge badge-nomatch';
    testStatusBadge.textContent = 'No Match';
    testResultSpan.textContent = 'Original URL (unchanged)';
    testResultSpan.className = 'result-value';
  }
}

/**
 * Handle form submit
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const savedState = getFormRuleState();
  const errors = Rule.validate(savedState);
  
  if (errors.length > 0) {
    showAlert(errors.join(' '), 'error');
    return;
  }

  const existingIdx = allRules.findIndex(r => r.id === savedState.id);
  if (existingIdx !== -1) {
    // Edit existing rule
    // Preserve active toggle state
    savedState.enabled = allRules[existingIdx].enabled;
    allRules[existingIdx] = savedState;
  } else {
    // Add new rule
    allRules.push(savedState);
  }

  await syncAndRefresh();
  closeDialog();
  showAlert('Rule saved successfully.');
}

/**
 * Export rules to JSON file
 */
function exportRules() {
  const version = typeof chrome !== 'undefined' && chrome.runtime?.getManifest
    ? chrome.runtime.getManifest().version
    : '0.0.0';
  const exportObj = {
    createdBy: `Redirector Rewrite v${version}`,
    createdAt: new Date().toISOString(),
    redirects: allRules
  };
  const json = JSON.stringify(exportObj, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Redirector.json';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import rules from JSON file
 */
function importRules(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      const importedArray = Array.isArray(imported) ? imported
        : (imported.rules || imported.redirects || []);

      let importedCount = 0;
      let existingCount = 0;
      importedArray.forEach(rawRule => {
        // Construct basic rule schema defaults if missing fields
        const compiledRule = {
          id: rawRule.id || Rule.generateId(),
          description: rawRule.description || 'Imported rule',
          includePattern: rawRule.includePattern || rawRule.pattern || '',
          excludePattern: rawRule.excludePattern || '',
          patternDesc: rawRule.patternDesc || rawRule.patternDescription || '',
          targetUrl: rawRule.targetUrl || rawRule.redirectUrl || '',
          patternType: rawRule.patternType || (rawRule.isRegex ? PatternType.REGEX : PatternType.WILDCARD),
          matchProcessing: rawRule.matchProcessing || MatchProcessing.NONE,
          enabled: rawRule.disabled !== undefined ? !rawRule.disabled : true,
          appliesTo: rawRule.appliesTo || ['main_frame']
        };

        const errors = Rule.validate(compiledRule);
        if (errors.length !== 0) return;

        // Avoid duplicate IDs
        if (allRules.some(r => r.id === compiledRule.id)) {
          compiledRule.id = Rule.generateId();
        }

        // Content-based dedup: skip rules that already exist
        const isDuplicate = allRules.some(existing =>
          existing.description === compiledRule.description &&
          existing.includePattern === compiledRule.includePattern &&
          existing.excludePattern === compiledRule.excludePattern &&
          existing.targetUrl === compiledRule.targetUrl &&
          existing.patternType === compiledRule.patternType
        );
        if (isDuplicate) {
          existingCount++;
          return;
        }

        allRules.push(compiledRule);
        importedCount++;
      });

      if (importedCount > 0 || existingCount > 0) {
        await syncAndRefresh();
        let msg = `Successfully imported ${importedCount} ${pluralize(importedCount, 'rule')}.`;
        if (existingCount > 0) {
          msg += ` ${existingCount} already existed and ${pluralize(existingCount, 'was', 'were')} skipped.`;
        }
        showAlert(msg);
      } else {
        showAlert('No valid rules found in the imported file.', 'error');
      }
    } catch {
      showAlert('Failed to parse file. Ensure it is a valid JSON schema.', 'error');
    }
  };
  reader.readAsText(file);
}

async function handleSyncToggle() {
  const enabled = enableSyncCheckbox.checked;
  const result = await Storage.toggleSync(enabled);
  showAlert(result.message, result.success ? 'success' : 'error');
  if (!result.success) {
    enableSyncCheckbox.checked = !enabled;
  }
  await loadRules();
}

// Attach listeners
btnCreateRule.addEventListener('click', () => openEditDialog());
btnEmptyCreate.addEventListener('click', () => openEditDialog());
btnCloseDialog.addEventListener('click', closeDialog);
btnCancelRule.addEventListener('click', closeDialog);
btnConfirmDelete.addEventListener('click', confirmDelete);
btnCancelDelete.addEventListener('click', closeDeleteDialog);
ruleForm.addEventListener('submit', handleFormSubmit);

// Import/Export Attachments
btnExport.addEventListener('click', exportRules);
importFileInput.addEventListener('change', importRules);

// Live testing listeners
ruleForm.addEventListener('input', runLiveTest);
testUrlInput.addEventListener('input', runLiveTest);

enableSyncCheckbox.addEventListener('change', handleSyncToggle);
btnOrganize.addEventListener('click', toggleOrganizeMode);
processingSelect.addEventListener('change', updateProcessingHint);

document.addEventListener('DOMContentLoaded', loadRules);

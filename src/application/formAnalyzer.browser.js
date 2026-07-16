// This file runs in the BROWSER context via page.evaluate()
// It is NOT transpiled by tsx because it's a .js file loaded as a raw string
function analyzeFormInBrowser() {
  function findModalRoot() {
    var selectors = ['[data-testid="dialog-content"]', '.jobs-easy-apply-modal', '[data-easy-apply-modal]', '.artdeco-modal[role="dialog"]'];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) return el;
    }
    var modals = document.querySelectorAll('.artdeco-modal');
    for (var j = 0; j < modals.length; j++) {
      var t = modals[j].textContent || '';
      if (t.indexOf('Easy Apply') !== -1 || t.indexOf('Solicitar') !== -1 || t.indexOf('Aplicar') !== -1) return modals[j];
    }
    return document.querySelector('.jobs-details') || document.querySelector('main') || null;
  }

  function buildSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    var tag = el.tagName.toLowerCase();
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      if (el.name) {
        var s = tag + '[name="' + CSS.escape(el.name) + '"]';
        if (document.querySelectorAll(s).length === 1) return s;
      }
      if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
        var group = document.querySelectorAll('input[type="' + el.type + '"][name="' + CSS.escape(el.name) + '"]');
        var idx = 0;
        for (var r = 0; r < group.length; r++) { if (group[r] === el) break; idx++; }
        return 'input[type="' + el.type + '"][name="' + CSS.escape(el.name) + '"]:nth-of-type(' + (idx + 1) + ')';
      }
    }
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      var s2 = tag + '[aria-label="' + CSS.escape(ariaLabel) + '"]';
      if (document.querySelectorAll(s2).length === 1) return s2;
    }
    // For buttons, prefer stable data-* attributes over CSS classes
    if (tag === 'button' || tag === 'a') {
      var dataControl = el.getAttribute('data-control-name');
      if (dataControl) {
        var s3 = tag + '[data-control-name="' + CSS.escape(dataControl) + '"]';
        if (document.querySelectorAll(s3).length === 1) return s3;
      }
      var dataTestId = el.getAttribute('data-test-id');
      if (dataTestId) {
        var s4 = tag + '[data-test-id="' + CSS.escape(dataTestId) + '"]';
        if (document.querySelectorAll(s4).length === 1) return s4;
      }
      var componentKey = el.getAttribute('componentkey');
      if (componentKey) {
        var s5 = tag + '[componentkey="' + CSS.escape(componentKey) + '"]';
        if (document.querySelectorAll(s5).length === 1) return s5;
      }
      // Skip obfuscated CSS classes for buttons; use positional selector instead
      var btnParent = el.parentElement;
      if (btnParent) {
        var btnSiblings = btnParent.querySelectorAll(tag);
        var btnIdx = 0;
        for (var bsi = 0; bsi < btnSiblings.length; bsi++) { if (btnSiblings[bsi] === el) break; btnIdx++; }
        return tag + ':nth-of-type(' + (btnIdx + 1) + ')';
      }
      return tag;
    }
    var cls = el.className ? '.' + el.className.split(' ').filter(Boolean).map(function(c) { return CSS.escape(c); }).join('.') : '';
    if (cls) {
      var matches = document.querySelectorAll(cls);
      if (matches.length === 1) return cls;
      var idx2 = 0;
      for (var m = 0; m < matches.length; m++) { if (matches[m] === el) break; idx2++; }
      return cls + ':nth-of-type(' + (idx2 + 1) + ')';
    }
    var parent = el.parentElement;
    if (parent) {
      var siblings = parent.querySelectorAll(tag);
      var idx3 = 0;
      for (var si = 0; si < siblings.length; si++) { if (siblings[si] === el) break; idx3++; }
      return tag + ':nth-of-type(' + (idx3 + 1) + ')';
    }
    return tag;
  }

  function buildXPath(el) {
    if (el.id) return '//*[@id="' + el.id + '"]';
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      var tag = cur.tagName.toLowerCase();
      var p = cur.parentElement;
      if (!p) { parts.unshift(tag); break; }
      var sibs = Array.from(p.children).filter(function(c) { return c.tagName === cur.tagName; });
      var aria = cur.getAttribute('aria-label');
      if (aria && sibs.length <= 1) {
        parts.unshift(tag + '[@aria-label="' + aria + '"]');
      } else if (cur instanceof HTMLInputElement && cur.name && sibs.length <= 1) {
        parts.unshift(tag + '[@name="' + cur.name + '"]');
      } else {
        var idx = sibs.indexOf(cur) + 1;
        parts.unshift(tag + '[' + idx + ']');
      }
      cur = p;
    }
    return '/' + parts.join('/');
  }

  function extractLabel(container) {
    var sources = [];
    var labelEl = container.querySelector('label, [class*="label"], [class*="title"], [class*="fb-form-element-label"], strong, legend');
    if (labelEl && labelEl.textContent && labelEl.textContent.trim()) sources.push(labelEl.textContent.trim());
    var descEl = container.querySelector('[class*="description"], [class*="help-text"], [class*="hint"], small');
    if (descEl && descEl.textContent && descEl.textContent.trim()) sources.push(descEl.textContent.trim());
    if (sources.length > 0) return sources.join(' ');
    var prev = container.previousElementSibling;
    if (prev && prev.textContent && prev.textContent.trim() && prev.textContent.trim().length < 200) return prev.textContent.trim();
    return '';
  }

  function extractLabelStandalone(el) {
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    var labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      var labelEl = document.getElementById(labelledby);
      if (labelEl && labelEl.textContent && labelEl.textContent.trim()) return labelEl.textContent.trim();
    }
    var closestLabel = el.closest('label');
    if (closestLabel && closestLabel.textContent && closestLabel.textContent.trim()) return closestLabel.textContent.trim();
    if ('placeholder' in el && el.placeholder && el.placeholder.trim()) return el.placeholder.trim();
    var prevEl = el.previousElementSibling;
    if (prevEl && prevEl.textContent && prevEl.textContent.trim() && prevEl.textContent.trim().length < 200) return prevEl.textContent.trim();
    var title = el.getAttribute('title');
    if (title && title.trim()) return title.trim();
    return '';
  }

  function extractHelpText(el, container) {
    var describedby = el.getAttribute('aria-describedby');
    if (describedby) {
      var descEl = document.getElementById(describedby);
      if (descEl && descEl.textContent && descEl.textContent.trim()) return descEl.textContent.trim();
    }
    var containerEl = container || el.closest('[class*="form-group"], [class*="form-section"], .fb-form-element');
    if (containerEl) {
      var helpEl = containerEl.querySelector('[class*="help-text"], [class*="hint"], [class*="description"], small, [class*="subtitle"]');
      if (helpEl && helpEl.textContent && helpEl.textContent.trim()) return helpEl.textContent.trim();
    }
    return '';
  }

  function buildFormField(input, label, placeholder, root) {
    var inputType = input.type || 'text';
    var required = input.required || input.hasAttribute('aria-required');
    var name = input.name || input.id || '';
    var base = { label: label, placeholder: placeholder, required: required, name: name, groupName: '', autocomplete: input.getAttribute('autocomplete') || null, role: input.getAttribute('role') || null };

    if (inputType === 'file') {
      return Object.assign({}, base, { type: 'file', label: label || 'CV Upload', selector: buildSelector(input), xpath: buildXPath(input), options: [], helpText: extractHelpText(input) });
    }
    if (inputType === 'radio') {
      var radioGroup = root.querySelectorAll('input[type="radio"][name="' + input.name + '"]');
      var opts = [];
      var seen = {};
      for (var i = 0; i < radioGroup.length; i++) {
        var r = radioGroup[i];
        var parentLabel = r.closest('label') || (r.closest('[class*="form-group"]') ? r.closest('[class*="form-group"]').querySelector('label') : null);
        var optText = (parentLabel && parentLabel.textContent ? parentLabel.textContent.trim() : '') || (r.nextSibling && r.nextSibling.textContent ? r.nextSibling.textContent.trim() : '') || r.value || '';
        if (optText && !seen[optText]) { seen[optText] = true; opts.push(optText); }
      }
      return Object.assign({}, base, { type: 'radio', selector: buildSelector(input), xpath: buildXPath(input), options: opts, groupName: input.name || '', helpText: extractHelpText(input) });
    }
    if (inputType === 'checkbox') {
      var cbLabel = (input.closest('label') && input.closest('label').textContent ? input.closest('label').textContent.trim() : '') || label || '';
      return Object.assign({}, base, { type: 'checkbox', label: cbLabel, selector: buildSelector(input), xpath: buildXPath(input), options: [], helpText: extractHelpText(input) });
    }
    var fieldType = inputType === 'email' ? 'email' : inputType === 'tel' ? 'tel' : 'text';
    return Object.assign({}, base, { type: fieldType, selector: buildSelector(input), xpath: buildXPath(input), options: [], helpText: extractHelpText(input) });
  }

  var root = findModalRoot();
  if (!root) return null;

  var fields = [];
  var hasFileUpload = false;

  var progressBar = root.querySelector('[aria-label*="Step"], [aria-label*="step"], [aria-label*="\u0627\u0644\u062e\u0637\u0648\u0629"], [class*="progress"], [class*="steps"]');
  var stepTexts = [];
  if (progressBar) {
    var items = progressBar.querySelectorAll('li, [class*="step"]');
    for (var i = 0; i < items.length; i++) {
      var text = items[i].textContent ? items[i].textContent.trim() : '';
      if (text) stepTexts.push(text);
    }
  }

  // Also look for "1/4 páginas" style progress in text
  var allText = root.textContent || '';
  var progressMatch = allText.match(/(\d+)\s*\/\s*(\d+)\s*(páginas|pages|pasos|steps)/i);
  if (progressMatch) {
    var current = parseInt(progressMatch[1], 10);
    var total = parseInt(progressMatch[2], 10);
    if (total > 0 && total <= 50 && current <= total) {
      stepTexts.push(current + '/' + total);
    }
  }

  var processedElements = new Set();
  var fieldContainerSelectors = [
    '.jobs-easy-apply-form-section__group', '[class*="form-group"]', '[class*="form-section"]',
    '.fb-form-element', '.fb-dynamic-form__field', '.ph4', '[class*="jobs-easy-apply-form"] > div'
  ];

  var fieldGroups = null;
  for (var si = 0; si < fieldContainerSelectors.length; si++) {
    var groups = root.querySelectorAll(fieldContainerSelectors[si]);
    if (groups.length > 0) { fieldGroups = groups; break; }
  }

  if (fieldGroups && fieldGroups.length > 0) {
    for (var gi = 0; gi < fieldGroups.length; gi++) {
      var groupEl = fieldGroups[gi];
      var extractedLabel = extractLabel(groupEl);
      var input = groupEl.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
      var select = groupEl.querySelector('select');
      var textarea = groupEl.querySelector('textarea');
      var placeholder = (input && input.placeholder) || (textarea && textarea.placeholder) || '';

      if (input) {
        processedElements.add(input);
        var field = buildFormField(input, extractedLabel, placeholder, root);
        if (field.type === 'file') hasFileUpload = true;
        fields.push(field);
      } else if (select) {
        processedElements.add(select);
        var opts = [];
        var sOpts = select.querySelectorAll('option');
        for (var oi = 0; oi < sOpts.length; oi++) {
          if (!sOpts[oi].disabled && sOpts[oi].value !== '') {
            var t = sOpts[oi].textContent ? sOpts[oi].textContent.trim() : '';
            if (t) opts.push(t);
          }
        }
        fields.push({ type: 'select', label: extractedLabel, placeholder: '', required: select.required || select.hasAttribute('aria-required'), name: select.name || select.id || '', selector: buildSelector(select), xpath: buildXPath(select), options: opts, groupName: '', autocomplete: select.getAttribute('autocomplete') || null, role: select.getAttribute('role') || null, helpText: extractHelpText(select, groupEl) });
      } else if (textarea) {
        processedElements.add(textarea);
        fields.push({ type: 'textarea', label: extractedLabel, placeholder: textarea.placeholder || '', required: textarea.required || textarea.hasAttribute('aria-required'), name: textarea.name || textarea.id || '', selector: buildSelector(textarea), xpath: buildXPath(textarea), options: [], groupName: '', autocomplete: textarea.getAttribute('autocomplete') || null, role: textarea.getAttribute('role') || null, helpText: extractHelpText(textarea, groupEl) });
      }
    }
  }

  var standaloneInputs = root.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
  for (var ii = 0; ii < standaloneInputs.length; ii++) {
    var input = standaloneInputs[ii];
    if (processedElements.has(input)) continue;
    processedElements.add(input);
    var field = buildFormField(input, extractLabelStandalone(input), input.placeholder || '', root);
    if (field.type === 'file') hasFileUpload = true;
    fields.push(field);
  }

  var standaloneSelects = root.querySelectorAll('select');
  for (var si2 = 0; si2 < standaloneSelects.length; si2++) {
    var select = standaloneSelects[si2];
    if (processedElements.has(select)) continue;
    processedElements.add(select);
    var opts = [];
    var sOpts = select.querySelectorAll('option');
    for (var oi = 0; oi < sOpts.length; oi++) {
      if (!sOpts[oi].disabled && sOpts[oi].value !== '') {
        var t = sOpts[oi].textContent ? sOpts[oi].textContent.trim() : '';
        if (t) opts.push(t);
      }
    }
    fields.push({ type: 'select', label: extractLabelStandalone(select), placeholder: '', required: select.required || select.hasAttribute('aria-required'), name: select.name || select.id || '', selector: buildSelector(select), xpath: buildXPath(select), options: opts, groupName: '', autocomplete: select.getAttribute('autocomplete') || null, role: select.getAttribute('role') || null, helpText: extractHelpText(select) });
  }

  var standaloneTextareas = root.querySelectorAll('textarea');
  for (var ti = 0; ti < standaloneTextareas.length; ti++) {
    var textarea = standaloneTextareas[ti];
    if (processedElements.has(textarea)) continue;
    processedElements.add(textarea);
    fields.push({ type: 'textarea', label: extractLabelStandalone(textarea), placeholder: textarea.placeholder || '', required: textarea.required || textarea.hasAttribute('aria-required'), name: textarea.name || textarea.id || '', selector: buildSelector(textarea), xpath: buildXPath(textarea), options: [], groupName: '', autocomplete: textarea.getAttribute('autocomplete') || null, role: textarea.getAttribute('role') || null, helpText: extractHelpText(textarea) });
  }

  var buttons = root.querySelectorAll('button');
  var nextBtn = null;
  var reviewBtn = null;
  var submitBtn = null;
  var nextBtnText = null;
  var reviewBtnText = null;
  var submitBtnText = null;

  function checkButton(btn) {
    var text = btn.textContent ? btn.textContent.trim().toLowerCase() : '';
    var aria = btn.getAttribute('aria-label') ? btn.getAttribute('aria-label').toLowerCase() : '';
    var visible = btn.offsetParent !== null;
    if (!visible) return;
    var display = window.getComputedStyle(btn).display;
    if (display === 'none') return;
    var rawText = btn.textContent ? btn.textContent.trim() : '';
    var rawAria = btn.getAttribute('aria-label') || '';
    if (text.indexOf('next') !== -1 || text.indexOf('siguiente') !== -1 || aria.indexOf('next') !== -1 || aria.indexOf('siguiente') !== -1) {
      if (!nextBtn) {
        nextBtn = buildSelector(btn);
        nextBtnText = rawAria || rawText;
      }
    }
    if (text.indexOf('review') !== -1 || text.indexOf('revisar') !== -1 || aria.indexOf('review') !== -1) {
      if (!reviewBtn) {
        reviewBtn = buildSelector(btn);
        reviewBtnText = rawAria || rawText;
      }
    }
    if (text.indexOf('submit') !== -1 || text.indexOf('enviar') !== -1 || text.indexOf('apply') !== -1 || aria.indexOf('submit') !== -1) {
      if (!submitBtn) {
        submitBtn = buildSelector(btn);
        submitBtnText = rawAria || rawText;
      }
    }
  }

  for (var bi = 0; bi < buttons.length; bi++) { checkButton(buttons[bi]); }

  var footer = root.querySelector('.artdeco-modal__actionbar, [class*="modal__actionbar"], [class*="footer"]');
  if (footer) {
    var footerBtns = footer.querySelectorAll('button');
    for (var fi = 0; fi < footerBtns.length; fi++) { checkButton(footerBtns[fi]); }
  }

  // Also check document-level action buttons (modal footer often outside root)
  if (!nextBtn || !submitBtn) {
    var docFooter = document.querySelector('.artdeco-modal__actionbar, [class*="modal__actionbar"], [class*="footer"]');
    if (docFooter) {
      var docFooterBtns = docFooter.querySelectorAll('button');
      for (var di = 0; di < docFooterBtns.length; di++) { checkButton(docFooterBtns[di]); }
    }
    // Also scan ALL visible buttons as last resort
    if (!nextBtn && !submitBtn && !reviewBtn) {
      var allBtns = document.querySelectorAll('button');
      for (var ai = 0; ai < allBtns.length; ai++) { checkButton(allBtns[ai]); }
    }
  }

  // Positional fallback: if no buttons found by text, find the primary action button
  // in the modal footer by position (last visible button, or button with primary styling)
  if (!nextBtn && !submitBtn && !reviewBtn) {
    var actionbar = document.querySelector('.artdeco-modal__actionbar, [class*="actionbar"]');
    if (!actionbar) {
      var modal = document.querySelector('.jobs-easy-apply-modal, [data-easy-apply-modal], .artdeco-modal[role="dialog"], .artdeco-modal');
      if (modal) actionbar = modal.querySelector('[class*="footer"], [class*="actionbar"]');
    }
    if (actionbar) {
      var actionBtns = actionbar.querySelectorAll('button');
      // The primary action is typically the last visible button
      for (var pi = actionBtns.length - 1; pi >= 0; pi--) {
        var pbtn = actionBtns[pi];
        if (pbtn.offsetParent !== null && window.getComputedStyle(pbtn).display !== 'none') {
          nextBtn = buildSelector(pbtn);
          nextBtnText = (pbtn.getAttribute('aria-label') || pbtn.textContent || '').trim();
          break;
        }
      }
    }
  }

  return {
    fields: fields,
    hasFileUpload: hasFileUpload,
    stepCount: stepTexts.length,
    currentStep: 0,
    totalSteps: stepTexts.length || 1,
    nextButtonSelector: nextBtn,
    reviewButtonSelector: reviewBtn,
    submitButtonSelector: submitBtn,
    nextButtonText: nextBtnText,
    reviewButtonText: reviewBtnText,
    submitButtonText: submitBtnText
  };
}

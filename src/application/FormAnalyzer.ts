import { Page } from 'puppeteer';

export interface FormField {
  type: 'text' | 'email' | 'tel' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'file';
  label: string;
  placeholder: string;
  required: boolean;
  name: string;
  selector: string;
  xpath: string;
  options: string[];
  groupName: string;
  autocomplete: string | null;
  role: string | null;
  helpText: string;
}

export interface FormAnalysis {
  fields: FormField[];
  hasFileUpload: boolean;
  stepCount: number;
  currentStep: number;
  totalSteps: number;
  nextButtonSelector: string | null;
  reviewButtonSelector: string | null;
  submitButtonSelector: string | null;
}

export class FormAnalyzer {
  async analyze(page: Page): Promise<FormAnalysis> {
    const result = await page.evaluate(() => {
      const root = FormAnalyzer._findModalRoot();
      if (!root) return null;

      const fields: any[] = [];
      let hasFileUpload = false;

      const progressBar = root.querySelector('[aria-label*="Step"], [class*="progress"], [class*="steps"]');
      const stepTexts: string[] = [];
      if (progressBar) {
        const items = progressBar.querySelectorAll('li, [class*="step"]');
        items.forEach((item) => {
          const text = item.textContent?.trim();
          if (text) stepTexts.push(text);
        });
      }

      const processedElements = new Set<Element>();
      const fieldContainerSelectors = [
        '.jobs-easy-apply-form-section__group',
        '[class*="form-group"]',
        '[class*="form-section"]',
        '.fb-form-element',
        '.fb-dynamic-form__field',
        '.ph4',
        '[class*="jobs-easy-apply-form"] > div',
      ];

      let fieldGroups: NodeListOf<Element> | null = null;
      for (const sel of fieldContainerSelectors) {
        const groups = root.querySelectorAll(sel);
        if (groups.length > 0) {
          fieldGroups = groups;
          break;
        }
      }

      if (fieldGroups && fieldGroups.length > 0) {
        fieldGroups.forEach((group) => {
          const groupEl = group as HTMLElement;
          const extractedLabel = FormAnalyzer._extractLabel(groupEl);

          const input = groupEl.querySelector<HTMLInputElement>(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"])'
          );
          const select = groupEl.querySelector<HTMLSelectElement>('select');
          const textarea = groupEl.querySelector<HTMLTextAreaElement>('textarea');
          const placeholder = input?.placeholder || textarea?.placeholder || '';

          if (input) {
            processedElements.add(input);
            const field = FormAnalyzer._buildFormField(input, extractedLabel, placeholder, root);
            if (field.type === 'file') hasFileUpload = true;
            fields.push(field);
          } else if (select) {
            processedElements.add(select);
            const options: string[] = [];
            select.querySelectorAll('option').forEach((opt) => {
              const text = opt.textContent?.trim();
              if (text && !opt.disabled && opt.value !== '') options.push(text);
            });
            const required = select.required || select.hasAttribute('aria-required');

            fields.push({
              type: 'select',
              label: extractedLabel,
              placeholder: '',
              required,
              name: select.name || select.id || '',
              selector: FormAnalyzer._buildSelector(select),
              xpath: FormAnalyzer._buildXPath(select),
              options,
              groupName: '',
              autocomplete: select.getAttribute('autocomplete') || null,
              role: select.getAttribute('role') || null,
              helpText: FormAnalyzer._extractHelpText(select, groupEl),
            });
          } else if (textarea) {
            processedElements.add(textarea);
            const required = textarea.required || textarea.hasAttribute('aria-required');
            fields.push({
              type: 'textarea',
              label: extractedLabel,
              placeholder: textarea.placeholder || '',
              required,
              name: textarea.name || textarea.id || '',
              selector: FormAnalyzer._buildSelector(textarea),
              xpath: FormAnalyzer._buildXPath(textarea),
              options: [],
              groupName: '',
              autocomplete: textarea.getAttribute('autocomplete') || null,
              role: textarea.getAttribute('role') || null,
              helpText: FormAnalyzer._extractHelpText(textarea, groupEl),
            });
          }
        });
      }

      const standaloneInputs = root.querySelectorAll<HTMLInputElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"])'
      );
      standaloneInputs.forEach((input) => {
        if (processedElements.has(input)) return;
        processedElements.add(input);
        const extractedLabel = FormAnalyzer._extractLabelForStandalone(input, root);
        const placeholder = input.placeholder || '';
        const field = FormAnalyzer._buildFormField(input, extractedLabel, placeholder, root);
        if (field.type === 'file') hasFileUpload = true;
        fields.push(field);
      });

      const standaloneSelects = root.querySelectorAll<HTMLSelectElement>('select');
      standaloneSelects.forEach((select) => {
        if (processedElements.has(select)) return;
        processedElements.add(select);
        const extractedLabel = FormAnalyzer._extractLabelForStandalone(select, root);
        const options: string[] = [];
        select.querySelectorAll('option').forEach((opt) => {
          const text = opt.textContent?.trim();
          if (text && !opt.disabled && opt.value !== '') options.push(text);
        });
        const required = select.required || select.hasAttribute('aria-required');
        fields.push({
          type: 'select',
          label: extractedLabel,
          placeholder: '',
          required,
          name: select.name || select.id || '',
          selector: FormAnalyzer._buildSelector(select),
          xpath: FormAnalyzer._buildXPath(select),
          options,
          groupName: '',
          autocomplete: select.getAttribute('autocomplete') || null,
          role: select.getAttribute('role') || null,
          helpText: FormAnalyzer._extractHelpText(select),
        });
      });

      const standaloneTextareas = root.querySelectorAll<HTMLTextAreaElement>('textarea');
      standaloneTextareas.forEach((textarea) => {
        if (processedElements.has(textarea)) return;
        processedElements.add(textarea);
        const extractedLabel = FormAnalyzer._extractLabelForStandalone(textarea, root);
        const required = textarea.required || textarea.hasAttribute('aria-required');
        fields.push({
          type: 'textarea',
          label: extractedLabel,
          placeholder: textarea.placeholder || '',
          required,
          name: textarea.name || textarea.id || '',
          selector: FormAnalyzer._buildSelector(textarea),
          xpath: FormAnalyzer._buildXPath(textarea),
          options: [],
          groupName: '',
          autocomplete: textarea.getAttribute('autocomplete') || null,
          role: textarea.getAttribute('role') || null,
          helpText: FormAnalyzer._extractHelpText(textarea),
        });
      });

      const buttons = root.querySelectorAll('button');
      let nextBtn: string | null = null;
      let reviewBtn: string | null = null;
      let submitBtn: string | null = null;

      buttons.forEach((btn) => {
        const text = btn.textContent?.trim().toLowerCase() || '';
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        const isVisible = (btn as HTMLElement).offsetParent !== null;

        if (!isVisible) return;

        if (text.includes('next') || text.includes('siguiente') || ariaLabel.includes('next') || ariaLabel.includes('siguiente')) {
          if (!nextBtn) nextBtn = FormAnalyzer._buildSelector(btn);
        }
        if (text.includes('review') || text.includes('revisar') || ariaLabel.includes('review')) {
          if (!reviewBtn) reviewBtn = FormAnalyzer._buildSelector(btn);
        }
        if ((text.includes('submit') || text.includes('enviar') || text.includes('apply') || ariaLabel.includes('submit')) && isVisible) {
          if (!submitBtn) submitBtn = FormAnalyzer._buildSelector(btn);
        }
      });

      const footer = root.querySelector('.artdeco-modal__actionbar, [class*="modal__actionbar"], [class*="footer"]');
      if (footer) {
        const footerBtns = footer.querySelectorAll('button');
        footerBtns.forEach((btn) => {
          const text = btn.textContent?.trim().toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          const isVisible = (btn as HTMLElement).offsetParent !== null;
          if (!isVisible) return;

          if ((text.includes('next') || text.includes('siguiente') || ariaLabel.includes('next'))) {
            if (!nextBtn) nextBtn = FormAnalyzer._buildSelector(btn);
          }
          if ((text.includes('review') || text.includes('revisar') || ariaLabel.includes('review'))) {
            if (!reviewBtn) reviewBtn = FormAnalyzer._buildSelector(btn);
          }
          if ((text.includes('submit') || text.includes('enviar') || text.includes('apply') || ariaLabel.includes('submit'))) {
            if (!submitBtn) submitBtn = FormAnalyzer._buildSelector(btn);
          }
        });
      }

      return {
        fields,
        hasFileUpload,
        stepCount: stepTexts.length,
        currentStep: 0,
        totalSteps: stepTexts.length || 1,
        nextButtonSelector: nextBtn,
        reviewButtonSelector: reviewBtn,
        submitButtonSelector: submitBtn,
      };
    });

    if (!result) {
      return {
        fields: [],
        hasFileUpload: false,
        stepCount: 0,
        currentStep: 0,
        totalSteps: 0,
        nextButtonSelector: null,
        reviewButtonSelector: null,
        submitButtonSelector: null,
      };
    }

    return result as FormAnalysis;
  }

  private static _findModalRoot(): Element | null {
    const modalSelectors = [
      '.jobs-easy-apply-modal',
      '[data-easy-apply-modal]',
      '.artdeco-modal[role="dialog"]',
    ];

    for (const sel of modalSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    const allModals = document.querySelectorAll('.artdeco-modal');
    for (const m of allModals) {
      if (m.textContent?.includes('Easy Apply') || m.textContent?.includes('Solicitar')) {
        return m;
      }
    }

    return null;
  }

  private static _extractLabel(container: HTMLElement): string {
    const sources: string[] = [];

    const labelEl = container.querySelector(
      'label, [class*="label"], [class*="title"], ' +
      '[class*="fb-form-element-label"], strong, ' +
      '[class*="display-flex"], legend'
    );
    if (labelEl?.textContent?.trim()) sources.push(labelEl.textContent.trim());

    const descriptionEl = container.querySelector(
      '[class*="description"], [class*="fb-form-element-description"], ' +
      '[class*="help-text"], [class*="hint"], small'
    );
    if (descriptionEl?.textContent?.trim()) sources.push(descriptionEl.textContent.trim());

    if (sources.length > 0) return sources.join(' ');

    const firstTextChild = Array.from(container.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent?.trim())
      .find(t => t && t.length > 0);
    if (firstTextChild) return firstTextChild;

    const prevSibling = container.previousElementSibling;
    if (prevSibling?.textContent?.trim()) {
      const text = prevSibling.textContent.trim();
      if (text.length < 200) return text;
    }

    return '';
  }

  private static _extractLabelForStandalone(el: Element, root: Element): string {
    const htmlEl = el as HTMLElement;

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel?.trim()) return ariaLabel.trim();

    const ariaLabelledby = el.getAttribute('aria-labelledby');
    if (ariaLabelledby) {
      const labelEl = document.getElementById(ariaLabelledby);
      if (labelEl?.textContent?.trim()) return labelEl.textContent.trim();
    }

    const closestLabel = el.closest('label');
    if (closestLabel?.textContent?.trim()) return closestLabel.textContent.trim();

    const labelledBy = document.querySelector(`label[for="${htmlEl.id}"]`);
    if (labelledBy?.textContent?.trim()) return labelledBy.textContent.trim();

    if ('placeholder' in htmlEl && (htmlEl as HTMLInputElement).placeholder?.trim()) {
      return (htmlEl as HTMLInputElement).placeholder.trim();
    }

    const name = el.getAttribute('name');
    if (name) {
      const nameLabel = root.querySelector(`[name="${CSS.escape(name)}"]`)?.closest('[class*="form-group"]')
        ?.querySelector('label, [class*="label"], [class*="title"]')
        ?.textContent?.trim();
      if (nameLabel) return nameLabel;
    }

    const prevEl = el.previousElementSibling;
    if (prevEl?.textContent?.trim()) {
      const text = prevEl.textContent.trim();
      if (text.length < 200) return text;
    }

    const parent = el.parentElement;
    if (parent) {
      const parentText = Array.from(parent.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent?.trim())
        .find(t => t && t.length > 0);
      if (parentText) return parentText;
    }

    const title = el.getAttribute('title');
    if (title?.trim()) return title.trim();

    return '';
  }

  private static _extractHelpText(el: Element, container?: HTMLElement): string {
    const ariaDescribedby = el.getAttribute('aria-describedby');
    if (ariaDescribedby) {
      const descEl = document.getElementById(ariaDescribedby);
      if (descEl?.textContent?.trim()) return descEl.textContent.trim();
    }

    const containerEl = container || el.closest('[class*="form-group"], [class*="form-section"], .fb-form-element');
    if (containerEl) {
      const helpEl = containerEl.querySelector(
        '[class*="help-text"], [class*="hint"], [class*="description"], ' +
        '[class*="fb-form-element-description"], small, [class*="subtitle"]'
      );
      if (helpEl?.textContent?.trim()) return helpEl.textContent.trim();
    }

    return '';
  }

  private static _buildFormField(
    input: HTMLInputElement,
    label: string,
    placeholder: string,
    root: Element,
  ): any {
    const inputType = input.type || 'text';
    const required = input.required || input.hasAttribute('aria-required');
    const name = input.name || input.id || '';

    if (inputType === 'file') {
      return {
        type: 'file',
        label: label || 'CV Upload',
        placeholder: '',
        required,
        name,
        selector: FormAnalyzer._buildSelector(input),
        xpath: FormAnalyzer._buildXPath(input),
        options: [],
        groupName: '',
        autocomplete: input.getAttribute('autocomplete') || null,
        role: input.getAttribute('role') || null,
        helpText: FormAnalyzer._extractHelpText(input),
      };
    }

    if (inputType === 'radio') {
      const radioName = input.name;
      const radioGroup = root.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${radioName}"]`);
      const options: string[] = [];
      radioGroup.forEach((r) => {
        const parentLabel = r.closest('label') || r.closest('[class*="form-group"]')?.querySelector('label');
        const optText = parentLabel?.textContent?.trim() || (r.nextSibling as Text)?.textContent?.trim() || r.value || '';
        if (optText) options.push(optText);
      });
      return {
        type: 'radio',
        label: label || '',
        placeholder: '',
        required,
        name: radioName || name,
        selector: FormAnalyzer._buildSelector(input),
        xpath: FormAnalyzer._buildXPath(input),
        options: [...new Set(options)],
        groupName: radioName || '',
        autocomplete: input.getAttribute('autocomplete') || null,
        role: input.getAttribute('role') || null,
        helpText: FormAnalyzer._extractHelpText(input),
      };
    }

    if (inputType === 'checkbox') {
      const cbLabel = input.closest('label')?.textContent?.trim() || label || '';
      return {
        type: 'checkbox',
        label: cbLabel,
        placeholder: '',
        required,
        name: input.name || input.id || '',
        selector: FormAnalyzer._buildSelector(input),
        xpath: FormAnalyzer._buildXPath(input),
        options: [],
        groupName: '',
        autocomplete: input.getAttribute('autocomplete') || null,
        role: input.getAttribute('role') || null,
        helpText: FormAnalyzer._extractHelpText(input),
      };
    }

    const fieldType = inputType === 'email' ? 'email' : inputType === 'tel' ? 'tel' : 'text';
    return {
      type: fieldType,
      label: label || '',
      placeholder,
      required,
      name,
      selector: FormAnalyzer._buildSelector(input),
      xpath: FormAnalyzer._buildXPath(input),
      options: [],
      groupName: '',
      autocomplete: input.getAttribute('autocomplete') || null,
      role: input.getAttribute('role') || null,
      helpText: FormAnalyzer._extractHelpText(input),
    };
  }

  private static _buildSelector(el: Element): string {
    if (el.id) {
      return `#${CSS.escape(el.id)}`;
    }

    const tag = el.tagName.toLowerCase();

    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      if (el.name) {
        const nameSelector = `${tag}[name="${CSS.escape(el.name)}"]`;
        const matches = document.querySelectorAll(nameSelector);
        if (matches.length === 1) return nameSelector;
      }

      if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
        const group = document.querySelectorAll(`input[type="${el.type}"][name="${CSS.escape(el.name)}"]`);
        let idx = 0;
        for (const r of group) { if (r === el) break; idx++; }
        return `input[type="${el.type}"][name="${CSS.escape(el.name)}"]:nth-of-type(${idx + 1})`;
      }
    }

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      const ariaSelector = `${tag}[aria-label="${CSS.escape(ariaLabel)}"]`;
      const matches = document.querySelectorAll(ariaSelector);
      if (matches.length === 1) return ariaSelector;
    }

    const className = el.className
      ? '.' + el.className.split(' ').filter(Boolean).map(c => CSS.escape(c)).join('.')
      : '';

    if (className) {
      const match = document.querySelectorAll(className);
      if (match.length === 1) return className;
      let idx = 0;
      for (const m of match) { if (m === el) break; idx++; }
      return `${className}:nth-of-type(${idx + 1})`;
    }

    const parent = el.parentElement;
    if (parent) {
      const siblings = parent.querySelectorAll(tag);
      let idx = 0;
      for (const s of siblings) { if (s === el) break; idx++; }
      return `${tag}:nth-of-type(${idx + 1})`;
    }

    return tag;
  }

  private static _buildXPath(el: Element): string {
    if (el.id) {
      return `//*[@id="${el.id.replace(/['"\\]/g, '\\$&')}"]`;
    }

    const parts: string[] = [];
    let currentEl: Element | null = el;

    while (currentEl && currentEl !== document.body && currentEl !== document.documentElement) {
      const tag = currentEl.tagName.toLowerCase();
      const p: Element | null = currentEl.parentElement;
      if (!p) { parts.unshift(tag); break; }

      const siblingArray: Element[] = [];
      for (let i = 0; i < p.children.length; i++) {
        siblingArray.push(p.children[i]);
      }
      const siblings = siblingArray.filter((child) => child.tagName === currentEl!.tagName);

      const ariaLabel = currentEl.getAttribute('aria-label');
      if (ariaLabel && siblings.length <= 1) {
        parts.unshift(`${tag}[@aria-label="${ariaLabel.replace(/['"\\]/g, '\\$&')}"]`);
      } else if (currentEl instanceof HTMLInputElement && (currentEl as HTMLInputElement).name && siblings.length <= 1) {
        const inputName = (currentEl as HTMLInputElement).name.replace(/['"\\]/g, '\\$&');
        parts.unshift(`${tag}[@name="${inputName}"]`);
      } else if (currentEl.className && siblings.length <= 1) {
        const cls = currentEl.className.split(' ').filter(Boolean).join(' and contains(@class, ');
        parts.unshift(`${tag}[contains(@class, '${cls}')]`);
      } else {
        const idx = siblings.indexOf(currentEl) + 1;
        parts.unshift(`${tag}[${idx}]`);
      }

      currentEl = p;
    }

    return '/' + parts.join('/');
  }
}

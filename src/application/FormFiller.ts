import { Page } from 'puppeteer';
import { setTimeout as sleep } from 'timers/promises';
import { FormField } from './FormAnalyzer.js';
import { QuestionAnswerer } from './QuestionAnswerer.js';

export class FormFiller {
  private qa: QuestionAnswerer;

  constructor(qa: QuestionAnswerer) {
    this.qa = qa;
  }

  async fillFields(page: Page, fields: FormField[]): Promise<{ filled: number; skipped: number; errors: string[] }> {
    let filled = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const field of fields) {
      try {
        const value = await this._getValueForField(field);
        if (value === null || value === undefined) {
          skipped++;
          continue;
        }

        const filledOk = await this._fillField(page, field, value);
        if (filledOk) {
          filled++;
        } else {
          skipped++;
        }

        await sleep(300 + Math.random() * 500);
      } catch (err: any) {
        errors.push(`Field "${field.label}": ${err.message}`);
        skipped++;
      }
    }

    return { filled, skipped, errors };
  }

  private async _getValueForField(field: FormField): Promise<string | null> {
    const searchText = `${field.label} ${field.placeholder} ${field.helpText}`.trim();

    if (field.autocomplete) {
      const autofill = this._autocompleteValue(field.autocomplete, field.options);
      if (autofill !== null) return autofill;
    }

    const answer = await this.qa.findAnswer(
      searchText,
      field.placeholder,
      field.options,
      field.type,
    );

    if (answer.answer !== null && answer.answer !== '') {
      return answer.answer;
    }

    if (field.options && field.options.length > 0) {
      return this._selectBestOption(field.options, searchText);
    }

    return null;
  }

  private _autocompleteValue(autocomplete: string, options: string[]): string | null {
    const map: Record<string, string> = {
      'given-name': 'Jefferson',
      'family-name': 'Rodriguez',
      'name': 'Jefferson Rodriguez',
      'email': 'jefray@email.com',
      'tel': '+57 300 000 0000',
      'tel-national': '+57 300 000 0000',
      'address-level2': 'Bogotá',
      'address-level1': 'Cundinamarca',
      'postal-code': '',
      'country': 'CO',
      'url': '',
      'organization': '',
      'language': 'A2',
      'bday': '',
      'bday-year': '',
      'bday-month': '',
      'bday-day': '',
      'sex': '',
    };

    const normalized = autocomplete.toLowerCase().trim();
    if (map[normalized]) return map[normalized];

    if (normalized.includes('email')) return 'jefray@email.com';
    if (normalized.includes('tel') || normalized.includes('phone')) return '+57 300 000 0000';
    if (normalized.includes('name')) return 'Jefferson Rodriguez';

    return null;
  }

  private _selectBestOption(options: string[], searchText: string): string | null {
    const lowerSearch = searchText.toLowerCase();

    const yesInSearch = /yes|si|sí|authorized|sponsor|visa/.test(lowerSearch);
    if (yesInSearch) {
      const yesOption = options.find(o => /yes|si|sí/i.test(o));
      if (yesOption) return yesOption;
    }

    const noInSearch = /no/.test(lowerSearch) && !yesInSearch;
    if (noInSearch) {
      const noOption = options.find(o => /^no$/i.test(o));
      if (noOption) return noOption;
    }

    const levelOrder = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'basic', 'intermediate', 'advanced', 'native', 'fluent'];
    if (/english|ingl[eé]s|idioma|language/.test(lowerSearch)) {
      for (const opt of options) {
        const optLower = opt.toLowerCase();
        const matchLevel = levelOrder.find(l => optLower.includes(l));
        if (matchLevel && (matchLevel === 'a2' || levelOrder.indexOf(matchLevel) <= 4)) {
          return opt;
        }
      }
      const matched = options.find(o => levelOrder.some(l => o.toLowerCase().includes(l)));
      if (matched) return matched;
    }

    if (/salary|salario|compensación/.test(lowerSearch)) {
      const salaryOpts = options.filter(o => /\d/.test(o));
      if (salaryOpts.length > 0) return salaryOpts[0];
    }

    if (/years?|experience|años?/.test(lowerSearch)) {
      const expOpts = options.filter(o => /\d/.test(o));
      if (expOpts.length > 0) return expOpts[0];
    }

    const preferNot = options.find(o => /prefer.*not|decline|skip|i don't/i.test(o));
    if (preferNot) return preferNot;

    return options[0];
  }

  private async _fillField(page: Page, field: FormField, value: string): Promise<boolean> {
    let el = await page.$(field.selector);

    if (!el && field.xpath) {
      el = await this._findByXPath(page, field.xpath);
    }

    if (!el) return false;

    try {
      const tagName = await el.evaluate((el) => el.tagName.toLowerCase());
      const inputType = await el.evaluate((el) => (el as HTMLInputElement).type || '').catch(() => '');

      if (tagName === 'select') {
        await el.select(value);
        await page.evaluate((sel) => {
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          sel.dispatchEvent(new Event('input', { bubbles: true }));
        }, el);
        return true;
      }

      if (tagName === 'textarea') {
        await el.click();
        await sleep(100 + Math.random() * 200);
        await el.evaluate((el) => (el as HTMLTextAreaElement).value = '');
        await sleep(100 + Math.random() * 200);
        await el.type(value, { delay: 30 + Math.random() * 50 });
        return true;
      }

      if (inputType === 'radio') {
        return await this._fillRadio(page, field, value);
      }

      if (inputType === 'checkbox') {
        return await this._fillCheckbox(el, value);
      }

      if (inputType === 'file') {
        const ch = await page.$('input[type="file"]');
        if (ch) {
          await ch.uploadFile(value);
          return true;
        }
        return false;
      }

      await el.click({ clickCount: 3 });
      await sleep(100 + Math.random() * 200);
      await el.evaluate((el) => (el as HTMLInputElement).value = '');
      await sleep(100 + Math.random() * 200);
      await el.type(value, { delay: 30 + Math.random() * 70 });
      return true;
    } catch {
      return false;
    }
  }

  private async _findByXPath(page: Page, xpath: string): Promise<any> {
    try {
      const result = await page.evaluate((xp) => {
        const iterator = document.evaluate(
          xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
        );
        return iterator.singleNodeValue ? true : false;
      }, xpath);

      if (result) {
        const el = await page.evaluateHandle((xp) => {
          const iterator = document.evaluate(
            xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
          );
          return iterator.singleNodeValue;
        }, xpath);

        if (el) return el;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async _fillRadio(page: Page, field: FormField, value: string): Promise<boolean> {
    const groupName = field.groupName || field.name;
    if (!groupName) return false;

    const selector = `input[type="radio"][name="${CSS.escape(groupName)}"]`;
    const radios = await page.$$(selector);

    if (radios.length === 0) return false;

    const lowerValue = value.toLowerCase();

    for (const radio of radios) {
      const labelText = await radio.evaluate((el) => {
        const parent = el.closest('label');
        return parent?.textContent?.trim().toLowerCase() || '';
      });

      const radioValue = await radio.evaluate((el) => (el as HTMLInputElement).value.toLowerCase());

      if (labelText.includes(lowerValue) || radioValue.includes(lowerValue) ||
          lowerValue.includes(labelText) || lowerValue.includes(radioValue)) {
        await radio.click();
        return true;
      }
    }

    if (radios.length > 0) {
      await radios[0].click();
      return true;
    }

    return false;
  }

  private async _fillCheckbox(el: any, value: string): Promise<boolean> {
    const isChecked = await el.evaluate((el: HTMLInputElement) => el.checked);
    const shouldCheck = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' || value === '1';
    if (shouldCheck && !isChecked) {
      await el.click();
    } else if (!shouldCheck && isChecked) {
      await el.click();
    }
    return true;
  }
}

import { Page } from 'puppeteer';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  submitButtonText: string | null;
  submitEnabled: boolean;
}

export class SubmitGuard {
  async validate(page: Page): Promise<ValidationResult> {
    const result = await page.evaluate(() => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const errorMessages = document.querySelectorAll(
        '.artdeco-inline-feedback--error, ' +
        '[class*="error"], ' +
        '[class*="validation"], ' +
        '[aria-describedby*="error"], ' +
        '.fb-form-element__error, ' +
        '[class*="alert"]'
      );
      for (const el of errorMessages) {
        if ((el as HTMLElement).offsetParent !== null) {
          const text = el.textContent?.trim();
          if (text) errors.push(`Field error: ${text}`);
        }
      }

      const inputErrors = document.querySelectorAll(
        'input:invalid, select:invalid, textarea:invalid'
      );
      for (const el of inputErrors) {
        const label = el.closest('[class*="form-group"]')?.querySelector('label')?.textContent?.trim()
          || (el as HTMLElement).getAttribute('aria-label')
          || el.getAttribute('name')
          || 'unknown';
        if (!errors.some((e) => e.includes(label))) {
          errors.push(`Invalid input: ${label}`);
        }
      }

      const requiredEmpty: string[] = [];
      const requiredFields = document.querySelectorAll(
        'input[required], select[required], textarea[required]'
      );
      requiredFields.forEach((el) => {
        const htmlEl = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const value = htmlEl.value?.trim();
        if (!value || value === '' || value === htmlEl.getAttribute('data-placeholder') || value === 'Select an option') {
          const label = el.closest('[class*="form-group"]')?.querySelector('label')?.textContent?.trim()
            || htmlEl.getAttribute('aria-label')
            || htmlEl.name
            || 'unknown';
          requiredEmpty.push(label);
        }
      });
      if (requiredEmpty.length > 0) {
        errors.push(`Empty required fields: ${requiredEmpty.join(', ')}`);
      }

      const modal = document.querySelector(
        '.jobs-easy-apply-modal, [data-easy-apply-modal], .artdeco-modal[role="dialog"]'
      );
      const footer = modal?.querySelector('.artdeco-modal__actionbar, [class*="actionbar"]');
      let submitBtn: HTMLButtonElement | null = null;
      let submitText: string | null = null;
      let submitEnabled = false;

      if (footer) {
        const buttons = footer.querySelectorAll('button');
        buttons.forEach((btn) => {
          const text = btn.textContent?.trim().toLowerCase() || '';
          if (text.includes('submit') || text.includes('enviar') || text.includes('apply')) {
            submitBtn = btn;
            submitText = btn.textContent?.trim() || null;
            submitEnabled = !btn.disabled && btn.offsetParent !== null;
          }
        });
      }

      if (!submitBtn) {
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
          const text = btn.textContent?.trim().toLowerCase() || '';
          if ((text.includes('submit') || text.includes('enviar')) && btn.offsetParent !== null) {
            submitBtn = btn;
            submitText = btn.textContent?.trim() || null;
            submitEnabled = !btn.disabled && btn.offsetParent !== null;
            break;
          }
        }
      }

      if (!submitBtn) {
        warnings.push('No Submit button found on this step');
      } else if (!submitEnabled) {
        errors.push('Submit button is disabled');
      }

      return { errors, warnings, submitText, submitEnabled };
    });

    return {
      valid: result.errors.length === 0,
      errors: result.errors,
      warnings: result.warnings,
      submitButtonText: result.submitText,
      submitEnabled: result.submitEnabled,
    };
  }
}

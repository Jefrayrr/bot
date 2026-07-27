import { Page } from 'puppeteer';
import { FormFieldData, FormViewData } from './types.js';
import { eventBus } from './EventBus.js';

export class FormExtractor {
  private page: Page | null = null;

  setPage(page: Page): void {
    this.page = page;
  }

  async extract(): Promise<FormViewData | null> {
    if (!this.page) return null;

    try {
      const result = await this.page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]')
          || document.querySelector('.jobs-easy-apply-modal')
          || document.querySelector('.artdeco-modal');

        if (!dialog) return null;

        const fields: Array<{
          type: string;
          name: string;
          label: string;
          value: string;
          options?: string[];
          required: boolean;
          filled: boolean;
        }> = [];
        const buttons: string[] = [];

        // Detect step
        let currentStep = 1;
        let totalSteps = 1;
        const text = dialog.textContent || '';
        const stepMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
        if (stepMatch) {
          currentStep = parseInt(stepMatch[1], 10);
          totalSteps = parseInt(stepMatch[2], 10);
        }

        // Resume file
        let resumeFile: string | null = null;
        const fileInputs = dialog.querySelectorAll('input[type="file"]');
        if (fileInputs.length > 0) {
          const fileInput = fileInputs[0] as HTMLInputElement;
          if (fileInput.files && fileInput.files.length > 0) {
            resumeFile = fileInput.files[0].name;
          } else {
            const label = dialog.querySelector('[class*="resume"], [class*="file"]');
            resumeFile = label?.textContent?.trim() || 'uploaded';
          }
        }

        // Extract inputs
        const inputs = dialog.querySelectorAll('input:not([type="hidden"]):not([type="file"])');
        for (const input of inputs) {
          const el = input as HTMLInputElement;
          const label = findLabel(el);
          fields.push({
            type: el.type || 'text',
            name: el.name || el.id || '',
            label,
            value: el.type === 'password' ? '********' : (el.value || ''),
            required: el.required,
            filled: !!el.value,
          });
        }

        // Extract selects
        const selects = dialog.querySelectorAll('select');
        for (const sel of selects) {
          const el = sel as HTMLSelectElement;
          const label = findLabel(el);
          const options = Array.from(el.options).map(o => o.text).filter(t => t);
          fields.push({
            type: 'select',
            name: el.name || el.id || '',
            label,
            value: el.options[el.selectedIndex]?.text || '',
            options,
            required: el.required,
            filled: !!el.value,
          });
        }

        // Extract textareas
        const textareas = dialog.querySelectorAll('textarea');
        for (const ta of textareas) {
          const el = ta as HTMLTextAreaElement;
          const label = findLabel(el);
          fields.push({
            type: 'textarea',
            name: el.name || el.id || '',
            label,
            value: el.value?.substring(0, 100) || '',
            required: el.required,
            filled: !!el.value,
          });
        }

        // Extract buttons
        const btns = dialog.querySelectorAll('button');
        for (const btn of btns) {
          const text = btn.textContent?.trim();
          if (text && btn.offsetParent !== null) {
            buttons.push(text.substring(0, 40));
          }
        }

        // Detect Easy Apply
        const isEasyApply = !!(
          dialog.querySelector('[data-easy-apply-modal]') ||
          dialog.querySelector('.jobs-easy-apply-modal') ||
          dialog.textContent?.includes('Easy Apply')
        );

        function findLabel(el: Element): string {
          const id = el.id;
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) return label.textContent?.trim() || '';
          }
          const parent = el.closest('.jobs-easy-apply-form-section__group, .fb-dash-form-element, [class*="form-group"], [class*="field"]');
          if (parent) {
            const labelEl = parent.querySelector('label, legend, [class*="label"]');
            if (labelEl) return labelEl.textContent?.trim() || '';
          }
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel) return ariaLabel;
          return el.getAttribute('placeholder') || (el as HTMLInputElement).name || '';
        }

        return {
          isEasyApply,
          currentStep,
          totalSteps,
          fields,
          buttons,
          resumeFile,
        };
      });

      if (!result) return null;

      // Cast field types to match FormFieldData
      const typedFields: FormFieldData[] = result.fields.map((f: Record<string, unknown>) => ({
        type: f.type as FormFieldData['type'],
        name: f.name as string,
        label: f.label as string,
        value: f.value as string,
        options: f.options as string[] | undefined,
        required: f.required as boolean,
        filled: f.filled as boolean,
      }));

      return { ...result, fields: typedFields } as FormViewData;
    } catch {
      return null;
    }
  }

  async emitForm(): Promise<void> {
    const form = await this.extract();
    if (form) eventBus.emit('form:detected', form);
  }
}

export const formExtractor = new FormExtractor();

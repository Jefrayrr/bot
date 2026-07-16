import { Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  nextButtonText: string | null;
  submitButtonText: string | null;
}

const BROWSER_SCRIPT_PATH = path.resolve(__dirname, 'formAnalyzer.browser.js');

export class FormAnalyzer {
  private browserScript: string;

  constructor() {
    this.browserScript = fs.readFileSync(BROWSER_SCRIPT_PATH, 'utf-8');
  }

  async analyze(page: Page): Promise<FormAnalysis> {
    try {
      const result = await page.evaluate((script: string) => {
        // eslint-disable-next-line no-eval
        return (0, eval)(script + '\n; analyzeFormInBrowser()');
      }, this.browserScript);

      if (!result) {
        return this._emptyResult();
      }

      return {
        fields: result.fields || [],
        hasFileUpload: result.hasFileUpload || false,
        stepCount: result.stepCount || 0,
        currentStep: result.currentStep || 0,
        totalSteps: result.totalSteps || 1,
        nextButtonSelector: result.nextButtonSelector || null,
        reviewButtonSelector: result.reviewButtonSelector || null,
        submitButtonSelector: result.submitButtonSelector || null,
        nextButtonText: result.nextButtonText || null,
        submitButtonText: result.submitButtonText || null,
      };
    } catch (err: any) {
      console.warn(`    [FormAnalyzer] Error: ${err.message}`);
      return this._emptyResult();
    }
  }

  private _emptyResult(): FormAnalysis {
    return {
      fields: [],
      hasFileUpload: false,
      stepCount: 0,
      currentStep: 0,
      totalSteps: 0,
      nextButtonSelector: null,
      reviewButtonSelector: null,
      submitButtonSelector: null,
      nextButtonText: null,
      submitButtonText: null,
    };
  }
}

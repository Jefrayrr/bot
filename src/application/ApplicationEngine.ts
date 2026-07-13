import { Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { setTimeout as sleep } from 'timers/promises';
import { LinkedInSession } from '../linkedin/LinkedInSession.js';
import { JobDetails } from '../linkedin/JobExtractor.js';
import { EasyApplyDetector } from './EasyApplyDetector.js';
import { FormAnalyzer } from './FormAnalyzer.js';
import { FormFiller } from './FormFiller.js';
import { QuestionAnswerer } from './QuestionAnswerer.js';
import { ResumeManager } from './ResumeManager.js';
import { ApplicationLogger, ApplicationResult } from './ApplicationLogger.js';
import { ApplicationProfile } from './ApplicationProfile.js';
import { KnowledgeBase } from './KnowledgeBase.js';
import { ApplicationStateManager } from './ApplicationState.js';

const SCREENSHOT_DIR = path.resolve('screenshots');

export class ApplicationEngine {
  private session: LinkedInSession;
  private detector: EasyApplyDetector;
  private analyzer: FormAnalyzer;
  private filler: FormFiller;
  private resumeManager: ResumeManager;
  private logger: ApplicationLogger;
  private profile: ApplicationProfile;
  private qa: QuestionAnswerer;
  private knowledgeBase: KnowledgeBase;
  private stateManager: ApplicationStateManager;

  constructor(
    session: LinkedInSession,
    profile: ApplicationProfile,
    qa: QuestionAnswerer,
    knowledgeBase: KnowledgeBase,
    logger: ApplicationLogger,
    resumeManager: ResumeManager,
  ) {
    this.session = session;
    this.profile = profile;
    this.qa = qa;
    this.knowledgeBase = knowledgeBase;
    this.logger = logger;
    this.resumeManager = resumeManager;
    this.detector = new EasyApplyDetector();
    this.analyzer = new FormAnalyzer();
    this.filler = new FormFiller(qa);
    this.stateManager = new ApplicationStateManager();
  }

  async processJobs(jobs: JobDetails[]): Promise<void> {
    if (jobs.length === 0) {
      console.log('[AppEngine] No jobs to process.');
      return;
    }

    const pendingState = await this.stateManager.hasIncomplete();
    if (pendingState) {
      const state = await this.stateManager.load();
      if (state) {
        console.log(`\n[AppEngine] Found incomplete application: ${state.title} @ ${state.company}`);
        console.log(`[AppEngine] Step ${state.currentStep}, fields filled: ${state.filledFields.length}`);
        console.log(`[AppEngine] Resume from saved state? Check data/application_state.json`);
        console.log(`[AppEngine] Clearing state to start fresh batch.\n`);
        await this.stateManager.clear();
      }
    }

    console.log(`\n========== Application Engine ==========\n`);
    console.log(`[AppEngine] Processing ${jobs.length} Easy Apply jobs...\n`);

    let applied = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      console.log(`\n[${i + 1}/${jobs.length}] ${job.title} @ ${job.company}`);

      const alreadyApplied = await this.logger.hasBeenApplied(job.id);
      if (alreadyApplied) {
        console.log(`  [-] Already applied, skipping.`);
        await this.logger.log({
          jobId: job.id,
          company: job.company,
          title: job.title,
          url: job.url,
          result: 'already_applied',
          reason: 'Previously applied to this job',
        });
        skipped++;
        continue;
      }

      const result = await this._processSingleJob(job);
      if (result === 'applied') {
        applied++;
        await this.stateManager.clear();
      } else if (result === 'failed' || result === 'need_review') {
        failed++;
      } else {
        skipped++;
      }

      if (i < jobs.length - 1) {
        const delay = 5000 + Math.random() * 10000;
        console.log(`  [AppEngine] Waiting ${Math.round(delay / 1000)}s before next job...`);
        await sleep(delay);
      }
    }

    const pendingLearning = this.knowledgeBase.getPendingLearning();
    if (pendingLearning.length > 0) {
      console.log(`\n[AppEngine] ${pendingLearning.length} unknown question(s) logged for learning:`);
      for (const p of pendingLearning) {
        console.log(`  - "${p.rawText}" (category: ${p.category})`);
      }
      console.log(`  Answers will be saved to data/knowledge_base.json for next run.\n`);
    }

    console.log(`\n[AppEngine] Complete: ${applied} applied, ${failed} failed, ${skipped} skipped`);
  }

  private async _processSingleJob(job: JobDetails): Promise<ApplicationResult> {
    const page = await this.session.getPage();
    const safeId = (job.id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const maxFormPages = parseInt(process.env.MAX_FORM_PAGES || '5', 10);

    try {
      // === STEP 1: Open job page ===
      console.log(`  → Opening job page...`);
      await page.goto(job.url, { waitUntil: 'networkidle2', timeout: 60000 });
      console.log(`  → URL: ${page.url()}`);

      // Wait for job details panel to load
      try {
        await page.waitForSelector('.jobs-details, .jobs-details__, main', { timeout: 15000 });
      } catch {}
      await sleep(3000 + Math.random() * 2000);

      // === STEP 2: Click Easy Apply button ===
      console.log(`  → Looking for Easy Apply button in job panel...`);
      const detection = await this.detector.detect(page);

      if (detection.isExternal) {
        console.log(`  → External link detected: ${detection.externalUrl}`);
        await this._saveScreenshot(page, safeId, 'external');
        await this.logger.log({
          jobId: job.id, company: job.company, title: job.title, url: job.url,
          result: 'external_site', reason: `External site: ${detection.externalUrl}`,
        });
        return 'external_site';
      }

      if (!detection.hasEasyApply || !detection.buttonSelector) {
        console.log(`  → No Easy Apply button found.`);
        await this._saveScreenshot(page, safeId, 'no_easy_apply');
        await this.logger.log({
          jobId: job.id, company: job.company, title: job.title, url: job.url,
          result: 'no_easy_apply', reason: 'Easy Apply button not detected',
        });
        return 'no_easy_apply';
      }

      console.log(`  → Found Easy Apply (selector: ${detection.buttonSelector}). Clicking...`);
      const clicked = await this._clickButton(page, detection.buttonSelector);
      if (!clicked) {
        console.log(`  → Failed to click Easy Apply button.`);
        await this._saveScreenshot(page, safeId, 'click_fail');
        await this.logger.log({
          jobId: job.id, company: job.company, title: job.title, url: job.url,
          result: 'failed', reason: 'Could not click Easy Apply button',
        });
        return 'failed';
      }

      // === STEP 3: Wait for modal (with retry) ===
      console.log(`  → Waiting for modal (role="dialog")...`);
      let modalShown = await this._waitForModal(page, 10000);

      if (!modalShown) {
        // Retry: click the button again and wait once more
        console.log(`  → Modal not found. Retrying click...`);
        await sleep(1000 + Math.random() * 1000);
        await this._clickButton(page, detection.buttonSelector!);
        modalShown = await this._waitForModal(page, 10000);
      }

      if (!modalShown) {
        // Debug: list all buttons to see what's on the page
        console.log(`  → Modal still not found. Listing all buttons:`);
        const buttons = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).map((b) => ({
            text: b.innerText?.trim().substring(0, 60),
            aria: b.getAttribute('aria-label'),
            visible: b.offsetParent !== null,
          }));
        });
        for (const b of buttons) {
          const vis = b.visible ? 'visible' : 'hidden';
          console.log(`    - "${b.text}" [aria="${b.aria}"] (${vis})`);
        }

        await this._saveScreenshot(page, safeId, 'no_modal');
        await this.logger.log({
          jobId: job.id, company: job.company, title: job.title, url: job.url,
          result: 'failed', reason: 'Modal did not appear after 2 click attempts',
        });
        return 'failed';
      }

      // === STEP 4: Detect total steps from "1/4", "Step 1 of 3", etc ===
      const totalPages = await this._detectTotalPages(page);
      console.log(`  → Solicitud de ${totalPages} paso(s)`);

      if (totalPages > maxFormPages) {
        console.log(`  → Form too long: ${totalPages} pages (max: ${maxFormPages}). Skipping.`);
        await this._closeModalIfOpen(page);
        await this.logger.log({
          jobId: job.id, company: job.company, title: job.title, url: job.url,
          result: 'skipped', reason: `Form too long: ${totalPages} pages`,
        });
        return 'skipped';
      }

      // === STEP 5: Complete all steps ===
      const result = await this._completeSteps(page, job, safeId, totalPages);

      const success = result === 'applied';
      await this.logger.log({
        jobId: job.id, company: job.company, title: job.title, url: job.url,
        result: success ? 'applied' : 'need_review',
        reason: success ? `Submitted (${totalPages} pages)` : result,
      });

      if (success) {
        await this._closeModalIfOpen(page);
      } else {
        await this._saveScreenshot(page, safeId, 'failed');
      }

      return success ? 'applied' : 'need_review';
    } catch (err: any) {
      console.error(`  [AppEngine] Error: ${err.message}`);
      await this._saveScreenshot(page, safeId, 'error');
      await this.logger.log({
        jobId: job.id, company: job.company, title: job.title, url: job.url,
        result: 'failed', reason: `Error: ${err.message}`,
      });
      return 'failed';
    }
  }

  private async _detectTotalPages(page: Page): Promise<number> {
    return page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return 1;

      const text = dialog.textContent || '';

      // "1/4", "Step 1/3", "Paso 1/4", "Page 1/4"
      const slashPatterns = [
        /(\d+)\s*\/\s*(\d+)/,
        /step\s*(\d+)\s*\/\s*(\d+)/i,
        /paso\s*(\d+)\s*\/\s*(\d+)/i,
        /page\s*(\d+)\s*\/\s*(\d+)/i,
        /página\s*(\d+)\s*\/\s*(\d+)/i,
      ];
      for (const p of slashPatterns) {
        const m = text.match(p);
        if (m) return parseInt(m[2], 10);
      }

      // "1 of 4", "Step 1 of 3", "Paso 1 de 4"
      const ofPatterns = [
        /(\d+)\s+(?:of|de)\s+(\d+)/i,
        /step\s+(\d+)\s+(?:of|de)\s+(\d+)/i,
        /paso\s+(\d+)\s+(?:de|of)\s+(\d+)/i,
        /page\s+(\d+)\s+(?:of|de)\s+(\d+)/i,
        /página\s+(\d+)\s+(?:de|of)\s+(\d+)/i,
      ];
      for (const p of ofPatterns) {
        const m = text.match(p);
        if (m) return parseInt(m[2], 10);
      }

      // Fallback: count progress indicators
      const steps = dialog.querySelectorAll(
        '[aria-label*="Step"], [class*="progress"] li, [class*="steps"] li, ol li'
      );
      if (steps.length > 1) return steps.length;

      return 1;
    });
  }

  private async _completeSteps(
    page: Page,
    job: JobDetails,
    safeId: string,
    totalPages: number
  ): Promise<string> {
    for (let step = 1; step <= totalPages + 2; step++) {
      console.log(`    Paso ${step}/${totalPages}: Analyzing...`);
      await sleep(1500 + Math.random() * 1000);

      // Check if modal is still open (submission might have completed)
      const modalOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
      if (!modalOpen) {
        console.log(`    ✓ Modal closed - submission confirmed.`);
        return 'applied';
      }

      // Check for success confirmation
      if (await this._checkApplicationSuccess(page)) {
        console.log(`    ✓ Application submitted!`);
        return 'applied';
      }

      // Analyze current form step
      const analysis = await this.analyzer.analyze(page);

      // Fill fields if any
      if (analysis.fields.length > 0) {
        console.log(`    Found ${analysis.fields.length} field(s):`);
        for (const field of analysis.fields) {
          console.log(`      - ${field.type}: "${field.label}"${field.required ? ' *' : ''}`);
        }

        // Handle file upload
        if (analysis.hasFileUpload) {
          const resumePath = this.resumeManager.getResumeForJob(job.title);
          if (fs.existsSync(resumePath)) {
            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
              await fileInput.uploadFile(resumePath);
              console.log(`    ✓ CV uploaded`);
              await sleep(2000 + Math.random() * 2000);
            }
          } else {
            console.warn(`    ⚠ CV not found: ${resumePath}`);
          }
        }

        const fillResult = await this.filler.fillFields(page, analysis.fields);
        console.log(`    Filled: ${fillResult.filled}, Skipped: ${fillResult.skipped}`);
        await sleep(500 + Math.random() * 500);
      }

      // On last expected step, look for Submit
      const isLastStep = step >= totalPages;

      if (isLastStep && analysis.submitButtonSelector) {
        console.log(`    → Last step. Clicking Submit...`);
        const clicked = await this._clickButton(page, analysis.submitButtonSelector);
        if (!clicked) {
          console.warn(`    ⚠ Could not click Submit`);
          return 'need_review';
        }
        await sleep(2000 + Math.random() * 2000);
        if (await this._checkApplicationSuccess(page)) {
          console.log(`    ✓ Application submitted!`);
          return 'applied';
        }
        console.log(`    Submit clicked, checking...`);
        continue;
      }

      // Click Continue / Next / Review
      if (analysis.nextButtonSelector) {
        console.log(`    → Clicking Continue...`);
        await this._clickButton(page, analysis.nextButtonSelector);
        await sleep(1000 + Math.random() * 1000);
        continue;
      }

      if (analysis.reviewButtonSelector) {
        console.log(`    → Clicking Review...`);
        await this._clickButton(page, analysis.reviewButtonSelector);
        await sleep(1000 + Math.random() * 1000);
        continue;
      }

      // Submit button found even if not on expected last step
      if (analysis.submitButtonSelector) {
        console.log(`    → Clicking Submit...`);
        const clicked = await this._clickButton(page, analysis.submitButtonSelector);
        if (!clicked) return 'need_review';
        await sleep(2000 + Math.random() * 2000);
        if (await this._checkApplicationSuccess(page)) {
          console.log(`    ✓ Application submitted!`);
          return 'applied';
        }
        continue;
      }

      // No buttons found — check if modal closed
      const stillOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
      if (!stillOpen) {
        console.log(`    ✓ Modal closed.`);
        return 'applied';
      }

      console.log(`    No action possible on this step.`);
      return 'need_review';
    }

    return 'need_review (max steps exceeded)';
  }

  private async _clickButton(page: Page, selector: string): Promise<boolean> {
    try {
      const btn = await page.$(selector);
      if (!btn) return false;

      const isVisible = await btn.evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;
        const style = window.getComputedStyle(htmlEl);
        return style.display !== 'none' && style.visibility !== 'hidden' && htmlEl.offsetParent !== null;
      });

      if (!isVisible) return false;

      await btn.evaluate((el) => (el as HTMLElement).scrollIntoView({ block: 'center' }));
      await sleep(200 + Math.random() * 300);
      await btn.click();
      return true;
    } catch {
      try {
        await page.click(selector);
        return true;
      } catch {
        return false;
      }
    }
  }

  private async _checkApplicationSuccess(page: Page): Promise<boolean> {
    try {
      return await page.evaluate(() => {
        const selectors = [
          '[class*="application-success"]',
          '[class*="submitted"]',
          '.jobs-easy-apply-success',
          '[data-easy-apply-success]',
        ];

        for (const sel of selectors) {
          try {
            if (document.querySelector(sel)) return true;
          } catch {
            continue;
          }
        }

        const body = document.body.textContent || '';
        return body.includes('Your application was sent')
          || body.includes('Application submitted')
          || body.includes('Solicitud enviada')
          || body.includes('Postulación enviada');
      });
    } catch {
      return false;
    }
  }

  private async _waitForModal(page: Page, timeoutMs: number): Promise<boolean> {
    try {
      await page.waitForSelector('[role="dialog"]', { timeout: timeoutMs });
      return true;
    } catch {
      return page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    }
  }

  private async _closeModalIfOpen(page: Page): Promise<void> {
    try {
      const closed = await page.evaluate(() => {
        const btn = document.querySelector(
          '.artdeco-modal__dismiss, button[aria-label="Dismiss"], ' +
          'button[data-control-name="easy-apply-close"], ' +
          '.artdeco-modal button[aria-label="Close"]'
        );
        if (btn && btn instanceof HTMLElement) {
          btn.click();
          return true;
        }
        return false;
      });

      if (closed) {
        await sleep(1000 + Math.random() * 1000);
      }
    } catch {
    }
  }

  private async _saveScreenshot(page: Page, safeId: string, label: string): Promise<void> {
    if (process.env.DISABLE_FILE_OUTPUT === 'true') return;
    try {
      if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      }
      const filename = `${safeId}_${label}_${Date.now()}.png`;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });
      console.log(`    📸 Screenshot saved: ${filename}`);
    } catch {
    }
  }
}

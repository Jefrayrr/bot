import { Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { setTimeout as sleep } from 'timers/promises';

export interface JobDetails {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string | null;
  easyApply: boolean;
  url: string;
  postedDate: string | null;
  employmentType: string | null;
  workplaceType: string | null;
  companySize: string | null;
  recruiterName: string | null;
  description: string;
  snippet: string;
  fetchedAt: string;
}

export interface ExtractFromListResult {
  jobs: JobDetails[];
  invalid: number;
  duplicates: number;
}

const DEBUG_DIR = path.resolve('debug');
const FILE_OUTPUT_DISABLED = process.env.DISABLE_FILE_OUTPUT === 'true';

export class JobExtractor {
  async extractFromList(page: Page): Promise<ExtractFromListResult> {
    try {
      const result = await page.evaluate(() => {
        const allCards = document.querySelectorAll('.job-card-container');
        const seenKeys = new Set<string>();
        const jobs: any[] = [];
        let invalid = 0;
        let duplicates = 0;

        for (const card of allCards) {
          const el = card as HTMLElement;

          // --- URL ---
          const link = el.querySelector<HTMLAnchorElement>(
            'a[href*="/jobs/view/"], a.job-card-list__title, a.job-card-container__link'
          );
          const fallbackLink = el.querySelector<HTMLAnchorElement>('a');
          const anchor = link || fallbackLink;
          const href = anchor?.getAttribute('href') || '';
          if (!href) { invalid++; continue; }

          const url = href.startsWith('http')
            ? href
            : `https://www.linkedin.com${href.startsWith('/') ? '' : '/'}${href}`;

          // --- Title ---
          const titleEl =
            el.querySelector('.job-card-list__title') ||
            el.querySelector('.job-card-container__link') ||
            el.querySelector('.job-card-list__title--link') ||
            el.querySelector('[class*="job-title"]') ||
            el.querySelector('[class*="job-card"] h3, [class*="job-card"] strong') ||
            anchor;
          const title = titleEl?.textContent?.trim() || anchor?.getAttribute('aria-label') || '';
          if (!title) { invalid++; continue; }

          // --- Company ---
          const companyEl =
            el.querySelector('.artdeco-entity-lockup__subtitle span') ||
            el.querySelector('[class*="entity-lockup__subtitle"] span') ||
            el.querySelector('[class*="subtitle"] span') ||
            el.querySelector('.job-card-container__company-name') ||
            el.querySelector('.job-card-list__company-name') ||
            el.querySelector('[class*="company-name"]') ||
            el.querySelector('[class*="company"]');
          const company = companyEl?.textContent?.trim() || '';
          if (!company) { invalid++; continue; }

          // Dedup within page
          const key = title.toLowerCase() + '|' + company.toLowerCase();
          if (seenKeys.has(key)) { duplicates++; continue; }
          seenKeys.add(key);

          // --- Location ---
          const locationEl =
            el.querySelector('.job-card-container__metadata-wrapper li span') ||
            el.querySelector('[class*="metadata-wrapper"] li span') ||
            el.querySelector('.job-card-container__metadata-item') ||
            el.querySelector('.job-card-list__metadata-item') ||
            el.querySelector('[class*="metadata-item"]') ||
            el.querySelector('[class*="location"]');
          const location = locationEl?.textContent?.trim() || '';

          // --- Salary ---
          const salaryEl =
            el.querySelector('[class*="salary"]');
          const salary = salaryEl?.textContent?.trim() || null;

          // --- Easy Apply ---
          const easyApplyEl =
            el.querySelector('[class*="easy-apply"]');
          const easyApply = !!(easyApplyEl || el.textContent?.includes('Easy Apply'));

          // --- Job ID ---
          const jobId =
            el.dataset?.jobId ||
            el.getAttribute('data-entity-urn')?.split(':').pop() ||
            url.split('/').pop()?.split('?')[0] ||
            '';

          // --- Posted Date ---
          const timeEl =
            el.querySelector('.job-card-container__listed-time') ||
            el.querySelector('[class*="time"]') ||
            el.querySelector('[class*="posted"]') ||
            el.querySelector('time');
          const postedDate = timeEl?.textContent?.trim() || null;

          // --- Snippet ---
          const snippet = el.textContent?.trim().substring(0, 300) || '';

          jobs.push({
            id: jobId || `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title,
            company,
            location,
            salary,
            easyApply,
            url: url.split('?')[0],
            postedDate,
            employmentType: null,
            workplaceType: null,
            companySize: null,
            recruiterName: null,
            description: '',
            snippet,
          });
        }

        return { jobs, invalid, duplicates };
      });

      const jobs = result.jobs.map((j: any) => ({
        ...j,
        fetchedAt: new Date().toISOString(),
      }));

      return { jobs, invalid: result.invalid, duplicates: result.duplicates };
    } catch (err) {
      console.error('[JobExtractor] Failed to extract jobs from list:', err);

      try {
        if (!FILE_OUTPUT_DISABLED) {
          if (!fs.existsSync(DEBUG_DIR)) {
            fs.mkdirSync(DEBUG_DIR, { recursive: true });
          }
          const content = await page.content();
          fs.writeFileSync(path.join(DEBUG_DIR, `extract-fail-${Date.now()}.html`), content);
          console.log('[JobExtractor] Debug HTML saved to debug/extract-fail-*.html');
        }
      } catch {
        // ignore debug errors
      }

      return { jobs: [], invalid: 0, duplicates: 0 };
    }
  }

  async extractFromDetailPage(page: Page, job: JobDetails): Promise<JobDetails> {
    try {
      const safeId = (job.id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
      const detailDir = path.join(DEBUG_DIR, 'detail');
      if (!FILE_OUTPUT_DISABLED && !fs.existsSync(detailDir)) {
        fs.mkdirSync(detailDir, { recursive: true });
      }

      await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this._randomDelay(2000, 3000);

      // Wait for the job description to actually appear in the DOM (loaded via XHR).
      // If the SPA is slow, this waitForFunction will keep polling until the content
      // renders or the timeout fires — much more reliable than a fixed delay.
      try {
        await page.waitForFunction(
          (selectors: string[]) => {
            return selectors.some((sel) => {
              const el = document.querySelector(sel);
              return el && (el.textContent?.trim()?.length || 0) > 100;
            });
          },
          { timeout: 25000 },
          [
            '.jobs-description__content',
            '.jobs-description-content',
            '.jobs-description-content__text',
            '.jobs-box__html-content',
            '.jobs-description',
            '.description__text',
            'main [class*="description"]',
            '[class*="jobs-description"]',
            '[class*="description"]',
            'section[class*="description"]',
            'article[class*="description"]',
          ]
        );
        console.log('[JobExtractor] Description content detected in DOM.');
      } catch {
        console.log('[JobExtractor] Timeout waiting for description. Proceeding with current DOM.');
      }

      // Debug: save screenshot + HTML to inspect what Puppeteer received
      if (!FILE_OUTPUT_DISABLED) {
        await page.screenshot({ path: path.join(detailDir, `${safeId}.png`), fullPage: true });
        fs.writeFileSync(path.join(detailDir, `${safeId}.html`), await page.content());
        console.log(`[JobExtractor] Detail page debug saved for job ${safeId}`);
      }

      // Scroll progressively to trigger any remaining lazy-loaded content
      await page.evaluate(async () => {
        const candidate = document.querySelector(
          '[class*="job-details"], [class*="description"], main'
        ) || document.documentElement;
        const step = 400;
        let iters = 0;
        while (iters < 60) {
          const target = candidate.scrollHeight;
          const pos = candidate.scrollTop;
          if (pos >= target - candidate.clientHeight - 10) break;
          const next = Math.min(pos + step, target - candidate.clientHeight);
          candidate.scrollBy({ top: next - pos, behavior: 'instant' });
          candidate.dispatchEvent(new Event('scroll'));
          iters++;
          await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
        }
      });

      await this._randomDelay(2000, 3000);

      const deepData = await page.evaluate(() => {
        // Try every plausible description selector
        const descSelectors = [
          '.jobs-description__content',
          '.jobs-description-content',
          '.jobs-description-content__text',
          '.jobs-box__html-content',
          '.jobs-description',
          '.description__text',
          '[data-job-id] .jobs-description',
          'main [class*="description"]',
          '[class*="jobs-description"]',
          '[class*="description"]',
          'section[class*="description"]',
          'article[class*="description"]',
          '.job-details-jobs-unified-top-card__description',
        ];
        let fullDescription = '';
        for (const sel of descSelectors) {
          const el = document.querySelector(sel);
          if (el && (el.textContent?.trim()?.length || 0) > 50) {
            fullDescription = el.textContent!.trim();
            break;
          }
        }

        const salarySelectors = [
          '.job-details-jobs-unified-top-card__salary-info',
          '.jobs-unified-top-card__salary-info',
          '[class*="salary"]',
          '[class*="compensation"]',
        ];
        let salaryDetails: string | null = null;
        for (const sel of salarySelectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent?.trim()) {
            salaryDetails = el.textContent.trim();
            break;
          }
        }

        const recruiterSelectors = [
          '[class*="recruiter"] a',
          '[class*="hiring"] a',
          '[data-anonymize*="person"]',
          '[class*="posted-by"] a',
        ];
        let recruiterName: string | null = null;
        for (const sel of recruiterSelectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent?.trim()) {
            recruiterName = el.textContent.trim();
            break;
          }
        }

        const sizeSelectors = [
          '[class*="company-size"]',
          '[class*="staff-count"]',
          '[class*="employee-count"]',
        ];
        let companySize: string | null = null;
        for (const sel of sizeSelectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent?.trim()) {
            companySize = el.textContent.trim();
            break;
          }
        }

        const insightSelectors = [
          '.job-details-jobs-unified-top-card__job-insight',
          '[class*="job-insight"]',
          '[class*="top-card"] [class*="insight"]',
          '[class*="criteria"]',
        ];
        const metadataTexts: string[] = [];
        for (const sel of insightSelectors) {
          const elements = document.querySelectorAll(sel);
          for (const el of elements) {
            const text = el.textContent?.trim();
            if (text) metadataTexts.push(text);
          }
        }

        const easyApplyBtn = document.querySelector<HTMLElement>(
          'button.jobs-apply-button, ' +
          'button[data-control-name*="easyapply"], ' +
          'button[data-job-detail-easy-apply], ' +
          'button[aria-label*="Easy Apply"]'
        );
        const easyApply = !!(
          easyApplyBtn &&
          easyApplyBtn.offsetParent !== null &&
          easyApplyBtn.textContent?.toLowerCase().includes('easy apply')
        );

        return {
          fullDescription,
          metadataTexts,
          salaryDetails,
          recruiterName,
          companySize,
          easyApply,
        };
      });

      let employmentType = job.employmentType;
      let workplaceType = job.workplaceType;
      for (const text of deepData.metadataTexts) {
        const lower = text.toLowerCase();
        if (
          !employmentType &&
          (lower.includes('full-time') ||
            lower.includes('full time') ||
            lower.includes('tiempo completo') ||
            lower.includes('contract') ||
            lower.includes('temporary') ||
            lower.includes('media jornada') ||
            lower.includes('jornada completa') ||
            lower.includes('por contrato'))
        ) {
          employmentType = text;
        }
        if (
          !workplaceType &&
          (lower.includes('remot') ||
            lower.includes('remoto') ||
            lower.includes('híbrido') ||
            lower.includes('hibrido') ||
            lower.includes('presencial') ||
            lower.includes('hybrid') ||
            lower.includes('on-site') ||
            lower.includes('a distancia'))
        ) {
          workplaceType = text;
        }
      }

      const description = deepData.fullDescription || job.description;
      const snippet = description.substring(0, 300) || job.snippet;

      console.log(
        `[JobExtractor] Detail for ${job.id}: desc=${description.length}chars, ` +
        `salary=${deepData.salaryDetails || 'none'}, type=${employmentType || 'unknown'}`
      );

      return {
        ...job,
        easyApply: deepData.easyApply || job.easyApply,
        description,
        snippet,
        salary: deepData.salaryDetails || job.salary,
        recruiterName: deepData.recruiterName || job.recruiterName,
        companySize: deepData.companySize || job.companySize,
        employmentType: employmentType || job.employmentType,
        workplaceType: workplaceType || job.workplaceType,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[JobExtractor] Detail extraction failed for job ${job.id}:`, err);
      return job;
    }
  }

  async extractJobDescription(page: Page): Promise<string> {
    try {
      const description = await page.evaluate(() => {
        const selectors = [
          '.jobs-description__content',
          '.jobs-description-content',
          '.jobs-description-content__text',
          '.jobs-box__html-content',
          '.jobs-description',
          '.description__text',
          '[data-job-id] .jobs-description',
          'main [class*="description"]',
          '[class*="jobs-description"]',
          '[class*="description"]',
          'section[class*="description"]',
          'article[class*="description"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && (el.textContent?.trim()?.length || 0) > 50) {
            return el.textContent!.trim();
          }
        }
        return '';
      });
      return description;
    } catch {
      return '';
    }
  }

  async _randomDelay(minMs = 500, maxMs = 1500): Promise<void> {
    const delay = minMs + Math.random() * (maxMs - minMs);
    await sleep(delay);
  }
}

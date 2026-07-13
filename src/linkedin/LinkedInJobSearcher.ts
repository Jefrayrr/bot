import { Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { LinkedInSession } from './LinkedInSession.js';
import { PaginationManager } from './PaginationManager.js';
import { JobExtractor, JobDetails } from './JobExtractor.js';
import { setTimeout as sleep } from 'timers/promises';

export interface SearchQuery {
  keywords: string;
  location?: string;
  filters?: SearchFilters;
}

export interface SearchFilters {
  remote?: boolean;
  easyApply?: boolean;
  fullTime?: boolean;
  postedWithin?: string;
}

export interface SearchResult {
  query: string;
  pagesProcessed: number;
  cardsDetected: number;
  validJobs: number;
  invalidCards: number;
  uniqueJobs: number;
  duration: string;
  jobs: JobDetails[];
}

const DEBUG_DIR = path.resolve('debug');

const FILE_OUTPUT_DISABLED = process.env.DISABLE_FILE_OUTPUT === 'true';

function ensureDebugDir(): void {
  if (FILE_OUTPUT_DISABLED) return;
  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
  }
}

export class LinkedInJobSearcher {
  private session: LinkedInSession;
  private pagination: PaginationManager;
  private extractor: JobExtractor;
  private maxPages: number;

  constructor(session: LinkedInSession) {
    this.session = session;
    this.maxPages = parseInt(process.env.MAX_PAGES_PER_QUERY || '5', 10);
    this.pagination = new PaginationManager();
    this.extractor = new JobExtractor();
  }

  async searchQuery(
    keywords: string,
    location?: string,
    filters?: SearchFilters
  ): Promise<SearchResult> {
    const page = await this.session.getPage();
    const result: SearchResult = {
      query: keywords,
      pagesProcessed: 0,
      cardsDetected: 0,
      validJobs: 0,
      invalidCards: 0,
      uniqueJobs: 0,
      duration: '0',
      jobs: [],
    };

    const startTime = Date.now();
    this.pagination.reset();
    ensureDebugDir();

    const slug = keywords.replace(/\s+/g, '_').toLowerCase();

    for (let pageNum = 0; pageNum < this.maxPages; pageNum++) {
      const start = pageNum * 25;
      const searchUrl = this._buildSearchUrl({ keywords, location, filters }, start);

      console.log(`\n--- Page ${pageNum + 1} (start=${start}) ---`);
      console.log(`[Searcher] Navigating to: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      try {
        await page.waitForSelector('.jobs-search-results-list, .scaffold-layout__list', {
          timeout: 20000,
        });
        console.log('[Searcher] Results container loaded.');
      } catch {
        console.log('[Searcher] Results container not found. Proceeding anyway.');
      }

      await this._randomDelay(2000, 3000);

      const debugScreenshot = path.join(DEBUG_DIR, `${slug}-page-${pageNum + 1}.png`);
      const debugHtml = path.join(DEBUG_DIR, `${slug}-page-${pageNum + 1}.html`);
      if (!FILE_OUTPUT_DISABLED) {
        await page.screenshot({ path: debugScreenshot, fullPage: true }).catch(() => {});
        fs.writeFileSync(debugHtml, await page.content().catch(() => ''));
        console.log(`[Searcher] Debug files saved: ${debugScreenshot}, ${debugHtml}`);
      }

      const initialCount = await this.pagination.waitForInitialLoad(page);
      if (initialCount === 0) {
        console.log('[Searcher] No cards after initial load. Skipping page.');
        continue;
      }

      const cardCount = await this.pagination.loadFullJobList(page);
      console.log(`Cards detected: ${cardCount}`);

      if (cardCount === 0) {
        console.log('[Searcher] No cards found on this page. Skipping.');
        continue;
      }

      await this._randomDelay(2000, 3000);

      // Extract card-level metadata (title, company, URL, etc.)
      let extractResult: Awaited<ReturnType<typeof this.extractor.extractFromList>> | null = null;
      let extractRetries = 0;
      while (extractRetries < 3) {
        try {
          extractResult = await this.extractor.extractFromList(page);
          break;
        } catch (err) {
          extractRetries++;
          if (extractRetries >= 3) {
            console.log(`[Searcher] Extraction failed after 3 retries. Skipping page.`);
            break;
          }
          console.log(`[Searcher] Extraction failed (retry ${extractRetries}/3):`, err);
          await this._randomDelay(3000, 5000);
        }
      }

      if (!extractResult) {
        console.log('[Searcher] No extraction result. Skipping page.');
        continue;
      }

      result.cardsDetected += cardCount;
      result.validJobs += extractResult.jobs.length;
      result.invalidCards += extractResult.invalid;
      result.pagesProcessed++;

      console.log(`Valid jobs: ${extractResult.jobs.length}`);
      console.log(`Invalid cards: ${extractResult.invalid}`);
      console.log(`Duplicates on page: ${extractResult.duplicates}`);

      if (filters?.easyApply) {
        for (const job of extractResult.jobs) {
          job.easyApply = true;
        }
      }

      result.jobs.push(...extractResult.jobs);

      // Enrich each job by clicking its card and reading the detail panel
      await this.enrichVisibleJobs(page, extractResult.jobs, `${slug}-page-${pageNum + 1}`);

      if (extractResult.jobs.length === 0 && cardCount > 0 && !FILE_OUTPUT_DISABLED) {
        const failScreenshot = path.join(
          DEBUG_DIR,
          `${slug}-page-${pageNum + 1}-extract-fail.png`
        );
        const failHtml = path.join(
          DEBUG_DIR,
          `${slug}-page-${pageNum + 1}-extract-fail.html`
        );
        await page.screenshot({ path: failScreenshot, fullPage: true }).catch(() => {});
        fs.writeFileSync(failHtml, await page.content().catch(() => ''));
        console.log(`[Searcher] Extraction failed debug: ${failScreenshot}, ${failHtml}`);
      }
    }

    const uniqueIds = new Set(result.jobs.map((j) => j.id));
    result.uniqueJobs = uniqueIds.size;
    result.duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\nQuery: ${keywords}`);
    console.log(`Pages processed: ${result.pagesProcessed}`);
    console.log(`Cards detected: ${result.cardsDetected}`);
    console.log(`Valid jobs: ${result.validJobs}`);
    console.log(`Invalid cards: ${result.invalidCards}`);
    console.log(`Unique jobs: ${result.uniqueJobs}`);
    console.log(`Duration: ${result.duration} seconds\n`);

    return result;
  }

  private async enrichVisibleJobs(
    page: Page,
    jobs: JobDetails[],
    label: string
  ): Promise<void> {
    if (jobs.length === 0) return;

    const enrichDir = path.join(DEBUG_DIR, 'enrich');
    if (!FILE_OUTPUT_DISABLED && !fs.existsSync(enrichDir)) {
      fs.mkdirSync(enrichDir, { recursive: true });
    }

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const progress = `${i + 1}/${jobs.length}`;

      console.log(`[${progress}] Enriching: ${job.title} @ ${job.company}`);

      // Record current panel length to detect content change
      const prevLen = await page.evaluate(() => {
        const panel = document.querySelector(
          '.jobs-search__job-details, [class*="job-details"]'
        );
        return panel ? panel.textContent?.trim().length || 0 : 0;
      });

      // Click the card by data-job-id
      const clicked = await page.evaluate((jobId) => {
        const card = document.querySelector<HTMLElement>(
          `.job-card-container[data-job-id="${jobId}"]`
        );
        if (!card) return false;
        card.click();
        card.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        return true;
      }, job.id);

      if (!clicked) {
        console.log(`[${progress}] Card not found. Skipping.`);
        continue;
      }

      // Wait for the detail panel to load fresh content (> 500 chars, different from before)
      try {
        await page.waitForFunction(
          (prevLen) => {
            const panel = document.querySelector(
              '.jobs-search__job-details, [class*="job-details"]'
            );
            if (!panel) return false;
            const len = panel.textContent?.trim().length || 0;
            return len > 500 && len !== prevLen;
          },
          { timeout: 15000 },
          prevLen
        );
      } catch {
        console.log(`[${progress}] Timeout waiting for detail panel. Extracting current DOM.`);
      }

      // Extract all details from the right panel
      const enriched = await page.evaluate(() => {
        const panel = document.querySelector(
          '.jobs-search__job-details, [class*="job-details"]'
        );
        if (!panel) return null;

        const fullText = panel.textContent?.trim() || '';

        // --- Easy Apply detection in detail panel ---
        const easyApplyBtn = panel.querySelector<HTMLElement>(
          'button.jobs-apply-button, ' +
          'button[data-control-name*="easyapply"], ' +
          'button[data-job-detail-easy-apply], ' +
          'button[aria-label*="Easy Apply"]'
        );
        const panelEasyApply = !!(easyApplyBtn &&
          easyApplyBtn.offsetParent !== null &&
          easyApplyBtn.textContent?.toLowerCase().includes('easy apply'));

        // --- Description ---
        const descSelectors = [
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
        ];
        let description = '';
        for (const sel of descSelectors) {
          const el = panel.querySelector(sel);
          if (el && (el.textContent?.trim()?.length || 0) > 50) {
            description = el.textContent!.trim();
            break;
          }
        }
        if (!description) {
          // Fallback: find the largest text block in the panel
          const allBlocks = panel.querySelectorAll('p, div, span, section, article');
          let maxLen = 0;
          for (const el of allBlocks) {
            const text = el.textContent?.trim() || '';
            if (text.length > maxLen && text.length > 100) {
              maxLen = text.length;
              description = text;
            }
          }
          if (!description) description = fullText;
        }

        // --- Salary ---
        const salarySelectors = [
          '.job-details-jobs-unified-top-card__salary-info',
          '.jobs-unified-top-card__salary-info',
          '[class*="salary"]',
          '[class*="compensation"]',
        ];
        let salary: string | null = null;
        for (const sel of salarySelectors) {
          const el = panel.querySelector(sel);
          if (el?.textContent?.trim()) {
            salary = el.textContent.trim();
            break;
          }
        }

        // --- Recruiter ---
        const recruiterSelectors = [
          '[class*="recruiter"] a',
          '[class*="hiring"] a',
          '[data-anonymize*="person"]',
        ];
        let recruiter: string | null = null;
        for (const sel of recruiterSelectors) {
          const el = panel.querySelector(sel);
          if (el?.textContent?.trim()) {
            recruiter = el.textContent.trim();
            break;
          }
        }

        // --- Company size ---
        const sizeSelectors = [
          '[class*="company-size"]',
          '[class*="staff-count"]',
          '[class*="employee-count"]',
        ];
        let companySize: string | null = null;
        for (const sel of sizeSelectors) {
          const el = panel.querySelector(sel);
          if (el?.textContent?.trim()) {
            companySize = el.textContent.trim();
            break;
          }
        }

        // --- Metadata insights ---
        const insightSelectors = [
          '.job-details-jobs-unified-top-card__job-insight',
          '[class*="job-insight"]',
          '[class*="top-card"] [class*="insight"]',
          '[class*="criteria"]',
        ];
        const metadataTexts: string[] = [];
        for (const sel of insightSelectors) {
          const elements = panel.querySelectorAll(sel);
          for (const el of elements) {
            const text = el.textContent?.trim();
            if (text) metadataTexts.push(text);
          }
        }

        return {
          description,
          salary,
          recruiterName: recruiter,
          companySize,
          metadataTexts,
          panelEasyApply,
        };
      });

      if (enriched) {
        job.description = enriched.description;
        job.snippet = enriched.description.substring(0, 300) || job.snippet;
        job.salary = enriched.salary || job.salary;
        job.recruiterName = enriched.recruiterName || job.recruiterName;
        job.companySize = enriched.companySize || job.companySize;
        if (!job.easyApply && enriched.panelEasyApply) {
          job.easyApply = true;
        }

        for (const text of enriched.metadataTexts) {
          const lower = text.toLowerCase();
          if (
            !job.employmentType &&
            (lower.includes('full-time') ||
              lower.includes('full time') ||
              lower.includes('tiempo completo') ||
              lower.includes('contract') ||
              lower.includes('temporary') ||
              lower.includes('media jornada') ||
              lower.includes('jornada completa') ||
              lower.includes('por contrato'))
          ) {
            job.employmentType = text;
          }
          if (
            !job.workplaceType &&
            (lower.includes('remot') ||
              lower.includes('remoto') ||
              lower.includes('híbrido') ||
              lower.includes('hibrido') ||
              lower.includes('presencial') ||
              lower.includes('hybrid') ||
              lower.includes('on-site') ||
              lower.includes('a distancia'))
          ) {
            job.workplaceType = text;
          }
        }

        console.log(
          `[${progress}] Enriched: ${job.title} (desc=${enriched.description.length} chars)`
        );
      }

      // Small delay between cards to avoid rate-limiting
      await this._randomDelay(1500, 2500);
    }
  }

  private _buildSearchUrl(query: SearchQuery, start = 0): string {
    const params = new URLSearchParams();
    params.set('keywords', query.keywords);
    if (query.location) {
      params.set('location', query.location);
    }
    params.set('geoId', '92000000');
    params.set('position', '1');
    params.set('pageNum', '0');
    params.set('start', start.toString());
    if (query.filters) {
      if (query.filters.easyApply) params.set('f_AL', 'true');
      if (query.filters.remote) params.set('f_WT', '2');
      if (query.filters.fullTime) params.set('f_JT', 'F');
    }
    return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
  }

  async executeSearch(queries: SearchQuery[]): Promise<JobDetails[]> {
    const allJobs: JobDetails[] = [];
    for (const query of queries) {
      const result = await this.searchQuery(query.keywords, query.location, query.filters);
      allJobs.push(...result.jobs);
    }
    return allJobs;
  }

  async searchSingleQuery(keywords: string, location?: string): Promise<JobDetails[]> {
    const result = await this.searchQuery(keywords, location);
    return result.jobs;
  }

  async searchDefaultQueries(): Promise<JobDetails[]> {
    const location = process.env.SEARCH_LOCATION || 'Colombia';
    const keywordsRaw =
      process.env.SEARCH_KEYWORDS || 'Frontend Developer,Full Stack Developer,Backend Developer';
    const keywords = keywordsRaw.split(',').map((k) => k.trim());

    const easyApply = process.env.EASY_APPLY_ONLY?.toLowerCase() === 'true';
    const filters: SearchFilters = { remote: true, fullTime: true, easyApply };

    const allJobs: JobDetails[] = [];
    for (const kw of keywords) {
      const result = await this.searchQuery(kw, location, filters);
      allJobs.push(...result.jobs);
    }
    return allJobs;
  }

  async _randomDelay(minMs = 1000, maxMs = 3000): Promise<void> {
    const delay = minMs + Math.random() * (maxMs - minMs);
    await sleep(delay);
  }
}

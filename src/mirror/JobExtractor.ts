import { Page } from 'puppeteer';
import { JobViewData, SkillMatch } from './types.js';
import { eventBus } from './EventBus.js';

const SKILL_ALIASES: Record<string, string[]> = {
  React: ['react', 'reactjs', 'react.js'],
  Angular: ['angular', 'angularjs'],
  Vue: ['vue', 'vuejs', 'vue.js'],
  JavaScript: ['javascript', 'js', 'ecmascript', 'es6'],
  TypeScript: ['typescript', 'ts'],
  'Node.js': ['node', 'nodejs', 'node.js'],
  Express: ['express', 'expressjs'],
  HTML: ['html', 'html5'],
  CSS: ['css', 'css3', 'sass', 'scss', 'tailwind', 'bootstrap'],
  Docker: ['docker', 'container'],
  Git: ['git', 'github', 'gitlab'],
  SQL: ['sql', 'mysql', 'postgresql', 'postgres'],
  Python: ['python'],
  Java: ['java'],
  'REST APIs': ['rest', 'restful', 'rest api', 'api'],
};

export class JobExtractor {
  private page: Page | null = null;

  setPage(page: Page): void {
    this.page = page;
  }

  async extractCurrentJob(): Promise<JobViewData | null> {
    if (!this.page) return null;

    try {
      const result = await this.page.evaluate((skillMap) => {
        const panel = document.querySelector(
          '.jobs-search__job-details, [class*="job-details"]'
        );
        if (!panel) return null;

        const getText = (selectors: string[]): string => {
          for (const sel of selectors) {
            const el = panel.querySelector(sel);
            if (el?.textContent?.trim()) return el.textContent.trim();
          }
          return '';
        };

        const title = getText([
          '.job-details-jobs-unified-top-card__job-title',
          '.jobs-details-top-card__job-title',
          'h1',
        ]);

        const company = getText([
          '.job-details-jobs-unified-top-card__company-name',
          '.jobs-details-top-card__company-name',
          '[class*="company-name"]',
        ]);

        const location = getText([
          '.job-details-jobs-unified-top-card__bullet',
          '.jobs-details-top-card__bullet',
          '[class*="location"]',
        ]);

        const salary = getText([
          '.job-details-jobs-unified-top-card__salary-info',
          '[class*="salary"]',
          '[class*="compensation"]',
        ]) || null;

        const postedDate = getText([
          '.job-details-jobs-unified-top-card__list-date',
          '[class*="posted"]',
          '[class*="date"]',
        ]) || null;

        const workplaceType = getText([
          '[class*="workplace-type"]',
          '[class*="remote"]',
        ]) || null;

        const employmentType = getText([
          '[class*="employment-type"]',
          '[class*="full-time"]',
        ]) || null;

        const description = getText([
          '.jobs-description__content',
          '.jobs-description-content',
          '[class*="description"]',
        ]);

        const isEasyApply = !!panel.querySelector(
          'button.jobs-apply-button, button[data-control-name*="easyapply"], button[aria-label*="Easy Apply"]'
        ) || panel.textContent?.toLowerCase().includes('easy apply') || false;

        // Detect skills from description
        const descLower = description.toLowerCase();
        const skills: Array<{ name: string; matched: boolean }> = [];
        for (const [name, aliases] of Object.entries(skillMap)) {
          const matched = aliases.some((alias: string) => {
            if (alias.length <= 3) return new RegExp(`\\b${alias}\\b`, 'i').test(description);
            return descLower.includes(alias);
          });
          skills.push({ name, matched });
        }

        // Extract ID from URL
        const url = window.location.href;
        const idMatch = url.match(/view\/(\d+)/);

        return {
          id: idMatch ? idMatch[1] : `job_${Date.now()}`,
          title,
          company,
          location,
          salary,
          easyApply: isEasyApply,
          score: 0,
          grade: '-',
          confidence: 0,
          skills,
          postedDate,
          workplaceType,
          employmentType,
        };
      }, SKILL_ALIASES);

      return result as JobViewData | null;
    } catch {
      return null;
    }
  }

  emitJob(job: JobViewData): void {
    eventBus.emit('job:view', job);
  }
}

export const jobExtractor = new JobExtractor();

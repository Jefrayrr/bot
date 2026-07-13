import { Page } from 'puppeteer';
import { setTimeout as sleep } from 'timers/promises';

export interface DetectionResult {
  hasEasyApply: boolean;
  isExternal: boolean;
  externalUrl: string | null;
  buttonSelector: string | null;
}

export class EasyApplyDetector {
  async detect(page: Page): Promise<DetectionResult> {
    const result = await page.evaluate(() => {
      // Search ONLY within the job detail panel, not the whole page
      const panel =
        document.querySelector('.jobs-details') ||
        document.querySelector('.jobs-details__top-card') ||
        document.querySelector('[class*="job-details"]') ||
        document.querySelector('main') ||
        document;

      // 1. Try standard CSS selectors within the panel
      const buttonSelectors = [
        'button.jobs-apply-button',
        'button[data-control-name*="easyapply"]',
        'button[data-job-detail-easy-apply]',
        'button[aria-label*="Easy Apply"]',
        'button[aria-label*="Solicitud sencilla"]',
        'button[aria-label*="Postularse"]',
        '.jobs-apply-button',
      ];

      for (const sel of buttonSelectors) {
        try {
          const btn = panel.querySelector(sel);
          if (btn && btn instanceof HTMLElement && btn.offsetParent !== null) {
            return { found: true, selector: sel, isExternal: false, externalUrl: null };
          }
        } catch {
          continue;
        }
      }

      // 2. Text-based fallback: check all buttons in the panel
      const allButtons = panel.querySelectorAll('button');
      for (const btn of allButtons) {
        const text = btn.textContent?.trim().toLowerCase() || '';
        if (
          text.includes('easy apply') ||
          text.includes('solicitud sencilla') ||
          text.includes('postularse fácilmente') ||
          text.includes('aplicar fácilmente')
        ) {
          // Build a unique selector for this button
          const idx = Array.from(allButtons).indexOf(btn);
          return {
            found: true,
            selector: `button:nth-of-type(${idx + 1})`,
            isExternal: false,
            externalUrl: null,
          };
        }
      }

      // 3. External link detection: only check the apply button area
      const applyBtn = panel.querySelector(
        '.jobs-apply-button, [data-control-name*="apply"]'
      );
      if (applyBtn) {
        const parentLink = applyBtn.closest('a[href]');
        if (parentLink instanceof HTMLAnchorElement) {
          const href = parentLink.href;
          if (href && !href.includes('linkedin.com')) {
            return { found: false, selector: null, isExternal: true, externalUrl: href };
          }
        }
      }

      return { found: false, selector: null, isExternal: false, externalUrl: null };
    });

    return {
      hasEasyApply: result.found,
      isExternal: result.isExternal,
      externalUrl: result.externalUrl,
      buttonSelector: result.selector,
    };
  }

  async detectFromListCard(page: Page): Promise<boolean> {
    try {
      const result = await page.evaluate(() => {
        const cards = document.querySelectorAll('.job-card-container');
        for (const card of cards) {
          const badge = card.querySelector('[class*="easy-apply"]');
          if (badge) return true;
          if (card.textContent?.includes('Easy Apply')) return true;
        }
        return false;
      });
      return result;
    } catch {
      return false;
    }
  }
}

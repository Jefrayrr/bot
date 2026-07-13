import { Page } from 'puppeteer';
import { setTimeout as sleep } from 'timers/promises';

export class PaginationManager {
  private processedPageUrls: Set<string> = new Set();

  async waitForInitialLoad(page: Page): Promise<number> {
    let previousCount = 0;
    let stableIterations = 0;

    for (let i = 0; i < 20; i++) {
      await this._randomDelay(1000, 1500);
      const count = await this._countCards(page);

      if (count === previousCount) {
        stableIterations++;
        if (stableIterations >= 3) {
          console.log(`[Pagination] Initial load stable: ${count} cards`);
          return count;
        }
      } else {
        stableIterations = 0;
        console.log(`[Pagination] Initial cards: ${previousCount} → ${count}`);
      }

      previousCount = count;
    }

    return previousCount;
  }

  async loadFullJobList(page: Page): Promise<number> {
    const containerInfo = await page.evaluate(() => {
      const el = [...document.querySelectorAll<HTMLElement>('*')].find((el) => {
        const style = getComputedStyle(el);
        return (
          el.scrollHeight > el.clientHeight + 100 &&
          (style.overflowY === 'auto' || style.overflowY === 'scroll')
        );
      });
      if (!el) return null;
      return {
        tag: el.tagName,
        class: el.className,
        id: el.id,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollTop: el.scrollTop,
        overflow: getComputedStyle(el).overflowY,
      };
    });

    if (!containerInfo) {
      console.log('[Pagination] No scrollable container detected. Scrolling window...');
      await this._smoothScrollFallback(page);
      return this._countCards(page);
    }

    console.log('[Pagination] Scroll container:', containerInfo);

    if (containerInfo.scrollHeight <= containerInfo.clientHeight) {
      console.log('[Pagination] Container has no overflow. Using window fallback.');
      await this._smoothScrollFallback(page);
      return this._countCards(page);
    }

    let previousCount = 0;
    let stableIterations = 0;

    for (let pass = 0; pass < 15; pass++) {
      await page.evaluate(async () => {
        const el = [...document.querySelectorAll<HTMLElement>('*')].find((el) => {
          const style = getComputedStyle(el);
          return (
            el.scrollHeight > el.clientHeight + 100 &&
            (style.overflowY === 'auto' || style.overflowY === 'scroll')
          );
        });
        if (!el) return;
        const step = 400;
        let iters = 0;
        while (iters < 200) {
          const currentTarget = el.scrollHeight;
          const currentPos = el.scrollTop;
          if (currentPos >= currentTarget - el.clientHeight - 10) break;
          const next = Math.min(currentPos + step, currentTarget - el.clientHeight);
          el.scrollBy({ top: next - currentPos, behavior: 'instant' });
          el.dispatchEvent(new Event('scroll'));
          iters++;
          await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
        }
      });

      await this._randomDelay(2000, 3000);

      const currentCount = await this._countCards(page);

      if (currentCount === previousCount) {
        stableIterations++;
        if (stableIterations >= 3) {
          console.log(
            `[Pagination] List fully loaded: ${currentCount} cards (stable ×3)`
          );
          break;
        }
      } else {
        stableIterations = 0;
        console.log(
          `[Pagination] Pass ${pass + 1}: ${previousCount} → ${currentCount} cards`
        );
      }

      previousCount = currentCount;
    }

    return previousCount;
  }

  private async _countCards(page: Page): Promise<number> {
    try {
      return await page.evaluate(() => {
        const cards = document.querySelectorAll('.job-card-container');
        let valid = 0;
        for (const card of cards) {
          const link = card.querySelector('a[href*="/jobs/view/"]');
          if (!link) continue;
          const title = card.querySelector(
            '.job-card-list__title, .job-card-container__link, [class*="job-title"]'
          )?.textContent?.trim();
          if (!title) continue;
          valid++;
        }
        return valid;
      });
    } catch {
      return 0;
    }
  }

  private async _smoothScrollFallback(page: Page): Promise<void> {
    const steps = 10;
    await page.evaluate(async (steps) => {
      const totalHeight = document.documentElement.scrollHeight;
      const stepSize = Math.max(totalHeight / steps, 100);
      for (let i = 0; i < steps; i++) {
        window.scrollTo(
          0,
          Math.min((i + 1) * stepSize, document.documentElement.scrollHeight)
        );
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
      }
    }, steps);
    await this._randomDelay(1000, 2000);
  }

  hasProcessedUrl(url: string): boolean {
    return this.processedPageUrls.has(url);
  }

  addProcessedUrl(url: string): void {
    this.processedPageUrls.add(url);
  }

  async _randomDelay(minMs = 1000, maxMs = 3000): Promise<void> {
    const delay = minMs + Math.random() * (maxMs - minMs);
    await sleep(delay);
  }

  reset(): void {
    this.processedPageUrls.clear();
  }
}

import { Page } from 'puppeteer';
import { BrowserStateData, BotState } from './types.js';
import { eventBus } from './EventBus.js';

export class BrowserState {
  private page: Page | null = null;
  private state: BotState = 'idle';
  private startTime: number = Date.now();
  private currentQuery: string = '';
  private currentPage: number = 0;
  private totalPages: number = 0;
  private currentJob: number = 0;
  private totalJobs: number = 0;

  setPage(page: Page): void {
    this.page = page;
  }

  setState(state: BotState): void {
    this.state = state;
    this.emitState();
  }

  setSearchInfo(query: string, page: number, totalPages: number): void {
    this.currentQuery = query;
    this.currentPage = page;
    this.totalPages = totalPages;
    this.emitState();
  }

  setJobProgress(current: number, total: number): void {
    this.currentJob = current;
    this.totalJobs = total;
    this.emitState();
  }

  async getState(): Promise<BrowserStateData> {
    let url = '';
    let title = '';
    let sessionStatus = 'Unknown';

    if (this.page) {
      try {
        url = this.page.url();
        title = await this.page.title();
        sessionStatus = url.includes('linkedin.com') ? 'Authenticated' : 'Not Authenticated';
      } catch {
        url = 'N/A';
        title = 'N/A';
      }
    }

    const mem = process.memoryUsage();
    const memoryMB = Math.round(mem.heapUsed / 1024 / 1024);
    const uptime = Math.round((Date.now() - this.startTime) / 1000);

    return {
      url,
      title,
      state: this.state,
      memoryMB,
      uptime,
      currentQuery: this.currentQuery,
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      currentJob: this.currentJob,
      totalJobs: this.totalJobs,
      sessionStatus,
    };
  }

  private emitState(): void {
    this.getState().then((state) => {
      eventBus.emit('browser:state', state);
    });
  }
}

export const browserState = new BrowserState();

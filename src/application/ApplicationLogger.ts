import fs from 'fs/promises';
import path from 'path';

export type ApplicationResult =
  | 'applied'
  | 'rejected'
  | 'failed'
  | 'need_resume'
  | 'need_review'
  | 'external_site'
  | 'already_applied'
  | 'no_easy_apply'
  | 'skipped';

export interface ApplicationLogEntry {
  jobId: string;
  company: string;
  title: string;
  url: string;
  result: ApplicationResult;
  reason: string;
  timestamp: string;
  screenshot?: string;
}

export interface ApplicationStats {
  total: number;
  applied: number;
  rejected: number;
  failed: number;
  needReview: number;
  externalSite: number;
  alreadyApplied: number;
  noEasyApply: number;
  byCompany: Record<string, number>;
}

const LOG_FILE = path.resolve(process.env.DATA_DIR || './data', 'applications.json');

export class ApplicationLogger {
  private entries: ApplicationLogEntry[] = [];

  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(LOG_FILE, 'utf-8');
      this.entries = JSON.parse(data);
      console.log(`[ApplicationLogger] Loaded ${this.entries.length} application logs.`);
    } catch {
      console.log('[ApplicationLogger] No existing application log, starting fresh.');
      this.entries = [];
    }
  }

  async log(entry: Omit<ApplicationLogEntry, 'timestamp'>): Promise<void> {
    const fullEntry: ApplicationLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(fullEntry);
    await this._save();

    const icon = this._resultIcon(entry.result);
    console.log(`${icon} [Apply] ${entry.company} - ${entry.title}: ${entry.reason}`);
  }

  async hasBeenApplied(jobId: string): Promise<boolean> {
    return this.entries.some(
      (e) => e.jobId === jobId && e.result === 'applied'
    );
  }

  async getApplicationsForJob(jobId: string): Promise<ApplicationLogEntry[]> {
    return this.entries.filter((e) => e.jobId === jobId);
  }

  getStats(): ApplicationStats {
    const total = this.entries.length;
    const applied = this.entries.filter((e) => e.result === 'applied').length;
    const rejected = this.entries.filter((e) => e.result === 'rejected').length;
    const failed = this.entries.filter((e) => e.result === 'failed').length;
    const needReview = this.entries.filter((e) => e.result === 'need_review').length;
    const externalSite = this.entries.filter((e) => e.result === 'external_site').length;
    const alreadyApplied = this.entries.filter((e) => e.result === 'already_applied').length;
    const noEasyApply = this.entries.filter((e) => e.result === 'no_easy_apply').length;

    const byCompany: Record<string, number> = {};
    for (const e of this.entries) {
      byCompany[e.company] = (byCompany[e.company] || 0) + 1;
    }

    return { total, applied, rejected, failed, needReview, externalSite, alreadyApplied, noEasyApply, byCompany };
  }

  getRecent(limit = 20): ApplicationLogEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  getAll(): ApplicationLogEntry[] {
    return [...this.entries];
  }

  private async _save(): Promise<void> {
    if (process.env.DISABLE_FILE_OUTPUT === 'true') return;
    const dir = path.dirname(LOG_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(LOG_FILE, JSON.stringify(this.entries, null, 2), 'utf-8');
  }

  private _resultIcon(result: ApplicationResult): string {
    switch (result) {
      case 'applied': return '[✓]';
      case 'rejected': return '[✗]';
      case 'failed': return '[!]';
      case 'need_review': return '[?]';
      case 'external_site': return '[→]';
      case 'already_applied': return '[-]';
      case 'no_easy_apply': return '[ ]';
      default: return '[?]';
    }
  }
}

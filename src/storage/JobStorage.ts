import fs from 'fs/promises';
import path from 'path';
import { JobDetails } from '../linkedin/JobExtractor.js';
import { ScoreResult } from '../scoring/AdvancedJobScorer.js';

export interface StoredJob extends JobDetails {
  score?: ScoreResult;
  state: 'new' | 'seen' | 'applied' | 'rejected' | 'saved';
  stateUpdatedAt: string;
  lastSeenAt: string;
}

export class JobStorage {
  private filePath: string;
  private jobs: Map<string, StoredJob> = new Map();
  private disabled: boolean;

  constructor() {
    this.disabled = process.env.DISABLE_FILE_OUTPUT === 'true';
    const dataDir = path.resolve(process.env.DATA_DIR || './data');
    this.filePath = path.join(dataDir, 'jobs.json');
  }

  async initialize(): Promise<void> {
    if (this.disabled) {
      this.jobs = new Map();
      return;
    }
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await this._load();
  }

  private async _load(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const jobsArray: StoredJob[] = JSON.parse(data);
      this.jobs = new Map(jobsArray.map((job) => [job.id, job]));
      console.log(`[JobStorage] Loaded ${this.jobs.size} jobs from storage.`);
    } catch {
      console.log('[JobStorage] No existing data found, starting fresh.');
      this.jobs = new Map();
    }
  }

  async save(): Promise<void> {
    if (this.disabled) return;
    const jobsArray = Array.from(this.jobs.values());
    await fs.writeFile(this.filePath, JSON.stringify(jobsArray, null, 2), 'utf-8');
    console.log(`[JobStorage] Saved ${jobsArray.length} jobs.`);
  }

  hasJob(jobId: string): boolean {
    return this.jobs.has(jobId);
  }

  getJob(jobId: string): StoredJob | undefined {
    return this.jobs.get(jobId);
  }

  async addJob(job: JobDetails, score?: ScoreResult): Promise<StoredJob> {
    const storedJob: StoredJob = {
      ...job,
      score,
      state: 'new',
      stateUpdatedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, storedJob);
    return storedJob;
  }

  async updateJob(jobId: string, updates: Partial<StoredJob>): Promise<void> {
    const existing = this.jobs.get(jobId);
    if (!existing) return;
    Object.assign(existing, updates, { lastSeenAt: new Date().toISOString() });
  }

  async setJobState(jobId: string, state: StoredJob['state']): Promise<void> {
    const existing = this.jobs.get(jobId);
    if (!existing) return;
    existing.state = state;
    existing.stateUpdatedAt = new Date().toISOString();
    existing.lastSeenAt = new Date().toISOString();
  }

  getAllJobs(): StoredJob[] {
    return Array.from(this.jobs.values());
  }

  getJobsByState(state: StoredJob['state']): StoredJob[] {
    return this.getAllJobs().filter((j) => j.state === state);
  }

  getHighScoreJobs(minScore = 4.0): StoredJob[] {
    return this.getAllJobs().filter((j) => j.score && j.score.score >= minScore);
  }

  getEasyApplyJobs(): StoredJob[] {
    return this.getAllJobs().filter((j) => j.easyApply);
  }

  getStats(): { total: number; new: number; seen: number; applied: number; rejected: number; saved: number } {
    const all = this.getAllJobs();
    return {
      total: all.length,
      new: all.filter((j) => j.state === 'new').length,
      seen: all.filter((j) => j.state === 'seen').length,
      applied: all.filter((j) => j.state === 'applied').length,
      rejected: all.filter((j) => j.state === 'rejected').length,
      saved: all.filter((j) => j.state === 'saved').length,
    };
  }
}

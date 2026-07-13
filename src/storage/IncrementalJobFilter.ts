import { JobDetails } from '../linkedin/JobExtractor.js';
import { JobStorage, StoredJob } from './JobStorage.js';

export interface IncrementalResult {
  newJobs: JobDetails[];
  updatedJobs: JobDetails[];
  skippedJobs: number;
}

export class IncrementalJobFilter {
  private storage: JobStorage;

  constructor(storage: JobStorage) {
    this.storage = storage;
  }

  filter(jobs: JobDetails[]): IncrementalResult {
    const newJobs: JobDetails[] = [];
    const updatedJobs: JobDetails[] = [];
    let skippedJobs = 0;

    for (const job of jobs) {
      const existing = this.storage.getJob(job.id);

      if (!existing) {
        newJobs.push(job);
        continue;
      }

      if (this._hasChanged(existing, job)) {
        updatedJobs.push(job);
      } else {
        skippedJobs++;
      }
    }

    console.log(
      `[IncrementalFilter] New: ${newJobs.length}, Updated: ${updatedJobs.length}, Skipped: ${skippedJobs}`
    );

    return { newJobs, updatedJobs, skippedJobs };
  }

  private _hasChanged(existing: StoredJob, incoming: JobDetails): boolean {
    const existingTitle = (existing.title || '').toLowerCase().trim();
    const incomingTitle = (incoming.title || '').toLowerCase().trim();
    if (existingTitle !== incomingTitle) return true;

    const existingSalary = (existing.salary || '').toLowerCase().trim();
    const incomingSalary = (incoming.salary || '').toLowerCase().trim();
    if (existingSalary !== incomingSalary) return true;

    if (existing.easyApply !== incoming.easyApply) return true;

    const existingDesc = (existing.description || '').substring(0, 100).toLowerCase();
    const incomingDesc = (incoming.description || '').substring(0, 100).toLowerCase();
    if (existingDesc !== incomingDesc) return true;

    return false;
  }
}

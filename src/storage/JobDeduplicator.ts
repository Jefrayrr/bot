import { JobDetails } from '../linkedin/JobExtractor.js';
import { JobStorage } from './JobStorage.js';

export interface DeduplicationResult {
  unique: JobDetails[];
  removed: number;
  totalRaw: number;
  stats: {
    byId: number;
    byUrl: number;
    byNormalized: number;
  };
}

export class JobDeduplicator {
  private storage: JobStorage;
  private processedUrls: Set<string> = new Set();
  private processedIds: Set<string> = new Set();

  constructor(storage: JobStorage) {
    this.storage = storage;
  }

  initialize(): void {
    const existingJobs = this.storage.getAllJobs();
    for (const job of existingJobs) {
      if (job.url) this.processedUrls.add(job.url);
      this.processedIds.add(job.id);
    }
    console.log(`[JobDeduplicator] Initialized with ${this.processedIds.size} known jobs.`);
  }

  isDuplicate(job: JobDetails): boolean {
    if (this.processedIds.has(job.id)) return true;
    if (job.url && this.processedUrls.has(job.url)) return true;
    return false;
  }

  markAsProcessed(job: JobDetails): void {
    this.processedIds.add(job.id);
    if (job.url) this.processedUrls.add(job.url);
  }

  filterNewJobs(jobs: JobDetails[]): JobDetails[] {
    const newJobs: JobDetails[] = [];
    for (const job of jobs) {
      if (!this.isDuplicate(job)) {
        newJobs.push(job);
        this.markAsProcessed(job);
      }
    }
    console.log(`[JobDeduplicator] Filtered ${jobs.length} -> ${newJobs.length} new jobs.`);
    return newJobs;
  }

  deduplicateAcrossSearches(searchResults: JobDetails[][]): DeduplicationResult {
    const flat = searchResults.flat();
    const totalRaw = flat.length;
    const seenIds = new Set<string>();
    const seenUrls = new Set<string>();
    const seenNormalized = new Set<string>();
    const unique: JobDetails[] = [];
    let byId = 0;
    let byUrl = 0;
    let byNormalized = 0;

    for (const job of flat) {
      if (job.id && seenIds.has(job.id)) {
        byId++;
        continue;
      }

      if (job.url && seenUrls.has(job.url)) {
        byUrl++;
        continue;
      }

      const normalized =
        `${(job.title || '').toLowerCase().trim()}|${(job.company || '').toLowerCase().trim()}|${(job.location || '').toLowerCase().trim()}`;
      if (seenNormalized.has(normalized)) {
        byNormalized++;
        continue;
      }

      if (job.id) seenIds.add(job.id);
      if (job.url) seenUrls.add(job.url);
      seenNormalized.add(normalized);
      unique.push(job);
    }

    const totalRemoved = byId + byUrl + byNormalized;
    const result: DeduplicationResult = {
      unique,
      removed: totalRemoved,
      totalRaw,
      stats: { byId, byUrl, byNormalized },
    };

    console.log(
      `[JobDeduplicator] Cross-search dedup: ${totalRaw} -> ${unique.length} (removed ${totalRemoved})`
    );
    return result;
  }

  reset(): void {
    this.processedUrls.clear();
    this.processedIds.clear();
  }
}

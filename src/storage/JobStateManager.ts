import { JobStorage, StoredJob } from './JobStorage.js';

export interface JobStatistics {
  total: number;
  new: number;
  seen: number;
  applied: number;
  rejected: number;
  saved: number;
  highScoreCount: number;
  easyApplyCount: number;
  averageScore: number | null;
  topJobs: StoredJob[];
  gradeDistribution: Record<string, number>;
}

export class JobStateManager {
  private storage: JobStorage;

  constructor(storage: JobStorage) {
    this.storage = storage;
  }

  getStatistics(): JobStatistics {
    const stats = this.storage.getStats();
    const allJobs = this.storage.getAllJobs();
    const scoredJobs = allJobs.filter((j) => j.score);

    const averageScore = scoredJobs.length > 0
      ? Math.round((scoredJobs.reduce((sum, j) => sum + (j.score?.score || 0), 0) / scoredJobs.length) * 100) / 100
      : null;

    const gradeDistribution: Record<string, number> = {};
    for (const job of scoredJobs) {
      const grade = job.score!.grade;
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    }

    const topJobs = [...allJobs]
      .filter((j) => j.score)
      .sort((a, b) => (b.score?.score || 0) - (a.score?.score || 0))
      .slice(0, 10);

    return {
      ...stats,
      highScoreCount: this.storage.getHighScoreJobs().length,
      easyApplyCount: this.storage.getEasyApplyJobs().length,
      averageScore,
      topJobs,
      gradeDistribution,
    };
  }

  markAsApplied(jobId: string): void {
    this.storage.setJobState(jobId, 'applied');
  }

  markAsRejected(jobId: string): void {
    this.storage.setJobState(jobId, 'rejected');
  }

  markAsSaved(jobId: string): void {
    this.storage.setJobState(jobId, 'saved');
  }

  markAsSeen(jobId: string): void {
    this.storage.setJobState(jobId, 'seen');
  }

  getUntouchedJobs(): StoredJob[] {
    return this.storage.getJobsByState('new');
  }

  getPriorityJobs(minScore = 4.0): StoredJob[] {
    return this.storage
      .getHighScoreJobs(minScore)
      .filter((j) => j.state === 'new' || j.state === 'seen');
  }
}

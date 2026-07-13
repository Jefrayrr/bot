import { StoredJob } from '../storage/JobStorage.js';

export interface NotificationEvent {
  type: 'high_score' | 'easy_apply' | 'salary_threshold' | 'batch_summary';
  job?: StoredJob;
  message: string;
  timestamp: string;
}

export class NotificationManager {
  private events: NotificationEvent[] = [];

  notifyHighScoreJob(job: StoredJob): void {
    const grade = job.score?.grade || 'N/A';
    const score = job.score?.score.toFixed(1) || 'N/A';
    const message = `[HIGH SCORE] ${job.title} at ${job.company} scored ${score} (${grade})`;

    const event: NotificationEvent = {
      type: 'high_score',
      job,
      message,
      timestamp: new Date().toISOString(),
    };

    this.events.push(event);
    this._consoleOutput(event);
  }

  notifyEasyApply(job: StoredJob): void {
    const message = `[EASY APPLY] ${job.title} at ${job.company} - ${job.location}`;

    const event: NotificationEvent = {
      type: 'easy_apply',
      job,
      message,
      timestamp: new Date().toISOString(),
    };

    this.events.push(event);
    this._consoleOutput(event);
  }

  notifySalaryThreshold(job: StoredJob): void {
    const message = `[SALARY ALERT] ${job.title} at ${job.company} offers ${job.salary || 'competitive salary'}`;

    const event: NotificationEvent = {
      type: 'salary_threshold',
      job,
      message,
      timestamp: new Date().toISOString(),
    };

    this.events.push(event);
    this._consoleOutput(event);
  }

  notifyBatchSummary(newJobs: number, highScoreJobs: number, easyApplyJobs: number): void {
    const message = `[BATCH SUMMARY] Found ${newJobs} new jobs. ${highScoreJobs} high-score, ${easyApplyJobs} Easy Apply.`;

    const event: NotificationEvent = {
      type: 'batch_summary',
      message,
      timestamp: new Date().toISOString(),
    };

    this.events.push(event);
    this._consoleOutput(event);
  }

  private _consoleOutput(event: NotificationEvent): void {
    const icons: Record<string, string> = {
      high_score: '⭐',
      easy_apply: '⚡',
      salary_threshold: '💰',
      batch_summary: '📊',
    };

    const icon = icons[event.type] || '📌';
    console.log(`\n${icon} ${event.message}\n`);
  }

  getEvents(): NotificationEvent[] {
    return [...this.events];
  }

  getRecentEvents(count = 10): NotificationEvent[] {
    return this.events.slice(-count);
  }

  clearEvents(): void {
    this.events = [];
  }
}

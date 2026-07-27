import fs from 'fs/promises';
import path from 'path';
import { JobStateManager } from '../storage/JobStateManager.js';

export class JobReportGenerator {
  private stateManager: JobStateManager;
  private reportsDir: string;

  constructor(stateManager: JobStateManager) {
    this.stateManager = stateManager;
    this.reportsDir = path.resolve(process.env.REPORTS_DIR || './reports');
  }

  async generateDailyReport(): Promise<string> {
    const stats = this.stateManager.getStatistics();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const lines: string[] = [];
    lines.push('='.repeat(50));
    lines.push(`  LinkedIn Job Bot - Daily Report`);
    lines.push(`  Date: ${dateStr}`);
    lines.push('='.repeat(50));
    lines.push('');
    lines.push('--- Summary ---');
    lines.push(`Total jobs in storage: ${stats.total}`);
    lines.push(`New jobs: ${stats.new}`);
    lines.push(`Seen jobs: ${stats.seen}`);
    lines.push(`Applied jobs: ${stats.applied}`);
    lines.push(`Rejected jobs: ${stats.rejected}`);
    lines.push(`Saved jobs: ${stats.saved}`);
    lines.push(`High-score jobs (A): ${stats.highScoreCount}`);
    lines.push(`Easy Apply jobs: ${stats.easyApplyCount}`);
    if (stats.averageScore !== null) {
      lines.push(`Average score: ${stats.averageScore.toFixed(2)}`);
    }
    lines.push('');
    lines.push('--- Grade Distribution ---');
    for (const [grade, count] of Object.entries(stats.gradeDistribution).sort()) {
      lines.push(`  ${grade}: ${count} jobs`);
    }
    lines.push('');
    if (stats.topJobs.length > 0) {
      lines.push('--- Top Opportunities ---');
      stats.topJobs.slice(0, 10).forEach((job, i) => {
        const score = job.score?.score.toFixed(1) || 'N/A';
        const grade = job.score?.grade || 'N/A';
        lines.push(`  ${i + 1}. [${grade}] ${score} - ${job.title} @ ${job.company}`);
      });
    }
    lines.push('');
    lines.push('='.repeat(50));

    const report = lines.join('\n');

    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
      const filePath = path.join(this.reportsDir, `report-${dateStr}.txt`);
      await fs.writeFile(filePath, report, 'utf-8');
      console.log(`[JobReportGenerator] Report saved to ${filePath}`);
    } catch (err) {
      console.error('[JobReportGenerator] Failed to save report file:', err);
    }

    return report;
  }
}

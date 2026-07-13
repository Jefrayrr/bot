import 'dotenv/config';
import { LinkedInSession } from './linkedin/LinkedInSession.js';
import { LinkedInJobSearcher, SearchResult, SearchFilters } from './linkedin/LinkedInJobSearcher.js';
import { JobDetails } from './linkedin/JobExtractor.js';
import { AdvancedJobScorer, ScoreResult, GRADE_ACTIONS } from './scoring/AdvancedJobScorer.js';
import { loadUserProfile } from './scoring/UserProfile.js';
import { JobStorage } from './storage/JobStorage.js';
import { JobStateManager } from './storage/JobStateManager.js';
import { JobDeduplicator } from './storage/JobDeduplicator.js';
import { IncrementalJobFilter } from './storage/IncrementalJobFilter.js';
import { JobReportGenerator } from './reports/JobReportGenerator.js';
import { NotificationManager } from './notifications/NotificationManager.js';
import { loadApplicationProfile } from './application/ApplicationProfile.js';
import { QuestionAnswerer } from './application/QuestionAnswerer.js';
import { KnowledgeBase } from './application/KnowledgeBase.js';
import { ApplicationLogger } from './application/ApplicationLogger.js';
import { ResumeManager } from './application/ResumeManager.js';
import { ApplicationEngine } from './application/ApplicationEngine.js';

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  LinkedIn Job Bot v2.0');
  console.log('  Multi-Stage Search Pipeline');
  console.log('========================================\n');

  const profile = loadUserProfile();
  console.log(`Profile: ${profile.name}`);
  console.log(`Preferred roles: ${profile.preferredRoles.join(', ')}`);
  console.log(`Technical skills: ${profile.technicalSkills.length} tracked`);
  console.log(`Minimum salary: ${(profile.minimumSalary / 1000000).toFixed(0)}M COP\n`);

  const scorer = new AdvancedJobScorer(profile);
  const storage = new JobStorage();
  await storage.initialize();
  const stateManager = new JobStateManager(storage);
  const deduplicator = new JobDeduplicator(storage);
  deduplicator.initialize();
  const incrementalFilter = new IncrementalJobFilter(storage);
  const reportGenerator = new JobReportGenerator(stateManager);
  const notifier = new NotificationManager();

  const session = new LinkedInSession();
  let page;

  try {
    // ========== STAGE 0: Verify LinkedIn Session ==========
    console.log('========== Stage 0: Verify LinkedIn Session ==========\n');
    page = await session.initialize();
    console.log('[Pipeline] Session verified.\n');

    const searcher = new LinkedInJobSearcher(session);
    const location = process.env.SEARCH_LOCATION || 'Colombia';
    const searchQueries = ['Frontend Developer'];
      //, 'Backend Developer', 'Full Stack Developer'];
    const searchFilters: SearchFilters = {
      easyApply: process.env.EASY_APPLY_ONLY?.toLowerCase() === 'true',
    };

    // ========== STAGE 1: Search Execution ==========
    console.log('========== Stage 1: Search Execution ==========\n');
    const rawResults: SearchResult[] = [];

    for (const query of searchQueries) {
      console.log(`\n>>> Search: "${query}" <<<\n`);
      const result = await searcher.searchQuery(query, location, searchFilters);
      rawResults.push(result);
      console.log(
        `[Pipeline] "${query}" completed: ${result.validJobs} valid jobs in ${result.duration}s\n`
      );
    }

    const allRawJobs = rawResults.flatMap((r) => r.jobs);
    console.log(`\n[Pipeline] Stage 1 complete. Total raw jobs collected: ${allRawJobs.length}\n`);

    // ========== STAGE 2: Global Deduplication ==========
    console.log('========== Stage 2: Global Deduplication ==========\n');
    const dedupResult = deduplicator.deduplicateAcrossSearches(rawResults.map((r) => r.jobs));

    console.log(`Raw jobs collected: ${dedupResult.totalRaw}`);
    console.log(`Duplicates removed: ${dedupResult.removed}`);
    console.log(`  By LinkedIn Job ID: ${dedupResult.stats.byId}`);
    console.log(`  By Job URL: ${dedupResult.stats.byUrl}`);
    console.log(`  By Normalized (Title|Company|Location): ${dedupResult.stats.byNormalized}`);
    console.log(`Unique jobs: ${dedupResult.unique.length}\n`);

    // ========== STAGE 3: Incremental Search Support ==========
    console.log('========== Stage 3: Incremental Search Support ==========\n');
    const incremental = incrementalFilter.filter(dedupResult.unique);
    const jobsToProcess = [...incremental.newJobs, ...incremental.updatedJobs];

    console.log(`New jobs: ${incremental.newJobs.length}`);
    console.log(`Updated jobs: ${incremental.updatedJobs.length}`);
    console.log(`Skipped (already processed): ${incremental.skippedJobs}\n`);

    let scoredResults: Array<{ job: JobDetails; score: ScoreResult }> = [];

    if (jobsToProcess.length === 0) {
      console.log(
        '[Pipeline] No new or updated jobs. Skipping scoring and ranking.\n'
      );
    } else {
      // Jobs already enriched inline during searchQuery (enrichVisibleJobs)
      console.log(
        `[Pipeline] ${jobsToProcess.length} pre-enriched jobs ready for scoring.\n`
      );

      // ========== STAGE 4: Advanced Scoring ==========
      console.log('========== Stage 4: Advanced Scoring ==========\n');
      for (const job of jobsToProcess) {
        console.log(`Scoring: ${job.title} @ ${job.company}`);
        const score = scorer.scoreJob(job);
        scoredResults.push({ job, score });

        const icon =
          score.grade === 'A' ? '⭐' : score.grade === 'B' ? '👍' : score.grade === 'C' ? '📄' : '❌';
        const action = GRADE_ACTIONS[score.grade] || '';
        const status = score.passedStage1
          ? `Score: ${score.score.toFixed(1)} (${score.grade}) | ${action} | Confidence: ${score.confidence}%`
          : `REJECTED | Score: ${score.score.toFixed(1)} | ${score.reasons.slice(0, 2).join(', ')}`;
        console.log(`${icon} ${status}`);
        if (score.breakdown.length > 0) {
          const lines = score.breakdown.join('\n         ');
          console.log(`         ${lines}`);
          console.log(`         ------------`);
          const rawTotal = score.rawBreakdown.reduce((s, c) => s + c.raw, 0);
          console.log(`         Raw: ${rawTotal.toFixed(1)} → Final: ${score.score.toFixed(1)} (${score.grade})`);
        }
        console.log('');

        await storage.addJob(job, score);
      }

      // ========== STAGE 6: Ranking ==========
      console.log('========== Stage 6: Ranking ==========\n');
      scoredResults.sort((a, b) => b.score.score - a.score.score);

      console.log('Ranking (Top 10):');
      console.log('');
      console.log(' #  Score Grade Company              Title');
      console.log('--- ----- ----- -------------------- ------------------------------------');
      scoredResults.slice(0, 10).forEach((r, i) => {
        const title =
          r.job.title.length > 36 ? r.job.title.substring(0, 33) + '...' : r.job.title;
        const company =
          r.job.company.length > 20 ? r.job.company.substring(0, 17) + '...' : r.job.company;
        console.log(
          `${(i + 1).toString().padStart(2)}  ${r.score.score.toFixed(1).padStart(4)}  ${r.score.grade.padEnd(5)} ${company.padEnd(20)} ${title}`
        );
      });
      console.log('');

      // ========== STAGE 7: Results Classification ==========
      console.log('========== Stage 7: Results Classification ==========\n');
      const gradeA = scoredResults.filter((r) => r.score.grade === 'A');
      const gradeB = scoredResults.filter((r) => r.score.grade === 'B');
      const gradeC = scoredResults.filter((r) => r.score.grade === 'C');
      const rejected = scoredResults.filter((r) => !r.score.passedStage1);

      console.log('A Grade (≥4.5) — Auto Apply    : ' + gradeA.length);
      console.log('B Grade (≥4.0) — Auto Apply    : ' + gradeB.length);
      console.log('C Grade (≥3.0) — Revisar       : ' + gradeC.length);
      console.log('Rejected (Below 3.0)           : ' + rejected.length);
      console.log('');

      // Notifications
      for (const r of gradeA) {
        const stored = storage.getJob(r.job.id);
        if (stored) notifier.notifyHighScoreJob(stored);
      }
      for (const r of scoredResults) {
        if (r.job.easyApply && r.score.score >= 3.0) {
          const stored = storage.getJob(r.job.id);
          if (stored) notifier.notifyEasyApply(stored);
        }
      }
      notifier.notifyBatchSummary(
        jobsToProcess.length,
        gradeA.length,
        scoredResults.filter((r) => r.job.easyApply).length
      );
    }

    // ========== STAGE 7.5: Application Engine ==========
    if (scoredResults.length > 0) {
      console.log('========== Stage 7.5: Application Engine ==========\n');

      const appProfile = loadApplicationProfile();
      const knowledgeBase = new KnowledgeBase();
      await knowledgeBase.initialize();
      const qa = new QuestionAnswerer(appProfile, knowledgeBase);
      const appLogger = new ApplicationLogger();
      await appLogger.initialize();
      const resumeManager = new ResumeManager(appProfile);
      const appEngine = new ApplicationEngine(session, appProfile, qa, knowledgeBase, appLogger, resumeManager);

      const autoApplyJobs = scoredResults
        .filter(r => r.job.easyApply && (r.score.grade === 'A' || r.score.grade === 'B'))
        .map(r => r.job);

      const maxApplyLimit = parseInt(process.env.MAX_APPLY_LIMIT || '0', 10);
      const jobsToApply = maxApplyLimit > 0 ? autoApplyJobs.slice(0, maxApplyLimit) : autoApplyJobs;

      if (jobsToApply.length > 0) {
        console.log(`[Pipeline] ${jobsToApply.length} jobs queued for auto-apply${maxApplyLimit > 0 ? ` (limit: ${maxApplyLimit})` : ''}.\n`);
        await appEngine.processJobs(jobsToApply);

        for (const app of appLogger.getRecent(jobsToApply.length)) {
          const storedJob = storage.getJob(app.jobId);
          if (storedJob) {
            if (app.result === 'applied') {
              await storage.setJobState(app.jobId, 'applied');
            } else if (app.result === 'failed' || app.result === 'no_easy_apply' || app.result === 'external_site') {
              await storage.setJobState(app.jobId, 'rejected');
            }
          }
        }
      } else {
        console.log('[Pipeline] No auto-apply eligible jobs found.\n');
      }
    }

    // ========== STAGE 8: Save Results ==========
    console.log('========== Stage 8: Save Results ==========\n');
    await storage.save();
    console.log('[Pipeline] Results saved.\n');

    // ========== STAGE 9: Generate Report ==========
    console.log('========== Stage 9: Generate Report ==========\n');
    const dailyReport = await reportGenerator.generateDailyReport();
    console.log('[Pipeline] Report generated.\n');

    // ========== Execution Summary ==========
    const stats = stateManager.getStatistics();
    console.log('========== Execution Summary ==========\n');
    console.log(`Total jobs in storage: ${stats.total}`);
    console.log(`Raw jobs collected: ${allRawJobs.length}`);
    console.log(`Duplicates removed: ${dedupResult.removed}`);
    console.log(`Unique jobs: ${dedupResult.unique.length}`);
    console.log(`Jobs processed this session: ${jobsToProcess.length}`);
    console.log(`High-score jobs (A): ${stats.highScoreCount}`);
    console.log(`Easy Apply jobs: ${stats.easyApplyCount}`);
    if (stats.averageScore !== null) {
      console.log(`Average score: ${stats.averageScore.toFixed(2)}`);
    }
    console.log('\nGrade distribution:');
    for (const [grade, count] of Object.entries(stats.gradeDistribution).sort()) {
      console.log(`  ${grade}: ${count} jobs`);
    }
    if (stats.topJobs.length > 0) {
      console.log('\nTop 3 opportunities:');
      stats.topJobs.slice(0, 3).forEach((job, i) => {
        console.log(
          `  ${i + 1}. ${job.title} @ ${job.company} - ${job.score?.score.toFixed(1)} (${job.score?.grade})`
        );
      });
    }
    console.log('\n========================================');
    console.log('  Pipeline completed successfully!');
    console.log('========================================\n');
  } catch (err) {
    console.error('\nFatal error during pipeline execution:', err);
    process.exit(1);
  } finally {
    await session.close();
  }
}

main();

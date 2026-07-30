import { eventBus } from './EventBus.js';
import { browserState } from './BrowserState.js';
import { domSerializer } from './DOMSerializer.js';
import { formExtractor } from './FormExtractor.js';
import { jobExtractor } from './JobExtractor.js';
import { decisionTracker } from './DecisionTracker.js';
import { timeline } from './TimelineRecorder.js';
import { BotWebSocketServer, getDashboardHTML } from './WebSocketServer.js';
import { Page } from 'puppeteer-core';

let wsServer: BotWebSocketServer | null = null;

export function initMirror(page: Page, port?: number): void {
  browserState.setPage(page);
  domSerializer.setPage(page);
  formExtractor.setPage(page);
  jobExtractor.setPage(page);

  wsServer = new BotWebSocketServer(port);
  wsServer.start();

  console.log(`[Mirror] Dashboard available at http://localhost:${port || process.env.WS_PORT || 3001}`);
}

export function getDashboard(): string {
  return getDashboardHTML();
}

export function emitPipelineStart(query: string, totalJobs: number): void {
  browserState.setState('searching');
  timeline.add('pipeline_start', `Pipeline started: "${query}" (${totalJobs} jobs)`);
  decisionTracker.startJob('pipeline');
}

export function emitPipelineStage(stage: string): void {
  timeline.add('pipeline_stage', `Stage: ${stage}`);
}

export function emitJobFound(jobId: string, title: string, company: string): void {
  timeline.add('job_found', `${title} @ ${company}`);
}

export function emitJobEnriched(jobId: string, title: string): void {
  timeline.add('job_enriched', `Enriched: ${title}`);
}

export function emitScoringComplete(jobId: string, score: number, grade: string, passed: boolean, factors: string[]): void {
  browserState.setState('scoring');
  timeline.add('scoring', `Score: ${score.toFixed(1)} (${grade}) - ${passed ? 'PASSED' : 'REJECTED'}`);

  decisionTracker.startJob(jobId);
  decisionTracker.addStep('Score', score.toFixed(1), passed);
  decisionTracker.addStep('Grade', grade, passed);
  for (const factor of factors) {
    decisionTracker.addStep('Factor', factor, true);
  }
}

export function emitApplicationStart(jobId: string): void {
  browserState.setState('applying');
  timeline.add('application_start', `Application started for ${jobId}`);
}

export function emitFormStep(step: number, total: number): void {
  timeline.add('form_detected', `Form step ${step}/${total}`);
}

export function emitFieldFilled(field: string, value: string): void {
  timeline.add('field_filled', `${field}: ${value}`);
}

export function emitApplicationComplete(jobId: string, result: string): void {
  browserState.setState('idle');
  timeline.add('application_complete', `Result: ${result}`);
}

export function emitError(message: string): void {
  browserState.setState('error');
  timeline.add('error', message);
}

export { eventBus, browserState, domSerializer, formExtractor, jobExtractor, decisionTracker, timeline, BotWebSocketServer };

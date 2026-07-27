import { createServer, IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { browserState } from '../mirror/BrowserState.js';
import { timeline } from '../mirror/TimelineRecorder.js';
import { decisionTracker } from '../mirror/DecisionTracker.js';
import { getDashboardHTML } from '../mirror/WebSocketServer.js';

const PORT = parseInt(process.env.API_PORT || '3002', 10);
const DATA_DIR = process.env.DATA_DIR || 'data';
const REPORTS_DIR = process.env.REPORTS_DIR || 'reports';

function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readJsonFile(filePath: string): unknown {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || '/';

  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (url === '/' || url === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getDashboardHTML());
    return;
  }

  if (url === '/api/state') {
    const state = await browserState.getState();
    json(res, state);
    return;
  }

  if (url === '/api/jobs') {
    const jobs = readJsonFile(path.join(DATA_DIR, 'jobs.json'));
    json(res, jobs || []);
    return;
  }

  if (url.startsWith('/api/jobs/')) {
    const jobId = url.split('/api/jobs/')[1];
    const jobs = readJsonFile(path.join(DATA_DIR, 'jobs.json'));
    if (Array.isArray(jobs)) {
      const job = jobs.find((j: Record<string, unknown>) => j.id === jobId);
      if (job) { json(res, job); return; }
    }
    json(res, { error: 'Job not found' }, 404);
    return;
  }

  if (url === '/api/timeline') {
    const limit = parseInt(new URL(url, 'http://localhost').searchParams?.get('limit') || '200', 10);
    json(res, timeline.getEntries(limit));
    return;
  }

  if (url === '/api/decision') {
    json(res, decisionTracker.getResult());
    return;
  }

  if (url === '/api/stats') {
    const jobs = readJsonFile(path.join(DATA_DIR, 'jobs.json'));
    const applications = readJsonFile(path.join(DATA_DIR, 'applications.json'));
    const jobArray = Array.isArray(jobs) ? jobs : [];
    const appArray = Array.isArray(applications) ? applications : [];

    const gradeDistribution: Record<string, number> = {};
    let totalScore = 0;
    let scoredCount = 0;
    for (const job of jobArray) {
      const grade = (job as Record<string, unknown>).grade as string || 'unknown';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
      const score = (job as Record<string, unknown>).score as Record<string, number>;
      if (score?.score !== undefined) {
        totalScore += score.score;
        scoredCount++;
      }
    }

    json(res, {
      totalJobs: jobArray.length,
      totalApplications: appArray.length,
      gradeDistribution,
      averageScore: scoredCount > 0 ? (totalScore / scoredCount).toFixed(2) : null,
    });
    return;
  }

  if (url === '/api/reports') {
    if (!fs.existsSync(REPORTS_DIR)) {
      json(res, []);
      return;
    }
    const files = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.md'));
    json(res, files);
    return;
  }

  json(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  console.log(`[API] REST API server running on port ${PORT}`);
  console.log(`[API] Dashboard: http://localhost:${PORT}/`);
  console.log(`[API] Endpoints:`);
  console.log(`  GET /api/state`);
  console.log(`  GET /api/jobs`);
  console.log(`  GET /api/jobs/:id`);
  console.log(`  GET /api/timeline`);
  console.log(`  GET /api/decision`);
  console.log(`  GET /api/stats`);
  console.log(`  GET /api/reports`);
});

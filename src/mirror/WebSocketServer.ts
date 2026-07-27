import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { eventBus } from './EventBus.js';
import { browserState } from './BrowserState.js';
import { timeline } from './TimelineRecorder.js';
import { MirrorEvent } from './types.js';

export class BotWebSocketServer {
  private wss: WSServer | null = null;
  private port: number;

  constructor(port = parseInt(process.env.WS_PORT || '3001', 10)) {
    this.port = port;
  }

  start(): void {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || '/';

      if (url === '/' || url === '/dashboard') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getDashboardHTML());
        return;
      }

      if (url === '/api/state') {
        browserState.getState().then((state) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(state));
        });
        return;
      }

      if (url === '/api/timeline') {
        const entries = timeline.getEntries(200);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(entries));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    this.wss = new WSServer({ server });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const ip = req.socket.remoteAddress || 'unknown';
      console.log(`[WS] Client connected from ${ip}`);

      this._sendFullState(ws);

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          this._handleMessage(ws, msg);
        } catch {}
      });

      ws.on('close', () => {
        console.log('[WS] Client disconnected');
      });
    });

    server.listen(this.port, () => {
      console.log(`[WS] Dashboard + WebSocket running on http://localhost:${this.port}`);
    });

    this._setupEventForwarding();
  }

  broadcast(event: string, data: unknown): void {
    if (!this.wss) return;
    const msg = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  stop(): void {
    this.wss?.close();
    this.wss = null;
  }

  private _sendFullState(ws: WebSocket): void {
    browserState.getState().then((state) => {
      ws.send(JSON.stringify({ event: 'browser:state', data: state, timestamp: new Date().toISOString() }));
    });

    const entries = timeline.getEntries(100);
    ws.send(JSON.stringify({ event: 'timeline:full', data: entries, timestamp: new Date().toISOString() }));
  }

  private _handleMessage(_ws: WebSocket, msg: { action?: string }): void {
    if (msg.action === 'getState') {
      browserState.getState().then((state) => {
        _ws.send(JSON.stringify({ event: 'browser:state', data: state, timestamp: new Date().toISOString() }));
      });
    } else if (msg.action === 'getTimeline') {
      const entries = timeline.getEntries(200);
      _ws.send(JSON.stringify({ event: 'timeline:full', data: entries, timestamp: new Date().toISOString() }));
    }
  }

  private _setupEventForwarding(): void {
    const events = [
      'browser:state', 'job:view', 'form:detected', 'dom:tree',
      'decision:tree', 'timeline:entry', 'pipeline:start', 'pipeline:stage',
      'job:found', 'job:enriched', 'scoring:complete',
      'application:start', 'application:complete',
    ];

    for (const event of events) {
      eventBus.onEvent(event, (mirrorEvent: MirrorEvent) => {
        this.broadcast(event, mirrorEvent.data);
      });
    }
  }
}

export function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LinkedIn Job Bot - Mirror Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#c9d1d9;--text-dim:#8b949e;--accent:#58a6ff;--green:#3fb950;--red:#f85149;--yellow:#d29922;--orange:#db6d28;--purple:#bc8cff}
body{background:var(--bg);color:var(--text);font-family:'SF Mono',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;line-height:1.5}
.dashboard{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto 1fr;gap:1px;background:var(--border);height:100vh}
.panel{background:var(--surface);padding:12px;overflow-y:auto}
.panel-header{color:var(--accent);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.state-value{display:flex;justify-content:space-between;padding:3px 0}
.state-value .label{color:var(--text-dim)}
.state-value .value{color:var(--text);font-weight:500}
.state-value .value.running{color:var(--green)}
.state-value .value.error{color:var(--red)}
.state-value .value.idle{color:var(--yellow)}
.state-value .value.searching{color:var(--accent)}
.state-value .value.applying{color:var(--purple)}
.job-card{background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px}
.job-title{color:var(--accent);font-size:14px;font-weight:600;margin-bottom:4px}
.job-company{color:var(--text-dim);margin-bottom:6px}
.job-score{display:inline-block;padding:2px 8px;border-radius:10px;font-weight:600;font-size:12px;margin-right:4px}
.job-score.A{background:rgba(63,185,80,0.2);color:var(--green)}
.job-score.B{background:rgba(88,166,255,0.2);color:var(--accent)}
.job-score.C{background:rgba(210,153,34,0.2);color:var(--yellow)}
.job-score.D,.job-score.F{background:rgba(248,81,73,0.2);color:var(--red)}
.skills{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.skill{padding:2px 6px;border-radius:4px;font-size:11px}
.skill.matched{background:rgba(63,185,80,0.15);color:var(--green);border:1px solid rgba(63,185,80,0.3)}
.skill.unmatched{background:rgba(139,148,158,0.1);color:var(--text-dim);border:1px solid var(--border)}
.form-field{display:flex;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)}
.form-field:last-child{border-bottom:none}
.form-field .type{color:var(--purple);width:60px;font-size:11px}
.form-field .name{color:var(--text);flex:1}
.form-field .value{color:var(--text-dim);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.form-field .filled{color:var(--green);margin-left:6px}
.form-field .empty{color:var(--red);margin-left:6px}
.decision-step{display:flex;align-items:center;padding:4px 0}
.decision-step .arrow{color:var(--text-dim);margin:0 8px}
.decision-step .label{color:var(--text-dim);width:140px}
.decision-step .val{color:var(--text);font-weight:500}
.decision-step .status{margin-left:auto;font-size:11px}
.decision-step .status.pass{color:var(--green)}
.decision-step .status.fail{color:var(--red)}
.timeline-entry{display:flex;gap:8px;padding:3px 0;font-size:12px}
.timeline-entry .time{color:var(--text-dim);white-space:nowrap;min-width:70px}
.timeline-entry .type{color:var(--accent);min-width:100px}
.timeline-entry .msg{color:var(--text)}
.dom-tree{font-size:11px}
.dom-node{padding-left:16px;border-left:1px solid var(--border);margin-left:4px}
.dom-node.interactive{color:var(--accent)}
.dom-tag{color:var(--purple)}
.dom-text{color:var(--text-dim);font-style:italic;margin-left:4px}
.btn{padding:4px 12px;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:4px;cursor:pointer;font-size:11px;font-family:inherit}
.btn:hover{border-color:var(--accent);color:var(--accent)}
.controls{position:fixed;top:8px;right:8px;display:flex;gap:4px;z-index:100}
.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.status-dot.running{background:var(--green);animation:pulse 2s infinite}
.status-dot.idle{background:var(--yellow)}
.status-dot.error{background:var(--red)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.empty-state{color:var(--text-dim);text-align:center;padding:20px;font-style:italic}
</style>
</head>
<body>
<div class="controls">
  <button class="btn" onclick="sendAction('getState')">Refresh State</button>
  <button class="btn" onclick="sendAction('getTimeline')">Refresh Timeline</button>
</div>
<div class="dashboard">
  <!-- Browser State -->
  <div class="panel" id="state-panel">
    <div class="panel-header"><span class="status-dot idle" id="status-dot"></span> Browser State</div>
    <div id="state-content"><div class="empty-state">Waiting for connection...</div></div>
  </div>

  <!-- Job View -->
  <div class="panel" id="job-panel">
    <div class="panel-header">Job View</div>
    <div id="job-content"><div class="empty-state">No job selected</div></div>
  </div>

  <!-- Form View -->
  <div class="panel" id="form-panel">
    <div class="panel-header">Form View</div>
    <div id="form-content"><div class="empty-state">No form detected</div></div>
  </div>

  <!-- Decision Tree -->
  <div class="panel" id="decision-panel">
    <div class="panel-header">Decision Tree</div>
    <div id="decision-content"><div class="empty-state">No decisions yet</div></div>
  </div>

  <!-- Timeline (spans full width) -->
  <div class="panel" style="grid-column:1/-1" id="timeline-panel">
    <div class="panel-header">Timeline</div>
    <div id="timeline-content"><div class="empty-state">No events yet</div></div>
  </div>

  <!-- DOM Tree (spans full width) -->
  <div class="panel" style="grid-column:1/-1" id="dom-panel">
    <div class="panel-header">DOM Tree</div>
    <div id="dom-content"><div class="empty-state">Waiting for DOM data...</div></div>
  </div>
</div>

<script>
let ws;
const MAX_TIMELINE = 200;
let timelineEntries = [];

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(proto + '://' + location.host);
  ws.onopen = () => { document.getElementById('status-dot').className = 'status-dot running'; };
  ws.onclose = () => { document.getElementById('status-dot').className = 'status-dot error'; setTimeout(connect, 3000); };
  ws.onmessage = (e) => { try { handleMessage(JSON.parse(e.data)); } catch {} };
}

function handleMessage(msg) {
  switch(msg.event) {
    case 'browser:state': renderState(msg.data); break;
    case 'job:view': renderJob(msg.data); break;
    case 'form:detected': renderForm(msg.data); break;
    case 'decision:tree': renderDecision(msg.data); break;
    case 'timeline:entry': addTimelineEntry(msg.data); break;
    case 'timeline:full': renderTimelineFull(msg.data); break;
    case 'dom:tree': renderDOM(msg.data); break;
  }
}

function renderState(s) {
  const dot = document.getElementById('status-dot');
  dot.className = 'status-dot ' + s.state;
  document.getElementById('state-content').innerHTML =
    '<div class="state-value"><span class="label">State</span><span class="value ' + s.state + '">' + s.state.toUpperCase() + '</span></div>' +
    '<div class="state-value"><span class="label">URL</span><span class="value">' + truncate(s.url, 50) + '</span></div>' +
    '<div class="state-value"><span class="label">Title</span><span class="value">' + truncate(s.title, 40) + '</span></div>' +
    '<div class="state-value"><span class="label">Memory</span><span class="value">' + s.memoryMB + ' MB</span></div>' +
    '<div class="state-value"><span class="label">Uptime</span><span class="value">' + formatTime(s.uptime) + '</span></div>' +
    '<div class="state-value"><span class="label">Session</span><span class="value">' + s.sessionStatus + '</span></div>' +
    '<div class="state-value"><span class="label">Search</span><span class="value">' + (s.currentQuery || '-') + '</span></div>' +
    '<div class="state-value"><span class="label">Page</span><span class="value">' + s.currentPage + ' / ' + s.totalPages + '</span></div>' +
    '<div class="state-value"><span class="label">Job</span><span class="value">' + s.currentJob + ' / ' + s.totalJobs + '</span></div>';
}

function renderJob(j) {
  const skillsHtml = j.skills.map(s =>
    '<span class="skill ' + (s.matched ? 'matched' : 'unmatched') + '">' +
    (s.matched ? '&#10003; ' : '') + s.name + '</span>'
  ).join('');
  document.getElementById('job-content').innerHTML =
    '<div class="job-card">' +
    '<div class="job-title">' + esc(j.title) + '</div>' +
    '<div class="job-company">' + esc(j.company) + ' &middot; ' + esc(j.location) + '</div>' +
    (j.salary ? '<div style="color:var(--green);margin-bottom:4px">' + esc(j.salary) + '</div>' : '') +
    '<span class="job-score ' + j.grade + '">' + j.score.toFixed(1) + ' ' + j.grade + '</span>' +
    ' <span style="color:var(--text-dim);font-size:11px;margin-left:6px">Confidence ' + j.confidence + '%</span>' +
    (j.easyApply ? ' <span style="color:var(--green);font-size:11px;margin-left:6px">Easy Apply</span>' : '') +
    '<div class="skills">' + skillsHtml + '</div>' +
    '</div>';
}

function renderForm(f) {
  let html = '<div class="job-card">' +
    '<div style="margin-bottom:6px"><span class="job-score ' + (f.isEasyApply ? 'A' : 'C') + '">' +
    (f.isEasyApply ? 'Easy Apply' : 'External') + '</span>' +
    ' <span style="color:var(--text-dim);font-size:11px;margin-left:6px">Step ' + f.currentStep + ' / ' + f.totalSteps + '</span></div>';
  if (f.resumeFile) {
    html += '<div class="form-field"><span class="type">file</span><span class="name">Resume</span><span class="value">' + esc(f.resumeFile) + '</span><span class="filled">&#10003;</span></div>';
  }
  for (const field of f.fields) {
    html += '<div class="form-field">' +
      '<span class="type">' + field.type + '</span>' +
      '<span class="name">' + esc(field.label || field.name) + '</span>' +
      '<span class="value">' + esc(field.value || '(empty)') + '</span>' +
      '<span class="' + (field.filled ? 'filled' : 'empty') + '">' + (field.filled ? '&#10003;' : '&#10007;') + '</span>' +
      '</div>';
  }
  if (f.buttons.length > 0) {
    html += '<div style="margin-top:8px;color:var(--text-dim);font-size:11px">Buttons: ' + f.buttons.join(' | ') + '</div>';
  }
  html += '</div>';
  document.getElementById('form-content').innerHTML = html;
}

function renderDecision(d) {
  let html = '';
  for (let i = 0; i < d.steps.length; i++) {
    const s = d.steps[i];
    html += '<div class="decision-step">' +
      (i > 0 ? '<span class="arrow">&darr;</span>' : '') +
      '<span class="label">' + esc(s.label) + '</span>' +
      '<span class="val">' + esc(String(s.value)) + '</span>' +
      '<span class="status ' + (s.passed ? 'pass' : 'fail') + '">' + (s.passed ? 'YES' : 'NO') + '</span>' +
      '</div>';
  }
  document.getElementById('decision-content').innerHTML = html || '<div class="empty-state">No decisions yet</div>';
}

function addTimelineEntry(e) {
  timelineEntries.push(e);
  if (timelineEntries.length > MAX_TIMELINE) timelineEntries.shift();
  renderTimeline();
}

function renderTimelineFull(entries) {
  timelineEntries = entries;
  renderTimeline();
}

function renderTimeline() {
  let html = '';
  for (let i = timelineEntries.length - 1; i >= 0; i--) {
    const e = timelineEntries[i];
    const t = new Date(e.timestamp);
    const time = t.toTimeString().substring(0, 8);
    html += '<div class="timeline-entry">' +
      '<span class="time">' + time + '</span>' +
      '<span class="type">' + esc(e.type) + '</span>' +
      '<span class="msg">' + esc(e.message) + '</span>' +
      '</div>';
  }
  document.getElementById('timeline-content').innerHTML = html || '<div class="empty-state">No events yet</div>';
}

function renderDOM(tree) {
  document.getElementById('dom-content').innerHTML = '<div class="dom-tree">' + renderDOMNode(tree, 0) + '</div>';
}

function renderDOMNode(node, depth) {
  if (!node) return '';
  let html = '<div class="dom-node' + (node.interactive ? ' interactive' : '') + '">' +
    '<span class="dom-tag">&lt;' + node.tag + '&gt;</span>' +
    (node.text ? '<span class="dom-text"> ' + esc(node.text.substring(0, 50)) + '</span>' : '');
  for (const child of (node.children || [])) {
    html += renderDOMNode(child, depth + 1);
  }
  html += '</div>';
  return html;
}

function sendAction(action) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ action }));
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function truncate(s, n) { return s && s.length > n ? s.substring(0, n) + '...' : s || ''; }
function formatTime(s) { const m = Math.floor(s / 60); const sec = s % 60; return m + 'm ' + sec + 's'; }

connect();
</script>
</body>
</html>`;
}

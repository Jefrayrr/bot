const API_BASE = '';
const WS_PORT = 3001;
let ws = null;
let timelineEntries = [];
const MAX_TIMELINE = 200;

function connectWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const host = location.hostname + ':' + WS_PORT;
    ws = new WebSocket(proto + '://' + host);

    ws.onopen = () => console.log('[WS] Connected');
    ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 3s...');
        setTimeout(connectWebSocket, 3000);
    };
    ws.onmessage = (e) => {
        try {
            const msg = JSON.parse(e.data);
            handleMessage(msg);
        } catch {}
    };
}

function handleMessage(msg) {
    switch (msg.event) {
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
    document.getElementById('state-content').innerHTML =
        '<div class="state-value"><span class="label">State</span><span class="value ' + s.state + '">' + s.state.toUpperCase() + '</span></div>' +
        '<div class="state-value"><span class="label">URL</span><span class="value">' + truncate(s.url, 50) + '</span></div>' +
        '<div class="state-value"><span class="label">Title</span><span class="value">' + truncate(s.title, 40) + '</span></div>' +
        '<div class="state-value"><span class="label">Memory</span><span class="value">' + s.memoryMB + ' MB</span></div>' +
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
        '<span style="color:var(--text-dim);font-size:11px;margin-left:6px">Confidence ' + j.confidence + '%</span>' +
        (j.easyApply ? '<span style="color:var(--green);font-size:11px;margin-left:6px">Easy Apply</span>' : '') +
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

    if (f.buttons && f.buttons.length > 0) {
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
    document.getElementById('dom-content').innerHTML = '<div class="dom-tree">' + renderDOMNode(tree) + '</div>';
}

function renderDOMNode(node) {
    if (!node) return '';
    let html = '<div class="dom-node' + (node.interactive ? ' interactive' : '') + '">' +
        '<span class="dom-tag">&lt;' + node.tag + '&gt;</span>' +
        (node.text ? '<span class="dom-text"> ' + esc(node.text.substring(0, 50)) + '</span>' : '');
    for (const child of (node.children || [])) {
        html += renderDOMNode(child);
    }
    html += '</div>';
    return html;
}

function refreshAll() {
    fetch(API_BASE + '/api/state').then(r => r.json()).then(renderState).catch(() => {});
    fetch(API_BASE + '/api/jobs').then(r => r.json()).then(jobs => {
        if (Array.isArray(jobs) && jobs.length > 0) {
            const latest = jobs[jobs.length - 1];
            if (latest) renderJob(latest);
        }
    }).catch(() => {});
    fetch(API_BASE + '/api/timeline').then(r => r.json()).then(renderTimelineFull).catch(() => {});
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function truncate(s, n) { return s && s.length > n ? s.substring(0, n) + '...' : s || ''; }

document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    refreshAll();
});

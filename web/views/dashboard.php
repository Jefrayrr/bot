<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LinkedIn Job Bot - Mirror Dashboard</title>
    <link rel="stylesheet" href="/css/dashboard.css">
</head>
<body>
    <div class="dashboard">
        <div class="panel" id="state-panel">
            <div class="panel-header" id="state-header">Browser State</div>
            <div id="state-content">
                <?php if ($state): ?>
                    <div class="state-value"><span class="label">State</span><span class="value <?= $state['state'] ?? 'idle' ?>"><?= strtoupper($state['state'] ?? 'IDLE') ?></span></div>
                    <div class="state-value"><span class="label">URL</span><span class="value"><?= htmlspecialchars($state['url'] ?? 'N/A') ?></span></div>
                    <div class="state-value"><span class="label">Title</span><span class="value"><?= htmlspecialchars($state['title'] ?? 'N/A') ?></span></div>
                    <div class="state-value"><span class="label">Memory</span><span class="value"><?= $state['memoryMB'] ?? 0 ?> MB</span></div>
                    <div class="state-value"><span class="label">Session</span><span class="value"><?= htmlspecialchars($state['sessionStatus'] ?? 'Unknown') ?></span></div>
                    <div class="state-value"><span class="label">Search</span><span class="value"><?= htmlspecialchars($state['currentQuery'] ?? '-') ?></span></div>
                    <div class="state-value"><span class="label">Page</span><span class="value"><?= $state['currentPage'] ?? 0 ?> / <?= $state['totalPages'] ?? 0 ?></span></div>
                    <div class="state-value"><span class="label">Job</span><span class="value"><?= $state['currentJob'] ?? 0 ?> / <?= $state['totalJobs'] ?? 0 ?></span></div>
                <?php else: ?>
                    <div class="empty-state">Waiting for connection...</div>
                <?php endif; ?>
            </div>
        </div>

        <div class="panel" id="stats-panel">
            <div class="panel-header">Statistics</div>
            <div id="stats-content">
                <?php if ($stats): ?>
                    <div class="state-value"><span class="label">Total Jobs</span><span class="value"><?= $stats['totalJobs'] ?? 0 ?></span></div>
                    <div class="state-value"><span class="label">Applications</span><span class="value"><?= $stats['totalApplications'] ?? 0 ?></span></div>
                    <div class="state-value"><span class="label">Avg Score</span><span class="value"><?= $stats['averageScore'] ?? 'N/A' ?></span></div>
                    <?php if (!empty($stats['gradeDistribution'])): ?>
                        <div style="margin-top:8px">
                            <?php foreach ($stats['gradeDistribution'] as $grade => $count): ?>
                                <span class="job-score <?= $grade ?>"><?= $grade ?>: <?= $count ?></span>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                <?php else: ?>
                    <div class="empty-state">No statistics available</div>
                <?php endif; ?>
            </div>
        </div>

        <div class="panel" id="job-panel">
            <div class="panel-header">Job View</div>
            <div id="job-content"><div class="empty-state">No job selected</div></div>
        </div>

        <div class="panel" id="form-panel">
            <div class="panel-header">Form View</div>
            <div id="form-content"><div class="empty-state">No form detected</div></div>
        </div>

        <div class="panel" id="decision-panel">
            <div class="panel-header">Decision Tree</div>
            <div id="decision-content"><div class="empty-state">No decisions yet</div></div>
        </div>

        <div class="panel" id="timeline-panel">
            <div class="panel-header">Timeline</div>
            <div id="timeline-content"><div class="empty-state">No events yet</div></div>
        </div>

        <div class="panel" id="dom-panel">
            <div class="panel-header">DOM Tree</div>
            <div id="dom-content"><div class="empty-state">Waiting for DOM data...</div></div>
        </div>
    </div>

    <div class="controls">
        <button class="btn" onclick="refreshAll()">Refresh All</button>
    </div>

    <script src="/js/app.js"></script>
</body>
</html>

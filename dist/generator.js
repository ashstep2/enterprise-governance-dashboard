function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function formatWithCommas(n) {
    return n.toLocaleString("en-US");
}
function formatCompact(n) {
    if (n >= 1_000_000)
        return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000)
        return formatWithCommas(n);
    return n.toString();
}
function statusBarColor(status) {
    const colors = {
        completed: "bg-emerald-500",
        success: "bg-emerald-500",
        in_progress: "bg-amber-400",
        running: "bg-amber-400",
        pending: "bg-slate-300",
        failed: "bg-red-500",
        error: "bg-red-500",
        cancelled: "bg-slate-400",
    };
    return colors[status] || "bg-slate-300";
}
function statusBadge(status) {
    const styles = {
        completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
        success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
        in_progress: "bg-amber-50 text-amber-700 ring-amber-600/20",
        running: "bg-amber-50 text-amber-700 ring-amber-600/20",
        pending: "bg-slate-50 text-slate-600 ring-slate-500/20",
        failed: "bg-red-50 text-red-700 ring-red-600/20",
        error: "bg-red-50 text-red-700 ring-red-600/20",
        cancelled: "bg-slate-50 text-slate-500 ring-slate-400/20",
        unknown: "bg-slate-50 text-slate-500 ring-slate-400/20",
    };
    const style = styles[status] || styles.unknown;
    return `<span class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style}">${escapeHtml(status)}</span>`;
}
function healthIndicator(data) {
    const completed = data.statusCounts["completed"] || 0;
    const failed = (data.statusCounts["failed"] || 0) + (data.statusCounts["error"] || 0);
    const total = data.totalEntries || 1;
    const completionRate = completed / total;
    const failRate = failed / total;
    if (failRate > 0.2)
        return { label: "Critical", color: "text-red-600", dotColor: "bg-red-500" };
    if (failRate > 0.1 || completionRate < 0.5)
        return { label: "Warning", color: "text-amber-600", dotColor: "bg-amber-400" };
    return { label: "Healthy", color: "text-emerald-600", dotColor: "bg-emerald-500" };
}
function generateStatusBars(statusCounts, total) {
    if (total === 0) {
        return `<div class="flex items-center justify-center h-16 text-xs text-slate-400">No task data</div>`;
    }
    return Object.entries(statusCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([status, count]) => {
        const pct = ((count / total) * 100).toFixed(1);
        return `
        <div class="mb-2.5">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs font-medium text-slate-600 capitalize">${escapeHtml(status.replace(/_/g, " "))}</span>
            <span class="text-xs tabular-nums text-slate-400">${formatWithCommas(count)} (${pct}%)</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-1.5">
            <div class="h-1.5 rounded-full ${statusBarColor(status)}" style="width: ${pct}%"></div>
          </div>
        </div>`;
    })
        .join("\n");
}
function generatePatternsList(patterns) {
    if (patterns.length === 0) {
        return `<div class="flex items-center justify-center h-16 text-xs text-slate-400">No patterns</div>`;
    }
    return `<div class="space-y-1.5">
    ${patterns
        .slice(0, 6)
        .map((p) => `
      <div class="flex justify-between items-center gap-2">
        <span class="text-xs text-slate-600 truncate">${escapeHtml(p.key)}</span>
        <span class="shrink-0 text-[10px] font-medium bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full">${p.count}x</span>
      </div>`)
        .join("\n")}
  </div>`;
}
function generateRecentTable(entries) {
    if (entries.length === 0) {
        return `<div class="flex items-center justify-center h-16 text-xs text-slate-400">No recent tasks</div>`;
    }
    const shown = entries.slice(0, 8);
    return `
    <div class="overflow-hidden">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-slate-100">
            <th class="text-left py-1.5 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-20">Status</th>
            <th class="text-left py-1.5 px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Task</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          ${shown
        .map((e) => `
            <tr class="hover:bg-slate-50/50">
              <td class="py-1.5 px-2">${statusBadge(e.status || "unknown")}</td>
              <td class="py-1.5 px-2 text-slate-600 truncate max-w-[300px]">${escapeHtml((e.content || e.message || "-").slice(0, 60))}</td>
            </tr>`)
        .join("\n")}
        </tbody>
      </table>
      ${entries.length > 8 ? `<p class="text-[10px] text-slate-400 mt-1.5 px-2">+${entries.length - 8} more entries</p>` : ""}
    </div>`;
}
function generateModelBreakdown(modelCounts) {
    const entries = Object.entries(modelCounts).sort(([, a], [, b]) => b - a);
    if (entries.length === 0) {
        return `<div class="flex items-center justify-center h-16 text-xs text-slate-400">No model data</div>`;
    }
    return `<div class="space-y-2">
    ${entries
        .map(([model, count]) => `
      <div class="flex justify-between items-center">
        <span class="text-xs text-slate-600 font-mono">${escapeHtml(model)}</span>
        <span class="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">${formatWithCommas(count)}</span>
      </div>`)
        .join("\n")}
  </div>`;
}
export function generateReport(data) {
    const health = healthIndicator(data);
    const completionRate = data.totalEntries > 0
        ? ((data.statusCounts["completed"] || 0) / data.totalEntries * 100).toFixed(1)
        : "0.0";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enterprise Governance Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
          colors: {
            brand: {
              50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
              400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
              800: '#3730a3', 900: '#312e81',
            }
          }
        }
      }
    }
  </script>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; }
    .pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    .step-badge { cursor: pointer; transition: all 0.2s; }
    .step-badge:hover { transform: scale(1.15); }
    .step-insight { display: none; animation: slideIn 0.25s ease-out; }
    .step-insight.active { display: block; }
    .step-section { transition: box-shadow 0.3s, border-color 0.3s; }
    .step-section.highlighted { box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4); border-color: rgba(99, 102, 241, 0.5); }
    @keyframes slideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
  </style>
  <script>
    let activeStep = null;
    function toggleStep(n) {
      event.stopPropagation();
      const wasActive = activeStep === n;
      // Close all
      document.querySelectorAll('.step-insight').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.step-section').forEach(el => el.classList.remove('highlighted'));
      document.querySelectorAll('.step-badge').forEach(el => { el.classList.remove('ring-2', 'ring-offset-1', 'bg-brand-600'); el.classList.add('bg-brand-500'); });
      activeStep = null;
      // Toggle open if different
      if (!wasActive) {
        const insight = document.getElementById('insight-' + n);
        const section = document.getElementById('section-' + n);
        const badge = document.getElementById('badge-' + n);
        if (insight) insight.classList.add('active');
        if (section) section.classList.add('highlighted');
        if (badge) { badge.classList.add('ring-2', 'ring-offset-1', 'bg-brand-600'); badge.classList.remove('bg-brand-500'); }
        activeStep = n;
        // Scroll insight into view
        if (insight) insight.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  </script>
</head>
<body class="bg-[#f8f7f5] min-h-screen flex flex-col antialiased">

  <!-- Header -->
  <header class="bg-white/90 backdrop-blur-sm border-b border-slate-200/60 shrink-0">
    <div class="max-w-[1400px] mx-auto px-5 py-2.5 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="white" opacity="0.9"/></svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-sm font-semibold text-slate-900">Enterprise Governance</h1>
            <div class="flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-slow"></div>
              <span class="text-[10px] font-medium text-emerald-700">Live</span>
            </div>
          </div>
          <p class="text-[10px] text-slate-400">AI Coding Analytics &mdash; Click numbered badges to explore</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div id="section-1" class="step-section flex items-center gap-2 mr-2 px-2 py-1 rounded-lg border border-transparent cursor-pointer" onclick="toggleStep(1)">
          <div id="badge-1" class="step-badge w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">1</div>
          <div class="w-2 h-2 rounded-full ${health.dotColor} ${health.label === "Healthy" ? "pulse-slow" : ""}"></div>
          <span class="text-xs font-medium ${health.color}">${health.label}</span>
          <span class="text-slate-200">|</span>
          <span class="text-xs text-slate-400">${completionRate}%</span>
        </div>
        <span class="text-[10px] text-slate-400">Jan 23, 2026</span>
        <button onclick="window.print()" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Export
        </button>
      </div>
    </div>
    <!-- Step 1 Insight -->
    <div id="insight-1" class="step-insight max-w-[1400px] mx-auto px-5 pb-3">
      <div class="bg-brand-50 border border-brand-100 rounded-lg px-4 py-3">
        <p class="text-xs font-semibold text-brand-800 mb-1">System Health &mdash; Auto-Scored Risk Indicator</p>
        <p class="text-xs text-brand-700 leading-relaxed">Computed from task completion vs failure rates. >20% failures = Critical. >10% failures = Warning. This is the first thing an <strong>enterprise admin</strong> checks: "Is my fleet of AI agents healthy, or are they failing silently?"</p>
        <p class="text-[10px] text-brand-500 mt-2">Enterprise need: Proactive alerting before issues become incidents. No manual monitoring required.</p>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1">
    <div class="max-w-[1400px] mx-auto px-5 py-4 flex flex-col gap-3">

      <!-- Top Row: KPIs -->
      <div id="section-2" class="step-section grid grid-cols-4 gap-3 shrink-0 rounded-xl border border-transparent p-0.5 cursor-pointer" onclick="toggleStep(2)">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200/60 p-3.5 relative">
          <div id="badge-2" class="step-badge absolute -top-2 -left-2 w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">2</div>
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sessions</p>
          <p class="text-2xl font-bold text-slate-900 tabular-nums mt-1">${formatWithCommas(data.totalFiles)}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">.json files scanned</p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200/60 p-3.5">
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tasks</p>
          <p class="text-2xl font-bold text-slate-900 tabular-nums mt-1">${formatWithCommas(data.totalEntries)}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">total entries parsed</p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200/60 p-3.5">
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tokens</p>
          <p class="text-2xl font-bold text-slate-900 tabular-nums mt-1">${formatCompact(data.totalTokensInput + data.totalTokensOutput)}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">${formatCompact(data.totalTokensInput)} in / ${formatCompact(data.totalTokensOutput)} out</p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200/60 p-3.5">
          <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Est. Cost</p>
          <p class="text-2xl font-bold text-brand-600 tabular-nums mt-1">$${data.estimatedCost.toFixed(2)}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">$3/M in + $15/M out</p>
        </div>
      </div>
      <!-- Step 2 Insight -->
      <div id="insight-2" class="step-insight">
        <div class="bg-brand-50 border border-brand-100 rounded-lg px-4 py-3">
          <p class="text-xs font-semibold text-brand-800 mb-1">Usage Volume: How Much Is Your Org Using AI?</p>
          <p class="text-xs text-brand-700 leading-relaxed"><strong>Sessions</strong> = number of AI coding sessions that tracked tasks. <strong>Tasks</strong> = total work items across all sessions. <strong>Tokens</strong> = consumption (lights up when task-level attribution ships). <strong>Cost</strong> = estimated spend at API rates.</p>
          <p class="text-[10px] text-brand-500 mt-2">Enterprise need: Finance teams need cost attribution per team/project. This is the raw signal for chargebacks and budget forecasting.</p>
        </div>
      </div>

      <!-- Middle Row: Charts + Table -->
      <div class="grid grid-cols-12 gap-3" style="min-height: 300px;">

        <!-- Left Column: Status + Patterns -->
        <div class="col-span-3 flex flex-col gap-3">
          <div id="section-3" class="step-section bg-white rounded-xl shadow-sm border border-slate-200/60 p-4 flex-1 cursor-pointer" onclick="toggleStep(3)">
            <div class="flex items-center gap-2 mb-3">
              <div id="badge-3" class="step-badge w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">3</div>
              <h2 class="text-xs font-semibold text-slate-700">Status Distribution</h2>
            </div>
            ${generateStatusBars(data.statusCounts, data.totalEntries)}
          </div>
          <div id="section-4" class="step-section bg-white rounded-xl shadow-sm border border-slate-200/60 p-4 flex-1 cursor-pointer" onclick="toggleStep(4)">
            <div class="flex items-center gap-2 mb-3">
              <div id="badge-4" class="step-badge w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">4</div>
              <h2 class="text-xs font-semibold text-slate-700">Task Patterns</h2>
            </div>
            ${generatePatternsList(data.patterns)}
          </div>
        </div>

        <!-- Center: Recent Tasks -->
        <div id="section-5" class="step-section col-span-6 bg-white rounded-xl shadow-sm border border-slate-200/60 p-4 flex flex-col min-h-0 cursor-pointer" onclick="toggleStep(5)">
          <div class="flex items-center gap-2 mb-2">
            <div id="badge-5" class="step-badge w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">5</div>
            <h2 class="text-xs font-semibold text-slate-700">Recent Activity</h2>
            <span class="text-[10px] text-slate-400 ml-auto">${formatWithCommas(data.totalEntries)} total</span>
          </div>
          <div class="flex-1 overflow-auto">
            ${generateRecentTable(data.recentTasks)}
          </div>
        </div>

        <!-- Right Column: Models + Sessions -->
        <div class="col-span-3 flex flex-col gap-3">
          <div id="section-6" class="step-section bg-white rounded-xl shadow-sm border border-slate-200/60 p-4 flex-1 cursor-pointer" onclick="toggleStep(6)">
            <div class="flex items-center gap-2 mb-3">
              <div id="badge-6" class="step-badge w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">6</div>
              <h2 class="text-xs font-semibold text-slate-700">Model Usage</h2>
            </div>
            ${generateModelBreakdown(data.modelCounts)}
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-slate-200/60 p-4 flex-1">
            <h2 class="text-xs font-semibold text-slate-700 mb-1">Session Files</h2>
            <p class="text-lg font-bold text-slate-800 tabular-nums">${formatWithCommas(data.taskFiles.length)}</p>
            <p class="text-[10px] text-slate-400 mb-2">~/.claude/todos/*.json</p>
            <div class="flex flex-wrap gap-1">
              ${data.taskFiles.slice(0, 8).map(() => `<div class="w-2 h-2 rounded-sm bg-brand-200"></div>`).join("")}
              ${data.taskFiles.length > 8 ? `<span class="text-[10px] text-slate-400 ml-1">+${data.taskFiles.length - 8}</span>` : ""}
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3 Insight -->
      <div id="insight-3" class="step-insight">
        <div class="bg-brand-50 border border-brand-100 rounded-lg px-4 py-3">
          <p class="text-xs font-semibold text-brand-800 mb-1">Completion Rates:  Are Tasks Finishing or Stalling?</p>
          <p class="text-xs text-brand-700 leading-relaxed">Groups every task by its <code class="bg-brand-100 px-1 rounded">status</code> field (completed, in_progress, pending, failed). Progress bars show the distribution at a glance.</p>
          <p class="text-[10px] text-brand-500 mt-2">Enterprise need: Engineering managers spot bottlenecks immediately. If "in_progress" is growing but "completed" is flat, it means that agents are stuck. Intervention signal.</p>
        </div>
      </div>

      <!-- Step 4 Insight -->
      <div id="insight-4" class="step-insight">
        <div class="bg-brand-50 border border-brand-100 rounded-lg px-4 py-3">
          <p class="text-xs font-semibold text-brand-800 mb-1">Pattern Detection: What Is AI Actually Doing?</p>
          <p class="text-xs text-brand-700 leading-relaxed">Extracts the first 3 words of each task's <code class="bg-brand-100 px-1 rounded">content</code> field and clusters by frequency. Reveals what your team is repeatedly asking AI to do.</p>
          <p class="text-[10px] text-brand-500 mt-2">Enterprise need: If 40% of tasks start with "Fix the build", you have a CI problem, not a productivity problem. Surface the signal behind the AI usage.</p>
        </div>
      </div>

      <!-- Step 5 Insight -->
      <div id="insight-5" class="step-insight">
        <div class="bg-brand-50 border border-brand-100 rounded-lg px-4 py-3">
          <p class="text-xs font-semibold text-brand-800 mb-1">Audit Trail: The Compliance Evidence</p>
          <p class="text-xs text-brand-700 leading-relaxed">Every task the AI worked on, its status, and what it was doing. Reads <code class="bg-brand-100 px-1 rounded">content</code> (the instruction) and <code class="bg-brand-100 px-1 rounded">status</code> (the outcome) from each session's JSON file.</p>
          <p class="text-[10px] text-brand-500 mt-2">Enterprise need: SOC2 and ISO27001 require evidence of AI governance. This table is the evidence that shows what the AI was instructed to do and if it succeeded/failed.</p>
        </div>
      </div>

      <!-- Step 6 Insight -->
      <div id="insight-6" class="step-insight">
        <div class="bg-brand-50 border border-brand-100 rounded-lg px-4 py-3">
          <p class="text-xs font-semibold text-brand-800 mb-1">Model Governance: Which Models, At What Cost?</p>
          <p class="text-xs text-brand-700 leading-relaxed">Reads the <code class="bg-brand-100 px-1 rounded">model</code> field from task entries. Tracks whether teams are using Haiku (cheap/fast), Sonnet (balanced), or Opus (expensive/powerful).</p>
          <p class="text-[10px] text-brand-500 mt-2">Enterprise need: Policy enforcement. Cost control without blocking productivity.</p>
        </div>
      </div>

      <!-- Bottom: Product Thesis -->
      <div id="section-7" class="step-section shrink-0 bg-white rounded-xl shadow-sm border border-slate-200/60 px-4 py-3 cursor-pointer" onclick="toggleStep(7)">
        <div class="flex items-center gap-2">
          <div id="badge-7" class="step-badge w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">7</div>
          <span class="text-xs font-semibold text-slate-700">The Product Thesis</span>
          <span class="text-[10px] text-slate-400 ml-2">Click to reveal why this matters</span>
        </div>
      </div>
      <div id="insight-7" class="step-insight">
        <div class="bg-gradient-to-r from-brand-50 to-orange-50 border border-brand-200 rounded-lg px-5 py-4">
          <p class="text-sm font-semibold text-brand-900 mb-2">AI coding tools need governance for enterprise adoption.</p>
          <div class="grid grid-cols-3 gap-4 mt-3">
            <div>
              <p class="text-xs font-semibold text-slate-700 mb-1">The Gap</p>
              <p class="text-xs text-slate-600 leading-relaxed">AI coding tools write task data. The next step is to provide aggregation, visualization, and alerting.</p>
            </div>
            <div>
              <p class="text-xs font-semibold text-slate-700 mb-1">The Opportunity</p>
              <p class="text-xs text-slate-600 leading-relaxed">First-party governance = trust advantage. Third-party governance = someone else owns your customers' compliance layer. This should be built in.</p>
            </div>
            <div>
              <p class="text-xs font-semibold text-slate-700 mb-1">This Demo</p>
              <p class="text-xs text-slate-600 leading-relaxed">Zero deps. Reads existing data. The tool that reads task data was itself tracked by that same system.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </main>

  <!-- Footer Bar -->
  <footer class="border-t border-slate-200/60 bg-white/60 shrink-0">
    <div class="max-w-[1400px] mx-auto px-5 py-2 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="white" opacity="0.9"/></svg>
        </div>
        <span class="text-[10px] text-slate-500">Enterprise Context Governance Dashboard</span>
        <span class="text-slate-200">|</span>
        <span class="text-[10px] text-slate-400">Enterprise Governance Platform &middot; 2026</span>
      </div>
      <span class="text-[10px] text-slate-300">v1.0.0</span>
    </div>
  </footer>

</body>
</html>`;
}

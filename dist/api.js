/**
 * Enterprise Governance - REST API Server
 *
 * Provides a REST API for integrating governance data with enterprise systems.
 * Supports JSON, CSV, and PDF export formats.
 */
import { createServer } from "node:http";
import { URL } from "node:url";
import { collectTasks } from "./collector.js";
import { generateReport } from "./generator.js";
const PORT = parseInt(process.env.GOVERNANCE_PORT || "3000");
const HOST = process.env.GOVERNANCE_HOST || "localhost";
// Server state
let serverStartTime = Date.now();
let cachedData = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute cache
// Alert configuration
const alertConfigs = [
    { type: "cost_threshold", threshold: 100, enabled: true },
    { type: "failure_rate", threshold: 0.2, enabled: true },
    { type: "usage_spike", threshold: 2.0, enabled: true },
];
/**
 * Get cached or fresh data
 */
async function getData(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedData && now - cacheTimestamp < CACHE_TTL_MS) {
        return cachedData;
    }
    cachedData = await collectTasks();
    cacheTimestamp = now;
    return cachedData;
}
/**
 * Convert data to CSV format
 */
function toCSV(data) {
    const headers = [
        "task_id",
        "content",
        "status",
        "type",
        "model",
        "tokens_input",
        "tokens_output",
        "cost",
        "timestamp",
        "source_file",
    ];
    const rows = [headers];
    for (const file of data.taskFiles) {
        for (const entry of file.entries) {
            rows.push([
                entry.id || "",
                `"${(entry.content || "").replace(/"/g, '""')}"`,
                entry.status || "",
                entry.type || "",
                entry.model || "",
                String(entry.tokens?.input || 0),
                String(entry.tokens?.output || 0),
                String(entry.cost || 0),
                entry.timestamp || "",
                file.filename,
            ]);
        }
    }
    return rows.map((row) => row.join(",")).join("\n");
}
/**
 * Calculate metrics from aggregated data
 */
function calculateMetrics(data) {
    const totalTasks = data.totalEntries;
    const completed = data.statusCounts["completed"] || 0;
    return {
        totalTasks,
        totalSessions: data.totalFiles,
        totalCost: Math.round(data.estimatedCost * 100) / 100,
        completionRate: totalTasks > 0 ? Math.round((completed / totalTasks) * 1000) / 10 : 0,
        tokenUsage: {
            input: data.totalTokensInput,
            output: data.totalTokensOutput,
            total: data.totalTokensInput + data.totalTokensOutput,
        },
        modelDistribution: data.modelCounts,
        statusDistribution: data.statusCounts,
    };
}
/**
 * Check alerts against current data
 */
function checkAlerts(data) {
    const results = [];
    const metrics = calculateMetrics(data);
    for (const config of alertConfigs) {
        if (!config.enabled)
            continue;
        let triggered = false;
        let currentValue = 0;
        let message = "";
        switch (config.type) {
            case "cost_threshold":
                currentValue = metrics.totalCost;
                triggered = currentValue > config.threshold;
                message = triggered
                    ? `Cost exceeded threshold: $${currentValue.toFixed(2)} > $${config.threshold}`
                    : `Cost within threshold: $${currentValue.toFixed(2)}`;
                break;
            case "failure_rate":
                const failed = data.statusCounts["failed"] || 0;
                currentValue =
                    data.totalEntries > 0 ? failed / data.totalEntries : 0;
                triggered = currentValue > config.threshold;
                message = triggered
                    ? `Failure rate exceeded: ${(currentValue * 100).toFixed(1)}% > ${config.threshold * 100}%`
                    : `Failure rate normal: ${(currentValue * 100).toFixed(1)}%`;
                break;
            case "usage_spike":
                // Simplified spike detection (would compare to historical average)
                currentValue = metrics.totalTasks;
                triggered = false; // Would need historical data for proper detection
                message = `Current task count: ${currentValue}`;
                break;
        }
        results.push({
            triggered,
            type: config.type,
            message,
            currentValue,
            threshold: config.threshold,
        });
    }
    return results;
}
/**
 * Send JSON response
 */
function sendJSON(res, data, status = 200) {
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end(JSON.stringify(data, null, 2));
}
/**
 * Handle API requests
 */
async function handleRequest(req, res) {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;
    // CORS preflight
    if (method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
    }
    const meta = {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
    };
    try {
        // Health check
        if (path === "/health" || path === "/api/health") {
            const health = {
                status: "healthy",
                uptime: Math.floor((Date.now() - serverStartTime) / 1000),
                version: "1.0.0",
            };
            sendJSON(res, { success: true, data: health, meta });
            return;
        }
        // Metrics endpoint
        if (path === "/api/metrics" || path === "/metrics") {
            const data = await getData();
            const metrics = calculateMetrics(data);
            sendJSON(res, { success: true, data: metrics, meta });
            return;
        }
        // Full data endpoint
        if (path === "/api/data" || path === "/data") {
            const refresh = url.searchParams.get("refresh") === "true";
            const data = await getData(refresh);
            sendJSON(res, { success: true, data, meta });
            return;
        }
        // Tasks endpoint
        if (path === "/api/tasks" || path === "/tasks") {
            const data = await getData();
            const limit = parseInt(url.searchParams.get("limit") || "100");
            const status = url.searchParams.get("status");
            let tasks = data.recentTasks;
            if (status) {
                tasks = tasks.filter((t) => t.status === status);
            }
            tasks = tasks.slice(0, limit);
            sendJSON(res, {
                success: true,
                data: { tasks, total: tasks.length },
                meta,
            });
            return;
        }
        // Patterns endpoint
        if (path === "/api/patterns" || path === "/patterns") {
            const data = await getData();
            sendJSON(res, { success: true, data: data.patterns, meta });
            return;
        }
        // Alerts endpoint
        if (path === "/api/alerts" || path === "/alerts") {
            const data = await getData();
            const alerts = checkAlerts(data);
            const triggered = alerts.filter((a) => a.triggered);
            sendJSON(res, {
                success: true,
                data: {
                    alerts,
                    triggeredCount: triggered.length,
                    hasActiveAlerts: triggered.length > 0,
                },
                meta,
            });
            return;
        }
        // Export endpoints
        if (path === "/api/export/csv" || path === "/export/csv") {
            const data = await getData();
            const csv = toCSV(data);
            res.writeHead(200, {
                "Content-Type": "text/csv",
                "Content-Disposition": 'attachment; filename="governance-export.csv"',
                "Access-Control-Allow-Origin": "*",
            });
            res.end(csv);
            return;
        }
        if (path === "/api/export/json" || path === "/export/json") {
            const data = await getData();
            res.writeHead(200, {
                "Content-Type": "application/json",
                "Content-Disposition": 'attachment; filename="governance-export.json"',
                "Access-Control-Allow-Origin": "*",
            });
            res.end(JSON.stringify(data, null, 2));
            return;
        }
        if (path === "/api/export/html" || path === "/export/html") {
            const data = await getData();
            const html = generateReport(data);
            res.writeHead(200, {
                "Content-Type": "text/html",
                "Content-Disposition": 'attachment; filename="governance-report.html"',
                "Access-Control-Allow-Origin": "*",
            });
            res.end(html);
            return;
        }
        // Dashboard (serve HTML report)
        if (path === "/" || path === "/dashboard") {
            const data = await getData();
            const html = generateReport(data);
            res.writeHead(200, {
                "Content-Type": "text/html",
                "Access-Control-Allow-Origin": "*",
            });
            res.end(html);
            return;
        }
        // API documentation
        if (path === "/api" || path === "/api/") {
            const docs = {
                name: "Enterprise Governance API",
                version: "1.0.0",
                endpoints: [
                    { method: "GET", path: "/health", description: "Health check" },
                    { method: "GET", path: "/api/metrics", description: "Get metrics summary" },
                    { method: "GET", path: "/api/data", description: "Get full aggregated data" },
                    { method: "GET", path: "/api/tasks", description: "Get recent tasks (supports ?limit=N&status=X)" },
                    { method: "GET", path: "/api/patterns", description: "Get task patterns" },
                    { method: "GET", path: "/api/alerts", description: "Check alert status" },
                    { method: "GET", path: "/api/export/csv", description: "Export data as CSV" },
                    { method: "GET", path: "/api/export/json", description: "Export data as JSON" },
                    { method: "GET", path: "/api/export/html", description: "Export dashboard as HTML" },
                    { method: "GET", path: "/dashboard", description: "View live dashboard" },
                ],
            };
            sendJSON(res, { success: true, data: docs, meta });
            return;
        }
        // 404
        sendJSON(res, { success: false, error: "Not found", meta }, 404);
    }
    catch (error) {
        console.error("API Error:", error);
        sendJSON(res, {
            success: false,
            error: error instanceof Error ? error.message : "Internal server error",
            meta,
        }, 500);
    }
}
/**
 * Start the API server
 */
export function startServer() {
    const server = createServer(handleRequest);
    server.listen(PORT, HOST, () => {
        console.log("╔══════════════════════════════════════════════════╗");
        console.log("║   Enterprise Governance API Server               ║");
        console.log("╚══════════════════════════════════════════════════╝");
        console.log();
        console.log(`Server running at http://${HOST}:${PORT}`);
        console.log();
        console.log("Endpoints:");
        console.log(`  Dashboard:  http://${HOST}:${PORT}/dashboard`);
        console.log(`  API Docs:   http://${HOST}:${PORT}/api`);
        console.log(`  Metrics:    http://${HOST}:${PORT}/api/metrics`);
        console.log(`  Health:     http://${HOST}:${PORT}/health`);
        console.log();
        console.log("Press Ctrl+C to stop");
    });
}
// Run if called directly
const isMain = process.argv[1]?.includes("api");
if (isMain) {
    startServer();
}

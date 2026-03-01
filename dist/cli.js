#!/usr/bin/env node
/**
 * Enterprise Governance - CLI
 *
 * Interactive command-line interface for governance operations.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createInterface } from "node:readline";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectTasks } from "./collector.js";
import { generateReport } from "./generator.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const MOCK_DATA_DIR = join(__dirname, "..", "mock-data");
// ANSI color codes
const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};
function color(text, c) {
    return `${colors[c]}${text}${colors.reset}`;
}
function printHeader() {
    console.log();
    console.log(color("╔══════════════════════════════════════════════════════════════╗", "cyan"));
    console.log(color("║     Enterprise Governance CLI                                ║", "cyan"));
    console.log(color("║     Analytics • Compliance • Cost Management                 ║", "cyan"));
    console.log(color("╚══════════════════════════════════════════════════════════════╝", "cyan"));
    console.log();
}
function printHelp() {
    console.log(color("Available Commands:", "bold"));
    console.log();
    console.log(`  ${color("report", "green")}     Generate HTML governance report`);
    console.log(`  ${color("metrics", "green")}    Show key metrics summary`);
    console.log(`  ${color("costs", "green")}      Show cost breakdown`);
    console.log(`  ${color("models", "green")}     Show model usage statistics`);
    console.log(`  ${color("status", "green")}     Show task status distribution`);
    console.log(`  ${color("patterns", "green")}   Show common task patterns`);
    console.log(`  ${color("alerts", "green")}     Check for governance alerts`);
    console.log(`  ${color("export", "green")}     Export data (csv, json)`);
    console.log(`  ${color("server", "green")}     Start the API server`);
    console.log(`  ${color("help", "green")}       Show this help message`);
    console.log(`  ${color("quit", "green")}       Exit the CLI`);
    console.log();
}
function formatNumber(n) {
    return n.toLocaleString();
}
function formatCost(n) {
    return `$${n.toFixed(2)}`;
}
function formatPercent(n) {
    return `${n.toFixed(1)}%`;
}
async function showMetrics(data) {
    const completed = data.statusCounts["completed"] || 0;
    const failed = data.statusCounts["failed"] || 0;
    const total = data.totalEntries;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;
    console.log();
    console.log(color("═══ KEY METRICS ═══", "bold"));
    console.log();
    console.log(`  Total Sessions:     ${color(formatNumber(data.totalFiles), "cyan")}`);
    console.log(`  Total Tasks:        ${color(formatNumber(data.totalEntries), "cyan")}`);
    console.log(`  Input Tokens:       ${color(formatNumber(data.totalTokensInput), "cyan")}`);
    console.log(`  Output Tokens:      ${color(formatNumber(data.totalTokensOutput), "cyan")}`);
    console.log(`  Estimated Cost:     ${color(formatCost(data.estimatedCost), "yellow")}`);
    console.log(`  Completion Rate:    ${color(formatPercent(completionRate), completionRate > 80 ? "green" : "yellow")}`);
    console.log(`  Failure Rate:       ${color(formatPercent(failureRate), failureRate < 10 ? "green" : "red")}`);
    console.log();
}
async function showCosts(data) {
    const inputCost = (data.totalTokensInput / 1_000_000) * 3;
    const outputCost = (data.totalTokensOutput / 1_000_000) * 15;
    const dailyRate = data.estimatedCost / 30; // Approximate
    console.log();
    console.log(color("═══ COST BREAKDOWN ═══", "bold"));
    console.log();
    console.log(`  Input Token Cost:   ${color(formatCost(inputCost), "cyan")}`);
    console.log(`  Output Token Cost:  ${color(formatCost(outputCost), "cyan")}`);
    console.log(`  Total Cost:         ${color(formatCost(data.estimatedCost), "yellow")}`);
    console.log();
    console.log(color("  Projections:", "dim"));
    console.log(`  Daily Rate:         ${formatCost(dailyRate)}/day`);
    console.log(`  Monthly Projection: ${formatCost(dailyRate * 30)}/month`);
    console.log();
}
async function showModels(data) {
    console.log();
    console.log(color("═══ MODEL USAGE ═══", "bold"));
    console.log();
    const models = Object.entries(data.modelCounts).sort(([, a], [, b]) => b - a);
    if (models.length === 0) {
        console.log("  No model data available");
    }
    else {
        for (const [model, count] of models) {
            const pct = data.totalEntries > 0 ? (count / data.totalEntries) * 100 : 0;
            const bar = "█".repeat(Math.round(pct / 5));
            console.log(`  ${model.padEnd(35)} ${String(count).padStart(5)} (${formatPercent(pct).padStart(6)}) ${color(bar, "cyan")}`);
        }
    }
    console.log();
}
async function showStatus(data) {
    console.log();
    console.log(color("═══ STATUS DISTRIBUTION ═══", "bold"));
    console.log();
    const statuses = Object.entries(data.statusCounts).sort(([, a], [, b]) => b - a);
    const statusColors = {
        completed: "green",
        in_progress: "yellow",
        pending: "blue",
        failed: "red",
    };
    for (const [status, count] of statuses) {
        const pct = data.totalEntries > 0 ? (count / data.totalEntries) * 100 : 0;
        const bar = "█".repeat(Math.round(pct / 5));
        const c = statusColors[status] || "dim";
        console.log(`  ${status.padEnd(15)} ${String(count).padStart(5)} (${formatPercent(pct).padStart(6)}) ${color(bar, c)}`);
    }
    console.log();
}
async function showPatterns(data) {
    console.log();
    console.log(color("═══ TASK PATTERNS ═══", "bold"));
    console.log();
    if (data.patterns.length === 0) {
        console.log("  No patterns detected");
    }
    else {
        for (const pattern of data.patterns.slice(0, 10)) {
            console.log(`  ${color(String(pattern.count).padStart(4), "cyan")}  ${pattern.key}`);
        }
    }
    console.log();
}
async function checkAlerts(data) {
    console.log();
    console.log(color("═══ GOVERNANCE ALERTS ═══", "bold"));
    console.log();
    const alerts = [];
    // Cost alert
    if (data.estimatedCost > 100) {
        alerts.push({
            type: "COST",
            severity: data.estimatedCost > 500 ? "CRITICAL" : "WARNING",
            message: `Estimated cost (${formatCost(data.estimatedCost)}) exceeds threshold`,
        });
    }
    // Failure rate alert
    const failed = data.statusCounts["failed"] || 0;
    const failureRate = data.totalEntries > 0 ? failed / data.totalEntries : 0;
    if (failureRate > 0.1) {
        alerts.push({
            type: "FAILURE_RATE",
            severity: failureRate > 0.2 ? "CRITICAL" : "WARNING",
            message: `Failure rate (${formatPercent(failureRate * 100)}) exceeds threshold`,
        });
    }
    // In-progress pile-up
    const inProgress = data.statusCounts["in_progress"] || 0;
    if (inProgress > 10) {
        alerts.push({
            type: "STALLED_TASKS",
            severity: "WARNING",
            message: `${inProgress} tasks stuck in progress`,
        });
    }
    if (alerts.length === 0) {
        console.log(`  ${color("✓", "green")} No active alerts - system healthy`);
    }
    else {
        for (const alert of alerts) {
            const icon = alert.severity === "CRITICAL" ? "✗" : "⚠";
            const c = alert.severity === "CRITICAL" ? "red" : "yellow";
            console.log(`  ${color(icon, c)} [${color(alert.severity, c)}] ${alert.type}: ${alert.message}`);
        }
    }
    console.log();
}
async function exportData(data, format) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    if (format === "csv") {
        const headers = [
            "source_file",
            "content",
            "status",
            "type",
            "model",
            "tokens_input",
            "tokens_output",
            "timestamp",
        ];
        const rows = [headers.join(",")];
        for (const file of data.taskFiles) {
            for (const entry of file.entries) {
                rows.push([
                    file.filename,
                    `"${(entry.content || "").replace(/"/g, '""')}"`,
                    entry.status || "",
                    entry.type || "",
                    entry.model || "",
                    entry.tokens?.input || 0,
                    entry.tokens?.output || 0,
                    entry.timestamp || "",
                ].join(","));
            }
        }
        const csvPath = join(OUTPUT_DIR, "governance-export.csv");
        await writeFile(csvPath, rows.join("\n"));
        console.log();
        console.log(`  ${color("✓", "green")} Exported to: ${csvPath}`);
    }
    else if (format === "json") {
        const jsonPath = join(OUTPUT_DIR, "governance-export.json");
        await writeFile(jsonPath, JSON.stringify(data, null, 2));
        console.log();
        console.log(`  ${color("✓", "green")} Exported to: ${jsonPath}`);
    }
    else {
        console.log(`  ${color("✗", "red")} Unknown format: ${format}`);
        console.log("  Supported formats: csv, json");
    }
    console.log();
}
async function generateReportFile(data) {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const html = generateReport(data);
    const reportPath = join(OUTPUT_DIR, "governance-report.html");
    await writeFile(reportPath, html);
    console.log();
    console.log(`  ${color("✓", "green")} Report generated: ${reportPath}`);
    // Try to open in browser
    const platform = process.platform;
    const openCmd = platform === "darwin"
        ? "open"
        : platform === "win32"
            ? "start"
            : "xdg-open";
    exec(`${openCmd} "${reportPath}"`, (err) => {
        if (!err) {
            console.log(`  ${color("✓", "green")} Opened in browser`);
        }
    });
    console.log();
}
async function startServer() {
    console.log();
    console.log("  Starting API server...");
    console.log("  Press Ctrl+C to stop");
    console.log();
    // Dynamically import and start
    const { startServer } = await import("./api.js");
    startServer();
}
async function interactiveMode() {
    printHeader();
    console.log(color("Loading governance data...", "dim"));
    const args = process.argv.slice(2);
    const isDemo = args.includes("--demo");
    const data = await collectTasks(isDemo ? MOCK_DATA_DIR : undefined);
    console.log(`Loaded ${color(String(data.totalEntries), "cyan")} tasks from ${color(String(data.totalFiles), "cyan")} sessions`);
    if (isDemo) {
        console.log(color("(Running in demo mode with sample data)", "dim"));
    }
    console.log();
    console.log('Type "help" for available commands, "quit" to exit');
    console.log();
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: color("governance> ", "magenta"),
    });
    rl.prompt();
    rl.on("line", async (line) => {
        const cmd = line.trim().toLowerCase();
        const parts = cmd.split(/\s+/);
        try {
            switch (parts[0]) {
                case "help":
                case "h":
                case "?":
                    printHelp();
                    break;
                case "report":
                    await generateReportFile(data);
                    break;
                case "metrics":
                case "m":
                    await showMetrics(data);
                    break;
                case "costs":
                case "cost":
                case "c":
                    await showCosts(data);
                    break;
                case "models":
                case "model":
                    await showModels(data);
                    break;
                case "status":
                case "s":
                    await showStatus(data);
                    break;
                case "patterns":
                case "p":
                    await showPatterns(data);
                    break;
                case "alerts":
                case "a":
                    await checkAlerts(data);
                    break;
                case "export":
                case "e":
                    await exportData(data, parts[1] || "csv");
                    break;
                case "server":
                    await startServer();
                    return; // Don't prompt again
                case "quit":
                case "exit":
                case "q":
                    console.log();
                    console.log(color("Goodbye!", "cyan"));
                    rl.close();
                    process.exit(0);
                    break;
                case "":
                    // Empty line, just re-prompt
                    break;
                default:
                    console.log(`  Unknown command: ${cmd}`);
                    console.log('  Type "help" for available commands');
                    console.log();
            }
        }
        catch (error) {
            console.error(color(`Error: ${error instanceof Error ? error.message : "Unknown error"}`, "red"));
        }
        rl.prompt();
    });
    rl.on("close", () => {
        process.exit(0);
    });
}
// Command-line argument handling
async function main() {
    const args = process.argv.slice(2);
    // Direct command mode
    if (args.length > 0 && !args[0].startsWith("-")) {
        const cmd = args[0];
        const isDemo = args.includes("--demo");
        const data = await collectTasks(isDemo ? MOCK_DATA_DIR : undefined);
        switch (cmd) {
            case "report":
                await generateReportFile(data);
                break;
            case "metrics":
                await showMetrics(data);
                break;
            case "costs":
                await showCosts(data);
                break;
            case "models":
                await showModels(data);
                break;
            case "status":
                await showStatus(data);
                break;
            case "patterns":
                await showPatterns(data);
                break;
            case "alerts":
                await checkAlerts(data);
                break;
            case "export":
                await exportData(data, args[1] || "csv");
                break;
            case "server":
                await startServer();
                break;
            default:
                console.log(`Unknown command: ${cmd}`);
                printHelp();
        }
        return;
    }
    // Interactive mode
    await interactiveMode();
}
main().catch(console.error);

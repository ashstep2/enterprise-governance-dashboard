import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectTasks } from "./collector.js";
import { generateReport } from "./generator.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "governance-report.html");
const MOCK_DATA_DIR = join(__dirname, "..", "mock-data");
async function main() {
    const isDemo = process.argv.includes("--demo");
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║   Enterprise Governance Report Generator        ║");
    console.log("║   Enterprise Task Analytics                     ║");
    console.log("╚══════════════════════════════════════════════════╝");
    console.log();
    if (isDemo) {
        console.log("→ Running in DEMO mode with sample data ...");
        console.log(`→ Collecting tasks from ${MOCK_DATA_DIR} ...`);
    }
    else {
        console.log("→ Collecting tasks from ~/.claude/todos/ ...");
    }
    const data = await collectTasks(isDemo ? MOCK_DATA_DIR : undefined);
    console.log(`  Found ${data.totalFiles} task files with ${data.totalEntries} entries`);
    console.log("→ Generating HTML dashboard ...");
    const html = generateReport(data);
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(OUTPUT_FILE, html, "utf-8");
    console.log(`  Report written to: ${OUTPUT_FILE}`);
    console.log("→ Opening in browser ...");
    const platform = process.platform;
    const openCmd = platform === "darwin"
        ? "open"
        : platform === "win32"
            ? "start"
            : "xdg-open";
    exec(`${openCmd} "${OUTPUT_FILE}"`, (err) => {
        if (err) {
            console.warn(`  Could not auto-open browser. Open manually:`);
            console.warn(`  file://${OUTPUT_FILE}`);
        }
    });
    console.log();
    console.log("✓ Done. Dashboard generated successfully.");
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});

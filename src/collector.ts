import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface TaskEntry {
  content?: string;
  status?: string;
  activeForm?: string;
  id?: string;
  type?: string;
  message?: string;
  timestamp?: string;
  model?: string;
  cost?: number;
  tokens?: { input?: number; output?: number };
  [key: string]: unknown;
}

export interface TaskFile {
  filename: string;
  entries: TaskEntry[];
  raw: unknown;
}

export interface AggregatedData {
  totalFiles: number;
  totalEntries: number;
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  modelCounts: Record<string, number>;
  totalTokensInput: number;
  totalTokensOutput: number;
  estimatedCost: number;
  taskFiles: TaskFile[];
  patterns: { key: string; count: number }[];
  recentTasks: TaskEntry[];
}

const DEFAULT_TASKS_DIR = join(homedir(), ".claude", "todos");

// Cost per million tokens (approximate LLM pricing)
const COST_PER_M_INPUT = 3.0;
const COST_PER_M_OUTPUT = 15.0;

export async function collectTasks(customDir?: string): Promise<AggregatedData> {
  const TASKS_DIR = customDir || DEFAULT_TASKS_DIR;
  const taskFiles: TaskFile[] = [];
  let totalEntries = 0;
  const statusCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const modelCounts: Record<string, number> = {};
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  const patternMap: Record<string, number> = {};
  const allEntries: TaskEntry[] = [];

  let files: string[] = [];
  try {
    const dirEntries = await readdir(TASKS_DIR);
    files = dirEntries.filter((f) => f.endsWith(".json"));
  } catch (err) {
    console.warn(
      `Warning: Could not read ${TASKS_DIR}. Directory may not exist.`
    );
    console.warn(
      "Generating report with empty data. Create tasks first."
    );
  }

  for (const file of files) {
    const filepath = join(TASKS_DIR, file);
    try {
      const content = await readFile(filepath, "utf-8");
      const raw = JSON.parse(content);

      // Handle both array and single-object task files
      const entries: TaskEntry[] = Array.isArray(raw) ? raw : [raw];
      totalEntries += entries.length;

      for (const entry of entries) {
        allEntries.push(entry);

        // Count statuses
        const status = entry.status || "unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        // Count types
        const type = entry.type || "general";
        typeCounts[type] = (typeCounts[type] || 0) + 1;

        // Count models
        if (entry.model) {
          modelCounts[entry.model] = (modelCounts[entry.model] || 0) + 1;
        }

        // Aggregate tokens
        if (entry.tokens) {
          totalTokensInput += entry.tokens.input || 0;
          totalTokensOutput += entry.tokens.output || 0;
        }

        // Extract patterns from content/messages
        const text = entry.content || entry.message || "";
        if (text) {
          const words = text.split(/\s+/).slice(0, 3).join(" ");
          if (words.length > 2) {
            patternMap[words] = (patternMap[words] || 0) + 1;
          }
        }
      }

      taskFiles.push({ filename: file, entries, raw });
    } catch {
      console.warn(`Skipping malformed file: ${file}`);
    }
  }

  // Sort patterns by frequency
  const patterns = Object.entries(patternMap)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Recent tasks (last 20 by timestamp, or just latest entries)
  const withTimestamp = allEntries.filter((e) => e.timestamp);
  const recentTasks =
    withTimestamp.length > 0
      ? withTimestamp
          .sort(
            (a, b) =>
              new Date(b.timestamp!).getTime() -
              new Date(a.timestamp!).getTime()
          )
          .slice(0, 20)
      : allEntries.slice(-20);

  // Estimate cost
  const estimatedCost =
    (totalTokensInput / 1_000_000) * COST_PER_M_INPUT +
    (totalTokensOutput / 1_000_000) * COST_PER_M_OUTPUT;

  return {
    totalFiles: files.length,
    totalEntries,
    statusCounts,
    typeCounts,
    modelCounts,
    totalTokensInput,
    totalTokensOutput,
    estimatedCost,
    taskFiles,
    patterns,
    recentTasks,
  };
}

#!/usr/bin/env node
/**
 * Enterprise Governance - MCP Server (Hybrid)
 *
 * This MCP server provides governance tools by reading from multiple
 * data primitives:
 * - ~/.claude/todos/ - Task tracking with session IDs
 * - ~/.claude/stats-cache.json - Aggregated usage metrics
 * - ~/.claude/projects/{project}/*.jsonl - Detailed session logs
 *
 * To use: Add this server to your MCP configuration.
 */

import { createInterface } from "node:readline";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createReadStream } from "node:fs";
import { createInterface as createRLInterface } from "node:readline";

// ============================================================================
// Types
// ============================================================================

interface MCPRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Todo primitive types
interface TodoItem {
  content: string;
  status: "completed" | "in_progress" | "pending";
  id: string;
  activeForm?: string;
}

interface TodoSession {
  sessionId: string;
  timestamp: Date;
  todos: TodoItem[];
}

// Stats cache types (from ~/.claude/stats-cache.json)
interface StatsCache {
  version: number;
  lastComputedDate: string;
  dailyActivity: Array<{
    date: string;
    messageCount: number;
    sessionCount: number;
    toolCallCount: number;
  }>;
  dailyModelTokens: Array<{
    date: string;
    tokensByModel: Record<string, number>;
  }>;
  modelUsage: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      costUSD: number;
    }
  >;
  totalSessions: number;
  totalMessages: number;
  firstSessionDate?: string;
  longestSession?: {
    sessionId: string;
    duration: number;
    messageCount: number;
    timestamp: string;
  };
}

// Session log types (from project .jsonl files)
interface SessionMessage {
  type: "user" | "assistant" | "summary" | "file-history-snapshot";
  sessionId?: string;
  timestamp?: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  todos?: TodoItem[];
}

// ============================================================================
// Constants
// ============================================================================

const CLAUDE_DIR = join(homedir(), ".claude");
const TODOS_DIR = join(CLAUDE_DIR, "todos");
const STATS_CACHE_PATH = join(CLAUDE_DIR, "stats-cache.json");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");

// Model pricing (per million tokens) - approximate
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-5-20251101": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-haiku-3-5-20241022": { input: 0.8, output: 4.0 },
  default: { input: 3.0, output: 15.0 },
};

// ============================================================================
// Data Loaders
// ============================================================================

/**
 * Load stats cache - aggregated metrics
 */
async function loadStatsCache(): Promise<StatsCache | null> {
  try {
    const content = await readFile(STATS_CACHE_PATH, "utf-8");
    return JSON.parse(content) as StatsCache;
  } catch {
    return null;
  }
}

/**
 * Load todos with file timestamps for session tracking (legacy - from todos dir)
 */
async function loadTodosFromTodosDir(): Promise<TodoSession[]> {
  const sessions: TodoSession[] = [];

  try {
    const files = await readdir(TODOS_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of jsonFiles) {
      try {
        const filePath = join(TODOS_DIR, file);
        const [content, fileStat] = await Promise.all([
          readFile(filePath, "utf-8"),
          stat(filePath),
        ]);

        const data = JSON.parse(content);
        const todos: TodoItem[] = Array.isArray(data) ? data : [data];

        // Skip empty todo lists
        if (todos.length === 0) continue;

        // Extract session ID from filename (format: {sessionId}-agent-{sessionId}.json)
        const sessionId = file.split("-agent-")[0] || file.replace(".json", "");

        sessions.push({
          sessionId,
          timestamp: fileStat.mtime,
          todos,
        });
      } catch {
        // Skip malformed files
      }
    }
  } catch {
    // Directory doesn't exist
  }

  // Sort by timestamp (most recent first)
  sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return sessions;
}

/**
 * Real-time session data from session logs
 */
interface RealTimeSession {
  sessionId: string;
  project: string;
  timestamp: Date;
  messageCount: number;
  tokens: { input: number; output: number };
  models: Record<string, number>;
  currentTodos: TodoItem[];
  lastActivity: string;
}

/**
 * Parse a session log for real-time data (reads from end for efficiency)
 */
async function parseSessionLogRealTime(
  filePath: string,
  sessionId: string,
  project: string
): Promise<RealTimeSession | null> {
  const result: RealTimeSession = {
    sessionId,
    project,
    timestamp: new Date(),
    messageCount: 0,
    tokens: { input: 0, output: 0 },
    models: {},
    currentTodos: [],
    lastActivity: "",
  };

  try {
    const fileStat = await stat(filePath);
    result.timestamp = fileStat.mtime;

    const fileStream = createReadStream(filePath);
    const rl = createRLInterface({ input: fileStream, crlfDelay: Infinity });

    let lastTodos: TodoItem[] = [];
    let lastTimestamp = "";

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line) as SessionMessage & { todos?: TodoItem[]; timestamp?: string };

        // Track todos from any message that has them
        if (entry.todos && Array.isArray(entry.todos) && entry.todos.length > 0) {
          lastTodos = entry.todos;
        }

        // Track timestamp
        if (entry.timestamp) {
          lastTimestamp = entry.timestamp;
        }

        // Count assistant messages and tokens
        if (entry.type === "assistant" && entry.message) {
          result.messageCount++;

          if (entry.message.model) {
            result.models[entry.message.model] =
              (result.models[entry.message.model] || 0) + 1;
          }

          if (entry.message.usage) {
            result.tokens.input += entry.message.usage.input_tokens || 0;
            result.tokens.output += entry.message.usage.output_tokens || 0;
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    result.currentTodos = lastTodos;
    result.lastActivity = lastTimestamp;

    return result.messageCount > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Load real-time session data from all project session logs
 */
async function loadRealTimeSessions(): Promise<RealTimeSession[]> {
  const sessions: RealTimeSession[] = [];

  try {
    const projectDirs = await readdir(PROJECTS_DIR);

    for (const projectDir of projectDirs) {
      const projectPath = join(PROJECTS_DIR, projectDir);

      try {
        const projectStat = await stat(projectPath);
        if (!projectStat.isDirectory()) continue;

        const files = await readdir(projectPath);
        const sessionFiles = files.filter((f) => f.endsWith(".jsonl"));

        for (const sessionFile of sessionFiles) {
          const sessionId = sessionFile.replace(".jsonl", "");
          const filePath = join(projectPath, sessionFile);

          const session = await parseSessionLogRealTime(filePath, sessionId, projectDir);
          if (session) {
            sessions.push(session);
          }
        }
      } catch {
        // Skip unreadable directories
      }
    }
  } catch {
    // Projects directory doesn't exist
  }

  // Sort by timestamp (most recent first)
  sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return sessions;
}

/**
 * Load todos - combines real-time session data with legacy todos
 */
async function loadTodosWithTimestamps(): Promise<TodoSession[]> {
  // Get real-time data from session logs (primary source)
  const realTimeSessions = await loadRealTimeSessions();

  // Convert to TodoSession format, using current todos from sessions
  const sessions: TodoSession[] = realTimeSessions
    .filter(s => s.currentTodos.length > 0)
    .map(s => ({
      sessionId: s.sessionId,
      timestamp: s.timestamp,
      todos: s.currentTodos,
    }));

  // If no real-time todos found, fall back to legacy todos directory
  if (sessions.length === 0) {
    return loadTodosFromTodosDir();
  }

  return sessions;
}

/**
 * Parse a session log file (.jsonl) for detailed metrics
 */
async function parseSessionLog(
  filePath: string
): Promise<{ messages: number; tokens: { input: number; output: number }; models: Record<string, number> }> {
  const result = {
    messages: 0,
    tokens: { input: 0, output: 0 },
    models: {} as Record<string, number>,
  };

  try {
    const fileStream = createReadStream(filePath);
    const rl = createRLInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      try {
        const entry = JSON.parse(line) as SessionMessage;
        if (entry.type === "assistant" && entry.message) {
          result.messages++;

          if (entry.message.model) {
            result.models[entry.message.model] =
              (result.models[entry.message.model] || 0) + 1;
          }

          if (entry.message.usage) {
            result.tokens.input += entry.message.usage.input_tokens || 0;
            result.tokens.output += entry.message.usage.output_tokens || 0;
          }
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // File read error
  }

  return result;
}

/**
 * Get list of projects with session logs
 */
async function getProjectSessions(): Promise<
  Array<{ project: string; sessions: string[] }>
> {
  const projects: Array<{ project: string; sessions: string[] }> = [];

  try {
    const projectDirs = await readdir(PROJECTS_DIR);

    for (const projectDir of projectDirs) {
      const projectPath = join(PROJECTS_DIR, projectDir);
      const projectStat = await stat(projectPath);

      if (projectStat.isDirectory()) {
        try {
          const files = await readdir(projectPath);
          const sessionFiles = files.filter((f) => f.endsWith(".jsonl"));
          if (sessionFiles.length > 0) {
            projects.push({ project: projectDir, sessions: sessionFiles });
          }
        } catch {
          // Skip unreadable directories
        }
      }
    }
  } catch {
    // Projects directory doesn't exist
  }

  return projects;
}

// ============================================================================
// Cost Calculation
// ============================================================================

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING.default;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Get governance metrics - uses stats cache for accurate data
 */
async function getMetrics(
  days: number = 30
): Promise<Record<string, unknown>> {
  const [statsCache, todoSessions] = await Promise.all([
    loadStatsCache(),
    loadTodosWithTimestamps(),
  ]);

  // Calculate date threshold
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);

  // Filter daily activity by date range
  const recentActivity = statsCache?.dailyActivity?.filter(
    (d) => new Date(d.date) >= threshold
  ) || [];

  // Aggregate metrics from stats cache
  const totalMessages = recentActivity.reduce((sum, d) => sum + d.messageCount, 0);
  const totalSessions = recentActivity.reduce((sum, d) => sum + d.sessionCount, 0);
  const totalToolCalls = recentActivity.reduce((sum, d) => sum + d.toolCallCount, 0);

  // Calculate token usage and cost from model usage
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let estimatedCost = 0;
  const modelBreakdown: Record<string, { tokens: number; cost: number }> = {};

  if (statsCache?.modelUsage) {
    for (const [model, usage] of Object.entries(statsCache.modelUsage)) {
      const input = usage.inputTokens || 0;
      const output = usage.outputTokens || 0;
      totalInputTokens += input;
      totalOutputTokens += output;

      const cost = calculateCost(model, input, output);
      estimatedCost += cost;

      modelBreakdown[model] = {
        tokens: input + output,
        cost: Math.round(cost * 100) / 100,
      };
    }
  }

  // Calculate task metrics from todos
  const recentTodoSessions = todoSessions.filter(
    (s) => s.timestamp >= threshold
  );
  const allTodos = recentTodoSessions.flatMap((s) => s.todos);
  const statusCounts: Record<string, number> = {};
  for (const todo of allTodos) {
    statusCounts[todo.status] = (statusCounts[todo.status] || 0) + 1;
  }

  const completionRate =
    allTodos.length > 0
      ? ((statusCounts.completed || 0) / allTodos.length) * 100
      : 0;

  return {
    period_days: days,
    data_source: "hybrid (stats-cache + todos)",
    activity: {
      total_messages: totalMessages,
      total_sessions: totalSessions,
      total_tool_calls: totalToolCalls,
      messages_per_session: totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
    },
    tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      total: totalInputTokens + totalOutputTokens,
    },
    cost: {
      estimated_usd: Math.round(estimatedCost * 100) / 100,
      by_model: modelBreakdown,
    },
    tasks: {
      total_todo_items: allTodos.length,
      sessions_with_todos: recentTodoSessions.length,
      status_distribution: statusCounts,
      completion_rate_percent: Math.round(completionRate * 10) / 10,
    },
  };
}

/**
 * Check for governance alerts
 */
async function checkAlerts(
  costThreshold: number = 100,
  failureThreshold: number = 0.2
): Promise<Record<string, unknown>> {
  const metrics = await getMetrics(30);
  const alerts: Array<{ type: string; severity: string; message: string }> = [];

  const cost = (metrics.cost as { estimated_usd: number }).estimated_usd;
  const tasks = metrics.tasks as {
    status_distribution: Record<string, number>;
    total_todo_items: number;
  };

  // Cost alert
  if (cost > costThreshold) {
    alerts.push({
      type: "cost_threshold",
      severity: cost > costThreshold * 1.5 ? "critical" : "warning",
      message: `Estimated cost ($${cost}) exceeds threshold ($${costThreshold})`,
    });
  }

  // Task completion alert (using "pending" as potential concern)
  const pendingCount = tasks.status_distribution.pending || 0;
  const pendingRate =
    tasks.total_todo_items > 0 ? pendingCount / tasks.total_todo_items : 0;

  if (pendingRate > failureThreshold) {
    alerts.push({
      type: "high_pending_rate",
      severity: pendingRate > 0.5 ? "critical" : "warning",
      message: `High pending task rate (${(pendingRate * 100).toFixed(1)}%) - ${pendingCount} tasks not completed`,
    });
  }

  // High activity alert (unusual spike)
  const activity = metrics.activity as { messages_per_session: number };
  if (activity.messages_per_session > 200) {
    alerts.push({
      type: "high_activity",
      severity: "info",
      message: `High average messages per session (${activity.messages_per_session})`,
    });
  }

  return {
    alerts,
    alert_count: alerts.length,
    has_critical: alerts.some((a) => a.severity === "critical"),
    thresholds: {
      cost: costThreshold,
      pending_rate: failureThreshold,
    },
    current_values: {
      cost,
      pending_rate: Math.round(pendingRate * 1000) / 10,
    },
  };
}

/**
 * Get model usage breakdown - from stats cache
 */
async function getModelUsage(): Promise<Record<string, unknown>> {
  const statsCache = await loadStatsCache();

  if (!statsCache?.modelUsage) {
    return {
      error: "No model usage data available",
      models: {},
    };
  }

  const models: Record<string, unknown> = {};
  let totalCost = 0;

  for (const [model, usage] of Object.entries(statsCache.modelUsage)) {
    const cost = calculateCost(model, usage.inputTokens, usage.outputTokens);
    totalCost += cost;

    models[model] = {
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cache_read_tokens: usage.cacheReadInputTokens,
      cache_creation_tokens: usage.cacheCreationInputTokens,
      estimated_cost_usd: Math.round(cost * 100) / 100,
    };
  }

  // Daily breakdown
  const dailyTokens = statsCache.dailyModelTokens?.slice(-7) || [];

  return {
    models,
    total_estimated_cost_usd: Math.round(totalCost * 100) / 100,
    daily_breakdown_last_7_days: dailyTokens,
    data_source: "stats-cache.json",
  };
}

/**
 * Get recent tasks - from real-time session logs
 */
async function getRecentTasks(
  limit: number = 10,
  status?: string
): Promise<Record<string, unknown>> {
  // Get real-time session data
  const realTimeSessions = await loadRealTimeSessions();

  // Flatten and enrich tasks with session info
  let allTasks: Array<{
    content: string;
    status: string;
    sessionId: string;
    project: string;
    sessionTimestamp: string;
    sessionMessages: number;
  }> = [];

  for (const session of realTimeSessions) {
    for (const todo of session.currentTodos) {
      allTasks.push({
        content: todo.content,
        status: todo.status,
        sessionId: session.sessionId,
        project: session.project.replace(/-/g, "/").substring(1), // Convert back to path
        sessionTimestamp: session.timestamp.toISOString(),
        sessionMessages: session.messageCount,
      });
    }
  }

  // Filter by status if specified
  if (status) {
    allTasks = allTasks.filter((t) => t.status === status);
  }

  // Limit results (already sorted by session timestamp)
  allTasks = allTasks.slice(0, limit);

  // Also get active sessions summary
  const activeSessions = realTimeSessions.slice(0, 5).map(s => ({
    sessionId: s.sessionId.substring(0, 8) + "...",
    project: s.project.replace(/-/g, "/").substring(1).split("/").pop(),
    messages: s.messageCount,
    lastActivity: s.lastActivity ? new Date(s.lastActivity).toLocaleString() : "unknown",
    todoCount: s.currentTodos.length,
  }));

  return {
    tasks: allTasks,
    count: allTasks.length,
    active_sessions: activeSessions,
    total_sessions_with_todos: realTimeSessions.filter(s => s.currentTodos.length > 0).length,
    data_source: "real-time session logs",
  };
}

/**
 * Get live session activity - new tool for real-time monitoring
 */
async function getLiveActivity(): Promise<Record<string, unknown>> {
  const realTimeSessions = await loadRealTimeSessions();

  // Get sessions from last 24 hours
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const recentSessions = realTimeSessions.filter(s => s.timestamp >= oneDayAgo);

  // Aggregate stats
  let totalMessages = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const modelCounts: Record<string, number> = {};
  const projectActivity: Record<string, { sessions: number; messages: number }> = {};

  for (const session of recentSessions) {
    totalMessages += session.messageCount;
    totalInputTokens += session.tokens.input;
    totalOutputTokens += session.tokens.output;

    for (const [model, count] of Object.entries(session.models)) {
      modelCounts[model] = (modelCounts[model] || 0) + count;
    }

    const projectName = session.project.split("-").pop() || session.project;
    if (!projectActivity[projectName]) {
      projectActivity[projectName] = { sessions: 0, messages: 0 };
    }
    projectActivity[projectName].sessions++;
    projectActivity[projectName].messages += session.messageCount;
  }

  // Calculate cost
  let estimatedCost = 0;
  for (const [model, count] of Object.entries(modelCounts)) {
    // Rough estimate: average tokens per message
    const avgInputPerMsg = totalMessages > 0 ? totalInputTokens / totalMessages : 1000;
    const avgOutputPerMsg = totalMessages > 0 ? totalOutputTokens / totalMessages : 500;
    estimatedCost += calculateCost(model, avgInputPerMsg * count, avgOutputPerMsg * count);
  }

  return {
    period: "last_24_hours",
    sessions: {
      total: recentSessions.length,
      with_active_todos: recentSessions.filter(s => s.currentTodos.length > 0).length,
    },
    messages: {
      total: totalMessages,
      per_session: recentSessions.length > 0 ? Math.round(totalMessages / recentSessions.length) : 0,
    },
    tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      total: totalInputTokens + totalOutputTokens,
    },
    models: modelCounts,
    estimated_cost_24h: Math.round(estimatedCost * 100) / 100,
    project_activity: projectActivity,
    most_recent_session: recentSessions[0] ? {
      id: recentSessions[0].sessionId.substring(0, 8) + "...",
      project: recentSessions[0].project.replace(/-/g, "/").substring(1).split("/").pop(),
      messages: recentSessions[0].messageCount,
      active_todos: recentSessions[0].currentTodos.length,
      last_activity: recentSessions[0].lastActivity,
    } : null,
    data_source: "real-time session logs",
  };
}

/**
 * Get cost forecast based on usage patterns
 */
async function getCostForecast(
  daysAhead: number = 30
): Promise<Record<string, unknown>> {
  const statsCache = await loadStatsCache();

  if (!statsCache?.dailyActivity?.length) {
    return {
      error: "Insufficient data for forecasting",
      note: "Need daily activity data from stats-cache.json",
    };
  }

  // Calculate daily averages from recent activity
  const recentDays = statsCache.dailyActivity.slice(-14); // Last 2 weeks
  const avgMessagesPerDay =
    recentDays.reduce((sum, d) => sum + d.messageCount, 0) / recentDays.length;
  const avgSessionsPerDay =
    recentDays.reduce((sum, d) => sum + d.sessionCount, 0) / recentDays.length;

  // Calculate current total cost
  let currentCost = 0;
  if (statsCache.modelUsage) {
    for (const [model, usage] of Object.entries(statsCache.modelUsage)) {
      currentCost += calculateCost(model, usage.inputTokens, usage.outputTokens);
    }
  }

  // Estimate daily cost rate
  const activeDays = statsCache.dailyActivity.length;
  const dailyCostRate = activeDays > 0 ? currentCost / activeDays : 0;

  // Project forward
  const projectedCost = dailyCostRate * daysAhead;

  return {
    current: {
      total_cost_usd: Math.round(currentCost * 100) / 100,
      active_days: activeDays,
      daily_cost_rate: Math.round(dailyCostRate * 100) / 100,
    },
    forecast: {
      period_days: daysAhead,
      projected_cost_usd: Math.round(projectedCost * 100) / 100,
      projected_messages: Math.round(avgMessagesPerDay * daysAhead),
      projected_sessions: Math.round(avgSessionsPerDay * daysAhead),
    },
    averages: {
      messages_per_day: Math.round(avgMessagesPerDay),
      sessions_per_day: Math.round(avgSessionsPerDay * 10) / 10,
    },
    confidence: activeDays >= 7 ? "medium" : "low",
    note: "Forecast based on linear extrapolation of recent usage patterns",
  };
}

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS: Tool[] = [
  {
    name: "governance_metrics",
    description:
      "Get governance metrics including activity, token usage, costs, and task completion rates. Uses hybrid data from stats-cache and todos.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to analyze (default: 30)",
        },
      },
    },
  },
  {
    name: "governance_alerts",
    description:
      "Check for governance alerts including cost thresholds and high pending task rates",
    inputSchema: {
      type: "object",
      properties: {
        cost_threshold: {
          type: "number",
          description: "Cost threshold in dollars (default: 100)",
        },
        failure_threshold: {
          type: "number",
          description: "Pending task rate threshold as decimal (default: 0.2)",
        },
      },
    },
  },
  {
    name: "governance_model_usage",
    description:
      "Get detailed breakdown of model usage including tokens and costs per model",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "governance_recent_tasks",
    description:
      "Get recent tasks from REAL-TIME session logs, showing current active todos across all sessions",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of tasks to return (default: 10)",
        },
        status: {
          type: "string",
          description: "Filter by status (completed, in_progress, pending)",
        },
      },
    },
  },
  {
    name: "governance_cost_forecast",
    description:
      "Get cost forecast based on current usage patterns from stats cache",
    inputSchema: {
      type: "object",
      properties: {
        days_ahead: {
          type: "number",
          description: "Days to forecast (default: 30)",
        },
      },
    },
  },
  {
    name: "governance_live_activity",
    description:
      "Get REAL-TIME activity from session logs - messages, tokens, models, and active todos from the last 24 hours",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ============================================================================
// MCP Protocol Handler
// ============================================================================

async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "governance_metrics":
      return getMetrics(args.days as number);
    case "governance_alerts":
      return checkAlerts(
        args.cost_threshold as number,
        args.failure_threshold as number
      );
    case "governance_model_usage":
      return getModelUsage();
    case "governance_recent_tasks":
      return getRecentTasks(args.limit as number, args.status as string);
    case "governance_cost_forecast":
      return getCostForecast(args.days_ahead as number);
    case "governance_live_activity":
      return getLiveActivity();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleRequest(request: MCPRequest): Promise<MCPResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: {
              name: "governance-mcp-server",
              version: "2.0.0",
            },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: { tools: TOOLS },
        };

      case "tools/call": {
        const toolName = (params as { name: string }).name;
        const toolArgs =
          (params as { arguments?: Record<string, unknown> }).arguments || {};
        const result = await executeTool(toolName, toolArgs);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          },
        };
      }

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
      },
    };
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    try {
      const request = JSON.parse(line) as MCPRequest;
      const response = await handleRequest(request);
      console.log(JSON.stringify(response));
    } catch {
      const errorResponse: MCPResponse = {
        jsonrpc: "2.0",
        id: 0,
        error: { code: -32700, message: "Parse error" },
      };
      console.log(JSON.stringify(errorResponse));
    }
  });
}

main().catch(console.error);

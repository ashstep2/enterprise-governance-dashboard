// Embedded mock data for Vercel serverless deployment
export interface TaskEntry {
  content?: string;
  status?: string;
  activeForm?: string;
  id?: string;
  type?: string;
  timestamp?: string;
  model?: string;
  tokens?: { input?: number; output?: number };
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
  patterns: { key: string; count: number }[];
  recentTasks: TaskEntry[];
}

// Mock data embedded for demo
const MOCK_TASKS: TaskEntry[] = [
  { content: "Implement user authentication module", status: "completed", id: "task-001", type: "feature", timestamp: "2025-01-20T09:15:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 12500, output: 8200 } },
  { content: "Add JWT token validation", status: "completed", id: "task-002", type: "feature", timestamp: "2025-01-20T09:45:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 8900, output: 5600 } },
  { content: "Write unit tests for auth", status: "completed", id: "task-003", type: "testing", timestamp: "2025-01-20T10:30:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 15200, output: 12800 } },
  { content: "Refactor API endpoint structure", status: "completed", id: "task-004", type: "refactor", timestamp: "2025-01-21T14:00:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 22000, output: 18500 } },
  { content: "Update REST endpoints to v2", status: "completed", id: "task-005", type: "refactor", timestamp: "2025-01-21T15:20:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 18000, output: 14200 } },
  { content: "Fix breaking changes in client", status: "completed", id: "task-006", type: "bugfix", timestamp: "2025-01-21T16:45:00Z", model: "claude-haiku-3-5-20241022", tokens: { input: 5500, output: 3200 } },
  { content: "Design database migration strategy", status: "completed", id: "task-007", type: "planning", timestamp: "2025-01-22T10:00:00Z", model: "claude-opus-4-20250514", tokens: { input: 45000, output: 28000 } },
  { content: "Create migration scripts for PostgreSQL", status: "completed", id: "task-008", type: "feature", timestamp: "2025-01-22T11:30:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 19500, output: 16800 } },
  { content: "Add rollback procedures", status: "completed", id: "task-009", type: "feature", timestamp: "2025-01-22T13:15:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 12000, output: 9500 } },
  { content: "Test migration on staging", status: "completed", id: "task-010", type: "testing", timestamp: "2025-01-22T15:00:00Z", model: "claude-haiku-3-5-20241022", tokens: { input: 6200, output: 4100 } },
  { content: "Review codebase for security vulnerabilities", status: "completed", id: "task-011", type: "security", timestamp: "2025-01-23T09:00:00Z", model: "claude-opus-4-20250514", tokens: { input: 85000, output: 32000 } },
  { content: "Fix SQL injection vulnerability", status: "completed", id: "task-012", type: "bugfix", timestamp: "2025-01-23T11:00:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 8500, output: 6200 } },
  { content: "Update dependencies with CVEs", status: "completed", id: "task-013", type: "security", timestamp: "2025-01-23T12:30:00Z", model: "claude-haiku-3-5-20241022", tokens: { input: 4200, output: 2800 } },
  { content: "Generate security compliance report", status: "completed", id: "task-014", type: "documentation", timestamp: "2025-01-23T14:00:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 11000, output: 15500 } },
  { content: "Analyze bundle size and performance", status: "completed", id: "task-015", type: "analysis", timestamp: "2025-01-24T10:00:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 28000, output: 12500 } },
  { content: "Implement code splitting for routes", status: "completed", id: "task-016", type: "feature", timestamp: "2025-01-24T11:30:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 16500, output: 13200 } },
  { content: "Add lazy loading for images", status: "in_progress", id: "task-017", type: "feature", timestamp: "2025-01-24T14:00:00Z", model: "claude-haiku-3-5-20241022", tokens: { input: 7800, output: 5100 } },
  { content: "Optimize React re-renders", status: "pending", id: "task-018", type: "optimization", timestamp: "2025-01-24T15:30:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 9200, output: 0 } },
  { content: "Configure GitHub Actions workflow", status: "completed", id: "task-019", type: "devops", timestamp: "2025-01-25T09:00:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 14000, output: 11500 } },
  { content: "Add automated testing pipeline", status: "completed", id: "task-020", type: "devops", timestamp: "2025-01-25T10:30:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 12800, output: 9600 } },
  { content: "Set up staging deployment", status: "completed", id: "task-021", type: "devops", timestamp: "2025-01-25T12:00:00Z", model: "claude-haiku-3-5-20241022", tokens: { input: 8500, output: 6200 } },
  { content: "Configure production deployment with approvals", status: "failed", id: "task-022", type: "devops", timestamp: "2025-01-25T13:30:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 10200, output: 4500 } },
  { content: "Generate API documentation from OpenAPI", status: "completed", id: "task-023", type: "documentation", timestamp: "2025-01-25T14:00:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 32000, output: 45000 } },
  { content: "Write developer onboarding guide", status: "completed", id: "task-024", type: "documentation", timestamp: "2025-01-25T15:30:00Z", model: "claude-sonnet-4-20250514", tokens: { input: 18500, output: 24000 } },
  { content: "Create architecture decision records", status: "in_progress", id: "task-025", type: "documentation", timestamp: "2025-01-25T16:45:00Z", model: "claude-opus-4-20250514", tokens: { input: 52000, output: 38000 } },
];

const COST_PER_M_INPUT = 3.0;
const COST_PER_M_OUTPUT = 15.0;

export function getAggregatedData(): AggregatedData {
  const statusCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const modelCounts: Record<string, number> = {};
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  const patternMap: Record<string, number> = {};

  for (const entry of MOCK_TASKS) {
    const status = entry.status || "unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const type = entry.type || "general";
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    if (entry.model) {
      modelCounts[entry.model] = (modelCounts[entry.model] || 0) + 1;
    }

    if (entry.tokens) {
      totalTokensInput += entry.tokens.input || 0;
      totalTokensOutput += entry.tokens.output || 0;
    }

    const text = entry.content || "";
    if (text) {
      const words = text.split(/\s+/).slice(0, 3).join(" ");
      if (words.length > 2) {
        patternMap[words] = (patternMap[words] || 0) + 1;
      }
    }
  }

  const patterns = Object.entries(patternMap)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recentTasks = [...MOCK_TASKS]
    .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
    .slice(0, 20);

  const estimatedCost =
    (totalTokensInput / 1_000_000) * COST_PER_M_INPUT +
    (totalTokensOutput / 1_000_000) * COST_PER_M_OUTPUT;

  return {
    totalFiles: 7,
    totalEntries: MOCK_TASKS.length,
    statusCounts,
    typeCounts,
    modelCounts,
    totalTokensInput,
    totalTokensOutput,
    estimatedCost,
    patterns,
    recentTasks,
  };
}

export function getTasks(): TaskEntry[] {
  return MOCK_TASKS;
}

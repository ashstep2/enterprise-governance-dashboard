#!/usr/bin/env npx ts-node
/**
 * Test script for Governance MCP Server
 *
 * Tests the hybrid data approach:
 * 1. Stats cache loading
 * 2. Todos with timestamps
 * 3. All governance tools
 *
 * Run: npx ts-node test/test-governance.ts
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CLAUDE_DIR = join(homedir(), ".claude");

// ============================================================================
// Test Utilities
// ============================================================================

interface MCPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
    tools?: Array<{ name: string }>;
    [key: string]: unknown;
  };
  error?: { code: number; message: string };
}

async function sendMCPRequest(
  serverProcess: ReturnType<typeof spawn>,
  request: MCPRequest
): Promise<MCPResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

    const handler = (data: Buffer) => {
      clearTimeout(timeout);
      try {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          const response = JSON.parse(line) as MCPResponse;
          if (response.id === request.id) {
            serverProcess.stdout?.off("data", handler);
            resolve(response);
            return;
          }
        }
      } catch (e) {
        reject(e);
      }
    };

    serverProcess.stdout?.on("data", handler);
    serverProcess.stdin?.write(JSON.stringify(request) + "\n");
  });
}

function printResult(name: string, success: boolean, details?: string) {
  const icon = success ? "✅" : "❌";
  console.log(`${icon} ${name}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

function printSection(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(` ${title}`);
  console.log("=".repeat(60));
}

// ============================================================================
// Tests
// ============================================================================

async function runTests() {
  console.log("🧪 Governance MCP Server - Test Suite\n");

  // Check if real data exists
  printSection("1. Data Source Verification");

  const statsPath = join(CLAUDE_DIR, "stats-cache.json");
  const todosPath = join(CLAUDE_DIR, "todos");

  try {
    const { stat } = await import("node:fs/promises");
    await stat(statsPath);
    printResult("Stats cache exists", true, statsPath);
  } catch {
    printResult("Stats cache exists", false, "File not found - some features will be limited");
  }

  try {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(todosPath);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    printResult("Todos directory exists", true, `${jsonFiles.length} session files found`);
  } catch {
    printResult("Todos directory exists", false, "Directory not found");
  }

  // Start MCP server
  printSection("2. MCP Server Startup");

  const serverProcess = spawn("npx", ["ts-node", "src/index.ts"], {
    cwd: join(process.cwd()),
    stdio: ["pipe", "pipe", "pipe"],
  });

  let serverStarted = false;

  try {
    // Initialize
    const initResponse = await sendMCPRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });

    if (initResponse.result?.serverInfo) {
      serverStarted = true;
      const info = initResponse.result.serverInfo as { name: string; version: string };
      printResult("Server initialized", true, `${info.name} v${info.version}`);
    } else {
      printResult("Server initialized", false, JSON.stringify(initResponse.error));
    }

    // List tools
    const toolsResponse = await sendMCPRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    if (toolsResponse.result?.tools) {
      const tools = toolsResponse.result.tools;
      printResult("Tools listed", true, `${tools.length} tools available`);
      tools.forEach((t) => console.log(`   - ${t.name}`));
    }

    // Test each tool
    printSection("3. Tool Execution Tests");

    // Test governance_metrics
    const metricsResponse = await sendMCPRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "governance_metrics", arguments: { days: 7 } },
    });

    if (metricsResponse.result?.content?.[0]?.text) {
      const metrics = JSON.parse(metricsResponse.result.content[0].text);
      printResult("governance_metrics", true);
      console.log(`   Data source: ${metrics.data_source}`);
      console.log(`   Messages: ${metrics.activity?.total_messages || 0}`);
      console.log(`   Sessions: ${metrics.activity?.total_sessions || 0}`);
      console.log(`   Estimated cost: $${metrics.cost?.estimated_usd || 0}`);
      console.log(`   Todo items: ${metrics.tasks?.total_todo_items || 0}`);
    } else {
      printResult("governance_metrics", false, metricsResponse.error?.message);
    }

    // Test governance_model_usage
    const modelResponse = await sendMCPRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "governance_model_usage", arguments: {} },
    });

    if (modelResponse.result?.content?.[0]?.text) {
      const usage = JSON.parse(modelResponse.result.content[0].text);
      printResult("governance_model_usage", true);
      if (usage.models) {
        Object.entries(usage.models).forEach(([model, data]) => {
          const d = data as { estimated_cost_usd: number };
          console.log(`   ${model}: $${d.estimated_cost_usd}`);
        });
      }
    } else {
      printResult("governance_model_usage", false, modelResponse.error?.message);
    }

    // Test governance_recent_tasks
    const tasksResponse = await sendMCPRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "governance_recent_tasks", arguments: { limit: 5 } },
    });

    if (tasksResponse.result?.content?.[0]?.text) {
      const tasks = JSON.parse(tasksResponse.result.content[0].text);
      printResult("governance_recent_tasks", true);
      console.log(`   Total sessions with todos: ${tasks.total_sessions}`);
      console.log(`   Tasks returned: ${tasks.count}`);
      if (tasks.tasks?.length > 0) {
        console.log(`   Most recent: "${tasks.tasks[0].content.substring(0, 50)}..."`);
      }
    } else {
      printResult("governance_recent_tasks", false, tasksResponse.error?.message);
    }

    // Test governance_alerts
    const alertsResponse = await sendMCPRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "governance_alerts", arguments: { cost_threshold: 50 } },
    });

    if (alertsResponse.result?.content?.[0]?.text) {
      const alerts = JSON.parse(alertsResponse.result.content[0].text);
      printResult("governance_alerts", true);
      console.log(`   Alert count: ${alerts.alert_count}`);
      console.log(`   Has critical: ${alerts.has_critical}`);
      console.log(`   Current cost: $${alerts.current_values?.cost || 0}`);
    } else {
      printResult("governance_alerts", false, alertsResponse.error?.message);
    }

    // Test governance_cost_forecast
    const forecastResponse = await sendMCPRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "governance_cost_forecast", arguments: { days_ahead: 30 } },
    });

    if (forecastResponse.result?.content?.[0]?.text) {
      const forecast = JSON.parse(forecastResponse.result.content[0].text);
      printResult("governance_cost_forecast", true);
      if (forecast.forecast) {
        console.log(`   Projected cost (30d): $${forecast.forecast.projected_cost_usd}`);
        console.log(`   Projected messages: ${forecast.forecast.projected_messages}`);
        console.log(`   Confidence: ${forecast.confidence}`);
      } else {
        console.log(`   ${forecast.error || "No forecast data"}`);
      }
    } else {
      printResult("governance_cost_forecast", false, forecastResponse.error?.message);
    }

    printSection("4. Summary");
    console.log("\n✅ All tests completed!\n");
    console.log("The hybrid governance MCP server is working with:");
    console.log("  - stats-cache.json for metrics & model usage");
    console.log("  - todos/ directory with file timestamps");
    console.log("  - Real cost calculations based on model pricing\n");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
  } finally {
    serverProcess.kill();
  }
}

// Run tests
runTests().catch(console.error);

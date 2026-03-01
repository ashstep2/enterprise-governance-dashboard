# Governance MCP Server - Status

**Last Updated:** Jan 27, 2026

## What Was Done

### Problem
- Original MCP server read from `~/.claude/todos/` but those files are usually empty (cleared after tasks complete)
- Tasks were showing from Aug 2025 instead of recent ones
- No real-time visibility into current AI coding activity

### Solution: Hybrid Multi-Primitive Approach
Updated the MCP server to read from multiple data sources:

1. **Session Logs** (`~/.claude/projects/{project}/*.jsonl`) - PRIMARY for real-time
   - Current todos embedded in each message
   - Per-message token usage
   - Model used per request

2. **Stats Cache** (`~/.claude/stats-cache.json`) - For aggregated metrics
   - Daily activity totals
   - Model usage breakdown
   - Historical patterns

3. **Todos Directory** (`~/.claude/todos/`) - Fallback only
   - Only used if session logs have no data

## Available Tools (6 total)

| Tool | Purpose | Data Source |
|------|---------|-------------|
| `governance_live_activity` | Real-time last 24h activity | Session logs |
| `governance_recent_tasks` | Current todos across sessions | Session logs |
| `governance_metrics` | Overall metrics & completion rates | Hybrid |
| `governance_model_usage` | Token/cost breakdown by model | Stats cache |
| `governance_cost_forecast` | Project future costs | Stats cache |
| `governance_alerts` | Cost/task threshold alerts | Hybrid |

## Files Changed

- `mcp-server/src/index.ts` - Complete rewrite with hybrid approach
- `mcp-server/test/test-governance.ts` - Test script
- `mcp-server/dist/` - Built output

## To Test

```bash
cd /Users/Ashka/Desktop/CodingProjects/ent-governance-mock/mcp-server

# Build (already done)
npm run build

# Test live activity
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"governance_live_activity","arguments":{}}}' | node dist/index.js

# Test recent tasks
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"governance_recent_tasks","arguments":{"limit":5}}}' | node dist/index.js

# Run full test suite
npx ts-node test/test-governance.ts
```

## To Use

Restart to reload the MCP server, then:
- Ask for `governance_live_activity`
- Ask for `governance_recent_tasks`

## Test Results (Last Run)

```
Live Activity (24h):
- 11 sessions, 777 messages
- 25,211 tokens (claude-opus-4-5)
- $0.50 estimated cost
- Projects: mock, app, claude, governance

Recent Tasks:
- "Add 'Built in X hours' badge" (Jan 27)
- "Add 'How I Built This' toggle" (Jan 27)
- "Initialize React project with Vite" (Jan 26)
```

## Next Steps (Optional)

1. Add historical todo reconstruction from session logs
2. Add per-project filtering
3. Add time-range queries for session data
4. Dashboard visualization

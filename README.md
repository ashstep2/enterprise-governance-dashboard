# Enterprise Governance Platform

Governance, analytics, and compliance for AI-assisted development at scale.

[Quick Start](#quick-start) · [Documentation](#documentation) · [API Reference](#api-reference) · [Enterprise Setup](#enterprise-setup)

---

## Overview

Track usage, control costs, and maintain compliance across your organization's AI coding tool deployments.

- **Usage tracking** — Sessions, tasks, tokens, model breakdown
- **Cost management** — Real-time spend tracking, forecasting, budget alerts
- **Compliance** — Audit trails, exportable reports, policy enforcement

## Project Status

| Component | Status | Notes |
|-----------|--------|-------|
| HTML Dashboard | Working | Generates reports from task data |
| REST API | Working | Local server + Vercel serverless |
| Interactive CLI | Working | 10 commands |
| Python Analytics | Working | pandas/numpy |
| MCP Server | Scaffolded | Compiles, follows MCP spec |
| Docs | Complete | Product vision, pricing, GTM, metrics |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+ (for analytics)

### Installation

```bash
git clone https://github.com/your-org/enterprise-governance.git
cd enterprise-governance
npm install
```

### Run with Demo Data

```bash
# Generate HTML dashboard
npm run demo

# Start interactive CLI
npm run build && node dist/cli.js --demo

# Start API server
npm run server
```

### Run with Real Data

```bash
# Generate report from live usage data
npm run report

# Interactive CLI
npm run build && node dist/cli.js
```

### Deploy to Vercel

```bash
npm install
npx vercel dev       # local
npx vercel --prod    # production
```

Deploys:
- **Dashboard** at `/` — Interactive UI with guided walkthrough
- **API** at `/api/dashboard` — Single endpoint returning metrics, patterns, and tasks

## Project Structure

```
enterprise-governance/
├── src/                      # TypeScript source
│   ├── index.ts              # Entry point
│   ├── collector.ts          # Data aggregation
│   ├── generator.ts          # HTML report generator
│   ├── api.ts                # REST API server
│   └── cli.ts                # Interactive CLI
├── api/                      # Vercel serverless functions
│   ├── dashboard.ts          # Consolidated data endpoint
│   ├── metrics.ts            # Metrics endpoint
│   ├── tasks.ts              # Tasks endpoint
│   ├── data.ts               # Full data endpoint
│   ├── health.ts             # Health check
│   └── lib/data.ts           # Shared data layer
├── public/                   # Static frontend
│   └── index.html            # Interactive dashboard
├── analytics/                # Python analytics
│   ├── usage_analysis.py     # Pandas-based analytics
│   ├── cost_forecasting.py   # ML cost prediction
│   ├── queries.sql           # Enterprise SQL queries
│   └── governance_analysis.ipynb
├── mcp-server/               # MCP server integration
│   └── src/index.ts
├── mock-data/                # Sample data for demos
├── docs/                     # Product documentation
│   ├── PRODUCT_VISION.md
│   ├── PRICING_STRATEGY.md
│   ├── GTM_STRATEGY.md
│   └── METRICS_FRAMEWORK.md
├── output/                   # Generated reports
└── vercel.json               # Vercel config
```

## Features

### Dashboard

- KPI cards (sessions, tasks, tokens, cost)
- Status distribution bars
- Model usage breakdown
- Task pattern detection
- Recent activity table
- System health indicator
- Guided walkthrough (7 steps)

### Interactive CLI

```bash
$ node dist/cli.js --demo

governance> metrics
═══ KEY METRICS ═══
  Total Sessions:     7
  Total Tasks:        25
  Input Tokens:       456,800
  Output Tokens:      319,900
  Estimated Cost:     $6.17
  Completion Rate:    84.0%

governance> alerts
═══ GOVERNANCE ALERTS ═══
  ✓ No active alerts - system healthy

governance> export csv
  ✓ Exported to: output/governance-export.csv
```

### REST API

```bash
npm run server
# http://localhost:3000

# Local server endpoints:
GET /api/metrics       # Metrics summary
GET /api/data          # Full aggregated data
GET /api/tasks         # Recent tasks (?limit=N&status=X)
GET /api/alerts        # Alert status
GET /api/patterns      # Task patterns
GET /export/csv        # CSV export
GET /export/json       # JSON export
GET /export/html       # Dashboard export
GET /dashboard         # Live dashboard
GET /health            # Health check

# Vercel endpoints:
GET /api/dashboard     # Consolidated (metrics + patterns + tasks)
GET /api/metrics
GET /api/data
GET /api/tasks
GET /api/health
```

### Python Analytics

```bash
cd analytics
pip install -r requirements.txt

python usage_analysis.py --demo
python cost_forecasting.py --demo --budget 1000
```

### MCP Server

```bash
cd mcp-server
npm install && npm run build
npm start
```

Add to your MCP config:
```json
{
  "mcpServers": {
    "governance": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

Tools: `governance_metrics`, `governance_alerts`, `governance_model_usage`, `governance_recent_tasks`, `governance_cost_forecast`

## Documentation

| Document | Description |
|----------|-------------|
| [PRODUCT_VISION.md](docs/PRODUCT_VISION.md) | Market analysis, personas, competitive landscape, roadmap |
| [PRICING_STRATEGY.md](docs/PRICING_STRATEGY.md) | Tiered pricing, packaging, unit economics |
| [GTM_STRATEGY.md](docs/GTM_STRATEGY.md) | Market segmentation, sales motions, launch plan |
| [METRICS_FRAMEWORK.md](docs/METRICS_FRAMEWORK.md) | Metrics, health scores, dashboards |
| [queries.sql](analytics/queries.sql) | Enterprise SQL for Snowflake/BigQuery |
| [governance_analysis.ipynb](analytics/governance_analysis.ipynb) | Jupyter notebook with visualizations |

## Enterprise Setup

### Centralized Deployment

```bash
git clone <repo> /opt/governance
cd /opt/governance && npm install && npm run build

# Daily report via cron
0 6 * * * cd /opt/governance && npm run report && cp output/*.html /var/www/
```

### Multi-Tenant Aggregation

```bash
rsync -av user1@host1:~/.claude/todos/ /shared/tasks/user1/
rsync -av user2@host2:~/.claude/todos/ /shared/tasks/user2/

node dist/index.js --data-dir /shared/tasks
```

### Data Warehouse Integration

Load task data into Snowflake/BigQuery using `analytics/queries.sql` for:
- Executive dashboards
- Cost allocation
- Compliance audit trails

### Alerting (Slack example)

```bash
ALERTS=$(curl -s http://localhost:3000/api/alerts)
if echo "$ALERTS" | jq -e '.data.hasActiveAlerts'; then
  curl -X POST $SLACK_WEBHOOK -d '{"text":"Governance alert triggered"}'
fi
```

### SSO

Place behind a reverse proxy:

```nginx
location /governance {
    auth_request /auth;
    proxy_pass http://localhost:3000;
}
```

### Compliance

- **SOC 2** — Activity logging, access controls
- **ISO 27001** — Audit trails, operational security
- **GDPR** — Data export, retention policies

```bash
curl http://localhost:3000/api/data > compliance-export.json
```

## API Reference

### GET /api/dashboard

Consolidated endpoint (recommended for frontends):

```json
{
  "success": true,
  "metrics": {
    "totalTasks": 25,
    "totalSessions": 7,
    "totalCost": 6.65,
    "completionRate": 84,
    "tokenUsage": { "input": 483000, "output": 347500, "total": 830500 },
    "modelDistribution": { "sonnet-4": 17 },
    "statusDistribution": { "completed": 21, "in_progress": 2 }
  },
  "patterns": [
    { "key": "Implement user authentication", "count": 1 }
  ],
  "recentTasks": [
    { "content": "Create architecture decision records", "status": "in_progress" }
  ],
  "meta": { "timestamp": "2025-01-26T...", "version": "1.0.0" }
}
```

### GET /api/metrics

```json
{
  "success": true,
  "data": {
    "totalTasks": 25,
    "totalSessions": 7,
    "totalCost": 6.17,
    "completionRate": 84.0,
    "tokenUsage": { "input": 456800, "output": 319900, "total": 776700 },
    "modelDistribution": { "sonnet-4": 18, "haiku-3.5": 5, "opus-4": 2 }
  }
}
```

### GET /api/alerts

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "triggered": false,
        "type": "cost_threshold",
        "message": "Cost within threshold: $6.17",
        "currentValue": 6.17,
        "threshold": 100
      }
    ],
    "triggeredCount": 0,
    "hasActiveAlerts": false
  }
}
```

## Development

```bash
npm run build        # Build TypeScript
npm test             # Run tests
npm run mcp:build    # Build MCP server
```

## Roadmap

### Now

- [x] Task data collection and aggregation
- [x] Dashboard with guided walkthrough
- [x] REST API + Vercel deployment
- [x] CLI, Python analytics, MCP server
- [x] Cost estimation and alerting
- [x] Product strategy docs

### Next

- [ ] Authentication (OAuth2/SAML)
- [ ] PostgreSQL/Snowflake backend
- [ ] Multi-tenant data isolation
- [ ] Real-time streaming dashboard
- [ ] Custom policy engine
- [ ] SOC 2 certification path

### Later

- [ ] Self-hosted deployment option
- [ ] ML-based anomaly detection
- [ ] Custom report builder
- [ ] 99.9% SLA infrastructure

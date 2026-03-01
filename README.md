# Enterprise Governance Platform

<div align="center">

**Enterprise-grade governance, analytics, and compliance platform for agentic coding.**

[Quick Start](#quick-start) • [Documentation](#documentation) • [API Reference](#api-reference) • [Enterprise Setup](#enterprise-setup)

</div>

---

## Overview

This project provides comprehensive governance tooling for AI coding tool deployments at enterprise scale. It enables organizations to:

- **Track Usage** - Monitor task completion, model usage, and token consumption
- **Control Costs** - Real-time cost tracking with forecasting and budget alerts
- **Ensure Compliance** - Audit trails, compliance reports, and policy enforcement

Includes code, strategy documents, and GTM planning.

## Project Status

**This is a working prototype, not production software.**

| Component | Status | Notes |
|-----------|--------|-------|
| HTML Dashboard | Functional | Generates real reports from task data |
| REST API | Functional | Demo purposes only (no auth) |
| Vercel Deployment | Functional | Live serverless API + static dashboard |
| Interactive CLI | Functional | 10 commands |
| Python Analytics | Functional | pandas/numpy |
| MCP Server | Scaffolded | Compiles, follows MCP spec, not battle-tested |
| Docs | Complete | Product vision, pricing, GTM, metrics |

### What This Is and Isn't
- This IS a demo and protype to show the vision
- NOT Production-ready (no auth, no database, no tests)
- NOT scalable (reads JSON files per request)
- NOT officially supported (uses undocumented internals which can change at any time)

## Quick Start

### Prerequisites

- Node.js
- Python
- npm or yarn

### Installation

```bash
git clone https://github.com/your-org/enterprise-governance.git
cd enterprise-governance
npm install
```

### Try with Demo Data

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
# Generate report from your AI coding usage
npm run report

# Interactive CLI
npm run build && node dist/cli.js
```

### Deploy to Vercel

Deploy a live, shareable dashboard with serverless API:

```bash
# Install dependencies
npm install

# Test locally
npx vercel dev

# Deploy to production
npx vercel --prod
```

This deploys:
- **Dashboard** at `/` - Interactive UI with guided walkthrough (badges 1-7)
- **API** at `/api/dashboard` - Single endpoint returning all metrics, patterns, and tasks

## Project Structure

```
enterprise-governance/
├── src/                      # TypeScript source (local server)
│   ├── index.ts              # Main entry point
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
├── public/                   # Vercel static frontend
│   └── index.html            # Interactive dashboard
├── analytics/                # Python analytics
│   ├── usage_analysis.py     # Pandas-based analytics
│   ├── cost_forecasting.py   # ML cost prediction
│   ├── queries.sql           # Enterprise SQL queries
│   └── governance_analysis.ipynb  # Jupyter notebook
├── mcp-server/               # MCP server integration
│   └── src/index.ts          # MCP server implementation
├── mock-data/                # Sample data for demos
├── docs/                     # Product documentation
│   ├── PRODUCT_VISION.md     # Product strategy
│   ├── PRICING_STRATEGY.md   # Pricing & packaging
│   ├── GTM_STRATEGY.md       # Go-to-market plan
│   └── METRICS_FRAMEWORK.md  # Success metrics
├── output/                   # Generated reports
└── vercel.json               # Vercel deployment config
```

## Features

### Dashboard

Interactive HTML dashboard with:
- KPI cards (sessions, tasks, tokens, cost)
- Status distribution visualization
- Model usage breakdown
- Task pattern detection
- Recent activity timeline
- System health indicator

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
# Server running at http://localhost:3000

# Endpoints (local server):
GET /api/metrics     # Key metrics summary
GET /api/data        # Full aggregated data
GET /api/tasks       # Recent tasks (supports ?limit=N&status=X)
GET /api/alerts      # Check alert status
GET /api/patterns    # Task patterns
GET /export/csv      # Export as CSV
GET /export/json     # Export as JSON
GET /export/html     # Export dashboard
GET /dashboard       # Live dashboard
GET /health          # Health check

# Vercel serverless endpoints:
GET /api/dashboard   # Consolidated endpoint (metrics + patterns + tasks)
GET /api/metrics     # Key metrics summary
GET /api/data        # Full aggregated data
GET /api/tasks       # Recent tasks (supports ?limit=N&status=X)
GET /api/health      # Health check
```

### Python Analytics

```bash
cd analytics
pip install -r requirements.txt

# Usage analysis
python usage_analysis.py --demo

# Cost forecasting
python cost_forecasting.py --demo --budget 1000
```

### MCP Server

Native MCP integration:

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

Available tools:
- `governance_metrics` - Get usage metrics
- `governance_alerts` - Check alerts
- `governance_model_usage` - Model breakdown
- `governance_recent_tasks` - Recent tasks
- `governance_cost_forecast` - Cost projections

## Documentation

### Product Strategy

| Document | Description |
|----------|-------------|
| [PRODUCT_VISION.md](docs/PRODUCT_VISION.md) | Market analysis, personas, competitive landscape, roadmap |
| [PRICING_STRATEGY.md](docs/PRICING_STRATEGY.md) | Tiered pricing, packaging, unit economics |
| [GTM_STRATEGY.md](docs/GTM_STRATEGY.md) | Market segmentation, sales motions, launch plan |
| [METRICS_FRAMEWORK.md](docs/METRICS_FRAMEWORK.md) | Metrics, health scores, dashboards |

### Technical Documentation

| Component | Description |
|-----------|-------------|
| [analytics/queries.sql](analytics/queries.sql) | Enterprise SQL queries for Snowflake/BigQuery |
| [analytics/governance_analysis.ipynb](analytics/governance_analysis.ipynb) | Jupyter notebook with visualizations |

## Enterprise Setup

### 1. Centralized Deployment

```bash
# Deploy to internal infrastructure
git clone <repo> /opt/governance
cd /opt/governance && npm install && npm run build

# Cron job for daily reports
0 6 * * * cd /opt/governance && npm run report && cp output/*.html /var/www/
```

### 2. Multi-Tenant Aggregation

```bash
# Sync from multiple workstations
rsync -av user1@host1:~/.claude/todos/ /shared/claude-tasks/user1/
rsync -av user2@host2:~/.claude/todos/ /shared/claude-tasks/user2/

# Run against aggregated data
node dist/index.js --data-dir /shared/claude-tasks
```

### 3. Data Warehouse Integration

Load task data into Snowflake/BigQuery using the schema in `analytics/queries.sql`, then run the provided queries for:
- Executive dashboards
- Cost allocation
- Compliance audit trails

### 4. Alerting Integration

```bash
# ex. Slack webhook on high failure rate
ALERTS=$(curl -s http://localhost:3000/api/alerts)
if echo "$ALERTS" | jq -e '.data.hasActiveAlerts'; then
  curl -X POST $SLACK_WEBHOOK -d '{"text":"Governance alert triggered"}'
fi
```

### 5. SSO Integration

The API server can be placed behind a reverse proxy with SSO:

```nginx
location /governance {
    auth_request /auth;
    proxy_pass http://localhost:3000;
}
```

### 6. Compliance

The platform provides:
- **SOC 2**: Activity logging, access controls
- **ISO 27001**: Audit trails, operational security
- **GDPR**: Data export, retention policies

Generate compliance reports:
```bash
curl http://localhost:3000/api/data > compliance-export.json
```

## API Reference

### Dashboard Endpoint (Vercel - Recommended)

Single consolidated endpoint optimized for fast loading (one cold start instead of multiple):

```bash
GET /api/dashboard
```

Response:
```json
{
  "success": true,
  "metrics": {
    "totalTasks": 25,
    "totalSessions": 7,
    "totalCost": 6.65,
    "completionRate": 84,
    "tokenUsage": { "input": 483000, "output": 347500, "total": 830500 },
    "modelDistribution": { "claude-sonnet-4-20250514": 17, "...": "..." },
    "statusDistribution": { "completed": 21, "in_progress": 2, "...": "..." }
  },
  "patterns": [
    { "key": "Implement user authentication", "count": 1 },
    { "key": "Add JWT token", "count": 1 }
  ],
  "recentTasks": [
    { "content": "Create architecture decision records", "status": "in_progress", "..." : "..." }
  ],
  "meta": { "timestamp": "2025-01-26T...", "version": "1.0.0" }
}
```

### Metrics Endpoint

```bash
GET /api/metrics
```

Response:
```json
{
  "success": true,
  "data": {
    "totalTasks": 25,
    "totalSessions": 7,
    "totalCost": 6.17,
    "completionRate": 84.0,
    "tokenUsage": {
      "input": 456800,
      "output": 319900,
      "total": 776700
    },
    "modelDistribution": {
      "claude-sonnet-4-20250514": 18,
      "claude-haiku-3-5-20241022": 5,
      "claude-opus-4-20250514": 2
    }
  }
}
```

### Alerts Endpoint

```bash
GET /api/alerts
```

Response:
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
# Build TypeScript
npm run build

# Run tests
npm test

# Build MCP server
npm run mcp:build
```

## Roadmap to Production

### Current State: Working Prototype

This project is a **functional proof-of-concept** demonstrating product vision and technical architecture. It is not production-ready enterprise software.

### Blockers for Enterprise Adoption

#### 🔴 Critical Blockers

| Blocker | Issue | Path to Resolution |
|---------|-------|-------------------|
| **No Official Data API** | Reads from `~/.claude/todos/` which is an undocumented internal format that could change anytime | Requires an official telemetry API |
| **No Authentication** | API server has no auth; anyone with network access can read data | Implement OAuth2/SAML, integrate with enterprise IdP |
| **No Production Security** | No encryption, no RBAC, no audit logging for the tool itself | Security hardening, threat modeling |

#### 🟡 Gaps

| Gap | Current State | Enterprise Requirement |
|-----|---------------|----------------------|
| **Scalability** | Reads JSON files per-request | PostgreSQL/Snowflake backend with intelligent caching |
| **Multi-tenancy** | Single-tenant only | Org/team isolation |
| **Compliance** | Documented mappings | SOC 2 certification, HIPAA BAA |
| **High Availability** | Single-node | Redundant deployment, 99.9% SLA |
| **Observability** | Console logs only | Structured logging + alerts |

#### 🟢 Demonstrated

- Product vision
- Pricing
- GTM strategy
- Technical architecture
- API design high-level
- MCP integration pattern 
- Enterprise feature requirements

### Getting this launched to the enterprise

```
Quarter 1: Foundation
├── Partner with AI provider for official usage data API
├── Implement backend with proper schema
├── Add authentication
├── Deploy on AWS/GCP
└── Work with security experts re: threat model

Quarter 2: Enterprise Ready
├── SOC 2 certification
├── Multi-tenant architecture
├── Real-time data streaming
└── Customer pilot program (10 design partners)

Quarter 3: Scale
├── Self-hosted deployment option
├── 99.9% SLA infrastructure
├── GA launch
└── First enterprise contracts
```

Building this could occur in 2 primary ways:
1. AI provider building this as a first-party feature (expose a governance API + layer on top) - Recommended
2. AI coding tools adding a plugin/extension architecture for telemetry (each company owns their own implementation - less sticky)

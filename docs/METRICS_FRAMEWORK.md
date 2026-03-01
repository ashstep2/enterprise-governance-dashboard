# Metrics Framework: Enterprise AI Coding Governance

This document defines the metrics framework for measuring the success of Enterprise AI Coding Governance.

## North Star Metric

### **Weekly Active Users (WAU) or Weekly Active Governance Developers (WAGD)**

> The number of developers whose AI coding tool usage is tracked through an enterprise governance dashboard, measured weekly.

**Why this metric?**
- Indicator of revenue (correlated with seat count)
- Actionable (can be influenced by product, sales, and CS)
- Defensible (governance is our moat)
- Captures both adoption (developers using AI coding tools) AND enterprise value (governance enabled)

**Target**: 50K WAU/WAGD by end of Year 1

## Metric Categories

### 1. Acquisition Metrics

How effectively we attract enterprise prospects.

| Metric | Definition | Target | Owner |
|--------|------------|--------|-------|
| Marketing Qualified Leads (MQLs) | Leads meeting firmographic + behavioral criteria | 500/month | Marketing |
| Sales Qualified Leads (SQLs) | MQLs that pass discovery call | 150/month | Sales |
| Trial Starts | New governance dashboard deployments | 100/month | Product |

### 2. Activation Metrics

How effectively users experience core value.

| Metric | Definition | Target | Owner |
|--------|------------|--------|-------|
| Time to First Dashboard | Hours from signup to dashboard view | <2 hours | Product |
| First 2 Weeks Engagement | % of users active 5+ days in 2 weeks | >60% | Product |
| Key Feature Adoption | % using exports, alerts, or API | >50% | Product |

**Activation Milestones (Enterprise)**:
1. Dashboard deployed (Day 1)
2. 10+ users connected (Day 3)
3. Dashboards accessed >5 times and 20% of features clicked through (Day 7)
4. Permissioning or auth layer added (Day 14)
5. Executive report shared (Day 30)

### 3. Engagement Metrics

How actively customers use the platform.

| Metric | Definition | Target | Owner |
|--------|------------|--------|-------|
| Daily Active Users (DAU) | Unique users/day with AI coding activity | Track | Product |
| Dashboard Views/Week | Average weekly dashboard views per account | >5 | Product |
| API Calls/Week | Average weekly API calls per account | >100 | Product |
| Feature Depth Score | # of features used / total available | >40% | Product |

**Engagement Segments**:
- **Power Users**: Daily dashboard access, API integration, custom alerts, admins potentially
- **Regular Users**: Weekly dashboard check, monthly exports
- **Light Users**: Monthly or less (at risk)
- **Dormant**: No activity in 30+ days (churn risk)

### 4. Retention Metrics

| Metric | Definition | Target | Owner |
|--------|------------|--------|-------|
| Gross Revenue Retention (GRR) | Revenue retained excluding expansion | >90% | CS |
| Logo Retention | % of customers retained | >85% | CS |
| Net Revenue Retention (NRR) | Revenue retained including expansion | >120% | CS |
| Churn Rate (Monthly) | % of ARR churned | <5% | CS |

**Churn Reasons**:
1. Competitor switch
2. Budget cut
3. Project ended
4. Product / feature gaps
5. Poor support
6. Champion left

### 5. Revenue Metrics


| Metric | Definition | Target | Owner |
|--------|------------|--------|-------|
| Annual Recurring Revenue (ARR) | Total annualized contract value | $6M Y1 | Sales |
| Monthly Recurring Revenue (MRR) | Total monthly contract value | $500K Y1 | Sales |
| Average Contract Value (ACV) | Average new deal size | $150K | Sales |
| Average Revenue Per User (ARPU) | ARR / total seats | $50/mo | Finance |
| Expansion Revenue | Revenue from existing customers | 30% of new | CS |
| LTV:CAC | Lifetime value / acquisition cost | >3:1 | Finance |

### 6. Product Quality Metrics

Platform reliability and performance.

| Metric | Definition | Target | Owner |
|--------|------------|--------|-------|
| Uptime SLA | % of time dashboard accessible | >99.9% | Eng |
| Dashboard Load Time | P95 page load time | <2s | Eng |
| API Latency | P95 API response time | <500ms | Eng |
| Data Freshness | Lag in task data reflection | <5 min | Eng |
| Error Rate | % of requests resulting in errors | <0.5% | Eng |
| Support Ticket Volume | Tickets per 100 users/month | <5 | Support |

## Customer Health Score

Composite score predicting churn risk and expansion potential.

### Health Score Components

| Component | Weight | Calculation |
|-----------|--------|-------------|
| **Engagement** | 35% | (DAU / total seats) |
| **Adoption** | 30% | (features used / total features) |
| **Growth** | 20% | (seat increase % over a set of days) |
| **Satisfaction** | 15% | (NPS, normalized) |

### Health Score Interpretation

| Score | Label | Action |
|-------|-------|--------|
| 90-100 | Champion | Expansion outreach, case study request |
| 75-89 | Healthy | Standard engagement, QBR prep |
| 60-74 | Needs Attention | CSM intervention, feature training, hands-on training or webinars/engagement |
| 40-59 | At Risk | Executive outreach + action a "save" plan |
| 0-39 | Critical | Escalation, potential offboarding |

## Dashboards & Reporting

### Executive Dashboard (Weekly)

```
┌─────────────────────────────────────────────────────────────┐
│  CLAUDE CODE ENTERPRISE - EXECUTIVE SUMMARY                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  NORTH STAR                  REVENUE                        │
│  ┌─────────────────┐        ┌─────────────────┐             │
│  │ WAU: 20K        │        │ ARR: $2.49M     │             │
│  │ ▲ +33% WoW      │        │ ▲ +12% MoM      │             │
│  └─────────────────┘        └─────────────────┘             │
│  ACQUISITION          RETENTION           ENGAGEMENT        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Engaged: 12  │    │ NRR: 118%    │    │ DAU: 10K     │   │
│  │ vs 150 target│    │ vs 120%      │    │  X% of seats │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                             │
│  HEALTH DISTRIBUTION                                        │
│  Champion ████████████████░░░░ 42%                          │
│  Healthy  ████████████░░░░░░░░ 31%                          │
│  Attention████████░░░░░░░░░░░░ 18%                          │
│  At Risk  ████░░░░░░░░░░░░░░░░  7%                          │
│  Critical ██░░░░░░░░░░░░░░░░░░  2%                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Product Dashboard (Daily)

Key real-time metrics:
- Active users (hourly)
- API call volume
- Error rates
- Feature usage metrics
- New user onboarding funnel
- Ability to deep dive per key customer or segment (industry/size/etc)

### CS Dashboard (Daily)

Account-level view:
- Health score
- Current status (seats, plans, key stakeholders, etc)
- Engagement trends
- Support ticket count/status
- Renewal calendar
- Expansion pipeline potential and if the customer's usage is tracking

### Sales Dashboard (Daily)

Pipeline and performance:
- Stage progression
- Win/loss/churn analysis
- Competitive company intelligence (feature parity, etc)

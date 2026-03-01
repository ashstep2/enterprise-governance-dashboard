-- ============================================================================
-- Enterprise Governance - SQL Analytics Queries
-- ============================================================================
-- These queries are designed for enterprise data warehouses (Snowflake, BigQuery,
-- Redshift) where AI coding task data has been loaded for centralized analysis.
--
-- Schema assumes tasks are loaded into a `ai_governance.tasks` table with the
-- following structure. Adjust table names for your data warehouse.
-- ============================================================================

-- ============================================================================
-- TABLE SCHEMA (DDL)
-- ============================================================================

-- Create schema
CREATE SCHEMA IF NOT EXISTS claude_code;

-- Main tasks table
CREATE TABLE IF NOT EXISTS ai_governance.tasks (
    task_id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64),
    team_id VARCHAR(64),
    organization_id VARCHAR(64),
    content TEXT,
    status VARCHAR(20),
    task_type VARCHAR(50),
    model VARCHAR(100),
    tokens_input BIGINT DEFAULT 0,
    tokens_output BIGINT DEFAULT 0,
    cost_input DECIMAL(10, 6),
    cost_output DECIMAL(10, 6),
    cost_total DECIMAL(10, 6),
    created_at TIMESTAMP,
    completed_at TIMESTAMP,
    source_file VARCHAR(255),
    metadata VARIANT,  -- JSON column for flexible data (Snowflake syntax)
    ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tasks_org_date ON ai_governance.tasks(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON ai_governance.tasks(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON ai_governance.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_model ON ai_governance.tasks(model);


-- ============================================================================
-- EXECUTIVE DASHBOARD QUERIES
-- ============================================================================

-- 1. Organization-wide summary metrics
-- Returns key KPIs for executive dashboard
SELECT
    COUNT(DISTINCT session_id) AS total_sessions,
    COUNT(*) AS total_tasks,
    COUNT(DISTINCT user_id) AS active_users,
    SUM(tokens_input) AS total_tokens_input,
    SUM(tokens_output) AS total_tokens_output,
    SUM(cost_total) AS total_cost,
    AVG(cost_total) AS avg_cost_per_task,
    ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::DECIMAL /
          NULLIF(COUNT(*), 0) * 100, 2) AS completion_rate_pct
FROM ai_governance.tasks
WHERE organization_id = :org_id
  AND created_at >= DATEADD(day, -30, CURRENT_DATE);


-- 2. Daily usage trend (last 30 days)
-- For time-series charts
SELECT
    DATE_TRUNC('day', created_at) AS date,
    COUNT(*) AS task_count,
    COUNT(DISTINCT user_id) AS active_users,
    SUM(tokens_input + tokens_output) AS total_tokens,
    SUM(cost_total) AS daily_cost
FROM ai_governance.tasks
WHERE organization_id = :org_id
  AND created_at >= DATEADD(day, -30, CURRENT_DATE)
GROUP BY 1
ORDER BY 1;


-- 3. Cost by team breakdown
-- For cost allocation and chargeback
SELECT
    t.team_id,
    tm.team_name,  -- Join with teams dimension table
    COUNT(*) AS task_count,
    COUNT(DISTINCT t.user_id) AS active_users,
    SUM(t.cost_total) AS total_cost,
    ROUND(SUM(t.cost_total) / NULLIF(COUNT(DISTINCT t.user_id), 0), 2) AS cost_per_user,
    ROUND(SUM(t.cost_total) / SUM(SUM(t.cost_total)) OVER () * 100, 2) AS pct_of_total
FROM ai_governance.tasks t
LEFT JOIN ai_governance.teams tm ON t.team_id = tm.team_id
WHERE t.organization_id = :org_id
  AND t.created_at >= DATEADD(day, -30, CURRENT_DATE)
GROUP BY 1, 2
ORDER BY total_cost DESC;


-- ============================================================================
-- MODEL USAGE ANALYTICS
-- ============================================================================

-- 4. Model usage distribution
-- Shows which models teams are using
SELECT
    model,
    COUNT(*) AS task_count,
    COUNT(DISTINCT user_id) AS unique_users,
    SUM(tokens_input) AS total_input_tokens,
    SUM(tokens_output) AS total_output_tokens,
    SUM(cost_total) AS total_cost,
    ROUND(AVG(tokens_input + tokens_output), 0) AS avg_tokens_per_task,
    ROUND(SUM(cost_total) / NULLIF(COUNT(*), 0), 4) AS avg_cost_per_task
FROM ai_governance.tasks
WHERE organization_id = :org_id
  AND created_at >= DATEADD(day, -30, CURRENT_DATE)
GROUP BY 1
ORDER BY total_cost DESC;


-- 5. Model efficiency comparison
-- Helps optimize model selection
SELECT
    model,
    task_type,
    COUNT(*) AS task_count,
    ROUND(AVG(cost_total), 4) AS avg_cost,
    ROUND(AVG(tokens_output::DECIMAL / NULLIF(tokens_input, 0)), 2) AS output_input_ratio,
    ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::DECIMAL /
          NULLIF(COUNT(*), 0) * 100, 2) AS success_rate,
    -- Cost per completed task (true efficiency)
    ROUND(SUM(cost_total) / NULLIF(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0), 4)
        AS cost_per_completion
FROM ai_governance.tasks
WHERE organization_id = :org_id
  AND created_at >= DATEADD(day, -30, CURRENT_DATE)
GROUP BY 1, 2
HAVING COUNT(*) >= 10  -- Only statistically significant samples
ORDER BY 1, cost_per_completion;


-- ============================================================================
-- USER ANALYTICS
-- ============================================================================

-- 6. User productivity leaderboard
-- Top users by task completion
SELECT
    u.user_id,
    u.user_email,
    u.team_name,
    COUNT(*) AS total_tasks,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
    ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::DECIMAL /
          NULLIF(COUNT(*), 0) * 100, 2) AS completion_rate,
    SUM(cost_total) AS total_cost,
    COUNT(DISTINCT DATE_TRUNC('day', created_at)) AS active_days
FROM ai_governance.tasks t
JOIN ai_governance.users u ON t.user_id = u.user_id
WHERE t.organization_id = :org_id
  AND t.created_at >= DATEADD(day, -30, CURRENT_DATE)
GROUP BY 1, 2, 3
ORDER BY completed_tasks DESC
LIMIT 20;


-- 7. User engagement cohort analysis
-- Weekly retention by signup cohort
WITH user_first_week AS (
    SELECT
        user_id,
        DATE_TRUNC('week', MIN(created_at)) AS cohort_week
    FROM ai_governance.tasks
    WHERE organization_id = :org_id
    GROUP BY 1
),
user_activity AS (
    SELECT
        t.user_id,
        ufw.cohort_week,
        DATE_TRUNC('week', t.created_at) AS activity_week,
        DATEDIFF('week', ufw.cohort_week, DATE_TRUNC('week', t.created_at)) AS weeks_since_first
    FROM ai_governance.tasks t
    JOIN user_first_week ufw ON t.user_id = ufw.user_id
    WHERE t.organization_id = :org_id
)
SELECT
    cohort_week,
    weeks_since_first,
    COUNT(DISTINCT user_id) AS active_users,
    ROUND(COUNT(DISTINCT user_id)::DECIMAL /
          FIRST_VALUE(COUNT(DISTINCT user_id)) OVER (
              PARTITION BY cohort_week ORDER BY weeks_since_first
          ) * 100, 2) AS retention_pct
FROM user_activity
WHERE weeks_since_first <= 12
GROUP BY 1, 2
ORDER BY 1, 2;


-- ============================================================================
-- COMPLIANCE & AUDIT QUERIES
-- ============================================================================

-- 8. Audit log query
-- Full audit trail for compliance
SELECT
    task_id,
    session_id,
    user_id,
    created_at AS timestamp,
    model,
    task_type,
    status,
    content,
    tokens_input,
    tokens_output,
    cost_total,
    source_file
FROM ai_governance.tasks
WHERE organization_id = :org_id
  AND created_at BETWEEN :start_date AND :end_date
ORDER BY created_at DESC;


-- 9. Policy violation detection
-- Find usage that may violate organizational policies
SELECT
    t.task_id,
    t.user_id,
    u.user_email,
    t.model,
    t.created_at,
    t.cost_total,
    CASE
        WHEN t.model LIKE '%opus%' AND u.role NOT IN ('senior_engineer', 'staff_engineer', 'manager')
            THEN 'Unauthorized Opus usage'
        WHEN t.cost_total > 1.00
            THEN 'High cost task'
        WHEN EXTRACT(HOUR FROM t.created_at) NOT BETWEEN 6 AND 22
            THEN 'Off-hours usage'
        ELSE NULL
    END AS violation_type
FROM ai_governance.tasks t
JOIN ai_governance.users u ON t.user_id = u.user_id
WHERE t.organization_id = :org_id
  AND t.created_at >= DATEADD(day, -7, CURRENT_DATE)
  AND (
      (t.model LIKE '%opus%' AND u.role NOT IN ('senior_engineer', 'staff_engineer', 'manager'))
      OR t.cost_total > 1.00
      OR EXTRACT(HOUR FROM t.created_at) NOT BETWEEN 6 AND 22
  )
ORDER BY t.created_at DESC;


-- 10. Data residency compliance
-- Ensure data processed in correct regions
SELECT
    DATE_TRUNC('day', created_at) AS date,
    -- Assumes region metadata is captured
    metadata:region::VARCHAR AS processing_region,
    COUNT(*) AS task_count,
    SUM(tokens_input + tokens_output) AS total_tokens
FROM ai_governance.tasks
WHERE organization_id = :org_id
  AND created_at >= DATEADD(day, -30, CURRENT_DATE)
GROUP BY 1, 2
ORDER BY 1, 2;


-- ============================================================================
-- COST MANAGEMENT QUERIES
-- ============================================================================

-- 11. Budget burn rate analysis
WITH daily_costs AS (
    SELECT
        DATE_TRUNC('day', created_at) AS date,
        SUM(cost_total) AS daily_cost
    FROM ai_governance.tasks
    WHERE organization_id = :org_id
      AND created_at >= DATEADD(day, -30, CURRENT_DATE)
    GROUP BY 1
),
budget AS (
    SELECT 1000.00 AS monthly_budget  -- Parameterize this
)
SELECT
    dc.date,
    dc.daily_cost,
    SUM(dc.daily_cost) OVER (ORDER BY dc.date) AS cumulative_cost,
    b.monthly_budget,
    ROUND(SUM(dc.daily_cost) OVER (ORDER BY dc.date) / b.monthly_budget * 100, 2) AS budget_used_pct,
    ROUND(AVG(dc.daily_cost) OVER (ORDER BY dc.date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2)
        AS rolling_7d_avg,
    ROUND(AVG(dc.daily_cost) OVER () * 30, 2) AS projected_monthly
FROM daily_costs dc
CROSS JOIN budget b
ORDER BY dc.date;


-- 12. Cost anomaly detection
-- Identify unusual spending patterns
WITH daily_stats AS (
    SELECT
        DATE_TRUNC('day', created_at) AS date,
        SUM(cost_total) AS daily_cost
    FROM ai_governance.tasks
    WHERE organization_id = :org_id
      AND created_at >= DATEADD(day, -90, CURRENT_DATE)
    GROUP BY 1
),
statistics AS (
    SELECT
        AVG(daily_cost) AS mean_cost,
        STDDEV(daily_cost) AS stddev_cost
    FROM daily_stats
)
SELECT
    ds.date,
    ds.daily_cost,
    s.mean_cost,
    ROUND((ds.daily_cost - s.mean_cost) / NULLIF(s.stddev_cost, 0), 2) AS z_score,
    CASE
        WHEN (ds.daily_cost - s.mean_cost) / NULLIF(s.stddev_cost, 0) > 2 THEN 'HIGH_ANOMALY'
        WHEN (ds.daily_cost - s.mean_cost) / NULLIF(s.stddev_cost, 0) > 1.5 THEN 'ELEVATED'
        WHEN (ds.daily_cost - s.mean_cost) / NULLIF(s.stddev_cost, 0) < -1.5 THEN 'LOW_ANOMALY'
        ELSE 'NORMAL'
    END AS anomaly_status
FROM daily_stats ds
CROSS JOIN statistics s
WHERE ds.date >= DATEADD(day, -30, CURRENT_DATE)
ORDER BY ds.date DESC;


-- ============================================================================
-- PATTERN ANALYSIS QUERIES
-- ============================================================================

-- 13. Task pattern extraction
-- Identify common task types from content
SELECT
    -- Extract first 3 words as pattern
    REGEXP_REPLACE(
        TRIM(SPLIT_PART(content, ' ', 1) || ' ' ||
             SPLIT_PART(content, ' ', 2) || ' ' ||
             SPLIT_PART(content, ' ', 3)),
        '[^a-zA-Z0-9 ]', ''
    ) AS task_pattern,
    COUNT(*) AS frequency,
    ROUND(AVG(cost_total), 4) AS avg_cost,
    ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::DECIMAL /
          NULLIF(COUNT(*), 0) * 100, 2) AS success_rate
FROM ai_governance.tasks
WHERE organization_id = :org_id
  AND created_at >= DATEADD(day, -30, CURRENT_DATE)
  AND content IS NOT NULL
GROUP BY 1
HAVING COUNT(*) >= 5
ORDER BY frequency DESC
LIMIT 20;


-- 14. Peak usage hours
-- Identify when teams are most active
SELECT
    EXTRACT(HOUR FROM created_at) AS hour_of_day,
    EXTRACT(DOW FROM created_at) AS day_of_week,
    COUNT(*) AS task_count,
    SUM(cost_total) AS total_cost,
    COUNT(DISTINCT user_id) AS unique_users
FROM ai_governance.tasks
WHERE organization_id = :org_id
  AND created_at >= DATEADD(day, -30, CURRENT_DATE)
GROUP BY 1, 2
ORDER BY 2, 1;


-- ============================================================================
-- FORECASTING SUPPORT QUERIES
-- ============================================================================

-- 15. Time series data for ML forecasting
-- Export for Python/ML processing
SELECT
    DATE_TRUNC('day', created_at) AS date,
    COUNT(*) AS task_count,
    COUNT(DISTINCT user_id) AS active_users,
    COUNT(DISTINCT session_id) AS sessions,
    SUM(tokens_input) AS total_input_tokens,
    SUM(tokens_output) AS total_output_tokens,
    SUM(cost_total) AS total_cost,
    AVG(cost_total) AS avg_cost_per_task,
    EXTRACT(DOW FROM DATE_TRUNC('day', created_at)) AS day_of_week,
    CASE WHEN EXTRACT(DOW FROM DATE_TRUNC('day', created_at)) IN (0, 6) THEN 1 ELSE 0 END AS is_weekend
FROM ai_governance.tasks
WHERE organization_id = :org_id
  AND created_at >= DATEADD(day, -90, CURRENT_DATE)
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY 1;


-- ============================================================================
-- HEALTH SCORE CALCULATION
-- ============================================================================

-- 16. Account health score components
-- Used for customer success monitoring
WITH usage_metrics AS (
    SELECT
        organization_id,
        COUNT(DISTINCT user_id) AS total_users,
        COUNT(DISTINCT CASE
            WHEN created_at >= DATEADD(day, -7, CURRENT_DATE) THEN user_id
        END) AS weekly_active_users,
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_tasks
    FROM ai_governance.tasks
    WHERE created_at >= DATEADD(day, -30, CURRENT_DATE)
    GROUP BY 1
),
feature_adoption AS (
    SELECT
        organization_id,
        COUNT(DISTINCT model) AS models_used,
        COUNT(DISTINCT task_type) AS task_types_used
    FROM ai_governance.tasks
    WHERE created_at >= DATEADD(day, -30, CURRENT_DATE)
    GROUP BY 1
)
SELECT
    um.organization_id,
    um.total_users,
    um.weekly_active_users,
    -- Engagement score (0-100)
    ROUND(LEAST(100, um.weekly_active_users::DECIMAL / NULLIF(um.total_users, 0) * 100), 0)
        AS engagement_score,
    -- Completion score (0-100)
    ROUND(um.completed_tasks::DECIMAL / NULLIF(um.total_tasks, 0) * 100, 0)
        AS completion_score,
    -- Feature adoption score (0-100)
    ROUND(LEAST(100, (fa.models_used * 20 + fa.task_types_used * 10)), 0)
        AS adoption_score,
    -- Overall health score (weighted average)
    ROUND(
        (LEAST(100, um.weekly_active_users::DECIMAL / NULLIF(um.total_users, 0) * 100) * 0.4) +
        (um.completed_tasks::DECIMAL / NULLIF(um.total_tasks, 0) * 100 * 0.3) +
        (LEAST(100, (fa.models_used * 20 + fa.task_types_used * 10)) * 0.3)
    , 0) AS health_score
FROM usage_metrics um
JOIN feature_adoption fa ON um.organization_id = fa.organization_id;


-- ============================================================================
-- DATA EXPORT VIEWS
-- ============================================================================

-- 17. Create materialized view for dashboard performance
CREATE OR REPLACE VIEW ai_governance.v_daily_summary AS
SELECT
    organization_id,
    DATE_TRUNC('day', created_at) AS date,
    COUNT(*) AS task_count,
    COUNT(DISTINCT user_id) AS active_users,
    COUNT(DISTINCT session_id) AS sessions,
    SUM(cost_total) AS total_cost,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_tasks
FROM ai_governance.tasks
GROUP BY 1, 2;


-- 18. Create view for SIEM export
CREATE OR REPLACE VIEW ai_governance.v_audit_log AS
SELECT
    task_id AS event_id,
    'ai_governance.task' AS event_type,
    created_at AS event_time,
    organization_id,
    user_id,
    session_id,
    model AS resource_type,
    status AS event_status,
    cost_total AS cost_usd,
    OBJECT_CONSTRUCT(
        'tokens_input', tokens_input,
        'tokens_output', tokens_output,
        'task_type', task_type,
        'source_file', source_file
    ) AS event_details
FROM ai_governance.tasks;

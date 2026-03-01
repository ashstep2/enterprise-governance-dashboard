#!/usr/bin/env python3
"""
Enterprise Governance - Usage Analysis

This module provides comprehensive analytics for AI coding task data,
including usage patterns, cost analysis, and productivity metrics.

Author: Enterprise Governance Team
"""

import json
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass

import pandas as pd
import numpy as np
from dateutil import parser as date_parser


# Default paths
DEFAULT_TASKS_DIR = Path.home() / ".claude" / "todos"
MOCK_DATA_DIR = Path(__file__).parent.parent / "mock-data"

# Cost constants (LLM API pricing)
COST_PER_M_INPUT = {
    "claude-haiku-3-5-20241022": 0.25,
    "claude-sonnet-4-20250514": 3.0,
    "claude-opus-4-20250514": 15.0,
    "default": 3.0
}

COST_PER_M_OUTPUT = {
    "claude-haiku-3-5-20241022": 1.25,
    "claude-sonnet-4-20250514": 15.0,
    "claude-opus-4-20250514": 75.0,
    "default": 15.0
}


@dataclass
class AnalyticsConfig:
    """Configuration for analytics processing."""
    data_dir: Path
    use_mock: bool = False
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


class TaskDataLoader:
    """Loads and preprocesses AI coding task data."""

    def __init__(self, config: AnalyticsConfig):
        self.config = config
        self.raw_data = []

    def load(self) -> pd.DataFrame:
        """Load all task files into a DataFrame."""
        data_dir = MOCK_DATA_DIR if self.config.use_mock else self.config.data_dir

        if not data_dir.exists():
            print(f"Warning: Directory {data_dir} does not exist")
            return pd.DataFrame()

        tasks = []
        for file_path in data_dir.glob("*.json"):
            try:
                with open(file_path, 'r') as f:
                    content = json.load(f)

                # Handle both array and single object formats
                entries = content if isinstance(content, list) else [content]

                for entry in entries:
                    entry['_source_file'] = file_path.name
                    tasks.append(entry)

            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Could not read {file_path}: {e}")

        if not tasks:
            return pd.DataFrame()

        df = pd.DataFrame(tasks)
        return self._preprocess(df)

    def _preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and enrich the DataFrame."""
        # Parse timestamps
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
            df['date'] = df['timestamp'].dt.date
            df['hour'] = df['timestamp'].dt.hour
            df['day_of_week'] = df['timestamp'].dt.day_name()

        # Extract token counts
        if 'tokens' in df.columns:
            df['tokens_input'] = df['tokens'].apply(
                lambda x: x.get('input', 0) if isinstance(x, dict) else 0
            )
            df['tokens_output'] = df['tokens'].apply(
                lambda x: x.get('output', 0) if isinstance(x, dict) else 0
            )
            df['tokens_total'] = df['tokens_input'] + df['tokens_output']
        else:
            df['tokens_input'] = 0
            df['tokens_output'] = 0
            df['tokens_total'] = 0

        # Calculate costs
        df['cost_input'] = df.apply(self._calc_input_cost, axis=1)
        df['cost_output'] = df.apply(self._calc_output_cost, axis=1)
        df['cost_total'] = df['cost_input'] + df['cost_output']

        # Fill missing values
        df['status'] = df.get('status', 'unknown').fillna('unknown')
        df['type'] = df.get('type', 'general').fillna('general')
        df['model'] = df.get('model', 'unknown').fillna('unknown')

        # Apply date filters if specified
        if self.config.date_from and 'timestamp' in df.columns:
            df = df[df['timestamp'] >= self.config.date_from]
        if self.config.date_to and 'timestamp' in df.columns:
            df = df[df['timestamp'] <= self.config.date_to]

        return df

    def _calc_input_cost(self, row) -> float:
        """Calculate input token cost for a row."""
        model = row.get('model', 'default')
        rate = COST_PER_M_INPUT.get(model, COST_PER_M_INPUT['default'])
        tokens = row.get('tokens_input', 0)
        return (tokens / 1_000_000) * rate

    def _calc_output_cost(self, row) -> float:
        """Calculate output token cost for a row."""
        model = row.get('model', 'default')
        rate = COST_PER_M_OUTPUT.get(model, COST_PER_M_OUTPUT['default'])
        tokens = row.get('tokens_output', 0)
        return (tokens / 1_000_000) * rate


class UsageAnalyzer:
    """Analyzes AI coding usage patterns."""

    def __init__(self, df: pd.DataFrame):
        self.df = df

    def summary_stats(self) -> dict:
        """Generate summary statistics."""
        return {
            'total_tasks': len(self.df),
            'total_sessions': self.df['_source_file'].nunique(),
            'total_tokens_input': int(self.df['tokens_input'].sum()),
            'total_tokens_output': int(self.df['tokens_output'].sum()),
            'total_cost': round(self.df['cost_total'].sum(), 2),
            'avg_tokens_per_task': int(self.df['tokens_total'].mean()) if len(self.df) > 0 else 0,
            'avg_cost_per_task': round(self.df['cost_total'].mean(), 4) if len(self.df) > 0 else 0,
        }

    def status_distribution(self) -> pd.DataFrame:
        """Get task status distribution."""
        counts = self.df['status'].value_counts()
        percentages = self.df['status'].value_counts(normalize=True) * 100

        return pd.DataFrame({
            'count': counts,
            'percentage': percentages.round(1)
        })

    def model_usage(self) -> pd.DataFrame:
        """Analyze model usage patterns."""
        grouped = self.df.groupby('model').agg({
            'content': 'count',
            'tokens_input': 'sum',
            'tokens_output': 'sum',
            'cost_total': 'sum'
        }).rename(columns={'content': 'task_count'})

        grouped['avg_tokens'] = (grouped['tokens_input'] + grouped['tokens_output']) / grouped['task_count']
        grouped['avg_cost'] = grouped['cost_total'] / grouped['task_count']

        return grouped.round(2)

    def type_analysis(self) -> pd.DataFrame:
        """Analyze task types."""
        return self.df.groupby('type').agg({
            'content': 'count',
            'cost_total': 'sum',
            'tokens_total': 'sum'
        }).rename(columns={'content': 'task_count'}).sort_values('task_count', ascending=False)

    def hourly_pattern(self) -> pd.DataFrame:
        """Analyze usage by hour of day."""
        if 'hour' not in self.df.columns:
            return pd.DataFrame()

        return self.df.groupby('hour').agg({
            'content': 'count',
            'cost_total': 'sum'
        }).rename(columns={'content': 'task_count'})

    def daily_trend(self) -> pd.DataFrame:
        """Analyze daily usage trends."""
        if 'date' not in self.df.columns:
            return pd.DataFrame()

        return self.df.groupby('date').agg({
            'content': 'count',
            'cost_total': 'sum',
            'tokens_total': 'sum'
        }).rename(columns={'content': 'task_count'})

    def completion_rate(self) -> dict:
        """Calculate task completion metrics."""
        total = len(self.df)
        if total == 0:
            return {'completion_rate': 0, 'failure_rate': 0, 'in_progress_rate': 0}

        completed = len(self.df[self.df['status'] == 'completed'])
        failed = len(self.df[self.df['status'] == 'failed'])
        in_progress = len(self.df[self.df['status'] == 'in_progress'])

        return {
            'completion_rate': round(completed / total * 100, 1),
            'failure_rate': round(failed / total * 100, 1),
            'in_progress_rate': round(in_progress / total * 100, 1),
            'health_status': 'healthy' if failed / total < 0.1 else 'warning' if failed / total < 0.2 else 'critical'
        }

    def pattern_detection(self, top_n: int = 10) -> pd.DataFrame:
        """Detect common task patterns from content."""
        if 'content' not in self.df.columns:
            return pd.DataFrame()

        # Extract first 3 words as pattern
        patterns = self.df['content'].dropna().apply(
            lambda x: ' '.join(str(x).split()[:3])
        )

        pattern_counts = patterns.value_counts().head(top_n)
        return pd.DataFrame({
            'pattern': pattern_counts.index,
            'count': pattern_counts.values
        })

    def cost_by_period(self, period: str = 'D') -> pd.DataFrame:
        """Aggregate costs by time period.

        Args:
            period: 'D' for daily, 'W' for weekly, 'M' for monthly
        """
        if 'timestamp' not in self.df.columns:
            return pd.DataFrame()

        df_with_ts = self.df[self.df['timestamp'].notna()].copy()
        df_with_ts.set_index('timestamp', inplace=True)

        return df_with_ts.resample(period).agg({
            'cost_total': 'sum',
            'tokens_total': 'sum',
            'content': 'count'
        }).rename(columns={'content': 'task_count'})


class CostAnalyzer:
    """Deep-dive cost analysis and projections."""

    def __init__(self, df: pd.DataFrame):
        self.df = df

    def cost_breakdown(self) -> dict:
        """Detailed cost breakdown."""
        return {
            'total_cost': round(self.df['cost_total'].sum(), 2),
            'input_cost': round(self.df['cost_input'].sum(), 2),
            'output_cost': round(self.df['cost_output'].sum(), 2),
            'cost_by_model': self.df.groupby('model')['cost_total'].sum().to_dict(),
            'cost_by_type': self.df.groupby('type')['cost_total'].sum().to_dict(),
        }

    def daily_burn_rate(self) -> float:
        """Calculate average daily cost."""
        if 'date' not in self.df.columns or self.df['date'].isna().all():
            return 0.0

        daily_costs = self.df.groupby('date')['cost_total'].sum()
        return round(daily_costs.mean(), 2) if len(daily_costs) > 0 else 0.0

    def monthly_projection(self) -> float:
        """Project monthly cost based on current burn rate."""
        daily_rate = self.daily_burn_rate()
        return round(daily_rate * 30, 2)

    def cost_per_completed_task(self) -> float:
        """Calculate cost per successfully completed task."""
        completed = self.df[self.df['status'] == 'completed']
        if len(completed) == 0:
            return 0.0
        return round(completed['cost_total'].sum() / len(completed), 4)

    def model_efficiency(self) -> pd.DataFrame:
        """Analyze cost efficiency by model."""
        grouped = self.df.groupby('model').agg({
            'cost_total': 'sum',
            'tokens_total': 'sum',
            'content': 'count'
        }).rename(columns={'content': 'task_count'})

        # Calculate metrics
        grouped['cost_per_task'] = grouped['cost_total'] / grouped['task_count']
        grouped['tokens_per_dollar'] = grouped['tokens_total'] / grouped['cost_total'].replace(0, np.nan)

        return grouped.round(2)


def generate_report(df: pd.DataFrame, output_path: Optional[Path] = None) -> str:
    """Generate a comprehensive analytics report."""

    usage = UsageAnalyzer(df)
    cost = CostAnalyzer(df)

    summary = usage.summary_stats()
    completion = usage.completion_rate()
    cost_breakdown = cost.cost_breakdown()

    report = f"""
================================================================================
           CLAUDE CODE ENTERPRISE GOVERNANCE - ANALYTICS REPORT
================================================================================
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

EXECUTIVE SUMMARY
--------------------------------------------------------------------------------
Total Tasks Analyzed:     {summary['total_tasks']:,}
Total Sessions:           {summary['total_sessions']:,}
Total Cost:              ${summary['total_cost']:,.2f}
Completion Rate:          {completion['completion_rate']}%
Health Status:            {completion['health_status'].upper()}

TOKEN USAGE
--------------------------------------------------------------------------------
Input Tokens:            {summary['total_tokens_input']:,}
Output Tokens:           {summary['total_tokens_output']:,}
Avg Tokens/Task:         {summary['avg_tokens_per_task']:,}

COST ANALYSIS
--------------------------------------------------------------------------------
Total Input Cost:        ${cost_breakdown['input_cost']:,.2f}
Total Output Cost:       ${cost_breakdown['output_cost']:,.2f}
Daily Burn Rate:         ${cost.daily_burn_rate():,.2f}
Monthly Projection:      ${cost.monthly_projection():,.2f}
Cost/Completed Task:     ${cost.cost_per_completed_task():.4f}

COST BY MODEL
--------------------------------------------------------------------------------
"""
    for model, model_cost in cost_breakdown['cost_by_model'].items():
        report += f"{model:40} ${model_cost:,.2f}\n"

    report += """
STATUS DISTRIBUTION
--------------------------------------------------------------------------------
"""
    status_dist = usage.status_distribution()
    for status, row in status_dist.iterrows():
        report += f"{status:20} {row['count']:5} ({row['percentage']:5.1f}%)\n"

    report += """
TOP TASK PATTERNS
--------------------------------------------------------------------------------
"""
    patterns = usage.pattern_detection()
    for _, row in patterns.iterrows():
        report += f"{row['pattern']:40} {row['count']:5}\n"

    report += """
================================================================================
                              END OF REPORT
================================================================================
"""

    if output_path:
        with open(output_path, 'w') as f:
            f.write(report)
        print(f"Report saved to: {output_path}")

    return report


def main():
    """Main entry point for CLI usage."""
    import argparse

    parser = argparse.ArgumentParser(
        description='AI coding Enterprise Governance - Usage Analytics'
    )
    parser.add_argument(
        '--demo',
        action='store_true',
        help='Use mock data for demonstration'
    )
    parser.add_argument(
        '--data-dir',
        type=Path,
        default=DEFAULT_TASKS_DIR,
        help='Directory containing task JSON files'
    )
    parser.add_argument(
        '--output',
        type=Path,
        help='Output file for the report'
    )
    parser.add_argument(
        '--format',
        choices=['text', 'json', 'csv'],
        default='text',
        help='Output format'
    )

    args = parser.parse_args()

    config = AnalyticsConfig(
        data_dir=args.data_dir,
        use_mock=args.demo
    )

    print("Loading task data...")
    loader = TaskDataLoader(config)
    df = loader.load()

    if df.empty:
        print("No task data found.")
        return

    print(f"Loaded {len(df)} tasks from {df['_source_file'].nunique()} sessions\n")

    if args.format == 'json':
        usage = UsageAnalyzer(df)
        cost = CostAnalyzer(df)

        result = {
            'summary': usage.summary_stats(),
            'completion': usage.completion_rate(),
            'cost': cost.cost_breakdown(),
            'patterns': usage.pattern_detection().to_dict('records'),
            'model_usage': usage.model_usage().to_dict('index')
        }

        output = json.dumps(result, indent=2, default=str)
        if args.output:
            with open(args.output, 'w') as f:
                f.write(output)
            print(f"JSON report saved to: {args.output}")
        else:
            print(output)

    elif args.format == 'csv':
        output_path = args.output or Path('analytics_export.csv')
        df.to_csv(output_path, index=False)
        print(f"Data exported to: {output_path}")

    else:  # text
        report = generate_report(df, args.output)
        if not args.output:
            print(report)


if __name__ == '__main__':
    main()

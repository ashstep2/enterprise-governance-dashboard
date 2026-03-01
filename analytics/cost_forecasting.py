#!/usr/bin/env python3
"""
Enterprise Governance - Cost Forecasting

Machine learning-based cost prediction and budget planning tools.
Uses time series analysis to forecast future AI coding costs.

Author: Enterprise Governance Team
"""

import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Tuple
from dataclasses import dataclass

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.metrics import mean_absolute_error, mean_squared_error


# Import from usage_analysis
from usage_analysis import TaskDataLoader, AnalyticsConfig, DEFAULT_TASKS_DIR, MOCK_DATA_DIR


@dataclass
class ForecastResult:
    """Container for forecast results."""
    forecast_date: datetime
    predicted_cost: float
    confidence_low: float
    confidence_high: float
    model_used: str


class CostForecaster:
    """Forecasts future costs based on historical data."""

    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.model = None
        self.metrics = {}

    def prepare_time_series(self, period: str = 'D') -> pd.DataFrame:
        """Aggregate data into time series format.

        Args:
            period: 'D' for daily, 'W' for weekly
        """
        if 'timestamp' not in self.df.columns:
            raise ValueError("Data must have timestamp column")

        df = self.df[self.df['timestamp'].notna()].copy()
        df.set_index('timestamp', inplace=True)

        ts = df.resample(period).agg({
            'cost_total': 'sum',
            'tokens_total': 'sum',
            'content': 'count'
        }).rename(columns={'content': 'task_count'})

        # Add derived features
        ts['day_of_week'] = ts.index.dayofweek
        ts['is_weekend'] = ts['day_of_week'].isin([5, 6]).astype(int)
        ts['day_of_month'] = ts.index.day

        return ts.fillna(0)

    def train_linear_model(self, ts: pd.DataFrame) -> Tuple[LinearRegression, dict]:
        """Train a linear regression model on the time series."""
        if len(ts) < 3:
            raise ValueError("Need at least 3 data points for training")

        # Create numeric features
        ts = ts.copy()
        ts['day_num'] = range(len(ts))

        X = ts[['day_num', 'day_of_week', 'is_weekend']].values
        y = ts['cost_total'].values

        # Train model
        model = LinearRegression()
        model.fit(X, y)

        # Calculate metrics
        y_pred = model.predict(X)
        metrics = {
            'mae': mean_absolute_error(y, y_pred),
            'rmse': np.sqrt(mean_squared_error(y, y_pred)),
            'r2': model.score(X, y),
            'coefficients': {
                'day_trend': model.coef_[0],
                'day_of_week': model.coef_[1],
                'weekend_effect': model.coef_[2]
            },
            'intercept': model.intercept_
        }

        self.model = model
        self.metrics = metrics

        return model, metrics

    def train_polynomial_model(self, ts: pd.DataFrame, degree: int = 2) -> Tuple[object, dict]:
        """Train a polynomial regression model for non-linear trends."""
        if len(ts) < 5:
            raise ValueError("Need at least 5 data points for polynomial model")

        ts = ts.copy()
        ts['day_num'] = range(len(ts))

        X = ts[['day_num']].values
        y = ts['cost_total'].values

        # Create polynomial features
        poly = PolynomialFeatures(degree=degree)
        X_poly = poly.fit_transform(X)

        # Train model
        model = LinearRegression()
        model.fit(X_poly, y)

        # Calculate metrics
        y_pred = model.predict(X_poly)
        metrics = {
            'mae': mean_absolute_error(y, y_pred),
            'rmse': np.sqrt(mean_squared_error(y, y_pred)),
            'r2': model.score(X_poly, y),
            'degree': degree
        }

        return (model, poly), metrics

    def forecast(self, days_ahead: int = 30, model_type: str = 'linear') -> list[ForecastResult]:
        """Generate cost forecasts for future days.

        Args:
            days_ahead: Number of days to forecast
            model_type: 'linear' or 'polynomial'

        Returns:
            List of ForecastResult objects
        """
        ts = self.prepare_time_series('D')

        if model_type == 'linear':
            model, metrics = self.train_linear_model(ts)
        else:
            (model, poly), metrics = self.train_polynomial_model(ts)

        results = []
        last_day_num = len(ts) - 1
        last_date = ts.index[-1]

        # Calculate prediction interval based on historical variance
        historical_std = ts['cost_total'].std()
        confidence_multiplier = 1.96  # 95% confidence

        for i in range(1, days_ahead + 1):
            forecast_date = last_date + timedelta(days=i)
            day_num = last_day_num + i
            day_of_week = forecast_date.dayofweek
            is_weekend = 1 if day_of_week in [5, 6] else 0

            if model_type == 'linear':
                X_pred = np.array([[day_num, day_of_week, is_weekend]])
                predicted = model.predict(X_pred)[0]
            else:
                X_pred = poly.transform([[day_num]])
                predicted = model.predict(X_pred)[0]

            # Ensure non-negative
            predicted = max(0, predicted)

            # Calculate confidence interval (widens with time)
            interval_width = historical_std * confidence_multiplier * (1 + i * 0.02)

            results.append(ForecastResult(
                forecast_date=forecast_date.to_pydatetime(),
                predicted_cost=round(predicted, 2),
                confidence_low=round(max(0, predicted - interval_width), 2),
                confidence_high=round(predicted + interval_width, 2),
                model_used=model_type
            ))

        return results

    def budget_analysis(self, monthly_budget: float, days_ahead: int = 30) -> dict:
        """Analyze if current trajectory will exceed budget.

        Args:
            monthly_budget: Budget in dollars
            days_ahead: Forecast horizon

        Returns:
            Budget analysis dict
        """
        forecasts = self.forecast(days_ahead)
        ts = self.prepare_time_series('D')

        # Historical spending
        total_historical = ts['cost_total'].sum()
        days_historical = len(ts)
        daily_historical = total_historical / max(days_historical, 1)

        # Forecasted spending
        total_forecasted = sum(f.predicted_cost for f in forecasts)
        daily_forecasted = total_forecasted / len(forecasts) if forecasts else 0

        # Monthly projections
        monthly_at_historical_rate = daily_historical * 30
        monthly_at_forecasted_rate = daily_forecasted * 30

        # Budget status
        if monthly_at_forecasted_rate <= monthly_budget * 0.8:
            status = 'on_track'
            message = 'Spending is well within budget'
        elif monthly_at_forecasted_rate <= monthly_budget:
            status = 'warning'
            message = 'Spending approaching budget limit'
        else:
            status = 'over_budget'
            overage = monthly_at_forecasted_rate - monthly_budget
            message = f'Projected to exceed budget by ${overage:.2f}'

        return {
            'monthly_budget': monthly_budget,
            'historical_daily_rate': round(daily_historical, 2),
            'forecasted_daily_rate': round(daily_forecasted, 2),
            'monthly_at_historical_rate': round(monthly_at_historical_rate, 2),
            'monthly_at_forecasted_rate': round(monthly_at_forecasted_rate, 2),
            'budget_utilization_percent': round(monthly_at_forecasted_rate / monthly_budget * 100, 1),
            'status': status,
            'message': message,
            'days_until_budget_exhausted': int(monthly_budget / daily_forecasted) if daily_forecasted > 0 else None
        }


class GrowthAnalyzer:
    """Analyzes usage growth patterns."""

    def __init__(self, df: pd.DataFrame):
        self.df = df

    def weekly_growth_rate(self) -> dict:
        """Calculate week-over-week growth rates."""
        if 'timestamp' not in self.df.columns:
            return {}

        df = self.df[self.df['timestamp'].notna()].copy()
        df.set_index('timestamp', inplace=True)

        weekly = df.resample('W').agg({
            'cost_total': 'sum',
            'tokens_total': 'sum',
            'content': 'count'
        }).rename(columns={'content': 'task_count'})

        if len(weekly) < 2:
            return {'message': 'Not enough data for growth analysis'}

        # Calculate growth rates
        weekly['cost_growth'] = weekly['cost_total'].pct_change() * 100
        weekly['task_growth'] = weekly['task_count'].pct_change() * 100

        return {
            'avg_weekly_cost_growth': round(weekly['cost_growth'].mean(), 1),
            'avg_weekly_task_growth': round(weekly['task_growth'].mean(), 1),
            'latest_week_cost': round(weekly['cost_total'].iloc[-1], 2),
            'latest_week_tasks': int(weekly['task_count'].iloc[-1]),
            'trend': 'growing' if weekly['cost_growth'].mean() > 5 else 'stable' if weekly['cost_growth'].mean() > -5 else 'declining'
        }

    def adoption_curve(self) -> dict:
        """Analyze adoption patterns over time."""
        if 'timestamp' not in self.df.columns:
            return {}

        df = self.df[self.df['timestamp'].notna()].copy()

        # Group by date and count unique sessions
        daily_sessions = df.groupby(df['timestamp'].dt.date)['_source_file'].nunique()

        if len(daily_sessions) < 2:
            return {'message': 'Not enough data for adoption analysis'}

        return {
            'total_sessions': int(daily_sessions.sum()),
            'avg_daily_sessions': round(daily_sessions.mean(), 1),
            'peak_daily_sessions': int(daily_sessions.max()),
            'first_activity': str(daily_sessions.index.min()),
            'latest_activity': str(daily_sessions.index.max()),
            'active_days': len(daily_sessions)
        }


def generate_forecast_report(df: pd.DataFrame, budget: float = 1000.0) -> str:
    """Generate a comprehensive forecast report."""

    forecaster = CostForecaster(df)
    growth = GrowthAnalyzer(df)

    # Generate forecasts
    try:
        forecasts = forecaster.forecast(30, 'linear')
        budget_analysis = forecaster.budget_analysis(budget)
        growth_analysis = growth.weekly_growth_rate()
        adoption = growth.adoption_curve()
        forecast_available = True
    except ValueError as e:
        forecast_available = False
        error_msg = str(e)

    report = f"""
================================================================================
           CLAUDE CODE ENTERPRISE - COST FORECASTING REPORT
================================================================================
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Monthly Budget: ${budget:,.2f}

"""

    if not forecast_available:
        report += f"""
INSUFFICIENT DATA FOR FORECASTING
--------------------------------------------------------------------------------
{error_msg}

Forecasting requires at least 3 days of historical data. Continue using
AI coding tools to generate sufficient data for accurate predictions.
"""
        return report

    report += f"""
BUDGET STATUS: {budget_analysis['status'].upper()}
--------------------------------------------------------------------------------
{budget_analysis['message']}

Budget Utilization:       {budget_analysis['budget_utilization_percent']}%
Historical Daily Rate:   ${budget_analysis['historical_daily_rate']}/day
Forecasted Daily Rate:   ${budget_analysis['forecasted_daily_rate']}/day
Monthly Projection:      ${budget_analysis['monthly_at_forecasted_rate']}

"""

    if budget_analysis['days_until_budget_exhausted']:
        report += f"Days Until Budget Exhausted: {budget_analysis['days_until_budget_exhausted']}\n\n"

    report += f"""
GROWTH ANALYSIS
--------------------------------------------------------------------------------
Weekly Cost Growth:      {growth_analysis.get('avg_weekly_cost_growth', 'N/A')}%
Weekly Task Growth:      {growth_analysis.get('avg_weekly_task_growth', 'N/A')}%
Trend:                   {growth_analysis.get('trend', 'N/A').upper()}
Latest Week Cost:       ${growth_analysis.get('latest_week_cost', 0)}
Latest Week Tasks:       {growth_analysis.get('latest_week_tasks', 0)}

ADOPTION METRICS
--------------------------------------------------------------------------------
Total Sessions:          {adoption.get('total_sessions', 'N/A')}
Avg Daily Sessions:      {adoption.get('avg_daily_sessions', 'N/A')}
Peak Daily Sessions:     {adoption.get('peak_daily_sessions', 'N/A')}
Active Days:             {adoption.get('active_days', 'N/A')}

30-DAY COST FORECAST
--------------------------------------------------------------------------------
"""

    # Show weekly summaries
    week_costs = {}
    for f in forecasts:
        week_num = (f.forecast_date - forecasts[0].forecast_date).days // 7 + 1
        if week_num not in week_costs:
            week_costs[week_num] = []
        week_costs[week_num].append(f.predicted_cost)

    for week, costs in week_costs.items():
        week_total = sum(costs)
        report += f"Week {week}:  ${week_total:,.2f}\n"

    report += f"""
Total 30-Day Forecast:   ${sum(f.predicted_cost for f in forecasts):,.2f}

MODEL METRICS
--------------------------------------------------------------------------------
Model Type:              Linear Regression
MAE:                    ${forecaster.metrics.get('mae', 0):.2f}
RMSE:                   ${forecaster.metrics.get('rmse', 0):.2f}
R² Score:                {forecaster.metrics.get('r2', 0):.3f}

RECOMMENDATIONS
--------------------------------------------------------------------------------
"""

    # Generate recommendations based on analysis
    if budget_analysis['status'] == 'over_budget':
        report += """• URGENT: Reduce usage or increase budget allocation
• Consider switching high-volume tasks to Haiku model
• Review task patterns for optimization opportunities
"""
    elif budget_analysis['status'] == 'warning':
        report += """• Monitor daily spend closely
• Identify and optimize expensive task types
• Consider setting up usage alerts
"""
    else:
        report += """• Budget is healthy - consider expanding usage
• Current model selection is cost-effective
• Track growth trends for future planning
"""

    if growth_analysis.get('trend') == 'growing':
        report += "• Growth trend detected - plan for increased capacity\n"

    report += """
================================================================================
                              END OF REPORT
================================================================================
"""

    return report


def main():
    """Main entry point for CLI usage."""
    import argparse

    parser = argparse.ArgumentParser(
        description='AI coding tools Enterprise Governance - Cost Forecasting'
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
        '--budget',
        type=float,
        default=1000.0,
        help='Monthly budget in dollars'
    )
    parser.add_argument(
        '--output',
        type=Path,
        help='Output file for the report'
    )
    parser.add_argument(
        '--format',
        choices=['text', 'json'],
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

    print(f"Loaded {len(df)} tasks\n")

    if args.format == 'json':
        forecaster = CostForecaster(df)
        growth = GrowthAnalyzer(df)

        try:
            forecasts = forecaster.forecast(30)
            budget_analysis = forecaster.budget_analysis(args.budget)
            growth_analysis = growth.weekly_growth_rate()

            result = {
                'forecasts': [
                    {
                        'date': f.forecast_date.isoformat(),
                        'predicted_cost': f.predicted_cost,
                        'confidence_low': f.confidence_low,
                        'confidence_high': f.confidence_high
                    }
                    for f in forecasts
                ],
                'budget_analysis': budget_analysis,
                'growth_analysis': growth_analysis,
                'model_metrics': forecaster.metrics
            }
        except ValueError as e:
            result = {'error': str(e)}

        output = json.dumps(result, indent=2, default=str)
        if args.output:
            with open(args.output, 'w') as f:
                f.write(output)
            print(f"JSON saved to: {args.output}")
        else:
            print(output)
    else:
        report = generate_forecast_report(df, args.budget)
        if args.output:
            with open(args.output, 'w') as f:
                f.write(report)
            print(f"Report saved to: {args.output}")
        else:
            print(report)


if __name__ == '__main__':
    main()

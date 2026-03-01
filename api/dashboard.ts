import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAggregatedData, getTasks } from './lib/data.js';

// Single endpoint that returns ALL dashboard data in one request
// Eliminates multiple cold starts and sequential fetches
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const data = getAggregatedData();
  const tasks = getTasks();
  const completed = data.statusCounts['completed'] || 0;
  const total = data.totalEntries;

  // Sort tasks by timestamp and limit to 8
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
    .slice(0, 8);

  return res.status(200).json({
    success: true,
    metrics: {
      totalTasks: total,
      totalSessions: data.totalFiles,
      totalCost: Math.round(data.estimatedCost * 100) / 100,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      tokenUsage: {
        input: data.totalTokensInput,
        output: data.totalTokensOutput,
        total: data.totalTokensInput + data.totalTokensOutput,
      },
      modelDistribution: data.modelCounts,
      statusDistribution: data.statusCounts,
    },
    patterns: data.patterns,
    recentTasks,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
}

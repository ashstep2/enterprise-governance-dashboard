import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAggregatedData } from './lib/data.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const data = getAggregatedData();
  const completed = data.statusCounts['completed'] || 0;
  const total = data.totalEntries;

  return res.status(200).json({
    success: true,
    data: {
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
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTasks } from './lib/data.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { status, limit } = req.query;
  let tasks = getTasks();

  // Filter by status if provided
  if (status && typeof status === 'string') {
    tasks = tasks.filter(t => t.status === status);
  }

  // Sort by timestamp descending
  tasks = [...tasks].sort((a, b) =>
    new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()
  );

  // Limit results
  const maxResults = limit ? parseInt(limit as string, 10) : 20;
  tasks = tasks.slice(0, maxResults);

  return res.status(200).json({
    success: true,
    data: tasks,
    meta: {
      total: tasks.length,
      timestamp: new Date().toISOString(),
    },
  });
}

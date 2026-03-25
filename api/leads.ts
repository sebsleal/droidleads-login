import { kv } from '@vercel/kv'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    const leads = (await kv.get('leads')) ?? []
    const lastScraped = (await kv.get('last_scraped')) ?? null
    return res.json({ leads, lastScraped, cached: true })
  } catch {
    // KV not configured — return empty (dev mode falls back to mock data)
    return res.json({ leads: [], lastScraped: null, cached: false })
  }
}

import Anthropic from '@anthropic-ai/sdk'
import { kv } from '@vercel/kv'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type DamageType = 'Hurricane/Wind' | 'Flood' | 'Roof' | 'Fire' | 'Structural'
type LeadStatus = 'New' | 'Contacted' | 'Closed'

interface ContactInfo {
  email?: string
  phone?: string
}

interface Lead {
  id: string
  ownerName: string
  propertyAddress: string
  city: string
  zip: string
  folioNumber: string
  damageType: DamageType
  score: number
  date: string
  contact?: ContactInfo
  status: LeadStatus
  permitType: string
  permitDate: string
  stormEvent: string
  outreachMessage: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  let leads: Lead[]
  try {
    leads = ((await kv.get('leads')) as Lead[]) ?? []
  } catch {
    return res.status(500).json({ error: 'KV not configured or unavailable' })
  }

  const toEnrich = leads.filter((l) => l.outreachMessage.startsWith('TEMPLATE:'))

  if (!toEnrich.length) {
    return res.json({ enriched: 0 })
  }

  let client: Anthropic
  try {
    client = new Anthropic()
  } catch {
    return res.status(500).json({ error: 'Anthropic API key not configured' })
  }

  let enriched = 0
  const enrichMap = new Map<string, string>()

  for (const lead of toEnrich.slice(0, 10)) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `You are a professional public adjuster outreach specialist for Claim Remedy Adjusters in Miami, FL.

Write a warm, professional 3-4 sentence outreach message to a property owner about their insurance claim.

Property: ${lead.propertyAddress}, ${lead.city}, FL ${lead.zip}
Owner last name: ${lead.ownerName}
Damage type: ${lead.damageType}
Permit filed: ${lead.permitType} on ${lead.permitDate}
${lead.stormEvent ? `Related storm: ${lead.stormEvent}` : ''}

Rules:
- Address them by last name (e.g. "Dear Mr./Ms. [Last Name],")
- Mention the specific damage type
- Explain that Claim Remedy Adjusters can help maximize their insurance settlement
- Keep it warm and helpful, not salesy
- End with a clear call to action (call or text)
- Do NOT use generic filler phrases like "I hope this message finds you well"

Output ONLY the message text, nothing else.`,
          },
        ],
      })

      const text =
        message.content[0].type === 'text' ? message.content[0].text.trim() : ''

      if (text) {
        enrichMap.set(lead.id, text)
        enriched++
      }
    } catch (err) {
      console.error(`[enrich] Failed to enrich lead ${lead.id}:`, err)
      // Continue with remaining leads
    }
  }

  // Apply enriched messages back to the full leads array
  const updatedLeads = leads.map((lead) => {
    const newMsg = enrichMap.get(lead.id)
    if (newMsg) return { ...lead, outreachMessage: newMsg }
    return lead
  })

  try {
    await kv.set('leads', updatedLeads, { ex: 43200 })
  } catch (err) {
    console.error('[enrich] Failed to save enriched leads to KV:', err)
    return res.status(500).json({ error: 'Failed to persist enriched leads' })
  }

  return res.json({ enriched })
}

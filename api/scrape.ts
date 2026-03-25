import { kv } from '@vercel/kv'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'

// Lead type matches the frontend src/types.ts exactly
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
  date: string // ISO date string
  contact?: ContactInfo
  status: LeadStatus
  permitType: string
  permitDate: string // ISO date string
  stormEvent: string
  outreachMessage: string
}

// Miami-Dade Open Data permit record shape
interface MiamiDadePermit {
  folio_number?: string
  address?: string
  owner1_last_name?: string
  permit_type?: string
  issue_date?: string
  work_description?: string
  zip_code?: string
}

const DAMAGE_KEYWORDS = [
  'roof', 'hurricane', 'flood', 'fire', 'structural', 'wind',
  'water damage', 'storm', 'damage', 'repair', 'restoration',
  'soffit', 'shutter', 'elevation', 'mitigation', 'rebuild',
  'foundation', 'masonry', 'wall repair', 'window', 'door replacement',
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  try {
    const permits = await fetchMiamiDadePermits()
    const storms = generateStormLeads()
    const all = deduplicateLeads([...permits, ...storms])
    const scored = scoreLeads(all)

    await kv.set('leads', scored, { ex: 43200 })
    await kv.set('last_scraped', new Date().toISOString(), { ex: 43200 })

    return res.json({ success: true, count: scored.length })
  } catch (err) {
    console.error('[scrape] error:', err)
    return res.status(500).json({ error: String(err) })
  }
}

function classifyDamageType(permitType: string, workDesc: string): DamageType {
  const text = `${permitType} ${workDesc}`.toLowerCase()

  if (/fire|smoke|arson/.test(text)) return 'Fire'
  if (/flood|water damage|water intrusion|inundation|surge|elevation|mitigation/.test(text)) return 'Flood'
  if (/hurricane|wind|storm|shutter|soffit/.test(text)) return 'Hurricane/Wind'
  if (/structural|foundation|load.?bearing|masonry|block wall|retaining|wall repair/.test(text)) return 'Structural'
  if (/roof|shingle|decking|re.?deck/.test(text)) return 'Roof'

  // fallback heuristics
  if (/window|door/.test(text)) return 'Hurricane/Wind'
  if (/plumbing|pipe/.test(text)) return 'Flood'

  return 'Roof' // safe default for unknown permits in damage bucket
}

function isDamageRelated(permitType: string, workDesc: string): boolean {
  const text = `${permitType} ${workDesc}`.toLowerCase()
  return DAMAGE_KEYWORDS.some((kw) => text.includes(kw))
}

function hashLead(address: string, date: string): string {
  return createHash('md5')
    .update(`${address.toLowerCase().trim()}|${date}`)
    .digest('hex')
    .slice(0, 12)
}

function formatPermitDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString().slice(0, 10)
  try {
    return new Date(raw).toISOString().slice(0, 10)
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function outreachTemplate(damageType: DamageType, ownerName: string, address: string, stormEvent: string): string {
  const lastName = ownerName.split(' ').pop() ?? ownerName
  const prefix = `TEMPLATE:Dear ${lastName}, `

  switch (damageType) {
    case 'Hurricane/Wind':
      return `${prefix}our records indicate your property at ${address} may have sustained hurricane or wind damage${stormEvent ? ` during ${stormEvent}` : ''}. As a licensed Florida public adjuster, Claim Remedy Adjusters specializes in maximizing insurance settlements for homeowners like you — at no upfront cost. We'd love to schedule a free property inspection to ensure you receive every dollar you deserve. Please call or text us at (800) 555-0100 at your earliest convenience.`

    case 'Flood':
      return `${prefix}flood damage records and recent permit activity at ${address} suggest you may have an open or underpaid insurance claim${stormEvent ? ` related to ${stormEvent}` : ''}. Claim Remedy Adjusters has recovered millions for South Florida property owners by uncovering hidden losses insurers overlook. A quick call with our team could mean a substantially higher payout — with zero out-of-pocket cost to you. Reach out today for a free claim review.`

    case 'Roof':
      return `${prefix}a recent roof permit filed for ${address} may indicate storm-related damage${stormEvent ? ` from ${stormEvent}` : ''} that qualifies for a larger insurance settlement than originally offered. Claim Remedy Adjusters specializes in Florida roof claims and knows exactly how to document and negotiate full replacement cost value. Contact us for a free, no-obligation assessment — you may be owed significantly more.`

    case 'Fire':
      return `${prefix}fire and smoke damage claims are among the most complex in Florida, and insurers often dispute the full scope of loss. Our records show recent permit activity at ${address} related to fire damage. Claim Remedy Adjusters handles everything from scope documentation to carrier negotiation so you can focus on rebuilding. Call us now for a same-week consultation at no cost to you.`

    case 'Structural':
      return `${prefix}structural repairs following a storm represent some of the largest and most under-compensated insurance claims in Florida. A recent structural permit was filed for ${address}${stormEvent ? ` following ${stormEvent}` : ''}, and our team at Claim Remedy Adjusters wants to ensure your settlement reflects the true scope of damage. Please reach out today — Florida hurricane claim deadlines apply. Our consultation is completely free.`
  }
}

async function fetchMiamiDadePermits(): Promise<Lead[]> {
  const base = 'https://opendata.miamidade.gov/resource/hvj5-8dge.json'
  const params = new URLSearchParams({
    $limit: '200',
    $order: 'issue_date DESC',
  })

  const url = `${base}?${params.toString()}`

  let records: MiamiDadePermit[]
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`Miami-Dade API responded ${response.status}`)
    }

    records = await response.json() as MiamiDadePermit[]
  } catch (err) {
    console.warn('[scrape] Miami-Dade fetch failed, continuing without permit data:', err)
    return []
  }

  const leads: Lead[] = []

  for (const record of records) {
    const permitType = record.permit_type ?? ''
    const workDesc = record.work_description ?? ''

    if (!isDamageRelated(permitType, workDesc)) continue

    const address = record.address ?? 'Unknown Address'
    const rawDate = record.issue_date ?? ''
    const permitDate = formatPermitDate(rawDate)
    const id = hashLead(address, permitDate)

    const lastName = record.owner1_last_name
      ? record.owner1_last_name.charAt(0).toUpperCase() + record.owner1_last_name.slice(1).toLowerCase()
      : 'Property Owner'
    const ownerName = lastName

    const damageType = classifyDamageType(permitType, workDesc)
    const stormEvent = inferStormEvent(permitDate)

    leads.push({
      id,
      ownerName,
      propertyAddress: address,
      city: 'Miami',
      zip: record.zip_code ?? '33101',
      folioNumber: record.folio_number ?? '',
      damageType,
      score: 0, // scored later
      date: permitDate,
      contact: undefined,
      status: 'New',
      permitType,
      permitDate,
      stormEvent,
      outreachMessage: outreachTemplate(damageType, ownerName, address, stormEvent),
    })
  }

  return leads
}

function inferStormEvent(permitDate: string): string {
  const d = new Date(permitDate)
  const year = d.getFullYear()
  const month = d.getMonth() + 1 // 1-indexed

  // Hurricane Milton Oct 2024
  if (year === 2024 && month >= 10) return 'Hurricane Milton (Oct 2024)'
  // Hurricane Helene Sept 2025
  if (year === 2025 && month >= 9 && month <= 12) return 'Hurricane Helene (Sept 2025)'
  // After Helene, permits still likely related
  if (year === 2026 && month <= 6) return 'Hurricane Helene (Sept 2025)'

  return ''
}

function generateStormLeads(): Lead[] {
  const now = new Date()
  const daysAgo = (n: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }

  const stormLeads: Omit<Lead, 'id' | 'score'>[] = [
    {
      ownerName: 'Martinez',
      propertyAddress: '8901 SW 24th St',
      city: 'Miami',
      zip: '33165',
      folioNumber: '30-4027-041-0110',
      damageType: 'Hurricane/Wind',
      date: daysAgo(12),
      contact: undefined,
      status: 'New',
      permitType: 'Hurricane Wind Damage Repair',
      permitDate: daysAgo(12),
      stormEvent: 'Hurricane Helene (Sept 2025)',
      outreachMessage: '',
    },
    {
      ownerName: 'Johnson',
      propertyAddress: '14520 NW 7th Ave',
      city: 'Miami Gardens',
      zip: '33168',
      folioNumber: '34-2115-001-0280',
      damageType: 'Roof',
      date: daysAgo(18),
      contact: undefined,
      status: 'New',
      permitType: 'Emergency Roof Replacement',
      permitDate: daysAgo(18),
      stormEvent: 'Hurricane Helene (Sept 2025)',
      outreachMessage: '',
    },
    {
      ownerName: 'Rodriguez',
      propertyAddress: '2211 SW 137th Ave',
      city: 'Miami',
      zip: '33175',
      folioNumber: '30-4028-033-0450',
      damageType: 'Flood',
      date: daysAgo(25),
      contact: undefined,
      status: 'New',
      permitType: 'Flood Mitigation & Restoration',
      permitDate: daysAgo(25),
      stormEvent: 'Hurricane Helene (Sept 2025)',
      outreachMessage: '',
    },
    {
      ownerName: 'Williams',
      propertyAddress: '6700 NW 186th St',
      city: 'Hialeah',
      zip: '33015',
      folioNumber: '04-2020-007-0120',
      damageType: 'Structural',
      date: daysAgo(8),
      contact: undefined,
      status: 'New',
      permitType: 'Structural Hurricane Damage Repair',
      permitDate: daysAgo(8),
      stormEvent: 'Hurricane Helene (Sept 2025)',
      outreachMessage: '',
    },
    {
      ownerName: 'Garcia',
      propertyAddress: '3310 NE 163rd St',
      city: 'North Miami Beach',
      zip: '33160',
      folioNumber: '07-2212-014-0340',
      damageType: 'Hurricane/Wind',
      date: daysAgo(35),
      contact: undefined,
      status: 'New',
      permitType: 'Wind Damage — Roof & Soffit',
      permitDate: daysAgo(35),
      stormEvent: 'Hurricane Helene (Sept 2025)',
      outreachMessage: '',
    },
    {
      ownerName: 'Hernandez',
      propertyAddress: '11200 SW 8th St',
      city: 'Miami',
      zip: '33174',
      folioNumber: '30-4028-011-0780',
      damageType: 'Flood',
      date: daysAgo(20),
      contact: undefined,
      status: 'New',
      permitType: 'Water Intrusion & Mold Remediation',
      permitDate: daysAgo(20),
      stormEvent: 'Hurricane Milton (Oct 2024)',
      outreachMessage: '',
    },
    {
      ownerName: 'Lopez',
      propertyAddress: '1850 W 68th St',
      city: 'Hialeah',
      zip: '33012',
      folioNumber: '04-2021-009-0560',
      damageType: 'Roof',
      date: daysAgo(15),
      contact: undefined,
      status: 'New',
      permitType: 'Full Roof Replacement + Decking',
      permitDate: daysAgo(15),
      stormEvent: 'Hurricane Helene (Sept 2025)',
      outreachMessage: '',
    },
    {
      ownerName: 'Gonzalez',
      propertyAddress: '4420 SW 8th St',
      city: 'Coral Gables',
      zip: '33134',
      folioNumber: '03-4115-010-0220',
      damageType: 'Structural',
      date: daysAgo(5),
      contact: undefined,
      status: 'New',
      permitType: 'Load-Bearing Wall Structural Repair',
      permitDate: daysAgo(5),
      stormEvent: 'Hurricane Helene (Sept 2025)',
      outreachMessage: '',
    },
    {
      ownerName: 'Perez',
      propertyAddress: '21000 NE 16th Ct',
      city: 'Miami',
      zip: '33179',
      folioNumber: '07-2218-003-0090',
      damageType: 'Fire',
      date: daysAgo(42),
      contact: undefined,
      status: 'New',
      permitType: 'Fire Damage Restoration',
      permitDate: daysAgo(42),
      stormEvent: '',
      outreachMessage: '',
    },
    {
      ownerName: 'Torres',
      propertyAddress: '7851 NW 46th St',
      city: 'Miami',
      zip: '33166',
      folioNumber: '30-3018-023-0410',
      damageType: 'Hurricane/Wind',
      date: daysAgo(28),
      contact: undefined,
      status: 'New',
      permitType: 'Hurricane Shutter & Roof Repair',
      permitDate: daysAgo(28),
      stormEvent: 'Hurricane Helene (Sept 2025)',
      outreachMessage: '',
    },
  ]

  return stormLeads.map((lead) => {
    const id = hashLead(lead.propertyAddress, lead.permitDate)
    const msg = outreachTemplate(lead.damageType, lead.ownerName, lead.propertyAddress, lead.stormEvent)
    return { ...lead, id, score: 0, outreachMessage: msg }
  })
}

function deduplicateLeads(leads: Lead[]): Lead[] {
  const seen = new Set<string>()
  return leads.filter((lead) => {
    const key = hashLead(lead.propertyAddress, lead.permitDate)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function scoreLeads(leads: Lead[]): Lead[] {
  const now = new Date()

  return leads.map((lead) => {
    let score = 30 // base score

    // Recency
    const leadDate = new Date(lead.permitDate)
    const daysDiff = Math.floor((now.getTime() - leadDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff <= 30) score += 20
    else if (daysDiff <= 60) score += 10

    // Damage type
    if (lead.damageType === 'Hurricane/Wind' || lead.damageType === 'Flood') score += 25
    else if (lead.damageType === 'Roof' || lead.damageType === 'Fire') score += 20
    else if (lead.damageType === 'Structural') score += 20

    // Roof replacement or structural permit
    const permitLower = lead.permitType.toLowerCase()
    if (
      permitLower.includes('roof replacement') ||
      permitLower.includes('full roof') ||
      permitLower.includes('structural') ||
      permitLower.includes('load-bearing') ||
      permitLower.includes('foundation')
    ) {
      score += 15
    }

    // Has contact
    if (lead.contact?.email || lead.contact?.phone) score += 15

    // Storm event linked
    if (lead.stormEvent && lead.stormEvent.trim().length > 0) score += 10

    // Cap at 100
    score = Math.min(score, 100)

    return { ...lead, score }
  })
}

import { createClient } from '@supabase/supabase-js'
import type { StormWatchStatus } from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Nullable — will be null in local dev if env vars are not set.
// When null, the app falls back to in-memory state only (existing behaviour).
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

// Mirrors the `lead_tracking` table schema
export interface TrackingRecord {
  lead_id: string
  status: 'New' | 'Contacted' | 'Converted' | 'Closed'
  contacted_at: string | null
  converted_at: string | null
  claim_value: number | null
  contact_method: string | null
  notes: string | null
  updated_at: string
}

export interface StormTrackingRecord {
  candidate_id: string
  status: StormWatchStatus
  notes: string | null
  contacted_at: string | null
  permit_filed_at: string | null
  closed_at: string | null
  updated_at: string
}

// Mirrors the `cases` table schema
export interface CaseRecord {
  id: string
  file_number: string
  client_name: string
  loss_address: string
  mailing_address: string | null
  loss_date: string | null
  peril_type: string | null
  insurance_company: string | null
  policy_number: string | null
  claim_number: string | null
  phone: string | null
  email: string | null
  status_phase: string
  fee_rate: number | null
  fee_disbursed: number | null
  estimated_loss: number | null
  date_logged: string
  lor: boolean
  plumbing_invoice: boolean
  water_mitigation: boolean
  estimate_date: string | null
  inspection_date: string | null
  srl_date: string | null
  cdl1_date: string | null
  cdl2_date: string | null
  cdl3_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

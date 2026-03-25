import { useState, useMemo, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { BarChart2, Users } from 'lucide-react'
import type { FilterState, Lead } from '@/types'
import { isWithinDays } from '@/lib/utils'
import { useTracking } from '@/lib/useTracking'
import Header from '@/components/Header'
import StatsRow from '@/components/StatsRow'
import FilterBar from '@/components/FilterBar'
import LeadsTable from '@/components/LeadsTable'
import LeadDrawer from '@/components/LeadDrawer'
import Analytics from '@/components/Analytics'

const DEFAULT_FILTERS: FilterState = {
  zip: '',
  damageType: 'All',
  scoreTier: 'All',
  dateRange: 'all',
  hasContact: false,
  absenteeOwner: false,
  underpaid: false,
  noContractor: false,
  stormFirst: false,
}

export default function App() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [rawLeads, setRawLeads] = useState<Lead[]>([])
  const [lastScraped, setLastScraped] = useState<string | null>(null)

  const { trackingMap, saveTracking } = useTracking()

  const navigate = useNavigate()
  const location = useLocation()
  const activeTab = location.pathname === '/analytics' ? 'analytics' : 'leads'

  // Load real leads from static JSON if it exists (populated by generate_leads.py)
  useEffect(() => {
    fetch('/leads.json')
      .then((r) => {
        if (!r.ok) throw new Error('no leads.json')
        return r.json()
      })
      .then((data: { leads: Lead[]; lastScraped: string }) => {
        if (data.leads?.length > 0) {
          setRawLeads(data.leads)
          setLastScraped(data.lastScraped)
        }
      })
      .catch(() => {
        // No leads.json yet — using mock data
      })
  }, [])

  // Merge Supabase tracking overlay on top of JSON leads
  const leads = useMemo(() => {
    if (trackingMap.size === 0) return rawLeads
    return rawLeads.map((lead) => {
      const t = trackingMap.get(lead.id)
      if (!t) return lead
      return {
        ...lead,
        status: t.status,
        contactedAt: t.contacted_at ?? undefined,
        convertedAt: t.converted_at ?? undefined,
        claimValue: t.claim_value ?? undefined,
        contactMethod: t.contact_method ?? undefined,
        notes: t.notes ?? undefined,
      }
    })
  }, [rawLeads, trackingMap])

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filters.zip && !lead.zip.includes(filters.zip)) return false
      if (filters.damageType !== 'All' && lead.damageType !== filters.damageType) return false
      if (filters.hasContact && !lead.contact) return false

      if (filters.scoreTier !== 'All') {
        if (filters.scoreTier === 'High' && lead.score < 85) return false
        if (filters.scoreTier === 'Medium' && (lead.score < 70 || lead.score >= 85)) return false
        if (filters.scoreTier === 'Low' && lead.score >= 70) return false
      }

      if (filters.dateRange !== 'all') {
        const days = parseInt(filters.dateRange, 10)
        if (!isWithinDays(lead.date, days)) return false
      }

      if (filters.absenteeOwner && !lead.absenteeOwner) return false;
      if (filters.underpaid && !lead.underpaidFlag) return false;
      if (filters.noContractor && lead.permitStatus !== 'No Contractor' && lead.permitStatus !== 'Owner-Builder') return false;
      if (filters.stormFirst && lead.source !== 'storm-first') return false;

      return true
    })
  }, [leads, filters])

  const stats = useMemo(
    () => ({
      totalLeads: leads.length,
      highPriority: leads.filter((l) => l.score >= 85).length,
      absenteeOwners: leads.filter(l => l.absenteeOwner).length,
      underpaidFlags: leads.filter(l => l.underpaidFlag).length,
    }),
    [leads]
  )

  function handleUpdateStatus(id: string, status: Lead['status']) {
    const nowIso = new Date().toISOString()
    const current = leads.find((l) => l.id === id)
    const patch: Parameters<typeof saveTracking>[1] = { status }
    if (status === 'Contacted' && !current?.contactedAt) patch.contactedAt = nowIso
    if (status === 'Converted' && !current?.convertedAt) patch.convertedAt = nowIso

    // Persist to Supabase (optimistic — also updates trackingMap which rerenders leads)
    saveTracking(id, patch)

    // Keep selectedLead in sync so the drawer reflects the change immediately
    if (selectedLead?.id === id) {
      setSelectedLead((prev) => {
        if (!prev) return null
        const next: Lead = { ...prev, status }
        if (patch.contactedAt) next.contactedAt = patch.contactedAt
        if (patch.convertedAt) next.convertedAt = patch.convertedAt
        return next
      })
    }
  }

  function handleUpdateTracking(id: string, patch: Parameters<typeof saveTracking>[1]) {
    saveTracking(id, patch)
    if (selectedLead?.id === id) {
      setSelectedLead((prev) => prev ? { ...prev, ...patch } : null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <Header
        leads={filteredLeads}
        totalToday={leads.length}
        lastScraped={lastScraped}
      />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="py-6">
          <StatsRow stats={stats} />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          <button
            onClick={() => navigate('/')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
              activeTab === 'leads'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Leads
          </button>
          <button
            onClick={() => navigate('/analytics')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
              activeTab === 'analytics'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Analytics
          </button>
        </div>

        <Routes>
          <Route
            path="/"
            element={
              <>
                <FilterBar
                  filters={filters}
                  onChange={setFilters}
                  onClear={() => setFilters(DEFAULT_FILTERS)}
                />
                <div className="mt-4">
                  <LeadsTable
                    leads={filteredLeads}
                    onSelectLead={setSelectedLead}
                    selectedLeadId={selectedLead?.id}
                  />
                </div>
              </>
            }
          />
          <Route path="/analytics" element={<Analytics leads={leads} />} />
        </Routes>
      </main>

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdateStatus={handleUpdateStatus}
          onUpdateTracking={handleUpdateTracking}
        />
      )}
    </div>
  )
}

import { useState } from 'react';
import { 
  Search, 
  Bell, 
  Settings, 
  Download, 
  TrendingUp, 
  AlertCircle, 
  UserMinus, 
  Flag, 
  Plus, 
  HelpCircle, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Mail,
  Eye,
  Flame,
  Droplets,
  Wind,
  LayoutGrid,
  CloudLightning,
  FolderOpen,
  BarChart3,
  MapPin,
  Clock,
  CheckCircle2,
  Hash,
  DollarSign,
  Phone,
  Copy,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// --- Shared Components ---

const Sidebar = ({ currentTab, setTab, isOpen, onClose }: { currentTab: string, setTab: (tab: string) => void, isOpen: boolean, onClose: () => void }) => {
  const tabs = [
    { id: 'leads', label: 'Leads', icon: LayoutGrid },
    { id: 'storm', label: 'Storm Watch', icon: CloudLightning },
    { id: 'cases', label: 'Cases', icon: FolderOpen },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[55] lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`h-screen w-64 fixed left-0 border-r border-slate-200/15 bg-slate-50 flex flex-col py-6 px-4 gap-2 z-[60] transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 px-2 flex justify-between items-center">
          <div>
            <h1 className="font-headline font-bold text-lg text-slate-900">Curator</h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Lead Intelligence</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
            <Plus className="rotate-45" size={20} />
          </button>
        </div>
      
      <nav className="flex-1 space-y-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              currentTab === tab.id 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-1 pt-4">
        <button 
          onClick={() => toast.success('New Lead creation coming soon!')}
          className="w-full flex items-center justify-center gap-2 mb-6 py-2.5 bg-secondary text-white text-sm font-semibold rounded-lg shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          New Lead
        </button>
        <button 
          onClick={() => toast.info('Support center is currently offline.')}
          className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-all"
        >
          <HelpCircle size={18} />
          Support
        </button>
        <button 
          onClick={() => toast.error('Sign out logic will be implemented with Auth.')}
          className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-all"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
    </>
  );
};

const Header = ({ title, onMenuClick }: { title: string, onMenuClick: () => void }) => (
  <header className="w-full top-0 sticky z-40 bg-slate-50/80 backdrop-blur-xl flex justify-between items-center px-4 sm:px-8 h-16 border-b border-slate-200/15">
    <div className="flex items-center gap-4">
      <button 
        onClick={onMenuClick}
        className="lg:hidden p-2 text-slate-500 hover:bg-slate-200/50 rounded-full transition-colors"
      >
        <LayoutGrid size={20} />
      </button>
      <span className="font-headline font-extrabold tracking-tighter text-lg sm:text-xl text-slate-900 truncate">{title}</span>
    </div>
    <div className="flex items-center gap-2 sm:gap-4">
      <button 
        onClick={() => toast('No new notifications')}
        className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full transition-colors relative"
      >
        <Bell size={20} />
        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
      </button>
      <button 
        onClick={() => toast.info('Settings panel is under construction.')}
        className="p-2 text-slate-500 hover:bg-slate-200/50 rounded-full transition-colors hidden sm:block"
      >
        <Settings size={20} />
      </button>
      <div 
        onClick={() => toast('Profile details coming soon')}
        className="h-8 w-8 rounded-full overflow-hidden ml-2 ring-2 ring-surface-container flex-shrink-0 cursor-pointer"
      >
        <img 
          src="https://picsum.photos/seed/curator-user/100/100" 
          alt="User profile" 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  </header>
);

const MetricCard = ({ title, value, icon: Icon, trend, badge, iconBg }: any) => (
  <motion.div 
    whileHover={{ scale: 1.02 }}
    className="bg-surface-container-lowest p-6 rounded-xl border border-transparent shadow-sm flex flex-col gap-1 transition-all"
  >
    <div className="flex items-center gap-2 mb-3">
      <div className={`p-2 ${iconBg} rounded-lg`}>
        <Icon size={18} className="text-secondary" />
      </div>
      <span className="text-[10px] font-bold text-on-primary-container uppercase tracking-wider">{title}</span>
    </div>
    <span className="font-headline text-3xl font-extrabold text-on-surface">{value}</span>
    {trend && (
      <span className={`text-[10px] font-medium flex items-center gap-1 mt-1 ${trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
        {trend.startsWith('+') ? <TrendingUp size={12} /> : <ArrowDownRight size={12} />}
        {trend} from last month
      </span>
    )}
    {badge && (
      <div className="flex mt-2">
        <span className={`px-2 py-0.5 rounded-full ${badge.bg} ${badge.text} text-[9px] font-bold uppercase tracking-tight`}>
          {badge.label}
        </span>
      </div>
    )}
    {!trend && !badge && (
      <span className="text-[10px] text-slate-400 font-medium mt-1">No records matching</span>
    )}
  </motion.div>
);

// --- Property Detail Sidebar ---

const PropertyDetailSidebar = ({ property, onClose }: { property: any, onClose: () => void }) => {
  if (!property) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]"
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-screen w-full sm:w-[480px] bg-surface-container-lowest shadow-2xl z-[70] overflow-y-auto border-l border-slate-200/15"
      >
        <div className="p-8 space-y-10">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-4">
              <div>
                <h3 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">{property.owner}</h3>
                <p className="text-sm text-slate-500 font-medium flex items-center gap-1 mt-1">
                  <MapPin size={14} /> {property.address}
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-xs font-bold text-green-700">{property.score} · High</span>
                </div>
                <span className="px-3 py-1 bg-tertiary-container text-tertiary-fixed text-[10px] font-bold rounded-full uppercase tracking-tight">Fire</span>
                <span className="px-3 py-1 bg-secondary-container/10 text-secondary text-[10px] font-bold rounded-full uppercase tracking-tight">Business Entity</span>
                <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-tight">Non-Homestead</span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
            >
              <Plus className="rotate-45" size={24} />
            </button>
          </div>

          {/* Property Details Section */}
          <section className="space-y-6">
            <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Property Details</h4>
            <div className="grid grid-cols-1 gap-5">
              {[
                { label: 'County', value: 'Miami-Dade County', icon: LayoutGrid },
                { label: 'Folio Number', value: '2230100140020', icon: Hash },
                { label: 'Permit Type', value: 'Hvls Fire Alarm', icon: Settings },
                { label: 'Permit Date', value: 'Mar 29, 2026', icon: Clock },
                { label: 'Lead Date', value: 'Mar 29, 2026', icon: Clock },
                { label: 'Owner Mailing Address', value: '311 S WACKER DR #3900, Chicago, IL 60606', icon: MapPin, highlight: true },
                { label: 'Assessed Value', value: '$31,385,000', icon: DollarSign },
              ].map((item: any) => (
                <div key={item.label} className="flex gap-4">
                  <div className="p-2 bg-slate-50 rounded-lg text-slate-400 h-fit flex-shrink-0">
                    <item.icon size={16} />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{item.label}</p>
                    <p className={`text-sm font-semibold break-words ${item.highlight ? 'text-orange-600' : 'text-on-surface'}`}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Permit Intelligence */}
          <section className="space-y-6">
            <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Permit Intelligence</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500 underline cursor-pointer">Contractor</span>
                <span className="text-xs font-bold text-on-surface uppercase">SUMMIT FIRE & SECURITY LLC</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500 underline cursor-pointer">Permit Value</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface">$6,100</span>
                  <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[9px] font-bold rounded uppercase">Likely Underpaid</span>
                </div>
              </div>
            </div>
          </section>

          {/* Property Intelligence */}
          <section className="space-y-6">
            <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Property Intelligence</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500 underline cursor-pointer">Owner Occupied</span>
                <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={14} /> Local owner
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500 underline cursor-pointer">Prior Permits</span>
                <span className="text-xs font-bold text-purple-600">2 prior at this address</span>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section className="space-y-6">
            <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Contact Information</h4>
            <div className="flex gap-4">
              <div className="p-2 bg-green-50 rounded-lg text-green-600 h-fit">
                <Phone size={16} />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</p>
                <p className="text-sm font-bold text-green-600">(233)337-4142</p>
              </div>
            </div>
          </section>

          {/* AI Outreach */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em]">AI Outreach Message</h4>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`Dear Property Owner, our records indicate your property at ${property.address} may have sustained fire damage...`);
                  toast.success('Message copied to clipboard!');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                <Copy size={12} /> Copy Message
              </button>
            </div>
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed font-medium">
              Dear Property Owner, our records indicate your property at {property.address} may have sustained fire damage. As a licensed Florida public adjuster, Curator Intelligence specializes in maximizing insurance settlements at no upfront cost to you. We'd love to schedule a free property inspection to ensure you receive every dollar you deserve. Please call or text us at (800) 555-0100.
            </div>
          </section>

          {/* Engagement & Conversion */}
          <section className="space-y-6">
            <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Engagement & Conversion</h4>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Contact Method</label>
                <select 
                  onChange={(e) => toast.info(`Contact method set to ${e.target.value}`)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-2.5 px-3 font-medium focus:ring-0 appearance-none cursor-pointer"
                >
                  <option>— not set —</option>
                  <option>Phone Call</option>
                  <option>Email</option>
                  <option>Text Message</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Claim Value</label>
                <input 
                  type="text" 
                  placeholder="e.g. 45000" 
                  onBlur={(e) => e.target.value && toast.success(`Claim value updated: $${e.target.value}`)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-2.5 px-3 font-medium focus:ring-0 outline-none" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Notes</label>
                <textarea 
                  placeholder="Add adjuster notes..." 
                  onBlur={(e) => e.target.value && toast('Note auto-saved')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-3 px-3 font-medium focus:ring-0 outline-none h-24 resize-none" 
                />
              </div>
            </div>
          </section>

          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-50 text-slate-600 text-sm font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </>
  );
};

// --- Leads View ---

const LeadsView = () => {
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  
  const leads = [
    { id: '1024', address: '4521 Oakmont Ave, Houston TX', tags: [{ label: 'Underpaid', type: 'error' }, { label: 'Repeat', type: 'secondary' }], owner: 'Everett Richardson', damage: { type: 'Fire', icon: Flame, color: 'text-orange-500' }, score: '88.7', date: 'Oct 12, 2023', status: 'NEW' },
    { id: '1023', address: '9102 Silverleaf Ln, Miami FL', tags: [{ label: 'High Equity', type: 'secondary' }], owner: 'Marcus Thorne', damage: { type: 'Flood', icon: Droplets, color: 'text-blue-400' }, score: '82.1', date: 'Oct 11, 2023', status: 'REVIEWED' },
    { id: '1022', address: '331 Sunset Blvd, Los Angeles CA', tags: [{ label: 'Underpaid', type: 'error' }], owner: 'Sarah Jenkins', damage: { type: 'Wind', icon: Wind, color: 'text-slate-400' }, score: '94.5', date: 'Oct 11, 2023', status: 'NEW' }
  ];

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {selectedProperty && (
          <PropertyDetailSidebar 
            property={selectedProperty} 
            onClose={() => setSelectedProperty(null)} 
          />
        )}
      </AnimatePresence>
      
      <div className="flex justify-between items-end">
        <div>
          <span className="text-secondary font-bold text-[10px] tracking-widest uppercase mb-2 block">Dashboard Overview</span>
          <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">Lead Intelligence</h2>
        </div>
        <button 
          onClick={() => toast.success('Exporting 14,762 leads to CSV...')}
          className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-highest text-on-surface font-semibold text-sm rounded-lg hover:bg-surface-container-high transition-colors"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Leads" value="14,762" icon={LayoutGrid} trend="+12%" iconBg="bg-primary-fixed" />
        <MetricCard title="High Priority" value="1,044" icon={AlertCircle} badge={{ label: 'Action Required', bg: 'bg-secondary-container', text: 'text-on-secondary-container' }} iconBg="bg-secondary-container/10" />
        <MetricCard title="Absentee Owners" value="0" icon={UserMinus} iconBg="bg-slate-100" />
        <MetricCard title="Underpaid Flags" value="1,432" icon={Flag} badge={{ label: 'System flagged', bg: 'bg-tertiary-container', text: 'text-on-tertiary-container' }} iconBg="bg-tertiary-container/10" />
      </div>

      <div className="bg-surface-container-low rounded-xl p-4 sm:p-8 border border-slate-100/10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="col-span-full mb-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Search by property address, owner name, or lead ID..." className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border-none rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-secondary/20 transition-all outline-none" />
            </div>
          </div>
          {['Zip Code', 'Damage Type', 'Owner Type', 'Status', 'Score Range'].map((label) => (
            <div key={label} className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-primary-container uppercase tracking-widest px-1">{label}</label>
              <select 
                onChange={(e) => toast(`Filter applied: ${label} = ${e.target.value}`)}
                className="w-full bg-surface-container-highest border-none rounded-lg text-xs py-2.5 px-3 font-medium focus:ring-0 appearance-none cursor-pointer"
              >
                <option>All {label}s</option>
                <option>Sample {label} 1</option>
                <option>Sample {label} 2</option>
              </select>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row justify-end mt-6 gap-3">
          <button 
            onClick={() => toast('Filters cleared')}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 px-4 py-2 transition-colors"
          >
            Clear Filters
          </button>
          <button 
            onClick={() => toast.promise(new Promise(r => setTimeout(r, 1000)), {
              loading: 'Analyzing leads...',
              success: 'Insights applied successfully!',
              error: 'Failed to apply insights.'
            })}
            className="bg-on-surface text-white text-xs font-bold px-6 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Apply Insights
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-slate-100/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/15">
                <th className="px-6 py-4 text-[11px] font-bold text-on-primary-container uppercase tracking-wider">#</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-primary-container uppercase tracking-wider">Property Address</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-primary-container uppercase tracking-wider">Owner</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-primary-container uppercase tracking-wider">Damage</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-primary-container uppercase tracking-wider">Score</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-primary-container uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold text-on-primary-container uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {leads.map((lead) => (
                <tr 
                  key={lead.id} 
                  onClick={() => setSelectedProperty(lead)}
                  className="hover:bg-surface-container-low transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-5 text-sm font-medium text-slate-400">{lead.id}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-bold text-on-surface">{lead.address}</span>
                      <div className="flex gap-2">
                        {lead.tags.map(tag => (
                          <span key={tag.label} className={`px-2 py-0.5 rounded-full ${tag.type === 'error' ? 'bg-tertiary-container text-tertiary-fixed' : 'bg-secondary-container/10 text-secondary'} text-[10px] font-bold`}>
                            {tag.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm font-medium text-on-surface">{lead.owner}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <lead.damage.icon size={18} className={lead.damage.color} />
                      <span className="text-sm font-semibold text-on-surface">{lead.damage.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm font-headline font-bold text-secondary">{lead.score}</td>
                  <td className="px-6 py-5 text-center">
                    <span className={`px-3 py-1 rounded-full ${lead.status === 'NEW' ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-slate-100 text-slate-500'} text-[10px] font-bold`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.success(`Drafting email to ${lead.owner}...`);
                        }}
                        className="p-2 text-slate-400 hover:text-secondary hover:bg-white rounded-lg transition-all"
                      >
                        <Mail size={18} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProperty(lead);
                        }}
                        className="p-2 text-slate-400 hover:text-on-surface hover:bg-white rounded-lg transition-all"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-8 py-5 border-t border-slate-100/50 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Showing 1-10 of 14,762 leads</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => toast('Already on first page')}
              className="p-1.5 rounded-lg border border-outline-variant/30 text-slate-400 hover:bg-surface-container-low transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button className="px-3 py-1 rounded-lg bg-secondary text-white text-xs font-bold">1</button>
            <button 
              onClick={() => toast('Pagination logic coming soon')}
              className="px-3 py-1 rounded-lg text-slate-500 hover:bg-surface-container-low text-xs font-bold transition-colors"
            >
              2
            </button>
            <button 
              onClick={() => toast('Loading next page...')}
              className="p-1.5 rounded-lg border border-outline-variant/30 text-slate-400 hover:bg-surface-container-low transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Storm Watch View ---

const StormWatchView = () => {
  const alerts = [
    { id: 'SW-001', type: 'Hurricane Warning', severity: 'Critical', location: 'Gulf Coast Region', properties: 428, time: '2h ago', status: 'Active' },
    { id: 'SW-002', type: 'Severe Thunderstorm', severity: 'High', location: 'Central Texas', properties: 156, time: '4h ago', status: 'Active' },
    { id: 'SW-003', type: 'Flash Flood Watch', severity: 'Moderate', location: 'South Florida', properties: 89, time: '6h ago', status: 'Monitoring' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-red-500 font-bold text-[10px] tracking-widest uppercase mb-2 block">Real-time Risk Monitoring</span>
          <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">Storm Watch</h2>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => toast.info('Loading interactive risk map...')}
            className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-highest text-on-surface font-semibold text-sm rounded-lg hover:bg-surface-container-high transition-colors"
          >
            <MapPin size={18} />
            View Map
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard title="Active Alerts" value="12" icon={CloudLightning} trend="+2" iconBg="bg-red-50" />
        <MetricCard title="Properties at Risk" value="1,240" icon={AlertCircle} iconBg="bg-orange-50" />
        <MetricCard title="Avg. Severity" value="High" icon={Flag} iconBg="bg-yellow-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider px-1">Active Weather Events</h3>
          {alerts.map((alert) => (
            <motion.div 
              key={alert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-container-lowest p-6 rounded-xl border border-slate-100/50 shadow-sm flex items-center justify-between group hover:border-red-200 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${alert.severity === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                  <CloudLightning size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-on-surface">{alert.type}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      alert.severity === 'Critical' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-3">
                    <span className="flex items-center gap-1"><MapPin size={12} /> {alert.location}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {alert.time}</span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-headline font-extrabold text-on-surface">{alert.properties}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Properties Impacted</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider px-1">Risk Distribution</h3>
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-slate-100/50 shadow-sm h-[350px] flex flex-col">
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Critical', value: 400 },
                      { name: 'High', value: 300 },
                      { name: 'Moderate', value: 300 },
                    ]}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#ef4444" />
                    <Cell fill="#f97316" />
                    <Cell fill="#eab308" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4 flex-shrink-0">
              {['Critical', 'High', 'Moderate'].map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${['bg-red-500', 'bg-orange-500', 'bg-yellow-500'][i]}`} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Cases View ---

const CasesView = () => {
  const columns = [
    { id: 'open', label: 'Open', color: 'bg-blue-500' },
    { id: 'review', label: 'In Review', color: 'bg-orange-500' },
    { id: 'closed', label: 'Closed', color: 'bg-green-500' },
  ];

  const cases = [
    { id: 'CS-4412', title: 'Fire Damage Claim', property: '4521 Oakmont Ave', assignee: 'Everett R.', status: 'open', priority: 'High' },
    { id: 'CS-4413', title: 'Water Leak Assessment', property: '9102 Silverleaf Ln', assignee: 'Marcus T.', status: 'review', priority: 'Medium' },
    { id: 'CS-4414', title: 'Roof Inspection', property: '331 Sunset Blvd', assignee: 'Sarah J.', status: 'closed', priority: 'Low' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-secondary font-bold text-[10px] tracking-widest uppercase mb-2 block">Workflow Management</span>
          <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">Active Cases</h2>
        </div>
        <button 
          onClick={() => toast.success('Case creation wizard opened.')}
          className="flex items-center gap-2 px-5 py-2.5 bg-on-surface text-white font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          Create Case
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {columns.map((col) => (
          <div key={col.id} className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${col.color}`} />
                <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">{col.label}</h3>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {cases.filter(c => c.status === col.id).length}
                </span>
              </div>
              <button 
                onClick={() => toast('Column options coming soon')}
                className="text-slate-400 hover:text-on-surface transition-colors"
              >
                <MoreVertical size={16} />
              </button>
            </div>
            
            <div className="space-y-4">
              {cases.filter(c => c.status === col.id).map((item) => (
                <motion.div 
                  key={item.id}
                  whileHover={{ y: -2 }}
                  className="bg-surface-container-lowest p-5 rounded-xl border border-slate-100/50 shadow-sm space-y-4 group cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{item.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      item.priority === 'High' ? 'bg-red-50 text-red-600' : item.priority === 'Medium' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                    }`}>
                      {item.priority}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface mb-1 group-hover:text-secondary transition-colors">{item.title}</h4>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <MapPin size={12} /> {item.property}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {item.assignee.charAt(0)}
                      </div>
                      <span className="text-xs font-medium text-slate-600">{item.assignee}</span>
                    </div>
                    <button className="p-1.5 text-slate-400 hover:text-secondary transition-colors"><CheckCircle2 size={16} /></button>
                  </div>
                </motion.div>
              ))}
              <button className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-secondary hover:text-secondary transition-all">
                + Add Card
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Analytics View ---

const AnalyticsView = () => {
  const data = [
    { name: 'Mon', leads: 400, cases: 240 },
    { name: 'Tue', leads: 300, cases: 139 },
    { name: 'Wed', leads: 200, cases: 980 },
    { name: 'Thu', leads: 278, cases: 390 },
    { name: 'Fri', leads: 189, cases: 480 },
    { name: 'Sat', leads: 239, cases: 380 },
    { name: 'Sun', leads: 349, cases: 430 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-secondary font-bold text-[10px] tracking-widest uppercase mb-2 block">Performance Insights</span>
          <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">Analytics</h2>
        </div>
        <div className="flex gap-3">
          <select 
            onChange={(e) => toast(`Time range changed to: ${e.target.value}`)}
            className="bg-surface-container-highest border-none rounded-lg text-xs py-2.5 px-4 font-bold focus:ring-0 cursor-pointer"
          >
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>Year to Date</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard title="Conversion Rate" value="24.8%" icon={TrendingUp} trend="+4.2%" iconBg="bg-blue-50" />
        <MetricCard title="Avg. Response Time" value="1.2h" icon={Clock} trend="-15%" iconBg="bg-purple-50" />
        <MetricCard title="Lead Quality Score" value="8.4" icon={CheckCircle2} trend="+0.5" iconBg="bg-green-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface-container-lowest p-8 rounded-xl border border-slate-100/50 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Lead vs Case Volume</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-secondary" /><span className="text-[10px] font-bold text-slate-500 uppercase">Leads</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-300" /><span className="text-[10px] font-bold text-slate-500 uppercase">Cases</span></div>
            </div>
          </div>
          <div className="h-[320px] w-full pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0051d5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0051d5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}} />
                <Tooltip />
                <Area type="monotone" dataKey="leads" stroke="#0051d5" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="cases" stroke="#93c5fd" strokeWidth={3} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-8 rounded-xl border border-slate-100/50 shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Lead Source Distribution</h3>
          <div className="h-[320px] w-full pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Direct', value: 400 },
                { name: 'Referral', value: 300 },
                { name: 'Social', value: 200 },
                { name: 'Search', value: 278 },
                { name: 'Other', value: 189 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}} />
                <Tooltip />
                <Bar dataKey="value" fill="#0051d5" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [currentTab, setTab] = useState('leads');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const renderView = () => {
    switch (currentTab) {
      case 'leads': return <LeadsView />;
      case 'storm': return <StormWatchView />;
      case 'cases': return <CasesView />;
      case 'analytics': return <AnalyticsView />;
      default: return <LeadsView />;
    }
  };

  const getTitle = () => {
    switch (currentTab) {
      case 'leads': return 'The Intelligent Ledger';
      case 'storm': return 'Risk Command Center';
      case 'cases': return 'Workflow Engine';
      case 'analytics': return 'Intelligence Hub';
      default: return 'Curator Intelligence';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <Sidebar 
        currentTab={currentTab} 
        setTab={(tab) => {
          setTab(tab);
          setSidebarOpen(false);
        }} 
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      <main className="lg:ml-64 min-h-screen flex flex-col">
        <Header 
          title={getTitle()} 
          onMenuClick={() => setSidebarOpen(true)}
        />
        
        <div className="p-4 sm:p-8 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

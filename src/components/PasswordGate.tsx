import { useState, useEffect, type ReactNode } from 'react'
import { Shield, Lock, Eye, EyeOff } from 'lucide-react'

const SESSION_KEY = 'cra_authed'
const ENV_PASSWORD = import.meta.env.VITE_APP_PASSWORD as string | undefined
const PASSWORD = ENV_PASSWORD?.trim() || 'droidleads'
const USING_DEFAULT_PASSWORD = !ENV_PASSWORD

interface PasswordGateProps {
  children: ReactNode
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const [authed, setAuthed] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      setAuthed(true)
    }
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setAuthed(true)
    } else {
      setError(true)
      setShaking(true)
      setInput('')
      setTimeout(() => setShaking(false), 500)
      setTimeout(() => setError(false), 2500)
    }
  }

  if (authed) return <>{children}</>

  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center px-4">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-[360px]">
        {/* Card */}
        <div
          className={`bg-[#161618] border border-white/[0.08] rounded-2xl px-8 py-10 shadow-2xl transition-transform duration-150 ${
            shaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
          }`}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <h1 className="text-[15px] font-semibold text-white tracking-tight">
              Claim Remedy Adjusters
            </h1>
            <p className="text-[12px] text-zinc-500 mt-1">Lead Intelligence System</p>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mb-8" />

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-[0.08em] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError(false) }}
                  placeholder="Enter password"
                  autoFocus
                  className={`w-full bg-[#0f0f11] border rounded-lg pl-9 pr-10 py-2.5 text-[13px] text-white
                             placeholder:text-zinc-700 outline-none transition-colors duration-150
                             ${error
                               ? 'border-red-500/60 focus:border-red-500'
                               : 'border-white/[0.08] focus:border-white/20'
                             }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {error && (
                <p className="text-[11px] text-red-400 mt-1.5">Incorrect password. Try again.</p>
              )}
              {USING_DEFAULT_PASSWORD && (
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  Local default password: <span className="text-zinc-300">droidleads</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 active:bg-amber-500
                         text-[13px] font-semibold text-zinc-900 transition-colors duration-150 mt-1"
            >
              Unlock
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-zinc-700 mt-6">
          Claim Remedy Adjusters · Internal use only
        </p>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}

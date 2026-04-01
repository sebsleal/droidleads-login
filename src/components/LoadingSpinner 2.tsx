import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  label?: string
}

export default function LoadingSpinner({ label = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="card flex flex-col items-center justify-center py-20 text-center" data-testid="loading-spinner">
      <Loader2 className="w-8 h-8 text-zinc-300 mb-3 animate-spin" />
      <p className="text-zinc-400 text-[13px]">{label}</p>
    </div>
  )
}

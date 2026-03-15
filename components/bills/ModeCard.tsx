'use client'

interface ModeCardProps {
  icon: string
  title: string
  desc: string
  onClick: () => void
}

export function ModeCard({ icon, title, desc, onClick }: ModeCardProps) {
  return (
    <button onClick={onClick} className="card p-5 text-left hover:shadow-md hover:border-brand-300 transition-all">
      <div className="text-3xl mb-3">{icon}</div>
      <p className="font-semibold text-gray-900 text-sm mb-1">{title}</p>
      <p className="text-xs text-gray-500">{desc}</p>
    </button>
  )
}

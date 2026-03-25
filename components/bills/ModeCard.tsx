'use client'

interface ModeCardProps {
  icon: string
  title: string
  desc: string
  onClick: () => void
}

export function ModeCard({ icon, title, desc, onClick }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      className="group rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl">
          {icon}
        </div>
        <span className="text-sm text-slate-300 transition-colors group-hover:text-brand-500">→</span>
      </div>
      <p className="font-semibold text-slate-900 text-base mb-2 tracking-tight">{title}</p>
      <p className="text-sm leading-6 text-slate-500">{desc}</p>
    </button>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type MatchMode = 'exact' | 'section'

function isActivePath(pathname: string, href: string, match: MatchMode) {
  if (match === 'exact') {
    return pathname === href
  }

  if (href === '/bills') {
    return pathname === '/bills' || /^\/bills\/[^/]+$/.test(pathname)
  }

  if (href === '/dashboard') {
    return pathname === '/dashboard'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function NavLink({
  href,
  label,
  icon,
  variant = 'sidebar',
  match = 'exact',
  onClick,
}: {
  href: string
  label: string
  icon: string
  variant?: 'sidebar' | 'menu' | 'mobile'
  match?: MatchMode
  onClick?: () => void
}) {
  const pathname = usePathname()
  const active = isActivePath(pathname, href, match)

  const classes = variant === 'sidebar'
    ? active
      ? 'bg-white text-brand-700 shadow-sm'
      : 'text-brand-100 hover:bg-brand-600 hover:text-white'
    : variant === 'menu'
      ? active
        ? 'bg-brand-50 text-brand-700'
        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
      : active
        ? 'text-brand-700'
        : 'text-slate-600'

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${variant === 'mobile' ? 'flex-col justify-center px-2 py-3 text-[11px]' : 'px-3 py-2'} ${classes}`}
    >
      <span className={variant === 'mobile' ? 'text-base' : ''}>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}

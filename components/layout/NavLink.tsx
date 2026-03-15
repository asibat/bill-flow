'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-brand-600 text-white' : 'text-brand-200 hover:bg-brand-600 hover:text-white'}`}>
      <span>{icon}</span>{label}
    </Link>
  )
}

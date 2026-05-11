'use client'

import { usePathname } from 'next/navigation'

const HIDDEN_PREFIXES = ['/login', '/signup', '/reporting/parents/']

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const noSidebar = HIDDEN_PREFIXES.some(p =>
    p.endsWith('/') ? pathname.startsWith(p) : pathname === p
  )

  return (
    <main style={{ marginLeft: noSidebar ? 0 : '240px', minHeight: '100vh' }}>
      {children}
    </main>
  )
}

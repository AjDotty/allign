'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutGrid,
  CalendarDays,
  BookOpen,
  Trophy,
  Users,
  FileText,
  Home,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  disabled?: boolean
}

type NavSection = {
  heading?: string
  items: NavItem[]
  disabled?: boolean
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const iconSize = 16

const NAV: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/',                    icon: <LayoutGrid size={iconSize} /> },
    ],
  },
  {
    heading: 'Training',
    items: [
      { label: 'Sessions',         href: '/training/sessions',  icon: <CalendarDays size={iconSize} /> },
      { label: 'Exercise Library', href: '/training/exercises', icon: <BookOpen size={iconSize} /> },
    ],
  },
  {
    heading: 'Performance',
    items: [
      { label: 'Matches', href: '/performance/matches', icon: <Trophy size={iconSize} /> },
      { label: 'Players', href: '/performance/players', icon: <Users size={iconSize} /> },
    ],
  },
  {
    heading: 'Reporting',
    items: [
      { label: 'Reports',       href: '/reporting',         icon: <FileText size={iconSize} /> },
      { label: 'Parent Portal', href: '/reporting/parents', icon: <Home size={iconSize} />    },
    ],
  },
]

// ─── Auth pages that should not show the sidebar ─────────────────────────────

const HIDDEN_PATHS = ['/login', '/signup']
const HIDDEN_PREFIXES = ['/reporting/parents/']

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [orgName, setOrgName] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserName(user.email ?? null)

      const { data: member } = await supabase
        .from('members')
        .select('id, name')
        .eq('user_id', user.id)
        .single()

      if (member?.name) setUserName(member.name)

      if (member) {
        const { data: orgMembership } = await supabase
          .from('organisation_members')
          .select('organisation_id')
          .eq('member_id', member.id)
          .single()

        if (orgMembership?.organisation_id) {
          const { data: org } = await supabase
            .from('organisations')
            .select('name')
            .eq('id', orgMembership.organisation_id)
            .single()

          setOrgName(org?.name ?? null)
        }
      }
    }

    fetchUser()
  }, [])

  // Hide on auth pages and public routes
  if (HIDDEN_PATHS.includes(pathname)) return null
  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Active: exact match for /, prefix match for everything else
  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: '240px', zIndex: 40,
      background: '#FFFFFF',
      borderRight: '1px solid #E5E7EB',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
      overflowY: 'auto',
    }}>

      {/* Brand */}
      <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#111111', lineHeight: 1.1 }}>Allign</div>
        <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '3px' }}>by Dottedline</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {NAV.map((section, sIdx) => (
          <div key={sIdx} style={{ marginBottom: '20px' }}>
            {section.heading && (
              <div style={{
                fontSize: '10px', fontWeight: 600,
                color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                padding: '0 10px', marginBottom: '4px',
              }}>
                {section.heading}
              </div>
            )}

            {section.items.map(item => {
              const active = isActive(item.href)
              const disabled = item.disabled

              if (disabled) {
                return (
                  <div
                    key={item.href}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '7px 10px', borderRadius: '8px',
                      color: '#C4C9D1', cursor: 'default',
                      fontSize: '14px', fontWeight: 500,
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ flexShrink: 0, opacity: 0.5 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <span style={{
                      fontSize: '10px', fontWeight: 600, color: '#C4C9D1',
                      background: '#F3F4F6', borderRadius: '9999px',
                      padding: '1px 6px', letterSpacing: '0.03em',
                    }}>
                      Soon
                    </span>
                  </div>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 10px', borderRadius: '8px',
                    textDecoration: 'none', marginBottom: '2px',
                    fontSize: '14px', fontWeight: active ? 600 : 500,
                    color: active ? '#FFFFFF' : '#6B7280',
                    background: active ? '#111111' : 'transparent',
                    transition: 'background 0.1s, color 0.1s',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = '#F9FAFB'
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <span style={{ flexShrink: 0 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: org + user + sign out */}
      <div style={{
        borderTop: '1px solid #E5E7EB', padding: '14px 16px', flexShrink: 0,
      }}>
        {orgName && (
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#111111', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {orgName}
          </div>
        )}
        {userName && (
          <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userName}
          </div>
        )}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            width: '100%', padding: '7px', borderRadius: '8px',
            border: '1px solid #E5E7EB', background: '#FFFFFF',
            fontSize: '13px', fontWeight: 500, color: '#6B7280',
            cursor: signingOut ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', textAlign: 'center',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF' }}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}

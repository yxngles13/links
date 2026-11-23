// components/NetworkingLayout.tsx
// The Networking tab: top bar, profile reminder, and a pill side menu
// (Professors / Matches / Network / Follow-ups) beside the page, a colored dot
// per section and a count on Follow-ups when someone is due. Each section's
// layout.tsx renders this, so the pages themselves only render their content.
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import ProfileReminder from '@/components/ProfileReminder'
import { requireUser } from '@/lib/auth'
import { needsFollowUp } from '@/lib/format'

export type NetworkingSection = 'professors' | 'matches' | 'network' | 'follow-ups'

const SECTIONS: { id: NetworkingSection; href: string; label: string; dot: string }[] = [
  { id: 'professors', href: '/professors', label: 'Professors', dot: 'dot-butter' },
  { id: 'matches', href: '/matches', label: 'Matches', dot: 'dot-lilac' },
  { id: 'network', href: '/network', label: 'Network', dot: 'dot-mint' },
  { id: 'follow-ups', href: '/follow-ups', label: 'Follow-ups', dot: 'dot-peach' },
]

// Same rule as app/follow-ups/page.tsx. A badge is never worth breaking the
// page it sits on, so any failure just hides it.
async function followUpsDue(): Promise<number> {
  const { supabase } = await requireUser()
  try {
    const { data, error } = await supabase.from('network_contacts').select('last_interaction_at')
    if (error || !data) return 0
    return data.filter((c) => needsFollowUp(c.last_interaction_at as string | null)).length
  } catch {
    return 0
  }
}

export default async function NetworkingLayout({ active, children }: { active: NetworkingSection; children: React.ReactNode }) {
  const due = await followUpsDue()
  return (
    <>
      <AppNav active="networking" />
      <ProfileReminder />
      <div className="netshell">
        <nav className="sidenav" aria-label="Networking">
          {SECTIONS.map((s) => (
            <Link key={s.id} href={s.href} aria-current={s.id === active ? 'page' : undefined}>
              <span aria-hidden="true" className={`dot ${s.dot}`} />
              {s.label}
              {s.id === 'follow-ups' && due > 0 ? (
                <span className="count">{due}<span className="sr-only"> due</span></span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="netbody">{children}</div>
      </div>
    </>
  )
}

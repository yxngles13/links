// components/NetworkingLayout.tsx
// The Networking tab: top bar, profile reminder, and a left section nav
// (Research / Network / Follow-ups) beside the page. Each section's
// layout.tsx renders this, so the pages themselves only render their content.
import Link from 'next/link'
import AppNav from '@/components/AppNav'
import ProfileReminder from '@/components/ProfileReminder'

export type NetworkingSection = 'research' | 'network' | 'follow-ups'

const SECTIONS: { id: NetworkingSection; href: string; label: string }[] = [
  { id: 'research', href: '/matches', label: 'Research' },
  { id: 'network', href: '/network', label: 'Network' },
  { id: 'follow-ups', href: '/follow-ups', label: 'Follow-ups' },
]

export default function NetworkingLayout({ active, children }: { active: NetworkingSection; children: React.ReactNode }) {
  return (
    <>
      <AppNav active="networking" />
      <ProfileReminder />
      <div className="netshell">
        <nav className="netnav" aria-label="Networking">
          {SECTIONS.map((s) => (
            <Link key={s.id} href={s.href} aria-current={s.id === active ? 'page' : undefined}>
              {s.label}
            </Link>
          ))}
        </nav>
        <div className="netbody">{children}</div>
      </div>
    </>
  )
}

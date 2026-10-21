// components/AgentTabs.tsx
// Second row under AppNav on the three agent pages: Capture, Plans, Activity.
import Link from 'next/link'

type AgentTab = 'capture' | 'plans' | 'activity'

const TABS: { id: AgentTab; href: string; label: string }[] = [
  { id: 'capture', href: '/capture', label: 'Capture' },
  { id: 'plans', href: '/plans', label: 'Plans' },
  { id: 'activity', href: '/activity', label: 'Activity' },
]

export default function AgentTabs({ active }: { active: AgentTab }) {
  return (
    <nav aria-label="Agent" style={{ display: 'flex', gap: 24, padding: '14px var(--gutter) 0', fontSize: 14 }}>
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === active ? 'page' : undefined}
          style={{ color: t.id === active ? 'var(--ink)' : 'var(--muted)', borderBottom: t.id === active ? '1px solid var(--ink)' : '1px solid transparent', paddingBottom: 2 }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

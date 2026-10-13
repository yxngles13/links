// components/AppNav.tsx
// Shared top pill nav. Only Research is live right now; Network and Mentors
// render as dimmed labels until those pages exist (swap each span for a
// <Link> when you build them).
import Link from 'next/link'

type Tab = 'research' | 'network' | 'mentors'

const soon = { fontSize: 13.5, fontWeight: 700, opacity: 0.4, cursor: 'default' } as const

export default function AppNav({ active = 'research' }: { active?: Tab }) {
  return (
    <nav className="l-nav">
      <Link href="/matches" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
          <rect x="2" y="9" width="14" height="8" rx="4" transform="rotate(-30 9 13)" stroke="#6C93FF" strokeWidth="2.6" />
          <rect x="10" y="9" width="14" height="8" rx="4" transform="rotate(-30 17 13)" stroke="#ffffff" strokeWidth="2.6" />
        </svg>
        <span className="l-display" style={{ fontSize: 19 }}>Links</span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Link href="/matches" aria-current={active === 'research' ? 'page' : undefined}>Research</Link>
        <span style={soon} title="Coming soon">Network</span>
        <span style={soon} title="Coming soon">Mentors</span>
      </div>

      <Link href="/onboarding">Edit profile</Link>
    </nav>
  )
}
// components/AppNav.tsx
// Shared top pill nav. Students get Research / Network / Mentors; mentor
// accounts get their own two-item nav (dashboard + profile).
import Link from 'next/link'

type Tab = 'research' | 'network' | 'mentors' | 'mentor-dashboard' | 'mentor-profile'

export function Logo() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <rect x="2" y="9" width="14" height="8" rx="4" transform="rotate(-30 9 13)" stroke="#6C93FF" strokeWidth="2.6" />
        <rect x="10" y="9" width="14" height="8" rx="4" transform="rotate(-30 17 13)" stroke="#ffffff" strokeWidth="2.6" />
      </svg>
      <span className="l-display" style={{ fontSize: 19 }}>Links</span>
    </span>
  )
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  )
}

export default function AppNav({ active = 'research' }: { active?: Tab }) {
  const isMentor = active === 'mentor-dashboard' || active === 'mentor-profile'

  return (
    <nav className="l-nav">
      <Link href={isMentor ? '/mentor' : '/matches'}>
        <Logo />
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        {isMentor ? (
          <>
            <NavLink href="/mentor" active={active === 'mentor-dashboard'}>Mentor dashboard</NavLink>
            <NavLink href="/mentor/profile" active={active === 'mentor-profile'}>My profile</NavLink>
          </>
        ) : (
          <>
            <NavLink href="/matches" active={active === 'research'}>Research</NavLink>
            <NavLink href="/network" active={active === 'network'}>Network</NavLink>
            <NavLink href="/mentors" active={active === 'mentors'}>Mentors</NavLink>
          </>
        )}
      </div>

      {isMentor ? <span /> : <Link href="/onboarding">Edit profile</Link>}
    </nav>
  )
}

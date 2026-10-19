// components/AppNav.tsx
// Top bar: serif wordmark left, plain text links right, active link
// underlined. Students get Research / Network / Mentors; mentor accounts
// get their own two-item nav.
import Link from 'next/link'

type Tab = 'research' | 'network' | 'mentors' | 'profile' | 'mentor-dashboard' | 'mentor-profile'

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
    <header className="topbar">
      <Link href={isMentor ? '/mentor' : '/matches'} className="brand">
        Links{isMentor ? <small>Mentor</small> : null}
      </Link>
      <nav className="topnav" aria-label="Main">
        {isMentor ? (
          <>
            <NavLink href="/mentor" active={active === 'mentor-dashboard'}>Dashboard</NavLink>
            <NavLink href="/mentor/profile" active={active === 'mentor-profile'}>My profile</NavLink>
          </>
        ) : (
          <>
            <NavLink href="/matches" active={active === 'research'}>Research</NavLink>
            <NavLink href="/network" active={active === 'network'}>Network</NavLink>
            <NavLink href="/mentors" active={active === 'mentors'}>Mentors</NavLink>
            <NavLink href="/onboarding" active={active === 'profile'}>Profile</NavLink>
          </>
        )}
      </nav>
    </header>
  )
}

// Bare top bar for pages outside the signed-in app (onboarding, sign-up).
export function BrandBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand">Links</Link>
      {right ? <span className="meta">{right}</span> : null}
    </header>
  )
}

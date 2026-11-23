// components/AppNav.tsx
// Top bar: serif wordmark left, plain text links right, active link
// underlined. Home / Networking / Plans / Profile (Networking holds Research,
// Network and Follow-ups behind its own side nav).
import Link from 'next/link'
import CreditsBadge from '@/components/CreditsBadge'
import FeedbackSurvey from '@/components/FeedbackSurvey'

type Tab = 'home' | 'networking' | 'plans' | 'profile'

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  )
}

export default function AppNav({ active = 'home' }: { active?: Tab }) {
  return (
    <header className="topbar">
      <Link href="/dashboard" className="brand">Links</Link>
      <nav className="topnav" aria-label="Main">
        <NavLink href="/dashboard" active={active === 'home'}>Home</NavLink>
        <NavLink href="/matches" active={active === 'networking'}>Networking</NavLink>
        <NavLink href="/plans" active={active === 'plans'}>Plans</NavLink>
        <NavLink href="/profile" active={active === 'profile'}>Profile</NavLink>
        <FeedbackSurvey />
        <CreditsBadge />
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

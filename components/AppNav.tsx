// components/AppNav.tsx
// Top bar: smiling logo mark and "links" wordmark left, nav pills right, the
// current page's pill filled in ink. Home / Networking / Profile (Networking
// holds Professors, Matches, Network and Follow-ups behind its own side menu).
import Link from 'next/link'
import CreditsBadge from '@/components/CreditsBadge'
import FeedbackSurvey from '@/components/FeedbackSurvey'

type Tab = 'home' | 'networking' | 'profile'

// The rounded-square purple mark with a small smile. Decorative: the
// wordmark beside it carries the name.
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false" style={{ width: size, height: size }}>
      <rect className="logo-tile" x="2" y="2" width="36" height="36" rx="14" />
      <circle cx="15" cy="18" r="2.6" fill="#FFFFFF" />
      <circle cx="25" cy="18" r="2.6" fill="#FFFFFF" />
      <path d="M14 25c3 3 9 3 12 0" stroke="#FFFFFF" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// Logo mark plus wordmark, linking home.
export function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="brand">
      <LogoMark />
      links
    </Link>
  )
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className="navpill" aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  )
}

// "Add to Chrome" in the top bar. Chrome can't install an extension from a
// site, so this opens the Web Store listing. Hidden until
// NEXT_PUBLIC_CHROME_EXTENSION_URL is set, and on phones (no extensions there).
function ChromePill() {
  const url = process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" className="navpill nav-chrome">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      Add to Chrome
    </a>
  )
}

export default function AppNav({ active = 'home' }: { active?: Tab }) {
  return (
    <header className="topbar">
      <Brand href="/dashboard" />
      <nav className="topnav" aria-label="Main">
        <NavLink href="/dashboard" active={active === 'home'}>Home</NavLink>
        <NavLink href="/professors" active={active === 'networking'}>Networking</NavLink>
        <NavLink href="/profile" active={active === 'profile'}>Profile</NavLink>
        <ChromePill />
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
      <Brand href="/" />
      {right ? <span className="meta">{right}</span> : null}
    </header>
  )
}

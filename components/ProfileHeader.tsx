// components/ProfileHeader.tsx
// Photo, name, headline and outside links. Shared by your own profile and
// the read-only view other people see, so both look the same.
import { initials } from '@/lib/format'
import { githubUrl, linkedinUrl } from '@/lib/profile'

export default function ProfileHeader({
  name,
  headline,
  photoUrl,
  resumeUrl,
  linkedin,
  github,
}: {
  name: string
  headline: string | null
  photoUrl: string | null
  resumeUrl: string | null
  linkedin: string | null
  github: string | null
}) {
  const links = [
    { href: linkedinUrl(linkedin), label: 'LinkedIn ↗' },
    { href: githubUrl(github), label: 'GitHub ↗' },
    { href: resumeUrl, label: 'Resume ↗' },
  ].filter((l): l is { href: string; label: string } => !!l.href)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', paddingBottom: 32, borderBottom: '1px solid var(--line)' }}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, changes every hour
        <img src={photoUrl} alt="" width={96} height={96} style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div aria-hidden className="serif" style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--paper)', border: '1px solid var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, flexShrink: 0 }}>
          {initials(name)}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 className="title-sm" style={{ marginBottom: 8 }}>{name}</h1>
        {headline ? <p className="lead" style={{ marginBottom: 12 }}>{headline}</p> : null}
        {links.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="link">{l.label}</a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

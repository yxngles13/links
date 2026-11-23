// components/ProfileHeader.tsx
// Photo, name, headline and outside links. Shared by your own profile and
// the read-only view other people see, so both look the same.
import { initials } from '@/lib/format'
import { pastelFor } from '@/lib/theme'
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

  const pastel = pastelFor(name)

  return (
    <div className="card profile-head">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, changes every hour
        <img src={photoUrl} alt="" width={104} height={104} className="profile-photo" />
      ) : (
        <div aria-hidden="true" className={`initials-tile profile-photo initials-tile-${pastel}`}>
          {initials(name)}
        </div>
      )}
      <div>
        <h1>{name}</h1>
        {headline ? <p className="lead">{headline}</p> : null}
        {links.length ? (
          <div className="profile-links">
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="pill">{l.label}</a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

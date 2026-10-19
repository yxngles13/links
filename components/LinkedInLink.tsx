// components/LinkedInLink.tsx
// External link to someone's LinkedIn, opened in a new tab. Renders nothing
// when there's no (safe) URL, so callers can drop it in unconditionally.
import { httpUrl } from '@/lib/format'

export default function LinkedInLink({ url, name, className = 'link', style }: { url: string | null | undefined; name: string; className?: string; style?: React.CSSProperties }) {
  const href = httpUrl(url)
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} style={style} aria-label={`${name} on LinkedIn (opens in a new tab)`}>
      LinkedIn ↗
    </a>
  )
}

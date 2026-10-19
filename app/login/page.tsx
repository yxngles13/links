// app/login/page.tsx
//
// One page, two forms (sign in + sign up), toggled by ?mode=signup; ?role=mentor
// switches the copy and where the user lands afterwards.

import Link from 'next/link'
import { BrandBar } from '@/components/AppNav'
import SubmitButton from '@/components/SubmitButton'
import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; mode?: string; role?: string }>
}) {
  const params = await searchParams
  const isSignup = params.mode === 'signup'
  const isMentor = params.role === 'mentor'
  const roleQuery = isMentor ? 'role=mentor' : ''

  const heading = isMentor
    ? isSignup
      ? <>Share what you <em className="accent">know</em>.</>
      : <>Welcome back, <em className="accent">mentor</em>.</>
    : isSignup
      ? <>Start with one <em className="accent">conversation</em>.</>
      : <>Welcome <em className="accent">back</em>.</>

  return (
    <main>
      <BrandBar right={isMentor ? 'Mentors' : undefined} />
      <div className="shell">
        <div className="main" style={{ maxWidth: 520, paddingTop: 72 }}>
          <div className="eyebrow" style={{ marginBottom: 20 }}>{isSignup ? 'Create an account' : 'Sign in'}</div>
          <h1 className="title-sm" style={{ marginBottom: 20 }}>{heading}</h1>
          <p className="body-copy">
            {isMentor
              ? 'Mentor accounts see requests from CPP students and choose which ones to take.'
              : 'Links is free for Cal Poly Pomona students and alumni.'}
          </p>
        </div>

        <div className="main" style={{ borderLeft: '1px solid var(--line)', paddingTop: 72, maxWidth: 640 }}>
          {params.error ? <div className="alert" role="alert">{params.error}</div> : null}
          {params.message ? <div className="notice" style={{ marginBottom: 24 }}>{params.message}</div> : null}

          <form action={isSignup ? signup : login} className="form">
            <input type="hidden" name="role" value={isMentor ? 'mentor' : 'student'} />
            {isSignup ? (
              <div className="field">
                <label htmlFor="full_name">Full name</label>
                <input id="full_name" name="full_name" type="text" required autoComplete="name" className="input" />
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className="input" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" required minLength={6} autoComplete={isSignup ? 'new-password' : 'current-password'} className="input" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28, marginTop: 8 }}>
              <SubmitButton pendingText={isSignup ? 'Creating account…' : 'Signing in…'}>{isSignup ? 'Create account' : 'Sign in'}</SubmitButton>
              {isSignup ? (
                <Link href={`/login${roleQuery ? `?${roleQuery}` : ''}`} className="link">I have an account</Link>
              ) : (
                <Link href={`/login?mode=signup${roleQuery ? `&${roleQuery}` : ''}`} className="link">Create an account</Link>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

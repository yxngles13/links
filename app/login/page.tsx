// app/login/page.tsx
//
// One page, two forms (sign in + sign up), toggled by ?mode=signup.

import Link from 'next/link'
import { BrandBar } from '@/components/AppNav'
import SubmitButton from '@/components/SubmitButton'
import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; mode?: string }>
}) {
  const params = await searchParams
  const isSignup = params.mode === 'signup'

  const heading = isSignup
    ? <>Start with one <em className="accent">conversation</em>.</>
    : <>Welcome <em className="accent">back</em>.</>

  return (
    <main>
      <BrandBar />
      <div className="auth-wrap">
        <div className="card auth-card">
          <div className="eyebrow auth-eyebrow">{isSignup ? 'Create an account' : 'Sign in'}</div>
          <h1 className="title-sm auth-title">{heading}</h1>
          <p className="body-copy auth-sub">Links is free for Cal Poly Pomona students and alumni.</p>

          {params.error ? <div className="alert" role="alert">{params.error}</div> : null}
          {params.message ? <div className="notice auth-notice">{params.message}</div> : null}

          <form action={isSignup ? signup : login} className="form">
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
            <div className="auth-actions">
              <SubmitButton pendingText={isSignup ? 'Creating account…' : 'Signing in…'}>{isSignup ? 'Create account' : 'Sign in'}</SubmitButton>
              {isSignup ? (
                <Link href="/login" className="link">I have an account</Link>
              ) : (
                <Link href="/login?mode=signup" className="link">Create an account</Link>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

// app/login/page.tsx
//
// One page, two forms (login + signup), toggled by query param — simplest
// thing that works. Split into two routes later if it ever needs to feel
// more polished; not worth it yet.

import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; mode?: string }>
}) {
  const params = await searchParams
  const isSignup = params.mode === 'signup'

  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>{isSignup ? 'Create account' : 'Sign in'}</h1>

      {params.error && (
        <p style={{ color: '#c00', marginBottom: 16, fontSize: 14 }}>{params.error}</p>
      )}
      {params.message && (
        <p style={{ color: '#060', marginBottom: 16, fontSize: 14 }}>{params.message}</p>
      )}

      <form
        action={isSignup ? signup : login}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {isSignup && (
          <div>
            <label htmlFor="full_name" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6 }}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6 }}
          />
        </div>

        <div>
          <label htmlFor="password" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6 }}
          />
        </div>

        <button
          type="submit"
          style={{
            marginTop: 8,
            padding: '10px 16px',
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {isSignup ? 'Sign up' : 'Sign in'}
        </button>
      </form>

      <p style={{ marginTop: 20, fontSize: 13 }}>
        {isSignup ? (
          <a href="/login">Already have an account? Sign in</a>
        ) : (
          <a href="/login?mode=signup">Need an account? Sign up</a>
        )}
      </p>
    </main>
  )
}
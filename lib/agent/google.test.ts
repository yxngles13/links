import test from 'node:test'
import assert from 'node:assert/strict'
import { authUrl, GOOGLE_SCOPE } from './google.ts'

test('authUrl asks for free/busy only, offline, with consent', () => {
  const u = new URL(authUrl('abc', 'http://localhost:3000/calendar/callback'))
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
  assert.equal(GOOGLE_SCOPE, 'https://www.googleapis.com/auth/calendar.freebusy')
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/calendar.freebusy')
  assert.equal(u.searchParams.get('access_type'), 'offline')
  assert.equal(u.searchParams.get('prompt'), 'consent')
  assert.equal(u.searchParams.get('state'), 'abc')
  assert.equal(u.searchParams.get('redirect_uri'), 'http://localhost:3000/calendar/callback')
})

// app/login/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  // Revalidates cached data across the app now that auth state changed —
  // without this, some pages could keep showing stale "not signed in"
  // content even after a successful login, depending on what's cached.
  revalidatePath('/', 'layout')
  redirect('/matches')
}

export async function signup(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Without emailRedirectTo, Supabase sends the confirmation link to
  // whatever "Site URL" is set in the dashboard's Auth settings — which
  // may not even point at /auth/confirm. Setting it explicitly here means
  // the link always lands where exchangeCodeForSession() is actually
  // waiting for it, regardless of that dashboard setting.
  const origin = (await headers()).get('origin')

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        full_name: formData.get('full_name') as string,
      },
      emailRedirectTo: `${origin}/auth/confirm?next=/onboarding`,
    },
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  // Supabase's default project settings require email confirmation before
  // a session exists — so right after signup there usually isn't a logged-in
  // session yet. Send them to a "check your email" state rather than
  // straight to onboarding, which would just bounce them back to /login.
  redirect('/login?message=Check your email to confirm your account')
}
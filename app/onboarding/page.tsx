// app/onboarding/page.tsx
// The onboarding questions now live on the profile page. Kept as a redirect
// because older confirmation emails and bookmarks still point here.
import { redirect } from 'next/navigation'

export default function OnboardingPage() {
  redirect('/profile#matching')
}

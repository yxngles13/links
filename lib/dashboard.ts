// lib/dashboard.ts
//
// Pure pieces of the home dashboard: the "Getting started" steps (the
// new-user tutorial) and the greeting. No `@/` imports so `npm test` can run
// this file directly under node.

export type StartFacts = {
  hasAbout: boolean // public profile has a headline or a personality answer
  hasAnswers: boolean // matching questions answered
  hasActedOnMatch: boolean // saved or contacted at least one professor
  contacts: number
  mentorRequests: number
}

export type StartStep = { key: string; title: string; why: string; href: string; cta: string; done: boolean }

// Order is the order a new student should do them in: answers first, since
// matches and mentor ranking both depend on them.
export function gettingStartedSteps(f: StartFacts): StartStep[] {
  return [
    { key: 'answers', title: 'Tell us what you want to work on', why: 'Two minutes of questions, and we match you with professors.', href: '/profile#matching', cta: 'Answer questions', done: f.hasAnswers },
    { key: 'about', title: 'Make your profile yours', why: 'A headline and a few quick answers, so people know who they’re talking to.', href: '/profile', cta: 'Edit profile', done: f.hasAbout },
    { key: 'match', title: 'Save or contact a professor', why: 'Each match comes with a draft email you can send.', href: '/matches', cta: 'See matches', done: f.hasActedOnMatch },
    { key: 'network', title: 'Add someone you’ve met', why: 'We remind you when it’s time to follow up.', href: '/network?add=1', cta: 'Add a contact', done: f.contacts > 0 },
    { key: 'mentor', title: 'Request a mentor chat', why: 'Alumni and seniors who’ve been where you’re going.', href: '/mentors/find', cta: 'Find mentors', done: f.mentorRequests > 0 },
  ]
}

// Pacific time, like the rest of the app (every user is at CPP).
export function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Los_Angeles' }).format(now))
  if (hour < 5) return 'Up late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

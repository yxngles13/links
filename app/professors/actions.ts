// app/professors/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { OUT_OF_CREDITS, spendCredit } from '@/lib/credits'
import { pickOpportunity } from '@/lib/matching'
import { draftRedirect } from '@/lib/professors'

const UUID = /^[0-9a-f-]{36}$/i
const SETUP_NEEDED = 'Setup needed: run supabase/migrations/20261124000000_professor_browse.sql'

// "Write me a draft" on a professor's page: makes them one of the
// student's matches (see pickOpportunity) and opens the match page.
export async function writeDraft(formData: FormData) {
  const oppId = String(formData.get('opportunity_id') ?? '')
  if (!UUID.test(oppId)) redirect('/professors')

  const { supabase, user } = await requireUser()
  const { data: student } = await supabase.from('student_profiles').select('id').eq('user_id', user.id).maybeSingle()
  if (!student) redirect(`/professors/${oppId}`)

  const spent = await spendCredit(supabase)
  const result = await pickOpportunity(supabase, student.id, oppId, { generate: spent })
  if ('error' in result) {
    if (result.error === 'not_found') notFound()
    redirect(`/professors/${oppId}?error=${encodeURIComponent(SETUP_NEEDED)}`)
  }

  revalidatePath('/matches')
  revalidatePath('/professors')
  redirect(draftRedirect(result.matchId, { spent, wrote: result.wrote }, OUT_OF_CREDITS))
}

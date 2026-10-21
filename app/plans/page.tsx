// app/plans/page.tsx
// The student's plans: a list on the left, the selected plan's steps on the
// right. Each visit re-places the steps first, so days are never stale.
import Link from 'next/link'
import AgentMigrationNotice from '@/components/AgentMigrationNotice'
import AgentTabs from '@/components/AgentTabs'
import AppNav from '@/components/AppNav'
import DeletePlanDialog from '@/components/DeletePlanDialog'
import { isMissingTable } from '@/components/MigrationNotice'
import { requireUser } from '@/lib/auth'
import { calendarStatus } from '@/lib/agent/calendar-status'
import { addDays, pacificToday } from '@/lib/agent/dates'
import { rescheduleUser } from '@/lib/agent/reschedule'
import { isPlanActive } from '@/lib/agent/schedule'
import { setDailyHours } from '@/app/capture/actions'
import {
  addStep, deleteStep, pausePlan, resolveTradeoff, resumePlan, toggleStepDone, updatePlan, updateStep,
} from './actions'

type Plan = {
  id: string
  kind: 'career' | 'idea' | null
  title: string
  done_looks_like: string | null
  deadline: string | null
  deadline_suggested: boolean
  paused: boolean
  paused_until: string | null
}
type Step = {
  id: string
  plan_id: string
  title: string
  minutes: number
  day: string | null
  done_at: string | null
  contact_id: string | null
  needs_person: string | null
}
type Tradeoff = { id: string; plan_id: string; suggestion: string; pause_until: string | null }
type Contact = { id: string; full_name: string; role: string | null; company: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "Nov 3", from a 'YYYY-MM-DD' day.
function shortDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// A weekday name within the next 7 days, otherwise the date.
function dayLabel(day: string, today: string): string {
  if (day > today && day <= addDays(today, 6)) {
    return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  }
  return day === today ? 'Today' : shortDate(day)
}

function hoursLabel(minutes: number): string {
  const h = minutes / 60
  return `${h} ${h === 1 ? 'hour' : 'hours'} a day`
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; error?: string }>
}) {
  const { plan: planParam, error } = await searchParams
  const { supabase, user } = await requireUser()
  const today = pacificToday()

  // Re-place the steps before reading them.
  const result = await rescheduleUser(supabase, user.id)

  const [plansRes, stepsRes, tradeoffsRes, settingsRes, calendar] = await Promise.all([
    supabase
      .from('agent_plans')
      .select('id, kind, title, done_looks_like, deadline, deadline_suggested, paused, paused_until')
      .eq('user_id', user.id)
      .order('position', { ascending: true }),
    supabase
      .from('agent_steps')
      .select('id, plan_id, title, minutes, day, done_at, contact_id, needs_person')
      .eq('user_id', user.id)
      .order('position', { ascending: true }),
    supabase
      .from('agent_tradeoffs')
      .select('id, plan_id, suggestion, pause_until')
      .eq('user_id', user.id)
      .eq('status', 'open'),
    supabase.from('agent_settings').select('daily_minutes').eq('user_id', user.id).maybeSingle(),
    calendarStatus(user.id),
  ])
  const missing = [plansRes, stepsRes, tradeoffsRes, settingsRes].some((r) => isMissingTable(r.error))
  const plans = (plansRes.data ?? []) as Plan[]
  const steps = (stepsRes.data ?? []) as Step[]
  const tradeoffs = (tradeoffsRes.data ?? []) as Tradeoff[]
  const dailyMinutes = settingsRes.data?.daily_minutes as number | null | undefined

  // Career first, then ideas. A plan with no kind sits with the ideas.
  const career = plans.filter((p) => p.kind === 'career')
  const ideas = plans.filter((p) => p.kind !== 'career')
  const selected = plans.find((p) => p.id === planParam && UUID.test(p.id)) ?? career[0] ?? ideas[0] ?? null

  const planSteps = selected ? steps.filter((s) => s.plan_id === selected.id) : []

  // Contacts are joined by hand: steps have no foreign key to them.
  const contactIds = [...new Set(planSteps.map((s) => s.contact_id).filter((id): id is string => !!id))]
  const contacts = new Map<string, Contact>()
  if (contactIds.length) {
    const { data } = await supabase.from('network_contacts').select('id, full_name, role, company').in('id', contactIds)
    for (const c of (data ?? []) as Contact[]) contacts.set(c.id, c)
  }

  const stepCount = (planId: string) => {
    const mine = steps.filter((s) => s.plan_id === planId)
    return `${mine.filter((s) => s.done_at).length} of ${mine.length} steps`
  }
  const pausedNow = (p: Plan) => !isPlanActive(p, today)
  const overloaded = new Set(result.overloaded)
  // A suggestion to pause a plan that's already paused has nothing to ask.
  const openTradeoff = (p: Plan) => (pausedNow(p) ? undefined : tradeoffs.find((t) => t.plan_id === p.id))
  const tradeoff = selected ? openTradeoff(selected) : undefined

  const planLink = (p: Plan) => (
    <li key={p.id} className="row row-tight" style={pausedNow(p) ? { opacity: 0.55 } : undefined}>
      <Link href={`/plans?plan=${p.id}`} aria-current={selected?.id === p.id ? 'page' : undefined}
        style={{ fontWeight: selected?.id === p.id ? 600 : 400 }}>
        {p.title}
      </Link>
      <div className="meta">
        {pausedNow(p) ? (p.paused_until ? `Paused until ${shortDate(p.paused_until)}` : 'Paused') : stepCount(p.id)}
        {openTradeoff(p) ? <> · <span className="accent">Trade-off</span></> : null}
      </div>
    </li>
  )

  const hours = (
    <form action={setDailyHours} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
      <input type="hidden" name="return_to" value="/plans" />
      <input id="daily_hours" name="daily_hours" type="number" min={0} max={12} step={0.5} required aria-label="Hours a day"
        defaultValue={dailyMinutes != null ? dailyMinutes / 60 : undefined} className="input" style={{ width: 90 }} />
      <button type="submit" className="btn btn-outline btn-sm">Save</button>
    </form>
  )

  return (
    <>
      <AppNav active="plans" />
      <AgentTabs active="plans" />
      <main className="page" style={{ display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'flex-start' }}>
        <aside style={{ flex: '0 1 280px', minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Plans</div>
          {career.length ? (
            <>
              <div className="label" style={{ marginBottom: 10 }}>Career</div>
              <ul className="rows" style={{ listStyle: 'none', margin: '0 0 28px', padding: 0 }}>{career.map(planLink)}</ul>
            </>
          ) : null}
          {ideas.length ? (
            <>
              <div className="label" style={{ marginBottom: 10 }}>Ideas</div>
              <ul className="rows" style={{ listStyle: 'none', margin: '0 0 28px', padding: 0 }}>{ideas.map(planLink)}</ul>
            </>
          ) : null}

          <div className="label" style={{ margin: '8px 0 6px' }}>Your time</div>
          {calendar.connected && !calendar.needsReconnect ? (
            <div className="meta">From Google Calendar</div>
          ) : (
            <>
              {calendar.needsReconnect ? (
                <div className="meta"><a href="/calendar/connect" className="link" style={{ fontSize: 14 }}>Reconnect Google Calendar</a></div>
              ) : null}
              {result.needsHours ? null : (
                <details>
                  <summary className="meta" style={{ cursor: 'pointer' }}>
                    {dailyMinutes != null ? <>{hoursLabel(dailyMinutes)} · change</> : 'Set your hours a day'}
                  </summary>
                  {hours}
                </details>
              )}
            </>
          )}
        </aside>

        <div style={{ flex: '1 1 480px', minWidth: 0 }}>
          {error ? <div className="alert" role="alert">{error}</div> : null}
          {missing ? <AgentMigrationNotice /> : null}

          {/* Nothing sizes the days yet, so ask up front instead of in the sidebar. */}
          {!missing && result.needsHours ? (
            <div className="notice" style={{ marginBottom: 28 }}>
              <label htmlFor="daily_hours" className="body-copy" style={{ display: 'block', marginBottom: 4 }}>
                About how many hours a day do you have for this?
              </label>
              {hours}
            </div>
          ) : null}

          {!missing && !selected ? (
            <div className="notice">
              <h1 className="title" style={{ marginBottom: 12 }}>No plans yet</h1>
              <p className="body-copy" style={{ marginBottom: 20 }}>Tell Links what you&apos;re juggling and it will make one.</p>
              <Link href="/capture" className="btn">Make my plan</Link>
            </div>
          ) : null}

          {!missing && selected ? (
            <>
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                {selected.kind === 'career' ? 'Career plan' : 'Idea'}
                {selected.deadline ? <> · deadline {shortDate(selected.deadline)}{selected.deadline_suggested ? ' (suggested)' : ''}</> : null}
              </div>
              <h1 className="title" style={{ marginBottom: 16 }}>{selected.title}</h1>
              {selected.done_looks_like ? (
                <p className="body-copy" style={{ marginBottom: 24 }}>
                  <strong>Done looks like:</strong> {selected.done_looks_like}
                </p>
              ) : null}

              {pausedNow(selected) ? (
                <p className="meta" style={{ marginBottom: 20 }}>
                  {selected.paused_until ? `Paused until ${shortDate(selected.paused_until)}` : 'Paused'} · its steps wait as Later.
                </p>
              ) : null}

              {tradeoff ? (
                <div className="notice" style={{ marginBottom: 28 }}>
                  <div className="label" style={{ marginBottom: 8 }}>Links suggests a trade-off</div>
                  <p className="body-copy" style={{ marginBottom: 4 }}>
                    Pause {selected.title}{tradeoff.pause_until ? ` until ${shortDate(tradeoff.pause_until)}` : ''}?
                  </p>
                  {/* The model's reason; with none, the suggestion only repeats the question. */}
                  {tradeoff.suggestion.startsWith('Suggested a pause: ') ? null : (
                    <p className="meta" style={{ marginBottom: 14 }}>{tradeoff.suggestion}</p>
                  )}
                  <form action={resolveTradeoff} style={{ display: 'flex', gap: 12 }}>
                    <input type="hidden" name="tradeoff_id" value={tradeoff.id} />
                    <button type="submit" name="choice" value="pause" className="btn btn-sm">Pause it</button>
                    <button type="submit" name="choice" value="keep" className="btn btn-outline btn-sm">Keep both</button>
                  </form>
                </div>
              ) : null}

              {result.reconnect ? (
                <p className="meta" style={{ marginBottom: 16 }}>
                  <a href="/calendar/connect" className="link" style={{ fontSize: 14 }}>Reconnect Google Calendar</a>
                </p>
              ) : null}

              <div className="label" style={{ marginBottom: 10 }}>Game plan</div>
              {planSteps.length ? (
                <ol className="rows" style={{ listStyle: 'none', margin: '0 0 20px', padding: 0 }}>
                  {planSteps.map((s, i) => {
                    const contact = s.contact_id ? contacts.get(s.contact_id) : undefined
                    const person = contact
                      ? [contact.full_name, [contact.role, contact.company].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
                      : s.needs_person
                    const done = s.done_at != null
                    const when = done
                      ? 'Done'
                      : s.day == null
                        ? 'Later'
                        : s.day < today
                          ? 'Overdue'
                          : dayLabel(s.day, today)
                    return (
                      <li key={s.id} className="row">
                        <div className="row-split">
                          <div style={{ minWidth: 0, opacity: done ? 0.55 : 1 }}>
                            <span className="meta">{String(i + 1).padStart(2, '0')}</span>{' '}
                            <span style={done ? { textDecoration: 'line-through' } : undefined}>{s.title}</span>
                            <div className="meta">
                              {person ? <>{person} · </> : null}{s.minutes} min
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                            <span className={when === 'Overdue' ? 'accent' : 'meta'}>{when}</span>
                            <form action={toggleStepDone.bind(null, s.id)}>
                              <button type="submit" className="link-quiet">{done ? 'Undo' : 'Mark done'}</button>
                            </form>
                          </div>
                        </div>
                        {!done && s.day && overloaded.has(s.day) ? (
                          <div className="meta accent" style={{ marginTop: 6 }}>This day is over your time</div>
                        ) : null}
                        <details style={{ marginTop: 8 }}>
                          <summary className="link-quiet" style={{ cursor: 'pointer' }}>Edit</summary>
                          <form action={updateStep} className="form" style={{ marginTop: 14 }}>
                            <input type="hidden" name="step_id" value={s.id} />
                            <div className="field">
                              <label htmlFor={`t-${s.id}`}>Step</label>
                              <input id={`t-${s.id}`} name="title" defaultValue={s.title} required maxLength={140} className="input" />
                            </div>
                            <div className="form-row">
                              <div className="field">
                                <label htmlFor={`m-${s.id}`}>Minutes</label>
                                <input id={`m-${s.id}`} name="minutes" type="number" min={10} max={240} step={5} defaultValue={s.minutes} required className="input" />
                              </div>
                              <div className="field">
                                <label htmlFor={`d-${s.id}`}>Day (blank lets Links choose)</label>
                                <input id={`d-${s.id}`} name="day" type="date" defaultValue={s.day ?? ''} className="input" />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                              <button type="submit" className="btn btn-sm">Save step</button>
                              <button type="submit" formAction={deleteStep.bind(null, s.id)} formNoValidate className="link-quiet">Delete step</button>
                            </div>
                          </form>
                        </details>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="meta" style={{ marginBottom: 20 }}>No steps yet.</p>
              )}

              <details style={{ marginBottom: 28 }}>
                <summary className="link" style={{ cursor: 'pointer' }}>Add a step</summary>
                <form action={addStep} className="form" style={{ marginTop: 14 }}>
                  <input type="hidden" name="plan_id" value={selected.id} />
                  <div className="field">
                    <label htmlFor="new-title">Step</label>
                    <input id="new-title" name="title" required maxLength={140} className="input" />
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="new-minutes">Minutes</label>
                      <input id="new-minutes" name="minutes" type="number" min={10} max={240} step={5} defaultValue={30} required className="input" />
                    </div>
                    <div className="field">
                      <label htmlFor="new-day">Day (optional)</label>
                      <input id="new-day" name="day" type="date" className="input" />
                    </div>
                  </div>
                  <div><button type="submit" className="btn btn-sm">Add step</button></div>
                </form>
              </details>

              <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <details>
                  <summary className="link-quiet" style={{ cursor: 'pointer' }}>Edit plan</summary>
                  <form action={updatePlan} className="form" style={{ marginTop: 14, minWidth: 280 }}>
                    <input type="hidden" name="plan_id" value={selected.id} />
                    <div className="field">
                      <label htmlFor="plan-title">Title</label>
                      <input id="plan-title" name="title" defaultValue={selected.title} required maxLength={140} className="input" />
                    </div>
                    <div className="field">
                      <label htmlFor="plan-done">Done looks like</label>
                      <textarea id="plan-done" name="done_looks_like" defaultValue={selected.done_looks_like ?? ''} rows={3} maxLength={500} className="input" />
                    </div>
                    <div className="field">
                      <label htmlFor="plan-deadline">Deadline</label>
                      <input id="plan-deadline" name="deadline" type="date" defaultValue={selected.deadline ?? ''} className="input" />
                    </div>
                    <div><button type="submit" className="btn btn-sm">Save plan</button></div>
                  </form>
                </details>

                {pausedNow(selected) ? (
                  <form action={resumePlan.bind(null, selected.id)}>
                    <button type="submit" className="link-quiet">Resume plan</button>
                  </form>
                ) : (
                  <details>
                    <summary className="link-quiet" style={{ cursor: 'pointer' }}>Pause plan</summary>
                    <form action={pausePlan} className="form" style={{ marginTop: 14 }}>
                      <input type="hidden" name="plan_id" value={selected.id} />
                      <div className="field">
                        <label htmlFor="pause-until">Until (blank pauses it until you resume)</label>
                        <input id="pause-until" name="until" type="date" min={addDays(today, 1)} className="input" />
                      </div>
                      <div><button type="submit" className="btn btn-sm">Pause</button></div>
                    </form>
                  </details>
                )}

                <DeletePlanDialog planId={selected.id} title={selected.title} />
              </div>
            </>
          ) : null}
        </div>
      </main>
    </>
  )
}

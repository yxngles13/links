// extension/popup.js
// Quick-add popup: checks the Links session, prefills from a LinkedIn
// profile when that's the open tab, and saves via POST /api/contacts.
// Prefill is two steps: an instant read of name and headline from the page
// code, then the page's visible text goes to POST /api/contacts/parse so the
// AI can fill in school, location, past roles, notes and tags.

const $ = (id) => document.getElementById(id)
const STATES = ['loading', 'signed-out', 'form', 'saved']
const DRAFT_KEY = 'draft'
const MAX_TEXT = 15000
const PARSE_TIMEOUT_MS = 15000
const NOTE_READING = 'Reading this profile…'
const NOTE_DONE = 'Filled in from this LinkedIn profile. Check it before saving.'
const NOTE_FAILED = "Couldn't read the rest of this profile. Fill in the rest yourself."

function show(state) {
  for (const s of STATES) $(s).hidden = s !== state
}

// Runs inside the LinkedIn tab (injected with chrome.scripting), so it can
// only use what's on the page. LinkedIn's markup changes often: every field
// is best-effort and the user checks the form before saving.
function scrapeLinkedInProfile() {
  const text = (sel) => document.querySelector(sel)?.innerText?.trim() || ''
  const name = text('main h1') || document.title.split('|')[0].replace(/^\(\d+\)\s*/, '').trim()
  const headline = text('main .text-body-medium.break-words') || text('main .text-body-medium')
  return { name, headline, url: location.origin + location.pathname }
}

// "Product Manager at Notion | ex-Stripe" -> role + company
function splitHeadline(headline) {
  const first = (headline || '').split('|')[0].trim()
  const [role, company] = first.split(/\s+(?:at|@)\s+/i)
  return { role: (role || '').trim(), company: (company || '').trim() }
}

// Also injected into the LinkedIn tab: the profile's visible text, for the
// AI to read. Not tied to LinkedIn's markup, so it survives their redesigns.
function readProfileText() {
  const root = document.querySelector('main') || document.body
  return { text: (root?.innerText || '').trim().slice(0, 15000) }
}

// Same rule as canonicalProfileUrl in lib/linkedin-parse.ts: sub-pages like
// /in/priya/overlay/contact-info/ still show the profile, so everything
// resolves to origin + /in/<slug> (or null when it isn't a profile).
function canonicalProfileUrl(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || !/^([a-z]+\.)?linkedin\.com$/i.test(u.hostname)) return null
    const slug = u.pathname.match(/^\/in\/([^/]+)/)?.[1]
    return slug ? `${u.origin}/in/${slug}` : null
  } catch {
    return null
  }
}

// Bumped on Save and "Add another", so an AI answer that arrives after
// either one is dropped instead of filling the wrong form.
let fillRun = 0

// The page the draft belongs to (a profile URL, or '' elsewhere). A draft
// from another page is thrown away, so one person's details never carry
// over onto the next.
let draftPage = ''

function setNote(text) {
  $('prefill-note').textContent = text
  $('prefill-note').hidden = false
}

async function profileTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const profile = tab?.url ? canonicalProfileUrl(tab.url) : null
  return profile ? { id: tab.id, profile } : null
}

async function prefillFromTab(tab) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeLinkedInProfile })
    if (!result?.name) return false
    const { role, company } = splitHeadline(result.headline)
    if (!$('full_name').value) $('full_name').value = result.name
    if (!$('role').value) $('role').value = role
    if (!$('company').value) $('company').value = company
    $('linkedin_url').value = tab.profile
    setNote(NOTE_DONE)
    return true
  } catch {
    return false // e.g. the page hasn't finished loading; the form still works
  }
}

// Fill only what's still empty when the answer arrives, so nothing the
// student typed meanwhile gets overwritten.
function fillEmpty(fields) {
  for (const [id, value] of Object.entries(fields)) {
    const el = $(id)
    const v = Array.isArray(value) ? value.join(', ') : value
    if (el && !el.value.trim() && v) el.value = v
  }
}

// One AI credit per profile; the popup closes whenever it loses focus, so
// the answer is cached for the browser session and reused on reopen.
async function aiPrefill(appUrl, tab) {
  const run = fillRun
  const cacheKey = `parsed:${tab.profile.toLowerCase()}`
  setNote(NOTE_READING)
  try {
    let parsed = (await chrome.storage.session.get(cacheKey))[cacheKey]
    if (!parsed) {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readProfileText })
      if (!result?.text) throw new Error('empty page')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS)
      const res = await fetch(`${appUrl}/api/contacts/parse`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tab.profile, text: result.text.slice(0, MAX_TEXT) }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer))
      const json = await res.json().catch(() => ({}))
      if (run !== fillRun) return
      if (res.status === 429 && json.error) {
        setNote(json.error)
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      parsed = json
      await chrome.storage.session.set({ [cacheKey]: parsed })
    }
    // Not saved as a draft: the cache above already restores these on reopen,
    // and a draft would only hold what the student typed.
    if (run !== fillRun) return
    fillEmpty({ full_name: parsed.full_name, role: parsed.role, company: parsed.company, notes: parsed.notes, tags: parsed.tags })
    if (!$('linkedin_url').value) $('linkedin_url').value = tab.profile
    setNote(NOTE_DONE)
  } catch {
    if (run !== fillRun) return
    // Timeout, offline, AI error: the quick prefill (if any) stays and the
    // form still saves.
    setNote(NOTE_FAILED)
  }
}

function renderMetOptions(options, selected) {
  const box = $('met-options')
  box.replaceChildren()
  for (const opt of options) {
    const label = document.createElement('label')
    label.className = 'chip'
    const input = document.createElement('input')
    input.type = 'radio'
    input.name = 'met_context'
    input.value = opt
    input.checked = opt === selected
    const span = document.createElement('span')
    span.textContent = opt
    label.append(input, span)
    box.append(label)
  }
}

// The popup closes whenever it loses focus, so keep what's been typed.
async function saveDraft() {
  const data = Object.fromEntries(new FormData($('form')))
  await chrome.storage.session.set({ [DRAFT_KEY]: { page: draftPage, data } })
}

async function restoreDraft() {
  const { [DRAFT_KEY]: saved } = await chrome.storage.session.get(DRAFT_KEY)
  if (!saved?.data || saved.page !== draftPage) {
    await chrome.storage.session.remove(DRAFT_KEY)
    return null
  }
  const draft = saved.data
  for (const [k, v] of Object.entries(draft)) {
    const el = $('form').elements.namedItem(k)
    if (el && 'value' in el && k !== 'met_context') el.value = v
  }
  return draft
}

async function init() {
  const appUrl = await getAppUrl()
  $('app-url').textContent = appUrl
  $('open-login').onclick = () => chrome.tabs.create({ url: `${appUrl}/login` })
  // The store build has no options page (its URL is fixed), so only offer
  // "Change URL" in the developer build.
  if (chrome.runtime.getManifest().options_ui) {
    $('open-options').onclick = (e) => {
      e.preventDefault()
      chrome.runtime.openOptionsPage()
    }
  } else {
    $('open-options').remove()
  }
  $('close').onclick = () => window.close()

  let session
  try {
    const res = await fetch(`${appUrl}/api/contacts`, { credentials: 'include' })
    if (!res.ok) throw new Error(String(res.status))
    session = await res.json()
  } catch {
    $('offline-note').hidden = false
    show('signed-out')
    return
  }
  if (!session.signedIn) {
    show('signed-out')
    return
  }

  $('user-name').textContent = session.name
  const tab = await profileTab()
  draftPage = tab?.profile ?? ''
  const draft = await restoreDraft()
  if (tab) await prefillFromTab(tab)
  renderMetOptions(session.metOptions, draft?.met_context || (tab ? 'LinkedIn message' : session.metOptions[0]))
  show('form')
  $('full_name').focus()
  // Not awaited: the form is usable while the AI reads the rest.
  if (tab) aiPrefill(appUrl, tab)

  $('form').addEventListener('input', saveDraft)
  $('form').addEventListener('change', saveDraft)
  $('form').addEventListener('submit', (e) => {
    e.preventDefault()
    submit(appUrl)
  })
  $('add-another').onclick = () => {
    fillRun++
    $('form').reset()
    $('linkedin_url').value = ''
    $('prefill-note').hidden = true
    renderMetOptions(session.metOptions, session.metOptions[0])
    show('form')
    $('full_name').focus()
  }
}

async function submit(appUrl) {
  fillRun++
  const data = Object.fromEntries(new FormData($('form')))
  const body = {
    ...data,
    tags: String(data.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  }

  $('error').hidden = true
  $('save').disabled = true
  $('save').textContent = 'Saving…'
  try {
    const res = await fetch(`${appUrl}/api/contacts`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (res.status === 401) {
      show('signed-out')
      return
    }
    if (!res.ok) throw new Error(json.error || `Save failed (${res.status})`)

    await chrome.storage.session.remove(DRAFT_KEY)
    $('saved-name').textContent = body.full_name
    $('view-contact').onclick = () => chrome.tabs.create({ url: json.url })
    show('saved')
  } catch (err) {
    $('error').textContent = err.message || 'Could not save. Try again.'
    $('error').hidden = false
  } finally {
    $('save').disabled = false
    $('save').textContent = 'Save contact'
  }
}

init()

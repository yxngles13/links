// extension/popup.js
// Quick-add popup: checks the Links session, prefills from a LinkedIn
// profile when that's the open tab, and saves via POST /api/contacts.

const $ = (id) => document.getElementById(id)
const STATES = ['loading', 'signed-out', 'form', 'saved']
const DRAFT_KEY = 'draft'

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

async function prefillFromTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url || !/^https:\/\/([a-z]+\.)?linkedin\.com\/in\//i.test(tab.url)) return false
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeLinkedInProfile })
    if (!result?.name) return false
    const { role, company } = splitHeadline(result.headline)
    if (!$('full_name').value) $('full_name').value = result.name
    if (!$('role').value) $('role').value = role
    if (!$('company').value) $('company').value = company
    $('linkedin_url').value = result.url
    $('prefill-note').hidden = false
    return true
  } catch {
    return false // e.g. the page hasn't finished loading; the form still works
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
  await chrome.storage.session.set({ [DRAFT_KEY]: data })
}

async function restoreDraft() {
  const { [DRAFT_KEY]: draft } = await chrome.storage.session.get(DRAFT_KEY)
  if (!draft) return null
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
  const draft = await restoreDraft()
  const fromLinkedIn = await prefillFromTab()
  renderMetOptions(session.metOptions, draft?.met_context || (fromLinkedIn ? 'LinkedIn message' : session.metOptions[0]))
  show('form')
  $('full_name').focus()

  $('form').addEventListener('input', saveDraft)
  $('form').addEventListener('change', saveDraft)
  $('form').addEventListener('submit', (e) => {
    e.preventDefault()
    submit(appUrl)
  })
  $('add-another').onclick = () => {
    $('form').reset()
    $('linkedin_url').value = ''
    $('prefill-note').hidden = true
    renderMetOptions(session.metOptions, session.metOptions[0])
    show('form')
    $('full_name').focus()
  }
}

async function submit(appUrl) {
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

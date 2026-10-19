// extension/options.js
// Lets the user point the extension at a deployed Links app. A new origin
// needs host permission so the popup's requests carry the session cookie.

const input = document.getElementById('app-url')
const status = document.getElementById('status')

getAppUrl().then((url) => (input.value = url))

document.getElementById('options').addEventListener('submit', async (e) => {
  e.preventDefault()
  let origin
  try {
    origin = new URL(input.value).origin
  } catch {
    status.textContent = 'That is not a valid URL.'
    return
  }

  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] })
  if (!granted) {
    status.textContent = 'Permission is needed to reach Links at that address.'
    return
  }
  await chrome.storage.sync.set({ appUrl: origin })
  status.textContent = `Saved. The popup now uses ${origin}.`
})

// extension/shared.js
// Where the Links app lives. Defaults to the local dev server; change it on
// the options page once the app is deployed.
const DEFAULT_APP_URL = 'http://localhost:3000'

// Shared with popup.js and options.js, which load this file first.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getAppUrl() {
  const { appUrl } = await chrome.storage.sync.get('appUrl')
  return (appUrl || DEFAULT_APP_URL).replace(/\/+$/, '')
}

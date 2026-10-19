// scripts/package-extension.mjs
//
// Builds the Chrome Web Store version of extension/ into dist/:
//   node scripts/package-extension.mjs [app-url]
// (default app URL: the production deployment)
//
// The source extension/ is the developer build: it talks to localhost and
// has an options page for changing the URL. The store build is locked to
// one URL, so it drops localhost, the "any site" optional permission and
// the options page, which reviewers would otherwise ask about.

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const appUrl = new URL(process.argv[2] ?? 'https://links-amber-one.vercel.app').origin
const out = 'dist/extension'

rmSync('dist', { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync('extension', out, {
  recursive: true,
  // Dev-only files and store listing assets stay out of the package.
  filter: (src) => !/(README\.md|STORE_LISTING\.md|options\.(html|js)|[\\/]store)$/.test(src),
})

const manifestPath = `${out}/manifest.json`
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.host_permissions = [`${appUrl}/*`]
delete manifest.optional_host_permissions
delete manifest.options_ui
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

const sharedPath = `${out}/shared.js`
const shared = readFileSync(sharedPath, 'utf8')
const updated = shared.replace(/const DEFAULT_APP_URL = '[^']*'/, `const DEFAULT_APP_URL = '${appUrl}'`)
if (updated === shared) throw new Error('Could not find DEFAULT_APP_URL in shared.js')
writeFileSync(sharedPath, updated)

const zip = `links-extension-${manifest.version}.zip`
execFileSync('zip', ['-qr', `../${zip}`, '.'], { cwd: out })
console.log(`Built dist/${zip} for ${appUrl}`)

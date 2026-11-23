# Chrome Web Store listing

Copy-paste text for the developer dashboard. Images are in `store/`.
The package to upload is built by `node scripts/package-extension.mjs` → `dist/links-extension-<version>.zip`.

## Store listing tab

**Name:** Links — Add to network
**Summary (132 chars max):** Save the people you meet to your Links network in two clicks. Prefills from LinkedIn and drafts your follow-up.
**Category:** Productivity → Workflow & Planning
**Language:** English

**Description:**

> Links is a career copilot for Cal Poly Pomona students. This extension adds anyone you meet to your Links network without leaving the page you're on.
>
> • Click the Links icon on any page to add a contact: name, role, company, how you met, tags and notes.
> • On a LinkedIn profile, the name, role, company, school, location and past roles are filled in for you, with a short summary in your notes. To do this, the profile's visible text is sent to Links, which uses AI to pick out those details; the text isn't kept, and nothing is saved until you press Save.
> • Links summarizes where the relationship stands, suggests questions for your next chat, and drafts a follow-up message.
> • Contacts you haven't talked to in two weeks are flagged so you never miss a follow-up.
>
> Requires a free Links account. Sign in at https://links-amber-one.vercel.app, then click the extension icon.

**Screenshots (1280×800):** `store/screenshot-1-quick-add.png`, `store/screenshot-2-contact.png`
**Small promo tile (440×280):** `store/promo-tile-440x280.png`
**Store icon (128×128):** `icons/icon128.png`
**Homepage URL:** https://links-amber-one.vercel.app
**Support URL / email:** your contact email

## Privacy practices tab

**Single purpose:** Save people the user has met as contacts in their Links account, optionally prefilled from the LinkedIn profile open in the current tab.

**Permission justifications:**

- **activeTab:** When the user clicks the extension icon on a LinkedIn profile, read that tab's visible text once to prefill the contact form (name, role, company, school, location, past roles). No access to any tab otherwise.
- **scripting:** Runs the one-time prefill function in the active LinkedIn tab (granted only through activeTab, after the user clicks the icon).
- **storage:** Keeps an unsaved draft of the form, and the details already read from a profile, in session storage (cleared when the browser closes), because Chrome closes the popup when it loses focus.
- **Host permission (links-amber-one.vercel.app):** The extension's own backend. When the user opens the popup on a LinkedIn profile, sends that profile's visible text so Links can fill in the form (not stored), and sends the saved contact to the user's Links account, using their existing Links sign-in.

**Remote code:** No, I am not using remote code. (The popup loads a Google Fonts stylesheet; no remote scripts.)

**Data usage — collected:** Personally identifiable information (names of contacts the user adds) and user-entered content (notes). Check: *Personally identifiable information*, *Website content* (the visible text of the LinkedIn profile the user clicks on, sent to the Links backend to fill in the form and not stored; only the fields the user saves are kept).
Certify all three: not sold to third parties, not used for unrelated purposes, not used for creditworthiness/lending.

**Privacy policy URL:** https://links-amber-one.vercel.app/privacy

## Distribution tab

- **Visibility:** *Public* for launch, or *Unlisted* to share only by link while testing with a few students.
- **Regions:** All regions (or United States).

## After it's approved

Set `NEXT_PUBLIC_CHROME_EXTENSION_URL` in Vercel to the listing URL and redeploy; the landing page then shows an **Add to Chrome** button.
For updates: bump `version` in `extension/manifest.json`, rebuild the zip, upload it under **Package**.

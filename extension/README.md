# Links Chrome extension

The "+ Add to network" quick-add popup: save someone to your Links network from any page. On a LinkedIn profile it prefills name, role, company and the profile URL.

## Load it (development)

1. Run the app: `npm run dev` (the extension talks to `http://localhost:3000` by default).
2. In Chrome, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick this `extension/` folder.
3. Pin it from the puzzle-piece menu.
4. Sign in to Links in the same Chrome profile (e.g. `demo@links-demo.com` / `links-demo-2026`), then click the icon.

After editing extension files, click the reload arrow on its card in `chrome://extensions`.

## How it works

- No separate login: the popup calls `GET/POST /api/contacts` (`app/api/contacts/route.ts`) and Chrome sends your normal Links session cookie, because the extension has host permission for the app.
- The API only accepts requests from `chrome-extension://` origins or the app itself.
- Saving returns immediately; the summary, questions and follow-up draft are generated in the background (`after()`), and show up on the contact page a few seconds later.

## Deployed app

Right-click the icon → **Options**, enter the deployed Links URL, and approve the permission prompt.

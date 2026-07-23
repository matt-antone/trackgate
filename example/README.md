# trackgate example

Manual verification app for the `trackgate` package (plan step 12). Not
published — this is a local sanity check, not a demo site.

It consumes the **built** package (`dist/`) via a `file:..` dependency, the
same way a real downstream consumer would (AC13) — no Vite source alias back
to `../src`.

## Prerequisites

Build the parent package first so `../dist` exists:

```bash
cd ..
npm run build
```

## Run

```bash
cd example
npm install
npm run dev
```

Then open the printed local URL.

## What to check (maps to the plan's Verification Steps §6)

1. Open DevTools → Network, clear it, reload the page.
2. Confirm **zero** requests to `httpbin.org`, `youtube-nocookie.com`, or
   `/tracker.js` before you accept the consent dialog.
3. Click **Accept** in the dialog (or the embed's "Accept & load" button) —
   the pixel beacon (`httpbin.org/get?tracker=demo-pixel`), the declarative
   `/tracker.js`, and (if clicked) the YouTube iframe should now load.
4. Click **Revoke** — the JSX-gated pixel and the embed both unmount; the
   already-injected `/tracker.js` script tag persists (documented limitation,
   AC16d) since `reloadOnRevoke` isn't set here.
5. Click **Reset** — status returns to `pending` and the dialog re-appears.
6. Reload the page after Decline — dialog should not re-appear and no tracker
   requests should fire.

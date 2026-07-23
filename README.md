# cipa-provider

A React provider that gates tracking components behind CIPA-compliant, express opt-in consent. Trackers wrapped by this library **never mount** — no script tags, no network beacons, no cookies or identifiers written — until the user affirmatively accepts.

This is a technical control, not a legal opinion. See [Legal disclaimer](#legal-disclaimer) and [CIPA background](#cipa-background) below.

## Why

California's Invasion of Privacy Act (CIPA) is currently the primary vehicle for website-tracking litigation in California. Its consent exceptions require consent **before** interception occurs — a tracker that fires a beacon on page load and *then* shows a cookie banner has already allegedly violated the statute. `cipa-provider` enforces this ordering at the React rendering layer: gated components render `null` until consent is granted, so there is nothing to intercept, no request to send, and no identifier to write.

## Install

```bash
npm install cipa-provider
```

`react` and `react-dom` (>=18) are peer dependencies. There are no other runtime dependencies.

## Quickstart

Wrap your app in `<CipaProvider>`, and wrap tracking components in `<CipaTracking>`:

```tsx
import { CipaProvider, CipaTracking } from 'cipa-provider';
import { HotjarTracker } from './HotjarTracker';
import { MetaPixel } from './MetaPixel';

function App() {
  return (
    <CipaProvider policyVersion="2026-07-23">
      <YourAppContent />

      <CipaTracking>
        <HotjarTracker />
        <MetaPixel />
      </CipaTracking>
    </CipaProvider>
  );
}
```

`HotjarTracker` and `MetaPixel` are not modified in any way — they are ordinary React components. `<CipaTracking>` simply does not render its children (`null`) until the visitor has granted consent. No dialog markup, no tracker markup, and no storage access happens on the server (SSR-safe), so there is no hydration mismatch.

By default, a native `<dialog>`-based consent prompt appears automatically once the provider mounts on the client and no prior decision is on record.

### Reading consent state — `useCipaConsent()`

```tsx
import { useCipaConsent } from 'cipa-provider';

function PrivacySettings() {
  const { status, statusFor, hydrated, record, grant, deny, revoke, reset } = useCipaConsent();

  return (
    <div>
      <p>Current status: {status}</p>
      <button onClick={() => grant()}>Accept tracking</button>
      <button onClick={() => deny()}>Decline tracking</button>
      <button onClick={() => revoke()}>Revoke consent</button>
      <button onClick={() => reset()}>Reset (ask me again)</button>
    </div>
  );
}
```

- `status` — aggregate status of the default category: `'pending' | 'granted' | 'denied'`.
- `statusFor(category)` — status for a specific category (see `categories` below).
- `hydrated` — `false` until the client has read storage; used to avoid SSR/client mismatches.
- `record` — the current `ConsentRecord` (or `null`), including `policyVersion`, `timestamp`, and `method`.
- `grant()` / `deny()` — record a decision programmatically (e.g. from a custom UI).
- `revoke()` — withdraw a previously granted consent; status becomes `'denied'` and gated trackers unmount.
- `reset()` — clear the stored record entirely; status returns to `'pending'` and the dialog re-appears (useful for testing or an explicit "ask me again" affordance).

`useCipaConsent()` throws a descriptive error if called outside a `<CipaProvider>`.

## `<CipaProvider>` props

```tsx
<CipaProvider
  policyVersion="2026-07-23"
  ttlDays={365}
  declineTtlDays={undefined}
  categories={['default']}
  reloadOnRevoke={false}
  trackers={[]}
  storage={undefined}
  storageKey="cipa-consent"
  onGrant={(record) => persistToServer(record)}
  onDeny={(record) => persistToServer(record)}
  onRevoke={(record) => persistToServer(record)}
  dialog={undefined}
  dialogProps={{}}
>
  {children}
</CipaProvider>
```

| Prop | Type | Default | Notes |
|---|---|---|---|
| `policyVersion` | `string` | — | Bump this when your tracking/privacy policy changes to force re-prompting. |
| `ttlDays` | `number` | — | A `granted` record older than this is treated as `pending` again. |
| `declineTtlDays` | `number` | off | Opt-in re-prompt for `denied` records after N days. Off by default — a decline must not nag the visitor. |
| `categories` | `string[]` | `['default']` | Named consent categories. v1 UX is binary (the dialog grants/denies all configured categories at once), but records and the context API are keyed by category so per-category consent is not a breaking change later. |
| `reloadOnRevoke` | `boolean` | `false` | Hard-reloads the page after `revoke()` so already-loaded vendor JS is torn down. See [Limitations](#limitations). |
| `trackers` | `TrackerDefinition[]` | — | Optional declarative tracker list. See [Declarative trackers](#declarative-trackers-optional) below. Omitting it changes nothing. |
| `storage` | `ConsentStorage` | localStorage-backed | Custom storage backend. See [Consent records](#consent-records-are-not-legal-evidence-by-themselves). |
| `storageKey` | `string` | `'cipa-consent'` | Key used with the storage backend. |
| `onGrant` / `onDeny` / `onRevoke` | `(record: ConsentRecord) => void` | — | Fired on each corresponding transition. This is the seam for server-side persistence. |
| `dialog` | `(api: DialogRenderApi) => ReactNode` | built-in native `<dialog>` UI | Full render-prop override for a custom consent UI. |
| `dialogProps` | `ConsentDialogProps` | `{}` | Props passed to the built-in dialog (copy, labels, etc.) when not overriding `dialog`. |

`ConsentStorage` is a small interface if you need a non-localStorage backend:

```ts
interface ConsentStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
```

## Declarative trackers (optional)

Instead of (or in addition to) wrapping JSX in `<CipaTracking>`, you may pass a list of tracker definitions to the provider. This is entirely optional — omitting `trackers` changes nothing.

Two forms are supported: a React component (`component`), or an external script (`src`):

```tsx
import { CipaProvider } from 'cipa-provider';
import { HotjarTracker } from './HotjarTracker';

<CipaProvider
  trackers={[
    { id: 'hotjar', component: HotjarTracker },
    {
      id: 'ga4',
      src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX',
      attrs: { async: 'true' },
    },
  ]}
>
  {children}
</CipaProvider>
```

- `{ id, component }` — `component` must be a component **type** (not an already-created element). If you're holding a `ReactNode`, wrap it in a trivial component first.
- `{ id, src, attrs? }` — the script is injected only after consent, via the same `loadConsentedScript` util described below. `attrs` may include things like `async`/`defer`/`data-*`.
- Each definition may also set `category` (defaults to `'default'`).
- `id` must be unique; duplicates emit a dev warning and are deduped (first one wins).

Script trackers keep executing after `revoke()` — JavaScript already loaded and running cannot be un-loaded from the page. If your `trackers` list includes any `src` entries and `reloadOnRevoke` is not set, the provider emits a `console.warn` in development explaining this. Set `reloadOnRevoke` if you need revocation to reliably stop script-based trackers.

## `<CipaEmbed>` — third-party media embeds

YouTube, Vimeo, and similar iframe embeds set cookies and transmit viewer data on load, so they're trackers too — but unlike a beacon script, an embed is visible content that can't simply vanish. `<CipaEmbed>` renders a placeholder pre-consent and swaps in the real iframe once the visitor accepts:

```tsx
import { CipaEmbed } from 'cipa-provider';

<CipaEmbed
  src="https://www.youtube.com/embed/dQw4w9WgXcQ"
  title="Demo video"
  width={560}
  height={315}
/>
```

- **Pre-consent:** no `<iframe>` in the DOM, zero requests to the embed host — instead a placeholder is rendered at the declared size, with the given `title` and an "Accept & load" button.
- **Click-to-consent:** clicking the placeholder's button records a grant (`method: 'embed'`) and mounts the iframe. Accepting via the global consent dialog mounts it too — it's the same consent state either way.
- **Privacy-enhanced by default:** `privacyEnhanced` defaults to `true`. YouTube URLs are rewritten to `youtube-nocookie.com`; Vimeo URLs gain `dnt=1`. Unrecognized hosts are left unchanged. Pass `privacyEnhanced={false}` to use the `src` exactly as given.
- **Revocation:** revoking consent unmounts the iframe and shows the placeholder again.

## Google Consent Mode v2 — `<GtagConsentBridge>`

For sites using `gtag`/Google Tag Manager, `<GtagConsentBridge>` keeps Consent Mode state in sync with `cipa-provider`'s consent state. Place it *inside* the provider but *outside* `<CipaTracking>` — it needs to run regardless of consent status in order to fire the default-denied signal and subsequent updates:

```tsx
import { CipaProvider, GtagConsentBridge } from 'cipa-provider';

<CipaProvider policyVersion="2026-07-23">
  <GtagConsentBridge />
  {/* rest of your app */}
</CipaProvider>
```

On mount, if there's no prior grant, it fires:

```js
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});
```

and on every subsequent status change it fires the matching `gtag('consent', 'update', …)` call. It no-ops gracefully if `window.gtag`/`dataLayer` isn't present.

### Important: head-loaded GTM needs the snippet too

`<GtagConsentBridge>` runs at React mount time, which is *after* hydration. **It cannot retroactively gate a `gtag`/GTM snippet that's already loaded in the document `<head>`** — that snippet's `gtag('config', …)` call (and the page_view it fires) runs before your React tree ever mounts.

If your GTM/gtag snippet lives in `<head>` (a static HTML file, `_document`, a CMS template, etc.), you **must** paste the exported `CONSENT_MODE_DEFAULT_SNIPPET` there yourself, **before** the `gtag('config', …)` call:

```html
<head>
  <!-- 1. Paste the default-denied snippet FIRST -->
  <script>
    /* contents of CONSENT_MODE_DEFAULT_SNIPPET */
  </script>

  <!-- 2. THEN your normal gtag/GTM loader -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXX'); // must come AFTER the default-denied snippet
  </script>
</head>
```

You can print the exact string to paste with:

```ts
import { CONSENT_MODE_DEFAULT_SNIPPET } from 'cipa-provider';

console.log(CONSENT_MODE_DEFAULT_SNIPPET);
```

`<GtagConsentBridge>` still fully gates any `gtag` calls that originate *inside* your React tree, and correctly relays grant/revoke transitions — the snippet is only needed to cover the initial page load of a head-loaded loader.

## Beacon idempotency: your tracker's job, not the provider's

React's `<StrictMode>` intentionally double-invokes effects in development (mount → cleanup → mount). `cipa-provider` does not promise "your tracker's mount effect fires exactly once" — components can legitimately remount for reasons unrelated to consent. Making a beacon or pixel call idempotent is the tracker's own responsibility. A simple ref guard:

```tsx
import { useEffect, useRef } from 'react';

function PixelTracker() {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    fetch('https://tracker.example/beacon', { method: 'POST' });
  }, []);

  return null;
}
```

`loadConsentedScript` (used internally by declarative `src` trackers) already guards this way at the DOM level when given a `data-cipa-id`:

```ts
import { loadConsentedScript } from 'cipa-provider';

loadConsentedScript('https://example.com/vendor.js', {
  'data-cipa-id': 'vendor-script',
  async: 'true',
});
```

Calling this repeatedly with the same `data-cipa-id` is a no-op after the first injection — it checks `document.querySelector('script[data-cipa-id="…"]')` before adding a new `<script>` tag.

## Consent records are not legal evidence by themselves

By default, `cipa-provider` persists the current `ConsentRecord` to `localStorage`. This is convenient client-side state — it lets the provider avoid re-prompting a returning visitor — but **it is not an audit trail**. It's controlled entirely by the visitor's browser, can be cleared or edited by them, and proves nothing to a court or regulator on its own.

If you need a defensible record of consent, persist it server-side yourself using the callbacks:

```tsx
<CipaProvider
  policyVersion="2026-07-23"
  onGrant={(record) => {
    fetch('/api/consent', { method: 'POST', body: JSON.stringify(record) });
  }}
  onDeny={(record) => {
    fetch('/api/consent', { method: 'POST', body: JSON.stringify(record) });
  }}
  onRevoke={(record) => {
    fetch('/api/consent', { method: 'POST', body: JSON.stringify(record) });
  }}
>
  {children}
</CipaProvider>
```

Each `ConsentRecord` includes `categories` (per-category status), `policyVersion`, an ISO `timestamp`, and `method` (`'dialog' | 'api' | 'embed'`).

## Limitations

**Read this section before relying on `cipa-provider` for compliance.**

1. **Anything outside the React tree is not gated.** Scripts placed directly in `index.html`, `_document`, a CMS template, or a GTM container loaded in `<head>` run *before* React mounts and are entirely invisible to this library. Move them inside `<CipaTracking>` as a component, load them via `loadConsentedScript`, or — for `gtag`/GTM specifically — use the `CONSENT_MODE_DEFAULT_SNIPPET` described above. There is no global script interceptor here (a monkey-patched `createElement`/`MutationObserver` approach was considered and rejected as fragile and SSR-hostile); this library only gates what you explicitly wrap.
2. **Revocation can't undo the past.** Calling `revoke()` stops *future* tracking — mounted components unmount, and (for declarative `src` trackers) a dev warning nudges you toward `reloadOnRevoke`. It cannot recall data already transmitted to a vendor, and it cannot clear cookies or storage that vendor's JavaScript has already written in the browser. Set `reloadOnRevoke` if you need a hard page reload to tear down already-running vendor code and its client-side state.
3. **A custom `ConsentStorage` gets no automatic cross-tab sync.** The default localStorage backend listens for the `storage` event so multiple open tabs stay in sync automatically. If you supply your own `storage`, you are responsible for wiring up equivalent synchronization if you need it.

## CIPA background

The California Invasion of Privacy Act (Cal. Penal Code §§ 630–638.55) is a 1967 wiretapping statute that is now the primary vehicle for website-tracking litigation in California:

- **§ 631(a) (wiretapping)** prohibits a third party from intercepting the *contents* of a communication in transit without consent of all parties — applied against session-replay tools, chat widgets, and ad pixels that relay page content, form input, or chat text to a vendor.
- **§ 638.51 (pen register / trap-and-trace)** prohibits installing a device or process that captures dialing, routing, addressing, or signaling information without a court order. Recent case law has extended this theory to tracking pixels/SDKs that collect IP addresses and device fingerprints — currently the dominant claim pattern.
- **§ 637.2 (private right of action)** provides **$5,000 in statutory damages per violation**, with no actual harm required — which is what makes this an active area of litigation.
- Both § 631 and § 638.51 carry an exception for **consent** — but that consent must be obtained **before** interception occurs. A tracker that fires on page load and shows a cookie banner afterward has arguably already violated the statute. This is why `cipa-provider` is opt-in and blocking, not opt-out (unlike CCPA).
- **On SB 690:** as of this writing, SB 690 (which would remove the private right of action for § 638.51 pen-register claims, AG-enforcement only, effective Jan 1 2027) has only passed a committee vote — **it is not law**. It would not affect § 631 wiretap claims even if enacted. Do not build compliance decisions around its passage.

## Legal disclaimer

`cipa-provider` is a **technical control**, not legal advice. It cannot by itself make a website compliant with CIPA or any other law. Your consent dialog copy, privacy policy, and the specific trackers you gate must be reviewed and approved by counsel. Nothing in this README or in the library's behavior should be relied upon as a substitute for legal review.

## Accessibility and anti-dark-pattern defaults

The built-in consent dialog is intentionally conservative so that naive, out-of-the-box usage still produces legally meaningful consent:

- Rendered with the native `<dialog>` element via `showModal()` — focus is trapped inside it and `Tab` cycles within it automatically.
- Accept and Decline are equally prominent, both keyboard-reachable — no pre-checked boxes, no buried decline link.
- Pressing `Esc` dismisses the dialog **without recording a decision** — status stays `pending`, and the dialog reappears on the next mount. Dismissal is never treated as acceptance.
- The default dialog passes `axe` accessibility checks with no violations.

If you override the dialog via the `dialog` render prop, keep these properties intact — weakening them weakens the legal basis for the consent you collect.

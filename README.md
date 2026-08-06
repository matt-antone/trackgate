# Trackgate

A React provider that gates tracking components behind CIPA-compliant, express opt-in consent. Trackers wrapped by this library **never mount** — no script tags, no network beacons, no cookies or identifiers written — until the user affirmatively accepts.

This is a technical control, not a legal opinion. See [Legal disclaimer](#legal-disclaimer) and [CIPA background](#cipa-background) below.

## Why

California's Invasion of Privacy Act (CIPA) is currently the primary vehicle for website-tracking litigation in California. Its consent exceptions require consent **before** interception occurs — a tracker that fires a beacon on page load and *then* shows a cookie banner has already allegedly violated the statute. `trackgate` enforces this ordering at the React rendering layer: gated components render `null` until consent is granted, so there is nothing to intercept, no request to send, and no identifier to write.

## Install

```bash
npm install trackgate
```

`react` and `react-dom` (>=18) are peer dependencies. There are no other runtime dependencies.

## Quickstart

Wrap your app in `<ConsentProvider>`, and wrap tracking components in `<ConsentGate>`:

```tsx
import { ConsentProvider, ConsentGate } from 'trackgate';
import { HotjarTracker } from './HotjarTracker';
import { MetaPixel } from './MetaPixel';

function App() {
  return (
    <ConsentProvider policyVersion="2026-07-23">
      <YourAppContent />

      <ConsentGate>
        <HotjarTracker />
        <MetaPixel />
      </ConsentGate>
    </ConsentProvider>
  );
}
```

`HotjarTracker` and `MetaPixel` are not modified in any way — they are ordinary React components. `<ConsentGate>` simply does not render its children (`null`) until the visitor has granted consent. No dialog markup, no tracker markup, and no storage access happens on the server (SSR-safe), so there is no hydration mismatch.

By default, a native `<dialog>`-based consent prompt appears automatically once the provider mounts on the client and no prior decision is on record.

### Reading consent state — `useConsent()`

```tsx
import { useConsent } from 'trackgate';

function PrivacySettings() {
  const { status, statusFor, hydrated, record, grant, deny, revoke, reset } = useConsent();

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
- `record` — the current `ConsentRecord` (or `null`), including `recordId`, `policyVersion`, `timestamp`, and `method`.
- `grant()` / `deny()` — record a decision programmatically (e.g. from a custom UI).
- `revoke()` — withdraw a previously granted consent; status becomes `'denied'` and gated trackers unmount.
- `reset()` — clear the stored record entirely; status returns to `'pending'` and the dialog re-appears (useful for testing or an explicit "ask me again" affordance).

`useConsent()` throws a descriptive error if called outside a `<ConsentProvider>`.

## `<ConsentProvider>` props

```tsx
<ConsentProvider
  policyVersion="2026-07-23"
  ttlDays={365}
  declineTtlDays={undefined}
  categories={['default']}
  reloadOnRevoke={false}
  trackers={[]}
  storage={undefined}
  storageKey="trackgate-consent"
  onGrant={(record) => persistToServer(record)}
  onDeny={(record) => persistToServer(record)}
  onRevoke={(record) => persistToServer(record)}
  dialog={undefined}
  dialogProps={{}}
>
  {children}
</ConsentProvider>
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
| `storageKey` | `string` | `'trackgate-consent'` | Key used with the storage backend. |
| `onGrant` / `onDeny` / `onRevoke` | `(record: ConsentRecord) => void` | — | Fired on each corresponding transition. This is the seam for server-side persistence. |
| `dialog` | `(api: DialogRenderApi) => ReactNode` | built-in native `<dialog>` UI | Full render-prop override for a custom consent UI. |
| `dialogProps` | `ConsentDialogProps` | `{}` | Props passed to the built-in dialog (copy, labels, `classNames`, etc.) when not overriding `dialog`. |

### Styling the built-in dialog with your own classes

Beyond the `--trackgate-*` CSS variables, `dialogProps.classNames` lets you attach a class to any slot of the built-in dialog: `dialog`, `title`, `description`, `privacyPolicy`, `actions`, `acceptButton`, `declineButton`.

```tsx
<ConsentProvider
  dialogProps={{
    classNames: {
      dialog: 'consent-modal',
      acceptButton: 'btn btn-primary',
      declineButton: 'btn btn-secondary',
    },
  }}
>
```

A slot that receives a class gets **no default inline style** — your CSS owns that slot entirely (inline styles would otherwise beat any class rule, making overrides impossible). Slots you leave unclassed keep the built-in styling.

For small tweaks without taking over a slot, set the CSS variables instead — they apply to the built-in styling of unclassed slots:

```css
:root {
  --trackgate-font-family: system-ui, sans-serif;
  --trackgate-dialog-max-width: 28rem;
  --trackgate-dialog-padding: 1.5rem;
  --trackgate-dialog-border: 1px solid rgba(0, 0, 0, 0.15);
  --trackgate-dialog-radius: 10px;
  --trackgate-dialog-bg: #fff;
  --trackgate-dialog-color: #111;
  --trackgate-button-padding: 0.625rem 1rem;
  --trackgate-button-font-size: 1rem;
  --trackgate-button-border: 1px solid currentColor;
  --trackgate-button-radius: 6px;
  --trackgate-button-bg: transparent;
  --trackgate-button-color: inherit;
}
```

Accept and Decline share one set of button variables by design — equal visual prominence is an anti-dark-pattern requirement for valid consent. Use `classNames` if you need them to differ.

`ConsentStorage` is a small interface if you need a non-localStorage backend:

```ts
interface ConsentStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
```

## Declarative trackers (optional)

Instead of (or in addition to) wrapping JSX in `<ConsentGate>`, you may pass a list of tracker definitions to the provider. This is entirely optional — omitting `trackers` changes nothing.

Two forms are supported: a React component (`component`), or an external script (`src`):

```tsx
import { ConsentProvider } from 'trackgate';
import { HotjarTracker } from './HotjarTracker';

<ConsentProvider
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
</ConsentProvider>
```

- `{ id, component }` — `component` must be a component **type** (not an already-created element). If you're holding a `ReactNode`, wrap it in a trivial component first.
- `{ id, src, attrs? }` — the script is injected only after consent, via the same `loadConsentedScript` util described below. `attrs` may include things like `async`/`defer`/`data-*`.
- Each definition may also set `category` (defaults to `'default'`).
- `id` must be unique; duplicates emit a dev warning and are deduped (first one wins).

Script trackers keep executing after `revoke()` — JavaScript already loaded and running cannot be un-loaded from the page. If your `trackers` list includes any `src` entries and `reloadOnRevoke` is not set, the provider emits a `console.warn` in development explaining this. Set `reloadOnRevoke` if you need revocation to reliably stop script-based trackers.

## `<ConsentEmbed>` — third-party media embeds

YouTube, Vimeo, and similar iframe embeds set cookies and transmit viewer data on load, so they're trackers too — but unlike a beacon script, an embed is visible content that can't simply vanish. `<ConsentEmbed>` renders a placeholder pre-consent and swaps in the real iframe once the visitor accepts:

```tsx
import { ConsentEmbed } from 'trackgate';

<ConsentEmbed
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

### Embed privacy hardening

The post-consent `<iframe>` ships with privacy-hardening defaults, all overridable:

| Prop | Default | Effect |
| --- | --- | --- |
| `credentialless` | `true` | Renders the `credentialless` iframe attribute. In Chromium, the iframe gets ephemeral, partitioned storage — any cookies the vendor sets die when the iframe unmounts (e.g. on revoke), instead of persisting across sessions. Browsers without support simply ignore the attribute. |
| `referrerPolicy` | `'strict-origin-when-cross-origin'` | Stops the vendor from seeing your page's full URL (including query strings) on the referrer header — only the origin is sent cross-site. |
| `allow` | `'autoplay; encrypted-media; fullscreen; picture-in-picture'` | Standard permissions policy for media embeds; override to grant or restrict features. |

```tsx
<ConsentEmbed
  src="https://www.youtube.com/embed/dQw4w9WgXcQ"
  title="Demo video"
  credentialless={false} // opt out if you need persistent vendor state
  referrerPolicy="no-referrer"
/>
```

### Styling the embed with your own classes

`classNames` attaches a class to any slot of the embed: `placeholder`, `thumbnail`, `title`, `button`, `iframe`.

```tsx
<ConsentEmbed
  src="https://www.youtube.com/embed/dQw4w9WgXcQ"
  title="Demo video"
  classNames={{ placeholder: 'embed-panel', button: 'btn btn-primary' }}
/>
```

Same rule as the dialog: a slot that receives a class gets **no default inline style** — your CSS owns that slot entirely. For `placeholder` that includes the `width`/`height` sizing, so size it in your CSS.

The unclassed placeholder reads these CSS variables:

```css
:root {
  --trackgate-embed-bg: #f2f2f2;
  --trackgate-embed-color: #111;
  --trackgate-embed-border: 1px solid rgba(0, 0, 0, 0.15);
  --trackgate-embed-radius: 8px;
}
```

**Thumbnail guidance:** self-host `thumbnailUrl` images. A vendor-hosted thumbnail (`i.ytimg.com`, `vimeocdn.com`, etc.) is itself a request to the vendor's servers — it pings them before the visitor has consented to anything, defeating the point of the placeholder. In development, `ConsentEmbed` logs a `console.warn` if it detects a known vendor thumbnail host.

## Google Consent Mode v2 — `<GtagConsentBridge>`

For sites using `gtag`/Google Tag Manager, `<GtagConsentBridge>` keeps Consent Mode state in sync with `trackgate`'s consent state. Place it *inside* the provider but *outside* `<ConsentGate>` — it needs to run regardless of consent status in order to fire the default-denied signal and subsequent updates:

```tsx
import { ConsentProvider, GtagConsentBridge } from 'trackgate';

<ConsentProvider policyVersion="2026-07-23">
  <GtagConsentBridge />
  {/* rest of your app */}
</ConsentProvider>
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
import { CONSENT_MODE_DEFAULT_SNIPPET } from 'trackgate';

console.log(CONSENT_MODE_DEFAULT_SNIPPET);
```

`<GtagConsentBridge>` still fully gates any `gtag` calls that originate *inside* your React tree, and correctly relays grant/revoke transitions — the snippet is only needed to cover the initial page load of a head-loaded loader.

## Beacon idempotency: your tracker's job, not the provider's

React's `<StrictMode>` intentionally double-invokes effects in development (mount → cleanup → mount). `trackgate` does not promise "your tracker's mount effect fires exactly once" — components can legitimately remount for reasons unrelated to consent. Making a beacon or pixel call idempotent is the tracker's own responsibility. A simple ref guard:

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

`loadConsentedScript` (used internally by declarative `src` trackers) already guards this way at the DOM level when given a `data-trackgate-id`:

```ts
import { loadConsentedScript } from 'trackgate';

loadConsentedScript('https://example.com/vendor.js', {
  'data-trackgate-id': 'vendor-script',
  async: 'true',
});
```

Calling this repeatedly with the same `data-trackgate-id` is a no-op after the first injection — it checks `document.querySelector('script[data-trackgate-id="…"]')` before adding a new `<script>` tag.

## Consent records are not legal evidence by themselves

By default, `trackgate` persists the current `ConsentRecord` to `localStorage`. This is convenient client-side state — it lets the provider avoid re-prompting a returning visitor — but **it is not an audit trail**. It's controlled entirely by the visitor's browser, can be cleared or edited by them, and proves nothing to a court or regulator on its own.

If you need a defensible record of consent, persist it server-side yourself using the callbacks:

```tsx
<ConsentProvider
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
</ConsentProvider>
```

A `ConsentRecord` looks like this:

```json
{
  "recordId": "b3b1a2e4-7c9d-4a1e-9f2d-1a2b3c4d5e6f",
  "categories": { "default": "granted" },
  "policyVersion": "2026-07-23",
  "timestamp": "2026-07-23T10:41:00.000Z",
  "method": "dialog"
}
```

`recordId` is a fresh, unique id generated on **every** grant/deny/revoke write (a revoke gets its own id, distinct from the grant it revokes). Mirror it in your server-side consent log inside `onGrant`/`onDeny`/`onRevoke` so you can match a visitor's local device record to the corresponding server-side log entry in a dispute — this is stronger evidence than matching on IP address, which is shared behind NAT/CGNAT, changes across sessions, and does not identify a device. As a rule of thumb, it's reasonable to log the request IP alongside a `grant` (supporting evidence for "this visitor accepted"), but avoid relying on IP to justify a `deny` — the absence of a matching IP proves nothing about consent.

Each `ConsentRecord` includes `recordId` (unique per decision event), `categories` (per-category status), `policyVersion`, an ISO `timestamp`, and `method` (`'dialog' | 'api' | 'embed'`).

## Google Fonts and other third-party assets: avoid, don't gate

Remote font requests (`fonts.googleapis.com` / `fonts.gstatic.com`) transmit each visitor's IP address to Google before any consent can be collected — the exact fact pattern behind the German *LG München* Google Fonts ruling and the same IP-transmission theory used in CIPA pen-register claims. But **consent-gating fonts is the wrong fix**: fonts are render-critical, so gating them means every pre-consent and declining visitor gets fallback typography and layout shift forever — visually punishing the choice not to consent.

**Eliminate the third-party request instead:**

- **Self-host via [Fontsource](https://fontsource.org):** `npm install @fontsource/inter`, then `import '@fontsource/inter/400.css'` — fonts ship from your own origin.
- **Next.js:** `next/font/google` downloads fonts at build time and self-hosts them automatically; production traffic never touches Google.
- **Manual:** download the `woff2` files (e.g. via google-webfonts-helper) and serve them yourself.

Google Fonts' license permits self-hosting. No third-party request means nothing to disclose, nothing to gate, and faster loads.

The same "avoid, don't gate" logic applies to any third-party asset that isn't itself a tracker: CDN-hosted CSS, icon fonts, remote images. Reserve `<ConsentGate>` for things that *track*. The narrow exception is a font service that contractually cannot be self-hosted **and** tracks (e.g. Adobe Fonts) — treat that like any other tracker: load it post-consent inside the gate and accept a fallback `font-family` stack pre-consent.

## Limitations

**Read this section before relying on `trackgate` for compliance.**

1. **Anything outside the React tree is not gated.** Scripts placed directly in `index.html`, `_document`, a CMS template, or a GTM container loaded in `<head>` run *before* React mounts and are entirely invisible to this library. Move them inside `<ConsentGate>` as a component, load them via `loadConsentedScript`, or — for `gtag`/GTM specifically — use the `CONSENT_MODE_DEFAULT_SNIPPET` described above. There is no global script interceptor here (a monkey-patched `createElement`/`MutationObserver` approach was considered and rejected as fragile and SSR-hostile); this library only gates what you explicitly wrap.
2. **Revocation can't undo the past.** Calling `revoke()` stops *future* tracking — mounted components unmount, and (for declarative `src` trackers) a dev warning nudges you toward `reloadOnRevoke`. It cannot recall data already transmitted to a vendor, and it cannot clear cookies or storage that vendor's JavaScript has already written in the browser. Set `reloadOnRevoke` if you need a hard page reload to tear down already-running vendor code and its client-side state.
3. **A custom `ConsentStorage` gets no automatic cross-tab sync.** The default localStorage backend listens for the `storage` event so multiple open tabs stay in sync automatically. If you supply your own `storage`, you are responsible for wiring up equivalent synchronization if you need it.

## CIPA background

The California Invasion of Privacy Act (Cal. Penal Code §§ 630–638.55) is a 1967 wiretapping statute that is now the primary vehicle for website-tracking litigation in California:

- **§ 631(a) (wiretapping)** prohibits a third party from intercepting the *contents* of a communication in transit without consent of all parties — applied against session-replay tools, chat widgets, and ad pixels that relay page content, form input, or chat text to a vendor.
- **§ 638.51 (pen register / trap-and-trace)** prohibits installing a device or process that captures dialing, routing, addressing, or signaling information without a court order. Recent case law has extended this theory to tracking pixels/SDKs that collect IP addresses and device fingerprints — currently the dominant claim pattern.
- **§ 637.2 (private right of action)** provides **$5,000 in statutory damages per violation**, with no actual harm required — which is what makes this an active area of litigation.
- Both § 631 and § 638.51 carry an exception for **consent** — but that consent must be obtained **before** interception occurs. A tracker that fires on page load and shows a cookie banner afterward has arguably already violated the statute. This is why `trackgate` is opt-in and blocking, not opt-out (unlike CCPA).
- **On SB 690:** as of this writing, SB 690 (which would remove the private right of action for § 638.51 pen-register claims, AG-enforcement only, effective Jan 1 2027) has only passed a committee vote — **it is not law**. It would not affect § 631 wiretap claims even if enacted. Do not build compliance decisions around its passage.

## Legal disclaimer

`trackgate` is a **technical control**, not legal advice. It cannot by itself make a website compliant with CIPA or any other law. Your consent dialog copy, privacy policy, and the specific trackers you gate must be reviewed and approved by counsel. Nothing in this README or in the library's behavior should be relied upon as a substitute for legal review.

## Accessibility and anti-dark-pattern defaults

The built-in consent dialog is intentionally conservative so that naive, out-of-the-box usage still produces legally meaningful consent:

- Rendered with the native `<dialog>` element via `showModal()` — focus is trapped inside it and `Tab` cycles within it automatically.
- Accept and Decline are equally prominent, both keyboard-reachable — no pre-checked boxes, no buried decline link.
- Pressing `Esc` dismisses the dialog **without recording a decision** — status stays `pending`, and the dialog reappears on the next mount. Dismissal is never treated as acceptance.
- The default dialog passes `axe` accessibility checks with no violations.

If you override the dialog via the `dialog` render prop — or restyle it via `dialogProps.classNames` — keep these properties intact. Styling Accept more prominently than Decline is the classic dark pattern these defaults exist to avoid; weakening them weakens the legal basis for the consent you collect.

import {
  CipaProvider,
  CipaTracking,
  CipaEmbed,
  useCipaConsent,
  type ConsentRecord,
} from 'cipa-provider';
import { PixelTracker } from './PixelTracker';

function StatusPanel() {
  const { status, hydrated, revoke, reset } = useCipaConsent();

  return (
    <section>
      <h2>Consent status</h2>
      <p>
        hydrated: <code>{String(hydrated)}</code> — status: <code>{status}</code>
      </p>
      <button type="button" onClick={() => revoke()}>
        Revoke
      </button>
      <button type="button" onClick={() => reset()}>
        Reset (re-prompt)
      </button>
    </section>
  );
}

function onGrant(record: ConsentRecord) {
  console.log('[example] onGrant', record);
}

function onDeny(record: ConsentRecord) {
  console.log('[example] onDeny', record);
}

export function App() {
  return (
    <CipaProvider
      policyVersion="1"
      onGrant={onGrant}
      onDeny={onDeny}
      trackers={[{ id: 'demo-vendor-script', src: '/tracker.js' }]}
    >
      <h1>cipa-provider example</h1>
      <p>
        Manual verification app for AC13 (built-package consumption) and AC2
        (no pre-consent network). Open DevTools Network before accepting the
        dialog — no requests to httpbin, youtube-nocookie, or /tracker.js
        should appear until you grant consent.
      </p>

      <StatusPanel />

      <section>
        <h2>JSX-gated fake pixel</h2>
        <CipaTracking>
          <PixelTracker />
        </CipaTracking>
      </section>

      <section>
        <h2>Declarative tracker list</h2>
        <p>
          Configured via the provider's <code>trackers</code> prop with one
          entry (<code>/tracker.js</code>, served from <code>public/</code>).
          Check the Network/Elements tab after granting consent.
        </p>
      </section>

      <section>
        <h2>Embed facade</h2>
        <CipaEmbed
          src="https://www.youtube.com/embed/dQw4w9WgXcQ"
          title="Demo video"
        />
      </section>
    </CipaProvider>
  );
}

import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import {
  CipaProvider,
  CipaTracking,
  GtagConsentBridge,
  CONSENT_MODE_DEFAULT_SNIPPET,
  useCipaConsent,
} from '../src';
import { DEFAULT_STORAGE_KEY } from '../src/storage';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// A gated mock component: only mounts once consent is granted (rendered
// inside <CipaTracking>), and calls gtag('config', 'G-X') on mount — the
// scenario AC15(a) asserts ordering against.
function MockGtagConfigComponent() {
  useEffect(() => {
    window.gtag?.('config', 'G-X');
  }, []);
  return null;
}

function Controls() {
  const { grant, deny, revoke } = useCipaConsent();
  return (
    <div>
      <button onClick={() => grant()}>grant</button>
      <button onClick={() => deny()}>deny</button>
      <button onClick={() => revoke()}>revoke</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  delete window.gtag;
  delete window.dataLayer;
  vi.restoreAllMocks();
});

describe('GtagConsentBridge (AC15)', () => {
  it('(a) fires consent default-denied BEFORE an in-tree gtag(config, ...) call', async () => {
    const gtagSpy = vi.fn();
    window.gtag = gtagSpy;
    window.dataLayer = [];

    // Pre-seed a granted record so the gated config component mounts once the
    // provider hydrates.
    window.localStorage.setItem(
      DEFAULT_STORAGE_KEY,
      JSON.stringify({
        categories: { default: 'granted' },
        policyVersion: '1',
        timestamp: new Date().toISOString(),
        method: 'api',
      }),
    );

    render(
      <CipaProvider>
        <GtagConsentBridge />
        <CipaTracking>
          <MockGtagConfigComponent />
        </CipaTracking>
      </CipaProvider>,
    );

    await waitFor(() => {
      const hasConfigCall = gtagSpy.mock.calls.some((call) => call[0] === 'config');
      expect(hasConfigCall).toBe(true);
    });

    const defaultCallIndex = gtagSpy.mock.calls.findIndex(
      (call) => call[0] === 'consent' && call[1] === 'default',
    );
    const configCallIndex = gtagSpy.mock.calls.findIndex((call) => call[0] === 'config');

    expect(defaultCallIndex).toBeGreaterThanOrEqual(0);
    expect(configCallIndex).toBeGreaterThanOrEqual(0);
    expect(defaultCallIndex).toBeLessThan(configCallIndex);

    const defaultCall = gtagSpy.mock.calls.find(
      (call) => call[0] === 'consent' && call[1] === 'default',
    );
    expect(defaultCall).toBeDefined();
    expect(defaultCall?.[2]).toMatchObject({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('(b) fires gtag(consent, update, ...granted) after grant', async () => {
    const gtagSpy = vi.fn();
    window.gtag = gtagSpy;
    window.dataLayer = [];

    const { getByText } = render(
      <CipaProvider>
        <GtagConsentBridge />
        <Controls />
      </CipaProvider>,
    );

    await waitFor(() => {
      expect(
        gtagSpy.mock.calls.some((call) => call[0] === 'consent' && call[1] === 'default'),
      ).toBe(true);
    });

    gtagSpy.mockClear();

    fireEvent.click(getByText('grant'));

    await waitFor(() => {
      expect(
        gtagSpy.mock.calls.some((call) => call[0] === 'consent' && call[1] === 'update'),
      ).toBe(true);
    });

    const updateCall = gtagSpy.mock.calls.find(
      (call) => call[0] === 'consent' && call[1] === 'update',
    );
    expect(updateCall?.[2]).toMatchObject({
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
  });

  it('(c) fires gtag(consent, update, ...denied) after revoke', async () => {
    const gtagSpy = vi.fn();
    window.gtag = gtagSpy;
    window.dataLayer = [];

    const { getByText } = render(
      <CipaProvider>
        <GtagConsentBridge />
        <Controls />
      </CipaProvider>,
    );

    await waitFor(() => {
      expect(
        gtagSpy.mock.calls.some((call) => call[0] === 'consent' && call[1] === 'default'),
      ).toBe(true);
    });

    fireEvent.click(getByText('grant'));

    await waitFor(() => {
      expect(
        gtagSpy.mock.calls.some(
          (call) =>
            call[0] === 'consent' &&
            call[1] === 'update' &&
            (call[2] as Record<string, string>)?.analytics_storage === 'granted',
        ),
      ).toBe(true);
    });

    gtagSpy.mockClear();

    fireEvent.click(getByText('revoke'));

    await waitFor(() => {
      expect(
        gtagSpy.mock.calls.some((call) => call[0] === 'consent' && call[1] === 'update'),
      ).toBe(true);
    });

    const updateCall = gtagSpy.mock.calls.find(
      (call) => call[0] === 'consent' && call[1] === 'update',
    );
    expect(updateCall?.[2]).toMatchObject({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('(d) CONSENT_MODE_DEFAULT_SNIPPET contains the consent default call and all four keys', () => {
    expect(CONSENT_MODE_DEFAULT_SNIPPET).toContain('consent');
    expect(CONSENT_MODE_DEFAULT_SNIPPET).toContain('default');
    expect(CONSENT_MODE_DEFAULT_SNIPPET).toContain('analytics_storage');
    expect(CONSENT_MODE_DEFAULT_SNIPPET).toContain('ad_storage');
    expect(CONSENT_MODE_DEFAULT_SNIPPET).toContain('ad_user_data');
    expect(CONSENT_MODE_DEFAULT_SNIPPET).toContain('ad_personalization');
  });

  it('no-ops without throwing when window.gtag is absent', async () => {
    delete window.gtag;
    delete window.dataLayer;

    expect(() => {
      const { getByText, unmount } = render(
        <CipaProvider>
          <GtagConsentBridge />
          <Controls />
        </CipaProvider>,
      );
      fireEvent.click(getByText('grant'));
      fireEvent.click(getByText('revoke'));
      unmount();
    }).not.toThrow();
  });
});

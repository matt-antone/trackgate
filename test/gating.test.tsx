import { useEffect } from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentProvider } from '../src/ConsentProvider';
import { ConsentGate } from '../src/ConsentGate';
import { DEFAULT_STORAGE_KEY } from '../src/storage';

const TRACKER_SCRIPT_SRC = 'https://tracker.example/tracker.js';
const TRACKER_BEACON_URL = 'https://tracker.example/beacon';

/**
 * Mock tracker fixture (per task spec): its mount effect injects a <script>
 * tag and calls fetch() — the two side effects CIPA gating must block until
 * consent is granted.
 */
function MockTracker() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = TRACKER_SCRIPT_SRC;
    document.body.appendChild(script);
    void fetch(TRACKER_BEACON_URL);
  }, []);
  return <div data-testid="tracker">tracking</div>;
}

function injectedScripts() {
  return document.querySelectorAll(`script[src="${TRACKER_SCRIPT_SRC}"]`);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const script of Array.from(injectedScripts())) {
    script.remove();
  }
});

describe('AC1 — no pre-consent render', () => {
  test('pending status: tracker child absent from DOM, zero scripts injected', () => {
    render(
      <ConsentProvider storageKey={DEFAULT_STORAGE_KEY}>
        <ConsentGate>
          <MockTracker />
        </ConsentGate>
      </ConsentProvider>,
    );

    expect(screen.queryByTestId('tracker')).toBeNull();
    expect(injectedScripts()).toHaveLength(0);
  });
});

describe('AC2 — no pre-consent network', () => {
  test('zero tracker calls before Accept; tracker mounts and fires only after Accept click', async () => {
    const user = userEvent.setup();

    const fetchSpy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', fetchSpy);

    const xhrOpenSpy = vi
      .spyOn(XMLHttpRequest.prototype, 'open')
      .mockImplementation(() => undefined as unknown as void);

    const imageSrcSpy = vi.fn();
    const originalImageSrcSetter = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      'src',
    );
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      set(value: string) {
        imageSrcSpy(value);
        originalImageSrcSetter?.set?.call(this, value);
      },
      get() {
        return originalImageSrcSetter?.get?.call(this);
      },
    });

    try {
      render(
        <ConsentProvider storageKey={DEFAULT_STORAGE_KEY}>
          <ConsentGate>
            <MockTracker />
          </ConsentGate>
        </ConsentProvider>,
      );

      // Pre-accept: zero tracker-originated calls on any channel.
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrOpenSpy).not.toHaveBeenCalled();
      expect(imageSrcSpy).not.toHaveBeenCalled();
      expect(screen.queryByTestId('tracker')).toBeNull();
      expect(injectedScripts()).toHaveLength(0);

      const acceptButton = await screen.findByText('Accept');
      await user.click(acceptButton);

      // Post-accept: tracker mounted, its mount-effect fetch fired.
      expect(document.body.contains(screen.getByTestId('tracker'))).toBe(true);
      expect(injectedScripts().length).toBeGreaterThanOrEqual(1);
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(fetchSpy).toHaveBeenCalledWith(TRACKER_BEACON_URL);
    } finally {
      if (originalImageSrcSetter) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', originalImageSrcSetter);
      }
    }
  });
});

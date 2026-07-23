import { useEffect } from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CipaProvider } from '../src/CipaProvider';
import { CipaTracking } from '../src/CipaTracking';
import { DEFAULT_STORAGE_KEY } from '../src/storage';

// jsdom does not implement the native <dialog> element's showModal()/close();
// the default ConsentDialog relies on it. Polyfill just enough for tests.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

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
      <CipaProvider storageKey={DEFAULT_STORAGE_KEY}>
        <CipaTracking>
          <MockTracker />
        </CipaTracking>
      </CipaProvider>,
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
        <CipaProvider storageKey={DEFAULT_STORAGE_KEY}>
          <CipaTracking>
            <MockTracker />
          </CipaTracking>
        </CipaProvider>,
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

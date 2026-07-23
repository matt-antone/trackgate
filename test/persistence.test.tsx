import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentProvider } from '../src/ConsentProvider';
import { ConsentGate } from '../src/ConsentGate';
import { DEFAULT_STORAGE_KEY } from '../src/storage';
import type { ConsentRecord } from '../src/types';

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

function TrackerChild() {
  return <div data-testid="tracker">tracking</div>;
}

function readStored(): ConsentRecord | null {
  const raw = window.localStorage.getItem(DEFAULT_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as ConsentRecord) : null;
}

function seedRecord(record: ConsentRecord, key = DEFAULT_STORAGE_KEY) {
  window.localStorage.setItem(key, JSON.stringify(record));
}

function makeRecord(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    categories: { default: 'granted' },
    policyVersion: '1',
    timestamp: new Date().toISOString(),
    method: 'dialog',
    ...overrides,
  };
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function dialogIsShown(): boolean {
  return screen.queryByText('Accept') !== null;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('AC3 — decline persists', () => {
  test('clicking Decline stores a denied record; a fresh provider render shows no dialog and mounts no trackers', async () => {
    const user = userEvent.setup();

    const { unmount } = render(
      <ConsentProvider>
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    const declineButton = await screen.findByText('Decline');
    await user.click(declineButton);

    const stored = readStored();
    expect(stored).not.toBeNull();
    expect(stored?.categories.default).toBe('denied');
    expect(stored?.policyVersion).toBe('1');
    expect(typeof stored?.timestamp).toBe('string');

    unmount();

    render(
      <ConsentProvider>
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    expect(dialogIsShown()).toBe(false);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});

describe('AC4 — grant persists', () => {
  test('clicking Accept stores a granted record; a fresh provider render mounts trackers with no dialog', async () => {
    const user = userEvent.setup();

    const { unmount } = render(
      <ConsentProvider>
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    const acceptButton = await screen.findByText('Accept');
    await user.click(acceptButton);

    const stored = readStored();
    expect(stored?.categories.default).toBe('granted');

    unmount();

    render(
      <ConsentProvider>
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    expect(dialogIsShown()).toBe(false);
    expect(document.body.contains(screen.getByTestId('tracker'))).toBe(true);
  });
});

describe('AC6 — policy version bump', () => {
  test('stored policyVersion "1" + provider policyVersion "2" resets to pending and re-shows the dialog', () => {
    seedRecord(makeRecord({ policyVersion: '1', categories: { default: 'granted' } }));

    render(
      <ConsentProvider policyVersion="2">
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    expect(dialogIsShown()).toBe(true);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});

describe('AC7 — TTL', () => {
  test('granted record older than ttlDays is treated as pending', () => {
    seedRecord(
      makeRecord({
        categories: { default: 'granted' },
        timestamp: isoDaysAgo(5),
      }),
    );

    render(
      <ConsentProvider ttlDays={3}>
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    expect(dialogIsShown()).toBe(true);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });

  test('denied record is unaffected by ttlDays', () => {
    seedRecord(
      makeRecord({
        categories: { default: 'denied' },
        timestamp: isoDaysAgo(5),
      }),
    );

    render(
      <ConsentProvider ttlDays={3}>
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    expect(dialogIsShown()).toBe(false);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});

describe('AC7b — decline TTL (opt-in)', () => {
  test('with declineTtlDays set, an old denied record expires back to pending', () => {
    seedRecord(
      makeRecord({
        categories: { default: 'denied' },
        timestamp: isoDaysAgo(10),
      }),
    );

    render(
      <ConsentProvider declineTtlDays={7}>
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    expect(dialogIsShown()).toBe(true);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });

  test('without declineTtlDays, a denied record never expires', () => {
    seedRecord(
      makeRecord({
        categories: { default: 'denied' },
        timestamp: isoDaysAgo(3650),
      }),
    );

    render(
      <ConsentProvider>
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    expect(dialogIsShown()).toBe(false);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});

describe('AC10 — corrupt storage fails closed', () => {
  test('unparseable JSON: status pending, no throw', () => {
    window.localStorage.setItem(DEFAULT_STORAGE_KEY, '{not valid json');

    expect(() =>
      render(
        <ConsentProvider>
          <ConsentGate>
            <TrackerChild />
          </ConsentGate>
        </ConsentProvider>,
      ),
    ).not.toThrow();

    expect(dialogIsShown()).toBe(true);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });

  test('malformed shape (valid JSON, wrong structure): status pending, no throw', () => {
    window.localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));

    expect(() =>
      render(
        <ConsentProvider>
          <ConsentGate>
            <TrackerChild />
          </ConsentGate>
        </ConsentProvider>,
      ),
    ).not.toThrow();

    expect(dialogIsShown()).toBe(true);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});

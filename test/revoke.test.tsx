import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CipaProvider } from '../src/CipaProvider';
import { CipaTracking } from '../src/CipaTracking';
import { useCipaConsent } from '../src/useCipaConsent';
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

function Controls() {
  const { revoke, reset } = useCipaConsent();
  return (
    <div>
      <button onClick={() => revoke()}>revoke</button>
      <button onClick={() => reset()}>reset</button>
    </div>
  );
}

function readStored(): ConsentRecord | null {
  const raw = window.localStorage.getItem(DEFAULT_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as ConsentRecord) : null;
}

function seedGrantedRecord() {
  const record: ConsentRecord = {
    categories: { default: 'granted' },
    policyVersion: '1',
    timestamp: new Date().toISOString(),
    method: 'dialog',
  };
  window.localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(record));
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

describe('AC5 — revoke', () => {
  test('revoke() flips status to denied, unmounts tracker children, and updates storage', async () => {
    const user = userEvent.setup();
    seedGrantedRecord();

    render(
      <CipaProvider>
        <Controls />
        <CipaTracking>
          <TrackerChild />
        </CipaTracking>
      </CipaProvider>,
    );

    // Granted record hydrated: tracker mounted, no dialog.
    expect(document.body.contains(screen.getByTestId('tracker'))).toBe(true);
    expect(dialogIsShown()).toBe(false);

    await user.click(screen.getByText('revoke'));

    expect(screen.queryByTestId('tracker')).toBeNull();

    const stored = readStored();
    expect(stored?.categories.default).toBe('denied');
    expect(stored?.method).toBe('api');
  });
});

describe('reset()', () => {
  test('reset() clears the stored record, status returns to pending, and the dialog re-appears', async () => {
    const user = userEvent.setup();
    seedGrantedRecord();

    render(
      <CipaProvider>
        <Controls />
        <CipaTracking>
          <TrackerChild />
        </CipaTracking>
      </CipaProvider>,
    );

    expect(document.body.contains(screen.getByTestId('tracker'))).toBe(true);
    expect(dialogIsShown()).toBe(false);

    await user.click(screen.getByText('reset'));

    expect(window.localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
    expect(screen.queryByTestId('tracker')).toBeNull();
    expect(dialogIsShown()).toBe(true);
  });
});

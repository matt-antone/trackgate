import type { ComponentProps, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentProvider } from '../src/ConsentProvider';
import { ConsentGate } from '../src/ConsentGate';
import { useConsent } from '../src/useConsent';
import { DEFAULT_STORAGE_KEY } from '../src/storage';
import type { ConsentRecord } from '../src/types';

/** Shared no-op tracker child: a plain div a test can assert mounted/unmounted. */
export function TrackerChild() {
  return <div data-testid="tracker">tracking</div>;
}

export function readStored(): ConsentRecord | null {
  const raw = window.localStorage.getItem(DEFAULT_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as ConsentRecord) : null;
}

export function dialogIsShown(): boolean {
  return screen.queryByText('Accept') !== null;
}

export function makeRecord(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    categories: { default: 'granted' },
    policyVersion: '1',
    timestamp: new Date().toISOString(),
    method: 'dialog',
    recordId: 'test-record-id',
    ...overrides,
  };
}

/** Builds a record via makeRecord() and writes it to localStorage under DEFAULT_STORAGE_KEY. */
export function seedRecord(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  const record = makeRecord(overrides);
  window.localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(record));
  return record;
}

/** Renders <ConsentProvider {...providerProps}><ConsentGate>{child}</ConsentGate></ConsentProvider>. */
export function renderGated(
  providerProps: ComponentProps<typeof ConsentProvider> = {},
  child: ReactNode = <TrackerChild />,
) {
  return render(
    <ConsentProvider {...providerProps}>
      <ConsentGate>{child}</ConsentGate>
    </ConsentProvider>,
  );
}

/** Test-only harness exposing revoke() via a button, since revoke isn't a JSX prop. */
export function RevokeButton() {
  const { revoke } = useConsent();
  return (
    <button type="button" onClick={() => revoke()}>
      Revoke
    </button>
  );
}

export async function acceptDialog() {
  const user = userEvent.setup();
  const acceptButton = await screen.findByRole('button', { name: 'Accept' });
  await user.click(acceptButton);
}

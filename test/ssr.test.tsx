// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ConsentProvider, ConsentGate } from '../src';

describe('SSR safety (AC8)', () => {
  it('renders on the server without throwing, without touching storage, and without dialog/tracker markup', () => {
    expect(typeof window).toBe('undefined');

    let html = '';
    expect(() => {
      html = renderToString(
        <ConsentProvider>
          <div data-testid="app">app shell</div>
          <ConsentGate>
            <div data-testid="tracker">tracker content</div>
          </ConsentGate>
        </ConsentProvider>,
      );
    }).not.toThrow();

    // App content (outside the consent gate) always renders.
    expect(html).toContain('app shell');

    // No tracker markup: consent is pending on the server, so the gated
    // child must never appear in the SSR output.
    expect(html).not.toContain('tracker content');
    expect(html).not.toContain('data-testid="tracker"');

    // No dialog markup: `hydrated` starts false, and the effect that would
    // flip it never runs during renderToString.
    expect(html).not.toContain('<dialog');
    expect(html).not.toContain('Accept');
    expect(html).not.toContain('Decline');
    expect(html).not.toContain('We use tracking technologies');
  });
});

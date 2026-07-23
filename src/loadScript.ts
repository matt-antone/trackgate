/**
 * Inject a `<script>` when called. Intended for use inside gated components so
 * non-React vendor snippets only load after consent.
 *
 * Idempotency guard: when `attrs['data-cipa-id']` is present, checks the DOM for
 * an existing `script[data-cipa-id="<id>"]` and no-ops if found. This is the
 * single dedupe point used by ScriptTracker; direct calls without the attr are
 * not deduped. Returns the element (existing or new) or null in SSR.
 */
export function loadConsentedScript(
  src: string,
  attrs?: Record<string, string>,
): HTMLScriptElement | null {
  if (typeof document === 'undefined') return null;

  const cipaId = attrs?.['data-cipa-id'];
  if (cipaId) {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-cipa-id="${cipaId}"]`,
    );
    if (existing) return existing;
  }

  const script = document.createElement('script');
  script.src = src;
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) {
      script.setAttribute(name, value);
    }
  }
  document.head.appendChild(script);
  return script;
}

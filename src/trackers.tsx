import { useEffect } from 'react';
import { CipaTracking } from './CipaTracking';
import { loadConsentedScript } from './loadScript';
import { isDev } from './env';
import type { TrackerDefinition } from './types';

function hasComponent(
  def: TrackerDefinition,
): def is Extract<TrackerDefinition, { component: unknown }> {
  return 'component' in def;
}

interface ScriptTrackerProps {
  id: string;
  src: string;
  attrs?: Record<string, string>;
}

function ScriptTracker({ id, src, attrs }: ScriptTrackerProps) {
  useEffect(() => {
    loadConsentedScript(src, { ...attrs, 'data-cipa-id': id });
    // No cleanup: idempotency is DOM-level (data-cipa-id guard). Removing the
    // script on unmount would break StrictMode's mount→cleanup→mount cycle and
    // multi-instance reuse. Scripts persist after revoke by design (see
    // reloadOnRevoke); this is documented.
  }, [id, src, attrs]);
  return null;
}

interface CipaTrackerListProps {
  trackers: TrackerDefinition[];
  reloadOnRevoke: boolean;
}

/**
 * Renders each tracker definition through the consent gate for its category.
 * Dedupes by `id` (first wins) before mapping, so we never rely on React's
 * duplicate-key behavior.
 */
export function CipaTrackerList({ trackers, reloadOnRevoke }: CipaTrackerListProps) {
  const seen = new Set<string>();
  const deduped: TrackerDefinition[] = [];
  let hasScript = false;

  for (const def of trackers) {
    if (seen.has(def.id)) {
      if (isDev) {
        console.warn(
          `[cipa-provider] Duplicate tracker id "${def.id}" ignored (first definition wins).`,
        );
      }
      continue;
    }
    seen.add(def.id);
    deduped.push(def);
    if (!hasComponent(def)) hasScript = true;
  }

  useEffect(() => {
    if (isDev && hasScript && !reloadOnRevoke) {
      console.warn(
        '[cipa-provider] Tracker list contains script (src) entries but reloadOnRevoke ' +
          'is not set. Injected scripts keep executing after revoke — enable ' +
          'reloadOnRevoke to hard-reload and kill already-loaded vendor JS.',
      );
    }
  }, [hasScript, reloadOnRevoke]);

  return (
    <>
      {deduped.map((def) => {
        const category = def.category ?? 'default';
        if (hasComponent(def)) {
          const Component = def.component;
          return (
            <CipaTracking key={def.id} category={category}>
              <Component />
            </CipaTracking>
          );
        }
        return (
          <CipaTracking key={def.id} category={category}>
            <ScriptTracker id={def.id} src={def.src} attrs={def.attrs} />
          </CipaTracking>
        );
      })}
    </>
  );
}

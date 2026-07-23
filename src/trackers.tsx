import { useEffect } from 'react';
import { ConsentGate } from './ConsentGate';
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
    loadConsentedScript(src, { ...attrs, 'data-trackgate-id': id });
    // No cleanup: idempotency is DOM-level (data-trackgate-id guard). Removing the
    // script on unmount would break StrictMode's mount→cleanup→mount cycle and
    // multi-instance reuse. Scripts persist after revoke by design (see
    // reloadOnRevoke); this is documented.
  }, [id, src, attrs]);
  return null;
}

interface ConsentTrackerListProps {
  trackers: TrackerDefinition[];
  reloadOnRevoke: boolean;
}

/**
 * Renders each tracker definition through the consent gate for its category.
 * Dedupes by `id` (first wins) before mapping, so we never rely on React's
 * duplicate-key behavior.
 */
export function ConsentTrackerList({ trackers, reloadOnRevoke }: ConsentTrackerListProps) {
  const seen = new Set<string>();
  const deduped: TrackerDefinition[] = [];
  let hasScript = false;

  for (const def of trackers) {
    if (seen.has(def.id)) {
      if (isDev) {
        console.warn(
          `[trackgate] Duplicate tracker id "${def.id}" ignored (first definition wins).`,
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
        '[trackgate] Tracker list contains script (src) entries but reloadOnRevoke ' +
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
            <ConsentGate key={def.id} category={category}>
              <Component />
            </ConsentGate>
          );
        }
        return (
          <ConsentGate key={def.id} category={category}>
            <ScriptTracker id={def.id} src={def.src} attrs={def.attrs} />
          </ConsentGate>
        );
      })}
    </>
  );
}

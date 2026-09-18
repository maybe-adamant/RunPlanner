import { catalog } from '@run-planner/hades2-catalog';
import { decodeProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';

export type RawCheckpoint = Parameters<typeof decodeProjectDocument>[0];

export interface CheckpointArtifact {
  readonly raw: RawCheckpoint;
  readonly load: () => ProjectDocument;
}

/**
 * Checkpoints remain baseline schema inputs until the single closure migration.
 * Test loading adapts only their missing route-context fields to the catalog's
 * ordinary preset, without modifying or publishing the fixture wire files.
 */
function currentModelCheckpoint(raw: RawCheckpoint): RawCheckpoint {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const document = raw as Record<string, unknown>;
  const route = document.route;
  if (route === null || typeof route !== 'object' || Array.isArray(route)) return raw;
  const authoredRoute = route as Record<string, unknown>;
  if ('itineraryBiomeKeys' in authoredRoute) return raw;
  const routeKey = authoredRoute.routeKey;
  const declaration = typeof routeKey === 'string' ? catalog.routes.byKey[routeKey] : undefined;
  if (declaration === undefined || (routeKey !== 'Underworld' && routeKey !== 'Surface'))
    return raw;
  return {
    ...document,
    route: {
      ...authoredRoute,
      itineraryBiomeKeys: declaration.biomeKeys,
    },
  };
}

export function checkpointArtifact(raw: RawCheckpoint): CheckpointArtifact {
  let cached: ProjectDocument | undefined;
  return Object.freeze({
    raw,
    load: () => {
      if (cached === undefined) {
        cached = decodeProjectDocument(currentModelCheckpoint(raw), catalog);
      }
      return cached;
    },
  });
}

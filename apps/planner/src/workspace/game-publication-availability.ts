import { routeInitialProfile } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

const FRESH_FILE_UNAVAILABLE =
  'Fresh File plans can’t be sent to the game yet: the game module doesn’t support this route.';

/**
 * Publication availability for routes whose game-module support is still in
 * development. Returns the reason sending is unavailable, or null.
 */
export function gamePublicationRestriction(catalog: Catalog, routeKey: string): string | null {
  return routeInitialProfile(catalog, routeKey).kind === 'freshFile'
    ? FRESH_FILE_UNAVAILABLE
    : null;
}

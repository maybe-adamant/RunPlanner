import type { AuthoredRoutePlan } from './model';

/** The route content a Dream itinerary replacement keeps or discards per biome. */
export type DreamItineraryReplacementRoute = Pick<
  AuthoredRoutePlan,
  'itineraryBiomeKeys' | 'biomes' | 'resourcePlacements' | 'practiceStart' | 'draft'
>;

/**
 * Positions of the current itinerary that keep their biome: those matching the new itinerary
 * position by position from its start. Every later position is replaced.
 */
export function dreamItineraryKeptBiomeCount(
  currentBiomeKeys: readonly string[],
  itineraryBiomeKeys: readonly string[],
): number {
  const firstChanged = currentBiomeKeys.findIndex(
    (biomeKey, index) => itineraryBiomeKeys[index] !== biomeKey,
  );
  return firstChanged < 0 ? currentBiomeKeys.length : firstChanged;
}

/** Itinerary biomes whose authored content ReplaceDreamItinerary would discard, in route order. */
export function dreamItineraryReplacementDroppedBiomeKeys(
  route: DreamItineraryReplacementRoute,
  itineraryBiomeKeys: readonly string[],
): readonly string[] {
  const keptCount = dreamItineraryKeptBiomeCount(route.itineraryBiomeKeys, itineraryBiomeKeys);
  const draft = route.draft;
  const configured = new Set<string>([
    ...route.biomes.map((biome) => biome.biomeKey),
    ...Object.keys(draft.storyNpcByBiome),
    ...Object.keys(draft.fieldNpcsByBiome),
    ...Object.keys(draft.rackKeepsakeByBiome),
    ...Object.keys(draft.godBoonsByBiome ?? {}),
    ...Object.values(route.resourcePlacements).flatMap((placement) =>
      placement === null ? [] : [placement.biomeKey],
    ),
    ...(route.practiceStart === undefined ? [] : [route.practiceStart.biomeKey]),
  ]);
  return Object.freeze(
    route.itineraryBiomeKeys.slice(keptCount).filter((biomeKey) => configured.has(biomeKey)),
  );
}

import type { FindingLocation } from './evaluationProjection';

/** A place as a reference from elsewhere names it, its own name on hover where shown. */
export interface PlaceName {
  readonly text: string;
  /** The place's own name, where the text is its Location. */
  readonly hint?: string;
}

/**
 * A place referenced from elsewhere: by its run-wide Location (the game's word for a room's
 * place in the run, unique across biomes), its own name on hover; a place the run has not
 * numbered goes by its own name. The biome is never prefixed.
 */
export function placeName(name: string, depth: number | undefined): PlaceName {
  return Object.freeze(
    depth === undefined ? { text: name } : { text: `Location ${depth}`, hint: name },
  );
}

/** Where a finding or the walk's stop is, as every reference names it. */
export function locationName(location: FindingLocation): PlaceName {
  switch (location.kind) {
    case 'route':
      return placeName('Route', undefined);
    // Outside any biome, a place is the Loadout.
    case 'loadout':
    case 'project':
      return placeName('Loadout', undefined);
    // A biome's unchosen start has no Location.
    case 'biome':
      return placeName(location.biomeLabel, undefined);
    case 'hub':
      return placeName('Hub', location.depth);
    case 'step':
      return placeName(location.label, location.depth);
    case 'room':
      return placeName(location.room.label, location.depth);
  }
}

/** The place in words, its own name after its Location, as an accessible name reads it. */
export function placeNameLabel(name: PlaceName): string {
  return name.hint === undefined ? name.text : `${name.text} · ${name.hint}`;
}

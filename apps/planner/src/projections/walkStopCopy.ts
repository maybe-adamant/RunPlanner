import type { FindingLocation } from './evaluationProjection';

/** A rail stop past the walk's stop, in its accessible status. */
export const notReachedLabel = 'Not reached';

/** Where a stop notice is shown, against where the walk stops. */
export type StopNoticeAt =
  /** The room the walk stopped in at its Overview. */
  | { readonly kind: 'overview' }
  /** A Ship phase waiting on an earlier phase of its room. */
  | { readonly kind: 'phase'; readonly phaseLabel: string }
  /** A room or Hub past the stop, in the biome named. */
  | { readonly kind: 'past'; readonly place: FindingLocation; readonly biomeKey: string };

function placeName(place: FindingLocation, biomeKey: string): string {
  const elsewhere = 'biomeKey' in place && place.biomeKey !== biomeKey;
  const inBiome = (name: string) =>
    elsewhere && 'biomeLabel' in place ? `${name} in ${place.biomeLabel}` : name;
  switch (place.kind) {
    case 'route':
      return 'the Route';
    case 'loadout':
      return 'the Loadout';
    case 'project':
      return 'the plan settings';
    case 'biome':
      return elsewhere ? `the start of ${place.biomeLabel}` : 'the biome start';
    case 'hub':
      return inBiome('the Hub');
    case 'step':
      return inBiome(place.label);
    case 'room':
      return inBiome(place.room.label);
  }
}

/** The stop notice's one sentence: where the plan stops. */
export function stopNoticeSentence(at: StopNoticeAt): string {
  switch (at.kind) {
    case 'overview':
      return "The plan stops at this room's Overview.";
    case 'phase':
      return `The plan stops at ${at.phaseLabel}.`;
    case 'past':
      return `The plan stops at ${placeName(at.place, at.biomeKey)}.`;
  }
}

/** The stop notice's link to where the plan stops. */
export const goToStopLabel = 'Go there';

/** A row whose room needs a required action before it; named by its Timeline row. */
export function requiredFirstTitle(actionLabel: string | undefined): string {
  return `${actionLabel ?? 'A required action'} must come first`;
}

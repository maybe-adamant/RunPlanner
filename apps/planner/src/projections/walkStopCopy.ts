import type { FindingLocation } from './evaluationProjection';

/** A rail stop past the walk's stop, in its accessible status. */
export const notReachedLabel = 'Not reached';

/** Where a stop notice is shown, against where the walk stops. */
export type StopNoticeAt =
  /** The room the walk stopped in at its Overview. */
  | { readonly kind: 'overview' }
  /** A Ship phase waiting on an earlier phase of its room. */
  | { readonly kind: 'phase'; readonly phaseLabel: string }
  /** A room or Hub past the stop. */
  | { readonly kind: 'past'; readonly place: FindingLocation };

/** The stop notice's words before its link. */
export const stopNoticeLead = 'Plan stopped at';

/** The stop notice's link: the place the plan stops, by the location number the rail shows. */
export function stopNoticeLink(at: StopNoticeAt): string {
  switch (at.kind) {
    case 'overview':
      return 'Overview';
    case 'phase':
      return `${at.phaseLabel} timeline`;
    case 'past': {
      const place = at.place;
      switch (place.kind) {
        case 'route':
        case 'loadout':
        case 'project':
          return 'Loadout';
        case 'room':
        case 'step':
          return place.depth === undefined
            ? place.kind === 'room'
              ? place.room.label
              : place.label
            : `Location ${place.depth}`;
        // The rail numbers neither the Hub nor a biome's unchosen start.
        case 'hub':
          return 'Hub';
        case 'biome':
          return place.biomeLabel;
      }
    }
  }
}

/** A row whose room needs a required action before it; named by its Timeline row. */
export function requiredFirstTitle(actionLabel: string | undefined): string {
  return `${actionLabel ?? 'A required action'} must come first`;
}

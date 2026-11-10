import type { FindingLocation } from './evaluationProjection';
import { locationName, placeName, type PlaceName } from './placeName';

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

/** The stop notice's link: the place the plan stops, as every reference names it. */
export function stopNoticeLink(at: StopNoticeAt): PlaceName {
  switch (at.kind) {
    case 'overview':
      return placeName('Overview', undefined);
    case 'phase':
      return placeName(`${at.phaseLabel} timeline`, undefined);
    case 'past':
      return locationName(at.place);
  }
}

/** A row whose room needs a required action before it; named by its Timeline row. */
export function requiredFirstTitle(actionLabel: string | undefined): string {
  return `${actionLabel ?? 'A required action'} must come first`;
}

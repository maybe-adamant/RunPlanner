import type { HubAction } from '@run-planner/engine/authored-project';

/**
 * Builds a Hub action order from room visits, placing the fountain use after
 * `fountainAfterVisits` visits, or leaving it unplanned when that is null.
 */
export function hubVisitActions(
  hubSlotKeys: readonly string[],
  fountainAfterVisits: number | null = 0,
): readonly HubAction[] {
  const visits = hubSlotKeys.map((hubSlotKey): HubAction => ({ kind: 'roomVisit', hubSlotKey }));
  if (fountainAfterVisits === null) return visits;
  return [
    ...visits.slice(0, fountainAfterVisits),
    { kind: 'useFountain' },
    ...visits.slice(fountainAfterVisits),
  ];
}

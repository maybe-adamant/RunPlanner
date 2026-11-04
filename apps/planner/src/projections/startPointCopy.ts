import type { RunStartPoint } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { StartPointPublicationBlock } from '@run-planner/engine/execution-plan';
import type { StartInstallationUnavailableReason } from '@run-planner/engine/simulation';

export const START_POINT_LABELS = Object.freeze({
  opening: 'Opening',
  preboss: 'Preboss',
  boss: 'Boss',
} as const);

/** A start point as the editor names it, such as "Thessaly · Boss". */
export function startPointLabel(catalog: Catalog, startPoint: Omit<RunStartPoint, 'gold'>): string {
  const biome = catalog.biomes.byKey[startPoint.biomeKey]?.label ?? startPoint.biomeKey;
  return `${biome} · ${START_POINT_LABELS[startPoint.point]}`;
}

/** Why a start point cannot start the run, as the editor and publish gate say it. */
export function describeStartPointUnavailable(reason: StartInstallationUnavailableReason): string {
  switch (reason.kind) {
    case 'notOnItinerary':
      return 'This biome is not on the route.';
    case 'routeStart':
      return 'The run already starts here.';
    case 'notReached':
      return 'Plan the route up to this point first.';
    case 'afterPlanEnd':
      return 'The plan ends before this point.';
  }
}

/** Why the authored start point keeps the plan from being sent. */
export function describeStartPointBlocked(block: StartPointPublicationBlock): string {
  return `The start point can’t start this run. ${describeStartPointUnavailable(block.reason)}`;
}

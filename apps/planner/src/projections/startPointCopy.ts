import type { StartPointPublicationBlock } from '@run-planner/engine/execution-plan';
import type {
  StartInstallationFamily,
  StartInstallationUnavailableReason,
} from '@run-planner/engine/simulation';

const FAMILY_LABELS: Readonly<Record<StartInstallationFamily, string>> = Object.freeze({
  equipment: 'equipment',
  traits: 'boons and traits',
  chaos: 'Chaos effects',
  keepsake: 'keepsake',
  arcana: 'Arcana',
  fear: 'Fear',
  maxStats: 'max Health or Magick',
  stygianWell: 'Well of Charon items',
  hermesDeliveries: 'Hermes deliveries',
  hex: 'Hex progress',
  rewardPriorities: 'reward priorities',
  runRecords: 'run records',
  biomeRecords: 'biome records',
  counters: 'progress counters',
});

/** Why a start point cannot start the run, as the editor and publish gate say it. */
export function describeStartPointUnavailable(reason: StartInstallationUnavailableReason): string {
  switch (reason.kind) {
    case 'notOnItinerary':
      return 'This biome is not on the route.';
    case 'routeStart':
      return 'The run already starts here.';
    case 'notReached':
      return 'Plan the route up to this point first.';
    case 'branchesDisagree':
      return `The planned outcomes before this point differ in ${reason.families
        .map((family) => FAMILY_LABELS[family])
        .join(', ')}.`;
  }
}

/** Why the authored start point keeps the plan from being sent. */
export function describeStartPointBlocked(block: StartPointPublicationBlock): string {
  return `The start point can’t start this run. ${describeStartPointUnavailable(block.reason)}`;
}

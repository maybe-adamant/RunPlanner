import type { ProjectDocument, RoomOccurrence } from '../model';
import { actionsAfterLeftChallengeSwitch } from '../acquisition/challenge-switch';
import { failCommand } from './contract';
import type { ProjectCommand } from './types';

/** Commands that place an action at an authored position. */
const PLACING_COMMANDS = new Set<ProjectCommand['kind']>([
  'InsertRoomAction',
  'MoveRoomAction',
  'InsertReroll',
  'InsertStygianWellReroll',
  'InsertPurgingPoolReroll',
  'SellPurgingPoolRollSlot',
]);

function pressedLast(occurrence: RoomOccurrence): RoomOccurrence {
  const order = occurrence.roomActions.order;
  const press = order.find((reference) => reference.kind === 'interactChallengeSwitch')!;
  return Object.freeze({
    ...occurrence,
    roomActions: Object.freeze({
      ...occurrence.roomActions,
      order: Object.freeze([...order.filter((reference) => reference !== press), press]),
    }),
  });
}

/**
 * A left switch press is its room's last action. A command that places an
 * action after it is refused; any other edit that leaves actions after a
 * press that was last, or that makes a press left, keeps the press last. A
 * preserved order with actions after a left press is retained otherwise.
 */
export function reconcileLeftChallengeSwitchPresses(
  before: ProjectDocument,
  after: ProjectDocument,
  command: ProjectCommand,
): ProjectDocument {
  let changed = false;
  const biomes = after.route.biomes.map((plan) => {
    const topology = plan.topology;
    if (topology === null) return plan;
    const prior = new Map(
      (
        before.route.biomes.find((candidate) => candidate.biomeKey === plan.biomeKey)?.topology
          ?.occurrences ?? []
      ).map((occurrence) => [occurrence.occurrenceId, occurrence]),
    );
    let topologyChanged = false;
    const occurrences = topology.occurrences.map((occurrence) => {
      const following = actionsAfterLeftChallengeSwitch(occurrence);
      if (following === undefined || following === 0) return occurrence;
      const previous = prior.get(occurrence.occurrenceId);
      const previousFollowing =
        previous === undefined ? undefined : actionsAfterLeftChallengeSwitch(previous);
      if (previousFollowing !== undefined && following <= previousFollowing) return occurrence;
      // A placing command authored this position while the fight was already left.
      if (previous?.challengeSwitch?.outcome === 'left' && PLACING_COMMANDS.has(command.kind))
        failCommand(command, 'nothing follows leaving the switch fight: it leaves the room');
      topologyChanged = true;
      return pressedLast(occurrence);
    });
    if (!topologyChanged) return plan;
    changed = true;
    return Object.freeze({
      ...plan,
      topology: Object.freeze({ ...topology, occurrences: Object.freeze(occurrences) }),
    });
  });
  if (!changed) return after;
  return Object.freeze({
    ...after,
    route: Object.freeze({ ...after.route, biomes: Object.freeze(biomes) }),
  });
}

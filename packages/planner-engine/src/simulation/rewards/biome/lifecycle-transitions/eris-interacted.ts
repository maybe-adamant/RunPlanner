import type { Catalog } from '../../../../catalog-schema';
import {
  createRoomFeatureAddress,
  semanticAddressKey,
  type RoomActionSemanticAddress,
} from '../../../../authored-project/addresses';
import { routeErisHost } from '../../../../authored-project/route-profile';
import type { HistoryEvent } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion, type FindingChronology } from '../../../finding-regions';
import { replaceSimulationTraitHistory } from '../../../state/transitions';
import { recordFixedAcquisitionTraitGrant } from '../../../traits/offers';
import type { RewardBranchState } from '../../branch-primitives';
import { rewardFinding } from '../../findings';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { LifecycleFinding } from './types';

export interface ErisInteractedTransition {
  readonly branches: readonly RewardBranchState[];
}

function curseGrantOwnerKey(branch: RewardBranchState, curseTraitKey: string): string | undefined {
  const grant = branch.state.traitHistory.events.find(
    (event) => event.kind === 'directTraitGrant' && event.traitKey === curseTraitKey,
  );
  return grant === undefined ? undefined : semanticAddressKey(grant.owner);
}

function cursed(
  room: CanonicalAuthoredRoom,
  curseTraitKey: string,
  branches: readonly RewardBranchState[],
): boolean | undefined {
  const cursedBefore = branches.map(
    (branch) => branch.state.traitHistory.equippedTraits[curseTraitKey] !== undefined,
  );
  if (cursedBefore.some((value) => value !== cursedBefore[0]))
    throw new BiomeRewardSimulationContractError(
      `${room.gameName} branches disagree on an earlier Eris curse`,
    );
  return cursedBefore[0];
}

/**
 * Eris spawns on room entry only while the hero lacks her curse, so an observed
 * spawn after an earlier curse is an Overview fact of the room.
 */
export function erisSpawnFindings(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  branches: readonly RewardBranchState[],
  chronology: FindingChronology,
): readonly LifecycleFinding[] {
  const host = routeErisHost(catalog.rooms.byKey[room.gameName], room.origin.routeKey);
  if (
    host === undefined ||
    !room.roomActionRoster.rows.some(
      (row) => !row.stale && row.reference.kind === 'interactEris',
    ) ||
    cursed(room, host.curseTraitKey, branches) !== true
  )
    return [];
  const owner = createRoomFeatureAddress(room.origin, { kind: 'erisSpawn' });
  return [
    Object.freeze({
      finding: rewardFinding('erisSpawnUnavailable', owner, {
        reason: 'alreadyCursed',
        curseTraitKey: host.curseTraitKey,
      }),
      region: ownerRegion(owner),
      chronology,
    }),
  ];
}

/**
 * Talking to Eris applies her curse trait (`ApplyErisCurse`); an already
 * cursed hero met no spawned Eris, so the talk curses nothing.
 */
export function applyErisInteractedTransition(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'erisInteracted' }>,
  room: CanonicalAuthoredRoom | undefined,
  branches: readonly RewardBranchState[],
): ErisInteractedTransition {
  const host =
    room === undefined
      ? undefined
      : routeErisHost(catalog.rooms.byKey[room.gameName], room.origin.routeKey);
  if (host === undefined)
    throw new BiomeRewardSimulationContractError(
      `${room?.gameName ?? 'unknown room'} reached an Eris interaction without a route host`,
    );
  if (cursed(room!, host.curseTraitKey, branches) === true) return Object.freeze({ branches });
  return Object.freeze({
    branches: Object.freeze(
      branches.map((branch) =>
        Object.freeze({
          ...branch,
          state: replaceSimulationTraitHistory(
            branch.state,
            recordFixedAcquisitionTraitGrant(
              catalog,
              branch.state.traitHistory,
              event.owner,
              event.sequence,
              'erisInteraction',
              host.curseTraitKey,
            ),
          ),
        }),
      ),
    ),
  });
}

/** Eris drops her gift only where this exact interaction applied the curse. */
export function erisGiftDropped(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  interaction: RoomActionSemanticAddress,
  branches: readonly RewardBranchState[],
): boolean {
  const host = routeErisHost(catalog.rooms.byKey[room.gameName], room.origin.routeKey);
  if (host === undefined) return false;
  const ownerKey = semanticAddressKey(interaction);
  const dropped = branches.map(
    (branch) => curseGrantOwnerKey(branch, host.curseTraitKey) === ownerKey,
  );
  if (dropped.some((value) => value !== dropped[0]))
    throw new BiomeRewardSimulationContractError(
      `${room.gameName} branches disagree on the Eris gift`,
    );
  return dropped[0] === true;
}

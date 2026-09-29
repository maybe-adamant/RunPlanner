import type { Catalog } from '../../../../catalog-schema';
import {
  semanticAddressKey,
  type RoomActionSemanticAddress,
} from '../../../../authored-project/addresses';
import { routeErisHost } from '../../../../authored-project/route-profile';
import type { HistoryEvent } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { ownerRegion } from '../../../finding-regions';
import { replaceSimulationTraitHistory } from '../../../state/transitions';
import { recordFixedAcquisitionTraitGrant } from '../../../traits/offers';
import type { RewardBranchState } from '../../branch-primitives';
import { rewardFinding } from '../../findings';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { LifecycleFinding } from './types';

export interface ErisInteractedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly LifecycleFinding[];
}

function curseGrantOwnerKey(branch: RewardBranchState, curseTraitKey: string): string | undefined {
  const grant = branch.state.traitHistory.events.find(
    (event) => event.kind === 'directTraitGrant' && event.traitKey === curseTraitKey,
  );
  return grant === undefined ? undefined : semanticAddressKey(grant.owner);
}

/**
 * Talking to Eris applies her curse trait (`ApplyErisCurse`). Native spawns
 * her only while the hero lacks it, so a later observation curses nothing.
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
  const cursedBefore = branches.map(
    (branch) => branch.state.traitHistory.equippedTraits[host.curseTraitKey] !== undefined,
  );
  if (cursedBefore.some((cursed) => cursed !== cursedBefore[0]))
    throw new BiomeRewardSimulationContractError(
      `${room!.gameName} branches disagree on an earlier Eris curse`,
    );
  if (cursedBefore[0] === true)
    return Object.freeze({
      branches,
      findings: Object.freeze([
        Object.freeze({
          finding: rewardFinding('erisSpawnUnavailable', event.owner, {
            reason: 'alreadyCursed',
            curseTraitKey: host.curseTraitKey,
          }),
          region: ownerRegion(event.owner),
          chronology: Object.freeze({
            kind: 'history' as const,
            sequence: event.sequence,
            boundary: 'at' as const,
          }),
        }),
      ]),
    });
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
    findings: Object.freeze([]),
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

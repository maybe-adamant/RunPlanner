import type { RoomDeclaration } from '../../catalog-schema';
import type { EnteredRewardStoreHistoryPolicy } from '../../reward-kernel/bindings';
import type { RoomLifecycleExecutionInput } from '../lifecycle';
import type { ResolvedEncounterPhase } from '../encounters/model';
import { scopeRoomActionRoster } from '../room-actions';
import { declaredEnteredStoreKey } from '../rewards/biome/reward-store-support';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubRoom,
  CanonicalLocalVisitRoom,
} from '../materialization';

export type CanonicalLifecycleRoom =
  CanonicalAuthoredRoom | CanonicalHubRoom | CanonicalLocalVisitRoom;

export class HistoryLifecycleInputContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'HistoryLifecycleInputContractError';
  }
}

/**
 * The one owner of "which store did entering this room count with". Callers
 * that only hold a materialized room and its declaration use
 * `declaredEnteredStoreKey`; this wrapper adds the lifecycle-only Clockwork
 * goal exclusion and the contract error, which the support reader cannot
 * raise because it evaluates rooms that were never entered.
 */
function enteredStoreKey(
  policy: EnteredRewardStoreHistoryPolicy,
  room: CanonicalLifecycleRoom,
): string | undefined {
  if (room.kind === 'authored' && room.clockworkReward === 'goal') {
    return undefined;
  }
  if (room.kind !== 'authored') return policy.kind === 'fixed' ? policy.storeKey : undefined;
  const storeKey = declaredEnteredStoreKey(room, policy);
  if (storeKey === undefined && policy.kind === 'resolvedOffer') {
    throw new HistoryLifecycleInputContractError(
      `${room.gameName} requires resolved entered-store provenance`,
    );
  }
  return storeKey;
}

/**
 * Whether folding this room would hit the provenance invariant above. A boss
 * whose entered store resolves from the chosen offer has no provenance until
 * its door's store is authored, and until then it must not be folded at all —
 * the completeness pass owns that state and raises `batchRewardStoreMissing`
 * at the Preboss instead.
 *
 * This exists so composition can terminate its prefix at exactly the room the
 * completeness verdict stops at, without softening the invariant: any room the
 * fold does reach still fails hard if its provenance is missing. Q is the case
 * that forces it — its ordinary doors carry no store, so the boss door is the
 * only possible provenance, where G/O/P still inherit one from their Preboss.
 */
export function lacksEnteredStoreProvenance(
  room: CanonicalLifecycleRoom,
  declaration: RoomDeclaration,
): boolean {
  const policy = declaration.enteredRewardStoreHistory;
  if (policy.kind !== 'resolvedOffer') return false;
  if (room.kind !== 'authored') return false;
  if (room.clockworkReward === 'goal') return false;
  return declaredEnteredStoreKey(room, policy) === undefined;
}

export function createRoomLifecycleInput(
  room: CanonicalLifecycleRoom,
  encounterPhases: readonly ResolvedEncounterPhase[],
  declaration: RoomDeclaration,
): RoomLifecycleExecutionInput {
  const storeKey = enteredStoreKey(declaration.enteredRewardStoreHistory, room);
  const incomingReward = 'incomingReward' in room ? room.incomingReward : undefined;
  const requiredObjects = 'requiredObjects' in room ? room.requiredObjects : undefined;
  const rewardWheels = 'rewardWheels' in room ? room.rewardWheels : undefined;
  const activePhaseKeys = new Set(encounterPhases.map((phase) => phase.slotKey));
  const offerPointRewardStores =
    rewardWheels === undefined
      ? undefined
      : Object.freeze(
          Object.fromEntries(
            rewardWheels
              .filter((wheel) => activePhaseKeys.has(wheel.encounterPhaseKey))
              .map((wheel) => [wheel.wheelKey, wheel.storeKey]),
          ),
        );
  const roomActionRoster =
    room.kind !== 'authored'
      ? undefined
      : scopeRoomActionRoster(
          room.roomActionRoster,
          encounterPhases.map((phase) => phase.slotKey),
        );
  return {
    origin: room.origin,
    lifecycleProfileKey: room.lifecycleProfileKey,
    encounterEnvelopeKey: room.encounterEnvelopeKey,
    encounterPhases,
    counterEffects: room.counterEffects,
    ...(room.kind === 'authored' && room.hermesShrine !== undefined
      ? { surfaceShopPresent: true }
      : {}),
    ...(room.kind === 'authored' && room.stygianWell !== undefined
      ? { roomShopPresent: true }
      : {}),
    ...(requiredObjects === undefined ? {} : { requiredObjects }),
    ...(offerPointRewardStores === undefined ? {} : { offerPointRewardStores }),
    ...(roomActionRoster === undefined ? {} : { roomActionRoster }),
    ...(room.kind === 'authored' && room.hermesShrine !== undefined
      ? { hermesShrine: room.hermesShrine }
      : {}),
    ...(incomingReward === undefined
      ? {}
      : {
          producer: {
            lifecycleProfileKey: incomingReward.producerLifecycleKey,
            offer: incomingReward.offer,
            ...(incomingReward.acquisitionEnabled === undefined
              ? {}
              : { acquisitionEnabled: incomingReward.acquisitionEnabled }),
          },
        }),
    ...(storeKey === undefined ? {} : { enteredRewardStoreKey: storeKey }),
  };
}

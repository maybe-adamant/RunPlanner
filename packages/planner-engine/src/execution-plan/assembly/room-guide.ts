import { semanticAddressKey } from '../../authored-project/addresses';
import type { RoomActionReference } from '../../authored-project/model';
import { roomActionKey } from '../../authored-project/room-actions/key';
import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
import type { CompleteValidBiomeProjectEvaluation } from '../../simulation/evaluation/evaluation-products';
import type {
  ExecutionRoomGuideDescription,
  ExecutionRoomGuideRow,
  ExecutionTimelineTransaction,
} from '../model';

function rewardFor(transaction: ExecutionTimelineTransaction | undefined) {
  return transaction?.kind === 'acquisition' ? transaction.reward : undefined;
}

function descriptionFor(
  reference: RoomActionReference,
  room: CanonicalAuthoredRoom,
  transaction: ExecutionTimelineTransaction | undefined,
  timePieced: boolean,
): ExecutionRoomGuideDescription {
  switch (reference.kind) {
    case 'collectRequiredReward':
      return Object.freeze({ kind: reference.kind });
    case 'completeFieldsCage':
      return Object.freeze({ kind: reference.kind, phaseKey: reference.phaseKey });
    case 'interactIncomingReward':
    case 'interactLocalReward': {
      const reward = rewardFor(transaction);
      return Object.freeze({
        kind: reference.kind,
        ...(reward === undefined ? {} : { reward }),
        ...(timePieced ? { conversion: 'timePiece' as const } : {}),
      });
    }
    case 'chooseRewardWheel':
      return Object.freeze({ kind: reference.kind, wheelKey: reference.wheelKey });
    case 'interactWheelReward': {
      const reward = rewardFor(transaction);
      return Object.freeze({
        kind: reference.kind,
        wheelKey: reference.wheelKey,
        ...(reward === undefined ? {} : { reward }),
        ...(timePieced ? { conversion: 'timePiece' as const } : {}),
      });
    }
    case 'interactShopOffer': {
      const rewardType = rewardFor(transaction)?.rewardType;
      return Object.freeze({
        kind: reference.kind,
        offerKey: reference.offerKey,
        ...(rewardType === undefined ? {} : { rewardType }),
        ...(timePieced
          ? { conversion: 'timePiece' as const }
          : transaction?.kind === 'transformation' &&
              transaction.transformation.kind === 'anvilOfFates'
            ? { conversion: 'anvilOfFates' as const }
            : {}),
      });
    }
    case 'purchaseStygianWellOffer': {
      if (transaction?.kind === 'itemEffect')
        return Object.freeze({
          kind: reference.kind,
          generationKey: reference.generationKey,
          itemKey: transaction.itemKey,
          effect: transaction.effect,
        });
      if (
        transaction?.kind === 'transformation' &&
        transaction.transformation.kind === 'stygianWellTwist'
      )
        return Object.freeze({
          kind: reference.kind,
          generationKey: reference.generationKey,
          itemKey: transaction.transformation.sourceItemKey,
          twistResultKey: transaction.transformation.resultItemKey,
        });
      return Object.freeze({ kind: reference.kind, generationKey: reference.generationKey });
    }
    case 'sellPurgingPoolTrait': {
      const traitKey = room.purgingPool?.traitKeyBySlot[reference.slotKey];
      if (traitKey === undefined || traitKey === null)
        throw new Error(`missing active Pool trait ${reference.slotKey}`);
      return Object.freeze({
        kind: reference.kind,
        slotKey: reference.slotKey,
        traitKey,
      });
    }
    case 'interactEncounter':
    case 'interactGorgon':
      return Object.freeze({
        kind: reference.kind,
        phaseKey: reference.phaseKey,
        ...(room.encounters.encounterKeyByPhase[reference.phaseKey] === undefined
          ? {}
          : { encounterKey: room.encounters.encounterKeyByPhase[reference.phaseKey] }),
      });
    case 'interactAcquisitionEntry': {
      const reward = rewardFor(transaction);
      return Object.freeze({
        kind: reference.kind,
        ...(reward === undefined ? {} : { reward }),
        ...(timePieced ? { conversion: 'timePiece' as const } : {}),
        ...(transaction?.kind === 'transformation' &&
        transaction.transformation.kind === 'anvilOfFates'
          ? { conversion: 'anvilOfFates' as const }
          : {}),
      });
    }
    case 'useFountain':
      return Object.freeze({
        kind: reference.kind,
        ...(transaction?.kind === 'fountainUse' && transaction.aromaticPhialTarget !== undefined
          ? { aromaticPhialTarget: transaction.aromaticPhialTarget }
          : {}),
      });
    case 'interactKeepsakeRack':
      return Object.freeze({
        kind: reference.kind,
        ...(transaction?.kind === 'keepsakeChange' ? { keepsakeKey: transaction.keepsakeKey } : {}),
      });
  }
}

/**
 * Project the complete-valid room's existing action timeline without changing
 * transaction assembly, dependencies, obligations, or conformance.
 */
export function assembleExecutionRoomGuide(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
  transactions: readonly ExecutionTimelineTransaction[],
  selected: boolean,
): readonly ExecutionRoomGuideRow[] {
  if (!selected) return Object.freeze([]);
  const transactionsByOwner = new Map(
    transactions.map((transaction) => [transaction.owner, transaction]),
  );
  const timePieced = (actionOwner: (typeof room.roomActionRoster.rows)[number]['owner']) => {
    const source = actionOwner.kind === 'acquisitionRole' ? actionOwner.owner : actionOwner;
    const role = actionOwner.kind === 'acquisitionRole' ? actionOwner.acquisitionRole : undefined;
    return biome.rewards.branches.every((branch) =>
      branch.events.some(
        (event) =>
          event.kind === 'conversionToGold' &&
          semanticAddressKey(event.origin) === semanticAddressKey(source) &&
          (role === undefined || event.acquisition.role === role),
      ),
    );
  };
  return Object.freeze(
    room.roomLifecycleTimeline.entries.flatMap((entry) => {
      if (entry.kind !== 'action') return [];
      const owner = semanticAddressKey(entry.action.owner);
      const transaction = transactionsByOwner.get(owner);
      const key = roomActionKey(entry.action.reference);
      if (typeof key !== 'string' || key.length === 0)
        throw new Error(
          `room guide action lacks a stable key: ${JSON.stringify(entry.action.reference)}`,
        );
      return [
        Object.freeze({
          key,
          description: descriptionFor(
            entry.action.reference,
            room,
            transaction,
            timePieced(entry.action.owner),
          ),
          ...(transaction === undefined ? {} : { transactionOwner: transaction.owner }),
        }),
      ];
    }),
  );
}

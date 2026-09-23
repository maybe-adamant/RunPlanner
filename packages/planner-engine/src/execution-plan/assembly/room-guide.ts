import { semanticAddressKey } from '../../authored-project/addresses';
import type { RoomActionReference } from '../../authored-project/model';
import { roomActionKey } from '../../authored-project/room-actions/key';
import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
import type { CompleteValidBiomeProjectEvaluation } from '../../simulation/evaluation/evaluation-products';
import type {
  ExecutionReward,
  ExecutionRoomGuideDescription,
  ExecutionRoomGuideRow,
  ExecutionTimelineTransaction,
} from '../model';
import { executionRewardFromOffer } from './overview';
import { agreement } from './support';

function rewardFor(transaction: ExecutionTimelineTransaction | undefined) {
  return transaction?.kind === 'acquisition' ? transaction.reward : undefined;
}

function descriptionFor(
  reference: RoomActionReference,
  room: CanonicalAuthoredRoom,
  transaction: ExecutionTimelineTransaction | undefined,
  timePieced: boolean,
  convertedReward: ExecutionReward | undefined,
): ExecutionRoomGuideDescription {
  switch (reference.kind) {
    case 'collectRequiredReward':
      return Object.freeze({ kind: reference.kind });
    case 'completeFieldsCage': {
      const attachment = room.encounterPhases.find(
        (phase) => phase.slotKey === reference.phaseKey,
      )?.rewardAttachment;
      const localReward =
        attachment?.kind === 'localReward'
          ? room.localRewards?.find(
              (reward) =>
                reward.groupKey === attachment.groupKey && reward.slotKey === attachment.slotKey,
            )
          : undefined;
      if (localReward === undefined)
        throw new Error(`room guide cage ${reference.phaseKey} lacks its attached reward`);
      return Object.freeze({
        kind: reference.kind,
        phaseKey: reference.phaseKey,
        reward: executionRewardFromOffer(
          localReward.offer,
          localReward.producerLifecycleKey,
          localReward.resolvedStoreKey,
        ),
      });
    }
    case 'interactIncomingReward':
    case 'interactLocalReward': {
      const reward = rewardFor(transaction) ?? convertedReward;
      return Object.freeze({
        kind: reference.kind,
        ...(reward === undefined ? {} : { reward }),
        ...(timePieced ? { conversion: 'timePiece' as const } : {}),
      });
    }
    case 'chooseRewardWheel':
      return Object.freeze({ kind: reference.kind, wheelKey: reference.wheelKey });
    case 'interactWheelReward': {
      const reward = rewardFor(transaction) ?? convertedReward;
      return Object.freeze({
        kind: reference.kind,
        wheelKey: reference.wheelKey,
        ...(reward === undefined ? {} : { reward }),
        ...(timePieced ? { conversion: 'timePiece' as const } : {}),
      });
    }
    case 'interactShopOffer': {
      const rewardType = (rewardFor(transaction) ?? convertedReward)?.rewardType;
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
      const reward = rewardFor(transaction) ?? convertedReward;
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
  const timePiecedReward = (actionOwner: (typeof room.roomActionRoster.rows)[number]['owner']) => {
    const source = actionOwner.kind === 'acquisitionRole' ? actionOwner.owner : actionOwner;
    const role = actionOwner.kind === 'acquisitionRole' ? actionOwner.acquisitionRole : undefined;
    const events = biome.rewards.branches.map((branch) =>
      branch.events.find(
        (event) =>
          event.kind === 'conversionToGold' &&
          semanticAddressKey(event.origin) === semanticAddressKey(source) &&
          (role === undefined || event.acquisition.role === role),
      ),
    );
    if (!events.every((event) => event?.kind === 'conversionToGold')) return undefined;
    return agreement(
      events.map((event) =>
        executionRewardFromOffer(
          event.source.offer,
          event.source.producerLifecycleKey,
          event.source.resolvedStoreKey,
        ),
      ),
      `room guide Time Piece target ${semanticAddressKey(actionOwner)}`,
    );
  };
  return Object.freeze(
    room.roomLifecycleTimeline.entries.flatMap((entry) => {
      if (entry.kind !== 'action') return [];
      const owner = semanticAddressKey(entry.action.owner);
      const transaction = transactionsByOwner.get(owner);
      const convertedReward = timePiecedReward(entry.action.owner);
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
            convertedReward !== undefined,
            convertedReward,
          ),
          ...(transaction === undefined ? {} : { transactionOwner: transaction.owner }),
        }),
      ];
    }),
  );
}

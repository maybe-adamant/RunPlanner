import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import { roomActionKey } from '../../authored-project/room-action-key';
import { semanticAddressKey } from '../../authored-project/addresses';
import { assembleLifecycleWindow } from './lifecycle';
import type {
  ExecutionOccurrence,
  ExecutionWellRetainedEffectCorrelation,
  ExecutionTimeline,
  ExecutionTimelineDependency,
  ExecutionTimelineObligation,
  ExecutionTimelineTransaction,
} from '../model';

export function assembleTimelineRelations(
  transactions: readonly ExecutionTimelineTransaction[],
  room: CanonicalAuthoredRoom,
): ExecutionTimeline {
  const activeRows = room.roomActionRoster.rows.filter((row) => !row.stale && row.rank !== null);
  for (const row of activeRows) assembleLifecycleWindow(row.window);
  const dependencies: ExecutionTimelineDependency[] = [];
  const dependencyKeys = new Set<string>();
  const addDependency = (owner: string, afterOwner: string): void => {
    const key = `${owner}\u0000${afterOwner}`;
    if (dependencyKeys.has(key)) return;
    dependencyKeys.add(key);
    dependencies.push(Object.freeze({ owner, afterOwner }));
  };
  for (const row of activeRows) {
    const owner = semanticAddressKey(row.owner);
    for (const dependency of row.dependencies) {
      if (dependency.kind !== 'afterAction') continue;
      const afterRow = activeRows.find(
        (candidate) => candidate.key === roomActionKey(dependency.action),
      );
      if (afterRow === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} has a dependency without an active owner`,
        );
      const afterOwner = semanticAddressKey(afterRow.owner);
      addDependency(owner, afterOwner);
    }
  }
  for (const transaction of transactions) {
    if (transaction.kind !== 'acquisition' && transaction.kind !== 'shopPurchase') continue;
    for (const role of transaction.roles) {
      if (role.producer === undefined || role.producer.sourceOwner === transaction.sourceOwner)
        continue;
      const sourceTransaction = transactions.find(
        (
          candidate,
        ): candidate is Extract<
          ExecutionTimelineTransaction,
          { readonly kind: 'acquisition' | 'shopPurchase' }
        > =>
          (candidate.kind === 'acquisition' || candidate.kind === 'shopPurchase') &&
          candidate.sourceOwner === role.producer!.sourceOwner &&
          candidate.roles.some((candidateRole) => candidateRole.role === role.producer!.sourceRole),
      );
      if (sourceTransaction === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} has a generated acquisition without its source transaction`,
        );
      addDependency(transaction.owner, sourceTransaction.owner);
    }
  }
  const rankByOwner = new Map(
    activeRows.map((row) => [semanticAddressKey(row.owner), row.rank!] as const),
  );
  const transactionRank = (transaction: ExecutionTimelineTransaction): number =>
    rankByOwner.get(transaction.owner) ?? Number.MAX_SAFE_INTEGER;
  const nextTransaction = (
    transaction: ExecutionTimelineTransaction,
    predicate: (candidate: ExecutionTimelineTransaction) => boolean,
  ): ExecutionTimelineTransaction | undefined => {
    const rank = transactionRank(transaction);
    return transactions
      .filter((candidate) => transactionRank(candidate) > rank && predicate(candidate))
      .sort((left, right) => transactionRank(left) - transactionRank(right))[0];
  };
  const traitConsumer = (transaction: ExecutionTimelineTransaction, traitKey: string): boolean =>
    (transaction.kind === 'acquisition' || transaction.kind === 'shopPurchase') &&
    transaction.roles.some(
      (role) =>
        (role.traitOffer?.kind === 'traits' &&
          role.traitOffer.options.some(
            (option) =>
              option.key === traitKey || option.replacement?.replacedTraitKey === traitKey,
          )) ||
        role.levelResolution?.offeredTargets.includes(traitKey) === true ||
        role.levelResolution?.selectedTarget === traitKey,
    );
  const addNextConsumerDependency = (
    producer: ExecutionTimelineTransaction,
    consumer: ExecutionTimelineTransaction | undefined,
  ): void => {
    if (consumer !== undefined) addDependency(consumer.owner, producer.owner);
  };
  for (const transaction of transactions) {
    if (transaction.kind === 'keepsakeChange') {
      const fountain = nextTransaction(
        transaction,
        (candidate) => candidate.kind === 'fountainUse',
      );
      addNextConsumerDependency(transaction, fountain);
    } else if (transaction.kind === 'poolSale') {
      const consumer = nextTransaction(transaction, (candidate) =>
        traitConsumer(candidate, transaction.traitKey),
      );
      addNextConsumerDependency(transaction, consumer);
    } else if (transaction.kind === 'wellPurchase') {
      if (transaction.effect === 'extended') {
        addNextConsumerDependency(
          transaction,
          nextTransaction(
            transaction,
            (candidate) => candidate.kind === 'wellPurchase' && candidate.extendedDirectPurchase,
          ),
        );
      } else if (transaction.effect === 'yarn' || transaction.effect === 'hymn') {
        addNextConsumerDependency(
          transaction,
          nextTransaction(
            transaction,
            (candidate) =>
              (candidate.kind === 'acquisition' || candidate.kind === 'shopPurchase') &&
              candidate.roles.some((role) => role.traitOffer !== undefined),
          ),
        );
      }
    }
  }
  // Every published transaction is a consequential authored contact. Optional
  // rows are omitted before this stage when they are guidance-neutral; once a
  // row has a transaction, its owning checkpoint must be explicit as well.
  const obligations = transactions.map((transaction) => {
    const checkpoint =
      transaction.window.kind === 'postOutgoing'
        ? 'roomExit'
        : transaction.window.kind === 'encounterEnd'
          ? 'roomExit'
          : transaction.window.kind === 'standard' && transaction.window.phase === 'beforeCombat'
            ? 'outgoingGeneration'
            : 'exitUsable';
    return Object.freeze({ owner: transaction.owner, checkpoint }) as ExecutionTimelineObligation;
  });
  const streamOwners = new Map<string, string[]>();
  const addStream = (key: string, owner: string): void => {
    const owners = streamOwners.get(key) ?? [];
    if (!owners.includes(owner)) owners.push(owner);
    streamOwners.set(key, owners);
  };
  for (const transaction of transactions) {
    if (transaction.kind === 'acquisition' || transaction.kind === 'shopPurchase') {
      if (transaction.kind === 'shopPurchase') addStream('shopPurchases', transaction.owner);
      if (
        transaction.roles.some(
          (role) => role.traitOffer !== undefined || role.levelResolution !== undefined,
        )
      )
        addStream('traitHistory', transaction.owner);
      if (transaction.reward.rewardType === 'BlindBoxLoot')
        addStream('providerResolution', transaction.owner);
      if (transaction.roles.some((role) => role.producer !== undefined))
        addStream('rewardProduction', transaction.owner);
    } else if (transaction.kind === 'automatic') addStream('automaticEffects', transaction.owner);
    else if (transaction.kind === 'encounterInteraction')
      addStream('encounterOutcomes', transaction.owner);
    else if (transaction.kind === 'wellPurchase') addStream('wellEffects', transaction.owner);
  }
  return Object.freeze({
    transactions: Object.freeze(transactions),
    dependencies: Object.freeze(dependencies),
    obligations: Object.freeze(obligations),
    streams: Object.freeze(
      [...streamOwners].map(([key, owners]) =>
        Object.freeze({ key, owners: Object.freeze(owners) }),
      ),
    ),
  });
}

/** Correlate each retained Well effect with the first exact consumer in route order. */
export function assembleWellRetainedEffects(
  occurrences: readonly Pick<ExecutionOccurrence, 'id' | 'timeline'>[],
): readonly ExecutionWellRetainedEffectCorrelation[] {
  const transactions = occurrences.flatMap((occurrence) =>
    occurrence.timeline.transactions.map((transaction) =>
      Object.freeze({ occurrenceId: occurrence.id, transaction }),
    ),
  );
  const hasTraitOffer = (transaction: ExecutionTimelineTransaction): boolean =>
    (transaction.kind === 'acquisition' || transaction.kind === 'shopPurchase') &&
    transaction.roles.some((role) => role.traitOffer !== undefined);
  const result: ExecutionWellRetainedEffectCorrelation[] = [];
  for (let index = 0; index < transactions.length; index += 1) {
    const producer = transactions[index];
    if (producer?.transaction.kind !== 'wellPurchase') continue;
    const wellProducer = producer.transaction;
    const retainedEffect = wellProducer.effect;
    if (retainedEffect !== 'extended' && retainedEffect !== 'yarn' && retainedEffect !== 'hymn')
      continue;
    const consumer = transactions
      .slice(index + 1)
      .find((candidate) =>
        retainedEffect === 'extended'
          ? candidate.transaction.kind === 'wellPurchase' &&
            candidate.transaction.extendedDirectPurchase
          : hasTraitOffer(candidate.transaction),
      );
    if (consumer === undefined || consumer.occurrenceId === producer.occurrenceId) continue;
    result.push(
      Object.freeze({
        producerOwner: wellProducer.owner,
        effect: retainedEffect,
        consumerOwner: consumer.transaction.owner,
      }),
    );
  }
  return Object.freeze(result);
}

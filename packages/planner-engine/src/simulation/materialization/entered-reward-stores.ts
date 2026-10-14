import type { Catalog } from '../../catalog-schema';
import { sourceOfferPointStoreKey } from '../../authored-project/batchState';
import type { BiomeTopology, ExitDecision, OccurrenceId } from '../../authored-project/model';
import {
  additionalExitsForDecision,
  selectedExitContinuation,
} from '../../authored-project/topology/query';
import { finalSharedBatchStoreKey, orderedTargets } from './batch';
import { enteredRewardStore, type EnteredRewardStore } from './rooms/templates';
import type { CanonicalBatch } from './model';

export type { EnteredRewardStore } from './rooms/templates';

export type BatchExitKey =
  | { readonly kind: 'normal'; readonly exitKey: string }
  | { readonly kind: 'additional'; readonly additionalExitKey: 'chaos' | 'zagreusContract' };

/** What entering one exit of a batch records for the store ratio. */
export interface BatchExitEnteredRewardStore {
  readonly exit: BatchExitKey;
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  readonly entered: EnteredRewardStore;
}

export interface BatchEnteredRewardStores {
  /** Normal targets in physical order, then additional exits. */
  readonly exits: readonly BatchExitEnteredRewardStore[];
  readonly selected?: BatchExitEnteredRewardStore;
}

export class BatchEnteredRewardStoreContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'BatchEnteredRewardStoreContractError';
  }
}

function requireDeclaration(catalog: Catalog, gameName: string) {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new BatchEnteredRewardStoreContractError(`trusted topology lost room ${gameName}`);
  }
  return room;
}

function product(
  exits: readonly BatchExitEnteredRewardStore[],
  selected: BatchExitEnteredRewardStore | undefined,
): BatchEnteredRewardStores {
  return Object.freeze({
    exits: Object.freeze(exits),
    ...(selected === undefined ? {} : { selected }),
  });
}

function carriedStoreKey(topology: BiomeTopology, decision: ExitDecision): string | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  const rewardStore = decision.normal.rewardStore;
  switch (rewardStore.kind) {
    case 'authoredBaseStore':
      return rewardStore.baseRewardStoreKey ?? undefined;
    case 'sourceOfferPoint':
      return sourceOfferPointStoreKey(topology, decision.source);
    case 'none':
      return undefined;
  }
}

/**
 * The authored reading: declarations plus authored batch stores, before any
 * evaluation. Doors resolve through the same shared-store pass simulation uses.
 */
export function authoredBatchEnteredRewardStores(
  catalog: Catalog,
  topology: BiomeTopology,
  decision: ExitDecision,
): BatchEnteredRewardStores {
  if (decision.normal.kind !== 'batch') return product([], undefined);
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence] as const),
  );
  const occurrenceGameName = (occurrenceId: OccurrenceId): string => {
    const occurrence = occurrences.get(occurrenceId);
    if (occurrence === undefined) {
      throw new BatchEnteredRewardStoreContractError(
        `trusted topology lost occurrence ${occurrenceId}`,
      );
    }
    return occurrence.gameName;
  };
  const targets = orderedTargets(decision.normal.targets);
  const shared = finalSharedBatchStoreKey(
    catalog,
    occurrences,
    targets,
    carriedStoreKey(topology, decision),
  );
  const normal = targets.map((target) => {
    const gameName = occurrenceGameName(target.occurrenceId);
    return Object.freeze({
      exit: Object.freeze({ kind: 'normal' as const, exitKey: target.exitKey }),
      occurrenceId: target.occurrenceId,
      gameName,
      entered: enteredRewardStore(requireDeclaration(catalog, gameName), shared),
    });
  });
  const additionalExits = additionalExitsForDecision(topology, decision);
  const additional = additionalExits.map((exit) => {
    const gameName = occurrenceGameName(exit.occurrenceId);
    return Object.freeze({
      exit: Object.freeze({ kind: 'additional' as const, additionalExitKey: exit.key }),
      occurrenceId: exit.occurrenceId,
      gameName,
      // An additional exit's room is created with no door store of its own.
      entered: enteredRewardStore(requireDeclaration(catalog, gameName), undefined),
    });
  });
  const selection = selectedExitContinuation(decision, additionalExits);
  const selected =
    selection === undefined
      ? undefined
      : selection.kind === 'normal'
        ? normal.find((exit) => exit.occurrenceId === selection.target.occurrenceId)
        : additional.find((exit) => exit.occurrenceId === selection.exit.occurrenceId);
  return product([...normal, ...additional], selected);
}

/** The evaluated reading: each materialized room's own entered store. */
export function canonicalBatchEnteredRewardStores(
  catalog: Catalog,
  batch: CanonicalBatch,
): BatchEnteredRewardStores {
  const entered = (room: CanonicalBatch['targets'][number]['room']): EnteredRewardStore =>
    room.enteredRewardStoreKey !== undefined
      ? Object.freeze({ kind: 'store', storeKey: room.enteredRewardStoreKey })
      : requireDeclaration(catalog, room.gameName).enteredRewardStoreHistory.kind === 'none'
        ? Object.freeze({ kind: 'none' })
        : Object.freeze({ kind: 'unresolved' });
  let selected: BatchExitEnteredRewardStore | undefined;
  const exits = [
    ...batch.targets.map((target) => {
      const exit = Object.freeze({
        exit: Object.freeze({ kind: 'normal' as const, exitKey: target.exit.exitKey }),
        occurrenceId: target.room.occurrenceId,
        gameName: target.room.gameName,
        entered: entered(target.room),
      });
      if (target.picked) selected = exit;
      return exit;
    }),
    ...batch.additional.map((continuation) => {
      const exit = Object.freeze({
        exit: Object.freeze({
          kind: 'additional' as const,
          additionalExitKey: continuation.key,
        }),
        occurrenceId: continuation.room.occurrenceId,
        gameName: continuation.room.gameName,
        entered: entered(continuation.room),
      });
      if (continuation.picked) selected = exit;
      return exit;
    }),
  ];
  return product(exits, selected);
}

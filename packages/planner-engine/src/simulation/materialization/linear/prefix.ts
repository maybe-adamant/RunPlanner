import {
  createContinuationAddress,
  createPickedAddress,
  type BiomeAddress,
} from '../../../authored-project/addresses';
import type {
  LinearBiomePlan,
  LinearBiomeTopology,
  LinearContinuation,
  OccurrenceId,
  RoomOccurrence,
} from '../../../authored-project/model';
import type {
  Catalog,
  FixedEntryDescriptor,
  LinearBiomeLayout,
  RoomDeclaration,
} from '../../../catalog-schema';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalFixedEntryRoom,
  MaterializedLinearBiomePrefix,
  MaterializedLinearFrontierGeneration,
  CanonicalTarget,
} from '../model';
import {
  canonicalBatchState,
  canonicalBiomeState,
  canonicalRewardStore,
  finalSharedRewardStoreKey,
  materializeTarget,
  projectClockworkTopology,
  roomReference,
} from './continuations';
import { fail } from './contract';
import { requireLinearMaterializationLayout } from './dispatch';
import { materializeAuthoredRoom, materializeFixedEntryRoom } from './rooms';

function occurrenceMap(topology: LinearBiomeTopology): ReadonlyMap<OccurrenceId, RoomOccurrence> {
  return new Map(topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]));
}

function requireOccurrence(
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  occurrenceId: OccurrenceId,
): RoomOccurrence {
  const occurrence = occurrences.get(occurrenceId);
  if (occurrence === undefined) {
    fail(`trusted topology lost occurrence ${occurrenceId}`);
  }
  return occurrence;
}

function requireRoom(catalog: Catalog, occurrence: RoomOccurrence): RoomDeclaration {
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) {
    fail(`trusted topology lost room ${occurrence.gameName}`);
  }
  return room;
}

function hasEveryTarget(room: RoomDeclaration, continuation: LinearContinuation): boolean {
  return room.exits.every((exit) =>
    continuation.targets.some((target) => target.exitIndex === exit.index),
  );
}

function pickedShopIsIncomplete(
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  continuation: LinearContinuation,
): boolean {
  if (continuation.pickedExitIndex === null) {
    return false;
  }
  const picked = continuation.targets.find(
    (target) => target.exitIndex === continuation.pickedExitIndex,
  );
  if (picked === undefined) {
    fail(`trusted continuation lost picked exit ${continuation.pickedExitIndex}`);
  }
  const occurrence = requireOccurrence(occurrences, picked.occurrenceId);
  return occurrence.state.kind === 'shop' && occurrence.state.shop === undefined;
}

function prefixResult(
  biome: BiomeAddress,
  plan: LinearBiomePlan,
  entryRooms: readonly (CanonicalAuthoredRoom | CanonicalFixedEntryRoom)[],
  batches: readonly CanonicalBatch[],
  frontierGeneration?: MaterializedLinearFrontierGeneration,
): MaterializedLinearBiomePrefix {
  return Object.freeze({
    kind: 'LinearBiomePrefix',
    routeKey: biome.routeKey,
    biomeKey: biome.biomeKey,
    entryRooms: Object.freeze([...entryRooms]),
    batches: Object.freeze([...batches]),
    ...(frontierGeneration === undefined ? {} : { frontierGeneration }),
    biomeState: canonicalBiomeState(plan.biomeKey, plan.state),
  });
}

function materializeFixedEntries(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: LinearBiomeLayout,
): readonly CanonicalFixedEntryRoom[] {
  const descriptors = [layout.start, ...layout.entries] as readonly FixedEntryDescriptor[];
  return Object.freeze(
    descriptors.map((descriptor) => materializeFixedEntryRoom(catalog, biome, descriptor)),
  );
}

export function materializeLinearBiomePrefix(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: LinearBiomePlan,
): MaterializedLinearBiomePrefix | null {
  const layout = requireLinearMaterializationLayout(catalog, biome);
  if (Object.values(plan.state).some((value) => value === null)) {
    return null;
  }
  const projectedClockwork =
    layout.continuation.batchPolicy.kind === 'clockwork'
      ? projectClockworkTopology(catalog, biome, plan)
      : undefined;
  const topology = plan.topology;
  if (topology === null) {
    return layout.start.kind === 'fixedEntry'
      ? prefixResult(biome, plan, materializeFixedEntries(catalog, biome, layout), [])
      : null;
  }
  const occurrences = occurrenceMap(topology);
  const continuations = new Map(
    topology.continuations.map((continuation) => [continuation.parentOccurrenceId, continuation]),
  );
  let source: CanonicalAuthoredRoom | CanonicalFixedEntryRoom;
  let entryRooms: readonly (CanonicalAuthoredRoom | CanonicalFixedEntryRoom)[];
  if (layout.start.kind === 'fixedEntry') {
    entryRooms = materializeFixedEntries(catalog, biome, layout);
    const fixedSource = entryRooms.at(-1);
    if (fixedSource === undefined) {
      fail(`${layout.biomeKey} has no fixed entry source`);
    }
    source = fixedSource;
  } else {
    if (topology.startOccurrenceId === null) {
      return null;
    }
    const occurrence = requireOccurrence(occurrences, topology.startOccurrenceId);
    const room = requireRoom(catalog, occurrence);
    source = materializeAuthoredRoom({
      catalog,
      biome,
      room,
      occurrence,
      role: 'ordinary',
      entered: true,
    });
    entryRooms = Object.freeze([source]);
  }

  const batches: CanonicalBatch[] = [];
  for (let batchIndex = 0; ; batchIndex += 1) {
    const parentOccurrenceId = source.kind === 'fixedEntry' ? null : source.occurrenceId;
    const continuation = continuations.get(parentOccurrenceId);
    if (continuation === undefined) {
      return prefixResult(biome, plan, entryRooms, batches);
    }
    const sourceDeclaration = catalog.rooms.byKey[source.gameName];
    if (sourceDeclaration === undefined) {
      fail(`trusted prefix source lost room ${source.gameName}`);
    }
    const hasAllTargets = hasEveryTarget(sourceDeclaration, continuation);
    if (
      continuation.rewardStore?.kind === 'authoredBaseStore' &&
      continuation.rewardStore.baseRewardStoreKey === null
    ) {
      return prefixResult(biome, plan, entryRooms, batches);
    }
    if (
      continuation.kind === 'batch' &&
      layout.continuation.batchPolicy.kind === 'fields' &&
      continuation.batchState === null
    ) {
      return prefixResult(biome, plan, entryRooms, batches);
    }

    const clockworkProjection = projectedClockwork?.batches[batchIndex];
    const batchState =
      layout.continuation.batchPolicy.kind === 'clockwork'
        ? clockworkProjection?.batchState
        : continuation.kind === 'batch'
          ? canonicalBatchState(catalog, layout, occurrences, continuation)
          : undefined;
    if (layout.continuation.batchPolicy.kind === 'clockwork' && batchState === undefined) {
      fail(`Clockwork batch ${batchIndex + 1} has no projection`);
    }
    const authoredRewardStore =
      layout.continuation.batchPolicy.kind === 'clockwork'
        ? ({ kind: 'none' } as const)
        : continuation.rewardStore;
    const orderedAuthoredTargets = Object.freeze(
      [...continuation.targets].sort((left, right) => left.exitIndex - right.exitIndex),
    );
    const sharedStoreKey =
      authoredRewardStore === undefined
        ? undefined
        : finalSharedRewardStoreKey(
            catalog,
            occurrences,
            source,
            authoredRewardStore,
            orderedAuthoredTargets,
          );
    const selectedShopIncomplete = pickedShopIsIncomplete(occurrences, continuation);
    const targets = Object.freeze(
      orderedAuthoredTargets.map((target): CanonicalTarget => {
        const occurrence = requireOccurrence(occurrences, target.occurrenceId);
        const room = requireRoom(catalog, occurrence);
        const clockworkReward = clockworkProjection?.targets.find(
          (candidate) => candidate.exitIndex === target.exitIndex,
        )?.reward;
        const entersGeneratedTerminal =
          layout.terminal.kind === 'generatedTarget' &&
          room.gameName === layout.terminal.roomGameName;
        const terminalRole =
          continuation.kind === 'terminal' || entersGeneratedTerminal
            ? layout.terminal.kind === 'directTransition' || target.exitIndex === 1
              ? 'terminalShop'
              : 'terminalFreeReward'
            : 'ordinary';
        return materializeTarget(
          catalog,
          biome,
          occurrences,
          sourceDeclaration,
          continuation,
          target,
          terminalRole,
          continuation.kind === 'terminal' || entersGeneratedTerminal
            ? 'entersTerminal'
            : 'continuesSpine',
          sharedStoreKey,
          batchState?.kind === 'fields' ? batchState.doorCageRewardCount : undefined,
          clockworkReward,
          !selectedShopIncomplete && continuation.pickedExitIndex === target.exitIndex,
        );
      }),
    );
    const rewardStore =
      authoredRewardStore === undefined
        ? undefined
        : canonicalRewardStore(biome, parentOccurrenceId, authoredRewardStore);
    const pickedExitIndex = continuation.pickedExitIndex;
    const frontierKind = continuation.kind === 'terminal' ? 'terminal' : 'batch';
    if (!hasAllTargets || pickedExitIndex === null || selectedShopIncomplete) {
      return prefixResult(
        biome,
        plan,
        entryRooms,
        batches,
        Object.freeze({
          kind: frontierKind,
          origin: createContinuationAddress(biome, parentOccurrenceId),
          parent: roomReference(source),
          ...(rewardStore === undefined ? {} : { rewardStore }),
          ...(batchState === undefined ? {} : { batchState }),
          targets,
          pickedExitIndex,
          pickedOrigin: createPickedAddress(biome, parentOccurrenceId),
        }),
      );
    }
    const picked = targets.find((target) => target.exit.index === pickedExitIndex);
    if (picked === undefined) {
      fail(`prefix continuation lost picked exit ${pickedExitIndex}`);
    }
    if (
      continuation.kind === 'terminal' ||
      (layout.terminal.kind === 'generatedTarget' &&
        picked.room.gameName === layout.terminal.roomGameName)
    ) {
      fail(`incomplete ${layout.biomeKey} prefix unexpectedly reached its terminal`);
    }
    if (rewardStore === undefined || batchState === undefined) {
      fail(`${layout.biomeKey} batch has no canonical policy state`);
    }
    batches.push(
      Object.freeze({
        origin: createContinuationAddress(biome, parentOccurrenceId),
        parent: roomReference(source),
        rewardStore,
        batchState,
        targets,
        pickedExitIndex,
        pickedOrigin: createPickedAddress(biome, parentOccurrenceId),
      }),
    );
    source = picked.room;
  }
}

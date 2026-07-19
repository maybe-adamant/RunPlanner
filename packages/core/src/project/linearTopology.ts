import type { Catalog, LinearBiomeLayout, RoomDeclaration } from '../catalog';
import type {
  LinearBiomeTopology,
  BatchRewardStoreState,
  LinearContinuation,
  LinearTargetReference,
  OccurrenceId,
  RoomOccurrence,
} from './model';
import { decodeRoomState, type RoomOccurrenceRole } from './roomState';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectPositiveInteger,
  expectRecord,
  expectString,
  failProjectDocument,
} from './validation';

interface RawOccurrence {
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  readonly state: unknown;
  readonly path: string;
}

interface DecodedContinuation {
  readonly value: LinearContinuation;
  readonly path: string;
}

function occurrenceId(value: unknown, path: string): OccurrenceId {
  return expectNonBlankString(value, path) as OccurrenceId;
}

function decodePickedExitIndex(value: unknown, path: string): number | null {
  return value === null ? null : expectPositiveInteger(value, path);
}

function decodeBatchRewardStore(
  value: unknown,
  layout: LinearBiomeLayout,
  path: string,
): BatchRewardStoreState {
  const rewardStore = expectRecord(value, path);
  const kind = expectString(rewardStore.kind, `${path}.kind`);
  if (kind !== layout.continuation.rewardStorePolicy.kind) {
    failProjectDocument(
      `${path}.kind`,
      `expected ${layout.continuation.rewardStorePolicy.kind}, received ${kind}`,
    );
  }
  if (layout.continuation.rewardStorePolicy.kind !== 'authoredBaseStore') {
    failProjectDocument(path, 'linear project topology requires an authored base-store policy');
  }
  expectExactKeys(rewardStore, ['kind', 'baseRewardStoreKey'], path);
  const baseRewardStoreKey = expectString(
    rewardStore.baseRewardStoreKey,
    `${path}.baseRewardStoreKey`,
  );
  if (!layout.continuation.rewardStorePolicy.storeKeys.includes(baseRewardStoreKey)) {
    failProjectDocument(
      `${path}.baseRewardStoreKey`,
      `${baseRewardStoreKey} is not available from this batch policy`,
    );
  }
  return Object.freeze({ kind: 'authoredBaseStore', baseRewardStoreKey });
}

function maxExitIndex(catalog: Catalog, biomeKey: string): number {
  let maximum = 0;
  for (const room of catalog.rooms.values) {
    if (room.biomeKey === biomeKey) {
      maximum = Math.max(maximum, ...room.exits.map((exit) => exit.index));
    }
  }
  return maximum;
}

function decodeTargets(
  value: unknown,
  path: string,
  occurrenceById: ReadonlyMap<OccurrenceId, RawOccurrence>,
  maximumExitIndex: number,
): readonly LinearTargetReference[] {
  const rawTargets = expectArray(value, path);
  const seenExitIndexes = new Set<number>();
  const targets = rawTargets.map((rawTarget, index): LinearTargetReference => {
    const targetPath = `${path}[${index}]`;
    const target = expectRecord(rawTarget, targetPath);
    expectExactKeys(target, ['exitIndex', 'occurrenceId'], targetPath);
    const exitIndex = expectPositiveInteger(target.exitIndex, `${targetPath}.exitIndex`);
    if (exitIndex > maximumExitIndex) {
      failProjectDocument(
        `${targetPath}.exitIndex`,
        `exceeds structural exit capacity ${maximumExitIndex}`,
      );
    }
    if (seenExitIndexes.has(exitIndex)) {
      failProjectDocument(`${targetPath}.exitIndex`, `duplicates exit ${exitIndex}`);
    }
    seenExitIndexes.add(exitIndex);

    const targetOccurrenceId = occurrenceId(target.occurrenceId, `${targetPath}.occurrenceId`);
    if (!occurrenceById.has(targetOccurrenceId)) {
      failProjectDocument(`${targetPath}.occurrenceId`, `unknown occurrence ${targetOccurrenceId}`);
    }
    return Object.freeze({ exitIndex, occurrenceId: targetOccurrenceId });
  });

  return Object.freeze(targets.sort((left, right) => left.exitIndex - right.exitIndex));
}

function requireRoom(
  occurrence: RawOccurrence,
  catalog: Catalog,
  biomeKey: string,
): RoomDeclaration {
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) {
    failProjectDocument(`${occurrence.path}.gameName`, `unknown room ${occurrence.gameName}`);
  }
  if (room.biomeKey !== biomeKey) {
    failProjectDocument(
      `${occurrence.path}.gameName`,
      `${occurrence.gameName} belongs to ${room.biomeKey}`,
    );
  }
  return room;
}

export function decodeLinearBiomeTopology(
  value: unknown,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  path: string,
): LinearBiomeTopology {
  if (layout.continuation.batchPolicy.kind !== 'standard') {
    failProjectDocument(path, `${layout.biomeKey} does not use standard authored batches`);
  }
  if (layout.continuation.rewardStoreOverrides.length !== 0) {
    failProjectDocument(path, `${layout.biomeKey} uses source-specific reward-store policies`);
  }
  const topology = expectRecord(value, path);
  expectExactKeys(topology, ['startOccurrenceId', 'occurrences', 'continuations'], path);

  const rawOccurrences = expectArray(topology.occurrences, `${path}.occurrences`);
  const occurrenceById = new Map<OccurrenceId, RawOccurrence>();
  for (const [index, rawValue] of rawOccurrences.entries()) {
    const occurrencePath = `${path}.occurrences[${index}]`;
    const rawOccurrence = expectRecord(rawValue, occurrencePath);
    expectExactKeys(rawOccurrence, ['occurrenceId', 'gameName', 'state'], occurrencePath);
    const id = occurrenceId(rawOccurrence.occurrenceId, `${occurrencePath}.occurrenceId`);
    if (occurrenceById.has(id)) {
      failProjectDocument(`${occurrencePath}.occurrenceId`, `duplicates occurrence ${id}`);
    }
    occurrenceById.set(id, {
      occurrenceId: id,
      gameName: expectNonBlankString(rawOccurrence.gameName, `${occurrencePath}.gameName`),
      state: rawOccurrence.state,
      path: occurrencePath,
    });
  }

  const startOccurrenceId = occurrenceId(topology.startOccurrenceId, `${path}.startOccurrenceId`);
  const start = occurrenceById.get(startOccurrenceId);
  if (start === undefined) {
    failProjectDocument(`${path}.startOccurrenceId`, `unknown occurrence ${startOccurrenceId}`);
  }
  const startRoom = requireRoom(start, catalog, layout.biomeKey);
  if (layout.start.kind !== 'authoredStart') {
    failProjectDocument(`${path}.startOccurrenceId`, `${layout.biomeKey} has a derived start`);
  }
  if (!layout.start.roomGameNames.includes(startRoom.gameName)) {
    failProjectDocument(
      `${start.path}.gameName`,
      `${startRoom.gameName} is not a declared start room for ${layout.biomeKey}`,
    );
  }

  const maximumExitIndex = maxExitIndex(catalog, layout.biomeKey);
  if (layout.terminal.kind !== 'forkedTransition') {
    failProjectDocument(path, `${layout.biomeKey} does not use a forked terminal transition`);
  }
  const terminalRoom = catalog.rooms.byKey[layout.terminal.roomGameName];
  if (terminalRoom?.entryOfferPolicy === undefined) {
    failProjectDocument(path, `${layout.terminal.roomGameName} has no terminal offer policy`);
  }
  const maximumTerminalExitIndex = Math.min(
    maximumExitIndex,
    1 + terminalRoom.entryOfferPolicy.maxFreeRewards,
  );
  const rawContinuations = expectArray(topology.continuations, `${path}.continuations`);
  const continuationByParent = new Map<OccurrenceId, DecodedContinuation>();
  let batchCount = 0;
  let terminalCount = 0;
  let targetCount = 0;

  for (const [index, rawValue] of rawContinuations.entries()) {
    const continuationPath = `${path}.continuations[${index}]`;
    const rawContinuation = expectRecord(rawValue, continuationPath);
    expectExactKeys(
      rawContinuation,
      [
        'kind',
        'parentOccurrenceId',
        ...(rawContinuation.kind === 'batch' ? ['rewardStore', 'batchState'] : []),
        'targets',
        'pickedExitIndex',
      ],
      continuationPath,
    );
    const kind = expectString(rawContinuation.kind, `${continuationPath}.kind`);
    if (kind !== 'batch' && kind !== 'terminal') {
      failProjectDocument(`${continuationPath}.kind`, `unknown continuation kind ${kind}`);
    }
    const parentOccurrenceId = occurrenceId(
      rawContinuation.parentOccurrenceId,
      `${continuationPath}.parentOccurrenceId`,
    );
    if (!occurrenceById.has(parentOccurrenceId)) {
      failProjectDocument(
        `${continuationPath}.parentOccurrenceId`,
        `unknown occurrence ${parentOccurrenceId}`,
      );
    }
    if (continuationByParent.has(parentOccurrenceId)) {
      failProjectDocument(
        `${continuationPath}.parentOccurrenceId`,
        `duplicates continuation for ${parentOccurrenceId}`,
      );
    }
    const targets = decodeTargets(
      rawContinuation.targets,
      `${continuationPath}.targets`,
      occurrenceById,
      kind === 'terminal' ? maximumTerminalExitIndex : maximumExitIndex,
    );
    targetCount += targets.length;
    const pickedExitIndex = decodePickedExitIndex(
      rawContinuation.pickedExitIndex,
      `${continuationPath}.pickedExitIndex`,
    );
    if (
      pickedExitIndex !== null &&
      !targets.some((target) => target.exitIndex === pickedExitIndex)
    ) {
      failProjectDocument(
        `${continuationPath}.pickedExitIndex`,
        `exit ${pickedExitIndex} has no target`,
      );
    }
    if (kind === 'batch') {
      batchCount += 1;
    } else {
      terminalCount += 1;
    }
    const decoded =
      kind === 'batch'
        ? Object.freeze({
            kind,
            parentOccurrenceId,
            rewardStore: decodeBatchRewardStore(
              rawContinuation.rewardStore,
              layout,
              `${continuationPath}.rewardStore`,
            ),
            batchState:
              rawContinuation.batchState === null
                ? null
                : failProjectDocument(`${continuationPath}.batchState`, 'must be null'),
            targets,
            pickedExitIndex,
          })
        : Object.freeze({ kind, parentOccurrenceId, targets, pickedExitIndex });
    continuationByParent.set(parentOccurrenceId, { value: decoded, path: continuationPath });
  }

  if (batchCount > layout.bounds.maxBatches) {
    failProjectDocument(`${path}.continuations`, `exceeds ${layout.bounds.maxBatches} batches`);
  }
  if (terminalCount > 1) {
    failProjectDocument(`${path}.continuations`, 'must contain at most one terminal transition');
  }
  if (targetCount > layout.bounds.maxTargets) {
    failProjectDocument(`${path}.continuations`, `exceeds ${layout.bounds.maxTargets} targets`);
  }

  const orderedContinuations: LinearContinuation[] = [];
  const spine = new Set<OccurrenceId>();
  let currentOccurrenceId: OccurrenceId | null = startOccurrenceId;
  while (currentOccurrenceId !== null) {
    if (spine.has(currentOccurrenceId)) {
      failProjectDocument(path, `continuation cycle reaches ${currentOccurrenceId}`);
    }
    spine.add(currentOccurrenceId);
    const continuation = continuationByParent.get(currentOccurrenceId);
    if (continuation === undefined) {
      break;
    }
    orderedContinuations.push(continuation.value);
    if (continuation.value.kind === 'terminal' || continuation.value.pickedExitIndex === null) {
      currentOccurrenceId = null;
    } else {
      const pickedTarget = continuation.value.targets.find(
        (target) => target.exitIndex === continuation.value.pickedExitIndex,
      );
      if (pickedTarget === undefined) {
        failProjectDocument(continuation.path, 'picked target disappeared during normalization');
      }
      currentOccurrenceId = pickedTarget.occurrenceId;
    }
  }

  if (orderedContinuations.length !== continuationByParent.size) {
    const detached = [...continuationByParent.entries()].find(([parentId]) => !spine.has(parentId));
    if (detached !== undefined) {
      failProjectDocument(
        `${detached[1].path}.parentOccurrenceId`,
        `${detached[0]} is not on the picked spine`,
      );
    }
  }

  const roles = new Map<OccurrenceId, RoomOccurrenceRole>();
  roles.set(startOccurrenceId, 'ordinary');
  const enteredOccurrences = new Set<OccurrenceId>([startOccurrenceId]);
  const orderedOccurrenceIds: OccurrenceId[] = [startOccurrenceId];

  for (const continuation of orderedContinuations) {
    if (continuation.kind === 'terminal') {
      if (continuation.targets.length > 1 + terminalRoom.entryOfferPolicy.maxFreeRewards) {
        failProjectDocument(
          path,
          `terminal transition exceeds ${terminalRoom.entryOfferPolicy.maxFreeRewards} free rewards`,
        );
      }
    }

    for (const target of continuation.targets) {
      if (roles.has(target.occurrenceId)) {
        failProjectDocument(
          path,
          `occurrence ${target.occurrenceId} has multiple structural owners`,
        );
      }
      const rawOccurrence = occurrenceById.get(target.occurrenceId);
      if (rawOccurrence === undefined) {
        failProjectDocument(path, `unknown occurrence ${target.occurrenceId}`);
      }
      const room = requireRoom(rawOccurrence, catalog, layout.biomeKey);
      let role: RoomOccurrenceRole = 'ordinary';
      if (continuation.kind === 'terminal') {
        if (room.gameName !== layout.terminal.roomGameName) {
          failProjectDocument(
            `${rawOccurrence.path}.gameName`,
            `terminal target must be ${layout.terminal.roomGameName}`,
          );
        }
        role = target.exitIndex === 1 ? 'terminalShop' : 'terminalFreeReward';
      } else if (room.kind === 'Intro' || room.kind === 'Opening' || room.kind === 'Preboss') {
        failProjectDocument(
          `${rawOccurrence.path}.gameName`,
          `${room.gameName} cannot be an ordinary generated target`,
        );
      } else if (room.mode.kind !== 'authored') {
        failProjectDocument(
          `${rawOccurrence.path}.gameName`,
          `${room.gameName} is layout-derived and cannot be authored`,
        );
      }
      roles.set(target.occurrenceId, role);
      if (continuation.pickedExitIndex === target.exitIndex) {
        enteredOccurrences.add(target.occurrenceId);
      }
      orderedOccurrenceIds.push(target.occurrenceId);
    }
  }

  if (roles.size !== occurrenceById.size) {
    const unreferenced = [...occurrenceById.keys()].find((id) => !roles.has(id));
    if (unreferenced !== undefined) {
      const occurrence = occurrenceById.get(unreferenced);
      failProjectDocument(
        occurrence?.path ?? path,
        `occurrence ${unreferenced} is not referenced by topology`,
      );
    }
  }

  const occurrences = orderedOccurrenceIds.map((id): RoomOccurrence => {
    const rawOccurrence = occurrenceById.get(id);
    const role = roles.get(id);
    if (rawOccurrence === undefined || role === undefined) {
      failProjectDocument(path, `missing normalized occurrence ${id}`);
    }
    const room = requireRoom(rawOccurrence, catalog, layout.biomeKey);
    return Object.freeze({
      occurrenceId: id,
      gameName: room.gameName,
      state: decodeRoomState(
        rawOccurrence.state,
        catalog,
        room,
        { role, entryActive: enteredOccurrences.has(id) },
        `${rawOccurrence.path}.state`,
      ),
    });
  });

  return Object.freeze({
    startOccurrenceId,
    occurrences: Object.freeze(occurrences),
    continuations: Object.freeze(orderedContinuations),
  });
}

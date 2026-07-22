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
import { decodeBatchState } from './batchState';
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

function nullableOccurrenceId(value: unknown, path: string): OccurrenceId | null {
  return value === null ? null : occurrenceId(value, path);
}

function decodePickedExitIndex(value: unknown, path: string): number | null {
  return value === null ? null : expectPositiveInteger(value, path);
}

function decodeBatchRewardStore(
  value: unknown,
  layout: LinearBiomeLayout,
  sourceRoom: RoomDeclaration,
  path: string,
): BatchRewardStoreState {
  const rewardStore = expectRecord(value, path);
  const kind = expectString(rewardStore.kind, `${path}.kind`);
  const policy =
    layout.continuation.rewardStoreOverrides.find(
      (override) => override.sourceEncounterProfileKey === sourceRoom.encounterProfileKey,
    )?.policy ?? layout.continuation.rewardStorePolicy;
  if (kind !== policy.kind) {
    failProjectDocument(`${path}.kind`, `expected ${policy.kind}, received ${kind}`);
  }
  if (policy.kind === 'none') {
    expectExactKeys(rewardStore, ['kind'], path);
    return Object.freeze({ kind: 'none' });
  }
  if (policy.kind === 'sourceOfferPoint') {
    expectExactKeys(rewardStore, ['kind'], path);
    return Object.freeze({ kind: 'sourceOfferPoint' });
  }
  expectExactKeys(rewardStore, ['kind', 'baseRewardStoreKey'], path);
  const baseRewardStoreKey = expectString(
    rewardStore.baseRewardStoreKey,
    `${path}.baseRewardStoreKey`,
  );
  if (!policy.storeKeys.includes(baseRewardStoreKey)) {
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

function continuationSourceRoom(
  parentOccurrenceId: OccurrenceId | null,
  layout: LinearBiomeLayout,
  catalog: Catalog,
  occurrenceById: ReadonlyMap<OccurrenceId, RawOccurrence>,
  path: string,
): RoomDeclaration {
  if (parentOccurrenceId !== null) {
    const source = occurrenceById.get(parentOccurrenceId);
    if (source === undefined) {
      failProjectDocument(path, `unknown source occurrence ${parentOccurrenceId}`);
    }
    return requireRoom(source, catalog, layout.biomeKey);
  }
  if (layout.start.kind !== 'fixedEntry') {
    failProjectDocument(path, `${layout.biomeKey} has no derived entry source`);
  }
  const descriptor = layout.entries.at(-1) ?? layout.start;
  const room = catalog.rooms.byKey[descriptor.roomGameName];
  if (room === undefined || room.biomeKey !== layout.biomeKey) {
    failProjectDocument(path, `unknown fixed entry ${descriptor.roomGameName}`);
  }
  return room;
}

export function decodeLinearBiomeTopology(
  value: unknown,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  path: string,
): LinearBiomeTopology {
  if (
    layout.continuation.batchPolicy.kind !== 'standard' &&
    layout.continuation.batchPolicy.kind !== 'fields' &&
    layout.continuation.batchPolicy.kind !== 'clockwork'
  ) {
    failProjectDocument(path, `${layout.biomeKey} does not use a supported authored batch policy`);
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

  const startOccurrenceId = nullableOccurrenceId(
    topology.startOccurrenceId,
    `${path}.startOccurrenceId`,
  );
  if (layout.start.kind === 'authoredStart') {
    if (startOccurrenceId === null) {
      failProjectDocument(
        `${path}.startOccurrenceId`,
        `${layout.biomeKey} requires an authored start`,
      );
    }
    const start = occurrenceById.get(startOccurrenceId);
    if (start === undefined) {
      failProjectDocument(`${path}.startOccurrenceId`, `unknown occurrence ${startOccurrenceId}`);
    }
    const startRoom = requireRoom(start, catalog, layout.biomeKey);
    if (!layout.start.roomGameNames.includes(startRoom.gameName)) {
      failProjectDocument(
        `${start.path}.gameName`,
        `${startRoom.gameName} is not a declared start room for ${layout.biomeKey}`,
      );
    }
  } else if (startOccurrenceId !== null) {
    failProjectDocument(
      `${path}.startOccurrenceId`,
      `${layout.biomeKey} uses derived fixed entries`,
    );
  }

  const maximumExitIndex = maxExitIndex(catalog, layout.biomeKey);
  const terminalRoom = catalog.rooms.byKey[layout.terminal.roomGameName];
  if (terminalRoom === undefined) {
    failProjectDocument(path, `${layout.terminal.roomGameName} is not declared`);
  }
  if (layout.terminal.kind === 'forkedTransition' && terminalRoom.entryOfferPolicy === undefined) {
    failProjectDocument(path, `${layout.terminal.roomGameName} has no terminal offer policy`);
  }
  const maximumTerminalExitIndex =
    layout.terminal.kind === 'forkedTransition'
      ? Math.min(maximumExitIndex, 1 + terminalRoom.entryOfferPolicy!.maxFreeRewards)
      : layout.terminal.kind === 'directTransition'
        ? 1
        : 0;
  const rawContinuations = expectArray(topology.continuations, `${path}.continuations`);
  const continuationByParent = new Map<OccurrenceId | null, DecodedContinuation>();
  let batchCount = 0;
  let terminalCount = 0;
  let targetCount = 0;

  for (const [index, rawValue] of rawContinuations.entries()) {
    const continuationPath = `${path}.continuations[${index}]`;
    const rawContinuation = expectRecord(rawValue, continuationPath);
    const kind = expectString(rawContinuation.kind, `${continuationPath}.kind`);
    if (kind !== 'batch' && kind !== 'terminal') {
      failProjectDocument(`${continuationPath}.kind`, `unknown continuation kind ${kind}`);
    }
    expectExactKeys(
      rawContinuation,
      [
        'kind',
        'parentOccurrenceId',
        ...(kind === 'batch'
          ? ['rewardStore', 'batchState']
          : layout.terminal.kind === 'directTransition'
            ? ['rewardStore']
            : []),
        'targets',
        'pickedExitIndex',
      ],
      continuationPath,
    );
    if (
      kind === 'terminal' &&
      layout.terminal.kind !== 'forkedTransition' &&
      layout.terminal.kind !== 'directTransition'
    ) {
      failProjectDocument(
        `${continuationPath}.kind`,
        `${layout.biomeKey} does not use an independent terminal transition`,
      );
    }
    const parentOccurrenceId = nullableOccurrenceId(
      rawContinuation.parentOccurrenceId,
      `${continuationPath}.parentOccurrenceId`,
    );
    if (parentOccurrenceId === null && layout.start.kind !== 'fixedEntry') {
      failProjectDocument(
        `${continuationPath}.parentOccurrenceId`,
        `${layout.biomeKey} has no derived entry continuation`,
      );
    }
    if (parentOccurrenceId !== null && !occurrenceById.has(parentOccurrenceId)) {
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
    if (kind === 'batch') {
      targetCount += targets.length;
    }
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
              continuationSourceRoom(
                parentOccurrenceId,
                layout,
                catalog,
                occurrenceById,
                continuationPath,
              ),
              `${continuationPath}.rewardStore`,
            ),
            batchState: decodeBatchState(
              rawContinuation.batchState,
              layout.continuation.batchPolicy,
              `${continuationPath}.batchState`,
            ),
            targets,
            pickedExitIndex,
          })
        : Object.freeze({
            kind,
            parentOccurrenceId,
            ...(layout.terminal.kind === 'directTransition'
              ? {
                  rewardStore: decodeBatchRewardStore(
                    rawContinuation.rewardStore,
                    layout,
                    continuationSourceRoom(
                      parentOccurrenceId,
                      layout,
                      catalog,
                      occurrenceById,
                      continuationPath,
                    ),
                    `${continuationPath}.rewardStore`,
                  ),
                }
              : {}),
            targets,
            pickedExitIndex,
          });
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
  if (layout.start.kind === 'fixedEntry' && !continuationByParent.has(null)) {
    failProjectDocument(
      `${path}.continuations`,
      `${layout.biomeKey} topology must continue from its fixed entry sequence`,
    );
  }

  const orderedContinuations: LinearContinuation[] = [];
  const spine = new Set<OccurrenceId | null>();
  let currentOwner: OccurrenceId | null | undefined = startOccurrenceId;
  while (currentOwner !== undefined) {
    if (spine.has(currentOwner)) {
      failProjectDocument(path, `continuation cycle reaches ${String(currentOwner)}`);
    }
    spine.add(currentOwner);
    const continuation = continuationByParent.get(currentOwner);
    if (continuation === undefined) {
      break;
    }
    orderedContinuations.push(continuation.value);
    if (continuation.value.kind === 'terminal' || continuation.value.pickedExitIndex === null) {
      currentOwner = undefined;
    } else {
      const pickedTarget = continuation.value.targets.find(
        (target) => target.exitIndex === continuation.value.pickedExitIndex,
      );
      if (pickedTarget === undefined) {
        failProjectDocument(continuation.path, 'picked target disappeared during normalization');
      }
      const picked = occurrenceById.get(pickedTarget.occurrenceId);
      currentOwner =
        layout.terminal.kind === 'generatedTarget' &&
        picked?.gameName === layout.terminal.roomGameName
          ? undefined
          : pickedTarget.occurrenceId;
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
  const enteredOccurrences = new Set<OccurrenceId>();
  const orderedOccurrenceIds: OccurrenceId[] = [];
  if (startOccurrenceId !== null) {
    roles.set(startOccurrenceId, 'ordinary');
    enteredOccurrences.add(startOccurrenceId);
    orderedOccurrenceIds.push(startOccurrenceId);
  }

  for (const continuation of orderedContinuations) {
    if (continuation.kind === 'terminal') {
      if (layout.terminal.kind === 'forkedTransition') {
        if (
          terminalRoom.entryOfferPolicy === undefined ||
          continuation.targets.length > 1 + terminalRoom.entryOfferPolicy.maxFreeRewards
        ) {
          failProjectDocument(
            path,
            `terminal transition exceeds ${terminalRoom.entryOfferPolicy?.maxFreeRewards ?? 0} free rewards`,
          );
        }
      } else if (
        layout.terminal.kind !== 'directTransition' ||
        continuation.targets.length !== 1 ||
        continuation.targets[0]?.exitIndex !== 1 ||
        continuation.pickedExitIndex !== 1
      ) {
        failProjectDocument(path, 'direct terminal requires one picked target on exit 1');
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
        role =
          layout.terminal.kind === 'directTransition' || target.exitIndex === 1
            ? 'terminalShop'
            : 'terminalFreeReward';
      } else if (
        layout.terminal.kind === 'generatedTarget' &&
        room.gameName === layout.terminal.roomGameName
      ) {
        role = 'terminalShop';
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

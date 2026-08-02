import type { BiomeLayout, Catalog, RoomDeclaration } from '../../catalog-schema';
import { decodeBatchState } from '../batchState';
import type {
  AuthoredBatchState,
  BatchRewardStoreState,
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  ExitSelection,
  ExitTargetReference,
  HubDecision,
  HubTargetReference,
  NextRoomDecision,
  OccurrenceId,
  RoomOccurrence,
} from '../model';
import { decodeRoomState } from '../room-state/codec';
import type { RoomOccurrenceRole } from '../room-state/declaration';
import {
  admitsTerminalTakeoverEnvelope,
  ordinaryProgressionBatchLimit,
  selectedExitKey,
  selectedOrdinaryBatchIndex,
} from './query';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';

interface RawOccurrence {
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  readonly state: unknown;
  readonly path: string;
}

interface OccurrenceOwner {
  readonly gameName: string;
  readonly role: RoomOccurrenceRole;
  readonly entryActive: boolean;
  readonly path: string;
}

interface RawDecision {
  readonly value: Record<string, unknown>;
  readonly path: string;
}

function occurrenceId(value: unknown, path: string): OccurrenceId {
  return expectNonBlankString(value, path) as OccurrenceId;
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
  if (room.mode.kind !== 'authored') {
    failProjectDocument(`${occurrence.path}.gameName`, `${occurrence.gameName} is layout-derived`);
  }
  return room;
}

function decodeSource(value: unknown, path: string): ExitDecisionSource {
  const source = expectRecord(value, path);
  const kind = expectString(source.kind, `${path}.kind`);
  if (kind === 'occurrence') {
    expectExactKeys(source, ['kind', 'occurrenceId'], path);
    return Object.freeze({
      kind,
      occurrenceId: occurrenceId(source.occurrenceId, `${path}.occurrenceId`),
    });
  }
  if (kind === 'hubDecision') {
    expectExactKeys(source, ['kind', 'decisionKey'], path);
    return Object.freeze({
      kind,
      decisionKey: expectNonBlankString(source.decisionKey, `${path}.decisionKey`),
    });
  }
  failProjectDocument(`${path}.kind`, `unknown exit decision source ${kind}`);
}

function sourceKey(source: ExitDecisionSource): string {
  return source.kind === 'occurrence'
    ? `occurrence:${source.occurrenceId}`
    : `hubDecision:${source.decisionKey}`;
}

function decodeSelection(
  value: unknown,
  targetKeys: readonly string[],
  path: string,
): ExitSelection {
  const selection = expectRecord(value, path);
  const kind = expectString(selection.kind, `${path}.kind`);
  if (kind === 'derived' || kind === 'unresolved') {
    expectExactKeys(selection, ['kind'], path);
    if (kind === 'derived' && targetKeys.length !== 1) {
      failProjectDocument(path, 'derived selection requires exactly one normal exit');
    }
    if (kind === 'unresolved' && targetKeys.length === 1) {
      failProjectDocument(path, 'a width-one normal exit must use derived selection');
    }
    return Object.freeze({ kind });
  }
  if (kind !== 'normal') {
    failProjectDocument(`${path}.kind`, `unknown exit selection ${kind}`);
  }
  expectExactKeys(selection, ['kind', 'exitKey'], path);
  if (targetKeys.length === 1) {
    failProjectDocument(path, 'a width-one normal exit must use derived selection');
  }
  const exitKey = expectNonBlankString(selection.exitKey, `${path}.exitKey`);
  if (!targetKeys.includes(exitKey)) {
    failProjectDocument(`${path}.exitKey`, `${exitKey} is not a normal exit in this decision`);
  }
  return Object.freeze({ kind, exitKey });
}

function normalExitKeys(room: RoomDeclaration): readonly string[] {
  return room.exits.map((exit) => `exit${exit.index}`);
}

/**
 * A room replacement may leave a batch with target keys that its new source
 * declaration no longer exposes.  Those targets are deliberately retained
 * until an explicit capacity-repair command removes them.  The codec still
 * has to reject invented keys, so its structural domain is the declaration
 * owned normal-exit vocabulary for this biome rather than the current source
 * width alone.
 */
function possibleNormalExitKeys(catalog: Catalog, biomeKey: string): readonly string[] {
  return Object.freeze([
    ...new Set(
      Object.values(catalog.rooms.byKey)
        .filter((room) => room.biomeKey === biomeKey && room.mode.kind === 'authored')
        .flatMap((room) => normalExitKeys(room)),
    ),
  ]);
}

function rewardStoreFor(
  layout: BiomeLayout,
  source: ExitDecisionSource,
  sourceRoom: RoomDeclaration | undefined,
  raw: unknown,
  path: string,
): BatchRewardStoreState {
  const policy =
    layout.progression.kind === 'generated' && sourceRoom !== undefined
      ? (layout.progression.rewardStoreOverrides.find(
          (override) => override.sourceEncounterProfileKey === sourceRoom.encounterProfileKey,
        )?.policy ?? layout.progression.rewardStorePolicy)
      : { kind: 'none' as const };
  const value = expectRecord(raw, path);
  const kind = expectString(value.kind, `${path}.kind`);
  if (kind !== policy.kind) {
    failProjectDocument(`${path}.kind`, `expected ${policy.kind}, received ${kind}`);
  }
  if (policy.kind === 'none') {
    expectExactKeys(value, ['kind'], path);
    return Object.freeze({ kind: 'none' });
  }
  if (policy.kind === 'sourceOfferPoint') {
    expectExactKeys(value, ['kind'], path);
    return Object.freeze({ kind: 'sourceOfferPoint' });
  }
  expectExactKeys(value, ['kind', 'baseRewardStoreKey'], path);
  if (value.baseRewardStoreKey === null) {
    return Object.freeze({ kind: 'authoredBaseStore', baseRewardStoreKey: null });
  }
  const storeKey = expectString(value.baseRewardStoreKey, `${path}.baseRewardStoreKey`);
  if (!policy.storeKeys.includes(storeKey)) {
    failProjectDocument(
      `${path}.baseRewardStoreKey`,
      `${storeKey} is not available from this batch`,
    );
  }
  return Object.freeze({ kind: 'authoredBaseStore', baseRewardStoreKey: storeKey });
}

function decodeTargets(
  value: unknown,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  allowedExitKeys: readonly string[],
  path: string,
): readonly ExitTargetReference[] {
  const rawTargets = expectArray(value, path);
  const seen = new Set<string>();
  const targets = rawTargets.map((rawTarget, index) => {
    const targetPath = `${path}[${index}]`;
    const target = expectRecord(rawTarget, targetPath);
    expectExactKeys(target, ['exitKey', 'occurrenceId'], targetPath);
    const exitKey = expectNonBlankString(target.exitKey, `${targetPath}.exitKey`);
    if (!allowedExitKeys.includes(exitKey)) {
      failProjectDocument(
        `${targetPath}.exitKey`,
        `${exitKey} is not a declaration-owned normal exit key`,
      );
    }
    if (seen.has(exitKey)) {
      failProjectDocument(`${targetPath}.exitKey`, `duplicates normal exit ${exitKey}`);
    }
    seen.add(exitKey);
    const targetOccurrenceId = occurrenceId(target.occurrenceId, `${targetPath}.occurrenceId`);
    if (!occurrences.has(targetOccurrenceId)) {
      failProjectDocument(`${targetPath}.occurrenceId`, `unknown occurrence ${targetOccurrenceId}`);
    }
    return Object.freeze({ exitKey, occurrenceId: targetOccurrenceId });
  });
  return Object.freeze(
    [...targets].sort(
      (left, right) =>
        allowedExitKeys.indexOf(left.exitKey) - allowedExitKeys.indexOf(right.exitKey),
    ),
  );
}

function isTakeoverBatch(
  decision: NextRoomDecision,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  catalog: Catalog,
  biomeKey: string,
): boolean {
  return (
    decision.kind === 'exit' &&
    decision.normal.kind === 'batch' &&
    decision.normal.targets.some((target) => {
      const occurrence = occurrences.get(target.occurrenceId);
      return (
        occurrence !== undefined &&
        requireRoom(occurrence, catalog, biomeKey).prebossBatchPolicy?.kind ===
          'takeOverNormalDoors'
      );
    })
  );
}

function validateSelectedDecisionCycles(
  decisions: readonly NextRoomDecision[],
  startOccurrenceId: OccurrenceId,
  path: string,
): void {
  const decisionsBySource = new Map<OccurrenceId, ExitDecision>();
  for (const decision of decisions) {
    if (decision.kind === 'exit' && decision.source.kind === 'occurrence') {
      decisionsBySource.set(decision.source.occurrenceId, decision);
    }
  }
  const visiting = new Set<OccurrenceId>();
  const visited = new Set<OccurrenceId>();
  const visit = (occurrenceId: OccurrenceId) => {
    if (visiting.has(occurrenceId)) {
      failProjectDocument(path, 'selected topology spine contains a decision cycle');
    }
    if (visited.has(occurrenceId)) return;
    visiting.add(occurrenceId);
    const decision = decisionsBySource.get(occurrenceId);
    if (decision !== undefined) {
      const targets =
        decision.normal.kind === 'linked'
          ? [decision.normal.occurrenceId]
          : (() => {
              const selected = selectedExitKey(decision);
              return decision.normal.targets
                .filter((target) => target.exitKey === selected)
                .map((target) => target.occurrenceId);
            })();
      for (const target of targets) visit(target);
    }
    visiting.delete(occurrenceId);
    visited.add(occurrenceId);
  };
  visit(startOccurrenceId);
}

function validateStagedSelections(
  decisions: readonly NextRoomDecision[],
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  catalog: Catalog,
  layout: BiomeLayout,
  startOccurrenceId: OccurrenceId,
  path: string,
): void {
  if (
    layout.progression.kind !== 'generated' ||
    layout.progression.progressionPolicy.kind !== 'staged'
  ) {
    return;
  }
  const decisionsBySource = new Map<OccurrenceId, ExitDecision>();
  for (const decision of decisions) {
    if (decision.kind === 'exit' && decision.source.kind === 'occurrence') {
      decisionsBySource.set(decision.source.occurrenceId, decision);
    }
  }
  const traversedSources = new Set<OccurrenceId>();
  let sourceOccurrenceId: OccurrenceId | undefined = startOccurrenceId;
  let batchIndex = 0;
  while (sourceOccurrenceId !== undefined) {
    if (traversedSources.has(sourceOccurrenceId)) {
      failProjectDocument(path, 'selected topology spine contains a decision cycle');
    }
    traversedSources.add(sourceOccurrenceId);
    const decision = decisionsBySource.get(sourceOccurrenceId);
    if (decision === undefined) return;
    if (decision.normal.kind === 'linked') {
      sourceOccurrenceId = decision.normal.occurrenceId;
      continue;
    }
    if (isTakeoverBatch(decision, occurrences, catalog, layout.biomeKey)) return;
    // An empty decision is an authored envelope, not an ordinary stage. It
    // remains the active frontier until its first ordinary target exists (or a
    // takeover atomically replaces it).
    if (decision.normal.targets.length === 0) return;
    const stage = layout.progression.progressionPolicy.stages[batchIndex];
    if (stage === undefined) {
      failProjectDocument(path, 'exceeds the declared staged normal-door progression');
    }
    for (const target of decision.normal.targets) {
      const occurrence = occurrences.get(target.occurrenceId);
      if (occurrence === undefined) {
        failProjectDocument(path, `missing staged target ${target.occurrenceId}`);
      }
      if (!stage.roomGameNames.includes(occurrence.gameName)) {
        failProjectDocument(
          path,
          `${occurrence.gameName} is not available in staged pool ${stage.key}`,
        );
      }
    }
    batchIndex += 1;
    const selected = selectedExitKey(decision);
    sourceOccurrenceId = decision.normal.targets.find(
      (target) => target.exitKey === selected,
    )?.occurrenceId;
  }
}

function validateGeneratedProgressionBounds(
  decisions: readonly NextRoomDecision[],
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  catalog: Catalog,
  layout: BiomeLayout,
  startOccurrenceId: OccurrenceId,
  path: string,
): void {
  if (layout.progression.kind !== 'generated') return;
  const selectedSpine = Object.freeze({
    startOccurrenceId,
    decisions: Object.freeze([...decisions]),
  });
  const ordinaryBatchLimit = ordinaryProgressionBatchLimit(layout);
  if (ordinaryBatchLimit === undefined) return;
  const ordinaryBatches = decisions.filter(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.normal.kind === 'batch' &&
      decision.normal.targets.length > 0 &&
      !isTakeoverBatch(decision, occurrences, catalog, layout.biomeKey),
  );
  const ordinaryTargetCount = ordinaryBatches.reduce(
    (count, decision) =>
      count + (decision.normal.kind === 'batch' ? decision.normal.targets.length : 0),
    0,
  );
  if (ordinaryBatches.length > ordinaryBatchLimit) {
    failProjectDocument(`${path}.decisions`, `exceeds ${ordinaryBatchLimit} generated batches`);
  }
  if (ordinaryTargetCount > layout.progression.bounds.maxTargets) {
    failProjectDocument(
      `${path}.decisions`,
      `exceeds ${layout.progression.bounds.maxTargets} generated targets`,
    );
  }
  for (const decision of decisions) {
    if (
      decision.kind !== 'exit' ||
      decision.normal.kind !== 'batch' ||
      decision.normal.targets.length !== 0 ||
      decision.source.kind !== 'occurrence'
    ) {
      continue;
    }
    const ordinal = selectedOrdinaryBatchIndex(selectedSpine, decision.source.occurrenceId);
    if (ordinal === undefined || ordinal < ordinaryBatchLimit) continue;
    if (admitsTerminalTakeoverEnvelope(catalog, layout, selectedSpine, decision.source)) continue;
    failProjectDocument(`${path}.decisions`, `exceeds ${ordinaryBatchLimit} generated batches`);
  }
}

function prebossRole(room: RoomDeclaration, targetIndex: number, path: string): RoomOccurrenceRole {
  if (room.kind !== 'Preboss') return 'ordinary';
  const policy = room.prebossBatchPolicy;
  if (policy === undefined) {
    failProjectDocument(path, `${room.gameName} has no preboss batch policy`);
  }
  if (policy.kind === 'retainNormalPeers' || targetIndex === 0) return 'prebossShop';
  if (policy.remainingOffers.kind !== 'counted') {
    failProjectDocument(path, `${room.gameName} cannot fill remaining normal exits`);
  }
  return 'prebossFreeReward';
}

function validateTakeoverBatch(
  targets: readonly ExitTargetReference[],
  declarationExitKeys: readonly string[],
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  catalog: Catalog,
  biomeKey: string,
  path: string,
): void {
  const targetRooms = targets.map((target) => {
    const occurrence = occurrences.get(target.occurrenceId);
    if (occurrence === undefined)
      failProjectDocument(path, `missing target ${target.occurrenceId}`);
    return requireRoom(occurrence, catalog, biomeKey);
  });
  const retainedCounts = new Map<string, number>();
  for (const room of targetRooms) {
    if (room.prebossBatchPolicy?.kind !== 'retainNormalPeers') continue;
    const count = (retainedCounts.get(room.gameName) ?? 0) + 1;
    retainedCounts.set(room.gameName, count);
    if (count > 1) {
      failProjectDocument(path, `${room.gameName} may appear only once in one normal-door batch`);
    }
  }
  const takeover = targetRooms.find(
    (room) => room.prebossBatchPolicy?.kind === 'takeOverNormalDoors',
  );
  if (takeover === undefined) return;
  const normalExitSequence = declarationExitKeys.every(
    (exitKey, index) => exitKey === `exit${index + 1}`,
  );
  const ownsOrderedExitSequence = normalExitSequence
    ? targets.every((target, index) => target.exitKey === `exit${index + 1}`)
    : targets.length === declarationExitKeys.length &&
      targets.every((target, index) => target.exitKey === declarationExitKeys[index]);
  if (!ownsOrderedExitSequence) {
    failProjectDocument(
      path,
      'a takeover preboss batch must own every normal exit in declaration order',
    );
  }
  if (targetRooms.some((room) => room.gameName !== takeover.gameName)) {
    failProjectDocument(
      path,
      'a takeover preboss batch cannot contain ordinary or mixed declarations',
    );
  }
  if (
    takeover.prebossBatchPolicy?.kind === 'takeOverNormalDoors' &&
    takeover.prebossBatchPolicy.remainingOffers.kind === 'none' &&
    targets.length !== 1
  ) {
    failProjectDocument(
      path,
      `${takeover.gameName} has no remaining offers for this multi-exit batch`,
    );
  }
}

function decodeExitDecision(
  raw: RawDecision,
  layout: BiomeLayout,
  catalog: Catalog,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
): ExitDecision {
  const value = raw.value;
  expectExactKeys(value, ['kind', 'source', 'normal', 'selection'], raw.path);
  const source = decodeSource(value.source, `${raw.path}.source`);
  let sourceRoom: RoomDeclaration | undefined;
  if (source.kind === 'occurrence') {
    const occurrence = occurrences.get(source.occurrenceId);
    if (occurrence === undefined) {
      failProjectDocument(
        `${raw.path}.source.occurrenceId`,
        `unknown occurrence ${source.occurrenceId}`,
      );
    }
    sourceRoom = requireRoom(occurrence, catalog, layout.biomeKey);
  } else if (
    layout.progression.kind !== 'hub' ||
    source.decisionKey !== layout.progression.hubKey
  ) {
    failProjectDocument(
      `${raw.path}.source.decisionKey`,
      `${source.decisionKey} is not a Hub decision in ${layout.biomeKey}`,
    );
  }
  const normal = expectRecord(value.normal, `${raw.path}.normal`);
  const normalKind = expectString(normal.kind, `${raw.path}.normal.kind`);
  if (normalKind === 'linked') {
    expectExactKeys(normal, ['kind', 'exitKey', 'occurrenceId'], `${raw.path}.normal`);
    if (layout.progression.kind !== 'hub' || source.kind !== 'occurrence') {
      failProjectDocument(
        `${raw.path}.normal`,
        'linked exits are only declared by a Hub progression',
      );
    }
    const exitKey = expectNonBlankString(normal.exitKey, `${raw.path}.normal.exitKey`);
    if (exitKey !== layout.progression.linkedExit.exitKey) {
      failProjectDocument(
        `${raw.path}.normal.exitKey`,
        `expected ${layout.progression.linkedExit.exitKey}`,
      );
    }
    const targetId = occurrenceId(normal.occurrenceId, `${raw.path}.normal.occurrenceId`);
    const target = occurrences.get(targetId);
    if (target === undefined)
      failProjectDocument(`${raw.path}.normal.occurrenceId`, `unknown occurrence ${targetId}`);
    if (target.gameName !== layout.progression.linkedExit.roomGameName) {
      failProjectDocument(
        `${target.path}.gameName`,
        `linked exit requires ${layout.progression.linkedExit.roomGameName}`,
      );
    }
    const selection = decodeSelection(value.selection, [exitKey], `${raw.path}.selection`);
    return Object.freeze({
      kind: 'exit',
      source,
      normal: Object.freeze({ kind: 'linked', exitKey, occurrenceId: targetId }),
      selection,
    });
  }
  if (normalKind !== 'batch') {
    failProjectDocument(`${raw.path}.normal.kind`, `unknown normal exit form ${normalKind}`);
  }
  expectExactKeys(normal, ['kind', 'rewardStore', 'batchState', 'targets'], `${raw.path}.normal`);
  if (source.kind === 'hubDecision' && layout.progression.kind !== 'hub') {
    failProjectDocument(raw.path, 'Hub source requires Hub progression');
  }
  if (source.kind === 'occurrence' && layout.progression.kind !== 'generated') {
    failProjectDocument(
      raw.path,
      'occurrence-sourced normal batches require generated progression',
    );
  }
  const declarationExitKeys =
    source.kind === 'hubDecision'
      ? [
          layout.progression.kind === 'hub'
            ? layout.progression.completedExit.exitKey
            : failProjectDocument(raw.path, 'Hub source requires Hub progression'),
        ]
      : sourceRoom === undefined
        ? failProjectDocument(raw.path, 'occurrence source requires a Room Declaration')
        : normalExitKeys(sourceRoom);
  const allowedExitKeys =
    source.kind === 'hubDecision'
      ? declarationExitKeys
      : Object.freeze([
          ...declarationExitKeys,
          ...possibleNormalExitKeys(catalog, layout.biomeKey).filter(
            (exitKey) => !declarationExitKeys.includes(exitKey),
          ),
        ]);
  const targets = decodeTargets(
    normal.targets,
    occurrences,
    allowedExitKeys,
    `${raw.path}.normal.targets`,
  );
  if (source.kind === 'hubDecision') {
    const hub = layout.progression;
    if (hub.kind !== 'hub') failProjectDocument(raw.path, 'Hub source requires Hub progression');
    const targetReference = targets[0];
    if (targets.length !== 1 || targetReference?.exitKey !== hub.completedExit.exitKey) {
      failProjectDocument(
        `${raw.path}.normal.targets`,
        'completed Hub requires its fixed width-one preboss exit',
      );
    }
    if (targetReference === undefined)
      failProjectDocument(raw.path, 'completed Hub target is missing');
    const target = occurrences.get(targetReference.occurrenceId);
    if (target?.gameName !== hub.completedExit.roomGameName) {
      failProjectDocument(
        `${raw.path}.normal.targets[0]`,
        `completed Hub requires ${hub.completedExit.roomGameName}`,
      );
    }
  }
  const selection = decodeSelection(
    value.selection,
    targets.map((target) => target.exitKey),
    `${raw.path}.selection`,
  );
  validateTakeoverBatch(
    targets,
    declarationExitKeys,
    occurrences,
    catalog,
    layout.biomeKey,
    `${raw.path}.normal.targets`,
  );
  const takeover = targets.some((target) => {
    const occurrence = occurrences.get(target.occurrenceId);
    return (
      occurrence !== undefined &&
      catalog.rooms.byKey[occurrence.gameName]?.prebossBatchPolicy?.kind === 'takeOverNormalDoors'
    );
  });
  const batchState: AuthoredBatchState = takeover
    ? decodeBatchState(
        normal.batchState,
        { kind: 'standard', fields: [] },
        `${raw.path}.normal.batchState`,
      )
    : layout.progression.kind === 'generated'
      ? decodeBatchState(
          normal.batchState,
          layout.progression.batchPolicy,
          `${raw.path}.normal.batchState`,
        )
      : decodeBatchState(
          normal.batchState,
          { kind: 'standard', fields: [] },
          `${raw.path}.normal.batchState`,
        );
  return Object.freeze({
    kind: 'exit',
    source,
    normal: Object.freeze({
      kind: 'batch',
      rewardStore: rewardStoreFor(
        layout,
        source,
        sourceRoom,
        normal.rewardStore,
        `${raw.path}.normal.rewardStore`,
      ),
      batchState,
      targets,
    }),
    selection,
  });
}

function decodeHubDecision(
  raw: RawDecision,
  layout: Extract<BiomeLayout, { readonly progression: { readonly kind: 'hub' } }> | BiomeLayout,
  catalog: Catalog,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
): HubDecision {
  if (layout.progression.kind !== 'hub') {
    failProjectDocument(raw.path, `${layout.biomeKey} has no Hub decision`);
  }
  const hub = layout.progression;
  const value = raw.value;
  expectExactKeys(value, ['kind', 'hubKey', 'openTargets', 'visitOrder'], raw.path);
  const hubKey = expectNonBlankString(value.hubKey, `${raw.path}.hubKey`);
  if (hubKey !== hub.hubKey) failProjectDocument(`${raw.path}.hubKey`, `expected ${hub.hubKey}`);
  const rawTargets = expectArray(value.openTargets, `${raw.path}.openTargets`);
  if (rawTargets.length > hub.openCount.max)
    failProjectDocument(`${raw.path}.openTargets`, `exceeds ${hub.openCount.max} Hub slots`);
  const slotByKey = new Map(hub.slots.map((slot) => [slot.slotKey, slot]));
  const seenSlots = new Set<string>();
  const openTargets = rawTargets.map((rawTarget, index): HubTargetReference => {
    const targetPath = `${raw.path}.openTargets[${index}]`;
    const target = expectRecord(rawTarget, targetPath);
    expectExactKeys(target, ['hubSlotKey', 'occurrenceId'], targetPath);
    const hubSlotKey = expectNonBlankString(target.hubSlotKey, `${targetPath}.hubSlotKey`);
    const slot = slotByKey.get(hubSlotKey);
    if (slot === undefined)
      failProjectDocument(`${targetPath}.hubSlotKey`, `unknown Hub slot ${hubSlotKey}`);
    if (seenSlots.has(hubSlotKey))
      failProjectDocument(`${targetPath}.hubSlotKey`, `duplicates Hub slot ${hubSlotKey}`);
    seenSlots.add(hubSlotKey);
    const id = occurrenceId(target.occurrenceId, `${targetPath}.occurrenceId`);
    const occurrence = occurrences.get(id);
    if (occurrence === undefined)
      failProjectDocument(`${targetPath}.occurrenceId`, `unknown occurrence ${id}`);
    if (occurrence.gameName !== slot.roomGameName)
      failProjectDocument(`${occurrence.path}.gameName`, `Hub slot requires ${slot.roomGameName}`);
    return Object.freeze({ hubSlotKey, occurrenceId: id });
  });
  for (const constraint of hub.openSlotConstraints) {
    if (
      constraint.kind === 'maxOpenFromSlots' &&
      openTargets.filter((target) => constraint.slotKeys.includes(target.hubSlotKey)).length >
        constraint.max
    ) {
      failProjectDocument(
        `${raw.path}.openTargets`,
        `exceeds Hub open-slot constraint for ${constraint.slotKeys.join(', ')}`,
      );
    }
  }
  const visitOrder = expectArray(value.visitOrder, `${raw.path}.visitOrder`).map((visit, index) =>
    expectNonBlankString(visit, `${raw.path}.visitOrder[${index}]`),
  );
  if (visitOrder.length > hub.requiredVisits)
    failProjectDocument(`${raw.path}.visitOrder`, `exceeds ${hub.requiredVisits} Hub visits`);
  const visited = new Set<string>();
  for (const [index, slotKey] of visitOrder.entries()) {
    if (!seenSlots.has(slotKey))
      failProjectDocument(`${raw.path}.visitOrder[${index}]`, `${slotKey} is not open`);
    if (visited.has(slotKey))
      failProjectDocument(`${raw.path}.visitOrder[${index}]`, `duplicates Hub visit ${slotKey}`);
    visited.add(slotKey);
  }
  return Object.freeze({
    kind: 'hub',
    hubKey,
    openTargets: Object.freeze(openTargets),
    visitOrder: Object.freeze(visitOrder),
  });
}

export function decodeBiomeTopology(
  value: unknown,
  catalog: Catalog,
  layout: BiomeLayout,
  path: string,
): BiomeTopology {
  const topology = expectRecord(value, path);
  expectExactKeys(topology, ['startOccurrenceId', 'occurrences', 'decisions'], path);
  const rawOccurrences = expectArray(topology.occurrences, `${path}.occurrences`);
  const occurrences = new Map<OccurrenceId, RawOccurrence>();
  for (const [index, rawValue] of rawOccurrences.entries()) {
    const occurrencePath = `${path}.occurrences[${index}]`;
    const occurrence = expectRecord(rawValue, occurrencePath);
    expectExactKeys(occurrence, ['occurrenceId', 'gameName', 'state'], occurrencePath);
    const id = occurrenceId(occurrence.occurrenceId, `${occurrencePath}.occurrenceId`);
    if (occurrences.has(id))
      failProjectDocument(`${occurrencePath}.occurrenceId`, `duplicates occurrence ${id}`);
    occurrences.set(
      id,
      Object.freeze({
        occurrenceId: id,
        gameName: expectNonBlankString(occurrence.gameName, `${occurrencePath}.gameName`),
        state: occurrence.state,
        path: occurrencePath,
      }),
    );
  }
  const startOccurrenceId = occurrenceId(topology.startOccurrenceId, `${path}.startOccurrenceId`);
  const start = occurrences.get(startOccurrenceId);
  if (start === undefined)
    failProjectDocument(`${path}.startOccurrenceId`, `unknown occurrence ${startOccurrenceId}`);
  const startRoom = requireRoom(start, catalog, layout.biomeKey);
  const validStartNames =
    layout.start.kind === 'authoredChoice'
      ? layout.start.roomGameNames
      : [layout.start.roomGameName];
  if (!validStartNames.includes(startRoom.gameName)) {
    failProjectDocument(
      `${start.path}.gameName`,
      `${startRoom.gameName} is not a declared start room`,
    );
  }

  const rawDecisions = expectArray(topology.decisions, `${path}.decisions`).map(
    (value, index): RawDecision => ({
      value: expectRecord(value, `${path}.decisions[${index}]`),
      path: `${path}.decisions[${index}]`,
    }),
  );
  const decisionSources = new Set<string>();
  const decisions: NextRoomDecision[] = [];
  for (const raw of rawDecisions) {
    const kind = expectString(raw.value.kind, `${raw.path}.kind`);
    const decision =
      kind === 'exit'
        ? decodeExitDecision(raw, layout, catalog, occurrences)
        : kind === 'hub'
          ? decodeHubDecision(raw, layout, catalog, occurrences)
          : failProjectDocument(`${raw.path}.kind`, `unknown decision ${kind}`);
    const identity =
      decision.kind === 'exit'
        ? `exit:${sourceKey(decision.source)}`
        : `hubDecision:${decision.hubKey}`;
    if (decisionSources.has(identity))
      failProjectDocument(raw.path, `duplicates decision source ${identity}`);
    decisionSources.add(identity);
    decisions.push(decision);
  }
  validateGeneratedProgressionBounds(
    decisions,
    occurrences,
    catalog,
    layout,
    startOccurrenceId,
    path,
  );
  validateStagedSelections(decisions, occurrences, catalog, layout, startOccurrenceId, path);
  validateSelectedDecisionCycles(decisions, startOccurrenceId, path);

  const hubDecision = decisions.find(
    (decision): decision is HubDecision => decision.kind === 'hub',
  );
  const linkedDecisions = decisions.filter(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' && decision.normal.kind === 'linked',
  );
  const linkedDecision = linkedDecisions[0];
  const hasSoleStartOwnedLinkedExit =
    linkedDecisions.length === 1 &&
    linkedDecision?.source.kind === 'occurrence' &&
    linkedDecision.source.occurrenceId === startOccurrenceId;
  if (linkedDecisions.length > 0 && !hasSoleStartOwnedLinkedExit) {
    failProjectDocument(
      `${path}.decisions`,
      'a Hub progression has exactly one linked PreHub exit owned by the declared start occurrence',
    );
  }
  if (hubDecision !== undefined) {
    if (!hasSoleStartOwnedLinkedExit) {
      failProjectDocument(
        `${path}.decisions`,
        'Hub decision is detached from its linked PreHub exit',
      );
    }
  }
  const selectedSources = new Set<OccurrenceId>([startOccurrenceId]);
  let addedSelectedSource = true;
  while (addedSelectedSource) {
    addedSelectedSource = false;
    for (const decision of decisions) {
      if (decision.kind !== 'exit' || decision.source.kind !== 'occurrence') continue;
      if (!selectedSources.has(decision.source.occurrenceId)) continue;
      const targets =
        decision.normal.kind === 'linked'
          ? [decision.normal.occurrenceId]
          : (() => {
              const selected = selectedExitKey(decision);
              return decision.normal.targets
                .filter((target) => target.exitKey === selected)
                .map((target) => target.occurrenceId);
            })();
      for (const target of targets) {
        if (!selectedSources.has(target)) {
          selectedSources.add(target);
          addedSelectedSource = true;
        }
      }
    }
  }
  for (const [index, decision] of decisions.entries()) {
    const decisionPath = rawDecisions[index]?.path ?? path;
    if (decision.kind !== 'exit') continue;
    if (
      decision.source.kind === 'occurrence' &&
      !selectedSources.has(decision.source.occurrenceId)
    ) {
      failProjectDocument(
        `${decisionPath}.source.occurrenceId`,
        'source is not on the selected topology spine',
      );
    }
    if (decision.source.kind === 'hubDecision') {
      if (hubDecision === undefined) {
        failProjectDocument(
          `${decisionPath}.source`,
          'completed-Hub exit requires its Hub decision',
        );
      }
      if (
        layout.progression.kind !== 'hub' ||
        hubDecision.openTargets.length < layout.progression.openCount.min ||
        hubDecision.visitOrder.length !== layout.progression.requiredVisits
      ) {
        failProjectDocument(`${decisionPath}.source`, 'completed-Hub exit requires a complete Hub');
      }
    }
    if (decision.source.kind === 'occurrence') {
      const source = occurrences.get(decision.source.occurrenceId);
      if (
        source !== undefined &&
        requireRoom(source, catalog, layout.biomeKey).kind === 'Preboss'
      ) {
        failProjectDocument(
          `${decisionPath}.source`,
          'a selected Preboss closes editable traversal',
        );
      }
    }
  }

  const owners = new Map<OccurrenceId, OccurrenceOwner>();
  const own = (id: OccurrenceId, owner: OccurrenceOwner) => {
    if (owners.has(id))
      failProjectDocument(owner.path, `occurrence ${id} has multiple structural owners`);
    owners.set(id, owner);
  };
  own(startOccurrenceId, {
    gameName: startRoom.gameName,
    role: 'ordinary',
    entryActive: true,
    path: start.path,
  });
  for (const [index, decision] of decisions.entries()) {
    const decisionPath = rawDecisions[index]?.path ?? path;
    if (decision.kind === 'hub') {
      for (const target of decision.openTargets) {
        const slot =
          layout.progression.kind === 'hub'
            ? layout.progression.slots.find((candidate) => candidate.slotKey === target.hubSlotKey)
            : undefined;
        if (slot === undefined)
          failProjectDocument(decisionPath, `unknown normalized Hub slot ${target.hubSlotKey}`);
        own(target.occurrenceId, {
          gameName: slot.roomGameName,
          role: 'ordinary',
          entryActive: decision.visitOrder.includes(target.hubSlotKey),
          path: `${decisionPath}.openTargets`,
        });
      }
      continue;
    }
    if (decision.normal.kind === 'linked') {
      own(decision.normal.occurrenceId, {
        gameName:
          layout.progression.kind === 'hub' ? layout.progression.linkedExit.roomGameName : '',
        role: 'ordinary',
        entryActive: true,
        path: `${decisionPath}.normal.occurrenceId`,
      });
      continue;
    }
    const selected = selectedExitKey(decision);
    for (const [targetIndex, target] of decision.normal.targets.entries()) {
      const rawOccurrence = occurrences.get(target.occurrenceId);
      if (rawOccurrence === undefined)
        failProjectDocument(decisionPath, `unknown target ${target.occurrenceId}`);
      const room = requireRoom(rawOccurrence, catalog, layout.biomeKey);
      own(target.occurrenceId, {
        gameName: room.gameName,
        role: prebossRole(room, targetIndex, `${decisionPath}.normal.targets[${targetIndex}]`),
        entryActive: selected === target.exitKey,
        path: `${decisionPath}.normal.targets[${targetIndex}].occurrenceId`,
      });
    }
  }
  if (owners.size !== occurrences.size) {
    const orphan = [...occurrences.values()].find(
      (occurrence) => !owners.has(occurrence.occurrenceId),
    );
    if (orphan !== undefined)
      failProjectDocument(orphan.path, `occurrence ${orphan.occurrenceId} has no structural owner`);
  }
  const normalizedOccurrences = [...occurrences.values()].map((rawOccurrence): RoomOccurrence => {
    const owner = owners.get(rawOccurrence.occurrenceId);
    if (owner === undefined) failProjectDocument(rawOccurrence.path, 'has no owner');
    if (owner.gameName !== rawOccurrence.gameName)
      failProjectDocument(`${rawOccurrence.path}.gameName`, `owner requires ${owner.gameName}`);
    const room = requireRoom(rawOccurrence, catalog, layout.biomeKey);
    return Object.freeze({
      occurrenceId: rawOccurrence.occurrenceId,
      gameName: room.gameName,
      state: decodeRoomState(
        rawOccurrence.state,
        catalog,
        room,
        owner,
        `${rawOccurrence.path}.state`,
      ),
    });
  });
  return Object.freeze({
    startOccurrenceId,
    occurrences: Object.freeze(normalizedOccurrences),
    decisions: Object.freeze(decisions),
  });
}

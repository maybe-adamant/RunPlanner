import type { BiomeLayout, Catalog, RoomDeclaration } from '../../../catalog-schema';
import { decodeBatchState } from '../../batchState';
import { decodeFountainRarityResult } from '../../fountain-rarity-codec';
import type {
  AuthoredBatchState,
  BatchRewardStoreState,
  ExitDecision,
  ExitDecisionSource,
  ExitSelection,
  ExitTargetReference,
  HubAction,
  HubDecision,
  HubTargetReference,
  LocalVisitDecision,
  OccurrenceId,
} from '../../model';
import {
  declaredPhysicalExitsForSourceRoom,
  normalDecisionProgressionForLayout,
  possibleGeneratedNormalExitKeys,
} from '../query';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../../validation';
import {
  occurrenceId,
  requireHostRoom,
  requireKnownRoom,
  type AdditionalExitsFor,
  type RawDecision,
  type RawOccurrence,
} from './raw';

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

function decodeSelection(
  value: unknown,
  targetKeys: readonly string[],
  additionalExitKeys: readonly string[],
  path: string,
): ExitSelection {
  const selection = expectRecord(value, path);
  const kind = expectString(selection.kind, `${path}.kind`);
  if (kind === 'derived' || kind === 'unresolved') {
    expectExactKeys(selection, ['kind'], path);
    if (kind === 'derived' && targetKeys.length !== 1) {
      failProjectDocument(path, 'derived selection requires exactly one normal exit');
    }
    if (kind === 'derived' && additionalExitKeys.length > 0) {
      failProjectDocument(
        path,
        'derived selection cannot coexist with an authored additional exit',
      );
    }
    if (kind === 'unresolved' && targetKeys.length === 1 && additionalExitKeys.length === 0) {
      failProjectDocument(path, 'a width-one normal exit must use derived selection');
    }
    return Object.freeze({ kind });
  }
  if (kind === 'additional') {
    expectExactKeys(selection, ['kind', 'additionalExitKey'], path);
    const additionalExitKey = expectNonBlankString(
      selection.additionalExitKey,
      `${path}.additionalExitKey`,
    );
    if (!additionalExitKeys.includes(additionalExitKey)) {
      failProjectDocument(
        `${path}.additionalExitKey`,
        `${additionalExitKey} is not an authored additional exit in this decision`,
      );
    }
    return Object.freeze({ kind, additionalExitKey });
  }
  if (kind !== 'normal') {
    failProjectDocument(`${path}.kind`, `unknown exit selection ${kind}`);
  }
  expectExactKeys(selection, ['kind', 'exitKey'], path);
  if (targetKeys.length === 1 && additionalExitKeys.length === 0) {
    failProjectDocument(path, 'a width-one normal exit must use derived selection');
  }
  const exitKey = expectNonBlankString(selection.exitKey, `${path}.exitKey`);
  if (!targetKeys.includes(exitKey)) {
    failProjectDocument(`${path}.exitKey`, `${exitKey} is not a normal exit in this decision`);
  }
  return Object.freeze({ kind, exitKey });
}

function rewardStoreFor(
  layout: BiomeLayout,
  source: ExitDecisionSource,
  sourceRoom: RoomDeclaration | undefined,
  raw: unknown,
  path: string,
): BatchRewardStoreState {
  const progression = normalDecisionProgressionForLayout(layout);
  const sourceRoomTemplateKey =
    sourceRoom?.mode.kind === 'authored' ? sourceRoom.mode.templateKey : undefined;
  const policy =
    source.kind === 'occurrence' && sourceRoomTemplateKey !== undefined && progression !== undefined
      ? (progression.rewardStoreOverrides.find(
          (override) => override.sourceRoomTemplateKey === sourceRoomTemplateKey,
        )?.policy ?? progression.rewardStorePolicy)
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

function validateTakeoverBatch(
  targets: readonly ExitTargetReference[],
  declarationExitKeys: readonly string[],
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  catalog: Catalog,
  path: string,
): void {
  const targetRooms = targets.map((target) => {
    const occurrence = occurrences.get(target.occurrenceId);
    if (occurrence === undefined)
      failProjectDocument(path, `missing target ${target.occurrenceId}`);
    return requireKnownRoom(occurrence, catalog);
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

export function decodeExitDecision(
  raw: RawDecision,
  layout: BiomeLayout,
  catalog: Catalog,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  additionalExitsFor: AdditionalExitsFor,
  startOccurrenceId: OccurrenceId,
): ExitDecision {
  const value = raw.value;
  expectExactKeys(value, ['kind', 'source', 'normal', 'selection'], raw.path);
  const source = decodeSource(value.source, `${raw.path}.source`);
  const progression = normalDecisionProgressionForLayout(layout);
  let sourceRoom: RoomDeclaration | undefined;
  if (source.kind === 'occurrence') {
    const occurrence = occurrences.get(source.occurrenceId);
    if (occurrence === undefined) {
      failProjectDocument(
        `${raw.path}.source.occurrenceId`,
        `unknown occurrence ${source.occurrenceId}`,
      );
    }
    sourceRoom = requireKnownRoom(occurrence, catalog);
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
  if (normalKind !== 'batch') {
    failProjectDocument(`${raw.path}.normal.kind`, `unknown normal exit form ${normalKind}`);
  }
  expectExactKeys(normal, ['kind', 'rewardStore', 'batchState', 'targets'], `${raw.path}.normal`);
  if (source.kind === 'hubDecision' && layout.progression.kind !== 'hub') {
    failProjectDocument(raw.path, 'Hub source requires Hub progression');
  }
  if (source.kind === 'occurrence' && progression === undefined) {
    failProjectDocument(
      raw.path,
      'occurrence-sourced normal batches require a normal decision progression',
    );
  }
  const declarationExits = declaredPhysicalExitsForSourceRoom(
    layout,
    startOccurrenceId,
    source,
    sourceRoom,
  );
  if (declarationExits === undefined) {
    failProjectDocument(raw.path, 'source has no declaration-owned normal exits');
  }
  const declarationExitKeys = declarationExits.map((exit) => exit.exitKey);
  // Generated sources may retain an incompatible declaration-owned key after
  // explicit room replacement until capacity repair. The bounded Hub entry is
  // fixed to `prehub`, while its later terminal source has no ordinary key;
  // neither accepts a retained ordinary target outside that exact declaration.
  const retainsAlternativeExitKeys =
    source.kind === 'occurrence' &&
    sourceRoom?.roomSetKey === layout.biomeKey &&
    declarationExitKeys.length > 0 &&
    layout.progression.kind !== 'hub';
  const allowedExitKeys = retainsAlternativeExitKeys
    ? Object.freeze([
        ...declarationExitKeys,
        ...possibleGeneratedNormalExitKeys(catalog, layout).filter(
          (exitKey) => !declarationExitKeys.includes(exitKey),
        ),
      ])
    : declarationExitKeys;
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
  const additional =
    source.kind === 'occurrence'
      ? additionalExitsFor(source.occurrenceId, `${raw.path}.source.occurrenceId.additionalExits`)
      : Object.freeze([]);
  const selection = decodeSelection(
    value.selection,
    targets.map((target) => target.exitKey),
    additional.map((exit) => exit.key),
    `${raw.path}.selection`,
  );
  validateTakeoverBatch(
    targets,
    declarationExitKeys,
    occurrences,
    catalog,
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
    : source.kind === 'occurrence' && progression !== undefined
      ? decodeBatchState(
          normal.batchState,
          progression.batchPolicy,
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

export function decodeHubDecision(
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
  const hasFountainRarityResult = Object.hasOwn(value, 'fountainRarityResult');
  expectExactKeys(
    value,
    [
      'kind',
      'hubKey',
      'source',
      'openTargets',
      'actions',
      ...(hasFountainRarityResult ? ['fountainRarityResult'] : []),
    ],
    raw.path,
  );
  const hubKey = expectNonBlankString(value.hubKey, `${raw.path}.hubKey`);
  if (hubKey !== hub.hubKey) failProjectDocument(`${raw.path}.hubKey`, `expected ${hub.hubKey}`);
  const source = decodeSource(value.source, `${raw.path}.source`);
  if (source.kind !== 'occurrence') {
    failProjectDocument(`${raw.path}.source`, 'Hub decision source must be an occurrence');
  }
  const sourceOccurrence = occurrences.get(source.occurrenceId);
  if (sourceOccurrence === undefined) {
    failProjectDocument(
      `${raw.path}.source.occurrenceId`,
      `unknown occurrence ${source.occurrenceId}`,
    );
  }
  // A Hub source is normally the biome-owned PreHub occurrence, but a selected
  // Chaos detour can occupy the same terminal spine position. The
  // selected-spine validation below proves that exact ownership and rejects
  // every other foreign-room source.
  requireKnownRoom(sourceOccurrence, catalog);
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
  const actions = expectArray(value.actions, `${raw.path}.actions`).map(
    (rawAction, index): HubAction => {
      const actionPath = `${raw.path}.actions[${index}]`;
      const action = expectRecord(rawAction, actionPath);
      const kind = expectString(action.kind, `${actionPath}.kind`);
      if (kind === 'useFountain') {
        expectExactKeys(action, ['kind'], actionPath);
        return Object.freeze({ kind: 'useFountain' });
      }
      if (kind !== 'roomVisit')
        failProjectDocument(`${actionPath}.kind`, `unknown Hub action ${kind}`);
      expectExactKeys(action, ['kind', 'hubSlotKey'], actionPath);
      return Object.freeze({
        kind: 'roomVisit',
        hubSlotKey: expectNonBlankString(action.hubSlotKey, `${actionPath}.hubSlotKey`),
      });
    },
  );
  const visited = new Set<string>();
  let fountainUsed = false;
  for (const [index, action] of actions.entries()) {
    const actionPath = `${raw.path}.actions[${index}]`;
    if (action.kind === 'useFountain') {
      if (fountainUsed) failProjectDocument(actionPath, 'duplicates the Hub fountain use');
      fountainUsed = true;
      continue;
    }
    if (!seenSlots.has(action.hubSlotKey))
      failProjectDocument(`${actionPath}.hubSlotKey`, `${action.hubSlotKey} is not open`);
    if (visited.has(action.hubSlotKey))
      failProjectDocument(`${actionPath}.hubSlotKey`, `duplicates Hub visit ${action.hubSlotKey}`);
    visited.add(action.hubSlotKey);
  }
  if (visited.size > hub.requiredVisits)
    failProjectDocument(`${raw.path}.actions`, `exceeds ${hub.requiredVisits} Hub visits`);
  const fountainRarityResult = hasFountainRarityResult
    ? decodeFountainRarityResult(
        value.fountainRarityResult,
        catalog,
        `${raw.path}.fountainRarityResult`,
      )
    : undefined;
  if (fountainRarityResult !== undefined && !fountainUsed)
    failProjectDocument(`${raw.path}.fountainRarityResult`, 'requires the planned fountain use');
  return Object.freeze({
    kind: 'hub',
    hubKey,
    source,
    openTargets: Object.freeze(openTargets),
    actions: Object.freeze(actions),
    ...(fountainRarityResult === undefined ? {} : { fountainRarityResult }),
  });
}

export function decodeLocalVisitDecision(
  raw: RawDecision,
  layout: BiomeLayout,
  catalog: Catalog,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
): LocalVisitDecision {
  const value = raw.value;
  expectExactKeys(
    value,
    ['kind', 'sourceOccurrenceId', 'groupKey', 'targetsBySlot', 'visitOrder'],
    raw.path,
  );
  const sourceOccurrenceId = occurrenceId(
    value.sourceOccurrenceId,
    `${raw.path}.sourceOccurrenceId`,
  );
  const source = occurrences.get(sourceOccurrenceId);
  if (source === undefined) {
    failProjectDocument(
      `${raw.path}.sourceOccurrenceId`,
      `unknown occurrence ${sourceOccurrenceId}`,
    );
  }
  const sourceRoom = requireHostRoom(source, catalog, layout.biomeKey);
  const groupKey = expectNonBlankString(value.groupKey, `${raw.path}.groupKey`);
  const descriptor = sourceRoom.localChildren.find((group) => group.key === groupKey);
  if (descriptor?.kind !== 'fixedRoomSlots') {
    failProjectDocument(
      `${raw.path}.groupKey`,
      `${sourceRoom.gameName} has no local group ${groupKey}`,
    );
  }
  const targets = expectRecord(value.targetsBySlot, `${raw.path}.targetsBySlot`);
  expectExactKeys(
    targets,
    descriptor.slots.map((slot) => slot.slotKey),
    `${raw.path}.targetsBySlot`,
  );
  const seenOccurrences = new Set<OccurrenceId>();
  const targetsBySlot = Object.fromEntries(
    descriptor.slots.map((slot) => {
      const targetPath = `${raw.path}.targetsBySlot.${slot.slotKey}`;
      const target = expectRecord(targets[slot.slotKey], targetPath);
      expectExactKeys(target, ['occurrenceId', 'generation'], targetPath);
      const id = occurrenceId(target.occurrenceId, `${targetPath}.occurrenceId`);
      if (seenOccurrences.has(id)) {
        failProjectDocument(`${targetPath}.occurrenceId`, `duplicates local occurrence ${id}`);
      }
      seenOccurrences.add(id);
      const child = occurrences.get(id);
      if (child === undefined)
        failProjectDocument(`${targetPath}.occurrenceId`, `unknown occurrence ${id}`);
      if (child.gameName !== slot.roomGameName) {
        failProjectDocument(`${child.path}.gameName`, `local slot requires ${slot.roomGameName}`);
      }
      const generation = expectString(target.generation, `${targetPath}.generation`);
      if (generation !== 'generated' && generation !== 'notGenerated') {
        failProjectDocument(`${targetPath}.generation`, 'must be generated or notGenerated');
      }
      return [slot.slotKey, Object.freeze({ occurrenceId: id, generation })];
    }),
  );
  const visitOrder = expectArray(value.visitOrder, `${raw.path}.visitOrder`).map((entry, index) =>
    occurrenceId(entry, `${raw.path}.visitOrder[${index}]`),
  );
  if (new Set(visitOrder).size !== visitOrder.length) {
    failProjectDocument(`${raw.path}.visitOrder`, 'must contain distinct local occurrences');
  }
  for (const id of visitOrder) {
    const target = Object.values(targetsBySlot).find((candidate) => candidate.occurrenceId === id);
    if (target === undefined)
      failProjectDocument(`${raw.path}.visitOrder`, `unknown local occurrence ${id}`);
    if (target.generation !== 'generated') {
      failProjectDocument(`${raw.path}.visitOrder`, `${id} must be generated before entry`);
    }
  }
  return Object.freeze({
    kind: 'localVisit',
    sourceOccurrenceId,
    groupKey,
    targetsBySlot: Object.freeze(targetsBySlot),
    visitOrder: Object.freeze(visitOrder),
  });
}

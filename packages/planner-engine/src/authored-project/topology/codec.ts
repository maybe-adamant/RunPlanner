import type { BiomeLayout, Catalog, RoomDeclaration } from '../../catalog-schema';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import { decodeBatchState } from '../batchState';
import type {
  AnomalyReplacementProvenance,
  AuthoredBatchState,
  AuthoredAdditionalExit,
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
  AuthoredRewardState,
} from '../model';
import { decodeRewardState, decodeRoomState } from '../room-state/codec';
import { optionIndex } from '../traits';
import { decodeRoomEncounterState } from '../room-state/encounters';
import { requireCountedBinding, type RoomOccurrenceRole } from '../room-state/declaration';
import {
  admitsTerminalTakeoverEnvelope,
  hostContinuationExitForDetourRoom,
  declaredPhysicalExitsForSourceRoom,
  hubDecisionHandoffReadiness,
  hubTerminalTakeoverForSource,
  isExactTerminalTakeoverEnvelope,
  normalDecisionProgressionForLayout,
  ordinaryProgressionBatchLimit,
  possibleGeneratedNormalExitKeys,
  selectedExitContinuation,
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
  readonly anomalyReplacement: unknown;
  readonly hasAnomalyReplacement: boolean;
  readonly state: unknown;
  readonly encounters: unknown;
  readonly additionalExits: unknown;
  readonly acquisitionSites: unknown;
  readonly hasAcquisitionSites: boolean;
  readonly path: string;
}

interface OccurrenceOwner {
  readonly gameName: string;
  readonly role: RoomOccurrenceRole;
  readonly entryActive: boolean;
  readonly anomalyReplacement?: AnomalyReplacementProvenance;
  readonly rememberedCountedBinding?: CountedRewardBinding;
  readonly path: string;
}

interface RawDecision {
  readonly value: Record<string, unknown>;
  readonly path: string;
}

function occurrenceId(value: unknown, path: string): OccurrenceId {
  return expectNonBlankString(value, path) as OccurrenceId;
}

function requireKnownRoom(occurrence: RawOccurrence, catalog: Catalog): RoomDeclaration {
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) {
    failProjectDocument(`${occurrence.path}.gameName`, `unknown room ${occurrence.gameName}`);
  }
  if (room.mode.kind !== 'authored') {
    failProjectDocument(`${occurrence.path}.gameName`, `${occurrence.gameName} is layout-derived`);
  }
  return room;
}

function requireHostRoom(
  occurrence: RawOccurrence,
  catalog: Catalog,
  biomeKey: string,
): RoomDeclaration {
  const room = requireKnownRoom(occurrence, catalog);
  if (room.roomSetKey !== biomeKey) {
    failProjectDocument(
      `${occurrence.path}.gameName`,
      `${occurrence.gameName} belongs to ${room.roomSetKey}`,
    );
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

function decodeAdditionalExits(
  value: unknown,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  path: string,
): readonly AuthoredAdditionalExit[] {
  const rawAdditional = expectArray(value, path);
  const seen = new Set<string>();
  const additional = rawAdditional.map((rawValue, index): AuthoredAdditionalExit => {
    const additionalPath = `${path}[${index}]`;
    const additional = expectRecord(rawValue, additionalPath);
    const kind = expectString(additional.kind, `${additionalPath}.kind`);
    if (kind !== 'zagreusContract' && kind !== 'naturalChaos') {
      failProjectDocument(`${additionalPath}.kind`, `unknown additional exit ${kind}`);
    }
    expectExactKeys(additional, ['kind', 'key', 'occurrenceId'], additionalPath);
    const key = expectNonBlankString(additional.key, `${additionalPath}.key`);
    if (
      (kind === 'zagreusContract' && key !== 'zagreusContract') ||
      (kind === 'naturalChaos' && key !== 'naturalChaos')
    ) {
      failProjectDocument(`${additionalPath}.key`, `unknown additional exit ${key}`);
    }
    if (seen.has(key)) {
      failProjectDocument(`${additionalPath}.key`, `duplicates additional exit ${key}`);
    }
    seen.add(key);
    const id = occurrenceId(additional.occurrenceId, `${additionalPath}.occurrenceId`);
    const target = occurrences.get(id);
    if (target === undefined) {
      failProjectDocument(`${additionalPath}.occurrenceId`, `unknown occurrence ${id}`);
    }
    if (kind === 'zagreusContract' && target.gameName !== 'C_Boss01') {
      failProjectDocument(`${additionalPath}.occurrenceId`, `${key} requires C_Boss01`);
    }
    return Object.freeze({ kind, key, occurrenceId: id }) as AuthoredAdditionalExit;
  });
  return Object.freeze(additional);
}

function decodeAnomalyReplacementProvenance(
  occurrence: RawOccurrence,
): AnomalyReplacementProvenance {
  if (!occurrence.hasAnomalyReplacement) {
    failProjectDocument(
      `${occurrence.path}.anomalyReplacement`,
      'is required for an Anomaly target',
    );
  }
  const value = expectRecord(
    occurrence.anomalyReplacement,
    `${occurrence.path}.anomalyReplacement`,
  );
  expectExactKeys(value, ['replacedRoomGameName'], `${occurrence.path}.anomalyReplacement`);
  return Object.freeze({
    replacedRoomGameName: expectNonBlankString(
      value.replacedRoomGameName,
      `${occurrence.path}.anomalyReplacement.replacedRoomGameName`,
    ),
  });
}

function decodeAcquisitionSites(
  value: unknown,
  occurrence: RawOccurrence,
  catalog: Catalog,
  pickupProducerLifecycleKey: string | undefined,
): Readonly<
  Record<
    string,
    {
      readonly order: readonly string[];
      readonly pickupEntries?: Readonly<Record<string, AuthoredRewardState>>;
    }
  >
> {
  const sites = expectRecord(value, `${occurrence.path}.acquisitionSites`);
  const decoded: Record<
    string,
    {
      readonly order: readonly string[];
      readonly pickupEntries?: Readonly<Record<string, AuthoredRewardState>>;
    }
  > = {};
  for (const [pointKey, rawSite] of Object.entries(sites)) {
    const site = expectRecord(rawSite, `${occurrence.path}.acquisitionSites.${pointKey}`);
    const hasPickups = site.pickupEntries !== undefined;
    expectExactKeys(
      site,
      ['order', ...(hasPickups ? ['pickupEntries'] : [])],
      `${occurrence.path}.acquisitionSites.${pointKey}`,
    );
    const order = expectArray(
      site.order,
      `${occurrence.path}.acquisitionSites.${pointKey}.order`,
    ).map((key, index) =>
      expectNonBlankString(key, `${occurrence.path}.acquisitionSites.${pointKey}.order[${index}]`),
    );
    if (new Set(order).size !== order.length) {
      failProjectDocument(
        `${occurrence.path}.acquisitionSites.${pointKey}.order`,
        'contains a duplicate entry',
      );
    }
    if (hasPickups && pickupProducerLifecycleKey === undefined)
      failProjectDocument(
        `${occurrence.path}.acquisitionSites.${pointKey}.pickupEntries`,
        'has no selected pickup producer',
      );
    const pickupEntries = hasPickups
      ? Object.freeze(
          Object.fromEntries(
            Object.entries(
              expectRecord(
                site.pickupEntries,
                `${occurrence.path}.acquisitionSites.${pointKey}.pickupEntries`,
              ),
            ).map(([key, raw]) => [
              key,
              decodeRewardState(
                raw,
                catalog,
                `${occurrence.path}.acquisitionSites.${pointKey}.pickupEntries.${key}`,
                { kind: 'producerLifecycle', key: pickupProducerLifecycleKey! },
              ),
            ]),
          ),
        )
      : undefined;
    decoded[pointKey] = Object.freeze({
      order: Object.freeze(order),
      ...(pickupEntries === undefined ? {} : { pickupEntries }),
    });
  }
  return Object.freeze(decoded);
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

function isTakeoverBatch(
  decision: NextRoomDecision,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  catalog: Catalog,
): boolean {
  return (
    decision.kind === 'exit' &&
    decision.normal.targets.some((target) => {
      const occurrence = occurrences.get(target.occurrenceId);
      return (
        occurrence !== undefined &&
        requireKnownRoom(occurrence, catalog).prebossBatchPolicy?.kind === 'takeOverNormalDoors'
      );
    })
  );
}

function selectedContinuationForDecision(
  decision: ExitDecision,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
): ReturnType<typeof selectedExitContinuation> {
  const additional =
    decision.source.kind === 'occurrence'
      ? decodeAdditionalExits(
          occurrences.get(decision.source.occurrenceId)?.additionalExits,
          occurrences,
          `${occurrences.get(decision.source.occurrenceId)?.path ?? '$'}.additionalExits`,
        )
      : Object.freeze([]);
  return selectedExitContinuation(decision, additional);
}

function validateSelectedDecisionCycles(
  decisions: readonly NextRoomDecision[],
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
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
      const continuation = selectedContinuationForDecision(decision, occurrences);
      const targetOccurrenceId =
        continuation?.kind === 'normal'
          ? continuation.target.occurrenceId
          : continuation?.kind === 'additional'
            ? continuation.exit.occurrenceId
            : undefined;
      if (targetOccurrenceId !== undefined) visit(targetOccurrenceId);
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
  const progression = normalDecisionProgressionForLayout(layout);
  if (progression?.progressionPolicy.kind !== 'staged') {
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
    const continuation = selectedContinuationForDecision(decision, occurrences);
    if (isTakeoverBatch(decision, occurrences, catalog)) return;
    // An empty decision is an authored envelope, not an ordinary stage. It
    // remains the active frontier until its first ordinary target exists (or a
    // takeover atomically replaces it).
    if (decision.normal.targets.length === 0) return;
    const stage = progression.progressionPolicy.stages[batchIndex];
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
    sourceOccurrenceId =
      continuation?.kind === 'normal'
        ? continuation.target.occurrenceId
        : continuation?.kind === 'additional'
          ? continuation.exit.occurrenceId
          : undefined;
  }
}

function validateNormalDecisionProgressionBounds(
  decisions: readonly NextRoomDecision[],
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  catalog: Catalog,
  layout: BiomeLayout,
  startOccurrenceId: OccurrenceId,
  path: string,
): void {
  const progression = normalDecisionProgressionForLayout(layout);
  if (progression === undefined) return;
  const selectedSpine = Object.freeze({
    startOccurrenceId,
    decisions: Object.freeze([...decisions]),
    occurrences: Object.freeze(
      [...occurrences.values()].map((occurrence) =>
        Object.freeze({
          occurrenceId: occurrence.occurrenceId,
          additionalExits: decodeAdditionalExits(
            occurrence.additionalExits,
            occurrences,
            `${occurrence.path}.additionalExits`,
          ),
        }),
      ),
    ),
  });
  const ordinaryBatchLimit = ordinaryProgressionBatchLimit(layout);
  if (ordinaryBatchLimit === undefined) return;
  const ordinaryBatches = decisions.filter(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      decision.normal.targets.length > 0 &&
      !isTakeoverBatch(decision, occurrences, catalog),
  );
  const ordinaryTargetCount = ordinaryBatches.reduce(
    (count, decision) => count + decision.normal.targets.length,
    0,
  );
  if (ordinaryBatches.length > ordinaryBatchLimit) {
    failProjectDocument(`${path}.decisions`, `exceeds ${ordinaryBatchLimit} normal batches`);
  }
  if (ordinaryTargetCount > progression.bounds.maxTargets) {
    failProjectDocument(
      `${path}.decisions`,
      `exceeds ${progression.bounds.maxTargets} normal targets`,
    );
  }
  for (const decision of decisions) {
    if (
      decision.kind !== 'exit' ||
      decision.normal.targets.length !== 0 ||
      decision.source.kind !== 'occurrence'
    ) {
      continue;
    }
    const ordinal = selectedOrdinaryBatchIndex(selectedSpine, decision.source.occurrenceId);
    if (ordinal === undefined || ordinal < ordinaryBatchLimit) continue;
    if (
      hubTerminalTakeoverForSource(catalog, layout, selectedSpine, decision.source) !== undefined
    ) {
      if (!isExactTerminalTakeoverEnvelope(decision)) {
        failProjectDocument(
          `${path}.decisions`,
          'terminal Hub takeover envelope must use the exact no-choice batch state',
        );
      }
      continue;
    }
    if (admitsTerminalTakeoverEnvelope(catalog, layout, selectedSpine, decision.source)) {
      continue;
    }
    failProjectDocument(`${path}.decisions`, `exceeds ${ordinaryBatchLimit} normal batches`);
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

function decodeExitDecision(
  raw: RawDecision,
  layout: BiomeLayout,
  catalog: Catalog,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
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
      ? decodeAdditionalExits(
          occurrences.get(source.occurrenceId)?.additionalExits,
          occurrences,
          `${raw.path}.source.occurrenceId.additionalExits`,
        )
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
  expectExactKeys(value, ['kind', 'hubKey', 'source', 'openTargets', 'visitOrder'], raw.path);
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
  requireHostRoom(sourceOccurrence, catalog, layout.biomeKey);
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
    source,
    openTargets: Object.freeze(openTargets),
    visitOrder: Object.freeze(visitOrder),
  });
}

function ownerForNormalTarget(
  rawOccurrence: RawOccurrence,
  catalog: Catalog,
  layout: BiomeLayout,
  targetIndex: number,
  entryActive: boolean,
  path: string,
): OccurrenceOwner {
  const room = requireKnownRoom(rawOccurrence, catalog);
  if (room.roomSetKey === layout.biomeKey) {
    if (rawOccurrence.hasAnomalyReplacement) {
      failProjectDocument(
        `${rawOccurrence.path}.anomalyReplacement`,
        'is only valid for an Anomaly replacement target',
      );
    }
    return Object.freeze({
      gameName: room.gameName,
      role: prebossRole(room, targetIndex, path),
      entryActive,
      path,
    });
  }
  const replacement =
    layout.progression.kind === 'generated' ? layout.progression.anomalyReplacement : undefined;
  if (
    replacement === undefined ||
    room.mode.kind !== 'authored' ||
    room.mode.templateKey !== 'Anomaly' ||
    !replacement.replacementRoomGameNames.includes(room.gameName)
  ) {
    failProjectDocument(
      `${rawOccurrence.path}.gameName`,
      `${rawOccurrence.gameName} belongs to ${room.roomSetKey}`,
    );
  }
  const anomalyReplacement = decodeAnomalyReplacementProvenance(rawOccurrence);
  if (
    !replacement.replaceableTargetRoomGameNames.includes(anomalyReplacement.replacedRoomGameName)
  ) {
    failProjectDocument(
      `${rawOccurrence.path}.anomalyReplacement.replacedRoomGameName`,
      `${anomalyReplacement.replacedRoomGameName} is not an Anomaly-replaceable normal target`,
    );
  }
  const rememberedRoom = catalog.rooms.byKey[anomalyReplacement.replacedRoomGameName];
  if (rememberedRoom === undefined || rememberedRoom.roomSetKey !== layout.biomeKey) {
    failProjectDocument(
      `${rawOccurrence.path}.anomalyReplacement.replacedRoomGameName`,
      `${anomalyReplacement.replacedRoomGameName} is not a known ${layout.biomeKey} room`,
    );
  }
  return Object.freeze({
    gameName: room.gameName,
    role: 'ordinary',
    entryActive,
    anomalyReplacement,
    rememberedCountedBinding: requireCountedBinding(
      rememberedRoom,
      `${rawOccurrence.path}.anomalyReplacement.replacedRoomGameName`,
    ),
    path,
  });
}

function ownerForAdditionalExit(
  additional: AuthoredAdditionalExit,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  catalog: Catalog,
  layout: BiomeLayout,
  entryActive: boolean,
  path: string,
): OccurrenceOwner {
  const rawOccurrence = occurrences.get(additional.occurrenceId);
  if (rawOccurrence === undefined) {
    failProjectDocument(path, `unknown additional target ${additional.occurrenceId}`);
  }
  const room = requireKnownRoom(rawOccurrence, catalog);
  if (additional.kind === 'zagreusContract') {
    if (
      room.roomSetKey === layout.biomeKey ||
      room.mode.kind !== 'authored' ||
      room.mode.templateKey !== 'ContractBoss'
    ) {
      failProjectDocument(
        `${rawOccurrence.path}.gameName`,
        `${additional.key} requires its declared Zagreus contract room`,
      );
    }
  } else if (
    room.roomSetKey !== 'Chaos' ||
    room.mode.kind !== 'authored' ||
    room.mode.templateKey !== 'Chaos'
  ) {
    failProjectDocument(
      `${rawOccurrence.path}.gameName`,
      `${additional.key} requires a declared Chaos room`,
    );
  }
  if (rawOccurrence.hasAnomalyReplacement) {
    failProjectDocument(
      `${rawOccurrence.path}.anomalyReplacement`,
      'is only valid for an Anomaly replacement target',
    );
  }
  return Object.freeze({
    gameName: room.gameName,
    role: 'ordinary',
    entryActive,
    path,
  });
}

function validateDetourAutomaticContinuationDecision(
  decision: ExitDecision,
  decisionPath: string,
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  catalog: Catalog,
  layout: BiomeLayout,
): void {
  if (decision.source.kind !== 'occurrence') return;
  const source = occurrences.get(decision.source.occurrenceId);
  if (source === undefined) return;
  const sourceRoom = requireKnownRoom(source, catalog);
  if (sourceRoom.roomSetKey === layout.biomeKey) return;
  const continuation = hostContinuationExitForDetourRoom(sourceRoom);
  if (continuation === undefined) {
    failProjectDocument(
      `${decisionPath}.source.occurrenceId`,
      `${sourceRoom.gameName} has no admitted detour host continuation`,
    );
  }
  if (
    decision.normal.targets.length === 0 &&
    decodeAdditionalExits(source.additionalExits, occurrences, `${source.path}.additionalExits`)
      .length === 0 &&
    decision.selection.kind === 'unresolved'
  ) {
    // The automatic return uses the same intentionally incomplete envelope
    // shape as normal authoring. Once its host target exists, its one exit is
    // declaration-derived and no player-choice state remains.
    return;
  }
  const [target] = decision.normal.targets;
  if (
    decision.normal.targets.length !== 1 ||
    target?.exitKey !== continuation.exitKey ||
    decodeAdditionalExits(source.additionalExits, occurrences, `${source.path}.additionalExits`)
      .length !== 0 ||
    decision.selection.kind !== 'derived'
  ) {
    failProjectDocument(
      decisionPath,
      'a detour host continuation requires one derived exit1 host target and no additional exits',
    );
  }
  if (target === undefined) return;
  const returnTarget = occurrences.get(target.occurrenceId);
  if (returnTarget === undefined) return;
  const returnRoom = requireHostRoom(returnTarget, catalog, layout.biomeKey);
  if (returnRoom.mode.kind !== 'authored') {
    failProjectDocument(
      `${returnTarget.path}.gameName`,
      `${returnTarget.gameName} is layout-derived`,
    );
  }
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
    const hasAnomalyReplacement = Object.hasOwn(occurrence, 'anomalyReplacement');
    const hasAcquisitionSites = Object.hasOwn(occurrence, 'acquisitionSites');
    expectExactKeys(
      occurrence,
      [
        'occurrenceId',
        'gameName',
        'state',
        'encounters',
        'additionalExits',
        ...(hasAnomalyReplacement ? ['anomalyReplacement'] : []),
        ...(hasAcquisitionSites ? ['acquisitionSites'] : []),
      ],
      occurrencePath,
    );
    const id = occurrenceId(occurrence.occurrenceId, `${occurrencePath}.occurrenceId`);
    if (occurrences.has(id))
      failProjectDocument(`${occurrencePath}.occurrenceId`, `duplicates occurrence ${id}`);
    occurrences.set(
      id,
      Object.freeze({
        occurrenceId: id,
        gameName: expectNonBlankString(occurrence.gameName, `${occurrencePath}.gameName`),
        anomalyReplacement: occurrence.anomalyReplacement,
        hasAnomalyReplacement,
        state: occurrence.state,
        encounters: occurrence.encounters,
        additionalExits: occurrence.additionalExits,
        acquisitionSites: occurrence.acquisitionSites,
        hasAcquisitionSites,
        path: occurrencePath,
      }),
    );
  }
  const startOccurrenceId = occurrenceId(topology.startOccurrenceId, `${path}.startOccurrenceId`);
  const start = occurrences.get(startOccurrenceId);
  if (start === undefined)
    failProjectDocument(`${path}.startOccurrenceId`, `unknown occurrence ${startOccurrenceId}`);
  const startRoom = requireHostRoom(start, catalog, layout.biomeKey);
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
        ? decodeExitDecision(raw, layout, catalog, occurrences, startOccurrenceId)
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
  validateNormalDecisionProgressionBounds(
    decisions,
    occurrences,
    catalog,
    layout,
    startOccurrenceId,
    path,
  );
  validateStagedSelections(decisions, occurrences, catalog, layout, startOccurrenceId, path);
  validateSelectedDecisionCycles(decisions, occurrences, startOccurrenceId, path);

  const hubDecision = decisions.find(
    (decision): decision is HubDecision => decision.kind === 'hub',
  );
  const selectedSources = new Set<OccurrenceId>([startOccurrenceId]);
  let addedSelectedSource = true;
  while (addedSelectedSource) {
    addedSelectedSource = false;
    for (const decision of decisions) {
      if (decision.kind !== 'exit' || decision.source.kind !== 'occurrence') continue;
      if (!selectedSources.has(decision.source.occurrenceId)) continue;
      const continuation = selectedContinuationForDecision(decision, occurrences);
      const targetOccurrenceId =
        continuation?.kind === 'normal'
          ? continuation.target.occurrenceId
          : continuation?.kind === 'additional'
            ? continuation.exit.occurrenceId
            : undefined;
      if (targetOccurrenceId !== undefined && !selectedSources.has(targetOccurrenceId)) {
        selectedSources.add(targetOccurrenceId);
        addedSelectedSource = true;
      }
    }
  }
  const selectedSpine = Object.freeze({
    startOccurrenceId,
    decisions: Object.freeze([...decisions]),
  });
  for (const [index, decision] of decisions.entries()) {
    const decisionPath = rawDecisions[index]?.path ?? path;
    if (decision.kind === 'hub') {
      if (!selectedSources.has(decision.source.occurrenceId)) {
        failProjectDocument(
          `${decisionPath}.source.occurrenceId`,
          'Hub source is not on the selected topology spine',
        );
      }
      if (
        decisions.some(
          (candidate): candidate is ExitDecision =>
            candidate.kind === 'exit' &&
            candidate.source.kind === 'occurrence' &&
            candidate.source.occurrenceId === decision.source.occurrenceId,
        )
      ) {
        failProjectDocument(
          `${decisionPath}.source`,
          'Hub decision cannot coexist with an exit decision at its source',
        );
      }
      const terminal = hubTerminalTakeoverForSource(
        catalog,
        layout,
        selectedSpine,
        decision.source,
      );
      if (terminal === undefined || terminal.hubKey !== decision.hubKey) {
        failProjectDocument(
          `${decisionPath}.source`,
          'Hub source does not resolve the declared terminal Hub takeover',
        );
      }
      continue;
    }
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
        hubDecisionHandoffReadiness(layout.progression, hubDecision).kind !== 'ready'
      ) {
        failProjectDocument(`${decisionPath}.source`, 'completed-Hub exit requires a complete Hub');
      }
    }
    if (decision.source.kind === 'occurrence') {
      const source = occurrences.get(decision.source.occurrenceId);
      if (source !== undefined && requireKnownRoom(source, catalog).kind === 'Preboss') {
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
  for (const rawOccurrence of occurrences.values()) {
    const additional = decodeAdditionalExits(
      rawOccurrence.additionalExits,
      occurrences,
      `${rawOccurrence.path}.additionalExits`,
    );
    for (const [additionalIndex, exit] of additional.entries()) {
      const sourceDecision = decisions.find(
        (decision): decision is ExitDecision =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === rawOccurrence.occurrenceId,
      );
      own(
        exit.occurrenceId,
        ownerForAdditionalExit(
          exit,
          occurrences,
          catalog,
          layout,
          sourceDecision?.selection.kind === 'additional' &&
            sourceDecision.selection.additionalExitKey === exit.key,
          `${rawOccurrence.path}.additionalExits[${additionalIndex}].occurrenceId`,
        ),
      );
    }
  }
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
    const selected = selectedExitKey(decision);
    for (const [targetIndex, target] of decision.normal.targets.entries()) {
      const rawOccurrence = occurrences.get(target.occurrenceId);
      if (rawOccurrence === undefined)
        failProjectDocument(decisionPath, `unknown target ${target.occurrenceId}`);
      own(
        target.occurrenceId,
        ownerForNormalTarget(
          rawOccurrence,
          catalog,
          layout,
          targetIndex,
          selected === target.exitKey,
          `${decisionPath}.normal.targets[${targetIndex}].occurrenceId`,
        ),
      );
    }
  }
  for (const [index, decision] of decisions.entries()) {
    if (decision.kind !== 'exit') continue;
    validateDetourAutomaticContinuationDecision(
      decision,
      rawDecisions[index]?.path ?? path,
      occurrences,
      catalog,
      layout,
    );
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
    const room = requireKnownRoom(rawOccurrence, catalog);
    const state = decodeRoomState(
      rawOccurrence.state,
      catalog,
      room,
      owner,
      `${rawOccurrence.path}.state`,
    );
    const encounters = decodeRoomEncounterState(
      rawOccurrence.encounters,
      catalog,
      room,
      `${rawOccurrence.path}.encounters`,
    );
    const selectedPickupDispositions = Object.values(encounters.traitOffersByPhase ?? {})
      .flatMap((phase) => Object.values(phase))
      .map(
        (offer) =>
          catalog.traits.byKey[offer.options[optionIndex(offer.selectedOptionKey)].traitKey]
            ?.selectedDisposition,
      )
      .filter(
        (
          disposition,
        ): disposition is Extract<
          NonNullable<typeof disposition>,
          { readonly kind: 'producePickups' }
        > => disposition?.kind === 'producePickups',
      );
    if (selectedPickupDispositions.length > 1)
      failProjectDocument(
        `${rawOccurrence.path}.encounters`,
        'has more than one active pickup producer',
      );
    const pickupDisposition = selectedPickupDispositions[0];
    const acquisitionSites = rawOccurrence.hasAcquisitionSites
      ? decodeAcquisitionSites(
          rawOccurrence.acquisitionSites,
          rawOccurrence,
          catalog,
          pickupDisposition?.producerLifecycleKey,
        )
      : undefined;
    if (state.kind === 'shop' && state.shop !== undefined) {
      if (acquisitionSites === undefined || acquisitionSites.roomExit === undefined) {
        failProjectDocument(
          `${rawOccurrence.path}.acquisitionSites`,
          'materialized Shop requires roomExit state',
        );
      }
      if (Object.keys(acquisitionSites).some((pointKey) => pointKey !== 'roomExit')) {
        failProjectDocument(
          `${rawOccurrence.path}.acquisitionSites`,
          'Shop only authors roomExit state',
        );
      }
      if (acquisitionSites.roomExit.pickupEntries !== undefined) {
        failProjectDocument(
          `${rawOccurrence.path}.acquisitionSites.roomExit.pickupEntries`,
          'Shop offers are producer-owned and cannot be copied into pickupEntries',
        );
      }
      for (const entryKey of acquisitionSites.roomExit.order) {
        if (state.shop.offers[entryKey] === undefined) {
          failProjectDocument(
            `${rawOccurrence.path}.acquisitionSites.roomExit.order`,
            `${entryKey} is not a Shop offer`,
          );
        }
      }
    } else {
      if (
        acquisitionSites !== undefined &&
        Object.keys(acquisitionSites).some((pointKey) => pointKey !== 'roomExit')
      )
        failProjectDocument(
          `${rawOccurrence.path}.acquisitionSites`,
          'pickup producers author only roomExit',
        );
      const expected = pickupDisposition?.pickups ?? [];
      if (expected.length === 0 && acquisitionSites !== undefined) {
        failProjectDocument(
          `${rawOccurrence.path}.acquisitionSites`,
          'has no authorable acquisition site',
        );
      }
      if (expected.length > 0 && acquisitionSites?.roomExit?.pickupEntries === undefined)
        failProjectDocument(
          `${rawOccurrence.path}.acquisitionSites.roomExit`,
          'selected pickup producer requires pickupEntries',
        );
      if (expected.length > 0) {
        const entries = acquisitionSites?.roomExit?.pickupEntries ?? {};
        if (
          Object.keys(entries).length !== expected.length ||
          expected.some((pickup) => entries[pickup.key]?.offer.rewardType !== pickup.rewardType)
        )
          failProjectDocument(
            `${rawOccurrence.path}.acquisitionSites.roomExit.pickupEntries`,
            'does not match selected descriptor pickups',
          );
        for (const key of acquisitionSites?.roomExit?.order ?? []) {
          if (entries[key] === undefined)
            failProjectDocument(
              `${rawOccurrence.path}.acquisitionSites.roomExit.order`,
              `${key} is not an active pickup`,
            );
        }
      }
    }
    return Object.freeze({
      occurrenceId: rawOccurrence.occurrenceId,
      gameName: room.gameName,
      ...(owner.anomalyReplacement === undefined
        ? {}
        : { anomalyReplacement: owner.anomalyReplacement }),
      state,
      encounters,
      ...(acquisitionSites === undefined ? {} : { acquisitionSites }),
      additionalExits: decodeAdditionalExits(
        rawOccurrence.additionalExits,
        occurrences,
        `${rawOccurrence.path}.additionalExits`,
      ),
    });
  });
  return Object.freeze({
    startOccurrenceId,
    occurrences: Object.freeze(normalizedOccurrences),
    decisions: Object.freeze(decisions),
  });
}

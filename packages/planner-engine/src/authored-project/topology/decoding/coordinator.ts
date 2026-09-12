import type { BiomeLayout, Catalog, RoomDeclaration } from '../../../catalog-schema';
import type {
  AnomalyReplacementProvenance,
  AuthoredAdditionalExit,
  IxionGeneratedChaosOrigin,
  StygianWellGenerationKey,
  ExitDecision,
  FixedRoomLink,
  HubDecision,
  LocalVisitDecision,
  NextRoomDecision,
  OccurrenceId,
} from '../../model';
import { fixedCompletionOccurrenceId } from '../../fixed-room-links';
import { requireCountedBinding, type RoomOccurrenceRole } from '../../room-state/declaration';
import {
  automaticHostContinuationExitForDetourRoom,
  hubDecisionHandoffReadiness,
  hubTerminalTakeoverForSource,
  isExactTerminalTakeoverEnvelope,
  isHostRouteDetourRoom,
  normalDecisionProgressionForLayout,
  ordinaryProgressionBatchLimit,
  selectedExitContinuation,
  selectedExitKey,
  selectedOrdinaryBatchIndex,
} from '../query';
import { exitDecisionSourceKey } from '../source-identity';
import {
  expectArray,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../../validation';
import { decodeExitDecision, decodeHubDecision, decodeLocalVisitDecision } from './decisions';
import {
  occurrenceId,
  requireHostRoom,
  requireKnownRoom,
  type AdditionalExitsFor,
  type OccurrenceOwner,
  type RawDecision,
  type RawOccurrence,
} from './raw';

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
    if (kind !== 'zagreusContract' && kind !== 'chaos') {
      failProjectDocument(`${additionalPath}.kind`, `unknown additional exit ${kind}`);
    }
    expectExactKeys(
      additional,
      kind === 'chaos' && additional.origin !== undefined
        ? ['kind', 'key', 'occurrenceId', 'origin']
        : ['kind', 'key', 'occurrenceId'],
      additionalPath,
    );
    const key = expectNonBlankString(additional.key, `${additionalPath}.key`);
    if (
      (kind === 'zagreusContract' && key !== 'zagreusContract') ||
      (kind === 'chaos' && key !== 'chaos')
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
    if (kind === 'zagreusContract')
      return Object.freeze({ kind, key, occurrenceId: id }) as AuthoredAdditionalExit;
    let origin: IxionGeneratedChaosOrigin | undefined;
    if (additional.origin !== undefined) {
      const rawOrigin = expectRecord(additional.origin, `${additionalPath}.origin`);
      const originKind = expectString(rawOrigin.kind, `${additionalPath}.origin.kind`);
      if (originKind === 'ixionGenerated') {
        expectExactKeys(
          rawOrigin,
          ['kind', 'sourceBiomeKey', 'sourceOccurrenceId', 'generationKey'],
          `${additionalPath}.origin`,
        );
        origin = Object.freeze({
          kind: 'ixionGenerated',
          sourceBiomeKey: expectNonBlankString(
            rawOrigin.sourceBiomeKey,
            `${additionalPath}.origin.sourceBiomeKey`,
          ),
          sourceOccurrenceId: occurrenceId(
            rawOrigin.sourceOccurrenceId,
            `${additionalPath}.origin.sourceOccurrenceId`,
          ),
          generationKey: (() => {
            const generationKey = expectNonBlankString(
              rawOrigin.generationKey,
              `${additionalPath}.origin.generationKey`,
            );
            if (
              generationKey !== 'initial:healing' &&
              generationKey !== 'initial:secondLeft' &&
              generationKey !== 'initial:secondRight' &&
              generationKey !== 'travelDealRefill'
            )
              failProjectDocument(
                `${additionalPath}.origin.generationKey`,
                `unknown Stygian Well generation ${generationKey}`,
              );
            return generationKey as StygianWellGenerationKey;
          })(),
        });
      } else {
        failProjectDocument(
          `${additionalPath}.origin.kind`,
          `unknown Chaos gate origin ${originKind}`,
        );
      }
    }
    return Object.freeze({
      kind,
      key,
      occurrenceId: id,
      ...(origin === undefined ? {} : { origin }),
    }) as AuthoredAdditionalExit;
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
  additionalExitsFor: AdditionalExitsFor,
): ReturnType<typeof selectedExitContinuation> {
  const additional =
    decision.source.kind === 'occurrence'
      ? additionalExitsFor(
          decision.source.occurrenceId,
          `${occurrences.get(decision.source.occurrenceId)?.path ?? '$'}.additionalExits`,
        )
      : Object.freeze([]);
  return selectedExitContinuation(decision, additional);
}

function validateSelectedDecisionCycles(
  decisions: readonly NextRoomDecision[],
  occurrences: ReadonlyMap<OccurrenceId, RawOccurrence>,
  additionalExitsFor: AdditionalExitsFor,
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
      const continuation = selectedContinuationForDecision(
        decision,
        occurrences,
        additionalExitsFor,
      );
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
  additionalExitsFor: AdditionalExitsFor,
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
    const continuation = selectedContinuationForDecision(decision, occurrences, additionalExitsFor);
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
  additionalExitsFor: AdditionalExitsFor,
  catalog: Catalog,
  layout: BiomeLayout,
  startOccurrenceId: OccurrenceId,
  path: string,
): void {
  const progression = normalDecisionProgressionForLayout(layout);
  if (progression === undefined) return;
  if (!('bounds' in progression)) return;
  const selectedSpine = Object.freeze({
    startOccurrenceId,
    decisions: Object.freeze([...decisions]),
    occurrences: Object.freeze(
      [...occurrences.values()].map((occurrence) =>
        Object.freeze({
          occurrenceId: occurrence.occurrenceId,
          additionalExits: additionalExitsFor(
            occurrence.occurrenceId,
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
    const sourceOccurrence = occurrences.get(decision.source.occurrenceId);
    const sourceRoom =
      sourceOccurrence === undefined ? undefined : requireKnownRoom(sourceOccurrence, catalog);
    if (sourceRoom !== undefined && isHostRouteDetourRoom(sourceRoom)) {
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
  additionalExitsFor: AdditionalExitsFor,
  catalog: Catalog,
  layout: BiomeLayout,
): void {
  if (decision.source.kind !== 'occurrence') return;
  const source = occurrences.get(decision.source.occurrenceId);
  if (source === undefined) return;
  const sourceRoom = requireKnownRoom(source, catalog);
  if (sourceRoom.roomSetKey === layout.biomeKey) return;
  if (sourceRoom.mode.kind === 'authored' && sourceRoom.mode.templateKey === 'Chaos') return;
  const continuation = automaticHostContinuationExitForDetourRoom(sourceRoom);
  if (continuation === undefined) {
    failProjectDocument(
      `${decisionPath}.source.occurrenceId`,
      `${sourceRoom.gameName} has no admitted detour host continuation`,
    );
  }
  if (
    decision.normal.targets.length === 0 &&
    additionalExitsFor(source.occurrenceId, `${source.path}.additionalExits`).length === 0 &&
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
    additionalExitsFor(source.occurrenceId, `${source.path}.additionalExits`).length !== 0 ||
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

export interface DecodedTopologyStructure {
  readonly startOccurrenceId: OccurrenceId;
  readonly occurrences: readonly {
    readonly raw: RawOccurrence;
    readonly owner: OccurrenceOwner;
    readonly additionalExits: readonly AuthoredAdditionalExit[];
  }[];
  readonly decisions: readonly NextRoomDecision[];
  readonly fixedRoomLinks: readonly FixedRoomLink[];
}

export function decodeTopologyStructure(
  value: unknown,
  catalog: Catalog,
  layout: BiomeLayout,
  routeKey: string,
  path: string,
): DecodedTopologyStructure {
  const topology = expectRecord(value, path);
  expectExactKeys(
    topology,
    ['startOccurrenceId', 'occurrences', 'decisions', 'fixedRoomLinks'],
    path,
  );
  const rawOccurrences = expectArray(topology.occurrences, `${path}.occurrences`);
  const occurrences = new Map<OccurrenceId, RawOccurrence>();
  for (const [index, rawValue] of rawOccurrences.entries()) {
    const occurrencePath = `${path}.occurrences[${index}]`;
    const occurrence = expectRecord(rawValue, occurrencePath);
    const hasAnomalyReplacement = Object.hasOwn(occurrence, 'anomalyReplacement');
    const hasAcquisitionSites = Object.hasOwn(occurrence, 'acquisitionSites');
    const hasHermesShrine = Object.hasOwn(occurrence, 'hermesShrine');
    const hasStygianWell = Object.hasOwn(occurrence, 'stygianWell');
    const hasFountainRarityResult = Object.hasOwn(occurrence, 'fountainRarityResult');
    const hasPurgingPool = Object.hasOwn(occurrence, 'purgingPool');
    const hasKeepsakeRack = Object.hasOwn(occurrence, 'keepsakeRack');
    const hasFigurineArcanaKeysByPhase = Object.hasOwn(occurrence, 'figurineArcanaKeysByPhase');
    expectExactKeys(
      occurrence,
      [
        'occurrenceId',
        'gameName',
        'state',
        'encounters',
        'roomActions',
        'additionalExits',
        ...(hasAnomalyReplacement ? ['anomalyReplacement'] : []),
        ...(hasAcquisitionSites ? ['acquisitionSites'] : []),
        ...(hasHermesShrine ? ['hermesShrine'] : []),
        ...(hasStygianWell ? ['stygianWell'] : []),
        ...(hasFountainRarityResult ? ['fountainRarityResult'] : []),
        ...(hasPurgingPool ? ['purgingPool'] : []),
        ...(hasKeepsakeRack ? ['keepsakeRack'] : []),
        ...(hasFigurineArcanaKeysByPhase ? ['figurineArcanaKeysByPhase'] : []),
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
        roomActions: occurrence.roomActions,
        additionalExits: occurrence.additionalExits,
        acquisitionSites: occurrence.acquisitionSites,
        hasAcquisitionSites,
        hermesShrine: occurrence.hermesShrine,
        hasHermesShrine,
        stygianWell: occurrence.stygianWell,
        hasStygianWell,
        fountainRarityResult: occurrence.fountainRarityResult,
        hasFountainRarityResult,
        purgingPool: occurrence.purgingPool,
        hasPurgingPool,
        keepsakeRack: occurrence.keepsakeRack,
        hasKeepsakeRack,
        figurineArcanaKeysByPhase: occurrence.figurineArcanaKeysByPhase,
        hasFigurineArcanaKeysByPhase,
        path: occurrencePath,
      }),
    );
  }
  const decodedAdditionalExits = new Map<OccurrenceId, readonly AuthoredAdditionalExit[]>();
  const additionalExitsFor: AdditionalExitsFor = (occurrenceId, diagnosticPath) => {
    const decoded = decodedAdditionalExits.get(occurrenceId);
    if (decoded !== undefined) return decoded;
    const decodedForOccurrence = decodeAdditionalExits(
      occurrences.get(occurrenceId)?.additionalExits,
      occurrences,
      diagnosticPath,
    );
    decodedAdditionalExits.set(occurrenceId, decodedForOccurrence);
    return decodedForOccurrence;
  };
  const rawFixedLinks = expectArray(topology.fixedRoomLinks, `${path}.fixedRoomLinks`);
  const fixedRoomLinks = rawFixedLinks.map((value, index): FixedRoomLink => {
    const linkPath = `${path}.fixedRoomLinks[${index}]`;
    const link = expectRecord(value, linkPath);
    expectExactKeys(link, ['sourceOccurrenceId', 'targetOccurrenceId'], linkPath);
    const sourceOccurrenceId = occurrenceId(
      link.sourceOccurrenceId,
      `${linkPath}.sourceOccurrenceId`,
    );
    const targetOccurrenceId = occurrenceId(
      link.targetOccurrenceId,
      `${linkPath}.targetOccurrenceId`,
    );
    const source = occurrences.get(sourceOccurrenceId);
    const target = occurrences.get(targetOccurrenceId);
    if (source === undefined || target === undefined)
      failProjectDocument(linkPath, 'must reference existing occurrences');
    const sourceRoom = requireKnownRoom(source, catalog);
    const targetRoom = requireKnownRoom(target, catalog);
    const validPrebossLink = sourceRoom.kind === 'Preboss' && targetRoom.kind === 'Boss';
    const validBossLink = sourceRoom.kind === 'Boss' && targetRoom.kind === 'PostBoss';
    if (!validPrebossLink && !validBossLink)
      failProjectDocument(linkPath, 'must link Preboss to Boss or Boss to PostBoss');
    const route = catalog.routes.byKey[routeKey];
    const biomeIndex = route?.biomeKeys.indexOf(layout.biomeKey) ?? -1;
    if (validPrebossLink && route?.prebossRoomGameNames?.[biomeIndex] !== sourceRoom.gameName) {
      failProjectDocument(linkPath, 'must originate from this route position Preboss');
    }
    if (
      validPrebossLink &&
      targetRoom.gameName !== layout.completion.bossRoomGameName &&
      targetRoom.gameName !== layout.completion.rivalsBossRoomGameName
    )
      failProjectDocument(linkPath, 'must target this biome completion Boss');
    if (validBossLink) {
      const expected = biomeIndex < 0 ? undefined : route?.postbossRoomGameNames[biomeIndex];
      if (expected === undefined || targetRoom.gameName !== expected)
        failProjectDocument(linkPath, 'must target this route position PostBoss');
    }
    return Object.freeze({ sourceOccurrenceId, targetOccurrenceId });
  });
  if (
    new Set(fixedRoomLinks.map((link) => `${link.sourceOccurrenceId}:${link.targetOccurrenceId}`))
      .size !== fixedRoomLinks.length
  )
    failProjectDocument(`${path}.fixedRoomLinks`, 'must not repeat fixed room links');
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
        ? decodeExitDecision(
            raw,
            layout,
            catalog,
            occurrences,
            additionalExitsFor,
            startOccurrenceId,
          )
        : kind === 'hub'
          ? decodeHubDecision(raw, layout, catalog, occurrences)
          : kind === 'localVisit'
            ? decodeLocalVisitDecision(raw, layout, catalog, occurrences)
            : failProjectDocument(`${raw.path}.kind`, `unknown decision ${kind}`);
    const identity =
      decision.kind === 'exit'
        ? `exit:${exitDecisionSourceKey(decision.source)}`
        : decision.kind === 'hub'
          ? `hubDecision:${decision.hubKey}`
          : `localVisit:${decision.sourceOccurrenceId}:${decision.groupKey}`;
    if (decisionSources.has(identity))
      failProjectDocument(raw.path, `duplicates decision source ${identity}`);
    decisionSources.add(identity);
    decisions.push(decision);
  }
  validateNormalDecisionProgressionBounds(
    decisions,
    occurrences,
    additionalExitsFor,
    catalog,
    layout,
    startOccurrenceId,
    path,
  );
  validateStagedSelections(
    decisions,
    occurrences,
    additionalExitsFor,
    catalog,
    layout,
    startOccurrenceId,
    path,
  );
  validateSelectedDecisionCycles(
    decisions,
    occurrences,
    additionalExitsFor,
    startOccurrenceId,
    path,
  );

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
      const continuation = selectedContinuationForDecision(
        decision,
        occurrences,
        additionalExitsFor,
      );
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
    for (const decision of decisions) {
      if (decision.kind !== 'hub' || !selectedSources.has(decision.source.occurrenceId)) continue;
      const handoff = decisions.find(
        (candidate): candidate is ExitDecision =>
          candidate.kind === 'exit' &&
          candidate.source.kind === 'hubDecision' &&
          candidate.source.decisionKey === decision.hubKey,
      );
      if (handoff === undefined) continue;
      const continuation = selectedContinuationForDecision(
        handoff,
        occurrences,
        additionalExitsFor,
      );
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
    for (const link of fixedRoomLinks) {
      if (!selectedSources.has(link.sourceOccurrenceId)) continue;
      if (!selectedSources.has(link.targetOccurrenceId)) {
        selectedSources.add(link.targetOccurrenceId);
        addedSelectedSource = true;
      }
    }
  }
  const selectedPrebosses = [...occurrences.values()].filter(
    (occurrence) =>
      selectedSources.has(occurrence.occurrenceId) &&
      requireKnownRoom(occurrence, catalog).kind === 'Preboss',
  );
  if (selectedPrebosses.length > 1) {
    failProjectDocument(`${path}.fixedRoomLinks`, 'must have at most one selected Preboss owner');
  }
  const expectedFixedRoomLinks = (() => {
    const preboss = selectedPrebosses[0];
    if (preboss === undefined) return [] as const;
    const bossOccurrenceId = fixedCompletionOccurrenceId(preboss.occurrenceId, 'boss');
    const route = catalog.routes.byKey[routeKey];
    const biomeIndex = route?.biomeKeys.indexOf(layout.biomeKey) ?? -1;
    const postbossGameName = biomeIndex < 0 ? undefined : route?.postbossRoomGameNames[biomeIndex];
    if (postbossGameName === undefined) {
      failProjectDocument(
        `${path}.fixedRoomLinks`,
        'cannot resolve the route-position Postboss declaration',
      );
    }
    const links: FixedRoomLink[] = [
      Object.freeze({
        sourceOccurrenceId: preboss.occurrenceId,
        targetOccurrenceId: bossOccurrenceId,
      }),
    ];
    if (postbossGameName !== null) {
      links.push(
        Object.freeze({
          sourceOccurrenceId: bossOccurrenceId,
          targetOccurrenceId: fixedCompletionOccurrenceId(preboss.occurrenceId, 'postboss'),
        }),
      );
    }
    return links;
  })();
  if (fixedRoomLinks.length !== expectedFixedRoomLinks.length) {
    failProjectDocument(
      `${path}.fixedRoomLinks`,
      selectedPrebosses.length === 0
        ? 'must be empty when no Preboss is selected'
        : `must contain exactly ${expectedFixedRoomLinks.length} fixed room links for the selected Preboss`,
    );
  }
  for (const [index, expected] of expectedFixedRoomLinks.entries()) {
    const actual = fixedRoomLinks[index];
    if (
      actual?.sourceOccurrenceId !== expected.sourceOccurrenceId ||
      actual.targetOccurrenceId !== expected.targetOccurrenceId
    ) {
      failProjectDocument(
        `${path}.fixedRoomLinks[${index}]`,
        'must match the selected Preboss fixed completion chain',
      );
    }
  }
  const selectedSpine = Object.freeze({
    startOccurrenceId,
    decisions: Object.freeze([...decisions]),
    occurrences: Object.freeze(
      [...occurrences.values()].map((occurrence) =>
        Object.freeze({
          occurrenceId: occurrence.occurrenceId,
          additionalExits: additionalExitsFor(
            occurrence.occurrenceId,
            `${occurrence.path}.additionalExits`,
          ),
        }),
      ),
    ),
  });
  for (const occurrence of occurrences.values()) {
    const room = requireKnownRoom(occurrence, catalog);
    for (const group of room.localChildren) {
      if (group.kind !== 'fixedRoomSlots') continue;
      const localDecisionCount = decisions.filter(
        (decision): decision is LocalVisitDecision =>
          decision.kind === 'localVisit' &&
          decision.sourceOccurrenceId === occurrence.occurrenceId &&
          decision.groupKey === group.key,
      ).length;
      if (localDecisionCount !== 1) {
        failProjectDocument(
          `${occurrence.path}.occurrenceId`,
          `${room.gameName} requires exactly one local visit decision for ${group.key}`,
        );
      }
    }
  }
  for (const [index, decision] of decisions.entries()) {
    const decisionPath = rawDecisions[index]?.path ?? path;
    if (decision.kind === 'localVisit') {
      const source = occurrences.get(decision.sourceOccurrenceId);
      if (source === undefined) {
        failProjectDocument(
          `${decisionPath}.sourceOccurrenceId`,
          `unknown occurrence ${decision.sourceOccurrenceId}`,
        );
      }
      continue;
    }
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

  for (const [index, link] of fixedRoomLinks.entries()) {
    const linkPath = `${path}.fixedRoomLinks[${index}]`;
    if (!selectedSources.has(link.sourceOccurrenceId))
      failProjectDocument(linkPath, 'source must be on the selected topology spine');
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
    const additional = additionalExitsFor(
      rawOccurrence.occurrenceId,
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
    if (decision.kind === 'localVisit') {
      const source = occurrences.get(decision.sourceOccurrenceId);
      if (source === undefined) {
        failProjectDocument(decisionPath, `unknown source ${decision.sourceOccurrenceId}`);
      }
      const room = requireKnownRoom(source, catalog);
      const descriptor = room.localChildren.find((group) => group.key === decision.groupKey);
      if (descriptor?.kind !== 'fixedRoomSlots') {
        failProjectDocument(decisionPath, `${room.gameName} has no local visit group`);
      }
      for (const slot of descriptor.slots) {
        const target = decision.targetsBySlot[slot.slotKey];
        if (target === undefined) failProjectDocument(decisionPath, `missing ${slot.slotKey}`);
        own(target.occurrenceId, {
          gameName: slot.roomGameName,
          role: 'ordinary',
          entryActive: decision.visitOrder.includes(target.occurrenceId),
          path: `${decisionPath}.targetsBySlot.${slot.slotKey}`,
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
  for (const [index, link] of fixedRoomLinks.entries()) {
    const target = occurrences.get(link.targetOccurrenceId);
    if (target === undefined)
      failProjectDocument(`${path}.fixedRoomLinks[${index}]`, 'unknown target');
    const source = occurrences.get(link.sourceOccurrenceId);
    if (source === undefined)
      failProjectDocument(`${path}.fixedRoomLinks[${index}]`, 'unknown source');
    const sourceRoom = requireKnownRoom(source, catalog);
    const targetRoom = requireKnownRoom(target, catalog);
    own(link.targetOccurrenceId, {
      gameName: targetRoom.gameName,
      role: 'ordinary',
      entryActive: true,
      path: `${path}.fixedRoomLinks[${index}].targetOccurrenceId`,
    });
    if (sourceRoom.kind !== 'Preboss' && sourceRoom.kind !== 'Boss')
      failProjectDocument(`${path}.fixedRoomLinks[${index}]`, 'source is not a fixed-link room');
  }
  for (const [index, decision] of decisions.entries()) {
    if (decision.kind !== 'exit') continue;
    validateDetourAutomaticContinuationDecision(
      decision,
      rawDecisions[index]?.path ?? path,
      occurrences,
      additionalExitsFor,
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
  return Object.freeze({
    startOccurrenceId,
    occurrences: Object.freeze(
      [...occurrences.values()].map((raw) => {
        const owner = owners.get(raw.occurrenceId);
        if (owner === undefined) failProjectDocument(raw.path, 'has no owner');
        return Object.freeze({
          raw,
          owner,
          additionalExits: additionalExitsFor(raw.occurrenceId, `${raw.path}.additionalExits`),
        });
      }),
    ),
    decisions: Object.freeze(decisions),
    fixedRoomLinks: Object.freeze(fixedRoomLinks),
  });
}

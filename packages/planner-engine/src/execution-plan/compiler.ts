import {
  createRoomRunStateCheckpointAddress,
  createLevelResolutionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
} from '../authored-project/addresses';
import type { TraitOfferOwnerAddress } from '../authored-project/addresses';
import type { CanonicalAuthoredRoom, CanonicalBatch } from '../simulation/materialization';
import { assertExactProjectEvaluationAssembly } from '../simulation/project-evaluation-assembly';
import type { CompleteValidBiomeProjectEvaluation } from '../simulation/evaluation-products';
import type { RunStateSnapshot } from '../simulation/rewards/run-state';
import type { RewardEvent } from '../simulation/rewards/model';
import {
  appendSteadyGrowthTimelineEffects,
  appendTranscendentEmbryoTimelineEffects,
} from '../simulation/room-actions';
import {
  EXECUTION_CATALOG_VERSION,
  EXECUTION_PLAN_FORMAT,
  EXECUTION_PROTOCOL_VERSION,
  type ExecutionCompilerInput,
  type ExecutionOutgoing,
  type ExecutionPlan,
  type ExecutionReward,
  type ExecutionRoom,
  type ExecutionRunStateCount,
  type ExecutionRunStateDiagnostic,
  type ExecutionAcquisitionRole,
  type ExecutionLevelResolution,
  type ExecutionTraceStep,
  type ExecutionTraitOffer,
} from './model';

class CompilerError extends Error {
  readonly code: NonNullable<import('./model').ExecutionCompilerError['code']>;

  constructor(
    code: NonNullable<import('./model').ExecutionCompilerError['code']>,
    message: string,
  ) {
    super(message);
    this.name = 'ExecutionCompilerError';
    this.code = code;
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(',')}}`;
}

function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const character of stableJson(value)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function ownerKey(room: CanonicalAuthoredRoom): string {
  return semanticAddressKey(room.origin);
}

function executionReward(room: CanonicalAuthoredRoom): ExecutionReward | undefined {
  const incoming = room.incomingReward;
  if (incoming === undefined) return undefined;
  const payload = incoming.offer.payload;
  return Object.freeze({
    rewardType: incoming.offer.rewardType,
    producerLifecycleKey: incoming.producerLifecycleKey,
    ...(incoming.resolvedStoreKey === undefined
      ? {}
      : { resolvedStoreKey: incoming.resolvedStoreKey }),
    ...(payload?.kind === 'BoonSource' ? { source: payload.source } : {}),
    ...(payload?.kind === 'DevotionPair'
      ? { source: payload.chosenSource, spurnedSource: payload.spurnedSource }
      : {}),
  });
}

function executionCount(value: ExecutionRunStateCount): ExecutionRunStateCount {
  return value.kind === 'exact'
    ? Object.freeze({ kind: 'exact', count: value.count })
    : Object.freeze({ kind: 'range', min: value.min, max: value.max });
}

function diagnostic(
  snapshot: RunStateSnapshot | undefined,
): ExecutionRunStateDiagnostic | undefined {
  if (snapshot === undefined) return undefined;
  return Object.freeze({
    owner: semanticAddressKey(snapshot.owner),
    checkpoint: snapshot.checkpoint === 'roomEntered' ? 'roomEntered' : 'beforeRoomExit',
    counters: Object.freeze({
      biomeDepthCache: snapshot.counters.biomeDepthCache,
      biomeEncounterDepth: snapshot.counters.biomeEncounterDepth,
      routeEncounterDepth: snapshot.counters.routeEncounterDepth,
      roomHistoryOrdinal: snapshot.counters.roomHistoryOrdinal,
    }),
    bags: Object.freeze(
      snapshot.bags.map((bag) =>
        Object.freeze({ storeKey: bag.storeKey, remaining: executionCount(bag.remaining) }),
      ),
    ),
    godPool: Object.freeze({
      ...snapshot.godPool,
      acquiredSourceKeys: Object.freeze([...snapshot.godPool.acquiredSourceKeys]),
      effectiveSourceKeys: Object.freeze([...snapshot.godPool.effectiveSourceKeys]),
    }),
    traits: Object.freeze({
      equipped: Object.freeze(
        Object.values(snapshot.traits.equippedTraits).map((trait) =>
          Object.freeze({
            traitKey: trait.traitKey,
            ...(trait.rarity === undefined ? {} : { rarity: trait.rarity }),
            ...(trait.level === undefined ? {} : { level: trait.level }),
            ...(trait.hammerRank === undefined ? {} : { hammerRank: trait.hammerRank }),
          }),
        ),
      ),
      slots: Object.freeze(
        (['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana', 'Spell'] as const).map((slot) =>
          Object.freeze({
            slot,
            ...(snapshot.traits.equippedSlots[slot] === undefined
              ? {}
              : { traitKey: snapshot.traits.equippedSlots[slot]!.traitKey }),
          }),
        ),
      ),
      elements: Object.freeze({ ...snapshot.traits.elementCounts }),
      godRarityCounts: Object.freeze({ ...snapshot.traits.godBoonRarityCounts }),
      upgradableCount: snapshot.traits.upgradableTraitCount,
      bannedTraitKeys: Object.freeze([...snapshot.traits.bannedTraitKeys]),
    }),
    arcana: Object.freeze({
      active: Object.freeze(
        snapshot.arcanaFear.arcana.active.map((card) =>
          Object.freeze({ key: card.key, origin: card.origin, rarity: card.rarity }),
        ),
      ),
    }),
    vows: Object.freeze({
      configuredRanks: Object.freeze({ ...snapshot.arcanaFear.fear.configuredRanks }),
      effectiveRanks: Object.freeze({ ...snapshot.arcanaFear.fear.effectiveRanks }),
      disabledKeys: Object.freeze([...snapshot.arcanaFear.fear.disabledVowKeys]),
    }),
    forfeit: snapshot.forfeitStatus,
  });
}

function roomSnapshots(
  biome: CompleteValidBiomeProjectEvaluation,
): ReadonlyMap<string, RunStateSnapshot> {
  const result = new Map<string, RunStateSnapshot>();
  for (const snapshot of biome.rewards.runStateSnapshots) {
    result.set(semanticAddressKey(snapshot.owner), snapshot);
  }
  return result;
}

function addRoom(
  rooms: CanonicalAuthoredRoom[],
  seen: Set<string>,
  room: CanonicalAuthoredRoom,
): void {
  const key = ownerKey(room);
  if (seen.has(key)) return;
  seen.add(key);
  rooms.push(room);
}

function orderedRooms(
  biomes: readonly CompleteValidBiomeProjectEvaluation[],
): CanonicalAuthoredRoom[] {
  const rooms: CanonicalAuthoredRoom[] = [];
  const seen = new Set<string>();
  for (const evaluation of biomes) {
    const snapshot = evaluation.snapshot;
    addRoom(rooms, seen, snapshot.entryRoom);
    for (const decision of snapshot.decisions) {
      if (decision.kind !== 'batch') continue;
      for (const target of decision.targets) addRoom(rooms, seen, target.room);
      for (const additional of decision.additional) addRoom(rooms, seen, additional.room);
    }
    for (const link of snapshot.fixedRoomLinks) {
      addRoom(rooms, seen, link.source);
      addRoom(rooms, seen, link.target);
    }
  }
  return rooms;
}

function batchByRoom(
  biomes: readonly CompleteValidBiomeProjectEvaluation[],
): ReadonlyMap<string, CanonicalBatch> {
  const result = new Map<string, CanonicalBatch>();
  for (const evaluation of biomes) {
    for (const decision of evaluation.snapshot.decisions) {
      if (decision.kind !== 'batch' || decision.parent.origin.kind !== 'occurrence') continue;
      result.set(semanticAddressKey(decision.parent.origin), decision);
    }
  }
  return result;
}

function fixedTargetByRoom(
  biomes: readonly CompleteValidBiomeProjectEvaluation[],
): ReadonlyMap<string, CanonicalAuthoredRoom> {
  const result = new Map<string, CanonicalAuthoredRoom>();
  for (const evaluation of biomes) {
    for (const link of evaluation.snapshot.fixedRoomLinks) {
      result.set(ownerKey(link.source), link.target);
    }
  }
  return result;
}

function executionTrace(
  room: CanonicalAuthoredRoom,
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
  biome: CompleteValidBiomeProjectEvaluation,
): readonly ExecutionTraceStep[] {
  if (!room.entered) return Object.freeze([]);
  const owner = ownerKey(room);
  const entryOwner = createRoomRunStateCheckpointAddress(room.origin, { kind: 'roomEntered' });
  const exitOwner = createRoomRunStateCheckpointAddress(room.origin, { kind: 'beforeRoomExit' });
  const entrySnapshot = snapshots.get(semanticAddressKey(entryOwner));
  const exitSnapshot = snapshots.get(semanticAddressKey(exitOwner));
  if (entrySnapshot === undefined || exitSnapshot === undefined) {
    throw new CompilerError(
      'runStateMissing',
      `${room.gameName} is entered but lacks roomEntered and beforeRoomExit snapshots`,
    );
  }
  const entry = diagnostic(entrySnapshot);
  const exit = diagnostic(exitSnapshot);
  if (entry === undefined || exit === undefined) {
    throw new CompilerError(
      'runStateMissing',
      `${room.gameName} is entered but lacks a usable run-state snapshot`,
    );
  }
  const sourceForAction = (actionOwner: (typeof room.roomActionRoster.rows)[number]['owner']) =>
    actionOwner.kind === 'acquisitionRole' ? actionOwner.owner : actionOwner;
  const agreement = <T>(values: readonly T[], label: string): T => {
    const first = values[0];
    if (first === undefined || values.some((value) => stableJson(value) !== stableJson(first)))
      throw new CompilerError(
        'executionCoverageMissing',
        `${room.gameName} has divergent ${label}`,
      );
    return first;
  };
  const only = <T>(values: readonly T[], label: string): T => {
    if (values.length !== 1 || values[0] === undefined)
      throw new CompilerError('executionCoverageMissing', `${room.gameName} is missing ${label}`);
    return values[0];
  };
  const traitOffer = (
    source: TraitOfferOwnerAddress,
    role: string,
  ): ExecutionTraitOffer | undefined => {
    const matches = biome.rewards.selectedTraitOffers.filter(
      (candidate) =>
        semanticAddressKey(candidate.address) ===
        semanticAddressKey(createTraitOfferAddress(source, role)),
    );
    if (matches.length > 1)
      throw new CompilerError(
        'executionCoverageMissing',
        `duplicate trait offer ${semanticAddressKey(createTraitOfferAddress(source, role))}`,
      );
    const selected = matches[0];
    if (selected === undefined) return undefined;
    if (selected.offer.kind === 'fallbackGold')
      return Object.freeze({ kind: 'fallbackGold' as const, giver: selected.offer.giverKey });
    if (selected.offer.kind !== 'traits')
      throw new CompilerError(
        'executionCoverageMissing',
        `unsupported trait offer ${semanticAddressKey(selected.address)}`,
      );
    const levels = agreement(
      selected.branches.map((branch) => branch.effectiveLevels),
      `trait effective levels ${semanticAddressKey(selected.address)}`,
    );
    const fallbackMatches = biome.rewards.runtimeOfferFallbacks.filter(
      (candidate) => semanticAddressKey(candidate.address) === semanticAddressKey(selected.address),
    );
    if (fallbackMatches.length > 1)
      throw new CompilerError(
        'executionCoverageMissing',
        `duplicate runtime fallback ${semanticAddressKey(selected.address)}`,
      );
    const fallback = fallbackMatches[0];
    const replacements = agreement(
      selected.branches.map((branch) =>
        branch.assessments.map((assessment) => assessment.replacementTransition),
      ),
      `trait replacements ${semanticAddressKey(selected.address)}`,
    );
    return Object.freeze({
      kind: 'traits' as const,
      giver: selected.offer.giverKey,
      options: Object.freeze(
        selected.offer.options.map((option, index) => {
          const replacement = replacements[index];
          return Object.freeze({
            key: option.traitKey,
            ...(option.rarity === undefined ? {} : { rarity: option.rarity }),
            ...(levels[index] === undefined ? {} : { effectiveLevel: levels[index] }),
            ...(replacement === undefined
              ? {}
              : {
                  replacement: Object.freeze({
                    slot: replacement.slot,
                    replacedTraitKey: replacement.replacedTraitKey,
                    oldRarity: replacement.oldRarity,
                    newTraitKey: replacement.newTraitKey,
                    requiredRarity: replacement.requiredRarity,
                    ...(replacement.levelBonus === undefined
                      ? {}
                      : { levelBonus: replacement.levelBonus }),
                  }),
                }),
          });
        }),
      ),
      selected: selected.offer.selectedOptionKey,
      ...(selected.offer.rejectedOptionKey === undefined
        ? {}
        : { rejected: selected.offer.rejectedOptionKey }),
      ...(fallback === undefined ? {} : { runtimeFallback: fallback.fallbackKey }),
    });
  };
  const levelResolution = (
    source: TraitOfferOwnerAddress,
    role: string,
  ): ExecutionLevelResolution | undefined => {
    const matches = biome.rewards.selectedLevelResolutions.filter(
      (candidate) =>
        semanticAddressKey(candidate.address) ===
        semanticAddressKey(createLevelResolutionAddress(source, role)),
    );
    if (matches.length > 1)
      throw new CompilerError(
        'executionCoverageMissing',
        `duplicate level resolution ${semanticAddressKey(createLevelResolutionAddress(source, role))}`,
      );
    const selected = matches[0];
    if (selected === undefined) return undefined;
    const levelCount = agreement(
      selected.branches.map((branch) => branch.levelCount),
      `level count ${semanticAddressKey(selected.address)}`,
    );
    return Object.freeze({
      offeredTargets: Object.freeze(
        selected.value.kind === 'choice' ? [...selected.value.offeredTraitKeys] : [],
      ),
      selectedTarget:
        selected.value.kind === 'choice'
          ? selected.value.selectedTraitKey
          : selected.value.targetTraitKey,
      levelCount,
    });
  };
  const result: ExecutionTraceStep[] = [
    Object.freeze({
      id: `${owner}:roomEntered`,
      kind: 'roomEntered' as const,
      owner,
      runState: entry,
    }),
  ];
  const timeline = appendTranscendentEmbryoTimelineEffects(
    appendSteadyGrowthTimelineEffects(
      room.roomLifecycleTimeline,
      biome.rewards.steadyGrowthOutcomes.map((outcome) => outcome.address),
    ),
    biome.rewards.transcendentEmbryoOutcomes.map((outcome) => outcome.address),
  );
  for (const timelineEntry of timeline.entries) {
    const timeline = timelineEntry;
    if (timeline.kind === 'boundary') {
      const boundary = timeline.boundary;
      if (boundary.kind === 'roomEntered') continue;
      if (boundary.kind === 'encounterStart') {
        const phase = room.encounterPhases.find(
          (candidate) => candidate.slotKey === boundary.phaseKey,
        );
        if (phase === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `${room.gameName} lacks encounter phase ${boundary.phaseKey}`,
          );
        result.push(
          Object.freeze({
            id: `${owner}:${boundary.key}`,
            kind: 'encounterStart' as const,
            owner,
            phase: boundary.phaseKey,
            encounter: phase.encounterKey,
            encounterKind: phase.kind,
          }),
        );
      } else if (boundary.kind === 'encounterEnd' || boundary.kind === 'bossDefeated') {
        result.push(
          Object.freeze({
            id: `${owner}:${boundary.key}`,
            kind: 'encounterEnd' as const,
            owner,
            phase: boundary.phaseKey,
            endEffectsExpected: true,
          }),
        );
      } else if (boundary.kind === 'cleanup')
        result.push(Object.freeze({ id: `${owner}:cleanup`, kind: 'cleanup' as const, owner }));
      continue;
    }
    if (timeline.kind === 'automaticEffect') {
      if (timeline.effect === 'steadyGrowth') {
        const outcome = biome.rewards.steadyGrowthOutcomes.find(
          (candidate) =>
            semanticAddressKey(candidate.address) === semanticAddressKey(timeline.address),
        );
        if (outcome === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `missing automatic outcome ${semanticAddressKey(timeline.address)}`,
          );
        const selected = room.encounters.steadyGrowthTargetByPhase?.[timeline.phaseKey];
        if (selected === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `missing Steady Growth target ${timeline.phaseKey}`,
          );
        result.push(
          Object.freeze({
            id: `${owner}:steady:${timeline.phaseKey}`,
            kind: 'steadyGrowth' as const,
            owner,
            phase: timeline.phaseKey,
            source: outcome.sourceTraitKey,
            target: selected,
          }),
        );
      } else {
        const outcome = biome.rewards.transcendentEmbryoOutcomes.find(
          (candidate) =>
            semanticAddressKey(candidate.address) === semanticAddressKey(timeline.address),
        );
        if (outcome === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `missing automatic outcome ${semanticAddressKey(timeline.address)}`,
          );
        const selected = room.encounters.transcendentEmbryoBlessingByPhase?.[timeline.phaseKey];
        const rarities = outcome.transformationRarities;
        if (selected === undefined || rarities.length !== 1)
          throw new CompilerError(
            'executionCoverageMissing',
            `missing or divergent Embryo outcome ${timeline.phaseKey}`,
          );
        result.push(
          Object.freeze({
            id: `${owner}:embryo:${timeline.phaseKey}`,
            kind: 'transcendentEmbryo' as const,
            owner,
            phase: timeline.phaseKey,
            source: outcome.sourceBlessingKey,
            target: selected,
            rarity: rarities[0]!,
          }),
        );
      }
      continue;
    }
    if (
      timeline.action.reference.kind === 'interactEncounter' ||
      timeline.action.reference.kind === 'interactGorgon'
    ) {
      result.push(
        Object.freeze({
          id: `${owner}:${timeline.action.key}`,
          kind: 'encounterInteraction' as const,
          owner: semanticAddressKey(timeline.action.owner),
          phaseKey: timeline.phaseKey ?? timeline.action.reference.phaseKey,
        }),
      );
      continue;
    }
    if (
      timeline.action.reference.kind !== 'interactIncomingReward' &&
      timeline.action.reference.kind !== 'interactLocalReward' &&
      timeline.action.reference.kind !== 'interactAcquisitionEntry'
    ) {
      continue;
    }
    const source = sourceForAction(timeline.action.owner);
    if (
      source.kind !== 'incomingReward' &&
      source.kind !== 'localReward' &&
      source.kind !== 'rewardWheelOffer' &&
      source.kind !== 'shopOffer' &&
      source.kind !== 'encounterPhase' &&
      source.kind !== 'gorgonPhase' &&
      source.kind !== 'acquisitionEntry'
    ) {
      if (timeline.action.participation === 'optional') continue;
      throw new CompilerError(
        'executionCoverageMissing',
        `unmapped acquisition owner ${semanticAddressKey(source)}`,
      );
    }
    const branchRows = biome.rewards.branches.map((branch) => {
      const event = only(
        branch.events.filter(
          (
            candidate,
          ): candidate is Extract<RewardEvent, { readonly kind: 'concreteAcquisition' }> =>
            candidate.kind === 'concreteAcquisition' &&
            semanticAddressKey(candidate.origin) === semanticAddressKey(source) &&
            candidate.acquisition.role ===
              (timeline.action.owner.kind === 'acquisitionRole'
                ? timeline.action.owner.acquisitionRole
                : 'self'),
        ),
        `acquisition ${semanticAddressKey(source)}`,
      );
      const offered = only(
        branch.events.filter(
          (candidate): candidate is Extract<RewardEvent, { readonly kind: 'rewardOffered' }> =>
            candidate.kind === 'rewardOffered' &&
            semanticAddressKey(candidate.origin) === semanticAddressKey(source),
        ),
        `reward provenance ${semanticAddressKey(source)}`,
      );
      return Object.freeze({ event, offered });
    });
    const row = agreement(
      branchRows.map((candidate) => candidate),
      `acquisition ${semanticAddressKey(source)}`,
    );
    const role = row.event.acquisition.role;
    const offer = traitOffer(source, role);
    const level = levelResolution(source, role);
    const roles: readonly ExecutionAcquisitionRole[] = Object.freeze([
      Object.freeze({
        role,
        lifecyclePoint: row.event.acquisition.lifecyclePoint,
        kind: row.event.acquisition.acquisition.kind,
        gameName: row.event.acquisition.acquisition.gameName,
        ...(row.event.settlement === undefined
          ? {}
          : {
              settlement: Object.freeze({
                site: semanticAddressKey(row.event.settlement.site),
                entry: semanticAddressKey(row.event.settlement.entry),
              }),
            }),
        ...(offer === undefined ? {} : { traitOffer: offer }),
        ...(level === undefined ? {} : { levelResolution: level }),
      }),
    ]);
    const offered = row.offered.offer;
    const reward: ExecutionReward = Object.freeze({
      rewardType: offered.rewardType,
      producerLifecycleKey: row.event.acquisition.lifecyclePoint,
      ...(row.offered.storeKey === undefined ? {} : { resolvedStoreKey: row.offered.storeKey }),
      ...(offered.payload?.kind === 'BoonSource' ? { source: offered.payload.source } : {}),
      ...(offered.payload?.kind === 'DevotionPair'
        ? { source: offered.payload.chosenSource, spurnedSource: offered.payload.spurnedSource }
        : {}),
    });
    result.push(
      Object.freeze({
        id: `${owner}:${timeline.action.key}`,
        kind: 'acquireReward' as const,
        owner: semanticAddressKey(timeline.action.owner),
        sourceOwner: semanticAddressKey(source),
        reward,
        producerLifecycleKey: row.event.acquisition.lifecyclePoint,
        roles,
      }),
    );
  }
  result.push(
    Object.freeze({
      id: `${owner}:beforeRoomExit`,
      kind: 'beforeRoomExit' as const,
      owner,
      runState: exit,
    }),
  );
  return Object.freeze(result);
}

function executionOutgoing(
  room: CanonicalAuthoredRoom,
  batches: ReadonlyMap<string, CanonicalBatch>,
  fixedTargets: ReadonlyMap<string, CanonicalAuthoredRoom>,
  crossBiomeTarget: CanonicalAuthoredRoom | undefined,
  crossBiomeSourceId: string | undefined,
): ExecutionOutgoing {
  const owner = ownerKey(room);
  const batch = batches.get(owner);
  if (batch !== undefined) {
    if (batch.selectedExitKey === null) {
      throw new CompilerError('openingSelectionMissing', `${room.gameName} has no selected exit`);
    }
    return Object.freeze({
      owner: semanticAddressKey(batch.origin),
      kind: 'batch',
      targets: Object.freeze(
        batch.targets.map((target) =>
          Object.freeze({
            exitKey: target.exit.exitKey,
            index: target.exit.index,
            type: target.exit.kind === 'available' ? target.exit.type : '',
            room: Object.freeze({
              id: target.room.occurrenceId,
              biomeKey: target.room.origin.biomeKey,
              gameName: target.room.gameName,
            }),
            picked: target.picked,
          }),
        ),
      ),
      selectedExitKey: batch.selectedExitKey,
      ...(batch.resolvedSharedRewardStoreKey === undefined
        ? {}
        : { resolvedSharedRewardStoreKey: batch.resolvedSharedRewardStoreKey }),
    });
  }
  const fixed =
    fixedTargets.get(owner) ?? (owner === crossBiomeSourceId ? crossBiomeTarget : undefined);
  if (fixed !== undefined) {
    return Object.freeze({
      owner,
      kind: 'fixed',
      target: Object.freeze({
        id: fixed.occurrenceId,
        biomeKey: fixed.origin.biomeKey,
        gameName: fixed.gameName,
      }),
    });
  }
  return Object.freeze({ owner, kind: 'terminal' });
}

function executionRoom(
  room: CanonicalAuthoredRoom,
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
  batches: ReadonlyMap<string, CanonicalBatch>,
  fixedTargets: ReadonlyMap<string, CanonicalAuthoredRoom>,
  crossBiomeTarget: CanonicalAuthoredRoom | undefined,
  crossBiomeSourceId: string | undefined,
  biome: CompleteValidBiomeProjectEvaluation,
): ExecutionRoom {
  const reward = executionReward(room);
  return Object.freeze({
    id: room.occurrenceId,
    owner: ownerKey(room),
    biomeKey: room.origin.biomeKey,
    gameName: room.gameName,
    kind: room.encounterEnvelopeKey,
    entered: room.entered,
    contents: Object.freeze({
      ...(reward === undefined ? {} : { incomingReward: reward }),
      encounterPhases: Object.freeze(
        room.encounterPhases.map((phase) =>
          Object.freeze({
            slotKey: phase.slotKey,
            encounterKey: phase.encounterKey,
            kind: phase.kind,
          }),
        ),
      ),
      requiredObjects: Object.freeze((room.requiredObjects ?? []).map((object) => object.key)),
    }),
    trace: executionTrace(room, snapshots, biome),
    outgoing: executionOutgoing(room, batches, fixedTargets, crossBiomeTarget, crossBiomeSourceId),
  });
}

function completeBiomes(
  assembly: ExecutionCompilerInput['assembly'],
): CompleteValidBiomeProjectEvaluation[] {
  const route = assembly.evaluation.route;
  if (!route.summary.eligibleForExecutionPlan) {
    throw new CompilerError('notEligible', 'project evaluation is not eligible for execution');
  }
  const values: CompleteValidBiomeProjectEvaluation[] = [];
  for (const biome of route.biomes) {
    if (biome.authoring !== 'complete' || biome.validity !== 'valid') {
      throw new CompilerError('notEligible', `${biome.biomeKey} is not complete-valid`);
    }
    values.push(biome);
  }
  return values;
}

export function compileExecutionPlan({ assembly }: ExecutionCompilerInput): ExecutionPlan {
  assertExactProjectEvaluationAssembly(assembly);
  const { evaluation } = assembly;
  if (evaluation.catalogVersion !== EXECUTION_CATALOG_VERSION) {
    throw new CompilerError('unsupportedExtent', 'execution catalog version is unsupported');
  }
  if (evaluation.route.routeKey !== 'Underworld') {
    throw new CompilerError('unsupportedRoute', 'F/G execution supports only the Underworld route');
  }
  const keys = evaluation.route.configuredBiomeKeys;
  if (
    !(keys.length === 1 && keys[0] === 'F') &&
    !(keys.length === 2 && keys[0] === 'F' && keys[1] === 'G')
  ) {
    throw new CompilerError(
      'unsupportedExtent',
      'execution supports only configured F or F/G prefixes',
    );
  }
  const biomes = completeBiomes(assembly);
  const rooms = orderedRooms(biomes);
  if (rooms.length === 0 || rooms.length > 256) {
    throw new CompilerError('openingMissing', 'execution route has no bounded room product');
  }
  const batches = batchByRoom(biomes);
  const fixedTargets = fixedTargetByRoom(biomes);
  const snapshots = new Map<string, RunStateSnapshot>();
  for (const biome of biomes) {
    for (const [key, value] of roomSnapshots(biome)) snapshots.set(key, value);
  }
  const entryByBiome = new Map(
    biomes.map((biome) => [biome.biomeKey, biome.snapshot.entryRoom] as const),
  );
  const executionRooms = rooms.map((room) => {
    const index = keys.indexOf(room.origin.biomeKey);
    const nextBiomeKey = index >= 0 ? keys[index + 1] : undefined;
    const crossBiomeTarget =
      nextBiomeKey !== undefined && room.gameName === `${room.origin.biomeKey}_PostBoss01`
        ? entryByBiome.get(nextBiomeKey)
        : undefined;
    const crossBiomeSourceId = crossBiomeTarget === undefined ? undefined : ownerKey(room);
    const biome = biomes.find((candidate) => candidate.biomeKey === room.origin.biomeKey);
    if (biome === undefined) {
      throw new CompilerError(
        'executionCoverageMissing',
        `${room.gameName} has no complete-valid biome evaluation`,
      );
    }
    return executionRoom(
      room,
      snapshots,
      batches,
      fixedTargets,
      crossBiomeTarget,
      crossBiomeSourceId,
      biome,
    );
  });
  const extent = Object.freeze({
    kind: 'configuredPrefix' as const,
    biomeKeys: Object.freeze([...keys]) as readonly ['F'] | readonly ['F', 'G'],
    terminalBiomeKey: keys[keys.length - 1] as 'F' | 'G',
  });
  const base = Object.freeze({
    format: EXECUTION_PLAN_FORMAT,
    protocolVersion: EXECUTION_PROTOCOL_VERSION,
    catalogVersion: evaluation.catalogVersion,
    projectId: evaluation.projectId,
    routeKey: 'Underworld' as const,
    extent,
    rooms: Object.freeze(executionRooms),
  });
  return Object.freeze({ ...base, planFingerprint: fingerprint(base) });
}

export { CompilerError as ExecutionCompilerError };

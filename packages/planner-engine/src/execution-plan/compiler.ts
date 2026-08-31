import {
  createRoomRunStateCheckpointAddress,
  createEncounterPhaseAddress,
  createBiomeAddress,
  createLevelResolutionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
} from '../authored-project/addresses';
import { parseSeaStarDuplicateSiteKey } from '../authored-project/sea-star';
import { parseArtificerReplacementEntryKey } from '../authored-project/artificer';
import type { TraitOfferOwnerAddress } from '../authored-project/addresses';
import type { CanonicalAuthoredRoom, CanonicalBatch } from '../simulation/materialization';
import { assertExactProjectEvaluationAssembly } from '../simulation/project-evaluation-assembly';
import type { CompleteValidBiomeProjectEvaluation } from '../simulation/evaluation-products';
import type { RunStateSnapshot } from '../simulation/rewards/run-state';
import type { RewardEvent } from '../simulation/rewards/model';
import type { TraitHistoryEvent } from '../simulation/trait-history';
import type { ResolvedRewardOffer } from '../reward-kernel';
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

function agreement<T>(values: readonly T[], label: string): T {
  const first = values[0];
  if (first === undefined || values.some((value) => stableJson(value) !== stableJson(first)))
    throw new CompilerError('executionCoverageMissing', `divergent ${label}`);
  return first;
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
  return executionRewardFromOffer(
    incoming.offer,
    incoming.producerLifecycleKey,
    incoming.resolvedStoreKey,
    incoming.acquisitionEnabled,
  );
}

function executionRewardFromOffer(
  offer: ResolvedRewardOffer,
  producerLifecycleKey: string,
  resolvedStoreKey?: string,
  acquisitionEnabled?: boolean,
): ExecutionReward {
  const payload = offer.payload;
  return Object.freeze({
    rewardType: offer.rewardType,
    producerLifecycleKey,
    ...(resolvedStoreKey === undefined ? {} : { resolvedStoreKey }),
    ...(acquisitionEnabled === undefined || acquisitionEnabled
      ? {}
      : { acquisitionEnabled: false }),
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

function executionResources(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
): ExecutionRoom['contents']['resources'] | undefined {
  const owner = ownerKey(room);
  const rows = biome.rewards.branches.map((branch) =>
    (branch.traitHistory?.events ?? [])
      .filter(
        (event): event is Extract<TraitHistoryEvent, { readonly kind: 'elementContribution' }> =>
          event.kind === 'elementContribution' &&
          semanticAddressKey(event.owner) === owner &&
          event.acquisitionPoint === 'roomExited' &&
          event.acquisitionRole.startsWith('resource:'),
      )
      .map((event) =>
        Object.freeze({
          acquisitionRole: event.acquisitionRole,
          grantedTraitKey: event.acquisitionRole.slice('resource:'.length),
          contributions: Object.freeze({ ...event.contributions }),
        }),
      ),
  );
  const first = rows[0];
  if (first === undefined || first.length === 0) return undefined;
  if (rows.some((row) => stableJson(row) !== stableJson(first)))
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} has divergent successful resource outcomes`,
    );
  return Object.freeze(first);
}

function shopOptionKeys(room: CanonicalAuthoredRoom, biome: CompleteValidBiomeProjectEvaluation) {
  const owner = ownerKey(room);
  const offerCount = room.entryState?.offers.length ?? 0;
  const rows = biome.rewards.branches.map((branch) =>
    branch.events
      .filter(
        (event): event is Extract<RewardEvent, { readonly kind: 'shopInventorySupported' }> =>
          event.kind === 'shopInventorySupported' && semanticAddressKey(event.origin) === owner,
      )
      .map((event) => event.optionKeys),
  );
  const first = rows[0]?.[0];
  if (
    first === undefined ||
    first.length !== offerCount ||
    rows.some((row) => row.length !== 1 || row[0]?.length !== offerCount)
  )
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Shop inventory evidence`,
    );
  return agreement(
    rows.map((row) => row[0]),
    `${room.gameName} Shop option order`,
  );
}

function travelDealRefill(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
  offers: readonly { readonly offerKey: string }[],
):
  | {
      readonly sourceOfferKey: string;
      readonly slotIndex: number;
      readonly optionKey: string;
      readonly reward: ExecutionReward;
    }
  | undefined {
  const rows = biome.rewards.derivedAcquisitionEntries.filter(
    (entry) =>
      entry.kind === 'travelDealRefill' &&
      entry.sourceOfferKey !== undefined &&
      offers.some((offer) => offer.offerKey === entry.sourceOfferKey),
  );
  if (rows.length === 0) return undefined;
  const row = rows[0]!;
  agreement(
    rows.map((candidate) =>
      Object.freeze({
        address: semanticAddressKey(candidate.address),
        sourceOfferKey: candidate.sourceOfferKey,
        slotIndex: candidate.slotIndex,
      }),
    ),
    `${room.gameName} Travel Deal refill`,
  );
  if (row.sourceOfferKey === undefined || row.slotIndex === undefined)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Travel Deal source`,
    );
  const entry = Object.values(room.acquisitionSites)
    .map((site) => site.entries.travelDealRefill)
    .find((candidate) => candidate !== undefined);
  if (entry === undefined || entry === null)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Travel Deal result`,
    );
  const optionRows = biome.rewards.branches.map((branch) =>
    branch.events
      .filter(
        (event): event is Extract<RewardEvent, { readonly kind: 'shopInventorySupported' }> =>
          event.kind === 'shopInventorySupported' &&
          semanticAddressKey(event.origin) === semanticAddressKey(row.address),
      )
      .map((event) => event.optionKeys[row.slotIndex!]),
  );
  const optionKey = agreement(
    optionRows.map((options) => {
      if (options.length !== 1 || options[0] === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} lacks Travel Deal option`,
        );
      return options[0];
    }),
    `${room.gameName} Travel Deal option`,
  );
  return Object.freeze({
    sourceOfferKey: row.sourceOfferKey,
    slotIndex: row.slotIndex,
    optionKey,
    reward: executionRewardFromOffer(entry.offer, 'Shop'),
  });
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
    chaos: Object.freeze({
      active: Object.freeze(
        snapshot.traits.chaos.active.map((entry) =>
          Object.freeze({
            curseKey: entry.curseKey,
            blessingKey: entry.blessingKey,
            rarity: entry.rarity,
            clock: entry.clock,
            remaining: entry.remaining,
          }),
        ),
      ),
      matured: Object.freeze(
        snapshot.traits.chaos.matured.map((entry) =>
          Object.freeze({
            blessingKey: entry.blessingKey,
            rarity: entry.rarity,
          }),
        ),
      ),
    }),
    keepsakes: Object.freeze({
      currentKey: snapshot.keepsakes.currentKey,
      usedKeys: Object.freeze(snapshot.keepsakes.history.map((entry) => entry.key)),
      blockedKeys: Object.freeze([...snapshot.keepsakes.removedKeys]),
      fatedStatus: snapshot.keepsakes.fatedStatus,
    }),
    rewardPriorities: Object.freeze([...snapshot.rewardPriorities]),
    hexProgress: Object.freeze({
      ...(snapshot.hexObserver.spellTraitKey === undefined
        ? {}
        : { spellTraitKey: snapshot.hexObserver.spellTraitKey }),
      ...(snapshot.hexObserver.layoutKey === undefined
        ? {}
        : { layoutKey: snapshot.hexObserver.layoutKey }),
      talentKeys: snapshot.hexObserver.talentKeys,
      closed: snapshot.hexObserver.closed,
      bankedPathPoints: snapshot.hexObserver.bankedPathPoints,
      investedPathPoints: snapshot.hexObserver.investedPathPoints,
    }),
    artificer: snapshot.artificer === undefined ? null : Object.freeze({ ...snapshot.artificer }),
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
    if (selected.offer.kind === 'chaos')
      return Object.freeze({
        kind: 'chaos' as const,
        giver: 'Chaos' as const,
        curseOptions: Object.freeze(
          selected.offer.curseOptions.map((option) =>
            Object.freeze({ curseKey: option.curseKey, requirementCount: option.requirementCount }),
          ),
        ),
        selected: selected.offer.selectedOptionKey,
        selectedCurseValues: Object.freeze({ ...selected.offer.selectedCurseValues }),
        blessingKey: selected.offer.blessingKey,
        rarity: selected.offer.rarity,
        blessingValues: Object.freeze({ ...selected.offer.blessingValues }),
      });
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
      const phaseKey = timeline.phaseKey ?? timeline.action.reference.phaseKey;
      const encounterKey = room.encounters.encounterKeyByPhase[phaseKey];
      const phase = createEncounterPhaseAddress(
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        { kind: 'occurrence', occurrenceId: room.occurrenceId },
        phaseKey,
      );
      // Encounter-owned screens (Narcissus, Artemis and Gorgon) are authored
      // on the phase's selection role. `self` belongs to an acquisition role;
      // consulting it here silently omitted an otherwise complete NPC screen.
      // Some story interactions have no entry in the encounter-key map even
      // though their timeline phase owns a fully resolved selection screen.
      // The selection address itself is the authoritative join key.
      const selectedOffer = traitOffer(phase, 'selection');
      const nemesis = room.encounters.nemesisRandomEventByPhase?.[phaseKey];
      if (encounterKey === 'NemesisRandomEvent' && nemesis === null)
        throw new CompilerError(
          'executionCoverageMissing',
          `unresolved Nemesis event ${owner}:${phaseKey}`,
        );
      result.push(
        Object.freeze({
          id: `${owner}:${timeline.action.key}`,
          kind: 'encounterInteraction' as const,
          owner: semanticAddressKey(timeline.action.owner),
          phaseKey,
          ...(selectedOffer === undefined
            ? {}
            : { resolution: Object.freeze({ kind: 'traitOffer' as const, offer: selectedOffer }) }),
          ...(nemesis === undefined || nemesis === null
            ? {}
            : {
                resolution: Object.freeze({
                  kind: 'nemesisRandomEvent' as const,
                  outcome: nemesis,
                }),
              }),
        }),
      );
      continue;
    }
    if (
      timeline.action.reference.kind !== 'interactIncomingReward' &&
      timeline.action.reference.kind !== 'interactLocalReward' &&
      timeline.action.reference.kind !== 'interactAcquisitionEntry' &&
      timeline.action.reference.kind !== 'interactShopOffer' &&
      timeline.action.reference.kind !== 'purchaseStygianWellOffer'
    ) {
      const reference = timeline.action.reference;
      if (reference.kind === 'sellPurgingPoolTrait') {
        const traitKey = room.purgingPool?.traitKeyBySlot[reference.slotKey];
        if (traitKey === null || traitKey === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `${room.gameName} lacks selected Pool sale ${reference.slotKey}`,
          );
        result.push(
          Object.freeze({
            id: `${owner}:${timeline.action.key}`,
            kind: 'purgingPoolSale' as const,
            owner: semanticAddressKey(timeline.action.owner),
            slotKey: reference.slotKey,
            traitKey,
          }),
        );
      } else if (reference.kind === 'interactKeepsakeRack') {
        const keepsakeKey = room.keepsakeRack?.keepsakeKey;
        if (keepsakeKey === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `${room.gameName} lacks selected keepsake rack target`,
          );
        result.push(
          Object.freeze({
            id: `${owner}:${timeline.action.key}`,
            kind: 'keepsakeRackChange' as const,
            owner: semanticAddressKey(timeline.action.owner),
            keepsakeKey,
            ...(room.keepsakeRack?.equipResults === undefined
              ? {}
              : {
                  equipResults: Object.freeze({
                    ...(room.keepsakeRack.equipResults.jeweledPom === undefined
                      ? {}
                      : {
                          jeweledPom: Object.freeze({
                            ...room.keepsakeRack.equipResults.jeweledPom,
                          }),
                        }),
                    ...(room.keepsakeRack.equipResults.experimentalHammer === undefined
                      ? {}
                      : {
                          experimentalHammer: Object.freeze({
                            ...room.keepsakeRack.equipResults.experimentalHammer,
                          }),
                        }),
                    ...(room.keepsakeRack.equipResults.transcendentEmbryo === undefined
                      ? {}
                      : {
                          transcendentEmbryo: Object.freeze({
                            ...room.keepsakeRack.equipResults.transcendentEmbryo,
                          }),
                        }),
                  }),
                }),
          }),
        );
      } else if (reference.kind === 'useFountain') {
        result.push(
          Object.freeze({
            id: `${owner}:${timeline.action.key}`,
            kind: 'fountainUse' as const,
            owner: semanticAddressKey(timeline.action.owner),
            ...(room.fountainRarityResult === undefined
              ? {}
              : { aromaticPhialTarget: room.fountainRarityResult.targetTraitKey }),
          }),
        );
      }
      continue;
    }
    if (timeline.action.reference.kind === 'purchaseStygianWellOffer') {
      const generationKey = timeline.action.reference.generationKey;
      const slot =
        generationKey === 'travelDealRefill'
          ? undefined
          : (generationKey.slice('initial:'.length) as 'healing' | 'secondLeft' | 'secondRight');
      const offerKey =
        generationKey === 'travelDealRefill'
          ? room.stygianWell?.travelDealRefillKey
          : room.stygianWell?.offerKeyBySlot[slot!];
      if (offerKey === undefined || offerKey === null)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} lacks Well inventory for ${generationKey}`,
        );
      const twistResultKey =
        room.stygianWell?.twistResultKeyBySlot?.[
          generationKey === 'travelDealRefill' ? 'travelDealRefill' : slot!
        ];
      result.push(
        Object.freeze({
          id: `${owner}:${timeline.action.key}:purchase`,
          kind: 'stygianWellPurchase' as const,
          owner: semanticAddressKey(timeline.action.owner),
          generationKey,
          offerKey,
          ...(twistResultKey === undefined || twistResultKey === null ? {} : { twistResultKey }),
        }),
      );
    }
    const actionReference = timeline.action.reference;
    if (actionReference.kind === 'interactShopOffer') {
      const offer = room.entryState?.offers.find(
        (candidate) => candidate.offerKey === actionReference.offerKey,
      );
      if (offer === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} lacks World Shop offer ${actionReference.offerKey}`,
        );
      result.push(
        Object.freeze({
          id: `${owner}:${timeline.action.key}:purchase`,
          kind: 'worldShopPurchase' as const,
          owner: semanticAddressKey(timeline.action.owner),
          offerKey: offer.offerKey,
          rewardType: offer.offer.rewardType,
        }),
      );
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
          ): candidate is Extract<
            RewardEvent,
            | { readonly kind: 'concreteAcquisition' }
            | { readonly kind: 'conversionToGold' }
            | { readonly kind: 'artificerConversion' }
          > =>
            (candidate.kind === 'concreteAcquisition' ||
              candidate.kind === 'conversionToGold' ||
              candidate.kind === 'artificerConversion') &&
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
    const seaStarDuplicate =
      source.kind === 'acquisitionEntry'
        ? parseSeaStarDuplicateSiteKey(source.site.pointKey)
        : undefined;
    const artificerReplacement =
      source.kind === 'acquisitionEntry'
        ? parseArtificerReplacementEntryKey(source.site.pointKey)
        : undefined;
    const pickupProducer =
      source.kind === 'acquisitionEntry'
        ? room.pickupProducers?.find((candidate) =>
            candidate.pickups.some((pickup) => pickup.key === source.site.pointKey),
          )
        : undefined;
    const roles: readonly ExecutionAcquisitionRole[] = Object.freeze([
      Object.freeze({
        role,
        disposition:
          row.event.kind === 'conversionToGold'
            ? ('timePiece' as const)
            : row.event.kind === 'artificerConversion'
              ? ('artificer' as const)
              : ('normal' as const),
        ...(seaStarDuplicate !== undefined
          ? {
              producer: Object.freeze({
                kind: 'seaStarDuplicate' as const,
                sourceOwner: seaStarDuplicate.sourceKey,
                sourceRole: seaStarDuplicate.acquisitionRole,
              }),
            }
          : artificerReplacement !== undefined
            ? {
                producer: Object.freeze({
                  kind: 'artificerReplacement' as const,
                  sourceOwner: artificerReplacement.sourceKey,
                  sourceRole: artificerReplacement.acquisitionRole,
                }),
              }
            : pickupProducer?.producerLifecycleKey === 'EchoLastReward'
              ? {
                  producer: Object.freeze({
                    kind: 'echoLastReward' as const,
                    sourceOwner: semanticAddressKey(pickupProducer.source),
                    sourceRole: 'self',
                  }),
                }
              : {}),
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
    const pickedAdditional = batch.additional.filter((additional) => additional.picked);
    if (
      (batch.selectedExitKey === null && pickedAdditional.length !== 1) ||
      (batch.selectedExitKey !== null && pickedAdditional.length !== 0)
    ) {
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
      additional: Object.freeze(
        batch.additional.map((additional) =>
          Object.freeze({
            kind: additional.key,
            key: additional.key,
            owner: semanticAddressKey(additional.origin),
            room: Object.freeze({
              id: additional.room.occurrenceId,
              biomeKey: additional.room.origin.biomeKey,
              gameName: additional.room.gameName,
            }),
            picked: additional.picked,
            ...(additional.chaosOrigin === undefined
              ? {}
              : {
                  ixionOrigin: Object.freeze({
                    sourceBiomeKey: additional.chaosOrigin.sourceBiomeKey,
                    sourceOccurrenceId: additional.chaosOrigin.sourceOccurrenceId,
                    generationKey: additional.chaosOrigin.generationKey,
                  }),
                }),
          }),
        ),
      ),
      ...(batch.selectedExitKey === null
        ? { selectedAdditionalKey: pickedAdditional[0]!.key }
        : { selectedExitKey: batch.selectedExitKey }),
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
  const resources = executionResources(room, biome);
  const optionKeys = room.entryState === undefined ? undefined : shopOptionKeys(room, biome);
  const shopOffers =
    room.entryState === undefined
      ? undefined
      : Object.freeze(
          room.entryState.offers.map((offer, index) =>
            Object.freeze({
              offerKey: offer.offerKey,
              optionKey: optionKeys![index]!,
              rewardType: offer.offer.rewardType,
              ...(offer.offer.payload?.kind === 'BoonSource'
                ? { source: offer.offer.payload.source }
                : {}),
              ...(offer.offer.payload?.kind === 'DevotionPair'
                ? {
                    source: offer.offer.payload.chosenSource,
                    spurnedSource: offer.offer.payload.spurnedSource,
                  }
                : {}),
            }),
          ),
        );
  const refill = shopOffers === undefined ? undefined : travelDealRefill(room, biome, shopOffers);
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
      ...(room.entryState === undefined
        ? {}
        : {
            shop: Object.freeze({
              profileKey: room.entryState.profileKey,
              offers: shopOffers!,
              ...(refill === undefined ? {} : { travelDealRefill: refill }),
            }),
          }),
      ...(room.stygianWell?.interacted !== true
        ? {}
        : {
            stygianWell: Object.freeze({
              offers: Object.freeze(
                (
                  [
                    [
                      'initial:healing',
                      room.stygianWell.offerKeyBySlot.healing,
                      room.stygianWell.twistResultKeyBySlot?.healing,
                    ],
                    [
                      'initial:secondLeft',
                      room.stygianWell.offerKeyBySlot.secondLeft,
                      room.stygianWell.twistResultKeyBySlot?.secondLeft,
                    ],
                    [
                      'initial:secondRight',
                      room.stygianWell.offerKeyBySlot.secondRight,
                      room.stygianWell.twistResultKeyBySlot?.secondRight,
                    ],
                    [
                      'travelDealRefill',
                      room.stygianWell.travelDealRefillKey,
                      room.stygianWell.twistResultKeyBySlot?.travelDealRefill,
                    ],
                  ] as const
                ).flatMap(([generationKey, offerKey, twistResultKey]) =>
                  offerKey === null || offerKey === undefined
                    ? []
                    : [
                        Object.freeze({
                          generationKey,
                          offerKey,
                          ...(twistResultKey === undefined || twistResultKey === null
                            ? {}
                            : { twistResultKey }),
                        }),
                      ],
                ),
              ),
            }),
          }),
      ...(room.purgingPool?.interacted !== true
        ? {}
        : {
            purgingPool: Object.freeze({
              traits: Object.freeze(
                (['left', 'middle', 'right'] as const).map((slotKey) =>
                  Object.freeze({ slotKey, traitKey: room.purgingPool!.traitKeyBySlot[slotKey] }),
                ),
              ),
            }),
          }),
      ...(room.keepsakeRack === undefined
        ? {}
        : { keepsakeRack: Object.freeze({ keepsakeKey: room.keepsakeRack.keepsakeKey }) }),
      ...(room.fountainRarityResult === undefined
        ? {}
        : {
            fountain: Object.freeze({
              aromaticPhialTarget: room.fountainRarityResult.targetTraitKey,
            }),
          }),
      ...(resources === undefined ? {} : { resources }),
    }),
    ...(room.anomalyReplacement === undefined
      ? {}
      : { anomaly: Object.freeze({ ...room.anomalyReplacement }) }),
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

import {
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
} from '../../authored-project/addresses';
import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
import type { RunStateSnapshot } from '../../simulation/rewards/run-state';
import type { TraitRarity } from '../../catalog-schema';
import type { GorgonRarityLevel } from '../../simulation/keepsakes';
import type {
  ExecutionOccurrence,
  ExecutionRunStateCount,
  ExecutionRunStateDiagnostic,
} from '../model';
import { pendingKeepsakeEffects } from '../../simulation/rewards/run-state-conformance';

function executionCount(value: ExecutionRunStateCount): ExecutionRunStateCount {
  return value.kind === 'exact'
    ? Object.freeze({ kind: 'exact', count: value.count })
    : Object.freeze({ kind: 'range', min: value.min, max: value.max });
}

const GORGON_SOURCE_RARITY_BY_LEVEL: Readonly<Record<GorgonRarityLevel, TraitRarity>> =
  Object.freeze({ 1: 'Common', 2: 'Rare', 3: 'Epic', 4: 'Heroic' });

function executionPendingKeepsakeEffects(
  snapshot: RunStateSnapshot,
): ExecutionRunStateDiagnostic['retainedEffects']['keepsakes'] {
  const effects = pendingKeepsakeEffects(snapshot.keepsakes);
  const { gorgon: pendingGorgon, ...rest } = effects;
  const gorgon = pendingGorgon ?? null;
  return Object.freeze({
    ...rest,
    gorgon:
      gorgon === null || gorgon.status !== 'pending'
        ? gorgon
        : Object.freeze({
            status: 'pending' as const,
            rarity: GORGON_SOURCE_RARITY_BY_LEVEL[gorgon.rarityLevel],
          }),
  });
}

function assembleRunStateDiagnostic(
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
    retainedEffects: Object.freeze({
      echoShopDuplicateStatus: snapshot.traits.echoShopDuplicateStatus ?? null,
      keepsakes: executionPendingKeepsakeEffects(snapshot),
      steadyGrowth: Object.freeze(
        Object.entries(snapshot.traits.steadyGrowth ?? {})
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([traitKey, state]) => Object.freeze({ traitKey, ...state })),
      ),
      hermesShrineDeliveries: Object.freeze(
        Object.values(snapshot.pendingHermesShrineDeliveries)
          .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey))
          .map((delivery) =>
            Object.freeze({
              sourceKey: delivery.sourceKey,
              sourceOccurrenceId: delivery.sourceOrigin.occurrenceId,
              generationKey: delivery.generationKey,
              rewardType: delivery.rewardType,
              remainingUses: delivery.remainingUses,
              rushed: delivery.rushed === true,
              ...(delivery.dueAt === undefined
                ? {}
                : { dueOccurrenceId: delivery.dueAt.occurrenceId }),
              ...(delivery.dueSequence === undefined ? {} : { dueSequence: delivery.dueSequence }),
            }),
          ),
      ),
      stygianWell: Object.freeze({
        ...snapshot.stygianWell,
        discountUses: Object.freeze([...snapshot.stygianWell.discountUses]),
        emptySlotUses: Object.freeze([...snapshot.stygianWell.emptySlotUses]),
      }),
    }),
  });
}

/** Assemble the diagnostic-only entry/exit observations for one entered room. */
export function assembleOccurrenceDiagnostics(
  room: CanonicalAuthoredRoom,
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
): ExecutionOccurrence['diagnostics'] | undefined {
  if (!room.entered) return undefined;
  const roomEntered = assembleRunStateDiagnostic(
    snapshots.get(
      semanticAddressKey(createRoomRunStateCheckpointAddress(room.origin, { kind: 'roomEntered' })),
    ),
  );
  const beforeRoomExit = assembleRunStateDiagnostic(
    snapshots.get(
      semanticAddressKey(
        createRoomRunStateCheckpointAddress(room.origin, { kind: 'beforeRoomExit' }),
      ),
    ),
  );
  if (roomEntered === undefined && beforeRoomExit === undefined) return undefined;
  return Object.freeze({
    ...(roomEntered === undefined ? {} : { roomEntered }),
    ...(beforeRoomExit === undefined ? {} : { beforeRoomExit }),
  });
}

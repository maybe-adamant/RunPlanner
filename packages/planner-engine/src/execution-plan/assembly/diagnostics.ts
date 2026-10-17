import {
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
} from '../../authored-project/addresses';
import type { CanonicalAuthoredRoom } from '../../simulation/materialization';
import type { RunStateSnapshot } from '../../simulation/rewards/run-state';
import type { Catalog, TraitRarity } from '../../catalog-schema';
import { routeErisHost } from '../../authored-project/route-profile';
import type { GorgonRarityLevel } from '../../simulation/keepsakes/state';
import type {
  ExecutionOccurrence,
  ExecutionRoomExitConformance,
  ExecutionRunStateCount,
  ExecutionRunStateDiagnostic,
  ExecutionStartKeepsakeTrait,
} from '../model';
import {
  pendingKeepsakeEffects,
  type RoomExitConformanceDelta,
} from '../../simulation/rewards/run-state-conformance';
import { projectStartKeepsake } from '../../simulation/start-installation/projection';
import {
  MATURE_ASPECT_RARITY,
  PERFECT_ASPECT_RARITY,
} from '../../simulation/traits/equipment-upgrades';
import { keepsakeState } from './start-state';

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

/** Bell, Fang and Silken Sash values stay live; no check reads them. */
function heldKeepsake(
  row: ExecutionStartKeepsakeTrait,
): ExecutionRunStateDiagnostic['keepsakes']['held'][number] {
  const { escalatingKeepsakeValue, currentKeepsakeDamageBonus, currentArmor, ...held } = row;
  void escalatingKeepsakeValue;
  void currentKeepsakeDamageBonus;
  void currentArmor;
  return Object.freeze(held);
}

function assembleRunStateDiagnostic(
  catalog: Catalog,
  snapshot: RunStateSnapshot | undefined,
): ExecutionRunStateDiagnostic | undefined {
  if (snapshot === undefined) return undefined;
  const { aspect, familiarKey, familiarStackMultiplier } = snapshot.effects;
  return Object.freeze({
    owner: semanticAddressKey(snapshot.owner),
    checkpoint: snapshot.checkpoint === 'roomEntered' ? 'roomEntered' : 'beforeRoomExit',
    counters: Object.freeze({
      biomeDepthCache: snapshot.counters.biomeDepthCache,
      ...(snapshot.counters.biomeEncounterDepth === undefined
        ? {}
        : { biomeEncounterDepth: snapshot.counters.biomeEncounterDepth }),
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
          Object.freeze({
            key: card.key,
            origin: card.origin,
            rarity: card.rarity,
            held: card.unequipped !== true,
          }),
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
            curseValues: entry.curseValues,
            blessingValues: entry.blessingValues,
          }),
        ),
      ),
      matured: Object.freeze(
        snapshot.traits.chaos.matured.map((entry) =>
          Object.freeze({
            blessingKey: entry.blessingKey,
            rarity: entry.rarity,
            blessingValues: entry.blessingValues,
          }),
        ),
      ),
    }),
    keepsakes: Object.freeze({
      ...(snapshot.keepsakes.currentKey === null
        ? {}
        : { currentKey: snapshot.keepsakes.currentKey }),
      usedKeys: Object.freeze(snapshot.keepsakes.history.map((entry) => entry.key)),
      blockedKeys: Object.freeze([...snapshot.keepsakes.removedKeys]),
      fatedStatus: snapshot.keepsakes.fatedStatus,
      held: Object.freeze(
        keepsakeState(
          catalog,
          projectStartKeepsake(catalog, {
            keepsakes: snapshot.keepsakes,
            traitHistory: { equippedTraits: snapshot.traits.equippedTraits },
          }),
        ).traits.map(heldKeepsake),
      ),
    }),
    equipment: Object.freeze({
      ...(aspect === undefined
        ? {}
        : {
            aspect: Object.freeze({
              key: aspect.aspectKey,
              rarity: aspect.rank === 6 ? PERFECT_ASPECT_RARITY : MATURE_ASPECT_RARITY,
            }),
          }),
      ...(familiarKey === undefined || familiarStackMultiplier === undefined
        ? {}
        : {
            familiar: Object.freeze({
              name: familiarKey,
              stackMultiplier: familiarStackMultiplier,
            }),
          }),
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
      olympianTalentInvested: snapshot.hexObserver.olympianTalentInvested,
    }),
    rewardStores: Object.freeze(
      snapshot.rewardStores.map(({ storeKey, remainingEntryCounts }) =>
        Object.freeze({ name: storeKey, remainingEntryCounts }),
      ),
    ),
    hexNodes: Object.freeze({
      nodes: snapshot.hexProgress.tree?.nodes ?? Object.freeze({}),
      investedNodes: snapshot.hexProgress.investedNodeKeys,
    }),
    artificer:
      snapshot.artificer === undefined
        ? null
        : Object.freeze(
            snapshot.arcanaFear.arcana.active.some(
              (card) => card.unequipped === true && card.key === 'MetaToRunUpgrade',
            )
              ? { usedCount: snapshot.artificer.usedCount }
              : { ...snapshot.artificer },
          ),
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
          .sort((left, right) => left.entryKey.localeCompare(right.entryKey))
          .map((delivery) =>
            Object.freeze({
              sourceKey: delivery.entryKey,
              sourceOccurrenceId: delivery.source.occurrenceId,
              generationKey: delivery.generationKey,
              rewardType: delivery.rewardType,
              remainingUses: delivery.remainingUses,
              rushed: delivery.rushed,
              ...(delivery.due === undefined
                ? {}
                : {
                    dueOccurrenceId: delivery.due.host.occurrenceId,
                    dueSequence: delivery.due.historySequence,
                  }),
            }),
          ),
      ),
      stygianWell: snapshot.stygianWellLegality,
    }),
  });
}

/** Assemble the diagnostic-only entry/exit observations for one entered room. */
export function assembleOccurrenceDiagnostics(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
): ExecutionOccurrence['diagnostics'] | undefined {
  if (!room.entered) return undefined;
  const roomEntered = assembleRunStateDiagnostic(
    catalog,
    snapshots.get(
      semanticAddressKey(createRoomRunStateCheckpointAddress(room.origin, { kind: 'roomEntered' })),
    ),
  );
  const beforeRoomExit = assembleRunStateDiagnostic(
    catalog,
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

/**
 * The published room-exit facts. An Eris host on the route whose curse is not
 * held at exit asserts it absent, so Eris present but unplanned mismatches here.
 */
export function assembleRoomExitConformance(
  catalog: Catalog,
  routeKey: string,
  room: CanonicalAuthoredRoom,
  delta: RoomExitConformanceDelta | undefined,
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
): ExecutionRoomExitConformance | undefined {
  if (delta === undefined) return undefined;
  const host = routeErisHost(catalog.rooms.byKey[room.gameName], routeKey);
  const exit = snapshots.get(
    semanticAddressKey(
      createRoomRunStateCheckpointAddress(room.origin, { kind: 'beforeRoomExit' }),
    ),
  );
  const absent =
    host !== undefined &&
    exit !== undefined &&
    !Object.values(exit.traits.equippedTraits).some(
      (trait) => trait.traitKey === host.curseTraitKey,
    );
  if (!absent) return Object.freeze({ facts: Object.freeze([...delta.facts]) });
  const absentTraitKeys = Object.freeze([host.curseTraitKey]);
  const facts = delta.facts.some((fact) => fact.kind === 'traitInventory')
    ? delta.facts.map((fact) =>
        fact.kind === 'traitInventory' ? Object.freeze({ kind: fact.kind, absentTraitKeys }) : fact,
      )
    : [...delta.facts, Object.freeze({ kind: 'traitInventory' as const, absentTraitKeys })];
  return Object.freeze({ facts: Object.freeze(facts) });
}

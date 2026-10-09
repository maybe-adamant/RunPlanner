import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createLocalRewardAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  type ProjectDocument,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { factsWithHistory } from '@run-planner/engine/reward-kernel';
import { simulateProject } from '@run-planner/engine/simulation';
import { replaceTestRoomActionOrder } from '@run-planner/test-fixtures/shared';
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures/underworld';
import { assembleOccurrenceDiagnostics } from '../../src/execution-plan/assembly/diagnostics';
import { deriveRoomExitConformanceDeltas } from '../../src/simulation/rewards/run-state-conformance';
import {
  createDefaultRouteLoadout,
  createInitialRouteLoadout,
} from '../../src/authored-project/loadout';
import type { EquippedTrait } from '../../src/authored-project/traits/state';
import type { InRunTraitRarity, TraitElement } from '../../src/catalog-schema';
import { createArcanaFearState, type ArcanaFearState } from '../../src/simulation/arcana-fear';
import {
  advanceCurrentKeepsake,
  applyEchoMaxStatKeepsakeReplay,
  applyKeepsakeReplacement,
  createKeepsakeState,
  expireMaxHealthCapAtBoss,
  type KeepsakeState,
} from '../../src/simulation/keepsakes/state';
import { deriveMaxStats } from '../../src/simulation/max-stats';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition/site-settlement';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import type { SimulationState } from '../../src/simulation/state/model';
import { resolveProducedMaxStatGrant } from '../../src/simulation/state/pending-resource-pickups';
import { createTraitHistoryState, foldTraitHistoryEvents } from '../../src/simulation/traits';
import type {
  ChaosBlessingInstance,
  ChaosCurseInstance,
  TraitHistoryEvent,
  TraitHistoryState,
} from '../../src/simulation/traits/history/model';
import { initializeTestRewardBranchesForRoute } from '../support/arcana-fear';
import { traitFrontierState } from '../support/simulation-state';
import { baseFacts } from './shop-trait-purchase-support';

const NO_STAT_ASPECT = { weaponKey: 'WeaponStaffSwing', aspectKey: 'StaffClearCastAspect' };
const NEUTRAL_KEEPSAKE = 'BossPreDamageKeepsake';
const noArcana = (): ArcanaFearState =>
  createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));

function equipped(
  traitKey: string,
  rarity?: InRunTraitRarity,
  extra: Partial<EquippedTrait> = {},
): EquippedTrait {
  return Object.freeze({
    traitKey,
    giverKey: 'Test',
    providerKind: 'olympian' as const,
    ...(rarity === undefined ? {} : { rarity }),
    sourceRole: 'selection',
    ...extra,
  });
}

function traits(
  list: readonly EquippedTrait[],
  overrides: Partial<TraitHistoryState> = {},
): TraitHistoryState {
  return Object.freeze({
    ...createTraitHistoryState(),
    equippedTraits: Object.freeze(Object.fromEntries(list.map((trait) => [trait.traitKey, trait]))),
    ...overrides,
  });
}

/** A mature Underworld start with no stat-bearing loadout, keepsake or Arcana. */
function neutralState(
  traitHistory: TraitHistoryState = createTraitHistoryState(),
  overrides: {
    readonly loadout?: { weaponKey: string; aspectKey: string; familiarKey?: string | null };
    readonly arcanaFear?: ArcanaFearState;
    readonly keepsakes?: KeepsakeState;
  } = {},
): SimulationState {
  return traitFrontierState(traitHistory, {
    loadout: overrides.loadout ?? NO_STAT_ASPECT,
    startingKeepsakeKey: NEUTRAL_KEEPSAKE,
    arcanaFear: overrides.arcanaFear ?? noArcana(),
    ...(overrides.keepsakes === undefined ? {} : { keepsakes: overrides.keepsakes }),
  });
}

const maxima = (state: SimulationState) => {
  const { maxHealth, maxMana } = deriveMaxStats(catalog, state);
  return { maxHealth, maxMana };
};

function elements(water: number): Readonly<Record<TraitElement, number>> {
  return Object.freeze({ Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: water });
}

function curse(curseKey: string, curseValues: Record<string, number>): ChaosCurseInstance {
  return Object.freeze({
    acquisitionIdentity: `curse:${curseKey}:${JSON.stringify(curseValues)}`,
    owner: createBiomeAddress('Underworld', 'F'),
    curseKey,
    duration: 4,
    remaining: 2,
    clock: 'encounters' as const,
    curseValues,
    blessingKey: 'ChaosWeaponBlessing',
    rarity: 'Common' as const,
    blessingValues: { damageBonus: 0.3 },
  });
}

function blessing(
  blessingKey: string,
  blessingValues: Record<string, number>,
): ChaosBlessingInstance {
  return Object.freeze({
    acquisitionIdentity: `blessing:${blessingKey}`,
    blessingKey,
    rarity: 'Rare' as const,
    blessingValues,
  });
}

describe('max health and max Magick formula', () => {
  it('starts from the hero base and adds each flat source with fractions kept', () => {
    expect(maxima(neutralState())).toEqual({ maxHealth: 30, maxMana: 50 });
    // Axe rank V: 50.1 health, rounded once at the end.
    const axe = neutralState(createTraitHistoryState(), {
      loadout: { weaponKey: 'WeaponAxe', aspectKey: 'AxeRecoveryAspect' },
    });
    expect(maxima(axe)).toEqual({ maxHealth: 80, maxMana: 50 });
    expect(deriveMaxStats(catalog, axe).flat).toContainEqual({
      source: { kind: 'aspect', key: 'AxeRecoveryAspect' },
      maxHealth: 50.1,
      maxMana: 0,
    });
    // Premium Service raises the aspect to rank VI.
    const premium = neutralState(
      traits([], { previouslyPickedTraitKeys: Object.freeze(['WeaponUpgradeBoon']) }),
      { loadout: { weaponKey: 'WeaponAxe', aspectKey: 'AxeRecoveryAspect' } },
    );
    expect(maxima(premium).maxHealth).toBe(90);
    const staff = neutralState(createTraitHistoryState(), {
      loadout: { weaponKey: 'WeaponStaffSwing', aspectKey: 'BaseStaffAspect' },
    });
    expect(maxima(staff).maxMana).toBe(90);
  });

  it('rounds the multiplied fractional total once', () => {
    // (30 + 50.1) x 1.15 = 92.115; Lua doubles make 50 x 1.15 = 57.4999…
    const state = neutralState(traits([equipped('HealthRewardBonusBoon', 'Common')]), {
      loadout: { weaponKey: 'WeaponAxe', aspectKey: 'AxeRecoveryAspect' },
    });
    expect(maxima(state)).toEqual({ maxHealth: 92, maxMana: 57 });
  });

  it('sums multipliers as one plus each excess and applies them to base and flat sources', () => {
    const state = neutralState(
      traits([equipped('HealthRewardBonusBoon', 'Heroic'), equipped('CirceEnlargeTrait')]),
    );
    // Health 30 x (1 + 0.30 + 0.15); Magick 50 x 1.30.
    expect(maxima(state)).toEqual({ maxHealth: 44, maxMana: 65 });
    expect(deriveMaxStats(catalog, state).multipliers).toEqual({ maxHealth: 1.45, maxMana: 1.3 });
  });

  it('converts ceil(max Magick) into health before the health multiplier', () => {
    const state = neutralState(
      traits([equipped('ManaToHealthBoon', 'Heroic'), equipped('HealthRewardBonusBoon', 'Common')]),
    );
    // M = round(57.4999…) = 57; H = round((30 + 0.35 x 57) x 1.15) = round(57.4425).
    expect(deriveMaxStats(catalog, state)).toMatchObject({
      maxHealth: 57,
      maxMana: 57,
      convertedHealth: 19.95,
    });
  });

  it('scales Water Fitness with the current Water count', () => {
    const state = (water: number) =>
      neutralState(
        traits([equipped('ElementalHealthBoon', 'Common')], { elementCounts: elements(water) }),
      );
    expect(maxima(state(2)).maxHealth).toBe(60);
    expect(maxima(state(4)).maxHealth).toBe(90);
  });

  it('adds Persistence at its rarity and The Centaur at its recorded grants', () => {
    const arcana = (rarity: InRunTraitRarity) =>
      Object.freeze({
        ...noArcana(),
        arcana: Object.freeze({
          ...noArcana().arcana,
          active: Object.freeze([
            Object.freeze({ key: 'BonusHealth', origin: 'manual' as const, rarity }),
          ]),
          roomEntryGrowth: Object.freeze({
            MaxHealthPerRoom: Object.freeze({
              progress: 2,
              grants: 3,
              maxHealthGranted: 15,
              maxManaGranted: 15,
            }),
          }),
        }),
      }) as ArcanaFearState;
    expect(maxima(neutralState(undefined, { arcanaFear: arcana('Common') }))).toEqual({
      maxHealth: 65,
      maxMana: 85,
    });
    expect(maxima(neutralState(undefined, { arcanaFear: arcana('Heroic') }))).toEqual({
      maxHealth: 95,
      maxMana: 115,
    });
  });

  it('adds Chaos operands only while a curse is active or a blessing has matured', () => {
    const state = neutralState(
      traits([], {
        activeChaosCurses: Object.freeze([curse('ChaosHealthCurse', { healthPenalty: -25 })]),
        maturedChaosBlessings: Object.freeze([
          blessing('ChaosHealthBlessing', { health: 60 }),
          blessing('ChaosManaBlessing', { magick: 50 }),
        ]),
      }),
    );
    expect(maxima(state)).toEqual({ maxHealth: 65, maxMana: 100 });
  });

  it('never lets max health fall below one', () => {
    const state = neutralState(
      traits([], {
        activeChaosCurses: Object.freeze([curse('ChaosHealthCurse', { healthPenalty: -29 })]),
      }),
    );
    expect(maxima(state).maxHealth).toBe(1);
  });

  it('stacks the mature familiar and doubles it after Primal Psychic Connection', () => {
    const frinos = { ...NO_STAT_ASPECT, familiarKey: 'FrogFamiliar' };
    expect(maxima(neutralState(undefined, { loadout: frinos })).maxHealth).toBe(70);
    const doubled = traits([], {
      previouslyPickedTraitKeys: Object.freeze(['DoubleFamiliarTrait']),
    });
    expect(maxima(neutralState(doubled, { loadout: frinos })).maxHealth).toBe(110);
    const hecuba = { ...NO_STAT_ASPECT, familiarKey: 'HoundFamiliar' };
    expect(maxima(neutralState(undefined, { loadout: hecuba })).maxMana).toBe(110);
    expect(maxima(neutralState(doubled, { loadout: hecuba })).maxMana).toBe(170);
    const toula = { ...NO_STAT_ASPECT, familiarKey: 'CatFamiliar' };
    expect(maxima(neutralState(undefined, { loadout: toula }))).toEqual({
      maxHealth: 30,
      maxMana: 50,
    });
  });

  it("fixes max health at White Antler's cap while active, even above a lower total", () => {
    const antler = createKeepsakeState(catalog, 'LowHealthCritKeepsake');
    const cursed = traits([], {
      activeChaosCurses: Object.freeze([curse('ChaosHealthCurse', { healthPenalty: -20 })]),
    });
    expect(maxima(neutralState(cursed, { keepsakes: antler })).maxHealth).toBe(30);
    const heavy = neutralState(traits([equipped('HealthRewardBonusBoon', 'Heroic')]), {
      keepsakes: antler,
      loadout: { weaponKey: 'WeaponAxe', aspectKey: 'AxeRecoveryAspect' },
    });
    expect(deriveMaxStats(catalog, heavy)).toMatchObject({
      maxHealth: 30,
      maxHealthCap: { maxHealth: 30, keepsakeKey: 'LowHealthCritKeepsake' },
    });
    const expired = expireMaxHealthCapAtBoss(antler);
    expect(expired.maxHealthCap).toEqual({
      keepsakeKey: 'LowHealthCritKeepsake',
      origin: 'ordinary',
      status: 'expired',
    });
    expect(maxima(neutralState(cursed, { keepsakes: expired })).maxHealth).toBe(10);
    // Unequipping ends the window; the echo copy starts a fresh one.
    const replaced = applyKeepsakeReplacement(catalog, antler, NEUTRAL_KEEPSAKE, noArcana());
    expect(replaced.maxHealthCap).toBeUndefined();
    const copy = applyEchoMaxStatKeepsakeReplay(catalog, replaced, 'LowHealthCritKeepsake');
    expect(copy.maxHealthCap).toEqual({
      keepsakeKey: 'LowHealthCritKeepsake',
      origin: 'echo',
      status: 'active',
    });
  });
});

describe('permanent trait grants', () => {
  const owner = createBiomeAddress('Underworld', 'F');
  const worryFree = (sequence: number, rarity: InRunTraitRarity, maxHealthRoll?: number) =>
    Object.freeze({
      kind: 'traitOffer' as const,
      owner,
      acquisitionRole: 'selection',
      sequence,
      giverKey: 'Dionysus',
      options: Object.freeze([
        Object.freeze({
          traitKey: 'HiddenMaxHealthBoon',
          rarity,
          ...(maxHealthRoll === undefined ? {} : { maxHealthRoll }),
        }),
      ]),
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'roomRewardPickup',
      acquisitionIdentity: `worry-free:${sequence}`,
    }) as TraitHistoryEvent;

  it('grants the Worry Free roll at its acquired rarity, once per acquisition', () => {
    const acquired = foldTraitHistoryEvents(catalog, [worryFree(1, 'Rare', 12)]);
    expect(acquired.maxStatGrants).toEqual({ HiddenMaxHealthBoon: { maxHealth: 82, maxMana: 0 } });
    // A later rarity upgrade re-adds the trait without its acquire function.
    const upgraded = foldTraitHistoryEvents(catalog, [
      ...acquired.events,
      Object.freeze({
        kind: 'rarityMutation' as const,
        owner,
        acquisitionRole: 'fountainRarity' as const,
        acquisitionPoint: 'fountainUsed' as const,
        sequence: 2,
        targetTraitKey: 'HiddenMaxHealthBoon',
        oldRarity: 'Rare' as const,
        newRarity: 'Epic' as const,
      }),
    ]);
    expect(upgraded.equippedTraits.HiddenMaxHealthBoon?.rarity).toBe('Epic');
    expect(upgraded.maxStatGrants).toEqual(acquired.maxStatGrants);
    // The grant outlives the trait, and a fresh acquisition rolls again.
    const reacquired = foldTraitHistoryEvents(catalog, [
      ...upgraded.events,
      Object.freeze({
        kind: 'traitRemoval' as const,
        owner,
        acquisitionRole: 'test',
        sequence: 3,
        acquisitionPoint: 'test',
        traitKey: 'HiddenMaxHealthBoon',
        acquisitionIdentity: 'worry-free:1',
        match: 'acquisitionIdentity' as const,
      }),
      worryFree(4, 'Common'),
    ]);
    expect(reacquired.maxStatGrants).toEqual({
      HiddenMaxHealthBoon: { maxHealth: 132, maxMana: 0 },
    });
    expect(maxima(neutralState(reacquired)).maxHealth).toBe(162);
  });
});

describe('Silver Wheel max-Magick grants', () => {
  const WHEEL = 'ManaOverTimeRefundKeepsake';
  const grants = (state: KeepsakeState) => state.maxManaGrants?.[WHEEL];

  it('adds one grant per loot equip, raised in place by Cherished and kept after unequip', () => {
    const start = createKeepsakeState(catalog, WHEEL);
    expect(grants(start)).toEqual([100]);
    expect(maxima(neutralState(undefined, { keepsakes: start })).maxMana).toBe(150);
    // Cherished raises the equipped Wheel's grant to rank IV.
    const cherished = advanceCurrentKeepsake(catalog, start, 1);
    expect(grants(cherished)).toEqual([150]);
    // Swapping away keeps it; Echo's Common copy at the next region adds its own grant.
    const swapped = applyKeepsakeReplacement(catalog, cherished, NEUTRAL_KEEPSAKE, noArcana());
    expect(grants(swapped)).toEqual([150]);
    const copy = applyEchoMaxStatKeepsakeReplay(catalog, swapped, WHEEL);
    expect(grants(copy)).toEqual([150, 50]);
    expect(maxima(neutralState(undefined, { keepsakes: copy })).maxMana).toBe(250);
    expect(
      deriveMaxStats(catalog, neutralState(undefined, { keepsakes: copy })).flat,
    ).toContainEqual({ source: { kind: 'keepsake', key: WHEEL }, maxHealth: 0, maxMana: 200 });
    // A rack equip adds a grant at the equipped rank.
    const later = applyKeepsakeReplacement(
      catalog,
      createKeepsakeState(catalog, NEUTRAL_KEEPSAKE),
      WHEEL,
      noArcana(),
      'Heroic',
    );
    expect(grants(later)).toEqual([150]);
  });
});

describe('pickup max-stat settlement', () => {
  const biome = createBiomeAddress('Underworld', 'F');
  const facts = (state: SimulationState) =>
    factsWithHistory(baseFacts(), state.rewardHistory, new Set());

  function collect(
    branch: RewardBranchState,
    name: string,
    rewardType: string,
    producerLifecycleKey: string,
  ) {
    const occurrenceId = createOccurrenceId(`max-stat-${name}`);
    const origin = createIncomingRewardAddress(biome, occurrenceId);
    const [settled] = settleOwnedAcquisitionSite(
      catalog,
      [branch],
      {
        siteOwner: createOccurrenceAddress(biome, occurrenceId),
        pointKey: 'roomRewardPickup',
        entryKey: 'self',
        historySequence: 1,
        source: {
          origin,
          offer: Object.freeze({ rewardType }),
          producerLifecycleKey,
          instanceProvenance: producerLifecycleKey === 'WorldShop' ? 'paid' : 'free',
          presentsMaterializedScreen: false,
          dispositionByAcquisitionRole: Object.freeze({
            self: Object.freeze({ kind: 'normal' as const }),
          }),
        },
      },
      facts,
    ).branches;
    if (settled === undefined) throw new Error(`${rewardType} did not settle`);
    return settled.state.rewardHistory.maxStatGains;
  }

  const mature = () => initializeTestRewardBranchesForRoute()[0]!;

  it('credits each consumable amount', () => {
    for (const [rewardType, gains] of [
      ['MaxHealthDropSmall', { maxHealth: 5, maxMana: 0 }],
      ['MaxHealthDrop', { maxHealth: 25, maxMana: 0 }],
      ['MaxHealthDropBig', { maxHealth: 50, maxMana: 0 }],
      ['EmptyMaxHealthSmallDrop', { maxHealth: 10, maxMana: 0 }],
      ['MaxManaDropSmall', { maxHealth: 0, maxMana: 10 }],
      ['MaxManaDrop', { maxHealth: 0, maxMana: 30 }],
      ['MaxManaDropBig', { maxHealth: 0, maxMana: 60 }],
    ] as const)
      expect(collect(mature(), rewardType, rewardType, 'RoomReward'), rewardType).toEqual(gains);
  });

  it('adds the run-progress bonus to spawned Ashes and Bones, never to a purchase', () => {
    expect(collect(mature(), 'ashes', 'MetaCardPointsCommonDrop', 'RoomReward')).toEqual({
      maxHealth: 5,
      maxMana: 0,
    });
    expect(collect(mature(), 'bones', 'MetaCurrencyBigDrop', 'RoomReward')).toEqual({
      maxHealth: 0,
      maxMana: 5,
    });
    expect(collect(mature(), 'narcissus', 'MetaCurrencyDrop', 'NarcissusPickup').maxMana).toBe(5);
    expect(collect(mature(), 'echo', 'MetaCardPointsCommonDrop', 'EchoLastReward').maxHealth).toBe(
      5,
    );
    // A Shop settles under its profile key, which never takes RunProgress overrides.
    expect(
      resolveProducedMaxStatGrant(catalog, 'MetaCardPointsCommonDrop', 'WorldShop', 'Underworld'),
    ).toBeUndefined();
    expect(
      resolveProducedMaxStatGrant(catalog, 'MaxHealthDrop', 'WorldShop', 'Underworld'),
    ).toEqual({ stat: 'maxHealth', amount: 25 });
    expect(collect(mature(), 'eris', 'MetaCurrencyDrop', 'ErisCursePickup').maxMana).toBe(0);
  });

  it('withholds the run-progress bonus on a Fresh File', () => {
    const fresh = initializeTestRewardBranchesForRoute(
      undefined,
      undefined,
      catalog,
      null,
      undefined,
      'FreshFile',
      createInitialRouteLoadout(catalog, 'FreshFile'),
    )[0]!;
    expect(collect(fresh, 'fresh-ashes', 'MetaCardPointsCommonDrop', 'RoomReward')).toEqual({
      maxHealth: 0,
      maxMana: 0,
    });
    expect(collect(fresh, 'fresh-heart', 'MaxHealthDrop', 'RoomReward').maxHealth).toBe(25);
  });
});

describe('max stats on an authored route', () => {
  function routeSnapshots(project: ProjectDocument) {
    const result = simulateProject(catalog, project);
    return result.route.biomes.flatMap((biome) => {
      if (!('rewards' in biome)) return [];
      return [...biome.rewards.runStateSnapshots].map((snapshot) => ({
        biomeKey: biome.biomeKey,
        snapshot,
      }));
    });
  }

  it("holds White Antler's cap through F and lifts it after the first Boss", () => {
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'LowHealthCritKeepsake',
    });
    const snapshots = routeSnapshots(project);
    // Every F door decision precedes the Boss; every later checkpoint follows it.
    const fDoors = snapshots.filter(
      (entry) => entry.biomeKey === 'F' && entry.snapshot.owner.kind === 'exitDecision',
    );
    const later = snapshots.filter((entry) => entry.biomeKey !== 'F');
    expect(fDoors.length).toBeGreaterThan(0);
    expect(
      fDoors.every(
        (entry) =>
          entry.snapshot.maxStats.maxHealth === 30 &&
          entry.snapshot.maxStats.maxHealthCap?.keepsakeKey === 'LowHealthCritKeepsake',
      ),
    ).toBe(true);
    expect(later.length).toBeGreaterThan(0);
    expect(
      later.every(
        (entry) =>
          entry.snapshot.maxStats.maxHealthCap === undefined &&
          entry.snapshot.keepsakes.maxHealthCap?.status === 'expired' &&
          entry.snapshot.maxStats.maxHealth > 30,
      ),
    ).toBe(true);
  });

  it('credits a Fields optional Bones or Ashes with its run-progress maximum', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const exitMaxima = (rewardType: string) => {
      const project = replaceTestRoomActionOrder(
        applyProjectCommand(createGoldenFGHProject(), catalog, {
          kind: 'ReplaceLocalReward',
          reward: createLocalRewardAddress(
            goldenHBiome,
            occurrenceId,
            'optionalRewards',
            'optional1',
          ),
          value: { rewardType },
        }),
        catalog,
        goldenHBiome,
        occurrenceId,
        [
          { kind: 'interactLocalReward', groupKey: 'optionalRewards', slotKey: 'optional1' },
          { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
          { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage2' },
          { kind: 'completeFieldsCage', phaseKey: 'Cage01' },
          { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' },
        ],
      );
      const exit = routeSnapshots(project).find(
        ({ snapshot }) =>
          snapshot.checkpoint === 'beforeRoomExit' &&
          semanticAddressKey(snapshot.owner).includes('golden-h-combat02'),
      );
      if (exit === undefined) throw new Error('H room exit was not reached');
      return exit.snapshot.maxStats;
    };
    const bones = exitMaxima('MetaCurrencyDrop');
    const ashes = exitMaxima('MetaCardPointsCommonDrop');
    expect(bones.maxMana - ashes.maxMana).toBe(5);
    expect(ashes.maxHealth - bones.maxHealth).toBe(5);
  });

  it('leaves room-exit conformance and execution diagnostics unchanged by the maxima', () => {
    const snapshots = new Map(
      routeSnapshots(createGoldenFGHProject()).map(({ snapshot }) => [
        semanticAddressKey(snapshot.owner),
        snapshot,
      ]),
    );
    const altered = new Map(
      [...snapshots].map(([key, snapshot]) => [
        key,
        Object.freeze({
          ...snapshot,
          maxStats: Object.freeze({ ...snapshot.maxStats, maxHealth: 1, maxMana: 1 }),
        }),
      ]),
    );
    const result = simulateProject(catalog, createGoldenFGHProject());
    const rooms = result.route.biomes.flatMap((biome) =>
      'snapshot' in biome && biome.snapshot !== undefined ? [biome.snapshot.entryRoom] : [],
    );
    expect(rooms.length).toBeGreaterThan(0);
    const occurrences = rooms.map((room) => room.origin);
    expect(deriveRoomExitConformanceDeltas(occurrences, altered)).toEqual(
      deriveRoomExitConformanceDeltas(occurrences, snapshots),
    );
    for (const room of rooms)
      expect(assembleOccurrenceDiagnostics(room, altered)).toEqual(
        assembleOccurrenceDiagnostics(room, snapshots),
      );
  });
});

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly, type RunStateSnapshot } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import type {
  WorkspaceRunStateRow,
  WorkspaceRunStateSection,
} from '@planner/projections/structured-workspace';
import { presentRunState } from '@planner/projections/structured-workspace/presentation/run-state';

const equippedTrait = (
  traitKey: string,
  fields: Partial<RunStateSnapshot['traits']['equippedTraits'][string]> = {},
) => ({
  traitKey,
  giverKey: 'test',
  providerKind: 'olympian' as const,
  sourceRole: 'test',
  ...fields,
});

const base: RunStateSnapshot = {
  owner: createExitDecisionAddress(createBiomeAddress('Underworld', 'F'), {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('x'),
  }),
  historySequence: 1,
  biomeKey: 'G',
  checkpoint: 'beforeTargetGeneration',
  godPool: { acquiredSourceKeys: [], effectiveSourceKeys: [], capNarrowed: false },
  traits: {
    equippedTraits: {},
    equippedSlots: {},
    elementCounts: { Aether: 0, Air: 0, Earth: 0, Fire: 0, Water: 0 },
    godBoonRarityCounts: {},
    upgradableTraitCount: 0,
    bannedTraitKeys: [],
    chaos: { active: [], matured: [] },
  },
  counters: {
    biomeDepthCache: 0,
    biomeEncounterDepth: 0,
    routeEncounterDepth: 0,
    roomHistoryOrdinal: 0,
    runDepthCache: 1,
    enteredBiomes: 1,
    upgradableTraitCount: 0,
  },
  arcanaFear: {
    arcana: { active: [], artificerUses: [] },
    fear: {
      configuredRanks: {},
      configuredTotal: 0,
      disabledVowKeys: [],
      effectiveRanks: {},
      forfeitConsumed: false,
    },
    events: [],
  } as unknown as RunStateSnapshot['arcanaFear'],
  keepsakes: {
    currentKey: null,
    history: [],
    removedKeys: [],
    fatedStatus: 'Unknown',
    olympianSources: [],
    nextOlympianAcquisitionOrder: 0,
    experimentalHammers: [],
  },
  rewardPriorities: [],
  pendingHermesShrineDeliveries: {},
  stygianWell: {
    sparkUses: 0,
    yarnUses: 0,
    hymnUses: 0,
    extendedUses: 0,
    timedInstances: [],
    directPurchases: {},
  },
  stygianWellLegality: {
    sparkUses: 0,
    yarnUses: 0,
    hymnUses: 0,
    discountUses: [],
    emptySlotUses: [],
    extendedUses: 0,
  },
  hexProgress: { bankedPathPoints: 0, investedNodeKeys: [] },
  hexObserver: {
    talentKeys: [],
    closed: false,
    bankedPathPoints: 0,
    investedPathPoints: 0,
    olympianTalentInvested: false,
  },
  forfeitStatus: 'inactive',
  resourceGains: {},
  maxStats: {
    maxHealth: 30,
    maxMana: 50,
    flat: [{ source: { kind: 'base' }, maxHealth: 30, maxMana: 50 }],
    multipliers: { maxHealth: 1, maxMana: 1 },
    convertedHealth: 0,
  },
  effects: {
    keepsakes: [],
    keepsakeHistory: [],
    traitStates: {},
    traitEntries: [],
    arcanaClocks: {},
    stygianWell: [],
    chaosCurses: [],
    hermesDeliveries: [],
    hexTalents: [],
  },
  rewardStoreController: {
    enteredStoreCount: 7,
    enteredMetaStoreCount: 2,
    currentMetaRatio: 2 / 7,
    targetMetaRewardsRatio: 0.3,
  },
  bags: [],
};

function present(patch: Partial<RunStateSnapshot> = {}) {
  return presentRunState(catalog, { ...base, ...patch }, 'Before Combat 12');
}

function withEffects(effects: Partial<RunStateSnapshot['effects']>) {
  return { effects: { ...base.effects, ...effects } };
}

/** Each section as `heading: name (bracket) | right` lines. */
function lines(sections: readonly WorkspaceRunStateSection[]) {
  const text = (row: WorkspaceRunStateRow) =>
    [row.name, row.bracket, row.right === undefined ? undefined : `| ${row.right}`]
      .filter((part) => part !== undefined)
      .join(' ');
  return Object.fromEntries(
    sections.map((section) => [section.heading ?? section.key, section.rows.map(text)]),
  );
}

describe('Run State presentation', () => {
  it('names the moment, and returns every tab with empty sections dropped', () => {
    const state = present();
    expect(state.moment).toBe('Before Combat 12 · Oceanus');
    expect(state.loadout).toEqual([]);
    expect(state.overview).toEqual([]);
    expect(state.effects).toEqual([]);
    expect(state.keepsakes).toEqual([]);
    expect(state.arcana).toEqual([]);
    expect(state.fear).toEqual([]);
    expect(state.moreInfo.sections.map((section) => section.heading)).toEqual([
      'Reward Store Ratio',
      'Counters',
    ]);
  });

  it('opens the Overview with the loadout and orders keepsake, elements, traits and Hex', () => {
    const state = present({
      traits: {
        ...base.traits,
        equippedTraits: {
          ApolloWeaponBoon: equippedTrait('ApolloWeaponBoon', { rarity: 'Rare', level: 3 }),
          BoonGrowthBoon: equippedTrait('BoonGrowthBoon', { rarity: 'Common', level: 1 }),
          ElementalHealthBoon: equippedTrait('ElementalHealthBoon', { rarity: 'Common' }),
          ElementalDamageFloorBoon: equippedTrait('ElementalDamageFloorBoon', { rarity: 'Rare' }),
          StaffDoubleAttackTrait: equippedTrait('StaffDoubleAttackTrait', {
            providerKind: 'hammer',
            hammerRank: 'RankII',
          }),
          StaffLongAttackTrait: equippedTrait('StaffLongAttackTrait', {
            providerKind: 'hammer',
            hammerRank: 'RankI',
          }),
          EchoDoubleShop: equippedTrait('EchoDoubleShop', { providerKind: 'npc' }),
          SpellMoonBeamTrait: equippedTrait('SpellMoonBeamTrait', { providerKind: 'spell' }),
        },
        equippedSlots: {
          Melee: equippedTrait('ApolloWeaponBoon', { rarity: 'Rare', level: 3 }),
          Spell: equippedTrait('SpellMoonBeamTrait', { providerKind: 'spell' }),
        },
        elementCounts: { Aether: 0, Air: 5, Earth: 0, Fire: 1, Water: 4 },
      },
      hexProgress: {
        spellTraitKey: 'SpellMoonBeamTrait',
        bankedPathPoints: 0,
        investedNodeKeys: [],
      },
      ...withEffects({
        aspect: { aspectKey: 'BaseStaffAspect', rank: 6 },
        familiarKey: 'FrogFamiliar',
        keepsakes: [
          {
            keepsakeKey: 'RarifyKeepsake',
            rank: 'Epic',
            state: { kind: 'clock', clock: { unit: 'charges', direction: 'remaining', value: 1 } },
          },
          {
            keepsakeKey: 'DecayingBoostKeepsake',
            state: { kind: 'bonus', fraction: 0.2499999999999998 },
          },
          { keepsakeKey: 'EscalatingKeepsake', rank: 'Rare' },
        ],
        traitStates: {
          BoonGrowthBoon: {
            kind: 'clock',
            clock: { unit: 'encounters', direction: 'progress', value: 4, total: 6 },
          },
          ElementalHealthBoon: { kind: 'elementCount', element: 'Water', count: 4 },
          ElementalDamageFloorBoon: { kind: 'status', status: 'active' },
          StaffLongAttackTrait: {
            kind: 'clock',
            clock: { unit: 'encounters', direction: 'remaining', value: 1 },
          },
          EchoDoubleShop: { kind: 'status', status: 'pending' },
        },
        traitEntries: [
          { kind: 'trait', traitKey: 'BoonGrowthBoon' },
          {
            kind: 'chaosBlessing',
            acquisitionIdentity: 'b',
            blessingKey: 'ChaosHealthBlessing',
            rarity: 'Epic',
          },
          { kind: 'trait', traitKey: 'ElementalHealthBoon' },
          { kind: 'trait', traitKey: 'ElementalDamageFloorBoon' },
          { kind: 'trait', traitKey: 'StaffDoubleAttackTrait' },
          { kind: 'trait', traitKey: 'StaffLongAttackTrait' },
          { kind: 'trait', traitKey: 'EchoDoubleShop' },
          { kind: 'consumedTrait', traitKey: 'EchoDoubleShop', acquisitionIdentity: 'old' },
        ],
        hexTalents: [{ talentKey: 'UnknownTalent', level: 2 }],
      }),
    });
    expect(lines([{ key: 'loadout', rows: state.loadout }])).toEqual({
      loadout: ['Aspect of Melinoë | Rank VI', 'Frinos'],
    });
    expect(state.overview.map((section) => section.heading)).toEqual([
      'Keepsake',
      'Elements',
      'Traits',
      'Hex',
    ]);
    expect(lines(state.overview)).toEqual({
      Keepsake: ['Calling Card (1 charge) | ★★★', 'Lion Fang (+25%)', 'Discordant Bell | ★★'],
      Elements: ['Air 5 · Water 4 · Fire 1'],
      Traits: [
        'Nova Strike | Rare · Lv. 3',
        'Steady Growth (4/6 encounters) | Common · Lv. 1',
        'Soul | Epic',
        'Water Fitness (Water 4) | Common',
        'Air Quality (Active) | Rare',
        'Wicked Thrasher | Rank II',
        `${catalog.traits.byKey.StaffLongAttackTrait!.label} (1 encounter)`,
        'Gold Gold Gold (Pending)',
        'Gold Gold Gold (Consumed)',
      ],
      Hex: ['Sky Fall', 'UnknownTalent | Lv. 2'],
    });
  });

  it('groups Well, Shrine and Chaos effects with remaining-only countdowns', () => {
    const state = present({
      ...withEffects({
        stygianWell: [
          {
            itemKey: 'TemporaryImprovedSecondaryTrait',
            clock: { unit: 'encounters', direction: 'remaining', value: 3 },
          },
          {
            itemKey: 'TemporaryDoorHealTrait',
            clock: { unit: 'guardians', direction: 'remaining', value: 1 },
          },
          {
            itemKey: 'TemporaryBoonRarityTrait',
            clock: { unit: 'charges', direction: 'remaining', value: 1 },
          },
          {
            itemKey: 'ExtendedShopTrait',
            clock: { unit: 'charges', direction: 'remaining', value: 2 },
          },
        ],
        hermesDeliveries: [
          {
            entryKey: 'e',
            rewardType: 'SpellDrop',
            clock: { unit: 'encounters', direction: 'remaining', value: 2 },
          },
        ],
        chaosCurses: [
          {
            curseKey: 'ChaosHiddenRoomRewardCurse',
            blessingKey: 'ChaosHealthBlessing',
            rarity: 'Rare',
            clock: { unit: 'boons', direction: 'remaining', value: 1 },
          },
        ],
      }),
    });
    expect(lines(state.effects)).toEqual({
      Well: [
        'Chimaera Jerky (3 encounters)',
        'HydraLite (1 guardian)',
        'Yarn of Ariadne (1 charge)',
        'Archaic Seal (2 charges)',
      ],
      Shrine: ["Selene's Gift (2 encounters)"],
      Chaos: ['Enshrouded → Soul (1 boon) | Rare'],
    });
    expect(
      lines(
        present(
          withEffects({
            hermesDeliveries: [
              {
                entryKey: 'e',
                rewardType: 'SpellDrop',
                clock: { unit: 'encounters', direction: 'remaining', value: 1 },
              },
            ],
          }),
        ).effects,
      ),
    ).toEqual({ Shrine: ["Selene's Gift (1 encounter)"] });
  });

  it('formats each biome keepsake chain, kept keepsakes and known Fated status', () => {
    const history = (fatedStatus: RunStateSnapshot['keepsakes']['fatedStatus']) =>
      lines(
        present({
          keepsakes: {
            ...base.keepsakes,
            retained: [{ key: 'EscalatingKeepsake', rank: 'Rare' }],
            fatedStatus,
          },
          ...withEffects({
            keepsakeHistory: [
              { biomeKey: 'F', keepsakeKeys: ['RarifyKeepsake', 'ManaOverTimeRefundKeepsake'] },
              { biomeKey: 'G', keepsakeKeys: ['ManaOverTimeRefundKeepsake'] },
            ],
          }),
        }).keepsakes,
      );
    expect(history('Unknown')).toEqual({
      history: ['Erebus · Calling Card → Silver Wheel', 'Oceanus · Silver Wheel'],
      Kept: ['Discordant Bell | ★★'],
    });
    expect(history('Fated').fated).toEqual(['Fated']);
  });

  it('shows equipped Arcana with clocks and ranks, then temporary cards and Barren', () => {
    const state = present({
      arcanaFear: {
        ...base.arcanaFear,
        arcana: {
          ...base.arcanaFear.arcana,
          active: [
            { key: 'MaxHealthPerRoom', origin: 'automatic', rarity: 'Epic' },
            { key: 'MetaToRunUpgrade', origin: 'equipped', rarity: 'Common' },
            { key: 'ChanneledCast', origin: 'temporary', rarity: 'Heroic' },
          ],
        },
      } as unknown as RunStateSnapshot['arcanaFear'],
      ...withEffects({
        arcanaClocks: {
          MaxHealthPerRoom: { unit: 'rooms', direction: 'progress', value: 4, total: 5 },
          MetaToRunUpgrade: { unit: 'charges', direction: 'remaining', value: 1 },
        },
        arcanaBarren: { unit: 'encounters', direction: 'remaining', value: 2 },
      }),
    });
    expect(lines(state.arcana)).toEqual({
      equipped: ['The Centaur (4/5 rooms) | Rank III', 'The Artificer (1 charge) | Rank I'],
      Temporary: ['The Sorceress | Rank IV'],
      'Run effects': ['Barren (2 encounters)'],
    });
  });

  it('shows active vows with ranks, then Forfeit, Circe-disabled vows and banned traits', () => {
    const state = present({
      forfeitStatus: 'consumed',
      arcanaFear: {
        ...base.arcanaFear,
        fear: {
          configuredRanks: { EnemyDamageShrineUpgrade: 2, EnemyHealthShrineUpgrade: 1 },
          configuredTotal: 4,
          disabledVowKeys: ['EnemyDamageShrineUpgrade'],
          effectiveRanks: { EnemyDamageShrineUpgrade: 0, EnemyHealthShrineUpgrade: 1 },
          forfeitConsumed: true,
        },
      } as unknown as RunStateSnapshot['arcanaFear'],
      traits: { ...base.traits, bannedTraitKeys: ['ApolloSpecialBoon'] },
    });
    expect(lines(state.fear)).toEqual({
      vows: ['Vow of Grit | Rank I'],
      Effects: ['Forfeit | Used'],
      'Disabled by Circe': ['Vow of Pain | Rank II'],
      Banned: ['Nova Flourish'],
    });
  });

  it('keeps More Info details: gods, Hex, bags and the Reward Store ratio', () => {
    const state = present({
      godPool: { ...base.godPool, acquiredSourceKeys: ['ApolloUpgrade'] },
      traits: {
        ...base.traits,
        equippedSlots: { Spell: equippedTrait('SpellMoonBeamTrait', { providerKind: 'spell' }) },
      },
      hexProgress: {
        spellTraitKey: 'SpellMoonBeamTrait',
        tree: { layoutKey: 'Maze', nodes: {} },
        godSentAdded: true,
        bankedPathPoints: 2,
        investedNodeKeys: ['1:3', '2:2'],
      },
      bags: [
        {
          storeKey: 'RunProgress',
          remaining: { kind: 'exact', count: 1 },
          entries: [
            {
              rewardType: 'Boon',
              eligibility: 'eligible',
              remaining: { kind: 'exact', count: 1 },
              conditions: [
                {
                  remaining: { kind: 'exact', count: 1 },
                  requirement: { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 2 } },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(lines(state.moreInfo.sections)).toEqual({
      'Gods in pool': ['Apollo'],
      Hex: [
        'Layout | Maze',
        'Capacity | 22 → 24',
        'God Sent | Added',
        'Path points banked | 2',
        'Path points invested | 2',
      ],
      'Reward Store Ratio': [
        'Entered stores | 7 entered, 2 Minor Reward',
        'Current ratio | 0.286',
        'Biome target | 0.300',
      ],
      Counters: [
        'biomeDepthCache | 0',
        'biomeEncounterDepth | 0',
        'routeEncounterDepth | 0',
        'roomHistoryOrdinal | 0',
        'runDepthCache | 1',
        'enteredBiomes | 1',
        'upgradableTraitCount | 0',
      ],
    });
    expect(
      lines(
        present({ hexProgress: { bankedPathPoints: 5, investedNodeKeys: [] } }).moreInfo.sections,
      ),
    ).toMatchObject({ Hex: ['Path points banked | 5', 'Path points invested | 0'] });
    expect(state.moreInfo.bags[0]).toMatchObject({
      label: 'Major Reward',
      technicalKey: 'RunProgress',
      rows: [
        { name: 'Remaining', right: 'x1' },
        { name: 'Eligible', right: 'x1' },
        { name: 'Ineligible', right: 'x0' },
      ],
      eligible: {
        total: 'x1',
        entries: [
          {
            label: 'Boon',
            technicalKey: 'Boon',
            conditions: [
              {
                technicalKey: 'counterRange',
                explanation: 'Requires biomeDepthCache at least 2.',
              },
            ],
          },
        ],
      },
    });
    const target = (bankableStoreKeys: readonly string[]) =>
      present({
        rewardStoreController: {
          enteredStoreCount: 0,
          enteredMetaStoreCount: 0,
          currentMetaRatio: null,
          bankableStoreKeys,
        },
      }).moreInfo.sections.find((section) => section.key === 'reward-store')!.rows;
    expect(lines([{ key: 'r', rows: target([]) }]).r).toEqual([
      'Entered stores | 0 entered, 0 Minor Reward',
      'Current ratio | None counted yet',
      'Biome target | This biome ignores Reward Store.',
    ]);
    expect(target(['TartarusRewards'])[2]?.right).toBe('This biome rolls only Tartarus Reward.');
    expect(target(['RunProgress', 'MetaProgress'])[2]?.right).toBe(
      'This biome rolls no base store.',
    );
  });

  it('formats max stats with signed sources, multipliers and a cap note', () => {
    const state = present({
      maxStats: {
        maxHealth: 30,
        maxMana: 150,
        flat: [
          { source: { kind: 'base' }, maxHealth: 30, maxMana: 50 },
          { source: { kind: 'aspect', key: 'BaseStaffAspect' }, maxHealth: 50.1, maxMana: 0 },
          {
            source: { kind: 'keepsake', key: 'ManaOverTimeRefundKeepsake' },
            maxHealth: 0,
            maxMana: 100,
          },
        ],
        multipliers: { maxHealth: 1.15, maxMana: 1 },
        convertedHealth: 0,
        maxHealthCap: { maxHealth: 30, keepsakeKey: 'LowHealthCritKeepsake' },
      },
    });
    expect(lines([{ key: 'rows', rows: state.maxStats.rows }]).rows).toEqual([
      'Max Health (Fixed by White Antler) | 30',
      'Max Magick | 150',
    ]);
    expect(lines([{ key: 'sources', rows: state.maxStats.sources }]).sources).toEqual([
      'Base | +30 health · +50 Magick',
      'Aspect of Melinoë | +50.1 health',
      'Silver Wheel | +100 Magick',
      'Multipliers | ×1.15 health',
    ]);
  });

  it('shows a G postboss replacement as the G swap when the F rack was skipped', () => {
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(
        createOccurrenceAddress(
          createBiomeAddress('Underworld', 'G'),
          createOccurrenceId('golden-g-preboss-shop:postboss'),
        ),
      ),
      keepsakeKey: 'BossPreDamageKeepsake',
    });
    const g = simulateProjectAssembly(catalog, project).evaluation.route?.biomes.find(
      (biome) => biome.biomeKey === 'G',
    );
    if (g?.authoring !== 'complete' || g.validity !== 'valid')
      throw new Error('expected valid G biome');
    const snapshot = g.rewards.runStateSnapshots.find(
      (candidate) =>
        candidate.owner.kind === 'roomRunStateCheckpoint' &&
        candidate.owner.occurrenceId === 'golden-g-preboss-shop:postboss' &&
        candidate.owner.checkpoint.kind === 'beforeRoomExit',
    );
    if (snapshot === undefined) throw new Error('expected G postboss Run State checkpoint');
    const history = presentRunState(catalog, snapshot, 'Leaving Postboss').keepsakes[0]!.rows;
    expect(history.map((row) => row.name)).toEqual([
      'Erebus · Silver Wheel',
      'Oceanus · Silver Wheel → Knuckle Bones',
    ]);
  });
});

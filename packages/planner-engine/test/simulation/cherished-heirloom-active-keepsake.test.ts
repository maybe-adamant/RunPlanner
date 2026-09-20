import { describe, expect, it } from 'vitest';
import { ordinaryRoutePosition } from '../support/route-position';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHProject, goldenGBiome } from '@run-planner/test-fixtures/underworld';

import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../src/authored-project/defaults';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import {
  applyKeepsakeReplacement,
  beginBiomeKeepsakeState,
  createKeepsakeState,
  keepsakeRankForEquip,
  type KeepsakeState,
} from '../../src/simulation/keepsakes/state';
import { attestGorgonBranchState } from '../../src/simulation/keepsakes/encounter-effects';
import { initializeTestRewardBranchesForRoute as initializeRewardBranches } from '../support/arcana-fear';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';
import { type RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import { evaluateProgressiveBiomeAssembly } from '../../src/simulation/progressive/biome';
import { simulateProject } from '../../src/simulation/evaluation/project';
import {
  attachTraitHistory,
  foldTraitHistoryEvents,
  type TraitHistoryEvent,
} from '../../src/simulation/traits';

const loadout = createDefaultRouteLoadout(catalog);
const arcanaFear = createArcanaFearState(catalog, loadout);
const owner = createEncounterPhaseAddress(
  createBiomeAddress('Underworld', 'F'),
  { kind: 'occurrence', occurrenceId: createOccurrenceId('cherished-active') },
  'Encounter',
);

function prerequisiteEvents(): readonly TraitHistoryEvent[] {
  return [
    {
      kind: 'traitOffer',
      owner: { kind: 'project' },
      acquisitionRole: 'demeterSeed',
      sequence: 1,
      giverKey: 'Demeter',
      options: [{ traitKey: 'DemeterWeaponBoon', rarity: 'Common' }],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'prerequisiteSeed',
    },
    {
      kind: 'traitOffer',
      owner: { kind: 'project' },
      acquisitionRole: 'heraSeed',
      sequence: 2,
      giverKey: 'Hera',
      options: [{ traitKey: 'HeraCastBoon', rarity: 'Common' }],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'prerequisiteSeed',
    },
  ];
}

function branchWithKeepsakes(
  keepsakes: KeepsakeState,
  extraEvents: readonly TraitHistoryEvent[] = [],
): RewardBranchState {
  const initialized = initializeRewardBranches(
    undefined,
    arcanaFear,
    catalog,
    keepsakes.currentKey,
  )[0]!;
  const traitHistory = foldTraitHistoryEvents(catalog, [...prerequisiteEvents(), ...extraEvents]);
  return Object.freeze({
    ...initialized,
    state: Object.freeze({
      ...initialized.state,
      rewardHistory: attachTraitHistory(initialized.state.rewardHistory, traitHistory),
      traitHistory: traitHistory,
      keepsakes: keepsakes,
    }),
  });
}

function currentBranch(key: string): RewardBranchState {
  return branchWithKeepsakes(createKeepsakeState(catalog, key, arcanaFear));
}

function cherishedOffer(giverKey: 'Demeter' | 'Hera') {
  const otherTraits =
    giverKey === 'Demeter'
      ? (['DemeterSpecialBoon', 'DemeterSprintBoon'] as const)
      : (['HeraSpecialBoon', 'HeraSprintBoon'] as const);
  return {
    kind: 'traits' as const,
    giverKey,
    options: [
      { traitKey: 'KeepsakeLevelBoon', rarity: 'Duo' as const },
      { traitKey: otherTraits[0], rarity: 'Common' as const },
      { traitKey: otherTraits[1], rarity: 'Common' as const },
    ] as const,
    selectedOptionKey: 'option1' as const,
    rarificationActions: [] as const,
  };
}

function acquireCherished(
  branch: RewardBranchState,
  giverKey: 'Demeter' | 'Hera' = 'Demeter',
): RewardBranchState {
  return settleEncounterTraitOffer(
    catalog,
    branch,
    owner,
    cherishedOffer(giverKey),
    (branch.state.traitHistory?.events.length ?? 0) + 1,
    'encounterCompleted',
  ).branch;
}

describe('Cherished Heirloom active keepsake advance', () => {
  it.each([
    ['pending', { status: 'pending', rarityLevel: 3 }, { status: 'pending', rarityLevel: 4 }],
    ['consumed', { status: 'consumed' }, { status: 'consumed' }],
    ['expired', { status: 'expired' }, { status: 'expired' }],
  ] as const)('advances only a %s current Gorgon appearance', (_label, before, after) => {
    const initial = createKeepsakeState(catalog, 'AthenaEncounterKeepsake', arcanaFear);
    const acquired = acquireCherished(branchWithKeepsakes({ ...initial, gorgon: before }));
    expect(acquired.state.keepsakes.gorgon).toEqual(after);
    expect(acquired.state.keepsakes.fatedStatus).toBe(initial.fatedStatus);
  });

  it.each([
    [0, false],
    [2, true],
    [3, false],
  ] as const)(
    'leaves current Fig Leaf uses %i and biome guard %s unchanged',
    (remainingUses, activatedThisBiome) => {
      const initial = createKeepsakeState(catalog, 'SkipEncounterKeepsake', arcanaFear);
      const keepsakes = {
        ...initial,
        figLeaf: { remainingUses, activatedThisBiome },
      };
      expect(acquireCherished(branchWithKeepsakes(keepsakes)).state.keepsakes.figLeaf).toEqual(
        keepsakes.figLeaf,
      );
    },
  );

  it.each([
    [0, false],
    [9, true],
    [20, true],
  ] as const)(
    'leaves current Hammer identity, active state, and %i remaining uses unchanged',
    (remainingUses, active) => {
      const acquisitionIdentity = 'keepsake:hammer:1';
      const initial = createKeepsakeState(catalog, 'TempHammerKeepsake', arcanaFear);
      const keepsakes = {
        ...initial,
        experimentalHammers: [
          { traitKey: 'StaffJumpSpecialTrait', remainingUses, acquisitionIdentity, active },
        ],
      };
      const hammerEvent: TraitHistoryEvent = {
        kind: 'traitOffer',
        owner: { kind: 'project' },
        acquisitionRole: 'experimentalHammerEquip',
        sequence: 3,
        giverKey: 'WeaponUpgrade',
        options: [{ traitKey: 'StaffJumpSpecialTrait' }],
        selectedOptionKey: 'option1',
        acquisitionPoint: 'keepsakeEquip',
        acquisitionIdentity,
      };
      const acquired = acquireCherished(branchWithKeepsakes(keepsakes, [hammerEvent]));
      expect(acquired.state.keepsakes.experimentalHammers.at(-1)).toEqual(
        keepsakes.experimentalHammers.at(-1),
      );
      expect(
        acquired.state.traitHistory?.events.filter(
          (event) => event.kind === 'traitOffer' && event.giverKey === 'WeaponUpgrade',
        ),
      ).toEqual([hammerEvent]);
    },
  );

  it('changes current Jeweled Pom prospectively to +4 without another Hades acquisition', () => {
    const acquisitionIdentity = 'keepsake:pom:1';
    const initial = createKeepsakeState(catalog, 'HadesAndPersephoneKeepsake', arcanaFear);
    const keepsakes = {
      ...initial,
      jeweledPom: {
        grantedTraitKey: 'HadesLifestealBoon',
        active: true,
        levels: 3,
        acquisitionIdentity,
      },
    };
    const hadesEvent: TraitHistoryEvent = {
      kind: 'traitOffer',
      owner: { kind: 'project' },
      acquisitionRole: 'jeweledPomEquip',
      sequence: 3,
      giverKey: 'Hades',
      options: [{ traitKey: 'HadesLifestealBoon' }],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'keepsakeEquip',
      acquisitionIdentity,
    };
    const before = branchWithKeepsakes(keepsakes, [hadesEvent]);
    const acquired = acquireCherished(before);
    expect(acquired.state.keepsakes.jeweledPom).toEqual({ ...keepsakes.jeweledPom, levels: 4 });
    expect(acquired.state.traitHistory?.equippedTraits.HadesLifestealBoon).toEqual(
      before.state.traitHistory?.equippedTraits.HadesLifestealBoon,
    );
    expect(
      acquired.state.traitHistory?.events.filter(
        (event) => event.kind === 'traitOffer' && event.giverKey === 'Hades',
      ),
    ).toEqual([hadesEvent]);

    const nextOffer = settleEncounterTraitOffer(
      catalog,
      acquired,
      owner,
      {
        kind: 'traits',
        giverKey: 'Demeter',
        options: [
          { traitKey: 'DemeterSpecialBoon', rarity: 'Common' },
          { traitKey: 'DemeterSprintBoon', rarity: 'Common' },
          { traitKey: 'DemeterManaBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
      (acquired.state.traitHistory?.events.length ?? 0) + 1,
      'laterEncounterCompleted',
    );
    expect(nextOffer.branch.state.traitHistory?.equippedTraits.DemeterSpecialBoon?.level).toBe(5);
    expect(
      nextOffer.branch.state.traitHistory?.events.filter(
        (event) => event.kind === 'traitOffer' && event.giverKey === 'Hades',
      ),
    ).toEqual([hadesEvent]);
  });

  it('adds only Moon Beam Epic-to-Heroic Path delta through the real Cherished acquisition fold', () => {
    const before = currentBranch('SpellTalentKeepsake');
    expect(before.state.hexProgress).toEqual({ bankedPathPoints: 5, investedPathPoints: 0 });
    expect(before.state.rewardPriorities).toEqual(['SpellDrop']);

    const acquired = acquireCherished(before);
    expect(acquired.state.hexProgress).toEqual({ bankedPathPoints: 7, investedPathPoints: 0 });
    expect(acquired.state.rewardPriorities).toEqual(['SpellDrop']);
  });

  it.each([
    ['pending', { origin: 'ordinary', status: 'pending', rarity: 'Epic' }, 'Heroic'],
    ['consumed', { origin: 'ordinary', status: 'consumed', rarity: 'Epic' }, 'Epic'],
  ] as const)(
    'advances Crystal Figurine only while its source is unused (%s)',
    (_label, before, expectedRarity) => {
      const initial = createKeepsakeState(catalog, 'BossMetaUpgradeKeepsake', arcanaFear);
      const acquired = acquireCherished(branchWithKeepsakes({ ...initial, figurine: before }));
      expect(acquired.state.keepsakes.figurine).toEqual({ ...before, rarity: expectedRarity });
    },
  );

  it.each([0, 3, 6])('adds the declared Calling Card rank delta to %i charges', (remaining) => {
    const initial = createKeepsakeState(catalog, 'RarifyKeepsake', arcanaFear);
    const acquired = acquireCherished(
      branchWithKeepsakes({ ...initial, callingCard: { remainingCharges: remaining } }),
    );
    const effect = catalog.keepsakes.byKey.RarifyKeepsake?.effect;
    expect(effect?.kind).toBe('callingCard');
    if (effect?.kind !== 'callingCard') return;
    expect(acquired.state.keepsakes.callingCard?.remainingCharges).toBe(
      remaining + effect.rarificationChargesByRank.Heroic - effect.rarificationChargesByRank.Epic,
    );
    expect(acquired.state.keepsakes.fatedStatus).toBe(initial.fatedStatus);
  });

  it('applies the Calling Card spend before adding the Cherished declaration delta', () => {
    const initial = branchWithKeepsakes({
      ...createKeepsakeState(catalog, 'RarifyKeepsake', arcanaFear),
      callingCard: { remainingCharges: 3 },
    });
    const offer = cherishedOffer('Demeter');
    const acquired = settleEncounterTraitOffer(
      catalog,
      initial,
      owner,
      { ...offer, rarificationActions: ['option2'] },
      3,
      'encounterCompleted',
    );
    const effect = catalog.keepsakes.byKey.RarifyKeepsake?.effect;
    expect(effect?.kind).toBe('callingCard');
    if (effect?.kind !== 'callingCard') return;
    expect(acquired.branch.traitEvaluations?.at(-1)?.offer).toMatchObject({
      options: [
        { traitKey: 'KeepsakeLevelBoon', rarity: 'Duo' },
        { traitKey: 'DemeterSpecialBoon', rarity: 'Rare' },
        { traitKey: 'DemeterSprintBoon', rarity: 'Common' },
      ],
    });
    expect(acquired.branch.state.keepsakes.callingCard?.remainingCharges).toBe(
      3 - 1 + effect.rarificationChargesByRank.Heroic - effect.rarificationChargesByRank.Epic,
    );
  });

  it.each([0, 2, 4])('adds the declared Time Piece rank delta to %i charges', (remaining) => {
    const initial = createKeepsakeState(catalog, 'GoldifyKeepsake', arcanaFear);
    const acquired = acquireCherished(
      branchWithKeepsakes({ ...initial, timePiece: { remainingCharges: remaining } }),
    );
    const effect = catalog.keepsakes.byKey.GoldifyKeepsake?.effect;
    expect(effect?.kind).toBe('timePiece');
    if (effect?.kind !== 'timePiece') return;
    expect(acquired.state.keepsakes.timePiece?.remainingCharges).toBe(
      remaining + effect.conversionChargesByRank.Heroic - effect.conversionChargesByRank.Epic,
    );
  });

  it('keeps a neutral current identity inert while retaining later rank-IV equip behavior', () => {
    const acquired = acquireCherished(currentBranch('BossPreDamageKeepsake'));
    expect(acquired.state.keepsakes).toMatchObject({
      currentKey: 'BossPreDamageKeepsake',
      history: [{ key: 'BossPreDamageKeepsake', kind: 'start', biomeNumber: 1 }],
      removedKeys: [],
    });
    expect(acquired.state.traitHistory?.equippedTraits.KeepsakeLevelBoon).toBeDefined();
    const rank = keepsakeRankForEquip(
      catalog,
      'SkipEncounterKeepsake',
      acquired.state.traitHistory!,
    );
    const replaced = applyKeepsakeReplacement(
      catalog,
      acquired.state.keepsakes,
      'SkipEncounterKeepsake',
      acquired.state.arcanaFear,
      rank,
    );
    expect(rank).toBe('Heroic');
    expect(replaced.figLeaf).toEqual({ remainingUses: 4, activatedThisBiome: false });
  });

  it('mutates no retained ledger when the current keepsake is effect-neutral', () => {
    const keepsakes: KeepsakeState = Object.freeze({
      ...createKeepsakeState(catalog, 'BossPreDamageKeepsake', arcanaFear),
      removedKeys: Object.freeze([
        'AthenaEncounterKeepsake',
        'SkipEncounterKeepsake',
        'TempHammerKeepsake',
        'HadesAndPersephoneKeepsake',
        'RarifyKeepsake',
        'GoldifyKeepsake',
      ]),
      gorgon: Object.freeze({ status: 'expired' }),
      figLeaf: Object.freeze({ remainingUses: 1, activatedThisBiome: true }),
      experimentalHammers: Object.freeze([
        Object.freeze({
          traitKey: 'StaffJumpSpecialTrait',
          remainingUses: 7,
          acquisitionIdentity: 'keepsake:hammer:removed',
          active: true,
        }),
      ]),
      jeweledPom: Object.freeze({
        grantedTraitKey: 'HadesLifestealBoon',
        active: true,
        levels: 3,
        acquisitionIdentity: 'keepsake:pom:removed',
      }),
      callingCard: Object.freeze({ remainingCharges: 2 }),
      timePiece: Object.freeze({ remainingCharges: 3 }),
    });
    const acquired = acquireCherished(branchWithKeepsakes(keepsakes));
    expect(acquired.state.keepsakes).toEqual(keepsakes);
  });

  it.each([
    ['Gorgon Amulet', 'AthenaEncounterKeepsake', 'gorgon'],
    ['Fig Leaf', 'SkipEncounterKeepsake', 'figLeaf'],
    ['Experimental Hammer', 'TempHammerKeepsake', 'experimentalHammer'],
    ['Jeweled Pom', 'HadesAndPersephoneKeepsake', 'jeweledPom'],
    ['Calling Card', 'RarifyKeepsake', 'callingCard'],
    ['Time Piece', 'GoldifyKeepsake', 'timePiece'],
  ] as const)(
    'does not recreate a missing current %s ledger or product',
    (_label, keepsakeKey, ledgerKey) => {
      const initial = createKeepsakeState(catalog, keepsakeKey, arcanaFear);
      const withoutLedger = Object.freeze(
        Object.fromEntries(Object.entries(initial).filter(([key]) => key !== ledgerKey)),
      ) as unknown as KeepsakeState;
      const acquired = acquireCherished(branchWithKeepsakes(withoutLedger));
      expect(acquired.state.keepsakes).not.toHaveProperty(ledgerKey);
    },
  );

  it('keeps equivalent branch advances attested and exposes a missed branch transition', () => {
    const initial = currentBranch('AthenaEncounterKeepsake');
    const demeter = acquireCherished(initial, 'Demeter');
    const hera = acquireCherished(initial, 'Hera');
    expect(
      attestGorgonBranchState([
        { state: { keepsakes: demeter.state.keepsakes } },
        { state: { keepsakes: hera.state.keepsakes } },
      ]),
    ).toBe('pending');
    expect(() =>
      attestGorgonBranchState([
        { state: { keepsakes: demeter.state.keepsakes } },
        { state: { keepsakes: initial.state.keepsakes } },
      ]),
    ).toThrow('Gorgon branch frontier is divergent');
  });

  it.each(['Demeter', 'Hera'] as const)(
    'settles one ordinary canonical %s offer and advances exactly once',
    (giverKey) => {
      const initial = branchWithKeepsakes({
        ...createKeepsakeState(catalog, 'RarifyKeepsake', arcanaFear),
        callingCard: { remainingCharges: 2 },
      });
      const first = acquireCherished(initial, giverKey);
      const recomposed = acquireCherished(initial, giverKey);
      const repeated = acquireCherished(first, giverKey);
      expect(first.state.keepsakes.callingCard?.remainingCharges).toBe(4);
      expect(recomposed.state.keepsakes.callingCard?.remainingCharges).toBe(4);
      expect(repeated.state.keepsakes.callingCard?.remainingCharges).toBe(4);
      expect(
        repeated.state.traitHistory?.events.filter(
          (event) =>
            event.kind === 'traitOffer' &&
            event.options.some((option) => option.traitKey === 'KeepsakeLevelBoon'),
        ),
      ).toHaveLength(1);
      expect(beginBiomeKeepsakeState(repeated.state.keepsakes).callingCard?.remainingCharges).toBe(
        4,
      );
    },
  );

  it('does not replay the advance during real progressive succeeding-biome evaluation', () => {
    const project = createGoldenFGHProject();
    const route = project.route;
    const plan = route?.biomes.find((biome) => biome.biomeKey === 'G');
    const previous = simulateProject(catalog, project).route?.biomes.find(
      (biome) => biome.biomeKey === 'F',
    );
    if (
      route === undefined ||
      plan === undefined ||
      previous?.authoring !== 'complete' ||
      previous.validity !== 'valid'
    )
      throw new Error('missing valid F-to-G progressive fixture');

    const active = acquireCherished(
      branchWithKeepsakes({
        ...createKeepsakeState(catalog, 'RarifyKeepsake', arcanaFear),
        callingCard: { remainingCharges: 2 },
      }),
    );
    const base = previous.rewards.branches[0];
    if (base === undefined || active.state.traitHistory === undefined)
      throw new Error('missing progressive reward branch');
    const rewardBranch = Object.freeze({
      ...base,
      state: Object.freeze({
        ...base.state,
        rewardHistory: attachTraitHistory(base.state.rewardHistory, active.state.traitHistory),
        traitHistory: active.state.traitHistory,
        keepsakes: active.state.keepsakes,
      }),
    });
    const input = {
      routePosition: ordinaryRoutePosition(catalog, 'Underworld', 'G'),
      resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
      loadout: route.loadout,
      seed: {
        history: previous.history,
        rewardBranches: [rewardBranch],
      },
    } as const;
    const first = evaluateProgressiveBiomeAssembly(catalog, goldenGBiome, plan, input);
    const recomposed = evaluateProgressiveBiomeAssembly(catalog, goldenGBiome, plan, input);
    expect(first).not.toBeNull();
    expect(recomposed).not.toBeNull();
    expect(
      first?.evaluation.rewards.branches.every(
        (branch) => branch.state.keepsakes.callingCard?.remainingCharges === 4,
      ),
    ).toBe(true);
    expect(
      recomposed?.evaluation.rewards.branches.every(
        (branch) => branch.state.keepsakes.callingCard?.remainingCharges === 4,
      ),
    ).toBe(true);
    expect(
      first?.evaluation.rewards.runStateSnapshots.some(
        (snapshot) => snapshot.keepsakes.callingCard?.remainingCharges === 4,
      ),
    ).toBe(true);
  });

  it('does nothing when the selected Cherished offer is not legal', () => {
    const initialized = initializeRewardBranches(
      undefined,
      arcanaFear,
      catalog,
      'GoldifyKeepsake',
    )[0]!;
    const before = {
      ...initialized,
      state: Object.freeze({
        ...initialized.state,
        keepsakes: {
          ...initialized.state.keepsakes,
          timePiece: { remainingCharges: 2 },
        },
      }),
    };
    const rejected = acquireCherished(before);
    expect(rejected.state.keepsakes).toEqual(before.state.keepsakes);
    expect(rejected.state.traitHistory?.equippedTraits.KeepsakeLevelBoon).toBeUndefined();
  });

  it('does not advance when Cherished is displayed but an ordinary alternative is selected', () => {
    const initial = branchWithKeepsakes({
      ...createKeepsakeState(catalog, 'GoldifyKeepsake', arcanaFear),
      timePiece: { remainingCharges: 2 },
    });
    const offer = cherishedOffer('Demeter');
    const selectedAlternative = settleEncounterTraitOffer(
      catalog,
      initial,
      owner,
      { ...offer, selectedOptionKey: 'option2' },
      3,
      'encounterCompleted',
    );
    expect(
      selectedAlternative.branch.state.traitHistory?.equippedTraits.DemeterSpecialBoon,
    ).toBeDefined();
    expect(
      selectedAlternative.branch.state.traitHistory?.equippedTraits.KeepsakeLevelBoon,
    ).toBeUndefined();
    expect(selectedAlternative.branch.state.keepsakes).toEqual(initial.state.keepsakes);
  });
});

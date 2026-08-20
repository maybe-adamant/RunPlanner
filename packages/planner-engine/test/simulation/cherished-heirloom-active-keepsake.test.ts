import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHProject, goldenGBiome } from '@run-planner/test-fixtures/underworld';

import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import {
  applyKeepsakeDisposition,
  attestGorgonBranchState,
  beginBiomeKeepsakeState,
  createKeepsakeState,
  keepsakeRankForEquip,
  type KeepsakeState,
} from '../../src/simulation/keepsakes';
import {
  initializeRewardBranches,
  processEncounterTraitOffer,
  type RewardBranchState,
} from '../../src/simulation/rewards/processing';
import { evaluateProgressiveBiomeAssembly } from '../../src/simulation/progressive/biome';
import { simulateProject } from '../../src/simulation/project';
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
    history: attachTraitHistory(initialized.history, traitHistory),
    traitHistory,
    keepsakes,
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
  return processEncounterTraitOffer(
    catalog,
    branch,
    owner,
    cherishedOffer(giverKey),
    (branch.traitHistory?.events.length ?? 0) + 1,
    'encounterCompleted',
  );
}

describe('Cherished Heirloom active keepsake advance', () => {
  it.each([
    ['pending', { status: 'pending', rarity: 'Epic' }, { status: 'pending', rarity: 'Heroic' }],
    ['consumed', { status: 'consumed' }, { status: 'consumed' }],
    ['expired', { status: 'expired' }, { status: 'expired' }],
  ] as const)('advances only a %s current Gorgon appearance', (_label, before, after) => {
    const initial = createKeepsakeState(catalog, 'AthenaEncounterKeepsake', arcanaFear);
    const acquired = acquireCherished(branchWithKeepsakes({ ...initial, gorgon: before }));
    expect(acquired.keepsakes.gorgon).toEqual(after);
    expect(acquired.keepsakes.fatedStatus).toBe(initial.fatedStatus);
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
      expect(acquireCherished(branchWithKeepsakes(keepsakes)).keepsakes.figLeaf).toEqual(
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
      expect(acquired.keepsakes.experimentalHammers.at(-1)).toEqual(
        keepsakes.experimentalHammers.at(-1),
      );
      expect(
        acquired.traitHistory?.events.filter(
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
    expect(acquired.keepsakes.jeweledPom).toEqual({ ...keepsakes.jeweledPom, levels: 4 });
    expect(acquired.traitHistory?.equippedTraits.HadesLifestealBoon).toEqual(
      before.traitHistory?.equippedTraits.HadesLifestealBoon,
    );
    expect(
      acquired.traitHistory?.events.filter(
        (event) => event.kind === 'traitOffer' && event.giverKey === 'Hades',
      ),
    ).toEqual([hadesEvent]);

    const nextOffer = processEncounterTraitOffer(
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
      (acquired.traitHistory?.events.length ?? 0) + 1,
      'laterEncounterCompleted',
    );
    expect(nextOffer.traitHistory?.equippedTraits.DemeterSpecialBoon?.level).toBe(5);
    expect(
      nextOffer.traitHistory?.events.filter(
        (event) => event.kind === 'traitOffer' && event.giverKey === 'Hades',
      ),
    ).toEqual([hadesEvent]);
  });

  it.each([0, 3, 6])('adds the declared Calling Card rank delta to %i charges', (remaining) => {
    const initial = createKeepsakeState(catalog, 'RarifyKeepsake', arcanaFear);
    const acquired = acquireCherished(
      branchWithKeepsakes({ ...initial, callingCard: { remainingCharges: remaining } }),
    );
    const effect = catalog.keepsakes.byKey.RarifyKeepsake?.effect;
    expect(effect?.kind).toBe('callingCard');
    if (effect?.kind !== 'callingCard') return;
    expect(acquired.keepsakes.callingCard?.remainingCharges).toBe(
      remaining + effect.rarificationChargesByRank.Heroic - effect.rarificationChargesByRank.Epic,
    );
    expect(acquired.keepsakes.fatedStatus).toBe(initial.fatedStatus);
  });

  it('applies the Calling Card spend before adding the Cherished declaration delta', () => {
    const initial = branchWithKeepsakes({
      ...createKeepsakeState(catalog, 'RarifyKeepsake', arcanaFear),
      callingCard: { remainingCharges: 3 },
    });
    const offer = cherishedOffer('Demeter');
    const acquired = processEncounterTraitOffer(
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
    expect(acquired.traitEvaluations?.at(-1)?.offer).toMatchObject({
      options: [
        { traitKey: 'KeepsakeLevelBoon', rarity: 'Duo' },
        { traitKey: 'DemeterSpecialBoon', rarity: 'Rare' },
        { traitKey: 'DemeterSprintBoon', rarity: 'Common' },
      ],
    });
    expect(acquired.keepsakes.callingCard?.remainingCharges).toBe(
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
    expect(acquired.keepsakes.timePiece?.remainingCharges).toBe(
      remaining + effect.conversionChargesByRank.Heroic - effect.conversionChargesByRank.Epic,
    );
  });

  it('keeps a neutral current identity inert while retaining later rank-IV equip behavior', () => {
    const acquired = acquireCherished(currentBranch('BossPreDamageKeepsake'));
    expect(acquired.keepsakes).toMatchObject({
      currentKey: 'BossPreDamageKeepsake',
      history: [{ key: 'BossPreDamageKeepsake', kind: 'start' }],
      removedKeys: [],
    });
    expect(acquired.traitHistory?.equippedTraits.KeepsakeLevelBoon).toBeDefined();
    const rank = keepsakeRankForEquip(catalog, 'SkipEncounterKeepsake', acquired.traitHistory!);
    const replaced = applyKeepsakeDisposition(
      catalog,
      acquired.keepsakes,
      { kind: 'replace', keepsakeKey: 'SkipEncounterKeepsake' },
      acquired.arcanaFear,
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
    expect(acquired.keepsakes).toEqual(keepsakes);
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
      expect(acquired.keepsakes).not.toHaveProperty(ledgerKey);
    },
  );

  it('keeps equivalent branch advances attested and exposes a missed branch transition', () => {
    const initial = currentBranch('AthenaEncounterKeepsake');
    const demeter = acquireCherished(initial, 'Demeter');
    const hera = acquireCherished(initial, 'Hera');
    expect(
      attestGorgonBranchState([{ keepsakes: demeter.keepsakes }, { keepsakes: hera.keepsakes }]),
    ).toBe('pending');
    expect(() =>
      attestGorgonBranchState([{ keepsakes: demeter.keepsakes }, { keepsakes: initial.keepsakes }]),
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
      expect(first.keepsakes.callingCard?.remainingCharges).toBe(4);
      expect(recomposed.keepsakes.callingCard?.remainingCharges).toBe(4);
      expect(repeated.keepsakes.callingCard?.remainingCharges).toBe(4);
      expect(
        repeated.traitHistory?.events.filter(
          (event) =>
            event.kind === 'traitOffer' &&
            event.options.some((option) => option.traitKey === 'KeepsakeLevelBoon'),
        ),
      ).toHaveLength(1);
      expect(beginBiomeKeepsakeState(repeated.keepsakes).callingCard?.remainingCharges).toBe(4);
    },
  );

  it('does not replay the advance during real progressive succeeding-biome evaluation', () => {
    const project = createGoldenFGHProject();
    const route = project.routes.find((candidate) => candidate.routeKey === 'Underworld');
    const plan = route?.biomes.find((biome) => biome.biomeKey === 'G');
    const previous = simulateProject(catalog, project)
      .routes.find((candidate) => candidate.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
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
    if (base === undefined || active.traitHistory === undefined)
      throw new Error('missing progressive reward branch');
    const rewardBranch = Object.freeze({
      ...base,
      history: attachTraitHistory(base.history, active.traitHistory),
      traitHistory: active.traitHistory,
      keepsakes: active.keepsakes,
    });
    const input = {
      enteredBiomeCount: 2,
      loadout: route.loadout,
      seed: { history: previous.history, rewardBranches: [rewardBranch] },
    } as const;
    const first = evaluateProgressiveBiomeAssembly(catalog, goldenGBiome, plan, input);
    const recomposed = evaluateProgressiveBiomeAssembly(catalog, goldenGBiome, plan, input);
    expect(first).not.toBeNull();
    expect(recomposed).not.toBeNull();
    expect(
      first?.evaluation.rewards.branches.every(
        (branch) => branch.keepsakes.callingCard?.remainingCharges === 4,
      ),
    ).toBe(true);
    expect(
      recomposed?.evaluation.rewards.branches.every(
        (branch) => branch.keepsakes.callingCard?.remainingCharges === 4,
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
      keepsakes: {
        ...initialized.keepsakes,
        timePiece: { remainingCharges: 2 },
      },
    };
    const rejected = acquireCherished(before);
    expect(rejected.keepsakes).toEqual(before.keepsakes);
    expect(rejected.traitHistory?.equippedTraits.KeepsakeLevelBoon).toBeUndefined();
  });

  it('does not advance when Cherished is displayed but an ordinary alternative is selected', () => {
    const initial = branchWithKeepsakes({
      ...createKeepsakeState(catalog, 'GoldifyKeepsake', arcanaFear),
      timePiece: { remainingCharges: 2 },
    });
    const offer = cherishedOffer('Demeter');
    const selectedAlternative = processEncounterTraitOffer(
      catalog,
      initial,
      owner,
      { ...offer, selectedOptionKey: 'option2' },
      3,
      'encounterCompleted',
    );
    expect(selectedAlternative.traitHistory?.equippedTraits.DemeterSpecialBoon).toBeDefined();
    expect(selectedAlternative.traitHistory?.equippedTraits.KeepsakeLevelBoon).toBeUndefined();
    expect(selectedAlternative.keepsakes).toEqual(initial.keepsakes);
  });
});

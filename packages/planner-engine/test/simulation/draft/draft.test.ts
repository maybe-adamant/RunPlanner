import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import { defaultDraftGodBoons } from '../../../src/authored-project/draft-spec';
import {
  assessDraftBasket,
  draftGodBoonBudget,
  draftKeepsakeOptions,
  draftSourceQueues,
  draftRefusals,
  draftWorldGiverKeys,
  draftWorldOptions,
  type DraftLoadout,
  type DraftRoute,
  type DraftSpec,
  type DraftWorld,
} from '../../../src/simulation';

function route(
  routeKey: string,
  itineraryBiomeKeys: readonly string[],
  overrides: Partial<DraftLoadout> = {},
): DraftRoute & DraftLoadout {
  const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
  void _startingReward;
  return { ...loadout, routeKey, itineraryBiomeKeys, ...overrides };
}

const underworld = route('Underworld', ['F', 'G', 'H', 'I']);
const surface = route('Surface', ['N', 'O', 'P', 'Q']);
const dream = route('Dream', ['H', 'F', 'N', 'I']);

function refusals(frame: DraftRoute & DraftLoadout, draft: Partial<DraftSpec> = {}) {
  const base = createProjectDocument(catalog, {
    projectId: 'draft',
    routeKey: frame.routeKey,
    itineraryBiomeKeys: frame.itineraryBiomeKeys,
  });
  return draftRefusals(catalog, base, {
    loadout: frame,
    world: { godKeys: ['Zeus', 'Apollo', 'Hestia'], storyNpcByBiome: {}, fieldNpcsByBiome: {} },
    basketTraitKeys: [],
    rackKeepsakeKeys: frame.itineraryBiomeKeys.slice(1).map(() => null),
    ...draft,
  });
}

const emptyWorld: DraftWorld = { godKeys: [], storyNpcByBiome: {}, fieldNpcsByBiome: {} };

function spec(basketTraitKeys: readonly string[], world: Partial<DraftWorld> = {}): DraftSpec {
  return {
    loadout: underworld,
    world: { ...emptyWorld, godKeys: ['Zeus', 'Apollo'], ...world },
    basketTraitKeys,
    rackKeepsakeKeys: [],
  };
}

function biomeHosts(draftRoute: DraftRoute) {
  return draftWorldOptions(catalog, draftRoute).biomes.map((biome) => ({
    biomeKey: biome.biomeKey,
    story: biome.storyNpc?.npcKey,
    field: biome.fieldNpcs.map((npc) => npc.npcKey).sort(),
  }));
}

function assessment(frame: DraftRoute & DraftLoadout, draft: DraftSpec, traitKey: string) {
  const result = assessDraftBasket(catalog, frame, { ...draft, loadout: frame }).traits.find(
    (trait) => trait.traitKey === traitKey,
  );
  if (result === undefined) throw new Error(`${traitKey} is not in the draft domain`);
  return result;
}

describe('draft world options', () => {
  it('reads Underworld story and field NPCs from room encounter slots', () => {
    expect(biomeHosts(underworld)).toEqual([
      { biomeKey: 'F', story: 'Arachne', field: ['Artemis', 'Nemesis'] },
      { biomeKey: 'G', story: 'Narcissus', field: ['Artemis', 'Nemesis'] },
      { biomeKey: 'H', story: 'Echo', field: ['Nemesis'] },
      { biomeKey: 'I', story: 'Hades', field: ['Nemesis'] },
    ]);
  });

  it('reads Surface hosts, with no story or field NPC in Q', () => {
    expect(biomeHosts(surface)).toEqual([
      { biomeKey: 'N', story: 'Medea', field: ['Artemis', 'Heracles'] },
      { biomeKey: 'O', story: 'Circe', field: ['Heracles', 'Icarus'] },
      { biomeKey: 'P', story: 'Dionysus', field: ['Athena', 'Heracles', 'Icarus'] },
      { biomeKey: 'Q', story: undefined, field: [] },
    ]);
  });

  it('follows a Dream itinerary in its own order', () => {
    expect(biomeHosts(dream).map(({ biomeKey, story }) => [biomeKey, story])).toEqual([
      ['H', 'Echo'],
      ['F', 'Arachne'],
      ['N', 'Medea'],
      ['I', 'Hades'],
    ]);
  });

  it('offers the Olympians under the native god cap', () => {
    const options = draftWorldOptions(catalog, underworld);
    expect(options.maxGods).toBe(4);
    expect(options.godKeys).toContain('Zeus');
    expect(options.godKeys).not.toContain('Artemis');
  });

  it('lists the Hermes, Hammer and Selene givers every world has', () => {
    expect([...draftWorldOptions(catalog, underworld).bonusGiverKeys].sort()).toEqual([
      'Hermes',
      'SpellDrop',
      'WeaponUpgrade',
    ]);
  });

  it('contributes the selected trait-giving NPCs and the always-present givers', () => {
    const givers = draftWorldGiverKeys(catalog, surface, {
      godKeys: ['Hera'],
      storyNpcByBiome: { O: 'Circe' },
      fieldNpcsByBiome: { N: ['Artemis', 'Heracles'], P: ['Athena'] },
    });
    expect([...givers].sort()).toEqual([
      'Artemis',
      'Athena',
      'Circe',
      'Hera',
      'Hermes',
      'SpellDrop',
      'WeaponUpgrade',
    ]);
  });
});

describe('draft basket legality', () => {
  it('admits a Duo only with its prerequisite traits in the basket', () => {
    expect(assessment(underworld, spec([]), 'ApolloSecondStageCastBoon').selectable).toBe(false);
    expect(
      assessment(
        underworld,
        spec(['ApolloExCastBoon', 'ZeusWeaponBoon']),
        'ApolloSecondStageCastBoon',
      ).selectable,
    ).toBe(true);
  });

  it('removes other Attacks once an Attack is drafted', () => {
    const draft = spec(['ZeusWeaponBoon']);
    expect(assessment(underworld, draft, 'ApolloWeaponBoon').refusals).toContainEqual({
      kind: 'slotTaken',
      slot: 'Melee',
      traitKey: 'ZeusWeaponBoon',
    });
    expect(assessment(underworld, draft, 'ZeusWeaponBoon').selectable).toBe(true);
  });

  it('refuses Hammers for another weapon', () => {
    const loadout = (weaponKey: string) =>
      route('Underworld', ['F', 'G', 'H', 'I'], {
        weaponKey,
        aspectKey: catalog.weapons.byKey[weaponKey]!.defaultAspectKey,
      });
    const draft = spec(['StaffDoubleAttackTrait']);
    const wrongLoadout = { kind: 'wrongHammerLoadout' };
    expect(
      assessment(loadout('WeaponStaffSwing'), draft, 'StaffDoubleAttackTrait').refusals,
    ).not.toContainEqual(wrongLoadout);
    expect(
      assessment(loadout('WeaponDagger'), draft, 'StaffDoubleAttackTrait').refusals,
    ).toContainEqual(wrongLoadout);
  });

  it('requires a Hammer the loadout can take before Latest Model', () => {
    const icarus = { fieldNpcsByBiome: { O: ['Icarus'] } };
    const latestModel = assessment(surface, spec([], icarus), 'UpgradeHammerBoon');
    expect(latestModel.refusals).toContainEqual(
      expect.objectContaining({ kind: 'requirement', code: 'missingPrerequisite' }),
    );
    const required = latestModel.refusals.flatMap((refusal) =>
      refusal.kind === 'requirement' ? (refusal.requirementTraitKeys ?? []) : [],
    );
    expect(required).toContain('StaffDoubleAttackTrait');
    expect(required).not.toContain('DaggerBlinkAoETrait');
    expect(
      assessment(surface, spec(['StaffDoubleAttackTrait'], icarus), 'UpgradeHammerBoon').selectable,
    ).toBe(true);
  });

  it('classifies core, other, Legendary and Duo traits', () => {
    const kinds = Object.fromEntries(
      [
        'ZeusWeaponBoon',
        'ZeusCastBoon',
        'SpawnKillBoon',
        'ApolloSecondStageCastBoon',
        'FocusLightningBoon',
      ].map((key) => [key, assessment(underworld, spec([]), key).kind]),
    );
    expect(kinds).toEqual({
      ZeusWeaponBoon: 'core',
      ZeusCastBoon: 'core',
      SpawnKillBoon: 'legendary',
      ApolloSecondStageCastBoon: 'duo',
      FocusLightningBoon: 'other',
    });
  });

  it('refuses the Hera and Zeus Ransoms as draft-illegal', () => {
    const draft = spec(['HeraWeaponBoon', 'ZeusCastBoon'], { godKeys: ['Hera', 'Zeus'] });
    for (const traitKey of ['SuperSacrificeBoonHera', 'SuperSacrificeBoonZeus'])
      expect(assessment(underworld, draft, traitKey).refusals).toContainEqual({
        kind: 'draftIllegal',
      });
  });

  it('leaves element thresholds to the search', () => {
    const infusion = assessment(underworld, spec([]), 'ElementalDamageFloorBoon');
    expect(infusion.selectable).toBe(true);
    expect(infusion.checkedDuringSearch).toContain('elementCount');
  });

  it('caps Hammers and Hermes at two, Hex at one and each god at five', () => {
    const staff = route('Underworld', ['F', 'G', 'H', 'I'], {
      weaponKey: 'WeaponStaffSwing',
      aspectKey: catalog.weapons.byKey.WeaponStaffSwing!.defaultAspectKey,
    });
    const cases = [
      [
        'WeaponUpgrade',
        2,
        ['StaffDoubleAttackTrait', 'StaffLongAttackTrait'],
        'StaffDashAttackTrait',
      ],
      ['Hermes', 2, ['HermesWeaponBoon', 'HermesSpecialBoon'], 'SorcerySpeedBoon'],
      ['SpellDrop', 1, ['SpellMeteorTrait'], 'SpellLaserTrait'],
      [
        'Zeus',
        5,
        ['ZeusWeaponBoon', 'ZeusSpecialBoon', 'ZeusCastBoon', 'ZeusSprintBoon', 'ZeusManaBoon'],
        'DoubleBoltBoon',
      ],
    ] as const;
    for (const [giverKey, cap, held, next] of cases) {
      const cappedRefusal = { kind: 'cap', giverKey, cap };
      expect(assessment(staff, spec(held), next).refusals).toContainEqual(cappedRefusal);
      expect(assessment(staff, spec(held.slice(1)), next).refusals).not.toContainEqual(
        cappedRefusal,
      );
    }
  });

  it('caps each god at four under Denial, in the refusals and the caps product', () => {
    const denial = {
      ...underworld,
      fearRanks: { ...underworld.fearRanks, BanUnpickedBoonsShrineUpgrade: 1 },
    };
    const zeus = ['ZeusWeaponBoon', 'ZeusSpecialBoon', 'ZeusCastBoon', 'ZeusSprintBoon'];
    const capped = { kind: 'cap', giverKey: 'Zeus', cap: 4 };
    expect(assessment(denial, spec(zeus), 'ZeusManaBoon').refusals).toContainEqual(capped);
    expect(assessment(denial, spec(zeus.slice(1)), 'ZeusManaBoon').refusals).not.toContainEqual(
      capped,
    );
    const { caps } = assessDraftBasket(catalog, denial, { ...spec(zeus), loadout: denial });
    expect(caps.poolGods[0]).toEqual({ giverKey: 'Zeus', count: 4, cap: 4 });
    expect(caps.poolGodTotal).toEqual({ count: 4, cap: 14 });
  });

  it('counts a Legendary toward its god, and a held Duo toward neither', () => {
    const zeusCores = ['ZeusWeaponBoon', 'ZeusSpecialBoon', 'ZeusCastBoon', 'ZeusSprintBoon'];
    const zeusCap = { kind: 'cap', giverKey: 'Zeus', cap: 5 };
    expect(
      assessment(underworld, spec([...zeusCores, 'SpawnKillBoon']), 'ZeusManaBoon').refusals,
    ).toContainEqual(zeusCap);
    expect(
      assessment(underworld, spec([...zeusCores, 'ApolloSecondStageCastBoon']), 'ZeusManaBoon')
        .refusals,
    ).not.toContainEqual(zeusCap);
  });

  it('does not count a Duo toward either god', () => {
    const zeusCores = [
      'ZeusWeaponBoon',
      'ZeusSpecialBoon',
      'ZeusCastBoon',
      'ZeusSprintBoon',
      'ZeusManaBoon',
    ];
    const duo = assessment(
      underworld,
      spec([...zeusCores, 'ApolloExCastBoon']),
      'ApolloSecondStageCastBoon',
    );
    expect(duo.refusals.some((refusal) => refusal.kind === 'cap')).toBe(false);
  });

  it('caps the basket at fourteen god traits, ten under Forfeit, leaving Hermes outside', () => {
    const godKeys = ['Zeus', 'Apollo', 'Hestia', 'Aphrodite'];
    const own = (giverKey: string) =>
      catalog.traitGivers.byKey[giverKey]!.traitKeys.filter(
        (key) => catalog.traitGivers.values.filter((g) => g.traitKeys.includes(key)).length === 1,
      );
    const next = own('Aphrodite')[0]!;
    const fourteen = [
      ...godKeys.slice(0, 3).flatMap((key) => own(key).slice(0, 4)),
      ...own('Aphrodite').slice(1, 3),
    ];
    const capped = (cap: number) => ({ kind: 'totalCap', cap });
    expect(assessment(underworld, spec(fourteen, { godKeys }), next).refusals).toContainEqual(
      capped(14),
    );
    expect(
      assessment(underworld, spec(fourteen.slice(1), { godKeys }), next).refusals,
    ).not.toContainEqual(capped(14));
    expect(
      assessment(underworld, spec(fourteen, { godKeys }), 'HermesWeaponBoon').refusals,
    ).not.toContainEqual(capped(14));
    const forfeit = {
      ...underworld,
      fearRanks: { ...underworld.fearRanks, BoonSkipShrineUpgrade: 1 },
    };
    const ten = fourteen.slice(0, 10);
    expect(assessment(forfeit, spec(ten, { godKeys }), next).refusals).toContainEqual(capped(10));
    expect(assessment(forfeit, spec(ten.slice(1), { godKeys }), next).refusals).not.toContainEqual(
      capped(10),
    );
  });

  it("sums the planned biomes' god boons, less one each under Forfeit, with one Hermes or Hammer per planned biome", () => {
    const planned = (count: number, frame = underworld) => ({
      ...frame,
      biomes: createProjectDocument(catalog, {
        projectId: 'p',
        routeKey: 'Underworld',
        configuredBiomeCount: count,
      }).route.biomes,
    });
    const forfeit = {
      ...underworld,
      fearRanks: { ...underworld.fearRanks, BoonSkipShrineUpgrade: 1 },
    };
    const capsOf = (frame: DraftRoute & DraftLoadout) =>
      assessDraftBasket(catalog, frame, { ...spec([]), loadout: frame }).caps;
    const caps = (count: number) => {
      const { poolGodTotal, supplyTotal, providers, poolGods } = capsOf(planned(count));
      return {
        gods: poolGodTotal.cap,
        forfeitGods: capsOf(planned(count, forfeit)).poolGodTotal.cap,
        supply: supplyTotal.cap,
        selene: providers.find((p) => p.providerKind === 'spell')!.cap,
        perGod: poolGods[0]!.cap,
      };
    };
    expect([1, 2, 3, 4].map(caps)).toEqual([
      // Underworld's defaults: F 6, G 2, H 2, I 4.
      { gods: 6, forfeitGods: 5, supply: 1, selene: 1, perGod: 5 },
      { gods: 8, forfeitGods: 6, supply: 2, selene: 1, perGod: 5 },
      { gods: 10, forfeitGods: 7, supply: 3, selene: 1, perGod: 5 },
      { gods: 14, forfeitGods: 10, supply: 4, selene: 1, perGod: 5 },
    ]);
    // An unconfigured route plans the whole itinerary.
    expect(capsOf(underworld)).toMatchObject({
      poolGodTotal: { cap: 14 },
      supplyTotal: { cap: 4 },
    });
    // One planned biome takes one Hermes or Hammer trait in all.
    const one = planned(1);
    expect(
      assessDraftBasket(catalog, one, { ...spec(['HermesWeaponBoon']), loadout: one }).traits.find(
        (trait) => trait.traitKey === 'StaffDoubleAttackTrait',
      )?.refusals,
    ).toContainEqual({ kind: 'supplyCap', cap: 1 });
  });

  it('refuses a trait whose giver is outside the world', () => {
    expect(assessment(underworld, spec(['HeraWeaponBoon']), 'HeraWeaponBoon').refusals).toEqual([
      { kind: 'giverNotInWorld' },
    ]);
  });

  it('refuses a Duo unless both of its gods are in the world', () => {
    const notInWorld = { kind: 'giverNotInWorld' };
    expect(
      assessment(underworld, spec([], { godKeys: ['Zeus', 'Hestia'] }), 'ApolloSecondStageCastBoon')
        .refusals,
    ).toContainEqual(notInWorld);
    expect(
      assessment(underworld, spec([]), 'ApolloSecondStageCastBoon').refusals,
    ).not.toContainEqual(notInWorld);
  });

  it('refuses a basket Duo whose other god is outside the pool', () => {
    expect(
      refusals(underworld, {
        world: { ...emptyWorld, godKeys: ['Zeus', 'Hestia', 'Hera'] },
        basketTraitKeys: ['ApolloSecondStageCastBoon'],
      }),
    ).toContainEqual({
      kind: 'basketTrait',
      traitKey: 'ApolloSecondStageCastBoon',
      refusals: expect.arrayContaining([{ kind: 'giverNotInWorld' }]),
    });
  });

  it('caps each selected trait-giving NPC at one trait', () => {
    const world = { storyNpcByBiome: { F: 'Arachne' }, fieldNpcsByBiome: { G: ['Artemis'] } };
    const [first, second] = catalog.traitGivers.byKey.Arachne!.traitKeys;
    const artemis = catalog.traitGivers.byKey.Artemis!.traitKeys.find(
      (key) => assessment(underworld, spec([], world), key).selectable,
    )!;
    const capped = { kind: 'cap', giverKey: 'Arachne', cap: 1 };
    expect(assessment(underworld, spec([first!], world), second!).refusals).toContainEqual(capped);
    expect(assessment(underworld, spec([], world), second!).refusals).toEqual([]);
    expect(assessment(underworld, spec([first!], world), artemis).selectable).toBe(true);
  });
});

describe('draft basket order', () => {
  it("queues each god's, Hermes' and each Hammer's traits in basket order, Duos outside", () => {
    const draft = spec([
      'ZeusCastBoon',
      'SpawnKillBoon',
      'HermesWeaponBoon',
      'ApolloWeaponBoon',
      'ZeusSprintBoon',
      'StaffLongAttackTrait',
      'ApolloExCastBoon',
      'HermesSpecialBoon',
      'ZeusWeaponBoon',
      'ApolloSecondStageCastBoon',
      'StaffDoubleAttackTrait',
    ]);
    expect(draftSourceQueues(catalog, draft)).toEqual([
      {
        giverKey: 'Zeus',
        traitKeys: ['ZeusCastBoon', 'SpawnKillBoon', 'ZeusSprintBoon', 'ZeusWeaponBoon'],
      },
      { giverKey: 'Apollo', traitKeys: ['ApolloWeaponBoon', 'ApolloExCastBoon'] },
      { giverKey: 'Hermes', traitKeys: ['HermesWeaponBoon', 'HermesSpecialBoon'] },
      {
        giverKey: 'WeaponUpgrade',
        traitKeys: ['StaffLongAttackTrait', 'StaffDoubleAttackTrait'],
      },
    ]);
  });

  it('refuses a Hermes trait queued before the Hermes trait it needs', () => {
    const order = (basket: readonly string[]) =>
      assessment(
        underworld,
        spec([...basket], { godKeys: ['Zeus', 'Apollo'] }),
        'TimeStopLastStandBoon',
      ).refusals;
    const prerequisites = ['ZeusWeaponBoon', 'DoubleStrikeChanceBoon'];
    expect(order([...prerequisites, 'TimeStopLastStandBoon', 'LuckyBoon'])).toEqual([
      { kind: 'prerequisiteAfter', traitKeys: ['LuckyBoon'] },
    ]);
    expect(order([...prerequisites, 'LuckyBoon', 'TimeStopLastStandBoon'])).toEqual([]);
  });

  it('refuses a trait queued before the only god traits that meet its need', () => {
    const refusal = { kind: 'prerequisiteAfter', traitKeys: ['ZeusCastBoon'] };
    expect(
      assessment(underworld, spec(['DoubleBoltBoon', 'ZeusCastBoon']), 'DoubleBoltBoon').refusals,
    ).toEqual([refusal]);
    expect(
      assessment(underworld, spec(['ZeusCastBoon', 'DoubleBoltBoon']), 'DoubleBoltBoon').selectable,
    ).toBe(true);
    // An earlier member of the same need is enough.
    expect(
      assessment(
        underworld,
        spec(['ZeusSprintBoon', 'DoubleBoltBoon', 'ZeusCastBoon']),
        'DoubleBoltBoon',
      ).selectable,
    ).toBe(true);
    expect(
      refusals(underworld, { basketTraitKeys: ['DoubleBoltBoon', 'ZeusCastBoon'] }),
    ).toContainEqual({ kind: 'basketTrait', traitKey: 'DoubleBoltBoon', refusals: [refusal] });
  });

  it('refuses a Legendary queued above its own god prerequisites, and admits it after them', () => {
    const before = spec(['SpawnKillBoon', 'ZeusCastBoon', 'FocusLightningBoon', 'DoubleBoltBoon']);
    expect(assessment(underworld, before, 'SpawnKillBoon').refusals).toEqual([
      {
        kind: 'prerequisiteAfter',
        traitKeys: ['ZeusCastBoon', 'FocusLightningBoon', 'DoubleBoltBoon'],
      },
    ]);
    const after = spec(['ZeusCastBoon', 'FocusLightningBoon', 'DoubleBoltBoon', 'SpawnKillBoon']);
    expect(assessment(underworld, after, 'SpawnKillBoon').selectable).toBe(true);
  });
});

describe('draft god boon budget', () => {
  const planned = (count: number, routeKey = 'Underworld', itinerary?: readonly string[]) => ({
    ...underworld,
    routeKey,
    ...(itinerary === undefined ? {} : { itineraryBiomeKeys: itinerary }),
    biomes: createProjectDocument(catalog, {
      projectId: 'b',
      routeKey,
      ...(itinerary === undefined ? {} : { itineraryBiomeKeys: itinerary }),
      configuredBiomeCount: count,
    }).route.biomes,
  });

  it("plans each biome's default by biome key, with overrides by biome", () => {
    const budget = draftGodBoonBudget(catalog, planned(4), {
      loadout: underworld,
      godBoonsByBiome: { G: 6 },
    });
    expect(budget.biomes.map(({ biomeKey, value }) => [biomeKey, value])).toEqual([
      ['F', defaultDraftGodBoons('F')],
      ['G', 6],
      ['H', defaultDraftGodBoons('H')],
      ['I', defaultDraftGodBoons('I')],
    ]);
    expect(budget.total).toBe(
      6 + ['F', 'H', 'I'].reduce((sum, key) => sum + defaultDraftGodBoons(key), 0),
    );
    // A Dream route reads each biome's default by key, whatever its order.
    expect(
      draftGodBoonBudget(catalog, planned(2, 'Dream', ['H', 'F', 'N', 'I']), {
        loadout: underworld,
      }).biomes.map(({ biomeKey, value }) => [biomeKey, value]),
    ).toEqual([
      ['H', defaultDraftGodBoons('H')],
      ['F', defaultDraftGodBoons('F')],
    ]);
  });

  it('takes one boon per biome under Forfeit, floored at zero, and defaults to four per god under Denial', () => {
    const vows = { BoonSkipShrineUpgrade: 1, BanUnpickedBoonsShrineUpgrade: 1 };
    const loadout = { ...underworld, fearRanks: { ...underworld.fearRanks, ...vows } };
    const budget = draftGodBoonBudget(catalog, planned(2), {
      loadout,
      godBoonsByBiome: { G: 0 },
    });
    expect(budget).toMatchObject({
      total: defaultDraftGodBoons('F'),
      effectiveTotal: defaultDraftGodBoons('F') - 1,
      forfeit: true,
      perGod: 4,
      perGodDefault: 4,
      reachable: 16,
    });
    expect(budget.biomes.map((biome) => biome.effective)).toEqual([
      defaultDraftGodBoons('F') - 1,
      0,
    ]);
    // A chosen value holds under Denial; nothing is subtracted from it.
    expect(draftGodBoonBudget(catalog, planned(2), { loadout, perGodCap: 7 })).toMatchObject({
      perGod: 7,
      perGodDefault: 4,
      reachable: 28,
    });
  });

  it('caps each god at the per-god value in the refusals', () => {
    const draft = { ...spec(['ZeusWeaponBoon', 'ZeusCastBoon']), perGodCap: 2 };
    expect(assessment(underworld, draft, 'ZeusSprintBoon').refusals).toContainEqual({
      kind: 'cap',
      giverKey: 'Zeus',
      cap: 2,
    });
  });
});

describe('draft basket caps', () => {
  const world = {
    godKeys: ['Zeus', 'Apollo', 'Hestia', 'Aphrodite'],
    storyNpcByBiome: { F: 'Arachne', H: 'Echo' },
    fieldNpcsByBiome: { F: ['Artemis', 'Nemesis'] },
  };
  const basket = [
    'ZeusWeaponBoon',
    'ZeusSpecialBoon',
    'AphroditeManaBoon',
    'SprintEchoBoon',
    'HermesWeaponBoon',
    'SpellMeteorTrait',
    catalog.traitGivers.byKey.Arachne!.traitKeys[0]!,
  ];

  it('counts the basket against every cap of the world', () => {
    const { caps } = assessDraftBasket(catalog, underworld, spec(basket, world));
    expect(caps.poolGodTotal).toEqual({ count: 4, cap: 14 });
    expect(caps.poolGods).toEqual([
      { giverKey: 'Zeus', count: 2, cap: 5 },
      { giverKey: 'Apollo', count: 0, cap: 5 },
      { giverKey: 'Hestia', count: 0, cap: 5 },
      { giverKey: 'Aphrodite', count: 1, cap: 5 },
    ]);
    expect(caps.providers).toEqual(
      expect.arrayContaining([
        { giverKey: 'Hermes', providerKind: 'hermes', count: 1, cap: 2 },
        { giverKey: 'WeaponUpgrade', providerKind: 'hammer', count: 0, cap: 2 },
        { giverKey: 'SpellDrop', providerKind: 'spell', count: 1, cap: 1 },
      ]),
    );
    expect(caps.providers).toHaveLength(3);
    expect([...caps.npcs].sort((a, b) => a.giverKey.localeCompare(b.giverKey))).toEqual([
      { giverKey: 'Arachne', count: 1, cap: 1 },
      { giverKey: 'Artemis', count: 0, cap: 1 },
      { giverKey: 'Echo', count: 0, cap: 1 },
    ]);
    expect(caps.npcTotal).toEqual({ count: 1, cap: 3 });
  });

  it('lowers the pool-god total to ten under Forfeit', () => {
    const forfeit = {
      ...underworld,
      fearRanks: { ...underworld.fearRanks, BoonSkipShrineUpgrade: 1 },
    };
    const { caps } = assessDraftBasket(catalog, forfeit, {
      ...spec(basket, world),
      loadout: forfeit,
    });
    expect(caps.poolGodTotal).toEqual({ count: 4, cap: 10 });
  });
});

describe('draft keepsakes and route', () => {
  it('offers one rack per biome boundary without god keepsakes', () => {
    const { rackSlots } = draftKeepsakeOptions(catalog, underworld);
    expect(rackSlots.map((slot) => slot.afterBiomeKey)).toEqual(['F', 'G', 'H']);
    expect(rackSlots[0]!.keepsakeKeys).not.toContain('ForceZeusBoonKeepsake');
    expect(rackSlots[0]!.keepsakeKeys).toContain(catalog.defaultStartingKeepsakeKey);
  });

  it('refuses a loadout the project codec rejects', () => {
    const overGrasp = route('Underworld', ['F', 'G', 'H', 'I'], {
      manualArcanaKeys: catalog.arcanaCards.values.map((card) => card.key),
    });
    expect(refusals(overGrasp)).toEqual([expect.objectContaining({ kind: 'invalidLoadout' })]);
  });

  it('refuses god, unknown and miscounted rack keepsakes', () => {
    expect(
      refusals(underworld, {
        rackKeepsakeKeys: ['ForcePoseidonBoonKeepsake', 'MissingKeepsake', null],
      }),
    ).toEqual([
      {
        kind: 'rackKeepsake',
        index: 0,
        keepsakeKey: 'ForcePoseidonBoonKeepsake',
        reason: 'forcesGod',
      },
      { kind: 'rackKeepsake', index: 1, keepsakeKey: 'MissingKeepsake', reason: 'unknown' },
    ]);
    expect(refusals(underworld, { rackKeepsakeKeys: [null] })).toEqual([
      { kind: 'rackSlotCount', slotCount: 3 },
    ]);
  });

  it('refuses an invalid world', () => {
    expect(
      refusals(underworld, {
        world: {
          godKeys: ['Zeus', 'Apollo', 'Hera', 'Ares', 'Artemis'],
          storyNpcByBiome: { F: 'Medea' },
          fieldNpcsByBiome: { G: ['Heracles'] },
        },
      }),
    ).toEqual([
      { kind: 'tooManyGods', maxGods: 4 },
      { kind: 'notAGod', godKey: 'Artemis' },
      { kind: 'storyNpc', biomeKey: 'F', npcKey: 'Medea' },
      { kind: 'fieldNpc', biomeKey: 'G', npcKey: 'Heracles' },
    ]);
    const gods = (godKeys: string[]) =>
      refusals(underworld, { world: { godKeys, storyNpcByBiome: {}, fieldNpcsByBiome: {} } });
    expect(gods(['Zeus', 'Apollo'])).toEqual([{ kind: 'tooFewGods', minGods: 3 }]);
    expect(gods(['Zeus', 'Apollo', 'Hera'])).toEqual([]);
  });

  it('refuses a once-per-run field NPC selected in more than one biome', () => {
    const world = (fieldNpcsByBiome: DraftWorld['fieldNpcsByBiome']) => ({
      world: { godKeys: ['Zeus', 'Apollo', 'Hestia'], storyNpcByBiome: {}, fieldNpcsByBiome },
    });
    expect(
      refusals(underworld, world({ F: ['Artemis', 'Nemesis'], G: ['Artemis'], I: ['Nemesis'] })),
    ).toEqual([
      { kind: 'repeatedFieldNpc', npcKey: 'Artemis', biomeKeys: ['F', 'G'] },
      { kind: 'repeatedFieldNpc', npcKey: 'Nemesis', biomeKeys: ['F', 'I'] },
    ]);
    expect(refusals(surface, world({ O: ['Icarus'], P: ['Icarus', 'Heracles'] }))).toEqual([
      { kind: 'repeatedFieldNpc', npcKey: 'Icarus', biomeKeys: ['O', 'P'] },
    ]);
    expect(refusals(underworld, world({ F: ['Artemis'], I: ['Nemesis'] }))).toEqual([]);
  });

  it('counts a field NPC once toward the NPC caps however many biomes list it', () => {
    const { caps } = assessDraftBasket(catalog, underworld, {
      ...spec([], { fieldNpcsByBiome: { F: ['Artemis'], G: ['Artemis'] } }),
    });
    expect(caps.npcs).toEqual([{ giverKey: 'Artemis', count: 0, cap: 1 }]);
    expect(caps.npcTotal).toEqual({ count: 0, cap: 1 });
  });

  it('refuses basket traits the static legality rejects', () => {
    expect(
      refusals(underworld, { basketTraitKeys: ['ZeusWeaponBoon', 'ApolloWeaponBoon', 'Missing'] }),
    ).toEqual([{ kind: 'unknownTrait', traitKey: 'Missing' }]);
    expect(
      refusals(underworld, {
        basketTraitKeys: ['ZeusWeaponBoon', 'ApolloWeaponBoon', 'HeraWeaponBoon'],
      }).map((refusal) => refusal.kind === 'basketTrait' && refusal.traitKey),
    ).toEqual(['ZeusWeaponBoon', 'ApolloWeaponBoon', 'HeraWeaponBoon']);
  });

  it('refuses a god starting keepsake and the FreshFile route', () => {
    expect(refusals(underworld)).toEqual([]);
    expect(
      refusals(
        route('Underworld', ['F', 'G', 'H', 'I'], { startingKeepsakeKey: 'ForceHeraBoonKeepsake' }),
      ),
    ).toEqual([{ kind: 'godStartingKeepsake', keepsakeKey: 'ForceHeraBoonKeepsake' }]);
    expect(refusals(route('FreshFile', ['F', 'G', 'H', 'I']))).toEqual([
      { kind: 'freshFileRoute' },
    ]);
  });
});

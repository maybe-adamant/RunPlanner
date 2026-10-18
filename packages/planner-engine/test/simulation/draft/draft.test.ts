import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import {
  assessDraftBasket,
  draftKeepsakeOptions,
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
    world: { godKeys: ['Zeus', 'Apollo'], storyNpcByBiome: {}, fieldNpcsByBiome: {} },
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

  it('caps the basket at twelve god traits, eight under Forfeit, leaving Hermes outside', () => {
    const godKeys = ['Zeus', 'Apollo', 'Hestia', 'Aphrodite'];
    const own = (giverKey: string) =>
      catalog.traitGivers.byKey[giverKey]!.traitKeys.filter(
        (key) => catalog.traitGivers.values.filter((g) => g.traitKeys.includes(key)).length === 1,
      );
    const next = own('Aphrodite')[0]!;
    const twelve = godKeys.slice(0, 3).flatMap((key) => own(key).slice(0, 4));
    const capped = (cap: number) => ({ kind: 'totalCap', cap });
    expect(assessment(underworld, spec(twelve, { godKeys }), next).refusals).toContainEqual(
      capped(12),
    );
    expect(
      assessment(underworld, spec(twelve.slice(1), { godKeys }), next).refusals,
    ).not.toContainEqual(capped(12));
    expect(
      assessment(underworld, spec(twelve, { godKeys }), 'HermesWeaponBoon').refusals,
    ).not.toContainEqual(capped(12));
    const forfeit = {
      ...underworld,
      fearRanks: { ...underworld.fearRanks, BoonSkipShrineUpgrade: 1 },
    };
    const eight = twelve.slice(0, 8);
    expect(assessment(forfeit, spec(eight, { godKeys }), next).refusals).toContainEqual(capped(8));
    expect(
      assessment(forfeit, spec(eight.slice(1), { godKeys }), next).refusals,
    ).not.toContainEqual(capped(8));
  });

  it('refuses a trait whose giver is outside the world', () => {
    expect(assessment(underworld, spec(['HeraWeaponBoon']), 'HeraWeaponBoon').refusals).toEqual([
      { kind: 'giverNotInWorld' },
    ]);
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

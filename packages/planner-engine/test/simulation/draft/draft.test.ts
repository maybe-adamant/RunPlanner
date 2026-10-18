import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createInitialRouteLoadout } from '../../../src/authored-project/loadout';
import type { RouteLoadout } from '../../../src/authored-project/model';
import {
  assessDraftBasket,
  draftKeepsakeOptions,
  draftRefusals,
  draftWorldGiverKeys,
  draftWorldOptions,
  type DraftRoute,
  type DraftSpec,
  type DraftWorld,
} from '../../../src/simulation';

function route(
  routeKey: string,
  itineraryBiomeKeys: readonly string[],
  loadout: Partial<RouteLoadout> = {},
): DraftRoute {
  return {
    routeKey,
    itineraryBiomeKeys,
    loadout: { ...createInitialRouteLoadout(catalog, routeKey), ...loadout },
  };
}

const underworld = route('Underworld', ['F', 'G', 'H', 'I']);
const surface = route('Surface', ['N', 'O', 'P', 'Q']);
const dream = route('Dream', ['H', 'F', 'N', 'I']);

const emptyWorld: DraftWorld = { godKeys: [], storyNpcByBiome: {}, fieldNpcsByBiome: {} };

function spec(basketTraitKeys: readonly string[], world: Partial<DraftWorld> = {}): DraftSpec {
  return {
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

function assessment(draftRoute: DraftRoute, draft: DraftSpec, traitKey: string) {
  const result = assessDraftBasket(catalog, draftRoute, draft).traits.find(
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

  it('refuses a god starting keepsake and the FreshFile route', () => {
    expect(draftRefusals(catalog, underworld)).toEqual([]);
    expect(
      draftRefusals(
        catalog,
        route('Underworld', ['F', 'G', 'H', 'I'], { startingKeepsakeKey: 'ForceHeraBoonKeepsake' }),
      ),
    ).toEqual([{ kind: 'godStartingKeepsake', keepsakeKey: 'ForceHeraBoonKeepsake' }]);
    expect(draftRefusals(catalog, route('FreshFile', ['F', 'G', 'H', 'I']))).toEqual([
      { kind: 'freshFileRoute' },
    ]);
  });
});

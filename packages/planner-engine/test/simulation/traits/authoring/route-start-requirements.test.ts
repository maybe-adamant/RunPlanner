import { catalog } from '@run-planner/hades2-catalog';
import { createDefaultRouteLoadout } from '@run-planner/engine/authored-project';
import { prepareRouteStartTraitRequirements } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

const loadout = createDefaultRouteLoadout(catalog);
const underworld = { routeKey: 'Underworld', itineraryBiomeKeys: ['F', 'G', 'H', 'I'] };
const requirements = prepareRouteStartTraitRequirements(catalog, underworld, loadout);

describe('route-start trait requirements', () => {
  it('holds no trait before anything is acquired, so a fresh god offer is all vacant cores', () => {
    expect([...requirements.held.traitKeys]).toEqual([]);
    expect(requirements.held.elementCounts).toEqual({
      Aether: 0,
      Earth: 0,
      Air: 0,
      Fire: 0,
      Water: 0,
    });
    const cores = requirements.coreFirstOfferTraitKeys('Zeus');
    expect(cores).toContain('ZeusWeaponBoon');
    expect(cores?.every((key) => catalog.traits.byKey[key]!.isCoreGodTrait)).toBe(true);
  });

  it('judges held-trait requirements over the route start plus each call’s assumed traits', () => {
    expect(requirements.assess('DoorHealToFullBoon', []).failures).toEqual([
      { code: 'missingPrerequisite', requirementTraitKeys: ['HighHealthOffenseBoon'] },
    ]);
    expect(requirements.assess('DoorHealToFullBoon', ['HighHealthOffenseBoon']).failures).toEqual(
      [],
    );
    // An assumption holds only for its own call.
    expect(requirements.assess('DoorHealToFullBoon', []).failures).toHaveLength(1);
    expect(requirements.assess('CastLobBoon', ['SelfCastBoon']).failures).toEqual([
      {
        code: 'negativePrerequisite',
        requirementTraitKeys: expect.arrayContaining(['SelfCastBoon']),
      },
    ]);
    expect(requirements.assess('CastLobBoon', []).failures).toEqual([]);
  });

  it('judges loadout requirements from the route start', () => {
    const card = catalog.arcanaCards.values.find(
      (candidate) => candidate.traitKey === 'DoorRerollMetaUpgrade',
    )!;
    expect(requirements.assess('NarcissusF', []).failures).toEqual([
      {
        code: 'missingPrerequisite',
        requirementTraitKeys: expect.arrayContaining(['DoorRerollMetaUpgrade']),
      },
    ]);
    const withCard = prepareRouteStartTraitRequirements(catalog, underworld, {
      ...loadout,
      manualArcanaKeys: [card.key],
    });
    expect(withCard.assess('NarcissusF', []).failures).toEqual([]);
  });

  it('leaves requirements the run decides to the caller, once each', () => {
    const sprint = requirements.assess('SprintEchoBoon', []);
    expect(sprint.contextual).toEqual(['offerContext:devotionNoDuo']);
    expect(requirements.assess('ElementalDodgeBoon', []).contextual).toEqual(['elementCount']);
    expect(requirements.assess('ZeusWeaponBoon', [])).toEqual({ failures: [], contextual: [] });
  });
});

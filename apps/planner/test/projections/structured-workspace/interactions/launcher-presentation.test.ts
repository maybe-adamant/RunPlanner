import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  anvilResultLauncherPresentation,
  levelResolutionLauncherPresentation,
  traitOfferLauncherPresentation,
} from '@planner/projections/structured-workspace/interactions/launcher-presentation';

function giver(key: string) {
  const declaration = catalog.traitGivers.byKey[key];
  if (declaration === undefined) throw new Error(`${key} giver is missing`);
  return declaration;
}

describe('launcher presentation', () => {
  it('values trait, Hex and Chaos launchers by their chosen outcome', () => {
    expect(traitOfferLauncherPresentation(catalog, giver('Apollo'), null)).toEqual({
      label: 'Edit Trait · Choose trait',
    });
    expect(
      traitOfferLauncherPresentation(catalog, giver('Apollo'), {
        kind: 'traits',
        giverKey: 'Apollo',
        selectedOptionKey: 'option2',
        options: [
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        ],
      }),
    ).toEqual({ label: 'Edit Trait · Nova Strike', detail: 'Apollo: Nova Strike · Rare' });
    expect(
      traitOfferLauncherPresentation(catalog, giver('Apollo'), {
        kind: 'fallbackGold',
        giverKey: 'Apollo',
      }),
    ).toMatchObject({ label: 'Edit Trait · Fallback Gold' });
    expect(traitOfferLauncherPresentation(catalog, giver('SpellDrop'), null).label).toBe(
      'Edit Hex · Choose Hex',
    );
    expect(traitOfferLauncherPresentation(catalog, giver('Chaos'), null).label).toBe(
      'Edit Chaos · Choose outcome',
    );
    const chaos = traitOfferLauncherPresentation(catalog, giver('Chaos'), {
      kind: 'chaos',
      giverKey: 'Chaos',
      curseOptions: [
        { curseKey: 'ChaosHealthCurse', requirementCount: 3 },
        { curseKey: 'ChaosNoMoneyCurse', requirementCount: 3 },
        { curseKey: 'ChaosDamageCurse', requirementCount: 3 },
      ],
      selectedOptionKey: 'option2',
      selectedCurseValues: {},
      blessingKey: 'ChaosWeaponBlessing',
      rarity: 'Common',
      blessingValues: { damageBonus: 0.2 },
    });
    const curse = catalog.chaos.curses.byKey.ChaosNoMoneyCurse!.label;
    const blessing = catalog.chaos.blessings.byKey.ChaosWeaponBlessing!.label;
    expect(chaos).toEqual({
      label: `Edit Chaos · ${curse} → ${blessing}`,
      detail: `${curse} → ${blessing} · Common`,
    });
  });

  it('values a Pom launcher by its target and levels', () => {
    const random = (targetTraitKey: string | null) => ({ kind: 'random', targetTraitKey }) as const;
    expect(levelResolutionLauncherPresentation(catalog, random(null), 1, false)).toEqual({
      label: 'Edit Pom · Choose target +1',
    });
    expect(
      levelResolutionLauncherPresentation(catalog, random('ApolloWeaponBoon'), 2, false),
    ).toEqual({ label: 'Edit Pom · Nova Strike +2', detail: 'Nova Strike gains 2 levels' });
    expect(levelResolutionLauncherPresentation(catalog, random(null), 1, true).label).toBe(
      'Edit Pom · No eligible traits',
    );
  });

  it('keeps the Anvil launcher unvalued and summarizes its result', () => {
    expect(anvilResultLauncherPresentation(catalog, null)).toEqual({
      label: 'Edit Anvil',
    });
    expect(
      anvilResultLauncherPresentation(catalog, {
        kind: 'anvilOfFates',
        removedTraitKey: null,
        addedTraitKeys: ['ApolloWeaponBoon'],
      } as never),
    ).toEqual({ label: 'Edit Anvil', detail: 'No removal · adds Nova Strike' });
  });
});

import { catalog } from '@run-planner/hades2-catalog';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import {
  assessTraitOption,
  createTraitHistoryState,
  foldTraitOfferEvents,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

const owner = { kind: 'project' } as SemanticAddress;

function historyWith(
  giverKey: string,
  traitKey: string,
  rarity?: TraitOfferEvent['options'][number]['rarity'],
) {
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) throw new Error(`missing giver ${giverKey}`);
  const options = [
    { traitKey: giver.traitKeys[0]! },
    { traitKey: giver.traitKeys[1]! },
    { traitKey: giver.traitKeys[2]! },
  ] as [
    TraitOfferEvent['options'][number],
    TraitOfferEvent['options'][number],
    TraitOfferEvent['options'][number],
  ];
  options[0] = { traitKey, ...(rarity === undefined ? {} : { rarity }) };
  return foldTraitOfferEvents(catalog, [
    {
      owner,
      acquisitionRole: 'test',
      sequence: 1,
      giverKey,
      options: Object.freeze(options),
      selectedOptionKey: 'option1',
      acquisitionPoint: 'test',
    },
  ]);
}

function findingCode(traitKey: string, history: ReturnType<typeof createTraitHistoryState>) {
  return assessTraitOption(catalog, traitKey, history).findings[0]?.code;
}

describe('Boon Growth and Boon Decay target predicates', () => {
  it('rejects Heroic-only histories because no supported next rarity exists', () => {
    const history = historyWith('Demeter', 'DemeterWeaponBoon', 'Heroic');
    expect(findingCode('BoonGrowthBoon', history)).toBe('rarifiableTarget');
    expect(findingCode('BoonDecayBoon', history)).toBe('superchargeableTarget');
  });

  it('rejects Hammer-only histories because Hammers are not ranked god traits', () => {
    const history = historyWith('WeaponUpgrade', 'StaffDoubleAttackTrait');
    expect(findingCode('BoonGrowthBoon', history)).toBe('rarifiableTarget');
    expect(findingCode('BoonDecayBoon', history)).toBe('superchargeableTarget');
  });

  it('rejects a BlockInRunRarify target for Growth and a BlockStacking target for Decay', () => {
    const rarifyBlocked = historyWith('Demeter', 'ElementalDamageCapBoon', 'Rare');
    const stackingBlocked = historyWith('Demeter', 'BoonGrowthBoon', 'Common');
    expect(findingCode('BoonGrowthBoon', rarifyBlocked)).toBe('rarifiableTarget');
    expect(findingCode('BoonDecayBoon', stackingBlocked)).toBe('superchargeableTarget');
  });

  it('accepts ordinary ranked god traits with a concrete next rarity', () => {
    const history = historyWith('Demeter', 'DemeterWeaponBoon', 'Common');
    expect(findingCode('BoonGrowthBoon', history)).toBeUndefined();
    expect(findingCode('BoonDecayBoon', history)).toBeUndefined();
  });
});

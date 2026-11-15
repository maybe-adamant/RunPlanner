import type { NemesisRandomEventAddress } from '../../../../authored-project/addresses';
import type { EquippedTrait } from '../../../../authored-project/traits/state';
import type { Catalog } from '../../../../catalog-schema';
import { isSellableGodTrait } from '../../../commerce/purging-pool';
import type {
  NemesisRandomEventCandidateSupport,
  NemesisRandomEventFamily,
  NemesisRandomEventFamilyRefusal,
} from '../../model';

type HeldTraits = Readonly<Record<string, EquippedTrait>>;

const FAMILIES = Object.freeze([
  'freeItem',
  'goldTrade',
  'damageTrade',
  'traitTrade',
  'damageContest',
] as const satisfies readonly NemesisRandomEventFamily[]);

/**
 * Why her lines of one family are ineligible for the held traits: her damage
 * lines while a declared trait is held, her boon lines without a sellable god
 * trait (`RequiredSellableGodTraits`). Her other families have no run gate.
 */
export function nemesisRandomEventFamilyRefusal(
  catalog: Catalog,
  family: NemesisRandomEventFamily,
  held: HeldTraits,
): NemesisRandomEventFamilyRefusal | undefined {
  const policy = catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent;
  if (policy === undefined) return undefined;
  switch (family) {
    case 'damageTrade': {
      const traitKey = policy.damageTrade.unavailableWhileHeldTraitKeys.find(
        (key) => held[key] !== undefined,
      );
      return traitKey === undefined ? undefined : Object.freeze({ kind: 'heldTrait', traitKey });
    }
    case 'traitTrade':
      return nemesisTraitTradeTraitKeys(catalog, held).length === 0
        ? Object.freeze({ kind: 'noSellableGodTrait' })
        : undefined;
    case 'freeItem':
    case 'goldTrade':
    case 'damageContest':
      return undefined;
  }
}

/**
 * The boons her trade can take (`GenerateSellTraitShop`): every held sellable
 * god trait, narrowed to the Common ones when any is Common.
 */
export function nemesisTraitTradeTraitKeys(catalog: Catalog, held: HeldTraits): readonly string[] {
  const sellable = Object.values(held).filter((trait) => isSellableGodTrait(catalog, trait));
  const common = sellable.filter((trait) => trait.rarity === 'Common');
  return Object.freeze((common.length === 0 ? sellable : common).map((trait) => trait.traitKey));
}

/**
 * Her event's family support from the state she queues it in: the room's entry,
 * where she spawns and draws one eligible family.
 */
export function nemesisRandomEventFamilySupport(
  catalog: Catalog,
  origin: NemesisRandomEventAddress,
  held: HeldTraits,
): NemesisRandomEventCandidateSupport | undefined {
  const policy = catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent;
  if (policy === undefined) return undefined;
  const unavailableFamilies: Partial<
    Record<NemesisRandomEventFamily, NemesisRandomEventFamilyRefusal>
  > = {};
  for (const family of FAMILIES) {
    const refusal = nemesisRandomEventFamilyRefusal(catalog, family, held);
    if (refusal !== undefined) unavailableFamilies[family] = refusal;
  }
  return Object.freeze({
    origin,
    familyKeys: FAMILIES,
    unavailableFamilies: Object.freeze(unavailableFamilies),
    goldTradeResponses: policy.goldTrade.response,
    damageTradeResponses: policy.damageTrade.response,
    traitTradeResponses: policy.traitTrade.response,
    damageContestResults: Object.freeze(['success', 'failure'] as const),
    traitTradeRewardType: policy.traitTrade.fixedResultRewardType,
    damageContestFailureRewardType: policy.damageContest.failureResultRewardType,
  });
}

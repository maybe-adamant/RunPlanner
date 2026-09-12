import {
  createAcquisitionEntryAddress,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  type AcquisitionSiteAddress,
  type AuthoredRewardState,
} from '@run-planner/engine/authored-project';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceExplicitRewardControl,
  type WorkspaceShopSupplementalDescriptor,
  type WorkspaceShopSupplementalPurchaseDescriptor,
} from '../contract';
import {
  rewardControl,
  type WorkspaceDerivedAcquisitionEntry,
  type WorkspaceOccurrenceRewardAssemblyInput,
} from './occurrence-reward-assembly';

interface ShopSupplementalAssemblyContext {
  readonly selectedActionKeys: readonly string[];
  readonly acquisitionSite: AcquisitionSiteAddress;
  readonly input: WorkspaceOccurrenceRewardAssemblyInput;
  readonly offers: readonly { readonly key: string; readonly label: string }[];
  readonly pickupEntries: Readonly<Record<string, AuthoredRewardState | null>>;
  readonly roomGameName: string;
}

function supplementalPurchase(
  context: ShopSupplementalAssemblyContext,
  entryKey: string,
): WorkspaceShopSupplementalPurchaseDescriptor {
  const address = createAcquisitionEntryAddress(context.acquisitionSite, entryKey);
  const reference = Object.freeze({
    kind: 'interactAcquisitionEntry' as const,
    siteKey: context.acquisitionSite.pointKey,
    entryKey,
  });
  return Object.freeze({
    address,
    marker: context.input.markerDestinations.marker(address),
    purchased: context.selectedActionKeys.includes(entryKey),
    reference,
  });
}

function derivedRewardSupplementalOffer(
  family: 'travel' | 'gold',
  capability: WorkspaceDerivedAcquisitionEntry | undefined,
  context: ShopSupplementalAssemblyContext,
): WorkspaceShopSupplementalDescriptor | undefined {
  const gold = family === 'gold';
  const entryKey = gold ? ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY : TRAVEL_DEAL_REFILL_ENTRY_KEY;
  const activeKind = gold ? 'echoDoubleShopReward' : 'travelDealRefill';
  const placeholderKind = gold ? 'echoDoubleShopPlaceholder' : 'travelDealPlaceholder';
  const selected = context.selectedActionKeys.includes(entryKey);

  if (selected && capability?.kind !== activeKind) {
    const purchase = supplementalPurchase(context, entryKey);
    return gold
      ? Object.freeze({
          kind: 'echoDoubleShopInvalid' as const,
          key: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
          label: 'Gold Gold Gold duplicate',
          explanation:
            'This selected duplicate has no active eligible paid source. Clear Purchased here to repair the Shop.',
          purchase,
        })
      : Object.freeze({
          kind: 'travelDealInvalid' as const,
          key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
          label: 'Travel Deal refill',
          explanation:
            'This selected refill has no active triggering purchase. Clear Purchased here to repair the Shop.',
          purchase,
        });
  }
  if (capability === undefined) return undefined;
  if (capability.kind === placeholderKind) {
    return gold
      ? Object.freeze({
          kind: 'echoDoubleShopPlaceholder' as const,
          key: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
          label: 'Gold Gold Gold duplicate',
          explanation: 'Settle the first paid non-Spell Shop purchase before editing Echo Gold.',
        })
      : Object.freeze({
          kind: 'travelDealPlaceholder' as const,
          key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
          label: 'Travel Deal refill',
          explanation: 'Settle the first paid Shop purchase before editing Travel Deal.',
        });
  }
  if (capability.kind !== activeKind || capability.sourceOfferKey === undefined) {
    return undefined;
  }
  if (capability.rewardTypes === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${context.roomGameName} ${gold ? 'Gold duplicate' : 'Travel refill'} has no attested reward domain`,
    );
  }
  const eligibleSourceOfferKeys = capability.eligibleSourceOfferKeys;
  const sourceOfferLabel =
    context.offers.find((offer) => offer.key === capability.sourceOfferKey)?.label ??
    (gold && capability.sourceOfferKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
      ? 'Travel Deal refill'
      : capability.sourceOfferKey);
  const authored = context.pickupEntries[entryKey] ?? capability.fixedReward ?? null;
  const materialized = Object.hasOwn(context.pickupEntries, entryKey);
  const address = createAcquisitionEntryAddress(context.acquisitionSite, entryKey);
  const projectedReward = rewardControl(
    context.input,
    { kind: 'acquisitionEntry' as const, address },
    undefined,
    authored?.offer ?? null,
    authored,
    capability.rewardTypes,
    materialized
      ? undefined
      : Object.freeze({
          site: context.acquisitionSite,
          entryKey,
          sourceOfferKey: capability.sourceOfferKey,
        }),
  ) as WorkspaceExplicitRewardControl;
  const purchase = supplementalPurchase(context, entryKey);

  if (gold) {
    if (eligibleSourceOfferKeys === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${context.roomGameName} Gold duplicate has no attested source domain`,
      );
    }
    return Object.freeze({
      kind: 'echoDoubleShopReward' as const,
      key: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
      label: `Gold Gold Gold duplicate of ${sourceOfferLabel}`,
      sourceOfferKey: capability.sourceOfferKey,
      eligibleSourceOfferKeys,
      materialized,
      purchase,
      rewardControl: projectedReward,
    });
  }
  return Object.freeze({
    kind: 'travelDealRefill' as const,
    key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
    label: `Travel Deal refill after ${sourceOfferLabel}`,
    sourceOfferKey: capability.sourceOfferKey,
    materialized,
    purchase,
    rewardControl: projectedReward,
  });
}

function contractSupplementalOffer(
  capability: WorkspaceDerivedAcquisitionEntry | undefined,
  context: ShopSupplementalAssemblyContext,
): WorkspaceShopSupplementalDescriptor | undefined {
  if (capability === undefined) return undefined;
  const authored = context.pickupEntries[INFERNAL_CONTRACT_ENTRY_KEY];
  if (authored === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${context.roomGameName} contract opportunity has no structural child`,
    );
  }
  if (capability.rewardTypes === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${context.roomGameName} contract opportunity has no attested reward domain`,
    );
  }
  const address = createAcquisitionEntryAddress(
    context.acquisitionSite,
    INFERNAL_CONTRACT_ENTRY_KEY,
  );
  return Object.freeze({
    kind: 'infernalContractReward' as const,
    key: INFERNAL_CONTRACT_ENTRY_KEY,
    label: 'Infernal Contract reward',
    materialized: true,
    purchase: supplementalPurchase(context, INFERNAL_CONTRACT_ENTRY_KEY),
    rewardControl: rewardControl(
      context.input,
      { kind: 'acquisitionEntry' as const, address },
      undefined,
      authored?.offer ?? null,
      authored,
      capability.rewardTypes,
    ) as WorkspaceExplicitRewardControl,
  });
}

export function assembleShopSupplementalOffers({
  contractCapability,
  context,
  goldCapability,
  travelCapability,
}: {
  readonly contractCapability: WorkspaceDerivedAcquisitionEntry | undefined;
  readonly context: ShopSupplementalAssemblyContext;
  readonly goldCapability: WorkspaceDerivedAcquisitionEntry | undefined;
  readonly travelCapability: WorkspaceDerivedAcquisitionEntry | undefined;
}): readonly WorkspaceShopSupplementalDescriptor[] {
  return Object.freeze(
    [
      derivedRewardSupplementalOffer('travel', travelCapability, context),
      derivedRewardSupplementalOffer('gold', goldCapability, context),
      contractSupplementalOffer(contractCapability, context),
    ].filter((offer): offer is WorkspaceShopSupplementalDescriptor => offer !== undefined),
  );
}

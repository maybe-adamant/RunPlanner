import {
  createAcquisitionEntryAddress,
  createShopOfferAddress,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  type AcquisitionSiteAddress,
  type AuthoredRewardState,
} from '@run-planner/engine/authored-project';
import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspaceExplicitRewardControl } from '../contracts/rewards';
import type {
  WorkspaceShopSupplementalDescriptor,
  WorkspaceShopSupplementalPurchaseDescriptor,
} from '../contracts/commerce';
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
  const travelInventory =
    !gold && context.input.occurrence.state.kind === 'shop'
      ? context.input.occurrence.state.shop?.travelDealRefill
      : undefined;
  const authored = gold
    ? (context.pickupEntries[entryKey] ?? capability.fixedReward ?? null)
    : (travelInventory?.reward ?? null);
  const materialized = gold
    ? Object.hasOwn(context.pickupEntries, entryKey)
    : travelInventory !== undefined;
  const address = createAcquisitionEntryAddress(context.acquisitionSite, entryKey);
  const projectedReward = rewardControl(
    context.input,
    gold
      ? { kind: 'acquisitionEntry' as const, address }
      : {
          kind: 'shopOffer' as const,
          address: createShopOfferAddress(
            context.input.biome,
            context.input.occurrence.occurrenceId,
            entryKey,
          ),
        },
    undefined,
    authored?.offer ?? null,
    authored,
    capability.rewardTypes,
    materialized || !gold
      ? undefined
      : Object.freeze({
          site: context.acquisitionSite,
          entryKey: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
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
    rewardControl: Object.freeze({
      ...projectedReward,
      shopOption: Object.freeze({
        selectedOptionKey: travelInventory?.optionKey ?? null,
        options: Object.freeze([
          ...new Map(
            context.input.catalog.rewards.shops.byKey[
              context.input.occurrence.state.kind === 'shop'
                ? context.input.occurrence.state.shop!.profileKey
                : ''
            ]!.groups.values.flatMap((group) => group.options.values).map(
              (option) =>
                [
                  option.key,
                  Object.freeze({
                    key: option.key,
                    label: option.label,
                    rewardType: option.rewardType,
                  }),
                ] as const,
            ),
          ).values(),
        ]),
      }),
    }),
  });
}

export function assembleShopSupplementalOffers({
  context,
  goldCapability,
  travelCapability,
}: {
  readonly context: ShopSupplementalAssemblyContext;
  readonly goldCapability: WorkspaceDerivedAcquisitionEntry | undefined;
  readonly travelCapability: WorkspaceDerivedAcquisitionEntry | undefined;
}): readonly WorkspaceShopSupplementalDescriptor[] {
  return Object.freeze(
    [
      derivedRewardSupplementalOffer('travel', travelCapability, context),
      derivedRewardSupplementalOffer('gold', goldCapability, context),
    ].filter((offer): offer is WorkspaceShopSupplementalDescriptor => offer !== undefined),
  );
}

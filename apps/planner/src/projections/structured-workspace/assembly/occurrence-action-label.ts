import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  parseArtificerReplacementEntryKey,
  parseClockedTraitGeneratedPickupEntryKey,
  parseEchoLastRewardPickupEntryKey,
  parseHermesShrineDeliveryEntryKey,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { summarizeRewardOffer } from '@planner/projections/rewards/rewardPicker';
import { workspaceAcquisitionRoleLabel } from './occurrence-reward-assembly';
import type { WorkspaceEncounterPhase, WorkspaceRoomLocal } from '../contracts/locals';
import type { WorkspaceRewardControl } from '../contracts/rewards';

function timelineRewardName(catalog: Catalog, rewardType: string): string {
  switch (rewardType) {
    case 'StackUpgrade':
      return 'Pom';
    case 'StackUpgradeBig':
      return 'Double Pom';
    case 'StackUpgradeTriple':
      return 'Triple Pom';
    default:
      return catalog.rewards.rewardTypes.byKey[rewardType]?.label ?? rewardType;
  }
}

function timelineRewardLabel(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  control?: WorkspaceRewardControl,
): string {
  // Mystery's source is edited alongside the action, not repeated in its heading.
  if (offer.rewardType === 'BlindBoxLoot') {
    return timelineRewardName(catalog, offer.rewardType);
  }
  if (offer.rewardType === 'Boon' || offer.rewardType === 'RandomLoot') {
    const name =
      control?.shopOption?.options.find(
        (option) => option.key === control.shopOption?.selectedOptionKey,
      )?.label ?? timelineRewardName(catalog, offer.rewardType);
    return offer.payload?.kind === 'BoonSource'
      ? `${timelineRewardName(catalog, offer.payload.source)} ${name.toLowerCase()}`
      : name;
  }
  return offer.payload === undefined
    ? timelineRewardName(catalog, offer.rewardType)
    : summarizeRewardOffer(catalog, offer);
}

function wellPurchaseLabel(
  catalog: Catalog,
  occurrence: Pick<import('@run-planner/engine/authored-project').RoomOccurrence, 'stygianWell'>,
  generationKey: import('@run-planner/engine/authored-project').StygianWellGenerationKey,
): string {
  const slotKey = generationKey.startsWith('initial:')
    ? (generationKey.slice(
        'initial:'.length,
      ) as import('@run-planner/engine/authored-project').StygianWellSlotKey)
    : undefined;
  const profile = catalog.rewards.shops.byKey.RoomShop;
  const slotIndex = profile?.slots.values.findIndex((slot) => slot.key === slotKey) ?? -1;
  const subject =
    slotKey === undefined
      ? 'Travel Deal Offer'
      : slotIndex < 0
        ? 'Well Offer'
        : `Slot ${slotIndex + 1} Offer`;
  const itemKey =
    slotKey === undefined
      ? occurrence.stygianWell?.travelDealRefillKey
      : occurrence.stygianWell?.offerKeyBySlot[slotKey];
  const itemLabel =
    itemKey === null || itemKey === undefined
      ? undefined
      : profile?.groups.values
          .flatMap((group) => group.options.values)
          .find((option) => option.key === itemKey)?.label;
  return itemLabel === undefined ? subject : `${subject} · ${itemLabel}`;
}

/** Presentation labels for engine-authored action references. */
export function occurrenceActionLabel(
  catalog: Catalog,
  reference: import('@run-planner/engine/authored-project').RoomActionReference,
  roomLocal: WorkspaceRoomLocal,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  rewardControl: WorkspaceRewardControl | undefined,
  occurrence: Pick<
    import('@run-planner/engine/authored-project').RoomOccurrence,
    'hermesShrine' | 'stygianWell' | 'acquisitionSites'
  >,
  purgingPoolTraitKeyBySlot?: Readonly<Record<'left' | 'middle' | 'right', string | null>>,
): string {
  const actionLabel = (
    subject: string | undefined,
    verb: 'Interact' | 'Purchase' = 'Interact',
    includeOfferSummary = true,
    control = rewardControl,
  ): string => {
    const summary =
      !includeOfferSummary || control?.offer === null || control?.offer === undefined
        ? undefined
        : timelineRewardLabel(catalog, control.offer, control);
    return `${verb} ${
      subject === undefined
        ? (summary ?? 'Reward')
        : summary === undefined || summary === subject
          ? subject
          : `${subject} · ${summary}`
    }`;
  };
  const phase =
    'phaseKey' in reference
      ? encounterPhases.find((candidate) => candidate.address.phaseKey === reference.phaseKey)
      : undefined;
  switch (reference.kind) {
    case 'collectRequiredReward':
      return 'Interact Boss Reward';
    case 'completeFieldsCage':
      return `Interact ${phase?.label ?? reference.phaseKey} encounter`;
    case 'interactIncomingReward': {
      const role = reference.acquisitionRole;
      if (role === 'chosenSource' || role === 'spurnedSource') {
        const payload = rewardControl?.offer?.payload;
        const source = payload?.kind === 'DevotionPair' ? payload[role] : undefined;
        return `Interact ${role === 'chosenSource' ? 'Chosen' : 'Spurned'} boon${
          source === undefined ? '' : ` · ${timelineRewardName(catalog, source)}`
        }`;
      }
      return actionLabel(
        rewardControl?.offer == null ? workspaceAcquisitionRoleLabel(role) : undefined,
      );
    }
    case 'interactLocalReward': {
      const local =
        roomLocal.kind !== 'fields'
          ? undefined
          : [...roomLocal.cages, ...roomLocal.optionalRewards].find(
              (candidate) =>
                candidate.control.owner.address.kind === 'localReward' &&
                candidate.control.owner.address.groupKey === reference.groupKey &&
                candidate.control.owner.address.slotKey === reference.slotKey,
            );
      return actionLabel(local?.label ?? reference.slotKey);
    }
    case 'chooseRewardWheel': {
      const wheel =
        roomLocal.kind === 'ship'
          ? roomLocal.wheels.find((candidate) => candidate.key === reference.wheelKey)
          : undefined;
      return `Interact ${wheel?.label.replace(/ reward$/, ' wheel') ?? `${reference.wheelKey} wheel`}`;
    }
    case 'interactWheelReward': {
      const wheel =
        roomLocal.kind === 'ship'
          ? roomLocal.wheels.find((candidate) => candidate.key === reference.wheelKey)
          : undefined;
      return actionLabel(wheel?.label ?? `${reference.wheelKey} reward`);
    }
    case 'interactShopOffer': {
      const slotIndex =
        roomLocal.kind === 'shop'
          ? roomLocal.offers.findIndex((candidate) => candidate.key === reference.offerKey)
          : -1;
      const offer = roomLocal.kind === 'shop' ? roomLocal.offers[slotIndex] : undefined;
      const contract = reference.offerKey === 'infernalContractReward';
      return actionLabel(
        contract ? 'Contract Item' : slotIndex < 0 ? 'Shop Offer' : `Slot ${slotIndex + 1} Offer`,
        contract ? 'Interact' : 'Purchase',
        true,
        offer?.rewardControl,
      );
    }
    case 'purchaseStygianWellOffer':
      return `Purchase ${wellPurchaseLabel(catalog, occurrence, reference.generationKey)}`;
    case 'sellPurgingPoolTrait': {
      const traitKey = purgingPoolTraitKeyBySlot?.[reference.slotKey];
      return `Sell ${traitKey === null || traitKey === undefined ? `${reference.slotKey} Pool trait` : (catalog.traits.byKey[traitKey]?.label ?? traitKey)}`;
    }
    case 'interactEncounter':
      return `Interact ${phase?.selectedEncounter.label ?? `${reference.phaseKey} encounter`}`;
    case 'interactGorgon':
      return 'Interact Athena';
    case 'interactAcquisitionEntry': {
      const clockedTraitPickup = parseClockedTraitGeneratedPickupEntryKey(reference.entryKey);
      const supplemental =
        roomLocal.kind === 'shop'
          ? roomLocal.supplementalOffers.find((candidate) => candidate.key === reference.entryKey)
          : undefined;
      const shrineDelivery = parseHermesShrineDeliveryEntryKey(reference.entryKey);
      if (reference.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY) {
        return actionLabel(
          'Travel Deal Offer',
          'Purchase',
          true,
          supplemental?.kind === 'travelDealRefill' ? supplemental.rewardControl : rewardControl,
        );
      }
      if (reference.entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY) {
        return actionLabel(supplemental?.label ?? 'Echo duplicate');
      }
      const explicitRewardType =
        rewardControl?.offer?.rewardType ??
        (rewardControl?.kind === 'explicitReward' && rewardControl.rewardTypes.length === 1
          ? rewardControl.rewardTypes[0]
          : undefined);
      const authoredOffer =
        occurrence.acquisitionSites?.[reference.siteKey]?.pickupEntries?.[reference.entryKey]
          ?.offer;
      const explicitRewardLabel =
        authoredOffer !== undefined
          ? timelineRewardLabel(catalog, authoredOffer)
          : explicitRewardType === undefined
            ? undefined
            : timelineRewardName(catalog, explicitRewardType);
      const entryLabel =
        parseArtificerReplacementEntryKey(reference.entryKey) !== undefined
          ? 'Artificer reward'
          : clockedTraitPickup !== undefined
            ? 'Supply Chain Pom Slice'
            : parseEchoLastRewardPickupEntryKey(reference.entryKey) !== undefined
              ? 'Echo reward'
              : rewardControl?.offer != null
                ? undefined
                : (explicitRewardLabel ??
                  (shrineDelivery !== undefined ? 'Hermes delivery' : reference.entryKey));
      return actionLabel(entryLabel, 'Interact', clockedTraitPickup === undefined);
    }
    case 'useFountain':
      return 'Interact Fountain';
    case 'interactKeepsakeRack':
      return 'Interact Keepsake Rack';
  }
}

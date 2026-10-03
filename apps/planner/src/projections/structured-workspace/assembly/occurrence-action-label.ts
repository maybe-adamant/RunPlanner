import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  parseArtificerReplacementEntryKey,
  parseClockedTraitGeneratedPickupEntryKey,
  parseEchoLastRewardPickupEntryKey,
  parseHermesShrineDeliveryEntryKey,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '@run-planner/engine/authored-project';
import {
  isCombatBearingEncounterPhaseKind,
  type Catalog,
} from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { CanonicalAuthoredRoom } from '@run-planner/engine/simulation';
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
        : `Slot ${slotIndex + 1}`;
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
  return itemLabel === undefined ? subject : `${itemLabel} · ${subject}`;
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
  pickupProducers: NonNullable<CanonicalAuthoredRoom['pickupProducers']> = [],
): string {
  const actionLabel = (
    subject: string | undefined,
    verb: 'Collect' | 'Buy' = 'Collect',
    includeOfferSummary = true,
    control = rewardControl,
    fallbackSummary?: string,
  ): string => {
    const summary =
      !includeOfferSummary || control?.offer === null || control?.offer === undefined
        ? fallbackSummary
        : timelineRewardLabel(catalog, control.offer, control);
    const conversion = control?.conversions?.find((entry) => entry.value.kind !== 'normal');
    const action =
      conversion?.value.kind === 'artificer'
        ? 'Use Artificer on'
        : conversion?.value.kind === 'timePiece'
          ? 'Use Time Piece on'
          : verb;
    return `${action} ${
      subject === undefined
        ? (summary ?? 'Reward')
        : summary === undefined || summary === subject
          ? subject
          : `${summary} · ${subject}`
    }`;
  };
  const phase =
    'phaseKey' in reference
      ? encounterPhases.find((candidate) => candidate.address.phaseKey === reference.phaseKey)
      : undefined;
  switch (reference.kind) {
    case 'collectRequiredReward':
      return 'Collect Boss Reward';
    case 'completeFieldsCage':
      return `Clear ${phase?.label ?? reference.phaseKey}`;
    case 'interactIncomingReward': {
      const role = reference.acquisitionRole;
      if (role === 'chosenSource' || role === 'spurnedSource') {
        const payload = rewardControl?.offer?.payload;
        const source = payload?.kind === 'DevotionPair' ? payload[role] : undefined;
        return `Collect ${role === 'chosenSource' ? 'Chosen' : 'Spurned'} boon${
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
      return `Choose ${wheel?.label.replace(/ reward$/, ' wheel') ?? `${reference.wheelKey} wheel`}`;
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
        contract ? 'Contract Item' : slotIndex < 0 ? 'Shop Offer' : `Slot ${slotIndex + 1}`,
        contract ? 'Collect' : 'Buy',
        true,
        offer?.rewardControl,
      );
    }
    case 'purchaseStygianWellOffer':
      return `Buy ${wellPurchaseLabel(catalog, occurrence, reference.generationKey)}`;
    case 'sellPurgingPoolTrait': {
      const traitKey = purgingPoolTraitKeyBySlot?.[reference.slotKey];
      return `Sell ${traitKey === null || traitKey === undefined ? `${reference.slotKey} Pool trait` : (catalog.traits.byKey[traitKey]?.label ?? traitKey)}`;
    }
    case 'interactEncounter': {
      const key =
        phase?.selectedEncounter.nativeEncounterDefinitionKey ?? phase?.selectedEncounter.key;
      const definition = key === undefined ? undefined : catalog.encounterDefinitions.byKey[key];
      if (definition?.npcPresentationKey !== undefined)
        return `Talk to ${definition.npcPresentationKey}`;
      const verb =
        definition === undefined
          ? 'Resolve'
          : isCombatBearingEncounterPhaseKind(definition.kind)
            ? 'Clear'
            : 'Talk to';
      return `${verb} ${phase?.selectedEncounter.label ?? `${reference.phaseKey} encounter`}`;
    }
    case 'interactGorgon':
      return 'Talk to Athena';
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
          'Buy',
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
      const producer = pickupProducers.find(
        (candidate) =>
          candidate.siteKey === reference.siteKey &&
          candidate.pickups.some((pickup) => pickup.key === reference.entryKey),
      );
      const producerLabel =
        producer?.traitKey === undefined
          ? undefined
          : catalog.traits.byKey[producer.traitKey]?.label;
      const entryLabel =
        parseArtificerReplacementEntryKey(reference.entryKey) !== undefined
          ? explicitRewardLabel === undefined
            ? 'Artificer reward'
            : 'Artificer'
          : clockedTraitPickup !== undefined
            ? 'Supply Chain'
            : parseEchoLastRewardPickupEntryKey(reference.entryKey) !== undefined
              ? explicitRewardLabel === undefined
                ? 'Echo reward'
                : 'Echo'
              : shrineDelivery !== undefined
                ? 'Delivery'
                : producerLabel !== undefined
                  ? producerLabel
                  : rewardControl?.offer != null
                    ? undefined
                    : (explicitRewardLabel ?? reference.entryKey);
      return actionLabel(entryLabel, 'Collect', true, rewardControl, explicitRewardLabel);
    }
    case 'useFountain':
      return 'Use Fountain';
    case 'interactKeepsakeRack':
      return 'Change Keepsake';
    case 'interactEris':
      return 'Talk to Eris';
  }
}

/** Concise identity for a retained delivery outside evaluated lifecycle coverage. */
export function generatedPickupPlacementRepairLabel(
  catalog: Catalog,
  reference: import('@run-planner/engine/authored-project').RoomActionReference,
  source: import('@run-planner/engine/authored-project').RoomOccurrence | undefined,
  host: import('@run-planner/engine/authored-project').RoomOccurrence | undefined,
): string {
  if (reference.kind !== 'interactAcquisitionEntry') return 'Delivery';
  const parsed = parseHermesShrineDeliveryEntryKey(reference.entryKey);
  const generation = parsed?.generationKey;
  const slot =
    generation === 'travelDealRefill'
      ? 'Travel Deal'
      : generation === 'initial:first'
        ? 'Slot 1'
        : generation === 'initial:secondLeft'
          ? 'Slot 2'
          : 'Slot 3';
  const offer =
    host?.acquisitionSites?.[reference.siteKey]?.pickupEntries?.[reference.entryKey]?.offer;
  const roomLabel =
    source === undefined
      ? 'Hermes Shrine'
      : (catalog.rooms.byKey[source.gameName]?.label ?? source.gameName);
  return `${roomLabel} · ${slot}${offer === undefined ? '' : ` · ${timelineRewardLabel(catalog, offer)}`}`;
}

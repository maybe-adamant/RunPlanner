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
import {
  INITIAL_ROLL_KEY,
  parseStygianWellGenerationKey,
  purgingPoolRerolls,
  stygianWellGenerationItemKey,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { CanonicalAuthoredRoom } from '@run-planner/engine/simulation';
import { summarizeRewardOffer } from '@planner/projections/rewards/rewardOfferSummary';
import { featureRollCatalog, featureRollNumber } from './feature-roll-assembly';
import { workspaceAcquisitionRoleLabel } from './occurrence-reward-assembly';
import type { WorkspaceEncounterPhase, WorkspaceRoomLocal } from '../contracts/locals';
import type { WorkspaceRewardControl } from '../contracts/rewards';

/** Names a door or cage reroll target as the room's doors do. */
export type WorkspaceDoorRerollTargetLabel = (
  target: Exclude<
    import('@run-planner/engine/authored-project').RerollTarget,
    { readonly kind: 'wheelOffer' }
  >,
) => string;

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
  occurrence: Pick<import('@run-planner/engine/authored-project').RoomOccurrence, 'stygianWell'> &
    Partial<Pick<import('@run-planner/engine/authored-project').RoomOccurrence, 'roomActions'>>,
  generationKey: import('@run-planner/engine/authored-project').StygianWellGenerationKey,
): string {
  const roll = parseStygianWellGenerationKey(generationKey);
  const slotKey = roll?.slotKey;
  const rollNumber =
    roll === undefined || roll.rollKey === INITIAL_ROLL_KEY
      ? undefined
      : featureRollNumber(occurrence.roomActions?.order ?? [], 'stygianWell', roll.rollKey);
  const profile = catalog.rewards.shops.byKey.RoomShop;
  const slotIndex = profile?.slots.values.findIndex((slot) => slot.key === slotKey) ?? -1;
  const subject =
    slotKey === undefined
      ? 'Travel Deal Offer'
      : slotIndex < 0
        ? 'Well Offer'
        : `Slot ${slotIndex + 1}`;
  const itemKey = stygianWellGenerationItemKey(
    {
      stygianWell: occurrence.stygianWell,
      roomActions: occurrence.roomActions ?? { order: [] },
    },
    generationKey,
  );
  const itemLabel =
    itemKey === null || itemKey === undefined
      ? undefined
      : profile?.groups.values
          .flatMap((group) => group.options.values)
          .find((option) => option.key === itemKey)?.label;
  // A later roll's purchase names its roll rather than its slot.
  if (rollNumber !== undefined) return `${itemLabel ?? subject} · roll ${rollNumber}`;
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
    'hermesShrine' | 'stygianWell' | 'acquisitionSites' | 'infernalContractPedestal'
  > &
    Partial<Pick<import('@run-planner/engine/authored-project').RoomOccurrence, 'roomActions'>>,
  purgingPoolTraitKeyBySlot?: Readonly<Record<'left' | 'middle' | 'right', string | null>>,
  pickupProducers: NonNullable<CanonicalAuthoredRoom['pickupProducers']> = [],
  rerollTargetLabel?: WorkspaceDoorRerollTargetLabel,
): string {
  const actionLabel = (
    subject: string | undefined,
    verb: 'Collect' | 'Buy' = 'Collect',
    includeOfferSummary = true,
    control = rewardControl,
    fallbackSummary?: string,
  ): string => {
    // A forfeited reward is collected as its realized consolation, not as the authored offer;
    // a rerolled one as the reward its rerolls left.
    const collected = control?.rerolledOffer ?? control?.offer;
    const summary =
      !includeOfferSummary || collected === null || collected === undefined
        ? fallbackSummary
        : control?.realizedAcquisition === undefined
          ? timelineRewardLabel(catalog, collected, control)
          : timelineRewardName(catalog, control.realizedAcquisition.rewardType);
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
      return actionLabel(
        slotIndex < 0 ? 'Shop Offer' : `Slot ${slotIndex + 1}`,
        'Buy',
        true,
        offer?.rewardControl,
      );
    }
    case 'interactInfernalContractPedestal': {
      // The item names the action; its Mystery source is edited on the row.
      const item = occurrence.infernalContractPedestal?.reward?.offer;
      return actionLabel(
        'Champion Item',
        'Collect',
        false,
        rewardControl,
        item === undefined ? undefined : timelineRewardLabel(catalog, item),
      );
    }
    case 'purchaseStygianWellOffer':
      return `Buy ${wellPurchaseLabel(catalog, occurrence, reference.generationKey)}`;
    case 'purchaseHermesShrineOffer': {
      const slot =
        reference.generationKey === 'travelDealRefill'
          ? 'Travel Deal Offer'
          : reference.generationKey === 'initial:first'
            ? 'Slot 1'
            : reference.generationKey === 'initial:secondLeft'
              ? 'Slot 2'
              : 'Slot 3';
      const offer =
        reference.generationKey === 'travelDealRefill'
          ? occurrence.hermesShrine?.travelDealRefill?.offer
          : occurrence.hermesShrine?.offerBySlot[
              reference.generationKey.slice(
                'initial:'.length,
              ) as import('@run-planner/engine/authored-project').HermesShrineSlotKey
            ];
      return `Buy ${
        offer === null || offer === undefined
          ? slot
          : `${timelineRewardName(catalog, offer.rewardType)} · ${slot}`
      }`;
    }
    case 'rerollStygianWell':
    case 'rerollPurgingPool': {
      const feature = reference.kind === 'rerollStygianWell' ? 'stygianWell' : 'purgingPool';
      const rollNumber = featureRollNumber(
        occurrence.roomActions?.order ?? [],
        feature,
        reference.rerollId,
      );
      const subject = feature === 'stygianWell' ? 'Reroll Well' : 'Reroll Pool';
      return rollNumber === undefined ? subject : `${subject} · roll ${rollNumber}`;
    }
    case 'sellPurgingPoolTrait': {
      // A rerolled list's trait is the one pinned on its reroll.
      const traitKey =
        reference.rollKey === undefined
          ? purgingPoolTraitKeyBySlot?.[reference.slotKey]
          : purgingPoolRerolls(occurrence.roomActions?.order ?? []).find(
              (action) => action.rerollId === reference.rollKey,
            )?.traitKeyBySlot[reference.slotKey];
      const traitLabel =
        traitKey === null || traitKey === undefined
          ? undefined
          : (catalog.traits.byKey[traitKey]?.label ?? traitKey);
      if (reference.rollKey === undefined)
        return `Sell ${traitLabel ?? `${reference.slotKey} Pool trait`}`;
      const rollNumber = featureRollNumber(
        occurrence.roomActions?.order ?? [],
        'purgingPool',
        reference.rollKey,
      );
      return `Sell ${traitLabel ?? featureRollCatalog(catalog, 'purgingPool').slotLabel(reference.slotKey)}${rollNumber === undefined ? '' : ` · roll ${rollNumber}`}`;
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
      return 'Keepsake Rack';
    case 'interactEris':
      return 'Talk to Eris';
    case 'reroll': {
      const target = reference.target;
      const subject =
        target.kind === 'wheelOffer'
          ? roomLocal.kind === 'ship'
            ? roomLocal.wheels
                .find((wheel) => wheel.key === target.wheelKey)
                ?.offers.find((offer) => offer.key === target.offerKey)?.label
            : undefined
          : rerollTargetLabel?.(target);
      const reward = timelineRewardLabel(catalog, reference.reward);
      return subject === undefined ? `Reroll → ${reward}` : `Reroll ${subject} → ${reward}`;
    }
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

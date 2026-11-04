import { challengeSwitchKindLabel, observedChallengeSwitchKind } from './challenge-switch-assembly';
import {
  hermesShrineInitialSlotKey,
  type AcquisitionEntrySourceFamily,
} from '@run-planner/engine/authored-project';
import {
  isCombatBearingEncounterPhaseKind,
  type Catalog,
} from '@run-planner/engine/catalog-schema';
import {
  purgingPoolRerolls,
  stygianWellGenerationItemKey,
  stygianWellGenerationSlot,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { encounterNpcKey } from '@planner/projections/encounterPickerProjection';
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
    if (offer.payload?.kind !== 'BoonSource') return name;
    // "Boosted Hera"; a plain boon is named by its god alone.
    const quality = name.replace(/\s*Boon$/i, '');
    const god = timelineRewardName(catalog, offer.payload.source);
    return quality === '' ? god : `${quality} ${god}`;
  }
  return offer.payload === undefined
    ? timelineRewardName(catalog, offer.rewardType)
    : summarizeRewardOffer(catalog, offer);
}

/** Whether a boon offer is a quality variant (Boosted), shown as a marker on its icon. */
function boonQualityMarked(offer: ResolvedRewardOffer, control?: WorkspaceRewardControl): boolean {
  if (offer.payload?.kind !== 'BoonSource') return false;
  const name = control?.shopOption?.options.find(
    (option) => option.key === control.shopOption?.selectedOptionKey,
  )?.label;
  return name !== undefined && name.replace(/\s*Boon$/i, '') !== '';
}

function wellPurchaseLabel(
  catalog: Catalog,
  occurrence: Pick<import('@run-planner/engine/authored-project').RoomOccurrence, 'stygianWell'> &
    Partial<Pick<import('@run-planner/engine/authored-project').RoomOccurrence, 'roomActions'>>,
  generationKey: import('@run-planner/engine/authored-project').StygianWellGenerationKey,
): {
  readonly name: string;
  readonly suffix?: string;
  readonly slot?: number;
  readonly rewardType?: string;
  readonly itemKey?: string;
} {
  const stocked = stygianWellGenerationSlot(
    { roomActions: occurrence.roomActions ?? { order: [] } },
    generationKey,
  );
  const slotKey = stocked?.slotKey;
  const rollNumber = stocked?.rollNumber === 1 ? undefined : stocked?.rollNumber;
  const profile = catalog.rewards.shops.byKey.RoomShop;
  const slotIndex = profile?.slots.values.findIndex((slot) => slot.key === slotKey) ?? -1;
  const subject = slotKey === undefined ? 'Travel Deal Offer' : 'Well Offer';
  const itemKey = stygianWellGenerationItemKey(
    {
      stygianWell: occurrence.stygianWell,
      roomActions: occurrence.roomActions ?? { order: [] },
    },
    generationKey,
  );
  const itemOption =
    itemKey === null || itemKey === undefined
      ? undefined
      : profile?.groups.values
          .flatMap((group) => group.options.values)
          .find((option) => option.key === itemKey);
  const itemLabel = itemOption?.label;
  // The bought item names the row by its reward's icon.
  const reward =
    itemOption === undefined ? {} : { rewardType: itemOption.rewardType, itemKey: itemOption.key };
  const slot = slotIndex < 0 ? {} : { slot: slotIndex + 1 };
  if (rollNumber !== undefined)
    return { name: itemLabel ?? subject, suffix: `roll ${rollNumber}`, ...slot, ...reward };
  return slotKey === undefined
    ? {
        name: itemLabel ?? subject,
        ...(itemLabel === undefined ? {} : { suffix: subject }),
        ...reward,
      }
    : { name: itemLabel ?? subject, ...slot, ...reward };
}

/** A row label in parts: the verb a Mystery source picker follows, the name it replaces, and the slot badge. */
export interface OccurrenceActionLabelParts {
  readonly label: string;
  readonly verb?: string;
  readonly name?: string;
  /** Where in the room the action happens (Cage 1, Optional 2, roll 2), shown as a tag. */
  readonly suffix?: string;
  /** What produced the pickup, told on hover and focus rather than in the label. */
  readonly origin?: string;
  /** The reward the name stands for, which the row can show as an icon. */
  readonly reward?: {
    readonly offer: ResolvedRewardOffer;
    readonly boosted: boolean;
    /** A shop item's own key, whose artwork can differ from its reward type's. */
    readonly itemKey?: string;
  };
  /** The NPC a Talk row names, by NPC key; the row can show the NPC's portrait for the name. */
  readonly npcKey?: string;
  /** The inventory slot the action buys from, shown as a badge rather than in the label. */
  readonly slot?: number;
  /** A Travel Deal refill purchase, marked on its icon; `shownLabel` omits the offer name. */
  readonly travelDeal?: true;
  readonly shownLabel?: string;
}

const TRAVEL_DEAL_OFFER = 'Travel Deal Offer';

function labelParts(
  verb: string | undefined,
  name: string,
  suffix?: string,
  slot?: number,
  origin?: string,
): OccurrenceActionLabelParts {
  const head = `${verb === undefined ? '' : `${verb} `}${name}`;
  // A Travel Deal purchase shows the Travel Deal mark instead of naming its offer.
  const travelDeal = suffix === TRAVEL_DEAL_OFFER;
  return Object.freeze({
    label: `${head}${suffix === undefined ? '' : ` · ${suffix}`}`,
    ...(verb === undefined ? {} : { verb }),
    name,
    ...(suffix === undefined || travelDeal ? {} : { suffix }),
    ...(slot === undefined ? {} : { slot }),
    ...(origin === undefined ? {} : { origin }),
    ...(travelDeal ? { travelDeal: true as const, shownLabel: head } : {}),
  });
}

function talkTo(npcKey: string): OccurrenceActionLabelParts {
  return Object.freeze({ ...labelParts('Talk to', npcKey), npcKey });
}

function withReward(
  parts: OccurrenceActionLabelParts,
  offer: ResolvedRewardOffer,
  boosted: boolean,
  itemKey?: string,
): OccurrenceActionLabelParts {
  return Object.freeze({
    ...parts,
    reward: Object.freeze({ offer, boosted, ...(itemKey === undefined ? {} : { itemKey }) }),
  });
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
    Partial<
      Pick<
        import('@run-planner/engine/authored-project').RoomOccurrence,
        'roomActions' | 'challengeSwitch'
      >
    >,
  purgingPoolTraitKeyBySlot?: Readonly<Record<'left' | 'middle' | 'right', string | null>>,
  /** What created a generated pickup, as the engine publishes it. */
  sourceFamily?: AcquisitionEntrySourceFamily,
  rerollTargetLabel?: WorkspaceDoorRerollTargetLabel,
): string {
  return occurrenceActionLabelParts(
    catalog,
    reference,
    roomLocal,
    encounterPhases,
    rewardControl,
    occurrence,
    purgingPoolTraitKeyBySlot,
    sourceFamily,
    rerollTargetLabel,
  ).label;
}

/** The label of an engine-authored action reference with its verb, name and slot. */
export function occurrenceActionLabelParts(
  catalog: Catalog,
  reference: import('@run-planner/engine/authored-project').RoomActionReference,
  roomLocal: WorkspaceRoomLocal,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  rewardControl: WorkspaceRewardControl | undefined,
  occurrence: Pick<
    import('@run-planner/engine/authored-project').RoomOccurrence,
    'hermesShrine' | 'stygianWell' | 'acquisitionSites' | 'infernalContractPedestal'
  > &
    Partial<
      Pick<
        import('@run-planner/engine/authored-project').RoomOccurrence,
        'roomActions' | 'challengeSwitch'
      >
    >,
  purgingPoolTraitKeyBySlot?: Readonly<Record<'left' | 'middle' | 'right', string | null>>,
  /** What created a generated pickup, as the engine publishes it. */
  sourceFamily?: AcquisitionEntrySourceFamily,
  rerollTargetLabel?: WorkspaceDoorRerollTargetLabel,
): OccurrenceActionLabelParts {
  const plain = (label: string): OccurrenceActionLabelParts => Object.freeze({ label });
  const actionLabel = (
    subject: string | undefined,
    verb: 'Collect' | 'Buy' = 'Collect',
    includeOfferSummary = true,
    control = rewardControl,
    fallbackSummary?: string,
    slot?: number,
    /** Told instead of the subject once the reward itself names the row. */
    origin?: string,
  ): OccurrenceActionLabelParts => {
    // A forfeited reward is collected as its realized consolation, not as the authored offer;
    // a rerolled one as the reward its rerolls left.
    const collected = control?.rerolledOffer ?? control?.offer;
    const summary =
      !includeOfferSummary || collected === null || collected === undefined
        ? fallbackSummary
        : control?.realizedAcquisition === undefined
          ? timelineRewardLabel(catalog, collected, control)
          : timelineRewardName(catalog, control.realizedAcquisition.rewardType);
    // The verb stays the plain action; a Goldify or Transform choice is the row's verb control.
    const action = verb;
    const parts =
      subject === undefined
        ? labelParts(action, summary ?? 'Reward', undefined, slot)
        : summary === undefined || summary === subject
          ? labelParts(action, subject, undefined, slot)
          : origin === undefined
            ? labelParts(action, summary, subject, slot)
            : labelParts(action, summary, undefined, slot, origin);
    const shown =
      !includeOfferSummary || collected === null || collected === undefined
        ? undefined
        : control?.realizedAcquisition === undefined
          ? collected
          : Object.freeze({ rewardType: control.realizedAcquisition.rewardType });
    return shown === undefined || summary === undefined || parts.name !== summary
      ? parts
      : withReward(parts, shown, boonQualityMarked(shown, control));
  };
  const phase =
    'phaseKey' in reference
      ? encounterPhases.find((candidate) => candidate.address.phaseKey === reference.phaseKey)
      : undefined;
  switch (reference.kind) {
    case 'collectRequiredReward':
      return plain('Collect Boss Reward');
    case 'completeFieldsCage':
      return plain(`Clear ${phase?.label ?? reference.phaseKey}`);
    case 'interactIncomingReward': {
      const role = reference.acquisitionRole;
      if (role === 'chosenSource' || role === 'spurnedSource') {
        const payload = rewardControl?.offer?.payload;
        const source = payload?.kind === 'DevotionPair' ? payload[role] : undefined;
        return plain(
          `Collect ${role === 'chosenSource' ? 'Chosen' : 'Spurned'} boon${
            source === undefined ? '' : ` · ${timelineRewardName(catalog, source)}`
          }`,
        );
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
      return plain(
        `Choose ${wheel?.label.replace(/ reward$/, ' wheel') ?? `${reference.wheelKey} wheel`}`,
      );
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
        undefined,
        'Buy',
        true,
        offer?.rewardControl,
        'Shop Offer',
        slotIndex < 0 ? undefined : slotIndex + 1,
      );
    }
    case 'interactInfernalContractPedestal': {
      // The item names the action; its Mystery source is edited on the row.
      const item = occurrence.infernalContractPedestal?.reward?.offer;
      // The row's icon names the Pedestal; the item is its reward.
      const parts = actionLabel(
        undefined,
        'Collect',
        false,
        rewardControl,
        item === undefined ? 'Pedestal item' : timelineRewardLabel(catalog, item),
      );
      return item === undefined ? parts : withReward(parts, item, false);
    }
    case 'purchaseStygianWellOffer': {
      const well = wellPurchaseLabel(catalog, occurrence, reference.generationKey);
      const parts = labelParts('Buy', well.name, well.suffix, well.slot);
      return well.rewardType === undefined
        ? parts
        : withReward(parts, Object.freeze({ rewardType: well.rewardType }), false, well.itemKey);
    }
    case 'purchaseHermesShrineOffer': {
      const slotKey = hermesShrineInitialSlotKey(reference.generationKey);
      const slot =
        slotKey === undefined
          ? undefined
          : slotKey === 'first'
            ? 1
            : slotKey === 'secondLeft'
              ? 2
              : 3;
      const offer =
        slotKey === undefined
          ? occurrence.hermesShrine?.travelDealRefill?.offer
          : occurrence.hermesShrine?.offerBySlot[slotKey];
      // A rushed item is delivered in the Shrine room.
      const verb = reference.rushed ? 'Rush' : 'Buy';
      const item =
        offer === null || offer === undefined
          ? undefined
          : timelineRewardName(catalog, offer.rewardType);
      const shrineParts =
        slot === undefined
          ? labelParts(
              verb,
              item ?? 'Travel Deal Offer',
              item === undefined ? undefined : 'Travel Deal Offer',
            )
          : labelParts(verb, item ?? 'Shrine Offer', undefined, slot);
      return offer === null || offer === undefined
        ? shrineParts
        : withReward(shrineParts, offer, false);
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
      return plain(rollNumber === undefined ? subject : `${subject} · roll ${rollNumber}`);
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
        return plain(`Sell ${traitLabel ?? `${reference.slotKey} Pool trait`}`);
      const rollNumber = featureRollNumber(
        occurrence.roomActions?.order ?? [],
        'purgingPool',
        reference.rollKey,
      );
      return plain(
        `Sell ${traitLabel ?? featureRollCatalog(catalog, 'purgingPool').slotLabel(reference.slotKey)}${rollNumber === undefined ? '' : ` · roll ${rollNumber}`}`,
      );
    }
    case 'interactEncounter': {
      const key =
        phase?.selectedEncounter.nativeEncounterDefinitionKey ?? phase?.selectedEncounter.key;
      const definition = key === undefined ? undefined : catalog.encounterDefinitions.byKey[key];
      const npcKey = key === undefined ? undefined : encounterNpcKey(catalog, key);
      if (npcKey !== undefined) return talkTo(npcKey);
      const verb =
        definition === undefined
          ? 'Resolve'
          : isCombatBearingEncounterPhaseKind(definition.kind)
            ? 'Clear'
            : 'Talk to';
      return plain(
        `${verb} ${phase?.selectedEncounter.label ?? `${reference.phaseKey} encounter`}`,
      );
    }
    case 'interactGorgon':
      return talkTo('Athena');
    case 'interactAcquisitionEntry': {
      const supplemental =
        roomLocal.kind === 'shop'
          ? roomLocal.supplementalOffers.find((candidate) => candidate.key === reference.entryKey)
          : undefined;
      if (sourceFamily?.kind === 'shopTravelDealRefill') {
        return actionLabel(
          'Travel Deal Offer',
          'Buy',
          true,
          supplemental?.kind === 'travelDealRefill' ? supplemental.rewardControl : rewardControl,
        );
      }
      // Echo's duplicate of a Shop purchase is named by the Shop's own supplemental offer.
      if (
        sourceFamily?.kind === 'echo' &&
        sourceFamily.effect === 'doubleShop' &&
        supplemental !== undefined
      ) {
        return actionLabel(supplemental.label);
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
      const source = sourceFamilyPresentation(catalog, sourceFamily);
      const entryLabel =
        source !== undefined
          ? explicitRewardLabel === undefined
            ? source.unresolvedName
            : source.name
          : rewardControl?.offer != null
            ? undefined
            : // A persisted entry key is never shown; an unnamed pickup reads plainly.
              (explicitRewardLabel ?? 'Pickup');
      return actionLabel(
        entryLabel,
        'Collect',
        true,
        rewardControl,
        explicitRewardLabel,
        undefined,
        source?.origin,
      );
    }
    case 'useFountain':
      return plain('Use Fountain');
    case 'interactKeepsakeRack':
      return plain('Keepsake Rack');
    case 'interactEris':
      return talkTo('Eris');
    case 'interactChallengeSwitch': {
      const kind = observedChallengeSwitchKind(catalog, occurrence);
      return plain(kind === undefined ? 'Use switch' : `Use ${challengeSwitchKindLabel(kind)}`);
    }
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
      return plain(subject === undefined ? `Reroll → ${reward}` : `Reroll ${subject} → ${reward}`);
    }
  }
}

/** The Add area entry an optional action is offered under: a room object or a source family. */
export interface OccurrenceActionAddGroup {
  readonly key: string;
  readonly label: string;
  readonly object?: 'worldShop' | 'hermesShrine';
}

const addGroup = (
  key: string,
  label: string,
  object?: OccurrenceActionAddGroup['object'],
): OccurrenceActionAddGroup =>
  Object.freeze({ key, label, ...(object === undefined ? {} : { object }) });

/** How a pickup's source family names its row, tells its origin and groups it in the Add area. */
function sourceFamilyPresentation(
  catalog: Catalog,
  family: AcquisitionEntrySourceFamily | undefined,
):
  | {
      readonly name: string;
      readonly unresolvedName: string;
      readonly origin: string;
      readonly group: OccurrenceActionAddGroup;
    }
  | undefined {
  if (family === undefined) return undefined;
  const source = (
    name: string,
    origin: string,
    group: OccurrenceActionAddGroup,
    unresolvedName = `${name} reward`,
  ) => Object.freeze({ name, unresolvedName, origin, group });
  switch (family.kind) {
    case 'trait': {
      const label = catalog.traits.byKey[family.traitKey]?.label ?? family.traitKey;
      return source(
        label,
        `Created by ${label}`,
        addGroup(`trait:${family.traitKey}`, label),
        label,
      );
    }
    case 'echo':
      return source('Echo', 'Created by Echo', addGroup('echo', 'Echo'));
    case 'artificer':
      return source('Artificer', 'Created by the Artificer', addGroup('artificer', 'Artificer'));
    case 'seaStar':
      return source('Sea Star', 'Duplicated by Sea Star', addGroup('seaStar', 'Sea Star'));
    case 'nemesisEvent':
      return source('Nemesis', 'From a Nemesis event', addGroup('nemesis', 'Nemesis'));
    case 'erisGift':
      return source('Eris', 'A gift from Eris', addGroup('eris', 'Eris'));
    case 'hermesShrineDelivery':
      return source(
        'Delivery',
        'Delivered from the Hermes Shrine',
        addGroup('object:hermesShrine', 'Hermes Shrine', 'hermesShrine'),
        'Delivery',
      );
    case 'challengeSwitch':
      return source(
        'Switch reward',
        'Claimed from the challenge switch',
        addGroup('challengeSwitch', 'Challenge Switch'),
      );
    case 'shopTravelDealRefill':
      return source(
        'Travel Deal Offer',
        'Restocked by Travel Deal',
        addGroup('object:worldShop', 'World Shop', 'worldShop'),
        'Travel Deal Offer',
      );
  }
}

/** Groups an optional action by what produced it, for the room's Add area. */
export function occurrenceActionAddGroup(
  catalog: Catalog,
  reference: import('@run-planner/engine/authored-project').RoomActionReference,
  roomLocal: WorkspaceRoomLocal,
  sourceFamily?: AcquisitionEntrySourceFamily,
): OccurrenceActionAddGroup {
  // Fields optional rewards group by the room's own local product.
  if (
    reference.kind === 'interactLocalReward' &&
    roomLocal.kind === 'fields' &&
    roomLocal.optionalRewards.some(
      (candidate) =>
        candidate.control.owner.address.kind === 'localReward' &&
        candidate.control.owner.address.slotKey === reference.slotKey,
    )
  )
    return addGroup('optionalRewards', 'Optional rewards');
  return sourceFamilyPresentation(catalog, sourceFamily)?.group ?? addGroup('other', 'Actions');
}

/** Concise identity for a retained delivery outside evaluated lifecycle coverage. */
export function generatedPickupPlacementRepairLabel(
  catalog: Catalog,
  reference: import('@run-planner/engine/authored-project').RoomActionReference,
  source: import('@run-planner/engine/authored-project').GeneratedPickupSource,
  sourceRoom: import('@run-planner/engine/authored-project').RoomOccurrence | undefined,
  host: import('@run-planner/engine/authored-project').RoomOccurrence | undefined,
): string {
  if (reference.kind !== 'interactAcquisitionEntry' || source.kind !== 'hermesShrineDelivery')
    return 'Delivery';
  const slot = (() => {
    switch (hermesShrineInitialSlotKey(source.generationKey)) {
      case undefined:
        return 'Travel Deal';
      case 'first':
        return 'Slot 1';
      case 'secondLeft':
        return 'Slot 2';
      case 'secondRight':
        return 'Slot 3';
    }
  })();
  const offer =
    host?.acquisitionSites?.[reference.siteKey]?.pickupEntries?.[reference.entryKey]?.offer;
  const roomLabel =
    sourceRoom === undefined
      ? 'Hermes Shrine'
      : (catalog.rooms.byKey[sourceRoom.gameName]?.label ?? sourceRoom.gameName);
  return `${roomLabel} · ${slot}${offer === undefined ? '' : ` · ${timelineRewardLabel(catalog, offer)}`}`;
}

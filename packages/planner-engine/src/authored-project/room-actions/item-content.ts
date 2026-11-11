import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelOfferAddress,
  semanticAddressKey,
  type BiomeAddress,
  type OccurrenceAddress,
} from '../addresses';
import type {
  AuthoredBiomePlan,
  BiomeTopology,
  OccurrenceId,
  ProjectDocument,
  RoomActionContent,
  RoomActionReference,
  RoomOccurrence,
} from '../model';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import { biomeRerolledOwners, FIELDS_CAGE_GROUP_KEY, type OwnerRerolls } from '../rerolls';
import {
  purgingPoolRollTraitKey,
  purgingPoolSaleRollKey,
  stygianWellGenerationItemKey,
} from '../feature-rolls';
import { offerFor } from '../hermes-shrine-delivery';
import {
  authoredShopOffer,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../shop';
import { CHALLENGE_SWITCH_SITE_KEY } from '../acquisition/challenge-switch';
import {
  parseEchoLastRewardPickupEntryKey,
  parseNemesisGeneratedPickupSiteKey,
} from '../acquisition/pickup-producers';

/** A row acting on an item: its persisted reference may carry that item's content. */
export type ContentRoomActionReference = Extract<
  RoomActionReference,
  { readonly content?: RoomActionContent }
>;

const CONTENT_KINDS: ReadonlySet<RoomActionReference['kind']> = new Set([
  'interactIncomingReward',
  'interactLocalReward',
  'interactWheelReward',
  'interactShopOffer',
  'interactInfernalContractPedestal',
  'purchaseStygianWellOffer',
  'purchaseHermesShrineOffer',
  'rushHermesShrineOffer',
  'sellPurgingPoolTrait',
  'interactAcquisitionEntry',
]);

/** Whether rows of this kind act on an item whose content they record. */
export function roomActionCarriesContent(
  reference: RoomActionReference,
): reference is ContentRoomActionReference {
  return CONTENT_KINDS.has(reference.kind);
}

/** A reward's identity: its type and the gods its payload names. */
export function rewardOfferToken(offer: ResolvedRewardOffer): readonly string[] {
  const payload = offer.payload;
  if (payload === undefined) return [offer.rewardType];
  return payload.kind === 'BoonSource'
    ? [offer.rewardType, payload.source]
    : [offer.rewardType, payload.chosenSource, payload.spurnedSource];
}

/** The structural facts outside the occurrence its rows' items read. */
export interface RoomActionContentSource {
  readonly biome: BiomeAddress;
  /** Every rerolled reward owner of the biome, with its presses in order. */
  readonly rerolledOwners: ReadonlyMap<string, OwnerRerolls>;
  /** The route's first room, whose incoming reward is the route's starting reward. */
  readonly routeStart?: {
    readonly occurrenceId: OccurrenceId;
    readonly offer: ResolvedRewardOffer | null;
  };
}

const rerolledOwnersByTopology = new WeakMap<object, ReadonlyMap<string, OwnerRerolls>>();

/** The content source of one biome topology. */
export function roomActionContentSource(
  biome: BiomeAddress,
  topology: Pick<BiomeTopology, 'decisions' | 'occurrences'>,
  routeStart?: RoomActionContentSource['routeStart'],
): RoomActionContentSource {
  let rerolledOwners = rerolledOwnersByTopology.get(topology);
  if (rerolledOwners === undefined) {
    rerolledOwners = biomeRerolledOwners(biome, topology);
    rerolledOwnersByTopology.set(topology, rerolledOwners);
  }
  return Object.freeze({
    biome,
    rerolledOwners,
    ...(routeStart === undefined ? {} : { routeStart }),
  });
}

/** The content source of one authored biome plan, or none without a topology. */
export function biomePlanContentSource(
  document: ProjectDocument,
  plan: AuthoredBiomePlan,
): RoomActionContentSource | undefined {
  const topology = plan.topology;
  if (topology === null || topology === undefined) return undefined;
  const route = document.route;
  const routeStart =
    route.itineraryBiomeKeys[0] === plan.biomeKey && route.biomes[0]?.biomeKey === plan.biomeKey
      ? { occurrenceId: topology.startOccurrenceId, offer: route.loadout.startingReward }
      : undefined;
  return roomActionContentSource(
    createBiomeAddress(route.routeKey, plan.biomeKey),
    topology,
    routeStart,
  );
}

/** A redrawable reward's content: the press that drew it (`native` or its reroll id) and the reward. */
function pressedContent(
  source: RoomActionContentSource,
  owner: Parameters<typeof semanticAddressKey>[0],
  native: ResolvedRewardOffer | null | undefined,
): RoomActionContent | null {
  const last = source.rerolledOwners.get(semanticAddressKey(owner))?.rerolls.at(-1);
  if (last !== undefined) return [last.rerollId, ...rewardOfferToken(last.reward)];
  return native === null || native === undefined ? null : ['native', ...rewardOfferToken(native)];
}

function incomingReward(
  source: RoomActionContentSource,
  occurrence: RoomOccurrence,
): ResolvedRewardOffer | null | undefined {
  if (source.routeStart?.occurrenceId === occurrence.occurrenceId) return source.routeStart.offer;
  const state = occurrence.state;
  switch (state.kind) {
    case 'counted':
    case 'fixed':
    case 'anomaly':
    case 'ephyraCombat':
    case 'freeReward':
      return state.reward?.offer;
    default:
      return undefined;
  }
}

function offerContent(
  optionKey: string | null | undefined,
  offer: ResolvedRewardOffer | null | undefined,
): RoomActionContent | null {
  return optionKey === null || optionKey === undefined || offer === null || offer === undefined
    ? null
    : [optionKey, ...rewardOfferToken(offer)];
}

function entryContent(
  occurrence: RoomOccurrence,
  reference: Extract<RoomActionReference, { readonly kind: 'interactAcquisitionEntry' }>,
): RoomActionContent | null {
  const { siteKey, entryKey } = reference;
  if (siteKey === 'roomExit') {
    if (entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY && occurrence.state.kind === 'shop') {
      const refill = authoredShopOffer(occurrence, entryKey);
      return offerContent(refill?.optionKey, refill?.reward?.offer);
    }
    // Echo's replays copy history, so only their stored seed could be checked.
    if (
      entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY ||
      parseEchoLastRewardPickupEntryKey(entryKey) !== undefined
    )
      return null;
  }
  if (siteKey === CHALLENGE_SWITCH_SITE_KEY) {
    const variantKey = occurrence.challengeSwitch?.variantKey;
    return variantKey === undefined ? null : [variantKey];
  }
  const payload = occurrence.acquisitionSites?.[siteKey]?.pickupEntries?.[entryKey];
  if (payload === null || payload === undefined) return null;
  const nemesisPhase = parseNemesisGeneratedPickupSiteKey(siteKey);
  if (nemesisPhase !== undefined) {
    // Each event kind offers its own set, so her result is that kind's item.
    const outcome = occurrence.encounters.nemesisRandomEventByPhase?.[nemesisPhase];
    return outcome === null || outcome === undefined
      ? null
      : [outcome.kind, ...rewardOfferToken(payload.offer)];
  }
  return [...rewardOfferToken(payload.offer)];
}

/**
 * The content of the item a row acts on, as the occurrence holds it now: null
 * when the item is not observed yet, the row's kind acts on no item, or the
 * item is gone (which the row's context answers, not its content).
 */
export function roomActionItemContent(
  source: RoomActionContentSource,
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
): RoomActionContent | null {
  const content = (() => {
    switch (reference.kind) {
      case 'interactIncomingReward':
        return pressedContent(
          source,
          createIncomingRewardAddress(source.biome, occurrence.occurrenceId),
          incomingReward(source, occurrence),
        );
      case 'interactLocalReward': {
        if (occurrence.state.kind !== 'fieldsCombat') return null;
        if (reference.groupKey === FIELDS_CAGE_GROUP_KEY)
          return pressedContent(
            source,
            createLocalRewardAddress(
              source.biome,
              occurrence.occurrenceId,
              reference.groupKey,
              reference.slotKey,
            ),
            occurrence.state.cages[reference.slotKey]?.offer,
          );
        if (reference.groupKey === 'optionalRewards') {
          const offer = occurrence.state.optionalRewards[reference.slotKey]?.offer;
          return offer === undefined ? null : [...rewardOfferToken(offer)];
        }
        return null;
      }
      case 'interactWheelReward': {
        const wheel =
          occurrence.state.kind === 'shipCombat'
            ? occurrence.state.wheels[reference.wheelKey]
            : undefined;
        const offerKey =
          wheel === undefined ? undefined : Object.keys(wheel.offers)[wheel.pickedOfferIndex - 1];
        if (wheel === undefined || offerKey === undefined) return null;
        const pressed = pressedContent(
          source,
          createRewardWheelOfferAddress(
            source.biome,
            occurrence.occurrenceId,
            reference.wheelKey,
            offerKey,
          ),
          wheel.offers[offerKey]?.offer,
        );
        return pressed === null ? null : [offerKey, ...pressed];
      }
      case 'interactShopOffer': {
        const offer = authoredShopOffer(occurrence, reference.offerKey);
        return offerContent(offer?.optionKey, offer?.reward?.offer);
      }
      case 'interactInfernalContractPedestal':
        return offerContent(
          occurrence.infernalContractPedestal?.optionKey,
          occurrence.infernalContractPedestal?.reward?.offer,
        );
      case 'purchaseStygianWellOffer': {
        const offerKey = stygianWellGenerationItemKey(occurrence, reference.generationKey);
        return offerKey === null || offerKey === undefined ? null : [offerKey];
      }
      case 'purchaseHermesShrineOffer':
      case 'rushHermesShrineOffer': {
        const offer = offerFor(occurrence.hermesShrine, reference.generationKey);
        return offer === null || offer === undefined ? null : [offer.rewardType];
      }
      case 'sellPurgingPoolTrait': {
        const traitKey = purgingPoolRollTraitKey(
          occurrence,
          purgingPoolSaleRollKey(reference),
          reference.slotKey,
        );
        return traitKey === null || traitKey === undefined ? null : [traitKey];
      }
      case 'interactAcquisitionEntry':
        return entryContent(occurrence, reference);
      default:
        return null;
    }
  })();
  return content === null ? null : Object.freeze(content);
}

/** The content a row recorded for its item, if any. */
export function roomActionReferenceContent(
  reference: RoomActionReference,
): RoomActionContent | undefined {
  return roomActionCarriesContent(reference) ? reference.content : undefined;
}

function sameContent(left: RoomActionContent, right: RoomActionContent): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Whether a row still applies to its item: it recorded no content, the item
 * is not observed, or both hold the same content. Otherwise the item was
 * replaced since the row was placed.
 */
export function roomActionContentMatches(
  reference: RoomActionReference,
  itemContent: RoomActionContent | null,
): boolean {
  const content = roomActionReferenceContent(reference);
  return content === undefined || itemContent === null || sameContent(content, itemContent);
}

/** The reference carrying exactly this content; unchanged for a row of no item. */
export function withRoomActionContent(
  reference: RoomActionReference,
  content: RoomActionContent | null,
): RoomActionReference {
  if (!roomActionCarriesContent(reference)) return reference;
  const current = reference.content;
  if (content === null) {
    if (current === undefined) return reference;
    const { content: _content, ...rest } = reference;
    void _content;
    return Object.freeze(rest) as RoomActionReference;
  }
  if (current !== undefined && sameContent(current, content)) return reference;
  return Object.freeze({ ...reference, content: Object.freeze([...content]) });
}

/**
 * The occurrence with every row that recorded no content stamped with its
 * item's, once that item is observed; the same occurrence when none changes.
 */
export function withStampedRoomActionContent(
  source: RoomActionContentSource,
  occurrence: RoomOccurrence,
): RoomOccurrence {
  let changed = false;
  const order = occurrence.roomActions.order.map((reference) => {
    if (!roomActionCarriesContent(reference) || reference.content !== undefined) return reference;
    const content = roomActionItemContent(source, occurrence, reference);
    if (content === null) return reference;
    changed = true;
    return withRoomActionContent(reference, content);
  });
  return changed
    ? Object.freeze({
        ...occurrence,
        roomActions: Object.freeze({ ...occurrence.roomActions, order: Object.freeze(order) }),
      })
    : occurrence;
}

function stampedPlan(document: ProjectDocument, plan: AuthoredBiomePlan): AuthoredBiomePlan {
  const source = biomePlanContentSource(document, plan);
  const topology = plan.topology;
  if (source === undefined || topology === null || topology === undefined) return plan;
  let changed = false;
  const occurrences = topology.occurrences.map((occurrence) => {
    const stamped = withStampedRoomActionContent(source, occurrence);
    if (stamped !== occurrence) changed = true;
    return stamped;
  });
  return changed
    ? Object.freeze({
        ...plan,
        topology: Object.freeze({ ...topology, occurrences: Object.freeze(occurrences) }),
      })
    : plan;
}

/**
 * Stamps the rows an edit lets observe their item: in every biome the edit
 * changed, and the route's first biome when its starting reward changed.
 * Every biome when there is no earlier document.
 */
export function stampRoomActionContent(
  before: ProjectDocument | undefined,
  after: ProjectDocument,
): ProjectDocument {
  const startingRewardChanged =
    before === undefined ||
    before.route.loadout.startingReward !== after.route.loadout.startingReward;
  let changed = false;
  const biomes = after.route.biomes.map((plan, index) => {
    const touched =
      before === undefined ||
      before.route.biomes.find((candidate) => candidate.biomeKey === plan.biomeKey) !== plan ||
      (index === 0 && startingRewardChanged);
    if (!touched) return plan;
    const stamped = stampedPlan(after, plan);
    if (stamped !== plan) changed = true;
    return stamped;
  });
  return changed
    ? Object.freeze({
        ...after,
        route: Object.freeze({ ...after.route, biomes: Object.freeze(biomes) }),
      })
    : after;
}

/** One row whose item was replaced since it was placed. */
export interface ReplacedItemRow {
  readonly owner: OccurrenceAddress;
  readonly reference: RoomActionReference;
}

/** Every row of the plan whose item now holds content other than the row recorded. */
export function roomActionsOnReplacedItems(document: ProjectDocument): readonly ReplacedItemRow[] {
  const rows: ReplacedItemRow[] = [];
  for (const plan of document.route.biomes) {
    const source = biomePlanContentSource(document, plan);
    if (source === undefined) continue;
    for (const occurrence of plan.topology?.occurrences ?? []) {
      for (const reference of occurrence.roomActions.order) {
        if (roomActionReferenceContent(reference) === undefined) continue;
        if (
          roomActionContentMatches(reference, roomActionItemContent(source, occurrence, reference))
        )
          continue;
        rows.push(
          Object.freeze({
            owner: createOccurrenceAddress(source.biome, occurrence.occurrenceId),
            reference,
          }),
        );
      }
    }
  }
  return Object.freeze(rows);
}

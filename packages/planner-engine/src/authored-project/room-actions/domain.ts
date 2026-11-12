import {
  isCombatBearingEncounterPhaseKind,
  type Catalog,
  type RoomDeclaration,
} from '../../catalog-schema';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createAcquisitionRoleAddress,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createIncomingRewardAddress,
  createInfernalContractPedestalAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  semanticAddressKey,
  type BiomeAddress,
  type SemanticAddress,
} from '../addresses';
import type { ResolvedRoutePosition } from '../route-context';
import {
  authoredShopOffer,
  authoredShopOfferFromState,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  echoShopDuplicateSourceEligible,
} from '../shop';
import {
  acquisitionSiteFromStorageKey,
  parseArtificerReplacementEntryKey,
} from '../acquisition/artificer';
import {
  firstInitialRush,
  hermesShrinePurchaseAction,
  hermesShrineRushAction,
  isDeliveryFlushHost,
  parseHermesShrineDeliveryEntryKey,
} from '../hermes-shrine-delivery';
import { authoredAcquisitionSources } from '../acquisition/acquisition-sources';
import {
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  parseSeaStarDuplicateSiteKey,
  seaStarDuplicateUsesFreshObject,
} from '../acquisition/sea-star';
import { TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../shop';
import { INITIAL_ROLL_KEY, parseStygianWellGenerationKey } from '../feature-rolls';
import {
  INFERNAL_CONTRACT_ENTRY_KEY,
  INFERNAL_CONTRACT_PEDESTAL_SITE_KEY,
} from '../infernal-contract-pedestal';
import { rewardSourceResolvesAtAcquisition } from '../acquisition/reward-state';
import type {
  AuthoredRewardState,
  BiomeTopology,
  RoomActionReference,
  RoomOccurrence,
} from '../model';
import {
  encounterEnvelopeSlots,
  encounterAuthoringProfileForKey,
  encounterBindingsBySlot,
  directEncounterDefinitionKeyForSlot,
  encounterSetForBinding,
  selectedEncounterAuthoringProfileKey,
} from '../room-state/encounter-envelope';
import { resolveEntryDeclaration } from '../room-state/entry-resolution';
import type { RewardProducerBinding } from '../../reward-kernel/bindings';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import { activeRoomActionReferences, roomActionKey, roomIncomingRewardOffer } from './state';
import {
  roomActionContentSource,
  roomActionItemContent,
  withRoomActionContent,
} from './item-content';
import { unlockExitAction } from '../locked-exits';
import {
  parseClockedTraitGeneratedPickupEntryKey,
  selectedPickupProducerForEntry,
} from '../acquisition/pickup-producers';
import {
  acquisitionEntrySourceFamily,
  type AcquisitionEntrySourceFamily,
} from '../acquisition/entry-source-family';
import {
  assembleRoomEventGraph,
  fieldsRoom,
  nextWheelsOpen,
  phaseOfWheel,
  roomFightsEnd,
  type RoomActionBounds,
  type RoomEventGraph,
  type RoomEventPoint,
} from './event-graph';
import { roomLifecycleProfileKey } from './lifecycle-profile';

export type RoomActionParticipation = 'required' | 'optional';

export interface RoomActionDependency {
  readonly action: RoomActionReference;
  /** Constrains planner authoring without publishing an execution dependency. */
  readonly authoringOnly?: true;
}

export interface RoomActionContribution {
  readonly reference: RoomActionReference;
  readonly owner: SemanticAddress;
  readonly participation: RoomActionParticipation;
  readonly bounds: RoomActionBounds;
  readonly dependencies: readonly RoomActionDependency[];
  /** What created an acquisition-entry pickup; absent for every other action. */
  readonly sourceFamily?: AcquisitionEntrySourceFamily;
}

export interface RoomActionDomain {
  readonly owner: ReturnType<typeof createOccurrenceAddress>;
  readonly declaration: RoomDeclaration;
  readonly lifecycleProfileKey: string;
  readonly eventGraph: RoomEventGraph;
  readonly activeReferences: readonly RoomActionReference[];
  readonly contributions: readonly RoomActionContribution[];
  /**
   * What created each authored acquisition-entry pickup with no active
   * contribution here, keyed by action key; only sources the engine can name.
   */
  readonly retainedSourceFamilies: ReadonlyMap<string, AcquisitionEntrySourceFamily>;
}

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

function actionOwner(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
): SemanticAddress {
  return createRoomActionAddress(biome, occurrence.occurrenceId, roomActionKey(reference));
}

function artificerSourceActionKey(sourceKey: string, acquisitionRole: string): string {
  return JSON.stringify([sourceKey, acquisitionRole]);
}

function contribution(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
  participation: RoomActionParticipation,
  bounds: RoomActionBounds,
  dependencies: readonly RoomActionDependency[] = [],
  owner: SemanticAddress = actionOwner(biome, occurrence, reference),
): RoomActionContribution {
  return frozen({
    reference,
    owner,
    participation,
    bounds,
    dependencies: frozen([...dependencies]),
  });
}

const ROOM_ENTERED = frozen({ kind: 'roomEntered' as const });
const DOORS_OPENED = frozen({ kind: 'doorsOpened' as const });
const LEAVE = frozen({ kind: 'leave' as const });

function bounds(
  spawn: RoomEventPoint,
  deadline: RoomEventPoint,
  enabler?: RoomEventPoint,
): RoomActionBounds {
  return frozen({ spawn, ...(enabler === undefined ? {} : { enabler }), deadline });
}

/** Usable once the doors open, until the room is left. */
const AFTER_DOORS = bounds(ROOM_ENTERED, LEAVE, DOORS_OPENED);

/**
 * What a fight's end spawns is due as the doors open, or before the fight's
 * end effects when its script waits for the room to be ready
 * (`WaitForNextEncounterReady`).
 */
function spawnedAtEnd(graph: RoomEventGraph, spawn: RoomEventPoint): RoomActionBounds {
  const waits =
    spawn.kind === 'encounterEnd' &&
    graph.phases.some(
      (phase) => phase.phaseKey === spawn.phaseKey && phase.script?.waitReadyBeforeEnd === true,
    );
  return bounds(
    spawn,
    waits ? frozen({ kind: 'endEffects' as const, phaseKey: spawn.phaseKey }) : DOORS_OPENED,
  );
}

/** From the room's last encounter end (room entry without one). */
function afterCombat(graph: RoomEventGraph): RoomActionBounds {
  return spawnedAtEnd(graph, roomFightsEnd(graph));
}

/** Taken in a Fields room, where the player starts each cage's encounter. */
function fieldsBounds(graph: RoomEventGraph, phaseKey: string | undefined): RoomActionBounds {
  return spawnedAtEnd(
    graph,
    phaseKey === undefined ? ROOM_ENTERED : frozen({ kind: 'encounterEnd' as const, phaseKey }),
  );
}

/** Spawned by a phase's end effects; a Ship phase's wait for the next wheel's choice. */
function afterEndEffects(graph: RoomEventGraph, phaseKey: string): RoomActionBounds {
  const next = nextWheelsOpen(graph, phaseKey)?.phaseKey;
  return bounds(
    frozen({ kind: 'endEffects' as const, phaseKey }),
    next === undefined ? DOORS_OPENED : frozen({ kind: 'gate' as const, phaseKey: next }),
  );
}

function wheelPhaseKey(graph: RoomEventGraph, wheelKey: string): string {
  return phaseOfWheel(graph, wheelKey) ?? wheelKey;
}

/** A Ship wheel's choice and what stands with it: after its roll, before its phase's Combat. */
function beforeWheelPhase(graph: RoomEventGraph, wheelKey: string): RoomActionBounds {
  const phaseKey = wheelPhaseKey(graph, wheelKey);
  return bounds(
    frozen({ kind: 'wheelsOpen' as const, wheelKey }),
    frozen({ kind: 'encounterStarted' as const, phaseKey }),
    frozen({ kind: 'gate' as const, phaseKey }),
  );
}

/** A Ship phase's spoils: from its encounter's end, before its end effects. */
function afterWheelPhase(graph: RoomEventGraph, wheelKey: string): RoomActionBounds {
  const phaseKey = wheelPhaseKey(graph, wheelKey);
  return bounds(
    frozen({ kind: 'encounterEnd' as const, phaseKey }),
    frozen({ kind: 'endEffects' as const, phaseKey }),
  );
}

/**
 * A World Shop's items are usable from room entry and never wait for the exit
 * unlock. Where the room opens no outgoing doors (Preboss) they span the room;
 * elsewhere purchases follow outgoing generation.
 */
function shopPurchaseBounds(graph: RoomEventGraph): RoomActionBounds {
  return graph.events.some((event) => event.kind === 'doorsOpened' && event.generatesOutgoing)
    ? AFTER_DOORS
    : afterCombat(graph);
}

/**
 * A gate pickup is taken before the combat its use starts; the reward before
 * combat, before the room's first. Any other reward follows the room's fights.
 */
function incomingRewardBounds(graph: RoomEventGraph, producerPoint: string): RoomActionBounds {
  const gated =
    graph.events.flatMap((event) =>
      event.kind === 'encounterStarted' &&
      event.trigger.kind === 'action' &&
      event.trigger.action.kind === 'interactIncomingReward' &&
      event.trigger.action.producerPoint === producerPoint
        ? [event.phaseKey]
        : [],
    )[0] ?? (producerPoint === 'beforeCombat' ? graph.phases[0]?.phaseKey : undefined);
  return gated === undefined
    ? afterCombat(graph)
    : bounds(
        ROOM_ENTERED,
        frozen({ kind: 'encounterStarted' as const, phaseKey: gated }),
        frozen({ kind: 'gate' as const, phaseKey: gated }),
      );
}

function phaseRewardAttachment(
  catalog: Catalog,
  declaration: RoomDeclaration,
  occurrence: RoomOccurrence,
  phaseKey: string,
) {
  return encounterEnvelopeSlots(catalog, declaration, occurrence.gameName).find(
    (phase) => phase.key === phaseKey,
  )?.rewardAttachment;
}

function travelDealSourceAction(
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
): RoomActionReference | undefined {
  if (
    reference.kind === 'purchaseStygianWellOffer' &&
    reference.generationKey === 'travelDealRefill'
  ) {
    // The room's first purchase, from any roll, is the one Travel Deal restocks.
    return occurrence.roomActions.order.find(
      (candidate) =>
        candidate.kind === 'purchaseStygianWellOffer' &&
        candidate.generationKey !== 'travelDealRefill',
    );
  }
  if (
    reference.kind === 'interactAcquisitionEntry' &&
    reference.siteKey === 'roomExit' &&
    reference.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
  ) {
    return occurrence.roomActions.order.find((candidate) => candidate.kind === 'interactShopOffer');
  }
  return undefined;
}

/**
 * A rush follows its purchase, and a rushed Shrine pickup its rush, since the
 * item spawns as the rush closes the Shrine; the refill purchase follows the
 * first initial rush, the earliest rush that can create it.
 */
function hermesShrinePurchaseDependencies(
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
  sameRoomDelivery: import('../model').HermesShrineGenerationKey | undefined,
): readonly RoomActionDependency[] {
  const order = occurrence.roomActions.order;
  const source =
    sameRoomDelivery !== undefined
      ? hermesShrineRushAction(order, sameRoomDelivery)
      : reference.kind === 'rushHermesShrineOffer'
        ? hermesShrinePurchaseAction(order, reference.generationKey)
        : reference.kind === 'purchaseHermesShrineOffer' &&
            reference.generationKey === 'travelDealRefill'
          ? firstInitialRush(order)
          : undefined;
  if (source === undefined) return [];
  return [
    frozen({
      action: source,
      authoringOnly: true as const,
    }),
  ];
}

/**
 * A purchase or sale from a reroll's roll follows that reroll. The game shows
 * the roll only after the press, so the order constrains authoring; a roll
 * whose reroll is gone has no dependency and keeps its own finding.
 */
function rollDependencies(
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
): readonly RoomActionDependency[] {
  const roll =
    reference.kind === 'purchaseStygianWellOffer'
      ? reference.generationKey === 'travelDealRefill'
        ? undefined
        : {
            kind: 'rerollStygianWell',
            rollKey: parseStygianWellGenerationKey(reference.generationKey)?.rollKey,
          }
      : reference.kind === 'sellPurgingPoolTrait'
        ? { kind: 'rerollPurgingPool', rollKey: reference.rollKey }
        : undefined;
  if (roll?.rollKey === undefined || roll.rollKey === INITIAL_ROLL_KEY) return [];
  const reroll = occurrence.roomActions.order.find(
    (candidate) =>
      candidate.kind === roll.kind &&
      'rerollId' in candidate &&
      candidate.rerollId === roll.rollKey,
  );
  return reroll === undefined ? [] : [frozen({ action: reroll, authoringOnly: true as const })];
}

/**
 * Gold Gold Gold's duplicate spawns with the first purchase it duplicates: the
 * room's first purchase, in order, of an offer it can duplicate.
 */
function echoDuplicateSourceAction(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
): RoomActionReference | undefined {
  const shop = occurrence.state.kind === 'shop' ? occurrence.state.shop : undefined;
  if (
    shop === undefined ||
    reference.kind !== 'interactAcquisitionEntry' ||
    reference.siteKey !== 'roomExit' ||
    reference.entryKey !== ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
  )
    return undefined;
  return occurrence.roomActions.order.find((candidate) => {
    const offerKey =
      candidate.kind === 'interactShopOffer'
        ? candidate.offerKey
        : candidate.kind === 'interactAcquisitionEntry' &&
            candidate.siteKey === 'roomExit' &&
            candidate.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
          ? TRAVEL_DEAL_REFILL_ENTRY_KEY
          : undefined;
    const offer =
      offerKey === undefined
        ? undefined
        : authoredShopOfferFromState(shop, offerKey)?.reward?.offer;
    return offer !== undefined && echoShopDuplicateSourceEligible(catalog, offer);
  });
}

function purchaseSourceDependencies(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
): readonly RoomActionDependency[] {
  const source =
    travelDealSourceAction(occurrence, reference) ??
    echoDuplicateSourceAction(catalog, occurrence, reference);
  return source === undefined ? [] : [frozen({ action: source, authoringOnly: true as const })];
}

function baseContribution(
  catalog: Catalog,
  biome: BiomeAddress,
  routePosition: ResolvedRoutePosition,
  declaration: RoomDeclaration,
  graph: RoomEventGraph,
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
  routeStartIncoming?: AuthoredRewardState,
): RoomActionContribution {
  switch (reference.kind) {
    case 'collectRequiredReward':
    case 'useFountain':
    case 'interactEris':
      return contribution(biome, occurrence, reference, 'required', afterCombat(graph));
    case 'interactKeepsakeRack': {
      // The rack is not a required room object: it neither holds the doors nor waits for them.
      const order = occurrence.roomActions.order;
      const fountainIndex = order.findIndex((candidate) => candidate.kind === 'useFountain');
      const afterDoors =
        fountainIndex >= 0 &&
        order.findIndex((candidate) => candidate.kind === 'interactKeepsakeRack') > fountainIndex;
      return contribution(
        biome,
        occurrence,
        reference,
        'optional',
        afterDoors ? AFTER_DOORS : afterCombat(graph),
      );
    }
    // The switch is usable only once the doors open (`DoUnlockRoomExits`).
    case 'interactChallengeSwitch':
      return contribution(biome, occurrence, reference, 'optional', AFTER_DOORS);
    case 'purchaseStygianWellOffer':
      return contribution(biome, occurrence, reference, 'optional', AFTER_DOORS, [
        ...purchaseSourceDependencies(catalog, occurrence, reference),
        ...rollDependencies(occurrence, reference),
      ]);
    case 'purchaseHermesShrineOffer':
    case 'rushHermesShrineOffer':
      return contribution(
        biome,
        occurrence,
        reference,
        'optional',
        AFTER_DOORS,
        hermesShrinePurchaseDependencies(occurrence, reference, undefined),
      );
    case 'completeFieldsCage':
      return contribution(biome, occurrence, reference, 'required', fieldsBounds(graph, undefined));
    case 'interactIncomingReward':
      return contribution(
        biome,
        occurrence,
        reference,
        'required',
        incomingRewardBounds(graph, reference.producerPoint),
        [],
        createAcquisitionRoleAddress(
          createIncomingRewardAddress(biome, occurrence.occurrenceId),
          reference.acquisitionRole,
        ),
      );
    case 'interactLocalReward': {
      const attachment = encounterEnvelopeSlots(catalog, declaration, occurrence.gameName).find(
        (phase) =>
          phase.rewardAttachment?.kind === 'localReward' &&
          phase.rewardAttachment.groupKey === reference.groupKey &&
          phase.rewardAttachment.slotKey === reference.slotKey,
      );
      const required = reference.groupKey === 'cages';
      return contribution(
        biome,
        occurrence,
        reference,
        required ? 'required' : 'optional',
        fieldsBounds(graph, attachment?.key),
        attachment === undefined
          ? []
          : [
              frozen({
                action: frozen({ kind: 'completeFieldsCage', phaseKey: attachment.key }),
              }),
            ],
        createLocalRewardAddress(
          biome,
          occurrence.occurrenceId,
          reference.groupKey,
          reference.slotKey,
        ),
      );
    }
    case 'chooseRewardWheel':
      return contribution(
        biome,
        occurrence,
        reference,
        'required',
        beforeWheelPhase(graph, reference.wheelKey),
        [
          // Using the wheel ends its rerolls.
          ...occurrence.roomActions.order.flatMap((action) =>
            action.kind === 'reroll' &&
            action.target.kind === 'wheelOffer' &&
            action.target.wheelKey === reference.wheelKey
              ? [frozen({ action })]
              : [],
          ),
        ],
        createRewardWheelAddress(biome, occurrence.occurrenceId, reference.wheelKey),
      );
    case 'reroll': {
      // Door and cage rerolls follow the doors unlocking; a wheel's precede its use.
      // A locked door cannot be rerolled until its fight opens it (`CheckExitPreUnlock`).
      const target = reference.target;
      const locked =
        target.kind !== 'wheelOffer' && (occurrence.lockedExits ?? []).includes(target.exitKey);
      return contribution(
        biome,
        occurrence,
        reference,
        'optional',
        // A wheel rerolls from its roll on; only its use waits on a loose pickup.
        target.kind === 'wheelOffer'
          ? bounds(
              frozen({ kind: 'wheelsOpen' as const, wheelKey: target.wheelKey }),
              frozen({ kind: 'gate' as const, phaseKey: wheelPhaseKey(graph, target.wheelKey) }),
            )
          : AFTER_DOORS,
        locked
          ? [
              frozen({
                action:
                  occurrence.roomActions.order.find(
                    (candidate) =>
                      candidate.kind === 'unlockExit' && candidate.exitKey === target.exitKey,
                  ) ?? unlockExitAction(target.exitKey),
              }),
            ]
          : [],
      );
    }
    // A locked door can be pressed once the doors are open and no required
    // pickup remains (`AttemptUseDoor` checks `CheckRoomExitsReady`).
    case 'unlockExit':
      return contribution(
        biome,
        occurrence,
        reference,
        'optional',
        bounds(ROOM_ENTERED, LEAVE, frozen({ kind: 'exitsReady' as const })),
      );
    case 'interactWheelReward': {
      const wheel =
        occurrence.state.kind === 'shipCombat'
          ? occurrence.state.wheels[reference.wheelKey]
          : undefined;
      const offerKey =
        wheel === undefined ? undefined : Object.keys(wheel.offers)[wheel.pickedOfferIndex - 1];
      return contribution(
        biome,
        occurrence,
        reference,
        'required',
        afterWheelPhase(graph, reference.wheelKey),
        [
          frozen({
            action: frozen({ kind: 'chooseRewardWheel', wheelKey: reference.wheelKey }),
          }),
        ],
        offerKey === undefined
          ? createRewardWheelAddress(biome, occurrence.occurrenceId, reference.wheelKey)
          : createRewardWheelOfferAddress(
              biome,
              occurrence.occurrenceId,
              reference.wheelKey,
              offerKey,
            ),
      );
    }
    case 'interactShopOffer': {
      const reward =
        occurrence.state.kind === 'shop'
          ? authoredShopOffer(occurrence, reference.offerKey)?.reward
          : undefined;
      const owner =
        reward !== null &&
        reward !== undefined &&
        rewardSourceResolvesAtAcquisition(catalog, reward.offer)
          ? createAcquisitionEntryAddress(
              createAcquisitionSiteAddress(
                createOccurrenceAddress(biome, occurrence.occurrenceId),
                'roomExit',
              ),
              reference.offerKey,
            )
          : createShopOfferAddress(biome, occurrence.occurrenceId, reference.offerKey);
      return contribution(
        biome,
        occurrence,
        reference,
        'optional',
        shopPurchaseBounds(graph),
        [],
        owner,
      );
    }
    case 'interactInfernalContractPedestal': {
      const reward = occurrence.infernalContractPedestal?.reward;
      const owner =
        reward !== null &&
        reward !== undefined &&
        rewardSourceResolvesAtAcquisition(catalog, reward.offer)
          ? createAcquisitionEntryAddress(
              createAcquisitionSiteAddress(
                createOccurrenceAddress(biome, occurrence.occurrenceId),
                INFERNAL_CONTRACT_PEDESTAL_SITE_KEY,
              ),
              INFERNAL_CONTRACT_ENTRY_KEY,
            )
          : createInfernalContractPedestalAddress(biome, occurrence.occurrenceId);
      // The pedestal stands from room start, like a Shop item.
      return contribution(
        biome,
        occurrence,
        reference,
        'optional',
        shopPurchaseBounds(graph),
        [],
        owner,
      );
    }
    case 'sellPurgingPoolTrait':
      return contribution(
        biome,
        occurrence,
        reference,
        'optional',
        AFTER_DOORS,
        rollDependencies(occurrence, reference),
      );
    case 'rerollStygianWell':
    case 'rerollPurgingPool':
      return contribution(biome, occurrence, reference, 'optional', AFTER_DOORS);
    case 'interactEncounter':
    case 'interactGorgon': {
      const attachment = phaseRewardAttachment(
        catalog,
        declaration,
        occurrence,
        reference.phaseKey,
      );
      const fields = fieldsRoom(graph);
      const cage =
        fields && attachment?.kind === 'localReward'
          ? frozen({ kind: 'completeFieldsCage' as const, phaseKey: reference.phaseKey })
          : undefined;
      const encounterKey = selectedEncounterAuthoringProfileKey(
        catalog,
        declaration,
        occurrence.encounters,
        reference.phaseKey,
        occurrence.gameName,
      );
      const binding = encounterBindingsBySlot(catalog, declaration, occurrence.gameName).get(
        reference.phaseKey,
      );
      const phaseKind =
        binding?.kind === 'fixed'
          ? catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]?.kind
          : binding?.kind === 'set' && encounterKey !== undefined
            ? encounterAuthoringProfileForKey(
                encounterSetForBinding(catalog, binding, occurrence.gameName),
                encounterKey,
                occurrence.gameName,
              ).kind
            : undefined;
      // A contact waits on its fight's end; one whose phase the room no longer plays
      // spawns at an end that never comes.
      const phaseIsCombatBearing = isCombatBearingEncounterPhaseKind(phaseKind ?? 'nonCombat');
      const unplayed =
        phaseIsCombatBearing &&
        !(fields && attachment === undefined) &&
        !graph.phases.some((phase) => phase.phaseKey === reference.phaseKey);
      const contactBounds = unplayed
        ? bounds(
            frozen({ kind: 'encounterEnd' as const, phaseKey: reference.phaseKey }),
            DOORS_OPENED,
          )
        : attachment?.kind === 'rewardWheel'
          ? afterWheelPhase(graph, attachment.key)
          : fields
            ? fieldsBounds(graph, reference.phaseKey)
            : afterCombat(graph);
      const dependencies: RoomActionDependency[] =
        cage === undefined ? [] : [frozen({ action: cage })];
      const phaseOwner = createEncounterPhaseAddress(
        biome,
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        reference.phaseKey,
      );
      return contribution(
        biome,
        occurrence,
        reference,
        'required',
        contactBounds,
        dependencies,
        reference.kind === 'interactGorgon' ? createGorgonPhaseAddress(phaseOwner) : phaseOwner,
      );
    }
    case 'interactAcquisitionEntry': {
      const clockedTraitPickup = parseClockedTraitGeneratedPickupEntryKey(reference.entryKey);
      const hermesDelivery =
        reference.siteKey === 'hermesShrineDelivery'
          ? parseHermesShrineDeliveryEntryKey(reference.entryKey)
          : undefined;
      const producer = selectedPickupProducerForEntry(
        catalog,
        biome,
        occurrence,
        declaration,
        reference.siteKey,
        reference.entryKey,
        routePosition.ordinal,
        routeStartIncoming,
      );
      const sameRoomShrineDelivery =
        hermesDelivery !== undefined &&
        hermesDelivery.routeKey === biome.routeKey &&
        hermesDelivery.biomeKey === biome.biomeKey &&
        hermesDelivery.sourceOccurrenceId === occurrence.occurrenceId;
      // A countdown delivery spawns as a required object; a rushed item is
      // ordinary loot the player may leave behind. World Shop purchases never gate the exit.
      const required =
        (hermesDelivery !== undefined && !sameRoomShrineDelivery) ||
        (occurrence.state.kind !== 'shop' &&
          (producer?.pickups.some(
            (pickup) => pickup.key === reference.entryKey && pickup.required,
          ) ??
            false));
      const site = acquisitionSiteFromStorageKey(
        createOccurrenceAddress(biome, occurrence.occurrenceId),
        reference.siteKey,
      );
      const finalPrebossHost = isDeliveryFlushHost(
        catalog.rooms.byKey[occurrence.gameName],
        routePosition,
      );
      const sourceFamily = acquisitionEntrySourceFamily(
        catalog,
        reference.siteKey,
        reference.entryKey,
        producer,
      );
      // A fight the player's verb starts (a Fields cage) spawns its due pickups only
      // after that verb's row; like its reward, they are taken any time after it.
      const verbTrigger =
        reference.encounterPhaseKey === undefined ||
        (clockedTraitPickup === undefined &&
          (hermesDelivery === undefined || sameRoomShrineDelivery))
          ? undefined
          : graph.events.find(
              (event) =>
                event.kind === 'encounterBegun' &&
                event.phaseKey === reference.encounterPhaseKey &&
                event.trigger.kind === 'action',
            )?.trigger;
      const action = contribution(
        biome,
        occurrence,
        reference,
        required ? 'required' : 'optional',
        clockedTraitPickup !== undefined && reference.encounterPhaseKey !== undefined
          ? afterEndEffects(graph, reference.encounterPhaseKey)
          : hermesDelivery !== undefined
            ? sameRoomShrineDelivery
              ? AFTER_DOORS
              : reference.encounterPhaseKey === undefined && finalPrebossHost
                ? // A flushed delivery is a required object that gates the exit.
                  afterCombat(graph)
                : afterEndEffects(graph, reference.encounterPhaseKey!)
            : producer?.placement === 'roomExit' ||
                producer?.sourceAction?.kind === 'interactChallengeSwitch' ||
                (producer?.source.kind === 'traitOffer' &&
                  producer.source.owner.kind === 'shopOffer') ||
                reference.siteKey === 'roomExit'
              ? occurrence.state.kind === 'shop'
                ? shopPurchaseBounds(graph)
                : AFTER_DOORS
              : afterCombat(graph),
        [
          ...(verbTrigger?.kind !== 'action' ? [] : [frozen({ action: verbTrigger.action })]),
          ...purchaseSourceDependencies(catalog, occurrence, reference),
          ...hermesShrinePurchaseDependencies(
            occurrence,
            reference,
            sameRoomShrineDelivery && hermesDelivery !== undefined
              ? hermesDelivery.generationKey
              : undefined,
          ),
          ...(producer?.sourceAction === undefined
            ? []
            : [frozen({ action: producer.sourceAction })]),
        ],
        occurrence.state.kind === 'shop' &&
          reference.siteKey === 'roomExit' &&
          reference.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY &&
          occurrence.state.shop?.travelDealRefill?.reward != null &&
          !rewardSourceResolvesAtAcquisition(
            catalog,
            occurrence.state.shop.travelDealRefill.reward.offer,
          )
          ? createShopOfferAddress(biome, occurrence.occurrenceId, reference.entryKey)
          : site === undefined
            ? actionOwner(biome, occurrence, reference)
            : createAcquisitionEntryAddress(site, reference.entryKey),
      );
      return sourceFamily === undefined ? action : frozen({ ...action, sourceFamily });
    }
  }
}

/** Pure authored structural Room Action domain consumed by commands and simulation. */
export function assembleRoomActionDomain(options: {
  readonly catalog: Catalog;
  readonly biome: BiomeAddress;
  /** The biome topology holding the occurrence, with the doors and cages its rerolls name. */
  readonly topology: Pick<BiomeTopology, 'decisions' | 'occurrences'>;
  readonly occurrence: RoomOccurrence;
  readonly routePosition: ResolvedRoutePosition;
  readonly lifecycleProfileKey?: string;
  /** Whether the room runs its reward's producer: its `roomRunsProducer` fact. */
  readonly producer: boolean;
  readonly activeEncounterSlotKeys?: readonly string[];
  readonly activeRewardWheelKeys?: readonly string[];
  /** Evaluated producer disposition from canonical materialization. */
  readonly incomingRewardActive?: boolean;
  readonly incomingRewardOffer?: ResolvedRewardOffer | null;
  readonly incomingRewardBinding?: RewardProducerBinding;
  /** `undefined` means occurrence ownership; `null` is an unset route-start reward. */
  readonly incomingRewardState?: AuthoredRewardState | null;
  readonly shopInventoryActive?: boolean;
  readonly entryActive?: boolean;
}): RoomActionDomain {
  const rawDeclaration = options.catalog.rooms.byKey[options.occurrence.gameName];
  if (rawDeclaration === undefined) throw new Error(`unknown room ${options.occurrence.gameName}`);
  const declaration = resolveEntryDeclaration(rawDeclaration, options.routePosition);
  const lifecycleProfileKey =
    options.lifecycleProfileKey ??
    roomLifecycleProfileKey(declaration, 'ordinary', options.occurrence);
  const producer = options.producer;
  const structuralReferences = activeRoomActionReferences(
    options.catalog,
    options.biome,
    options.topology,
    options.occurrence,
    options.routePosition,
    {
      ...(options.activeEncounterSlotKeys === undefined
        ? {}
        : { activeEncounterSlotKeys: options.activeEncounterSlotKeys }),
      ...(options.activeRewardWheelKeys === undefined
        ? {}
        : { activeRewardWheelKeys: options.activeRewardWheelKeys }),
      ...(options.incomingRewardActive === undefined
        ? (() => {
            const selectedEncounterSuppressesIncoming = encounterEnvelopeSlots(
              options.catalog,
              declaration,
              declaration.gameName,
            ).some((slot) => {
              const selected = directEncounterDefinitionKeyForSlot(
                options.catalog,
                declaration,
                options.occurrence.encounters,
                slot.key,
                declaration.gameName,
              );
              return (
                selected !== undefined &&
                options.catalog.encounterDefinitions.byKey[selected]?.suppressesIncomingReward ===
                  true
              );
            });
            return {
              incomingRewardActive:
                !selectedEncounterSuppressesIncoming &&
                (options.occurrence.state.kind !== 'anomaly' || options.occurrence.state.success),
            };
          })()
        : { incomingRewardActive: options.incomingRewardActive }),
      ...(options.incomingRewardOffer === undefined
        ? {}
        : { incomingRewardOffer: options.incomingRewardOffer }),
      ...(options.incomingRewardBinding === undefined
        ? {}
        : { incomingRewardBinding: options.incomingRewardBinding }),
      ...(options.incomingRewardState === undefined
        ? {}
        : { incomingRewardState: options.incomingRewardState }),
      ...(options.shopInventoryActive === undefined
        ? {}
        : { shopInventoryActive: options.shopInventoryActive }),
      ...(options.entryActive === undefined ? {} : { entryActive: options.entryActive }),
    },
  );
  const rewardType = roomIncomingRewardOffer(options.biome, options.topology, options.occurrence, {
    ...(options.incomingRewardOffer === undefined
      ? {}
      : { incomingRewardOffer: options.incomingRewardOffer }),
    ...(options.incomingRewardState === undefined
      ? {}
      : { incomingRewardState: options.incomingRewardState }),
  })?.rewardType;
  const eventGraph = assembleRoomEventGraph({
    catalog: options.catalog,
    declaration,
    occurrence: options.occurrence,
    lifecycleProfileKey,
    producer,
    ...(rewardType === undefined ? {} : { rewardType }),
    incomingRewardPickups: structuralReferences.filter(
      (reference) => reference.kind === 'interactIncomingReward',
    ),
    ...(options.activeEncounterSlotKeys === undefined
      ? {}
      : { activeEncounterSlotKeys: options.activeEncounterSlotKeys }),
  });
  let actions = structuralReferences.map((reference) =>
    baseContribution(
      options.catalog,
      options.biome,
      options.routePosition,
      declaration,
      eventGraph,
      options.occurrence,
      reference,
      options.incomingRewardState ?? undefined,
    ),
  );
  const sourceRewards = new Map(
    authoredAcquisitionSources(
      options.biome,
      options.occurrence,
      options.incomingRewardState ?? undefined,
    ).map((source) => [semanticAddressKey(source.acquisition.owner), source.reward]),
  );
  const orderedActionKeys = new Set(options.occurrence.roomActions.order.map(roomActionKey));
  // Generated pickup actions inherit the exact lifecycle window of their
  // source acquisition. Iterate through the finite action list so a nested
  // Echo replay inherits its parent source before its own child does.
  for (let round = 0; round < actions.length; round += 1) {
    const sourceActions = new Map<string, RoomActionContribution>();
    const sourceActionsByReference = new Map<string, RoomActionContribution>();
    for (const action of actions) {
      sourceActionsByReference.set(roomActionKey(action.reference), action);
      const sourceOwner =
        action.owner.kind === 'acquisitionRole' ? action.owner.owner : action.owner;
      const acquisitionRole =
        action.owner.kind === 'acquisitionRole' ? action.owner.acquisitionRole : 'self';
      sourceActions.set(
        artificerSourceActionKey(semanticAddressKey(sourceOwner), acquisitionRole),
        action,
      );
    }
    // Some sources deliberately settle through a different row. A rushed
    // Shrine pickup is owned by its virtual acquisition entry but executes in
    // its delivery action, so generated Artificer/Sea Star children inherit
    // that contribution rather than search for a nonexistent source row.
    for (const source of authoredAcquisitionSources(
      options.biome,
      options.occurrence,
      options.incomingRewardState ?? undefined,
    )) {
      if (source.action === undefined) continue;
      const contribution = sourceActionsByReference.get(roomActionKey(source.action));
      if (contribution === undefined) continue;
      sourceActions.set(
        artificerSourceActionKey(
          semanticAddressKey(source.acquisition.owner),
          source.acquisition.acquisitionRole,
        ),
        contribution,
      );
    }
    actions = actions.flatMap((action) => {
      if (action.reference.kind !== 'interactAcquisitionEntry') return [action];
      const parsed = parseArtificerReplacementEntryKey(action.reference.entryKey);
      const seaStar =
        action.reference.entryKey === SEA_STAR_DUPLICATE_ENTRY_KEY
          ? parseSeaStarDuplicateSiteKey(action.reference.siteKey)
          : undefined;
      const producer =
        parsed === undefined && seaStar === undefined
          ? selectedPickupProducerForEntry(
              options.catalog,
              options.biome,
              options.occurrence,
              declaration,
              action.reference.siteKey,
              action.reference.entryKey,
              options.routePosition.ordinal,
              options.incomingRewardState ?? undefined,
            )
          : undefined;
      if (parsed === undefined && seaStar === undefined && producer === undefined) return [action];
      // An encounter's end spawns it; its own contribution already waits for that phase.
      if (producer !== undefined && producer.sourceAction === undefined) return [action];
      const source =
        parsed === undefined && seaStar === undefined
          ? producer?.sourceAction === undefined
            ? undefined
            : sourceActionsByReference.get(roomActionKey(producer.sourceAction))
          : sourceActions.get(
              artificerSourceActionKey(
                (parsed ?? seaStar)!.sourceKey,
                (parsed ?? seaStar)!.acquisitionRole,
              ),
            );
      if (source === undefined || !orderedActionKeys.has(roomActionKey(source.reference)))
        return [];
      if (parsed === undefined && seaStar === undefined && producer?.placement !== 'afterSource')
        return [action];
      if (
        parsed !== undefined &&
        sourceRewards.get(parsed.sourceKey)?.dispositionByAcquisitionRole[parsed.acquisitionRole]
          ?.kind !== 'artificer'
      )
        return [];
      if (
        seaStar !== undefined &&
        sourceRewards.get(seaStar.sourceKey)?.dispositionByAcquisitionRole[seaStar.acquisitionRole]
          ?.kind !== 'normal'
      )
        return [];
      const dependencies = action.dependencies.some(
        (dependency) => roomActionKey(dependency.action) === roomActionKey(source.reference),
      )
        ? action.dependencies
        : frozen([...action.dependencies, frozen({ action: source.reference })]);
      return [
        frozen({
          ...action,
          ...(parsed !== undefined
            ? { participation: 'required' as const }
            : seaStar !== undefined
              ? {
                  participation: seaStarDuplicateUsesFreshObject(
                    options.catalog,
                    sourceRewards.get(seaStar.sourceKey)!,
                    seaStar.acquisitionRole,
                  )
                    ? ('required' as const)
                    : source.participation,
                }
              : {}),
          bounds: source.bounds,
          dependencies,
        }),
      ];
    });
  }
  if (fieldsRoom(eventGraph)) {
    const authoredOrder = new Map(
      options.occurrence.roomActions.order.map((reference, index) => [
        roomActionKey(reference),
        index,
      ]),
    );
    const phaseOrder = new Map(
      encounterEnvelopeSlots(options.catalog, declaration, options.occurrence.gameName).map(
        (phase, index) => [phase.key, index],
      ),
    );
    const contacts = actions.filter(
      (action) =>
        action.reference.kind === 'interactEncounter' || action.reference.kind === 'interactGorgon',
    );
    actions = actions.map((action) => {
      if (action.reference.kind !== 'completeFieldsCage') return action;
      const cageReference = action.reference;
      const ownAuthored = authoredOrder.get(roomActionKey(cageReference));
      const ownDeclared = phaseOrder.get(cageReference.phaseKey) ?? Number.MAX_SAFE_INTEGER;
      const barriers = contacts.filter((contact) => {
        const reference = contact.reference;
        if (reference.kind !== 'interactEncounter' && reference.kind !== 'interactGorgon')
          return false;
        const attachment = phaseRewardAttachment(
          options.catalog,
          declaration,
          options.occurrence,
          reference.phaseKey,
        );
        if (attachment?.kind !== 'localReward') return reference.kind === 'interactGorgon';
        if (reference.phaseKey === cageReference.phaseKey) return false;
        const sourceReference = frozen({
          kind: 'completeFieldsCage' as const,
          phaseKey: reference.phaseKey,
        });
        const sourceAuthored = authoredOrder.get(roomActionKey(sourceReference));
        const sourceDeclared = phaseOrder.get(reference.phaseKey) ?? Number.MAX_SAFE_INTEGER;
        if (ownAuthored !== undefined && sourceAuthored !== undefined)
          return sourceAuthored < ownAuthored;
        return sourceDeclared < ownDeclared;
      });
      return frozen({
        ...action,
        dependencies: frozen([
          ...action.dependencies,
          ...barriers.map((barrier) => frozen({ action: barrier.reference })),
        ]),
      });
    });
  }
  // Nothing holds an optional row, so it may be taken until the room is left, except a
  // wheel's reroll: using the wheel ends its rerolls.
  actions = actions.map((action) =>
    action.participation === 'required' ||
    action.bounds.deadline.kind === 'leave' ||
    (action.reference.kind === 'reroll' && action.reference.target.kind === 'wheelOffer')
      ? action
      : frozen({ ...action, bounds: frozen({ ...action.bounds, deadline: LEAVE }) }),
  );
  // Each action names the content its item holds now, so a placed row is judged against it.
  const contentSource = roomActionContentSource(
    options.catalog,
    options.biome,
    options.topology,
    options.incomingRewardState === undefined
      ? undefined
      : {
          occurrenceId: options.occurrence.occurrenceId,
          offer: options.incomingRewardState?.offer ?? null,
        },
  );
  actions = actions.map((action) => {
    const reference = withRoomActionContent(
      action.reference,
      roomActionItemContent(contentSource, options.occurrence, action.reference),
    );
    return reference === action.reference ? action : frozen({ ...action, reference });
  });
  const contributions = frozen(actions);
  const activeReferences = frozen(actions.map((action) => action.reference));
  const activeKeys = new Set(activeReferences.map(roomActionKey));
  const retainedSourceFamilies = new Map<string, AcquisitionEntrySourceFamily>();
  for (const reference of options.occurrence.roomActions.order) {
    if (reference.kind !== 'interactAcquisitionEntry') continue;
    const key = roomActionKey(reference);
    if (activeKeys.has(key)) continue;
    const sourceFamily = acquisitionEntrySourceFamily(
      options.catalog,
      reference.siteKey,
      reference.entryKey,
      selectedPickupProducerForEntry(
        options.catalog,
        options.biome,
        options.occurrence,
        declaration,
        reference.siteKey,
        reference.entryKey,
        options.routePosition.ordinal,
        options.incomingRewardState ?? undefined,
      ),
    );
    if (sourceFamily !== undefined) retainedSourceFamilies.set(key, sourceFamily);
  }
  return frozen({
    owner: createOccurrenceAddress(options.biome, options.occurrence.occurrenceId),
    declaration,
    lifecycleProfileKey,
    eventGraph,
    activeReferences,
    contributions,
    retainedSourceFamilies,
  });
}

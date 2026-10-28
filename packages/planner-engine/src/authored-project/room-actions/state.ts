import type { AuthoredRewardState, RoomActionReference, RoomActionState } from '../model';
import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { RewardProducerBinding } from '../../reward-kernel/bindings';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type { RoomOccurrence } from '../model';
import {
  encounterEnvelopeSlots,
  directEncounterDefinitionKeyForSlot,
} from '../room-state/encounter-envelope';
import { createOccurrenceAddress, semanticAddressKey } from '../addresses';
import { parseArtificerReplacementEntryKey } from '../acquisition/artificer';
import {
  firstRushedInitialPurchase,
  hermesShrineDeliverySourceAddress,
  hermesShrinePurchaseAction,
  isDeliveryFlushHost,
  isSameRoomDelivery,
  parseHermesShrineDeliveryEntryKey,
  purchaseFor,
} from '../hermes-shrine-delivery';
import { authoredAcquisitionSources } from '../acquisition/acquisition-sources';
import {
  echoLastRewardPickupEntryKeys,
  activeSelectedPickupProducers,
  parseClockedTraitGeneratedPickupEntryKey,
  producerOwnedSiteKey,
} from '../acquisition/pickup-producers';
import { seaStarDuplicateSourceIsActive } from '../acquisition/sea-star';
import { rewardSourceResolvesAtAcquisition } from '../acquisition/reward-state';
import { authoredShopOffer } from '../shop';
import { INFERNAL_CONTRACT_PEDESTAL_SITE_KEY } from '../infernal-contract-pedestal';
import type { ResolvedRoutePosition } from '../route-context';
import { resolveEntryDeclaration } from '../room-state/entry-resolution';
import { routeErisHost } from '../route-profile';
export { roomActionKey } from './key';
import { roomActionKey } from './key';
import type { PurgingPoolSlotKey } from '../model';
import {
  INITIAL_ROLL_KEY,
  PURGING_POOL_SLOT_KEYS,
  STYGIAN_WELL_SLOT_KEYS,
  purgingPoolRerolls,
  stygianWellGenerationKey,
  stygianWellRerolls,
} from '../feature-rolls';

export function createEmptyRoomActionState(): RoomActionState {
  return Object.freeze({ order: Object.freeze([]) });
}

/** Declaration-owned required actions for a newly materialized room occurrence. */
export function createDefaultRoomActionState(room: RoomDeclaration): RoomActionState {
  const hasFountain =
    room.hasRequiredFountain ||
    (room.mode.kind === 'authored' && room.mode.templateKey === 'Fountain');
  return Object.freeze({
    order: Object.freeze([
      ...(room.effectNeutralRequiredReward ? [{ kind: 'collectRequiredReward' as const }] : []),
      ...(hasFountain ? [{ kind: 'useFountain' as const }] : []),
    ]),
  });
}

/** Complete structural action domain for one authored occurrence. */
export function activeRoomActionReferences(
  catalog: Catalog,
  biome: import('../addresses').BiomeAddress,
  occurrence: RoomOccurrence,
  routePosition: ResolvedRoutePosition,
  scope?: {
    readonly activeEncounterSlotKeys?: readonly string[];
    readonly activeRewardWheelKeys?: readonly string[];
    readonly incomingRewardActive?: boolean;
    readonly incomingRewardOffer?: ResolvedRewardOffer | null;
    readonly incomingRewardBinding?: RewardProducerBinding;
    /** `undefined` means occurrence ownership; `null` is an unset route-start reward. */
    readonly incomingRewardState?: AuthoredRewardState | null;
    readonly shopInventoryActive?: boolean;
    /** Whether the occurrence is entered; entry-time features act only then. */
    readonly entryActive?: boolean;
  },
): readonly RoomActionReference[] {
  const rawRoom = catalog.rooms.byKey[occurrence.gameName];
  if (rawRoom === undefined) return Object.freeze([]);
  const room = resolveEntryDeclaration(rawRoom, routePosition);
  const declarationActions = createDefaultRoomActionState(room).order;
  const references: RoomActionReference[] = declarationActions.filter(
    (reference) => reference.kind !== 'useFountain',
  );
  const envelopeSlots = encounterEnvelopeSlots(catalog, room, occurrence.gameName);
  const activeEncounterSlots =
    scope?.activeEncounterSlotKeys !== undefined
      ? new Set(scope.activeEncounterSlotKeys)
      : occurrence.state.kind === 'shipCombat'
        ? new Set(envelopeSlots.slice(0, occurrence.state.encounterCount).map((phase) => phase.key))
        : undefined;
  if (occurrence.state.kind === 'fieldsCombat') {
    for (const phase of envelopeSlots) {
      if (
        phase.rewardAttachment?.kind === 'localReward' &&
        (activeEncounterSlots === undefined || activeEncounterSlots.has(phase.key))
      ) {
        references.push(Object.freeze({ kind: 'completeFieldsCage', phaseKey: phase.key }));
      }
    }
    for (const [slotKey, reward] of Object.entries(occurrence.state.cages)) {
      const phase = envelopeSlots.find(
        (candidate) =>
          candidate.rewardAttachment?.kind === 'localReward' &&
          candidate.rewardAttachment.slotKey === slotKey,
      );
      if (
        reward !== undefined &&
        (activeEncounterSlots === undefined || activeEncounterSlots.has(phase?.key ?? ''))
      )
        references.push(Object.freeze({ kind: 'interactLocalReward', groupKey: 'cages', slotKey }));
    }
    const activeOptionalKeys = new Set(
      room.fieldsOptionalRewards?.slotKeys.slice(0, occurrence.state.optionalRewardCount) ?? [],
    );
    for (const [slotKey, reward] of Object.entries(occurrence.state.optionalRewards)) {
      if (!activeOptionalKeys.has(slotKey)) continue;
      if (reward !== undefined)
        references.push(
          Object.freeze({ kind: 'interactLocalReward', groupKey: 'optionalRewards', slotKey }),
        );
    }
  }
  // A rerolled door's room acquires its rerolled reward; its first draw is inert.
  const stateReward =
    occurrence.state.kind === 'counted' ||
    occurrence.state.kind === 'fixed' ||
    occurrence.state.kind === 'anomaly' ||
    occurrence.state.kind === 'ephyraCombat' ||
    occurrence.state.kind === 'freeReward'
      ? (occurrence.rerolledIncomingReward ?? occurrence.state.reward)
      : undefined;
  const reward =
    scope?.incomingRewardState !== undefined
      ? scope.incomingRewardState
      : (scope?.incomingRewardOffer ?? stateReward);
  if (
    reward !== undefined &&
    reward !== null &&
    (scope?.incomingRewardActive === undefined || scope.incomingRewardActive)
  ) {
    const binding = scope?.incomingRewardBinding ?? room.incomingReward;
    const lifecycleKey = binding.kind === 'none' ? undefined : binding.producerLifecycleKey;
    const offer = 'offer' in reward ? reward.offer : reward;
    const lifecycle =
      lifecycleKey === undefined
        ? undefined
        : catalog.rewards.producerLifecycles.byKey[lifecycleKey]?.rewardTypes.byKey[
            offer.rewardType
          ];
    for (const binding of lifecycle?.acquisitionLifecycle ?? []) {
      references.push(
        Object.freeze({
          kind: 'interactIncomingReward',
          producerPoint: binding.lifecyclePoint,
          acquisitionRole: binding.role,
        }),
      );
    }
  }
  // A Reprieve's authored reward is its room-entry pickup; fountain use follows it by default.
  const fountain = declarationActions.find((reference) => reference.kind === 'useFountain');
  if (fountain !== undefined) references.push(fountain);
  if (occurrence.keepsakeRack !== undefined)
    references.push(Object.freeze({ kind: 'interactKeepsakeRack' }));
  if (occurrence.eris !== undefined && routeErisHost(room, biome.routeKey) !== undefined)
    references.push(Object.freeze({ kind: 'interactEris' }));
  const activeWheels =
    occurrence.state.kind !== 'shipCombat'
      ? new Set<string>()
      : scope?.activeRewardWheelKeys !== undefined
        ? new Set(scope.activeRewardWheelKeys)
        : new Set(occurrence.state.encounterCount === 2 ? ['wheel1'] : ['wheel1', 'wheel2']);
  if (occurrence.state.kind === 'shipCombat') {
    for (const wheelKey of Object.keys(occurrence.state.wheels)) {
      if (!activeWheels.has(wheelKey)) continue;
      references.push(Object.freeze({ kind: 'chooseRewardWheel', wheelKey }));
      references.push(Object.freeze({ kind: 'interactWheelReward', wheelKey }));
    }
  }
  // An authored reroll participates by its presence; a wheel reroll only while its wheel is active.
  for (const reference of occurrence.roomActions.order) {
    if (reference.kind !== 'reroll') continue;
    if (reference.target.kind === 'wheelOffer' && !activeWheels.has(reference.target.wheelKey))
      continue;
    references.push(reference);
  }
  if (occurrence.state.kind === 'shop') {
    if (scope?.shopInventoryActive === undefined || scope.shopInventoryActive) {
      const purchasedKeys = new Set(
        occurrence.roomActions.order.flatMap((reference) =>
          reference.kind === 'interactShopOffer' ? [reference.offerKey] : [],
        ),
      );
      for (const offerKey of Object.keys(occurrence.state.shop?.offers ?? {})) {
        if (!purchasedKeys.has(offerKey)) continue;
        references.push(Object.freeze({ kind: 'interactShopOffer', offerKey }));
      }
      if (occurrence.state.shop?.travelDealRefill !== undefined)
        references.push(
          Object.freeze({
            kind: 'interactAcquisitionEntry',
            siteKey: 'roomExit',
            entryKey: 'travelDealRefill',
          }),
        );
    }
  }
  // The pedestal is entry-time like Shop inventory; a collected item participates.
  if (
    occurrence.infernalContractPedestal !== undefined &&
    (scope?.entryActive === undefined || scope.entryActive) &&
    occurrence.roomActions.order.some(
      (reference) => reference.kind === 'interactInfernalContractPedestal',
    )
  )
    references.push(Object.freeze({ kind: 'interactInfernalContractPedestal' }));
  if (occurrence.purgingPool?.interacted === true) {
    const sales: RoomActionReference[] = [];
    for (const [slotKey, traitKey] of Object.entries(occurrence.purgingPool.traitKeyBySlot)) {
      if (traitKey !== null)
        sales.push(
          Object.freeze({ kind: 'sellPurgingPoolTrait', slotKey: slotKey as PurgingPoolSlotKey }),
        );
    }
    for (const reroll of purgingPoolRerolls(occurrence.roomActions.order)) {
      references.push(reroll);
      for (const slotKey of PURGING_POOL_SLOT_KEYS)
        if (reroll.traitKeyBySlot[slotKey] !== undefined)
          sales.push(
            Object.freeze({ kind: 'sellPurgingPoolTrait', slotKey, rollKey: reroll.rerollId }),
          );
    }
    // A sale from a reroll's list participates by its presence, so one whose
    // roll or pin is gone keeps its finding; the initial list's empty slots
    // are its Overview finding.
    const saleKeys = new Set(sales.map(roomActionKey));
    for (const reference of occurrence.roomActions.order)
      if (
        reference.kind === 'sellPurgingPoolTrait' &&
        reference.rollKey !== undefined &&
        !saleKeys.has(roomActionKey(reference))
      )
        sales.push(reference);
    references.push(...sales);
  }
  if (occurrence.stygianWell?.interacted === true) {
    references.push(...stygianWellRerolls(occurrence.roomActions.order));
    const purchased = occurrence.stygianWell.purchasedGenerationKeys ?? [];
    // Purchase participation and rank survive an invalidating source edit.
    // The active action then reaches the missing source finding and remains
    // directly repairable by restoring this generation's offer.
    for (const generationKey of [
      ...STYGIAN_WELL_SLOT_KEYS.map((slotKey) =>
        stygianWellGenerationKey(INITIAL_ROLL_KEY, slotKey),
      ).filter((key) => purchased.includes(key)),
      ...purchased.filter(
        (key) => key !== 'travelDealRefill' && !key.startsWith(`${INITIAL_ROLL_KEY}:`),
      ),
      ...purchased.filter((key) => key === 'travelDealRefill'),
    ])
      references.push(Object.freeze({ kind: 'purchaseStygianWellOffer', generationKey }));
  }
  if (occurrence.hermesShrine !== undefined) {
    // Each purchased generation has one purchase action; a new one starts unrushed.
    for (const generationKey of [
      'initial:first',
      'initial:secondLeft',
      'initial:secondRight',
      'travelDealRefill',
    ] as const) {
      if (purchaseFor(occurrence.hermesShrine, generationKey) === undefined) continue;
      references.push(
        hermesShrinePurchaseAction(occurrence.roomActions.order, generationKey) ??
          Object.freeze({ kind: 'purchaseHermesShrineOffer', generationKey, rushed: false }),
      );
    }
  }
  for (const phase of envelopeSlots) {
    if (activeEncounterSlots !== undefined && !activeEncounterSlots.has(phase.key)) continue;
    const key = directEncounterDefinitionKeyForSlot(
      catalog,
      room,
      occurrence.encounters,
      phase.key,
      occurrence.gameName,
    );
    const definition = key === undefined ? undefined : catalog.encounterDefinitions.byKey[key];
    if (definition?.traitOfferProducer !== undefined || definition?.requiresInteraction === true)
      references.push(Object.freeze({ kind: 'interactEncounter', phaseKey: phase.key }));
    if (
      occurrence.encounters.gorgonResultByPhase?.[phase.key]?.athenaTriggerConditionMet === true
    ) {
      references.push(Object.freeze({ kind: 'interactGorgon', phaseKey: phase.key }));
    }
  }
  const sourceDispositions = new Map(
    authoredAcquisitionSources(biome, occurrence, scope?.incomingRewardState ?? undefined).map(
      (source) => [semanticAddressKey(source.acquisition.owner), source.reward],
    ),
  );
  const structuralEchoEntries = new Set(
    echoLastRewardPickupEntryKeys(catalog, occurrence.encounters),
  );
  const activePickupEntries = new Set(
    activeSelectedPickupProducers(
      catalog,
      biome,
      occurrence,
      room,
      routePosition.ordinal,
      scope?.incomingRewardState ?? undefined,
    ).flatMap((producer) =>
      producer.pickups.map((pickup) => JSON.stringify([producer.siteKey, pickup.key])),
    ),
  );
  for (const [siteKey, site] of Object.entries(occurrence.acquisitionSites ?? {})) {
    for (const entryKey of Object.keys(site.pickupEntries ?? {})) {
      if (
        occurrence.state.kind === 'shop' &&
        siteKey === 'roomExit' &&
        entryKey === 'travelDealRefill'
      )
        continue;
      // The pedestal's acquisition-resolved source belongs to its one collect action.
      if (siteKey === INFERNAL_CONTRACT_PEDESTAL_SITE_KEY) continue;
      const shopInventoryReward =
        occurrence.state.kind === 'shop' && siteKey === 'roomExit'
          ? authoredShopOffer(occurrence, entryKey)?.reward
          : undefined;
      // A paid acquisition-resolved Shop entry is payload owned by its one
      // purchase action. It is not a second pickup participant.
      if (
        shopInventoryReward !== null &&
        shopInventoryReward !== undefined &&
        rewardSourceResolvesAtAcquisition(catalog, shopInventoryReward.offer)
      )
        continue;
      if (
        structuralEchoEntries.has(entryKey) &&
        !activePickupEntries.has(JSON.stringify([siteKey, entryKey]))
      )
        continue;
      if (
        producerOwnedSiteKey(siteKey) &&
        !activePickupEntries.has(JSON.stringify([siteKey, entryKey]))
      )
        continue;
      if (
        siteKey.startsWith('seaStarDuplicate:') &&
        !seaStarDuplicateSourceIsActive(
          catalog,
          biome,
          occurrence,
          siteKey,
          scope?.incomingRewardState ?? undefined,
        )
      )
        continue;
      const artificer = parseArtificerReplacementEntryKey(entryKey);
      const shrineDelivery =
        siteKey === 'hermesShrineDelivery'
          ? parseHermesShrineDeliveryEntryKey(entryKey)
          : undefined;
      const existingReference = occurrence.roomActions.order.find(
        (
          candidate,
        ): candidate is Extract<RoomActionReference, { kind: 'interactAcquisitionEntry' }> =>
          candidate.kind === 'interactAcquisitionEntry' &&
          roomActionKey(candidate) ===
            roomActionKey({ kind: 'interactAcquisitionEntry', siteKey, entryKey }),
      );
      const reference: Extract<RoomActionReference, { kind: 'interactAcquisitionEntry' }> =
        existingReference ??
        Object.freeze({ kind: 'interactAcquisitionEntry' as const, siteKey, entryKey });
      // Saved clocked payload is not evidence that a drop is still due here.
      // Unplaced drops are exposed by the simulator's exact due capability;
      // ordered stale placements stay addressable so the user can remove them.
      if (
        siteKey === 'roomExit' &&
        parseClockedTraitGeneratedPickupEntryKey(entryKey) !== undefined &&
        existingReference === undefined
      )
        continue;
      if (
        siteKey === 'hermesShrineDelivery' &&
        shrineDelivery === undefined &&
        artificer === undefined
      )
        continue;
      if (shrineDelivery !== undefined) {
        const sourceIsCurrent = isSameRoomDelivery(
          hermesShrineDeliverySourceAddress(shrineDelivery),
          createOccurrenceAddress(biome, occurrence.occurrenceId),
        );
        const flushHost = isDeliveryFlushHost(room, routePosition);
        // A retained cross-occurrence entry is not a timeline action until
        // settlement ranks it at its reached delivery contact; dormant payload
        // alone never re-admits a retracted delivery. The fourth-biome Preboss
        // flush is the sole phase-less cross-occurrence contact and uses
        // post-outgoing.
        if (
          !sourceIsCurrent &&
          (existingReference === undefined ||
            (reference.encounterPhaseKey === undefined && !flushHost))
        )
          continue;
        if (sourceIsCurrent) {
          const order = occurrence.roomActions.order;
          if (hermesShrinePurchaseAction(order, shrineDelivery.generationKey)?.rushed !== true)
            continue;
          if (
            shrineDelivery.generationKey === 'travelDealRefill' &&
            firstRushedInitialPurchase(order) === undefined
          )
            continue;
        }
      }
      if (
        artificer !== undefined &&
        sourceDispositions.get(artificer.sourceKey)?.dispositionByAcquisitionRole[
          artificer.acquisitionRole
        ]?.kind !== 'artificer'
      )
        continue;
      references.push(reference);
    }
  }
  return Object.freeze(references);
}

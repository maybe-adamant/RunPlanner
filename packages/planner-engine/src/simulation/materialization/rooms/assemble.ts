import { resolvedRoomRerollPresses } from '../../../authored-project/rerolls';
import {
  INITIAL_ROLL_KEY,
  STYGIAN_WELL_SLOT_KEYS,
  stygianWellGenerationItemKey,
  stygianWellGenerationKey,
  stygianWellGenerationTwistResultKey,
  stygianWellRerolls,
} from '../../../authored-project/feature-rolls';
import {
  createOccurrenceAddress,
  createPhantomExitAddress,
} from '../../../authored-project/addresses';
import { routeHasKeepsakeRack } from '../../../authored-project/route-profile';
import type { StygianWellGenerationKey } from '../../../authored-project/model';
import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import type { ForcedRewardType } from '../../../authored-project/clockwork-doors';
import type { RewardProducerBinding } from '../../../reward-kernel/bindings';
import {
  activeSelectedPickupProducers,
  echoLastRewardPickupEntryKeys,
  sitesWithNemesisResultPickups,
} from '../../../authored-project/acquisition/pickup-producers';
import { acquisitionSiteFromStorageKey } from '../../../authored-project/acquisition/artificer';
import { seaStarDuplicateSourceIsActive } from '../../../authored-project/acquisition/sea-star';
import { assembleRoomActionDomain } from '../../../authored-project/room-actions/domain';
import { scheduleRequiredRoomActions } from '../../../authored-project/room-actions/defaults';
import { roomActionKey } from '../../../authored-project/room-actions/state';
import {
  roomActionContentMatches,
  roomActionReferenceContent,
} from '../../../authored-project/room-actions/item-content';
import { resolveRequiredRewardDrop } from './required-reward';
import {
  alwaysActiveEncounterSlotKeys,
  resolveMaterializedEncounterPhase,
  materializeEncounterPhases,
} from '../../encounters/resolve';
import { encounterResolutionContext } from '../../encounters/resolve';
import { directEncounterDefinitionKeyForSlot } from '../../../authored-project/room-state/encounter-envelope';
import { composeStartingReward } from '../../../authored-project/room-state/starting-reward';
import {
  extendedWellItemKeys,
  stygianWellGrant,
  stygianWellOfferEffect,
  type StygianWellEffect,
} from '../../commerce/stygian-well';
import { assembleRoomActionRoster, assembleRoomLifecycleTimeline } from '../../room-actions';
import { terminalRoomActionKey } from '../../../authored-project/room-actions/order-assessment';
import type { CanonicalAuthoredRoom } from '../model';
import {
  authoredMaterializer,
  materializeInfernalContractPedestal,
  materializeRouteStartEntry,
  enteredRewardStore,
  type AuthoredRoomMaterializationContext,
  type MaterializedRoomLeaf,
} from './templates';
import { resolveEntryRoom } from '../../../authored-project/room-state/entry-resolution';
import {
  roomLifecycleProfileKey,
  roomRunsProducer,
} from '../../../authored-project/room-actions/lifecycle-profile';

function fail(detail: string): never {
  throw new Error(detail);
}

/**
 * The room's lifecycle, which admits its envelope and the producer its reward
 * runs. The template materializes a reward exactly when the room runs a
 * producer, and a room runs none only as a forced reward's counted room, a
 * room whose binding is none, or a route start without the run-start reward.
 */
function requireLifecycleSelection(
  catalog: Catalog,
  room: RoomDeclaration,
  leaf: MaterializedRoomLeaf,
  lifecycleProfileKey: string,
  producer: {
    readonly runs: boolean;
    readonly binding: RewardProducerBinding;
    readonly forcedRewardType: ForcedRewardType | undefined;
    readonly routeStartWithoutReward: boolean;
  },
): void {
  const profile = catalog.roomLifecycleProfiles.byKey[lifecycleProfileKey];
  if (profile === undefined) {
    fail(`${room.gameName} selected unknown lifecycle ${lifecycleProfileKey}`);
  }
  if (!profile.encounterEnvelopeKeys.includes(room.encounterEnvelopeKey)) {
    fail(
      `${room.gameName} envelope ${room.encounterEnvelopeKey} is incompatible with ${profile.key}`,
    );
  }
  const reward = leaf.incomingReward ?? leaf.unresolvedIncomingReward;
  if (
    reward === undefined &&
    !(producer.forcedRewardType !== undefined && producer.binding.kind === 'countedChoice') &&
    producer.binding.kind !== 'none' &&
    !producer.routeStartWithoutReward
  )
    fail(`${room.gameName} requires a producer`);
  if ((reward !== undefined) !== producer.runs)
    fail(`${room.gameName} materialized a reward that disagrees with its producer`);
  if (reward === undefined) return;
  if (
    profile.producer.kind !== 'required' ||
    !profile.producer.lifecycleProfileKeys.includes(reward.producerLifecycleKey)
  ) {
    fail(
      `${room.gameName} producer ${reward.producerLifecycleKey} is incompatible with ${profile.key}`,
    );
  }
}

export function materializeAuthoredRoom(
  input: AuthoredRoomMaterializationContext,
): CanonicalAuthoredRoom {
  const resolvedEntry = resolveEntryRoom(
    input.catalog,
    input.room,
    input.routePosition,
    input.entry === true,
  );
  const contextualRoom = resolvedEntry.declaration;
  const context = Object.freeze({ ...input, room: contextualRoom });
  if (context.room.mode.kind === 'derived')
    fail(`${context.room.gameName} is not an occurrence room`);
  const anomalyReplacement =
    context.occurrence.anomalyReplacement === undefined
      ? undefined
      : Object.freeze({
          replacedRoomGameName: context.occurrence.anomalyReplacement.replacedRoomGameName,
          success:
            context.occurrence.state.kind === 'anomaly'
              ? context.occurrence.state.success
              : fail(
                  `Anomaly replacement ${context.occurrence.occurrenceId} lacks its authored Anomaly state`,
                ),
        });
  const leaf: MaterializedRoomLeaf =
    context.entry === true
      ? materializeRouteStartEntry(context, resolvedEntry)
      : authoredMaterializer(context.room.mode.templateKey, context.room.gameName)(context);
  let routeStartIncoming:
    import('../../../authored-project/model').AuthoredRewardState | null | undefined;
  if (context.entry === true && resolvedEntry.runStartReward) {
    if (context.loadout === undefined || !('startingReward' in context.loadout))
      fail(`${context.room.gameName} entry requires a complete route loadout`);
    routeStartIncoming =
      composeStartingReward(
        context.loadout.startingReward,
        context.occurrence.startingRewardAcquisition,
      ) ?? undefined;
  }
  // A rerolled door's room acquires its effective reward, so its actions follow that.
  if (leaf.rerolledIncomingAcquisition !== undefined)
    routeStartIncoming = leaf.rerolledIncomingAcquisition;
  const selectedEncounterPhases =
    leaf.encounterPhases ??
    materializeEncounterPhases(
      context.catalog,
      context.room,
      context.occurrence.encounters,
      leaf.activeEncounterSlotKeys ??
        alwaysActiveEncounterSlotKeys(context.catalog, context.room, context.room.gameName),
      context.room.gameName,
      context.configuredRivalsRank === undefined
        ? undefined
        : {
            routePosition: context.routePosition,
            configuredRivalsRank: context.configuredRivalsRank,
          },
    );
  const lifecycleProfileKey = roomLifecycleProfileKey(
    context.room,
    context.lifecycleRole ?? 'ordinary',
    context.occurrence,
  );
  const infernalContractPedestal = materializeInfernalContractPedestal(context);
  const authoredPhantomExit = context.occurrence.phantomExit;
  const phantomExit =
    !context.entered || authoredPhantomExit === undefined
      ? undefined
      : Object.freeze({
          origin: createPhantomExitAddress(context.biome, context.occurrence.occurrenceId),
          placeholderRoomGameName: authoredPhantomExit.placeholderRoomGameName,
          rewardType: authoredPhantomExit.rewardType,
        });
  const runsProducer = roomRunsProducer(
    resolvedEntry,
    context.entry === true,
    context.forcedRewardType,
  );
  requireLifecycleSelection(context.catalog, context.room, leaf, lifecycleProfileKey, {
    runs: runsProducer,
    binding: resolvedEntry.incomingRewardBinding,
    forcedRewardType: context.forcedRewardType,
    routeStartWithoutReward: context.entry === true && !resolvedEntry.runStartReward,
  });
  const pickupProducers = activeSelectedPickupProducers(
    context.catalog,
    context.biome,
    context.occurrence,
    context.room,
    context.routePosition.ordinal,
    routeStartIncoming ?? undefined,
  );
  const activePickupEntries = new Set(
    pickupProducers.flatMap((producer) =>
      producer.pickups.map((pickup) => `${producer.siteKey}\u0000${pickup.key}`),
    ),
  );
  const structuralEchoPickupKeys = new Set(
    echoLastRewardPickupEntryKeys(context.catalog, context.occurrence.encounters),
  );
  const pickupIsActive = (siteKey: string, key: string): boolean =>
    context.occurrence.state.kind === 'shop' ||
    (!structuralEchoPickupKeys.has(key) &&
      !siteKey.startsWith('traitGenerated:') &&
      (!siteKey.startsWith('seaStarDuplicate:') ||
        seaStarDuplicateSourceIsActive(
          context.catalog,
          context.biome,
          context.occurrence,
          siteKey,
          routeStartIncoming ?? undefined,
        ))) ||
    activePickupEntries.has(`${siteKey}\u0000${key}`);
  // Each Nemesis event's site settles the pickup her outcome spawns, not the
  // authored offer it holds (a failed contest spawns Consolation).
  const nemesisResultSites =
    sitesWithNemesisResultPickups(context.catalog, context.occurrence, context.biome.routeKey) ??
    {};
  // Anomaly and the Nemesis event are both evaluated acquisition dispositions:
  // the authored incoming draw remains intact, but its lifecycle producer is
  // disabled while the selected encounter owns the room's required contact.
  const suppressesIncomingReward = selectedEncounterPhases.some((phase) => {
    const definitionKey = directEncounterDefinitionKeyForSlot(
      context.catalog,
      context.room,
      context.occurrence.encounters,
      phase.slotKey,
      context.room.gameName,
    );
    return (
      context.catalog.encounterDefinitions.byKey[definitionKey ?? '']?.suppressesIncomingReward ===
      true
    );
  });
  const incomingReward =
    leaf.incomingReward === undefined || !suppressesIncomingReward
      ? leaf.incomingReward
      : Object.freeze({ ...leaf.incomingReward, acquisitionEnabled: false });
  const entered = enteredRewardStore(context.room, context.batchStoreKey);
  const enteredRewardStoreKey =
    resolvedEntry.enteredRewardStoreKey ??
    (entered.kind === 'store' ? entered.storeKey : undefined);
  const stygianWellOfferEffects =
    context.occurrence.stygianWell === undefined
      ? undefined
      : (() => {
          const effects: Partial<Record<StygianWellGenerationKey, StygianWellEffect>> = {};
          const occurrence = context.occurrence;
          const generations: readonly StygianWellGenerationKey[] = [
            ...STYGIAN_WELL_SLOT_KEYS.map((slotKey) =>
              stygianWellGenerationKey(INITIAL_ROLL_KEY, slotKey),
            ),
            ...stygianWellRerolls(occurrence.roomActions.order).flatMap((reroll) =>
              STYGIAN_WELL_SLOT_KEYS.map((slotKey) =>
                stygianWellGenerationKey(reroll.rerollId, slotKey),
              ),
            ),
            'travelDealRefill',
          ];
          for (const generationKey of generations) {
            const offerKey = stygianWellGenerationItemKey(occurrence, generationKey);
            if (offerKey === undefined || offerKey === null) continue;
            const grant = stygianWellGrant(context.catalog, offerKey);
            const effect = grant === undefined ? undefined : stygianWellOfferEffect(grant);
            const twistResultKey = stygianWellGenerationTwistResultKey(occurrence, generationKey);
            const twistResultGrant =
              effect === 'twist' && twistResultKey !== undefined && twistResultKey !== null
                ? stygianWellGrant(context.catalog, twistResultKey)
                : undefined;
            const twistResultEffect =
              twistResultGrant === undefined ? undefined : stygianWellOfferEffect(twistResultGrant);
            if (effect !== undefined) effects[generationKey] = twistResultEffect ?? effect;
          }
          return Object.freeze(effects);
        })();
  const stygianWellExtendedDirectPurchaseItemKeys =
    context.occurrence.stygianWell === undefined
      ? undefined
      : extendedWellItemKeys(context.catalog);
  const requiredReward = resolveRequiredRewardDrop(
    context.catalog,
    context.room,
    context.routePosition,
  );
  const base = Object.freeze({
    kind: 'authored',
    origin: createOccurrenceAddress(context.biome, context.occurrence.occurrenceId),
    occurrenceId: context.occurrence.occurrenceId,
    gameName: context.room.gameName,
    incomingRewardBinding: resolvedEntry.incomingRewardBinding,
    roomKind: context.room.kind,
    ...(anomalyReplacement === undefined ? {} : { anomalyReplacement }),
    encounters: context.occurrence.encounters,
    encounterEnvelopeKey: context.room.encounterEnvelopeKey,
    encounterPhases: selectedEncounterPhases,
    ...(context.room.unmodeledEncounterKeys === undefined
      ? {}
      : { unmodeledEncounterKeys: context.room.unmodeledEncounterKeys }),
    lifecycleProfileKey,
    runsProducer,
    counterEffects: context.room.counters,
    entered: context.entered,
    entry: context.entry === true,
    ...(requiredReward === undefined ? {} : { requiredReward }),
    ...(enteredRewardStoreKey === undefined ? {} : { enteredRewardStoreKey }),
    ...(resolvedEntry.unspawnedRunStartRoll === undefined
      ? {}
      : { unspawnedRunStartRoll: resolvedEntry.unspawnedRunStartRoll }),
    roomActions: context.occurrence.roomActions,
    hasKeepsakeRack: routeHasKeepsakeRack(context.room, context.biome.routeKey),
    hasRequiredFountain: context.room.hasRequiredFountain,
    ...(context.occurrence.keepsakeRack?.keepsakeKey == null
      ? {}
      : {
          keepsakeRack: context.occurrence.keepsakeRack as NonNullable<
            CanonicalAuthoredRoom['keepsakeRack']
          >,
        }),
    ...(context.occurrence.fountainRarityResult === undefined
      ? {}
      : { fountainRarityResult: context.occurrence.fountainRarityResult }),
    ...(context.occurrence.purgingPool === undefined
      ? {}
      : { purgingPool: context.occurrence.purgingPool }),
    ...(context.occurrence.hermesShrine === undefined
      ? {}
      : { hermesShrine: context.occurrence.hermesShrine }),
    ...(context.occurrence.stygianWell === undefined
      ? {}
      : { stygianWell: context.occurrence.stygianWell }),
    ...(context.occurrence.challengeSwitch === undefined
      ? {}
      : { challengeSwitch: context.occurrence.challengeSwitch }),
    ...(context.occurrence.lockedExits === undefined
      ? {}
      : { lockedExits: context.occurrence.lockedExits }),
    ...(context.occurrence.layout === undefined ? {} : { layout: context.occurrence.layout }),
    ...(stygianWellOfferEffects === undefined ? {} : { stygianWellOfferEffects }),
    ...(stygianWellExtendedDirectPurchaseItemKeys === undefined
      ? {}
      : { stygianWellExtendedDirectPurchaseItemKeys }),
    acquisitionSites: Object.freeze(
      Object.fromEntries(
        Object.entries(nemesisResultSites).flatMap(([siteKey, site]) => {
          const entries = Object.freeze(
            Object.fromEntries(
              Object.entries(site.pickupEntries ?? {}).filter(([key]) =>
                pickupIsActive(siteKey, key),
              ),
            ),
          );
          return Object.keys(entries).length === 0
            ? []
            : [
                [
                  siteKey,
                  Object.freeze({
                    address:
                      acquisitionSiteFromStorageKey(
                        createOccurrenceAddress(context.biome, context.occurrence.occurrenceId),
                        siteKey,
                      ) ?? fail(`${context.room.gameName} has an invalid acquisition site key`),
                    entries,
                  }),
                ] as const,
              ];
        }),
      ),
    ),
    ...(context.room.requiredObjects === undefined
      ? {}
      : { requiredObjects: context.room.requiredObjects }),
    ...(incomingReward === undefined ? {} : { incomingReward }),
    ...(leaf.unresolvedIncomingReward === undefined
      ? {}
      : { unresolvedIncomingReward: leaf.unresolvedIncomingReward }),
    ...(leaf.localRewards === undefined ? {} : { localRewards: leaf.localRewards }),
    ...(leaf.unresolvedLocalRewards === undefined
      ? {}
      : { unresolvedLocalRewards: leaf.unresolvedLocalRewards }),
    ...(leaf.fieldsOptionalRewards === undefined
      ? {}
      : { fieldsOptionalRewards: leaf.fieldsOptionalRewards }),
    ...(leaf.fieldsSpatial === undefined ? {} : { fieldsSpatial: leaf.fieldsSpatial }),
    ...(context.occurrence.state.kind !== 'fieldsCombat'
      ? {}
      : { fieldsOptionalRewardCount: context.occurrence.state.optionalRewardCount }),
    ...(leaf.unresolvedFieldsOptionalRewards === undefined
      ? {}
      : { unresolvedFieldsOptionalRewards: leaf.unresolvedFieldsOptionalRewards }),
    ...(leaf.rewardWheels === undefined ? {} : { rewardWheels: leaf.rewardWheels }),
    ...(leaf.entryState === undefined ? {} : { entryState: leaf.entryState }),
    ...(infernalContractPedestal === undefined ? {} : { infernalContractPedestal }),
    ...(phantomExit === undefined ? {} : { phantomExit }),
    ...(pickupProducers.length === 0 ? {} : { pickupProducers }),
    ...(context.forcedRewardType === undefined
      ? {}
      : { forcedRewardType: context.forcedRewardType }),
    ...(context.countsTowardClockworkGoal === undefined
      ? {}
      : { countsTowardClockworkGoal: context.countsTowardClockworkGoal }),
  }) as Omit<CanonicalAuthoredRoom, 'roomActionRoster' | 'roomLifecycleTimeline'>;
  const structuralEncounterIdentities = base.encounterPhases.flatMap((phase) => {
    const resolutionContext = encounterResolutionContext(
      base,
      context.room,
      context.routePosition.routeKey,
    );
    const resolved = resolveMaterializedEncounterPhase(
      context.catalog,
      context.room,
      phase,
      resolutionContext,
    );
    return resolved === undefined
      ? []
      : [
          Object.freeze({
            slotKey: phase.slotKey,
            encounterKey: resolved.encounterKey,
            kind: resolved.kind,
            ...(resolved.customization === undefined
              ? {}
              : { customization: resolved.customization }),
          }),
        ];
  });
  const roomActionDomain = assembleRoomActionDomain({
    catalog: context.catalog,
    biome: context.biome,
    topology: context.topology,
    occurrence: context.occurrence,
    routePosition: context.routePosition,
    lifecycleProfileKey: base.lifecycleProfileKey,
    producer: base.runsProducer,
    incomingRewardActive: base.incomingReward?.acquisitionEnabled !== false,
    // The producer acquires the materialized reward; a retained rerolled reward
    // that no current press draws stays authored for repair, its rows dormant.
    ...(base.incomingReward === undefined
      ? {}
      : { incomingRewardOffer: base.incomingReward.offer }),
    ...(context.entry === true
      ? { incomingRewardBinding: resolvedEntry.incomingRewardBinding }
      : {}),
    ...(routeStartIncoming === undefined ? {} : { incomingRewardState: routeStartIncoming }),
    activeEncounterSlotKeys: base.encounterPhases.map((phase) => phase.slotKey),
    shopInventoryActive: base.entryState?.kind === 'shop',
    entryActive: base.entered,
    ...(base.rewardWheels === undefined
      ? {}
      : { activeRewardWheelKeys: base.rewardWheels.map((wheel) => wheel.wheelKey) }),
  });
  const terminalActionKey = terminalRoomActionKey(context.occurrence);
  const roomActionRoster = assembleRoomActionRoster({
    owner: base.origin,
    order: base.roomActions.order,
    ...(terminalActionKey === undefined ? {} : { terminalActionKey }),
    contributions: roomActionDomain.contributions,
    retainedSourceFamilies: roomActionDomain.retainedSourceFamilies,
    eventGraph: roomActionDomain.eventGraph,
    canonicalRequiredInsertions: roomActionDomain.contributions.flatMap((entry) => {
      if (entry.kind !== 'action' || entry.participation !== 'required') return [];
      const actionKey = roomActionKey(entry.reference);
      const placedIndex = base.roomActions.order.findIndex(
        (reference) => roomActionKey(reference) === actionKey,
      );
      // A row on a replaced item leaves its item to place, judged without the row.
      const replaced =
        placedIndex >= 0 &&
        !roomActionContentMatches(
          base.roomActions.order[placedIndex]!,
          roomActionReferenceContent(entry.reference) ?? null,
        );
      if (placedIndex >= 0 && !replaced) return [];
      const order = scheduleRequiredRoomActions({
        catalog: context.catalog,
        domain: roomActionDomain,
        order: replaced
          ? base.roomActions.order.filter((_, index) => index !== placedIndex)
          : base.roomActions.order,
        requiredKeys: new Set([actionKey]),
      });
      const index = order.findIndex((reference) => roomActionKey(reference) === actionKey);
      return [{ actionKey, toIndex: replaced && index > placedIndex ? index + 1 : index }];
    }),
  });
  const roomLifecycleTimeline = assembleRoomLifecycleTimeline({
    owner: base.origin,
    roomActionRoster,
  });
  const rerollPresses = context.occurrence.roomActions.order.some(
    (reference) => reference.kind === 'reroll',
  )
    ? resolvedRoomRerollPresses(context.biome, context.topology, context.occurrence)
    : undefined;
  return Object.freeze({
    ...base,
    ...(structuralEncounterIdentities.length === 0
      ? {}
      : { structuralEncounterIdentities: Object.freeze(structuralEncounterIdentities) }),
    roomActionRoster,
    ...(rerollPresses === undefined ? {} : { rerollPresses }),
    roomLifecycleTimeline,
  });
}

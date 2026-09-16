import { createOccurrenceAddress } from '../../../authored-project/addresses';
import type { StygianWellGenerationKey } from '../../../authored-project/model';
import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import {
  activeSelectedPickupProducers,
  echoLastRewardPickupEntryKeys,
} from '../../../authored-project/acquisition/pickup-producers';
import { acquisitionSiteFromStorageKey } from '../../../authored-project/acquisition/artificer';
import { seaStarDuplicateSourceIsActive } from '../../../authored-project/acquisition/sea-star';
import { assembleRoomActionDomain } from '../../../authored-project/room-actions/domain';
import { scheduleRequiredRoomActions } from '../../../authored-project/room-actions/defaults';
import { roomActionKey } from '../../../authored-project/room-actions/state';
import type { ShopOptionEntry } from '../../../reward-kernel/model';
import {
  alwaysActiveEncounterSlotKeys,
  resolveMaterializedEncounterPhase,
  materializeEncounterPhases,
} from '../../encounters/resolve';
import { encounterResolutionContext } from '../../encounters/resolve';
import { directEncounterDefinitionKeyForSlot } from '../../../authored-project/room-state/encounter-envelope';
import { extendedWellItemKeys } from '../../commerce/stygian-well';
import { assembleRoomActionRoster, assembleRoomLifecycleTimeline } from '../../room-actions';
import type { CanonicalAuthoredRoom } from '../model';
import {
  authoredMaterializer,
  resolvedStoreKey,
  type AuthoredRoomMaterializationContext,
  type MaterializedRoomLeaf,
} from './templates';

type StygianWellEffect = NonNullable<ShopOptionEntry['stygianWell']>['effect'];

function fail(detail: string): never {
  throw new Error(detail);
}

function requireLifecycleSelection(
  catalog: Catalog,
  room: RoomDeclaration,
  leaf: MaterializedRoomLeaf,
  encounterEnvelopeKey: string,
): void {
  const profile = catalog.roomLifecycleProfiles.byKey[leaf.lifecycleProfileKey];
  if (profile === undefined) {
    fail(`${room.gameName} selected unknown lifecycle ${leaf.lifecycleProfileKey}`);
  }
  if (!profile.encounterEnvelopeKeys.includes(encounterEnvelopeKey)) {
    fail(`${room.gameName} envelope ${encounterEnvelopeKey} is incompatible with ${profile.key}`);
  }
  const producer = leaf.incomingReward ?? leaf.unresolvedIncomingReward;
  if (producer === undefined) {
    if (profile.producer.kind !== 'none') {
      fail(`${room.gameName} lifecycle ${profile.key} requires a producer`);
    }
  } else if (
    profile.producer.kind !== 'required' ||
    !profile.producer.lifecycleProfileKeys.includes(producer.producerLifecycleKey)
  ) {
    fail(
      `${room.gameName} producer ${producer.producerLifecycleKey} is incompatible with ${profile.key}`,
    );
  }
}

export function materializeAuthoredRoom(
  context: AuthoredRoomMaterializationContext,
): CanonicalAuthoredRoom {
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
  const leaf: MaterializedRoomLeaf = authoredMaterializer(
    context.room.mode.templateKey,
    context.room.gameName,
  )(context);
  const selectedEncounterPhases =
    leaf.encounterPhases ??
    materializeEncounterPhases(
      context.catalog,
      context.room,
      context.occurrence.encounters,
      leaf.activeEncounterSlotKeys ??
        alwaysActiveEncounterSlotKeys(context.catalog, context.room, context.room.gameName),
      context.room.gameName,
    );
  const clockworkReward = leaf.clockworkReward ?? context.clockworkReward;
  requireLifecycleSelection(context.catalog, context.room, leaf, context.room.encounterEnvelopeKey);
  const pickupProducers = activeSelectedPickupProducers(
    context.catalog,
    context.biome,
    context.occurrence,
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
        ))) ||
    activePickupEntries.has(`${siteKey}\u0000${key}`);
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
  const enteredRewardStoreKey =
    context.room.enteredRewardStoreHistory.kind === 'resolvedOffer'
      ? resolvedStoreKey(context.room, context.batchStoreKey)
      : context.room.enteredRewardStoreHistory.kind === 'fixed'
        ? context.room.enteredRewardStoreHistory.storeKey
        : undefined;
  const stygianWellOfferEffects =
    context.occurrence.stygianWell === undefined
      ? undefined
      : (() => {
          const effects: Partial<Record<StygianWellGenerationKey, StygianWellEffect>> = {};
          const generations: readonly [StygianWellGenerationKey, string | null | undefined][] = [
            ['initial:healing', context.occurrence.stygianWell!.offerKeyBySlot.healing],
            ['initial:secondLeft', context.occurrence.stygianWell!.offerKeyBySlot.secondLeft],
            ['initial:secondRight', context.occurrence.stygianWell!.offerKeyBySlot.secondRight],
            ['travelDealRefill', context.occurrence.stygianWell!.travelDealRefillKey],
          ];
          for (const [generationKey, offerKey] of generations) {
            if (offerKey === undefined || offerKey === null) continue;
            const option = context.catalog.rewards.shops.byKey.RoomShop?.groups.values
              .flatMap((group) => group.options.values)
              .find((candidate) => candidate.key === offerKey);
            const effect = option?.stygianWell?.effect;
            const twistResultKey =
              generationKey === 'travelDealRefill'
                ? context.occurrence.stygianWell?.twistResultKeyBySlot?.travelDealRefill
                : context.occurrence.stygianWell?.twistResultKeyBySlot?.[
                    generationKey.slice('initial:'.length) as
                      'healing' | 'secondLeft' | 'secondRight'
                  ];
            const twistResultEffect =
              effect === 'twist' && twistResultKey !== undefined && twistResultKey !== null
                ? context.catalog.rewards.shops.byKey.RoomShop?.groups.values
                    .flatMap((group) => group.options.values)
                    .find((candidate) => candidate.key === twistResultKey)?.stygianWell?.effect
                : undefined;
            if (effect !== undefined) effects[generationKey] = twistResultEffect ?? effect;
          }
          return Object.freeze(effects);
        })();
  const stygianWellExtendedDirectPurchaseItemKeys =
    context.occurrence.stygianWell === undefined
      ? undefined
      : extendedWellItemKeys(context.catalog);
  const base = Object.freeze({
    kind: 'authored',
    origin: createOccurrenceAddress(context.biome, context.occurrence.occurrenceId),
    occurrenceId: context.occurrence.occurrenceId,
    gameName: context.room.gameName,
    roomKind: context.room.kind,
    ...(anomalyReplacement === undefined ? {} : { anomalyReplacement }),
    encounters: context.occurrence.encounters,
    encounterEnvelopeKey: context.room.encounterEnvelopeKey,
    encounterPhases: selectedEncounterPhases,
    ...(context.room.unmodeledEncounterKeys === undefined
      ? {}
      : { unmodeledEncounterKeys: context.room.unmodeledEncounterKeys }),
    lifecycleProfileKey: leaf.lifecycleProfileKey,
    counterEffects: context.room.counters,
    entered: context.entered,
    effectNeutralRequiredReward: context.room.effectNeutralRequiredReward,
    ...(enteredRewardStoreKey === undefined ? {} : { enteredRewardStoreKey }),
    roomActions: context.occurrence.roomActions,
    hasKeepsakeRack: context.room.hasKeepsakeRack,
    hasRequiredFountain: context.room.hasRequiredFountain,
    ...(context.occurrence.keepsakeRack === undefined
      ? {}
      : { keepsakeRack: context.occurrence.keepsakeRack }),
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
    ...(stygianWellOfferEffects === undefined ? {} : { stygianWellOfferEffects }),
    ...(stygianWellExtendedDirectPurchaseItemKeys === undefined
      ? {}
      : { stygianWellExtendedDirectPurchaseItemKeys }),
    acquisitionSites: Object.freeze(
      Object.fromEntries(
        Object.entries(context.occurrence.acquisitionSites ?? {}).flatMap(([siteKey, site]) => {
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
    ...(leaf.fieldsEntryPair === undefined ? {} : { fieldsEntryPair: leaf.fieldsEntryPair }),
    ...(context.occurrence.state.kind !== 'fieldsCombat'
      ? {}
      : { fieldsOptionalRewardCount: context.occurrence.state.optionalRewardCount }),
    ...(leaf.unresolvedFieldsOptionalRewards === undefined
      ? {}
      : { unresolvedFieldsOptionalRewards: leaf.unresolvedFieldsOptionalRewards }),
    ...(leaf.rewardWheels === undefined ? {} : { rewardWheels: leaf.rewardWheels }),
    ...(leaf.entryState === undefined ? {} : { entryState: leaf.entryState }),
    ...(pickupProducers.length === 0 ? {} : { pickupProducers }),
    ...(clockworkReward === undefined ? {} : { clockworkReward }),
  }) as Omit<CanonicalAuthoredRoom, 'roomActionRoster' | 'roomLifecycleTimeline'>;
  const structuralEncounterIdentities = base.encounterPhases.flatMap((phase) => {
    const resolutionContext = encounterResolutionContext(base, context.room);
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
          }),
        ];
  });
  const roomActionDomain = assembleRoomActionDomain({
    catalog: context.catalog,
    biome: context.biome,
    occurrence: context.occurrence,
    lifecycleProfileKey: base.lifecycleProfileKey,
    incomingRewardActive: base.incomingReward?.acquisitionEnabled !== false,
    activeEncounterSlotKeys: base.encounterPhases.map((phase) => phase.slotKey),
    shopInventoryActive: base.entryState?.kind === 'shop',
    ...(base.rewardWheels === undefined
      ? {}
      : { activeRewardWheelKeys: base.rewardWheels.map((wheel) => wheel.wheelKey) }),
  });
  const roomActionRoster = assembleRoomActionRoster({
    owner: base.origin,
    order: base.roomActions.order,
    contributions: roomActionDomain.contributions,
    lifecycleStructure: roomActionDomain.lifecycleStructure,
    canonicalRequiredInsertions: roomActionDomain.contributions.flatMap((entry) => {
      if (
        entry.kind !== 'action' ||
        entry.participation !== 'required' ||
        base.roomActions.order.some(
          (reference) => roomActionKey(reference) === roomActionKey(entry.reference),
        )
      ) {
        return [];
      }
      const actionKey = roomActionKey(entry.reference);
      const order = scheduleRequiredRoomActions({
        catalog: context.catalog,
        domain: roomActionDomain,
        order: base.roomActions.order,
        requiredKeys: new Set([actionKey]),
      });
      return [
        {
          actionKey,
          toIndex: order.findIndex((reference) => roomActionKey(reference) === actionKey),
        },
      ];
    }),
  });
  const roomLifecycleTimeline = assembleRoomLifecycleTimeline({
    owner: base.origin,
    roomActionRoster,
  });
  return Object.freeze({
    ...base,
    ...(structuralEncounterIdentities.length === 0
      ? {}
      : { structuralEncounterIdentities: Object.freeze(structuralEncounterIdentities) }),
    roomActionRoster,
    roomLifecycleTimeline,
  });
}

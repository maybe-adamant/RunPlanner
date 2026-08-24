import type { RoomActionReference, RoomActionState } from './model';
import type { Catalog } from '../catalog-schema';
import type { RoomOccurrence } from './model';
import { encounterEnvelopeSlots, selectedEncounterDefinitionKey } from './room-state/encounters';
import { semanticAddressKey } from './addresses';
import { parseArtificerReplacementEntryKey } from './artificer';
import { authoredAcquisitionSources } from './acquisition-sources';
import { echoLastRewardPickupEntryKeys, activeSelectedPickupProducers } from './traits';
import { seaStarDuplicateSourceIsActive } from './sea-star';
export { roomActionKey } from './room-action-key';

export function createEmptyRoomActionState(): RoomActionState {
  return Object.freeze({ order: Object.freeze([]) });
}

/** Complete structural action domain for one authored occurrence. */
export function activeRoomActionReferences(
  catalog: Catalog,
  biome: import('./addresses').BiomeAddress,
  occurrence: RoomOccurrence,
  scope?: {
    readonly activeEncounterSlotKeys?: readonly string[];
    readonly activeRewardWheelKeys?: readonly string[];
    readonly incomingRewardActive?: boolean;
    readonly shopInventoryActive?: boolean;
  },
): readonly RoomActionReference[] {
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) return Object.freeze([]);
  const references: RoomActionReference[] = [];
  // Reprieve rooms and automatic Postboss rooms both expose the same
  // occurrence-owned Fountain interaction.  The declaration fact, rather than
  // the old completion role, is the authoritative source.
  const hasFountain =
    room.hasRequiredFountain ||
    (room.mode.kind === 'authored' && room.mode.templateKey === 'Fountain');
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
  const reward =
    occurrence.state.kind === 'counted' ||
    occurrence.state.kind === 'fixed' ||
    occurrence.state.kind === 'anomaly' ||
    occurrence.state.kind === 'ephyraCombat' ||
    occurrence.state.kind === 'freeReward'
      ? occurrence.state.reward
      : undefined;
  if (
    reward !== undefined &&
    reward !== null &&
    (scope?.incomingRewardActive === undefined || scope.incomingRewardActive)
  ) {
    const lifecycleKey =
      room.incomingReward.kind === 'none' ? undefined : room.incomingReward.producerLifecycleKey;
    const lifecycle =
      lifecycleKey === undefined
        ? undefined
        : catalog.rewards.producerLifecycles.byKey[lifecycleKey]?.rewardTypes.byKey[
            reward.offer.rewardType
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
  if (hasFountain) references.push(Object.freeze({ kind: 'useFountain' }));
  if (occurrence.keepsakeRack?.disposition.kind === 'replace')
    references.push(Object.freeze({ kind: 'interactKeepsakeRack' }));
  if (occurrence.state.kind === 'shipCombat') {
    const activeWheels =
      scope?.activeRewardWheelKeys !== undefined
        ? new Set(scope.activeRewardWheelKeys)
        : new Set(occurrence.state.encounterCount === 2 ? ['wheel1'] : ['wheel1', 'wheel2']);
    for (const wheelKey of Object.keys(occurrence.state.wheels)) {
      if (activeWheels !== undefined && !activeWheels.has(wheelKey)) continue;
      references.push(Object.freeze({ kind: 'chooseRewardWheel', wheelKey }));
      references.push(Object.freeze({ kind: 'interactWheelReward', wheelKey }));
    }
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
    }
  }
  for (const phase of envelopeSlots) {
    if (activeEncounterSlots !== undefined && !activeEncounterSlots.has(phase.key)) continue;
    const key = selectedEncounterDefinitionKey(
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
    authoredAcquisitionSources(biome, occurrence).map((source) => [
      semanticAddressKey(source.acquisition.owner),
      source.reward,
    ]),
  );
  const structuralEchoEntries = new Set(
    echoLastRewardPickupEntryKeys(catalog, occurrence.encounters),
  );
  const activePickupEntries = new Set(
    activeSelectedPickupProducers(catalog, biome, occurrence).flatMap((producer) =>
      producer.pickups.map((pickup) => JSON.stringify([producer.siteKey, pickup.key])),
    ),
  );
  for (const [siteKey, site] of Object.entries(occurrence.acquisitionSites ?? {})) {
    for (const entryKey of Object.keys(site.pickupEntries ?? {})) {
      if (
        structuralEchoEntries.has(entryKey) &&
        !activePickupEntries.has(JSON.stringify([siteKey, entryKey]))
      )
        continue;
      if (
        (siteKey.startsWith('traitGenerated:') || siteKey.startsWith('nemesisGenerated:')) &&
        !activePickupEntries.has(JSON.stringify([siteKey, entryKey]))
      )
        continue;
      if (
        siteKey.startsWith('seaStarDuplicate:') &&
        !seaStarDuplicateSourceIsActive(catalog, biome, occurrence, siteKey)
      )
        continue;
      const artificer = parseArtificerReplacementEntryKey(entryKey);
      if (
        artificer !== undefined &&
        sourceDispositions.get(artificer.sourceKey)?.dispositionByAcquisitionRole[
          artificer.acquisitionRole
        ]?.kind !== 'artificer'
      )
        continue;
      references.push(Object.freeze({ kind: 'interactAcquisitionEntry', siteKey, entryKey }));
    }
  }
  return Object.freeze(references);
}

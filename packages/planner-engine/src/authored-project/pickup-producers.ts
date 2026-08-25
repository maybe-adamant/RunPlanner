import type { Catalog } from '../catalog-schema';
import type { RoomActionReference, RoomEncounterState, RoomOccurrence } from './model';
import {
  createAcquisitionEntryAddress,
  createEncounterPhaseAddress,
  createGorgonPhaseAddress,
  createNemesisRandomEventAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type BiomeAddress,
  type NemesisRandomEventAddress,
  type TraitOfferAddress,
  type TraitOfferOwnerAddress,
} from './addresses';
import { acquisitionSiteFromStorageKey } from './artificer';
import { roomActionKey } from './room-action-key';
import {
  createSelectedPickupEntries,
  materializeGorgonAthenaOffer,
  optionIndex,
  TRAIT_OPTION_KEYS,
  type AuthoredTraitOffer,
  type TraitOptionKey,
} from './traits';

export interface SelectedPickupProducer {
  readonly traitKey?: string;
  readonly producerLifecycleKey: string;
  /** Whether this instance follows its source action or the room-exit placement declared by its lifecycle. */
  readonly placement: 'afterSource' | 'roomExit';
  /** Exact trait acquisition that creates this producer instance. */
  readonly source: TraitOfferAddress | NemesisRandomEventAddress;
  readonly sourceAction: RoomActionReference;
  /** The exact source is a normal participating acquisition, not a conversion or dormant optional. */
  readonly sourceNormal: boolean;
  /** Existing acquisition-site storage owner for this producer instance. */
  readonly siteKey: string;
  readonly pickups: readonly {
    readonly key: string;
    /** Omitted when exact prior history derives the generated reward identity. */
    readonly rewardType?: string;
    readonly required: boolean;
  }[];
}

export function nemesisGeneratedPickupSiteKey(phaseKey: string): string {
  return `nemesisGenerated:${encodeURIComponent(phaseKey)}`;
}
export function parseNemesisGeneratedPickupSiteKey(key: string): string | undefined {
  const [kind, phase, ...rest] = key.split(':');
  if (kind !== 'nemesisGenerated' || phase === undefined || rest.length !== 0) return undefined;
  try {
    const value = decodeURIComponent(phase);
    return value.length === 0 ? undefined : value;
  } catch {
    return undefined;
  }
}

/** Collision-safe site key for one selected equipping trait's fixed pickups. */
export function traitGeneratedPickupSiteKey(
  source: TraitOfferAddress,
  optionKey: TraitOptionKey,
): string {
  return `traitGenerated:${encodeURIComponent(semanticAddressKey(source))}:${optionKey}`;
}

export function parseTraitGeneratedPickupSiteKey(
  key: string,
): { readonly sourceKey: string; readonly optionKey: TraitOptionKey } | undefined {
  const [kind, source, optionKey, ...rest] = key.split(':');
  if (
    kind !== 'traitGenerated' ||
    source === undefined ||
    optionKey === undefined ||
    !TRAIT_OPTION_KEYS.includes(optionKey as TraitOptionKey) ||
    rest.length > 0
  )
    return undefined;
  try {
    const sourceKey = decodeURIComponent(source);
    return sourceKey.length === 0
      ? undefined
      : Object.freeze({ sourceKey, optionKey: optionKey as TraitOptionKey });
  } catch {
    return undefined;
  }
}

export function echoLastRewardPickupEntryKey(
  phaseKey: string,
  encounterKey: string,
  optionKey: TraitOptionKey,
): string {
  return `echoLastReward:${phaseKey}:${encounterKey}:${optionKey}`;
}

/** Reattest one persisted Echo replay pickup key without exposing its encoding to consumers. */
export function parseEchoLastRewardPickupEntryKey(key: string):
  | {
      readonly phaseKey: string;
      readonly encounterKey: string;
      readonly optionKey: TraitOptionKey;
    }
  | undefined {
  const [kind, phaseKey, encounterKey, optionKey, ...remainder] = key.split(':');
  if (
    kind !== 'echoLastReward' ||
    phaseKey === undefined ||
    phaseKey.length === 0 ||
    encounterKey === undefined ||
    encounterKey.length === 0 ||
    optionKey === undefined ||
    !TRAIT_OPTION_KEYS.includes(optionKey as TraitOptionKey) ||
    remainder.length > 0
  )
    return undefined;
  return Object.freeze({
    phaseKey,
    encounterKey,
    optionKey: optionKey as TraitOptionKey,
  });
}

/** Every structurally owned Echo replay row, including dormant outer options. */
export function echoLastRewardPickupEntryKeys(
  catalog: Catalog,
  encounters: RoomEncounterState,
): readonly string[] {
  return Object.freeze(
    Object.entries(encounters.traitOffersByPhase ?? {}).flatMap(([phaseKey, offers]) =>
      Object.entries(offers).flatMap(([encounterKey, offer]) =>
        offer?.kind !== 'traits'
          ? []
          : offer.options.flatMap((option, index) => {
              const disposition = catalog.traits.byKey[option.traitKey]?.selectedDisposition;
              const optionKey = TRAIT_OPTION_KEYS[index];
              return disposition?.kind === 'echo' &&
                disposition.effect === 'lastReward' &&
                optionKey !== undefined
                ? [echoLastRewardPickupEntryKey(phaseKey, encounterKey, optionKey)]
                : [];
            }),
      ),
    ),
  );
}

/** Builds one structurally selected producer; active consumers filter its source participation. */
function producerForTraitOffer(
  catalog: Catalog,
  source: TraitOfferAddress,
  sourceAction: RoomActionReference,
  offer: AuthoredTraitOffer | null | undefined,
  sourceNormal: boolean,
  sourceIsStory: boolean,
  echoEntryKey?: string,
): readonly SelectedPickupProducer[] {
  if (offer?.kind !== 'traits') return Object.freeze([]);
  const selected = offer.options[optionIndex(offer.selectedOptionKey)];
  if (selected === undefined) return Object.freeze([]);
  const traitKey = selected.traitKey;
  const disposition = catalog.traits.byKey[traitKey]?.selectedDisposition;
  if (disposition?.kind === 'producePickups') {
    const lifecycle = catalog.rewards.producerLifecycles.byKey[disposition.producerLifecycleKey];
    const placement = disposition.pickups.every((pickup) =>
      lifecycle?.rewardTypes.byKey[pickup.rewardType]?.acquisitionLifecycle.some(
        (binding) => binding.role === 'self' && binding.lifecyclePoint === 'roomExit',
      ),
    )
      ? 'roomExit'
      : 'afterSource';
    return Object.freeze([
      Object.freeze({
        traitKey,
        producerLifecycleKey: disposition.producerLifecycleKey,
        placement,
        source,
        sourceAction,
        sourceNormal,
        siteKey: traitGeneratedPickupSiteKey(source, offer.selectedOptionKey),
        pickups: Object.freeze(
          disposition.pickups
            .filter((pickup) => !pickup.excludeStorySource || !sourceIsStory)
            .map((pickup) => Object.freeze({ ...pickup, required: false as const })),
        ),
      }),
    ]);
  }
  if (
    disposition?.kind === 'echo' &&
    disposition.effect === 'lastReward' &&
    echoEntryKey !== undefined
  )
    return Object.freeze([
      Object.freeze({
        traitKey,
        producerLifecycleKey: 'EchoLastReward',
        placement: 'roomExit',
        source,
        sourceAction,
        sourceNormal,
        siteKey: 'roomExit',
        pickups: Object.freeze([Object.freeze({ key: echoEntryKey, required: true as const })]),
      }),
    ]);
  return Object.freeze([]);
}

function traitPickupOffers(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
): readonly {
  readonly source: TraitOfferAddress;
  readonly sourceAction: RoomActionReference;
  readonly sourceNormal: boolean;
  readonly sourceIsStory: boolean;
  readonly offer: AuthoredTraitOffer | null;
}[] {
  const result: {
    source: TraitOfferAddress;
    sourceAction: RoomActionReference;
    sourceNormal: boolean;
    sourceIsStory: boolean;
    offer: AuthoredTraitOffer | null;
  }[] = [];
  const actionKeys = new Set(occurrence.roomActions.order.map(roomActionKey));
  const room = catalog.rooms.byKey[occurrence.gameName];
  const sourceIsStory = room?.mode.kind === 'authored' && room.mode.templateKey === 'Story';
  const addReward = (
    owner: TraitOfferOwnerAddress,
    reward: import('./model').AuthoredRewardState | null | undefined,
  ) => {
    if (reward === undefined || reward === null) return;
    for (const [role, offer] of Object.entries(reward.traitOffersByAcquisitionRole)) {
      const source = createTraitOfferAddress(owner, role);
      const sourceAction = (() => {
        switch (owner.kind) {
          case 'incomingReward': {
            const incoming = catalog.rooms.byKey[occurrence.gameName]?.incomingReward;
            const lifecycleKey =
              incoming === undefined || incoming.kind === 'none'
                ? undefined
                : incoming.producerLifecycleKey;
            const binding =
              lifecycleKey === undefined
                ? undefined
                : catalog.rewards.producerLifecycles.byKey[lifecycleKey]?.rewardTypes.byKey[
                    reward.offer.rewardType
                  ]?.acquisitionLifecycle.find((candidate) => candidate.role === role);
            return {
              kind: 'interactIncomingReward' as const,
              producerPoint: binding?.lifecyclePoint ?? role,
              acquisitionRole: role,
            };
          }
          case 'localReward':
            return {
              kind: 'interactLocalReward' as const,
              groupKey: owner.groupKey,
              slotKey: owner.slotKey,
            };
          case 'rewardWheelOffer':
            return { kind: 'interactWheelReward' as const, wheelKey: owner.wheelKey };
          case 'shopOffer':
            return { kind: 'interactShopOffer' as const, offerKey: owner.offerKey };
          case 'encounterPhase':
            return { kind: 'interactEncounter' as const, phaseKey: owner.phaseKey };
          case 'gorgonPhase':
            return { kind: 'interactGorgon' as const, phaseKey: owner.encounter.phaseKey };
          case 'acquisitionEntry':
            return {
              kind: 'interactAcquisitionEntry' as const,
              siteKey: owner.site.pointKey,
              entryKey: owner.entryKey,
            };
        }
      })();
      const participates = actionKeys.has(roomActionKey(sourceAction));
      result.push({
        source,
        sourceAction: Object.freeze(sourceAction),
        sourceNormal: participates && reward.dispositionByAcquisitionRole[role]?.kind === 'normal',
        sourceIsStory,
        offer,
      });
    }
  };
  switch (occurrence.state.kind) {
    case 'counted':
    case 'fixed':
    case 'anomaly':
    case 'ephyraCombat':
    case 'freeReward':
      addReward(
        createIncomingRewardAddress(biome, occurrence.occurrenceId),
        occurrence.state.reward,
      );
      break;
    case 'fieldsCombat':
      for (const [slotKey, reward] of Object.entries(occurrence.state.cages))
        addReward(
          createLocalRewardAddress(biome, occurrence.occurrenceId, 'cages', slotKey),
          reward,
        );
      for (const [slotKey, reward] of Object.entries(occurrence.state.optionalRewards))
        addReward(
          createLocalRewardAddress(biome, occurrence.occurrenceId, 'optionalRewards', slotKey),
          reward,
        );
      break;
    case 'shipCombat':
      for (const [wheelKey, wheel] of Object.entries(occurrence.state.wheels))
        for (const [offerKey, reward] of Object.entries(wheel.offers))
          addReward(
            createRewardWheelOfferAddress(biome, occurrence.occurrenceId, wheelKey, offerKey),
            reward,
          );
      break;
    case 'shop':
      for (const [offerKey, offer] of Object.entries(occurrence.state.shop?.offers ?? {}))
        addReward(createShopOfferAddress(biome, occurrence.occurrenceId, offerKey), offer.reward);
      break;
    case 'none':
      break;
  }
  const occurrenceAddress = createOccurrenceAddress(biome, occurrence.occurrenceId);
  for (const [siteKey, site] of Object.entries(occurrence.acquisitionSites ?? {})) {
    const address = acquisitionSiteFromStorageKey(occurrenceAddress, siteKey);
    if (address === undefined) continue;
    for (const [entryKey, reward] of Object.entries(site.pickupEntries ?? {}))
      addReward(createAcquisitionEntryAddress(address, entryKey), reward);
  }
  for (const [phaseKey, offers] of Object.entries(occurrence.encounters.traitOffersByPhase ?? {})) {
    const owner = createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
      phaseKey,
    );
    for (const [encounterKey, offer] of Object.entries(offers))
      result.push({
        source: createTraitOfferAddress(owner, encounterKey),
        sourceAction: Object.freeze({ kind: 'interactEncounter', phaseKey }),
        sourceNormal: actionKeys.has(roomActionKey({ kind: 'interactEncounter', phaseKey })),
        sourceIsStory,
        offer,
      });
  }
  for (const [phaseKey, resultState] of Object.entries(
    occurrence.encounters.gorgonResultByPhase ?? {},
  )) {
    const offer =
      resultState.athenaOffer === undefined || resultState.athenaOffer === null
        ? null
        : materializeGorgonAthenaOffer(catalog, resultState.athenaOffer);
    const encounter = createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
      phaseKey,
    );
    result.push({
      source: createTraitOfferAddress(createGorgonPhaseAddress(encounter), 'gorgonAthena'),
      sourceAction: Object.freeze({ kind: 'interactGorgon', phaseKey }),
      sourceNormal: actionKeys.has(roomActionKey({ kind: 'interactGorgon', phaseKey })),
      sourceIsStory,
      offer: offer ?? null,
    });
  }
  return Object.freeze(result.map((item) => Object.freeze(item)));
}

/** Every structurally selected generated-pickup producer, regardless of its source outcome. */
export function selectedPickupProducers(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
): readonly SelectedPickupProducer[] {
  return Object.freeze([
    ...traitPickupOffers(catalog, biome, occurrence).flatMap(
      ({ source, sourceAction, sourceNormal, sourceIsStory, offer }) => {
        const echoKey =
          source.owner.kind === 'encounterPhase'
            ? echoLastRewardPickupEntryKey(
                source.owner.phaseKey,
                source.acquisitionRole,
                offer?.kind === 'traits' ? offer.selectedOptionKey : 'option1',
              )
            : undefined;
        return producerForTraitOffer(
          catalog,
          source,
          sourceAction,
          offer,
          sourceNormal,
          sourceIsStory,
          echoKey,
        );
      },
    ),
    ...nemesisPickupProducers(catalog, biome, occurrence),
  ]);
}

function nemesisPickupProducers(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
): readonly SelectedPickupProducer[] {
  const actions = new Set(occurrence.roomActions.order.map(roomActionKey));
  return Object.entries(occurrence.encounters.nemesisRandomEventByPhase ?? {}).flatMap(
    ([phaseKey, outcome]) => {
      if (outcome === undefined || outcome === null) return [];
      const declined = 'response' in outcome && outcome.response === 'decline';
      const policy = catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent;
      if (policy === undefined) return [];
      const required =
        !declined &&
        (outcome.kind === 'goldTrade'
          ? policy.goldTrade.pickupRequiredOnAccept
          : outcome.kind === 'damageTrade'
            ? policy.damageTrade.pickupRequiredOnAccept
            : outcome.kind === 'traitTrade'
              ? policy.traitTrade.pickupRequiredOnAccept
              : outcome.kind === 'freeItem'
                ? policy.freeItem.pickupRequired
                : policy.damageContest.pickupRequired);
      return [
        Object.freeze({
          producerLifecycleKey: 'NemesisEventPickup',
          placement: 'afterSource' as const,
          source: createNemesisRandomEventAddress(
            createEncounterPhaseAddress(
              biome,
              { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
              phaseKey,
            ),
          ),
          sourceAction: Object.freeze({ kind: 'interactEncounter' as const, phaseKey }),
          sourceNormal:
            occurrence.encounters.encounterKeyByPhase[phaseKey] === 'NemesisRandomEvent' &&
            !declined &&
            actions.has(roomActionKey({ kind: 'interactEncounter', phaseKey })),
          siteKey: nemesisGeneratedPickupSiteKey(phaseKey),
          pickups: Object.freeze([Object.freeze({ key: 'result', required })]),
        }),
      ];
    },
  );
}

/**
 * The live producer instances after their exact source acquisition has settled
 * normally.  Structural sites deliberately remain addressable while inactive
 * so an authored source can be restored without losing its nested detail.
 */
export function activeSelectedPickupProducers(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
): readonly SelectedPickupProducer[] {
  return Object.freeze(
    selectedPickupProducers(catalog, biome, occurrence).filter((producer) => producer.sourceNormal),
  );
}

/** Exact structurally selected producer for one persisted acquisition entry. */
export function selectedPickupProducerForEntry(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  siteKey: string,
  entryKey: string,
): SelectedPickupProducer | undefined {
  return selectedPickupProducers(catalog, biome, occurrence).find(
    (producer) =>
      producer.siteKey === siteKey && producer.pickups.some((pickup) => pickup.key === entryKey),
  );
}

/**
 * Retain only closed generated pickup detail for the currently selected source
 * descriptors, while keeping Echo's unselected replay rows structural. Every
 * source-owner mutation uses this one occurrence-local repair boundary.
 */
export function reconcileSelectedPickupProducerState(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
): RoomOccurrence {
  const producers = selectedPickupProducers(catalog, biome, occurrence);
  const echoKeys = new Set(echoLastRewardPickupEntryKeys(catalog, occurrence.encounters));
  const selectedSiteKeys = new Set(producers.map((producer) => producer.siteKey));
  const structuralEntries = new Set(
    producers.flatMap((producer) =>
      producer.pickups.map((pickup) => `${producer.siteKey}\u0000${pickup.key}`),
    ),
  );
  const nextSites: Record<string, import('./model').AuthoredAcquisitionSiteState> = {
    ...(occurrence.acquisitionSites ?? {}),
  };
  if (
    occurrence.state.kind !== 'shop' &&
    nextSites.roomExit?.pickupEntries !== undefined &&
    (echoKeys.size > 0 ||
      producers.some((producer) => producer.siteKey === 'roomExit') ||
      Object.keys(nextSites.roomExit.pickupEntries).some(
        (entryKey) => parseEchoLastRewardPickupEntryKey(entryKey) !== undefined,
      ))
  ) {
    const retained = Object.fromEntries(
      Object.entries(nextSites.roomExit.pickupEntries).filter(([key]) => echoKeys.has(key)),
    );
    if (Object.keys(retained).length === 0) delete nextSites.roomExit;
    else nextSites.roomExit = Object.freeze({ pickupEntries: Object.freeze(retained) });
  }
  for (const siteKey of Object.keys(nextSites))
    if (
      (siteKey.startsWith('traitGenerated:') || siteKey.startsWith('nemesisGenerated:')) &&
      !selectedSiteKeys.has(siteKey)
    )
      delete nextSites[siteKey];
  for (const producer of producers) {
    const current = nextSites[producer.siteKey];
    const existing = current?.pickupEntries ?? {};
    const defaults = createSelectedPickupEntries(catalog, producer);
    const preserved =
      producer.siteKey === 'roomExit'
        ? Object.entries(existing).filter(([key]) => echoKeys.has(key))
        : [];
    const pickupEntries = Object.freeze(
      Object.fromEntries([
        ...preserved,
        ...Object.entries(defaults).map(([key, fallback]) => {
          const retained = existing[key];
          return [
            key,
            fallback === null
              ? (retained ?? null)
              : retained !== null && retained?.offer.rewardType === fallback.offer.rewardType
                ? retained
                : fallback,
          ] as const;
        }),
      ]),
    );
    if (Object.keys(pickupEntries).length === 0) delete nextSites[producer.siteKey];
    else nextSites[producer.siteKey] = Object.freeze({ pickupEntries });
  }
  const withoutSites = { ...occurrence };
  delete withoutSites.acquisitionSites;
  const nextActions = occurrence.roomActions.order.filter((reference) => {
    if (reference.kind !== 'interactAcquisitionEntry') return true;
    const key = `${reference.siteKey}\u0000${reference.entryKey}`;
    if (
      reference.siteKey.startsWith('traitGenerated:') ||
      reference.siteKey.startsWith('nemesisGenerated:')
    )
      return structuralEntries.has(key);
    if (reference.siteKey === 'roomExit' && echoKeys.has(reference.entryKey))
      return structuralEntries.has(key) || echoKeys.has(reference.entryKey);
    return true;
  });
  return Object.freeze({
    ...withoutSites,
    ...(Object.keys(nextSites).length === 0 ? {} : { acquisitionSites: Object.freeze(nextSites) }),
    ...(nextActions.length === occurrence.roomActions.order.length
      ? {}
      : { roomActions: Object.freeze({ order: Object.freeze(nextActions) }) }),
  });
}

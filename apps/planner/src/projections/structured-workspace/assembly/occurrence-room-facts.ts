import {
  authoredShopOffer,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  activeSelectedPickupProducers,
  acquisitionSiteFromStorageKey,
  echoLastRewardPickupEntryKeys,
  defaultHermesShrineDeliveryReward,
  hermesShrineDeliveryEntryKey,
  parseHermesShrineDeliveryEntryKey,
  semanticAddressKey,
  createFieldsSpatialAddress,
  createRoomFeatureAddress,
  type FieldsSpatialTarget,
} from '@run-planner/engine/authored-project';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  fieldsOptionalRewardCountSupport,
  type CanonicalAuthoredRoom,
} from '@run-planner/engine/simulation';
import { summarizeRewardOffer } from '@planner/projections/rewards/rewardPicker';
import { resolveWorkspaceFixedRewardOffer } from './catalog-room';
import { assembleShopSupplementalOffers } from './occurrence-shop-supplementals';
import {
  requireEncounterEnvelope,
  requireProjectedRewardControl,
  activeEncounterPhasesForOwner,
  controlsForOccurrence,
  rewardControl,
  type WorkspaceOccurrenceRewardAssemblyInput,
} from './occurrence-reward-assembly';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceShipStructurePhase,
} from '../contract';
import type { WorkspaceEncounterPhase, WorkspaceRoomLocal } from '../contracts/locals';
import type { WorkspaceExplicitRewardControl, WorkspaceRewardControl } from '../contracts/rewards';

export interface WorkspaceOccurrenceRoomInput extends WorkspaceOccurrenceRewardAssemblyInput {
  readonly evaluatedRoom?: CanonicalAuthoredRoom;
}

export interface WorkspaceOccurrenceRewardLocalAssembly {
  readonly encounterPhases: readonly WorkspaceEncounterPhase[];
  readonly roomLocal: WorkspaceRoomLocal;
  readonly rewardControls: readonly WorkspaceRewardControl[];
}

export function assembleOccurrenceRewardLocal(
  input: WorkspaceOccurrenceRoomInput,
  room: RoomDeclaration,
): WorkspaceOccurrenceRewardLocalAssembly {
  const address = createOccurrenceAddress(input.biome, input.occurrence.occurrenceId);
  const baseRewardControls = controlsForOccurrence(input, room);
  const hasRetainedNemesisEvent = Object.values(
    input.occurrence.encounters.encounterKeyByPhase,
  ).some((encounterKey) => encounterKey === 'NemesisRandomEvent');
  const encounterPhases =
    input.facts.detailsActive || hasRetainedNemesisEvent
      ? activeEncounterPhasesForOwner(
          input,
          room,
          { kind: 'occurrence', occurrenceId: input.occurrence.occurrenceId },
          input.occurrence.encounters,
          {
            ...(input.occurrence.state.kind === 'shipCombat'
              ? { shipEncounterCount: input.occurrence.state.encounterCount }
              : {}),
            ...(input.occurrence.state.kind === 'fieldsCombat'
              ? { fieldsCageRewardCount: input.fieldsBatchFacts?.doorCageRewardCount ?? 0 }
              : {}),
          },
        )
      : Object.freeze([]);
  const roomLocal = roomLocalForOccurrence(input, room, baseRewardControls);
  const pickupRewardControls =
    !input.facts.detailsActive || input.occurrence.acquisitionSites === undefined
      ? Object.freeze([])
      : (() => {
          const pickupProducers = activeSelectedPickupProducers(
            input.catalog,
            input.biome,
            input.occurrence,
          );
          const activePickups = pickupProducers.flatMap((producer) =>
            producer.pickups.map((pickup) =>
              Object.freeze({ ...pickup, siteKey: producer.siteKey }),
            ),
          );
          const activeKeys = new Set(
            activePickups.map((pickup) => `${pickup.siteKey}\u0000${pickup.key}`),
          );
          const structuralEchoKeys = new Set(
            echoLastRewardPickupEntryKeys(input.catalog, input.occurrence.encounters),
          );
          return Object.freeze(
            Object.entries(input.occurrence.acquisitionSites).flatMap(([siteKey, state]) => {
              const site = acquisitionSiteFromStorageKey(address, siteKey);
              if (site === undefined) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${semanticAddressKey(address)} has invalid acquisition site ${siteKey}`,
                );
              }
              const derivedEntries = input.derivedAcquisitionEntries?.(site) ?? Object.freeze([]);
              return Object.entries(state.pickupEntries ?? {}).flatMap(([key, reward]) => {
                const shopInventoryReward =
                  input.occurrence.state.kind === 'shop' && siteKey === 'roomExit'
                    ? authoredShopOffer(input.occurrence, key)?.reward
                    : undefined;
                if (input.occurrence.state.kind === 'shop' && siteKey === 'roomExit') {
                  if (
                    shopInventoryReward === null ||
                    shopInventoryReward === undefined ||
                    input.catalog.rewards.rewardTypes.byKey[shopInventoryReward.offer.rewardType]
                      ?.sourceResolution?.kind !== 'acquisitionRole'
                  )
                    return [];
                }
                const shrineDelivery =
                  siteKey === 'hermesShrineDelivery'
                    ? parseHermesShrineDeliveryEntryKey(key)
                    : undefined;
                if (
                  shrineDelivery !== undefined &&
                  shrineDelivery.routeKey === address.routeKey &&
                  shrineDelivery.biomeKey === address.biomeKey &&
                  shrineDelivery.sourceOccurrenceId === address.occurrenceId
                )
                  return [];
                if (
                  siteKey === 'roomExit' &&
                  structuralEchoKeys.has(key) &&
                  !activeKeys.has(`${siteKey}\u0000${key}`)
                ) {
                  return [];
                }
                const pickup = activePickups.find(
                  (candidate) => candidate.siteKey === siteKey && candidate.key === key,
                );
                const capability = derivedEntries.find(
                  (entry) =>
                    entry.address.entryKey === key &&
                    entry.kind !== 'travelDealRefill' &&
                    entry.kind !== 'travelDealPlaceholder',
                );
                const echoCapability =
                  capability?.kind === 'echoLastReward' ? capability : undefined;
                const fixedEchoOffer = echoCapability?.fixedReward?.offer;
                const fixedOfferEdit =
                  fixedEchoOffer === undefined ||
                  (reward !== null && echoCapability?.retainedSourceMismatch !== true)
                    ? undefined
                    : Object.freeze({
                        actionLabel: `${reward === null ? 'Set' : 'Update'} replay reward · ${summarizeRewardOffer(input.catalog, fixedEchoOffer)}`,
                        offer: fixedEchoOffer,
                      });
                const rewardTypes =
                  capability?.rewardTypes ??
                  (shopInventoryReward === null || shopInventoryReward === undefined
                    ? undefined
                    : Object.freeze([shopInventoryReward.offer.rewardType])) ??
                  (pickup?.rewardType === undefined
                    ? Object.freeze([])
                    : Object.freeze([pickup.rewardType]));
                const entry = createAcquisitionEntryAddress(site, key);
                return [
                  rewardControl(
                    input,
                    { kind: 'acquisitionEntry' as const, address: entry },
                    undefined,
                    reward?.offer ?? null,
                    reward,
                    rewardTypes,
                    undefined,
                    capability?.retainedSourceMismatch === true,
                    fixedOfferEdit,
                    structuralEchoKeys.has(key),
                  ) as WorkspaceExplicitRewardControl,
                ];
              });
            }),
          );
        })();
  const supplementalRewardControls = Object.freeze(
    roomLocal.kind !== 'shop'
      ? []
      : roomLocal.supplementalOffers.flatMap((offer) =>
          'rewardControl' in offer ? [offer.rewardControl] : [],
        ),
  );
  // A due delayed delivery can be the first acquisition-site product at its
  // host. Publish its engine-attested payload owner even before the placement
  // command materializes the sparse site, so findings and repair navigation
  // have one exact destination at the delivery host.
  const dueShrineDeliveryRewardControls = Object.freeze(
    !input.facts.detailsActive
      ? []
      : (() => {
          const site = createAcquisitionSiteAddress(address, 'hermesShrineDelivery');
          const stored = input.occurrence.acquisitionSites?.hermesShrineDelivery?.pickupEntries;
          return (input.derivedAcquisitionEntries?.(site) ?? Object.freeze([])).flatMap(
            (capability) => {
              if (capability.kind !== 'hermesShrineDelivery') return [];
              if (stored?.[capability.address.entryKey] !== undefined) return [];
              const reward = capability.fixedReward ?? null;
              return [
                rewardControl(
                  input,
                  { kind: 'acquisitionEntry' as const, address: capability.address },
                  undefined,
                  reward?.offer ?? null,
                  reward,
                  capability.rewardTypes ?? Object.freeze([]),
                  undefined,
                  capability.retainedSourceMismatch === true,
                ) as WorkspaceExplicitRewardControl,
              ];
            },
          );
        })(),
  );
  const dueClockedTraitPickupRewardControls = Object.freeze(
    !input.facts.detailsActive
      ? []
      : (() => {
          const site = createAcquisitionSiteAddress(address, 'roomExit');
          const stored = input.occurrence.acquisitionSites?.roomExit?.pickupEntries;
          return (input.derivedAcquisitionEntries?.(site) ?? Object.freeze([])).flatMap(
            (capability) => {
              if (capability.kind !== 'clockedTraitPickup') return [];
              if (stored?.[capability.address.entryKey] !== undefined) return [];
              const reward = capability.fixedReward ?? null;
              return [
                rewardControl(
                  input,
                  { kind: 'acquisitionEntry' as const, address: capability.address },
                  undefined,
                  reward?.offer ?? null,
                  reward,
                  capability.rewardTypes ?? Object.freeze([]),
                ) as WorkspaceExplicitRewardControl,
              ];
            },
          );
        })(),
  );
  // Same-room rushed deliveries are active before the lifecycle has published
  // a derived host capability. Their source-owned entry remains the one
  // acquisition control; delayed host entries above consume the exact derived
  // capability instead of looking back to a purchase row.
  const rushedShrineRewardControls = Object.freeze(
    input.occurrence.hermesShrine === undefined
      ? []
      : [
          ...Object.entries(input.occurrence.hermesShrine.purchaseBySlot ?? []).map(
            ([slotKey, purchase]) => [`initial:${slotKey}`, purchase] as const,
          ),
          ...(input.occurrence.hermesShrine.travelDealRefill?.purchase === undefined
            ? []
            : [
                [
                  'travelDealRefill' as const,
                  input.occurrence.hermesShrine.travelDealRefill.purchase,
                ] as const,
              ]),
        ].flatMap(([generationKey, purchase]) => {
          if (purchase?.rushed !== true) return [];
          const inventoryOffer =
            generationKey === 'travelDealRefill'
              ? input.occurrence.hermesShrine?.travelDealRefill?.offer
              : input.occurrence.hermesShrine?.offerBySlot[
                  generationKey.slice(
                    'initial:'.length,
                  ) as import('@run-planner/engine/authored-project').HermesShrineSlotKey
                ];
          if (inventoryOffer === null || inventoryOffer === undefined) return [];
          const entry = createAcquisitionEntryAddress(
            createAcquisitionSiteAddress(address, 'hermesShrineDelivery'),
            hermesShrineDeliveryEntryKey(
              address,
              generationKey as import('@run-planner/engine/authored-project').HermesShrineGenerationKey,
            ),
          );
          const reward =
            input.occurrence.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[
              entry.entryKey
            ] ?? defaultHermesShrineDeliveryReward(input.catalog, inventoryOffer.rewardType);
          return [
            rewardControl(
              input,
              { kind: 'acquisitionEntry' as const, address: entry },
              undefined,
              reward?.offer ?? null,
              reward,
              Object.freeze([inventoryOffer.rewardType]),
            ) as WorkspaceExplicitRewardControl,
          ];
        }),
  );
  return Object.freeze({
    encounterPhases,
    roomLocal,
    rewardControls: Object.freeze([
      ...baseRewardControls,
      ...pickupRewardControls,
      ...supplementalRewardControls,
      ...dueShrineDeliveryRewardControls,
      ...dueClockedTraitPickupRewardControls,
      ...rushedShrineRewardControls,
    ]),
  });
}
function roomLocalForOccurrence(
  input: WorkspaceOccurrenceRoomInput,
  room: RoomDeclaration,
  controls: readonly WorkspaceRewardControl[],
): WorkspaceRoomLocal {
  const { occurrence } = input;
  const address = createOccurrenceAddress(input.biome, occurrence.occurrenceId);
  const incoming = createIncomingRewardAddress(input.biome, occurrence.occurrenceId);
  switch (occurrence.state.kind) {
    case 'none':
      return Object.freeze({ kind: 'none' as const });
    case 'fixed': {
      const offer = resolveWorkspaceFixedRewardOffer(room, occurrence.state);
      const rewardType =
        room.incomingReward.kind === 'fixed'
          ? input.catalog.rewards.rewardTypes.byKey[room.incomingReward.rewardType]
          : undefined;
      const control =
        rewardType?.payloadDomain === undefined
          ? undefined
          : requireProjectedRewardControl(controls, incoming, 'explicitReward');
      return Object.freeze({
        kind: 'fixed' as const,
        marker: input.markerDestinations.marker(incoming),
        offer,
        summary: offer === null ? 'Choose reward' : summarizeRewardOffer(input.catalog, offer),
        ...(control === undefined ? {} : { control }),
      });
    }
    case 'counted':
    case 'anomaly':
    case 'freeReward': {
      const control = requireProjectedRewardControl(controls, incoming, 'countedReward');
      return Object.freeze({
        kind: 'incomingReward' as const,
        control,
        summary:
          control.offer === null
            ? 'Choose reward'
            : summarizeRewardOffer(input.catalog, control.offer),
        ...(input.evaluatedRoom?.clockworkReward === undefined
          ? {}
          : { clockworkReward: input.evaluatedRoom.clockworkReward }),
      });
    }
    case 'ephyraCombat': {
      const incomingReward = requireProjectedRewardControl(controls, incoming, 'countedReward');
      return Object.freeze({
        kind: 'incomingReward' as const,
        control: incomingReward,
        summary:
          incomingReward.offer === null
            ? 'Choose reward'
            : summarizeRewardOffer(input.catalog, incomingReward.offer),
      });
    }
    case 'fieldsCombat': {
      const fieldsFacts = input.fieldsBatchFacts;
      const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
      if (group?.kind !== 'boundedRewardSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Fields state has no bounded cage declaration`,
        );
      }
      const cages = group.slotKeys
        .slice(0, fieldsFacts?.doorCageRewardCount ?? 0)
        .map((slotKey, index) => {
          const address = createLocalRewardAddress(
            input.biome,
            occurrence.occurrenceId,
            group.key,
            slotKey,
          );
          return Object.freeze({
            control: requireProjectedRewardControl(controls, address, 'countedReward'),
            key: slotKey,
            label: `Cage ${index + 1}`,
            summary: (() => {
              const control = requireProjectedRewardControl(controls, address, 'countedReward');
              return control.offer === null
                ? 'Choose reward'
                : summarizeRewardOffer(input.catalog, control.offer);
            })(),
          });
        });
      const optionalDescriptor = room.fieldsOptionalRewards;
      if (optionalDescriptor === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Fields state has no optional reward declaration`,
        );
      }
      const optionalRewards = optionalDescriptor.slotKeys
        .slice(0, occurrence.state.optionalRewardCount)
        .map((slotKey, index) => {
          const address = createLocalRewardAddress(
            input.biome,
            occurrence.occurrenceId,
            optionalDescriptor.key,
            slotKey,
          );
          return Object.freeze({
            control: requireProjectedRewardControl(controls, address, 'countedReward'),
            key: slotKey,
            label: `Optional ${index + 1}`,
            summary: (() => {
              const control = requireProjectedRewardControl(controls, address, 'countedReward');
              return control.offer === null
                ? 'Choose reward'
                : summarizeRewardOffer(input.catalog, control.offer);
            })(),
          });
        });
      const spatialDeclaration = room.fieldsSpatial;
      if (spatialDeclaration === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Fields state has no spatial declaration`,
        );
      }
      const spatialState = occurrence.state.spatial;
      const pointChoices = (target: FieldsSpatialTarget, pointIds: readonly number[]) =>
        Object.freeze([
          Object.freeze({ label: 'Choose point', value: null }),
          ...pointIds.map((pointId, index) =>
            Object.freeze({
              label:
                target.kind === 'entry'
                  ? `Entry ${index + 1}`
                  : target.kind === 'cage'
                    ? `Cage Point ${index + 1}`
                    : `Optional Point ${index + 1}`,
              value: pointId,
            }),
          ),
        ]);
      const spatialControl = (
        target: FieldsSpatialTarget,
        label: string,
        pointId: number | null,
        pointIds: readonly number[],
      ) => {
        const spatialAddress = createFieldsSpatialAddress(
          createOccurrenceAddress(input.biome, occurrence.occurrenceId),
          target,
        );
        return Object.freeze({
          address: spatialAddress,
          interactionKey: semanticAddressKey(spatialAddress),
          label,
          marker: input.markerDestinations.marker(spatialAddress),
          pointChoices: pointChoices(target, pointIds),
          pointId,
          target,
        });
      };
      const spatial = Object.freeze([
        spatialControl(
          { kind: 'entry' },
          'Entry',
          spatialState.entryStartPointId,
          spatialDeclaration.entryPairs.map((pair) => pair.startPointId),
        ),
        ...cages.map((cage) =>
          spatialControl(
            { kind: 'cage', slotKey: cage.key },
            cage.label,
            spatialState.cagePointIdBySlot[cage.key] ?? null,
            spatialDeclaration.cagePointIds,
          ),
        ),
        ...optionalRewards.map((reward) =>
          spatialControl(
            { kind: 'optional', slotKey: reward.key },
            reward.label,
            spatialState.optionalPointIdBySlot[reward.key] ?? null,
            spatialDeclaration.optionalPointIds,
          ),
        ),
        ...(Object.values(occurrence.encounters.encounterKeyByPhase).includes('NemesisRandomEvent')
          ? [
              spatialControl(
                { kind: 'nemesis' },
                'Nemesis',
                spatialState.nemesisPointId,
                spatialDeclaration.optionalPointIds,
              ),
            ]
          : []),
      ]);
      return Object.freeze({
        kind: 'fields' as const,
        cages: Object.freeze(cages),
        spatial,
        owner: createOccurrenceAddress(input.biome, occurrence.occurrenceId),
        optionalRewardCount: occurrence.state.optionalRewardCount,
        optionalRewardCapacity: optionalDescriptor.optionalRewardCapacity,
        optionalRewardCountAddress: createRoomFeatureAddress(address, {
          kind: 'fieldsOptionalRewardCount',
        }),
        optionalRewardCountMarker: input.markerDestinations.marker(
          createRoomFeatureAddress(address, { kind: 'fieldsOptionalRewardCount' }),
        ),
        optionalRewardCountValues: (() => {
          const support = fieldsOptionalRewardCountSupport(
            input.catalog,
            occurrence,
            createOccurrenceAddress(input.biome, occurrence.occurrenceId),
          );
          const maximum = support?.effectiveMaximum ?? optionalDescriptor.optionalRewardCapacity;
          return Object.freeze([
            ...Array.from({ length: maximum + 1 }, (_, index) => index),
            ...(occurrence.state.optionalRewardCount > maximum
              ? [occurrence.state.optionalRewardCount]
              : []),
          ]);
        })(),
        optionalRewards: Object.freeze(optionalRewards),
        groupKey: group.key,
      });
    }
    case 'shipCombat': {
      const state = occurrence.state;
      const envelope = requireEncounterEnvelope(input.catalog, room);
      let combatOrdinal = 0;
      const structuralPhases: readonly WorkspaceShipStructurePhase[] = envelope.slots.map(
        (slot) => {
          const rewardAttachment = slot.rewardAttachment;
          if (rewardAttachment?.kind !== 'rewardWheel') {
            return Object.freeze({ key: slot.key, label: slot.key });
          }
          combatOrdinal += 1;
          return Object.freeze({
            key: slot.key,
            label: `Combat ${combatOrdinal}`,
            rewardWheelKey: rewardAttachment.key,
          });
        },
      );
      const wheels = envelope.slots.flatMap((slot, phaseIndex) => {
        const declaration = slot.rewardAttachment;
        if (declaration?.kind !== 'rewardWheel') return [];
        const wheel = state.wheels[declaration.key];
        if (wheel === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ship state is missing ${declaration.key}`,
          );
        }
        const address = createRewardWheelAddress(
          input.biome,
          occurrence.occurrenceId,
          declaration.key,
        );
        const active = phaseIndex < state.encounterCount;
        const phase = structuralPhases[phaseIndex];
        if (phase?.rewardWheelKey !== declaration.key) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} phase ${slot.key} lost reward-wheel presentation ownership`,
          );
        }
        const label = `${phase.label} reward`;
        const offers = declaration.offerKeys.map((offerKey, offerIndex) => {
          const offerAddress = createRewardWheelOfferAddress(
            input.biome,
            occurrence.occurrenceId,
            declaration.key,
            offerKey,
          );
          return Object.freeze({
            active: active && offerIndex < wheel.offerCount,
            control: requireProjectedRewardControl(controls, offerAddress, 'countedReward'),
            key: offerKey,
            label: `Offer ${offerIndex + 1}`,
          });
        });
        return [
          Object.freeze({
            active,
            address,
            encounterPhaseKey: slot.key,
            key: declaration.key,
            label,
            marker: input.markerDestinations.marker(address),
            offerCount: wheel.offerCount,
            offers: Object.freeze(offers),
            pickedOfferIndex: wheel.pickedOfferIndex,
            storeKey: wheel.storeKey,
          }),
        ];
      });
      return Object.freeze({
        kind: 'ship' as const,
        combatPhaseCount: state.encounterCount,
        phases: Object.freeze(structuralPhases.slice(0, state.encounterCount)),
        wheels: Object.freeze(wheels),
      });
    }
    case 'shop': {
      const state = occurrence.state;
      const shop = state.shop;
      if (!input.facts.detailsActive || shop === undefined) {
        return Object.freeze({
          kind: 'shop' as const,
          materialized: false,
          offers: Object.freeze([]),
          supplementalOffers: Object.freeze([]),
        });
      }
      const profile = input.catalog.rewards.shops.byKey[shop.profileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} shop profile ${shop.profileKey} is missing`,
        );
      }
      const selectedActionKeys = Object.freeze(
        occurrence.roomActions.order.flatMap((reference) =>
          reference.kind === 'interactShopOffer'
            ? [reference.offerKey]
            : reference.kind === 'interactAcquisitionEntry'
              ? [reference.entryKey]
              : [],
        ),
      );
      const acquisitionSite = createAcquisitionSiteAddress(
        createOccurrenceAddress(input.biome, occurrence.occurrenceId),
        'roomExit',
      );
      const derivedEntries = input.derivedAcquisitionEntries?.(acquisitionSite) ?? [];
      const travelCapability = derivedEntries.find(
        (entry) => entry.kind === 'travelDealRefill' || entry.kind === 'travelDealPlaceholder',
      );
      const goldCapability = derivedEntries.find(
        (entry) =>
          entry.kind === 'echoDoubleShopReward' || entry.kind === 'echoDoubleShopPlaceholder',
      );
      const slots = [
        ...profile.slots.values,
        ...(controls.some(
          (control) =>
            control.owner.address.kind === 'shopOffer' &&
            control.owner.address.offerKey === 'infernalContractReward',
        )
          ? [{ key: 'infernalContractReward', label: 'Contract' }]
          : []),
      ];
      const offers = slots.map((slot) => {
        if (shop.offers[slot.key] === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop state is missing ${slot.key}`,
          );
        }
        const offerAddress = createShopOfferAddress(input.biome, occurrence.occurrenceId, slot.key);
        const purchaseAddress = createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(
            createOccurrenceAddress(input.biome, occurrence.occurrenceId),
            'roomExit',
          ),
          slot.key,
        );
        return Object.freeze({
          key: slot.key,
          label: slot.label,
          purchase: Object.freeze({
            address: purchaseAddress,
            marker: input.markerDestinations.marker(purchaseAddress),
          }),
          participation: Object.freeze({
            interactionKey: semanticAddressKey(offerAddress),
            owner: offerAddress,
            purchased: occurrence.roomActions.order.some(
              (reference) =>
                reference.kind === 'interactShopOffer' && reference.offerKey === slot.key,
            ),
          }),
          rewardControl: requireProjectedRewardControl(controls, offerAddress, 'explicitReward'),
        });
      });
      const pickupEntries = occurrence.acquisitionSites?.roomExit?.pickupEntries ?? {};
      const supplementalContext = Object.freeze({
        selectedActionKeys,
        acquisitionSite,
        input,
        offers,
        pickupEntries,
        roomGameName: room.gameName,
      });
      const supplementalOffers = assembleShopSupplementalOffers({
        context: supplementalContext,
        goldCapability,
        travelCapability,
      });
      return Object.freeze({
        kind: 'shop' as const,
        materialized: true,
        offers: Object.freeze(offers),
        supplementalOffers,
      });
    }
  }
}

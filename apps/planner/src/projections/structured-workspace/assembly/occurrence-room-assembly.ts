import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  activeSelectedPickupProducers,
  acquisitionSiteFromStorageKey,
  echoLastRewardPickupEntryKeys,
  hermesShrineDeliveryEntryKey,
  semanticAddressKey,
  type AcquisitionSiteAddress,
  type AuthoredRewardState,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  fieldsOptionalRewardCountSupport,
  type CanonicalAuthoredRoom,
} from '@run-planner/engine/simulation';
import { summarizeRewardOffer } from '@planner/projections/rewardPicker';
import {
  requireWorkspaceRoom as requireRoom,
  resolveWorkspaceFixedRewardOffer,
} from './catalog-room';
import {
  requireEncounterEnvelope,
  requireProjectedRewardControl,
  requireRewardWheelAttachment,
  type WorkspaceDerivedAcquisitionEntry,
  activeEncounterPhasesForOwner,
  controlsForOccurrence,
  rewardControl,
  type WorkspaceOccurrenceRewardAssemblyInput,
} from './occurrence-reward-assembly';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceEncounterPhase,
  type WorkspaceExplicitRewardControl,
  type WorkspaceRewardControl,
  type WorkspaceRoomActionRow,
  type WorkspaceRoomActions,
  type WorkspaceRoomFeature,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomLifecycleTimelineEntry,
  type WorkspaceRoomLocal,
  type WorkspaceRoomSummary,
  type WorkspaceRoomWorkbenchPresentation,
  type WorkspaceShipPhasePresentation,
  type WorkspaceShipStructurePhase,
  type WorkspaceRewardWheelDescriptor,
  type WorkspaceShopPurchaseDescriptor,
  type WorkspaceShopSupplementalDescriptor,
} from '../contract';
import { workspaceRewardStoreLabel } from './reward-labels';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';

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
              if (input.occurrence.state.kind === 'shop' && siteKey === 'roomExit') return [];
              const site = acquisitionSiteFromStorageKey(address, siteKey);
              if (site === undefined) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${semanticAddressKey(address)} has invalid acquisition site ${siteKey}`,
                );
              }
              const derivedEntries = input.derivedAcquisitionEntries?.(site) ?? Object.freeze([]);
              return Object.entries(state.pickupEntries ?? {}).flatMap(([key, reward]) => {
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
                  (entry) => entry.kind === 'echoLastReward' && entry.address.entryKey === key,
                );
                const fixedEchoOffer = capability?.fixedReward?.offer;
                const fixedOfferEdit =
                  fixedEchoOffer === undefined ||
                  (reward !== null && capability?.retainedSourceMismatch !== true)
                    ? undefined
                    : Object.freeze({
                        actionLabel: `${reward === null ? 'Set' : 'Update'} replay reward · ${summarizeRewardOffer(input.catalog, fixedEchoOffer)}`,
                        offer: fixedEchoOffer,
                      });
                const rewardTypes =
                  capability?.rewardTypes ??
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
  const rushedShrineRewardControls = Object.freeze(
    input.occurrence.hermesShrine === undefined
      ? []
      : Object.entries(input.occurrence.hermesShrine.purchaseBySlot ?? []).flatMap(
          ([slotKey, purchase]) => {
            if (purchase?.rushed !== true) return [];
            const typedSlotKey =
              slotKey as import('@run-planner/engine/authored-project').HermesShrineSlotKey;
            const reward = input.occurrence.hermesShrine?.offerBySlot[typedSlotKey];
            if (reward === null || reward === undefined) return [];
            const generationKey =
              `initial:${typedSlotKey}` as import('@run-planner/engine/authored-project').HermesShrineGenerationKey;
            const entry = createAcquisitionEntryAddress(
              createAcquisitionSiteAddress(address, 'hermesShrineDelivery'),
              hermesShrineDeliveryEntryKey(address, generationKey),
            );
            return [
              rewardControl(
                input,
                { kind: 'acquisitionEntry' as const, address: entry },
                undefined,
                reward.offer,
                reward,
                Object.freeze([reward.offer.rewardType]),
              ) as WorkspaceExplicitRewardControl,
            ];
          },
        ),
  );
  return Object.freeze({
    encounterPhases,
    roomLocal,
    rewardControls: Object.freeze([
      ...baseRewardControls,
      ...pickupRewardControls,
      ...supplementalRewardControls,
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
          });
        });
      return Object.freeze({
        kind: 'fields' as const,
        cages: Object.freeze(cages),
        owner: createOccurrenceAddress(input.biome, occurrence.occurrenceId),
        optionalRewardCount: occurrence.state.optionalRewardCount,
        optionalRewardCapacity: optionalDescriptor.optionalRewardCapacity,
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
      const contractCapability = derivedEntries.find(
        (entry) => entry.kind === 'infernalContractReward',
      );
      const travelCapability = derivedEntries.find(
        (entry) => entry.kind === 'travelDealRefill' || entry.kind === 'travelDealPlaceholder',
      );
      const goldCapability = derivedEntries.find(
        (entry) =>
          entry.kind === 'echoDoubleShopReward' || entry.kind === 'echoDoubleShopPlaceholder',
      );
      const offers = profile.slots.values.map((slot) => {
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
      const supplementalContext: ShopSupplementalAssemblyContext = Object.freeze({
        selectedActionKeys,
        acquisitionSite,
        input,
        offers,
        pickupEntries,
        roomGameName: room.gameName,
      });
      const supplementalOffers = Object.freeze(
        [
          derivedRewardSupplementalOffer('travel', travelCapability, supplementalContext),
          derivedRewardSupplementalOffer('gold', goldCapability, supplementalContext),
          contractSupplementalOffer(contractCapability, supplementalContext),
        ].filter((offer): offer is WorkspaceShopSupplementalDescriptor => offer !== undefined),
      );
      return Object.freeze({
        kind: 'shop' as const,
        materialized: true,
        offers: Object.freeze(offers),
        supplementalOffers,
      });
    }
  }
}

function encounterPhaseInteractionRequirement(
  owner: WorkspaceRoomSummary['address'],
  phases: readonly WorkspaceEncounterPhase[],
): WorkspaceOccurrenceInteractionRequirement | undefined {
  const interactivePhases = phases.filter(
    (phase) =>
      phase.customizable ||
      phase.nemesisFeature !== undefined ||
      phase.nemesisEvent !== undefined ||
      phase.figLeaf !== undefined ||
      phase.gorgonCondition !== undefined,
  );
  if (interactivePhases.length === 0) return undefined;
  return Object.freeze({
    kind: 'encounterPhases' as const,
    owner,
    phases: Object.freeze(
      interactivePhases.map((phase) =>
        Object.freeze({
          candidateChoices: phase.candidateChoices,
          owner: phase.address,
          selectedEncounterKey: phase.selectedEncounter.key,
          selectionEnabled: phase.customizable,
          ...(phase.nemesisFeature === undefined ? {} : { nemesisFeature: phase.nemesisFeature }),
          ...(phase.nemesisEvent === undefined ? {} : { nemesisEvent: phase.nemesisEvent }),
          ...(phase.figLeaf === undefined
            ? {}
            : {
                figLeaf: Object.freeze({
                  selected: phase.figLeaf.selected,
                  supported: phase.figLeaf.supported,
                }),
              }),
          ...(phase.gorgonCondition === undefined
            ? {}
            : {
                gorgonCondition: Object.freeze({
                  selected: phase.gorgonCondition.selected,
                  supported: phase.gorgonCondition.supported,
                }),
              }),
        }),
      ),
    ),
  });
}

function presentedEncounterPhases(
  encounterPhases: readonly WorkspaceEncounterPhase[],
): readonly WorkspaceEncounterPhase[] {
  return Object.freeze(
    encounterPhases.filter(
      (phase) =>
        phase.address.phaseKey === 'Passive' ||
        phase.customizable ||
        phase.marker.findingCount > 0 ||
        phase.traitOffer !== undefined ||
        phase.figLeaf !== undefined ||
        phase.gorgonCondition !== undefined ||
        phase.gorgonAthena !== undefined,
    ),
  );
}

function shipWorkbenchPresentation(
  encounterPhases: readonly WorkspaceEncounterPhase[],
  features: readonly WorkspaceRoomFeature[],
  roomLocal: Extract<WorkspaceRoomLocal, { readonly kind: 'ship' }>,
  roomActions: WorkspaceRoomActions | undefined,
): WorkspaceRoomWorkbenchPresentation {
  const activeWheels = roomLocal.wheels.filter((wheel) => wheel.active);
  for (const wheel of activeWheels) {
    const phase = roomLocal.phases.find((candidate) => candidate.key === wheel.encounterPhaseKey);
    if (phase?.rewardWheelKey !== wheel.key) {
      throw new StructuredWorkspaceProjectionContractError(
        `Ship wheel ${wheel.key} has no active declaration-owned encounter phase`,
      );
    }
  }
  const phaseIndexForKey = (phaseKey: string): number => {
    const index = roomLocal.phases.findIndex((phase) => phase.key === phaseKey);
    if (index < 0) {
      throw new StructuredWorkspaceProjectionContractError(
        `Ship timeline references unknown phase ${phaseKey}`,
      );
    }
    return index;
  };
  const wheelForNextPhase = (phaseIndex: number): WorkspaceRewardWheelDescriptor | undefined => {
    const nextPhase = roomLocal.phases[phaseIndex + 1];
    return nextPhase?.rewardWheelKey === undefined
      ? undefined
      : activeWheels.find((wheel) => wheel.key === nextPhase.rewardWheelKey);
  };
  const boundaryPhaseIndex = (boundary: WorkspaceRoomLifecycleBoundary): number => {
    switch (boundary.kind) {
      case 'roomEntered':
        return 0;
      case 'encounterStart':
      case 'encounterEnd':
        return phaseIndexForKey(boundary.phaseKey);
      case 'bossDefeated':
        return phaseIndexForKey(boundary.phaseKey);
      case 'nextPhase': {
        const targetIndex = roomLocal.phases.findIndex(
          (phase) => phase.rewardWheelKey === boundary.wheelKey,
        );
        return targetIndex <= 0 ? 0 : targetIndex - 1;
      }
      case 'cleanup':
        return roomLocal.phases.length - 1;
    }
  };
  const checkpointKeyForBoundary = (boundary: WorkspaceRoomLifecycleBoundary): string => {
    switch (boundary.kind) {
      case 'encounterEnd':
        return `combat:${boundary.phaseKey}`;
      case 'nextPhase':
        return `nextPhaseUsable:${boundary.wheelKey}`;
      default:
        return boundary.key;
    }
  };
  const actionByKey = new Map(roomActions?.rows.map((row) => [row.key, row]) ?? []);
  const phaseRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const phaseOptionalRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const phaseBoundaryEntries = roomLocal.phases.map(
    () => [] as Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'boundary' }>[],
  );
  const phaseTimelineEntries = roomLocal.phases.map(
    () => [] as WorkspaceRoomLifecycleTimelineEntry[],
  );
  const phaseCheckpointEntries = roomLocal.phases.map(
    () => [] as WorkspaceRoomActions['checkpoints'][number][],
  );
  if (roomActions !== undefined) {
    let currentPhaseIndex = 0;
    for (const entry of roomActions.timeline.entries) {
      if (entry.kind === 'boundary') {
        const phaseIndex = boundaryPhaseIndex(entry.boundary);
        phaseBoundaryEntries[phaseIndex]!.push(entry);
        phaseTimelineEntries[phaseIndex]!.push(entry);
        if (entry.boundary.kind === 'encounterStart') currentPhaseIndex = phaseIndex;
        continue;
      }
      if (entry.kind === 'automaticEffect') {
        phaseTimelineEntries[phaseIndexForKey(entry.phaseKey)]!.push(entry);
        continue;
      }
      const row = actionByKey.get(entry.actionKey);
      if (row === undefined) continue;
      const phaseIndex =
        entry.phaseKey === undefined ? currentPhaseIndex : phaseIndexForKey(entry.phaseKey);
      phaseTimelineEntries[phaseIndex]!.push(entry);
      phaseRows[phaseIndex]!.push(row);
    }
    for (const checkpoint of roomActions.checkpoints) {
      if (checkpoint.key === 'exitUsable') continue;
      const matchingBoundary = roomActions.timeline.entries.find(
        (entry) =>
          entry.kind === 'boundary' && checkpointKeyForBoundary(entry.boundary) === checkpoint.key,
      );
      const phaseIndex =
        matchingBoundary?.kind === 'boundary'
          ? boundaryPhaseIndex(matchingBoundary.boundary)
          : roomLocal.phases.length - 1;
      phaseCheckpointEntries[phaseIndex]!.push(checkpoint);
    }
    for (const row of roomActions.optionalRows) {
      const phaseIndex = (() => {
        const window = row.window;
        if (window.kind === 'shipPostCombat') {
          return roomLocal.phases.findIndex((phase) => phase.rewardWheelKey === window.wheelKey);
        }
        if (window.kind === 'shipPreCombat') {
          const targetIndex = roomLocal.phases.findIndex(
            (phase) => phase.rewardWheelKey === window.wheelKey,
          );
          return Math.max(0, targetIndex - 1);
        }
        return roomLocal.phases.length - 1;
      })();
      if (phaseIndex < 0) {
        throw new StructuredWorkspaceProjectionContractError(
          `Ship optional action ${row.key} has no declaration-owned phase`,
        );
      }
      phaseOptionalRows[phaseIndex]!.push(row);
    }
  }
  const phases: WorkspaceShipPhasePresentation[] = roomLocal.phases.map((phase, index) => {
    const encounter = encounterPhases.find((candidate) => candidate.address.phaseKey === phase.key);
    const wheel = wheelForNextPhase(index);
    return Object.freeze({
      actionRows: Object.freeze(phaseRows[index]!),
      checkpoints: Object.freeze(phaseCheckpointEntries[index]!),
      ...(encounter === undefined ? {} : { encounter }),
      key: phase.key,
      label: phase.label,
      timeline: Object.freeze(phaseTimelineEntries[index]!),
      optionalRows: Object.freeze(phaseOptionalRows[index]!),
      ...(wheel === undefined ? {} : { wheel }),
    });
  });
  return Object.freeze({
    combatPhaseCount: roomLocal.combatPhaseCount,
    features,
    kind: 'ship' as const,
    phases: Object.freeze(phases),
    repairRows: Object.freeze(roomActions?.repairRows ?? []),
    ...(roomActions === undefined ? {} : { roomActions }),
  });
}

export function roomWorkbenchPresentation(
  encounterPhases: readonly WorkspaceEncounterPhase[],
  features: readonly WorkspaceRoomFeature[],
  roomLocal: WorkspaceRoomLocal,
  roomActions: WorkspaceRoomActions | undefined,
): WorkspaceRoomWorkbenchPresentation {
  const presented = presentedEncounterPhases(encounterPhases);
  switch (roomLocal.kind) {
    case 'fields':
      return Object.freeze({
        encounterPhases: presented,
        features,
        fields: roomLocal,
        kind: 'fields' as const,
        ...(roomActions === undefined ? {} : { roomActions }),
      });
    case 'ship':
      return shipWorkbenchPresentation(presented, features, roomLocal, roomActions);
    case 'shop':
      return Object.freeze({
        features,
        kind: 'shop' as const,
        shop: roomLocal,
        ...(roomActions === undefined ? {} : { roomActions }),
      });
    case 'none':
    case 'fixed':
    case 'incomingReward':
      return Object.freeze({
        encounterPhases: presented,
        features,
        kind: 'standard' as const,
        ...(roomActions === undefined ? {} : { roomActions }),
      });
  }
}

export function occurrenceInteractionRequirements(
  catalog: Catalog,
  room: WorkspaceRoomSummary,
): readonly WorkspaceOccurrenceInteractionRequirement[] {
  const requirements: WorkspaceOccurrenceInteractionRequirement[] = [];
  const topLevelEncounterRequirement = encounterPhaseInteractionRequirement(
    room.address,
    room.encounterPhases,
  );
  if (topLevelEncounterRequirement !== undefined) requirements.push(topLevelEncounterRequirement);

  if (room.zagreusSpawn?.materialized === true) {
    requirements.push(
      Object.freeze({ kind: 'zagreusSpawn' as const, owner: room.zagreusSpawn.owner }),
    );
  }
  if (room.naturalChaosSpawn !== undefined) {
    requirements.push(
      Object.freeze({ kind: 'naturalChaosSpawn' as const, owner: room.naturalChaosSpawn.owner }),
    );
  }
  if (room.resources !== undefined) {
    requirements.push(
      Object.freeze({
        kind: 'resourcePlacements' as const,
        owner: room.address,
        resources: room.resources,
      }),
    );
  }
  const activeShopOwners = new Set<string>();
  if (room.roomLocal.kind === 'shop' && room.roomLocal.materialized) {
    for (const offer of room.roomLocal.offers) {
      activeShopOwners.add(offer.participation.interactionKey);
      requirements.push(
        Object.freeze({
          kind: 'shopPurchaseParticipation' as const,
          owner: offer.participation.owner,
          purchased: offer.participation.purchased,
        }),
      );
    }
  }
  if (room.roomActions !== undefined) {
    requirements.push(
      Object.freeze({
        kind: 'roomActions' as const,
        owner: room.roomActions.owner,
        proposals: room.roomActions.proposals,
      }),
    );
    for (const row of room.roomActions.repairRows) {
      if (row.shopParticipation === undefined) continue;
      if (activeShopOwners.has(row.shopParticipation.interactionKey)) continue;
      requirements.push(
        Object.freeze({
          kind: 'shopPurchaseParticipation' as const,
          owner: row.shopParticipation.owner,
          purchased: true,
        }),
      );
    }
  }
  for (const feature of room.workbench.features) {
    if (feature.kind === 'stygianWell') {
      requirements.push(
        Object.freeze({
          kind: 'stygianWell' as const,
          owner: room.address,
          present: feature.present,
          ...(feature.presenceInteractionKey === undefined
            ? {}
            : { presenceInteractionKey: feature.presenceInteractionKey }),
          interacted: feature.interacted,
          ...(feature.interactionKey === undefined
            ? {}
            : { interactionKey: feature.interactionKey }),
          slots: Object.freeze(
            feature.slots.map((slot) =>
              Object.freeze({
                generationKey: slot.generationKey,
                slotKey: slot.key,
                itemKey: slot.itemKey,
                candidateItemKeys: slot.candidateItemKeys,
                offerInteractionKey: slot.offerInteractionKey,
                purchased: slot.purchased,
                purchaseInteractionKey: slot.purchaseInteractionKey,
                ...(slot.twist === undefined
                  ? {}
                  : {
                      twist: Object.freeze({
                        itemKey: slot.twist.itemKey,
                        candidateItemKeys: slot.twist.candidateItemKeys,
                        interactionKey: slot.twist.interactionKey,
                      }),
                    }),
              }),
            ),
          ),
        }),
      );
      continue;
    }
    if (feature.kind === 'hermesShrine') {
      requirements.push(
        Object.freeze({
          kind: 'hermesShrine' as const,
          owner: room.address,
          present: feature.present,
          ...(feature.presenceInteractionKey === undefined
            ? {}
            : { presenceInteractionKey: feature.presenceInteractionKey }),
          slots: Object.freeze([
            ...feature.slots.map((slot) =>
              Object.freeze({
                slotKey: slot.key,
                rewardType: slot.rewardType,
                candidateRewardTypes: slot.candidateRewardTypes,
                purchase: slot.purchase,
                offerInteractionKey: slot.offerInteractionKey,
                purchaseInteractionKey: slot.purchaseInteractionKey,
              }),
            ),
            ...(feature.travelDealRefill === undefined
              ? []
              : [
                  Object.freeze({
                    slotKey: 'travelDealRefill' as const,
                    rewardType: feature.travelDealRefill.rewardType,
                    candidateRewardTypes: feature.travelDealRefill.candidateRewardTypes,
                    purchase: feature.travelDealRefill.purchase,
                    offerInteractionKey: feature.travelDealRefill.offerInteractionKey,
                    purchaseInteractionKey: feature.travelDealRefill.purchaseInteractionKey,
                  }),
                ]),
          ]),
        }),
      );
      continue;
    }
    if (feature.kind !== 'purgingPool') continue;
    requirements.push(
      Object.freeze({
        kind: 'purgingPoolInteraction' as const,
        owner: room.address,
        interactionKey: feature.interactionKey,
        interacted: feature.interacted,
      }),
    );
    if (!feature.interacted) continue;
    requirements.push(
      Object.freeze({
        kind: 'purgingPoolSlots' as const,
        owner: room.address,
        slots: Object.freeze(
          feature.slots.map((slot) =>
            Object.freeze({
              interactionKey: slot.interactionKey,
              slotKey: slot.key,
              traitKey: slot.traitKey,
            }),
          ),
        ),
      }),
    );
  }

  switch (room.roomLocal.kind) {
    case 'none':
    case 'fixed':
    case 'incomingReward':
      return Object.freeze(requirements);
    case 'fields':
      return Object.freeze(requirements);
    case 'ship': {
      const declaration = requireRoom(catalog, room.gameName);
      const wheels = room.roomLocal.wheels.map((wheel) => {
        const attachment = requireRewardWheelAttachment(catalog, declaration, wheel.key);
        return Object.freeze({
          address: wheel.address,
          offerCount: wheel.offerCount,
          offerCountChoices: Object.freeze(
            Array.from(
              { length: attachment.offerCount.max - attachment.offerCount.min + 1 },
              (_, index) => {
                const value = attachment.offerCount.min + index;
                return Object.freeze({ label: String(value), value });
              },
            ),
          ),
          pickChoices: Object.freeze(
            Array.from({ length: wheel.offerCount }, (_, index) => {
              const value = index + 1;
              return Object.freeze({ label: `Offer ${value}`, value });
            }),
          ),
          pickedOfferIndex: wheel.pickedOfferIndex,
          storeKey: wheel.storeKey,
          storeChoices: Object.freeze(
            attachment.reward.storeKeys.map((value) =>
              Object.freeze({ label: workspaceRewardStoreLabel(value), value }),
            ),
          ),
        });
      });
      requirements.push(
        Object.freeze({
          combatPhaseCount: room.roomLocal.combatPhaseCount,
          combatPhaseCountChoices: Object.freeze([
            Object.freeze({ label: 'Intro + 1 combat', value: 2 as const }),
            Object.freeze({ label: 'Intro + 2 combats', value: 3 as const }),
          ]),
          kind: 'shipCombatPhaseCount' as const,
          owner: room.address,
          wheels: Object.freeze(wheels),
        }),
      );
      return Object.freeze(requirements);
    }
    case 'shop': {
      const shop = room.roomLocal;
      if (!shop.materialized) {
        return Object.freeze(requirements);
      }
      return Object.freeze(requirements);
    }
  }
}

interface ShopSupplementalAssemblyContext {
  readonly selectedActionKeys: readonly string[];
  readonly acquisitionSite: AcquisitionSiteAddress;
  readonly input: WorkspaceOccurrenceRewardAssemblyInput;
  readonly offers: readonly { readonly key: string; readonly label: string }[];
  readonly pickupEntries: Readonly<Record<string, AuthoredRewardState | null>>;
  readonly roomGameName: string;
}

function supplementalPurchase(
  context: ShopSupplementalAssemblyContext,
  entryKey: string,
): WorkspaceShopPurchaseDescriptor {
  const address = createAcquisitionEntryAddress(context.acquisitionSite, entryKey);
  return Object.freeze({
    address,
    marker: context.input.markerDestinations.marker(address),
  });
}

function derivedRewardSupplementalOffer(
  family: 'travel' | 'gold',
  capability: WorkspaceDerivedAcquisitionEntry | undefined,
  context: ShopSupplementalAssemblyContext,
): WorkspaceShopSupplementalDescriptor | undefined {
  const gold = family === 'gold';
  const entryKey = gold ? ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY : TRAVEL_DEAL_REFILL_ENTRY_KEY;
  const activeKind = gold ? 'echoDoubleShopReward' : 'travelDealRefill';
  const placeholderKind = gold ? 'echoDoubleShopPlaceholder' : 'travelDealPlaceholder';
  const selected = context.selectedActionKeys.includes(entryKey);

  if (selected && capability?.kind !== activeKind) {
    const purchase = supplementalPurchase(context, entryKey);
    return gold
      ? Object.freeze({
          kind: 'echoDoubleShopInvalid' as const,
          key: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
          label: 'Gold Gold Gold duplicate',
          explanation:
            'This selected duplicate has no active eligible paid source. Remove its Room Action to repair the Shop.',
          purchase,
        })
      : Object.freeze({
          kind: 'travelDealInvalid' as const,
          key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
          label: 'Travel Deal refill',
          explanation:
            'This selected refill has no active triggering purchase. Remove its Room Action to repair the Shop.',
          purchase,
        });
  }
  if (capability === undefined) return undefined;
  if (capability.kind === placeholderKind) {
    return gold
      ? Object.freeze({
          kind: 'echoDoubleShopPlaceholder' as const,
          key: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
          label: 'Gold Gold Gold duplicate',
          explanation:
            'A prior paid non-Spell Shop action is required before this duplicate can be edited.',
        })
      : Object.freeze({
          kind: 'travelDealPlaceholder' as const,
          key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
          label: 'Travel Deal refill',
          explanation: 'A prior paid Shop action is required before this refill can be edited.',
        });
  }
  if (capability.kind !== activeKind || capability.sourceOfferKey === undefined) {
    return undefined;
  }
  if (capability.rewardTypes === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${context.roomGameName} ${gold ? 'Gold duplicate' : 'Travel refill'} has no attested reward domain`,
    );
  }
  const eligibleSourceOfferKeys = capability.eligibleSourceOfferKeys;
  const sourceOfferLabel =
    context.offers.find((offer) => offer.key === capability.sourceOfferKey)?.label ??
    (gold && capability.sourceOfferKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
      ? 'Travel Deal refill'
      : capability.sourceOfferKey);
  const authored = context.pickupEntries[entryKey] ?? capability.fixedReward ?? null;
  const materialized = Object.hasOwn(context.pickupEntries, entryKey);
  const address = createAcquisitionEntryAddress(context.acquisitionSite, entryKey);
  const projectedReward = rewardControl(
    context.input,
    { kind: 'acquisitionEntry' as const, address },
    undefined,
    authored?.offer ?? null,
    authored,
    capability.rewardTypes,
    materialized
      ? undefined
      : Object.freeze({
          site: context.acquisitionSite,
          entryKey,
          sourceOfferKey: capability.sourceOfferKey,
        }),
  ) as WorkspaceExplicitRewardControl;
  const purchase = supplementalPurchase(context, entryKey);

  if (gold) {
    if (eligibleSourceOfferKeys === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${context.roomGameName} Gold duplicate has no attested source domain`,
      );
    }
    return Object.freeze({
      kind: 'echoDoubleShopReward' as const,
      key: ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
      label: `Gold Gold Gold duplicate of ${sourceOfferLabel}`,
      sourceOfferKey: capability.sourceOfferKey,
      eligibleSourceOfferKeys,
      materialized,
      purchase,
      rewardControl: projectedReward,
    });
  }
  return Object.freeze({
    kind: 'travelDealRefill' as const,
    key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
    label: `Travel Deal refill after ${sourceOfferLabel}`,
    sourceOfferKey: capability.sourceOfferKey,
    materialized,
    purchase,
    rewardControl: projectedReward,
  });
}

function contractSupplementalOffer(
  capability: WorkspaceDerivedAcquisitionEntry | undefined,
  context: ShopSupplementalAssemblyContext,
): WorkspaceShopSupplementalDescriptor | undefined {
  if (capability === undefined) return undefined;
  const authored = context.pickupEntries[INFERNAL_CONTRACT_ENTRY_KEY];
  if (authored === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${context.roomGameName} contract opportunity has no structural child`,
    );
  }
  if (capability.rewardTypes === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${context.roomGameName} contract opportunity has no attested reward domain`,
    );
  }
  const address = createAcquisitionEntryAddress(
    context.acquisitionSite,
    INFERNAL_CONTRACT_ENTRY_KEY,
  );
  return Object.freeze({
    kind: 'infernalContractReward' as const,
    key: INFERNAL_CONTRACT_ENTRY_KEY,
    label: 'Infernal Contract reward',
    materialized: true,
    purchase: supplementalPurchase(context, INFERNAL_CONTRACT_ENTRY_KEY),
    rewardControl: rewardControl(
      context.input,
      { kind: 'acquisitionEntry' as const, address },
      undefined,
      authored?.offer ?? null,
      authored,
      capability.rewardTypes,
    ) as WorkspaceExplicitRewardControl,
  });
}

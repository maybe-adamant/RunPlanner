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
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  fieldsOptionalRewardCountSupport,
  type CanonicalAuthoredRoom,
} from '@run-planner/engine/simulation';
import { summarizeRewardOffer } from '@planner/projections/rewardPicker';
import { resolveWorkspaceFixedRewardOffer } from './catalog-room';
import {
  requireEncounterEnvelope,
  requireProjectedRewardControl,
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
  type WorkspaceRoomLocal,
  type WorkspaceShipStructurePhase,
  type WorkspaceShopSupplementalPurchaseDescriptor,
  type WorkspaceShopSupplementalDescriptor,
} from '../contract';

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
): WorkspaceShopSupplementalPurchaseDescriptor {
  const address = createAcquisitionEntryAddress(context.acquisitionSite, entryKey);
  const reference = Object.freeze({
    kind: 'interactAcquisitionEntry' as const,
    siteKey: context.acquisitionSite.pointKey,
    entryKey,
  });
  return Object.freeze({
    address,
    marker: context.input.markerDestinations.marker(address),
    purchased: context.selectedActionKeys.includes(entryKey),
    reference,
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
            'This selected duplicate has no active eligible paid source. Clear Purchased here to repair the Shop.',
          purchase,
        })
      : Object.freeze({
          kind: 'travelDealInvalid' as const,
          key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
          label: 'Travel Deal refill',
          explanation:
            'This selected refill has no active triggering purchase. Clear Purchased here to repair the Shop.',
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
          explanation: 'Settle the first paid non-Spell Shop purchase before editing Echo Gold.',
        })
      : Object.freeze({
          kind: 'travelDealPlaceholder' as const,
          key: TRAVEL_DEAL_REFILL_ENTRY_KEY,
          label: 'Travel Deal refill',
          explanation: 'Settle the first paid Shop purchase before editing Travel Deal.',
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

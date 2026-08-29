import {
  createAdditionalExitAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type BiomeAddress,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type {
  HermesShrineCandidateCapability,
  ChaosCandidateCapability,
  PurgingPoolCandidateCapability,
  StygianWellCandidateCapability,
  ZagreusContractCandidateCapability,
} from '@run-planner/engine/simulation';
import {
  type WorkspaceEncounterPhase,
  type WorkspaceFeatureAssessment,
  type WorkspaceRoomFeature,
  type WorkspaceRoomLocal,
  type WorkspaceRoomSummary,
  workspaceInteractionKey,
} from '../contract';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';

export interface WorkspaceOccurrenceFeaturesInput {
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  readonly facts: {
    readonly authoredAdditionalExitKeys: readonly string[];
    readonly detailsActive: boolean;
    readonly chaosPlacement?: ChaosCandidateCapability;
    readonly chaosGateForced: boolean;
    readonly zagreusContractPlacement?: ZagreusContractCandidateCapability;
  };
  readonly hermesShrineAssessment?: (
    owner: import('@run-planner/engine/authored-project').OccurrenceAddress,
  ) => HermesShrineCandidateCapability | undefined;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly occurrence: RoomOccurrence;
  readonly purgingPoolAssessment?: (
    owner: import('@run-planner/engine/authored-project').OccurrenceAddress,
  ) => PurgingPoolCandidateCapability | undefined;
  readonly stygianWellAssessment?: (
    owner: import('@run-planner/engine/authored-project').OccurrenceAddress,
  ) => StygianWellCandidateCapability | undefined;
}

export interface WorkspaceOccurrenceFeatureAssembly {
  readonly features: readonly WorkspaceRoomFeature[];
  readonly chaosSpawn: WorkspaceRoomSummary['chaosSpawn'];
  readonly zagreusSpawn: WorkspaceRoomSummary['zagreusSpawn'];
}

function distinct(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function declaredRoomShopItemKeys(catalog: Catalog, slotKey: string): readonly string[] {
  const profile = catalog.rewards.shops.byKey.RoomShop;
  if (profile === undefined) return Object.freeze([]);
  const groupKey = profile?.slots.byKey[slotKey]?.groupKey;
  return groupKey === undefined
    ? Object.freeze([])
    : Object.freeze(
        (profile.groups.byKey[groupKey]?.options.values ?? []).map((option) => option.key),
      );
}

function declaredRoomShopAllItemKeys(catalog: Catalog): readonly string[] {
  const profile = catalog.rewards.shops.byKey.RoomShop;
  return profile === undefined
    ? Object.freeze([])
    : distinct(
        profile.groups.values.flatMap((group) => group.options.values.map((option) => option.key)),
      );
}

function declaredRoomShopTwistItemKeys(catalog: Catalog): readonly string[] {
  const profile = catalog.rewards.shops.byKey.RoomShop;
  return profile === undefined
    ? Object.freeze([])
    : Object.freeze(
        profile.groups.values
          .flatMap((group) => group.options.values)
          .find((option) => option.key === 'RandomStoreItem')?.stygianWell?.nestedResultItemKeys ??
          [],
      );
}

function declaredSurfaceShopRewardTypes(catalog: Catalog, slotKey: string): readonly string[] {
  const profile = catalog.rewards.shops.byKey.SurfaceShop;
  if (profile === undefined) return Object.freeze([]);
  const groupKey = profile?.slots.byKey[slotKey]?.groupKey;
  return groupKey === undefined
    ? Object.freeze([])
    : (profile.groups.byKey[groupKey]?.rewardTypes ?? Object.freeze([]));
}

function declaredSurfaceShopAllRewardTypes(catalog: Catalog): readonly string[] {
  const profile = catalog.rewards.shops.byKey.SurfaceShop;
  return profile === undefined
    ? Object.freeze([])
    : distinct(profile.groups.values.flatMap((group) => group.rewardTypes));
}

function declaredPurgingPoolTraitKeys(catalog: Catalog): readonly string[] {
  return distinct(
    catalog.traitGivers.values
      .filter((giver) => giver.shopAwareGodTrait)
      .flatMap((giver) => giver.traitKeys),
  );
}

export function assembleOccurrenceFeatures(
  input: WorkspaceOccurrenceFeaturesInput,
  room: RoomDeclaration,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  roomLocal: WorkspaceRoomLocal,
): WorkspaceOccurrenceFeatureAssembly {
  const zagreusDeclaration = room.additionalExits.find(
    (candidate) => candidate.kind === 'zagreusContract',
  );
  const zagreusSpawn =
    zagreusDeclaration === undefined ||
    input.facts.authoredAdditionalExitKeys.includes(zagreusDeclaration.key) ||
    input.facts.zagreusContractPlacement?.placementEligible === false ||
    !input.facts.detailsActive ||
    roomLocal.kind !== 'shop' ||
    !roomLocal.materialized
      ? undefined
      : (() => {
          const owner = createAdditionalExitAddress(
            input.biome,
            input.occurrence.occurrenceId,
            zagreusDeclaration.key,
          );
          return Object.freeze({
            marker: input.markerDestinations.marker(owner),
            materialized: true,
            owner,
          });
        })();
  const chaosDeclaration = room.additionalExits.find((candidate) => candidate.kind === 'chaos');
  const chaosSpawn =
    chaosDeclaration === undefined ||
    !chaosDeclaration.canSpawn ||
    input.facts.authoredAdditionalExitKeys.includes(chaosDeclaration.key) ||
    !input.facts.detailsActive
      ? undefined
      : (() => {
          const owner = createAdditionalExitAddress(
            input.biome,
            input.occurrence.occurrenceId,
            chaosDeclaration.key,
          );
          return Object.freeze({
            authorable: input.facts.chaosPlacement?.placementEligible === true,
            marker: input.markerDestinations.marker(owner),
            owner,
          });
        })();
  return Object.freeze({
    features: roomFeatures(input, room, encounterPhases, zagreusSpawn, chaosSpawn),
    chaosSpawn,
    zagreusSpawn,
  });
}

function roomFeatures(
  input: WorkspaceOccurrenceFeaturesInput,
  room: RoomDeclaration,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  zagreusSpawn: WorkspaceRoomSummary['zagreusSpawn'],
  chaosSpawn: WorkspaceRoomSummary['chaosSpawn'],
): readonly WorkspaceRoomFeature[] {
  const authored = new Set(input.facts.authoredAdditionalExitKeys);
  const additionalOwner = (key: string) =>
    createAdditionalExitAddress(input.biome, input.occurrence.occurrenceId, key);
  const zagreus = room.additionalExits.find((candidate) => candidate.kind === 'zagreusContract');
  const chaos = room.additionalExits.find((candidate) => candidate.kind === 'chaos');
  const passive = encounterPhases.find((phase) => phase.nemesisFeature !== undefined);
  const poolOwner = createOccurrenceAddress(input.biome, input.occurrence.occurrenceId);
  const poolAssessment = input.purgingPoolAssessment?.(poolOwner);
  const shrineAssessment = input.hermesShrineAssessment?.(poolOwner);
  const wellAssessment = input.stygianWellAssessment?.(poolOwner);
  const shrine = input.occurrence.hermesShrine;
  const well = input.occurrence.stygianWell;
  const pool = input.occurrence.purgingPool;
  const declaredPoolTraitKeys = declaredPurgingPoolTraitKeys(input.catalog);
  const declaredWellAllItemKeys = declaredRoomShopAllItemKeys(input.catalog);
  const declaredWellTwistItemKeys = declaredRoomShopTwistItemKeys(input.catalog);
  const declaredShrineAllRewardTypes = declaredSurfaceShopAllRewardTypes(input.catalog);
  const poolSlotLabel = (slotKey: 'left' | 'middle' | 'right'): string =>
    slotKey === 'left' ? 'Offer 1' : slotKey === 'middle' ? 'Offer 2' : 'Offer 3';
  return Object.freeze([
    ...(room.roomShop === undefined && well === undefined && wellAssessment === undefined
      ? []
      : [
          (() => {
            const wellForced = room.roomShop?.forced === true || wellAssessment?.required === true;
            const wellPresence =
              well === undefined
                ? wellForced
                  ? Object.freeze({ kind: 'forcedPresent' as const })
                  : Object.freeze({
                      kind: 'optionalAbsent' as const,
                      enabled: wellAssessment?.placementEligible === true,
                    })
                : wellForced
                  ? Object.freeze({ kind: 'forcedPresent' as const })
                  : Object.freeze({ kind: 'optionalPresent' as const });
            const itemLabel = (itemKey: string): string =>
              input.catalog.rewards.shops.byKey.RoomShop?.groups.values
                .flatMap((group) => group.options.values)
                .find((option) => option.key === itemKey)?.label ?? itemKey;
            const purchased = new Set(well?.purchasedGenerationKeys ?? []);
            const initialSlots =
              well === undefined
                ? []
                : (['healing', 'secondLeft', 'secondRight'] as const).map((slotKey) => {
                    const generationKey = `initial:${slotKey}` as const;
                    const selected = well.offerKeyBySlot[slotKey];
                    const twistKey = well.twistResultKeyBySlot?.[slotKey] ?? null;
                    const twistCandidates =
                      wellAssessment?.twistCandidateItemKeysByGeneration[generationKey] ??
                      declaredWellTwistItemKeys;
                    return Object.freeze({
                      key: slotKey,
                      generationKey,
                      label:
                        input.catalog.rewards.shops.byKey.RoomShop?.slots.byKey[slotKey]?.label ??
                        slotKey,
                      itemKey: selected,
                      ...(selected === null ? {} : { itemLabel: itemLabel(selected) }),
                      candidateItemKeys:
                        wellAssessment?.candidateItemKeysBySlot[slotKey] ??
                        declaredRoomShopItemKeys(input.catalog, slotKey),
                      candidateItems: Object.freeze(
                        (
                          wellAssessment?.candidateItemKeysBySlot[slotKey] ??
                          declaredRoomShopItemKeys(input.catalog, slotKey)
                        ).map((key) => Object.freeze({ key, label: itemLabel(key) })),
                      ),
                      offerInteractionKey: `stygianWellOffer:${semanticAddressKey(poolOwner)}:${generationKey}`,
                      purchaseInteractionKey: `stygianWellPurchase:${semanticAddressKey(poolOwner)}:${generationKey}`,
                      purchased: purchased.has(generationKey),
                      ...(!purchased.has(generationKey) || selected !== 'RandomStoreItem'
                        ? {}
                        : {
                            twist: Object.freeze({
                              itemKey: twistKey,
                              ...(twistKey === null ? {} : { itemLabel: itemLabel(twistKey) }),
                              candidateItemKeys: twistCandidates,
                              candidateItems: Object.freeze(
                                twistCandidates.map((key) =>
                                  Object.freeze({ key, label: itemLabel(key) }),
                                ),
                              ),
                              interactionKey: `stygianWellTwist:${semanticAddressKey(poolOwner)}:${generationKey}`,
                            }),
                          }),
                    });
                  });
            const refill =
              well === undefined ||
              (well.travelDealRefillKey === undefined &&
                wellAssessment?.travelDealRefill === undefined)
                ? []
                : (() => {
                    const generationKey = 'travelDealRefill' as const;
                    const selected = well.travelDealRefillKey ?? null;
                    const twistKey = well.twistResultKeyBySlot?.travelDealRefill ?? null;
                    const candidates =
                      wellAssessment === undefined
                        ? declaredWellAllItemKeys
                        : (wellAssessment.travelDealRefill?.candidateItemKeys ?? Object.freeze([]));
                    const twistCandidates =
                      wellAssessment?.twistCandidateItemKeysByGeneration[generationKey] ??
                      declaredWellTwistItemKeys;
                    return [
                      Object.freeze({
                        key: 'travelDealRefill' as const,
                        generationKey,
                        label: 'Travel Deal',
                        itemKey: selected,
                        ...(selected === null ? {} : { itemLabel: itemLabel(selected) }),
                        candidateItemKeys: candidates,
                        candidateItems: Object.freeze(
                          candidates.map((key) => Object.freeze({ key, label: itemLabel(key) })),
                        ),
                        offerInteractionKey: `stygianWellOffer:${semanticAddressKey(poolOwner)}:${generationKey}`,
                        purchaseInteractionKey: `stygianWellPurchase:${semanticAddressKey(poolOwner)}:${generationKey}`,
                        purchased: purchased.has(generationKey),
                        ...(!purchased.has(generationKey) || selected !== 'RandomStoreItem'
                          ? {}
                          : {
                              twist: Object.freeze({
                                itemKey: twistKey,
                                ...(twistKey === null ? {} : { itemLabel: itemLabel(twistKey) }),
                                candidateItemKeys: twistCandidates,
                                candidateItems: Object.freeze(
                                  twistCandidates.map((key) =>
                                    Object.freeze({ key, label: itemLabel(key) }),
                                  ),
                                ),
                                interactionKey: `stygianWellTwist:${semanticAddressKey(poolOwner)}:${generationKey}`,
                              }),
                            }),
                      }),
                    ];
                  })();
            return Object.freeze({
              assessment: (wellAssessment === undefined
                ? 'unassessed'
                : 'assessed') as WorkspaceFeatureAssessment,
              kind: 'stygianWell' as const,
              presence: wellPresence,
              ...(wellPresence.kind === 'forcedPresent' ||
              (wellPresence.kind === 'optionalAbsent' && !wellPresence.enabled)
                ? {}
                : {
                    presenceInteractionKey: `stygianWellPresence:${semanticAddressKey(poolOwner)}`,
                  }),
              ...(well === undefined
                ? {}
                : { interactionKey: `stygianWellInteract:${semanticAddressKey(poolOwner)}` }),
              interacted: well?.interacted === true,
              slots: Object.freeze([...initialSlots, ...refill]),
            });
          })(),
        ]),
    ...(room.surfaceShop === undefined && shrine === undefined && shrineAssessment === undefined
      ? []
      : [
          (() => {
            const shrineForced =
              room.surfaceShop?.forced === true || shrineAssessment?.required === true;
            const shrinePresence =
              shrine === undefined
                ? shrineForced
                  ? Object.freeze({ kind: 'forcedPresent' as const })
                  : Object.freeze({
                      kind: 'optionalAbsent' as const,
                      enabled: shrineAssessment?.placementEligible === true,
                    })
                : shrineForced
                  ? Object.freeze({ kind: 'forcedPresent' as const })
                  : Object.freeze({ kind: 'optionalPresent' as const });
            return Object.freeze({
              assessment: (shrineAssessment === undefined
                ? 'unassessed'
                : 'assessed') as WorkspaceFeatureAssessment,
              kind: 'hermesShrine' as const,
              presence: shrinePresence,
              ...(shrinePresence.kind === 'forcedPresent' ||
              (shrinePresence.kind === 'optionalAbsent' && !shrinePresence.enabled)
                ? {}
                : {
                    presenceInteractionKey: `hermesShrinePresence:${semanticAddressKey(poolOwner)}`,
                  }),
              slots: Object.freeze(
                shrine === undefined
                  ? []
                  : (['first', 'secondLeft', 'secondRight'] as const).map((slotKey) => {
                      const generationKey = `initial:${slotKey}` as const;
                      return Object.freeze({
                        key: slotKey,
                        label:
                          input.catalog.rewards.shops.byKey.SurfaceShop?.slots.byKey[slotKey]
                            ?.label ?? slotKey,
                        rewardType: shrine.offerBySlot[slotKey]?.rewardType ?? null,
                        ...(shrine.offerBySlot[slotKey] === null
                          ? {}
                          : {
                              rewardLabel:
                                input.catalog.rewards.rewardTypes.byKey[
                                  shrine.offerBySlot[slotKey]!.rewardType
                                ]?.label ?? shrine.offerBySlot[slotKey]!.rewardType,
                            }),
                        candidateRewardTypes:
                          shrineAssessment?.candidateRewardTypesBySlot[slotKey] ??
                          declaredSurfaceShopRewardTypes(input.catalog, slotKey),
                        candidateRewards: Object.freeze(
                          (
                            shrineAssessment?.candidateRewardTypesBySlot[slotKey] ??
                            declaredSurfaceShopRewardTypes(input.catalog, slotKey)
                          ).map((rewardType) =>
                            Object.freeze({
                              rewardType,
                              label:
                                input.catalog.rewards.rewardTypes.byKey[rewardType]?.label ??
                                rewardType,
                            }),
                          ),
                        ),
                        offerInteractionKey: `hermesShrineOffer:${semanticAddressKey(poolOwner)}:${slotKey}`,
                        purchaseInteractionKey: `hermesShrinePurchase:${semanticAddressKey(poolOwner)}:${generationKey}`,
                        purchase: shrine.purchaseBySlot?.[slotKey] ?? null,
                      });
                    }),
              ),
              ...(shrine === undefined ||
              (shrine.travelDealRefill === undefined &&
                shrineAssessment?.travelDealRefill === undefined)
                ? {}
                : {
                    travelDealRefill: Object.freeze({
                      rewardType: shrine.travelDealRefill?.offer?.rewardType ?? null,
                      ...(shrine.travelDealRefill?.offer === null ||
                      shrine.travelDealRefill?.offer === undefined
                        ? {}
                        : {
                            rewardLabel:
                              input.catalog.rewards.rewardTypes.byKey[
                                shrine.travelDealRefill.offer.rewardType
                              ]?.label ?? shrine.travelDealRefill.offer.rewardType,
                          }),
                      candidateRewardTypes:
                        shrineAssessment === undefined
                          ? declaredShrineAllRewardTypes
                          : (shrineAssessment.travelDealRefill?.candidateRewardTypes ??
                            Object.freeze([])),
                      candidateRewards: Object.freeze(
                        (shrineAssessment === undefined
                          ? declaredShrineAllRewardTypes
                          : (shrineAssessment.travelDealRefill?.candidateRewardTypes ??
                            Object.freeze([]))
                        ).map((rewardType) =>
                          Object.freeze({
                            rewardType,
                            label:
                              input.catalog.rewards.rewardTypes.byKey[rewardType]?.label ??
                              rewardType,
                          }),
                        ),
                      ),
                      offerInteractionKey: `hermesShrineOffer:${semanticAddressKey(poolOwner)}:travelDealRefill`,
                      purchaseInteractionKey: `hermesShrinePurchase:${semanticAddressKey(poolOwner)}:travelDealRefill`,
                      purchase: shrine.travelDealRefill?.purchase ?? null,
                    }),
                  }),
            });
          })(),
        ]),
    ...(pool === undefined
      ? []
      : [
          Object.freeze({
            assessment: (poolAssessment === undefined
              ? 'unassessed'
              : 'assessed') as WorkspaceFeatureAssessment,
            kind: 'purgingPool' as const,
            interactionKey: `purgingPool:${semanticAddressKey(poolOwner)}`,
            interacted: pool.interacted,
            slots: Object.freeze(
              (['left', 'middle', 'right'] as const).map((slotKey) =>
                (() => {
                  const candidateTraitKeys =
                    poolAssessment?.candidateTraitKeysBySlot[slotKey] ?? declaredPoolTraitKeys;
                  const traitKey = pool.traitKeyBySlot[slotKey];
                  const sold = input.occurrence.roomActions.order.some(
                    (reference) =>
                      reference.kind === 'sellPurgingPoolTrait' && reference.slotKey === slotKey,
                  );
                  return Object.freeze({
                    candidateTraitKeys,
                    candidateTraits: Object.freeze(
                      candidateTraitKeys.map((key) =>
                        Object.freeze({
                          key,
                          label: input.catalog.traits.byKey[key]?.label ?? key,
                        }),
                      ),
                    ),
                    interactionKey: `purgingPool:${semanticAddressKey(poolOwner)}:${slotKey}`,
                    key: slotKey,
                    label: poolSlotLabel(slotKey),
                    ...(traitKey === null ? {} : { sale: Object.freeze({ sold }) }),
                    traitKey,
                    ...(traitKey === null
                      ? {}
                      : { traitLabel: input.catalog.traits.byKey[traitKey]?.label ?? traitKey }),
                  });
                })(),
              ),
            ),
          }),
        ]),
    ...(room.mode.kind === 'authored' &&
    room.mode.templateKey === 'FieldsCombat' &&
    passive?.nemesisFeature !== undefined
      ? [
          Object.freeze({
            kind: 'nemesisEvent' as const,
            action: (passive.nemesisFeature.selected ? 'remove' : 'add') as 'add' | 'remove',
            interactionKey: workspaceInteractionKey(passive.address),
          }),
        ]
      : []),
    ...(zagreusSpawn?.materialized === true
      ? [
          Object.freeze({
            kind: 'zagreusContract' as const,
            action: 'add' as const,
            presence: Object.freeze({
              kind: 'optionalAbsent' as const,
              enabled: input.facts.zagreusContractPlacement?.placementEligible === true,
            }),
            control: zagreusSpawn,
          }),
        ]
      : zagreus !== undefined && authored.has(zagreus.key)
        ? [
            Object.freeze({
              kind: 'zagreusContract' as const,
              action: 'remove' as const,
              presence: Object.freeze({ kind: 'optionalPresent' as const }),
              owner: additionalOwner(zagreus.key),
            }),
          ]
        : []),
    ...(chaosSpawn !== undefined
      ? [
          Object.freeze({
            kind: 'chaos' as const,
            action: 'add' as const,
            presence: Object.freeze({
              kind: 'optionalAbsent' as const,
              enabled: chaosSpawn.authorable,
            }),
            control: chaosSpawn,
          }),
        ]
      : chaos !== undefined && authored.has(chaos.key)
        ? [
            Object.freeze({
              kind: 'chaos' as const,
              action: 'remove' as const,
              presence: Object.freeze({
                kind: input.facts.chaosGateForced
                  ? ('forcedPresent' as const)
                  : ('optionalPresent' as const),
              }),
              owner: additionalOwner(chaos.key),
            }),
          ]
        : []),
  ]);
}

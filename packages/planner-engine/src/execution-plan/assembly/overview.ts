import {
  createBiomeAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../authored-project/addresses';
import { roomActionKey } from '../../authored-project/room-actions';
import type { AuthoredKeepsakeEquipResults } from '../../authored-project/model';
import type { CompleteValidBiomeProjectEvaluation } from '../../simulation/evaluation-products';
import type { CanonicalAuthoredRoom, CanonicalBatch } from '../../simulation/materialization';
import type { RewardEvent } from '../../simulation/rewards/model';
import type { TraitHistoryEvent } from '../../simulation/trait-history';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import { agreement, executionRoomOwnerKey, stableJson } from './support';
import type {
  ExecutionKeepsakeEquipResults,
  ExecutionOverview,
  ExecutionReward,
  ExecutionRuntimeFallback,
} from '../model';
import type { RuntimeOfferAvailabilityContact } from '../../simulation/runtime-offer-fallback';

export function executionRuntimeFallbacks(
  biome: CompleteValidBiomeProjectEvaluation,
  address: SemanticAddress,
  availabilityContact?: RuntimeOfferAvailabilityContact,
): readonly ExecutionRuntimeFallback[] | undefined {
  const matches = biome.rewards.runtimeOfferFallbacks.filter(
    (candidate) =>
      semanticAddressKey(candidate.address) === semanticAddressKey(address) &&
      (availabilityContact === undefined || candidate.availabilityContact === availabilityContact),
  );
  if (matches.length === 0) return undefined;
  const preferredKeys = matches.map((fallback) => fallback.preferredKey);
  if (new Set(preferredKeys).size !== preferredKeys.length)
    throw new CompilerError(
      'executionCoverageMissing',
      `duplicate runtime fallback preference ${semanticAddressKey(address)}`,
    );
  if (
    matches.some(
      (fallback) =>
        fallback.preferredKey === fallback.fallbackKey ||
        preferredKeys.includes(fallback.fallbackKey),
    )
  )
    throw new CompilerError(
      'executionCoverageMissing',
      `runtime fallback must be one step ${semanticAddressKey(address)}`,
    );
  return Object.freeze(
    matches.map((fallback) =>
      Object.freeze({
        preferredKey: fallback.preferredKey,
        fallbackKey: fallback.fallbackKey,
        availabilityContact: fallback.availabilityContact,
      }),
    ),
  );
}

export function executionKeepsakeEquipResults(
  results: AuthoredKeepsakeEquipResults | undefined,
  jeweledPomRuntimeFallbacks?: readonly ExecutionRuntimeFallback[],
): ExecutionKeepsakeEquipResults | undefined {
  if (results === undefined) return undefined;
  return Object.freeze({
    ...(results.jeweledPom === undefined
      ? {}
      : {
          jeweledPom: Object.freeze({
            ...results.jeweledPom,
            ...(jeweledPomRuntimeFallbacks === undefined
              ? {}
              : { runtimeFallbacks: jeweledPomRuntimeFallbacks }),
          }),
        }),
    ...(results.experimentalHammer === undefined
      ? {}
      : { experimentalHammer: Object.freeze({ ...results.experimentalHammer }) }),
    ...(results.transcendentEmbryo === undefined
      ? {}
      : { transcendentEmbryo: Object.freeze({ ...results.transcendentEmbryo }) }),
  });
}

export function executionReward(room: CanonicalAuthoredRoom): ExecutionReward | undefined {
  const incoming = room.incomingReward;
  if (incoming === undefined) return undefined;
  return executionRewardFromOffer(
    incoming.offer,
    incoming.producerLifecycleKey,
    incoming.resolvedStoreKey,
    incoming.acquisitionEnabled,
  );
}

export function executionRewardFromOffer(
  offer: ResolvedRewardOffer,
  producerLifecycleKey: string,
  resolvedStoreKey?: string,
  acquisitionEnabled?: boolean,
): ExecutionReward {
  const payload = offer.payload;
  return Object.freeze({
    rewardType: offer.rewardType,
    producerLifecycleKey,
    ...(resolvedStoreKey === undefined ? {} : { resolvedStoreKey }),
    ...(acquisitionEnabled === undefined || acquisitionEnabled
      ? {}
      : { acquisitionEnabled: false }),
    ...(payload?.kind === 'BoonSource' ? { source: payload.source } : {}),
    ...(payload?.kind === 'DevotionPair'
      ? { source: payload.chosenSource, spurnedSource: payload.spurnedSource }
      : {}),
  });
}

export function executionResources(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
): ExecutionOverview['resources'] | undefined {
  const owner = executionRoomOwnerKey(room);
  const rows = biome.rewards.branches.map((branch) =>
    (branch.traitHistory?.events ?? [])
      .filter(
        (event): event is Extract<TraitHistoryEvent, { readonly kind: 'elementContribution' }> =>
          event.kind === 'elementContribution' &&
          semanticAddressKey(event.owner) === owner &&
          event.acquisitionPoint === 'roomExited' &&
          event.acquisitionRole.startsWith('resource:'),
      )
      .map((event) =>
        Object.freeze({
          acquisitionRole: event.acquisitionRole,
          grantedTraitKey: event.acquisitionRole.slice('resource:'.length),
          contributions: Object.freeze({ ...event.contributions }),
        }),
      ),
  );
  const first = rows[0];
  if (first === undefined || first.length === 0) return undefined;
  if (rows.some((row) => stableJson(row) !== stableJson(first)))
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} has divergent successful resource outcomes`,
    );
  return Object.freeze(first);
}

export function shopOptionKeys(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
) {
  const owner = executionRoomOwnerKey(room);
  const offerCount = room.entryState?.offers.length ?? 0;
  const rows = biome.rewards.branches.map((branch) =>
    branch.events
      .filter(
        (event): event is Extract<RewardEvent, { readonly kind: 'shopInventorySupported' }> =>
          event.kind === 'shopInventorySupported' && semanticAddressKey(event.origin) === owner,
      )
      .map((event) => event.optionKeys),
  );
  const first = rows[0]?.[0];
  if (
    first === undefined ||
    first.length !== offerCount ||
    rows.some((row) => row.length !== 1 || row[0]?.length !== offerCount)
  )
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Shop inventory evidence`,
    );
  return agreement(
    rows.map((row) => row[0]),
    `${room.gameName} Shop option order`,
  )!;
}

export function travelDealRefill(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
  offers: readonly { readonly offerKey: string }[],
):
  | {
      readonly sourceOfferKey: string;
      readonly slotIndex: number;
      readonly optionKey: string;
      readonly reward: ExecutionReward;
    }
  | undefined {
  const rows = biome.rewards.derivedAcquisitionEntries.filter(
    (entry) =>
      entry.kind === 'travelDealRefill' &&
      entry.sourceOfferKey !== undefined &&
      offers.some((offer) => offer.offerKey === entry.sourceOfferKey),
  );
  if (rows.length === 0) return undefined;
  const row = rows[0]!;
  agreement(
    rows.map((candidate) =>
      Object.freeze({
        address: semanticAddressKey(candidate.address),
        sourceOfferKey: candidate.sourceOfferKey,
        slotIndex: candidate.slotIndex,
      }),
    ),
    `${room.gameName} Travel Deal refill`,
  );
  if (row.sourceOfferKey === undefined || row.slotIndex === undefined)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Travel Deal source`,
    );
  const entry = Object.values(room.acquisitionSites)
    .map((site) => site.entries.travelDealRefill)
    .find((candidate) => candidate !== undefined);
  if (entry === undefined || entry === null)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Travel Deal result`,
    );
  const optionRows = biome.rewards.branches.map((branch) =>
    branch.events
      .filter(
        (event): event is Extract<RewardEvent, { readonly kind: 'shopInventorySupported' }> =>
          event.kind === 'shopInventorySupported' &&
          semanticAddressKey(event.origin) === semanticAddressKey(row.address),
      )
      .map((event) => event.optionKeys[row.slotIndex!]),
  );
  const optionKey = agreement(
    optionRows.map((options) => {
      if (options.length !== 1 || options[0] === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} lacks Travel Deal option`,
        );
      return options[0];
    }),
    `${room.gameName} Travel Deal option`,
  );
  return Object.freeze({
    sourceOfferKey: row.sourceOfferKey,
    slotIndex: row.slotIndex,
    optionKey,
    reward: executionRewardFromOffer(entry.offer, 'Shop'),
    ...(executionRuntimeFallbacks(biome, row.address, 'storeInventoryGeneration') === undefined
      ? {}
      : {
          runtimeFallbacks: executionRuntimeFallbacks(
            biome,
            row.address,
            'storeInventoryGeneration',
          ),
        }),
  });
}

function executionAdditionalExits(
  batch: CanonicalBatch | undefined,
): ExecutionOverview['additional'] | undefined {
  if (batch === undefined || batch.additional.length === 0) return undefined;
  return Object.freeze(
    batch.additional.map((exit) =>
      Object.freeze({
        kind: exit.key,
        owner: semanticAddressKey(exit.origin),
        room: Object.freeze({
          id: exit.room.occurrenceId,
          biomeKey: exit.room.origin.biomeKey,
          gameName: exit.room.gameName,
        }),
        ...(exit.chaosOrigin === undefined
          ? {}
          : {
              ixionOrigin: Object.freeze({
                sourceBiomeKey: exit.chaosOrigin.sourceBiomeKey,
                sourceOccurrenceId: exit.chaosOrigin.sourceOccurrenceId,
                generationKey: exit.chaosOrigin.generationKey,
              }),
            }),
      }),
    ),
  );
}

function executionShop(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
): ExecutionOverview['shop'] | undefined {
  if (room.entryState === undefined) return undefined;
  const optionKeys = shopOptionKeys(room, biome);
  const offers = Object.freeze(
    room.entryState.offers.map((offer, index) => {
      const address = createShopOfferAddress(
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        room.occurrenceId,
        offer.offerKey,
      );
      const runtimeFallbacks = executionRuntimeFallbacks(
        biome,
        address,
        'storeInventoryGeneration',
      );
      return Object.freeze({
        offerKey: offer.offerKey,
        optionKey: optionKeys[index]!,
        rewardType: offer.offer.rewardType,
        ...(offer.offer.payload?.kind === 'BoonSource'
          ? { source: offer.offer.payload.source }
          : {}),
        ...(offer.offer.payload?.kind === 'DevotionPair'
          ? {
              source: offer.offer.payload.chosenSource,
              spurnedSource: offer.offer.payload.spurnedSource,
            }
          : {}),
        ...(runtimeFallbacks === undefined ? {} : { runtimeFallbacks }),
      });
    }),
  );
  const refill = travelDealRefill(room, biome, offers);
  return Object.freeze({
    profileKey: room.entryState.profileKey,
    offers,
    ...(refill === undefined ? {} : { travelDealRefill: refill }),
  });
}

function executionStygianWell(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
): ExecutionOverview['stygianWell'] | undefined {
  if (room.stygianWell === undefined) return undefined;
  return Object.freeze({
    interacted: room.stygianWell.interacted,
    ...(room.stygianWell.interacted
      ? {
          offers: Object.freeze(
            (
              [
                [
                  'initial:healing',
                  room.stygianWell.offerKeyBySlot.healing,
                  room.stygianWell.twistResultKeyBySlot?.healing,
                ],
                [
                  'initial:secondLeft',
                  room.stygianWell.offerKeyBySlot.secondLeft,
                  room.stygianWell.twistResultKeyBySlot?.secondLeft,
                ],
                [
                  'initial:secondRight',
                  room.stygianWell.offerKeyBySlot.secondRight,
                  room.stygianWell.twistResultKeyBySlot?.secondRight,
                ],
                [
                  'travelDealRefill',
                  room.stygianWell.travelDealRefillKey,
                  room.stygianWell.twistResultKeyBySlot?.travelDealRefill,
                ],
              ] as const
            ).flatMap(([generationKey, offerKey, twistResultKey]) => {
              if (offerKey === null || offerKey === undefined) return [];
              const actionOwner = createRoomActionAddress(
                createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
                room.occurrenceId,
                roomActionKey(
                  Object.freeze({
                    kind: 'purchaseStygianWellOffer' as const,
                    generationKey,
                  }),
                ),
              );
              const runtimeFallbacks = executionRuntimeFallbacks(
                biome,
                actionOwner,
                'storeInventoryGeneration',
              );
              return [
                Object.freeze({
                  generationKey,
                  offerKey,
                  ...(twistResultKey === undefined || twistResultKey === null
                    ? {}
                    : { twistResultKey }),
                  ...(runtimeFallbacks === undefined ? {} : { runtimeFallbacks }),
                }),
              ];
            }),
          ),
        }
      : {}),
  });
}

function executionPurgingPool(
  room: CanonicalAuthoredRoom,
): ExecutionOverview['purgingPool'] | undefined {
  if (room.purgingPool === undefined) return undefined;
  return Object.freeze({
    interacted: room.purgingPool.interacted,
    ...(room.purgingPool.interacted
      ? {
          traits: Object.freeze(
            (['left', 'middle', 'right'] as const).map((slotKey) =>
              Object.freeze({
                slotKey,
                traitKey: room.purgingPool!.traitKeyBySlot[slotKey],
              }),
            ),
          ),
        }
      : {}),
  });
}

/** Assemble the complete room-entry realization facts for one occurrence. */
export function assembleExecutionOverview(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
  batch: CanonicalBatch | undefined,
): ExecutionOverview {
  const incomingReward = executionReward(room);
  const shop = executionShop(room, biome);
  const stygianWell = executionStygianWell(room, biome);
  const purgingPool = executionPurgingPool(room);
  const resources = executionResources(room, biome);
  const additional = executionAdditionalExits(batch);
  return Object.freeze({
    ...(incomingReward === undefined ? {} : { incomingReward }),
    ...(room.effectNeutralRequiredReward ? { effectNeutralRequiredReward: true as const } : {}),
    encounterPhases: Object.freeze(
      room.encounterPhases.map((phase) =>
        Object.freeze({
          slotKey: phase.slotKey,
          encounterKey: phase.encounterKey,
          kind: phase.kind,
        }),
      ),
    ),
    requiredObjects: Object.freeze((room.requiredObjects ?? []).map((object) => object.key)),
    ...(shop === undefined ? {} : { shop }),
    ...(stygianWell === undefined ? {} : { stygianWell }),
    ...(purgingPool === undefined ? {} : { purgingPool }),
    ...(!room.hasKeepsakeRack
      ? {}
      : {
          keepsakeRack: Object.freeze(
            room.keepsakeRack === undefined ? {} : { keepsakeKey: room.keepsakeRack.keepsakeKey },
          ),
        }),
    ...(!room.hasRequiredFountain
      ? {}
      : {
          fountain: Object.freeze(
            room.fountainRarityResult === undefined
              ? {}
              : { aromaticPhialTarget: room.fountainRarityResult.targetTraitKey },
          ),
        }),
    ...(resources === undefined ? {} : { resources }),
    ...(additional === undefined ? {} : { additional }),
  });
}

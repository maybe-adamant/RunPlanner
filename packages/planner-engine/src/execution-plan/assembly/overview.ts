import {
  createAcquisitionEntryAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  semanticAddressKey,
} from '../../authored-project/addresses';
import { hermesShrineDeliveryEntryKey } from '../../authored-project/hermes-shrine-delivery';
import { INFERNAL_CONTRACT_ENTRY_KEY } from '../../authored-project/shop';
import type { AuthoredKeepsakeEquipResults } from '../../authored-project/model';
import type { CompleteValidBiomeProjectEvaluation } from '../../simulation/evaluation-products';
import type { CanonicalAuthoredRoom, CanonicalBatch } from '../../simulation/materialization';
import type { RewardEvent } from '../../simulation/rewards/model';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import { agreement, executionRoomOwnerKey } from './support';
import type { ExecutionKeepsakeEquipResults, ExecutionOverview, ExecutionReward } from '../model';
import type { HermesShrineGenerationKey, HermesShrineSlotKey } from '../../authored-project/model';

export function executionKeepsakeEquipResults(
  results: AuthoredKeepsakeEquipResults | undefined,
): ExecutionKeepsakeEquipResults | undefined {
  if (results === undefined) return undefined;
  return Object.freeze({
    ...(results.jeweledPom === undefined
      ? {}
      : {
          jeweledPom: Object.freeze({
            ...results.jeweledPom,
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
      readonly sourceOwner: string;
      readonly slotIndex: number;
      readonly groupIndex: number;
      readonly optionKey: string;
      readonly reward: ExecutionReward;
    }
  | undefined {
  const entryLocation = Object.values(room.acquisitionSites)
    .map((site) => Object.freeze({ site, entry: site.entries.travelDealRefill }))
    .find((candidate) => candidate.entry !== undefined);
  const entry = entryLocation?.entry;
  if (entryLocation === undefined || entry === undefined) return undefined;
  if (entry === null)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Travel Deal result`,
    );
  const entryAddress = createAcquisitionEntryAddress(
    entryLocation.site.address,
    'travelDealRefill',
  );
  const rows = biome.rewards.derivedAcquisitionEntries.filter(
    (candidate) =>
      candidate.kind === 'travelDealRefill' &&
      semanticAddressKey(candidate.address) === semanticAddressKey(entryAddress) &&
      candidate.sourceOfferKey !== undefined &&
      offers.some((offer) => offer.offerKey === candidate.sourceOfferKey),
  );
  if (rows.length === 0)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Travel Deal source`,
    );
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
  const optionRows = biome.rewards.branches.map((branch) =>
    branch.events
      .filter(
        (event): event is Extract<RewardEvent, { readonly kind: 'shopInventorySupported' }> =>
          event.kind === 'shopInventorySupported' &&
          semanticAddressKey(event.origin) === semanticAddressKey(room.origin),
      )
      .map((event) => event.optionKeys[row.slotIndex!]),
  );
  const groupRows = biome.rewards.branches.map((branch) =>
    branch.events
      .filter(
        (event): event is Extract<RewardEvent, { readonly kind: 'shopInventorySupported' }> =>
          event.kind === 'shopInventorySupported' &&
          semanticAddressKey(event.origin) === semanticAddressKey(room.origin),
      )
      .map((event) => event.slotGroupIndexes[row.slotIndex!]),
  );
  const groupIndex = agreement(
    groupRows.map((groups) => {
      const value = groups[0];
      if (groups.length !== 1 || value === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} lacks Travel Deal native group`,
        );
      return value;
    }),
    `${room.gameName} Travel Deal native group`,
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
    sourceOwner: semanticAddressKey(entryAddress),
    slotIndex: row.slotIndex,
    groupIndex,
    optionKey,
    reward: executionRewardFromOffer(entry.offer, 'Shop'),
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
    room.entryState.offers.map((offer, index) =>
      Object.freeze({
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
      }),
    ),
  );
  const refill = travelDealRefill(room, biome, offers);
  const contractEntry = room.acquisitionSites.roomExit?.entries[INFERNAL_CONTRACT_ENTRY_KEY];
  const contract =
    contractEntry === undefined || contractEntry === null
      ? undefined
      : Object.freeze({
          sourceOwner: semanticAddressKey(
            createAcquisitionEntryAddress(
              room.acquisitionSites.roomExit!.address,
              INFERNAL_CONTRACT_ENTRY_KEY,
            ),
          ),
          rewardType: contractEntry.offer.rewardType,
        });
  return Object.freeze({
    profileKey: room.entryState.profileKey,
    offers,
    ...(refill === undefined ? {} : { travelDealRefill: refill }),
    ...(contract === undefined ? {} : { infernalContract: contract }),
  });
}

function executionHermesShrine(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
): ExecutionOverview['hermesShrine'] | undefined {
  const shrine = room.hermesShrine;
  if (shrine === undefined) return undefined;
  const owner = executionRoomOwnerKey(room);
  const assessments = biome.rewards.hermesShrineAssessments.find(
    (candidate) => semanticAddressKey(candidate.origin) === owner,
  )?.assessments;
  if (assessments === undefined || assessments.length === 0)
    throw new CompilerError('executionCoverageMissing', `${room.gameName} lacks Shrine assessment`);
  const slotRows = [
    ['first', 1],
    ['secondLeft', 2],
    ['secondRight', 3],
  ] as const satisfies readonly [HermesShrineSlotKey, 1 | 2 | 3][];
  const optionKeys = agreement(
    assessments.map((assessment) =>
      slotRows.map(([slotKey]) => {
        const optionKey = assessment.inventory?.optionKeysBySlot[slotKey];
        if (optionKey === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `${room.gameName} lacks Shrine option ${slotKey}`,
          );
        return optionKey;
      }),
    ),
    `${room.gameName} Shrine option order`,
  );
  const offers = Object.freeze(
    slotRows.map(([slotKey, slotIndex], index) => {
      const offer = shrine.offerBySlot[slotKey];
      if (offer === null)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} lacks Shrine offer ${slotKey}`,
        );
      const purchase = shrine.purchaseBySlot?.[slotKey];
      return Object.freeze({
        generationKey: `initial:${slotKey}` as Exclude<
          HermesShrineGenerationKey,
          'travelDealRefill'
        >,
        optionKey: optionKeys[index]!,
        rewardType: offer.rewardType,
        slotIndex,
        ...(purchase === undefined
          ? {}
          : {
              deliverySourceKey: hermesShrineDeliveryEntryKey(
                room.origin,
                `initial:${slotKey}` as Exclude<HermesShrineGenerationKey, 'travelDealRefill'>,
              ),
            }),
        ...(purchase === undefined
          ? {}
          : { purchase: Object.freeze({ roomDelay: purchase.delay, rushed: purchase.rushed }) }),
      });
    }),
  );
  const refillOffer = shrine.travelDealRefill?.offer;
  const refillEvidence =
    refillOffer === undefined || refillOffer === null
      ? undefined
      : agreement(
          assessments.map((assessment) => {
            const refill = assessment.travelDealRefill;
            const optionKey = refill?.candidateOptionKeysByRewardType[refillOffer.rewardType];
            if (refill === undefined || optionKey === undefined)
              throw new CompilerError(
                'executionCoverageMissing',
                `${room.gameName} lacks native SurfaceShop option ${refillOffer.rewardType}`,
              );
            return Object.freeze({
              sourceGenerationKey: refill.sourceGenerationKey,
              optionKey,
            });
          }),
          `${room.gameName} Shrine Travel Deal refill`,
        );
  const refill =
    refillEvidence === undefined || refillOffer === undefined || refillOffer === null
      ? undefined
      : Object.freeze({
          sourceGenerationKey: refillEvidence.sourceGenerationKey as Exclude<
            HermesShrineGenerationKey,
            'travelDealRefill'
          >,
          slotIndex: (
            {
              'initial:first': 1,
              'initial:secondLeft': 2,
              'initial:secondRight': 3,
            } as const
          )[
            refillEvidence.sourceGenerationKey as Exclude<
              HermesShrineGenerationKey,
              'travelDealRefill'
            >
          ],
          optionKey: refillEvidence.optionKey,
          rewardType: refillOffer.rewardType,
          ...(shrine.travelDealRefill?.purchase === undefined
            ? {}
            : {
                deliverySourceKey: hermesShrineDeliveryEntryKey(room.origin, 'travelDealRefill'),
              }),
          ...(shrine.travelDealRefill?.purchase === undefined
            ? {}
            : {
                purchase: Object.freeze({
                  roomDelay: shrine.travelDealRefill.purchase.delay,
                  rushed: shrine.travelDealRefill.purchase.rushed,
                }),
              }),
        });
  return Object.freeze({
    offers,
    ...(refill === undefined ? {} : { travelDealRefill: refill }),
  });
}

function executionStygianWell(
  room: CanonicalAuthoredRoom,
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
              return [
                Object.freeze({
                  generationKey,
                  offerKey,
                  ...(twistResultKey === undefined || twistResultKey === null
                    ? {}
                    : { twistResultKey }),
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
  const hermesShrine = executionHermesShrine(room, biome);
  const stygianWell = executionStygianWell(room);
  const purgingPool = executionPurgingPool(room);
  const additional = executionAdditionalExits(batch);
  const biomeAddress = createBiomeAddress(room.origin.routeKey, room.origin.biomeKey);
  return Object.freeze({
    ...(incomingReward === undefined ? {} : { incomingReward }),
    ...(room.effectNeutralRequiredReward ? { effectNeutralRequiredReward: true as const } : {}),
    ...(room.unmodeledEncounterKeys === undefined
      ? {}
      : { unmodeledEncounterKeys: room.unmodeledEncounterKeys }),
    encounterPhases: Object.freeze(
      room.encounterPhases.map((phase) =>
        (() => {
          const phaseAddress = createEncounterPhaseAddress(
            biomeAddress,
            { kind: 'occurrence', occurrenceId: room.occurrenceId },
            phase.slotKey,
          );
          const figLeaf = biome.rewards.figLeafPhaseCandidates.find(
            (candidate) =>
              candidate.supported &&
              semanticAddressKey(candidate.origin) === semanticAddressKey(phaseAddress),
          );
          return Object.freeze({
            slotKey: phase.slotKey,
            encounterKey: phase.encounterKey,
            kind: phase.kind,
            ...(figLeaf === undefined ? {} : { figLeafSkip: figLeaf.selected }),
          });
        })(),
      ),
    ),
    requiredObjects: Object.freeze((room.requiredObjects ?? []).map((object) => object.key)),
    ...(shop === undefined ? {} : { shop }),
    ...(hermesShrine === undefined ? {} : { hermesShrine }),
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
    ...(additional === undefined ? {} : { additional }),
  });
}

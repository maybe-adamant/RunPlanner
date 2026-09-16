import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createTravelDealRefillRealizationAddress,
  semanticAddressKey,
} from '../../authored-project/addresses';
import { hermesShrineDeliveryEntryKey } from '../../authored-project/hermes-shrine-delivery';
import type { AuthoredKeepsakeEquipResults } from '../../authored-project/model';
import type { CompleteValidBiomeProjectEvaluation } from '../../simulation/evaluation/evaluation-products';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalFieldsEntryPair,
} from '../../simulation/materialization';
import type { RewardEvent } from '../../simulation/rewards/model';
import type { ResolvedRewardOffer } from '../../reward-kernel';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import { agreement, executionRoomOwnerKey } from './support';
import type {
  ExecutionFieldsLayout,
  ExecutionKeepsakeEquipResults,
  ExecutionOverview,
  ExecutionReward,
  ExecutionTimelineTransaction,
  ExecutionTravelDealRefill,
} from '../model';
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
  if (room.clockworkReward === 'goal') {
    return Object.freeze({
      rewardType: 'ClockworkGoal',
      producerLifecycleKey: 'ClockworkGoalRoom',
    });
  }
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
      readonly owner: string;
      readonly refill: Extract<ExecutionTravelDealRefill, { readonly carrier: 'worldShop' }>;
    }
  | undefined {
  const rows = biome.rewards.derivedAcquisitionEntries.filter(
    (candidate) =>
      candidate.kind === 'travelDealRefill' &&
      semanticAddressKey(candidate.address.site.owner) === semanticAddressKey(room.origin),
  );
  if (rows.length === 0) return undefined;
  const row = rows[0]!;
  const entry = room.entryState?.kind === 'shop' ? room.entryState.travelDealRefill : undefined;
  if (entry === undefined || entry === null)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Travel Deal result`,
    );
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
  if (
    row.sourceOfferKey === undefined ||
    row.slotIndex === undefined ||
    !offers.some((offer) => offer.offerKey === row.sourceOfferKey)
  )
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Travel Deal source`,
    );
  const sourceAction = room.roomActionRoster.rows.find(
    (candidate) =>
      !candidate.stale &&
      candidate.rank !== null &&
      candidate.reference.kind === 'interactShopOffer' &&
      candidate.reference.offerKey === row.sourceOfferKey,
  );
  if (sourceAction === undefined)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Travel Deal source action ${row.sourceOfferKey}`,
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
  const optionKey = entry.optionKey;
  if (optionKey === null)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Travel Deal option`,
    );
  return Object.freeze({
    owner: semanticAddressKey(
      createTravelDealRefillRealizationAddress(
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        room.occurrenceId,
      ),
    ),
    refill: Object.freeze({
      carrier: 'worldShop' as const,
      source: Object.freeze({
        owner: semanticAddressKey(sourceAction.owner),
        offerKey: row.sourceOfferKey,
      }),
      replacement: Object.freeze({
        slotIndex: row.slotIndex,
        groupIndex,
        optionKey,
        reward: executionRewardFromOffer(entry.offer, 'Shop'),
      }),
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

/** The destination-navigation input copied from this occurrence's canonical additional exits. */
export function zagreusContractPresent(batch: CanonicalBatch | undefined): boolean {
  return batch?.additional.some((exit) => exit.key === 'zagreusContract') ?? false;
}

function executionShop(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
  transactions: readonly ExecutionTimelineTransaction[],
): ExecutionOverview['shop'] | undefined {
  if (room.entryState === undefined) return undefined;
  const optionKeys = shopOptionKeys(room, biome);
  const transactionByOwner = new Map(
    transactions.map((transaction) => [transaction.owner, transaction]),
  );
  const transactionOwnerByOffer = new Map(
    room.roomLifecycleTimeline.entries.flatMap((entry) =>
      entry.kind === 'action' && entry.action.reference.kind === 'interactShopOffer'
        ? [[entry.action.reference.offerKey, semanticAddressKey(entry.action.owner)] as const]
        : [],
    ),
  );
  const offers = Object.freeze(
    room.entryState.offers.map((offer, index) =>
      (() => {
        const actionOwner = transactionOwnerByOffer.get(offer.offerKey);
        const transaction =
          actionOwner === undefined ? undefined : transactionByOwner.get(actionOwner);
        return Object.freeze({
          offerKey: offer.offerKey,
          ...(transaction === undefined ? {} : { transactionOwner: transaction.owner }),
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
        });
      })(),
    ),
  );
  const contractEntry = room.entryState.infernalContractOffer;
  const contractActive =
    contractEntry != null &&
    biome.rewards.branches.every((branch) =>
      branch.events.some(
        (event) =>
          event.kind === 'rewardOffered' &&
          semanticAddressKey(event.origin) === semanticAddressKey(contractEntry.offerOrigin),
      ),
    );
  const contract =
    !contractActive || contractEntry === undefined || contractEntry === null
      ? undefined
      : (() => {
          const actionOwner = transactionOwnerByOffer.get(contractEntry.offerKey);
          const transaction =
            actionOwner === undefined ? undefined : transactionByOwner.get(actionOwner);
          return Object.freeze({
            sourceOwner:
              transaction?.kind === 'acquisition'
                ? transaction.sourceOwner
                : semanticAddressKey(contractEntry.offerOrigin),
            rewardType: contractEntry.offer.rewardType,
          });
        })();
  return Object.freeze({
    profileKey: room.entryState.profileKey,
    offers,
    ...(contract === undefined ? {} : { infernalContract: contract }),
  });
}

function executionRewardWheels(
  room: CanonicalAuthoredRoom,
): ExecutionOverview['rewardWheels'] | undefined {
  if (room.rewardWheels === undefined) return undefined;
  const biome = createBiomeAddress(room.origin.routeKey, room.origin.biomeKey);
  return Object.freeze(
    room.rewardWheels.map((wheel) => {
      if (wheel.unresolvedOffers.length > 0 || wheel.offers.length === 0)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName}.${wheel.wheelKey} lacks a complete active offer cohort`,
        );
      const phase = room.encounterPhases.find(
        (candidate) => candidate.slotKey === wheel.encounterPhaseKey,
      );
      if (phase === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName}.${wheel.wheelKey} lacks its encounter phase`,
        );
      const picked = wheel.offers.find((offer) => offer.picked);
      if (picked === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName}.${wheel.wheelKey} lacks its picked offer`,
        );
      const phaseOwner = semanticAddressKey(
        createEncounterPhaseAddress(
          biome,
          { kind: 'occurrence', occurrenceId: room.occurrenceId },
          phase.slotKey,
        ),
      );
      return Object.freeze({
        wheelKey: wheel.wheelKey,
        phaseKey: phase.slotKey,
        phaseOwner,
        offerCount: wheel.offers.length,
        storeKey: wheel.storeKey,
        offers: Object.freeze(
          wheel.offers.map((offer) =>
            Object.freeze({
              offerKey: offer.offerKey,
              reward: executionRewardFromOffer(
                offer.offer,
                wheel.producerLifecycleKey,
                wheel.storeKey,
              ),
            }),
          ),
        ),
        pickedOfferKey: picked.offerKey,
      });
    }),
  );
}

/**
 * Project the exact Shrine Travel Deal replacement into the shared timeline
 * product. Initial Shrine offers stay in the room Overview; only the dynamic
 * replacement crosses the Timeline boundary.
 */
export function hermesShrineTravelDealRefill(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
):
  | {
      readonly owner: string;
      readonly sourceOwner: string;
      readonly refill: Extract<ExecutionTravelDealRefill, { readonly carrier: 'hermesShrine' }>;
    }
  | undefined {
  const shrine = room.hermesShrine;
  if (shrine === undefined) return undefined;
  const owner = executionRoomOwnerKey(room);
  const assessments = biome.rewards.hermesShrineAssessments.find(
    (candidate) => semanticAddressKey(candidate.origin) === owner,
  )?.assessments;
  if (assessments === undefined || assessments.length === 0)
    throw new CompilerError('executionCoverageMissing', `${room.gameName} lacks Shrine assessment`);
  if (assessments.every((assessment) => assessment.travelDealRefill === undefined))
    return undefined;
  const travelDeal = shrine.travelDealRefill;
  const refillOffer = travelDeal?.offer;
  if (travelDeal === undefined || refillOffer === undefined || refillOffer === null)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Shrine Travel Deal result`,
    );
  const refillEvidence = agreement(
    assessments.map((assessment) => {
      const refill = assessment.travelDealRefill;
      const optionKey = refill?.candidateOptionKeysByRewardType[refillOffer.rewardType];
      if (refill === undefined || optionKey === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `${room.gameName} lacks native SurfaceShop option ${refillOffer.rewardType}`,
        );
      return Object.freeze({ sourceGenerationKey: refill.sourceGenerationKey, optionKey });
    }),
    `${room.gameName} Shrine Travel Deal refill`,
  );
  const sourceGenerationKey = refillEvidence.sourceGenerationKey as Exclude<
    HermesShrineGenerationKey,
    'travelDealRefill'
  >;
  const slotIndex = (
    {
      'initial:first': 1,
      'initial:secondLeft': 2,
      'initial:secondRight': 3,
    } as const
  )[sourceGenerationKey];
  const sourceEntryKey = hermesShrineDeliveryEntryKey(room.origin, sourceGenerationKey);
  const sourceAction = room.roomActionRoster.rows.find(
    (candidate) =>
      !candidate.stale &&
      candidate.rank !== null &&
      candidate.reference.kind === 'interactAcquisitionEntry' &&
      candidate.reference.siteKey === 'hermesShrineDelivery' &&
      candidate.reference.entryKey === sourceEntryKey,
  );
  if (sourceAction === undefined)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Shrine Travel Deal source action`,
    );
  return Object.freeze({
    owner: semanticAddressKey(
      createTravelDealRefillRealizationAddress(
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        room.occurrenceId,
      ),
    ),
    sourceOwner: semanticAddressKey(sourceAction.owner),
    refill: Object.freeze({
      carrier: 'hermesShrine' as const,
      source: Object.freeze({ generationKey: sourceGenerationKey, slotIndex }),
      replacement: Object.freeze({
        generationKey: 'travelDealRefill' as const,
        slotIndex,
        optionKey: refillEvidence.optionKey,
        rewardType: refillOffer.rewardType,
        ...(travelDeal.purchase === undefined
          ? {}
          : {
              deliverySourceKey: hermesShrineDeliveryEntryKey(room.origin, 'travelDealRefill'),
              purchase: Object.freeze({
                roomDelay: travelDeal.purchase.delay,
                rushed: travelDeal.purchase.rushed,
              }),
            }),
      }),
    }),
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
  return Object.freeze({ offers });
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
              ] as const
            ).flatMap(([generationKey, offerKey, twistResultKey]) => {
              if (offerKey === null || offerKey === undefined) return [];
              const purchased =
                room.stygianWell?.purchasedGenerationKeys?.includes(generationKey) === true;
              return [
                Object.freeze({
                  generationKey,
                  offerKey,
                  ...(!purchased ||
                  offerKey !== 'RandomStoreItem' ||
                  twistResultKey === undefined ||
                  twistResultKey === null
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

function executionFieldsLayout(room: CanonicalAuthoredRoom): ExecutionFieldsLayout | undefined {
  if (!room.entered || room.encounterEnvelopeKey !== 'FieldsEncounter') return undefined;
  const entryPair: CanonicalFieldsEntryPair | undefined = room.fieldsEntryPair;
  const spatial = room.fieldsSpatial;
  if (entryPair === undefined || spatial === undefined)
    throw new CompilerError(
      'executionCoverageMissing',
      `${room.gameName} lacks Fields entry layout`,
    );

  const cagePoints = room.encounterPhases.flatMap((phase) => {
    const attachment = phase.rewardAttachment;
    if (attachment?.kind !== 'localReward' || attachment.groupKey !== 'cages') return [];
    const pointId = spatial.cagePointIdBySlot[attachment.slotKey];
    if (pointId === null || pointId === undefined)
      throw new CompilerError(
        'executionCoverageMissing',
        `${room.gameName} lacks Fields cage point ${attachment.slotKey}`,
      );
    return [{ slotKey: attachment.slotKey, pointId }];
  });
  const optionalRewards = (room.fieldsOptionalRewards ?? []).map((optional) => {
    const pointId = spatial.optionalPointIdBySlot[optional.slotKey];
    if (pointId === null || pointId === undefined)
      throw new CompilerError(
        'executionCoverageMissing',
        `${room.gameName} lacks Fields optional point ${optional.slotKey}`,
      );
    return Object.freeze({
      slotKey: optional.slotKey,
      pointId,
      reward: executionRewardFromOffer(
        optional.offer,
        optional.producerLifecycleKey,
        optional.resolvedStoreKey,
      ),
    });
  });
  const nemesisPointId = room.encounterPhases.some(
    (phase) => phase.encounterKey === 'NemesisRandomEvent',
  )
    ? spatial.nemesisPointId
    : undefined;
  return Object.freeze({
    entryPair: Object.freeze({ ...entryPair }),
    cagePoints: Object.freeze(cagePoints.map((point) => Object.freeze(point))),
    optionalRewards: Object.freeze(optionalRewards),
    ...(nemesisPointId === null || nemesisPointId === undefined ? {} : { nemesisPointId }),
  });
}

/** Assemble the complete room-entry realization facts for one occurrence. */
export function assembleExecutionOverview(
  room: CanonicalAuthoredRoom,
  biome: CompleteValidBiomeProjectEvaluation,
  batch: CanonicalBatch | undefined,
  transactions: readonly ExecutionTimelineTransaction[],
): ExecutionOverview {
  const incomingReward = executionReward(room);
  const shop = executionShop(room, biome, transactions);
  const hermesShrine = executionHermesShrine(room, biome);
  const rewardWheels = executionRewardWheels(room);
  const stygianWell = executionStygianWell(room);
  const purgingPool = executionPurgingPool(room);
  const fields = executionFieldsLayout(room);
  const additional = executionAdditionalExits(batch);
  const biomeAddress = createBiomeAddress(room.origin.routeKey, room.origin.biomeKey);
  const recordedPhases = new Map(
    biome.history.events.flatMap((event) =>
      event.kind === 'encounterRecorded' &&
      semanticAddressKey(event.origin) === semanticAddressKey(room.origin)
        ? [[event.phaseKey, event] as const]
        : [],
    ),
  );
  return Object.freeze({
    ...(incomingReward === undefined ? {} : { incomingReward }),
    ...(room.effectNeutralRequiredReward ? { effectNeutralRequiredReward: true as const } : {}),
    ...(room.unmodeledEncounterKeys === undefined
      ? {}
      : { unmodeledEncounterKeys: room.unmodeledEncounterKeys }),
    encounterPhases: Object.freeze(
      room.encounterPhases.map((phase) =>
        (() => {
          const recorded = recordedPhases.get(phase.slotKey);
          if (room.entered && recorded === undefined)
            throw new CompilerError(
              'executionCoverageMissing',
              `${room.gameName} lacks recorded encounter ${phase.slotKey}`,
            );
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
            encounterKey: recorded?.encounterKey ?? phase.encounterKey,
            kind: recorded?.phaseKind ?? phase.kind,
            ...(figLeaf === undefined ? {} : { figLeafSkip: figLeaf.selected }),
          });
        })(),
      ),
    ),
    ...(rewardWheels === undefined ? {} : { rewardWheels }),
    requiredObjects: Object.freeze((room.requiredObjects ?? []).map((object) => object.key)),
    ...(shop === undefined ? {} : { shop }),
    ...(hermesShrine === undefined ? {} : { hermesShrine }),
    ...(stygianWell === undefined ? {} : { stygianWell }),
    ...(purgingPool === undefined ? {} : { purgingPool }),
    ...(fields === undefined ? {} : { fields }),
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

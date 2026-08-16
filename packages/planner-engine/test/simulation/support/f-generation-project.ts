import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures';

export const fGenerationBiome = createBiomeAddress('Underworld', 'F');
export const fGenerationStartId = createOccurrenceId('possibility-start');

export interface FGenerationBatchSpec {
  readonly targets: readonly string[];
  /** Omit only on the terminal fixture batch to retain a partial decision frontier. */
  readonly pickedExitIndex?: number;
  readonly storeKey?: 'MetaProgress' | 'RunProgress';
  /** Optional counted-offer replacements, aligned with the physical exits. */
  readonly offers?: readonly (ResolvedRewardOffer | undefined)[];
}

export interface FGenerationProjectOptions {
  /** Omit the closing takeover when a test needs a live selected-prefix frontier. */
  readonly includeTakeover?: boolean;
}

export const fGenerationBaselineBatches: readonly FGenerationBatchSpec[] = Object.freeze([
  { targets: ['F_Combat02'], pickedExitIndex: 1, offers: [{ rewardType: 'MetaCurrencyDrop' }] },
  {
    targets: ['F_Combat03', 'F_Combat03'],
    pickedExitIndex: 1,
    offers: [{ rewardType: 'MaxHealthDrop' }, { rewardType: 'MaxManaDrop' }],
  },
  {
    targets: ['F_Combat04', 'F_Combat04'],
    pickedExitIndex: 1,
    offers: [{ rewardType: 'RoomMoneyDrop' }, { rewardType: 'WeaponUpgrade' }],
  },
  {
    targets: ['F_Combat05', 'F_Combat11'],
    pickedExitIndex: 1,
    offers: [{ rewardType: 'HermesUpgrade' }, { rewardType: 'SpellDrop' }],
  },
  {
    targets: ['F_Combat06', 'F_Combat06'],
    pickedExitIndex: 1,
    storeKey: 'MetaProgress',
    offers: [{ rewardType: 'MetaCurrencyDrop' }, { rewardType: 'MetaCardPointsCommonDrop' }],
  },
  {
    targets: ['F_MiniBoss01', 'F_MiniBoss02'],
    pickedExitIndex: 1,
    offers: [
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
      { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
    ],
  },
  { targets: ['F_Combat11'], pickedExitIndex: 1, offers: [{ rewardType: 'MaxManaDrop' }] },
  {
    targets: ['F_Combat12', 'F_Combat12'],
    pickedExitIndex: 1,
    offers: [{ rewardType: 'WeaponUpgrade' }, { rewardType: 'HermesUpgrade' }],
  },
  {
    targets: ['F_Combat14', 'F_Combat14'],
    pickedExitIndex: 1,
    storeKey: 'MetaProgress',
    offers: [{ rewardType: 'MetaCurrencyDrop' }, { rewardType: 'MetaCardPointsCommonDrop' }],
  },
  {
    targets: ['F_Combat15', 'F_Combat15'],
    pickedExitIndex: 1,
    offers: [{ rewardType: 'RoomMoneyDrop' }, { rewardType: 'SpellDrop' }],
  },
]);

export function fGenerationOccurrenceId(batchIndex: number, exitIndex: number) {
  return createOccurrenceId(`possibility-b${batchIndex}-e${exitIndex}`);
}

function sourceOccurrenceId(
  batches: readonly FGenerationBatchSpec[],
  batchIndex: number,
): OccurrenceId {
  if (batchIndex === 1) return fGenerationStartId;
  const previous = batches[batchIndex - 2];
  if (previous === undefined)
    throw new Error(`F generation fixture has no batch ${batchIndex - 1}`);
  if (previous.pickedExitIndex === undefined)
    throw new Error(
      `F generation fixture cannot continue after unresolved batch ${batchIndex - 1}`,
    );
  return fGenerationOccurrenceId(batchIndex - 1, previous.pickedExitIndex);
}

export function fGenerationTargetAddress(
  batches: readonly FGenerationBatchSpec[],
  batchIndex: number,
  exitIndex: number,
) {
  return createTargetAddress(
    fGenerationBiome,
    {
      kind: 'occurrence',
      occurrenceId: sourceOccurrenceId(batches, batchIndex),
    },
    `exit${exitIndex}`,
  );
}

export function createFGenerationProject(
  batches: readonly FGenerationBatchSpec[] = fGenerationBaselineBatches,
  options: FGenerationProjectOptions = {},
): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'f-generation',
    name: 'F Generation',
    configuredBiomeCounts: { Underworld: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: fGenerationBiome,
    occurrenceId: fGenerationStartId,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(fGenerationBiome, fGenerationStartId),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(fGenerationBiome, fGenerationStartId),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });

  for (const [offset, batch] of batches.entries()) {
    const batchIndex = offset + 1;
    const source = {
      kind: 'occurrence' as const,
      occurrenceId: sourceOccurrenceId(batches, batchIndex),
    };
    const decision = createExitDecisionAddress(fGenerationBiome, source);
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fGenerationBiome, source),
      storeKey: batch.storeKey ?? (batchIndex === 1 ? 'MetaProgress' : 'RunProgress'),
    });
    for (const [targetOffset, gameName] of batch.targets.entries()) {
      const exitIndex = targetOffset + 1;
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(fGenerationBiome, source, `exit${exitIndex}`),
        occurrenceId: fGenerationOccurrenceId(batchIndex, exitIndex),
        gameName,
      });
      const offer = batch.offers?.[targetOffset];
      if (offer !== undefined) {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceIncomingReward',
          reward: {
            kind: 'incomingReward',
            routeKey: fGenerationBiome.routeKey,
            biomeKey: fGenerationBiome.biomeKey,
            occurrenceId: fGenerationOccurrenceId(batchIndex, exitIndex),
          },
          value: offer,
        });
      }
    }
    if (batch.targets.length > 1 && batch.pickedExitIndex !== undefined) {
      project = applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(fGenerationBiome, source),
        value: { kind: 'normal', exitKey: `exit${batch.pickedExitIndex}` },
      });
    }
    const selectedIndex = batch.targets.length === 1 ? 1 : batch.pickedExitIndex;
    if (selectedIndex !== undefined && batch.targets[selectedIndex - 1] === 'F_Shop01') {
      for (const [offerKey, value] of Object.entries({
        Boon: {
          rewardType: 'RandomLoot' as const,
          payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
        },
        MajorNonBoon: { rewardType: 'RoomRewardHealDrop' as const },
        Minor: { rewardType: 'MaxManaDrop' as const },
      })) {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceShopOffer',
          offer: createShopOfferAddress(
            fGenerationBiome,
            fGenerationOccurrenceId(batchIndex, selectedIndex),
            offerKey,
          ),
          value,
        });
      }
    }
  }

  if (options.includeTakeover === false) return authorLegalTraitOffers(project);

  const finalBatch = batches.at(-1);
  if (finalBatch === undefined) throw new Error('F generation fixture needs one ordinary batch');
  const finalSource = {
    kind: 'occurrence' as const,
    occurrenceId: sourceOccurrenceId(batches, batches.length + 1),
  };
  if (finalBatch.pickedExitIndex === undefined) {
    throw new Error('F generation fixture cannot add a takeover after an unresolved final batch');
  }
  const finalRoom = catalog.rooms.byKey[finalBatch.targets[finalBatch.pickedExitIndex - 1] ?? ''];
  if (finalRoom === undefined) throw new Error('F generation fixture has no final source room');
  const targetOccurrenceIds = Object.fromEntries(
    finalRoom.exits.map((exit) => [
      `exit${exit.index}`,
      createOccurrenceId(`possibility-preboss-e${exit.index}`),
    ]),
  );
  const takeover = createExitDecisionAddress(fGenerationBiome, finalSource);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: takeover,
    gameName: 'F_PreBoss01',
    targetOccurrenceIds,
  });
  if (finalRoom.exits.length > 1) {
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fGenerationBiome, finalSource),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
  }
  const prebossShopId = targetOccurrenceIds.exit1;
  if (prebossShopId !== undefined) {
    for (const [offerKey, value] of Object.entries({
      Boon: {
        rewardType: 'RandomLoot' as const,
        payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
      },
      MajorNonBoon: { rewardType: 'RoomRewardHealDrop' as const },
      Minor: { rewardType: 'MaxManaDrop' as const },
    })) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopOffer',
        offer: createShopOfferAddress(fGenerationBiome, prebossShopId, offerKey),
        value,
      });
    }
  }
  return authorLegalTraitOffers(project);
}

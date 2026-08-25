import { catalog } from '@run-planner/hades2-catalog';
import { fireEvent, screen } from '@testing-library/react';
import { expect } from 'vitest';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createGorgonPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createRoomActionAddress,
  createShopOfferAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTargetAddress,
  createTraitOfferAddress,
  roomActionKey,
  selectedPickupProducers,
  type OccurrenceId,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import type {
  WorkspaceBiome,
  WorkspaceMixedBatchNode,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceOrdinaryBatchNode,
} from '@planner/projections/structured-workspace';
import {
  authorLegalTraitOffers,
  replaceTestRoomActionOrder,
} from '@run-planner/test-fixtures/shared';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenGBiome,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import { oOccurrenceIds } from '@run-planner/test-fixtures/surface';

export function occurrenceById(
  occurrenceId: string,
): (biome: WorkspaceBiome) => WorkspaceOccurrenceWorkbenchNode | undefined {
  return (biome) =>
    biome.nodes.find(
      (node): node is WorkspaceOccurrenceWorkbenchNode =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
    );
}

export function completionOccurrenceById(
  occurrenceId: string,
): (biome: WorkspaceBiome) => WorkspaceOccurrenceWorkbenchNode | undefined {
  return (biome) => biome.completionOutline.find((node) => node.room.occurrenceId === occurrenceId);
}

export function decisionContainingOccurrence(occurrenceId: OccurrenceId) {
  return (biome: WorkspaceBiome) => {
    const node = biome.nodes.find(
      (candidate): candidate is WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode =>
        (candidate.kind === 'ordinaryBatch' || candidate.kind === 'mixedBatch') &&
        candidate.targets.some((target) => target.room.occurrenceId === occurrenceId),
    );
    return node === undefined ? undefined : { kind: 'node' as const, node };
  };
}

export function expectBefore(first: Element, second: Element): void {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
}

export function openRoomTab(name: string): void {
  fireEvent.click(screen.getByRole('tab', { name }));
}

export function emptyFProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'occurrence-workbench-empty-f',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

export function authoredAnomalyProject(): {
  readonly occurrenceId: OccurrenceId;
  readonly project: ProjectDocument;
} {
  const biome = createBiomeAddress('Underworld', 'G');
  const start = createOccurrenceId('occurrence-workbench-g-intro');
  const target = createOccurrenceId('occurrence-workbench-g-anomaly');
  const source = { kind: 'occurrence' as const, occurrenceId: start };
  let project = createProjectDocument(catalog, {
    projectId: 'occurrence-workbench-anomaly',
    configuredBiomeCounts: { Underworld: 2 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(biome, source),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, source),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, source, 'exit1'),
    occurrenceId: target,
    gameName: 'G_Combat01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SwitchTargetToAnomaly',
    target: createTargetAddress(biome, source, 'exit1'),
  });
  return { occurrenceId: target, project };
}

export function occurrenceState(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: string,
) {
  const state = project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)?.state;
  if (state === undefined) throw new Error(`${occurrenceId} state is missing`);
  return state;
}

export function insertRoomAction(
  project: ProjectDocument,
  biome: ReturnType<typeof createBiomeAddress>,
  occurrenceId: OccurrenceId,
  reference: RoomActionReference,
  index: number,
): ProjectDocument {
  const alreadyOrdered = project.routes
    .find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
    ?.roomActions.order.some((candidate) => roomActionKey(candidate) === roomActionKey(reference));
  if (alreadyOrdered === true) return project;
  return applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(biome, occurrenceId, roomActionKey(reference)),
    reference,
    index,
  });
}

export function occurrenceRoomActionOrder(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: OccurrenceId,
) {
  return project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
    ?.roomActions.order;
}

export function selectedNarcissusPickupSite(
  project: ProjectDocument,
  occurrenceId: OccurrenceId,
): string {
  const occurrence = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) throw new Error('Narcissus occurrence is missing');
  const producer = selectedPickupProducers(catalog, goldenGBiome, occurrence).find(
    (candidate) => candidate.traitKey?.startsWith('Narcissus') === true,
  );
  if (producer === undefined) throw new Error('selected Narcissus pickup producer is missing');
  return producer.siteKey;
}

export function threeCageFieldsProject(): ProjectDocument {
  const occurrenceId = createOccurrenceId('golden-h-combat02');
  const expanded = applyProjectCommand(createGoldenFGHIProject(), catalog, {
    kind: 'ReplaceFieldsCageOutcome',
    decision: createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('golden-h-intro'),
    }),
    cageOutcome: 'max',
  });
  return replaceTestRoomActionOrder(expanded, catalog, goldenHBiome, occurrenceId, [
    { kind: 'completeFieldsCage', phaseKey: 'Cage01' },
    { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
    { kind: 'completeFieldsCage', phaseKey: 'Cage03' },
    { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' },
    { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage2' },
    { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage3' },
  ]);
}

export function fieldsGorgonBarrierProject(): ProjectDocument {
  const occurrenceId = createOccurrenceId('golden-h-combat02');
  const phase = createEncounterPhaseAddress(
    goldenHBiome,
    { kind: 'occurrence', occurrenceId },
    'Cage01',
  );
  let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'AthenaEncounterKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceGorgonDeathDefianceCondition',
    phase,
    value: true,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceGorgonAthenaOffer',
    trait: createTraitOfferAddress(createGorgonPhaseAddress(phase), 'gorgonAthena'),
    value: {
      traitKeys: ['InvulnerabilityDashBoon', 'RetaliateInvulnerabilityBoon', 'FocusLastStandBoon'],
      selectedOptionKey: 'option1',
    },
  });
  return replaceTestRoomActionOrder(project, catalog, goldenHBiome, occurrenceId, [
    { kind: 'interactLocalReward', groupKey: 'optionalRewards', slotKey: 'optional2' },
    { kind: 'completeFieldsCage', phaseKey: 'Cage01' },
    { kind: 'interactGorgon', phaseKey: 'Cage01' },
    { kind: 'interactLocalReward', groupKey: 'optionalRewards', slotKey: 'optional1' },
    { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
    { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' },
    { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage2' },
  ]);
}

export function occurrenceEncounterSelections(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: string,
) {
  const selections = project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
    ?.encounters.encounterKeyByPhase;
  if (selections === undefined) throw new Error(`${occurrenceId} encounter selections are missing`);
  return selections;
}

export function shipWheel(project: ProjectDocument, wheelKey: 'wheel1' | 'wheel2') {
  const state = occurrenceState(project, 'Surface', 'O', oOccurrenceIds.combat07);
  if (state.kind !== 'shipCombat') throw new Error('O Ship state is missing');
  const wheel = state.wheels[wheelKey];
  if (wheel === undefined) throw new Error(`O Ship ${wheelKey} is missing`);
  return wheel;
}

export function shipWheel2(project: ProjectDocument) {
  return shipWheel(project, 'wheel2');
}

export function dormantShopProject(): {
  readonly project: ProjectDocument;
  readonly shopId: OccurrenceId;
} {
  const start = createOccurrenceId('occurrence-workbench-f-start');
  const combat = createOccurrenceId('occurrence-workbench-f-combat');
  const shop = createOccurrenceId('occurrence-workbench-dormant-shop');
  const source = { kind: 'occurrence' as const, occurrenceId: start };
  let project = applyProjectCommand(emptyFProject(), catalog, {
    kind: 'CreateStart',
    biome: goldenFBiome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, start),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, source),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, source),
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, source, 'exit1'),
    occurrenceId: combat,
    gameName: 'F_Combat03',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, combat),
    value: { rewardType: 'GiftDrop' },
  });
  const secondSource = { kind: 'occurrence' as const, occurrenceId: combat };
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, secondSource),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, secondSource),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, secondSource, 'exit1'),
    occurrenceId: createOccurrenceId('occurrence-workbench-shop-sibling'),
    gameName: 'F_Combat04',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, secondSource, 'exit2'),
    occurrenceId: shop,
    gameName: 'F_Shop01',
  });
  return { project, shopId: shop };
}

export function enteredShopProject(): {
  readonly project: ProjectDocument;
  readonly shopId: OccurrenceId;
} {
  const dormant = dormantShopProject();
  const combat = createOccurrenceId('occurrence-workbench-f-combat');
  let project = applyProjectCommand(dormant.project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: combat,
    }),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  for (const [offerKey, value] of [
    [
      'Boon',
      {
        rewardType: 'RandomLoot',
        payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
      },
    ],
    ['MajorNonBoon', { rewardType: 'RoomRewardHealDrop' }],
    ['Minor', { rewardType: 'MaxManaDrop' }],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(goldenFBiome, dormant.shopId, offerKey),
      value,
    });
  }
  return { project: authorLegalTraitOffers(project), shopId: dormant.shopId };
}

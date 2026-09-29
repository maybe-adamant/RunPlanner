import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createProjectDocument,
  createShopOfferAddress,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  simulateProject,
  simulateProjectAssembly,
  zagreusContractCandidateForProjectEvaluationAssembly,
  type RunStateSnapshot,
} from '@run-planner/engine/simulation';
import { loadUnderworldZagreusContractCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';

const biome = createBiomeAddress('FreshFile', 'F');
const boon = (source: string): ResolvedRewardOffer => ({
  rewardType: 'Boon',
  payload: { kind: 'BoonSource', source },
});
const shopOffers: Readonly<Record<string, ResolvedRewardOffer>> = {
  Boon: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  MajorNonBoon: { rewardType: 'RoomRewardHealDrop' },
  Minor: { rewardType: 'MaxManaDrop' },
};

/** A complete valid Fresh File F: each batch selects its first exit. */
const freshF: readonly {
  readonly storeKey: 'RunProgress' | 'MetaProgress';
  readonly targets: readonly (readonly [string, ResolvedRewardOffer | null])[];
}[] = [
  { storeKey: 'RunProgress', targets: [['F_Combat01', { rewardType: 'MaxHealthDrop' }]] },
  {
    storeKey: 'MetaProgress',
    targets: [['F_Combat02', { rewardType: 'MetaCardPointsCommonDrop' }]],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      ['F_Combat03', { rewardType: 'RoomMoneyDrop' }],
      ['F_Combat04', { rewardType: 'MaxManaDrop' }],
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      ['F_Combat07', boon('ApolloUpgrade')],
      ['F_Combat06', boon('PoseidonUpgrade')],
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      ['F_Combat05', { rewardType: 'MaxHealthDrop' }],
      ['F_Combat08', { rewardType: 'MaxManaDrop' }],
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      ['F_Shop01', null],
      ['F_MiniBoss01', boon('ApolloUpgrade')],
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      ['F_Combat11', { rewardType: 'MetaCardPointsCommonDrop' }],
      ['F_Combat12', { rewardType: 'MetaCurrencyDrop' }],
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      ['F_Combat13', { rewardType: 'RoomMoneyDrop' }],
      ['F_Combat14', boon('ApolloUpgrade')],
    ],
  },
  {
    storeKey: 'RunProgress',
    targets: [
      ['F_Combat15', { rewardType: 'StackUpgrade' }],
      ['F_Combat16', { rewardType: 'MaxManaDrop' }],
    ],
  },
  {
    storeKey: 'MetaProgress',
    targets: [
      ['F_Combat17', { rewardType: 'MetaCardPointsCommonDrop' }],
      ['F_Combat18', { rewardType: 'MetaCurrencyDrop' }],
    ],
  },
];
const midshop = createOccurrenceId('fresh-5-0');
const prebossShop = createOccurrenceId('fresh-preboss-shop');
const postboss = createOccurrenceId('fresh-preboss-shop:postboss');

function authorShop(project: ProjectDocument, occurrenceId: typeof midshop): ProjectDocument {
  return Object.entries(shopOffers).reduce(
    (next, [offerKey, value]) =>
      applyProjectCommand(next, catalog, {
        kind: 'ReplaceShopOffer',
        offer: createShopOfferAddress(biome, occurrenceId, offerKey),
        value,
      }),
    project,
  );
}

function freshFProject(): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'fresh-f',
    routeKey: 'FreshFile',
    configuredBiomeCount: 1,
  });
  let parent = project.route.biomes[0]!.topology!.startOccurrenceId;
  const selectFirst = (decision: ReturnType<typeof createExitDecisionAddress>) => {
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, decision.source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
  };
  freshF.forEach(({ storeKey, targets }, depth) => {
    const decision = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: parent });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, decision.source),
      storeKey,
    });
    targets.forEach(([gameName, offer], index) => {
      const occurrenceId = createOccurrenceId(`fresh-${depth}-${index}`);
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, decision.source, `exit${index + 1}`),
        occurrenceId,
        gameName,
      });
      if (offer !== null)
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceIncomingReward',
          reward: createIncomingRewardAddress(biome, occurrenceId),
          value: offer,
        });
    });
    if (targets.length > 1) selectFirst(decision);
    parent = createOccurrenceId(`fresh-${depth}-0`);
    if (targets[0]![0] === 'F_Shop01') project = authorShop(project, parent);
  });
  const decision = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: parent });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision,
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: { exit1: prebossShop, exit2: createOccurrenceId('fresh-preboss-free') },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, createOccurrenceId('fresh-preboss-free')),
    value: boon('ApolloUpgrade'),
  });
  selectFirst(decision);
  return authorLegalTraitOffers(authorShop(project, prebossShop));
}

function snapshotsOf(project: ProjectDocument): readonly RunStateSnapshot[] {
  const result = simulateProject(catalog, project).route.biomes[0]!;
  return 'rewards' in result ? (result.rewards?.runStateSnapshots ?? []) : [];
}

describe('Fresh File retained content', () => {
  it('authors a complete valid Fresh File F with no Postboss Well, Pool or rack', () => {
    const project = freshFProject();
    const evaluation = simulateProject(catalog, project);
    expect(evaluation.findings).toEqual([]);
    const occurrence = project.route.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === postboss,
    )!;
    expect(occurrence.gameName).toBe('F_PostBoss01');
    expect(occurrence).not.toHaveProperty('stygianWell');
    expect(occurrence).not.toHaveProperty('purgingPool');
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplacePostbossKeepsake',
        selection: createPostbossKeepsakeSelectionAddress(createOccurrenceAddress(biome, postboss)),
        keepsakeKey: catalog.keepsakes.values[0]!.key,
      }),
    ).toThrow(/no Postboss rack/);
  });

  it('refuses the Zagreus contract door at the Fresh Midshop and admits it on a mature route', () => {
    const withDoor = authorLegalTraitOffers(
      applyProjectCommand(freshFProject(), catalog, {
        kind: 'AddZagreusContract',
        additional: createAdditionalExitAddress(biome, midshop, 'zagreusContract'),
        occurrenceId: createOccurrenceId('fresh-contract'),
      }),
    );
    const capability = zagreusContractCandidateForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, withDoor),
      createOccurrenceAddress(biome, midshop),
    );
    expect(capability).toMatchObject({
      placementEligible: false,
      failedConditions: ['sourceRequirement'],
    });
    expect(simulateProject(catalog, withDoor).findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        evidence: expect.objectContaining({
          kind: 'zagreusContract',
          failedConditions: ['sourceRequirement'],
        }),
      }),
    );

    const mature = loadUnderworldZagreusContractCheckpoint();
    const matureShop = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'G'),
      createOccurrenceId('golden-g-b5-e1'),
    );
    expect(
      zagreusContractCandidateForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, mature),
        matureShop,
      ),
    ).toMatchObject({ placementEligible: true, failedConditions: [] });
    expect(
      simulateProject(catalog, mature).findings.filter(
        (finding) => finding.evidence.kind === 'zagreusContract',
      ),
    ).toEqual([]);
  });

  it('reports a retained Postboss Well, rack and Pool on Fresh File and lets each be removed', () => {
    const keepsakeKey = catalog.keepsakes.values[0]!.key;
    const encoded = JSON.parse(encodeProjectDocument(freshFProject()));
    const raw = encoded.route.biomes[0].topology.occurrences.find(
      (occurrence: { occurrenceId: string }) => occurrence.occurrenceId === postboss,
    );
    raw.stygianWell = {
      interacted: false,
      offerKeyBySlot: { healing: null, secondLeft: null, secondRight: null },
    };
    raw.purgingPool = {
      interacted: true,
      traitKeyBySlot: { left: 'ApolloWeaponBoon', middle: null, right: null },
    };
    raw.keepsakeRack = { keepsakeKey };
    raw.roomActions = {
      order: [
        ...raw.roomActions.order,
        { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
        { kind: 'interactKeepsakeRack' },
      ],
    };
    const retained = decodeProjectDocument(encoded, catalog);
    const codesOf = (project: ProjectDocument) =>
      simulateProject(catalog, project).findings.map((finding) => [
        finding.code,
        finding.evidence.reason ?? null,
      ]);
    expect(codesOf(retained)).toEqual(
      expect.arrayContaining([
        ['stygianWellPlacementUnavailable', null],
        ['purgingPoolUnavailable', null],
        ['purgingPoolSaleUnavailable', null],
      ]),
    );

    const owner = createOccurrenceAddress(biome, postboss);
    const withoutWell = applyProjectCommand(retained, catalog, {
      kind: 'RemoveStygianWell',
      occurrence: owner,
    });
    expect(codesOf(withoutWell)).not.toContainEqual(['stygianWellPlacementUnavailable', null]);
    const poolClosed = applyProjectCommand(withoutWell, catalog, {
      kind: 'SetPurgingPoolInteraction',
      occurrence: owner,
      interacted: false,
    });
    // The rack is reached once the earlier Postboss features are repaired.
    expect(codesOf(poolClosed)).toEqual([['keepsakeUnavailable', 'rackUnavailableOnRoute']]);
    for (const snapshot of snapshotsOf(poolClosed))
      expect(snapshot.keepsakes.currentKey).not.toBe(keepsakeKey);
    const repaired = applyProjectCommand(poolClosed, catalog, {
      kind: 'RemovePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(owner),
    });
    expect(simulateProject(catalog, repaired).findings).toEqual([]);
  });

  it('reports an interacted Pool on Fresh File even without a sale', () => {
    const owner = createOccurrenceAddress(biome, postboss);
    const encoded = JSON.parse(encodeProjectDocument(freshFProject()));
    const raw = encoded.route.biomes[0].topology.occurrences.find(
      (occurrence: { occurrenceId: string }) => occurrence.occurrenceId === postboss,
    );
    raw.purgingPool = {
      interacted: true,
      traitKeyBySlot: { left: null, middle: null, right: null },
    };
    const findings = simulateProject(catalog, decodeProjectDocument(encoded, catalog)).findings;
    expect(findings.map((finding) => finding.code)).toEqual(['purgingPoolUnavailable']);
    expect(JSON.stringify(findings[0]!.origin)).toContain('purgingPoolInventory');
    expect(JSON.stringify(findings[0]!.origin)).toContain(owner.occurrenceId);
  });
});

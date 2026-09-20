import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createAdditionalExitAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { assembleExecutionProduct, compileExecutionPlan } from '@run-planner/engine/execution-plan';
import { levelResolutionCandidateForProjectEvaluationAssembly } from '@run-planner/engine/simulation';
import {
  createCompleteFGProject,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

const preboss = createOccurrenceId('golden-g-preboss-shop');
const inventory = createShopOfferAddress(goldenGBiome, preboss, 'infernalContractReward');

it('hides inactive Contract inventory unless its stale purchase needs removal', () => {
  let project = createCompleteFGProject();
  const absent = projectStructuredWorkspaceFixture(project);
  expect(absent.workspace.interactions.shopOffers.has(semanticAddressKey(inventory))).toBe(false);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: inventory,
    value: { rewardType: 'BlindBoxLoot' },
  });
  const dormant = projectStructuredWorkspaceFixture(project);
  expect(dormant.workspace.interactions.shopOffers.has(semanticAddressKey(inventory))).toBe(false);
  expect(dormant.evaluation.route.findings).toEqual([]);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: inventory,
    purchased: true,
  });
  const stale = projectStructuredWorkspaceFixture(project);
  const entry = createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(createOccurrenceAddress(goldenGBiome, preboss), 'roomExit'),
    'infernalContractReward',
  );
  expect(stale.evaluation.findings).toContainEqual(
    expect.objectContaining({ code: 'shopPurchaseUnavailable', origin: entry }),
  );
  expect(stale.workspace.focusByOwner.has(semanticAddressKey(entry))).toBe(true);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: inventory,
    purchased: false,
  });
  const removed = projectStructuredWorkspaceFixture(project);
  expect(removed.workspace.interactions.shopOffers.has(semanticAddressKey(inventory))).toBe(false);
  expect(removed.evaluation.route.findings).toEqual([]);
});

function createContractShopProject(withHex = false) {
  const midshop = goldenGOccurrenceId(5, 1);
  const returned = goldenGOccurrenceId(7, 1);
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'AddZagreusContract',
    additional: createAdditionalExitAddress(goldenGBiome, midshop, 'zagreusContract'),
    occurrenceId: createOccurrenceId('contract-pedestal-witness'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, {
      kind: 'occurrence',
      occurrenceId: midshop,
    }),
    value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenGBiome, returned),
    gameName: 'G_MiniBoss03',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenGBiome, returned),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  if (withHex) {
    const spell = createShopOfferAddress(goldenGBiome, midshop, 'Minor');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: spell,
      value: { rewardType: 'SpellDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: spell,
      purchased: true,
    });
  }
  return authorLegalTraitOffers(project);
}

it('edits Contract inventory, resolves its acquired Mystery in Timeline, and publishes the same source', () => {
  let project = createContractShopProject();
  const entry = createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(createOccurrenceAddress(goldenGBiome, preboss), 'roomExit'),
    'infernalContractReward',
  );
  const missing = projectStructuredWorkspaceFixture(project);
  expect(missing.evaluation.route.biomes.flatMap((biome) => biome.findings)).toEqual([
    expect.objectContaining({ code: 'rewardMissing', origin: inventory }),
  ]);
  expect(missing.workspace.focusByOwner.get(semanticAddressKey(inventory))).toMatchObject({
    focusAddress: inventory,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: inventory,
    value: { rewardType: 'BlindBoxLoot' },
  });
  const uncollected = projectStructuredWorkspaceFixture(project);
  expect(uncollected.evaluation.route.biomes.flatMap((biome) => biome.findings)).toEqual([]);
  const uncollectedProduct = assembleExecutionProduct({ assembly: uncollected.assembly, catalog });
  expect(
    uncollectedProduct.occurrences.find((room) => room.id === preboss)?.overview.shop
      ?.infernalContract,
  ).toEqual({ sourceOwner: semanticAddressKey(inventory), rewardType: 'BlindBoxLoot' });
  expect(() => compileExecutionPlan({ product: uncollectedProduct })).not.toThrow();

  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: inventory,
    purchased: true,
  });
  const resolving = projectStructuredWorkspaceFixture(project);
  expect(resolving.evaluation.route.biomes.flatMap((biome) => biome.findings)).toEqual([
    expect.objectContaining({ code: 'rewardMissing', origin: entry }),
  ]);
  expect(resolving.workspace.focusByOwner.get(semanticAddressKey(entry))).toMatchObject({
    roomTab: 'actions',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAcquisitionEntryOffer',
    entry,
    value: { rewardType: 'BlindBoxLoot', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = authorLegalTraitOffers(project);
  const acquired = projectStructuredWorkspaceFixture(project);
  expect(acquired.evaluation.route.biomes.flatMap((biome) => biome.findings)).toEqual([]);
  const product = assembleExecutionProduct({ assembly: acquired.assembly, catalog });
  const room = product.occurrences.find((room) => room.id === preboss)!;
  expect(room.overview.shop?.infernalContract?.sourceOwner).toBe(semanticAddressKey(entry));
  expect(room.timeline.transactions).toContainEqual(
    expect.objectContaining({
      kind: 'acquisition',
      sourceOwner: semanticAddressKey(entry),
      roles: expect.arrayContaining([expect.objectContaining({ traitOffer: expect.anything() })]),
    }),
  );
  expect(() => compileExecutionPlan({ product })).not.toThrow();
});

it.each([
  ['StackUpgrade', 1],
  ['StackUpgradeBig', 2],
] as const)(
  'resolves a purchased Contract %s through its Timeline target editor and publication',
  (rewardType, levelCount) => {
    let project = applyProjectCommand(createContractShopProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer: inventory,
      value: { rewardType },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: inventory,
      purchased: true,
    });
    const resolution = createLevelResolutionAddress(inventory, 'self');
    const missing = projectStructuredWorkspaceFixture(project);
    expect(missing.evaluation.route.findings).toContainEqual(
      expect.objectContaining({ code: 'missingPomTarget', origin: resolution }),
    );
    expect(missing.workspace.focusByOwner.get(semanticAddressKey(resolution))).toMatchObject({
      roomTab: 'actions',
    });
    expect(
      missing.workspace.interactions.levelResolutions.has(semanticAddressKey(resolution)),
    ).toBe(true);
    const capability = levelResolutionCandidateForProjectEvaluationAssembly(
      missing.assembly,
      resolution,
    );
    const branch = capability?.branches[0];
    if (branch === undefined) throw new Error('Contract Pom has no reached target capability');
    expect(branch.levelCount).toBe(levelCount);
    const offeredTraitKeys = branch.eligibleTargetTraitKeys.slice(0, branch.requiredOfferCount);
    const selectedTraitKey = offeredTraitKeys[0];
    if (selectedTraitKey === undefined) throw new Error('Contract Pom has no eligible target');
    const value = { kind: 'choice', offeredTraitKeys, selectedTraitKey } as const;
    expect(capability?.evaluate(value)[0]?.supported).toBe(true);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: resolution,
      value,
    });
    const acquired = projectStructuredWorkspaceFixture(project);
    expect(acquired.evaluation.route.findings).toEqual([]);
    const biome = acquired.evaluation.route.biomes.find((candidate) => candidate.biomeKey === 'G');
    if (biome === undefined || !('rewards' in biome)) throw new Error('G was not evaluated');
    for (const result of biome.rewards.branches) {
      const event = result.state.traitHistory?.events.find(
        (event) =>
          event.kind === 'levelMutation' &&
          semanticAddressKey(event.owner) === semanticAddressKey(resolution),
      );
      if (event?.kind !== 'levelMutation') throw new Error('Contract Pom did not apply its level');
      expect(event.targetTraitKey).toBe(selectedTraitKey);
      expect(event.newLevel - event.oldLevel).toBe(levelCount);
    }
    const product = assembleExecutionProduct({ assembly: acquired.assembly, catalog });
    const room = product.occurrences.find((room) => room.id === preboss)!;
    expect(room.timeline.transactions).toContainEqual(
      expect.objectContaining({
        kind: 'acquisition',
        sourceOwner: semanticAddressKey(inventory),
        roles: expect.arrayContaining([
          expect.objectContaining({
            levelResolution: {
              offeredTargets: offeredTraitKeys,
              selectedTarget: selectedTraitKey,
              levelCount,
            },
          }),
        ]),
      }),
    );
    expect(() => compileExecutionPlan({ product })).not.toThrow();
  },
);

it.each([
  ['TalentDrop', 3],
  ['TalentBigDrop', 5],
] as const)(
  'accounts for Contract %s points at acquisition, publication, and removal',
  (rewardType, points) => {
    let project = applyProjectCommand(createContractShopProject(true), catalog, {
      kind: 'ReplaceShopOffer',
      offer: inventory,
      value: { rewardType },
    });
    const uncollected = projectStructuredWorkspaceFixture(project);
    expect(uncollected.evaluation.route.findings).toEqual([]);
    const uncollectedProduct = assembleExecutionProduct({
      assembly: uncollected.assembly,
      catalog,
    });
    const baseline = uncollectedProduct.occurrences.find((room) => room.id === preboss)?.diagnostics
      ?.beforeRoomExit?.hexProgress;
    expect(baseline).toMatchObject({ bankedPathPoints: 0, investedPathPoints: 0, closed: false });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: inventory,
      purchased: true,
    });
    const acquired = projectStructuredWorkspaceFixture(project);
    expect(acquired.evaluation.route.findings).toEqual([]);
    const biome = acquired.evaluation.route.biomes.find((candidate) => candidate.biomeKey === 'G');
    if (biome === undefined || !('rewards' in biome)) throw new Error('G was not evaluated');
    expect(biome.rewards.branches.map((branch) => branch.state.hexProgress)).toEqual([
      expect.objectContaining({ bankedPathPoints: 0, investedPathPoints: points }),
    ]);
    const product = assembleExecutionProduct({ assembly: acquired.assembly, catalog });
    const room = product.occurrences.find((room) => room.id === preboss)!;
    expect(room.diagnostics?.beforeRoomExit?.hexProgress).toEqual({
      ...baseline,
      investedPathPoints: points,
    });
    expect(room.timeline.transactions).toContainEqual(
      expect.objectContaining({
        kind: 'acquisition',
        sourceOwner: semanticAddressKey(inventory),
        roles: expect.arrayContaining([
          expect.objectContaining({ role: 'self', gameName: rewardType }),
        ]),
      }),
    );
    expect(() => compileExecutionPlan({ product })).not.toThrow();

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: inventory,
      purchased: false,
    });
    const removed = projectStructuredWorkspaceFixture(project);
    expect(removed.evaluation.route.findings).toEqual([]);
    expect(assembleExecutionProduct({ assembly: removed.assembly, catalog })).toEqual(
      uncollectedProduct,
    );
  },
);

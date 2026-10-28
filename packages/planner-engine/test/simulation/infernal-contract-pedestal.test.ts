import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAdditionalExitAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createShopOfferAddress,
  createAcquisitionSiteAddress,
  createExitSelectionAddress,
  createInfernalContractPedestalAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  roomActionKey,
  semanticAddressKey,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  levelResolutionCandidateForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { assembleExecutionProduct, compileExecutionPlan } from '@run-planner/engine/execution-plan';
import { loadUnderworldZagreusContractCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';

const shopId = createOccurrenceId('zagreus-contract-preboss-shop');
const peerId = createOccurrenceId('zagreus-contract-preboss-peer');
const returnSource = {
  kind: 'occurrence' as const,
  occurrenceId: createOccurrenceId('zagreus-contract-return'),
};
const shopPedestal = createInfernalContractPedestalAddress(goldenGBiome, shopId);
const peerPedestal = createInfernalContractPedestalAddress(goldenGBiome, peerId);
const collect = { kind: 'interactInfernalContractPedestal' } as const;

function occurrence(project: ProjectDocument, id: string): RoomOccurrence {
  const found = project.route.biomes
    .find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === id);
  if (found === undefined) throw new Error(`missing occurrence ${id}`);
  return found;
}

/** The checkpoint with its boon-form Preboss door entered instead of the Shop form. */
function boonForm(): ProjectDocument {
  return applyProjectCommand(loadUnderworldZagreusContractCheckpoint(), catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, returnSource),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
}

describe('Infernal Contract pedestal', () => {
  it('is a feature of both Preboss forms, apart from the Shop inventory', () => {
    const project = loadUnderworldZagreusContractCheckpoint();
    const shop = occurrence(project, shopId);
    const peer = occurrence(project, peerId);
    expect(shop.infernalContractPedestal?.reward?.offer).toEqual({ rewardType: 'StackUpgrade' });
    expect(shop.state.kind === 'shop' ? Object.keys(shop.state.shop?.offers ?? {}) : []).toEqual([
      'Boon',
      'MajorNonBoon',
      'Minor',
    ]);
    expect(shop.roomActions.order).toContainEqual(collect);
    expect(peer.state.kind).toBe('freeReward');
    expect(peer.infernalContractPedestal).toEqual({ optionKey: null, reward: null });
  });

  it('spawns in the boon form while the Contract is held and blocks until its item is authored', () => {
    const project = boonForm();
    const findings = simulateProjectAssembly(catalog, project).evaluation.findings;
    expect(findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardMissing',
        origin: peerPedestal,
      }),
    );
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const evaluation = session.evaluate({
      kind: 'infernalContractPedestal',
      pedestal: peerPedestal,
      value: { rewardType: 'StackUpgradeBig' },
    });
    expect(evaluation).toMatchObject({
      kind: 'infernalContractPedestal',
      result: { supported: true },
    });
  });

  it('settles a collected boon-form pedestal item as a free acquisition', () => {
    let project = applyProjectCommand(boonForm(), catalog, {
      kind: 'ReplaceInfernalContractPedestalOffer',
      pedestal: peerPedestal,
      value: { rewardType: 'StackUpgradeBig' },
    });
    const uncollected = simulateProjectAssembly(catalog, project).evaluation.findings;
    expect(uncollected.map((finding) => semanticAddressKey(finding.origin))).not.toContain(
      semanticAddressKey(peerPedestal),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'SetInfernalContractPedestalCollected',
      pedestal: peerPedestal,
      collected: true,
    });
    expect(occurrence(project, peerId).roomActions.order).toContainEqual(collect);
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    expect(
      evaluation.findings.filter(
        (finding) =>
          finding.origin.kind === 'infernalContractPedestal' ||
          (finding.origin.kind === 'acquisitionEntry' &&
            finding.origin.site.pointKey === 'infernalContractPedestal'),
      ),
    ).toEqual([]);
  });

  it('retains an item collected before the Contract is held, as a finding at its collect action', () => {
    const fPreboss = createOccurrenceId('golden-f-preboss-shop');
    const pedestal = createInfernalContractPedestalAddress(goldenFBiome, fPreboss);
    let project = applyProjectCommand(loadUnderworldZagreusContractCheckpoint(), catalog, {
      kind: 'ReplaceInfernalContractPedestalOffer',
      pedestal,
      value: { rewardType: 'StackUpgrade' },
    });
    expect(
      simulateProjectAssembly(catalog, project).evaluation.findings.map(
        (finding) => finding.origin,
      ),
    ).not.toContainEqual(pedestal);
    project = applyProjectCommand(project, catalog, {
      kind: 'SetInfernalContractPedestalCollected',
      pedestal,
      collected: true,
    });
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardSourceUnavailable',
        origin: createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(
            createOccurrenceAddress(goldenFBiome, fPreboss),
            'infernalContractPedestal',
          ),
          'infernalContractReward',
        ),
        evidence: { reason: 'infernalContractNotHeld' },
      }),
    );
  });

  it('reconciles a collected Mystery item with its acquisition entry and round-trips', () => {
    let project = applyProjectCommand(loadUnderworldZagreusContractCheckpoint(), catalog, {
      kind: 'ReplaceInfernalContractPedestalOffer',
      pedestal: shopPedestal,
      value: { rewardType: 'BlindBoxLoot' },
    });
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenGBiome, shopId),
      'infernalContractPedestal',
    );
    expect(occurrence(project, shopId).acquisitionSites?.infernalContractPedestal).toEqual({
      pickupEntries: { infernalContractReward: null },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: createAcquisitionEntryAddress(site, 'infernalContractReward'),
      value: { rewardType: 'BlindBoxLoot', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'SetInfernalContractPedestalCollected',
      pedestal: shopPedestal,
      collected: false,
    });
    expect(occurrence(project, shopId).acquisitionSites?.infernalContractPedestal).toBeUndefined();
    expect(occurrence(project, shopId).roomActions.order).not.toContainEqual(collect);
    project = applyProjectCommand(project, catalog, {
      kind: 'ClearInfernalContractPedestal',
      pedestal: shopPedestal,
    });
    expect(occurrence(project, shopId).infernalContractPedestal).toEqual({
      optionKey: null,
      reward: null,
    });
  });

  it('keeps a collected Mystery item and its source when the Shop form is left and re-entered', () => {
    let project = applyProjectCommand(loadUnderworldZagreusContractCheckpoint(), catalog, {
      kind: 'ReplaceInfernalContractPedestalOffer',
      pedestal: shopPedestal,
      value: { rewardType: 'BlindBoxLoot' },
    });
    const pedestal = occurrence(project, shopId).infernalContractPedestal;
    const site = occurrence(project, shopId).acquisitionSites?.infernalContractPedestal;
    for (const exitKey of ['exit2', 'exit1'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(goldenGBiome, returnSource),
        value: { kind: 'normal', exitKey },
      });
      expect(occurrence(project, shopId).infernalContractPedestal).toEqual(pedestal);
      expect(occurrence(project, shopId).acquisitionSites?.infernalContractPedestal).toEqual(site);
    }
  });

  it('owns its collect action through its own command', () => {
    const project = loadUnderworldZagreusContractCheckpoint();
    const action = createRoomActionAddress(goldenGBiome, shopId, roomActionKey(collect));
    expect(() =>
      applyProjectCommand(project, catalog, { kind: 'RemoveRoomAction', action }),
    ).toThrowError(expect.objectContaining({ commandKind: 'RemoveRoomAction' }));
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceInfernalContractPedestalOffer',
        pedestal: createInfernalContractPedestalAddress(
          goldenGBiome,
          createOccurrenceId('zagreus-contract-return'),
        ),
        value: { rewardType: 'StackUpgrade' },
      }),
    ).toThrowError(expect.objectContaining({ detail: 'G_MiniBoss03 has no Contract pedestal' }));
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'SetInfernalContractPedestalCollected',
        pedestal: peerPedestal,
        collected: true,
      }),
    ).toThrowError(
      expect.objectContaining({ detail: 'an unentered Preboss cannot collect its pedestal item' }),
    );
  });
});

const gPreboss = createOccurrenceId('golden-g-preboss-shop');
const gPedestal = createInfernalContractPedestalAddress(goldenGBiome, gPreboss);
const gEntry = createAcquisitionEntryAddress(
  createAcquisitionSiteAddress(
    createOccurrenceAddress(goldenGBiome, gPreboss),
    'infernalContractPedestal',
  ),
  'infernalContractReward',
);

/** F/G with the Midshop's Contract taken, so the G Preboss Shop stands the pedestal. */
function contractShopProject(withHex = false): ProjectDocument {
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

function collected(project: ProjectDocument, value: boolean): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'SetInfernalContractPedestalCollected',
    pedestal: gPedestal,
    collected: value,
  });
}

describe('Infernal Contract pedestal acquisition and publication', () => {
  it('resolves a collected Mystery at its pedestal entry and publishes the same source', () => {
    let project = contractShopProject();
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).toEqual([
      expect.objectContaining({ code: 'rewardMissing', origin: gPedestal }),
    ]);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceInfernalContractPedestalOffer',
      pedestal: gPedestal,
      value: { rewardType: 'BlindBoxLoot' },
    });
    const uncollected = simulateProjectAssembly(catalog, project);
    expect(uncollected.evaluation.findings).toEqual([]);
    const uncollectedProduct = assembleExecutionProduct({ assembly: uncollected, catalog });
    expect(
      uncollectedProduct.occurrences.find((room) => room.id === gPreboss)?.overview
        .infernalContractPedestal,
    ).toEqual({ sourceOwner: semanticAddressKey(gPedestal), rewardType: 'BlindBoxLoot' });
    expect(() => compileExecutionPlan({ product: uncollectedProduct })).not.toThrow();

    project = collected(project, true);
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).toEqual([
      expect.objectContaining({ code: 'rewardMissing', origin: gEntry }),
    ]);
    project = authorLegalTraitOffers(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceAcquisitionEntryOffer',
        entry: gEntry,
        value: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      }),
    );
    const acquired = simulateProjectAssembly(catalog, project);
    expect(acquired.evaluation.findings).toEqual([]);
    const product = assembleExecutionProduct({ assembly: acquired, catalog });
    const room = product.occurrences.find((candidate) => candidate.id === gPreboss)!;
    expect(room.overview.infernalContractPedestal?.sourceOwner).toBe(semanticAddressKey(gEntry));
    expect(room.timeline.transactions).toContainEqual(
      expect.objectContaining({
        kind: 'acquisition',
        sourceOwner: semanticAddressKey(gEntry),
        roles: expect.arrayContaining([expect.objectContaining({ traitOffer: expect.anything() })]),
      }),
    );
    expect(() => compileExecutionPlan({ product })).not.toThrow();
  });

  it.each([
    ['StackUpgrade', 1],
    ['StackUpgradeBig', 2],
  ] as const)('resolves a collected %s target and publishes it', (rewardType, levelCount) => {
    let project = collected(
      applyProjectCommand(contractShopProject(), catalog, {
        kind: 'ReplaceInfernalContractPedestalOffer',
        pedestal: gPedestal,
        value: { rewardType },
      }),
      true,
    );
    const resolution = createLevelResolutionAddress(gPedestal, 'self');
    const missing = simulateProjectAssembly(catalog, project);
    expect(missing.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'missingPomTarget', origin: resolution }),
    );
    const capability = levelResolutionCandidateForProjectEvaluationAssembly(missing, resolution);
    const branch = capability?.branches[0];
    if (branch === undefined) throw new Error('pedestal Pom has no reached target capability');
    expect(branch.levelCount).toBe(levelCount);
    const offeredTraitKeys = branch.eligibleTargetTraitKeys.slice(0, branch.requiredOfferCount);
    const selectedTraitKey = offeredTraitKeys[0];
    if (selectedTraitKey === undefined) throw new Error('pedestal Pom has no eligible target');
    const value = { kind: 'choice', offeredTraitKeys, selectedTraitKey } as const;
    expect(capability?.evaluate(value)[0]?.supported).toBe(true);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: resolution,
      value,
    });
    const acquired = simulateProjectAssembly(catalog, project);
    expect(acquired.evaluation.findings).toEqual([]);
    const product = assembleExecutionProduct({ assembly: acquired, catalog });
    expect(
      product.occurrences.find((room) => room.id === gPreboss)?.timeline.transactions,
    ).toContainEqual(
      expect.objectContaining({
        kind: 'acquisition',
        sourceOwner: semanticAddressKey(gPedestal),
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
  });

  it.each([
    ['TalentDrop', 3],
    ['TalentBigDrop', 5],
  ] as const)('accounts for collected %s points and their removal', (rewardType, points) => {
    let project = applyProjectCommand(contractShopProject(true), catalog, {
      kind: 'ReplaceInfernalContractPedestalOffer',
      pedestal: gPedestal,
      value: { rewardType },
    });
    const uncollected = simulateProjectAssembly(catalog, project);
    expect(uncollected.evaluation.findings).toEqual([]);
    const uncollectedProduct = assembleExecutionProduct({ assembly: uncollected, catalog });
    project = applyProjectCommand(collected(project, true), catalog, {
      kind: 'ReplaceHexActivation',
      acquisition: createAcquisitionRoleAddress(gPedestal, 'self'),
      value: { selectedNodeKeys: ['1:2', '1:4', '2:2', '2:4', '3:1'].slice(0, points) },
    });
    const acquired = simulateProjectAssembly(catalog, project);
    expect(acquired.evaluation.findings).toEqual([]);
    const product = assembleExecutionProduct({ assembly: acquired, catalog });
    const room = product.occurrences.find((candidate) => candidate.id === gPreboss)!;
    expect(room.diagnostics?.beforeRoomExit?.hexProgress).toMatchObject({
      investedPathPoints: points,
    });
    expect(room.timeline.transactions).toContainEqual(
      expect.objectContaining({
        kind: 'acquisition',
        sourceOwner: semanticAddressKey(gPedestal),
        roles: expect.arrayContaining([
          expect.objectContaining({ role: 'self', gameName: rewardType }),
        ]),
      }),
    );
    const removed = simulateProjectAssembly(catalog, collected(project, false));
    expect(removed.evaluation.findings).toEqual([]);
    expect(assembleExecutionProduct({ assembly: removed, catalog })).toEqual(uncollectedProduct);
  });
});

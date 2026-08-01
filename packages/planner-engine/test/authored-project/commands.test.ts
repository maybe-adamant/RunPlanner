import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createBiomeFieldAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createProjectHistory,
  createShopPurchaseAddress,
  createTargetAddress,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  redoProjectHistory,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';

import { createCompleteNProject } from './support/complete-n-project';

const fBiome = createBiomeAddress('Underworld', 'F');
const gBiome = createBiomeAddress('Underworld', 'G');
const iBiome = createBiomeAddress('Underworld', 'I');
const nBiome = createBiomeAddress('Surface', 'N');
const oBiome = createBiomeAddress('Surface', 'O');
const qBiome = createBiomeAddress('Surface', 'Q');

function fProject() {
  return createProjectDocument(catalog, {
    projectId: 'commands-f',
    name: 'Commands F',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

function nProject() {
  return createProjectDocument(catalog, {
    projectId: 'commands-n',
    name: 'Commands N',
    configuredBiomeCounts: { Surface: 1 },
  });
}

function gProject() {
  return createProjectDocument(catalog, {
    projectId: 'commands-g',
    name: 'Commands G',
    configuredBiomeCounts: { Underworld: 2 },
  });
}

function iProject() {
  return createProjectDocument(catalog, {
    projectId: 'commands-i',
    name: 'Commands I',
    configuredBiomeCounts: { Underworld: 4 },
  });
}

function surfaceProject(configuredBiomeCount: number) {
  return createProjectDocument(catalog, {
    projectId: `commands-surface-${configuredBiomeCount}`,
    name: 'Commands Surface',
    configuredBiomeCounts: { Surface: configuredBiomeCount },
  });
}

function fTopology(project: ReturnType<typeof fProject>) {
  const topology = project.routes[0]?.biomes[0]?.topology;
  if (topology === null || topology === undefined) throw new Error('missing F topology');
  return topology;
}

describe('authored-project commands and topology', () => {
  it('removes the completed-Hub Preboss handoff when a visit truncates the Hub', () => {
    const project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 'hub', 6),
    });
    const topology = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    if (topology === null || topology === undefined) throw new Error('N topology is required');

    expect(
      topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
    expect(topology.occurrences.some((occurrence) => occurrence.gameName === 'N_PreBoss01')).toBe(
      false,
    );
    expect(topology.decisions.find((decision) => decision.kind === 'hub')).toMatchObject({
      visitOrder: ['combat01', 'combat02', 'combat03', 'combat04', 'combat05'],
    });
  });

  it('removes the completed-Hub Preboss handoff when an unvisited ninth slot closes', () => {
    const project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'CloseHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat07'),
    });
    const topology = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    if (topology === null || topology === undefined) throw new Error('N topology is required');
    const hub = topology.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('N Hub decision is required');

    expect(hub.openTargets).toHaveLength(8);
    expect(hub.openTargets.map((target) => target.hubSlotKey)).not.toContain('combat07');
    expect(hub.openTargets.map((target) => target.hubSlotKey)).toContain('combat08');
    expect(hub.visitOrder).toHaveLength(6);
    expect(
      topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(false);
    expect(topology.occurrences.some((occurrence) => occurrence.gameName === 'N_PreBoss01')).toBe(
      false,
    );
  });

  it('requires topology null until an authored start exists and preserves selected starts', () => {
    let project = fProject();
    expect(project.routes[0]?.biomes[0]).toMatchObject({ biomeKey: 'F', topology: null });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('f-opening'),
      gameName: 'F_Opening02',
    });
    expect(fTopology(project)).toMatchObject({
      startOccurrenceId: 'f-opening',
      occurrences: [{ occurrenceId: 'f-opening', gameName: 'F_Opening02' }],
      decisions: [],
    });
  });

  it('keeps ordinary batches progressive and selection declaration-derived at width one', () => {
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('f-start'),
      gameName: 'F_Opening01',
    });
    const decision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('f-start'),
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    expect(fTopology(project).decisions[0]).toMatchObject({
      normal: { kind: 'batch', targets: [] },
      selection: { kind: 'unresolved' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, decision.source, 'exit1'),
      occurrenceId: createOccurrenceId('f-combat'),
      gameName: 'F_Combat02',
    });
    expect(fTopology(project).decisions[0]).toMatchObject({
      selection: { kind: 'derived' },
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: 'f-combat' }] },
    });
  });

  it('canonicalizes normal targets in declaration-owned physical exit order', () => {
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('ordered-opening'),
      gameName: 'F_Opening01',
    });
    const openingDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('ordered-opening'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('ordered-source'),
      gameName: 'F_Combat02',
    });
    const sourceDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('ordered-source'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: sourceDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, sourceDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit2'),
      occurrenceId: createOccurrenceId('ordered-exit2'),
      gameName: 'F_Combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('ordered-exit1'),
      gameName: 'F_Combat03',
    });
    const source = fTopology(project).decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === 'ordered-source',
    );
    if (source?.kind !== 'exit' || source.normal.kind !== 'batch') {
      throw new Error('missing ordered source batch');
    }
    expect(source.normal.targets.map((target) => target.exitKey)).toEqual(['exit1', 'exit2']);
  });

  it('creates an atomic declaration-ordered takeover batch with Shop then free offers', () => {
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('f-start'),
      gameName: 'F_Opening01',
    });
    const openingDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('f-start'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('f-combat'),
      gameName: 'F_Combat02',
    });
    const combatDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('f-combat'),
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTakeoverBatch',
        decision: combatDecision,
        gameName: 'F_PreBoss01',
        targetOccurrenceIds: { exit1: createOccurrenceId('partial-preboss') },
      }),
    ).toThrow(ProjectCommandContractError);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: combatDecision,
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('f-preboss-shop'),
        exit2: createOccurrenceId('f-preboss-free'),
      },
    });
    const topology = fTopology(project);
    const takeover = topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === 'f-combat',
    );
    expect(takeover).toMatchObject({
      selection: { kind: 'unresolved' },
      normal: {
        targets: [
          { exitKey: 'exit1', occurrenceId: 'f-preboss-shop' },
          { exitKey: 'exit2', occurrenceId: 'f-preboss-free' },
        ],
      },
    });
    expect(
      topology.occurrences.find((occurrence) => occurrence.occurrenceId === 'f-preboss-shop')?.state
        .kind,
    ).toBe('shop');
    expect(
      topology.occurrences.find((occurrence) => occurrence.occurrenceId === 'f-preboss-free')?.state
        .kind,
    ).toBe('freeReward');
    expect(
      topology.occurrences.find((occurrence) => occurrence.occurrenceId === 'f-preboss-shop')
        ?.state,
    ).toEqual({ kind: 'shop' });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, combatDecision.source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(
      fTopology(project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'f-preboss-shop',
      )?.state,
    ).toMatchObject({ kind: 'shop', shop: expect.any(Object) });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetShopPurchase',
      purchase: createShopPurchaseAddress(fBiome, createOccurrenceId('f-preboss-shop'), 'Boon'),
      purchased: true,
    });
    expect(
      fTopology(project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'f-preboss-shop',
      )?.state,
    ).toMatchObject({ kind: 'shop', shop: { offers: { Boon: { purchased: true } } } });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, combatDecision.source),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(
      fTopology(project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'f-preboss-shop',
      )?.state,
    ).toEqual({ kind: 'shop' });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(fBiome, combatDecision.source, 'exit1'),
        occurrenceId: createOccurrenceId('bad'),
        gameName: 'F_Combat01',
      }),
    ).toThrow(ProjectCommandContractError);
  });

  it('derives N fixed start identity and progressively creates linked PreHub, Hub, and its width-one exit', () => {
    expect(() =>
      applyProjectCommand(nProject(), catalog, {
        kind: 'CreateStart',
        biome: nBiome,
        occurrenceId: createOccurrenceId('n-opening'),
        gameName: 'N_Combat01',
      }),
    ).toThrow(ProjectCommandContractError);
    let project = applyProjectCommand(nProject(), catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: createOccurrenceId('n-opening'),
    });
    const openingDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('n-opening'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateLinkedExit',
      decision: openingDecision,
      occurrenceId: createOccurrenceId('n-prehub'),
    });
    const hub = createHubDecisionAddress(nBiome, 'hub');
    project = applyProjectCommand(project, catalog, { kind: 'CreateHubDecision', hub });
    for (let index = 1; index <= 9; index += 1) {
      const slotKey = `combat${String(index).padStart(2, '0')}`;
      project = applyProjectCommand(project, catalog, {
        kind: 'OpenHubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', slotKey),
        occurrenceId: createOccurrenceId(`n-${slotKey}`),
      });
    }
    for (let index = 1; index <= 6; index += 1) {
      const slotKey = `combat${String(index).padStart(2, '0')}`;
      project = applyProjectCommand(project, catalog, {
        kind: 'AppendHubVisit',
        visit: createHubVisitAddress(nBiome, 'hub', index),
        hubSlotKey: slotKey,
      });
    }
    const handoff = createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: handoff,
      gameName: 'N_PreBoss01',
      targetOccurrenceIds: { preboss: createOccurrenceId('n-preboss') },
    });
    const plan = project.routes.find((route) => route.routeKey === 'Surface')?.biomes[0];
    expect(plan?.topology).toMatchObject({
      startOccurrenceId: 'n-opening',
      occurrences: expect.arrayContaining([
        expect.objectContaining({ occurrenceId: 'n-opening', gameName: 'N_Opening01' }),
        expect.objectContaining({ occurrenceId: 'n-prehub', gameName: 'N_PreHub01' }),
        expect.objectContaining({
          occurrenceId: 'n-preboss',
          gameName: 'N_PreBoss01',
          state: expect.objectContaining({ kind: 'shop' }),
        }),
      ]),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveExitDecision',
      decision: openingDecision,
    });
    expect(
      project.routes.find((route) => route.routeKey === 'Surface')?.biomes[0]?.topology,
    ).toMatchObject({
      occurrences: [{ occurrenceId: 'n-opening' }],
      decisions: [],
    });
  });

  it('reports an N PreHub normal-batch attempt through the exact command contract', () => {
    let project = applyProjectCommand(nProject(), catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: createOccurrenceId('wrapper-n-opening'),
    });
    const openingDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('wrapper-n-opening'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateLinkedExit',
      decision: openingDecision,
      occurrenceId: createOccurrenceId('wrapper-n-prehub'),
    });
    const command = {
      kind: 'CreateBatch' as const,
      decision: createExitDecisionAddress(nBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('wrapper-n-prehub'),
      }),
    };

    try {
      applyProjectCommand(project, catalog, command);
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectCommandContractError);
      expect(error).toMatchObject({
        commandKind: 'CreateBatch',
        addressKey:
          '["exitDecision","Surface","N",{"kind":"occurrence","occurrenceId":"wrapper-n-prehub"}]',
        detail: 'ordinary normal-door batches require generated progression',
      });
      return;
    }
    throw new Error('expected the N PreHub batch command to fail');
  });

  it('wraps a project-document field failure at the public command boundary', () => {
    const command = {
      kind: 'ReplaceBiomeField' as const,
      field: createBiomeFieldAddress(fBiome, 'unknownField'),
      value: false,
    };

    try {
      applyProjectCommand(fProject(), catalog, command);
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectCommandContractError);
      if (!(error instanceof ProjectCommandContractError)) {
        throw new Error('expected a ProjectCommandContractError', { cause: error });
      }
      expect(error).toMatchObject({
        commandKind: 'ReplaceBiomeField',
        addressKey: '["biomeField","Underworld","F","unknownField"]',
        detail: 'ReplaceBiomeField.value: unknown biome field unknownField',
      });
      expect(error.cause).toBeInstanceOf(ProjectDocumentContractError);
      expect(error.cause).toMatchObject({
        path: 'ReplaceBiomeField.value',
        detail: 'unknown biome field unknownField',
      });
      return;
    }
    throw new Error('expected the invalid biome field command to fail');
  });

  it('clears every persisted N topology member through the shared clear impact', () => {
    const project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ClearTopology',
      biome: nBiome,
    });

    expect(
      project.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')?.topology,
    ).toBeNull();
  });

  it('addresses selection by semantic decision source and rejects absent target choices', () => {
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('f-start'),
      gameName: 'F_Opening01',
    });
    const decision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('f-start'),
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(fBiome, decision.source),
        value: { kind: 'normal', exitKey: 'exit1' },
      }),
    ).toThrow(ProjectCommandContractError);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, decision.source, 'exit1'),
      occurrenceId: createOccurrenceId('f-only-target'),
      gameName: 'F_Combat02',
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(fBiome, decision.source),
        value: { kind: 'normal', exitKey: 'exit1' },
      }),
    ).toThrow(ProjectCommandContractError);
  });

  it('retains overflow targets until explicit ordinary exit-capacity repair', () => {
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('capacity-opening'),
      gameName: 'F_Opening01',
    });
    const openingDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('capacity-opening'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('capacity-source'),
      gameName: 'F_Combat02',
    });
    const sourceDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('capacity-source'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: sourceDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, sourceDecision.source),
      storeKey: 'RunProgress',
    });
    for (const exitKey of ['exit1', 'exit2']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(fBiome, sourceDecision.source, exitKey),
        occurrenceId: createOccurrenceId(`capacity-${exitKey}`),
        gameName: 'F_Combat01',
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, createOccurrenceId('capacity-source')),
      gameName: 'F_Combat01',
    });
    expect(
      fTopology(project).decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === 'capacity-source',
      ),
    ).toMatchObject({ normal: { targets: [{ exitKey: 'exit1' }, { exitKey: 'exit2' }] } });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReconcileBatchExitCapacity',
      decision: sourceDecision,
    });
    expect(
      fTopology(project).decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === 'capacity-source',
      ),
    ).toMatchObject({ normal: { targets: [{ exitKey: 'exit1' }] } });
  });

  it('retains takeover targets by declaration exit key rather than caller-supplied ID order', () => {
    let project = applyProjectCommand(gProject(), catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: createOccurrenceId('g-intro'),
    });
    const introDecision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('g-intro'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: introDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, introDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, introDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('g-combat'),
      gameName: 'G_Combat02',
    });
    const combatDecision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('g-combat'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: combatDecision,
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('g-shop'),
        exit2: createOccurrenceId('g-free-left'),
        exit3: createOccurrenceId('g-free-right'),
      },
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReconcileTakeoverBatch',
        decision: combatDecision,
        gameName: 'G_PreBoss01',
        targetOccurrenceIds: {
          exit1: createOccurrenceId('g-shop'),
          exit2: createOccurrenceId('g-free-right'),
          exit3: createOccurrenceId('g-free-left'),
        },
      }),
    ).toThrow(ProjectCommandContractError);

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(gBiome, createOccurrenceId('g-combat')),
      gameName: 'G_MiniBoss02',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReconcileTakeoverBatch',
      decision: combatDecision,
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: { exit1: createOccurrenceId('g-shop') },
    });
    const repaired = project.routes[0]?.biomes[1]?.topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === 'g-combat',
    );
    expect(repaired).toMatchObject({
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: 'g-shop' }] },
      selection: { kind: 'derived' },
    });
  });

  it('defaults takeover leaves whose selection contract changes', () => {
    let takeover = applyProjectCommand(gProject(), catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: createOccurrenceId('widening-intro'),
    });
    const introDecision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('widening-intro'),
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateBatch',
      decision: introDecision,
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, introDecision.source),
      storeKey: 'RunProgress',
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, introDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('widening-source'),
      gameName: 'G_MiniBoss02',
    });
    const takeoverDecision = createExitDecisionAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('widening-source'),
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: takeoverDecision,
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: { exit1: createOccurrenceId('widening-shop') },
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'SetShopPurchase',
      purchase: createShopPurchaseAddress(gBiome, createOccurrenceId('widening-shop'), 'Boon'),
      purchased: true,
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(gBiome, createOccurrenceId('widening-source')),
      gameName: 'G_Combat02',
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'ReconcileTakeoverBatch',
      decision: takeoverDecision,
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('widening-shop'),
        exit2: createOccurrenceId('widening-free-2'),
        exit3: createOccurrenceId('widening-free-3'),
      },
    });
    const widenedTopology = takeover.routes[0]?.biomes[1]?.topology;
    expect(widenedTopology?.occurrences).toContainEqual(
      expect.objectContaining({
        occurrenceId: 'widening-shop',
        state: { kind: 'shop' },
      }),
    );
    expect(widenedTopology?.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          occurrenceId: 'widening-free-2',
          state: expect.objectContaining({ kind: 'freeReward' }),
        }),
        expect.objectContaining({
          occurrenceId: 'widening-free-3',
          state: expect.objectContaining({ kind: 'freeReward' }),
        }),
      ]),
    );
  });

  it('records common structural commands as semantic history and preserves compatible takeover state', () => {
    let fHistory = createProjectHistory(fProject());
    const start = {
      kind: 'CreateStart' as const,
      biome: fBiome,
      occurrenceId: createOccurrenceId('history-start'),
      gameName: 'F_Opening01',
    };
    fHistory = applyProjectHistoryCommand(fHistory, catalog, start);
    const openingDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('history-start'),
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingDecision.source),
      storeKey: 'RunProgress',
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('history-combat'),
      gameName: 'F_Combat02',
    });
    const combatDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('history-combat'),
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: combatDecision,
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('history-shop'),
        exit2: createOccurrenceId('history-free'),
      },
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, combatDecision.source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'SetShopPurchase',
      purchase: createShopPurchaseAddress(fBiome, createOccurrenceId('history-shop'), 'Boon'),
      purchased: true,
    });
    fHistory = applyProjectHistoryCommand(fHistory, catalog, {
      kind: 'ReconcileTakeoverBatch',
      decision: combatDecision,
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('history-shop'),
        exit2: createOccurrenceId('history-free'),
      },
    });
    expect(
      fHistory.present.routes[0]?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'history-shop',
      )?.state,
    ).toMatchObject({ kind: 'shop', shop: { offers: { Boon: { purchased: true } } } });
    const beforeUndo = fHistory.present;
    fHistory = undoProjectHistory(fHistory);
    expect(fHistory.present).not.toEqual(beforeUndo);
    fHistory = redoProjectHistory(fHistory);
    expect(fHistory.present).toEqual(beforeUndo);

    let nHistory = createProjectHistory(nProject());
    nHistory = applyProjectHistoryCommand(nHistory, catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: createOccurrenceId('history-opening'),
    });
    const nOpeningDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('history-opening'),
    });
    nHistory = applyProjectHistoryCommand(nHistory, catalog, {
      kind: 'CreateLinkedExit',
      decision: nOpeningDecision,
      occurrenceId: createOccurrenceId('history-prehub'),
    });
    nHistory = applyProjectHistoryCommand(nHistory, catalog, {
      kind: 'CreateHubDecision',
      hub: createHubDecisionAddress(nBiome, 'hub'),
    });
    const hubbed = nHistory.present;
    nHistory = undoProjectHistory(nHistory);
    nHistory = undoProjectHistory(nHistory);
    nHistory = undoProjectHistory(nHistory);
    expect(
      nHistory.present.routes.find((route) => route.routeKey === 'Surface')?.biomes[0],
    ).toMatchObject({
      topology: null,
    });
    nHistory = redoProjectHistory(redoProjectHistory(redoProjectHistory(nHistory)));
    expect(nHistory.present).toEqual(hubbed);
  });

  it('keeps I Preboss in the ordinary batch but respects its one-creation-per-source policy', () => {
    let project = applyProjectCommand(iProject(), catalog, {
      kind: 'CreateStart',
      biome: iBiome,
      occurrenceId: createOccurrenceId('i-intro'),
    });
    const decision = createExitDecisionAddress(iBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('i-intro'),
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(iBiome, decision.source, 'exit1'),
      occurrenceId: createOccurrenceId('i-two-exit-combat'),
      gameName: 'I_Combat01',
    });
    const twoExitDecision = createExitDecisionAddress(iBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('i-two-exit-combat'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: twoExitDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(iBiome, twoExitDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('i-preboss'),
      gameName: 'I_PreBoss02',
    });
    expect(
      project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[3]?.topology
        ?.occurrences,
    ).toContainEqual(
      expect.objectContaining({
        occurrenceId: 'i-preboss',
        state: expect.objectContaining({ kind: 'shop', shop: expect.any(Object) }),
      }),
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(iBiome, twoExitDecision.source, 'exit2'),
        occurrenceId: createOccurrenceId('i-second-preboss'),
        gameName: 'I_PreBoss02',
      }),
    ).toThrow(ProjectCommandContractError);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(iBiome, twoExitDecision.source, 'exit2'),
      occurrenceId: createOccurrenceId('i-peer'),
      gameName: 'I_Combat02',
    });
    expect(
      project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[3]?.topology
        ?.occurrences,
    ).toContainEqual(
      expect.objectContaining({ occurrenceId: 'i-preboss', state: { kind: 'shop' } }),
    );
  });

  it('keeps staged candidate pools and Ship encounter counts valid after occurrence replacement', () => {
    let qProject = applyProjectCommand(surfaceProject(4), catalog, {
      kind: 'CreateStart',
      biome: qBiome,
      occurrenceId: createOccurrenceId('q-intro'),
    });
    const qIntroDecision = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('q-intro'),
    });
    qProject = applyProjectCommand(qProject, catalog, {
      kind: 'CreateBatch',
      decision: qIntroDecision,
    });
    qProject = applyProjectCommand(qProject, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(qBiome, qIntroDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('q-foyer'),
      gameName: 'Q_Combat10',
    });
    const qFoyerDecision = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('q-foyer'),
    });
    qProject = applyProjectCommand(qProject, catalog, {
      kind: 'CreateBatch',
      decision: qFoyerDecision,
    });
    qProject = applyProjectCommand(qProject, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(qBiome, qFoyerDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('q-first-fork'),
      gameName: 'Q_Combat03',
    });
    expect(() =>
      applyProjectCommand(qProject, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(qBiome, createOccurrenceId('q-first-fork')),
        gameName: 'Q_Combat02',
      }),
    ).toThrow(ProjectCommandContractError);
    qProject = applyProjectCommand(qProject, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(qBiome, createOccurrenceId('q-first-fork')),
      gameName: 'Q_Combat05',
    });
    expect(
      qProject.routes.find((route) => route.routeKey === 'Surface')?.biomes[3]?.topology
        ?.occurrences,
    ).toContainEqual(expect.objectContaining({ gameName: 'Q_Combat05' }));

    let oProject = applyProjectCommand(surfaceProject(2), catalog, {
      kind: 'CreateStart',
      biome: oBiome,
      occurrenceId: createOccurrenceId('o-intro'),
    });
    const oIntroDecision = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('o-intro'),
    });
    oProject = applyProjectCommand(oProject, catalog, {
      kind: 'CreateBatch',
      decision: oIntroDecision,
    });
    oProject = applyProjectCommand(oProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(oBiome, oIntroDecision.source),
      storeKey: 'RunProgress',
    });
    oProject = applyProjectCommand(oProject, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(oBiome, oIntroDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('o-ship'),
      gameName: 'O_Combat01',
    });
    oProject = applyProjectCommand(oProject, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, createOccurrenceId('o-ship')),
      encounterCount: 3,
    });
    expect(
      oProject.routes.find((route) => route.routeKey === 'Surface')?.biomes[1]?.topology
        ?.occurrences,
    ).toContainEqual(
      expect.objectContaining({
        occurrenceId: 'o-ship',
        state: expect.objectContaining({ kind: 'shipCombat', encounterCount: 3 }),
      }),
    );
  });
});

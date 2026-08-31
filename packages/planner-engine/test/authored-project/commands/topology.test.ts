import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createTargetAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  ProjectCommandContractError,
  redoProjectHistory,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import { replaceTestShopOfferActions } from '@run-planner/test-fixtures/shared';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import {
  composeBiomeHistoryPrefix,
  materializeBiomePrefix,
  simulateProject,
} from '@run-planner/engine/simulation';

import { createCompleteNProject } from '../support/complete-n-project';
import {
  fBiome,
  fProject,
  fTopology,
  gBiome,
  gProject,
  hBiome,
  hProject,
  iBiome,
  iProject,
  nBiome,
  nProject,
} from '../support/configured-projects';

function startedNTopology(project: ReturnType<typeof nProject>) {
  const topology = project.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
  if (topology === null || topology === undefined) throw new Error('missing N topology');
  return topology;
}

describe('authored-project commands and topology', () => {
  it('rejects a Surface-addressed biome command against an Underworld document without mutation', () => {
    const project = fProject();
    const encodedBefore = encodeProjectDocument(project);

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateStart',
        biome: nBiome,
        occurrenceId: createOccurrenceId('surface-addressed-start'),
        gameName: 'N_Opening01',
      }),
    ).toThrowError(ProjectCommandContractError);

    expect(encodeProjectDocument(project)).toBe(encodedBefore);
  });

  it('keeps the single Surface completion chain route-qualified', () => {
    const evaluation = simulateProject(catalog, loadSurfaceNProject());
    const n = evaluation.route.biomes.find((biome) => biome.biomeKey === 'N');
    if (n?.authoring !== 'complete' || n.validity !== 'valid') {
      throw new Error('complete N project did not produce a canonical Surface biome');
    }

    expect(n.snapshot.fixedRoomLinks.map((link) => link.target.gameName)).toEqual([
      'N_Boss01',
      'N_PostBoss01',
    ]);
  });

  it('removes the completed-Hub Preboss handoff when an aggregate visit order shortens the Hub', () => {
    const project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ReplaceHubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat01', 'combat02', 'combat03', 'combat04', 'combat05'],
    });
    const topology = project.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
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

  it('reorders a complete Hub visit prefix without rewriting its completed handoff', () => {
    const project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ReplaceHubVisitOrder',
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: ['combat06', 'combat05', 'combat04', 'combat03', 'combat02', 'combat01'],
    });
    const topology = project.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    if (topology === null || topology === undefined) throw new Error('N topology is required');

    expect(topology.decisions.find((decision) => decision.kind === 'hub')).toMatchObject({
      visitOrder: ['combat06', 'combat05', 'combat04', 'combat03', 'combat02', 'combat01'],
    });
    expect(
      topology.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(true);
    expect(topology.occurrences.some((occurrence) => occurrence.gameName === 'N_PreBoss01')).toBe(
      true,
    );
  });

  it('rejects aggregate Hub orders with duplicate, closed, or over-limit slots', () => {
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const project = createCompleteNProject();

    for (const hubSlotKeys of [
      ['combat01', 'combat01'],
      ['combat12'],
      ['combat01', 'combat02', 'combat03', 'combat04', 'combat05', 'combat06', 'combat07'],
    ]) {
      expect(() =>
        applyProjectCommand(project, catalog, {
          kind: 'ReplaceHubVisitOrder',
          hub,
          hubSlotKeys,
        }),
      ).toThrow(ProjectCommandContractError);
    }
  });

  it('removes the completed-Hub Preboss handoff when an unvisited ninth slot closes', () => {
    const project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'CloseHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat07'),
    });
    const topology = project.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
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
    expect(project.route?.biomes[0]).toMatchObject({ biomeKey: 'F', topology: null });
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

  it('creates an authored-choice start from its first declared room when no room is supplied', () => {
    const project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('default-f-opening'),
    });

    expect(fTopology(project)).toMatchObject({
      startOccurrenceId: 'default-f-opening',
      occurrences: [{ occurrenceId: 'default-f-opening', gameName: 'F_Opening01' }],
    });
  });

  it('owns Fields cage outcomes with topology batches and preserves unchanged identity', () => {
    const startId = createOccurrenceId('h-fields-start');
    let project = applyProjectCommand(hProject(), catalog, {
      kind: 'CreateStart',
      biome: hBiome,
      occurrenceId: startId,
    });
    const decision = createExitDecisionAddress(hBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });

    const minimum = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: 'min',
    });
    expect(
      minimum.route?.biomes[2]?.topology?.decisions.find(
        (candidate) =>
          candidate.kind === 'exit' &&
          candidate.source.kind === 'occurrence' &&
          candidate.source.occurrenceId === startId,
      ),
    ).toMatchObject({ normal: { batchState: { cageOutcome: 'min' } } });
    expect(
      applyProjectCommand(minimum, catalog, {
        kind: 'ReplaceFieldsCageOutcome',
        decision,
        cageOutcome: 'min',
      }),
    ).toBe(minimum);

    const maximum = applyProjectCommand(minimum, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision,
      cageOutcome: 'max',
    });
    expect(
      maximum.route?.biomes[2]?.topology?.decisions.find(
        (candidate) =>
          candidate.kind === 'exit' &&
          candidate.source.kind === 'occurrence' &&
          candidate.source.occurrenceId === startId,
      ),
    ).toMatchObject({ normal: { batchState: { cageOutcome: 'max' } } });
  });

  it('atomically initializes an outgoing decision with its first semantic edit', () => {
    const fStartId = createOccurrenceId('atomic-frontier-f-start');
    const fStarted = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: fStartId,
      gameName: 'F_Opening01',
    });
    const fDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: fStartId,
    });
    const history = applyProjectHistoryCommand(createProjectHistory(fStarted), catalog, {
      kind: 'InitializeExitDecision',
      decision: fDecision,
      edit: { kind: 'rewardStore', storeKey: 'RunProgress' },
    });
    expect(fTopology(history.present).decisions).toEqual([
      expect.objectContaining({
        normal: expect.objectContaining({
          rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
          targets: [],
        }),
      }),
    ]);
    expect(history.past).toHaveLength(1);
    expect(fTopology(undoProjectHistory(history).present).decisions).toEqual([]);

    const hStartId = createOccurrenceId('atomic-frontier-h-start');
    const hStarted = applyProjectCommand(hProject(), catalog, {
      kind: 'CreateStart',
      biome: hBiome,
      occurrenceId: hStartId,
    });
    const hDecision = createExitDecisionAddress(hBiome, {
      kind: 'occurrence',
      occurrenceId: hStartId,
    });
    const fields = applyProjectCommand(hStarted, catalog, {
      kind: 'InitializeExitDecision',
      decision: hDecision,
      edit: { kind: 'fieldsCageOutcome', cageOutcome: 'max' },
    });
    const fieldsTopology = fields.route?.biomes.find((biome) => biome.biomeKey === 'H')?.topology;
    expect(
      fieldsTopology && fieldsTopology.decisions.find((candidate) => candidate.kind === 'exit'),
    ).toMatchObject({ normal: { batchState: { cageOutcome: 'max' }, targets: [] } });

    const nStartId = createOccurrenceId('atomic-frontier-n-start');
    const nStarted = applyProjectCommand(nProject(), catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: nStartId,
    });
    const nDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nStartId,
    });
    const prehubId = createOccurrenceId('atomic-frontier-n-prehub');
    const target = applyProjectCommand(nStarted, catalog, {
      kind: 'InitializeExitDecision',
      decision: nDecision,
      edit: {
        kind: 'target',
        target: createTargetAddress(nBiome, nDecision.source, 'prehub'),
        occurrenceId: prehubId,
        gameName: 'N_PreHub01',
      },
    });
    const targetTopology = target.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    expect(
      targetTopology && targetTopology.decisions.find((candidate) => candidate.kind === 'exit'),
    ).toMatchObject({ normal: { targets: [{ exitKey: 'prehub', occurrenceId: prehubId }] } });
    expect(targetTopology?.occurrences).toContainEqual(
      expect.objectContaining({ occurrenceId: prehubId, gameName: 'N_PreHub01' }),
    );
  });

  it('rejects a mismatched atomic target before initializing either decision source', () => {
    const startId = createOccurrenceId('atomic-mismatch-start');
    const started = applyProjectCommand(nProject(), catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: startId,
    });
    const decision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    const mismatchedTarget = createTargetAddress(
      nBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('different-source') },
      'prehub',
    );
    const before = encodeProjectDocument(started);

    expect(() =>
      applyProjectCommand(started, catalog, {
        kind: 'InitializeExitDecision',
        decision,
        edit: {
          kind: 'target',
          target: mismatchedTarget,
          occurrenceId: createOccurrenceId('atomic-mismatch-target'),
          gameName: 'N_PreHub01',
        },
      }),
    ).toThrowError(
      expect.objectContaining({
        detail: 'initial target must belong to the initialized exit decision',
      }),
    );
    expect(encodeProjectDocument(started)).toBe(before);
    expect(startedNTopology(started).decisions).toEqual([]);
  });

  it('rejects Fields cage outcomes outside ordinary Fields batches', () => {
    const fStartId = createOccurrenceId('non-fields-start');
    let nonFields = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: fStartId,
      gameName: 'F_Opening01',
    });
    const fDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: fStartId,
    });
    nonFields = applyProjectCommand(nonFields, catalog, {
      kind: 'CreateBatch',
      decision: fDecision,
    });
    expect(() =>
      applyProjectCommand(nonFields, catalog, {
        kind: 'ReplaceFieldsCageOutcome',
        decision: fDecision,
        cageOutcome: 'min',
      }),
    ).toThrowError(
      expect.objectContaining({ detail: 'batch does not expose a Fields cage outcome' }),
    );

    const hStartId = createOccurrenceId('takeover-fields-start');
    const hCombatId = createOccurrenceId('takeover-fields-combat');
    let takeover = applyProjectCommand(hProject(), catalog, {
      kind: 'CreateStart',
      biome: hBiome,
      occurrenceId: hStartId,
    });
    const hStartDecision = createExitDecisionAddress(hBiome, {
      kind: 'occurrence',
      occurrenceId: hStartId,
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateBatch',
      decision: hStartDecision,
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision: hStartDecision,
      cageOutcome: 'min',
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(hBiome, hStartDecision.source, 'exit1'),
      occurrenceId: hCombatId,
      gameName: 'H_Combat02',
    });
    const takeoverDecision = createExitDecisionAddress(hBiome, {
      kind: 'occurrence',
      occurrenceId: hCombatId,
    });
    takeover = applyProjectCommand(takeover, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: takeoverDecision,
      gameName: 'H_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('takeover-fields-shop'),
        exit2: createOccurrenceId('takeover-fields-free'),
      },
    });
    expect(() =>
      applyProjectCommand(takeover, catalog, {
        kind: 'ReplaceFieldsCageOutcome',
        decision: takeoverDecision,
        cageOutcome: 'max',
      }),
    ).toThrowError(
      expect.objectContaining({ detail: 'takeover batches do not own Fields cage state' }),
    );
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

  it('reserves Boss and Postboss declarations for the fixed Preboss completion chain', () => {
    const startId = createOccurrenceId('fixed-completion-domain-start');
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: startId,
      gameName: 'F_Opening01',
    });
    const decision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: startId,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey: 'RunProgress',
    });

    for (const gameName of ['F_Boss01', 'F_PostBoss01'] as const) {
      expect(() =>
        applyProjectCommand(project, catalog, {
          kind: 'CreateTarget',
          target: createTargetAddress(fBiome, decision.source, 'exit1'),
          occurrenceId: createOccurrenceId(`ordinary-${gameName}`),
          gameName,
        }),
      ).toThrowError(
        expect.objectContaining({ detail: `${gameName} is not an ordinary normal-door target` }),
      );
    }
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
    const prebossShopEncounters = topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'f-preboss-shop',
    )?.encounters;
    if (prebossShopEncounters === undefined)
      throw new Error('F Preboss Shop encounters are missing');
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
    expect(
      fTopology(project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'f-preboss-shop',
      )?.encounters,
    ).toEqual(prebossShopEncounters);
    project = replaceTestShopOfferActions(
      project,
      catalog,
      createOccurrenceAddress(fBiome, createOccurrenceId('f-preboss-shop')),
      ['Boon'],
    );
    expect(
      fTopology(project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'f-preboss-shop',
      ),
    ).toMatchObject({
      state: { kind: 'shop' },
      roomActions: {
        order: expect.arrayContaining([{ kind: 'interactShopOffer', offerKey: 'Boon' }]),
      },
    });
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
    expect(
      fTopology(project).occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'f-preboss-shop',
      )?.encounters,
    ).toEqual(prebossShopEncounters);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(fBiome, combatDecision.source, 'exit1'),
        occurrenceId: createOccurrenceId('bad'),
        gameName: 'F_Combat01',
      }),
    ).toThrow(ProjectCommandContractError);
  });

  it('replaces a normal batch with a takeover while retaining physical doors and pruning its subtree', () => {
    const openingId = createOccurrenceId('replace-preboss-opening');
    const sourceId = createOccurrenceId('replace-preboss-source');
    const existingId = createOccurrenceId('replace-preboss-existing');
    const peerId = createOccurrenceId('replace-preboss-peer');
    const descendantId = createOccurrenceId('replace-preboss-descendant');
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: openingId,
      gameName: 'F_Opening01',
    });
    const openingDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: openingId,
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
      occurrenceId: sourceId,
      gameName: 'F_Combat02',
    });
    const sourceDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: sourceId,
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
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit1'),
      occurrenceId: existingId,
      gameName: 'F_Combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit2'),
      occurrenceId: peerId,
      gameName: 'F_Combat03',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, sourceDecision.source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    const descendantDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: existingId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: descendantDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, descendantDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, descendantDecision.source, 'exit1'),
      occurrenceId: descendantId,
      gameName: 'F_Combat03',
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceWithTakeoverBatch',
      decision: sourceDecision,
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: { exit1: existingId, exit2: peerId },
    });

    const topology = fTopology(project);
    expect(
      topology.decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === sourceId,
      ),
    ).toMatchObject({
      normal: {
        rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
        targets: [
          { exitKey: 'exit1', occurrenceId: existingId },
          { exitKey: 'exit2', occurrenceId: peerId },
        ],
      },
      selection: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(topology.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gameName: 'F_PreBoss01',
          occurrenceId: existingId,
          state: expect.objectContaining({ kind: 'shop', shop: expect.any(Object) }),
        }),
        expect.objectContaining({
          gameName: 'F_PreBoss01',
          occurrenceId: peerId,
          state: expect.objectContaining({ kind: 'freeReward' }),
        }),
      ]),
    );
    expect(
      topology.decisions.some(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === existingId,
      ),
    ).toBe(false);
    expect(
      topology.occurrences.some((occurrence) => occurrence.occurrenceId === descendantId),
    ).toBe(false);
  });

  it('derives N fixed start identity through a normal PreHub decision, source-bearing Hub, and width-one handoff', () => {
    expect(() =>
      applyProjectCommand(nProject(), catalog, {
        kind: 'CreateStart',
        biome: nBiome,
        occurrenceId: createOccurrenceId('n-opening'),
        gameName: 'N_Combat01',
      }),
    ).toThrow(ProjectCommandContractError);
    let project = createCompleteNProject();
    const openingDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('round-trip-n-opening'),
    });
    const plan = project.route?.biomes[0];
    expect(plan?.topology).toMatchObject({
      startOccurrenceId: 'round-trip-n-opening',
      occurrences: expect.arrayContaining([
        expect.objectContaining({ occurrenceId: 'round-trip-n-opening', gameName: 'N_Opening01' }),
        expect.objectContaining({ occurrenceId: 'round-trip-n-prehub', gameName: 'N_PreHub01' }),
        expect.objectContaining({
          occurrenceId: 'round-trip-n-preboss',
          gameName: 'N_PreBoss01',
          state: expect.objectContaining({ kind: 'shop' }),
        }),
      ]),
      decisions: expect.arrayContaining([
        expect.objectContaining({
          kind: 'exit',
          source: openingDecision.source,
          normal: expect.objectContaining({
            targets: [{ exitKey: 'prehub', occurrenceId: 'round-trip-n-prehub' }],
          }),
        }),
        expect.objectContaining({
          kind: 'hub',
          hubKey: 'hub',
          source: { kind: 'occurrence', occurrenceId: 'round-trip-n-prehub' },
        }),
      ]),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveExitDecision',
      decision: openingDecision,
    });
    expect(project.route?.biomes[0]?.topology).toMatchObject({
      occurrences: [{ occurrenceId: 'round-trip-n-opening' }],
      decisions: [],
    });
  });

  it('admits only an exact empty N terminal envelope for Hub replacement and restores it on removal', () => {
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
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(nBiome, openingDecision.source, 'prehub'),
      occurrenceId: createOccurrenceId('wrapper-n-prehub'),
      gameName: 'N_PreHub01',
    });
    const preHubDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('wrapper-n-prehub'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: preHubDecision,
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(nBiome, preHubDecision.source, 'exit1'),
        occurrenceId: createOccurrenceId('unexpected-preboss'),
        gameName: 'N_PreBoss01',
      }),
    ).toThrow(ProjectCommandContractError);
    const hub = createHubDecisionAddress(nBiome, 'hub');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceWithHubDecision',
      decision: preHubDecision,
      hub,
    });
    project = applyProjectCommand(project, catalog, { kind: 'RemoveHubDecision', hub });
    const topology = project.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    expect(topology?.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'exit',
          source: preHubDecision.source,
          normal: { kind: 'batch', rewardStore: { kind: 'none' }, batchState: null, targets: [] },
          selection: { kind: 'unresolved' },
        }),
      ]),
    );
    expect(topology?.decisions.some((decision) => decision.kind === 'hub')).toBe(false);
  });

  it('rejects a Hub takeover address outside its terminal decision biome', () => {
    let project = applyProjectCommand(nProject(), catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: createOccurrenceId('addressed-n-opening'),
    });
    const openingDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('addressed-n-opening'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(nBiome, openingDecision.source, 'prehub'),
      occurrenceId: createOccurrenceId('addressed-n-prehub'),
      gameName: 'N_PreHub01',
    });
    const terminalDecision = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('addressed-n-prehub'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: terminalDecision,
    });

    for (const hub of [
      createHubDecisionAddress(fBiome, 'hub'),
      createHubDecisionAddress(createBiomeAddress('Surface', 'O'), 'hub'),
    ]) {
      expect(() =>
        applyProjectCommand(project, catalog, {
          kind: 'ReplaceWithHubDecision',
          decision: terminalDecision,
          hub,
        }),
      ).toThrowError(
        expect.objectContaining({
          detail: 'Hub address does not match the terminal decision biome',
        }),
      );
    }
  });

  it('clears every persisted N topology member through the shared clear impact', () => {
    const project = applyProjectCommand(createCompleteNProject(), catalog, {
      kind: 'ClearTopology',
      biome: nBiome,
    });

    expect(project.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology).toBeNull();
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

  it('re-anchors one selected ordinary continuation without rewriting its subtree or target payload beyond activated defaults', () => {
    const openingId = createOccurrenceId('reanchor-opening');
    const sourceId = createOccurrenceId('reanchor-source');
    const priorId = createOccurrenceId('reanchor-prior');
    const nextId = createOccurrenceId('reanchor-next');
    const descendantId = createOccurrenceId('reanchor-descendant');
    const leafId = createOccurrenceId('reanchor-leaf');
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: openingId,
      gameName: 'F_Opening01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(fBiome, openingId),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(createIncomingRewardAddress(fBiome, openingId), 'source'),
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
    const openingDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: openingId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: openingDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingDecision.source),
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingDecision.source, 'exit1'),
      occurrenceId: sourceId,
      gameName: 'F_Combat02',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(fBiome, sourceId),
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    const sourceDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: sourceId,
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
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit1'),
      occurrenceId: priorId,
      gameName: 'F_Combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit2'),
      occurrenceId: nextId,
      gameName: 'F_Combat04',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(fBiome, priorId),
      value: { rewardType: 'RoomMoneyDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(fBiome, nextId),
      value: { rewardType: 'MaxManaDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, sourceDecision.source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    const priorDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: priorId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: priorDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, priorDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, priorDecision.source, 'exit1'),
      occurrenceId: descendantId,
      gameName: 'F_Combat03',
    });
    const descendantDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: descendantId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: descendantDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, descendantDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, descendantDecision.source, 'exit1'),
      occurrenceId: leafId,
      gameName: 'F_Combat04',
    });

    const before = fTopology(project);
    const beforeOutgoing = before.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === priorId,
    );
    const beforeDescendant = before.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === descendantId,
    );
    if (beforeOutgoing?.kind !== 'exit' || beforeDescendant?.kind !== 'exit') {
      throw new Error('re-anchor fixture is missing its selected continuation');
    }
    const priorPackage = before.occurrences.find(
      (occurrence) => occurrence.occurrenceId === priorId,
    );
    const nextPackage = before.occurrences.find((occurrence) => occurrence.occurrenceId === nextId);
    if (priorPackage === undefined || nextPackage === undefined) {
      throw new Error('re-anchor fixture is missing its target packages');
    }

    const command = {
      kind: 'SetExitSelection' as const,
      selection: createExitSelectionAddress(fBiome, sourceDecision.source),
      value: { kind: 'normal' as const, exitKey: 'exit2' },
    };
    const reanchored = applyProjectCommand(project, catalog, command);
    const history = createProjectHistory(project);
    const reanchoredHistory = applyProjectHistoryCommand(history, catalog, command);
    const topology = fTopology(reanchored);
    const moved = topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === nextId,
    );
    const retainedDescendant = topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === descendantId,
    );
    if (moved?.kind !== 'exit' || retainedDescendant?.kind !== 'exit') {
      throw new Error('re-anchor result is missing its retained continuation');
    }

    expect(
      topology.decisions.some(
        (decision) =>
          decision.kind !== 'localVisit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === priorId,
      ),
    ).toBe(false);
    expect(moved.normal).toEqual(beforeOutgoing.normal);
    expect(retainedDescendant).toEqual(beforeDescendant);
    expect(topology.occurrences.find((occurrence) => occurrence.occurrenceId === priorId)).toEqual(
      priorPackage,
    );
    expect(topology.occurrences.find((occurrence) => occurrence.occurrenceId === nextId)).toEqual({
      ...nextPackage,
      roomActions: {
        order: [
          {
            kind: 'interactIncomingReward',
            producerPoint: 'roomRewardPickup',
            acquisitionRole: 'self',
          },
        ],
      },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(reanchored)), catalog)).toEqual(
      reanchored,
    );
    expect(undoProjectHistory(reanchoredHistory).present).toBe(project);
    expect(redoProjectHistory(undoProjectHistory(reanchoredHistory)).present).toEqual(reanchored);

    const plan = reanchored.route?.biomes[0];
    if (plan === undefined) throw new Error('re-anchor F plan is missing');
    const route = reanchored.route;
    if (route === undefined) throw new Error('re-anchor F route is missing');
    const prefix = materializeBiomePrefix(catalog, fBiome, plan, route.loadout);
    if (prefix?.entryRoom === undefined) throw new Error('re-anchor prefix did not materialize');
    const historyPrefix = composeBiomeHistoryPrefix(catalog, prefix);
    expect(prefix.decisions).toHaveLength(2);
    expect(prefix.frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(fBiome, {
        kind: 'occurrence',
        occurrenceId: nextId,
      }),
      parent: { occurrenceId: nextId },
    });
    expect(historyPrefix).not.toBeNull();
    const evaluated = simulateProject(catalog, reanchored).route?.biomes[0];
    if (evaluated === undefined || !('history' in evaluated)) {
      throw new Error('re-anchor simulation did not retain its reached history');
    }
    const enteredOccurrenceIds = evaluated.history.events.flatMap((event) =>
      event.kind === 'roomEntered' && event.origin.kind === 'occurrence'
        ? [event.origin.occurrenceId]
        : [],
    );
    expect(enteredOccurrenceIds, JSON.stringify(evaluated.findings)).toContain(nextId);
    expect(enteredOccurrenceIds).not.toContain(priorId);
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
    const repaired = project.route?.biomes[1]?.topology?.decisions.find(
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
    expect(project.route?.biomes[3]?.topology?.occurrences).toContainEqual(
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
    expect(project.route?.biomes[3]?.topology?.occurrences).toContainEqual(
      expect.objectContaining({ occurrenceId: 'i-preboss', state: { kind: 'shop' } }),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(iBiome, twoExitDecision.source),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const peerDecision = createExitDecisionAddress(iBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('i-peer'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: peerDecision,
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(iBiome, twoExitDecision.source),
        value: { kind: 'normal', exitKey: 'exit1' },
      }),
    ).toThrow(/cannot rebase the prior selected continuation onto this target/);
  });
});

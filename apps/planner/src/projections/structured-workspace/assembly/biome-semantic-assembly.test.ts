import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createBiomeFieldAddress,
  createEncounterPhaseAddress,
  createEchoKeepsakeReplayAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { authorRequiredTestRoomActions, requireTraits } from '@run-planner/test-fixtures/shared';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  appendCompleteN,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { assembleWorkspaceBiomeSemantics } from './biome-semantic-assembly';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from '../source-index';

function biomeSource(
  project: ProjectDocument,
  routeKey = 'Surface',
  biomeKey = 'N',
): WorkspaceBiomeSource {
  const authoredProject = authorRequiredTestRoomActions(project, catalog);
  const assembly = simulateProjectAssembly(catalog, authoredProject);
  const source = createWorkspaceProjectSourceIndex(
    catalog,
    authoredProject,
    assembly.evaluation,
    (phase) => encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase),
  )
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.plan.biomeKey === biomeKey);
  if (source === undefined) throw new Error(`${routeKey}/${biomeKey} source is missing`);
  return source;
}

function blockBiomeAtFirstBoon(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
): ProjectDocument {
  const evaluated = simulateProject(catalog, project)
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey);
  if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'valid') {
    throw new Error(`${routeKey}/${biomeKey} block fixture did not start complete-valid`);
  }
  const selected = evaluated.rewards.selectedTraitOffers.find(
    (trace) => trace.offer.giverKey !== 'WeaponUpgrade',
  );
  const offer = selected === undefined ? undefined : requireTraits(selected.offer);
  const [first, second, third] = offer?.options ?? [];
  if (
    selected === undefined ||
    offer === undefined ||
    first === undefined ||
    second === undefined ||
    third === undefined
  ) {
    throw new Error(`${routeKey}/${biomeKey} block fixture has no complete boon offer`);
  }
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: selected.address,
    value: {
      kind: 'traits',
      giverKey: offer.giverKey,
      options: [{ ...first, rarity: 'Heroic' }, second, third],
      selectedOptionKey: 'option1',
    },
  });
}

function selectedContractWithoutNormalTargets() {
  const base = createGoldenFGHIProject();
  const located = base.routes.flatMap((route) =>
    route.biomes.flatMap((plan) =>
      (plan.topology?.occurrences ?? []).flatMap((occurrence) => {
        const room = catalog.rooms.byKey[occurrence.gameName];
        return room?.additionalExits.some((exit) => exit.kind === 'zagreusContract')
          ? [{ occurrence, plan, route }]
          : [];
      }),
    ),
  )[0];
  if (located === undefined) throw new Error('semantic assembly selected contract is missing');
  const biome = createBiomeAddress(located.route.routeKey, located.plan.biomeKey);
  const source = { kind: 'occurrence' as const, occurrenceId: located.occurrence.occurrenceId };
  const owner = createExitDecisionAddress(biome, source);
  const additional = createAdditionalExitAddress(biome, source.occurrenceId, 'zagreusContract');
  let project = applyProjectCommand(base, catalog, { kind: 'RemoveExitDecision', decision: owner });
  project = applyProjectCommand(project, catalog, {
    kind: 'AddZagreusContract',
    additional,
    occurrenceId: createOccurrenceId('semantic-assembly-additional-only-contract'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, source),
    value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
  });
  return { additional, biome, owner, project };
}

function emptyNProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    configuredBiomeCounts: { Surface: 1 },
    projectId: 'empty-n-semantic-assembly',
  });
}

function withBelowDepthAnomalyTakeovers(source: WorkspaceBiomeSource): WorkspaceBiomeSource {
  const evaluation = source.evaluation;
  if (evaluation === undefined || !('roomGeneration' in evaluation)) {
    throw new Error('Anomaly workspace witness requires evaluated generation.');
  }
  return Object.freeze({
    ...source,
    evaluation: Object.freeze({
      ...evaluation,
      roomGeneration: Object.freeze({
        ...evaluation.roomGeneration,
        ordinary: Object.freeze({
          ...evaluation.roomGeneration.ordinary,
          anomalyTakeovers: Object.freeze(
            evaluation.roomGeneration.ordinary.anomalyTakeovers.map((support) =>
              Object.freeze({
                ...support,
                selectedPossible: false,
                sourceBiomeDepthCache: support.minimumBiomeDepthCache - 1,
                failedConditions: Object.freeze(['minimumBiomeDepthCache'] as const),
              }),
            ),
          ),
        }),
      }),
    }),
  });
}

function indexOfNode(
  assembly: ReturnType<typeof assembleWorkspaceBiomeSemantics>,
  predicate: (node: (typeof assembly.nodes)[number]) => boolean,
  message: string,
): number {
  const index = assembly.nodes.findIndex(predicate);
  if (index < 0) throw new Error(message);
  return index;
}

function batchTargets(assembly: ReturnType<typeof assembleWorkspaceBiomeSemantics>) {
  return assembly.nodes.flatMap((node) =>
    node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' || node.kind === 'takeoverBatch'
      ? node.targets
      : [],
  );
}

describe('structured workspace biome semantic assembly', () => {
  it('publishes the Postboss keepsake child only when a configured successor reaches the rack', () => {
    const source = biomeSource(createRepresentativeNOPQProject());
    const dormant = assembleWorkspaceBiomeSemantics(catalog, source);
    const reached = assembleWorkspaceBiomeSemantics(catalog, source, undefined, true);
    const dormantPostboss = dormant.completion.find((node) => node.role === 'postboss');
    const reachedPostboss = reached.completion.find((node) => node.role === 'postboss');

    expect(dormantPostboss).not.toHaveProperty('keepsakeSelection');
    expect(reachedPostboss?.keepsakeSelection).toMatchObject({
      value: { kind: 'retain' },
    });
  });

  it('owns a reached Gift Hammer child at the succeeding biome entry address', () => {
    const source = biomeSource(createGoldenFGHIProject(), 'Underworld', 'I');
    const expected = createKeepsakeEquipResultAddress(
      createEchoKeepsakeReplayAddress(goldenIBiome),
      'experimentalHammer',
    );
    const assembly = assembleWorkspaceBiomeSemantics(
      catalog,
      source,
      undefined,
      false,
      (address) => semanticAddressKey(address) === semanticAddressKey(expected),
    );
    expect(assembly.echoKeepsakeReplay?.address).toEqual(expected);
    expect(assembly.preliminaryFocusDestinations.get(semanticAddressKey(expected))).toMatchObject({
      ownerAddress: expected,
      region: 'structure',
      routeKey: 'Underworld',
      biomeKey: 'I',
      nodeKey: assembly.entry?.key,
    });
  });

  it('projects and focuses an evaluated selected continuation without a normal-target overlay', () => {
    const fixture = selectedContractWithoutNormalTargets();
    const source = biomeSource(fixture.project, fixture.biome.routeKey, fixture.biome.biomeKey);
    const authored = source.exitDecision(fixture.owner.source);
    if (authored?.normal.kind !== 'batch') {
      throw new Error('semantic assembly additional-only batch is missing');
    }
    expect(authored.normal.targets).toEqual([]);
    expect(source.evaluatedBatch(fixture.owner)).toBeUndefined();
    expect(source.evaluatedAdditional(fixture.owner)).toHaveLength(1);

    const assembly = assembleWorkspaceBiomeSemantics(catalog, source);
    const node = assembly.nodes.find(
      (candidate) =>
        (candidate.kind === 'ordinaryBatch' || candidate.kind === 'mixedBatch') &&
        semanticAddressKey(candidate.owner) === semanticAddressKey(fixture.owner),
    );
    if (node?.kind !== 'ordinaryBatch' && node?.kind !== 'mixedBatch') {
      throw new Error('semantic assembly additional-only decision is missing');
    }
    expect(node.targets).toEqual([]);
    expect(node.zagreusContract?.door.room.entered).toBe(true);
    expect(
      assembly.preliminaryFocusDestinations.get(semanticAddressKey(fixture.additional))?.nodeKey,
    ).toBe(node.key);
  });

  it('publishes only engine-available Anomaly takeovers while retaining authored Anomaly controls', () => {
    const project = createGoldenFGHIProject();
    const source = biomeSource(project, 'Underworld', 'G');
    const available = assembleWorkspaceBiomeSemantics(catalog, source);
    const decision = available.nodes.find(
      (
        node,
      ): node is Extract<
        (typeof available.nodes)[number],
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' }
      > =>
        (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') &&
        node.targets.some((target) => target.anomalyTakeover !== undefined),
    );
    if (decision === undefined) throw new Error('Anomaly-capable G target is missing');
    const target = decision.targets.find((candidate) => candidate.anomalyTakeover !== undefined);
    if (target === undefined) throw new Error('Anomaly takeover control is missing');

    const unavailable = assembleWorkspaceBiomeSemantics(
      catalog,
      withBelowDepthAnomalyTakeovers(source),
    );
    const unavailableDecision = unavailable.nodes.find(
      (
        node,
      ): node is Extract<
        (typeof unavailable.nodes)[number],
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' }
      > =>
        (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') && node.key === decision.key,
    );
    expect(
      unavailableDecision?.targets.find((candidate) => candidate.exitKey === target.exitKey),
    ).not.toHaveProperty('anomalyTakeover');

    const takenOver = applyProjectCommand(project, catalog, {
      kind: 'SwitchTargetToAnomaly',
      target: target.marker.address as Extract<
        typeof target.marker.address,
        { readonly kind: 'target' }
      >,
    });
    const retained = assembleWorkspaceBiomeSemantics(
      catalog,
      withBelowDepthAnomalyTakeovers(biomeSource(takenOver, 'Underworld', 'G')),
    );
    const retainedTarget = retained.nodes
      .flatMap((node) =>
        node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' ? node.targets : [],
      )
      .find((candidate) => candidate.room.occurrenceId === target.room.occurrenceId);
    expect(retainedTarget?.room.anomaly).toBeDefined();
  });

  it('composes N in authored Opening → PreHub → Hub → Preboss order without duplicate occurrences', () => {
    const source = biomeSource(appendCompleteN(emptyNProject()));
    const assembly = assembleWorkspaceBiomeSemantics(catalog, source);

    const opening = indexOfNode(
      assembly,
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceIds.opening,
      'N Opening workbench is missing',
    );
    const preHubDecision = indexOfNode(
      assembly,
      (node) =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.source.kind === 'occurrence' &&
        node.source.occurrenceId === nOccurrenceIds.opening,
      'N PreHub decision is missing',
    );
    const preHub = indexOfNode(
      assembly,
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceIds.preHub,
      'N PreHub workbench is missing',
    );
    const hub = indexOfNode(
      assembly,
      (node) => node.kind === 'hubDecision',
      'N Hub board is missing',
    );
    const firstHubWorkbench = indexOfNode(
      assembly,
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.inspectorPresentation === 'hubRoomLocal',
      'N Hub room-local workbench is missing',
    );
    const prebossDecision = indexOfNode(
      assembly,
      (node) =>
        (node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        node.source.kind === 'hubDecision',
      'N Preboss handoff is missing',
    );
    const preboss = indexOfNode(
      assembly,
      (node) =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === nOccurrenceIds.preboss,
      'N Preboss workbench is missing',
    );
    expect(opening).toBeLessThan(preHubDecision);
    expect(preHubDecision).toBeLessThan(preHub);
    expect(preHub).toBeLessThan(hub);
    expect(hub).toBeLessThan(firstHubWorkbench);
    expect(firstHubWorkbench).toBeLessThan(prebossDecision);
    expect(prebossDecision).toBeLessThan(preboss);

    const occurrenceIds = assembly.nodes
      .filter(
        (
          node,
        ): node is Extract<
          (typeof assembly.nodes)[number],
          { readonly kind: 'occurrenceWorkbench' }
        > => node.kind === 'occurrenceWorkbench',
      )
      .map((node) => node.room.occurrenceId);
    expect(new Set(occurrenceIds).size).toBe(occurrenceIds.length);
    const notGeneratedLocalOccurrences = new Set(
      (source.plan.topology?.decisions ?? []).flatMap((decision) =>
        decision.kind !== 'localVisit'
          ? []
          : Object.values(decision.targetsBySlot)
              .filter((target) => target.generation === 'notGenerated')
              .map((target) => target.occurrenceId),
      ),
    );
    expect(new Set(occurrenceIds)).toEqual(
      new Set(
        source.plan.topology?.occurrences
          .filter((occurrence) => !notGeneratedLocalOccurrences.has(occurrence.occurrenceId))
          .map((occurrence) => occurrence.occurrenceId),
      ),
    );
    expect(assembly.hubInteractionRequirements.size).toBe(1);
    expect(assembly.occurrenceInteractionRequirements.size).toBeGreaterThan(0);
    expect(assembly.topologyRemovalInteractionRequirements.size).toBe(1);
    expect(assembly.takeoverInteractionRequirements.size).toBeGreaterThan(0);

    const hubNode = assembly.nodes.find((node) => node.kind === 'hubDecision');
    const completion = assembly.completion[0];
    if (hubNode === undefined || completion === undefined) {
      throw new Error('N Hub or completion node is missing');
    }
    expect(assembly.preliminaryFocusDestinations.has(assembly.marker.focusKey)).toBe(true);
    expect(assembly.preliminaryFocusDestinations.has(hubNode.marker.focusKey)).toBe(true);
    expect(assembly.preliminaryFocusDestinations.has(completion.marker.focusKey)).toBe(true);
    expect(assembly.preliminaryFocusDestinations.has(assembly.marker.focusKey)).toBe(true);
  });

  it('keeps the empty N start frontier without publishing an unauthored Hub board', () => {
    const assembly = assembleWorkspaceBiomeSemantics(catalog, biomeSource(emptyNProject()));
    const hub = assembly.structuralNodes.find((node) => node.kind === 'hubDecision');

    expect(assembly.frontier).toMatchObject({ kind: 'start', owner: nBiome });
    expect(hub).toBeUndefined();
    expect(assembly.hubInteractionRequirements.size).toBe(0);
    expect(assembly.roomControls.size).toBe(0);
    expect(assembly.rewardControls.size).toBe(0);
    expect(assembly.startInteractionRequirements.size).toBe(1);
  });

  it('projects declaration-owned biome fields at semantic assembly ownership', () => {
    const assembly = assembleWorkspaceBiomeSemantics(
      catalog,
      biomeSource(createGoldenFGHIProject(), 'Underworld', 'I'),
    );

    expect(assembly.fields).toEqual([
      {
        address: createBiomeFieldAddress(goldenIBiome, 'maxNonGoalRewards'),
        key: 'maxNonGoalRewards',
        kind: 'boundedInteger',
        label: 'Rolled non-goal limit',
        marker: expect.objectContaining({
          address: createBiomeFieldAddress(goldenIBiome, 'maxNonGoalRewards'),
        }),
        value: 3,
        values: [3, 4, 5, 6],
      },
    ]);
  });

  it('keeps incomplete and route-prefix-blocked biome products explicit', () => {
    const initial = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 2 },
      projectId: 'semantic-prefix-states',
    });
    const f = assembleWorkspaceBiomeSemantics(catalog, biomeSource(initial, 'Underworld', 'F'));
    const g = assembleWorkspaceBiomeSemantics(catalog, biomeSource(initial, 'Underworld', 'G'));

    expect(f).toMatchObject({
      frontier: { kind: 'start', owner: goldenFBiome },
      status: 'incomplete',
    });
    expect(g).toMatchObject({ frontier: { kind: 'start' }, status: 'blocked' });

    const partial = applyProjectCommand(initial, catalog, {
      biome: goldenFBiome,
      gameName: 'F_Opening01',
      kind: 'CreateStart',
      occurrenceId: createOccurrenceId('semantic-prefix-f-start'),
    });
    const partialF = assembleWorkspaceBiomeSemantics(
      catalog,
      biomeSource(partial, 'Underworld', 'F'),
    );
    expect(partialF).toMatchObject({
      entry: { room: { gameName: 'F_Opening01' } },
      source: 'progressive',
      status: 'incomplete',
    });
  });

  it('presents a reached contextual block as invalid ahead of a later authored frontier', () => {
    let project = createProjectDocument(catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      projectId: 'blocked-incomplete-semantic-assembly',
    });
    const openingId = createOccurrenceId('blocked-incomplete-f-opening');
    const openingDecision = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: openingId,
    });
    project = applyProjectCommand(project, catalog, {
      biome: goldenFBiome,
      gameName: 'F_Opening01',
      kind: 'CreateStart',
      occurrenceId: openingId,
    });
    const openingReward = createIncomingRewardAddress(goldenFBiome, openingId);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: openingReward,
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(openingReward, 'source'),
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
    project = applyProjectCommand(project, catalog, {
      decision: openingDecision,
      kind: 'CreateBatch',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, openingDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      gameName: 'F_Combat14',
      kind: 'CreateTarget',
      occurrenceId: createOccurrenceId('blocked-incomplete-f-target'),
      target: createTargetAddress(goldenFBiome, openingDecision.source, 'exit1'),
    });

    const source = biomeSource(project, 'Underworld', 'F');
    const assembly = assembleWorkspaceBiomeSemantics(catalog, source);

    expect(source.evaluation).toMatchObject({ authoring: 'incomplete', validity: 'invalid' });
    expect(assembly).toMatchObject({ source: 'progressive', status: 'invalid' });
  });

  it('keeps the full authored biome visible under a blocked progressive overlay', () => {
    const invalid = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      gameName: 'P_Combat02',
      kind: 'ReplaceOccurrenceRoom',
      occurrence: {
        biomeKey: pBiome.biomeKey,
        kind: 'occurrence',
        occurrenceId: pOccurrenceId('P_Combat03', 1, 1),
        routeKey: pBiome.routeKey,
      },
    });
    const assembly = assembleWorkspaceBiomeSemantics(catalog, biomeSource(invalid, 'Surface', 'P'));

    expect(assembly).toMatchObject({ source: 'progressive', status: 'invalid' });
    expect(
      assembly.nodes.some(
        (node) =>
          (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') &&
          node.targets.some((target) => target.marker.findingCount > 0),
      ),
    ).toBe(true);
  });

  it('keeps blocked suffix controls without projecting downstream evaluated room facts', () => {
    const base = createGoldenFGHIProject();
    const project = blockBiomeAtFirstBoon(base, 'Underworld', 'F');
    const source = biomeSource(project, 'Underworld', 'F');
    const laterDecision = source.exitDecisions.find(
      (decision) => !source.isAssessed(createExitDecisionAddress(goldenFBiome, decision.source)),
    );
    if (laterDecision === undefined || laterDecision.normal.kind !== 'batch') {
      throw new Error('semantic assembly F fixture has no retained batch suffix');
    }
    const owner = createExitDecisionAddress(goldenFBiome, laterDecision.source);
    const assembly = assembleWorkspaceBiomeSemantics(catalog, source);
    const node = assembly.nodes.find(
      (
        candidate,
      ): candidate is Extract<
        (typeof assembly.nodes)[number],
        { readonly kind: 'ordinaryBatch' | 'mixedBatch' }
      > =>
        (candidate.kind === 'ordinaryBatch' || candidate.kind === 'mixedBatch') &&
        semanticAddressKey(candidate.owner) === semanticAddressKey(owner),
    );
    if (node === undefined) throw new Error('semantic assembly lost retained batch node');

    expect(node.topologyState).toBe('retained');
    expect(node.targets).not.toHaveLength(0);
    for (const target of node.targets) {
      expect(target).toMatchObject({ physicalState: 'available', retained: true });
      expect(target.room.entered).toBe(false);
      expect(target).not.toHaveProperty('clockworkReward');
      expect(
        assembly.roomControls.has(
          semanticAddressKey(
            createTargetAddress(goldenFBiome, laterDecision.source, target.exitKey),
          ),
        ),
      ).toBe(true);
      expect(
        assembly.rewardControls.has(
          semanticAddressKey(createIncomingRewardAddress(goldenFBiome, target.room.occurrenceId)),
        ),
      ).toBe(true);
    }
  });

  it('keeps biome-specific retained room state without downstream evaluator overlays', () => {
    const underworld = createGoldenFGHIProject();

    const validH = assembleWorkspaceBiomeSemantics(
      catalog,
      biomeSource(underworld, 'Underworld', 'H'),
    );
    const blockedHSource = biomeSource(
      blockBiomeAtFirstBoon(underworld, 'Underworld', 'H'),
      'Underworld',
      'H',
    );
    const blockedH = assembleWorkspaceBiomeSemantics(catalog, blockedHSource);
    const retainedFields = batchTargets(blockedH).find(
      (target) =>
        target.marker.assessment === 'unassessed' && target.room.roomLocal.kind === 'fields',
    );
    if (retainedFields?.room.roomLocal.kind !== 'fields') {
      throw new Error('blocked H fixture has no retained Fields room');
    }
    const validFields = batchTargets(validH).find(
      (target) =>
        semanticAddressKey(target.marker.address) ===
        semanticAddressKey(retainedFields.marker.address),
    );
    if (validFields?.room.roomLocal.kind !== 'fields') {
      throw new Error('valid H fixture lost the matching Fields room');
    }
    expect(retainedFields.room.entered).toBe(false);
    expect(retainedFields.room.roomLocal.cages).not.toHaveLength(0);
    expect(retainedFields.room.roomLocal.cages.map((cage) => cage.key)).toEqual(
      validFields.room.roomLocal.cages.map((cage) => cage.key),
    );
    expect(
      retainedFields.room.roomLocal.cages.every((cage) =>
        blockedH.rewardControls.has(semanticAddressKey(cage.control.owner.address)),
      ),
    ).toBe(true);

    const validISource = biomeSource(underworld, 'Underworld', 'I');
    const validI = assembleWorkspaceBiomeSemantics(catalog, validISource);
    const blockedIProject = applyProjectCommand(underworld, catalog, {
      kind: 'ResetEncounter',
      phase: createEncounterPhaseAddress(
        goldenIBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-i-combat01') },
        'Encounter',
      ),
    });
    const blockedISource = biomeSource(blockedIProject, 'Underworld', 'I');
    const blockedI = assembleWorkspaceBiomeSemantics(catalog, blockedISource);
    const validClockworkTarget = batchTargets(validI).find(
      (target) =>
        target.clockworkReward !== undefined && !blockedISource.isAssessed(target.marker.address),
    );
    if (validClockworkTarget === undefined) {
      throw new Error('blocked I fixture has no retained target with a valid Clockwork overlay');
    }
    const retainedClockworkTarget = batchTargets(blockedI).find(
      (target) =>
        semanticAddressKey(target.marker.address) ===
        semanticAddressKey(validClockworkTarget.marker.address),
    );
    if (retainedClockworkTarget?.room.roomLocal.kind !== 'incomingReward') {
      throw new Error('blocked I fixture lost the retained Clockwork reward room');
    }
    expect(validClockworkTarget.clockworkReward).toBeDefined();
    expect(retainedClockworkTarget.room.entered).toBe(false);
    expect(retainedClockworkTarget).not.toHaveProperty('clockworkReward');
    expect(retainedClockworkTarget.room.roomLocal).not.toHaveProperty('clockworkReward');

    const surface = createRepresentativeNOPQProject();
    const blockedOSource = biomeSource(
      blockBiomeAtFirstBoon(surface, 'Surface', 'O'),
      'Surface',
      'O',
    );
    const blockedO = assembleWorkspaceBiomeSemantics(catalog, blockedOSource);
    const retainedO = batchTargets(blockedO).filter(
      (target) => target.marker.assessment === 'unassessed',
    );
    const retainedShip = retainedO.find((target) => target.room.roomLocal.kind === 'ship');
    const retainedShop = retainedO.find((target) => target.room.roomLocal.kind === 'shop');
    if (
      retainedShip?.room.roomLocal.kind !== 'ship' ||
      retainedShop?.room.roomLocal.kind !== 'shop'
    ) {
      throw new Error('blocked O fixture lost its retained Ship or Shop room');
    }
    expect(retainedShip.room.entered).toBe(false);
    expect(retainedShip.room.roomLocal.wheels).not.toHaveLength(0);
    expect(retainedShop.room.entered).toBe(false);
    expect(retainedShop.room.roomLocal).toMatchObject({ materialized: true });

    const blockedNSource = biomeSource(
      blockBiomeAtFirstBoon(surface, 'Surface', 'N'),
      'Surface',
      'N',
    );
    const blockedN = assembleWorkspaceBiomeSemantics(catalog, blockedNSource);
    const hub = blockedN.nodes.find((node) => node.kind === 'hubDecision');
    if (hub?.kind !== 'hubDecision') throw new Error('blocked N fixture lost its Hub');
    const authoredHub = blockedNSource.plan.topology?.decisions.find(
      (decision) => decision.kind === 'hub',
    );
    const visitedSlotKey = authoredHub?.kind === 'hub' ? authoredHub.visitOrder[0] : undefined;
    const retainedEphyra = hub.slots.find(
      (slot) => slot.hubSlotKey === visitedSlotKey && slot.room?.gameName.startsWith('N_Combat'),
    );
    if (retainedEphyra?.room === undefined) {
      throw new Error('blocked N fixture has no retained Ephyra room');
    }
    expect(retainedEphyra).toMatchObject({ open: true, visited: true });
    expect(retainedEphyra.room).toMatchObject({ detailsActive: true, entered: false });
    expect(retainedEphyra.localVisit?.address.sourceOccurrenceId).toBe(
      retainedEphyra.room.occurrenceId,
    );
    expect(
      blockedN.rewardControls.has(
        semanticAddressKey(
          createIncomingRewardAddress(nBiome, nOccurrenceId(retainedEphyra.hubSlotKey)),
        ),
      ),
    ).toBe(true);
  });
});

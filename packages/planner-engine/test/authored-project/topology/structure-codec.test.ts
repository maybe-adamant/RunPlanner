import { describe, expect, it } from 'vitest';

import {
  applyProjectCommand,
  catalog,
  completeHProject,
  completeOProject,
  completeQProject,
  createBatchRewardStoreAddress,
  createCompleteNProject,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceId,
  createTargetAddress,
  decodeProjectDocument,
  encodedProject,
  encodedTopology,
  expectDocumentError,
  fBiome,
  incompleteZagreusEnvelopeProject,
  loadSurfaceNOPQProject,
  materializeBiomePrefix,
  composeBiomeHistoryPrefix,
  ordinaryTargetAuthoringEligibility,
  oBiome,
  planFor,
  qBiome,
  selectedFTakeoverProject,
  semanticAddressKey,
  terminalEnvelope,
} from '../support/topology-codec-fixtures';

describe('topology structural codec', () => {
  it('round-trips strict local-visit topology and rejects retired or malformed local ownership', () => {
    const complete = createCompleteNProject();
    const encoded = encodedTopology(complete, 'Surface', 'N');
    const localIndex = encoded.topology.decisions.findIndex(
      (decision) => decision.kind === 'localVisit',
    );
    const local = encoded.topology.decisions[localIndex];
    if (localIndex < 0 || local === undefined) throw new Error('complete N local visit is missing');
    expect(decodeProjectDocument(encoded.document, catalog)).toEqual(complete);

    const missing = encodedTopology(complete, 'Surface', 'N');
    missing.topology.decisions.splice(localIndex, 1);
    expect(() => decodeProjectDocument(missing.document, catalog)).toThrow(
      /requires exactly one local visit decision/,
    );

    const extra = encodedTopology(complete, 'Surface', 'N');
    const extraLocal = extra.topology.decisions[localIndex];
    if (extraLocal === undefined) throw new Error('complete N local visit is missing');
    extraLocal.sideRooms = {};
    expect(() => decodeProjectDocument(extra.document, catalog)).toThrow(
      /sideRooms: is not a project document field/,
    );

    const invalidOrder = encodedTopology(complete, 'Surface', 'N');
    const invalidLocal = invalidOrder.topology.decisions[localIndex];
    const targets = invalidLocal?.targetsBySlot as Record<
      string,
      { occurrenceId: string; generation: string }
    >;
    const firstTarget = Object.values(targets)[0];
    if (invalidLocal === undefined || firstTarget === undefined) {
      throw new Error('complete N local visit target is missing');
    }
    firstTarget.generation = 'notGenerated';
    invalidLocal.visitOrder = [firstTarget.occurrenceId];
    expect(() => decodeProjectDocument(invalidOrder.document, catalog)).toThrow(
      /must be generated before entry/,
    );
  });

  it('retains an incomplete Zagreus normal branch and admits its closed automatic host return', () => {
    let document = incompleteZagreusEnvelopeProject();
    const shopSource = {
      kind: 'occurrence' as const,
      occurrenceId: createOccurrenceId('zagreus-shop'),
    };
    const envelope = planFor(document, 'Underworld', 'F').topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === shopSource.occurrenceId,
    );
    expect(envelope).toMatchObject({
      normal: { targets: [] },
      selection: { kind: 'unresolved' },
    });
    expect(
      planFor(document, 'Underworld', 'F').topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === shopSource.occurrenceId,
      )?.additionalExits,
    ).toEqual([
      { kind: 'zagreusContract', key: 'zagreusContract', occurrenceId: 'zagreus-contract' },
    ]);
    expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);

    document = applyProjectCommand(document, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, shopSource),
      value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
    });
    const contractSource = {
      kind: 'occurrence' as const,
      occurrenceId: createOccurrenceId('zagreus-contract'),
    };
    const contractDecision = createExitDecisionAddress(fBiome, contractSource);
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateBatch',
      decision: contractDecision,
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, contractSource),
      storeKey: 'RunProgress',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, contractSource, 'exit1'),
      occurrenceId: createOccurrenceId('zagreus-host-return'),
      gameName: 'F_Combat02',
    });

    expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);
    const returnDecision = planFor(document, 'Underworld', 'F').topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === contractSource.occurrenceId,
    );
    expect(returnDecision).toMatchObject({
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: 'zagreus-host-return' }] },
      selection: { kind: 'derived' },
    });
  });

  it('rejects the retired decision-owned additional-exit field', () => {
    const encoded = encodedTopology(incompleteZagreusEnvelopeProject(), 'Underworld', 'F');
    const shopDecisionIndex = encoded.topology.decisions.findIndex(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'zagreus-shop',
    );
    const shopDecision = encoded.topology.decisions[shopDecisionIndex];
    if (shopDecision === undefined) throw new Error('missing Zagreus Midshop decision');
    shopDecision.additional = [];

    expectDocumentError(encoded.document, {
      path: `${encoded.path}.decisions[${shopDecisionIndex}].additional`,
      detail: 'is not a project document field',
    });
  });

  it.each([
    ['H', completeHProject, 5, 9],
    ['O', completeOProject, 7, 7],
    ['Q', completeQProject, 7, 7],
  ] as const)(
    'round-trips the complete %s topology with its takeover outside ordinary progression',
    (biomeKey, build, expectedBatchCount, expectedTargetCount) => {
      const document = build();
      const plan = document.route.biomes.find((biome) => biome.biomeKey === biomeKey);
      const layout = catalog.biomeLayouts.byKey[biomeKey];
      if (
        plan?.topology === null ||
        plan?.topology === undefined ||
        layout?.progression.kind !== 'generated'
      ) {
        throw new Error(`missing generated ${biomeKey} topology`);
      }
      const batches = plan.topology.decisions.filter(
        (decision) => decision.kind === 'exit' && decision.normal.kind === 'batch',
      );
      const targets = batches.flatMap((decision) =>
        decision.kind === 'exit' && decision.normal.kind === 'batch' ? decision.normal.targets : [],
      );
      expect(batches).toHaveLength(expectedBatchCount);
      expect(targets).toHaveLength(expectedTargetCount);
      expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);
    },
  );

  it('canonicalizes target references in declaration-owned exit order', () => {
    const encoded = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    const takeoverIndex = encoded.topology.decisions.findIndex(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'f-combat',
    );
    const takeover = encoded.topology.decisions[takeoverIndex];
    if (takeover === undefined) throw new Error('missing F takeover decision');
    (takeover.normal as { targets: unknown[] }).targets.reverse();

    const decoded = decodeProjectDocument(encoded.document, catalog);
    const decodedTakeover = decoded.route?.biomes[0]?.topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === 'f-combat',
    );
    expect(decodedTakeover).toMatchObject({
      normal: {
        targets: [
          { exitKey: 'exit1', occurrenceId: 'f-preboss-shop' },
          { exitKey: 'exit2', occurrenceId: 'f-preboss-free' },
        ],
      },
    });
  });

  it.each([
    ['O', 'Surface', oBiome, completeOProject, 'complete-o-6'],
    ['Q', 'Surface', qBiome, loadSurfaceNOPQProject, 'surface-q-second-miniboss-1'],
  ] as const)(
    'round-trips the declaration-evaluated terminal %s envelope',
    (biomeKey, routeKey, biome, build, sourceOccurrenceId) => {
      const document = terminalEnvelope(build(), biome, sourceOccurrenceId);
      const plan = planFor(document, routeKey, biomeKey);
      const layout = catalog.biomeLayouts.byKey[biomeKey];
      if (plan.topology === null || layout?.progression.kind !== 'generated') {
        throw new Error(`missing generated ${biomeKey} terminal envelope`);
      }
      const decision = createExitDecisionAddress(biome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId(sourceOccurrenceId),
      });
      const envelope = plan.topology.decisions.find(
        (candidate) =>
          candidate.kind === 'exit' &&
          semanticAddressKey(createExitDecisionAddress(biome, candidate.source)) ===
            semanticAddressKey(decision),
      );
      const route = document.route;
      if (route === undefined) throw new Error(`missing ${routeKey} route`);
      const prefix = materializeBiomePrefix(catalog, biome, plan, route.loadout);
      if (prefix === null) throw new Error(`missing ${biomeKey} terminal prefix`);
      const history = composeBiomeHistoryPrefix(catalog, prefix);

      expect(envelope).toMatchObject({
        normal: { kind: 'batch', targets: [] },
        selection: { kind: 'unresolved' },
      });
      expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);
      expect(prefix.decisions.filter((candidate) => candidate.kind === 'batch')).toHaveLength(6);
      expect(prefix.frontier).toMatchObject({
        kind: 'exitDecision',
        origin: decision,
        targets: [],
      });
      expect(prefix.frontier).not.toHaveProperty('partialBatch');
      expect(
        history?.events.some(
          (event) => semanticAddressKey(event.origin) === semanticAddressKey(decision),
        ),
      ).toBe(false);
    },
  );

  it('rejects a seventh Q ordinary target through its exhausted staged pool', () => {
    const document = terminalEnvelope(
      loadSurfaceNOPQProject(),
      qBiome,
      'surface-q-second-miniboss-1',
    );
    const plan = planFor(document, 'Surface', 'Q');
    const layout = catalog.biomeLayouts.byKey.Q;
    if (plan.topology === null || layout === undefined) throw new Error('missing Q topology');
    const target = createTargetAddress(
      qBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-q-second-miniboss-1') },
      'exit1',
    );
    expect(
      ordinaryTargetAuthoringEligibility(catalog, layout, plan.topology, target, 'Q_Combat10'),
    ).toMatchObject({ kind: 'unavailable', reason: 'stage', stageKey: '?' });
  });
});

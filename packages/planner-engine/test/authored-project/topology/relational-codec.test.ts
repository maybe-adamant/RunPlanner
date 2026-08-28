import { describe, expect, it } from 'vitest';

import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  catalog,
  completeHProject,
  createBatchRewardStoreAddress,
  createBatchTargets,
  createCompleteNProject,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceId,
  createProjectHistory,
  createTargetAddress,
  decodeProjectDocument,
  encodedProject,
  encodedTopology,
  expectDocumentError,
  fBiome,
  hBiome,
  iAtOrdinaryBatchLimit,
  iBiome,
  planFor,
  project,
  qBiome,
  redoProjectHistory,
  selectedFTakeoverProject,
  semanticAddressKey,
  terminalEnvelope,
  undoProjectHistory,
} from '../support/topology-codec-fixtures';

describe('topology relational closure codec', () => {
  it('rejects a raw over-bound I envelope although it has no realized target', () => {
    const { document, terminalSourceId } = iAtOrdinaryBatchLimit();
    const terminalDecision = createExitDecisionAddress(iBiome, {
      kind: 'occurrence',
      occurrenceId: terminalSourceId,
    });
    expect(() =>
      applyProjectCommand(document, catalog, {
        kind: 'CreateBatch',
        decision: terminalDecision,
      }),
    ).toThrowError(
      expect.objectContaining({
        detail: 'normal progression has reached its declaration-owned batch bound',
      }),
    );

    const encoded = encodedTopology(document, 'Underworld', 'I');
    const template = encoded.topology.decisions.at(-1);
    if (template === undefined) throw new Error('missing final I batch');
    const normal = template.normal as Record<string, unknown>;
    encoded.topology.decisions.push({
      kind: 'exit',
      source: { kind: 'occurrence', occurrenceId: terminalSourceId },
      normal: {
        kind: 'batch',
        rewardStore: normal.rewardStore,
        batchState: normal.batchState,
        targets: [],
      },
      selection: { kind: 'unresolved' },
    });

    expectDocumentError(encoded.document, {
      path: `${encoded.path}.decisions`,
      detail: 'exceeds 13 normal batches',
    });
  });

  it('records and removes an H terminal envelope as one ordinary semantic edit', () => {
    const decision = createExitDecisionAddress(hBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('complete-h-07'),
    });
    const withoutTakeover = applyProjectCommand(completeHProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision,
    });
    const initial = createProjectHistory(withoutTakeover);
    const created = applyProjectHistoryCommand(initial, catalog, {
      kind: 'CreateBatch',
      decision,
    });
    const undone = undoProjectHistory(created);
    const redone = redoProjectHistory(undone);

    expect(created.present).toEqual(terminalEnvelope(completeHProject(), hBiome, 'complete-h-07'));
    expect(undone.present).toEqual(withoutTakeover);
    expect(redone.present).toEqual(created.present);
    const removed = applyProjectCommand(redone.present, catalog, {
      kind: 'RemoveExitDecision',
      decision,
    });
    expect(
      planFor(removed, 'Underworld', 'H').topology?.decisions.some(
        (candidate) =>
          candidate.kind === 'exit' &&
          semanticAddressKey(createExitDecisionAddress(hBiome, candidate.source)) ===
            semanticAddressKey(decision),
      ),
    ).toBe(false);
  });

  it('derives staged selection from the selected spine rather than decision storage order', () => {
    let document = applyProjectCommand(project('codec-staged-q', { Surface: 4 }), catalog, {
      kind: 'CreateStart',
      biome: qBiome,
      occurrenceId: createOccurrenceId('q-intro'),
    });
    document = createBatchTargets(document, {
      biome: qBiome,
      sourceOccurrenceId: 'q-intro',
      targets: [{ exitKey: 'exit1', occurrenceId: 'q-foyer', gameName: 'Q_Combat10' }],
    });
    document = createBatchTargets(document, {
      biome: qBiome,
      sourceOccurrenceId: 'q-foyer',
      targets: [{ exitKey: 'exit1', occurrenceId: 'q-first-fork', gameName: 'Q_Combat03' }],
    });
    const reordered = encodedTopology(document, 'Surface', 'Q');
    reordered.topology.decisions.reverse();
    expect(() => decodeProjectDocument(reordered.document, catalog)).not.toThrow();

    const firstFork = reordered.topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'q-first-fork',
    );
    if (firstFork === undefined) throw new Error('missing first-fork occurrence');
    firstFork.gameName = 'Q_Combat02';
    expectDocumentError(reordered.document, {
      path: reordered.path,
      detail: 'Q_Combat02 is not available in staged pool firstFork',
    });
  });

  it('uses selected topology ownership to require active Shop entry state', () => {
    let document = applyProjectCommand(project('codec-dormant-shop', { Underworld: 1 }), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('shop-opening'),
      gameName: 'F_Opening01',
    });
    document = createBatchTargets(document, {
      biome: fBiome,
      sourceOccurrenceId: 'shop-opening',
      rewardStoreKey: 'RunProgress',
      targets: [{ exitKey: 'exit1', occurrenceId: 'shop-source', gameName: 'F_Combat02' }],
    });
    const sourceDecision = createExitDecisionAddress(fBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('shop-source'),
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateBatch',
      decision: sourceDecision,
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, sourceDecision.source),
      storeKey: 'RunProgress',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit1'),
      occurrenceId: createOccurrenceId('shop-peer'),
      gameName: 'F_Combat01',
    });
    document = applyProjectCommand(document, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, sourceDecision.source, 'exit2'),
      occurrenceId: createOccurrenceId('ordinary-shop'),
      gameName: 'F_Shop01',
    });
    expect(decodeProjectDocument(encodedProject(document), catalog)).toEqual(document);

    const selectedWithoutEntryState = encodedTopology(document, 'Underworld', 'F');
    const decision = selectedWithoutEntryState.topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        (candidate.source as { occurrenceId?: string }).occurrenceId === 'shop-source',
    );
    const shopIndex = selectedWithoutEntryState.topology.occurrences.findIndex(
      (occurrence) => occurrence.occurrenceId === 'ordinary-shop',
    );
    if (decision === undefined || shopIndex < 0) throw new Error('missing dormant Shop topology');
    decision.selection = { kind: 'normal', exitKey: 'exit2' };
    expectDocumentError(selectedWithoutEntryState.document, {
      path: `${selectedWithoutEntryState.path}.occurrences[${shopIndex}].state.shop`,
      detail: 'is required for an entered shop occurrence',
    });

    const selected = applyProjectCommand(document, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, sourceDecision.source),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(decodeProjectDocument(encodedProject(selected), catalog)).toEqual(selected);
  });

  it('accepts Hub decision storage order but rejects malformed Hub source and linked normal ownership', () => {
    const reordered = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    reordered.topology.decisions.reverse();
    expect(() => decodeProjectDocument(reordered.document, catalog)).not.toThrow();

    const unsupportedLinkedNormal = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const opening = unsupportedLinkedNormal.topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'round-trip-n-opening',
    );
    if (opening === undefined) throw new Error('missing normal PreHub entry');
    opening.normal = {
      kind: 'linked',
      exitKey: 'prehub',
      occurrenceId: 'round-trip-n-prehub',
    };
    expectDocumentError(unsupportedLinkedNormal.document, {
      path: `${unsupportedLinkedNormal.path}.decisions[0].normal.kind`,
      detail: 'unknown normal exit form linked',
    });

    const unsupportedHubSource = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const hubIndex = unsupportedHubSource.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    const hub = unsupportedHubSource.topology.decisions[hubIndex];
    if (hub === undefined) throw new Error('missing Hub decision');
    hub.source = { kind: 'hubDecision', decisionKey: 'hub' };
    expectDocumentError(unsupportedHubSource.document, {
      path: `${unsupportedHubSource.path}.decisions[${hubIndex}].source`,
      detail: 'Hub decision source must be an occurrence',
    });

    const unknownHubSource = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const unknownHubIndex = unknownHubSource.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    const unknownHub = unknownHubSource.topology.decisions[unknownHubIndex];
    if (unknownHub === undefined) throw new Error('missing Hub decision');
    unknownHub.source = { kind: 'occurrence', occurrenceId: 'missing-prehub' };
    expectDocumentError(unknownHubSource.document, {
      path: `${unknownHubSource.path}.decisions[${unknownHubIndex}].source.occurrenceId`,
      detail: 'unknown occurrence missing-prehub',
    });

    const competingHubOwner = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const competingHubIndex = competingHubOwner.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    if (competingHubIndex < 0) throw new Error('missing Hub decision');
    competingHubOwner.topology.decisions.push({
      kind: 'exit',
      source: { kind: 'occurrence', occurrenceId: 'round-trip-n-prehub' },
      normal: {
        kind: 'batch',
        rewardStore: { kind: 'none' },
        batchState: null,
        targets: [],
      },
      selection: { kind: 'unresolved' },
    });
    expectDocumentError(competingHubOwner.document, {
      path: `${competingHubOwner.path}.decisions[${competingHubIndex}].source`,
      detail: 'Hub decision cannot coexist with an exit decision at its source',
    });

    const nonTerminalHubSource = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const nonTerminalHubIndex = nonTerminalHubSource.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    const nonTerminalHub = nonTerminalHubSource.topology.decisions[nonTerminalHubIndex];
    if (nonTerminalHub === undefined) throw new Error('missing Hub decision');
    nonTerminalHub.source = { kind: 'occurrence', occurrenceId: 'round-trip-n-opening' };
    nonTerminalHubSource.topology.decisions = nonTerminalHubSource.topology.decisions.filter(
      (decision) =>
        !(
          decision.kind === 'exit' &&
          (decision.source as { occurrenceId?: string }).occurrenceId === 'round-trip-n-opening'
        ),
    );
    const nonTerminalHubAfterRemovalIndex = nonTerminalHubSource.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    expectDocumentError(nonTerminalHubSource.document, {
      path: `${nonTerminalHubSource.path}.decisions[${nonTerminalHubAfterRemovalIndex}].source`,
      detail: 'Hub source does not resolve the declared terminal Hub takeover',
    });
  });

  it('rejects invalid selection, decision-source, exit-key, reachability, owner, and cycle shapes', () => {
    const widthOne = encodedTopology(
      applyProjectCommand(project('codec-width-one', { Underworld: 1 }), catalog, {
        kind: 'CreateStart',
        biome: fBiome,
        occurrenceId: createOccurrenceId('f-width-one'),
        gameName: 'F_Opening01',
      }),
      'Underworld',
      'F',
    );
    widthOne.topology.occurrences.push({
      occurrenceId: 'f-width-one-target',
      gameName: 'F_Combat02',
      state: { kind: 'counted', offer: { rewardType: 'Boon' } },
      encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {}, gorgonResultByPhase: {} },
      roomActions: { order: [] },
      additionalExits: [],
    });
    widthOne.topology.decisions.push({
      kind: 'exit',
      source: { kind: 'occurrence', occurrenceId: 'f-width-one' },
      normal: {
        kind: 'batch',
        rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
        batchState: null,
        targets: [{ exitKey: 'exit1', occurrenceId: 'f-width-one-target' }],
      },
      selection: { kind: 'normal', exitKey: 'exit1' },
    });
    expectDocumentError(widthOne.document, {
      path: `${widthOne.path}.decisions[0].selection`,
      detail: 'a width-one normal exit must use derived selection',
    });

    const duplicateSource = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    duplicateSource.topology.decisions.push({ ...duplicateSource.topology.decisions[0]! });
    expectDocumentError(duplicateSource.document, {
      path: `${duplicateSource.path}.decisions[2]`,
      detail: 'duplicates decision source exit:occurrence:f-start',
    });

    const inventedExitKey = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    const takeover = inventedExitKey.topology.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        (decision.source as { occurrenceId?: string }).occurrenceId === 'f-combat',
    );
    if (takeover === undefined) throw new Error('missing F takeover decision');
    const targets = (takeover.normal as { targets: Array<{ exitKey: string }> }).targets;
    targets[1]!.exitKey = 'banana';
    expectDocumentError(inventedExitKey.document, {
      path: `${inventedExitKey.path}.decisions[1].normal.targets[1].exitKey`,
      detail: 'banana is not a declaration-owned normal exit key',
    });

    const deadLeaf = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    deadLeaf.topology.decisions.push({
      kind: 'exit',
      source: { kind: 'occurrence', occurrenceId: 'f-preboss-free' },
      normal: {
        kind: 'batch',
        rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
        batchState: null,
        targets: [],
      },
      selection: { kind: 'unresolved' },
    });
    expectDocumentError(deadLeaf.document, {
      path: `${deadLeaf.path}.decisions[2].source.occurrenceId`,
      detail: 'source is not on the selected topology spine',
    });

    const orphan = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    orphan.topology.occurrences.push({
      occurrenceId: 'orphan',
      gameName: 'F_Combat02',
      state: { kind: 'counted', offer: { rewardType: 'Boon' } },
      encounters: { encounterKeyByPhase: {}, figLeafSkipByPhase: {}, gorgonResultByPhase: {} },
      roomActions: { order: [] },
      additionalExits: [],
    });
    expectDocumentError(orphan.document, {
      path: `${orphan.path}.occurrences[6]`,
      detail: 'occurrence orphan has no structural owner',
    });

    const cycle = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    const opening = cycle.topology.decisions[0];
    if (opening === undefined) throw new Error('missing F opening decision');
    const openingTargets = (opening.normal as { targets: Array<{ occurrenceId: string }> }).targets;
    openingTargets[0]!.occurrenceId = 'f-start';
    expectDocumentError(cycle.document, {
      path: cycle.path,
      detail: 'selected topology spine contains a decision cycle',
    });

    const multiplyOwned = encodedTopology(selectedFTakeoverProject(), 'Underworld', 'F');
    const multiplyOwnedTakeover = multiplyOwned.topology.decisions[1];
    if (multiplyOwnedTakeover === undefined) throw new Error('missing F takeover decision');
    const takeoverTargets = (
      multiplyOwnedTakeover.normal as { targets: Array<{ occurrenceId: string }> }
    ).targets;
    takeoverTargets[1]!.occurrenceId = 'f-preboss-shop';
    expectDocumentError(multiplyOwned.document, {
      path: `${multiplyOwned.path}.decisions[1].normal.targets[1].occurrenceId`,
      detail: 'occurrence f-preboss-shop has multiple structural owners',
    });
  });

  it('rejects a Hub target without an occurrence at its exact owner path', () => {
    const malformedHub = encodedTopology(createCompleteNProject(), 'Surface', 'N');
    const hubIndex = malformedHub.topology.decisions.findIndex(
      (decision) => decision.kind === 'hub',
    );
    const hub = malformedHub.topology.decisions[hubIndex];
    if (hub === undefined) throw new Error('missing Hub decision');
    hub.openTargets = [{ hubSlotKey: 'combat01', occurrenceId: 'missing-hub-target' }];
    expectDocumentError(malformedHub.document, {
      path: `${malformedHub.path}.decisions[${hubIndex}].openTargets[0].occurrenceId`,
      detail: 'unknown occurrence missing-hub-target',
    });
  });
});

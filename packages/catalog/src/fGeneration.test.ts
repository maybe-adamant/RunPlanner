import {
  applyProjectCommand,
  CandidateEvaluationContractError,
  composeFHistory,
  createBiomeAddress,
  createBatchRewardStoreAddress,
  createContinuationAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createRouteAddress,
  createIncomingRewardAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  evaluateFCompleteness,
  evaluateFRoomGeneration,
  evaluateProjectCandidate,
  evaluateProjectCandidates,
  materializeLinearBiome,
  semanticAddressKey,
  simulateProject,
  type CompleteFCompletenessResult,
  type LinearBiomePlan,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const biome = createBiomeAddress('Underworld', 'F');
const gBiome = createBiomeAddress('Underworld', 'G');
const startId = createOccurrenceId('possibility-start');

interface BatchSpec {
  readonly targets: readonly string[];
  readonly pickedExitIndex: number;
}

const baselineBatches: readonly BatchSpec[] = [
  { targets: ['F_Combat02'], pickedExitIndex: 1 },
  { targets: ['F_Combat03', 'F_Combat03'], pickedExitIndex: 1 },
  { targets: ['F_Combat04', 'F_Combat04'], pickedExitIndex: 1 },
  { targets: ['F_Combat05', 'F_Combat11'], pickedExitIndex: 1 },
  { targets: ['F_Combat06', 'F_Combat06'], pickedExitIndex: 1 },
  { targets: ['F_MiniBoss01', 'F_MiniBoss02'], pickedExitIndex: 1 },
  { targets: ['F_Combat11'], pickedExitIndex: 1 },
  { targets: ['F_Combat12', 'F_Combat12'], pickedExitIndex: 1 },
  { targets: ['F_Combat14', 'F_Combat14'], pickedExitIndex: 1 },
  { targets: ['F_Combat15', 'F_Combat15'], pickedExitIndex: 1 },
];

function fPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0];
  if (plan?.biomeKey !== 'F') {
    throw new Error('missing F possibility fixture plan');
  }
  return plan;
}

function complete(project: ProjectDocument): CompleteFCompletenessResult {
  const result = evaluateFCompleteness(catalog, biome, fPlan(project));
  if (result.completion !== 'complete') {
    throw new Error(`possibility fixture is incomplete: ${result.findings[0]?.code}`);
  }
  return result;
}

function batchOccurrenceId(batchIndex: number, exitIndex: number) {
  return createOccurrenceId(`possibility-b${batchIndex}-e${exitIndex}`);
}

function possibilityProject(batches: readonly BatchSpec[] = baselineBatches): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'f-possibility',
    name: 'F Possibility',
    configuredBiomeCounts: { Underworld: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });

  let parentId = startId;
  batches.forEach((batch, batchOffset) => {
    const batchIndex = batchOffset + 1;
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      continuation: createContinuationAddress(biome, parentId),
    });
    batch.targets.forEach((gameName, targetOffset) => {
      const exitIndex = targetOffset + 1;
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, parentId, exitIndex),
        occurrenceId: batchOccurrenceId(batchIndex, exitIndex),
        gameName,
      });
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetPicked',
      picked: createPickedAddress(biome, parentId),
      exitIndex: batch.pickedExitIndex,
    });
    parentId = batchOccurrenceId(batchIndex, batch.pickedExitIndex);
  });

  const parent = catalog.rooms.byKey[batches.at(-1)!.targets[batches.at(-1)!.pickedExitIndex - 1]!];
  if (parent === undefined) {
    throw new Error('terminal fixture parent is missing');
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, parentId),
    targetOccurrenceIds: parent.exits.map((exit) =>
      createOccurrenceId(`possibility-terminal-e${exit.index}`),
    ),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, parentId),
    exitIndex: 1,
  });
}

function evaluate(project: ProjectDocument = possibilityProject()) {
  const snapshot = materializeLinearBiome(catalog, biome, complete(project));
  const history = composeFHistory(catalog, snapshot);
  return { snapshot, history, generation: evaluateFRoomGeneration(catalog, snapshot, history) };
}

function pressure(result: ReturnType<typeof evaluate>, batchIndex: number, exitIndex: number) {
  const target = createTargetAddress(
    biome,
    batchIndex === 1
      ? startId
      : batchOccurrenceId(batchIndex - 1, baselineBatches[batchIndex - 2]!.pickedExitIndex),
    exitIndex,
  );
  const entry = result.generation.forcePressure.find(
    (candidate) => JSON.stringify(candidate.targetOrigin) === JSON.stringify(target),
  );
  if (entry === undefined) {
    throw new Error(`missing pressure entry for batch ${batchIndex} exit ${exitIndex}`);
  }
  return entry;
}

function targetAddress(batchIndex: number, exitIndex: number) {
  return createTargetAddress(
    biome,
    batchIndex === 1
      ? startId
      : batchOccurrenceId(batchIndex - 1, baselineBatches[batchIndex - 2]!.pickedExitIndex),
    exitIndex,
  );
}

function roomCandidate(
  project: ProjectDocument,
  batchIndex: number,
  exitIndex: number,
  gameName: string,
) {
  return evaluateProjectCandidate(catalog, project, {
    kind: 'roomTarget',
    target: targetAddress(batchIndex, exitIndex),
    gameName,
  });
}

function withGTarget(project: ProjectDocument): ProjectDocument {
  const gStartId = createOccurrenceId('candidate-g-start');
  let result = applyProjectCommand(project, catalog, {
    kind: 'ConfigureRoutePrefix',
    route: createRouteAddress('Underworld'),
    configuredBiomeCount: 2,
  });
  result = applyProjectCommand(result, catalog, {
    kind: 'CreateStart',
    biome: gBiome,
    occurrenceId: gStartId,
    gameName: 'G_Intro',
  });
  result = applyProjectCommand(result, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(gBiome, gStartId),
  });
  return applyProjectCommand(result, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(gBiome, gStartId, 1),
    occurrenceId: createOccurrenceId('candidate-g-target'),
    gameName: 'G_Combat01',
  });
}

function incompleteFProject(): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: 'candidate-incomplete',
    name: 'Candidate Incomplete',
    configuredBiomeCounts: { Underworld: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, startId),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: targetAddress(1, 1),
    occurrenceId: batchOccurrenceId(1, 1),
    gameName: 'F_Combat02',
  });
}

describe('F room possibility and generation validation', () => {
  it('accepts positive-support rooms, peer repeats, and a later repeat of an unentered room', () => {
    const result = evaluate();
    const optionalWindow = pressure(result, 5, 1);
    const firstForced = pressure(result, 6, 1);
    const secondForced = pressure(result, 6, 2);
    const laterRepeat = pressure(result, 7, 1);
    const repeatedPeer = pressure(result, 3, 2);

    expect(result.generation.validity).toBe('valid');
    expect(result.generation.findings).toEqual([]);
    expect(optionalWindow).toMatchObject({
      selectedGameName: 'F_Combat06',
      selectedPossible: true,
      optionalForcedRoomGameNames: ['F_MiniBoss01', 'F_MiniBoss02', 'F_MiniBoss03', 'F_Shop01'],
      requiredForcedRoomGameNames: [],
      biomeDepthCache: 4,
      biomeEncounterDepth: 6,
    });
    expect(optionalWindow.supportRoomGameNames).toContain('F_Combat06');
    expect(firstForced).toMatchObject({
      selectedGameName: 'F_MiniBoss01',
      selectedPossible: true,
    });
    expect(firstForced.requiredForcedRoomGameNames).toEqual([
      'F_MiniBoss01',
      'F_MiniBoss02',
      'F_MiniBoss03',
      'F_Shop01',
    ]);
    expect(secondForced.requiredForcedRoomGameNames).not.toContain('F_MiniBoss01');
    expect(secondForced.requiredForcedRoomGameNames).toContain('F_MiniBoss02');
    expect(repeatedPeer).toMatchObject({
      selectedGameName: 'F_Combat04',
      selectedCreationCount: 1,
      selectedAppearanceCount: 0,
      selectedParentCreationCount: 1,
      selectedPossible: true,
    });
    expect(laterRepeat).toMatchObject({
      selectedGameName: 'F_Combat11',
      selectedCreationCount: 1,
      selectedAppearanceCount: 0,
      selectedParentCreationCount: 0,
      selectedPossible: true,
      selectedExclusionReasons: [],
    });
  });

  it('evaluates entered-miniboss mutual exclusion from the later target history', () => {
    const batches = baselineBatches.map((batch, index) => {
      if (index === 5) {
        return { targets: ['F_MiniBoss01', 'F_Combat20'], pickedExitIndex: 1 };
      }
      if (index === 6) {
        return { targets: ['F_MiniBoss02'], pickedExitIndex: 1 };
      }
      if (index === 7) {
        return { targets: [batch.targets[0]!], pickedExitIndex: 1 };
      }
      return batch;
    });
    const result = evaluate(possibilityProject(batches));
    const excluded = pressure(result, 7, 1);

    expect(excluded).toMatchObject({
      selectedGameName: 'F_MiniBoss02',
      selectedAppearanceCount: 0,
      selectedPossible: false,
      selectedExclusionReasons: ['eligibilityRequirement'],
    });
    expect(result.generation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: excluded.targetOrigin,
      }),
    );
  });

  it('rejects an ordinary room when the required forced pool is active', () => {
    const batches = baselineBatches.map((batch, index) =>
      index === 5 ? { targets: ['F_Combat20', 'F_MiniBoss01'], pickedExitIndex: 2 } : batch,
    );
    const result = evaluate(possibilityProject(batches));
    const finding = result.generation.findings.find(
      (candidate) =>
        candidate.code === 'targetRoomUnavailable' &&
        candidate.origin.kind === 'target' &&
        candidate.origin.parentOccurrenceId === batchOccurrenceId(5, 1) &&
        candidate.origin.exitIndex === 1,
    );

    expect(result.generation.validity).toBe('invalid');
    expect(finding?.evidence).toMatchObject({
      selectedGameName: 'F_Combat20',
      exclusionReasons: ['forcedPool'],
    });
    expect(finding?.evidence.requiredForcedRoomGameNames).toContain('F_MiniBoss01');
    expect(finding?.evidence.supportRoomGameNames).not.toContain('F_Combat20');
  });

  it('separates creation caps from entered appearance caps', () => {
    const batches = baselineBatches.map((batch, index): BatchSpec => {
      if (index === 4) {
        return { targets: ['F_Combat06', 'F_Story01'], pickedExitIndex: 1 };
      }
      if (index === 7) {
        return { targets: ['F_Combat12', 'F_Story01'], pickedExitIndex: 1 };
      }
      if (index === 8) {
        return { targets: ['F_Combat14', 'F_Combat11'], pickedExitIndex: 1 };
      }
      return batch;
    });
    const result = evaluate(possibilityProject(batches));
    const unavailable = result.generation.findings.filter(
      (finding) => finding.code === 'targetRoomUnavailable',
    );

    expect(unavailable).toHaveLength(2);
    expect(unavailable.map((finding) => finding.evidence)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          selectedGameName: 'F_Story01',
          selectedCreationCount: 1,
          selectedAppearanceCount: 0,
          exclusionReasons: ['maxCreationsThisRun'],
        }),
        expect.objectContaining({
          selectedGameName: 'F_Combat11',
          selectedCreationCount: 2,
          selectedAppearanceCount: 1,
          exclusionReasons: ['maxAppearancesThisBiome'],
        }),
      ]),
    );
  });

  it('preserves retained overflow for semantic physical-exit validation', () => {
    let project = possibilityProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, batchOccurrenceId(7, 1)),
      gameName: 'F_Combat10',
    });
    const result = evaluate(project);
    const overflow = result.snapshot.batches[7]!.targets[1]!;
    const finding = result.generation.findings.find(
      (candidate) =>
        candidate.code === 'targetRoomUnavailable' &&
        candidate.origin.kind === 'target' &&
        candidate.origin.exitIndex === 2 &&
        candidate.origin.parentOccurrenceId === batchOccurrenceId(7, 1),
    );

    expect(overflow.exit).toEqual({ kind: 'unavailable', index: 2 });
    expect(finding?.evidence.exclusionReasons).toContain('physicalExitUnavailable');
  });

  it('rejects a snapshot whose source identity is newer than its supplied history', () => {
    const baseline = evaluate();
    const project = applyProjectCommand(possibilityProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, startId),
      gameName: 'F_Opening02',
    });
    const snapshot = materializeLinearBiome(catalog, biome, complete(project));

    expect(() => evaluateFRoomGeneration(catalog, snapshot, baseline.history)).toThrowError(
      /source .* does not match its history appearance/,
    );
  });

  it('rejects a snapshot whose target identity is newer than its supplied history', () => {
    const baseline = evaluate();
    const project = applyProjectCommand(possibilityProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, batchOccurrenceId(2, 2)),
      gameName: 'F_Combat04',
    });
    const snapshot = materializeLinearBiome(catalog, biome, complete(project));

    expect(() => evaluateFRoomGeneration(catalog, snapshot, baseline.history)).toThrowError(
      /target .* does not match its history creation/,
    );
  });

  it('reaches the terminal at the declared depth without treating force maximum as a ceiling', () => {
    const result = evaluate();
    const terminal = result.generation.forcePressure.slice(-2);

    expect(terminal.map((entry) => entry.beforeSequence)).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    );
    expect(terminal.every((entry) => entry.selectedGameName === 'F_PreBoss01')).toBe(true);
    expect(terminal.every((entry) => entry.biomeDepthCache === 10)).toBe(true);
    expect(terminal.every((entry) => entry.selectedPossible)).toBe(true);
    expect(
      terminal.every((entry) => entry.requiredForcedRoomGameNames.includes('F_PreBoss01')),
    ).toBe(true);
    expect(result.history.rooms.at(-4)?.preOutgoing?.ledgers.counters.biomeDepthCache).toBe(10);
  });
});

describe('project candidate evaluation', () => {
  it('projects authored F starts and base reward stores through semantic owners', () => {
    const project = possibilityProject();
    const opening = evaluateProjectCandidate(catalog, project, {
      kind: 'startRoom',
      owner: createOccurrenceAddress(biome, startId),
      gameName: 'F_Opening02',
    });
    const unsupportedOpening = evaluateProjectCandidate(catalog, project, {
      kind: 'startRoom',
      owner: createOccurrenceAddress(biome, startId),
      gameName: 'F_Combat01',
    });
    const store = createBatchRewardStoreAddress(biome, startId);
    const stores = evaluateProjectCandidates(catalog, project, [
      { kind: 'batchRewardStore', rewardStore: store, storeKey: 'RunProgress' },
      { kind: 'batchRewardStore', rewardStore: store, storeKey: 'MetaProgress' },
    ]);

    expect(opening).toMatchObject({ context: 'evaluated', support: 'possible' });
    expect(unsupportedOpening).toMatchObject({ context: 'evaluated', support: 'impossible' });
    expect(stores).toHaveLength(2);
    expect(
      stores.filter(
        (candidate) => candidate.context === 'evaluated' && candidate.support !== 'impossible',
      ),
    ).not.toHaveLength(0);
    const selectedStoreFindings = simulateProject(catalog, project).findings.filter(
      (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(store),
    );
    const currentStore = stores[0];
    expect(currentStore?.context).toBe('evaluated');
    if (currentStore?.context === 'evaluated') {
      expect(currentStore.findings).toEqual(selectedStoreFindings);
    }
    const authoredMeta = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: store,
      storeKey: 'MetaProgress',
    });
    const authoredMetaFindings = simulateProject(catalog, authoredMeta).findings.filter(
      (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(store),
    );
    const metaStore = stores[1];
    expect(metaStore?.context).toBe('evaluated');
    if (metaStore?.context === 'evaluated') {
      expect(metaStore.findings).toEqual(authoredMetaFindings);
    }
  });

  it('evaluates selected incoming rewards, shop offers, and purchases with selected-plan parity', () => {
    let project = possibilityProject();
    const shopId = batchOccurrenceId(5, 1);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, shopId),
      gameName: 'F_Shop01',
    });
    const plan = fPlan(project);
    const room = plan.topology?.occurrences.find(
      (candidate): candidate is RoomOccurrence => candidate.occurrenceId === shopId,
    );
    if (room?.state.kind !== 'shop' || room.state.shop === undefined) {
      throw new Error('candidate shop fixture did not materialize inventory');
    }
    const firstOffer = Object.values(room.state.shop.offers)[0];
    const firstOfferKey = Object.keys(room.state.shop.offers)[0];
    if (firstOffer === undefined || firstOfferKey === undefined) {
      throw new Error('candidate shop fixture has no first offer');
    }
    const incomingId = batchOccurrenceId(4, 1);
    const incoming = plan.topology?.occurrences.find(
      (candidate): candidate is RoomOccurrence => candidate.occurrenceId === incomingId,
    );
    if (incoming?.state.kind !== 'counted') {
      throw new Error('candidate incoming fixture has no counted reward');
    }
    const offerAddress = createShopOfferAddress(biome, shopId, firstOfferKey);
    const purchaseAddress = createShopPurchaseAddress(biome, shopId, firstOfferKey);
    const results = evaluateProjectCandidates(catalog, project, [
      {
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(biome, incomingId),
        value: incoming.state.offer,
      },
      { kind: 'shopOffer', offer: offerAddress, value: firstOffer.offer },
      {
        kind: 'shopPurchase',
        purchase: purchaseAddress,
        purchased: firstOffer.purchased,
      },
    ]);
    const selected = simulateProject(catalog, project).findings;

    for (const result of results) {
      expect(result.context).toBe('evaluated');
      if (result.context !== 'evaluated') {
        continue;
      }
      expect(result.support === 'impossible').toBe(result.findings.length > 0);
      for (const finding of result.findings) {
        expect(selected).toContainEqual(finding);
      }
    }
    const purchasedCandidate = evaluateProjectCandidate(catalog, project, {
      kind: 'shopPurchase',
      purchase: purchaseAddress,
      purchased: true,
    });
    const authoredPurchase = applyProjectCommand(project, catalog, {
      kind: 'SetShopPurchase',
      purchase: purchaseAddress,
      purchased: true,
    });
    expect(purchasedCandidate.context).toBe('evaluated');
    if (purchasedCandidate.context === 'evaluated') {
      for (const finding of purchasedCandidate.findings) {
        expect(simulateProject(catalog, authoredPurchase).findings).toContainEqual(finding);
      }
    }

    const earlyIncomingId = batchOccurrenceId(1, 1);
    const alternateIncoming = evaluateProjectCandidate(catalog, project, {
      kind: 'incomingReward',
      reward: createIncomingRewardAddress(biome, earlyIncomingId),
      value: { rewardType: 'StackUpgrade' },
    });
    const authoredImpossibleIncoming = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, earlyIncomingId),
      value: { rewardType: 'StackUpgrade' },
    });
    expect(alternateIncoming.context).toBe('evaluated');
    if (alternateIncoming.context === 'evaluated') {
      for (const finding of alternateIncoming.findings) {
        expect(simulateProject(catalog, authoredImpossibleIncoming).findings).toContainEqual(
          finding,
        );
      }
    }

    const profile = catalog.rewards.shops.byKey[room.state.shop.profileKey];
    const slot = profile?.slots.byKey[firstOfferKey];
    const group =
      profile === undefined || slot === undefined ? undefined : profile.groups.byKey[slot.groupKey];
    const alternateRewardType = group?.rewardTypes.find(
      (rewardType) => rewardType !== firstOffer.offer.rewardType,
    );
    const alternateDeclaration =
      alternateRewardType === undefined
        ? undefined
        : catalog.rewards.rewardTypes.byKey[alternateRewardType];
    if (alternateRewardType === undefined || alternateDeclaration === undefined) {
      throw new Error('candidate shop fixture has no alternate first-slot offer');
    }
    const alternateShopOffer = {
      rewardType: alternateRewardType,
      ...(alternateDeclaration.defaultPayload === undefined
        ? {}
        : { payload: alternateDeclaration.defaultPayload }),
    };
    const alternateShop = evaluateProjectCandidate(catalog, project, {
      kind: 'shopOffer',
      offer: offerAddress,
      value: alternateShopOffer,
    });
    const authoredAlternateShop = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: offerAddress,
      value: alternateShopOffer,
    });
    expect(alternateShop.context).toBe('evaluated');
    if (alternateShop.context === 'evaluated') {
      for (const finding of alternateShop.findings) {
        expect(simulateProject(catalog, authoredAlternateShop).findings).toContainEqual(finding);
      }
    }
  });

  it('reports possible, forced, and impossible room support without mutating the project', () => {
    const project = possibilityProject();
    const before = JSON.stringify(project);

    const [possible, forced, impossible] = evaluateProjectCandidates(catalog, project, [
      { kind: 'roomTarget', target: targetAddress(5, 1), gameName: 'F_Combat20' },
      { kind: 'roomTarget', target: targetAddress(6, 1), gameName: 'F_MiniBoss03' },
      { kind: 'roomTarget', target: targetAddress(6, 1), gameName: 'F_Combat20' },
    ]);

    expect(possible).toMatchObject({
      context: 'evaluated',
      support: 'possible',
      findings: [],
    });
    expect(forced).toMatchObject({
      context: 'evaluated',
      support: 'forced',
      findings: [],
    });
    expect(impossible).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      evidence: {
        candidateGameName: 'F_Combat20',
        exclusionReasons: ['forcedPool'],
      },
      findings: [
        expect.objectContaining({
          code: 'targetRoomUnavailable',
          origin: targetAddress(6, 1),
        }),
      ],
    });
    expect(JSON.stringify(project)).toBe(before);
  });

  it('matches the selected-plan pressure and findings after applying the same replacement', () => {
    const project = possibilityProject();
    const cases = [
      { batchIndex: 5, exitIndex: 1, gameName: 'F_Combat20', support: 'possible' },
      { batchIndex: 6, exitIndex: 1, gameName: 'F_MiniBoss03', support: 'forced' },
      { batchIndex: 6, exitIndex: 2, gameName: 'F_Combat20', support: 'impossible' },
    ] as const;

    for (const parityCase of cases) {
      const target = targetAddress(parityCase.batchIndex, parityCase.exitIndex);
      const candidate = roomCandidate(
        project,
        parityCase.batchIndex,
        parityCase.exitIndex,
        parityCase.gameName,
      );
      const selectedProject = applyProjectCommand(project, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(
          biome,
          batchOccurrenceId(parityCase.batchIndex, parityCase.exitIndex),
        ),
        gameName: parityCase.gameName,
      });
      const selectedEvaluation = simulateProject(catalog, selectedProject);
      const selectedBiome = selectedEvaluation.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((evaluation) => evaluation.biomeKey === 'F');
      if (selectedBiome?.completion !== 'complete') {
        throw new Error('selected candidate parity fixture did not produce complete F');
      }
      const targetKey = semanticAddressKey(target);
      const selectedPressure = selectedBiome.roomGeneration.forcePressure.find(
        (entry) => semanticAddressKey(entry.targetOrigin) === targetKey,
      );
      const selectedFindings = selectedBiome.roomGeneration.findings.filter(
        (finding) => semanticAddressKey(finding.origin) === targetKey,
      );

      expect(candidate.context).toBe('evaluated');
      if (candidate.context !== 'evaluated') {
        throw new Error('candidate context unexpectedly unavailable');
      }
      expect(candidate.support).toBe(parityCase.support);
      expect(candidate.evidence).toMatchObject({
        candidateGameName: selectedPressure?.selectedGameName,
        eligibleRoomGameNames: selectedPressure?.eligibleRoomGameNames,
        requiredForcedRoomGameNames: selectedPressure?.requiredForcedRoomGameNames,
        supportRoomGameNames: selectedPressure?.supportRoomGameNames,
        exclusionReasons: selectedPressure?.selectedExclusionReasons,
      });
      expect(candidate.findings).toEqual(selectedFindings);
    }
  });

  it('keeps an already-authored impossible room assessable', () => {
    const batches = baselineBatches.map((batch, index) =>
      index === 5 ? { targets: ['F_Combat20', 'F_MiniBoss01'], pickedExitIndex: 2 } : batch,
    );
    const candidate = roomCandidate(possibilityProject(batches), 6, 1, 'F_Combat20');

    expect(candidate).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      evidence: {
        candidateGameName: 'F_Combat20',
        exclusionReasons: ['forcedPool'],
      },
    });
  });

  it('reports unavailable context for a target in an incomplete biome', () => {
    expect(roomCandidate(incompleteFProject(), 1, 1, 'F_Combat03')).toEqual({
      context: 'unavailable',
      query: {
        kind: 'roomTarget',
        target: targetAddress(1, 1),
        gameName: 'F_Combat03',
      },
      reason: 'biomeIncomplete',
    });
  });

  it('distinguishes unavailable upstream history contexts', () => {
    const gTarget = createTargetAddress(gBiome, createOccurrenceId('candidate-g-start'), 1);
    const query = { kind: 'roomTarget' as const, target: gTarget, gameName: 'G_Combat02' };
    const invalidBatches = baselineBatches.map((batch, index) =>
      index === 5 ? { targets: ['F_Combat20', 'F_MiniBoss01'], pickedExitIndex: 2 } : batch,
    );

    expect(evaluateProjectCandidate(catalog, withGTarget(incompleteFProject()), query)).toEqual({
      context: 'unavailable',
      query,
      reason: 'upstreamIncomplete',
    });
    expect(
      evaluateProjectCandidate(catalog, withGTarget(possibilityProject(invalidBatches)), query),
    ).toEqual({
      context: 'unavailable',
      query,
      reason: 'upstreamInvalid',
    });
  });

  it('fails malformed candidate addresses at the candidate contact boundary', () => {
    const project = possibilityProject();
    const missingTarget = createTargetAddress(biome, startId, 2);

    expect(() =>
      evaluateProjectCandidate(catalog, project, {
        kind: 'roomTarget',
        target: missingTarget,
        gameName: 'F_Combat03',
      }),
    ).toThrow(
      new CandidateEvaluationContractError(
        { kind: 'roomTarget', target: missingTarget, gameName: 'F_Combat03' },
        'exit 2 has no authored target',
      ),
    );
  });
});

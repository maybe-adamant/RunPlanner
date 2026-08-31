import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  assembleRoomActionDomain,
  createBatchRewardStoreAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createRouteAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRoomActionAddress,
  createTargetAddress,
  createTraitOfferAddress,
  roomActionKey,
  semanticAddressKey,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  evaluateBiomeCompleteness,
  materializeBiome,
  simulateProjectAssembly,
  simulateProject,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { authorSurfaceWorldShop } from '@run-planner/test-fixtures/surface';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';

function evaluateO(project = loadSurfaceNOProject()) {
  const evaluation = simulateProject(catalog, project);
  const biome = evaluation.route.biomes.find((candidate) => candidate.biomeKey === 'O');
  if (biome?.authoring !== 'complete') throw new Error('O fixture did not complete');
  return { project, evaluation, biome };
}

function evaluateValidO(project = loadSurfaceNOProject()) {
  const result = evaluateO(project);
  if (result.biome.validity !== 'valid') {
    throw new Error(
      `O fixture did not complete-valid: ${JSON.stringify({
        findings: result.biome.findings,
        rewardFindings: result.biome.rewards.findings,
        branchCount: result.biome.rewards.branches.length,
      })}`,
    );
  }
  return { ...result, biome: result.biome };
}

function createEmptyTrialDecision(sourceProject = loadSurfaceNOProject()) {
  const decision = createExitDecisionAddress(oBiome, {
    kind: 'occurrence',
    occurrenceId: oOccurrenceIds.combat01,
  });
  let project = applyProjectCommand(sourceProject, catalog, {
    kind: 'RemoveExitDecision',
    decision,
  });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  return {
    project,
    target: createTargetAddress(oBiome, decision.source, 'exit1'),
  };
}

function materializedORoom(
  project: ReturnType<typeof loadSurfaceNOProject>,
  occurrenceId: typeof oOccurrenceIds.combat07,
) {
  const route = project.route;
  const plan = route?.biomes.find((candidate) => candidate.biomeKey === 'O');
  if (route === undefined || plan === undefined) throw new Error('O fixture plan is missing');
  const completeness = evaluateBiomeCompleteness(catalog, oBiome, plan);
  if (completeness.completion !== 'complete') throw new Error('O fixture is incomplete');
  const snapshot = materializeBiome(catalog, oBiome, completeness, route.loadout);
  const room = snapshot.decisions
    .filter((decision) => decision.kind === 'batch')
    .flatMap((decision) => decision.targets.map((target) => target.room))
    .find((candidate) => candidate.occurrenceId === occurrenceId);
  if (room?.kind !== 'authored') throw new Error('materialized O room is missing');
  return room;
}

describe('selected O validation', () => {
  it('adds the third-phase required cohort atomically and reuses retained ranks after reactivation', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const initial = loadSurfaceNOProject();
    const beforeOrder = initial.route.biomes
      .find((plan) => plan.biomeKey === 'O')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === oOccurrenceIds.combat07,
      )?.roomActions.order;
    if (beforeOrder === undefined) throw new Error('two-phase Ship order is missing');
    const initialHistory = createProjectHistory(initial);
    const expandedHistory = applyProjectHistoryCommand(initialHistory, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const expanded = expandedHistory.present;
    const expandedOrder = expanded.route.biomes
      .find((plan) => plan.biomeKey === 'O')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === oOccurrenceIds.combat07,
      )?.roomActions.order;
    expect(expandedHistory.past).toHaveLength(1);
    expect(expandedOrder).toEqual([
      ...beforeOrder,
      { kind: 'chooseRewardWheel', wheelKey: 'wheel2' },
      { kind: 'interactWheelReward', wheelKey: 'wheel2' },
    ]);
    expect(
      materializedORoom(expanded, oOccurrenceIds.combat07).roomLifecycleTimeline.entries,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'action',
          action: expect.objectContaining({
            key: roomActionKey({ kind: 'chooseRewardWheel', wheelKey: 'wheel2' }),
          }),
        }),
        expect.objectContaining({
          kind: 'action',
          action: expect.objectContaining({
            key: roomActionKey({ kind: 'interactWheelReward', wheelKey: 'wheel2' }),
          }),
        }),
      ]),
    );
    expect(undoProjectHistory(expandedHistory).present).toBe(initialHistory.present);

    const reduced = applyProjectCommand(expanded, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 2,
    });
    const restored = applyProjectCommand(reduced, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const restoredOrder = restored.route.biomes
      .find((plan) => plan.biomeKey === 'O')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === oOccurrenceIds.combat07,
      )?.roomActions.order;
    expect(restoredOrder).toEqual(expandedOrder);
  });

  it('adds a newly required contact without repairing an unrelated retained Ship timing error', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const wheel2Choice = { kind: 'chooseRewardWheel' as const, wheelKey: 'wheel2' };
    project = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(oBiome, oOccurrenceIds.combat07, roomActionKey(wheel2Choice)),
      toIndex: 0,
    });
    const invalidBefore = materializedORoom(project, oOccurrenceIds.combat07);
    expect(invalidBefore.roomActionRoster.issues).toContainEqual(
      expect.objectContaining({ kind: 'window' }),
    );
    const retainedOrder = invalidBefore.roomActions.order;

    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(oBiome, occurrence, 'Combat2'),
      encounterKey: 'IcarusCombatO',
    });
    const after = materializedORoom(project, oOccurrenceIds.combat07);
    const contact = { kind: 'interactEncounter' as const, phaseKey: 'Combat2' };
    expect(
      after.roomActions.order.filter(
        (reference) => roomActionKey(reference) !== roomActionKey(contact),
      ),
    ).toEqual(retainedOrder);
    expect(after.roomActions.order).toContainEqual(contact);
    expect(after.roomActionRoster.issues).toContainEqual(
      expect.objectContaining({ kind: 'window' }),
    );
  });

  it('validates the complete N/O prefix with exact Ship support and forced Preboss pressure', () => {
    const { project, evaluation, biome: o } = evaluateO();

    expect(evaluation.status).toBe('valid');
    expect(o.findings).toEqual([]);
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const shipCounts = [
      oOccurrenceIds.combat04,
      oOccurrenceIds.combat07,
      oOccurrenceIds.combat01,
      oOccurrenceIds.combat02,
    ].map((occurrenceId) => {
      const candidate = candidates.evaluate({
        kind: 'shipEncounterCount',
        occurrence: createOccurrenceAddress(oBiome, occurrenceId),
        encounterCount: 2,
      });
      if (candidate.kind !== 'shipEncounterCount') {
        throw new Error(`O Ship ${occurrenceId} candidate is unavailable`);
      }
      return {
        selected: candidate.result.encounterCount,
        support: candidate.result.supportEncounterCounts,
      };
    });
    expect(shipCounts).toEqual([
      { selected: 2, support: [2] },
      { selected: 2, support: [2, 3] },
      { selected: 2, support: [2, 3] },
      { selected: 2, support: [2, 3] },
    ]);
    expect(
      o.roomGeneration.ordinary.ordinaryBatches
        .flatMap((batch) => batch.targets.map((target) => target.pressure))
        .find((entry) => entry.selectedGameName === 'O_Devotion01'),
    ).toMatchObject({ selectedPossible: true, selectedExclusionReasons: [] });
    expect(o.rewards.targetHistory).toHaveLength(7);
  });

  it('keeps one authored chronology across both Ship combat windows and resolves the final wheel store', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel2 = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    let project = loadSurfaceNOProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel: wheel2,
      offerCount: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: wheel2,
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer1'),
      value: { rewardType: 'RoomMoneyDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const { biome } = evaluateValidO(authorLegalTraitOffers(project));
    const sourceDecision = biome.snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.origin.source.kind === 'occurrence' &&
        decision.origin.source.occurrenceId === oOccurrenceIds.combat07,
    );
    if (sourceDecision?.kind !== 'batch') throw new Error('Ship source decision is missing');
    const room = biome.snapshot.decisions
      .filter((decision) => decision.kind === 'batch')
      .flatMap((decision) => decision.targets.map((target) => target.room))
      .find((candidate) => candidate.occurrenceId === oOccurrenceIds.combat07);
    if (room?.kind !== 'authored') throw new Error('Ship source room is missing');

    expect(room.roomActionRoster.rows.map((row) => row.reference)).toEqual([
      { kind: 'chooseRewardWheel', wheelKey: 'wheel1' },
      { kind: 'interactWheelReward', wheelKey: 'wheel1' },
      { kind: 'chooseRewardWheel', wheelKey: 'wheel2' },
      { kind: 'interactWheelReward', wheelKey: 'wheel2' },
    ]);
    const authoredOccurrence = project.route.biomes
      .find((plan) => plan.biomeKey === 'O')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === oOccurrenceIds.combat07,
      );
    if (authoredOccurrence === undefined) throw new Error('authored Ship occurrence is missing');
    const domain = assembleRoomActionDomain({
      catalog,
      biome: oBiome,
      occurrence: authoredOccurrence,
    });
    expect(
      domain.contributions
        .filter((entry) => entry.kind === 'action')
        .map((entry) => roomActionKey(entry.reference)),
    ).toEqual(room.roomActionRoster.rows.filter((row) => !row.stale).map((row) => row.key));
    expect(room.roomActionRoster.checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkpointKey: 'combat:Combat1', afterRank: 2 }),
        expect.objectContaining({ checkpointKey: 'nextPhaseUsable:wheel1', afterRank: 2 }),
        expect.objectContaining({ checkpointKey: 'combat:Combat2', afterRank: 4 }),
        expect.objectContaining({
          checkpointKey: 'outgoingGeneration',
          afterRank: 4,
          window: { kind: 'shipPostCombat', wheelKey: 'wheel2' },
        }),
        expect.objectContaining({ checkpointKey: 'exitUsable', afterRank: 4 }),
      ]),
    );
    expect(
      room.roomActionRoster.proposals.find(
        (proposal) =>
          proposal.kind === 'move' &&
          proposal.reference.kind === 'chooseRewardWheel' &&
          proposal.reference.wheelKey === 'wheel2' &&
          proposal.toIndex === 1,
      ),
    ).toMatchObject({ structurallyAuthorable: false });
    expect(sourceDecision.rewardStore).toMatchObject({ kind: 'sourceOfferPoint' });
    expect(sourceDecision.resolvedSharedRewardStoreKey).toBe('RunProgress');

    const wheel2Choice = { kind: 'chooseRewardWheel' as const, wheelKey: 'wheel2' };
    const invalidOrder = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(oBiome, oOccurrenceIds.combat07, roomActionKey(wheel2Choice)),
      toIndex: 0,
    });
    const invalidRoom = materializedORoom(invalidOrder, oOccurrenceIds.combat07);
    expect(invalidRoom.roomActionRoster.issues).toContainEqual(
      expect.objectContaining({
        kind: 'dependency',
        reference: wheel2Choice,
        detail: 'afterCheckpoint nextPhaseUsable:wheel1',
      }),
    );
  });

  it('keeps dormant Wheel 2 out of a two-phase chronology and resolves outgoing from Wheel 1', () => {
    const wheel2 = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    let project = loadSurfaceNOProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: wheel2,
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel: wheel2,
      offerCount: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer1'),
      value: { rewardType: 'GiftDrop' },
    });
    const { biome } = evaluateValidO(authorLegalTraitOffers(project));
    const decisions = biome.snapshot.decisions.filter((decision) => decision.kind === 'batch');
    const sourceDecision = decisions.find(
      (decision) =>
        decision.origin.source.kind === 'occurrence' &&
        decision.origin.source.occurrenceId === oOccurrenceIds.combat07,
    );
    const predecessorDecision = decisions.find(
      (decision) =>
        decision.origin.source.kind === 'occurrence' &&
        decision.origin.source.occurrenceId === oOccurrenceIds.combat04,
    );
    const room = decisions
      .flatMap((decision) => decision.targets.map((target) => target.room))
      .find((candidate) => candidate.occurrenceId === oOccurrenceIds.combat07);
    if (sourceDecision === undefined || predecessorDecision === undefined || room === undefined) {
      throw new Error('two-phase Ship chronology is missing');
    }

    expect(room.roomActionRoster.rows.map((row) => row.reference)).toEqual([
      { kind: 'chooseRewardWheel', wheelKey: 'wheel1' },
      { kind: 'interactWheelReward', wheelKey: 'wheel1' },
    ]);
    expect(
      room.roomActionRoster.checkpoints.some(
        (checkpoint) =>
          checkpoint.checkpointKey.includes('wheel2') ||
          checkpoint.checkpointKey === 'combat:Combat2',
      ),
    ).toBe(false);
    expect(
      room.roomActionRoster.checkpoints.find(
        (checkpoint) => checkpoint.checkpointKey === 'outgoingGeneration',
      ),
    ).toMatchObject({
      afterRank: 2,
      window: { kind: 'shipPostCombat', wheelKey: 'wheel1' },
    });
    expect(predecessorDecision.resolvedSharedRewardStoreKey).toBe('RunProgress');
    expect(sourceDecision.rewardStore).toMatchObject({ kind: 'sourceOfferPoint' });
    expect(sourceDecision.resolvedSharedRewardStoreKey).toBe('MetaProgress');
  });

  it('keeps a retained Combat2 NPC contact dormant across a 3 -> 2 -> 3 edit', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const phase = createEncounterPhaseAddress(oBiome, occurrence, 'Combat2');
    let withThree = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    withThree = applyProjectCommand(withThree, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'IcarusCombatO',
    });
    withThree = authorLegalTraitOffers(withThree);

    const withTwo = applyProjectCommand(withThree, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 2,
    });
    const dormantRoom = materializedORoom(withTwo, oOccurrenceIds.combat07);
    const dormantContact = dormantRoom.roomActionRoster.rows.find(
      (row) => row.reference.kind === 'interactEncounter' && row.reference.phaseKey === 'Combat2',
    );
    expect(dormantContact).toMatchObject({ stale: true });
    expect(
      dormantRoom.roomActionRoster.checkpoints.map((checkpoint) => checkpoint.checkpointKey),
    ).not.toContain('combat:Combat2');

    const restored = applyProjectCommand(withTwo, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const restoredRoom = materializedORoom(restored, oOccurrenceIds.combat07);
    expect(
      restoredRoom.roomActionRoster.rows.find(
        (row) => row.reference.kind === 'interactEncounter' && row.reference.phaseKey === 'Combat2',
      ),
    ).toMatchObject({ stale: false, participation: 'required' });
  });

  it('assesses a retained Wheel 2 reward only after Wheel 1 acquisition history', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel1 = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel1');
    const wheel2 = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: wheel1,
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel1', 'offer1'),
      value: { rewardType: 'GiftDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel: wheel2,
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel: wheel2,
      offerCount: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer1'),
      value: { rewardType: 'GiftDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const evaluated = evaluateO(authorLegalTraitOffers(project)).biome;

    expect(evaluated.rewards.findings).toContainEqual(
      expect.objectContaining({
        code: 'baseRewardStoreUnavailable',
        origin: wheel2,
      }),
    );
    expect(evaluated.rewards.findings).not.toContainEqual(
      expect.objectContaining({
        code: 'baseRewardStoreUnavailable',
        origin: wheel1,
      }),
    );
  });

  it('preserves a non-Ship terminal base store through the Preboss takeover and fixed completion chain', () => {
    const terminalDecision = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat02,
    });
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: terminalDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.devotion),
      gameName: 'O_Reprieve01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion),
      value: { rewardType: 'MaxHealthDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat02),
      gameName: 'O_Devotion01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(oBiome, oOccurrenceIds.combat02),
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AresUpgrade',
          spurnedSource: 'HephaestusUpgrade',
        },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: terminalDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(oBiome, terminalDecision.source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceWithTakeoverBatch',
      decision: terminalDecision,
      gameName: 'O_PreBoss01',
      targetOccurrenceIds: { exit1: oOccurrenceIds.preboss },
    });
    project = authorSurfaceWorldShop(project, oBiome, oOccurrenceIds.preboss);
    const postboss = createOccurrenceAddress(
      oBiome,
      createOccurrenceId(`${oOccurrenceIds.preboss}:postboss`),
    );
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'MaxHealthDrop'],
      ['secondRight', 'MaxManaDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: postboss,
        slotKey,
        value: { rewardType },
      });
    }

    const { biome } = evaluateValidO(authorLegalTraitOffers(project));
    expect(biome.snapshot.decisions.at(-1)).toMatchObject({
      kind: 'batch',
      rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
      targets: [
        {
          room: {
            gameName: 'O_PreBoss01',
            incomingReward: { resolvedStoreKey: 'RunProgress' },
          },
        },
      ],
    });
    expect(biome.snapshot.fixedRoomLinks[0]?.target).toMatchObject({
      gameName: 'O_Boss01',
      enteredRewardStoreKey: 'RunProgress',
    });
  });

  it('addresses an unavailable first-room Combat2 count at its exact phase', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const { biome: o } = evaluateO(project);
    const candidate = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate({ kind: 'shipEncounterCount', occurrence, encounterCount: 3 });

    expect(o.validity).toBe('invalid');
    if (!('materializedPrefix' in o)) {
      throw new Error('invalid Ship phase did not retain an assessed prefix');
    }
    const blockedPhaseEvents = o.history.events.filter(
      (event) =>
        'origin' in event &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === oOccurrenceIds.combat04,
    );
    const creation = blockedPhaseEvents.find((event) => event.kind === 'roomCreated');
    const preparation = blockedPhaseEvents.find((event) => event.kind === 'roomPrepared');
    const recorded = blockedPhaseEvents.filter((event) => event.kind === 'encounterRecorded');
    expect(creation).toBeDefined();
    expect(preparation).toBeDefined();
    expect(recorded.map((event) => event.phaseKey)).toEqual(['Intro', 'Combat1']);
    expect(blockedPhaseEvents.some((event) => event.kind === 'roomEntered')).toBe(false);
    expect(blockedPhaseEvents.some((event) => event.kind === 'encounterStarted')).toBe(false);
    const blockedFinding = o.findings.find(
      (finding) =>
        finding.code === 'encounterSlotActivationUnavailable' &&
        finding.origin.kind === 'encounterPhase' &&
        finding.origin.owner.kind === 'occurrence' &&
        finding.origin.owner.occurrenceId === oOccurrenceIds.combat04 &&
        finding.origin.phaseKey === 'Combat2',
    );
    if (preparation === undefined || blockedFinding === undefined) {
      throw new Error('blocked Ship phase lost its preparation checkpoint or finding');
    }
    const beforeSequence = blockedFinding.evidence.beforeSequence;
    if (typeof beforeSequence !== 'number') {
      throw new Error('blocked Ship phase lost its numeric preparation evidence');
    }
    expect(recorded[0]?.sequence).toBe(preparation.sequence + 1);
    expect(beforeSequence).toBe(recorded.at(-1)?.sequence);
    expect(blockedFinding).toMatchObject({ evidence: { slotKey: 'Combat2' } });
    expect(candidate).toMatchObject({
      kind: 'shipEncounterCount',
      result: {
        supportEncounterCounts: [2],
        selectedPossible: false,
        findings: [
          expect.objectContaining({
            code: 'encounterSlotActivationUnavailable',
            origin: createEncounterPhaseAddress(
              oBiome,
              { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
              'Combat2',
            ),
          }),
        ],
      },
    });
  });

  it('retains only the blocked Devotion role capability before its after-combat sibling', () => {
    const base = authorLegalTraitOffers(loadSurfaceNOProject());
    const baseO = evaluateValidO(base).biome;
    const owner = createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion);
    const selected = baseO.rewards.selectedTraitOffers.filter(
      (trace) => semanticAddressKey(trace.address.owner) === semanticAddressKey(owner),
    );
    const chosen = selected.find((trace) => trace.acquisitionRole === 'chosenSource');
    const spurned = selected.find((trace) => trace.acquisitionRole === 'spurnedSource');
    if (chosen === undefined || spurned === undefined || chosen.offer.kind !== 'traits') {
      throw new Error('Devotion capability fixture lost its legal trait roles');
    }
    const [first, second, third] = chosen.offer.options;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Devotion chosen offer lost its complete options');
    }
    const chosenAddress = createTraitOfferAddress(owner, 'chosenSource');
    const spurnedAddress = createTraitOfferAddress(owner, 'spurnedSource');
    const project = applyProjectCommand(base, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: chosenAddress,
      value: {
        kind: 'traits',
        giverKey: chosen.offer.giverKey,
        options: [{ ...first, rarity: 'Heroic' }, second, third],
        selectedOptionKey: 'option1',
      },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const evaluated = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'O');
    if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'invalid') {
      throw new Error('invalid Devotion chosen offer did not block complete O');
    }

    expect(evaluated.coverage).toMatchObject({ kind: 'prefix', blockedAt: chosenAddress });
    expect(evaluated.rewards.selectedTraitOffers).toContainEqual(
      expect.objectContaining({ address: chosenAddress }),
    );
    expect(evaluated.rewards.selectedTraitOffers).not.toContainEqual(
      expect.objectContaining({ address: spurnedAddress }),
    );
    const session = createPreparedProjectCandidateSession(catalog, assembly);
    expect(
      session.evaluate({ kind: 'traitOffer', trait: chosenAddress, value: chosen.offer }),
    ).toMatchObject({ kind: 'traitOffer', result: { supported: true, findings: [] } });
    expect(
      session.evaluate({ kind: 'traitOffer', trait: spurnedAddress, value: spurned.offer }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('retains the invalid Combat2 owner for diagnosis while commands remain structural', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const phase = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
      'Combat2',
    );

    const selected = applyProjectCommand(project, catalog, {
      encounterKey: 'IcarusCombatO',
      kind: 'SelectEncounter',
      phase,
    });
    expect(selected).not.toBe(project);
    expect(applyProjectCommand(project, catalog, { kind: 'ResetEncounter', phase })).toBe(project);
  });

  it('rejects replacement of the declaration-fixed Devotion reward type', () => {
    expect(() =>
      applyProjectCommand(loadSurfaceNOProject(), catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion),
        value: { rewardType: 'WeaponUpgrade' },
      }),
    ).toThrow(/O_Devotion01 has a fixed reward type/);
  });

  it('retains forced-pool and appearance-cap failures at their physical target owners', () => {
    const forced = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.story),
      gameName: 'O_Combat03',
    });
    const { biome: forcedBiome } = evaluateO(forced);
    expect(
      forcedBiome.roomGeneration.ordinary.ordinaryBatches
        .flatMap((batch) => batch.targets.map((target) => target.pressure))
        .find(
          (entry) =>
            entry.targetOrigin.kind === 'target' &&
            entry.targetOrigin.source.kind === 'occurrence' &&
            entry.targetOrigin.source.occurrenceId === oOccurrenceIds.devotion,
        ),
    ).toMatchObject({ selectedPossible: false, selectedExclusionReasons: ['forcedPool'] });

    const capped = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat02),
      gameName: 'O_Combat01',
    });
    const { biome: cappedBiome } = evaluateO(capped);
    expect(
      cappedBiome.roomGeneration.ordinary.ordinaryBatches
        .flatMap((batch) => batch.targets.map((target) => target.pressure))
        .find(
          (entry) =>
            entry.targetOrigin.kind === 'target' &&
            entry.targetOrigin.source.kind === 'occurrence' &&
            entry.targetOrigin.source.occurrenceId === oOccurrenceIds.story,
        ),
    ).toMatchObject({
      selectedPossible: false,
      selectedExclusionReasons: expect.arrayContaining(['maxAppearancesThisBiome']),
    });
  });

  it('keeps a jointly overdrawn wheel failure attached to its concrete offer owner', () => {
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel: createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
      offerCount: 2,
    });
    for (const offerKey of ['offer1', 'offer2'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceRewardWheelOffer',
        offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', offerKey),
        value: { rewardType: 'SpellDrop' },
      });
    }
    const { biome } = evaluateO(project);

    expect(biome.validity).toBe('invalid');
    expect(biome.rewards.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
      }),
    );
  });

  it('keeps a wheel-offer failure assessable from its wheel store repair', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const offer = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    const baseProject = loadSurfaceNOProject();
    const baseSession = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, baseProject),
    );
    expect(
      baseSession.evaluate({ kind: 'rewardWheelStore', wheel, storeKey: 'MetaProgress' }),
    ).toMatchObject({
      kind: 'rewardWheelStore',
      result: {
        selectedPossible: true,
        findings: [expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: offer })],
      },
    });

    const project = applyProjectCommand(baseProject, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel,
      storeKey: 'MetaProgress',
    });
    const { biome } = evaluateO(project);
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(biome.validity).toBe('invalid');
    expect(biome.rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: offer }),
    );
    expect(
      session.evaluate({
        kind: 'rewardWheelStore',
        wheel,
        storeKey: 'RunProgress',
      }),
    ).toMatchObject({
      kind: 'rewardWheelStore',
      result: {
        storeKey: 'RunProgress',
        supportedStoreKeys: expect.arrayContaining(['MetaProgress', 'RunProgress']),
        selectedPossible: true,
        findings: [],
      },
    });
    expect(
      session.evaluate({
        kind: 'rewardWheelOffer',
        offer,
        value: { rewardType: 'GiftDrop' },
      }),
    ).toMatchObject({
      kind: 'rewardWheelOffer',
      result: {
        supported: true,
        findings: [expect.objectContaining({ code: 'missingPomTarget' })],
      },
    });
    expect(
      session.evaluate({
        kind: 'shipEncounterCount',
        occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat04),
        encounterCount: 2,
      }),
    ).toMatchObject({ kind: 'shipEncounterCount' });
    expect(
      session.evaluate({
        kind: 'shipEncounterCount',
        occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat07),
        encounterCount: 2,
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('evaluates a supported opening target through the prepared selected O prefix', () => {
    const { project } = evaluateO();
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      candidates.evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(
          oBiome,
          { kind: 'occurrence', occurrenceId: oOccurrenceIds.intro },
          'exit1',
        ),
        gameName: 'O_Combat02',
      }),
    ).toMatchObject({
      kind: 'roomTarget',
      result: {
        pressure: {
          selectedPossible: true,
          selectedExclusionReasons: [],
        },
      },
    });
  });

  it('uses acquired reward history for an uncommitted Trial target', () => {
    const { project, target } = createEmptyTrialDecision();
    const assembly = simulateProjectAssembly(catalog, project);
    const o = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'O');
    if (o === undefined || !('rewards' in o)) {
      throw new Error('O prefix did not publish reward checkpoints');
    }

    expect(o.rewards.targetHistory).toContainEqual(expect.objectContaining({ origin: target }));

    expect(
      createPreparedProjectCandidateSession(catalog, assembly).evaluate({
        kind: 'roomTarget',
        target,
        gameName: 'O_Devotion01',
      }),
    ).toMatchObject({
      kind: 'roomTarget',
      result: {
        pressure: {
          selectedPossible: true,
          selectedExclusionReasons: [],
        },
        findings: [],
      },
    });
  });

  it('keeps Ship and every reward-wheel candidate family in the engine', () => {
    const { project } = evaluateO();
    const occurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === oOccurrenceIds.combat04,
      );
    if (occurrence?.state.kind !== 'shipCombat') {
      throw new Error('O fixture must retain a Ship combat state');
    }
    const wheel = occurrence.state.wheels.wheel1;
    const offer = wheel?.offers.offer1;
    if (wheel === undefined || offer === undefined) {
      throw new Error('O Ship fixture must retain wheel1 offer1');
    }
    const wheelAddress = createRewardWheelAddress(oBiome, occurrence.occurrenceId, 'wheel1');
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate([
      {
        kind: 'shipEncounterCount',
        occurrence: createOccurrenceAddress(oBiome, occurrence.occurrenceId),
        encounterCount: occurrence.state.encounterCount,
      },
      { kind: 'rewardWheelOfferCount', wheel: wheelAddress, offerCount: wheel.offerCount },
      { kind: 'rewardWheelStore', wheel: wheelAddress, storeKey: wheel.storeKey },
      {
        kind: 'rewardWheelOffer',
        offer: createRewardWheelOfferAddress(oBiome, occurrence.occurrenceId, 'wheel1', 'offer1'),
        value: offer!.offer,
      },
      {
        kind: 'rewardWheelPicked',
        wheel: wheelAddress,
        pickedOfferIndex: wheel.pickedOfferIndex,
      },
    ]);

    expect(candidates).toMatchObject([
      { kind: 'shipEncounterCount', result: { selectedPossible: true, findings: [] } },
      { kind: 'rewardWheelOfferCount', result: { selectedPossible: true, findings: [] } },
      { kind: 'rewardWheelStore', result: { selectedPossible: true, findings: [] } },
      { kind: 'rewardWheelOffer', result: { supported: true, findings: [] } },
      { kind: 'rewardWheelPicked', result: { selectedPossible: true, findings: [] } },
    ]);
  });

  it('keeps a generated wheel offer selectable while its acquisition child is unresolved', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const secondOffer = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer2',
    );
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: secondOffer,
      value: { rewardType: 'HermesUpgrade' },
    });
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate([
      { kind: 'rewardWheelOffer', offer: secondOffer, value: { rewardType: 'HermesUpgrade' } },
      { kind: 'rewardWheelPicked', wheel, pickedOfferIndex: 2 },
    ]);

    expect(candidates).toMatchObject([
      { kind: 'rewardWheelOffer', result: { supported: true, findings: [] } },
      { kind: 'rewardWheelPicked', result: { selectedPossible: true, findings: [] } },
    ]);
  });

  it('rejects a stale wheel2 Hammer after the route loadout changes', () => {
    let project = loadSurfaceNOProject();
    const shipOwner = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer1'),
      value: { rewardType: 'RoomMoneyDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer2'),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelPicked',
      wheel,
      pickedOfferIndex: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: shipOwner,
      encounterCount: 3,
    });
    project = authorLegalTraitOffers(project);
    const route = project.route;
    if (route === undefined) throw new Error('O fixture has no Surface route');
    const replacementWeapon = catalog.weapons.values.find(
      (weapon) => weapon.key !== route.loadout.weaponKey,
    );
    if (replacementWeapon === undefined) throw new Error('missing replacement weapon');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRouteLoadout',
      route: createRouteAddress('Surface'),
      weaponKey: replacementWeapon.key,
      aspectKey: replacementWeapon.defaultAspectKey,
    });

    const assembly = simulateProjectAssembly(catalog, project);
    const evaluated = assembly.evaluation.route?.biomes.find(
      (candidate) => candidate.biomeKey === 'O',
    );
    if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'invalid') {
      throw new Error('stale Hammer fixture did not block complete O');
    }
    expect(evaluated.findings).toContainEqual(
      expect.objectContaining({ code: 'wrongHammerLoadout' }),
    );
  });

  it('evaluates dormant wheel2 when a supported encounter-count candidate activates it', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer1'),
      value: { rewardType: 'RoomMoneyDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer2'),
      value: { rewardType: 'SpellDrop' },
    });

    const evaluation = simulateProject(catalog, project);
    expect(evaluation.status).toBe('valid');
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({ kind: 'shipEncounterCount', occurrence, encounterCount: 3 }),
    ).toMatchObject({
      kind: 'shipEncounterCount',
      result: {
        encounterCount: 3,
        supportEncounterCounts: [2, 3],
        selectedPossible: true,
        findings: [
          expect.objectContaining({
            code: 'rewardBagEntryUnavailable',
            origin: expect.objectContaining({
              kind: 'rewardWheelOffer',
              occurrenceId: oOccurrenceIds.combat07,
              wheelKey: 'wheel2',
            }),
          }),
        ],
      },
    });

    const activeProject = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, activeProject),
      ).evaluate({ kind: 'rewardWheelOfferCount', wheel, offerCount: 1 }),
    ).toMatchObject({
      kind: 'rewardWheelOfferCount',
      result: { offerCount: 1, selectedPossible: true, findings: [] },
    });
  });

  it('keeps Combat2 authorable while exposing its newly active unresolved wheel leaf', () => {
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
      },
    });
    project = authorLegalTraitOffers(project);
    expect(simulateProject(catalog, project).status).toBe('valid');

    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({ kind: 'shipEncounterCount', occurrence, encounterCount: 3 }),
    ).toMatchObject({
      kind: 'shipEncounterCount',
      result: {
        encounterCount: 3,
        supportEncounterCounts: [2, 3],
        selectedPossible: true,
        findings: [
          expect.objectContaining({
            code: 'rewardMissing',
            origin: expect.objectContaining({
              kind: 'rewardWheelOffer',
              occurrenceId: oOccurrenceIds.combat07,
              wheelKey: 'wheel2',
            }),
          }),
        ],
      },
    });
  });

  it('keeps a newly active unresolved wheel structural values authorable', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    const project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      session.evaluate({ kind: 'rewardWheelStore', wheel, storeKey: 'RunProgress' }),
    ).toMatchObject({
      kind: 'rewardWheelStore',
      result: {
        selectedPossible: true,
        supportedStoreKeys: ['RunProgress'],
        findings: [expect.objectContaining({ code: 'rewardMissing' })],
      },
    });
    expect(
      session.evaluate({ kind: 'rewardWheelStore', wheel, storeKey: 'MetaProgress' }),
    ).toMatchObject({
      kind: 'rewardWheelStore',
      result: {
        selectedPossible: false,
        supportedStoreKeys: ['RunProgress'],
      },
    });
    expect(session.evaluate({ kind: 'rewardWheelOfferCount', wheel, offerCount: 2 })).toMatchObject(
      {
        kind: 'rewardWheelOfferCount',
        result: { selectedPossible: true },
      },
    );
  });

  it('finds an unavailable authored wheel store even when its offer belongs to that store', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    const offer = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat07,
      'wheel2',
      'offer1',
    );
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel,
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer,
      value: { rewardType: 'MetaCurrencyBigDrop' },
    });
    const evaluated = simulateProjectAssembly(catalog, project).evaluation.route?.biomes.find(
      (biome) => biome.biomeKey === 'O',
    );
    if (evaluated === undefined || !('rewards' in evaluated)) {
      throw new Error('O wheel-store finding fixture did not publish reward evaluation');
    }

    expect(evaluated.rewards.findings).toContainEqual(
      expect.objectContaining({
        code: 'baseRewardStoreUnavailable',
        origin: wheel,
        evidence: expect.objectContaining({
          authoredStoreKey: 'MetaProgress',
          supportStoreKeys: ['RunProgress'],
        }),
      }),
    );
    expect(evaluated.rewards.findings).not.toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: offer,
      }),
    );
  });

  it('keeps wheel findings scoped to the exact active wheel', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel1 = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel1');
    const wheel2 = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    const project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      session.evaluate({ kind: 'rewardWheelOfferCount', wheel: wheel1, offerCount: 1 }),
    ).toMatchObject({
      kind: 'rewardWheelOfferCount',
      result: { selectedPossible: true, findings: [] },
    });
    expect(
      session.evaluate({ kind: 'rewardWheelStore', wheel: wheel2, storeKey: 'RunProgress' }),
    ).toMatchObject({
      kind: 'rewardWheelStore',
      result: {
        selectedPossible: true,
        findings: [
          expect.objectContaining({
            code: 'rewardMissing',
            origin: createRewardWheelOfferAddress(
              oBiome,
              oOccurrenceIds.combat07,
              'wheel2',
              'offer1',
            ),
          }),
        ],
      },
    });
  });

  it('authors a complete MetaProgress wheel after its structural choices', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel1');
    const offer2 = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat07,
      'wheel1',
      'offer2',
    );
    let project = loadSurfaceNOProject();
    let session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    expect(
      session.evaluate({ kind: 'rewardWheelStore', wheel, storeKey: 'MetaProgress' }),
    ).toMatchObject({ result: { selectedPossible: true } });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel,
      storeKey: 'MetaProgress',
    });
    session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    expect(session.evaluate({ kind: 'rewardWheelOfferCount', wheel, offerCount: 2 })).toMatchObject(
      { result: { selectedPossible: true } },
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const offer2Candidate = session.evaluate({
      kind: 'rewardWheelOffer',
      offer: offer2,
      value: { rewardType: 'GiftDrop' },
    });
    expect(offer2Candidate).toMatchObject({
      kind: 'rewardWheelOffer',
      result: { supported: true },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: offer2,
      value: { rewardType: 'GiftDrop' },
    });
    session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    expect(
      session.evaluate({ kind: 'rewardWheelPicked', wheel, pickedOfferIndex: 2 }),
    ).toMatchObject({
      kind: 'rewardWheelPicked',
      result: { selectedPossible: true, findings: [] },
    });
  });

  it('uses the source-offer policy on Ship continuation and the explicit base store on Devotion', () => {
    const { project } = evaluateO();
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      candidates.evaluate({
        kind: 'batchRewardStore',
        rewardStore: createBatchRewardStoreAddress(
          oBiome,
          createExitDecisionAddress(oBiome, {
            kind: 'occurrence',
            occurrenceId: oOccurrenceIds.devotion,
          }).source,
        ),
        storeKey: 'MetaProgress',
      }),
    ).toMatchObject({
      kind: 'batchRewardStore',
      result: {
        selectedPossible: true,
        supportStoreKeys: ['RunProgress', 'MetaProgress'],
      },
    });
    expect(
      candidates.evaluate({
        kind: 'takeoverPrebossBatch',
        source: createExitDecisionAddress(oBiome, {
          kind: 'occurrence',
          occurrenceId: oOccurrenceIds.combat02,
        }),
        gameName: 'O_PreBoss01',
      }),
    ).toMatchObject({ kind: 'takeoverPrebossBatch', result: { requiredExitKeys: ['exit1'] } });
  });

  it('keeps the declaration-driven terminal takeover assessable from its empty envelope', () => {
    const decision = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat02,
    });
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });

    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({ kind: 'takeoverPrebossBatch', source: decision, gameName: 'O_PreBoss01' }),
    ).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: { support: 'required', selectedPossible: true, requiredExitKeys: ['exit1'] },
    });
  });
});

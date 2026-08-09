import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createOccurrenceAddress,
  createProjectDocument,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  appendCompleteN,
  appendNEntry,
  authorLegalTraitOffers,
  nBiome,
  nOccurrenceIds,
} from '@run-planner/test-fixtures';

function currentNEntryProject() {
  return authorLegalTraitOffers(
    appendNEntry(
      createProjectDocument(catalog, {
        projectId: 'n-b1-entry-baseline',
        name: 'N B1 entry baseline',
        configuredBiomeCounts: { Surface: 1 },
      }),
    ),
  );
}

function blankNEntryProject() {
  let project = createProjectDocument(catalog, {
    projectId: 'n-b2-blank-entry-candidate',
    name: 'N B2 blank entry candidate',
    configuredBiomeCounts: { Surface: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: nBiome,
    occurrenceId: nOccurrenceIds.opening,
  });
  return applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    }),
  });
}

function nBiomeEvaluation(project: ProjectDocument) {
  const biome = simulateProject(catalog, project)
    .routes.find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'N');
  if (biome === undefined) throw new Error('N baseline fixture lost its biome');
  return biome;
}

describe('N B1 entry and terminal baseline', () => {
  it('evaluates the blank bounded entry at Opening post-commit depth one', () => {
    const entryCandidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, blankNEntryProject()),
    );

    expect(
      entryCandidates.evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(
          nBiome,
          {
            kind: 'occurrence',
            occurrenceId: nOccurrenceIds.opening,
          },
          'prehub',
        ),
        gameName: 'N_PreHub01',
      }),
    ).toMatchObject({
      kind: 'roomTarget',
      result: {
        pressure: {
          biomeDepthCache: 1,
          selectedPossible: true,
          supportRoomGameNames: ['N_PreHub01'],
        },
        findings: [],
      },
    });
  });

  it('records Opening then PreHub lifecycle through the depth-two Hub frontier', () => {
    const biome = nBiomeEvaluation(currentNEntryProject());
    if (biome.authoring !== 'incomplete' || !('materializedPrefix' in biome)) {
      throw new Error('N entry baseline did not retain a composable prefix');
    }
    const entryBatch = biome.materializedPrefix.decisions[0];
    const complete = nBiomeEvaluation(
      appendCompleteN(
        createProjectDocument(catalog, {
          projectId: 'n-b1-lifecycle-baseline',
          name: 'N B1 lifecycle baseline',
          configuredBiomeCounts: { Surface: 1 },
        }),
      ),
    );
    if (complete.authoring !== 'complete') {
      throw new Error('N lifecycle baseline did not complete');
    }
    const openingHistory = complete.history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) ===
        semanticAddressKey(createOccurrenceAddress(nBiome, nOccurrenceIds.opening)),
    );
    const preHubHistory = complete.history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) ===
        semanticAddressKey(createOccurrenceAddress(nBiome, nOccurrenceIds.preHub)),
    );
    if (
      openingHistory?.postCommit === undefined ||
      preHubHistory?.postCommit === undefined ||
      preHubHistory.exit === undefined
    ) {
      throw new Error('N lifecycle baseline lost its opening or PreHub checkpoint');
    }

    expect(entryBatch).toMatchObject({
      kind: 'batch',
      selectedExitKey: 'prehub',
      targets: [
        {
          exit: { exitKey: 'prehub' },
          room: {
            occurrenceId: nOccurrenceIds.preHub,
            gameName: 'N_PreHub01',
            incomingReward: { resolvedStoreKey: 'RunProgress' },
          },
        },
      ],
    });
    expect(biome.materializedPrefix.frontier).toMatchObject({
      kind: 'exitDecision',
      origin: createExitDecisionAddress(nBiome, {
        kind: 'occurrence',
        occurrenceId: nOccurrenceIds.preHub,
      }),
      targets: [],
    });
    expect(openingHistory.postCommit.ledgers.counters).toMatchObject({
      biomeDepthCache: 1,
      roomHistoryOrdinal: 1,
    });
    expect(preHubHistory.postCommit.ledgers.counters).toMatchObject({
      biomeDepthCache: 2,
      roomHistoryOrdinal: 2,
    });
    expect(preHubHistory.exit.ledgers.counters).toMatchObject({
      biomeDepthCache: 2,
      roomHistoryOrdinal: 2,
    });
    expect(
      complete.history.ledgers.roomAppearances.slice(0, 2).map((appearance) => appearance.gameName),
    ).toEqual(['N_Opening01', 'N_PreHub01']);
    expect(
      biome.history.events.some(
        (event) => event.kind === 'roomCreated' && event.gameName === 'N_Hub',
      ),
    ).toBe(false);
  });

  it('keeps the current N terminal matrix closed: the PreHub source opens Hub, while only a complete Hub owns Preboss', () => {
    const entry = currentNEntryProject();
    const preHubSource = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    });
    const entryCandidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, entry),
    );

    const openingCandidate = entryCandidates.evaluate({
      kind: 'roomTarget',
      target: createTargetAddress(
        nBiome,
        {
          kind: 'occurrence',
          occurrenceId: nOccurrenceIds.opening,
        },
        'prehub',
      ),
      gameName: 'N_PreHub01',
    });
    expect(openingCandidate).toMatchObject({
      kind: 'roomTarget',
      result: {
        pressure: {
          targetOrigin: {
            exitKey: 'prehub',
          },
          biomeDepthCache: 1,
          selectedPossible: true,
          supportRoomGameNames: ['N_PreHub01'],
        },
      },
    });
    expect(
      entryCandidates.evaluate({
        kind: 'hubTerminalTakeover',
        source: preHubSource,
      }),
    ).toMatchObject({
      kind: 'hubTerminalTakeover',
      result: {
        source: preHubSource,
        hubKey: 'hub',
        gameName: 'N_Hub',
        eligibility: {
          kind: 'counterRange',
          axis: 'biomeDepthCache',
          actual: 2,
          expected: { min: 2, max: 2 },
          satisfied: true,
        },
        force: 'required',
        support: 'required',
        selectedPossible: true,
      },
    });
    expect(() =>
      entryCandidates.evaluate({
        kind: 'takeoverPrebossBatch',
        source: preHubSource,
        gameName: 'N_PreBoss01',
      }),
    ).toThrow(/no declaration-owned takeover Preboss candidate domain/);

    const hubOpened = applyProjectCommand(entry, catalog, {
      kind: 'ReplaceWithHubDecision',
      decision: preHubSource,
      hub: createHubDecisionAddress(nBiome, 'hub'),
    });
    const openedBiome = nBiomeEvaluation(hubOpened);
    if (openedBiome.authoring !== 'incomplete' || !('materializedPrefix' in openedBiome)) {
      throw new Error('opening the N Hub did not retain a composable prefix');
    }
    expect(openedBiome.materializedPrefix.decisions.map((decision) => decision.kind)).toEqual([
      'batch',
      'hub',
    ]);
    expect(openedBiome.materializedPrefix.frontier).toMatchObject({ kind: 'hubBoard' });

    const completeHubWithoutHandoff = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'n-b1-terminal-matrix',
        name: 'N B1 terminal matrix',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    const completeHubCandidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, completeHubWithoutHandoff),
    );

    expect(
      completeHubCandidates.evaluate({
        kind: 'takeoverPrebossBatch',
        source: createExitDecisionAddress(nBiome, {
          kind: 'hubDecision',
          decisionKey: 'hub',
        }),
        gameName: 'N_PreBoss01',
      }),
    ).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: {
        requiredExitKeys: ['preboss'],
        support: 'required',
        selectedPossible: true,
      },
    });
  });

  it('keeps an undersized retained Hub at its board instead of publishing a rejected Preboss handoff', () => {
    const handoff = createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    let project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'n-undersized-hub-handoff',
        name: 'N undersized Hub handoff',
        configuredBiomeCounts: { Surface: 1 },
      }),
      { includePreboss: false },
    );
    for (const hubSlotKey of ['combat10', 'combat03', 'combat01']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CloseHubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', hubSlotKey),
      });
    }

    const biome = nBiomeEvaluation(project);
    if (biome.authoring !== 'incomplete' || !('materializedPrefix' in biome)) {
      throw new Error('undersized Hub did not retain an editable materialized prefix');
    }
    expect(biome.findings).toContainEqual(
      expect.objectContaining({
        code: 'hubOpenSetIncomplete',
        evidence: expect.objectContaining({ actualCount: 6, minimumCount: 9 }),
      }),
    );
    expect(biome.materializedPrefix.frontier).toMatchObject({ kind: 'hubBoard' });
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({
        kind: 'takeoverPrebossBatch',
        source: handoff,
        gameName: 'N_PreBoss01',
      }),
    ).toMatchObject({
      kind: 'unavailable',
      reason: 'coverageNotReached',
      evidence: { requiredOwner: handoff },
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTakeoverBatch',
        decision: handoff,
        gameName: 'N_PreBoss01',
        targetOccurrenceIds: { preboss: nOccurrenceIds.preboss },
      }),
    ).toThrow(/complete the declared Hub board and required visits/);
  });
});

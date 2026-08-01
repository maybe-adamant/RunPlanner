import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createShopPurchaseAddress,
  createTargetAddress,
  ProjectCommandContractError,
  redoProjectHistory,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';

import {
  fBiome,
  fProject,
  gBiome,
  gProject,
  nBiome,
  nProject,
  oBiome,
  qBiome,
  surfaceProject,
} from './support/configured-projects';

describe('authored-project commands awaiting focused family migration', () => {
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

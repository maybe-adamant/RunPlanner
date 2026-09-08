import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubOpenSetAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createJudgmentArcanaAddress,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createOccurrenceAddress,
  createRouteAddress,
  createRoomActionAddress,
  createLocalRewardAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  createOccurrenceId,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import { authoringReadinessAt, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  loadSurfaceNProject,
  loadSurfaceNEntryFrontierResolvedProject,
  loadSurfaceNOProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
  nOccurrenceIds,
  nVisitSlotKeys,
  oBiome,
  oOccurrenceIds,
  createSurfaceNOHermesShrineDeliveryCheckpoint,
} from '@run-planner/test-fixtures/surface';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
  createGoldenFGHProject,
  goldenHBiome,
  createCompleteFGIxionChaosProject,
} from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { compareOwnerLocations } from '../../src/simulation/progressive/finding-location';

import { createFProject, fBiome, fDecision, fStartId } from './support/f-takeover-project';

describe('chronological authoring horizon', () => {
  it('preserves equality at an explicit history checkpoint over structural and timeline coordinates', () => {
    const history = { historySequence: 12, historyBoundary: 'at' as const };
    expect(
      compareOwnerLocations(
        { ...history, decisionIndex: 1, roomOccurrenceId: 'same', roomTimelineIndex: 0 },
        { ...history, decisionIndex: 2, roomOccurrenceId: 'same', roomTimelineIndex: 5 },
      ),
    ).toBe(0);
    expect(
      compareOwnerLocations(
        { decisionIndex: 1, roomOccurrenceId: 'same', roomTimelineIndex: 6 },
        { ...history, decisionIndex: 1, roomOccurrenceId: 'same', roomTimelineIndex: 5 },
      ),
    ).toBeGreaterThan(0);
  });
  it('orders real same-room pickups and retains the blocking action and containing repair', () => {
    const id = createOccurrenceId('golden-h-combat09');
    const reward = createLocalRewardAddress(goldenHBiome, id, 'cages', 'cage2');
    const blocking = createRoomActionAddress(
      goldenHBiome,
      id,
      roomActionKey({ kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage2' }),
    );
    const later = createRoomActionAddress(
      goldenHBiome,
      id,
      roomActionKey({ kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' }),
    );
    let project = applyProjectCommand(authorLegalTraitOffers(createGoldenFGHProject()), catalog, {
      kind: 'MoveRoomAction',
      action: blocking,
      toIndex: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward,
      value: { rewardType: 'MaxHealthDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward,
      value: { rewardType: 'WeaponUpgrade' },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      repairTarget: createTraitOfferAddress(reward, 'self'),
    });
    expect(authoringReadinessAt(assembly, blocking)).toBe('editable');
    expect(authoringReadinessAt(assembly, reward)).toBe('editable');
    expect(authoringReadinessAt(assembly, createOccurrenceAddress(goldenHBiome, id))).toBe(
      'editable',
    );
    expect(authoringReadinessAt(assembly, later)).toBe('locked');
  });

  it('keeps generated Hub side siblings editable while locking entered local lifecycles and later visits', () => {
    const original = loadSurfaceNOProject();
    const first = nLocalOccurrenceId('combat05', 'sideDoor3');
    const project = {
      ...original,
      route: {
        ...original.route,
        biomes: original.route.biomes.map((biome) =>
          biome.biomeKey !== 'N' || biome.topology === null
            ? biome
            : {
                ...biome,
                topology: {
                  ...biome.topology,
                  occurrences: biome.topology.occurrences.map((room) =>
                    room.occurrenceId !== first || room.state.kind !== 'counted'
                      ? room
                      : { ...room, state: { ...room.state, reward: null } },
                  ),
                },
              },
        ),
      },
    };
    const assembly = simulateProjectAssembly(catalog, project);
    const second = nLocalOccurrenceId('combat05', 'sideDoor2');
    const room = project.route.biomes
      .find((biome) => biome.biomeKey === 'N')!
      .topology!.occurrences.find((room) => room.occurrenceId === second)!;
    const action = room.roomActions.order[0];
    if (action === undefined)
      throw new Error('entered side fixture lacks its real acquisition action');
    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      repairTarget: createIncomingRewardAddress(nBiome, first),
    });
    expect(authoringReadinessAt(assembly, createOccurrenceAddress(nBiome, first))).toBe('editable');
    expect(authoringReadinessAt(assembly, createIncomingRewardAddress(nBiome, second))).toBe(
      'editable',
    );
    expect(
      authoringReadinessAt(
        assembly,
        createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      ),
    ).toBe('editable');
    expect(
      authoringReadinessAt(
        assembly,
        createRoomActionAddress(nBiome, second, roomActionKey(action)),
      ),
    ).toBe('locked');
    expect(
      authoringReadinessAt(assembly, createOccurrenceAddress(nBiome, nOccurrenceId('combat11'))),
    ).toBe('locked');
  });

  it('classifies an omitted due Shrine delivery placement as incomplete', () => {
    let project = createSurfaceNOHermesShrineDeliveryCheckpoint();
    project = {
      ...project,
      route: {
        ...project.route,
        biomes: project.route.biomes.map((biome) =>
          biome.topology === null
            ? biome
            : {
                ...biome,
                topology: {
                  ...biome.topology,
                  occurrences: biome.topology.occurrences.map((room) => ({
                    ...room,
                    acquisitionSites: {
                      ...room.acquisitionSites,
                      hermesShrineDelivery: { pickupEntries: {} },
                    },
                    roomActions: {
                      ...room.roomActions,
                      order: room.roomActions.order.filter(
                        (action) =>
                          action.kind !== 'interactAcquisitionEntry' ||
                          action.siteKey !== 'hermesShrineDelivery',
                      ),
                    },
                  })),
                },
              },
        ),
      },
    };
    const assembly = simulateProjectAssembly(catalog, project);
    const finding = assembly.evaluation.findings.find(
      (finding) => finding.code === 'hermesShrineDeliveryPlacementRequired',
    );
    expect(finding).toBeDefined();
    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      repairTarget: finding?.origin,
    });
  });

  it('classifies an active Rejected curse without its blocked boon as incomplete', () => {
    const base = createCompleteFGIxionChaosProject();
    const evaluation = simulateProjectAssembly(catalog, base).evaluation;
    const selected = evaluation.route.biomes
      .flatMap((biome) => ('rewards' in biome ? biome.rewards.selectedTraitOffers : []))
      .find((selected) => selected.offer.kind === 'chaos');
    if (selected?.offer.kind !== 'chaos')
      throw new Error('Chaos fixture lacks its selected screen');
    const curse = catalog.chaos.curses.byKey.ChaosRestrictBoonCurse!;
    const option = { curseKey: curse.key, requirementCount: curse.duration.minimum };
    const project = applyProjectCommand(base, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: selected.address,
      value: { ...selected.offer, curseOptions: [option, option, option], selectedCurseValues: {} },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const finding = assembly.evaluation.findings.find(
      (finding) => finding.code === 'chaosRejectedBlockMissing',
    );
    expect(finding).toBeDefined();
    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      repairTarget: finding?.origin,
    });
  });
  it('locks only owners after a missing opening reward', () => {
    const project = applyProjectCommand(createFProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: fStartId,
      gameName: 'F_Opening01',
    });
    const reward = createIncomingRewardAddress(fBiome, fStartId);
    const assembly = simulateProjectAssembly(catalog, project);

    expect(assembly.evaluation.authoringHorizon).toEqual({
      kind: 'incomplete',
      regionKey: expect.any(String),
      repairTarget: reward,
    });
    expect(authoringReadinessAt(assembly, createRouteAddress('Underworld'))).toBe('editable');
    expect(authoringReadinessAt(assembly, createOccurrenceAddress(fBiome, fStartId))).toBe(
      'editable',
    );
    expect(authoringReadinessAt(assembly, reward)).toBe('editable');
    expect(authoringReadinessAt(assembly, fDecision())).toBe('locked');
  });

  it('does not turn an invalid opening reward into an incomplete horizon', () => {
    const removedDecision = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(9, 1),
    });
    const incomplete = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: removedDecision,
    });
    const project = applyProjectCommand(incomplete, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ApolloUpgrade',
          spurnedSource: 'ZeusUpgrade',
        },
      },
    });
    const assembly = simulateProjectAssembly(catalog, project);

    expect(assembly.evaluation.status).toBe('invalid');
    expect(assembly.evaluation.authoringHorizon).toEqual({ kind: 'open' });
    expect(authoringReadinessAt(assembly, removedDecision)).toBe('editable');
  });

  it('keeps a Hub board atomic while locking its visit suffix', () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'CloseHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat03'),
    });
    const assembly = simulateProjectAssembly(catalog, project);

    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      repairTarget: { kind: 'hubOpenSet', biomeKey: 'N', hubKey: 'hub' },
    });
    expect(authoringReadinessAt(assembly, createHubSlotAddress(nBiome, 'hub', 'combat12'))).toBe(
      'editable',
    );
    expect(authoringReadinessAt(assembly, createHubVisitAddress(nBiome, 'hub', 1))).toBe('locked');
  });

  it('keeps the Hub structural frontier editable while locking each later stage', () => {
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const uncreated = simulateProjectAssembly(catalog, loadSurfaceNEntryFrontierResolvedProject());
    expect(uncreated.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      repairTarget: hub,
    });
    expect(authoringReadinessAt(uncreated, hub)).toBe('editable');
    expect(authoringReadinessAt(uncreated, createHubOpenSetAddress(nBiome, 'hub'))).toBe('locked');

    const incompleteVisits = simulateProjectAssembly(
      catalog,
      applyProjectCommand(loadSurfaceNProject(), catalog, {
        kind: 'ReplaceHubVisitOrder',
        hub,
        hubSlotKeys: nVisitSlotKeys.slice(0, 5),
      }),
    );
    expect(incompleteVisits.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      repairTarget: createHubVisitAddress(nBiome, 'hub', 6),
    });
    expect(authoringReadinessAt(incompleteVisits, hub)).toBe('editable');
    expect(
      authoringReadinessAt(
        incompleteVisits,
        createExitDecisionAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' }),
      ),
    ).toBe('locked');

    const handoff = createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    });
    const missingHandoff = simulateProjectAssembly(
      catalog,
      applyProjectCommand(loadSurfaceNProject(), catalog, {
        kind: 'RemoveExitDecision',
        decision: handoff,
      }),
    );
    expect(missingHandoff.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      repairTarget: handoff,
    });
    expect(authoringReadinessAt(missingHandoff, handoff)).toBe('editable');
    expect(
      authoringReadinessAt(missingHandoff, createOccurrenceAddress(nBiome, nOccurrenceIds.preboss)),
    ).toBe('locked');
  });

  it('keeps a blocking main Hub room repairable while locking side generation', () => {
    const original = loadSurfaceNProject();
    const occurrenceId = nOccurrenceId('combat05');
    const project = {
      ...original,
      route: {
        ...original.route,
        biomes: original.route.biomes.map((biome) =>
          biome.biomeKey !== 'N' || biome.topology === null
            ? biome
            : {
                ...biome,
                topology: {
                  ...biome.topology,
                  occurrences: biome.topology.occurrences.map((room) =>
                    room.occurrenceId !== occurrenceId || room.state.kind !== 'ephyraCombat'
                      ? room
                      : { ...room, state: { ...room.state, reward: null } },
                  ),
                },
              },
        ),
      },
    };
    const assembly = simulateProjectAssembly(catalog, project);
    const reward = createIncomingRewardAddress(nBiome, occurrenceId);

    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      repairTarget: reward,
    });
    expect(authoringReadinessAt(assembly, createOccurrenceAddress(nBiome, occurrenceId))).toBe(
      'editable',
    );
    expect(authoringReadinessAt(assembly, reward)).toBe('editable');
    expect(
      authoringReadinessAt(
        assembly,
        createLocalVisitOrderAddress(nBiome, occurrenceId, 'sideRooms'),
      ),
    ).toBe('locked');
    expect(
      authoringReadinessAt(
        assembly,
        createLocalVisitSlotAddress(nBiome, occurrenceId, 'sideRooms', 'sideDoor1'),
      ),
    ).toBe('locked');
  });

  it('keeps the completed Hub prefix editable when selected Preboss generation needs repair', () => {
    const original = loadSurfaceNProject();
    const project = {
      ...original,
      route: {
        ...original.route,
        biomes: original.route.biomes.map((biome) =>
          biome.biomeKey !== 'N' || biome.topology === null
            ? biome
            : {
                ...biome,
                topology: {
                  ...biome.topology,
                  occurrences: biome.topology.occurrences.map((room) =>
                    room.occurrenceId !== nOccurrenceIds.preboss || room.state.kind !== 'shop'
                      ? room
                      : { ...room, state: { kind: 'shop' as const } },
                  ),
                },
              },
        ),
      },
    };
    const assembly = simulateProjectAssembly(catalog, project);
    const preboss = createOccurrenceAddress(nBiome, nOccurrenceIds.preboss);
    const boss = createOccurrenceAddress(
      nBiome,
      createOccurrenceId(`${nOccurrenceIds.preboss}:boss`),
    );

    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      repairTarget: preboss,
    });
    expect(
      authoringReadinessAt(assembly, createOccurrenceAddress(nBiome, nOccurrenceIds.opening)),
    ).toBe('editable');
    expect(authoringReadinessAt(assembly, createHubVisitAddress(nBiome, 'hub', 6))).toBe(
      'editable',
    );
    expect(
      authoringReadinessAt(
        assembly,
        createExitDecisionAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' }),
      ),
    ).toBe('editable');
    expect(authoringReadinessAt(assembly, preboss)).toBe('editable');
    expect(authoringReadinessAt(assembly, boss)).toBe('locked');
  });

  it('keeps Preboss Shop purchases editable before an incomplete fixed Boss outcome', () => {
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Surface'),
      arcanaKeys: ['CastCount'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceJudgmentArcana',
      judgment: createJudgmentArcanaAddress(
        createOccurrenceAddress(nBiome, createOccurrenceId(`${nOccurrenceIds.preboss}:boss`)),
        'Encounter',
      ),
      arcanaKeys: ['ChanneledCast', 'HealthRegen', 'LowManaDamageBonus', 'CastBuff', 'BonusHealth'],
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const oBoss = createOccurrenceAddress(
      oBiome,
      createOccurrenceId(`${oOccurrenceIds.preboss}:boss`),
    );
    const judgment = createJudgmentArcanaAddress(oBoss, 'Encounter');

    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      repairTarget: judgment,
    });
    expect(
      authoringReadinessAt(
        assembly,
        createShopOfferAddress(oBiome, oOccurrenceIds.preboss, 'Boon'),
      ),
    ).toBe('editable');
    expect(authoringReadinessAt(assembly, judgment)).toBe('editable');
    expect(
      authoringReadinessAt(
        assembly,
        createOccurrenceAddress(oBiome, createOccurrenceId(`${oOccurrenceIds.preboss}:postboss`)),
      ),
    ).toBe('locked');
  });
});

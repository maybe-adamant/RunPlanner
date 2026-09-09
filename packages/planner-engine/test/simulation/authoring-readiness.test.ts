import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createKeepsakeEquipResultAddress,
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
  createPostbossKeepsakeSelectionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createShopOfferAddress,
  createTargetAddress,
  createOccurrenceId,
  hermesShrineDeliveryEntryKey,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import { authoringReadinessAt, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  loadSurfaceNProject,
  loadSurfaceNEntryFrontierResolvedProject,
  loadSurfaceNOProject,
  loadSurfaceNOPQProject,
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
  goldenGBiome,
  goldenGOccurrenceId,
  createGoldenFGHProject,
  goldenHBiome,
  createCompleteFGIxionChaosProject,
} from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { compareOwnerLocations } from '../../src/simulation/progressive/finding-location';

import {
  createFProject,
  createFOpeningBatch,
  createFStart,
  createUnresolvedFOpeningBatch,
  fBiome,
  fDecision,
  fStartId,
} from './support/f-takeover-project';

describe('chronological authoring horizon', () => {
  it('keeps route-start loadout repairable while locking the first occurrence', () => {
    const selection = createRouteStartKeepsakeSelectionAddress('Underworld');
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection,
      keepsakeKey: 'TempHammerKeepsake',
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const result = createKeepsakeEquipResultAddress(selection, 'experimentalHammer');

    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      blockedAfter: result,
    });
    expect(authoringReadinessAt(assembly, selection)).toBe('editable');
    expect(
      authoringReadinessAt(
        assembly,
        createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      ),
    ).toBe('locked');
  });

  it('keeps a Postboss keepsake selection editable while its equip result is incomplete', () => {
    const owner = createOccurrenceAddress(nBiome, createOccurrenceId('surface-n-preboss:postboss'));
    const selection = createPostbossKeepsakeSelectionAddress(owner);
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
    const assembly = simulateProjectAssembly(catalog, project);

    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      blockedAfter: owner,
    });
    expect(authoringReadinessAt(assembly, selection)).toBe('editable');
  });

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
  it('keeps the whole incomplete occurrence editable while locking its outgoing decision', () => {
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
      blockedAfter: createOccurrenceAddress(goldenHBiome, id),
    });
    expect(authoringReadinessAt(assembly, blocking)).toBe('editable');
    expect(authoringReadinessAt(assembly, reward)).toBe('editable');
    expect(authoringReadinessAt(assembly, createOccurrenceAddress(goldenHBiome, id))).toBe(
      'editable',
    );
    expect(authoringReadinessAt(assembly, later)).toBe('editable');
    expect(
      authoringReadinessAt(
        assembly,
        createExitDecisionAddress(goldenHBiome, {
          kind: 'occurrence',
          occurrenceId: id,
        }),
      ),
    ).toBe('locked');
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
      blockedAfter: createOccurrenceAddress(nBiome, nOccurrenceId('combat05')),
    });
    expect(authoringReadinessAt(assembly, createOccurrenceAddress(nBiome, first))).toBe('locked');
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

  it('keeps normal-door siblings editable as decision inputs without opening their room lifecycles', () => {
    const original = createCompleteFGProject();
    const selected = goldenFOccurrenceId(2, 1);
    const sibling = goldenFOccurrenceId(2, 2);
    const project = {
      ...original,
      route: {
        ...original.route,
        biomes: original.route.biomes.map((biome) =>
          biome.biomeKey !== 'F' || biome.topology === null
            ? biome
            : {
                ...biome,
                topology: {
                  ...biome.topology,
                  occurrences: biome.topology.occurrences.map((room) =>
                    room.occurrenceId !== selected || room.state.kind !== 'counted'
                      ? room
                      : {
                          ...room,
                          state: {
                            ...room.state,
                            reward:
                              room.state.reward === null
                                ? null
                                : {
                                    ...room.state.reward,
                                    traitOffersByAcquisitionRole: { source: null },
                                  },
                          },
                        },
                  ),
                },
              },
        ),
      },
    };
    const assembly = simulateProjectAssembly(catalog, project);
    const siblingRoom = project.route.biomes
      .find((biome) => biome.biomeKey === 'F')!
      .topology!.occurrences.find((room) => room.occurrenceId === sibling)!;
    const siblingAction = siblingRoom.roomActions.order[0];
    if (siblingAction === undefined) throw new Error('F sibling lacks its reward action');

    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      blockedAfter: createOccurrenceAddress(goldenFBiome, selected),
    });
    expect(authoringReadinessAt(assembly, createIncomingRewardAddress(goldenFBiome, sibling))).toBe(
      'editable',
    );
    expect(
      authoringReadinessAt(
        assembly,
        createRoomActionAddress(goldenFBiome, sibling, roomActionKey(siblingAction)),
      ),
    ).toBe('locked');
  });

  it('classifies an omitted due Shrine delivery placement as incomplete', () => {
    let project = createSurfaceNOHermesShrineDeliveryCheckpoint();
    const deliveryHost = oOccurrenceIds.devotion;
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
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
                  occurrences: biome.topology.occurrences.map((room) =>
                    room.occurrenceId !== deliveryHost
                      ? room
                      : {
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
                                action.entryKey !== entryKey,
                            ),
                          },
                        },
                  ),
                },
              },
        ),
      },
    };
    const assembly = simulateProjectAssembly(catalog, project);
    const finding = assembly.evaluation.findings.find(
      (finding) => finding.code === 'hermesShrineDeliveryPlacementRequired',
    );
    if (finding?.origin.kind !== 'acquisitionEntry') {
      throw new Error('fixture lacks its due Shrine delivery entry');
    }
    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      blockedAfter: createOccurrenceAddress(oBiome, oOccurrenceIds.devotion),
    });
    expect(authoringReadinessAt(assembly, finding.origin)).toBe('editable');

    const encounterPhaseKey = finding.evidence.encounterPhaseKey;
    if (typeof encounterPhaseKey !== 'string') {
      throw new Error('due Shrine delivery lacks its encounter phase');
    }
    const placed = applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry: finding.origin,
      encounterPhaseKey,
    });
    const reference = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: finding.origin.site.pointKey,
      entryKey: finding.origin.entryKey,
      encounterPhaseKey,
    };
    const action = createRoomActionAddress(
      oBiome,
      oOccurrenceIds.devotion,
      roomActionKey(reference),
    );
    expect(() =>
      applyProjectCommand(placed, catalog, { kind: 'MoveRoomAction', action, toIndex: 0 }),
    ).not.toThrow();
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
      blockedAfter: createOccurrenceAddress(goldenGBiome, goldenGOccurrenceId(6, 1)),
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
      blockedAfter: createOccurrenceAddress(fBiome, fStartId),
    });
    expect(authoringReadinessAt(assembly, createRouteAddress('Underworld'))).toBe('editable');
    expect(authoringReadinessAt(assembly, createOccurrenceAddress(fBiome, fStartId))).toBe(
      'editable',
    );
    expect(authoringReadinessAt(assembly, reward)).toBe('editable');
    expect(authoringReadinessAt(assembly, fDecision())).toBe('locked');

    const repaired = createFStart();
    const repairedAssembly = simulateProjectAssembly(catalog, repaired);
    expect(repairedAssembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      blockedAfter: fDecision(),
    });
    expect(authoringReadinessAt(repairedAssembly, fDecision())).toBe('editable');
  });

  it('keeps an incomplete outgoing batch editable while locking later occurrences', () => {
    const project = createUnresolvedFOpeningBatch(createFStart());
    const assembly = simulateProjectAssembly(catalog, project);
    const opening = createOccurrenceAddress(fBiome, fStartId);

    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      blockedAfter: fDecision(),
    });
    expect(authoringReadinessAt(assembly, opening)).toBe('editable');
    expect(authoringReadinessAt(assembly, fDecision())).toBe('editable');
    expect(
      authoringReadinessAt(
        assembly,
        createOccurrenceAddress(fBiome, createOccurrenceId('not-yet-created')),
      ),
    ).toBe('locked');
  });

  it('keeps a generated door reward editable without opening the target occurrence', () => {
    let project = createFOpeningBatch(createFStart());
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, fDecision().source, 'exit1'),
      occurrenceId: createOccurrenceId('pending-f-target'),
      gameName: 'F_Combat02',
    });
    const target = createTargetAddress(fBiome, fDecision().source, 'exit1');
    const occurrence = createOccurrenceAddress(fBiome, createOccurrenceId('pending-f-target'));
    const reward = createIncomingRewardAddress(fBiome, occurrence.occurrenceId);
    const assembly = simulateProjectAssembly(catalog, project);
    expect(assembly.evaluation.authoringHorizon).toMatchObject({
      kind: 'incomplete',
      blockedAfter: fDecision(),
    });
    expect(authoringReadinessAt(assembly, target)).toBe('editable');
    expect(authoringReadinessAt(assembly, reward)).toBe('editable');
    expect(authoringReadinessAt(assembly, occurrence)).toBe('locked');
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
      blockedAfter: createHubDecisionAddress(nBiome, 'hub'),
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
      blockedAfter: hub,
    });
    expect(authoringReadinessAt(uncreated, hub)).toBe('editable');
    expect(authoringReadinessAt(uncreated, createHubOpenSetAddress(nBiome, 'hub'))).toBe(
      'editable',
    );

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
      blockedAfter: createHubDecisionAddress(nBiome, 'hub'),
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
      blockedAfter: handoff,
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
      blockedAfter: createHubDecisionAddress(nBiome, 'hub'),
    });
    expect(authoringReadinessAt(assembly, createOccurrenceAddress(nBiome, occurrenceId))).toBe(
      'locked',
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
      blockedAfter: preboss,
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
      blockedAfter: oBoss,
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

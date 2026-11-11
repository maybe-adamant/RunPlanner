import { ordinaryPositionFor } from '../../support/route-position';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  positionedCommandInsertionIndexes,
  assembleRoomActionDomain,
  activeRoomActionReferences,
  authoredAcquisitionSources,
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionRoleAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createKeepsakeEquipResultAddress,
  createNemesisRandomEventAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createProjectDocument,
  createProjectHistory,
  createPostbossKeepsakeSelectionAddress,
  createRouteAddress,
  createStartingRewardAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  createTargetAddress,
  decodeProjectDocument,
  redoProjectHistory,
  roomActionDomainForOccurrence,
  roomActionKey,
  undoProjectHistory,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
  type StygianWellGenerationKey,
} from '@run-planner/engine/authored-project';
import {
  assembleRoomActionRoster,
  assembleRoomLifecycleTimeline,
  materializeBiomePrefix,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { settleProjectUpgrade } from '@run-planner/engine/project-migration';
import { withoutStaleDerivedItems } from '../../../src/authored-project/acquisition/derived-items';
import {
  createCompleteFGProject,
  replaceNemesisRandomEventInteraction,
  createGoldenFGHProject,
  createUnderworldFWellCheckpoint,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';

import { createCompleteNProject } from '../support/complete-n-project';
import { gBiome, gProject } from '../support/configured-projects';
import {
  replaceTestRoomActionOrder,
  scheduleTestRequiredRoomActions,
  withItemContent,
  withItemContents,
} from '@run-planner/test-fixtures/shared';

const biome = createBiomeAddress('Underworld', 'F');
const occurrenceId = createOccurrenceId('room-actions-start');
const reward: RoomActionReference = {
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'source',
};
const invented: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'invented' };
const start = createOccurrenceAddress(biome, occurrenceId);

function action(reference: RoomActionReference) {
  return createRoomActionAddress(biome, occurrenceId, roomActionKey(reference));
}

function unresolvedProject(): ProjectDocument {
  return applyProjectCommand(
    createProjectDocument(catalog, {
      projectId: 'room-actions',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    }),
    catalog,
    {
      kind: 'CreateStart',
      biome,
      occurrenceId,
      gameName: 'F_Opening01',
    },
  );
}

function project(): ProjectDocument {
  return applyProjectCommand(unresolvedProject(), catalog, {
    kind: 'ReplaceStartingReward',
    reward: createStartingRewardAddress('Underworld'),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
}

function occurrence(document: ProjectDocument) {
  const value = document.route?.biomes[0]?.topology?.occurrences[0];
  if (value === undefined) throw new Error('missing F start occurrence');
  return value;
}

function entryRoom(document: ProjectDocument) {
  const route = document.route;
  const plan = route?.biomes[0];
  if (route === undefined || plan === undefined) throw new Error('missing F authored biome');
  const room = materializeBiomePrefix(
    catalog,
    biome,
    ordinaryPositionFor(catalog, biome),
    plan,
    route.loadout,
  )?.entryRoom;
  if (room === undefined) throw new Error('missing F materialized entry room');
  return room;
}

function withoutRequiredRewardAction(document = project()): ProjectDocument {
  return decodeProjectDocument(
    {
      ...document,
      route: {
        ...document.route,
        biomes: document.route.biomes.map((plan) =>
          plan.topology === null
            ? plan
            : {
                ...plan,
                topology: {
                  ...plan.topology,
                  occurrences: plan.topology.occurrences.map((candidate) =>
                    candidate.occurrenceId === occurrenceId
                      ? { ...candidate, roomActions: { order: [] } }
                      : candidate,
                  ),
                },
              },
        ),
      },
    },
    catalog,
  );
}

const parallelTargetId = createOccurrenceId('room-actions-parallel-target');
const parallelSourceId = createOccurrenceId('room-actions-parallel-source');

/** An F_Combat06 Artemis target whose reward and Artemis interaction are both required on entry. */
function parallelRequiredProject(): ProjectDocument {
  const targetId = parallelTargetId;
  const sourceId = parallelSourceId;
  const openingSource = { kind: 'occurrence' as const, occurrenceId };
  const openingDecision = createExitDecisionAddress(biome, openingSource);
  let authored = applyProjectCommand(unresolvedProject(), catalog, {
    kind: 'CreateBatch',
    decision: openingDecision,
  });
  authored = applyProjectCommand(authored, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, openingSource),
    storeKey: 'RunProgress',
  });
  authored = applyProjectCommand(authored, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, openingSource, 'exit1'),
    occurrenceId: sourceId,
    gameName: 'F_Combat02',
  });
  const source = { kind: 'occurrence' as const, occurrenceId: sourceId };
  const decision = createExitDecisionAddress(biome, source);
  authored = applyProjectCommand(authored, catalog, { kind: 'CreateBatch', decision });
  authored = applyProjectCommand(authored, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, source),
    storeKey: 'RunProgress',
  });
  authored = applyProjectCommand(authored, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, source, 'exit1'),
    occurrenceId: targetId,
    gameName: 'F_Combat06',
  });
  authored = applyProjectCommand(authored, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, source, 'exit2'),
    occurrenceId: createOccurrenceId('room-actions-parallel-peer'),
    gameName: 'F_Combat02',
  });
  authored = applyProjectCommand(authored, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, targetId),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  authored = applyProjectCommand(authored, catalog, {
    kind: 'SelectEncounter',
    phase: createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId: targetId },
      'Encounter',
    ),
    encounterKey: 'ArtemisCombatF',
  });
  return authored;
}

function parallelTarget(document: ProjectDocument) {
  const value = document.route?.biomes[0]?.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === parallelTargetId,
  );
  if (value === undefined) throw new Error('missing parallel target');
  return value;
}

describe('room-action commands', () => {
  it('replaces every Fields cage permutation atomically while retaining mixed actions and cage leaves', () => {
    const fieldsId = createOccurrenceId('golden-h-combat02');
    const owner = createOccurrenceAddress(goldenHBiome, fieldsId);
    const expanded = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision: createExitDecisionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-intro'),
      }),
      cageOutcome: 'max',
    });
    const cage = (number: number): RoomActionReference => ({
      kind: 'completeFieldsCage',
      phaseKey: `Cage0${number}`,
    });
    const pickup = (number: number): RoomActionReference => ({
      kind: 'interactLocalReward',
      groupKey: 'cages',
      slotKey: `cage${number}`,
    });
    const initial = replaceTestRoomActionOrder(expanded, catalog, goldenHBiome, fieldsId, [
      cage(1),
      pickup(1),
      cage(2),
      pickup(2),
      cage(3),
      pickup(3),
    ]);
    const room = (document: ProjectDocument) =>
      document.route.biomes
        .find((plan) => plan.biomeKey === 'H')!
        .topology!.occurrences.find((candidate) => candidate.occurrenceId === fieldsId)!;
    const cases = [
      {
        permutation: [1, 2, 3],
        order: [cage(1), pickup(1), cage(2), pickup(2), cage(3), pickup(3)],
      },
      {
        permutation: [1, 3, 2],
        order: [cage(1), pickup(1), cage(3), cage(2), pickup(2), pickup(3)],
      },
      {
        permutation: [2, 1, 3],
        order: [cage(2), cage(1), pickup(1), pickup(2), cage(3), pickup(3)],
      },
      {
        permutation: [2, 3, 1],
        order: [cage(2), cage(3), cage(1), pickup(1), pickup(2), pickup(3)],
      },
      {
        permutation: [3, 1, 2],
        order: [cage(3), cage(1), pickup(1), cage(2), pickup(2), pickup(3)],
      },
      {
        permutation: [3, 2, 1],
        order: [cage(3), cage(2), cage(1), pickup(1), pickup(2), pickup(3)],
      },
    ];
    for (const scenario of cases) {
      const history = applyProjectHistoryCommand(createProjectHistory(initial), catalog, {
        kind: 'ReplaceFieldsCageOrder',
        occurrence: owner,
        phaseKeys: scenario.permutation.map((number) => `Cage0${number}`),
      });
      expect(room(history.present).roomActions.order).toEqual(
        withItemContents(history.present, owner, scenario.order),
      );
      expect(room(history.present).encounters).toEqual(room(initial).encounters);
      expect(room(history.present).state).toEqual(room(initial).state);
      if (scenario.permutation.join('') === '123') {
        expect(history.present).toBe(initial);
        expect(history.past).toHaveLength(0);
      } else {
        expect(history.past).toHaveLength(1);
        expect(undoProjectHistory(history).present).toBe(initial);
        expect(redoProjectHistory(undoProjectHistory(history)).present).toBe(history.present);
      }
    }
  });

  it('requires an exact active cage permutation and preserves a missing-action repair', () => {
    const initial = createGoldenFGHProject();
    const fieldsId = createOccurrenceId('golden-h-combat02');
    const owner = createOccurrenceAddress(goldenHBiome, fieldsId);
    for (const phaseKeys of [[], ['Cage01'], ['Cage01', 'Cage01'], ['Cage01', 'Cage03']]) {
      expect(() =>
        applyProjectCommand(initial, catalog, {
          kind: 'ReplaceFieldsCageOrder',
          occurrence: owner,
          phaseKeys,
        }),
      ).toThrow('each active Fields cage exactly once');
    }
    const missing = decodeProjectDocument(
      {
        ...initial,
        route: {
          ...initial.route,
          biomes: initial.route.biomes.map((plan) =>
            plan.biomeKey !== 'H'
              ? plan
              : {
                  ...plan,
                  topology: {
                    ...plan.topology!,
                    occurrences: plan.topology!.occurrences.map((room) =>
                      room.occurrenceId !== fieldsId
                        ? room
                        : {
                            ...room,
                            roomActions: {
                              order: room.roomActions.order.filter(
                                (reference) =>
                                  reference.kind !== 'completeFieldsCage' ||
                                  reference.phaseKey !== 'Cage02',
                              ),
                            },
                          },
                    ),
                  },
                },
          ),
        },
      },
      catalog,
    );
    const cageOrder = (document: ProjectDocument) =>
      roomActionDomainForOccurrence(document, catalog, goldenHBiome, fieldsId)?.domain
        .fieldsCageOrder;
    expect(cageOrder(initial)).toEqual({
      activePhaseKeys: ['Cage01', 'Cage02'],
      phaseKeys: ['Cage02', 'Cage01'],
      available: true,
    });
    expect(cageOrder(missing)).toEqual({
      activePhaseKeys: ['Cage01', 'Cage02'],
      phaseKeys: ['Cage01'],
      available: false,
    });
    expect(
      roomActionDomainForOccurrence(project(), catalog, biome, occurrenceId)?.domain
        .fieldsCageOrder,
    ).toBeUndefined();
    expect(() =>
      applyProjectCommand(missing, catalog, {
        kind: 'ReplaceFieldsCageOrder',
        occurrence: owner,
        phaseKeys: ['Cage02', 'Cage01'],
      }),
    ).toThrow('restore missing cage actions');
    expect(() =>
      applyProjectCommand(project(), catalog, {
        kind: 'ReplaceFieldsCageOrder',
        occurrence: createOccurrenceAddress(biome, occurrenceId),
        phaseKeys: ['Cage01'],
      }),
    ).toThrow('does not own Fields cage order');
  });

  it('projects a concrete Nemesis result as an ordinary acquisition entry with its exact action owner', () => {
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
      'Encounter',
    );
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisRandomEvent',
    });
    project = replaceNemesisRandomEventInteraction(
      project,
      createNemesisRandomEventAddress(phase),
      { kind: 'freeItem' },
      { rewardType: 'ArmorBoost' },
    );
    // The result spawns from the Nemesis contact, so it is an action once the contact is placed.
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(
        goldenFBiome,
        goldenFOccurrenceId(5, 1),
        roomActionKey({ kind: 'interactEncounter', phaseKey: 'Encounter' }),
      ),
      reference: { kind: 'interactEncounter', phaseKey: 'Encounter' },
      index: 0,
    });
    const eventOccurrence = project.route?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === goldenFOccurrenceId(5, 1),
    );
    if (eventOccurrence === undefined) throw new Error('missing Nemesis occurrence');
    const source = authoredAcquisitionSources(goldenFBiome, eventOccurrence).find(
      (candidate) => candidate.acquisition.owner.kind === 'acquisitionEntry',
    );
    expect(source?.acquisition.owner).toMatchObject({
      kind: 'acquisitionEntry',
      entryKey: 'result',
      site: { pointKey: 'nemesisGenerated:Encounter' },
    });
    const domain = assembleRoomActionDomain({
      routePosition: ordinaryPositionFor(catalog, goldenFBiome),
      catalog,
      biome: goldenFBiome,
      topology: project.route.biomes[0]!.topology!,
      occurrence: eventOccurrence,
    });
    expect(domain.contributions).toContainEqual(
      expect.objectContaining({
        kind: 'action',
        reference: withItemContent(
          project,
          createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(5, 1)),
          {
            kind: 'interactAcquisitionEntry',
            siteKey: 'nemesisGenerated:Encounter',
            entryKey: 'result',
          },
        ),
        owner: source?.acquisition.owner,
      }),
    );
  });
  it('creates a room with no rows and removes a placed required row', () => {
    const initial = project();
    expect(occurrence(initial).roomActions.order).toEqual([]);
    const placed = applyProjectCommand(initial, catalog, {
      kind: 'InsertRoomAction',
      action: action(reward),
      reference: reward,
      index: 0,
    });
    expect(occurrence(placed).roomActions.order).toEqual([withItemContent(placed, start, reward)]);
    const removed = applyProjectCommand(placed, catalog, {
      kind: 'RemoveRoomAction',
      action: action(reward),
    });
    expect(occurrence(removed).roomActions.order).toEqual([]);
  });

  it('reconciles a normal Reprieve to reward then fountain, while both ranked orders remain Cleanup-valid', () => {
    const reprieveId = createOccurrenceId('room-actions-reprieve');
    let authored = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'room-actions-reprieve',
        routeKey: 'Underworld',
        configuredBiomeCount: 1,
      }),
      catalog,
      { kind: 'CreateStart', biome, occurrenceId, gameName: 'F_Opening01' },
    );
    const opening = { kind: 'occurrence' as const, occurrenceId };
    const decision = createExitDecisionAddress(biome, opening);
    authored = applyProjectCommand(authored, catalog, { kind: 'CreateBatch', decision });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, opening),
      storeKey: 'RunProgress',
    });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, opening, 'exit1'),
      occurrenceId: reprieveId,
      gameName: 'F_Reprieve01',
    });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, reprieveId),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const reprieveOf = (document: ProjectDocument) =>
      document.route?.biomes[0]?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === reprieveId,
      );
    const pickup: RoomActionReference = {
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'source',
    };
    const fountain: RoomActionReference = { kind: 'useFountain' };
    expect(reprieveOf(authored)?.roomActions.order).toEqual([]);
    for (const [index, reference] of [pickup, fountain].entries())
      authored = applyProjectCommand(authored, catalog, {
        kind: 'InsertRoomAction',
        action: createRoomActionAddress(biome, reprieveId, roomActionKey(reference)),
        reference,
        index,
      });
    const reprieve = reprieveOf(authored);
    if (reprieve === undefined) throw new Error('normal Reprieve target is missing');
    const reprieveRoom = createOccurrenceAddress(biome, reprieveId);
    expect(reprieve.roomActions.order).toEqual(
      withItemContents(authored, reprieveRoom, [pickup, fountain]),
    );
    expect(
      reprieveOf(
        applyProjectCommand(authored, catalog, {
          kind: 'RemoveRoomAction',
          action: createRoomActionAddress(biome, reprieveId, roomActionKey(fountain)),
        }),
      )?.roomActions.order,
    ).toEqual([withItemContent(authored, reprieveRoom, pickup)]);

    const reversed = applyProjectCommand(authored, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(biome, reprieveId, roomActionKey(fountain)),
      toIndex: 0,
    });
    const reversedReprieve = reversed.route?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === reprieveId,
    );
    if (reversedReprieve === undefined) throw new Error('moved Reprieve target is missing');

    for (const candidate of [reprieve, reversedReprieve]) {
      const domain = assembleRoomActionDomain({
        routePosition: ordinaryPositionFor(catalog, biome),
        catalog,
        biome,
        topology: (candidate === reprieve ? authored : reversed).route.biomes[0]!.topology!,
        occurrence: candidate,
      });
      const roster = assembleRoomActionRoster({
        owner: createOccurrenceAddress(biome, candidate.occurrenceId),
        order: candidate.roomActions.order,
        contributions: domain.contributions,
        lifecycleStructure: domain.lifecycleStructure,
      });
      expect(roster.valid).toBe(true);
      const timeline = assembleRoomLifecycleTimeline({
        owner: createOccurrenceAddress(biome, candidate.occurrenceId),
        roomActionRoster: roster,
      });
      const actionRanks = timeline.entries
        .filter((entry) => entry.kind === 'action')
        .map((entry) => entry.action.rank);
      const cleanup = timeline.entries.findIndex(
        (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'cleanup',
      );
      const lastAction = timeline.entries.reduce(
        (index, entry, entryIndex) => (entry.kind === 'action' ? entryIndex : index),
        -1,
      );
      expect(actionRanks).toEqual([1, 2]);
      expect(cleanup).toBeGreaterThan(lastAction);
    }

    const echo = createGoldenFGHProject()
      .route?.biomes.find((plan) => plan.biomeKey === 'H')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'H_Bridge01');
    if (echo === undefined) throw new Error('H Echo bridge occurrence is missing');
    expect(
      activeRoomActionReferences(
        catalog,
        goldenHBiome,
        createGoldenFGHProject().route.biomes.find((plan) => plan.biomeKey === 'H')!.topology!,
        echo,
        ordinaryPositionFor(catalog, goldenHBiome),
      ),
    ).not.toContainEqual(fountain);
  });

  it('keeps a Well purchase after the required Artificer replacement clears outgoing generation', () => {
    const startId = createOccurrenceId('well-after-artificer-start');
    const hostId = createOccurrenceId('well-after-artificer-host');
    let authored = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'well-after-artificer',
        routeKey: 'Underworld',
        configuredBiomeCount: 1,
      }),
      catalog,
      { kind: 'CreateStart', biome, occurrenceId: startId, gameName: 'F_Opening01' },
    );
    const start = { kind: 'occurrence' as const, occurrenceId: startId };
    const decision = createExitDecisionAddress(biome, start);
    authored = applyProjectCommand(authored, catalog, { kind: 'CreateBatch', decision });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, start),
      storeKey: 'MetaProgress',
    });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, start, 'exit1'),
      occurrenceId: hostId,
      gameName: 'F_Combat08',
    });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, hostId),
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    const host = createOccurrenceAddress(biome, hostId);
    authored = applyProjectCommand(authored, catalog, {
      kind: 'AddStygianWell',
      occurrence: host,
    });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: host,
      slotKey: 'healing',
      itemKey: 'ArmorBoostStore',
    });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: host,
      generationKey: 'initial:healing',
      purchased: true,
    });
    const incoming = createIncomingRewardAddress(biome, hostId);
    authored = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(incoming, 'self'),
      value: { kind: 'artificer' },
    });
    // The pickup's row activates its replacement, which a second pass places.
    authored = scheduleTestRequiredRoomActions(authored, catalog, biome);
    authored = scheduleTestRequiredRoomActions(authored, catalog, biome);

    const hostOccurrence = authored.route.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === hostId,
    );
    if (hostOccurrence === undefined) throw new Error('missing Well host');
    const domain = assembleRoomActionDomain({
      routePosition: ordinaryPositionFor(catalog, biome),
      catalog,
      biome,
      topology: authored.route.biomes[0]!.topology!,
      occurrence: hostOccurrence,
    });
    const roster = assembleRoomActionRoster({
      owner: host,
      order: hostOccurrence.roomActions.order,
      contributions: domain.contributions,
      lifecycleStructure: domain.lifecycleStructure,
    });
    const replacement: RoomActionReference = {
      kind: 'interactAcquisitionEntry',
      siteKey: acquisitionSiteStorageKey(artificerAcquisitionSite(host, incoming)),
      entryKey: artificerReplacementEntryKey(incoming, 'self'),
    };
    const purchase: RoomActionReference = {
      kind: 'purchaseStygianWellOffer',
      generationKey: 'initial:healing',
    };
    expect(roster.valid).toBe(true);
    expect(
      roster.rows.find((row) => roomActionKey(row.reference) === roomActionKey(purchase))?.window,
    ).toEqual({ kind: 'postOutgoing' });
    expect(
      roster.proposals.find(
        (proposal) =>
          proposal.kind === 'move' &&
          roomActionKey(proposal.reference) === roomActionKey(replacement) &&
          proposal.toIndex === hostOccurrence.roomActions.order.length - 1,
      ),
    ).toMatchObject({ structurallyAuthorable: false });
  });

  it('rejects mismatched references, duplicates, unknown rows, and invalid indices', () => {
    const initial = withoutRequiredRewardAction();
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'InsertRoomAction',
        action: action(invented),
        reference: reward,
        index: 0,
      }),
    ).toThrow('reference does not match');
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'InsertRoomAction',
        action: action(invented),
        reference: invented,
        index: 0,
      }),
    ).toThrow('room action is not active for this occurrence');
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'InsertRoomAction',
        action: action(reward),
        reference: reward,
        index: 1,
      }),
    ).toThrow('index must be an integer from 0 through 0');

    const inserted = applyProjectCommand(initial, catalog, {
      kind: 'InsertRoomAction',
      action: action(reward),
      reference: reward,
      index: 0,
    });
    expect(() =>
      applyProjectCommand(inserted, catalog, {
        kind: 'InsertRoomAction',
        action: action(reward),
        reference: reward,
        index: 1,
      }),
    ).toThrow('already ordered');
    expect(() =>
      applyProjectCommand(inserted, catalog, {
        kind: 'RemoveRoomAction',
        action: action(invented),
      }),
    ).toThrow('not ordered');
    expect(() =>
      applyProjectCommand(inserted, catalog, {
        kind: 'MoveRoomAction',
        action: action(reward),
        toIndex: 1,
      }),
    ).toThrow('toIndex must be an integer from 0 through 0');
  });

  it('rejects dormant contextual insertions while accepting an active Fields optional', () => {
    const fieldsOccurrenceId = createOccurrenceId('golden-h-combat02');
    const fields = createGoldenFGHProject();
    const fieldsOccurrence = fields.route.biomes
      .find((plan) => plan.biomeKey === 'H')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === fieldsOccurrenceId);
    if (fieldsOccurrence === undefined) throw new Error('missing active two-cage Fields room');
    const dormantCage: RoomActionReference = {
      kind: 'completeFieldsCage',
      phaseKey: 'Cage03',
    };
    expect(() =>
      applyProjectCommand(fields, catalog, {
        kind: 'InsertRoomAction',
        action: createRoomActionAddress(
          goldenHBiome,
          fieldsOccurrenceId,
          roomActionKey(dormantCage),
        ),
        reference: dormantCage,
        index: fieldsOccurrence.roomActions.order.length,
      }),
    ).toThrow('room action is not active for this occurrence');

    const optional: RoomActionReference = {
      kind: 'interactLocalReward',
      groupKey: 'optionalRewards',
      slotKey: 'optional1',
    };
    const inserted = applyProjectCommand(fields, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(goldenHBiome, fieldsOccurrenceId, roomActionKey(optional)),
      reference: optional,
      index: fieldsOccurrence.roomActions.order.length,
    });
    expect(
      inserted.route.biomes
        .find((plan) => plan.biomeKey === 'H')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === fieldsOccurrenceId)
        ?.roomActions.order,
    ).toContainEqual(
      withItemContent(
        inserted,
        createOccurrenceAddress(goldenHBiome, fieldsOccurrenceId),
        optional,
      ),
    );
  });

  it('rejects reinserting a retained incoming reward after its Anomaly fails', () => {
    const intro = createOccurrenceId('room-actions-g-intro');
    const targetId = createOccurrenceId('room-actions-g-anomaly');
    const source = { kind: 'occurrence' as const, occurrenceId: intro };
    const decision = createExitDecisionAddress(gBiome, source);
    let authored = applyProjectCommand(gProject(), catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: intro,
    });
    authored = applyProjectCommand(authored, catalog, { kind: 'CreateBatch', decision });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, source),
      storeKey: 'RunProgress',
    });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, source, 'exit1'),
      occurrenceId: targetId,
      gameName: 'G_Combat01',
    });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(gBiome, targetId),
      value: { rewardType: 'MaxHealthDrop' },
    });
    const pickup: RoomActionReference = {
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'self',
    };
    const pickupAddress = createRoomActionAddress(gBiome, targetId, roomActionKey(pickup));
    authored = applyProjectCommand(authored, catalog, {
      kind: 'InsertRoomAction',
      action: pickupAddress,
      reference: pickup,
      index: 0,
    });
    authored = applyProjectCommand(authored, catalog, {
      kind: 'SwitchTargetToAnomaly',
      target: createTargetAddress(gBiome, source, 'exit1'),
    });
    const failed = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceAnomalySuccess',
      occurrence: createOccurrenceAddress(gBiome, targetId),
      success: false,
    });
    const removed = applyProjectCommand(failed, catalog, {
      kind: 'RemoveRoomAction',
      action: pickupAddress,
    });
    expect(() =>
      applyProjectCommand(removed, catalog, {
        kind: 'InsertRoomAction',
        action: pickupAddress,
        reference: pickup,
        index: 0,
      }),
    ).toThrow('room action is not active for this occurrence');
  });

  it('schedules parallel required actions activated by one selection by contribution ordinal', () => {
    const targetId = parallelTargetId;
    const source = { kind: 'occurrence' as const, occurrenceId: parallelSourceId };
    const authored = parallelRequiredProject();
    const targetOccurrence = (document: ProjectDocument) =>
      document.route?.biomes[0]?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === targetId,
      );
    expect(targetOccurrence(authored)?.roomActions.order).toEqual([]);

    const selected = applyProjectCommand(authored, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    // The selection activates them without placing either.
    expect(targetOccurrence(selected)?.roomActions.order).toEqual([]);
    const scheduled = scheduleTestRequiredRoomActions(selected, catalog, biome);
    expect(targetOccurrence(scheduled)?.roomActions.order).toEqual(
      withItemContents(scheduled, createOccurrenceAddress(biome, targetId), [
        {
          kind: 'interactIncomingReward',
          producerPoint: 'roomRewardPickup',
          acquisitionRole: 'source',
        },
        { kind: 'interactEncounter', phaseKey: 'Encounter' },
      ]),
    );
  });

  it('inserts a missing required action at any legal index, its canonical one by default', () => {
    const selected = scheduleTestRequiredRoomActions(
      applyProjectCommand(parallelRequiredProject(), catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(biome, {
          kind: 'occurrence',
          occurrenceId: parallelSourceId,
        }),
        value: { kind: 'normal', exitKey: 'exit1' },
      }),
      catalog,
      biome,
    );
    const [incoming, artemis] = parallelTarget(selected).roomActions.order;
    const missing = decodeProjectDocument(
      {
        ...selected,
        route: {
          ...selected.route,
          biomes: selected.route.biomes.map((plan) =>
            plan.topology === null
              ? plan
              : {
                  ...plan,
                  topology: {
                    ...plan.topology,
                    occurrences: plan.topology.occurrences.map((candidate) =>
                      candidate.occurrenceId === parallelTargetId
                        ? { ...candidate, roomActions: { order: [artemis] } }
                        : candidate,
                    ),
                  },
                },
          ),
        },
      },
      catalog,
    );
    const target = createRoomActionAddress(biome, parallelTargetId, roomActionKey(incoming!));
    const insert = (index: number) =>
      applyProjectCommand(missing, catalog, {
        kind: 'InsertRoomAction',
        action: target,
        reference: incoming!,
        index,
      });
    // Canonical before the Artemis interaction; after it is equally legal.
    expect(parallelTarget(insert(0)).roomActions.order).toEqual([incoming, artemis]);
    expect(parallelTarget(insert(1)).roomActions.order).toEqual([artemis, incoming]);
    expect(() => insert(2)).toThrow('index must be an integer from 0 through 1');
  });

  it('records each effective order edit as one semantic history entry', () => {
    const initial = createProjectHistory(unresolvedProject());
    const activated = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });

    expect(activated.past).toHaveLength(1);
    // Activation places no row; placing it is its own entry.
    expect(occurrence(activated.present).roomActions.order).toEqual([]);
    const undone = undoProjectHistory(activated);
    expect(undone.present).toBe(initial.present);
    expect(redoProjectHistory(undone).present).toBe(activated.present);
    const placed = applyProjectHistoryCommand(activated, catalog, {
      kind: 'InsertRoomAction',
      action: action(reward),
      reference: reward,
      index: 0,
    });
    expect(placed.past).toHaveLength(2);
    expect(occurrence(placed.present).roomActions.order).toEqual([
      withItemContent(placed.present, start, reward),
    ]);
    expect(undoProjectHistory(placed).present).toBe(activated.present);
  });

  it('keeps an existing omission through unrelated edits and restores it canonically in one history step', () => {
    const malformed = withoutRequiredRewardAction();
    const retained = applyProjectCommand(malformed, catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Underworld'),
      arcanaKeys: ['ChanneledCast'],
    });
    expect(occurrence(retained).roomActions.order).toEqual([]);

    const roster = entryRoom(retained).roomActionRoster;
    expect(roster.issues).toContainEqual({
      kind: 'unrankedRequired',
      reference: withItemContent(retained, start, reward),
    });
    const restores = roster.proposals.filter(
      (proposal) =>
        proposal.kind === 'insert' && roomActionKey(proposal.reference) === roomActionKey(reward),
    );
    expect(restores).toEqual([
      expect.objectContaining({
        kind: 'insert',
        toIndex: 0,
        structurallyAuthorable: true,
      }),
    ]);

    const initial = createProjectHistory(retained);
    const restored = applyProjectHistoryCommand(initial, catalog, {
      kind: 'InsertRoomAction',
      action: action(reward),
      reference: reward,
      index: 0,
    });
    expect(restored.past).toHaveLength(1);
    expect(occurrence(restored.present).roomActions.order).toEqual([
      withItemContent(restored.present, start, reward),
    ]);
    expect(undoProjectHistory(restored).present).toBe(initial.present);
  });

  it('keeps an Artificer replacement dormant when its source action is absent', () => {
    const malformed = withoutRequiredRewardAction();
    const source = createIncomingRewardAddress(biome, occurrenceId);
    const acquisition = createAcquisitionRoleAddress(source, 'source');
    const site = artificerAcquisitionSite(createOccurrenceAddress(biome, occurrenceId), source);
    const replacement: RoomActionReference = {
      kind: 'interactAcquisitionEntry',
      siteKey: acquisitionSiteStorageKey(site),
      entryKey: artificerReplacementEntryKey(source, 'source'),
    };
    const activated = applyProjectCommand(malformed, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'artificer' },
    });

    expect(occurrence(activated).roomActions.order).toEqual([]);
    const roster = entryRoom(activated).roomActionRoster;
    expect(roster.issues).toEqual(
      expect.arrayContaining([
        { kind: 'unrankedRequired', reference: withItemContent(activated, start, reward) },
      ]),
    );
    expect(roster.rows).not.toContainEqual(expect.objectContaining({ reference: replacement }));
    expect(
      roster.proposals.filter(
        (proposal) =>
          proposal.kind === 'insert' && roomActionKey(proposal.reference) === roomActionKey(reward),
      ),
    ).toEqual([
      expect.objectContaining({ kind: 'insert', toIndex: 0, structurallyAuthorable: true }),
    ]);
  });

  it('activates a required Artificer replacement only after an optional source participates', () => {
    const fieldsOccurrenceId = createOccurrenceId('golden-h-combat02');
    const source = createLocalRewardAddress(
      goldenHBiome,
      fieldsOccurrenceId,
      'optionalRewards',
      'optional1',
    );
    const sourceReference: RoomActionReference = {
      kind: 'interactLocalReward',
      groupKey: 'optionalRewards',
      slotKey: 'optional1',
    };
    const replacementSite = artificerAcquisitionSite(
      createOccurrenceAddress(goldenHBiome, fieldsOccurrenceId),
      source,
    );
    const replacement: RoomActionReference = {
      kind: 'interactAcquisitionEntry',
      siteKey: acquisitionSiteStorageKey(replacementSite),
      entryKey: artificerReplacementEntryKey(source, 'self'),
    };
    const sourceAction = createRoomActionAddress(
      goldenHBiome,
      fieldsOccurrenceId,
      roomActionKey(sourceReference),
    );
    const replacementAction = createRoomActionAddress(
      goldenHBiome,
      fieldsOccurrenceId,
      roomActionKey(replacement),
    );
    let dormant = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(source, 'self'),
      value: { kind: 'artificer' },
    });
    const fields = (document: ProjectDocument) => {
      const occurrence = document.route.biomes
        .find((plan) => plan.biomeKey === 'H')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === fieldsOccurrenceId);
      if (occurrence === undefined) throw new Error('Fields occurrence is missing');
      return occurrence;
    };
    const fieldsRoom = createOccurrenceAddress(goldenHBiome, fieldsOccurrenceId);
    expect(fields(dormant).roomActions.order).not.toContainEqual(
      withItemContent(dormant, fieldsRoom, sourceReference),
    );
    expect(fields(dormant).roomActions.order).not.toContainEqual(
      withItemContent(dormant, fieldsRoom, replacement),
    );
    expect(fields(dormant).acquisitionSites?.[replacement.siteKey]?.pickupEntries).toHaveProperty(
      replacement.entryKey,
      null,
    );

    dormant = applyProjectCommand(dormant, catalog, {
      kind: 'InsertRoomAction',
      action: sourceAction,
      reference: sourceReference,
      index: 0,
    });
    // The source's participation activates the replacement without placing it.
    expect(fields(dormant).roomActions.order).toContainEqual(
      withItemContent(dormant, fieldsRoom, sourceReference),
    );
    expect(fields(dormant).roomActions.order).not.toContainEqual(
      withItemContent(dormant, fieldsRoom, replacement),
    );
    const domain = assembleRoomActionDomain({
      routePosition: ordinaryPositionFor(catalog, goldenHBiome),
      catalog,
      biome: goldenHBiome,
      topology: dormant.route.biomes.find((plan) => plan.biomeKey === 'H')!.topology!,
      occurrence: fields(dormant),
    });
    expect(domain.contributions).toContainEqual(
      expect.objectContaining({
        kind: 'action',
        reference: replacement,
        participation: 'required',
        dependencies: [{ kind: 'afterAction', action: sourceReference }],
      }),
    );
    const withReplacement = applyProjectCommand(dormant, catalog, {
      kind: 'InsertRoomAction',
      action: replacementAction,
      reference: replacement,
      index: fields(dormant).roomActions.order.length,
    });
    expect(fields(withReplacement).roomActions.order.at(-1)).toEqual(
      withItemContent(withReplacement, fieldsRoom, replacement),
    );
    // A placed required row may be removed: its item is live again.
    expect(
      fields(
        applyProjectCommand(withReplacement, catalog, {
          kind: 'RemoveRoomAction',
          action: replacementAction,
        }),
      ).roomActions.order,
    ).toEqual(fields(dormant).roomActions.order);
    const deactivated = applyProjectCommand(dormant, catalog, {
      kind: 'RemoveRoomAction',
      action: sourceAction,
    });
    expect(
      assembleRoomActionDomain({
        routePosition: ordinaryPositionFor(catalog, goldenHBiome),
        catalog,
        biome: goldenHBiome,
        topology: deactivated.route.biomes.find((plan) => plan.biomeKey === 'H')!.topology!,
        occurrence: fields(deactivated),
      }).contributions,
    ).not.toContainEqual(expect.objectContaining({ kind: 'action', reference: replacement }));
    expect(
      fields(deactivated).acquisitionSites?.[replacement.siteKey]?.pickupEntries,
    ).toHaveProperty(replacement.entryKey, null);
  });

  it('undoes the Artificer required-replacement activation as one semantic edit that places no row', () => {
    const fieldsOccurrenceId = createOccurrenceId('golden-h-combat02');
    const source = createLocalRewardAddress(
      goldenHBiome,
      fieldsOccurrenceId,
      'optionalRewards',
      'optional1',
    );
    const sourceReference: RoomActionReference = {
      kind: 'interactLocalReward',
      groupKey: 'optionalRewards',
      slotKey: 'optional1',
    };
    const withSource = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(
        goldenHBiome,
        fieldsOccurrenceId,
        roomActionKey(sourceReference),
      ),
      reference: sourceReference,
      index: 0,
    });
    const history = applyProjectHistoryCommand(createProjectHistory(withSource), catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(source, 'self'),
      value: { kind: 'artificer' },
    });
    const replacement: RoomActionReference = {
      kind: 'interactAcquisitionEntry',
      siteKey: acquisitionSiteStorageKey(
        artificerAcquisitionSite(createOccurrenceAddress(goldenHBiome, fieldsOccurrenceId), source),
      ),
      entryKey: artificerReplacementEntryKey(source, 'self'),
    };
    expect(history.past).toHaveLength(1);
    const fields = history.present.route.biomes
      .find((plan) => plan.biomeKey === 'H')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === fieldsOccurrenceId);
    expect(fields?.roomActions.order).not.toContainEqual(replacement);
    expect(
      assembleRoomActionDomain({
        routePosition: ordinaryPositionFor(catalog, goldenHBiome),
        catalog,
        biome: goldenHBiome,
        topology: history.present.route.biomes.find((plan) => plan.biomeKey === 'H')!.topology!,
        occurrence: fields!,
      }).contributions,
    ).toContainEqual(
      expect.objectContaining({
        kind: 'action',
        reference: replacement,
        participation: 'required',
      }),
    );
    expect(undoProjectHistory(history).present).toBe(withSource);
  });

  it('activates encounter and Gorgon contacts without placing them or duplicating a retained row', () => {
    const combat = createCompleteFGProject();
    const combatOccurrenceId = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: combatOccurrenceId },
      'Encounter',
    );
    const combatOccurrence = (document: ProjectDocument) => {
      const candidate = document.route.biomes
        .find((plan) => plan.biomeKey === 'F')
        ?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === combatOccurrenceId,
        );
      if (candidate === undefined) throw new Error('missing F combat occurrence');
      return candidate;
    };
    const encounter = { kind: 'interactEncounter' as const, phaseKey: 'Encounter' };
    const selected = applyProjectHistoryCommand(createProjectHistory(combat), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'ArtemisCombatF',
    });
    expect(selected.past).toHaveLength(1);
    expect(combatOccurrence(selected.present).roomActions.order).not.toContainEqual(encounter);
    expect(undoProjectHistory(selected).present).toBe(combat);
    const contacted = applyProjectCommand(selected.present, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(goldenFBiome, combatOccurrenceId, roomActionKey(encounter)),
      reference: encounter,
      index: combatOccurrence(selected.present).roomActions.order.length,
    });

    const reset = applyProjectCommand(contacted, catalog, {
      kind: 'ResetEncounter',
      phase,
    });
    const reselected = applyProjectCommand(reset, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'ArtemisCombatF',
    });
    expect(
      combatOccurrence(reselected).roomActions.order.filter(
        (reference) => roomActionKey(reference) === roomActionKey(encounter),
      ),
    ).toHaveLength(1);

    const gorgon = { kind: 'interactGorgon' as const, phaseKey: 'Encounter' };
    const gorgonHistory = applyProjectHistoryCommand(createProjectHistory(combat), catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    expect(gorgonHistory.past).toHaveLength(1);
    expect(combatOccurrence(gorgonHistory.present).roomActions.order).not.toContainEqual(gorgon);
    expect(undoProjectHistory(gorgonHistory).present).toBe(combat);
    const gorgonContacted = applyProjectCommand(gorgonHistory.present, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(goldenFBiome, combatOccurrenceId, roomActionKey(gorgon)),
      reference: gorgon,
      index: combatOccurrence(gorgonHistory.present).roomActions.order.length,
    });
    expect(combatOccurrence(gorgonContacted).roomActions.order).toContainEqual(gorgon);
    const clearedGorgon = applyProjectCommand(gorgonContacted, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: false,
    });
    expect(combatOccurrence(clearedGorgon).roomActions.order).not.toContainEqual(gorgon);
    expect(combatOccurrence(clearedGorgon).encounters.gorgonResultByPhase?.Encounter).toMatchObject(
      { athenaTriggerConditionMet: false },
    );
  });

  it('keeps optional non-Shop and stale rows explicitly removable', () => {
    const fieldsOccurrenceId = createOccurrenceId('golden-h-combat02');
    const optional: RoomActionReference = {
      kind: 'interactLocalReward',
      groupKey: 'optionalRewards',
      slotKey: 'optional1',
    };
    const authored = createGoldenFGHProject();
    const retained = decodeProjectDocument(
      {
        ...authored,
        route: {
          ...authored.route,
          biomes: authored.route.biomes.map((plan) =>
            plan.topology === null
              ? plan
              : {
                  ...plan,
                  topology: {
                    ...plan.topology,
                    occurrences: plan.topology.occurrences.map((candidate) =>
                      candidate.occurrenceId !== fieldsOccurrenceId
                        ? candidate
                        : {
                            ...candidate,
                            roomActions: {
                              order: [...candidate.roomActions.order, optional, invented],
                            },
                          },
                    ),
                  },
                },
          ),
        },
      },
      catalog,
    );
    const withoutOptional = applyProjectCommand(retained, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(goldenHBiome, fieldsOccurrenceId, roomActionKey(optional)),
    });
    const fieldsOccurrence = (document: ProjectDocument) => {
      const candidate = document.route.biomes
        .find((plan) => plan.biomeKey === 'H')
        ?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === fieldsOccurrenceId,
        );
      if (candidate === undefined) throw new Error('missing Fields occurrence');
      return candidate;
    };
    expect(fieldsOccurrence(withoutOptional).roomActions.order).not.toContainEqual(optional);
    const withoutStale = applyProjectCommand(withoutOptional, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(goldenHBiome, fieldsOccurrenceId, roomActionKey(invented)),
    });
    expect(fieldsOccurrence(withoutStale).roomActions.order).not.toContainEqual(invented);
  });

  it('discards an Artificer replacement and its pickup when its source leaves the Artificer', () => {
    const source = createIncomingRewardAddress(biome, occurrenceId);
    const acquisition = createAcquisitionRoleAddress(source, 'source');
    const site = artificerAcquisitionSite(createOccurrenceAddress(biome, occurrenceId), source);
    const siteKey = acquisitionSiteStorageKey(site);
    const entryKey = artificerReplacementEntryKey(source, 'source');
    const replacement: RoomActionReference = {
      kind: 'interactAcquisitionEntry',
      siteKey,
      entryKey,
    };
    const activated = applyProjectCommand(project(), catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'artificer' },
    });
    expect(occurrence(activated).roomActions.order).toEqual([]);
    let active = activated;
    for (const [index, reference] of [reward, replacement].entries())
      active = applyProjectCommand(active, catalog, {
        kind: 'InsertRoomAction',
        action: action(reference),
        reference,
        index,
      });
    expect(occurrence(active).roomActions.order).toEqual(
      withItemContents(active, start, [reward, replacement]),
    );
    // Leaving the Artificer discards the replacement and its pickup in the same edit.
    const left = applyProjectCommand(active, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'normal' },
    });
    expect(occurrence(left).acquisitionSites?.[siteKey]).toBeUndefined();
    expect(occurrence(left).roomActions.order).toEqual([withItemContent(left, start, reward)]);

    // An equal offer rebuilt with another key order is the same source and keeps its chain.
    const room = occurrence(active);
    const acquisitionState = room.startingRewardAcquisition!;
    const judged = (offer: object) =>
      withoutStaleDerivedItems(biome, room, room, {
        previousStartIncoming: {
          offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
          ...acquisitionState,
        },
        startIncoming: { offer, ...acquisitionState } as never,
      });
    expect(
      judged({ payload: { source: 'ApolloUpgrade', kind: 'BoonSource' }, rewardType: 'Boon' }),
    ).toBe(room);
    expect(
      judged({ rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } })
        .acquisitionSites?.[siteKey],
    ).toBeUndefined();

    // An earlier schema kept the replacement dormant once its source left the Artificer.
    const dormant = decodeProjectDocument(
      JSON.parse(
        JSON.stringify({
          ...left,
          route: {
            ...left.route,
            biomes: left.route.biomes.map((plan, index) =>
              index !== 0 || plan.topology === null
                ? plan
                : {
                    ...plan,
                    topology: {
                      ...plan.topology,
                      occurrences: plan.topology.occurrences.map((room, roomIndex) =>
                        roomIndex === 0
                          ? {
                              ...room,
                              acquisitionSites: occurrence(active).acquisitionSites,
                              roomActions: { order: [reward, replacement] },
                            }
                          : room,
                      ),
                    },
                  },
            ),
          },
        }),
      ),
      catalog,
    );
    expect(occurrence(dormant).roomActions.order).toEqual([reward, replacement]);
    // An unrelated edit to the room keeps it; the edit never changed its source.
    const unrelated = applyProjectCommand(dormant, catalog, {
      kind: 'MoveRoomAction',
      action: action(replacement),
      toIndex: 0,
    });
    expect(occurrence(unrelated).acquisitionSites?.[siteKey]?.pickupEntries).toHaveProperty(
      entryKey,
    );
    expect(occurrence(unrelated).roomActions.order).toEqual(
      withItemContents(unrelated, start, [replacement, reward]),
    );
    // The 102 -> 103 upgrade drops it once, with its pickup.
    const upgraded = settleProjectUpgrade({
      catalog,
      project: dormant,
      evaluate: (document) => simulateProjectAssembly(catalog, document),
    }).assembly.project;
    expect(occurrence(upgraded).acquisitionSites?.[siteKey]).toBeUndefined();
    expect(occurrence(upgraded).roomActions.order).toEqual([reward]);
    expect(() =>
      applyProjectCommand(left, catalog, {
        kind: 'InsertRoomAction',
        action: action(replacement),
        reference: replacement,
        index: 0,
      }),
    ).toThrow('room action is not active for this occurrence');

    // Returning to the Artificer produces a new replacement, live until placed.
    const restored = applyProjectCommand(left, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'artificer' },
    });
    expect(occurrence(restored).roomActions.order).not.toContainEqual(
      withItemContent(restored, start, replacement),
    );
    expect(occurrence(restored).acquisitionSites?.[siteKey]?.pickupEntries).toHaveProperty(
      entryKey,
      null,
    );
    const replaced = applyProjectCommand(restored, catalog, {
      kind: 'InsertRoomAction',
      action: action(replacement),
      reference: replacement,
      index: 1,
    });
    expect(occurrence(replaced).roomActions.order).toEqual(
      withItemContents(replaced, start, [reward, replacement]),
    );
  });

  it('preserves authored chronology when room identity is replaced', () => {
    const placed = applyProjectCommand(project(), catalog, {
      kind: 'InsertRoomAction',
      action: action(reward),
      reference: reward,
      index: 0,
    });
    const replaced = applyProjectCommand(placed, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, occurrenceId),
      gameName: 'F_Opening02',
    });

    expect(occurrence(replaced).roomActions.order).toEqual([
      withItemContent(replaced, start, reward),
    ]);
  });

  it('owns initial Shop participation through one exact append/remove command', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const shopBiome = createBiomeAddress('Surface', 'N');
    const major = createShopOfferAddress(shopBiome, shopId, 'MajorNonBoon');
    const minor = createShopOfferAddress(shopBiome, shopId, 'Minor');
    const travel = createShopOfferAddress(shopBiome, shopId, 'travelDealRefill');
    const shop = createOccurrenceAddress(shopBiome, shopId);
    const initial = createCompleteNProject();
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: travel,
        purchased: true,
      }),
    ).toThrow('Travel Deal uses its roomExit acquisition entry participation');
    let history = createProjectHistory(initial);
    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: major,
      purchased: true,
    });
    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: minor,
      purchased: true,
    });
    const shopOccurrence = () =>
      history.present.route.biomes
        .find((candidate) => candidate.biomeKey === 'N')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    expect(shopOccurrence()?.roomActions.order).toEqual(
      withItemContents(history.present, shop, [
        { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
        { kind: 'interactShopOffer', offerKey: 'Minor' },
      ]),
    );

    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: major,
      purchased: false,
    });
    expect(shopOccurrence()?.roomActions.order).toEqual([
      withItemContent(history.present, shop, { kind: 'interactShopOffer', offerKey: 'Minor' }),
    ]);
    expect(history.past).toHaveLength(3);
    history = undoProjectHistory(history);
    expect(shopOccurrence()?.roomActions.order).toEqual(
      withItemContents(history.present, shop, [
        { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
        { kind: 'interactShopOffer', offerKey: 'Minor' },
      ]),
    );
    history = redoProjectHistory(history);
    expect(shopOccurrence()?.roomActions.order).toEqual([
      withItemContent(history.present, shop, { kind: 'interactShopOffer', offerKey: 'Minor' }),
    ]);
  });

  it('rejects generic membership edits for Shop offers while retaining move', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const shopBiome = createBiomeAddress('Surface', 'N');
    const offer = createShopOfferAddress(shopBiome, shopId, 'MajorNonBoon');
    const reference = { kind: 'interactShopOffer' as const, offerKey: 'MajorNonBoon' };
    const action = createRoomActionAddress(shopBiome, shopId, roomActionKey(reference));
    const initial = createCompleteNProject();
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'InsertRoomAction',
        action,
        reference,
        index: 0,
      }),
    ).toThrow('ReplaceShopPurchaseParticipation');
    const purchased = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer,
      purchased: true,
    });
    expect(() =>
      applyProjectCommand(purchased, catalog, { kind: 'RemoveRoomAction', action }),
    ).toThrow('ReplaceShopPurchaseParticipation');
    expect(() =>
      applyProjectCommand(purchased, catalog, { kind: 'MoveRoomAction', action, toIndex: 0 }),
    ).not.toThrow();
  });

  it('rejects generic membership edits for Well purchases while retaining move', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const project = createUnderworldFWellCheckpoint(false);
    const reference = project.route.biomes
      .find((candidate) => candidate.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === well.occurrenceId)
      ?.roomActions.order.find((candidate) => candidate.kind === 'purchaseStygianWellOffer');
    if (reference === undefined) throw new Error('missing Well purchase');
    const action = createRoomActionAddress(
      goldenFBiome,
      well.occurrenceId,
      roomActionKey(reference),
    );
    expect(() =>
      applyProjectCommand(project, catalog, { kind: 'RemoveRoomAction', action }),
    ).toThrow('SetStygianWellPurchase');
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'InsertRoomAction',
        action,
        reference,
        index: 0,
      }),
    ).toThrow('SetStygianWellPurchase');
    expect(() =>
      applyProjectCommand(project, catalog, { kind: 'MoveRoomAction', action, toIndex: 0 }),
    ).not.toThrow();
  });

  it('places a Stygian Well Travel refill after the first initial purchase in either selection order', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createUnderworldFWellCheckpoint(false);
    for (const generationKey of [
      'initial:secondLeft',
      'initial:secondRight',
      'travelDealRefill',
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: well,
        generationKey,
        purchased: false,
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'travelDealRefill',
      purchased: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondLeft',
      purchased: true,
    });
    const order = project.route.biomes
      .find((candidate) => candidate.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === well.occurrenceId)
      ?.roomActions.order;
    expect(order?.filter((reference) => reference.kind === 'purchaseStygianWellOffer')).toEqual(
      withItemContents(project, well, [
        { kind: 'purchaseStygianWellOffer', generationKey: 'initial:secondLeft' },
        { kind: 'purchaseStygianWellOffer', generationKey: 'travelDealRefill' },
      ]),
    );

    for (const generationKey of ['initial:secondLeft', 'travelDealRefill'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: well,
        generationKey,
        purchased: false,
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondLeft',
      purchased: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'travelDealRefill',
      purchased: true,
    });
    const finalOccurrence = project.route.biomes
      .find((candidate) => candidate.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === well.occurrenceId);
    if (finalOccurrence === undefined) throw new Error('missing Well occurrence');
    const reverseOrder = finalOccurrence.roomActions.order;
    expect(
      reverseOrder.filter((reference) => reference.kind === 'purchaseStygianWellOffer'),
    ).toEqual(
      withItemContents(project, well, [
        { kind: 'purchaseStygianWellOffer', generationKey: 'initial:secondLeft' },
        { kind: 'purchaseStygianWellOffer', generationKey: 'travelDealRefill' },
      ]),
    );
    expect(
      assembleRoomActionDomain({
        routePosition: ordinaryPositionFor(catalog, goldenFBiome),
        catalog,
        biome: goldenFBiome,
        topology: project.route.biomes.find((candidate) => candidate.biomeKey === 'F')!.topology!,
        occurrence: finalOccurrence,
      }).contributions,
    ).toContainEqual(
      expect.objectContaining({
        kind: 'action',
        reference: withItemContent(project, well, {
          kind: 'purchaseStygianWellOffer',
          generationKey: 'travelDealRefill',
        }),
        dependencies: [
          {
            kind: 'afterAction',
            action: withItemContent(project, well, {
              kind: 'purchaseStygianWellOffer',
              generationKey: 'initial:secondLeft',
            }),
            authoringOnly: true,
          },
        ],
      }),
    );
  });

  it('buys a Well item at a chosen legal index, the refill only after the first purchase', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = createUnderworldFWellCheckpoint(false);
    for (const generationKey of [
      'initial:secondLeft',
      'initial:secondRight',
      'travelDealRefill',
    ] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: well,
        generationKey,
        purchased: false,
      });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondLeft',
      purchased: true,
    });
    const order = (document: ProjectDocument) =>
      document.route.biomes
        .find((candidate) => candidate.biomeKey === 'F')!
        .topology!.occurrences.find((candidate) => candidate.occurrenceId === well.occurrenceId)!
        .roomActions.order;
    const refill = {
      kind: 'SetStygianWellPurchase' as const,
      occurrence: well,
      generationKey: 'travelDealRefill' as const,
      purchased: true,
    };
    const fountain = { kind: 'useFountain' as const };
    const rack = { kind: 'interactKeepsakeRack' as const };
    const bought = (generationKey: StygianWellGenerationKey) =>
      withItemContent(project, well, { kind: 'purchaseStygianWellOffer', generationKey });
    expect(order(project)).toEqual([fountain, rack, bought('initial:secondLeft')]);
    const secondRight = { ...refill, generationKey: 'initial:secondRight' as const };
    // Anywhere after the fountain unlocks the Well; the default is the end.
    expect(positionedCommandInsertionIndexes(project, catalog, secondRight)).toEqual([1, 2, 3]);
    expect(order(applyProjectCommand(project, catalog, { ...secondRight, index: 1 }))).toEqual([
      fountain,
      bought('initial:secondRight'),
      rack,
      bought('initial:secondLeft'),
    ]);
    expect(() => applyProjectCommand(project, catalog, { ...secondRight, index: 0 })).toThrow(
      /index 0 is not a legal position .* a required action of an earlier window/,
    );
    // The refill restocks only after the first purchase.
    expect(positionedCommandInsertionIndexes(project, catalog, refill)).toEqual([3]);
    expect(() => applyProjectCommand(project, catalog, { ...refill, index: 2 })).toThrow(
      /must follow/,
    );
    const placed = applyProjectCommand(project, catalog, secondRight);
    expect(positionedCommandInsertionIndexes(placed, catalog, secondRight)).toEqual([]);
    expect(() => applyProjectCommand(placed, catalog, { ...secondRight, index: 1 })).toThrow(
      'an index places only a new purchase',
    );
  });

  it('rejects an invented initial Shop offer when marking Purchased', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const shopBiome = createBiomeAddress('Surface', 'N');
    const initial = createCompleteNProject();
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(shopBiome, shopId, 'invented'),
        purchased: true,
      }),
    ).toThrow('unknown shop offer invented');
  });

  it('keeps the Postboss rack in place across set and clear, moves it in one undo step and removes it', () => {
    const completion = createOccurrenceAddress(
      biome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const rack = { kind: 'interactKeepsakeRack' as const };
    const action = createRoomActionAddress(biome, completion.occurrenceId, roomActionKey(rack));
    const selection = createPostbossKeepsakeSelectionAddress(completion);
    const postbossOf = (project: ProjectDocument) =>
      project.route?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === completion.occurrenceId,
      );
    const retained = createGoldenFGHProject();
    expect(postbossOf(retained)?.keepsakeRack).toEqual({ keepsakeKey: null });
    expect(postbossOf(retained)?.roomActions.order).toEqual([{ kind: 'useFountain' }, rack]);
    const replaced = applyProjectCommand(retained, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
    expect(postbossOf(replaced)?.roomActions.order).toEqual([{ kind: 'useFountain' }, rack]);
    // Removing the rack's use clears its choice; the held keepsake stays.
    const unracked = applyProjectCommand(replaced, catalog, { kind: 'RemoveRoomAction', action });
    expect(postbossOf(unracked)?.roomActions.order).toEqual([{ kind: 'useFountain' }]);
    expect(postbossOf(unracked)?.keepsakeRack).toEqual({ keepsakeKey: null });

    const history = applyProjectHistoryCommand(createProjectHistory(replaced), catalog, {
      kind: 'MoveRoomAction',
      action,
      toIndex: 0,
    });
    expect(history.past).toHaveLength(1);
    expect(postbossOf(history.present)?.roomActions.order).toEqual([rack, { kind: 'useFountain' }]);
    expect(undoProjectHistory(history).present).toBe(replaced);

    const withResult = applyProjectCommand(history.present, catalog, {
      kind: 'ReplaceJeweledPomEquipResult',
      result: createKeepsakeEquipResultAddress(selection, 'jeweledPom'),
      value: { traitKey: 'HadesLifestealBoon' },
    });
    const clearedHistory = applyProjectHistoryCommand(createProjectHistory(withResult), catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      keepsakeKey: null,
    });
    const cleared = clearedHistory.present;
    expect(postbossOf(cleared)?.keepsakeRack).toEqual({ keepsakeKey: null });
    expect(postbossOf(cleared)?.roomActions.order).toEqual([rack, { kind: 'useFountain' }]);
    expect(undoProjectHistory(clearedHistory).present).toBe(withResult);
    expect(
      applyProjectCommand(cleared, catalog, {
        kind: 'ReplacePostbossKeepsake',
        selection,
        keepsakeKey: null,
      }),
    ).toBe(cleared);

    const swapped = applyProjectCommand(withResult, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      keepsakeKey: 'BonusMoneyKeepsake',
    });
    expect(postbossOf(swapped)?.keepsakeRack).toEqual({ keepsakeKey: 'BonusMoneyKeepsake' });
    expect(postbossOf(swapped)?.roomActions.order).toEqual([rack, { kind: 'useFountain' }]);
  });

  it('orders the Postboss rack freely around the fountain and Well purchases', () => {
    const completion = createOccurrenceAddress(
      biome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const rack = { kind: 'interactKeepsakeRack' as const };
    const fountain = { kind: 'useFountain' as const };
    const purchase: RoomActionReference = {
      kind: 'purchaseStygianWellOffer',
      generationKey: 'initial:healing',
    };
    let document = createGoldenFGHProject();
    const commands: readonly ProjectCommand[] = [
      {
        kind: 'ReplaceStygianWellOffer' as const,
        occurrence: completion,
        slotKey: 'healing',
        itemKey: 'ArmorBoostStore',
      },
      {
        kind: 'SetStygianWellPurchase' as const,
        occurrence: completion,
        generationKey: 'initial:healing' as const,
        purchased: true,
      },
      {
        kind: 'ReplacePostbossKeepsake' as const,
        selection: createPostbossKeepsakeSelectionAddress(completion),
        keepsakeKey: 'HadesAndPersephoneKeepsake',
      },
    ];
    for (const command of commands) document = applyProjectCommand(document, catalog, command);
    const roster = (order: readonly RoomActionReference[]) => {
      const reordered = replaceTestRoomActionOrder(
        document,
        catalog,
        biome,
        completion.occurrenceId,
        order,
      );
      const located = roomActionDomainForOccurrence(
        reordered,
        catalog,
        biome,
        completion.occurrenceId,
      )!;
      return assembleRoomActionRoster({
        owner: completion,
        order,
        contributions: located.domain.contributions,
        lifecycleStructure: located.domain.lifecycleStructure,
      });
    };
    const rackAction = createRoomActionAddress(biome, completion.occurrenceId, roomActionKey(rack));

    // The permanent rack keeps its place; a later purchase lands after it.
    expect(
      roomActionDomainForOccurrence(document, catalog, biome, completion.occurrenceId)?.occurrence
        .roomActions.order,
    ).toEqual(withItemContents(document, completion, [fountain, rack, purchase]));
    for (const order of [
      [rack, fountain, purchase],
      [fountain, rack, purchase],
      [fountain, purchase, rack],
    ]) {
      const assessed = roster(order);
      expect(assessed.valid).toBe(true);
      expect(assessed.rows.find((row) => row.key === roomActionKey(rack))?.participation).toBe(
        'optional',
      );
      // Doors open once the fountain resolves, whatever the rack's position.
      expect(
        assessed.checkpoints.find((checkpoint) => checkpoint.checkpointKey === 'exitUsable')
          ?.afterRank,
      ).toBe(order.indexOf(fountain) + 1);
    }
    expect(
      roster([rack, fountain, purchase]).rows.find((row) => row.key === roomActionKey(rack))
        ?.window,
    ).toEqual({ kind: 'standard', phase: 'afterCombat' });
    expect(
      roster([fountain, purchase, rack]).rows.find((row) => row.key === roomActionKey(rack))
        ?.window,
    ).toEqual({ kind: 'postOutgoing' });
    // The Well still unlocks only with the doors.
    expect(roster([purchase, fountain, rack]).valid).toBe(false);
    expect(
      roster([fountain, purchase, rack]).proposals.filter(
        (proposal) =>
          proposal.kind === 'move' &&
          proposal.reference.kind === 'interactKeepsakeRack' &&
          proposal.structurallyAuthorable,
      ),
    ).toHaveLength(2);
    // The rack is an optional row like any other: removable, and insertable when absent.
    expect(
      roster([fountain, purchase, rack]).proposals.some(
        (proposal) => proposal.kind === 'remove' && proposal.reference.kind === rack.kind,
      ),
    ).toBe(true);
    const current = roomActionDomainForOccurrence(
      document,
      catalog,
      biome,
      completion.occurrenceId,
    )!;
    expect(
      assembleRoomActionRoster({
        owner: completion,
        order: [fountain, purchase],
        contributions: current.domain.contributions,
        lifecycleStructure: current.domain.lifecycleStructure,
      }).proposals.some(
        (proposal) => proposal.kind === 'insert' && proposal.reference.kind === rack.kind,
      ),
    ).toBe(true);
    expect(
      applyProjectCommand(document, catalog, {
        kind: 'MoveRoomAction',
        action: rackAction,
        toIndex: 0,
      }).route?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === completion.occurrenceId,
      )?.roomActions.order,
    ).toEqual(withItemContents(document, completion, [rack, fountain, purchase]));
  });
});

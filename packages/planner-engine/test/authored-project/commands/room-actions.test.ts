import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
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
  createRoomActionAddress,
  createShopOfferAddress,
  createTargetAddress,
  decodeProjectDocument,
  redoProjectHistory,
  roomActionKey,
  undoProjectHistory,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  assembleRoomActionRoster,
  assembleRoomLifecycleTimeline,
  materializeBiomePrefix,
} from '@run-planner/engine/simulation';
import {
  createCompleteFGProject,
  createGoldenFGHProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';

import { createCompleteNProject } from '../support/complete-n-project';
import { gBiome, gProject } from '../support/configured-projects';

const biome = createBiomeAddress('Underworld', 'F');
const occurrenceId = createOccurrenceId('room-actions-start');
const reward: RoomActionReference = {
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'source',
};
const invented: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'invented' };

function action(reference: RoomActionReference) {
  return createRoomActionAddress(biome, occurrenceId, roomActionKey(reference));
}

function unresolvedProject(): ProjectDocument {
  return applyProjectCommand(
    createProjectDocument(catalog, {
      projectId: 'room-actions',
      configuredBiomeCounts: { Underworld: 1 },
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
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, occurrenceId),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
}

function occurrence(document: ProjectDocument) {
  const value = document.routes[0]?.biomes[0]?.topology?.occurrences[0];
  if (value === undefined) throw new Error('missing F start occurrence');
  return value;
}

function entryRoom(document: ProjectDocument) {
  const route = document.routes[0];
  const plan = route?.biomes[0];
  if (route === undefined || plan === undefined) throw new Error('missing F authored biome');
  const room = materializeBiomePrefix(catalog, biome, plan, route.loadout)?.entryRoom;
  if (room === undefined) throw new Error('missing F materialized entry room');
  return room;
}

function withoutRequiredRewardAction(document = project()): ProjectDocument {
  return decodeProjectDocument(
    {
      ...document,
      routes: document.routes.map((route) => ({
        ...route,
        biomes: route.biomes.map((plan) =>
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
      })),
    },
    catalog,
  );
}

describe('room-action commands', () => {
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
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceNemesisRandomEventOutcome',
      event: createNemesisRandomEventAddress(phase),
      value: { kind: 'freeItem' },
      reward: { rewardType: 'ArmorBoost' },
    });
    const eventOccurrence = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
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
      catalog,
      biome: goldenFBiome,
      occurrence: eventOccurrence,
    });
    expect(domain.contributions).toContainEqual(
      expect.objectContaining({
        kind: 'action',
        reference: {
          kind: 'interactAcquisitionEntry',
          siteKey: 'nemesisGenerated:Encounter',
          entryKey: 'result',
        },
        owner: source?.acquisition.owner,
      }),
    );
  });
  it('defaults an active required reference and rejects its direct removal', () => {
    const initial = project();
    const original = occurrence(initial);
    expect(original.roomActions.order).toEqual([reward]);
    expect(() =>
      applyProjectCommand(initial, catalog, {
        kind: 'RemoveRoomAction',
        action: action(reward),
      }),
    ).toThrow('active required room action cannot be removed');
  });

  it('reconciles a normal Reprieve to reward then fountain, while both ranked orders remain Cleanup-valid', () => {
    const reprieveId = createOccurrenceId('room-actions-reprieve');
    let authored = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'room-actions-reprieve',
        configuredBiomeCounts: { Underworld: 1 },
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
    const reprieve = authored.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === reprieveId,
    );
    if (reprieve === undefined) throw new Error('normal Reprieve target is missing');
    const pickup: RoomActionReference = {
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'source',
    };
    const fountain: RoomActionReference = { kind: 'useFountain' };
    expect(reprieve.roomActions.order).toEqual([pickup, fountain]);
    expect(() =>
      applyProjectCommand(authored, catalog, {
        kind: 'RemoveRoomAction',
        action: createRoomActionAddress(biome, reprieveId, roomActionKey(fountain)),
      }),
    ).toThrow('active required room action cannot be removed');

    const reversed = applyProjectCommand(authored, catalog, {
      kind: 'MoveRoomAction',
      action: createRoomActionAddress(biome, reprieveId, roomActionKey(fountain)),
      toIndex: 0,
    });
    const reversedReprieve = reversed.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === reprieveId,
    );
    if (reversedReprieve === undefined) throw new Error('moved Reprieve target is missing');

    for (const candidate of [reprieve, reversedReprieve]) {
      const domain = assembleRoomActionDomain({ catalog, biome, occurrence: candidate });
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
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((plan) => plan.biomeKey === 'H')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'H_Bridge01');
    if (echo === undefined) throw new Error('H Echo bridge occurrence is missing');
    expect(activeRoomActionReferences(catalog, goldenHBiome, echo)).not.toContainEqual(fountain);
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
    const fieldsOccurrence = fields.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((plan) => plan.biomeKey === 'H')
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
      inserted.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((plan) => plan.biomeKey === 'H')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === fieldsOccurrenceId)
        ?.roomActions.order,
    ).toContainEqual(optional);
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
    authored = applyProjectCommand(authored, catalog, {
      kind: 'SwitchTargetToAnomaly',
      target: createTargetAddress(gBiome, source, 'exit1'),
    });
    const failed = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceAnomalySuccess',
      occurrence: createOccurrenceAddress(gBiome, targetId),
      success: false,
    });
    const pickup: RoomActionReference = {
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'self',
    };
    const pickupAddress = createRoomActionAddress(gBiome, targetId, roomActionKey(pickup));
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

  it('uses contribution ordinal for parallel required actions activated by one selection', () => {
    const targetId = createOccurrenceId('room-actions-parallel-target');
    const sourceId = createOccurrenceId('room-actions-parallel-source');
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
    const targetOccurrence = (document: ProjectDocument) =>
      document.routes[0]?.biomes[0]?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === targetId,
      );
    expect(targetOccurrence(authored)?.roomActions.order).toEqual([]);

    const selected = applyProjectCommand(authored, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(biome, source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(targetOccurrence(selected)?.roomActions.order).toEqual([
      {
        kind: 'interactIncomingReward',
        producerPoint: 'roomRewardPickup',
        acquisitionRole: 'source',
      },
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
    ]);
  });

  it('records each effective order edit as one semantic history entry', () => {
    const initial = createProjectHistory(unresolvedProject());
    const activated = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, occurrenceId),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });

    expect(activated.past).toHaveLength(1);
    expect(occurrence(activated.present).roomActions.order).toEqual([reward]);
    const undone = undoProjectHistory(activated);
    expect(undone.present).toBe(initial.present);
    expect(redoProjectHistory(undone).present).toBe(activated.present);
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
    expect(roster.issues).toContainEqual({ kind: 'unrankedRequired', reference: reward });
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
    expect(occurrence(restored.present).roomActions.order).toEqual([reward]);
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
      expect.arrayContaining([{ kind: 'unrankedRequired', reference: reward }]),
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
      const occurrence = document.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((plan) => plan.biomeKey === 'H')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === fieldsOccurrenceId);
      if (occurrence === undefined) throw new Error('Fields occurrence is missing');
      return occurrence;
    };
    expect(fields(dormant).roomActions.order).not.toContainEqual(sourceReference);
    expect(fields(dormant).roomActions.order).not.toContainEqual(replacement);
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
    const order = fields(dormant).roomActions.order;
    expect(order).toContainEqual(sourceReference);
    expect(order).toContainEqual(replacement);
    expect(
      order.findIndex((reference) => roomActionKey(reference) === roomActionKey(sourceReference)),
    ).toBeLessThan(
      order.findIndex((reference) => roomActionKey(reference) === roomActionKey(replacement)),
    );
    const domain = assembleRoomActionDomain({
      catalog,
      biome: goldenHBiome,
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
    expect(() =>
      applyProjectCommand(dormant, catalog, {
        kind: 'RemoveRoomAction',
        action: replacementAction,
      }),
    ).toThrow('active required room action cannot be removed');
    const deactivated = applyProjectCommand(dormant, catalog, {
      kind: 'RemoveRoomAction',
      action: sourceAction,
    });
    expect(
      assembleRoomActionDomain({
        catalog,
        biome: goldenHBiome,
        occurrence: fields(deactivated),
      }).contributions,
    ).not.toContainEqual(expect.objectContaining({ kind: 'action', reference: replacement }));
    expect(
      fields(deactivated).acquisitionSites?.[replacement.siteKey]?.pickupEntries,
    ).toHaveProperty(replacement.entryKey, null);
  });

  it('undoes the Artificer required-replacement activation as one semantic edit', () => {
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
    expect(
      history.present.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((plan) => plan.biomeKey === 'H')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === fieldsOccurrenceId)
        ?.roomActions.order,
    ).toContainEqual(replacement);
    expect(undoProjectHistory(history).present).toBe(withSource);
  });

  it('adds encounter and Gorgon contacts atomically without duplicating retained reactivation', () => {
    const combat = createCompleteFGProject();
    const combatOccurrenceId = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: combatOccurrenceId },
      'Encounter',
    );
    const combatOccurrence = (document: ProjectDocument) => {
      const candidate = document.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((plan) => plan.biomeKey === 'F')
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
    expect(combatOccurrence(selected.present).roomActions.order).toContainEqual(encounter);
    expect(undoProjectHistory(selected).present).toBe(combat);

    const reset = applyProjectCommand(selected.present, catalog, {
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
    expect(combatOccurrence(gorgonHistory.present).roomActions.order).toContainEqual(gorgon);
    expect(undoProjectHistory(gorgonHistory).present).toBe(combat);
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
        routes: authored.routes.map((route) => ({
          ...route,
          biomes: route.biomes.map((plan) =>
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
        })),
      },
      catalog,
    );
    const withoutOptional = applyProjectCommand(retained, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(goldenHBiome, fieldsOccurrenceId, roomActionKey(optional)),
    });
    const fieldsOccurrence = (document: ProjectDocument) => {
      const candidate = document.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((plan) => plan.biomeKey === 'H')
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

  it('keeps an Artificer replacement payload dormant while rejecting raw insertion until its source role reactivates', () => {
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
    const active = applyProjectCommand(project(), catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'artificer' },
    });
    expect(occurrence(active).roomActions.order).toContainEqual(replacement);
    let dormant = applyProjectCommand(active, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'normal' },
    });
    expect(occurrence(dormant).acquisitionSites?.[siteKey]?.pickupEntries).toHaveProperty(
      entryKey,
      null,
    );
    dormant = applyProjectCommand(dormant, catalog, {
      kind: 'RemoveRoomAction',
      action: action(replacement),
    });
    expect(() =>
      applyProjectCommand(dormant, catalog, {
        kind: 'InsertRoomAction',
        action: action(replacement),
        reference: replacement,
        index: 0,
      }),
    ).toThrow('room action is not active for this occurrence');

    const restored = applyProjectCommand(dormant, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'artificer' },
    });
    expect(occurrence(restored).roomActions.order).toContainEqual(replacement);
    expect(occurrence(restored).acquisitionSites?.[siteKey]?.pickupEntries).toHaveProperty(
      entryKey,
      null,
    );
  });

  it('preserves authored chronology when room identity is replaced', () => {
    const replaced = applyProjectCommand(project(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, occurrenceId),
      gameName: 'F_Opening02',
    });

    expect(occurrence(replaced).roomActions.order).toEqual([reward]);
  });

  it('owns initial Shop participation through one exact append/remove command', () => {
    const shopId = createOccurrenceId('round-trip-n-preboss');
    const shopBiome = createBiomeAddress('Surface', 'N');
    const major = createShopOfferAddress(shopBiome, shopId, 'MajorNonBoon');
    const minor = createShopOfferAddress(shopBiome, shopId, 'Minor');
    const initial = createCompleteNProject();
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
      history.present.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((candidate) => candidate.biomeKey === 'N')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shopId);
    expect(shopOccurrence()?.roomActions.order).toEqual([
      { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
      { kind: 'interactShopOffer', offerKey: 'Minor' },
    ]);

    history = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: major,
      purchased: false,
    });
    expect(shopOccurrence()?.roomActions.order).toEqual([
      { kind: 'interactShopOffer', offerKey: 'Minor' },
    ]);
    expect(history.past).toHaveLength(3);
    history = undoProjectHistory(history);
    expect(shopOccurrence()?.roomActions.order).toEqual([
      { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
      { kind: 'interactShopOffer', offerKey: 'Minor' },
    ]);
    history = redoProjectHistory(history);
    expect(shopOccurrence()?.roomActions.order).toEqual([
      { kind: 'interactShopOffer', offerKey: 'Minor' },
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

  it('keeps the Postboss rack membership atomic while its ranked action moves in one undo step', () => {
    const completion = createOccurrenceAddress(biome, createOccurrenceId('completion:F:postboss'));
    const rack = { kind: 'interactKeepsakeRack' as const };
    const action = createRoomActionAddress(biome, completion.occurrenceId, roomActionKey(rack));
    const retained = createGoldenFGHProject();
    const replaced = applyProjectCommand(retained, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(completion),
      value: { kind: 'replace', keepsakeKey: 'ForceZeusBoonKeepsake' },
    });
    expect(
      replaced.routes[0]?.biomes[0]?.completionOccurrences.find(
        (occurrence) => occurrence.occurrenceId === completion.occurrenceId,
      )?.roomActions.order,
    ).toEqual([{ kind: 'useFountain' }, rack]);
    expect(() =>
      applyProjectCommand(replaced, catalog, { kind: 'RemoveRoomAction', action }),
    ).toThrow('active required room action cannot be removed');

    const history = applyProjectHistoryCommand(createProjectHistory(replaced), catalog, {
      kind: 'MoveRoomAction',
      action,
      toIndex: 0,
    });
    expect(history.past).toHaveLength(1);
    expect(
      history.present.routes[0]?.biomes[0]?.completionOccurrences.find(
        (occurrence) => occurrence.occurrenceId === completion.occurrenceId,
      )?.roomActions.order,
    ).toEqual([rack, { kind: 'useFountain' }]);
    expect(undoProjectHistory(history).present).toBe(replaced);

    const retainedAgain = applyProjectCommand(replaced, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(completion),
      value: { kind: 'retain' },
    });
    expect(
      retainedAgain.routes[0]?.biomes[0]?.completionOccurrences.find(
        (occurrence) => occurrence.occurrenceId === completion.occurrenceId,
      )?.roomActions.order,
    ).toEqual([{ kind: 'useFountain' }]);
  });
});

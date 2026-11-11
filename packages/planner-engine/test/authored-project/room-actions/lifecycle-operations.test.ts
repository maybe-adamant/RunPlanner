import {
  applyProjectCommand,
  createBiomeAddress,
  createProjectDocument,
  createStartingRewardAddress,
  resolveEntryDeclaration,
  resolveEntryRoom,
  roomActionDomainForOccurrence,
  roomLifecycleOperations,
  type ResolvedRoutePosition,
} from '@run-planner/engine/authored-project';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

function entryOperations(routeKey: string, gameName: string, isFirst: boolean) {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) throw new Error(`missing room ${gameName}`);
  const entry = resolveEntryRoom(
    catalog,
    room,
    { routeKey, isFirst } as ResolvedRoutePosition,
    true,
  );
  const profile = catalog.roomLifecycleProfiles.byKey[entry.lifecycleProfileKey ?? ''];
  if (profile === undefined) throw new Error(`${gameName} resolved no lifecycle profile`);
  return {
    profileKey: profile.key,
    encounters: entry.declaration.encounterSlotBindings.map((binding) =>
      binding.kind === 'fixed' ? binding.encounterDefinitionKey : binding.encounterSetKey,
    ),
    operations: roomLifecycleOperations(catalog, profile, entry.declaration).map((operation) =>
      operation.kind === 'advanceProducer' ? `advanceProducer ${operation.point}` : operation.kind,
    ),
  };
}

function operations(profileKey: string, room: RoomDeclaration) {
  const profile = catalog.roomLifecycleProfiles.byKey[profileKey];
  if (profile === undefined) throw new Error(`missing profile ${profileKey}`);
  return roomLifecycleOperations(catalog, profile, room).map((operation) =>
    operation.kind === 'advanceProducer' ? `advanceProducer ${operation.point}` : operation.kind,
  );
}

describe('room lifecycle operations', () => {
  it('takes the room reward before combat where the encounter is gated on it', () => {
    expect(entryOperations('Underworld', 'F_Opening01', true)).toEqual({
      profileKey: 'OpeningRewardRoom',
      encounters: ['OpeningGeneratedF'],
      operations: [
        'prepareRoom',
        'enterRoom',
        'advanceProducer roomRewardPickup',
        'startEncounter',
        'completeEncounter',
        'generateOutgoingBatch',
        'commitRoom',
        'exitRoom',
      ],
    });
  });

  it("spawns a Dream start's reward after its empty encounter", () => {
    expect(entryOperations('Dream', 'P_Intro', true)).toEqual({
      profileKey: 'OpeningRewardRoom',
      encounters: ['PIntroDreamRunEmpty'],
      operations: [
        'prepareRoom',
        'enterRoom',
        'startEncounter',
        'completeEncounter',
        'advanceProducer roomRewardPickup',
        'generateOutgoingBatch',
        'commitRoom',
        'exitRoom',
      ],
    });
  });

  it("waits for a Dream start's reward only after its empty encounter", () => {
    let project = createProjectDocument(catalog, {
      projectId: 'dream-p-start',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['P', 'Q', 'F', 'N'],
      configuredBiomeCount: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Dream'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const topology = project.route.biomes[0]?.topology;
    if (topology === null || topology === undefined) throw new Error('missing Dream P topology');
    const start = roomActionDomainForOccurrence(
      project,
      catalog,
      createBiomeAddress('Dream', 'P'),
      topology.startOccurrenceId,
    );
    expect(start?.occurrence.gameName).toBe('P_Intro');
    expect(
      start?.domain.contributions.flatMap((entry) =>
        entry.kind === 'action' && entry.reference.kind === 'interactIncomingReward'
          ? [entry.window]
          : [],
      ),
    ).toEqual([{ kind: 'standard', phase: 'afterCombat' }]);
  });

  it("composes a fresh file's first rooms from their route-resolved encounters", () => {
    expect(entryOperations('FreshFile', 'F_Opening01', true)).toEqual({
      profileKey: 'RewardlessCombatRoom',
      encounters: ['OpeningEmpty'],
      operations: [
        'prepareRoom',
        'enterRoom',
        'startEncounter',
        'completeEncounter',
        'generateOutgoingBatch',
        'commitRoom',
        'exitRoom',
      ],
    });
    const combat = catalog.rooms.byKey.F_Combat01;
    if (combat === undefined) throw new Error('missing F_Combat01');
    const routed = resolveEntryDeclaration(combat, { routeKey: 'FreshFile', isFirst: true });
    expect(routed.encounterSlotBindings).toEqual([
      { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'FIntroFight' },
    ]);
    expect(operations('StandardRewardRoom', routed)).toEqual([
      'prepareRoom',
      'enterRoom',
      'advanceProducer beforeCombat',
      'startEncounter',
      'completeEncounter',
      'advanceProducer afterCombat',
      'advanceProducer roomRewardPickup',
      'generateOutgoingBatch',
      'commitRoom',
      'exitRoom',
    ]);
  });

  it('keeps a Devotion choice before combat and the room reward points after it', () => {
    const room = catalog.rooms.byKey.O_Devotion01;
    const standard = catalog.rooms.byKey.F_Combat02;
    if (room === undefined || standard === undefined) throw new Error('missing Devotion rooms');
    expect(operations('DevotionRoom', room)).toEqual([
      'prepareRoom',
      'enterRoom',
      'advanceProducer beforeCombat',
      'startEncounter',
      'completeEncounter',
      'advanceProducer afterCombat',
      'generateOutgoingBatch',
      'commitRoom',
      'exitRoom',
    ]);
    expect(operations('StandardRewardRoom', standard)).toEqual([
      'prepareRoom',
      'enterRoom',
      'advanceProducer beforeCombat',
      'startEncounter',
      'completeEncounter',
      'advanceProducer afterCombat',
      'advanceProducer roomRewardPickup',
      'generateOutgoingBatch',
      'commitRoom',
      'exitRoom',
    ]);
  });

  it('runs the reward after a Soul Pylon completes', () => {
    const room = catalog.rooms.byKey.N_Combat01;
    if (room === undefined) throw new Error('missing Ephyra room');
    expect(operations('EphyraMainRoom', room)).toEqual([
      'prepareRoom',
      'enterRoom',
      'spawnRequiredObjects',
      'advanceProducer beforeCombat',
      'startEncounter',
      'completeEncounter',
      'completeRequiredObjects',
      'advanceProducer afterCombat',
      'advanceProducer roomRewardPickup',
      'generateOutgoingBatch',
      'commitRoom',
      'exitRoom',
    ]);
  });

  it("runs a Ship room's phases as wheel phases and Fields cages as a sequence", () => {
    const ship = catalog.rooms.byKey.O_Combat01;
    const fields = catalog.rooms.byKey.H_Combat01;
    if (ship === undefined || fields === undefined) throw new Error('missing O or H room');
    expect(operations('ShipCombatRoom', ship)).toContain('runRewardEncounterSequence');
    expect(operations('FieldsCombatRoom', fields)).toContain('runEncounterSequence');
  });
});

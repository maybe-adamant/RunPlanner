import {
  applyProjectCommand,
  createBiomeAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createOccurrenceId,
  createProjectDocument,
  encodeProjectDocument,
  evaluateHubCompleteness,
  HubMaterializationContractError,
  materializeHubBiome,
  semanticAddressKey,
  type CompleteHubCompletenessResult,
  type HubBiomePlan,
  type ProjectDocument,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const biome = createBiomeAddress('Surface', 'N');
const fixedOccurrenceIds = {
  opening: createOccurrenceId('n-materialized-opening'),
  preHub: createOccurrenceId('n-materialized-prehub'),
  preboss: createOccurrenceId('n-materialized-preboss'),
};

function plan(project: ProjectDocument): HubBiomePlan {
  const result = project.routes.find((route) => route.routeKey === 'Surface')?.biomes[0];
  if (result?.kind !== 'HubBiome') {
    throw new Error('fixture lost N Hub plan');
  }
  return result;
}

function emptyProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'n-materialization',
    name: 'N Materialization',
    configuredBiomeCounts: { Surface: 1 },
  });
}

function startedProject(): ProjectDocument {
  return applyProjectCommand(emptyProject(), catalog, {
    kind: 'CreateHubTopology',
    biome,
    fixedOccurrenceIds,
  });
}

function openSlots(project: ProjectDocument, slotKeys: readonly string[]): ProjectDocument {
  return slotKeys.reduce(
    (current, hubSlotKey) =>
      applyProjectCommand(current, catalog, {
        kind: 'OpenHubSlot',
        slot: createHubSlotAddress(biome, hubSlotKey),
        occurrenceId: createOccurrenceId(`n-materialized-${hubSlotKey}`),
      }),
    project,
  );
}

function appendVisits(project: ProjectDocument, slotKeys: readonly string[]): ProjectDocument {
  return slotKeys.reduce(
    (current, hubSlotKey, index) =>
      applyProjectCommand(current, catalog, {
        kind: 'AppendHubVisit',
        visit: createHubVisitAddress(biome, index + 1),
        hubSlotKey,
      }),
    project,
  );
}

function generateSideRoom(
  project: ProjectDocument,
  parentSlotKey: string,
  sideSlotKey: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceSideRoomGeneration',
    sideRoom: createLocalChildAddress(
      biome,
      createOccurrenceId(`n-materialized-${parentSlotKey}`),
      'sideRooms',
      sideSlotKey,
    ),
    generation: 'generated',
  });
}

function enterSideRooms(
  project: ProjectDocument,
  parentSlotKey: string,
  enteredSlotKeys: readonly string[],
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceSideRoomEntryOrder',
    group: createLocalChildGroupAddress(
      biome,
      createOccurrenceId(`n-materialized-${parentSlotKey}`),
      'sideRooms',
    ),
    enteredSlotKeys,
  });
}

function representativeProject(): ProjectDocument {
  const physicalOpenOrder = [
    'combat01',
    'combat02',
    'combat03',
    'combat05',
    'combat09',
    'combat10',
    'combat11',
    'combat23',
    'miniBoss01',
  ];
  let project = openSlots(startedProject(), [...physicalOpenOrder].reverse());
  project = appendVisits(project, [
    'combat05',
    'miniBoss01',
    'combat02',
    'combat11',
    'combat23',
    'combat09',
  ]);
  for (const sideSlotKey of ['sideDoor1', 'sideDoor2', 'sideDoor3']) {
    project = generateSideRoom(project, 'combat05', sideSlotKey);
  }
  project = enterSideRooms(project, 'combat05', ['sideDoor2', 'sideDoor1']);
  project = generateSideRoom(project, 'combat02', 'sideDoor1');
  project = enterSideRooms(project, 'combat02', ['sideDoor1']);
  project = generateSideRoom(project, 'combat11', 'sideDoor1');
  return enterSideRooms(project, 'combat11', ['sideDoor1']);
}

function complete(project: ProjectDocument): CompleteHubCompletenessResult {
  const result = evaluateHubCompleteness(catalog, biome, plan(project));
  if (result.completion !== 'complete') {
    throw new Error(`fixture is incomplete: ${result.findings.map((finding) => finding.code)}`);
  }
  return result;
}

describe('canonical N Hub materialization', () => {
  it('requires complete Hub authorship at the public boundary', () => {
    const incomplete = evaluateHubCompleteness(catalog, biome, plan(emptyProject()));

    expect(() =>
      materializeHubBiome(catalog, biome, incomplete as unknown as CompleteHubCompletenessResult),
    ).toThrowError(
      new HubMaterializationContractError('Hub materialization requires a complete biome result'),
    );
  });

  it('separates physical board order from visit order and reuses canonical room entities', () => {
    const project = representativeProject();
    const encodedBefore = encodeProjectDocument(project);
    const snapshot = materializeHubBiome(catalog, biome, complete(project));

    expect(snapshot).toMatchObject({
      kind: 'HubBiome',
      routeKey: 'Surface',
      biomeKey: 'N',
      biomeState: {},
    });
    expect(snapshot.entryRooms).toMatchObject([
      {
        occurrenceId: fixedOccurrenceIds.opening,
        gameName: 'N_Opening01',
        lifecycleProfileKey: 'EphyraOpeningRoom',
        entered: true,
        incomingReward: { resolvedStoreKey: 'RunProgress' },
      },
      {
        occurrenceId: fixedOccurrenceIds.preHub,
        gameName: 'N_PreHub01',
        lifecycleProfileKey: 'StandardRewardRoom',
        entered: true,
        incomingReward: { resolvedStoreKey: 'RunProgress' },
      },
    ]);
    expect(snapshot.hubBoard.room).toMatchObject({
      kind: 'hub',
      gameName: 'N_Hub',
      lifecycleProfileKey: 'EphyraHubRoom',
      entered: true,
    });
    expect(semanticAddressKey(snapshot.hubBoard.room.origin)).not.toBe(
      semanticAddressKey(snapshot.hubBoard.origin),
    );
    expect(snapshot.hubBoard.targets.map((target) => target.hubSlotKey)).toEqual([
      'combat01',
      'combat02',
      'combat03',
      'combat05',
      'combat09',
      'combat10',
      'combat11',
      'combat23',
      'miniBoss01',
    ]);
    expect(snapshot.visits.map((visit) => visit.target.hubSlotKey)).toEqual([
      'combat05',
      'miniBoss01',
      'combat02',
      'combat11',
      'combat23',
      'combat09',
    ]);
    for (const visit of snapshot.visits) {
      const boardTarget = snapshot.hubBoard.targets.find(
        (target) => target.hubSlotKey === visit.target.hubSlotKey,
      );
      expect(visit.target).toBe(boardTarget);
      expect(visit.target.room.entered).toBe(true);
      expect(visit.hubRestore.room).toEqual({
        origin: snapshot.hubBoard.room.origin,
        gameName: 'N_Hub',
      });
    }
    expect(
      snapshot.hubBoard.targets.find((target) => target.hubSlotKey === 'combat10')?.room.entered,
    ).toBe(false);
    expect(new Set(snapshot.hubBoard.targets.map((target) => target.room.occurrenceId)).size).toBe(
      9,
    );
    expect(encodeProjectDocument(project)).toBe(encodedBefore);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.hubBoard.targets)).toBe(true);
  });

  it('projects complete local slots, semantic entry order, and parent restores', () => {
    const snapshot = materializeHubBiome(catalog, biome, complete(representativeProject()));
    const combat05 = snapshot.visits[0];
    if (combat05 === undefined) {
      throw new Error('fixture lost first Hub visit');
    }

    expect(combat05.localSlots.map((slot) => slot.slotKey)).toEqual([
      'sideDoor1',
      'sideDoor2',
      'sideDoor3',
    ]);
    expect(combat05.localSlots.map((slot) => slot.availabilityRank)).toEqual([1, 2, 3]);
    expect(combat05.localSlots.every((slot) => slot.generation === 'generated')).toBe(true);
    expect(combat05.enteredLocalRooms.map((room) => room.slotKey)).toEqual([
      'sideDoor2',
      'sideDoor1',
    ]);
    expect(combat05.localSlots[2]).toMatchObject({
      slotKey: 'sideDoor3',
      generation: 'generated',
      enteredOrdinal: null,
      entered: false,
      incomingReward: { resolvedStoreKey: 'SubRoomRewards' },
    });
    expect(combat05.parentRestores).toHaveLength(2);
    expect(combat05.parentRestores.map((restore) => restore.after)).toEqual(
      combat05.enteredLocalRooms.map((room) => room.origin),
    );
    expect(combat05.parentRestores[0]?.room).toEqual({
      origin: combat05.target.room.origin,
      occurrenceId: combat05.target.room.occurrenceId,
      gameName: 'N_Combat05',
    });

    const combat02 = snapshot.visits.find((visit) => visit.target.hubSlotKey === 'combat02');
    const combat11 = snapshot.visits.find((visit) => visit.target.hubSlotKey === 'combat11');
    expect(combat02?.localSlots.map((slot) => slot.slotKey)).toEqual(['sideDoor1', 'sideDoor2']);
    expect(combat02?.localSlots.map((slot) => slot.availabilityRank)).toEqual([2, 1]);
    expect(combat02?.localSlots[0]?.gameName).toBe('N_Sub01');
    expect(combat11?.localSlots[0]?.gameName).toBe('N_Sub01');
    expect(combat02?.localSlots[0]?.origin).not.toEqual(combat11?.localSlots[0]?.origin);
    expect(combat02?.localSlots[1]).toMatchObject({
      generation: 'notGenerated',
      entered: false,
    });
    expect(combat02?.localSlots[1]?.incomingReward).toBeUndefined();
    expect(semanticAddressKey(combat02!.localSlots[0]!.origin)).toBe(
      '["localChild","Surface","N","n-materialized-combat02","sideRooms","sideDoor1"]',
    );
  });

  it('materializes the fixed WorldShop and derived completion without authored copies', () => {
    const snapshot = materializeHubBiome(catalog, biome, complete(representativeProject()));

    expect(snapshot.terminalEntry).toMatchObject({
      occurrenceId: fixedOccurrenceIds.preboss,
      gameName: 'N_PreBoss01',
      lifecycleProfileKey: 'TerminalWorldShopRoom',
      entered: true,
      entryState: { kind: 'shop', profileKey: 'WorldShop' },
    });
    expect(snapshot.completionRooms).toMatchObject([
      { kind: 'completion', role: 'boss', gameName: 'N_Boss01', lifecycleProfileKey: 'BossRoom' },
      {
        kind: 'completion',
        role: 'postboss',
        gameName: 'N_PostBoss01',
        lifecycleProfileKey: 'PostBossRoom',
      },
    ]);
    expect(snapshot.completionRooms.every((room) => room.entered)).toBe(true);
    expect(
      snapshot.hubBoard.targets.some(
        (target) => target.room.occurrenceId === fixedOccurrenceIds.preboss,
      ),
    ).toBe(false);
  });

  it('materializes structurally complete invalid open sets for selected validation', () => {
    const open = [
      ...Array.from({ length: 8 }, (_, index) => `combat${String(index + 1).padStart(2, '0')}`),
      'miniBoss01',
      'miniBoss02',
    ];
    const project = appendVisits(openSlots(startedProject(), open), open.slice(0, 6));
    const snapshot = materializeHubBiome(catalog, biome, complete(project));

    expect(snapshot.hubBoard.targets.map((target) => target.hubSlotKey)).toContain('miniBoss01');
    expect(snapshot.hubBoard.targets.map((target) => target.hubSlotKey)).toContain('miniBoss02');
  });
});

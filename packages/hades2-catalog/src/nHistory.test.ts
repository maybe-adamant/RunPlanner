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
  semanticAddressKey,
  type HubBiomePlan,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeNHistory,
  evaluateHubCompleteness,
  foldHubHistoryEvents,
  materializeHubBiome,
  type CompleteHubCompletenessResult,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const biome = createBiomeAddress('Surface', 'N');
const fixedOccurrenceIds = {
  opening: createOccurrenceId('n-history-opening'),
  preHub: createOccurrenceId('n-history-prehub'),
  preboss: createOccurrenceId('n-history-preboss'),
};

function plan(project: ProjectDocument): HubBiomePlan {
  const result = project.routes.find((route) => route.routeKey === 'Surface')?.biomes[0];
  if (result?.kind !== 'HubBiome') {
    throw new Error('fixture lost N Hub plan');
  }
  return result;
}

function startedProject(): ProjectDocument {
  return applyProjectCommand(
    createProjectDocument(catalog, {
      projectId: 'n-history',
      name: 'N History',
      configuredBiomeCounts: { Surface: 1 },
    }),
    catalog,
    { kind: 'CreateHubTopology', biome, fixedOccurrenceIds },
  );
}

function openSlots(project: ProjectDocument, slotKeys: readonly string[]): ProjectDocument {
  return slotKeys.reduce(
    (current, hubSlotKey) =>
      applyProjectCommand(current, catalog, {
        kind: 'OpenHubSlot',
        slot: createHubSlotAddress(biome, hubSlotKey),
        occurrenceId: createOccurrenceId(`n-history-${hubSlotKey}`),
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
      createOccurrenceId(`n-history-${parentSlotKey}`),
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
      createOccurrenceId(`n-history-${parentSlotKey}`),
      'sideRooms',
    ),
    enteredSlotKeys,
  });
}

function representativeProject(): ProjectDocument {
  let project = openSlots(startedProject(), [
    'combat11',
    'combat10',
    'combat09',
    'combat05',
    'combat03',
    'combat02',
    'combat01',
    'miniBoss01',
    'combat23',
  ]);
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
  project = generateSideRoom(project, 'combat02', 'sideDoor2');
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

function fixture() {
  const snapshot = materializeHubBiome(catalog, biome, complete(representativeProject()));
  return { snapshot, history: composeNHistory(catalog, snapshot) };
}

describe('N Hub lifecycle composition and history', () => {
  it('creates the persistent board and generated local rooms once in physical order', () => {
    const { snapshot, history } = fixture();
    const hubView = history.rooms.find(
      (room) =>
        semanticAddressKey(room.origin) === semanticAddressKey(snapshot.hubBoard.room.origin),
    );
    const combat02 = snapshot.visits.find((visit) => visit.target.hubSlotKey === 'combat02');
    if (hubView === undefined || combat02 === undefined) {
      throw new Error('fixture lost Hub history structure');
    }

    expect(hubView.targetGenerations.map((view) => semanticAddressKey(view.targetOrigin))).toEqual(
      snapshot.hubBoard.targets.map((target) => semanticAddressKey(target.origin)),
    );
    expect(
      history.ledgers.roomCreations
        .filter(
          (event) =>
            event.source === 'localChild' &&
            semanticAddressKey(event.parentOrigin) ===
              semanticAddressKey(combat02.target.room.origin),
        )
        .map((event) => event.gameName),
    ).toEqual(['N_Sub03', 'N_Sub01']);
    expect(history.ledgers.roomCreations).toHaveLength(21);
    expect(history.ledgers.counters.numSubRoomsSpawned).toBe(6);
    expect(
      history.ledgers.roomCreations.filter((event) => event.gameName === 'N_PreHub01'),
    ).toEqual([expect.objectContaining({ source: 'layoutEntry', picked: true })]);
    expect(
      history.ledgers.roomCreations.filter(
        (event) =>
          semanticAddressKey(event.origin) === semanticAddressKey(snapshot.hubBoard.room.origin),
      ),
    ).toHaveLength(1);
  });

  it('spawns and completes one required Soul Pylon around every entered main encounter', () => {
    const { snapshot, history } = fixture();
    expect(history.ledgers.requiredObjectSpawns).toHaveLength(6);
    expect(history.ledgers.requiredObjectCompletions).toHaveLength(6);
    expect(history.ledgers.counters).toMatchObject({
      soulPylonsSpawned: 6,
      soulPylonsCompleted: 6,
      biomeEncounterDepth: 0,
      routeEncounterDepth: 8,
    });

    const firstMain = snapshot.visits[0]!.target.room;
    const kinds = history.events
      .filter(
        (event) =>
          'origin' in event &&
          semanticAddressKey(event.origin) === semanticAddressKey(firstMain.origin),
      )
      .map((event) => event.kind);
    const orderedKinds = [
      'roomEntered',
      'requiredObjectSpawned',
      'encounterStarted',
      'encounterCompleted',
      'requiredObjectCompleted',
      'producerRoleAdvanced',
      'outgoingGenerationCheckpoint',
    ] as const;
    const positions = orderedKinds.map((kind) => kinds.indexOf(kind));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it('records parent and Hub restores without recreating or replaying encounters', () => {
    const { snapshot, history } = fixture();
    const firstMain = snapshot.visits[0]!.target.room;
    const mainKey = semanticAddressKey(firstMain.origin);
    const hubKey = semanticAddressKey(snapshot.hubBoard.room.origin);

    expect(history.ledgers.roomRestores.map((restore) => restore.restoreKind)).toEqual([
      'parent',
      'parent',
      'hub',
      'hub',
      'parent',
      'hub',
      'parent',
      'hub',
      'hub',
      'hub',
    ]);
    expect(
      history.ledgers.roomAppearances.filter(
        (entry) => semanticAddressKey(entry.origin) === mainKey,
      ),
    ).toHaveLength(3);
    expect(
      history.ledgers.roomAppearances.filter(
        (entry) => semanticAddressKey(entry.origin) === hubKey,
      ),
    ).toHaveLength(7);
    expect(
      history.ledgers.encounterStarts.filter(
        (entry) => semanticAddressKey(entry.origin) === mainKey,
      ),
    ).toHaveLength(1);
    expect(
      history.ledgers.roomCreations.filter((entry) => semanticAddressKey(entry.origin) === mainKey),
    ).toHaveLength(1);
  });

  it('folds exact depth, history ordinal, terminal, and completion timing deterministically', () => {
    const { history } = fixture();

    expect(history.ledgers.roomAppearances.map((entry) => entry.gameName)).toEqual([
      'N_Opening01',
      'N_PreHub01',
      'N_Hub',
      'N_Combat05',
      'N_Sub07',
      'N_Combat05',
      'N_Sub02',
      'N_Combat05',
      'N_Hub',
      'N_MiniBoss01',
      'N_Hub',
      'N_Combat02',
      'N_Sub01',
      'N_Combat02',
      'N_Hub',
      'N_Combat11',
      'N_Sub01',
      'N_Combat11',
      'N_Hub',
      'N_Combat23',
      'N_Hub',
      'N_Combat09',
      'N_Hub',
      'N_PreBoss01',
      'N_Boss01',
      'N_PostBoss01',
    ]);
    expect(history.biomeCompletion.ledgers.counters).toMatchObject({
      biomeDepthCache: 24,
      biomeEncounterDepth: 8,
      routeEncounterDepth: 8,
      roomHistoryOrdinal: 26,
      numSubRoomsSpawned: 6,
      soulPylonsSpawned: 6,
      soulPylonsCompleted: 6,
    });
    expect(history.afterTransition.ledgers.counters).toMatchObject({
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
      routeEncounterDepth: 8,
      roomHistoryOrdinal: 26,
    });
    expect(foldHubHistoryEvents(history.events)).toEqual(history);
    expect(history.events.map((event) => event.sequence)).toEqual(
      history.events.map((_, index) => index + 1),
    );
    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history.ledgers.roomRestores)).toBe(true);
  });

  it('does not mutate authored or canonical inputs while composing history', () => {
    const project = representativeProject();
    const encodedBefore = encodeProjectDocument(project);
    const snapshot = materializeHubBiome(catalog, biome, complete(project));
    const canonicalBefore = JSON.stringify(snapshot);

    composeNHistory(catalog, snapshot);

    expect(encodeProjectDocument(project)).toBe(encodedBefore);
    expect(JSON.stringify(snapshot)).toBe(canonicalBefore);
  });
});

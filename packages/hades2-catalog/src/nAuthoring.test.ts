import {
  applyProjectCommand,
  createBiomeAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createEmptyProjectDocument,
  createRouteAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  type HubBiomePlan,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { evaluateHubCompleteness } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const biome = createBiomeAddress('Surface', 'N');
const fixedOccurrenceIds = {
  opening: createOccurrenceId('n-opening'),
  preHub: createOccurrenceId('n-prehub'),
  preboss: createOccurrenceId('n-preboss'),
};

function nPlan(project: ProjectDocument): HubBiomePlan {
  const plan = project.routes.find((route) => route.routeKey === 'Surface')?.biomes[0];
  if (plan?.kind !== 'HubBiome') {
    throw new Error('expected configured N HubBiome plan');
  }
  return plan;
}

function emptyNProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'n-authoring',
    name: 'N Authoring',
    configuredBiomeCounts: { Surface: 1 },
  });
}

function startedNProject(): ProjectDocument {
  return applyProjectCommand(emptyNProject(), catalog, {
    kind: 'CreateHubTopology',
    biome,
    fixedOccurrenceIds,
  });
}

function openSlot(project: ProjectDocument, hubSlotKey: string): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'OpenHubSlot',
    slot: createHubSlotAddress(biome, hubSlotKey),
    occurrenceId: createOccurrenceId(`n-${hubSlotKey}`),
  });
}

function openSlots(project: ProjectDocument, hubSlotKeys: readonly string[]): ProjectDocument {
  return hubSlotKeys.reduce(openSlot, project);
}

function appendVisits(project: ProjectDocument, hubSlotKeys: readonly string[]): ProjectDocument {
  return hubSlotKeys.reduce(
    (current, hubSlotKey, index) =>
      applyProjectCommand(current, catalog, {
        kind: 'AppendHubVisit',
        visit: createHubVisitAddress(biome, index + 1),
        hubSlotKey,
      }),
    project,
  );
}

describe('N Hub authorship', () => {
  it('initializes the Surface prefix as a HubBiome plan', () => {
    const project = emptyNProject();

    expect(nPlan(project)).toEqual({ kind: 'HubBiome', biomeKey: 'N', topology: null });
    expect(evaluateHubCompleteness(catalog, biome, nPlan(project))).toMatchObject({
      completion: 'incomplete',
      findings: [{ code: 'biomeTopologyMissing', origin: biome }],
    });
  });

  it('adds and removes N through the ordinary route-prefix command', () => {
    const empty = createEmptyProjectDocument(catalog, {
      projectId: 'n-route-prefix',
      name: 'N Route Prefix',
    });
    const configured = applyProjectCommand(empty, catalog, {
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Surface'),
      configuredBiomeCount: 1,
    });
    expect(nPlan(configured)).toEqual({ kind: 'HubBiome', biomeKey: 'N', topology: null });

    const cleared = applyProjectCommand(configured, catalog, {
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Surface'),
      configuredBiomeCount: 0,
    });
    expect(cleared.routes.find((route) => route.routeKey === 'Surface')?.biomes).toEqual([]);
  });

  it('creates exact fixed authored leaves and round trips the normalized Hub shape', () => {
    const project = startedNProject();
    const topology = nPlan(project).topology;

    expect(topology?.fixedRooms).toEqual([
      { fixedSlotKey: 'opening', occurrenceId: fixedOccurrenceIds.opening },
      { fixedSlotKey: 'preHub', occurrenceId: fixedOccurrenceIds.preHub },
      { fixedSlotKey: 'preboss', occurrenceId: fixedOccurrenceIds.preboss },
    ]);
    expect(
      topology?.occurrences.map(({ occurrenceId, gameName }) => ({ occurrenceId, gameName })),
    ).toEqual([
      { occurrenceId: fixedOccurrenceIds.opening, gameName: 'N_Opening01' },
      { occurrenceId: fixedOccurrenceIds.preHub, gameName: 'N_PreHub01' },
      { occurrenceId: fixedOccurrenceIds.preboss, gameName: 'N_PreBoss01' },
    ]);
    const preboss = topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === fixedOccurrenceIds.preboss,
    );
    expect(preboss?.state.kind).toBe('shop');
    expect(preboss?.state.kind === 'shop' ? preboss.state.shop?.profileKey : undefined).toBe(
      'WorldShop',
    );

    const encoded = encodeProjectDocument(project);
    expect(decodeProjectDocument(JSON.parse(encoded), catalog)).toEqual(project);
  });

  it('separates open membership from six ordered visits and reaches completeness', () => {
    const open = Array.from(
      { length: 9 },
      (_, index) => `combat${String(index + 1).padStart(2, '0')}`,
    );
    let project = openSlots(startedNProject(), [...open].reverse());
    const partial = evaluateHubCompleteness(catalog, biome, nPlan(project));
    expect(partial).toMatchObject({
      completion: 'incomplete',
      findings: [{ code: 'hubVisitOrderIncomplete' }],
    });

    project = appendVisits(project, open.slice(0, 6));
    const plan = nPlan(project);
    expect(plan.topology?.openTargets.map((target) => target.hubSlotKey)).toEqual(open);
    expect(plan.topology?.visitOrder).toEqual(open.slice(0, 6));
    expect(evaluateHubCompleteness(catalog, biome, plan)).toEqual({
      completion: 'complete',
      topology: plan.topology,
      findings: [],
    });
  });

  it('retains room leaves while visits are replaced and protects referenced open slots', () => {
    const open = Array.from(
      { length: 9 },
      (_, index) => `combat${String(index + 1).padStart(2, '0')}`,
    );
    let project = appendVisits(openSlots(startedNProject(), open), open.slice(0, 6));
    const before = nPlan(project).topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === createOccurrenceId('n-combat01'),
    );

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CloseHubSlot',
        slot: createHubSlotAddress(biome, 'combat01'),
      }),
    ).toThrowError(
      new ProjectCommandContractError(
        'CloseHubSlot',
        createHubSlotAddress(biome, 'combat01'),
        'replace or remove the referenced Hub visit before closing this slot',
      ),
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHubVisit',
      visit: createHubVisitAddress(biome, 1),
      hubSlotKey: 'combat07',
    });
    expect(
      nPlan(project).topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === createOccurrenceId('n-combat01'),
      ),
    ).toEqual(before);
    project = applyProjectCommand(project, catalog, {
      kind: 'CloseHubSlot',
      slot: createHubSlotAddress(biome, 'combat01'),
    });
    expect(nPlan(project).topology?.openTargets).toHaveLength(8);
  });

  it('keeps supported-but-invalid Hub constraints outside structural completeness', () => {
    const open = [
      ...Array.from({ length: 8 }, (_, index) => `combat${String(index + 1).padStart(2, '0')}`),
      'miniBoss01',
      'miniBoss02',
    ];
    const project = appendVisits(openSlots(startedNProject(), open), open.slice(0, 6));

    expect(evaluateHubCompleteness(catalog, biome, nPlan(project)).completion).toBe('complete');
  });

  it('authors side generation and atomically replaces exact entry order', () => {
    let project = openSlot(startedNProject(), 'combat02');
    const occurrenceId = createOccurrenceId('n-combat02');
    for (const slotKey of ['sideDoor1', 'sideDoor2']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceSideRoomGeneration',
        sideRoom: createLocalChildAddress(biome, occurrenceId, 'sideRooms', slotKey),
        generation: 'generated',
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(biome, occurrenceId, 'sideRooms'),
      enteredSlotKeys: ['sideDoor2', 'sideDoor1'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(biome, occurrenceId, 'sideRooms', 'sideDoor1'),
      value: { rewardType: 'MaxHealthDropSmall' },
    });

    const occurrence = nPlan(project).topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === occurrenceId,
    );
    expect(occurrence?.state.kind).toBe('ephyraCombat');
    if (occurrence?.state.kind !== 'ephyraCombat') {
      throw new Error('expected Ephyra combat state');
    }
    expect(occurrence.state.sideRooms.sideDoor1).toMatchObject({
      generation: 'generated',
      enteredOrdinal: 2,
      offer: { rewardType: 'MaxHealthDropSmall' },
    });
    expect(occurrence.state.sideRooms.sideDoor2).toMatchObject({
      generation: 'generated',
      enteredOrdinal: 1,
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceSideRoomGeneration',
        sideRoom: createLocalChildAddress(biome, occurrenceId, 'sideRooms', 'sideDoor1'),
        generation: 'notGenerated',
      }),
    ).toThrowError(/remove the side room from entry order before disabling generation/);

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(biome, occurrenceId, 'sideRooms'),
      enteredSlotKeys: ['sideDoor1', 'sideDoor2'],
    });
    const reordered = nPlan(project).topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === occurrenceId,
    );
    expect(
      reordered?.state.kind === 'ephyraCombat'
        ? Object.values(reordered.state.sideRooms).map((sideRoom) => sideRoom.enteredOrdinal)
        : [],
    ).toEqual([1, 2]);
  });

  it('replaces fixed and Hub incoming rewards without exposing room replacement', () => {
    let project = openSlot(startedNProject(), 'combat02');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, fixedOccurrenceIds.opening),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(biome, createOccurrenceId('n-combat02')),
      value: { rewardType: 'MaxHealthDropBig' },
    });

    expect(
      nPlan(project)
        .topology?.occurrences.map((occurrence) => occurrence.state)
        .slice(0, 2),
    ).toContainEqual({
      kind: 'counted',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      },
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(biome, createOccurrenceId('n-combat02')),
        gameName: 'N_Combat03',
      }),
    ).toThrowError(/ReplaceOccurrenceRoom is not available for HubBiome/);
  });

  it('rejects malformed fixed identity, duplicate visits, and unreferenced occurrences', () => {
    const open = Array.from(
      { length: 9 },
      (_, index) => `combat${String(index + 1).padStart(2, '0')}`,
    );
    const project = appendVisits(openSlots(startedNProject(), open), open.slice(0, 6));
    const raw = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{ biomes: Array<{ topology: Record<string, unknown> }> }>;
    };
    const topology = raw.routes[1]?.biomes[0]?.topology;
    if (topology === undefined) {
      throw new Error('missing serialized N topology');
    }
    const occurrences = topology.occurrences as Array<Record<string, unknown>>;
    occurrences[0] = { ...occurrences[0], gameName: 'N_PreHub01' };
    expect(() => decodeProjectDocument(raw, catalog)).toThrowError(
      new ProjectDocumentContractError(
        '$.routes[1].biomes[0].topology.occurrences[0].gameName',
        'fixed slot requires N_Opening01, received N_PreHub01',
      ),
    );

    const duplicateVisit = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{ biomes: Array<{ topology: { visitOrder: string[] } }> }>;
    };
    duplicateVisit.routes[1]!.biomes[0]!.topology.visitOrder[1] = 'combat01';
    expect(() => decodeProjectDocument(duplicateVisit, catalog)).toThrowError(
      /duplicates Hub visit/,
    );

    const unreferenced = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{
        biomes: Array<{ topology: { occurrences: Array<Record<string, unknown>> } }>;
      }>;
    };
    const unreferencedOccurrences = unreferenced.routes[1]!.biomes[0]!.topology.occurrences;
    unreferencedOccurrences.push({
      ...unreferencedOccurrences[0],
      occurrenceId: 'n-unreferenced',
    });
    expect(() => decodeProjectDocument(unreferenced, catalog)).toThrowError(
      /occurrence n-unreferenced is not referenced by Hub topology/,
    );
  });
});

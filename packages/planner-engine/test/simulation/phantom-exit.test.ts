import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createPhantomExitAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type PhantomExitAddress,
  type PhantomExitState,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  phantomExitSettlementForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type PhantomExitSettlement,
} from '@run-planner/engine/simulation';
import { assembleExecutionProduct, compileExecutionPlan } from '@run-planner/engine/execution-plan';
import { settlePhantomRewardType } from '../../src/simulation/rewards/biome/generation/phantom-exit';
import {
  loadSurfaceNProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';

const exitOf = (occurrenceId: string): PhantomExitAddress =>
  createPhantomExitAddress(nBiome, occurrenceId as never);
const combat05 = exitOf(nOccurrenceId('combat05'));
const combat02 = exitOf(nOccurrenceId('combat02'));
const miniBoss01 = exitOf(nOccurrenceId('miniBoss01'));
const side05 = exitOf(nLocalOccurrenceId('combat05', 'sideDoor2'));
const side02 = exitOf(nLocalOccurrenceId('combat02', 'sideDoor1'));

function pin(
  project: ProjectDocument,
  exit: PhantomExitAddress,
  value: PhantomExitState,
): ProjectDocument {
  return applyProjectCommand(project, catalog, { kind: 'ReplacePhantomExit', exit, value });
}

function settlements(project: ProjectDocument) {
  const assembly = simulateProjectAssembly(catalog, project);
  const at = (exit: PhantomExitAddress): PhantomExitSettlement => {
    const settled = phantomExitSettlementForProjectEvaluationAssembly(assembly, exit);
    if (settled === undefined) throw new Error(`${semanticAddressKey(exit)} was not reached`);
    return settled;
  };
  return { assembly, at };
}

function bagCount(project: ProjectDocument, storeKey: string): number {
  const biome = simulateProjectAssembly(catalog, project).evaluation.route.biomes[0]!;
  if (!('rewards' in biome)) throw new Error('N was not evaluated');
  const bag = biome.rewards.branches[0]!.state.bags[storeKey];
  return bag?.remainingEntryCounts.reduce((sum, count) => sum + count, 0) ?? -1;
}

describe('phantom exits', () => {
  it('authors an unpinned exit on exactly the declared Ephyra rooms', () => {
    const topology = loadSurfaceNProject().route.biomes[0]!.topology!;
    for (const occurrence of topology.occurrences)
      expect(occurrence.phantomExit !== undefined).toBe(
        catalog.rooms.byKey[occurrence.gameName]?.phantomExit !== undefined,
      );
    expect(
      topology.occurrences.find((entry) => entry.gameName === 'N_Combat05')?.phantomExit,
    ).toEqual({ placeholderRoomGameName: null, rewardType: null });
  });

  it('decodes strictly against the declared placeholder set and store', () => {
    const encoded = JSON.parse(encodeProjectDocument(loadSurfaceNProject())) as {
      route: { biomes: { topology: { occurrences: Record<string, unknown>[] } }[] };
    };
    const decodeWith = (gameName: string, edit: (occurrence: Record<string, unknown>) => void) => {
      const copy = structuredClone(encoded);
      const occurrence = copy.route.biomes[0]!.topology.occurrences.find(
        (entry) => entry.gameName === gameName,
      )!;
      edit(occurrence);
      return () => decodeProjectDocument(copy as never, catalog);
    };
    expect(decodeWith('N_Combat05', (room) => delete room.phantomExit)).toThrow(
      'must be an object',
    );
    expect(
      decodeWith('N_PreHub01', (room) => {
        room.phantomExit = { placeholderRoomGameName: null, rewardType: null };
      }),
    ).toThrow('declares no phantom exit');
    const pinned = (value: unknown) =>
      decodeWith('N_Combat05', (room) => {
        room.phantomExit = value;
      });
    expect(pinned({ placeholderRoomGameName: null, rewardType: 'Boon' })).toThrow(
      'a pinned reward requires a pinned placeholder room',
    );
    expect(pinned({ placeholderRoomGameName: 'N_Combat05', rewardType: null })).toThrow(
      'a room is never its own placeholder',
    );
    expect(pinned({ placeholderRoomGameName: 'N_Sub01', rewardType: null })).toThrow(
      'N_Sub01 is not a N placeholder',
    );
    expect(pinned({ placeholderRoomGameName: 'N_Boss01', rewardType: null })).toThrow(
      'N_Boss01 is not a N placeholder',
    );
    expect(pinned({ placeholderRoomGameName: 'N_Shop01', rewardType: 'Boon' })).toThrow(
      'N_Shop01 draws no Boon',
    );
    expect(pinned({ placeholderRoomGameName: 'N_MiniBoss02', rewardType: 'SpellDrop' })).toThrow(
      'N_MiniBoss02 draws no SpellDrop',
    );
    expect(() =>
      pin(loadSurfaceNProject(), combat05, {
        placeholderRoomGameName: null,
        rewardType: 'Boon',
      }),
    ).toThrow('a pinned reward requires a pinned placeholder room');
  });

  it('settles an unpinned main room to a no-draw placeholder that leaves every store alone', () => {
    const project = loadSurfaceNProject();
    const { at } = settlements(project);
    for (const exit of [combat05, combat02, miniBoss01])
      expect(at(exit)).toMatchObject({
        placeholderRoomGameName: 'N_PreBoss01',
        placeholderPinned: false,
        rewardPinned: false,
        offers: [],
      });
    expect(at(combat05).storeKey).toBeUndefined();
    expect(at(combat05).placeholderCandidates).toContainEqual({
      roomGameName: 'N_MiniBoss01',
      exclusion: 'creationCap',
    });
    expect(at(combat05).placeholderCandidates).toContainEqual({
      roomGameName: 'N_Combat05',
      exclusion: 'currentRoom',
    });
  });

  it('draws a side room the type with the most entries left, from its own placeholder set', () => {
    const { at } = settlements(loadSurfaceNProject());
    // The two MetaCurrencyDrop entries outnumber every single-entry type.
    expect(at(side05)).toMatchObject({
      placeholderRoomGameName: 'N_Sub01',
      storeKey: 'SubRoomRewards',
      offers: [{ rewardType: 'MetaCurrencyDrop' }],
    });
    // A side room never fills its door with itself.
    expect(at(side02).placeholderRoomGameName).toBe('N_Sub02');
  });

  it('consumes a pinned draw from the placeholder store with the first eligible god', () => {
    const before = loadSurfaceNProject();
    const project = pin(before, combat05, {
      placeholderRoomGameName: 'N_Combat13',
      rewardType: 'Boon',
    });
    const settled = settlements(project).at(combat05);
    expect(settled).toMatchObject({
      placeholderRoomGameName: 'N_Combat13',
      placeholderPinned: true,
      rewardPinned: true,
      storeKey: 'HubRewards',
    });
    expect(settled.offers).toEqual([
      expect.objectContaining({ rewardType: 'Boon', payload: expect.anything() }),
    ]);
    expect(bagCount(project, 'HubRewards')).toBe(bagCount(before, 'HubRewards') - 1);
  });

  it('counts a placeholder as created, so a Mini-Boss fills only one door', () => {
    const first = pin(loadSurfaceNProject(), combat05, {
      placeholderRoomGameName: 'N_MiniBoss02',
      rewardType: null,
    });
    const settledFirst = settlements(first).at(combat05);
    expect(settledFirst).toMatchObject({ storeKey: 'RunProgress' });
    expect(settledFirst.offers[0]?.rewardType).toBe('Boon');
    const second = pin(first, combat02, {
      placeholderRoomGameName: 'N_MiniBoss02',
      rewardType: null,
    });
    const evaluation = simulateProjectAssembly(catalog, second).evaluation;
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'phantomExitPlaceholderUnavailable',
        origin: combat02,
        evidence: { placeholderRoomGameName: 'N_MiniBoss02', exclusion: 'creationCap' },
      }),
    );
    // The board already created the open Mini-Boss.
    const board = pin(loadSurfaceNProject(), combat05, {
      placeholderRoomGameName: 'N_MiniBoss01',
      rewardType: null,
    });
    expect(simulateProjectAssembly(catalog, board).evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'phantomExitPlaceholderUnavailable', origin: combat05 }),
    );
  });

  it('keeps a pinned reward its placeholder cannot draw as a finding, never a fallback', () => {
    let project = loadSurfaceNProject();
    // HubRewards holds a single MaxHealthDropBig, so two draws cannot both take it.
    project = pin(project, combat05, {
      placeholderRoomGameName: 'N_Combat13',
      rewardType: 'MaxHealthDropBig',
    });
    project = pin(project, combat02, {
      placeholderRoomGameName: 'N_Combat13',
      rewardType: 'MaxHealthDropBig',
    });
    const findings = simulateProjectAssembly(catalog, project).evaluation.findings;
    expect(
      findings.filter((finding) => finding.code === 'phantomExitRewardUnavailable'),
    ).not.toEqual([]);
  });

  it('answers reward candidates at the unlock and publishes the settled exit', () => {
    const project = pin(loadSurfaceNProject(), combat05, {
      placeholderRoomGameName: 'N_Combat13',
      rewardType: null,
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const session = createPreparedProjectCandidateSession(catalog, assembly);
    const settled = phantomExitSettlementForProjectEvaluationAssembly(assembly, combat05)!;
    expect(
      session.evaluate({ kind: 'phantomExitReward', exit: combat05, value: settled.offers[0]! }),
    ).toMatchObject({ kind: 'phantomExitReward', result: { supported: true } });
    expect(
      session.evaluate({
        kind: 'phantomExitReward',
        exit: combat05,
        value: { rewardType: 'MaxManaDropSmall' },
      }),
    ).toMatchObject({ kind: 'phantomExitReward', result: { supported: false } });

    const product = assembleExecutionProduct({ assembly, catalog });
    expect(() => compileExecutionPlan({ product })).not.toThrow();
    const occurrence = product.occurrences.find(
      (candidate) => candidate.id === nOccurrenceId('combat05'),
    );
    expect(occurrence?.overview.phantomExit).toEqual({
      placeholderRoomGameName: 'N_Combat13',
      reward: expect.objectContaining({
        rewardType: settled.offers[0]!.rewardType,
        storeKey: 'HubRewards',
      }),
    });
    const side = product.occurrences.find(
      (candidate) => candidate.id === nLocalOccurrenceId('combat05', 'sideDoor2'),
    );
    expect(side?.overview.phantomExit).toEqual({
      placeholderRoomGameName: 'N_Sub01',
      reward: { rewardType: 'MetaCurrencyDrop', storeKey: 'SubRoomRewards' },
    });
  });

  it('fills each visited room once, before its side doors and never on a restore', () => {
    const { assembly } = settlements(loadSurfaceNProject());
    const biome = assembly.evaluation.route.biomes[0]!;
    if (!('history' in biome)) throw new Error('N has no history');
    const events = biome.history.events;
    const phantoms = events.filter((event) => event.kind === 'phantomExitCreated');
    // Six main visits and four entered side rooms.
    expect(phantoms).toHaveLength(10);
    const combat05Phantom = events.findIndex(
      (event) =>
        event.kind === 'phantomExitCreated' &&
        semanticAddressKey(event.owner) === semanticAddressKey(combat05),
    );
    const firstSideDoor = events.findIndex(
      (event) =>
        event.kind === 'roomCreated' &&
        event.source === 'localVisit' &&
        semanticAddressKey(event.parentOrigin) ===
          semanticAddressKey(events[combat05Phantom]!.origin),
    );
    expect(combat05Phantom).toBeGreaterThan(-1);
    expect(firstSideDoor).toBeGreaterThan(combat05Phantom);
  });

  it('settles one reward type on every branch, the one least scarce on its scarcest branch', () => {
    const branch = (entries: Record<string, number>) => new Map(Object.entries(entries));
    const declared = ['MaxManaDrop', 'RoomMoneyDrop', 'MaxHealthDrop'];
    // Branches disagree on their richest type, so each would settle differently alone.
    expect(
      settlePhantomRewardType(declared, [
        branch({ MaxManaDrop: 3, RoomMoneyDrop: 2, MaxHealthDrop: 1 }),
        branch({ MaxManaDrop: 1, RoomMoneyDrop: 2, MaxHealthDrop: 3 }),
      ]),
    ).toBe('RoomMoneyDrop');
    // A type one branch cannot draw is never settled, however plentiful elsewhere.
    expect(
      settlePhantomRewardType(declared, [
        branch({ MaxManaDrop: 9, MaxHealthDrop: 1 }),
        branch({ RoomMoneyDrop: 2, MaxHealthDrop: 1 }),
      ]),
    ).toBe('MaxHealthDrop');
    // Ties keep declaration order; no common type leaves the exit unsettled.
    expect(settlePhantomRewardType(declared, [branch({ MaxHealthDrop: 2, MaxManaDrop: 2 })])).toBe(
      'MaxManaDrop',
    );
    expect(
      settlePhantomRewardType(declared, [branch({ MaxManaDrop: 1 }), branch({ RoomMoneyDrop: 1 })]),
    ).toBeUndefined();
  });
});

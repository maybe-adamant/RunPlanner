import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { encodeSyntheticSave, sampleSaveBytes } from '@planner-test/support/syntheticSave';
import {
  abandonOpenRuns,
  advanceRecorder,
  EMPTY_RECORDER,
  observeSave,
  parseSaveFileName,
  prebossRoomsByBiome,
  reachesFirstPreboss,
  restoreOpenRuns,
  type ClosedRun,
  type RecorderState,
  type SaveObservation,
} from '@planner/workspace/run-recording/runRecorder';
import type { SaveCheckpoint, SavedRoom } from '@planner/workspace/run-recording/saveCheckpoint';
import { SaveFileError } from '@planner/workspace/run-recording/saveFile';

function room(name: string): SavedRoom {
  return {
    name,
    exitDoors: [],
    offeredRewards: {},
    predeterminedDoors: [],
    useRecord: {},
    kills: {},
    encounters: [],
    cages: [],
    wellShop: false,
    surfaceShop: false,
    sellShop: false,
  };
}

const ROUTE = ['F_Opening01', 'F_Combat01', 'F_Combat02', 'F_PreBoss01', 'F_Boss01'];

interface SaveSpec {
  readonly kind?: SaveCheckpoint['kind'];
  readonly runCount?: number;
  /** Rooms entered before this save; the current room is `ROUTE[depth]`. */
  readonly depth: number;
  readonly timestamp?: number;
  readonly heroDead?: boolean;
  readonly cleared?: boolean;
}

function checkpoint(spec: SaveSpec): SaveCheckpoint {
  const kind = spec.kind ?? 'entry';
  const history = ROUTE.slice(0, spec.depth);
  return {
    kind,
    timestamp: spec.timestamp ?? 1_000 + spec.depth * 10 + (kind === 'postReward' ? 5 : 0),
    runCount: spec.runCount ?? 7,
    mapName: spec.depth === 0 ? 'Hub_PreRun' : ROUTE[spec.depth - 1]!,
    nextMap: kind === 'postReward' ? '' : (ROUTE[spec.depth] ?? ''),
    worldTime: spec.depth * 10,
    history,
    currentRoom: room(ROUTE[Math.min(spec.depth, ROUTE.length - 1)]!),
    run: {
      biomeVisitOrder: spec.depth === 0 ? [] : ['F'],
      dream: false,
      cleared: spec.cleared ?? false,
      heroDead: spec.heroDead ?? false,
      ...(spec.heroDead ? { runResult: spec.cleared ? 1 : 2 } : {}),
      metaConversionUses: 0,
      biomeBoonSkipCount: 0,
      surfaceShopPurchases: 0,
      traitsSold: 0,
      wellShopPurchases: {},
      npcInteractions: {},
      rewardStores: {},
      lootChoices: [],
      bannedTraits: [],
    },
    profile: { shrineUpgrades: {}, arcana: {}, money: 0 },
  };
}

const seen = (spec: SaveSpec, profile = 1): SaveObservation => ({
  kind: 'checkpoint',
  profile,
  checkpoint: checkpoint(spec),
});

function feed(observations: readonly SaveObservation[], state: RecorderState = EMPTY_RECORDER) {
  const closed: ClosedRun[] = [];
  for (const observation of observations) {
    const step = advanceRecorder(state, observation);
    state = step.state;
    closed.push(...step.closed);
  }
  return { state, closed };
}

const depths = (run: ClosedRun) => run.checkpoints.map((save) => [save.kind, save.history.length]);

/** Start, then entry and PostReward saves through `ROUTE[last]`. */
const through = (last: number, runCount = 7): SaveObservation[] => [
  seen({ depth: 0, runCount }),
  ...Array.from({ length: last }, (_, index) => [
    seen({ kind: 'postReward', depth: index, runCount }),
    seen({ depth: index + 1, runCount }),
  ]).flat(),
];

describe('run recorder', () => {
  it('opens a run at the start save and ignores a run already under way', () => {
    expect(feed([seen({ depth: 2 })]).state.runs.size).toBe(0);
    const { state, closed } = feed(through(2));
    expect(closed).toEqual([]);
    expect(state.runs.get(1)).toMatchObject({ profile: 1, runCount: 7, attempt: 1 });
    expect(state.runs.get(1)!.checkpoints).toHaveLength(5);
  });

  it('closes a run at the hub save of the dead hero', () => {
    const { state, closed } = feed([
      ...through(3),
      seen({ kind: 'hub', depth: 4, heroDead: true }),
      // Later hub rewrites of the finished run change nothing.
      seen({ kind: 'hub', depth: 4, heroDead: true, timestamp: 9_000 }),
    ]);
    expect(state.runs.size).toBe(0);
    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({
      profile: 1,
      runCount: 7,
      startedAt: 1_000,
      outcome: 'death',
      gap: false,
    });
    expect(closed[0]!.end?.kind).toBe('hub');
  });

  it('reads a cleared run as a victory', () => {
    const { closed } = feed([
      ...through(4),
      seen({ kind: 'postReward', depth: 4, cleared: true }),
      seen({ kind: 'hub', depth: 5, heroDead: true, cleared: true }),
    ]);
    expect(closed[0]).toMatchObject({ outcome: 'victory', gap: false });
  });

  it('ends the open run unfinished at its last checkpoint when a later run starts', () => {
    const { state, closed } = feed([...through(2), ...through(1, 8)]);
    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({ runCount: 7, outcome: 'unfinished', gap: false });
    expect(closed[0]!.end).toBeUndefined();
    expect(depths(closed[0]!)).toEqual([
      ['entry', 0],
      ['postReward', 0],
      ['entry', 1],
      ['postReward', 1],
      ['entry', 2],
    ]);
    expect(state.runs.get(1)?.runCount).toBe(8);
  });

  it('ends the open run unfinished when a later run shows without its start', () => {
    const { state, closed } = feed([...through(2), seen({ depth: 1, runCount: 8 })]);
    expect(closed.map((run) => run.outcome)).toEqual(['unfinished']);
    expect(state.runs.size).toBe(0);
  });

  it('continues a reloaded run and lets a replayed room supersede the lost one', () => {
    const { state } = feed([
      ...through(2),
      seen({ kind: 'postReward', depth: 2 }),
      // Reloaded from the room-1 entry: the later saves were lost with the progress.
      seen({ depth: 1, timestamp: 5_000 }),
      seen({ kind: 'postReward', depth: 1, timestamp: 5_010 }),
      seen({ depth: 2, timestamp: 5_020 }),
    ]);
    const run = state.runs.get(1)!;
    expect(run.checkpoints.map((save) => [save.kind, save.history.length, save.timestamp])).toEqual(
      [
        ['entry', 0, 1_000],
        ['postReward', 0, 1_005],
        ['entry', 1, 5_000],
        ['postReward', 1, 5_010],
        ['entry', 2, 5_020],
      ],
    );
  });

  it('ignores a save delivered again', () => {
    const once = feed(through(2)).state;
    const again = advanceRecorder(once, seen({ depth: 2 }));
    expect(again.state).toBe(once);
    expect(again.closed).toEqual([]);
  });

  it('cuts a run before the room whose entry save was missed', () => {
    const { closed } = feed([
      seen({ depth: 0 }),
      seen({ kind: 'postReward', depth: 0 }),
      seen({ depth: 1 }),
      // The room-2 entry save never arrived.
      seen({ kind: 'postReward', depth: 2 }),
      seen({ depth: 3 }),
      seen({ kind: 'hub', depth: 4, heroDead: true }),
    ]);
    expect(closed).toHaveLength(1);
    // The plan ends at the gap, but the run keeps the outcome its end save showed.
    expect(closed[0]).toMatchObject({ outcome: 'death', gap: true });
    expect(closed[0]!.end).toBeUndefined();
    expect(depths(closed[0]!)).toEqual([
      ['entry', 0],
      ['postReward', 0],
      ['entry', 1],
    ]);
  });

  it('cuts a run whose last room has no entry save', () => {
    const { closed } = feed([
      ...through(2),
      seen({ kind: 'hub', depth: 4, heroDead: true, cleared: true }),
    ]);
    expect(closed[0]).toMatchObject({ outcome: 'victory', gap: true });
    expect(closed[0]!.end).toBeUndefined();
    expect(closed[0]!.checkpoints.at(-1)?.history).toHaveLength(2);
  });

  it('keeps each save profile in its own run', () => {
    const { state, closed } = feed([
      seen({ depth: 0 }, 1),
      seen({ depth: 0, runCount: 40 }, 2),
      seen({ depth: 1 }, 1),
      seen({ depth: 1, runCount: 40 }, 2),
      seen({ kind: 'hub', depth: 2, heroDead: true }, 1),
    ]);
    expect(closed.map((run) => [run.profile, run.runCount])).toEqual([[1, 7]]);
    expect([...state.runs.keys()]).toEqual([2]);
    expect(state.runs.get(2)!.checkpoints).toHaveLength(2);
  });

  it('ends every open run unfinished when recording stops', () => {
    const { state } = feed([seen({ depth: 0 }, 1), seen({ depth: 0, runCount: 40 }, 2)]);
    const step = abandonOpenRuns(state);
    expect(step.state.runs.size).toBe(0);
    expect(step.closed.map((run) => [run.profile, run.outcome])).toEqual([
      [1, 'unfinished'],
      [2, 'unfinished'],
    ]);
  });

  it('keeps a run only once it reached its first biome Preboss', () => {
    const preboss = prebossRoomsByBiome(catalog);
    expect([...preboss.get('F')!]).toEqual(['F_PreBoss01']);
    expect([...preboss.get('I')!].sort()).toEqual(['I_PreBoss01', 'I_PreBoss02']);
    const short = feed([...through(2), ...through(0, 8)]).closed[0]!;
    const reached = feed([...through(3), ...through(0, 8)]).closed[0]!;
    expect(reachesFirstPreboss(preboss, short)).toBe(false);
    expect(reachesFirstPreboss(preboss, reached)).toBe(true);
  });

  it('stops loudly at a save format it does not know', () => {
    const open = feed(through(1)).state;
    const halted = advanceRecorder(open, {
      kind: 'unsupportedVersion',
      profile: 1,
      version: 0x00010013,
    });
    expect(halted.state.error).toMatch(/version 10013/);
    expect(halted.state.runs.size).toBe(0);
    // The open run ends where its readable saves stop.
    expect(halted.closed.map((run) => [run.runCount, run.outcome, run.checkpoints.length])).toEqual(
      [[7, 'unfinished', 3]],
    );
    expect(advanceRecorder(halted.state, seen({ depth: 0, runCount: 8 })).state).toBe(halted.state);
  });

  it('ignores a hub rewrite of the previous run once the next run started', () => {
    const { state, closed } = feed([
      ...through(2),
      seen({ kind: 'hub', depth: 3, heroDead: true }),
      ...through(1, 8),
      seen({ kind: 'hub', depth: 3, heroDead: true, timestamp: 9_000 }),
    ]);
    expect(closed.map((run) => run.runCount)).toEqual([7]);
    expect(state.runs.get(1)?.runCount).toBe(8);
    expect(state.runs.get(1)!.checkpoints).toHaveLength(3);
  });

  it('reads a new start of the same run count as a reset of the open run', () => {
    const { state, closed } = feed([
      ...through(2),
      seen({ depth: 0, timestamp: 5_000 }),
      seen({ kind: 'postReward', depth: 0, timestamp: 5_005 }),
    ]);
    expect(closed.map((run) => [run.runCount, run.attempt, run.outcome])).toEqual([
      [7, 1, 'reset'],
    ]);
    expect(closed[0]!.end).toBeUndefined();
    expect(depths(closed[0]!)).toHaveLength(5);
    expect(state.runs.get(1)).toMatchObject({ runCount: 7, attempt: 2 });
    expect(state.runs.get(1)!.checkpoints).toHaveLength(2);
  });

  it('numbers attempts per profile and run count, counting runs below the keep threshold', () => {
    const { state, closed } = feed([
      // Reset in the first room: far below the Preboss, yet still an attempt.
      seen({ depth: 0 }),
      seen({ depth: 0, timestamp: 2_000 }),
      seen({ depth: 0, timestamp: 3_000 }),
      seen({ depth: 0, runCount: 40 }, 2),
      seen({ kind: 'hub', depth: 1, heroDead: true, timestamp: 3_100 }),
      // A death raises the run count, so the next start is a first attempt again.
      seen({ depth: 0, runCount: 8, timestamp: 4_000 }),
    ]);
    expect(closed.map((run) => [run.profile, run.runCount, run.attempt, run.outcome])).toEqual([
      [1, 7, 1, 'reset'],
      [1, 7, 2, 'reset'],
      [1, 7, 3, 'death'],
    ]);
    expect(state.attempts.get(1)).toEqual({ runCount: 8, attempt: 1 });
    expect(state.attempts.get(2)).toEqual({ runCount: 40, attempt: 1 });
    expect(state.runs.get(1)?.attempt).toBe(1);
  });

  it('continues attempt numbering from a restored memory', () => {
    const restored = restoreOpenRuns(
      EMPTY_RECORDER,
      [],
      new Map([[1, { runCount: 7, attempt: 4 }]]),
    );
    const { state } = feed([seen({ depth: 0 })], restored);
    expect(state.runs.get(1)?.attempt).toBe(5);
    // A memory of an earlier run count starts the new count at 1.
    const older = restoreOpenRuns(EMPTY_RECORDER, [], new Map([[1, { runCount: 6, attempt: 4 }]]));
    expect(feed([seen({ depth: 0 })], older).state.runs.get(1)?.attempt).toBe(1);
  });

  it('keeps the attempt memory as recording stops or meets an unknown format', () => {
    const { state } = feed([seen({ depth: 0 })]);
    expect(abandonOpenRuns(state).state.attempts).toBe(state.attempts);
    const halted = advanceRecorder(state, { kind: 'unsupportedVersion', profile: 1, version: 2 });
    expect(halted.state.attempts).toBe(state.attempts);
  });

  it('ignores the hub save of a run it never saw start', () => {
    const step = advanceRecorder(EMPTY_RECORDER, seen({ kind: 'hub', depth: 3, heroDead: true }));
    expect(step).toEqual({ state: EMPTY_RECORDER, closed: [] });
  });
});

describe('save observation', () => {
  it('names the profile and kind of each recorded save', () => {
    expect(parseSaveFileName('Profile1_Temp.sav')).toEqual({ profile: 1, temp: true });
    expect(parseSaveFileName('Profile12.sav')).toEqual({ profile: 12, temp: false });
    expect(parseSaveFileName('Profile1.sav.bak')).toBeUndefined();
    expect(parseSaveFileName('Profile1.v.sav')).toBeUndefined();
  });

  it('reduces a save to its checkpoint view', () => {
    const observation = observeSave('Profile3_Temp.sav', sampleSaveBytes('surface-002'));
    expect(observation).toMatchObject({
      kind: 'checkpoint',
      profile: 3,
      checkpoint: { kind: 'entry', runCount: 1002, mapName: 'Hub_PreRun', history: [] },
    });
  });

  it('reports an unknown header version before reading the payload', () => {
    const bytes = encodeSyntheticSave(
      {
        version: 0x00010013,
        timestamp: 1,
        location: 'Location_Home',
        runCount: 1,
        fear: 0,
        mapName: 'Hub_PreRun',
        nextMap: 'F_Opening01',
      },
      {},
    );
    expect(observeSave('Profile1_Temp.sav', bytes)).toEqual({
      kind: 'unsupportedVersion',
      profile: 1,
      version: 0x00010013,
    });
  });

  it('throws a save file error for a save read while it was written', () => {
    const bytes = sampleSaveBytes('surface-002');
    expect(() => observeSave('Profile1_Temp.sav', bytes.subarray(0, bytes.length - 10))).toThrow(
      SaveFileError,
    );
  });
});

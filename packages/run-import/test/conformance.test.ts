import { readFileSync } from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  simulateProject,
  simulateProjectAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { projectFromRunRecord } from '../src/import';
import { decodeRunRecord, type RunRecord, type RunRecordRoomEntry } from '../src/run-record';
import {
  compareImportToRecord,
  entryCheckpoint,
  entrySaves,
  entrySnapshot,
  recordedEntryStates,
} from '../src/conformance';
import { RecordOccurrences } from '../src/occurrences';
import type { RunImportReport, RunImportReportEntry } from '../src/report';
import { judgeRoom } from '../src/acceptance';

function fixture(name: string): RunRecord {
  return decodeRunRecord(
    JSON.parse(
      readFileSync(
        new URL(`./run-record/fixtures/${name}.run-record.json`, import.meta.url),
        'utf8',
      ),
    ),
  );
}

function line(entry: RunImportReportEntry): string {
  return `${entry.area} r${entry.record?.roomIndex} ${entry.mismatch?.field}: ${entry.mismatch?.expected} | ${entry.mismatch?.actual}`;
}

interface Imported {
  readonly record: RunRecord;
  readonly assembly: ProjectEvaluationAssembly;
  readonly occurrences: RecordOccurrences;
  readonly report: RunImportReport;
}

function imported(record: RunRecord): Imported {
  const { project, report } = projectFromRunRecord(catalog, record);
  const occurrences = new RecordOccurrences(catalog, record);
  occurrences.bindEngineOccurrences(project);
  return { record, assembly: simulateProjectAssembly(catalog, project), occurrences, report };
}

describe('import conformance alignment', () => {
  let surface: Imported;
  beforeAll(() => {
    surface = imported(fixture('surface'));
  });

  it("compares each entry save at the previous room's exit or its Hub stay's departure", () => {
    const { record, assembly, occurrences } = surface;
    const at = (roomIndex: number) => entryCheckpoint(occurrences, assembly.project, roomIndex);
    const name = (index: number) => record.rooms[index]!.name;
    expect([2, 3, 4, 5, 6].map(name)).toEqual([
      'N_Hub',
      'N_Combat02',
      'N_Sub01',
      'N_Combat02',
      'N_Hub',
    ]);
    expect(at(0)).toMatchObject({ kind: 'compared', source: { kind: 'opening' } });
    expect(at(1)).toMatchObject({
      source: { kind: 'exit', occurrence: { occurrenceId: 'N:start' } },
      entered: { occurrenceId: 'N-r1' },
    });
    // Leaving the Hub reads the departure after its completed visits.
    expect(at(3)).toMatchObject({
      source: { kind: 'hubDeparture', hub: { hubKey: 'hub' }, stay: 0 },
      entered: { occurrenceId: 'N-r3' },
    });
    expect(at(7)).toMatchObject({ source: { kind: 'hubDeparture', stay: 1 } });
    // A main room's first visit is left for its side room at its own exit.
    expect(at(4)).toMatchObject({ source: { kind: 'exit', occurrence: { occurrenceId: 'N-r3' } } });
    // Restoring a room, or the Hub, names no entered occurrence, only its visit.
    expect(at(5)).toMatchObject({ kind: 'compared', visit: 1 });
    expect(at(5)).not.toHaveProperty('entered');
    expect(at(8)).toMatchObject({ kind: 'compared', visit: 2 });
    expect(at(8)).not.toHaveProperty('entered');
    // The restored room's departure to the Hub captures no state.
    expect(at(6)).toMatchObject({ kind: 'unchecked', reason: 'restoredDeparture' });
    for (const roomIndex of [3, 4, 7])
      expect(entrySnapshot(assembly, occurrences, roomIndex)).toBeDefined();
  });

  it("reads Forfeit at the last room's exit, before the next biome restarts its count", () => {
    const { record, assembly, occurrences } = surface;
    const intro = record.rooms.findIndex((room) => room.name === 'O_Intro');
    const snapshot = (roomIndex: number, kind: 'roomEntered' | 'beforeRoomExit') =>
      assembly.evaluation.route.biomes
        .flatMap((biome) => ('rewards' in biome ? biome.rewards.runStateSnapshots : []))
        .find(
          (entry) =>
            semanticAddressKey(entry.owner) ===
            semanticAddressKey(
              createRoomRunStateCheckpointAddress(
                createOccurrenceAddress(
                  createBiomeAddress(
                    assembly.project.route.routeKey,
                    occurrences.biomeOfRoom[roomIndex]!,
                  ),
                  occurrences.occurrenceOf(roomIndex),
                ),
                { kind },
              ),
            ),
        );
    // The game saves O_Intro's entry with Ephyra's spent Forfeit; O_Intro then restarts the count.
    expect(recordedEntryStates(record)[intro]!.biomeBoonSkipCount).toBe(1);
    expect(snapshot(intro - 1, 'beforeRoomExit')?.forfeitStatus).toBe('consumed');
    expect(snapshot(intro, 'roomEntered')?.forfeitStatus).toBe('available');
    expect(
      compareImportToRecord(catalog, record, occurrences, assembly, record.rooms.length).filter(
        (entry) => entry.area === 'forfeit',
      ),
    ).toEqual([]);
  });
});

describe('import room acceptance', () => {
  let surface: Imported;
  beforeAll(() => {
    surface = imported(fixture('surface'));
  });

  it('judges each room at its next entry save, Hub stays included', () => {
    const { record, report } = surface;
    const rooms = report.rooms ?? [];
    expect(rooms.map((room) => room.roomIndex)).toEqual(record.rooms.map((_, index) => index));
    const at = (roomIndex: number) => rooms[roomIndex]!;
    // N_Hub stays are judged at their departures.
    for (const roomIndex of [2, 6, 8, 16])
      expect(at(roomIndex)).toMatchObject({ verdict: 'accepted', introduced: [], carried: [] });
    expect(at(5)).toEqual({ roomIndex: 5, verdict: 'unchecked', reason: 'restoredDeparture' });
    expect(at(record.rooms.length - 1)).toMatchObject({ verdict: 'unchecked', reason: 'lastRoom' });
    // Entering the Hub or a Ship room publishes no entry state after the exit's element grants.
    expect(record.rooms[21]!.name).toBe('O_Combat01');
    for (const roomIndex of [1, 20])
      expect(at(roomIndex)).toMatchObject({
        unchecked: [{ family: 'elements', reason: 'noEntrySnapshot' }],
      });
    expect(at(3)).toMatchObject({ unchecked: [] });
  });

  it('tells a difference a room began from one it carried', () => {
    const { record, assembly, occurrences } = surface;
    const saves = entrySaves(record);
    const changed = 8;
    const [store, counts] = [...saves.states[changed]!.rewardStores].find(
      ([key, entries]) => key !== 'Secrets' && Object.keys(entries).length > 0,
    )!;
    const name = Object.keys(counts)[0]!;
    // Every save from the Hub's third stay on holds one more of a reward than the game left.
    const altered = {
      ...saves,
      states: saves.states.map((state, index) =>
        index < changed
          ? state
          : {
              ...state,
              rewardStores: new Map([
                ...state.rewardStores,
                [
                  store,
                  {
                    ...state.rewardStores.get(store)!,
                    [name]: (state.rewardStores.get(store)![name] ?? 0) + 1,
                  },
                ],
              ]),
            },
      ),
    };
    const judged = (roomIndex: number) =>
      judgeRoom(catalog, record, altered, occurrences, assembly, roomIndex);
    expect(judged(changed - 2)).toMatchObject({ verdict: 'accepted' });
    expect(judged(changed - 1)).toMatchObject({
      verdict: 'mismatch',
      introduced: [{ area: 'stores', family: 'stores', field: store }],
      carried: [],
    });
    expect(judged(changed)).toMatchObject({
      verdict: 'mismatch',
      introduced: [],
      carried: [{ family: 'stores', field: store }],
    });
  });
});

describe('import stop at an entry save mismatch', () => {
  it('ends the plan at the first room whose next entry save differs', () => {
    const record = fixture('underworld-1010');
    const changed = 9;
    // Every save from F_Combat18's on holds one more Talent in RunProgress than the game left.
    const imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room, index) => {
        const stores = room.entry?.rewardStores;
        const run = stores?.['RunProgress'];
        return index < changed || run === undefined
          ? room
          : {
              ...room,
              entry: {
                ...room.entry,
                rewardStores: {
                  ...stores,
                  RunProgress: { ...run, TalentDrop: (run['TalentDrop'] ?? 0) + 1 },
                },
              },
            };
      }),
    });
    expect(imported).toMatchObject({
      kind: 'stopped',
      stop: { code: 'entryMismatch', record: { roomIndex: changed - 1 } },
    });
    const rooms = imported.report.rooms ?? [];
    expect(rooms[changed - 2]).toMatchObject({ verdict: 'accepted' });
    expect(rooms[changed - 1]).toMatchObject({ verdict: 'mismatch' });
    expect(imported.kind === 'stopped' && imported.stop.families).toEqual(['stores']);
    // The plan ends after the last room whose next save matched, so it publishes.
    expect(imported.report.end).toEqual({
      cause: 'entryMismatch',
      record: { roomIndex: changed - 2, visit: 0 },
    });
    expect(simulateProject(catalog, imported.project).status).toBe('valid');
    // The run's state after the mismatch is unknown: no later room is judged.
    expect(rooms.slice(changed).every((room) => room.verdict === 'unchecked')).toBe(true);
    expect(
      imported.report.entries
        .filter((entry) => entry.reason === 'mismatch')
        .map((entry) => entry.record?.roomIndex),
    ).toEqual([changed]);
  });
});

describe('import conformance field groups', () => {
  const ROOM = 5;
  let erebus: Imported;
  let base: readonly string[];
  beforeAll(() => {
    const record = fixture('underworld');
    erebus = imported({
      ...record,
      route: { ...record.route, biomes: ['F'] },
      rooms: record.rooms.slice(0, 14),
    });
    base = compare(erebus.record);
  });

  function compare(record: RunRecord): readonly string[] {
    return compareImportToRecord(
      catalog,
      record,
      erebus.occurrences,
      erebus.assembly,
      record.rooms.length,
    ).map(line);
  }

  /** The lines a change to one room's entry save adds. */
  function added(
    entry: Partial<RunRecordRoomEntry>,
    record = erebus.record,
    unchanged = base,
  ): readonly string[] {
    const rooms = record.rooms.map((room, index) =>
      index === ROOM
        ? {
            ...room,
            entry: {
              ...room.entry,
              ...entry,
              // Traits are a delta: keep the room's own changes beside the planted one.
              ...(entry.traits === undefined
                ? {}
                : { traits: { ...room.entry?.traits, ...entry.traits } }),
            },
          }
        : room,
    );
    return compare({ ...record, rooms }).filter((value) => !unchanged.includes(value));
  }

  const saved = () => recordedEntryStates(erebus.record)[ROOM]!;

  it('agrees with the imported Erebus', () => {
    expect(base).toEqual([]);
  });

  it('compares held traits the trait ledger models, levels as the game reads them', () => {
    const hera = saved().traits.get('HeraSpecialBoon')!;
    expect(added({ traits: { HeraSpecialBoon: { ...hera, level: 9 } } })).toEqual([
      `traits r5 HeraSpecialBoon: ${hera.rarity} level 9 | ${hera.rarity} level ${hera.level ?? 1}`,
    ]);
    expect(added({ traits: { ZeusWeaponBoon: { rarity: 'Rare' } } })).toEqual([
      'traits r5 ZeusWeaponBoon: Rare | absent',
    ]);
    // Arcana card traits, Chaos and names the catalog does not declare are not compared here.
    expect(
      added({
        traits: { DoorHealMetaUpgrade: { rarity: 'Epic' }, UnknownTrait: { rarity: 'Rare' } },
      }),
    ).toEqual([]);
    // Dresses break with their armor, which the planner never loses.
    expect(added({ traits: { CastDamageCostume: { rarity: 'Common' } } })).toEqual([]);
  });

  it('compares the slotted keepsake', () => {
    expect(added({ keepsake: 'LowHealthCritKeepsake' })).toEqual([
      `keepsake r5 Keepsake: LowHealthCritKeepsake | ${saved().keepsake}`,
    ]);
  });

  it('compares reward store contents by name', () => {
    const runProgress = saved().rewardStores.get('RunProgress')!;
    expect(
      added({
        rewardStores: { RunProgress: { ...runProgress, Boon: (runProgress.Boon ?? 0) + 1 } },
      }),
    ).toEqual([
      `stores r5 RunProgress: Boon ${(runProgress.Boon ?? 0) + 1} | Boon ${runProgress.Boon ?? 0}`,
    ]);
  });

  it('compares Vow of Denial bans', () => {
    expect(added({ bannedTraits: ['ZeusWeaponBoon'] })).toEqual([
      'denial r5 BannedTraits: ZeusWeaponBoon | none other',
    ]);
  });

  it("compares Artificer conversions and the Time Piece's remaining uses", () => {
    expect(added({ metaConversionUses: saved().metaConversionUses + 1 })).toEqual([
      `conversion r5 MetaConversionUses: ${saved().metaConversionUses + 1} | ${saved().metaConversionUses}`,
    ]);
    expect(
      added({ traits: { GoldifyKeepsake: { rarity: 'Common', boonConversionUses: 2 } } }),
    ).toContain('conversion r5 GoldifyKeepsake: 2 | absent');
  });

  it('compares Stygian Well purchases', () => {
    expect(
      added({
        wellShopPurchases: { ...saved().wellShopPurchases, TemporaryMoveSpeedTrait: 9 },
      }),
    ).toEqual([
      `well r5 WellShopPurchases: TemporaryMoveSpeedTrait 9 | TemporaryMoveSpeedTrait ${saved().wellShopPurchases.TemporaryMoveSpeedTrait ?? 0}`,
    ]);
  });

  it("compares each Chaos curse's remaining uses", () => {
    const curse = [...saved().traits].find(([name]) => /^Chaos.*Curse$/.test(name));
    expect(curse).toBeDefined();
    const [name, held] = curse!;
    expect(added({ traits: { [name]: { ...held, remainingUses: 9 } } })).toEqual([
      `chaos r5 ${name}: 9 | ${held.remainingUses}`,
    ]);
  });

  it('compares invested Path of Stars nodes', () => {
    expect(added({ investedTalents: ['5:1'] })).toEqual([
      'pathOfStars r5 Invested: 5:1 | none other',
    ]);
  });

  it("derives Forfeit from the biome's skip count and the Vow's rank", () => {
    const record = {
      ...erebus.record,
      loadout: {
        ...erebus.record.loadout,
        vows: { ...erebus.record.loadout.vows, BoonSkipShrineUpgrade: 1 },
      },
    };
    // The plan has no Forfeit, so the difference begins at the first compared room.
    const unchanged = compare(record);
    expect(unchanged).toContain('forfeit r1 BiomeBoonSkipCount: available | inactive');
    expect(added({ biomeBoonSkipCount: 1 }, record, unchanged)).toEqual([
      'forfeit r5 BiomeBoonSkipCount: consumed | inactive',
      'forfeit r6 BiomeBoonSkipCount: available | inactive',
    ]);
  });

  it("compares elements with the entered room's state, after the exit's gathering", () => {
    expect(added({ elements: { ...saved().elements, Aether: 5 } })).toEqual([
      'elements r5 Elements: Aether 5 | Aether 0',
    ]);
  });
});

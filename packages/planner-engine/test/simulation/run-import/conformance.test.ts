import { readFileSync } from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
} from '../../../src/authored-project';
import { decodeRunRecord, type RunRecord, type RunRecordRoomEntry } from '../../../src/run-record';
import { projectFromRunRecord, simulateProjectAssembly } from '../../../src/simulation';
import type { ProjectEvaluationAssembly } from '../../../src/simulation/evaluation/evaluation-products';
import {
  compareImportToRecord,
  entryCheckpoints,
  recordedEntryStates,
} from '../../../src/simulation/run-import/conformance';
import { RecordOccurrences } from '../../../src/simulation/run-import/occurrences';
import type { RunImportReportEntry } from '../../../src/simulation/run-import/report';

function fixture(name: string): RunRecord {
  return decodeRunRecord(
    JSON.parse(
      readFileSync(
        new URL(`../../run-record/fixtures/${name}.run-record.json`, import.meta.url),
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
}

function imported(record: RunRecord): Imported {
  const project = projectFromRunRecord(catalog, record).project;
  const occurrences = new RecordOccurrences(catalog, record);
  occurrences.bindEngineOccurrences(project);
  return { record, assembly: simulateProjectAssembly(catalog, project), occurrences };
}

describe('import conformance alignment', () => {
  let surface: Imported;
  beforeAll(() => {
    surface = imported(fixture('surface'));
  });

  it("compares each entry save with the previous room's exit, skipping Hub visits", () => {
    const { record, occurrences } = surface;
    const checkpoints = entryCheckpoints(record, occurrences, record.rooms.length);
    for (const checkpoint of checkpoints)
      expect(checkpoint.left.occurrenceId).toBe(occurrences.occurrenceOf(checkpoint.roomIndex - 1));
    const name = (index: number) => record.rooms[index]!.name;
    // No room is left from N_Hub, which every return revisits.
    expect(checkpoints.some((checkpoint) => name(checkpoint.roomIndex - 1) === 'N_Hub')).toBe(
      false,
    );
    expect(checkpoints[0]).toMatchObject({ roomIndex: 1, entered: { occurrenceId: 'N-r1' } });
    // Entering the Hub again names no entered occurrence, only its visit.
    const hubReturn = checkpoints.find(
      (checkpoint) => name(checkpoint.roomIndex) === 'N_Hub' && checkpoint.visit > 0,
    );
    expect(hubReturn).toMatchObject({ roomIndex: 8, visit: 2 });
    expect(hubReturn?.entered).toBeUndefined();
    expect(
      entryCheckpoints(record, occurrences, 1).map((checkpoint) => checkpoint.roomIndex),
    ).toEqual([1]);
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

  it('agrees with the imported Erebus but for the Chaos gate Secrets draw', () => {
    expect(base).toEqual(['stores r1 Secrets: TrialUpgrade 0 | TrialUpgrade 1']);
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

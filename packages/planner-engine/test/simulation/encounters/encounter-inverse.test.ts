import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { AuthoredGeneratedEncounterCustomization } from '../../../src/authored-project';
import type {
  GeneratedEncounterSelection,
  InfiniteRosterSelection,
} from '../../../src/catalog-schema';
import { decodeRunRecord, type RunRecord, type RunRecordEncounter } from '../../../src/run-record';
import {
  invertGeneratedEncounter,
  invertInfiniteRoster,
} from '../../../src/simulation/encounters/encounter-inverse';
import {
  assessGeneratedEncounter,
  type EncounterGenerationContext,
} from '../../../src/simulation/encounters/generation';
import { assessInfiniteRoster } from '../../../src/simulation/encounters/infinite-roster';

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

/** NPC selection-weight duplicates the planner authors as their primary encounter. */
const primaryEncounter: Readonly<Record<string, string>> = { ArtemisCombatF2: 'ArtemisCombatF' };

function decision(encounterKey: string) {
  return catalog.encounterDefinitions.byKey[
    primaryEncounter[encounterKey] ?? encounterKey
  ]?.customization?.find(
    (entry) => entry.selection.kind === 'generated' || entry.selection.kind === 'infiniteRoster',
  )?.selection;
}

function policy(encounterKey: string): GeneratedEncounterSelection {
  const value = decision(encounterKey);
  if (value?.kind !== 'generated') throw new Error(`Missing generation policy ${encounterKey}`);
  return value;
}

const invert = (
  selection: GeneratedEncounterSelection,
  context: EncounterGenerationContext,
  observed: RunRecordEncounter,
) =>
  invertGeneratedEncounter(
    selection,
    (value) => assessGeneratedEncounter(selection, value, context),
    observed,
  );

/** The observed phase a forward-assessed customization would leave in a save. */
function observe(
  selection: GeneratedEncounterSelection,
  value: AuthoredGeneratedEncounterCustomization,
  context: EncounterGenerationContext,
): RunRecordEncounter {
  const assessment = assessGeneratedEncounter(selection, value, context);
  const operands = assessment.operands;
  if (operands === undefined) throw new Error(JSON.stringify(assessment.issues));
  const declared = [...selection.fixedEnemies, ...(selection.fixedWaves ?? []).flat()];
  const all = [...selection.choices, ...(selection.generatedSeeds ?? []), ...declared];
  const budgets = assessment.budget!.waveBudgets as readonly number[];
  return {
    name: 'observed',
    difficulty: operands.expectedBudget,
    waves: operands.waves.map((wave) => ({
      difficulty: budgets[wave.waveIndex - 1]!,
      spawns: wave.typeKeys.map((key) => ({
        enemy: all.find((choice) => choice.key === key)!.nativeId,
        count: wave.counts[key]!,
        ...(declared.some((choice) => choice.key === key) ? {} : { generated: true as const }),
      })),
    })),
  };
}

function recordContext(record: RunRecord, roomName: string, depths: Depths) {
  const vows = record.loadout.vows;
  return {
    ...depths,
    knownRunBlacklist: [],
    hordesRank: vows.EnemyCountShrineUpgrade ?? 0,
    fangsRank: vows.EnemyEliteShrineUpgrade ?? 0,
    menaceRank: vows.NextBiomeEnemyShrineUpgrade ?? 0,
    roomSetKey: roomName[0]!,
  };
}

interface Depths {
  readonly biomeDepthCache: number;
  readonly biomeEncounterDepth: number | undefined;
}

const depthGrid: readonly Depths[] = Array.from({ length: 13 }, (_cache, biomeDepthCache) =>
  [undefined, ...Array.from({ length: 12 }, (_e, index) => index + 1)].map(
    (biomeEncounterDepth) => ({ biomeDepthCache, biomeEncounterDepth }),
  ),
).flat();

describe('generated encounter inverse over the capture records', () => {
  /*
   * The records carry no depth counters; an import reads them from the simulated
   * project. Each phase is therefore inverted across a bounded depth grid, and the
   * depth on its budget axis that replays exactly is pinned below with the room's
   * position in its biome.
   */
  const resolved = (name: string) => {
    const record = fixture(name);
    return record.rooms.flatMap((room, roomIndex) =>
      [...room.encounters, ...(room.fields?.cages ?? []).map((cage) => cage.encounter)]
        .filter((encounter) => (encounter.waves?.length ?? 0) > 0)
        .map((encounter) => {
          const selection = decision(encounter.name);
          if (selection?.kind !== 'generated')
            return { roomIndex, room: room.name, encounter: encounter.name, generated: false };
          const matches = depthGrid.filter(
            (depths) =>
              invert(selection, recordContext(record, room.name, depths), encounter).kind ===
              'match',
          );
          const axis = selection.budget.depthAxis;
          const pinned = [
            ...new Set(
              matches.map((depths) =>
                axis === 'biomeDepthCache' ? depths.biomeDepthCache : depths.biomeEncounterDepth,
              ),
            ),
          ];
          return {
            roomIndex,
            room: room.name,
            encounter: encounter.name,
            generated: true,
            axis,
            depths: pinned,
          };
        }),
    );
  };

  it('replays every generated Surface phase', () => {
    const phases = resolved('surface');
    expect(phases.filter((phase) => !phase.generated).map((phase) => phase.encounter)).toEqual([
      'MiniBossBoar',
    ]);
    expect(
      phases
        .filter((phase) => phase.generated)
        .map((phase) => `${phase.roomIndex} ${phase.encounter} ${phase.axis} ${phase.depths}`),
    ).toEqual(SURFACE_DEPTHS);
  });

  it('replays every generated Underworld phase', () => {
    const phases = resolved('underworld');
    expect(phases.filter((phase) => !phase.generated).map((phase) => phase.encounter)).toEqual([
      'MiniBossTreant',
      'MiniBossWaterUnit',
      'MiniBossVampire',
    ]);
    expect(
      phases
        .filter((phase) => phase.generated)
        .map((phase) => `${phase.roomIndex} ${phase.encounter} ${phase.axis} ${phase.depths}`),
    ).toEqual(UNDERWORLD_DEPTHS);
  });
});

const SURFACE_DEPTHS: readonly string[] = [
  // The opening reads encounter depth unset; PreHub's budget has no depth ramp.
  '0 OpeningGeneratedN biomeEncounterDepth ',
  '1 PreHubGeneratedN biomeEncounterDepth ,1,2,3,4,5,6,7,8,9,10,11,12',
  '3 GeneratedN biomeEncounterDepth 2',
  // N side rooms do not count encounter depth.
  '4 GeneratedNSubRoom_Bigger biomeEncounterDepth 3',
  '7 GeneratedN biomeEncounterDepth 3',
  '9 GeneratedN biomeEncounterDepth 4',
  '11 GeneratedN_Bigger biomeEncounterDepth 5',
  '13 GeneratedN_Bigger biomeEncounterDepth 6',
  // Both O phases are prepared at room entry; only GeneratedO counts.
  '21 GeneratedO_Intro01 biomeEncounterDepth 1',
  '21 GeneratedO biomeEncounterDepth 1',
  '22 GeneratedO_Intro01 biomeEncounterDepth 2',
  '22 GeneratedO biomeEncounterDepth 2',
  '25 GeneratedO_Intro01 biomeEncounterDepth 3',
  '25 GeneratedO biomeEncounterDepth 3',
  '25 GeneratedO biomeEncounterDepth 3',
  // Devotion generates from its source room after both O_Combat05 phases counted.
  '26 DevotionTestO biomeEncounterDepth 5',
];
const UNDERWORLD_DEPTHS: readonly string[] = [
  '0 OpeningGeneratedF biomeDepthCache 0',
  '2 GeneratedF biomeDepthCache 2',
  '3 GeneratedF biomeDepthCache 3',
  '4 ArtemisCombatF2 biomeDepthCache 4',
  '8 GeneratedF biomeDepthCache 8',
  '9 GeneratedF biomeDepthCache 9',
  '10 GeneratedF biomeDepthCache 10',
  '16 GeneratedG biomeDepthCache 3',
  '19 GeneratedG biomeDepthCache 6',
  '21 GeneratedG biomeDepthCache 8',
  // Every H cage is prepared at room entry, before any cage counts.
  '26 GeneratedH_PassiveSmall biomeDepthCache 2',
  '26 GeneratedH biomeEncounterDepth 1',
  '26 GeneratedH biomeEncounterDepth 1',
  '29 GeneratedH_Passive biomeDepthCache 5',
  '29 GeneratedH biomeEncounterDepth 4',
  '29 GeneratedH biomeEncounterDepth 4',
  '29 GeneratedH_Screamer2 biomeEncounterDepth 4',
  '34 GeneratedI_SmallChronosIntro biomeDepthCache 2',
  '35 GeneratedI_GoalReward biomeDepthCache 3',
  '36 GeneratedI_Small_GoalReward biomeDepthCache 4',
  '37 GeneratedI_GoalReward biomeDepthCache 5',
  '38 GeneratedI_GoalReward biomeDepthCache 6',
];

describe('generated encounter inverse', () => {
  const surface = fixture('surface');
  const surfaceContext = (biomeEncounterDepth: number, roomName = 'N_Combat') =>
    recordContext(surface, roomName, { biomeDepthCache: biomeEncounterDepth, biomeEncounterDepth });

  it('infers the shared highlight, per-wave additions, canonical allocations and Fangs', () => {
    const observed = surface.rooms[11]!.encounters[0]!;
    const result = invert(policy('GeneratedN_Bigger'), surfaceContext(5), observed);
    expect(result).toEqual({
      kind: 'match',
      customization: {
        kind: 'generated',
        waveCount: 3,
        highlightKey: 'Mudman',
        waves: [
          {
            waveIndex: 1,
            typeKeys: ['ZombieSpawner_Elite', 'ZombieHeavyRanged'],
            allocations: { Mudman: 41, ZombieSpawner_Elite: 90 },
          },
          {
            waveIndex: 2,
            typeKeys: ['Zombie', 'ZombieSpawner_Elite'],
            allocations: { Mudman: 41, Zombie: 24 },
          },
          {
            waveIndex: 3,
            typeKeys: ['ZombieAssassin', 'Carrion_Elite'],
            allocations: { Mudman: 123, ZombieAssassin: 90 },
          },
        ],
        fangs: { typeKey: 'ZombieSpawner_Elite', perkKeys: ['HeavyArmor', 'Orbit'] },
      },
    });
  });

  it('keeps a declared fixed leading wave and authors only the generated suffix', () => {
    const selection = policy('RadiatorIntro');
    const context = { biomeDepthCache: 3, biomeEncounterDepth: 3, knownRunBlacklist: [] };
    const observed = observe(
      selection,
      {
        kind: 'generated',
        waveCount: 2,
        waves: [{ waveIndex: 2, typeKeys: ['Guard'], allocations: { Radiator: 21 } }],
      },
      context,
    );
    const result = invert(selection, context, observed);
    expect(result.kind).toBe('match');
    if (result.kind !== 'match') return;
    expect(result.customization.highlightKey).toBeUndefined();
    expect(result.customization.waves!.map((wave) => wave.waveIndex)).toEqual([2]);
    expect(observe(selection, result.customization, context)).toEqual(observed);
    const [fixed, ...rest] = observed.waves!;
    const altered: RunRecordEncounter = {
      ...observed,
      waves: [{ ...fixed!, spawns: [{ ...fixed!.spawns[0]!, count: 6 }] }, ...rest],
    };
    expect(invert(selection, context, altered)).toEqual({
      kind: 'noMatch',
      mismatch: { reason: 'fixedWave', waveIndex: 1 },
    });
  });

  it('reproduces a capped member spilling its spare difficulty into the earlier type', () => {
    const selection = policy('GeneratedN');
    const context = { ...surfaceContext(6), fangsRank: 0 };
    const value: AuthoredGeneratedEncounterCustomization = {
      kind: 'generated',
      waveCount: 1,
      waves: [
        {
          waveIndex: 1,
          typeKeys: ['Carrion', 'ZombieSpawner', 'Mudman'],
          // ZombieSpawner caps at 4 (160) and spills its spare 53 as 5 Carrion.
          allocations: { Carrion: 11, ZombieSpawner: 213 },
        },
      ],
    };
    const observed = observe(selection, value, context);
    expect(observed.waves![0]!.spawns.map((spawn) => spawn.count)).toEqual([
      6,
      4,
      expect.any(Number),
    ]);
    const result = invert(selection, context, observed);
    // Canonically the earlier type keeps the largest own count and the capped type the smallest spill.
    expect(result).toMatchObject({
      kind: 'match',
      customization: { waves: [{ allocations: { Carrion: 44, ZombieSpawner: 182 } }] },
    });
    if (result.kind === 'match')
      expect(observe(selection, result.customization, context)).toEqual(observed);
  });

  it('chooses the upper end of each count interval as the canonical allocation', () => {
    const selection = policy('GeneratedN');
    const context = { ...surfaceContext(3), fangsRank: 0 };
    const sampled = (request: number) =>
      observe(
        selection,
        {
          kind: 'generated',
          waveCount: 1,
          waves: [
            { waveIndex: 1, typeKeys: ['Zombie', 'Carrion'], allocations: { Zombie: request } },
          ],
        },
        context,
      );
    // Every request in (18, 24] spawns four Zombies.
    for (const request of [18.5, 21, 24]) {
      const result = invert(selection, context, sampled(request));
      expect(result).toMatchObject({
        kind: 'match',
        customization: { waves: [{ allocations: { Zombie: 24 } }] },
      });
    }
  });

  it('derives the variable base roll from the wave difficulty', () => {
    const selection = policy('GeneratedP_PreCombat');
    const context = { biomeDepthCache: 4, biomeEncounterDepth: 4, knownRunBlacklist: [] };
    const initial = assessGeneratedEncounter(selection, { kind: 'generated' }, context);
    expect(initial.budgetDomain).toBeDefined();
    const base = {
      kind: 'generated' as const,
      baseRoll: 417,
      waveCount: selection.waveCount.min,
    };
    const value = initialized(selection, context, base);
    const observed = observe(selection, value, context);
    const result = invert(selection, context, without(observed, 'difficulty'));
    expect(result).toMatchObject({ kind: 'match', customization: { baseRoll: 417 } });
  });

  it('returns a typed mismatch rather than an unverified guess', () => {
    const selection = policy('GeneratedN_Bigger');
    const observed = surface.rooms[11]!.encounters[0]!;
    const context = surfaceContext(5);
    const recount = (wave: number, spawn: number, count: number): RunRecordEncounter => ({
      ...observed,
      waves: observed.waves!.map((entry, waveIndex) => ({
        ...entry,
        spawns: entry.spawns.map((item, index) =>
          waveIndex === wave && index === spawn ? { ...item, count } : item,
        ),
      })),
    });
    // The remainder member's count follows from the earlier ones.
    expect(invert(selection, context, recount(1, 2, 2))).toEqual({
      kind: 'noMatch',
      mismatch: { reason: 'counts', waveIndex: 2 },
    });
    expect(invert(selection, { ...context, hordesRank: 2 }, observed)).toEqual({
      kind: 'noMatch',
      mismatch: { reason: 'budget' },
    });
    expect(
      invert(selection, context, {
        ...observed,
        waves: [
          observed.waves![0]!,
          { ...observed.waves![1]!, spawns: observed.waves![1]!.spawns.slice(1) },
          observed.waves![2]!,
        ],
      }),
    ).toMatchObject({ kind: 'noMatch', mismatch: { reason: 'highlight' } });
    expect(invert(selection, context, without(observed, 'fangs'))).toEqual({
      kind: 'noMatch',
      mismatch: { reason: 'fangs', issue: 'missing' },
    });
    expect(
      invert(selection, context, {
        ...observed,
        fangs: { ...observed.fangs, Carrion_Elite: ['Blink'] },
      }),
    ).toEqual({ kind: 'noMatch', mismatch: { reason: 'fangs', issue: 'ambiguous' } });
    expect(
      invert(selection, context, {
        ...observed,
        waves: [
          {
            ...observed.waves![0]!,
            spawns: [
              ...observed.waves![0]!.spawns,
              { enemy: 'Boar_Shadow', count: 1, miniBossShrine: true },
            ],
          },
          ...observed.waves!.slice(1),
        ],
      }),
    ).toEqual({
      kind: 'noMatch',
      mismatch: { reason: 'unexpectedSpawn', waveIndex: 1, enemy: 'Boar_Shadow' },
    });
  });
});

function without(encounter: RunRecordEncounter, field: 'difficulty' | 'fangs'): RunRecordEncounter {
  const copy = { ...encounter };
  delete copy[field];
  return copy;
}

/** A complete starting composition at a given base roll, via the engine's initializer domain. */
function initialized(
  selection: GeneratedEncounterSelection,
  context: EncounterGenerationContext,
  base: AuthoredGeneratedEncounterCustomization,
): AuthoredGeneratedEncounterCustomization {
  const assessment = assessGeneratedEncounter(selection, base, context);
  const wave = assessment.waves[0]!;
  const typeKeys = [wave.eligibleKeysByPosition[0]![0]!];
  const withTypes = { ...base, waves: [{ waveIndex: wave.waveIndex, typeKeys }] };
  const typed = assessGeneratedEncounter(selection, withTypes, context).waves[0]!;
  const more = typed.eligibleKeysByPosition[1]?.[0];
  const keys = more === undefined ? typeKeys : [...typeKeys, more];
  const shaped = { ...base, waves: [{ waveIndex: wave.waveIndex, typeKeys: keys }] };
  const allocations = assessGeneratedEncounter(selection, shaped, context).waves[0]!
    .equalAllocations;
  return {
    ...shaped,
    waves: [{ waveIndex: wave.waveIndex, typeKeys: keys, ...(allocations ? { allocations } : {}) }],
  };
}

describe('infinite roster inverse', () => {
  const selection = decision('GeneratedAnomalyB') as InfiniteRosterSelection;
  const assess = (typeKeys: readonly string[]) =>
    assessInfiniteRoster(selection, typeKeys, { biomeDepthCache: 3 });
  const spawn = (key: string) => ({
    enemy: selection.choices.find((choice) => choice.key === key)!.nativeId,
    infinite: true as const,
  });

  it('reads the ordered roster and verifies it', () => {
    const typeKeys = assess([]).eligibleKeysByPosition[0]!.slice(0, 2);
    expect(
      invertInfiniteRoster(selection, assess, {
        name: 'GeneratedAnomalyB',
        waves: [{ spawns: typeKeys.map(spawn) }],
      }),
    ).toEqual({ kind: 'match', customization: { kind: 'infiniteRoster', typeKeys } });
  });

  it('rejects a roster with a non-infinite spawn', () => {
    const [key] = assess([]).eligibleKeysByPosition[0]!;
    expect(
      invertInfiniteRoster(selection, assess, {
        name: 'GeneratedAnomalyB',
        waves: [{ spawns: [{ enemy: spawn(key!).enemy, count: 3 }] }],
      }),
    ).toEqual({
      kind: 'noMatch',
      mismatch: { reason: 'unexpectedSpawn', waveIndex: 1, enemy: spawn(key!).enemy },
    });
  });
});

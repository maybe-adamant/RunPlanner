import { describe, expect, it } from 'vitest';
import type {
  AuthoredEncounterCustomization,
  AuthoredGeneratedEncounterCustomization,
} from '@run-planner/engine/authored-project';
import {
  bindGeneratedEncounterEdits,
  removeLastEnemy,
  replaceWaveEnemies,
  setAllocation,
  setBaseRoll,
  setFangsPerks,
  setFangsTarget,
  setMenaceCount,
  setMenaceTarget,
  setSharedEnemy,
  setWaveCount,
} from '@planner/projections/structured-workspace/interactions/generated-encounter-edits';
import type { WorkspaceGeneratedEncounterAssessment } from '@planner/projections/structured-workspace';

type Generated = AuthoredGeneratedEncounterCustomization;

const composed: Generated = {
  kind: 'generated',
  waveCount: 3,
  highlightKey: 'Guard',
  waves: [{ waveIndex: 3, typeKeys: ['Brawler', 'Mage'], allocations: { Guard: 2, Brawler: 3 } }],
};
const complete: Generated = {
  ...composed,
  baseRoll: 70,
  fangs: { typeKey: 'Guard_Elite', perkKeys: ['Blink'] },
  menace: [{ waveIndex: 3, conversions: { Brawler: { count: 1 } } }],
};
const wave = (value: Generated, waveIndex: number) =>
  value.waves?.find((entry) => entry.waveIndex === waveIndex);

describe('generated encounter wave replacement', () => {
  it('carries allocations by position and keeps highlight allocations', () => {
    expect(
      replaceWaveEnemies(composed, 3, ['Radiator', 'Casket'], ['Guard'], ['Guard', 'Radiator']),
    ).toEqual({
      ...composed,
      waves: [
        { waveIndex: 3, typeKeys: ['Radiator', 'Casket'], allocations: { Guard: 2, Radiator: 3 } },
      ],
    });
  });
  it('drops allocations of members outside the sampled budget keys', () => {
    expect(
      wave(replaceWaveEnemies(composed, 3, ['Radiator', 'Casket'], ['Guard'], ['Guard']), 3),
    ).toEqual({ waveIndex: 3, typeKeys: ['Radiator', 'Casket'], allocations: { Guard: 2 } });
  });
  it('does not author an empty map for a sole native remainder', () => {
    expect(wave(replaceWaveEnemies(composed, 3, [], ['Guard'], []), 3)).toEqual({
      waveIndex: 3,
      typeKeys: [],
    });
  });
  it('authors no allocations when the replaced wave had none', () => {
    expect(
      replaceWaveEnemies(complete, 1, ['Guard', 'Brawler'], ['Guard'], ['Guard', 'Brawler']),
    ).toEqual({
      ...complete,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'] }, ...complete.waves!],
    });
  });
  it('keeps baseRoll, shared enemy, Fangs and Menace', () => {
    const next = replaceWaveEnemies(complete, 3, ['Mage'], ['Guard'], ['Guard']);
    expect(next).toMatchObject({
      baseRoll: 70,
      waveCount: 3,
      highlightKey: 'Guard',
      fangs: complete.fangs,
      menace: complete.menace,
    });
  });
});

describe('generated encounter shared enemy', () => {
  it('keeps initialized budgets when a shared enemy is first chosen', () => {
    const initialized: Generated = {
      kind: 'generated',
      waveCount: 3,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 65 } }],
    };
    expect(setSharedEnemy(initialized, 'Radiator')).toEqual({
      ...initialized,
      highlightKey: 'Radiator',
    });
  });
  it('moves an unlisted prior highlight allocation onto an unallocated new highlight', () => {
    const replaced: Generated = {
      ...composed,
      waves: [
        { waveIndex: 3, typeKeys: ['Radiator', 'Casket'], allocations: { Guard: 2, Radiator: 3 } },
      ],
    };
    expect(wave(setSharedEnemy(replaced, 'Brawler'), 3)?.allocations).toEqual({
      Brawler: 2,
      Radiator: 3,
    });
    // Allocation entry order reaches saved bytes; the transferred entry is appended.
    expect(Object.keys(wave(setSharedEnemy(replaced, 'Brawler'), 3)!.allocations!)).toEqual([
      'Radiator',
      'Brawler',
    ]);
  });
  it('never invents a shared-enemy allocation', () => {
    const unallocated: Generated = {
      ...composed,
      waves: [{ waveIndex: 3, typeKeys: ['Brawler', 'Mage'], allocations: { Brawler: 10 } }],
    };
    expect(setSharedEnemy(unallocated, 'Radiator')).toEqual({
      ...unallocated,
      highlightKey: 'Radiator',
    });
  });
  it('never guesses an orphan allocation belongs to the new shared enemy', () => {
    const orphan: Generated = {
      kind: 'generated',
      waveCount: 3,
      waves: [
        { waveIndex: 3, typeKeys: ['Brawler', 'Mage'], allocations: { Guard: 20, Brawler: 10 } },
      ],
    };
    expect(wave(setSharedEnemy(orphan, 'Radiator'), 3)?.allocations).toEqual({
      Guard: 20,
      Brawler: 10,
    });
  });
  it('preserves both budgets when the new shared enemy already has one', () => {
    const both: Generated = {
      ...composed,
      waves: [
        { waveIndex: 3, typeKeys: ['Brawler', 'Mage'], allocations: { Guard: 20, Brawler: 10 } },
      ],
    };
    const brawler = setSharedEnemy(both, 'Brawler');
    expect(wave(brawler, 3)?.allocations).toEqual({ Guard: 20, Brawler: 10 });
    expect(wave(setSharedEnemy(brawler, 'Radiator'), 3)?.allocations).toEqual({
      Guard: 20,
      Brawler: 10,
    });
  });
  it('keeps a listed prior highlight allocation with its listed type', () => {
    const listed: Generated = {
      ...composed,
      waves: [{ waveIndex: 3, typeKeys: ['Guard', 'Mage'], allocations: { Guard: 4 } }],
    };
    expect(wave(setSharedEnemy(listed, 'Radiator'), 3)?.allocations).toEqual({ Guard: 4 });
  });
  it('keeps Menace keyed to its source', () => {
    const value: Generated = {
      ...composed,
      menace: [{ waveIndex: 3, conversions: { Guard: { count: 1 } } }],
    };
    const next = setSharedEnemy(value, 'Radiator');
    expect(next.menace).toEqual([{ waveIndex: 3, conversions: { Guard: { count: 1 } } }]);
    expect(wave(next, 3)?.allocations).toEqual({ Radiator: 2, Brawler: 3 });
    expect(Object.keys(wave(next, 3)!.allocations!)).toEqual(['Brawler', 'Radiator']);
  });
});

describe('generated encounter scalar edits', () => {
  it('keeps waves, shared enemy, Fangs and Menace across a wave-count edit', () => {
    expect(setWaveCount(complete, 2)).toEqual({ ...complete, waveCount: 2 });
  });
  it('keeps every other field when the base roll changes', () => {
    expect(setBaseRoll(complete, 340)).toEqual({ ...complete, baseRoll: 340 });
  });
});

describe('generated encounter allocations', () => {
  it('sets one allocation and keeps the others', () => {
    expect(wave(setAllocation(composed, 3, 'Mage', 1.5), 3)?.allocations).toEqual({
      Guard: 2,
      Brawler: 3,
      Mage: 1.5,
    });
  });
  it('keeps over-requests exactly', () => {
    expect(wave(setAllocation(composed, 3, 'Guard', 10000), 3)?.allocations).toEqual({
      Guard: 10000,
      Brawler: 3,
    });
  });
  it('creates an absent wave row in index order', () => {
    const next = setAllocation(complete, 1, 'Guard', 5);
    expect(next.waves).toEqual([
      { waveIndex: 1, typeKeys: [], allocations: { Guard: 5 } },
      ...complete.waves!,
    ]);
    expect(next).toMatchObject({ fangs: complete.fangs, menace: complete.menace, baseRoll: 70 });
  });
  it('removes the last enemy with its allocation and no blank key', () => {
    const value: Generated = {
      kind: 'generated',
      waveCount: 1,
      waves: [
        {
          waveIndex: 1,
          typeKeys: ['Guard', 'Brawler', 'Mage', 'Guard_Elite', 'Brawler_Elite'],
          allocations: { Guard: 10, Brawler_Elite: 20 },
        },
      ],
    };
    expect(wave(removeLastEnemy(value, 1), 1)).toEqual({
      waveIndex: 1,
      typeKeys: ['Guard', 'Brawler', 'Mage', 'Guard_Elite'],
      allocations: { Guard: 10 },
    });
  });
  it('omits the allocation map when removing the last allocated enemy', () => {
    const value: Generated = {
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Brawler: 20 } }],
    };
    expect(removeLastEnemy(value, 1)).toEqual({
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard'] }],
    });
  });
  it('removes an unallocated last enemy without authoring a map', () => {
    const value: Generated = {
      kind: 'generated',
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'] }],
    };
    expect(wave(removeLastEnemy(value, 1), 1)).toEqual({ waveIndex: 1, typeKeys: ['Guard'] });
  });
});

describe('generated encounter Fangs', () => {
  it('keeps perks when the target is replaced', () => {
    expect(
      setFangsTarget(
        { ...composed, fangs: { typeKey: 'Brawler_Elite', perkKeys: ['Blink'] } },
        'Guard_Elite',
      ).fangs,
    ).toEqual({ typeKey: 'Guard_Elite', perkKeys: ['Blink'] });
  });
  it('starts a first target without perks', () => {
    expect(setFangsTarget(composed, 'Guard_Elite')).toEqual({
      ...composed,
      fangs: { typeKey: 'Guard_Elite', perkKeys: [] },
    });
  });
  it('replaces perks on the authored target', () => {
    expect(setFangsPerks(complete, ['Blink', 'Shield'])).toEqual({
      ...complete,
      fangs: { typeKey: 'Guard_Elite', perkKeys: ['Blink', 'Shield'] },
    });
  });
  it('leaves the value unchanged without an authored target', () => {
    expect(setFangsPerks(composed, ['Blink'])).toBe(composed);
  });
});

describe('generated encounter Menace', () => {
  it('chooses a replacement with a default count and keeps other sources', () => {
    expect(setMenaceTarget(complete, 3, 'Mage', 'GoldElemental').menace).toEqual([
      {
        waveIndex: 3,
        conversions: { Brawler: { count: 1 }, Mage: { count: 0, targetKey: 'GoldElemental' } },
      },
    ]);
  });
  it('keeps the authored count when the replacement changes', () => {
    const counted = setMenaceCount(complete, 3, 'Brawler', 2);
    expect(setMenaceTarget(counted, 3, 'Brawler', 'Treant').menace).toEqual([
      { waveIndex: 3, conversions: { Brawler: { count: 2, targetKey: 'Treant' } } },
    ]);
  });
  it('keeps the replacement and authors excessive counts exactly', () => {
    const targeted = setMenaceTarget(complete, 3, 'Brawler', 'Treant');
    expect(setMenaceCount(targeted, 3, 'Brawler', 999).menace).toEqual([
      { waveIndex: 3, conversions: { Brawler: { count: 999, targetKey: 'Treant' } } },
    ]);
  });
  it('adds a wave conversion in index order and keeps other fields', () => {
    const next = setMenaceCount(complete, 1, 'Guard', 1);
    expect(next.menace).toEqual([
      { waveIndex: 1, conversions: { Guard: { count: 1 } } },
      ...complete.menace!,
    ]);
    expect(next).toMatchObject({ waves: complete.waves, fangs: complete.fangs, baseRoll: 70 });
  });
});

describe('bound generated encounter edits', () => {
  const assessment: WorkspaceGeneratedEncounterAssessment = {
    issues: [],
    composition: 'active',
    sharedEnemy: true,
    warnings: [],
    waves: [
      {
        waveIndex: 3,
        additionalTypeCount: { min: 1, max: 2 },
        seeds: [
          { key: 'Guard', kind: 'highlight' },
          { key: 'Fixed', kind: 'fixed' },
        ],
        sampledBudgetKeys: ['Guard', 'Radiator'],
      },
    ],
  };
  const bind = (value: Generated, published: WorkspaceGeneratedEncounterAssessment | undefined) => {
    const values: AuthoredEncounterCustomization[] = [];
    const edits = bindGeneratedEncounterEdits(value, published, (next) => {
      values.push(next);
      return {
        command: {
          kind: 'ReplaceEncounterCustomization',
          phase: undefined as never,
          decisionKey: 'generatedComposition',
          value: next,
        },
      };
    });
    return { edits, values };
  };
  it('binds each edit to the current authored value', () => {
    const { edits } = bind(complete, assessment);
    expect(edits.setWaveCount(2).command.value).toEqual({ ...complete, waveCount: 2 });
    expect(edits.setMenaceCount(3, 'Brawler', 4).command.value).toEqual(
      setMenaceCount(complete, 3, 'Brawler', 4),
    );
  });
  it('reads wave highlight seeds from the published assessment', () => {
    const { edits, values } = bind(composed, assessment);
    edits.replaceWaveEnemies(3, ['Radiator', 'Casket'], ['Guard', 'Radiator']);
    expect(wave(values[0] as Generated, 3)?.allocations).toEqual({ Guard: 2, Radiator: 3 });
    const unassessed = bind(composed, undefined);
    unassessed.edits.replaceWaveEnemies(3, ['Radiator', 'Casket'], ['Guard', 'Radiator']);
    expect(wave(unassessed.values[0] as Generated, 3)?.allocations).toEqual({ Radiator: 3 });
  });
});

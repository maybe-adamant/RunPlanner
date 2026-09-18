import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { normalizeEncounterGeneration } from '../../src/compiler/encounters/generation';

const definitions = catalog.encounterDefinitions.values.filter((definition) =>
  definition.customization?.some((decision) => decision.selection.kind === 'generated'),
);
function selection(key: string) {
  const value = definitions.find((definition) => definition.key === key)?.customization?.[0]
    ?.selection;
  if (value?.kind !== 'generated') throw new Error(key);
  return value;
}

describe('source-declared generated encounter policies', () => {
  it('covers the audited 39 concrete identities without boss/prescribed vignettes', () => {
    expect(definitions).toHaveLength(39);
    expect(definitions.every((definition) => definition.kind === 'combat')).toBe(true);
    expect(
      definitions
        .filter((definition) => selection(definition.key).preparation === 'rewardGeneration')
        .map((definition) => definition.key)
        .sort(),
    ).toEqual(['DevotionTestF', 'DevotionTestG', 'DevotionTestI', 'DevotionTestO']);
    for (const definition of definitions) {
      const policy = selection(definition.key);
      expect(Object.isFrozen(policy)).toBe(true);
      expect(
        policy.choices.every((enemy) => Object.isFrozen(enemy) && enemy.label.length > 0),
      ).toBe(true);
      expect(new Set(policy.choices.map((enemy) => enemy.nativeId)).size).toBe(
        policy.choices.length,
      );
    }
  });
  it('retains exact NPC, template, depth and pool differences', () => {
    expect(selection('ArtemisCombatF')).toMatchObject({
      waveCount: { min: 4, max: 4 },
      blockHighlightElites: true,
    });
    expect(selection('HeraclesCombatO').choices.map((enemy) => enemy.key)).toContain('Scimiterror');
    expect(selection('GeneratedO_Intro01').choices.map((enemy) => enemy.key)).toContain(
      'ZombieCrewman',
    );
    expect(selection('HeraclesCombatO').choices.map((enemy) => enemy.key)).not.toContain(
      'ZombieCrewman',
    );
    expect(selection('GeneratedH_Treant2').fixedEnemies).toMatchObject([
      { key: 'Treant2', elite: true },
    ]);
    expect(selection('GeneratedH_Screamer2').fixedEnemies).toMatchObject([
      { key: 'Screamer2', elite: true },
    ]);
    expect(selection('GeneratedN').types).toMatchObject({
      depthAxis: 'biomeEncounterDepth',
      escalate: true,
    });
    expect(selection('GeneratedP').maxTypesPerGroup).toEqual({ Automatons: 1, ChronosForces: 2 });
    expect(selection('GeneratedP_PreCombat').maxTypesPerGroup).toEqual({
      Automatons: 1,
      ChronosForces: 1,
    });
  });
  it('rejects malformed declaration boundaries', () => {
    const base = selection('GeneratedF');
    expect(() =>
      normalizeEncounterGeneration({ ...base, waveCount: { min: 3, max: 2 } }, 'test'),
    ).toThrow();
    expect(() =>
      normalizeEncounterGeneration(
        { ...base, choices: [base.choices[0]!, base.choices[0]!] },
        'test',
      ),
    ).toThrow();
    expect(() =>
      normalizeEncounterGeneration(
        { ...base, types: { ...base.types, depthRamp: Number.NaN } },
        'test',
      ),
    ).toThrow();
  });
});

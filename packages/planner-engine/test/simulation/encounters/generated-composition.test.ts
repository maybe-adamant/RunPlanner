import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import type { AuthoredGeneratedEncounterCustomization } from '../../../src/authored-project/model';
import {
  assessGeneratedEncounter,
  initializeGeneratedEncounter,
} from '../../../src/simulation/encounters/generation';

function policy(key: string) {
  const value = catalog.encounterDefinitions.byKey[key]?.customization?.find(
    (entry) => entry.selection.kind === 'generated',
  )?.selection;
  if (value?.kind !== 'generated') throw new Error(`Missing generation policy ${key}`);
  return value;
}
function assess(
  key: string,
  value: Omit<AuthoredGeneratedEncounterCustomization, 'kind'>,
  depth = 8,
  encounters = depth,
  blacklist: readonly string[] = [],
) {
  return assessGeneratedEncounter(
    policy(key),
    { kind: 'generated', ...value },
    { biomeDepthCache: depth, biomeEncounterDepth: encounters, knownRunBlacklist: blacklist },
  );
}

describe('native generated composition possibility', () => {
  it('initializes every supported profile into a complete publishable composition', () => {
    const profiles = Object.entries(catalog.encounterDefinitions.byKey).flatMap(
      ([definitionKey, definition]) =>
        (definition.customization ?? []).flatMap((decision) =>
          decision.selection.kind === 'generated'
            ? [{ definitionKey, policy: decision.selection }]
            : [],
        ),
    );
    expect(profiles).toHaveLength(39);
    for (const { definitionKey, policy: profile } of profiles) {
      const context = {
        biomeDepthCache: 8,
        biomeEncounterDepth: 8,
        knownRunBlacklist: [],
      };
      const value = initializeGeneratedEncounter(profile, context);
      expect(value, definitionKey).toBeDefined();
      const assessment = assessGeneratedEncounter(profile, value!, context);
      expect(assessment.operands, definitionKey).toBeDefined();
      expect(assessment.operands!.waves).toHaveLength(assessment.operands!.waveCount);
      expect(
        assessment.operands!.waves.every(
          (wave) => Object.keys(wave.counts).length === wave.typeKeys.length,
        ),
      ).toBe(true);
    }
  });
  it('bounds backtracking at native pool exhaustion without fabricating a dead slot', () => {
    const source = policy('GeneratedF');
    const onlyChoice = source.choices.find((choice) => !choice.blockSolo)!;
    const constrained = {
      ...source,
      waveCount: { min: 1, max: 1 },
      types: { ...source.types, min: 2, max: 2, depthRamp: 0, cap: 2 },
      choices: [onlyChoice],
    };
    const context = { biomeDepthCache: 8, biomeEncounterDepth: 8, knownRunBlacklist: [] };
    const value = initializeGeneratedEncounter(constrained, context);
    expect(value).toMatchObject({
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: [onlyChoice.key] }],
    });
    expect(assessGeneratedEncounter(constrained, value!, context)).toMatchObject({
      supported: true,
      operands: { waves: [{ typeKeys: [onlyChoice.key] }] },
    });
  });
  it('classifies editable budget members independently of the native remainder', () => {
    expect(
      assess('GeneratedF', {
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'] }],
      }).waves[0]?.sampledBudgetKeys,
    ).toEqual(['Guard']);
    expect(
      assess('GeneratedF', {
        waveCount: 3,
        highlightKey: 'Guard',
        waves: [{ waveIndex: 1, typeKeys: [] }],
      }).waves[0]?.sampledBudgetKeys,
    ).toEqual([]);
    expect(
      assess('GeneratedH_Treant2', {
        waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'] }],
      }).waves[0]?.sampledBudgetKeys,
    ).toEqual(['FogEmitter2']);
  });

  it('suggests equal remaining-budget samples without authoring the native remainder', () => {
    expect(
      assess('GeneratedF', {
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'] }],
      }).waves[0]?.equalAllocations,
    ).toEqual({ Guard: 87.5 });
    expect(
      assess('GeneratedH_Treant2', {
        waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'] }],
      }).waves[0]?.equalAllocations,
    ).toEqual({ FogEmitter2: 466 });
    expect(
      assess('GeneratedP_PreCombat', {}).waves.every((wave) => wave.equalAllocations === undefined),
    ).toBe(true);
  });

  it('derives native wave patterns from catalog budget facts and effective Hordes', () => {
    const result = assessGeneratedEncounter(
      policy('GeneratedF'),
      { kind: 'generated', waveCount: 3, highlightKey: 'Guard' },
      {
        biomeDepthCache: 8,
        biomeEncounterDepth: 8,
        knownRunBlacklist: [],
        hordesRank: 1,
        hard: false,
      },
    );
    expect(result.budget?.kind).toBe('exact');
    expect((result.budget?.waveBudgets as readonly number[])[2]).toBeCloseTo(115.5);
  });

  it('keeps P incomplete until an explicit base roll resolves its budget', () => {
    expect(assess('GeneratedP_PreCombat', {}).budget).toMatchObject({
      kind: 'range',
    });
    expect(assess('GeneratedP_PreCombat', { baseRoll: 412 }).budget).toMatchObject({
      kind: 'exact',
    });
  });

  it('retains the budget domain for invalid values and unresolved wave counts', () => {
    const native = assess('GeneratedP_PreCombat', {});
    const invalid = assess('GeneratedP_PreCombat', { baseRoll: 9999 });
    expect(native.budgetDomain?.baseRoll).toEqual({ min: 340, max: 500 });
    expect(invalid.budgetDomain).toEqual(native.budgetDomain);
    expect(invalid.budget).toBeUndefined();
    expect(invalid.issues).toContainEqual({ reason: 'baseRoll', actual: 9999 });
    expect(assess('GeneratedF', {}).budgetDomain).toBeUndefined();
  });

  it('previews ordered explicit slices and leaves incomplete samples unresolved', () => {
    const explicit = assess('GeneratedF', {
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 70 } }],
    });
    expect(explicit.waves[0]?.countPreview).toMatchObject([
      { key: 'Guard', requested: 70, effective: 70, count: 14 },
      { key: 'Brawler', effective: 105, count: 6 },
    ]);
    const native = assess('GeneratedF', {
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'] }],
    });
    expect(native.waves[0]?.countPreview?.[0]).toEqual({ key: 'Guard' });
  });

  it('mirrors native capped redistribution without inventing counts around a default sample', () => {
    const source = policy('GeneratedF');
    const guard = source.choices.find((choice) => choice.key === 'Guard')!;
    const fog = policy('GeneratedH').choices.find((choice) => choice.key === 'FogEmitter2')!;
    const capped = (base: number, allocation: number) =>
      assessGeneratedEncounter(
        {
          ...source,
          waveCount: { min: 1, max: 1 },
          types: { ...source.types, min: 2, max: 2, depthRamp: 0, cap: 2 },
          choices: [guard, fog],
          budget: { ...source.budget, base, depthRamp: 0 },
        },
        {
          kind: 'generated',
          waves: [
            {
              waveIndex: 1,
              typeKeys: ['Guard', 'FogEmitter2'],
              allocations: { Guard: allocation },
            },
          ],
        },
        { biomeDepthCache: 0, biomeEncounterDepth: 0, knownRunBlacklist: [] },
      );
    // A capped type with exactly one allowed spawn does not become the spare
    // target; only an earlier uncapped generated entry can receive surplus.
    expect(capped(100, 20).waves[0]?.countPreview).toMatchObject([
      { key: 'Guard', count: 4 },
      { key: 'FogEmitter2', effective: 80, count: 1 },
    ]);
    // Native uses a strict `>` comparison: spare difficulty equal to the
    // earlier Guard cost must not add another Guard.
    expect(capped(105, 20).waves[0]?.countPreview).toMatchObject([
      { key: 'Guard', count: 4 },
      { key: 'FogEmitter2', effective: 85, count: 1 },
    ]);
    const unknown = capped(105, 20);
    const withDefaultSample = assessGeneratedEncounter(
      { ...policy('GeneratedH'), waveCount: { min: 1, max: 1 } },
      { kind: 'generated', waves: [{ waveIndex: 1, typeKeys: ['BrokenHearted', 'FogEmitter2'] }] },
      { biomeDepthCache: 8, biomeEncounterDepth: 8, knownRunBlacklist: [] },
    );
    expect(unknown.supported).toBe(true);
    expect(withDefaultSample.waves[0]?.countPreview).toEqual([
      { key: 'BrokenHearted' },
      { key: 'FogEmitter2' },
    ]);
  });
  it('retains partial rows while reporting every missing completion field', () => {
    const row = {
      waveIndex: 3,
      typeKeys: ['Brawler', 'Mage'],
      allocations: { Guard: 2, Brawler: 3 },
    };
    expect(assess('GeneratedF', {}).operands).toBeUndefined();
    const dormant = assess('GeneratedF', { waves: [row] });
    expect(dormant).toMatchObject({
      supported: false,
      composition: 'missingWaveCount',
      knownRunBlacklistAdditions: [],
    });
    expect(dormant.operands).toBeUndefined();
    expect(assess('GeneratedF', { waveCount: 3, waves: [row] })).toMatchObject({
      supported: false,
      composition: 'missingHighlight',
    });
    expect(assess('GeneratedF', { highlightKey: 'Guard', waves: [row] }).issues).toContainEqual({
      reason: 'required',
      field: 'waveCount',
    });
    expect(
      assess('GeneratedF', { waveCount: 3, highlightKey: 'Guard', waves: [row] }).operands,
    ).toBeUndefined();
    expect(
      assess('GeneratedF', { waveCount: 2, highlightKey: 'Guard', waves: [row] }).issues,
    ).toContainEqual({ reason: 'required', field: 'wave', waveIndex: 1 });
  });

  it('exposes only reachable fixed-capacity slots and marks native pool exhaustion', () => {
    const generated = assess('GeneratedF', { waveCount: 3, highlightKey: 'Guard' });
    expect(generated.waves).toMatchObject([
      {
        typeCount: { min: 1, max: 1 },
        additionalTypeCount: { min: 0, max: 0 },
        seeds: [{ key: 'Guard', kind: 'highlight' }],
        eligibleKeysByPosition: [],
      },
      {
        typeCount: { min: 2, max: 2 },
        additionalTypeCount: { min: 1, max: 1 },
        seeds: [{ key: 'Guard', kind: 'highlight' }],
      },
      {
        typeCount: { min: 3, max: 3 },
        additionalTypeCount: { min: 2, max: 2 },
        // The next slot is reachable; the suffix is not a fabricated domain.
        eligibleKeysByPosition: expect.any(Array),
      },
    ]);
    expect(generated.waves[2]?.eligibleKeysByPosition).toHaveLength(1);

    const source = policy('GeneratedF');
    const onlyChoice = source.choices.find((choice) => !choice.blockSolo)!;
    const exhausted = assessGeneratedEncounter(
      {
        ...source,
        waveCount: { min: 1, max: 1 },
        types: { ...source.types, min: 2, max: 2, depthRamp: 0 },
        choices: [onlyChoice],
      },
      { kind: 'generated', waves: [{ waveIndex: 1, typeKeys: [onlyChoice.key] }] },
      { biomeDepthCache: 8, biomeEncounterDepth: 8, knownRunBlacklist: [] },
    );
    expect(exhausted).toMatchObject({ supported: true, waves: [{ exhausted: true }] });
    expect(exhausted.waves[0]?.eligibleKeysByPosition).toEqual([[onlyChoice.key], []]);

    const underfilled = assess('GeneratedF', {
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: [] }],
    });
    expect(underfilled.issues.filter((issue) => issue.reason === 'typeCount')).toHaveLength(1);
    expect(underfilled.issues).toContainEqual({
      reason: 'typeCount',
      waveIndex: 1,
      actual: 0,
      allowed: { min: 2, max: 3 },
    });
  });

  it('uses native highlight escalation and exact depth axes', () => {
    expect(
      assess('GeneratedF', { waveCount: 3, highlightKey: 'Guard' }).waves.map(
        (wave) => wave.typeCount,
      ),
    ).toEqual([
      { min: 1, max: 1 },
      { min: 2, max: 2 },
      { min: 3, max: 3 },
    ]);
    expect(
      assess('GeneratedN', { waveCount: 2, highlightKey: 'Zombie' }, 20, 0).waves.map(
        (wave) => wave.typeCount,
      ),
    ).toEqual([
      { min: 2, max: 2 },
      { min: 2, max: 2 },
    ]);
    expect(
      assess('GeneratedN', { waveCount: 2, highlightKey: 'Zombie' }, 1, 5).waves.map(
        (wave) => wave.typeCount,
      ),
    ).toEqual([
      { min: 3, max: 3 },
      { min: 3, max: 3 },
    ]);
    expect(assess('GeneratedF', { waveCount: 1, highlightKey: 'Guard' }).operands).toBeUndefined();
  });

  it('checks seed exclusions, elite limits, solo restrictions and preparation depth', () => {
    expect(
      assess('GeneratedF', { waveCount: 2, highlightKey: 'Guard_Elite' }, 2).issues,
    ).toContainEqual(expect.objectContaining({ reason: 'highlight' }));
    expect(
      assess('GeneratedF', { waveCount: 2, highlightKey: 'Guard_Elite' }, 3).issues,
    ).not.toContainEqual(expect.objectContaining({ reason: 'highlight' }));
    expect(assess('ArtemisCombatF', { highlightKey: 'Guard_Elite' }).issues).toContainEqual(
      expect.objectContaining({ reason: 'highlight' }),
    );
    expect(
      assess('GeneratedF', {
        waveCount: 2,
        highlightKey: 'Guard',
        waves: [{ waveIndex: 2, typeKeys: ['Guard_Elite'] }],
      }).supported,
    ).toBe(false);
    expect(
      assess('GeneratedF', {
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['Guard_Elite', 'Brawler_Elite'] }],
      }).supported,
    ).toBe(false);
    expect(
      assess('GeneratedH', { waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2', 'Lamia'] }] })
        .supported,
    ).toBe(false); // deterministic three types, pool still available
  });

  it('applies cross-wave counterpart exclusion but does not invent prior native rosters', () => {
    const last = { waveIndex: 3, typeKeys: ['Brawler_Elite', 'Mage'] };
    expect(
      assess('GeneratedF', { waveCount: 3, highlightKey: 'Guard', waves: [last] }).issues.some(
        (issue) => issue.reason === 'enemyUnavailable',
      ),
    ).toBe(false);
    expect(
      assess('GeneratedF', {
        waveCount: 3,
        highlightKey: 'Guard',
        waves: [{ waveIndex: 2, typeKeys: ['Brawler'] }, last],
      }).supported,
    ).toBe(false);
    expect(
      assess('GeneratedF', {
        waveCount: 3,
        highlightKey: 'Guard',
        waves: [
          { waveIndex: 2, typeKeys: ['Brawler'] },
          { waveIndex: 3, typeKeys: ['Brawler', 'Mage'] },
        ],
      }).issues.some((issue) => issue.reason === 'enemyUnavailable'),
    ).toBe(false);
  });

  it('prunes P groups after additions rather than rejecting a native-valid seed plus first filler', () => {
    const value = {
      waveCount: 2,
      highlightKey: 'SentryBot',
      waves: [{ waveIndex: 2, typeKeys: ['AutomatonBeamer'] }],
    };
    expect(
      assess('GeneratedP', value).issues.some((issue) => issue.reason === 'enemyUnavailable'),
    ).toBe(false);
    const third = assess('GeneratedP_Large', {
      highlightKey: 'SentryBot',
      waves: [{ waveIndex: 3, typeKeys: ['AutomatonBeamer', 'AutomatonEnforcer'] }],
    });
    expect(third.supported).toBe(false);
    expect(third.waves[2]?.eligibleKeysByPosition[1]).not.toContain('AutomatonEnforcer');
  });

  it('preserves fixed H elite seeds and their separate placeholder semantics', () => {
    const row = { waveIndex: 1, typeKeys: ['FogEmitter2'], allocations: { FogEmitter2: 1 } };
    const mixed = assess('GeneratedH_Treant2', { waves: [row] });
    expect(mixed).toMatchObject({ supported: true, knownRunBlacklistAdditions: [] });
    expect(mixed.operands?.waves).toEqual([
      expect.objectContaining({
        typeKeys: ['Treant2', 'FogEmitter2'],
        sources: { Treant2: 'fixed', FogEmitter2: 'template' },
        counts: { Treant2: 1, FogEmitter2: 1 },
      }),
    ]);
    expect(mixed.waves[0]?.eligibleKeysByPosition[0]).not.toContain('Lamia_Elite');
    expect(
      assess('GeneratedH_Treant2', { waves: [{ waveIndex: 1, typeKeys: ['Lamia_Elite'] }] })
        .supported,
    ).toBe(false);
    expect(assess('GeneratedH_Treant2', { waves: [row] }).operands?.waves[0]?.counts).toEqual({
      Treant2: 1,
      FogEmitter2: 1,
    });
    expect(mixed.waves[0]?.countPreview).toEqual([
      { key: 'Treant2', count: 1 },
      { key: 'FogEmitter2', requested: 1, effective: 80, count: 1 },
    ]);
  });

  it('records known run blacklist consequences only for valid ordinary additions', () => {
    const value = {
      waves: [
        {
          waveIndex: 1,
          typeKeys: ['FogEmitter2', 'Lamia', 'Mourner'],
          allocations: { FogEmitter2: 10, Lamia: 10 },
        },
      ],
    };
    expect(assess('GeneratedH', value)).toMatchObject({
      supported: true,
      knownRunBlacklistAdditions: ['FogEmitter2'],
    });
    expect(assess('GeneratedH', value, 8, 8, ['FogEmitter2']).issues).toContainEqual(
      expect.objectContaining({ reason: 'enemyUnavailable', key: 'FogEmitter2' }),
    );
    expect(
      assess('GeneratedH', { waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'] }] })
        .knownRunBlacklistAdditions,
    ).toEqual([]);
    expect(assess('GeneratedH', {}).knownRunBlacklistAdditions).toEqual([]);
  });
});

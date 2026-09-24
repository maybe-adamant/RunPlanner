import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  assessGeneratedEncounter,
  initializeGeneratedEncounter,
} from '../../../src/simulation/encounters/generation';
import type { AuthoredGeneratedEncounterCustomization } from '../../../src/authored-project/model';

function policy(key: string) {
  const value = catalog.encounterDefinitions.byKey[key]!.customization![0]!.selection;
  if (value.kind !== 'generated') throw new Error(key);
  return value;
}
const context = { biomeDepthCache: 8, biomeEncounterDepth: 8, knownRunBlacklist: [] };
const base = {
  kind: 'generated',
  waveCount: 1,
  waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 70 } }],
} as const;
const authored = (count: number): AuthoredGeneratedEncounterCustomization => ({
  ...base,
  menace: [{ waveIndex: 1, conversions: { Guard: { count } } }],
});

describe('source-request Menace assessment', () => {
  it.each([1, 2])(
    'permits zero, partial, and all requests at rank %s without recomputing counts',
    (menaceRank) => {
      const assess = (value: AuthoredGeneratedEncounterCustomization) =>
        assessGeneratedEncounter(policy('GeneratedF'), value, { ...context, menaceRank });
      const original = assess(base);
      expect(original.supported).toBe(true);
      expect(original.operands!.menace).toEqual([{ waveIndex: 1, conversions: [] }]);
      for (const count of [0, 1, 14]) {
        const result = assess(authored(count));
        expect(result.supported).toBe(true);
        expect(result.operands!.waves).toEqual(original.operands!.waves);
        expect(result.operands!.menace).toEqual([
          {
            waveIndex: 1,
            conversions: [
              { sourceKey: 'Guard', sourceNativeId: 'Guard', count, targetNativeId: 'Guard2' },
            ],
          },
        ]);
      }
      expect(assess(authored(15)).issues).toContainEqual({
        reason: 'menace',
        issue: 'countUnavailable',
        waveIndex: 1,
        key: 'Guard',
      });
    },
  );

  it('retains inactive and removed-source choices without findings or execution conversions', () => {
    const value = authored(14);
    expect(assessGeneratedEncounter(policy('GeneratedF'), value, context)).toMatchObject({
      supported: true,
      operands: { menace: [] },
    });
    const removed = {
      ...value,
      waves: [{ waveIndex: 1, typeKeys: ['Mage', 'Brawler'], allocations: { Mage: 70 } }],
    };
    const result = assessGeneratedEncounter(policy('GeneratedF'), removed, {
      ...context,
      menaceRank: 1,
    });
    expect(result.supported).toBe(true);
    expect(result.operands!.menace).toEqual([{ waveIndex: 1, conversions: [] }]);
    expect(removed.menace).toEqual(value.menace);
    const reduced = { ...value, waves: [{ ...base.waves[0], allocations: { Guard: 5 } }] };
    expect(
      assessGeneratedEncounter(policy('GeneratedF'), reduced, { ...context, menaceRank: 1 }).issues,
    ).toContainEqual({ reason: 'menace', issue: 'countUnavailable', waveIndex: 1, key: 'Guard' });
    expect(reduced.menace![0]!.conversions.Guard!.count).toBe(14);
  });

  it('requires a target only for positive random conversions and admits every native pool member', () => {
    const source = policy('GeneratedH_Treant2');
    const base = {
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'], allocations: { FogEmitter2: 1 } }],
    } as const;
    const assess = (count: number, targetKey?: string) =>
      assessGeneratedEncounter(
        source,
        {
          ...base,
          menace: [
            {
              waveIndex: 1,
              conversions: {
                Treant2: { count, ...(targetKey === undefined ? {} : { targetKey }) },
              },
            },
          ],
        },
        { ...context, menaceRank: 2 },
      );
    expect(assess(0).supported).toBe(true);
    expect(assess(0, 'stale-target').supported).toBe(true);
    expect(assess(1).issues).toContainEqual({
      reason: 'menace',
      issue: 'targetRequired',
      waveIndex: 1,
      key: 'Treant2',
    });
    expect(assess(1, 'Guard').issues).toContainEqual({
      reason: 'menace',
      issue: 'targetUnavailable',
      waveIndex: 1,
      key: 'Treant2',
    });
    for (const target of [
      'GoldElemental',
      'TimeElemental',
      'SwarmerClockwork',
      'ClockworkHeavyMelee',
      'SatyrLancer',
      'SatyrRatCatcher',
    ]) {
      for (const targetKey of [target, `${target}_Elite`]) {
        expect(assess(1, targetKey).supported, targetKey).toBe(true);
        expect(assess(1, targetKey).operands!.menace[0]!.conversions[0]!.targetNativeId).toBe(
          targetKey,
        );
      }
    }
  });

  it('gives encounter blocking precedence over a mapped source', () => {
    const source = { ...policy('GeneratedF'), blockMenace: true };
    for (const menaceRank of [1, 2]) {
      expect(
        assessGeneratedEncounter(source, authored(0), { ...context, menaceRank }).supported,
      ).toBe(true);
      expect(
        assessGeneratedEncounter(source, authored(100), { ...context, menaceRank }),
      ).toMatchObject({
        supported: true,
        operands: { menace: [{ waveIndex: 1, conversions: [] }] },
      });
    }
  });
  it.each(['GeneratedI', 'GeneratedH_Screamer2'])(
    'keeps unavailable %s source cells dormant and noneditable',
    (key) => {
      const source = policy(key);
      const value = initializeGeneratedEncounter(source, context)!;
      const result = assessGeneratedEncounter(source, value, { ...context, menaceRank: 1 });
      const wave = result.operands!.waves[0]!;
      const blocked = wave.typeKeys.find((key) => {
        const fact = [...source.choices, ...source.fixedEnemies].find(
          (entry) => entry.key === key,
        )?.menace;
        return fact?.kind === 'blocked' || fact?.kind === 'none';
      })!;
      expect(blocked).toBeDefined();
      const retained = assessGeneratedEncounter(
        source,
        { ...value, menace: [{ waveIndex: 1, conversions: { [blocked]: { count: 999 } } }] },
        { ...context, menaceRank: 1 },
      );
      expect(retained.supported).toBe(true);
      expect(retained.waves[0]!.menaceSources?.some((entry) => entry.sourceKey === blocked)).toBe(
        false,
      );
      expect(retained.operands!.menace[0]!.conversions).toEqual([]);
    },
  );
});

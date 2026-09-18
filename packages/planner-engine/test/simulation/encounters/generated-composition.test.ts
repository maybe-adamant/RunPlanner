import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import type { AuthoredGeneratedEncounterCustomization } from '../../../src/authored-project/model';
import { assessGeneratedEncounter } from '../../../src/simulation/encounters/generation';

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
  it('keeps independent overrides and sparse dormant rows', () => {
    const row = {
      waveIndex: 3,
      typeKeys: ['Brawler', 'Mage'],
      weights: { Guard: 2, Brawler: 3, Mage: 5 },
    };
    expect(assess('GeneratedF', {}).operands).toBeUndefined();
    const dormant = assess('GeneratedF', { waves: [row] });
    expect(dormant).toMatchObject({
      supported: true,
      composition: 'nativeWaveCount',
      knownRunBlacklistAdditions: [],
    });
    expect(dormant.operands).toBeUndefined();
    expect(assess('GeneratedF', { waveCount: 3, waves: [row] })).toMatchObject({
      supported: true,
      composition: 'nativeHighlight',
      operands: { waveCount: 3 },
    });
    expect(assess('GeneratedF', { highlightKey: 'Guard', waves: [row] })).toMatchObject({
      supported: true,
      operands: { highlightKey: 'Guard' },
    });
    expect(
      assess('GeneratedF', { waveCount: 3, highlightKey: 'Guard', waves: [row] }),
    ).toMatchObject({
      supported: true,
      operands: {
        waveCount: 3,
        highlightKey: 'Guard',
        waves: [{ waveIndex: 3, typeKeys: ['Guard', 'Brawler', 'Mage'], shares: [0.2, 0.3, 0.5] }],
      },
    });
    expect(
      assess('GeneratedF', { waveCount: 2, highlightKey: 'Guard', waves: [row] }).issues,
    ).toContainEqual({ reason: 'waveOutsideCount', waveIndex: 3 });
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
    expect(assess('GeneratedF', { waveCount: 1, highlightKey: 'Guard' }).operands).toEqual({
      waveCount: 1,
    });
  });

  it('checks seed exclusions, elite limits, solo restrictions and preparation depth', () => {
    expect(assess('GeneratedF', { waveCount: 2, highlightKey: 'Guard_Elite' }, 2).supported).toBe(
      false,
    );
    expect(assess('GeneratedF', { waveCount: 2, highlightKey: 'Guard_Elite' }, 3).supported).toBe(
      true,
    );
    expect(assess('ArtemisCombatF', { highlightKey: 'Guard_Elite' }).supported).toBe(false);
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
      assess('GeneratedF', { waveCount: 3, highlightKey: 'Guard', waves: [last] }).supported,
    ).toBe(true);
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
      }).supported,
    ).toBe(true);
  });

  it('prunes P groups after additions rather than rejecting a native-valid seed plus first filler', () => {
    const value = {
      waveCount: 2,
      highlightKey: 'SentryBot',
      waves: [{ waveIndex: 2, typeKeys: ['AutomatonBeamer'] }],
    };
    expect(assess('GeneratedP', value).supported).toBe(true);
    const third = assess('GeneratedP_Large', {
      highlightKey: 'SentryBot',
      waves: [{ waveIndex: 3, typeKeys: ['AutomatonBeamer', 'AutomatonEnforcer'] }],
    });
    expect(third.supported).toBe(false);
    expect(third.waves[2]?.eligibleKeysByPosition[1]).not.toContain('AutomatonEnforcer');
  });

  it('preserves fixed H elite seeds and their separate placeholder semantics', () => {
    const row = { waveIndex: 1, typeKeys: ['FogEmitter2'] };
    const mixed = assess('GeneratedH_Treant2', { waves: [row] });
    expect(mixed).toMatchObject({
      supported: true,
      knownRunBlacklistAdditions: [],
      operands: { waves: [row] },
    });
    expect(mixed.waves[0]?.eligibleKeysByPosition[0]).not.toContain('Lamia_Elite');
    expect(
      assess('GeneratedH_Treant2', { waves: [{ waveIndex: 1, typeKeys: ['Lamia_Elite'] }] })
        .supported,
    ).toBe(false);
    expect(
      assess('GeneratedH_Treant2', { waves: [{ ...row, weights: { FogEmitter2: 1 } }] }).supported,
    ).toBe(false);
  });

  it('records known run blacklist consequences only for valid ordinary additions', () => {
    const value = { waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2', 'Lamia', 'Mourner'] }] };
    expect(assess('GeneratedH', value)).toMatchObject({
      supported: true,
      knownRunBlacklistAdditions: ['FogEmitter2'],
    });
    expect(assess('GeneratedH', value, 8, 8, ['FogEmitter2']).supported).toBe(false);
    expect(
      assess('GeneratedH', { waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'] }] })
        .knownRunBlacklistAdditions,
    ).toEqual([]);
    expect(assess('GeneratedH', {}).knownRunBlacklistAdditions).toEqual([]);
  });
});

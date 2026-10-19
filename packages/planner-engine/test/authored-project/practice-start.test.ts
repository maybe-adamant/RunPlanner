import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createProjectDocument,
  createRouteAddress,
  decodePracticeStart,
  decodeProjectDocument,
  encodeProjectDocument,
  PRACTICE_START_GOLD,
  ProjectCommandContractError,
  RUN_MODIFIER_DECLARATIONS,
  type ProjectDocument,
  type RunStartPoint,
} from '@run-planner/engine/authored-project';

const route = createRouteAddress('Underworld');
const startPoint = { biomeKey: 'G', point: 'preboss', gold: 250 } as const;
const project = () =>
  createProjectDocument(catalog, {
    projectId: 'practice',
    routeKey: 'Underworld',
    configuredBiomeCount: 0,
  });
const replace = (value: RunStartPoint | null, document = project()) =>
  applyProjectCommand(document, catalog, {
    kind: 'ReplacePracticeStart',
    route,
    startPoint: value,
  });
const withRawStart = (value: unknown, document = project()): unknown => ({
  ...document,
  route: { ...document.route, practiceStart: value },
});

describe('Practice start', () => {
  it('is a route field, not a run modifier, and absent on a new route', () => {
    expect(RUN_MODIFIER_DECLARATIONS.map((declaration) => declaration.key)).not.toContain(
      'startPoint',
    );
    expect(project().route).not.toHaveProperty('practiceStart');
    expect(PRACTICE_START_GOLD).toEqual({ min: 0, max: 99_999, step: 1 });
  });

  it('heals malformed shapes and gold to absent, clamps gold and keeps a dangling biome', () => {
    for (const value of [
      null,
      [],
      'G',
      { point: 'opening' },
      { biomeKey: 3, point: 'opening' },
      { biomeKey: '', point: 'opening' },
      { biomeKey: 'G', point: 'hub' },
    ])
      expect(decodePracticeStart(value)).toBeUndefined();
    for (const gold of ['5', null, NaN, Infinity])
      expect(decodePracticeStart({ ...startPoint, gold })).toEqual({
        biomeKey: 'G',
        point: 'preboss',
      });
    for (const [stored, healed] of [
      [-5, 0],
      [12.6, 13],
      [250_000, 99_999],
    ] as const)
      expect(decodePracticeStart({ ...startPoint, gold: stored })).toEqual({
        ...startPoint,
        gold: healed,
      });
    const saved = decodeProjectDocument(
      withRawStart({ biomeKey: 'NotABiome', point: 'opening', extra: true }),
      catalog,
    );
    expect(saved.route.practiceStart).toEqual({ biomeKey: 'NotABiome', point: 'opening' });
    expect(
      decodeProjectDocument(withRawStart({ biomeKey: 'G', point: 'hub' }), catalog).route,
    ).not.toHaveProperty('practiceStart');
  });

  it('sets, compares by value and clears through ReplacePracticeStart', () => {
    const set = replace(startPoint);
    expect(set.route.practiceStart).toEqual(startPoint);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(set)), catalog)).toEqual(set);
    expect(replace({ ...startPoint }, set)).toBe(set);
    const cleared = replace(null, set);
    expect(cleared.route).not.toHaveProperty('practiceStart');
    expect(replace(null, cleared)).toBe(cleared);
    expect(set.route.loadout).not.toHaveProperty('runModifiers');
  });

  it('refuses a malformed start point the codec would heal, and another route', () => {
    // Commands validate; only loading a saved file heals.
    for (const malformed of [
      { ...startPoint, gold: 2.5 },
      { ...startPoint, gold: -1 },
      { ...startPoint, gold: 100_000 },
      { ...startPoint, biomeKey: '' },
      { biomeKey: 'G', point: 'hub' } as unknown as RunStartPoint,
    ])
      expect(() => replace(malformed)).toThrow('start point is malformed');
    expect(() =>
      applyProjectCommand(project() as ProjectDocument, catalog, {
        kind: 'ReplacePracticeStart',
        route: createRouteAddress('Surface'),
        startPoint,
      }),
    ).toThrow(ProjectCommandContractError);
  });
});

import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { authoringReadinessAt, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  applyProjectCommand,
  createProjectDocument,
  createRouteAddress,
  decodeProjectDocument,
  decodeRunModifiers,
  encodeProjectDocument,
  encodeRunModifiers,
  isNativeRunModifiers,
  NATIVE_RUN_MODIFIERS,
  RUN_MODIFIER_DECLARATIONS,
  routeRunModifiers,
  projectCommandAddress,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  type RunModifiers,
} from '@run-planner/engine/authored-project';

const route = createRouteAddress('Underworld');
const settings: RunModifiers = { enemyGoldDropChanceMultiplier: 1.25 };
const project = () =>
  createProjectDocument(catalog, {
    projectId: 'modifiers',
    routeKey: 'Underworld',
    configuredBiomeCount: 0,
  });
const replace = (value: RunModifiers, document = project()) =>
  applyProjectCommand(document, catalog, { kind: 'ReplaceRunModifiers', route, value });
const withLoadoutModifiers = (value: unknown, document = project()) => ({
  ...document,
  route: { ...document.route, loadout: { ...document.route.loadout, runModifiers: value } },
});

const malformedValues: readonly unknown[] = [NaN, Infinity, -Infinity, '2', null, true];
const clampedValues: readonly (readonly [number, number])[] = [
  [0.5, 1],
  [0.99, 1],
  [5.01, 5],
  [8, 5],
];

describe('run modifier declarations', () => {
  it('declare unique keys with valid numeric domains that contain their defaults', () => {
    const keys = RUN_MODIFIER_DECLARATIONS.map((declaration) => declaration.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const declaration of RUN_MODIFIER_DECLARATIONS) {
      expect(['released', 'internal']).toContain(declaration.stage);
      expect(declaration.label).not.toBe('');
      if (declaration.kind === 'number') {
        expect(declaration.min).toBeLessThan(declaration.max);
        expect(declaration.step).toBeGreaterThan(0);
        expect(declaration.default).toBeGreaterThanOrEqual(declaration.min);
        expect(declaration.default).toBeLessThanOrEqual(declaration.max);
      } else {
        expect(typeof declaration.default).toBe('boolean');
      }
    }
    expect(Object.isFrozen(RUN_MODIFIER_DECLARATIONS)).toBe(true);
    expect(NATIVE_RUN_MODIFIERS).toEqual({ enemyGoldDropChanceMultiplier: 1 });
    expect(isNativeRunModifiers(NATIVE_RUN_MODIFIERS)).toBe(true);
    expect(isNativeRunModifiers(settings)).toBe(false);
  });

  it('drops unknown keys, heals malformed known values, and omits all-default encodings', () => {
    expect(decodeRunModifiers({ ...settings, unknown: true }, 'runModifiers')).toEqual(settings);
    expect(decodeRunModifiers({}, 'runModifiers')).toEqual(NATIVE_RUN_MODIFIERS);
    for (const enemyGoldDropChanceMultiplier of malformedValues)
      expect(decodeRunModifiers({ enemyGoldDropChanceMultiplier }, 'runModifiers')).toEqual(
        NATIVE_RUN_MODIFIERS,
      );
    for (const [stored, clamped] of clampedValues)
      expect(decodeRunModifiers({ enemyGoldDropChanceMultiplier: stored }, 'runModifiers')).toEqual(
        { enemyGoldDropChanceMultiplier: clamped },
      );
    expect(encodeRunModifiers(NATIVE_RUN_MODIFIERS)).toBeUndefined();
    expect(encodeRunModifiers(settings)).toEqual(settings);
    for (const value of [null, [], 'modifiers', 2])
      expect(() => decodeRunModifiers(value, 'runModifiers')).toThrow(ProjectDocumentContractError);
  });

  it('decodes a document carrying the retired guarantee keys to the gold-only shape', () => {
    const decoded = decodeProjectDocument(
      withLoadoutModifiers({
        guaranteeEligibleCrits: true,
        guaranteeEligibleDoubleDamage: true,
        enemyGoldDropChanceMultiplier: 2.5,
      }),
      catalog,
    );
    expect(decoded.route.loadout.runModifiers).toEqual({ enemyGoldDropChanceMultiplier: 2.5 });
    expect(encodeProjectDocument(decoded)).not.toContain('guaranteeEligible');
    const native = decodeProjectDocument(
      withLoadoutModifiers({ guaranteeEligibleCrits: true, enemyGoldDropChanceMultiplier: 'x' }),
      catalog,
    );
    expect(native.route.loadout).not.toHaveProperty('runModifiers');
    expect(routeRunModifiers(native.route.loadout)).toBe(NATIVE_RUN_MODIFIERS);
    for (const [stored, clamped] of [
      [8, 5],
      [0.5, 1],
    ]) {
      const saved = decodeProjectDocument(
        withLoadoutModifiers({ enemyGoldDropChanceMultiplier: stored }),
        catalog,
      );
      expect(routeRunModifiers(saved.route.loadout).enemyGoldDropChanceMultiplier).toBe(clamped);
    }
  });
});

describe('authored run modifiers', () => {
  it('leaves bytes without run modifiers unchanged and reads native defaults', () => {
    const original = project();
    const bytes = encodeProjectDocument(original);
    const decoded = decodeProjectDocument(JSON.parse(bytes), catalog);
    expect(decoded.schemaVersion).toBe(91);
    expect(decoded.route.loadout).not.toHaveProperty('runModifiers');
    expect(routeRunModifiers(decoded.route.loadout)).toEqual(NATIVE_RUN_MODIFIERS);
    expect(encodeProjectDocument(decoded)).toBe(bytes);
    expect(replace(NATIVE_RUN_MODIFIERS, original)).toBe(original);
  });

  it('replaces complete settings, retains fractional values, and resets with omission', () => {
    const original = project();
    const changed = replace(settings, original);
    expect(changed.route.loadout.runModifiers).toEqual(settings);
    expect(replace({ ...settings }, changed)).toBe(changed);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(changed)), catalog)).toEqual(
      changed,
    );
    expect(replace(NATIVE_RUN_MODIFIERS, changed).route.loadout).not.toHaveProperty('runModifiers');
    const command = { kind: 'ReplaceRunModifiers' as const, route, value: settings };
    expect(projectCommandAddress(command)).toEqual(route);
  });

  it('keeps the route-owned modifier edit ready behind an incomplete loadout', () => {
    const configured = createProjectDocument(catalog, {
      projectId: 'incomplete',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    const command = { kind: 'ReplaceRunModifiers' as const, route, value: settings };
    const assembly = simulateProjectAssembly(catalog, configured);
    expect(assembly.evaluation.authoringHorizon.kind).not.toBe('open');
    expect(authoringReadinessAt(assembly, projectCommandAddress(command))).toBe('editable');
  });

  it('normalizes an explicit all-default record away during decode', () => {
    const decoded = decodeProjectDocument(withLoadoutModifiers(NATIVE_RUN_MODIFIERS), catalog);
    expect(decoded.route.loadout).not.toHaveProperty('runModifiers');
    expect(replace(NATIVE_RUN_MODIFIERS, decoded)).toBe(decoded);
  });

  it.each(malformedValues)(
    'normalizes a malformed command value instead of rejecting: %j',
    (value) => {
      const changed = replace({ ...settings }, project());
      const normalized = replace({ enemyGoldDropChanceMultiplier: value } as RunModifiers, changed);
      expect(normalized.route.loadout).not.toHaveProperty('runModifiers');
      expect(routeRunModifiers(normalized.route.loadout)).toEqual(NATIVE_RUN_MODIFIERS);
      const unknown = replace({ ...settings, unknown: true } as RunModifiers, project());
      expect(unknown.route.loadout.runModifiers).toEqual(settings);
      for (const [stored, clamped] of clampedValues)
        expect(
          routeRunModifiers(
            replace({ enemyGoldDropChanceMultiplier: stored }, project()).route.loadout,
          ).enemyGoldDropChanceMultiplier,
        ).toBe(clamped);
    },
  );

  it.each([null, [], 'modifiers'])('rejects a non-record value at its owner: %j', (value) => {
    expect(() => replace(value as unknown as RunModifiers, project())).toThrow(
      ProjectCommandContractError,
    );
    expect(() => decodeProjectDocument(withLoadoutModifiers(value), catalog)).toThrow(
      ProjectDocumentContractError,
    );
  });

  it('rejects the wrong route and permits Fresh File modifiers while retaining equipment guards', () => {
    expect(() =>
      applyProjectCommand(project(), catalog, {
        kind: 'ReplaceRunModifiers',
        route: createRouteAddress('Surface'),
        value: settings,
      }),
    ).toThrow(ProjectCommandContractError);
    const fresh = createProjectDocument(catalog, {
      projectId: 'fresh',
      routeKey: 'FreshFile',
      configuredBiomeCount: 0,
    });
    const freshRoute = createRouteAddress('FreshFile');
    const changed = applyProjectCommand(fresh, catalog, {
      kind: 'ReplaceRunModifiers',
      route: freshRoute,
      value: settings,
    });
    expect(changed.route.loadout.runModifiers).toEqual(settings);
    expect(changed.route.loadout.weaponKey).toBeNull();
    expect(() =>
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceRouteLoadout',
        route: freshRoute,
        weaponKey: 'WeaponStaff',
        aspectKey: 'BaseStaffAspect',
      }),
    ).toThrow(/Fresh File starting loadout is fixed/);
    expect(() =>
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceManualArcanaSelection',
        route: freshRoute,
        arcanaKeys: [],
      }),
    ).toThrow(/Fresh File starting loadout is fixed/);
  });
});

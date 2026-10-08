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
  isRunModifierValue,
  NATIVE_RUN_MODIFIERS,
  RUN_MODIFIER_DECLARATIONS,
  RUN_MODIFIER_PERCENTAGE,
  routeRunModifiers,
  projectCommandAddress,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  type RunModifiers,
} from '@run-planner/engine/authored-project';

const route = createRouteAddress('Underworld');
const settings: RunModifiers = { enemyGoldDropChance: 40 };
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
  [-5, 0],
  [-0.01, 0],
  [100.5, 100],
  [250, 100],
];

describe('run modifier declarations', () => {
  it('declare the gold percentages as released optional modifiers that are off natively', () => {
    const keys = RUN_MODIFIER_DECLARATIONS.map((declaration) => declaration.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(['enemyGoldDropChance', 'encounterGoldRange']);
    for (const declaration of RUN_MODIFIER_DECLARATIONS) {
      expect(declaration.kind).toBe('optionalPercentage');
      expect(declaration.stage).toBe('released');
      expect(declaration.label).not.toBe('');
      expect(declaration.description).not.toBe('');
      expect(isRunModifierValue(declaration, 0)).toBe(true);
      expect(isRunModifierValue(declaration, 100)).toBe(true);
      expect(isRunModifierValue(declaration, 101)).toBe(false);
      expect(isRunModifierValue(declaration, undefined)).toBe(false);
    }
    expect(RUN_MODIFIER_PERCENTAGE).toEqual({ min: 0, max: 100, step: 1, unit: '%' });
    expect(Object.isFrozen(RUN_MODIFIER_DECLARATIONS)).toBe(true);
    expect(NATIVE_RUN_MODIFIERS).toEqual({});
    expect(isNativeRunModifiers(NATIVE_RUN_MODIFIERS)).toBe(true);
    expect(isNativeRunModifiers(settings)).toBe(false);
    expect(isNativeRunModifiers({ encounterGoldRange: 0 })).toBe(false);
  });

  it('drops unknown keys, treats malformed values as off, clamps, and encodes only enabled values', () => {
    expect(decodeRunModifiers({ ...settings, unknown: true }, 'runModifiers')).toEqual(settings);
    expect(decodeRunModifiers({}, 'runModifiers')).toEqual(NATIVE_RUN_MODIFIERS);
    for (const enemyGoldDropChance of malformedValues)
      expect(decodeRunModifiers({ enemyGoldDropChance }, 'runModifiers')).toEqual(
        NATIVE_RUN_MODIFIERS,
      );
    for (const [stored, clamped] of clampedValues)
      expect(decodeRunModifiers({ encounterGoldRange: stored }, 'runModifiers')).toEqual({
        encounterGoldRange: clamped,
      });
    expect(encodeRunModifiers(NATIVE_RUN_MODIFIERS)).toBeUndefined();
    expect(encodeRunModifiers(settings)).toEqual(settings);
    expect(encodeRunModifiers({ enemyGoldDropChance: 0, encounterGoldRange: 100 })).toEqual({
      enemyGoldDropChance: 0,
      encounterGoldRange: 100,
    });
    for (const value of [null, [], 'modifiers', 2])
      expect(() => decodeRunModifiers(value, 'runModifiers')).toThrow(ProjectDocumentContractError);
  });

  it('drops the retired multiplier and guarantee keys on load', () => {
    const decoded = decodeProjectDocument(
      withLoadoutModifiers({
        guaranteeEligibleCrits: true,
        enemyGoldDropChanceMultiplier: 2.5,
        encounterGoldRange: 60,
      }),
      catalog,
    );
    expect(decoded.route.loadout.runModifiers).toEqual({ encounterGoldRange: 60 });
    const encoded = encodeProjectDocument(decoded);
    expect(encoded).not.toContain('guaranteeEligible');
    expect(encoded).not.toContain('enemyGoldDropChanceMultiplier');
    const native = decodeProjectDocument(
      withLoadoutModifiers({ enemyGoldDropChanceMultiplier: 2.5, enemyGoldDropChance: 'x' }),
      catalog,
    );
    expect(native.route.loadout).not.toHaveProperty('runModifiers');
    expect(routeRunModifiers(native.route.loadout)).toBe(NATIVE_RUN_MODIFIERS);
    for (const [stored, clamped] of [
      [250, 100],
      [-5, 0],
    ]) {
      const saved = decodeProjectDocument(
        withLoadoutModifiers({ enemyGoldDropChance: stored }),
        catalog,
      );
      expect(routeRunModifiers(saved.route.loadout).enemyGoldDropChance).toBe(clamped);
    }
  });
});

describe('authored run modifiers', () => {
  it('leaves bytes without run modifiers unchanged and reads native defaults', () => {
    const original = project();
    const bytes = encodeProjectDocument(original);
    const decoded = decodeProjectDocument(JSON.parse(bytes), catalog);
    expect(decoded.schemaVersion).toBe(92);
    expect(decoded.route.loadout).not.toHaveProperty('runModifiers');
    expect(routeRunModifiers(decoded.route.loadout)).toEqual(NATIVE_RUN_MODIFIERS);
    expect(encodeProjectDocument(decoded)).toBe(bytes);
    expect(replace(NATIVE_RUN_MODIFIERS, original)).toBe(original);
  });

  it('replaces complete settings and turns modifiers off by omission', () => {
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
      const normalized = replace({ enemyGoldDropChance: value } as RunModifiers, changed);
      expect(normalized.route.loadout).not.toHaveProperty('runModifiers');
      expect(routeRunModifiers(normalized.route.loadout)).toEqual(NATIVE_RUN_MODIFIERS);
      const unknown = replace({ ...settings, unknown: true } as RunModifiers, project());
      expect(unknown.route.loadout.runModifiers).toEqual(settings);
      for (const [stored, clamped] of clampedValues)
        expect(
          routeRunModifiers(replace({ enemyGoldDropChance: stored }, project()).route.loadout)
            .enemyGoldDropChance,
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

import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { authoringReadinessAt, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  applyProjectCommand,
  createProjectDocument,
  createRouteAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  NATIVE_RUN_MODIFIERS,
  routeRunModifiers,
  projectCommandAddress,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  type RunModifiers,
} from '@run-planner/engine/authored-project';

const route = createRouteAddress('Underworld');
const settings: RunModifiers = {
  guaranteeEligibleCrits: true,
  guaranteeEligibleDoubleDamage: false,
  enemyGoldDropChanceMultiplier: 1.25,
};
const project = () =>
  createProjectDocument(catalog, {
    projectId: 'modifiers',
    routeKey: 'Underworld',
    configuredBiomeCount: 0,
  });
const replace = (value: RunModifiers, document = project()) =>
  applyProjectCommand(document, catalog, { kind: 'ReplaceRunModifiers', route, value });

const malformed: readonly unknown[] = [
  null,
  [],
  {},
  { ...settings, unknown: true },
  { guaranteeEligibleCrits: true, enemyGoldDropChanceMultiplier: 2 },
  { guaranteeEligibleCrits: true, guaranteeEligibleDoubleDamage: true },
  { ...settings, guaranteeEligibleCrits: 1 },
  { ...settings, guaranteeEligibleDoubleDamage: 'false' },
  ...[NaN, Infinity, -Infinity, 0.99, '2', null].map((enemyGoldDropChanceMultiplier) => ({
    ...settings,
    enemyGoldDropChanceMultiplier,
  })),
];

describe('authored run modifiers', () => {
  it('leaves old schema-90 bytes unchanged and reads native defaults', () => {
    const original = project();
    const bytes = encodeProjectDocument(original);
    const decoded = decodeProjectDocument(JSON.parse(bytes), catalog);
    expect(decoded.schemaVersion).toBe(90);
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

  it('preserves explicit native presence during decode and removes it on reset', () => {
    const original = project();
    const decoded = decodeProjectDocument(
      {
        ...original,
        route: {
          ...original.route,
          loadout: { ...original.route.loadout, runModifiers: NATIVE_RUN_MODIFIERS },
        },
      },
      catalog,
    );
    expect(decoded.route.loadout.runModifiers).toEqual(NATIVE_RUN_MODIFIERS);
    expect(replace(NATIVE_RUN_MODIFIERS, decoded).route.loadout).not.toHaveProperty('runModifiers');
  });

  it.each(malformed)('rejects malformed complete settings at their owner: %j', (value) => {
    const original = project();
    expect(() => replace(value as RunModifiers, original)).toThrow(ProjectCommandContractError);
    expect(() =>
      decodeProjectDocument(
        {
          ...original,
          route: { ...original.route, loadout: { ...original.route.loadout, runModifiers: value } },
        },
        catalog,
      ),
    ).toThrow(ProjectDocumentContractError);
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

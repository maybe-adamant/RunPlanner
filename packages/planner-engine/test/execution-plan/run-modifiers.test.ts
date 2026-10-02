import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { NATIVE_RUN_MODIFIERS, type ProjectDocument } from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '../../src/simulation';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
  ExecutionPlanCodecError,
} from '../../src/execution-plan';
import { runModifiersProject } from './support/execution-fixtures';
import nativeWire from './fixtures/f-opening.execution.json';
import modifiersWire from './fixtures/run-modifiers.execution.json';

function compile(project: ProjectDocument) {
  return compileExecutionPlan({
    product: assembleExecutionProduct({
      assembly: simulateProjectAssembly(catalog, project),
      catalog,
    }),
  });
}

describe('execution run modifiers', () => {
  it('publishes the complete explicit product and verifies its fractional fingerprint', () => {
    const project = runModifiersProject();
    const plan = compile(project);
    expect(plan.runModifiers).toEqual(project.route.loadout.runModifiers);
    expect(plan.startingLoadout).not.toHaveProperty('runModifiers');
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    expect(decodeExecutionPlan(modifiersWire)).toEqual(plan);
    for (const settings of [
      { ...plan.runModifiers!, guaranteeEligibleCrits: false },
      { ...plan.runModifiers!, guaranteeEligibleDoubleDamage: false },
      { ...plan.runModifiers!, enemyGoldDropChanceMultiplier: 2.75 },
    ]) {
      expect(
        compile({
          ...project,
          route: {
            ...project.route,
            loadout: { ...project.route.loadout, runModifiers: settings },
          },
        }).planFingerprint,
      ).not.toBe(plan.planFingerprint);
    }
  });

  it('omits native settings and preserves the old document and fingerprint', () => {
    const project = runModifiersProject();
    const plan = compile({
      ...project,
      route: {
        ...project.route,
        loadout: { ...project.route.loadout, runModifiers: NATIVE_RUN_MODIFIERS },
      },
    });
    expect(plan).not.toHaveProperty('runModifiers');
    expect(decodeExecutionPlan(nativeWire)).toEqual(plan);
  });

  it('verifies explicit native wire presence without filling or removing fields', () => {
    const decoded = decodeExecutionPlan(nativeWire);
    const product = assembleExecutionProduct({
      assembly: simulateProjectAssembly(catalog, runModifiersProject()),
      catalog,
    });
    const explicit = compileExecutionPlan({
      product: { ...product, runModifiers: NATIVE_RUN_MODIFIERS },
    });
    expect(explicit.planFingerprint).not.toBe(decoded.planFingerprint);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(explicit))).runModifiers).toEqual(
      NATIVE_RUN_MODIFIERS,
    );
    expect(() =>
      decodeExecutionPlan({ ...nativeWire, runModifiers: NATIVE_RUN_MODIFIERS }),
    ).toThrow(/planFingerprint/);
  });

  it.each([
    {},
    null,
    {
      guaranteeEligibleCrits: true,
      guaranteeEligibleDoubleDamage: false,
      enemyGoldDropChanceMultiplier: Infinity,
    },
    {
      guaranteeEligibleCrits: true,
      guaranteeEligibleDoubleDamage: false,
      enemyGoldDropChanceMultiplier: 0.5,
    },
    {
      guaranteeEligibleCrits: true,
      guaranteeEligibleDoubleDamage: false,
      enemyGoldDropChanceMultiplier: 1.5,
      extra: true,
    },
  ])('rejects malformed wire settings before fingerprint verification: %j', (runModifiers) => {
    expect(() => decodeExecutionPlan({ ...nativeWire, runModifiers })).toThrow(
      ExecutionPlanCodecError,
    );
    expect(() => decodeExecutionPlan({ ...nativeWire, runModifiers })).toThrow(
      /execution plan.runModifiers/,
    );
  });

  it('rejects an otherwise valid setting change under the old fingerprint', () => {
    expect(() =>
      decodeExecutionPlan({
        ...modifiersWire,
        runModifiers: { ...modifiersWire.runModifiers, enemyGoldDropChanceMultiplier: 3 },
      }),
    ).toThrow(/planFingerprint/);
  });
});

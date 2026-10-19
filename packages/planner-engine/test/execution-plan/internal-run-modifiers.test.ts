import { describe, expect, it, vi } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { assembleExecutionProduct } from '@run-planner/engine/execution-plan';
import { runModifiersProject } from './support/execution-fixtures';

// Encounter gold range stands in for an internal declaration; nothing internal is declared today.
vi.mock('../../src/authored-project/run-modifiers', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/authored-project/run-modifiers')>();
  return {
    ...original,
    runModifierDeclaration: (key: Parameters<typeof original.runModifierDeclaration>[0]) => {
      const declaration = original.runModifierDeclaration(key);
      return key === 'encounterGoldRange' ? { ...declaration, stage: 'internal' } : declaration;
    },
  };
});

describe('internal run modifier publication', () => {
  const assembly = simulateProjectAssembly(catalog, runModifiersProject());

  it('publishes an internal modifier only where internal modifiers are enabled', () => {
    expect(
      assembleExecutionProduct({ assembly, catalog, internalRunModifiers: true }).runModifiers,
    ).toEqual({ enemyGoldDropChance: 40, encounterGoldRange: 25 });
    expect(assembleExecutionProduct({ assembly, catalog }).runModifiers).toEqual({
      enemyGoldDropChance: 40,
    });
  });
});

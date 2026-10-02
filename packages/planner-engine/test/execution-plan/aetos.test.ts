import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  surfaceGeneratedPreCombatProject,
  loadSurfaceNOPProject,
} from '@run-planner/test-fixtures/surface';
import { simulateProjectAssembly } from '../../src/simulation';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
} from '../../src/execution-plan';
import selectedFixture from './fixtures/surface-generated-precombat.execution.json';
import noneFixture from './fixtures/surface-nop.execution.json';
import underworldFixture from './fixtures/f-opening.execution.json';

describe('Aetos biome execution directive', () => {
  it('translates reached assessed history into one exact native-wave target', () => {
    const assembly = simulateProjectAssembly(catalog, surfaceGeneratedPreCombatProject());
    const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
    const olympus = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'P');
    if (olympus?.authoring !== 'complete' || olympus.validity !== 'valid')
      throw new Error('Aetos fixture must be complete-valid');
    const entry = olympus.history.ledgers.encounterStarts.find(
      (event) => event.aetosWave !== undefined,
    );
    expect(entry).toMatchObject({ aetosWave: 2, slotKey: 'Combat' });
    expect(plan.olympusAetos).toEqual({
      kind: 'target',
      occurrenceId: entry?.origin.kind === 'occurrence' ? entry.origin.occurrenceId : undefined,
      phaseKey: 'Combat',
      wave: 2,
    });
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan))).olympusAetos).toEqual(
      plan.olympusAetos,
    );
    expect(decodeExecutionPlan(selectedFixture).olympusAetos).toEqual(plan.olympusAetos);
  });

  it('publishes explicit suppression for old documents without selections', () => {
    const assembly = simulateProjectAssembly(catalog, loadSurfaceNOPProject());
    expect(assembleExecutionProduct({ assembly, catalog }).olympusAetos).toEqual({ kind: 'none' });
    expect(decodeExecutionPlan(noneFixture).olympusAetos).toEqual({ kind: 'none' });
    expect(decodeExecutionPlan(underworldFixture).olympusAetos).toBeUndefined();
  });

  it.each([
    undefined,
    null,
    false,
    { kind: 'native' },
    { kind: 'none', wave: 2 },
    ...[0, 1, 4, 2.5, '2'].map((wave) => ({ ...selectedFixture.olympusAetos, wave })),
    { ...selectedFixture.olympusAetos, occurrenceId: 'missing' },
    { ...selectedFixture.olympusAetos, phaseKey: 'missing' },
    { ...selectedFixture.olympusAetos, occurrenceId: 'surface-n-opening' },
  ])('rejects malformed or unresolved target %j', (olympusAetos) => {
    expect(() => decodeExecutionPlan({ ...selectedFixture, olympusAetos })).toThrow(/olympusAetos/);
  });

  it('rejects policy outside P', () => {
    expect(() =>
      decodeExecutionPlan({ ...underworldFixture, olympusAetos: { kind: 'none' } }),
    ).toThrow(/outside extent/);
  });
});

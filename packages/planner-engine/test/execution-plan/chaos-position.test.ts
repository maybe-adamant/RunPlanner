import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createOccurrenceId,
} from '../../src/authored-project';
import { createCompleteFGProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';
import { simulateProjectAssembly } from '../../src/simulation';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
} from '../../src/execution-plan';
import { overview } from '../../src/execution-plan/codec/overview';
import positionedFixture from './fixtures/fg-ixion-chaos.execution.json';

describe('Chaos position publication', () => {
  it('exports an unpicked gate, preserving Default omission and the normal selection', () => {
    let project = createCompleteFGProject();
    const opening = project.route.biomes[0]!.topology!.occurrences.find(
      (room) => room.gameName === 'F_Opening01',
    )!;
    const additional = createAdditionalExitAddress(goldenFBiome, opening.occurrenceId, 'chaos');
    const chaosId = createOccurrenceId('execution-unpicked-chaos');
    project = applyProjectCommand(project, catalog, {
      kind: 'AddChaos',
      additional,
      occurrenceId: chaosId,
    });
    for (const spawnPointIndex of [null, 1] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'SetChaosSpawnPoint',
        additional,
        spawnPointIndex,
      });
      const assembly = simulateProjectAssembly(catalog, project);
      const plan = compileExecutionPlan({
        product: assembleExecutionProduct({ catalog, assembly }),
      });
      expect(plan.selectedOccurrenceIds).not.toContain(chaosId);
      const gate = plan.occurrences.find((room) => room.id === opening.occurrenceId)!.overview
        .additional![0]!;
      expect(gate.kind).toBe('chaos');
      if (spawnPointIndex === null) expect(gate).not.toHaveProperty('spawnPointIndex');
      else expect(gate.spawnPointIndex).toBe(spawnPointIndex);
      expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    }
  });

  it('decodes the planner-produced Ixion witness', () => {
    const plan = decodeExecutionPlan(positionedFixture);
    expect(plan.occurrences.flatMap((room) => room.overview.additional ?? [])).toContainEqual(
      expect.objectContaining({
        kind: 'chaos',
        spawnPointIndex: 1,
        ixionOrigin: expect.any(Object),
      }),
    );
  });

  it('strictly accepts positive integer positions only on Chaos', () => {
    const gate = {
      kind: 'chaos',
      owner: 'gate',
      room: { id: 'chaos', biomeKey: 'F', gameName: 'Chaos_01' },
    };
    const decode = (row: unknown) =>
      overview({ encounterPhases: [], requiredObjects: [], additional: [row] }, 'overview');
    expect(decode(gate).additional![0]).not.toHaveProperty('spawnPointIndex');
    expect(decode({ ...gate, spawnPointIndex: 3 }).additional![0]!.spawnPointIndex).toBe(3);
    for (const spawnPointIndex of [null, 0, -1, 1.5, '2', true, Infinity, NaN]) {
      expect(() => decode({ ...gate, spawnPointIndex })).toThrow();
    }
    expect(() => decode({ ...gate, kind: 'zagreusContract', spawnPointIndex: 1 })).toThrow(
      /Chaos-only/,
    );
  });
});

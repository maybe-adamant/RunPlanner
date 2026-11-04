import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { loadUnderworldFGHCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { createFreshFileRouteProject } from '@run-planner/test-fixtures/fresh-file';

import { assembleExecutionProduct } from '../../src/execution-plan/assembler';
import { compileExecutionPlan } from '../../src/execution-plan/compiler';
import type { ExecutionPlan } from '../../src/execution-plan/model';
import { underworldFCutEndProject } from './support/plan-end-switch-fixtures';

function publish(project: ProjectDocument): ExecutionPlan {
  return compileExecutionPlan({
    product: assembleExecutionProduct({
      assembly: simulateProjectAssembly(catalog, project),
      catalog,
    }),
  });
}

function storeFacts(plan: ExecutionPlan) {
  return new Map(
    plan.occurrences.flatMap((occurrence) => {
      const fact = occurrence.roomExitConformance?.facts.find(
        (candidate) => candidate.kind === 'rewardStores',
      );
      return fact?.kind === 'rewardStores' ? [[occurrence.id, fact.stores] as const] : [];
    }),
  );
}

describe('room-exit reward store conformance', () => {
  it('names each store a room changes with the reward types both sides count alike', () => {
    const plan = publish(createCompleteFGProject());
    const facts = storeFacts(plan);
    // A room's door draws move RunProgress; its exit compares that store.
    expect(facts.get('golden-f-b1-e1')?.map((store) => store.name)).toContain('RunProgress');
    const declared = catalog.rewards.stores.byKey.RunProgress!.entries.map(
      (entry) => entry.rewardType,
    );
    for (const stores of facts.values()) {
      expect(stores.map((store) => store.name)).not.toContain('Secrets');
      for (const store of stores) expect(store.rewardTypes).toEqual([...store.rewardTypes].sort());
    }
    expect(new Set(facts.get('golden-f-b1-e1')?.[0]?.rewardTypes)).toEqual(new Set(declared));
  });

  it('leaves a store type declared for another route out of the comparison', () => {
    const offRoute = (plan: ExecutionPlan) =>
      [...storeFacts(plan).values()]
        .flat()
        .filter((store) => store.name === 'MetaProgress')
        .flatMap((store) => store.rewardTypes);
    // MetaProgress declares its MetaCurrencyDrop entries for the Fresh File route only.
    expect(offRoute(publish(createCompleteFGProject()))).not.toContain('MetaCurrencyDrop');
    expect(offRoute(publish(createFreshFileRouteProject()))).toContain('MetaCurrencyDrop');
  });

  it('compares no store at the plan’s end room, whose own door draws are not simulated', () => {
    const plan = publish(underworldFCutEndProject());
    const end = plan.occurrences.find((occurrence) => occurrence.id === 'golden-f-b5-e1')!;
    expect(end.doors.kind).toBe('terminal');
    expect(end.roomExitConformance?.facts.map((fact) => fact.kind)).not.toContain('rewardStores');
    expect(storeFacts(plan).size).toBeGreaterThan(0);
  });
});

describe('Fields cage count outcome', () => {
  it('publishes each Fields batch’s authored roll outcome beside its cages, and none elsewhere', () => {
    const project = loadUnderworldFGHCheckpoint();
    const plan = publish(project);
    const fieldsIds = new Set(
      plan.occurrences
        .filter((occurrence) => occurrence.kind === 'FieldsEncounter')
        .map((occurrence) => occurrence.id),
    );
    const authored = new Map(
      project.route.biomes.flatMap((biome) =>
        (biome.topology?.decisions ?? []).flatMap((decision) =>
          decision.kind !== 'exit' ||
          decision.source.kind !== 'occurrence' ||
          decision.normal.batchState === null
            ? []
            : [
                [
                  decision.source.occurrenceId as string,
                  decision.normal.batchState.cageOutcome,
                ] as const,
              ],
        ),
      ),
    );
    let fieldsBatches = 0;
    for (const occurrence of plan.occurrences) {
      if (occurrence.doors.kind !== 'batch') continue;
      const intoFields = occurrence.doors.targets.some((target) => fieldsIds.has(target.room.id));
      if (!intoFields) {
        expect(occurrence.doors).not.toHaveProperty('cageCountOutcome');
        continue;
      }
      fieldsBatches += 1;
      expect(occurrence.doors.cageCountOutcome).toBe(authored.get(occurrence.id));
    }
    expect(fieldsBatches).toBeGreaterThan(0);
  });
});

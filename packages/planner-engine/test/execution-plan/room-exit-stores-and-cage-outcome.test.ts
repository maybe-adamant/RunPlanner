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

function compared(plan: ExecutionPlan, name: string) {
  return plan.rewardStoreComparison.find((store) => store.name === name)?.rewardTypes;
}

describe('reward store comparison', () => {
  it('names each store once per plan with the reward types both sides count alike', () => {
    const plan = publish(createCompleteFGProject());
    expect(plan.rewardStoreComparison.map((store) => store.name)).not.toContain('Secrets');
    const declared = catalog.rewards.stores.byKey.RunProgress!.entries.map(
      (entry) => entry.rewardType,
    );
    expect(compared(plan, 'RunProgress')).toEqual([...new Set(declared)].sort());
    for (const store of plan.rewardStoreComparison) {
      expect(store.rewardTypes.length).toBeGreaterThan(0);
      expect(store.rewardTypes).toEqual([...store.rewardTypes].sort());
    }
    // No room carries its own store fact: every exit compares the plan's stores.
    expect(JSON.stringify(plan.occurrences)).not.toContain('"rewardStores","stores"');
  });

  it('leaves a store type declared for another route out of the comparison', () => {
    // MetaProgress declares its MetaCurrencyDrop entries for the Fresh File route only.
    expect(compared(publish(createCompleteFGProject()), 'MetaProgress')).not.toContain(
      'MetaCurrencyDrop',
    );
    expect(compared(publish(createFreshFileRouteProject()), 'MetaProgress')).toContain(
      'MetaCurrencyDrop',
    );
  });

  it('publishes the same comparison for a plan that ends early; its end room has terminal doors', () => {
    const plan = publish(underworldFCutEndProject());
    expect(plan.rewardStoreComparison).toEqual(
      publish(createCompleteFGProject()).rewardStoreComparison,
    );
    const end = plan.occurrences.find((occurrence) => occurrence.id === 'golden-f-b5-e1')!;
    expect(end.doors.kind).toBe('terminal');
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

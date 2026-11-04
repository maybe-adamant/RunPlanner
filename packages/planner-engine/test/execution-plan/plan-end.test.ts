import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import {
  applyProjectCommand,
  createRouteAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { assembleExecutionProduct } from '../../src/execution-plan/assembler';
import { compileExecutionPlan } from '../../src/execution-plan/compiler';
import { decodeExecutionPlan, encodeExecutionPlan } from '../../src/execution-plan/codec';

const endAt = (project: ProjectDocument, biomeKey: string, occurrenceId: string) =>
  applyProjectCommand(project, catalog, {
    kind: 'ReplacePlanEnd',
    route: createRouteAddress(project.route.routeKey),
    planEnd: { biomeKey, occurrenceId: occurrenceId as OccurrenceId },
  });

function publish(project: ProjectDocument) {
  const plan = compileExecutionPlan({
    product: assembleExecutionProduct({
      assembly: simulateProjectAssembly(catalog, project),
      catalog,
    }),
  });
  return decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)));
}

describe('Plan end publication', () => {
  it('publishes through the end room, which has no doors, and leaves later biomes out', () => {
    const plan = publish(endAt(createCompleteFGProject(), 'F', 'golden-f-b5-e1'));
    expect(plan.extent).toEqual({
      kind: 'configuredPrefix',
      biomeKeys: ['F'],
      terminalBiomeKey: 'F',
    });
    expect(plan.selectedOccurrenceIds.at(-1)).toBe('golden-f-b5-e1');
    expect(plan.selectedOccurrenceIds).not.toContain('golden-f-b6-e1');
    const end = plan.occurrences.find((occurrence) => occurrence.id === 'golden-f-b5-e1')!;
    expect(end.doors.kind).toBe('terminal');
    expect(plan.occurrences.every((occurrence) => occurrence.biomeKey === 'F')).toBe(true);
  });

  it('ends inside the completion chain and at a biome end before a later biome', () => {
    const atBoss = publish(endAt(createCompleteFGProject(), 'F', 'golden-f-preboss-shop:boss'));
    expect(atBoss.selectedOccurrenceIds.at(-1)).toBe('golden-f-preboss-shop:boss');
    expect(
      atBoss.occurrences.find((occurrence) => occurrence.id === 'golden-f-preboss-shop:boss')?.doors
        .kind,
    ).toBe('terminal');
    const atPostboss = publish(
      endAt(createCompleteFGProject(), 'F', 'golden-f-preboss-shop:postboss'),
    );
    expect(atPostboss.extent.biomeKeys).toEqual(['F']);
    expect(
      atPostboss.occurrences.find(
        (occurrence) => occurrence.id === 'golden-f-preboss-shop:postboss',
      )?.doors.kind,
    ).toBe('terminal');
  });

  it('publishes a partial Hub block when the plan ends inside the Hub stay', () => {
    const plan = publish(endAt(loadSurfaceNProject(), 'N', 'surface-n-combat05'));
    expect(plan.selectedOccurrenceIds.at(-1)).toBe('surface-n-combat05-sideDoor1');
    const hub = plan.occurrences.find((occurrence) => occurrence.overview.hub !== undefined)!
      .overview.hub!;
    expect(hub).not.toHaveProperty('finalHandoff');
    expect(hub.requiredVisitCount).toBe(1);
    // The fixture uses the fountain before its first visit.
    expect(hub.fountain?.precedingVisitCount).toBe(0);
    expect(hub.departures.map((departure) => departure.precedingVisitCount)).toEqual([0]);

    const complete = publish(loadSurfaceNProject());
    const fullHub = complete.occurrences.find(
      (occurrence) => occurrence.overview.hub !== undefined,
    )!.overview.hub!;
    expect(fullHub.finalHandoff).toBeDefined();
    expect(fullHub.departures).toHaveLength(fullHub.requiredVisitCount + 1);
  });

  it('refuses a Hub block that hands off without its fountain use', () => {
    const plan = JSON.parse(
      encodeExecutionPlan(
        compileExecutionPlan({
          product: assembleExecutionProduct({
            assembly: simulateProjectAssembly(catalog, loadSurfaceNProject()),
            catalog,
          }),
        }),
      ),
    );
    const hubEntry = plan.occurrences.find(
      (occurrence: { overview: { hub?: unknown } }) => occurrence.overview.hub !== undefined,
    );
    delete hubEntry.overview.hub.fountain;
    expect(() => decodeExecutionPlan(plan)).toThrow(/fountain is required/);
  });
});

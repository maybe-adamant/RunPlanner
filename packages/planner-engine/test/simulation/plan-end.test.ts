import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createRouteAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  authoringReadinessAt,
  simulateProject,
  simulateProjectAssembly,
  type ProjectBiomeEvaluation,
} from '@run-planner/engine/simulation';

const endAt = (project: ProjectDocument, biomeKey: string, occurrenceId: string) =>
  applyProjectCommand(project, catalog, {
    kind: 'ReplacePlanEnd',
    route: createRouteAddress(project.route.routeKey),
    planEnd: { biomeKey, occurrenceId: occurrenceId as OccurrenceId },
  });

function history(evaluation: ProjectBiomeEvaluation) {
  if (!('history' in evaluation)) throw new Error(`${evaluation.biomeKey} has no history`);
  return evaluation.history.events.map((event) => ({
    kind: event.kind,
    occurrenceId:
      'origin' in event && event.origin !== undefined && 'occurrenceId' in event.origin
        ? event.origin.occurrenceId
        : undefined,
  }));
}

const enteredRooms = (evaluation: ProjectBiomeEvaluation) =>
  history(evaluation).flatMap((event) =>
    event.kind === 'roomEntered' && event.occurrenceId !== undefined ? [event.occurrenceId] : [],
  );

describe('Plan end evaluation', () => {
  it('ends a biome after an ordinary room: valid, later biomes dormant, nothing published', () => {
    const baseline = simulateProject(catalog, createCompleteFGProject());
    expect(baseline.status).toBe('valid');
    const evaluation = simulateProject(
      catalog,
      endAt(createCompleteFGProject(), 'F', 'golden-f-b5-e1'),
    );
    expect(evaluation.status).toBe('valid');
    expect(evaluation.findings).toEqual([]);
    expect(evaluation.issue).toBeUndefined();
    expect(evaluation.route.biomes.map((biome) => biome.biomeKey)).toEqual(['F']);
    const f = evaluation.route.biomes[0]!;
    expect(f.authoring).toBe('ended');
    expect(f.validity).toBe('valid');
    expect(f).not.toHaveProperty('snapshot');
    expect(evaluation.route.processing).toEqual({
      completeValidPrefix: [],
      active: null,
      blockedSuffix: [],
      afterPlanEnd: ['G'],
    });
    // P1 publishes nothing for a mid-biome end.
    expect(evaluation.summary.eligibleForExecutionPlan).toBe(false);
    expect(evaluation.authoringHorizon).toEqual({
      kind: 'ended',
      blockedAfter: createOccurrenceAddress(
        createBiomeAddress('Underworld', 'F'),
        'golden-f-b5-e1' as OccurrenceId,
      ),
    });
    const events = history(f);
    expect(enteredRooms(f).at(-1)).toBe('golden-f-b5-e1');
    expect(events.at(-1)).toEqual({
      kind: 'outgoingGenerationCheckpoint',
      occurrenceId: 'golden-f-b5-e1',
    });
    // The end room settles its Timeline but never commits, exits or generates doors.
    expect(
      events.some(
        (event) =>
          event.occurrenceId === 'golden-f-b5-e1' &&
          ['roomCommitted', 'roomExited', 'roomDeparted'].includes(event.kind),
      ),
    ).toBe(false);
    expect(events.some((event) => event.occurrenceId === 'golden-f-b6-e1')).toBe(false);
  });

  it('keeps the completion chain and stops inside it at the Preboss or Boss', () => {
    const atPreboss = simulateProject(
      catalog,
      endAt(createCompleteFGProject(), 'F', 'golden-f-preboss-shop'),
    ).route.biomes[0]!;
    expect(atPreboss.authoring).toBe('ended');
    expect(enteredRooms(atPreboss).at(-1)).toBe('golden-f-preboss-shop');
    expect(
      history(atPreboss).some((event) => event.occurrenceId === 'golden-f-preboss-shop:boss'),
    ).toBe(false);

    const atBoss = simulateProject(
      catalog,
      endAt(createCompleteFGProject(), 'F', 'golden-f-preboss-shop:boss'),
    );
    expect(atBoss.status).toBe('valid');
    const f = atBoss.route.biomes[0]!;
    expect(f.authoring).toBe('ended');
    expect(enteredRooms(f).at(-1)).toBe('golden-f-preboss-shop:boss');
    const kinds = history(f).map((event) => event.kind);
    expect(kinds).not.toContain('biomeCompleted');
    expect(
      history(f).some(
        (event) =>
          event.occurrenceId === 'golden-f-preboss-shop:boss' && event.kind === 'roomExited',
      ),
    ).toBe(false);
    expect(
      history(f).some((event) => event.occurrenceId === 'golden-f-preboss-shop:postboss'),
    ).toBe(false);
  });

  it('treats an end at the terminal completion room as the ordinary biome end', () => {
    const atPostboss = simulateProject(
      catalog,
      endAt(createCompleteFGProject(), 'F', 'golden-f-preboss-shop:postboss'),
    );
    expect(atPostboss.status).toBe('valid');
    expect(atPostboss.route.biomes).toHaveLength(1);
    expect(atPostboss.route.biomes[0]).toHaveProperty('snapshot');
    expect(atPostboss.route.processing.completeValidPrefix).toEqual(['F']);
    expect(atPostboss.route.processing.afterPlanEnd).toEqual(['G']);
    expect(atPostboss.summary.eligibleForExecutionPlan).toBe(false);

    // At the last configured biome's end it is the unmarked plan.
    const unmarked = simulateProject(catalog, createCompleteFGProject());
    const atLast = simulateProject(
      catalog,
      endAt(createCompleteFGProject(), 'G', 'golden-g-preboss-shop:postboss'),
    );
    expect(atLast.status).toBe('valid');
    expect(atLast.summary).toEqual(unmarked.summary);
    expect(atLast.route.biomes).toEqual(unmarked.route.biomes);
  });

  it('reports an end off the selected spine as the route-owned planEndUnreached', () => {
    const evaluation = simulateProject(
      catalog,
      endAt(createCompleteFGProject(), 'F', 'golden-f-b5-e2'),
    );
    expect(evaluation.status).toBe('invalid');
    expect(evaluation.findings).toEqual([
      {
        code: 'planEndUnreached',
        phase: 'completeness',
        origin: createRouteAddress('Underworld'),
        evidence: { biomeKey: 'F', occurrenceId: 'golden-f-b5-e2' },
      },
    ]);
    expect(evaluation.issue?.owner).toEqual(createRouteAddress('Underworld'));
    expect(evaluation.route.processing).toEqual({
      completeValidPrefix: [],
      active: { kind: 'invalid', biomeKey: 'F' },
      blockedSuffix: [],
      afterPlanEnd: ['G'],
    });
    expect(evaluation.summary.eligibleForExecutionPlan).toBe(false);
    expect(evaluation.authoringHorizon).toEqual({ kind: 'open' });
  });

  it('still requires everything before the end', () => {
    const cleared = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ClearTopology',
      biome: createBiomeAddress('Underworld', 'F'),
    });
    const unended = simulateProject(catalog, cleared);
    const ended = simulateProject(catalog, endAt(cleared, 'G', 'golden-g-b5-e1'));
    expect(unended.status).toBe('incomplete');
    expect(ended.status).toBe('incomplete');
    expect(ended.issue).toEqual(unended.issue);
    expect(ended.route.biomes.map((biome) => biome.authoring)).toEqual(['incomplete']);
    expect(ended.authoringHorizon).toEqual(unended.authoringHorizon);
  });

  it('locks the end room exit and everything after it, but not the room itself', () => {
    const assembly = simulateProjectAssembly(
      catalog,
      endAt(createCompleteFGProject(), 'F', 'golden-f-b5-e1'),
    );
    const f = createBiomeAddress('Underworld', 'F');
    const g = createBiomeAddress('Underworld', 'G');
    const occurrence = (biome: typeof f, id: string) =>
      createOccurrenceAddress(biome, id as OccurrenceId);
    const exit = (id: string) =>
      createExitDecisionAddress(f, { kind: 'occurrence', occurrenceId: id as OccurrenceId });
    expect(authoringReadinessAt(assembly, occurrence(f, 'golden-f-b5-e1'))).toBe('editable');
    expect(authoringReadinessAt(assembly, exit('golden-f-b4-e1'))).toBe('editable');
    expect(authoringReadinessAt(assembly, exit('golden-f-b5-e1'))).toBe('locked');
    expect(authoringReadinessAt(assembly, occurrence(f, 'golden-f-b6-e1'))).toBe('locked');
    expect(authoringReadinessAt(assembly, occurrence(g, 'golden-g-b1-e1'))).toBe('locked');
    expect(authoringReadinessAt(assembly, createRouteAddress('Underworld'))).toBe('editable');
  });

  it('raises no finding for a route-owned placement on a room past the end', () => {
    const placed = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceResourcePlacement',
      route: createRouteAddress('Underworld'),
      family: 'Pickaxe',
      value: { biomeKey: 'F', occurrenceId: 'golden-f-b8-e2' as OccurrenceId },
    });
    expect(simulateProject(catalog, placed).status).toBe('invalid');
    const ended = simulateProject(catalog, endAt(placed, 'F', 'golden-f-b5-e1'));
    expect(ended.status).toBe('valid');
    expect(ended.findings).toEqual([]);
  });

  it('restores the unmarked evaluation when the end is removed', () => {
    const ended = endAt(createCompleteFGProject(), 'F', 'golden-f-b5-e1');
    const removed = applyProjectCommand(ended, catalog, {
      kind: 'ReplacePlanEnd',
      route: createRouteAddress('Underworld'),
      planEnd: null,
    });
    const restored = simulateProject(catalog, removed);
    const unmarked = simulateProject(catalog, createCompleteFGProject());
    expect(restored.status).toBe('valid');
    expect(restored.summary).toEqual(unmarked.summary);
    expect(restored.route.biomes).toEqual(unmarked.route.biomes);
  });

  it('ends inside a Hub stay at the end of a visit or after a side room', () => {
    // combat05 is the first visit; its side rooms are entered sideDoor2, then sideDoor1.
    const atMain = simulateProject(
      catalog,
      endAt(loadSurfaceNProject(), 'N', 'surface-n-combat05'),
    );
    expect(atMain.status).toBe('valid');
    const main = atMain.route.biomes[0]!;
    expect(main.authoring).toBe('ended');
    expect(enteredRooms(main).slice(-3)).toEqual([
      'surface-n-combat05',
      'surface-n-combat05-sideDoor2',
      'surface-n-combat05-sideDoor1',
    ]);
    expect(enteredRooms(main)).not.toContain('surface-n-miniBoss01');

    const atSide = simulateProject(
      catalog,
      endAt(loadSurfaceNProject(), 'N', 'surface-n-combat05-sideDoor2'),
    );
    expect(atSide.status).toBe('valid');
    const side = atSide.route.biomes[0]!;
    expect(side.authoring).toBe('ended');
    expect(enteredRooms(side).at(-1)).toBe('surface-n-combat05-sideDoor2');
    expect(enteredRooms(side)).not.toContain('surface-n-combat05-sideDoor1');

    const atPreHub = simulateProject(
      catalog,
      endAt(loadSurfaceNProject(), 'N', 'surface-n-prehub'),
    );
    expect(atPreHub.route.biomes[0]!.authoring).toBe('ended');
    expect(enteredRooms(atPreHub.route.biomes[0]!).at(-1)).toBe('surface-n-prehub');
  });
});

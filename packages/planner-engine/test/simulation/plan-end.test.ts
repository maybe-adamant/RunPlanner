import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubFountainAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createOccurrenceAddress,
  createPhantomExitAddress,
  createRouteAddress,
  createTargetAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  planEndAvailability,
  authoredStartPointEligibility,
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
  it('ends a biome after an ordinary room: valid and publishable, later biomes dormant', () => {
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
    expect(f).toHaveProperty('snapshot');
    expect(evaluation.route.processing).toEqual({
      completeValidPrefix: [],
      active: null,
      blockedSuffix: [],
      afterPlanEnd: ['G'],
    });
    expect(evaluation.summary.eligibleForExecutionPlan).toBe(true);
    expect(evaluation.authoringHorizon).toEqual({
      kind: 'ended',
      blockedAfter: createOccurrenceAddress(
        createBiomeAddress('Underworld', 'F'),
        'golden-f-b5-e1' as OccurrenceId,
      ),
    });
    const events = history(f);
    expect(enteredRooms(f).at(-1)).toBe('golden-f-b5-e1');
    // The end room settles and exits, generating no doors and departing nowhere.
    const endEvents = events.flatMap((event) =>
      event.occurrenceId === 'golden-f-b5-e1' ? [event.kind] : [],
    );
    expect(endEvents).toContain('emptyOutgoingGenerationCompleted');
    expect(endEvents).toContain('roomCommitted');
    expect(endEvents.at(-1)).toBe('roomExited');
    expect(endEvents).not.toContain('roomDeparted');
    expect(events.at(-1)).toEqual({ kind: 'roomExited', occurrenceId: 'golden-f-b5-e1' });
    if (f.authoring !== 'ended') throw new Error('F did not end');
    expect(
      f.rewards.runStateSnapshots.some(
        (snapshot) =>
          snapshot.checkpoint === 'beforeRoomExit' &&
          'occurrenceId' in snapshot.owner &&
          snapshot.owner.occurrenceId === 'golden-f-b5-e1',
      ),
    ).toBe(true);
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
    const bossEvents = history(f).flatMap((event) =>
      event.occurrenceId === 'golden-f-preboss-shop:boss' ? [event.kind] : [],
    );
    expect(bossEvents.at(-1)).toBe('roomExited');
    expect(bossEvents).not.toContain('roomDeparted');
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
    expect(atPostboss.summary.eligibleForExecutionPlan).toBe(true);

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

  it("keeps the end room's peers editable but locks the siblings of its own doors", () => {
    const assembly = simulateProjectAssembly(
      catalog,
      endAt(createCompleteFGProject(), 'F', 'golden-f-b5-e1'),
    );
    const f = createBiomeAddress('Underworld', 'F');
    const readiness = (id: string) => [
      authoringReadinessAt(assembly, createOccurrenceAddress(f, id as OccurrenceId)),
      authoringReadinessAt(assembly, createIncomingRewardAddress(f, id as OccurrenceId)),
    ];
    // b5-e2 was offered beside the end room by b4-e1's doors: inside the plan.
    expect(readiness('golden-f-b5-e2')).toEqual(['editable', 'editable']);
    expect(readiness('golden-f-b4-e2')).toEqual(['editable', 'editable']);
    // b6-e1 and b6-e2 are the end room's own doors: past the end.
    expect(readiness('golden-f-b6-e1')).toEqual(['locked', 'locked']);
    expect(readiness('golden-f-b6-e2')).toEqual(['locked', 'locked']);
  });

  it('keeps a Hub end visit editable through its side rooms and locks later visits', () => {
    // Visits: combat05 (sides sideDoor2, sideDoor1), miniBoss01, combat02 (side sideDoor1), ...
    const n = createBiomeAddress('Surface', 'N');
    const room = (id: string) => createOccurrenceAddress(n, id as OccurrenceId);
    const group = (id: string) => createLocalVisitOrderAddress(n, id as OccurrenceId, 'sideRooms');
    const atMain = simulateProjectAssembly(
      catalog,
      endAt(loadSurfaceNProject(), 'N', 'surface-n-combat05'),
    );
    const main = (owner: Parameters<typeof authoringReadinessAt>[1]) =>
      authoringReadinessAt(atMain, owner);
    expect(main(room('surface-n-combat05-sideDoor2'))).toBe('editable');
    expect(main(room('surface-n-combat05-sideDoor1'))).toBe('editable');
    expect(main(room('surface-n-combat05-sideDoor3'))).toBe('editable');
    expect(main(group('surface-n-combat05'))).toBe('editable');
    expect(
      main(
        createLocalVisitSlotAddress(
          n,
          'surface-n-combat05' as OccurrenceId,
          'sideRooms',
          'sideDoor3',
        ),
      ),
    ).toBe('editable');
    expect(main(createHubVisitAddress(n, 'hub', 1))).toBe('editable');
    // Later visits are past the end; their board offers are part of the board, before it.
    for (const later of ['surface-n-miniBoss01', 'surface-n-combat02', 'surface-n-combat11']) {
      expect(main(room(later))).toBe('locked');
      expect(main(createIncomingRewardAddress(n, later as OccurrenceId))).toBe('editable');
    }
    expect(main(room('surface-n-combat02-sideDoor1'))).toBe('locked');
    expect(main(group('surface-n-combat02'))).toBe('locked');
    expect(main(createHubVisitAddress(n, 'hub', 2))).toBe('locked');
    // A visit appended to an ended stay would follow its end.
    expect(main(createHubVisitAddress(n, 'hub', 7))).toBe('locked');
    // A board room no visit enters stays as editable as without an end.
    expect(main(room('surface-n-combat10'))).toBe('editable');
    expect(main(createHubDecisionAddress(n, 'hub'))).toBe('editable');
    expect(main(createHubFountainAddress(n, 'hub'))).toBe('editable');
    expect(main(createExitDecisionAddress(n, { kind: 'hubDecision', decisionKey: 'hub' }))).toBe(
      'locked',
    );

    // The end room's hidden door belongs to its doors; a side room's stays inside.
    expect(main(createPhantomExitAddress(n, 'surface-n-combat05' as OccurrenceId))).toBe('locked');
    expect(main(createPhantomExitAddress(n, 'surface-n-combat05-sideDoor2' as OccurrenceId))).toBe(
      'editable',
    );

    // An end at a side room ends after it: the side room entered later is past it.
    const atSide = simulateProjectAssembly(
      catalog,
      endAt(loadSurfaceNProject(), 'N', 'surface-n-combat05-sideDoor2'),
    );
    expect(authoringReadinessAt(atSide, room('surface-n-combat05-sideDoor1'))).toBe('locked');
    expect(authoringReadinessAt(atSide, room('surface-n-combat05-sideDoor3'))).toBe('editable');

    // A Hub the plan ends after keeps every visit.
    const afterHub = simulateProjectAssembly(
      catalog,
      endAt(loadSurfaceNProject(), 'N', 'surface-n-preboss'),
    );
    expect(authoringReadinessAt(afterHub, createHubVisitAddress(n, 'hub', 6))).toBe('editable');
    expect(authoringReadinessAt(afterHub, room('surface-n-combat02'))).toBe('editable');

    // A fountain used after the end visit is past the end.
    const fountainLater = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplaceHubActionOrder',
      hub: createHubDecisionAddress(n, 'hub'),
      actions: [
        { kind: 'roomVisit', hubSlotKey: 'combat05' },
        { kind: 'useFountain' },
        { kind: 'roomVisit', hubSlotKey: 'miniBoss01' },
      ],
    });
    const fountainAfter = simulateProjectAssembly(
      catalog,
      endAt(fountainLater, 'N', 'surface-n-combat05'),
    );
    expect(authoringReadinessAt(fountainAfter, createHubFountainAddress(n, 'hub'))).toBe('locked');
  });

  it('answers candidates through the end and none past it', () => {
    const project = endAt(createCompleteFGProject(), 'F', 'golden-f-b5-e1');
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const f = createBiomeAddress('Underworld', 'F');
    const lastTarget = (source: string) => {
      const decision = project.route.biomes[0]!.topology!.decisions.find(
        (candidate) =>
          candidate.kind === 'exit' &&
          candidate.source.kind === 'occurrence' &&
          candidate.source.occurrenceId === source,
      );
      if (decision?.kind !== 'exit' || decision.normal.kind !== 'batch')
        throw new Error(`${source} has no doors`);
      const target = decision.normal.targets.at(-1)!;
      return session.evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(
          f,
          { kind: 'occurrence', occurrenceId: source as OccurrenceId },
          target.exitKey,
        ),
        gameName: project.route.biomes[0]!.topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === target.occurrenceId,
        )!.gameName,
      });
    };
    // The end room's peer, offered by b4-e1's doors, keeps its alternatives.
    expect(lastTarget('golden-f-b4-e1').kind).toBe('roomTarget');
    expect(lastTarget('golden-f-b5-e1')).toMatchObject({
      kind: 'unavailable',
      reason: 'targetNotReachable',
    });
  });

  it("keeps an ended Hub's visit order a reached context", () => {
    const project = endAt(loadSurfaceNProject(), 'N', 'surface-n-combat05');
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const hub = createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub');
    expect(session.contextReached({ kind: 'hubActionOrder', hub })).toBe(true);
    const swapped = session.evaluate({
      kind: 'hubActionOrder',
      hub,
      actions: [
        { kind: 'useFountain' },
        { kind: 'roomVisit', hubSlotKey: 'miniBoss01' },
        { kind: 'roomVisit', hubSlotKey: 'combat05' },
      ],
    });
    expect(swapped).toMatchObject({
      kind: 'hubActionOrder',
      result: { selectedPossible: true, findings: [] },
    });
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

  it('refuses a Practice start past the plan end', () => {
    const withStart = (project: ProjectDocument, biomeKey: string, point: 'opening' | 'preboss') =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplacePracticeStart',
        route: createRouteAddress('Underworld'),
        startPoint: { biomeKey, point },
      });
    const eligibility = (project: ProjectDocument) =>
      authoredStartPointEligibility(catalog, project, simulateProject(catalog, project));
    const endedAtB5 = endAt(createCompleteFGProject(), 'F', 'golden-f-b5-e1');
    expect(eligibility(withStart(endedAtB5, 'G', 'opening'))).toMatchObject({
      kind: 'ineligible',
      reason: { kind: 'afterPlanEnd' },
    });
    expect(eligibility(withStart(endedAtB5, 'F', 'preboss'))).toMatchObject({
      kind: 'ineligible',
      reason: { kind: 'afterPlanEnd' },
    });
    const endedAtBoss = endAt(createCompleteFGProject(), 'F', 'golden-f-preboss-shop:boss');
    expect(eligibility(withStart(endedAtBoss, 'F', 'preboss')).kind).toBe('eligible');
  });

  it('answers whether the plan can end after a room', () => {
    const f = createBiomeAddress('Underworld', 'F');
    const room = (id: string) => createOccurrenceAddress(f, id as OccurrenceId);
    const complete = simulateProjectAssembly(catalog, createCompleteFGProject());
    expect(planEndAvailability(catalog, complete, room('golden-f-b5-e1'))).toEqual({
      available: true,
    });
    expect(planEndAvailability(catalog, complete, room('golden-f-b5-e2'))).toEqual({
      available: false,
      reason: 'notOnRoute',
    });
    // An invalid placement on a room offered beside the path blocks ends after its door.
    const placed = simulateProjectAssembly(
      catalog,
      applyProjectCommand(createCompleteFGProject(), catalog, {
        kind: 'ReplaceResourcePlacement',
        route: createRouteAddress('Underworld'),
        family: 'Pickaxe',
        value: { biomeKey: 'F', occurrenceId: 'golden-f-b8-e2' as OccurrenceId },
      }),
    );
    expect(planEndAvailability(catalog, placed, room('golden-f-b9-e1'))).toEqual({
      available: false,
      reason: 'notSettled',
    });
    expect(planEndAvailability(catalog, placed, room('golden-f-b5-e1')).available).toBe(true);
  });
});

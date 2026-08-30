import {
  createHubDecisionAddress,
  createHubSlotAddress,
  createOccurrenceAddress,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import {
  createApplication,
  type ApplicationEvaluationEvent,
  type PlannerApplication,
} from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  createGoldenFGHIProject,
  goldenGBiome,
  goldenGOccurrenceId,
  goldenGStartId,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject, nBiome } from '@run-planner/test-fixtures/surface';
import { writeFileSync } from 'node:fs';
import performanceSnapshotContract from './performance-snapshot-contract.json';

export const performanceSnapshotFormat = performanceSnapshotContract.format;
export const performanceSnapshotSampleCount = performanceSnapshotContract.sampleCount;
export const performanceProductTargetsMs = Object.freeze(performanceSnapshotContract.targetsMs);

export const performanceMetricNames = Object.freeze(performanceSnapshotContract.metrics);

export type PerformanceMetricName = (typeof performanceMetricNames)[number];
export type PerformanceRoute = 'underworld' | 'surface';

export interface TimedPerformanceSample {
  readonly durationMs: number;
  readonly events: readonly ApplicationEvaluationEvent[];
  readonly result: unknown;
}

export interface RoutePerformanceSamples {
  readonly project:
    ReturnType<typeof createGoldenFGHIProject> | ReturnType<typeof loadSurfaceNOPQProject>;
  readonly baseline: unknown;
  readonly rebuilds: readonly TimedPerformanceSample[];
  readonly candidates: readonly TimedPerformanceSample[];
  readonly edits: readonly TimedPerformanceSample[];
  readonly undos: readonly TimedPerformanceSample[];
}

export interface RawPerformanceSnapshot {
  readonly format: typeof performanceSnapshotFormat;
  readonly sampleCount: typeof performanceSnapshotSampleCount;
  readonly targetsMs: typeof performanceProductTargetsMs;
  readonly metrics: Readonly<Record<PerformanceMetricName, number>>;
}

interface RouteDefinition {
  readonly createProject: () => RoutePerformanceSamples['project'];
  readonly prepareCandidate: (application: PlannerApplication) => () => unknown;
  readonly applyEdit: (application: PlannerApplication) => void;
}

interface ObservedApplication {
  readonly application: PlannerApplication;
  readonly events: ApplicationEvaluationEvent[];
}

function measure<T>(operation: () => T): { readonly durationMs: number; readonly result: T } {
  const started = performance.now();
  const result = operation();
  return Object.freeze({ durationMs: performance.now() - started, result });
}

function medianDuration(samples: readonly TimedPerformanceSample[]): number {
  const orderedDurations = samples.map(({ durationMs }) => durationMs).sort((a, b) => a - b);
  return orderedDurations[Math.floor(orderedDurations.length / 2)]!;
}

function observedApplication(): ObservedApplication {
  const events: ApplicationEvaluationEvent[] = [];
  return {
    application: createApplication({ observeEvaluationWork: (event) => events.push(event) }),
    events,
  };
}

function currentWorkspace(application: PlannerApplication) {
  const workspace = application.store.getState().projectWorkspace;
  if (workspace.kind !== 'openProject') throw new Error('expected an open project');
  return workspace;
}

function snapshotEvents(
  events: readonly ApplicationEvaluationEvent[],
): readonly ApplicationEvaluationEvent[] {
  return Object.freeze([...events]);
}

const routeDefinitions: Readonly<Record<PerformanceRoute, RouteDefinition>> = Object.freeze({
  underworld: {
    createProject: createGoldenFGHIProject,
    prepareCandidate: (application) => {
      const target = createTargetAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId: goldenGStartId },
        'exit1',
      );
      const workspace = application.selectStructuredWorkspace(application.store.getState());
      if (workspace === undefined) throw new Error('workspace projection is unavailable');
      const roomCandidates = workspace.interactions.rooms.get(semanticAddressKey(target));
      if (roomCandidates === undefined) {
        throw new Error('G cold room-candidate interaction is missing');
      }
      return () => roomCandidates.load();
    },
    applyEdit: (application) => {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceOccurrenceRoom',
          occurrence: createOccurrenceAddress(goldenGBiome, goldenGOccurrenceId(1, 1)),
          gameName: 'G_Combat02',
        }),
      );
    },
  },
  surface: {
    createProject: loadSurfaceNOPQProject,
    prepareCandidate: (application) => {
      const hubSlot = createHubSlotAddress(nBiome, 'hub', 'miniBoss02');
      const workspace = application.selectStructuredWorkspace(application.store.getState());
      if (workspace === undefined) throw new Error('workspace projection is unavailable');
      const hubCandidates = workspace.interactions.hubSlots.get(semanticAddressKey(hubSlot));
      if (hubCandidates === undefined || hubCandidates.selected) {
        throw new Error('N cold Hub-slot candidate interaction is missing');
      }
      return () => hubCandidates.beginOpeningAttempt().load();
    },
    applyEdit: (application) => {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          hub: createHubDecisionAddress(nBiome, 'hub'),
          hubSlotKeys: ['combat02', 'combat01', 'combat03', 'combat05', 'combat09', 'combat10'],
          kind: 'ReplaceHubVisitOrder',
        }),
      );
    },
  },
});

function runFullRebuildSamples(definition: RouteDefinition): {
  readonly project: RoutePerformanceSamples['project'];
  readonly baseline: unknown;
  readonly rebuilds: readonly TimedPerformanceSample[];
} {
  const { application, events } = observedApplication();
  const project = definition.createProject();
  application.store.dispatch(authoredProjectReplaced(project));
  const baseline = currentWorkspace(application).assembly.evaluation;
  events.length = 0;
  simulateProject(application.catalog, project);
  const rebuilds = Object.freeze(
    Array.from({ length: performanceSnapshotSampleCount }, () => {
      const measured = measure(() => simulateProject(application.catalog, project));
      return Object.freeze({
        ...measured,
        events: snapshotEvents(events),
      });
    }),
  );
  application.dispose();
  return Object.freeze({ project, baseline, rebuilds });
}

function runCandidateSamples(definition: RouteDefinition): readonly TimedPerformanceSample[] {
  return Object.freeze(
    Array.from({ length: performanceSnapshotSampleCount }, () => {
      const { application, events } = observedApplication();
      const project = definition.createProject();
      application.store.dispatch(authoredProjectReplaced(project));
      events.length = 0;
      const candidateOperation = definition.prepareCandidate(application);
      const candidate = measure(candidateOperation);
      application.dispose();
      return Object.freeze({ ...candidate, events: snapshotEvents(events) });
    }),
  );
}

function runEditSamples(definition: RouteDefinition): readonly TimedPerformanceSample[] {
  return Object.freeze(
    Array.from({ length: performanceSnapshotSampleCount }, () => {
      const { application, events } = observedApplication();
      const project = definition.createProject();
      application.store.dispatch(authoredProjectReplaced(project));
      events.length = 0;
      const edit = measure(() => definition.applyEdit(application));
      const present = currentWorkspace(application).history.present;
      application.dispose();
      return Object.freeze({
        ...edit,
        events: snapshotEvents(events),
        result: Object.freeze({ present, project }),
      });
    }),
  );
}

function runUndoSamples(definition: RouteDefinition): readonly TimedPerformanceSample[] {
  return Object.freeze(
    Array.from({ length: performanceSnapshotSampleCount }, () => {
      const { application, events } = observedApplication();
      const project = definition.createProject();
      application.store.dispatch(authoredProjectReplaced(project));
      const baseline = currentWorkspace(application).assembly.evaluation;
      definition.applyEdit(application);
      events.length = 0;
      const undo = measure(() => application.store.dispatch(authoredProjectUndoRequested()));
      const present = currentWorkspace(application).history.present;
      const evaluation = currentWorkspace(application).assembly.evaluation;
      application.dispose();
      return Object.freeze({
        ...undo,
        events: snapshotEvents(events),
        result: Object.freeze({ present, project, baseline, evaluation }),
      });
    }),
  );
}

export function runPerformanceRoute(route: PerformanceRoute): RoutePerformanceSamples {
  const definition = routeDefinitions[route];
  const rebuild = runFullRebuildSamples(definition);
  return Object.freeze({
    ...rebuild,
    candidates: runCandidateSamples(definition),
    edits: runEditSamples(definition),
    undos: runUndoSamples(definition),
  });
}

export function createRawPerformanceSnapshot(
  routes: Readonly<Record<PerformanceRoute, RoutePerformanceSamples>>,
): RawPerformanceSnapshot {
  const metrics = {
    'underworld.fullRebuildMs': medianDuration(routes.underworld.rebuilds),
    'underworld.coldCandidateProjectionMs': medianDuration(routes.underworld.candidates),
    'underworld.representativeEditPublicationMs': medianDuration(routes.underworld.edits),
    'underworld.cachedUndoPublicationMs': medianDuration(routes.underworld.undos),
    'surface.fullRebuildMs': medianDuration(routes.surface.rebuilds),
    'surface.coldCandidateProjectionMs': medianDuration(routes.surface.candidates),
    'surface.representativeEditPublicationMs': medianDuration(routes.surface.edits),
    'surface.cachedUndoPublicationMs': medianDuration(routes.surface.undos),
  } satisfies Record<PerformanceMetricName, number>;
  return Object.freeze({
    format: performanceSnapshotFormat,
    sampleCount: performanceSnapshotSampleCount,
    targetsMs: performanceProductTargetsMs,
    metrics: Object.freeze(metrics),
  });
}

export function writeRawPerformanceSnapshot(path: string, snapshot: RawPerformanceSnapshot): void {
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

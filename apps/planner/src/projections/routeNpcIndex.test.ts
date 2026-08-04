import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createLocalChildAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog, EncounterDefinition } from '@run-planner/engine/catalog-schema';
import {
  createEncounterCommandAuthorization,
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type EncounterHistoryEntry,
  type ProjectRouteEvaluation,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures';

import { projectRouteNpcIndex, RouteNpcIndexProjectionContractError } from './routeNpcIndex';

const fArtemisPhase = createEncounterPhaseAddress(
  goldenFBiome,
  { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
  'Encounter',
);
const gArtemisPhase = createEncounterPhaseAddress(
  goldenGBiome,
  { kind: 'occurrence', occurrenceId: goldenGOccurrenceId(4, 1) },
  'Encounter',
);
const fNemesisPhase = createEncounterPhaseAddress(
  goldenFBiome,
  { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
  'Encounter',
);

function selectEncounter(
  project: ProjectDocument,
  phase: typeof fArtemisPhase,
  encounterKey: string,
): ProjectDocument {
  const assembly = simulateProjectAssembly(catalog, project);
  return applyProjectCommand(
    project,
    catalog,
    { kind: 'SelectEncounter', phase, encounterKey },
    { encounterAuthorization: createEncounterCommandAuthorization(catalog, assembly) },
  );
}

function underworldRoute(
  application: ReturnType<typeof createApplication>,
): ProjectRouteEvaluation {
  const route = application.store
    .getState()
    .projectWorkspace.assembly.evaluation.routes.find(
      (candidate) => candidate.routeKey === 'Underworld',
    );
  if (route === undefined) throw new Error('Underworld evaluation is missing');
  return route;
}

function routeIndexFixture(project: ProjectDocument) {
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(project));
  const workspace = application.selectStructuredWorkspace(application.store.getState());
  return Object.freeze({ application, route: underworldRoute(application), workspace });
}

function latestHistory(route: ProjectRouteEvaluation) {
  for (let index = route.biomes.length - 1; index >= 0; index -= 1) {
    const biome = route.biomes[index];
    if (biome !== undefined && 'history' in biome) return biome.history;
  }
  throw new Error('route has no history-bearing biome');
}

function withoutArtemisPresentationMetadata(): Catalog {
  const original = catalog.encounterDefinitions.byKey.ArtemisCombatF;
  if (original === undefined) throw new Error('Artemis Combat F definition is missing');
  const replacement = Object.freeze<EncounterDefinition>({
    key: original.key,
    label: original.label,
    kind: original.kind,
    countsEncounterDepth: original.countsEncounterDepth,
    ...(original.requirements === undefined ? {} : { requirements: original.requirements }),
    ...(original.sequenceEffect === undefined ? {} : { sequenceEffect: original.sequenceEffect }),
  });
  return Object.freeze({
    ...catalog,
    encounterDefinitions: Object.freeze({
      values: Object.freeze(
        catalog.encounterDefinitions.values.map((definition) =>
          definition.key === replacement.key ? replacement : definition,
        ),
      ),
      byKey: Object.freeze({
        ...catalog.encounterDefinitions.byKey,
        [replacement.key]: replacement,
      }),
    }),
  });
}

describe('route NPC index projection', () => {
  it('uses only the latest cumulative history ledger, preserving exact Artemis phase navigation', () => {
    const project = selectEncounter(createCompleteFGProject(), fArtemisPhase, 'ArtemisCombatF');
    const fixture = routeIndexFixture(project);
    try {
      const index = projectRouteNpcIndex(catalog, fixture.route, fixture.workspace.focusByOwner);

      expect(index.groups).toEqual([
        {
          presentationKey: 'Artemis',
          entries: [
            expect.objectContaining({
              encounterKey: 'ArtemisCombatF',
              label: 'Artemis combat',
              locationLabel: 'Erebus · Encounter',
              phase: fArtemisPhase,
            }),
          ],
        },
      ]);
      expect(index.groups[0]?.entries).toHaveLength(1);
    } finally {
      fixture.application.dispose();
    }
  });

  it('projects Nemesis through the same metadata grouping and exact phase destination', () => {
    const project = selectEncounter(createCompleteFGProject(), fNemesisPhase, 'NemesisCombatF');
    const fixture = routeIndexFixture(project);
    try {
      expect(
        projectRouteNpcIndex(catalog, fixture.route, fixture.workspace.focusByOwner).groups,
      ).toEqual([
        {
          presentationKey: 'Nemesis',
          entries: [
            expect.objectContaining({
              encounterKey: 'NemesisCombatF',
              label: 'Nemesis combat',
              locationLabel: 'Erebus · Encounter',
              phase: fNemesisPhase,
            }),
          ],
        },
      ]);
    } finally {
      fixture.application.dispose();
    }
  });

  it('omits a retained invalid NPC selection while retaining the prior resolved record', () => {
    let project = createCompleteFGProject();
    project = selectEncounter(project, gArtemisPhase, 'ArtemisCombatG');
    project = selectEncounter(project, fArtemisPhase, 'ArtemisCombatF');
    const fixture = routeIndexFixture(project);
    try {
      const index = projectRouteNpcIndex(catalog, fixture.route, fixture.workspace.focusByOwner);

      expect(index.groups).toHaveLength(1);
      expect(index.groups[0]?.entries.map((entry) => entry.encounterKey)).toEqual([
        'ArtemisCombatF',
      ]);
      expect(index.groups[0]?.entries[0]?.phase).toEqual(fArtemisPhase);
    } finally {
      fixture.application.dispose();
    }
  });

  it('requires exact workspace containment for every published row', () => {
    const project = selectEncounter(createCompleteFGProject(), fArtemisPhase, 'ArtemisCombatF');
    const fixture = routeIndexFixture(project);
    try {
      const ownerKey = semanticAddressKey(fArtemisPhase);
      const missing = new Map(fixture.workspace.focusByOwner);
      missing.delete(ownerKey);
      expect(() => projectRouteNpcIndex(catalog, fixture.route, missing)).toThrow(
        RouteNpcIndexProjectionContractError,
      );

      const destination = fixture.workspace.focusByOwner.get(ownerKey);
      if (destination === undefined) throw new Error('Artemis fixture has no phase destination');
      const misrouted = new Map(fixture.workspace.focusByOwner);
      misrouted.set(
        ownerKey,
        Object.freeze({
          ...destination,
          ownerAddress: createLocalChildAddress(
            goldenFBiome,
            goldenFOccurrenceId(5, 1),
            'sideRooms',
            'sideDoor1',
          ),
        }),
      );
      expect(() => projectRouteNpcIndex(catalog, fixture.route, misrouted)).toThrow(
        RouteNpcIndexProjectionContractError,
      );
    } finally {
      fixture.application.dispose();
    }
  });

  it('maps local-child records exactly and leaves presentation metadata outside simulation behavior', () => {
    const project = selectEncounter(createCompleteFGProject(), fArtemisPhase, 'ArtemisCombatF');
    const fixture = routeIndexFixture(project);
    try {
      const localOrigin = createLocalChildAddress(
        goldenFBiome,
        goldenFOccurrenceId(5, 1),
        'sideRooms',
        'sideDoor1',
      );
      const localPhase = createEncounterPhaseAddress(
        goldenFBiome,
        {
          kind: 'localChild',
          occurrenceId: localOrigin.occurrenceId,
          groupKey: localOrigin.groupKey,
          slotKey: localOrigin.slotKey,
        },
        'Encounter',
      );
      const originalHistory = latestHistory(fixture.route);
      const sourceRecord = originalHistory.ledgers.encounterRecords.find(
        (record) => record.encounterKey === 'ArtemisCombatF',
      );
      if (sourceRecord === undefined) throw new Error('Artemis fixture has no resolved record');
      const localRecord: EncounterHistoryEntry = Object.freeze({
        ...sourceRecord,
        origin: localOrigin,
        sequence: sourceRecord.sequence + 1,
      });
      const lastBiomeIndex = fixture.route.biomes.length - 1;
      const lastBiome = fixture.route.biomes[lastBiomeIndex];
      if (lastBiome === undefined || !('history' in lastBiome)) {
        throw new Error('Artemis fixture has no latest history-bearing biome');
      }
      // This deliberately mutates only the published history ledger to prove
      // that the generic address mapper accepts local-child NPC records.
      const routeWithLocalRecord = Object.freeze({
        ...fixture.route,
        biomes: Object.freeze(
          fixture.route.biomes.map((biome, index) =>
            index !== lastBiomeIndex
              ? biome
              : Object.freeze({
                  ...lastBiome,
                  history: Object.freeze({
                    ...lastBiome.history,
                    ledgers: Object.freeze({
                      ...lastBiome.history.ledgers,
                      encounterRecords: Object.freeze([
                        ...lastBiome.history.ledgers.encounterRecords,
                        localRecord,
                      ]),
                    }),
                  }),
                }),
          ),
        ),
      }) as ProjectRouteEvaluation;
      const localFocus = new Map(fixture.workspace.focusByOwner);
      const localKey = semanticAddressKey(localPhase);
      localFocus.set(
        localKey,
        Object.freeze({
          biomeKey: 'F',
          focusAddress: localPhase,
          focusKey: localKey,
          inspectorSubject: Object.freeze({ kind: 'node' as const, nodeKey: 'local-child-test' }),
          nodeKey: 'local-child-test',
          ownerAddress: localPhase,
          region: 'inspector' as const,
          routeKey: 'Underworld',
        }),
      );
      const localIndex = projectRouteNpcIndex(catalog, routeWithLocalRecord, localFocus);
      expect(localIndex.groups[0]?.entries.map((entry) => entry.phase)).toContainEqual(localPhase);

      const metadataFreeCatalog = withoutArtemisPresentationMetadata();
      const metadataFreeAssembly = simulateProjectAssembly(metadataFreeCatalog, project);
      expect(
        encounterPhaseCandidateSupportForProjectEvaluationAssembly(
          metadataFreeAssembly,
          fArtemisPhase,
        ),
      ).toEqual(
        encounterPhaseCandidateSupportForProjectEvaluationAssembly(
          simulateProjectAssembly(catalog, project),
          fArtemisPhase,
        ),
      );
      const metadataFreeRoute = metadataFreeAssembly.evaluation.routes.find(
        (route) => route.routeKey === 'Underworld',
      );
      if (metadataFreeRoute === undefined)
        throw new Error('metadata-free Underworld route is missing');
      expect(latestHistory(metadataFreeRoute).ledgers.encounterRecords).toEqual(
        latestHistory(fixture.route).ledgers.encounterRecords,
      );
      expect(
        projectRouteNpcIndex(metadataFreeCatalog, metadataFreeRoute, fixture.workspace.focusByOwner)
          .groups,
      ).toEqual([]);
    } finally {
      fixture.application.dispose();
    }
  });
});

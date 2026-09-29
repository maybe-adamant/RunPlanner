import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createEncounterPhaseAddress,
  createOccurrenceId,
  createProjectHistory,
  createRouteStartKeepsakeSelectionAddress,
  redoProjectHistory,
  semanticAddressKey,
  undoProjectHistory,
  type EncounterPhaseAddress,
  type ProjectDocument,
} from '../../../src/authored-project';
import type { AuthoredGeneratedEncounterCustomization } from '../../../src/authored-project/model';
import {
  generatedEncounterSupportForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '../../../src/simulation';
import { prepareRoomEncounterPhases } from '../../../src/simulation/encounters/preparation';
import { ordinaryPositionFor } from '../../support/route-position';
import {
  assessGeneratedEncounter,
  encounteredEnemyKeys,
} from '../../../src/simulation/encounters/generation';
import type { HistoryEvent } from '../../../src/simulation/history/model';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOProject, oBiome } from '@run-planner/test-fixtures/surface';

const fPhase = (batch: number) =>
  createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(batch, 1) },
    'Encounter',
  );
const hCage = (occurrence: string, slot: string) =>
  createEncounterPhaseAddress(
    goldenHBiome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId(occurrence) },
    slot,
  );

const guardAndBrawler: AuthoredGeneratedEncounterCustomization = {
  kind: 'generated',
  waveCount: 1,
  waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 50 } }],
};
const guardHighlight: AuthoredGeneratedEncounterCustomization = {
  kind: 'generated',
  waveCount: 2,
  highlightKey: 'Guard',
  waves: [
    { waveIndex: 1, typeKeys: [] },
    { waveIndex: 2, typeKeys: ['Brawler'], allocations: { Guard: 30 } },
  ],
};
const eliteGuard: AuthoredGeneratedEncounterCustomization = {
  kind: 'generated',
  waveCount: 1,
  waves: [
    {
      waveIndex: 1,
      typeKeys: ['Guard_Elite', 'Brawler'],
      allocations: { Guard_Elite: 100 },
    },
  ],
};

function customize(
  project: ProjectDocument,
  phase: EncounterPhaseAddress,
  value: AuthoredGeneratedEncounterCustomization,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase,
    decisionKey: 'generatedComposition',
    value,
  });
}

function evaluatedBiome(project: ProjectDocument, biomeKey: string) {
  const assembly = simulateProjectAssembly(catalog, project);
  const biome = assembly.evaluation.route?.biomes.find((entry) => entry.biomeKey === biomeKey);
  if (biome === undefined || !('history' in biome)) throw new Error(`${biomeKey} unassessed`);
  return { assembly, biome };
}

function phaseEvent(
  events: readonly HistoryEvent[],
  phase: EncounterPhaseAddress,
  kind: 'encounterRecorded' | 'encounterStarted' | 'encounterCompleted',
): HistoryEvent {
  const event = events.find(
    (candidate) =>
      candidate.kind === kind &&
      candidate.phaseKey === phase.phaseKey &&
      candidate.origin.kind === 'occurrence' &&
      candidate.origin.occurrenceId === phase.owner.occurrenceId,
  );
  if (event === undefined) throw new Error(`missing ${kind} for ${phase.owner.occurrenceId}`);
  return event;
}

function knownAt(biome: ReturnType<typeof evaluatedBiome>['biome'], event: HistoryEvent) {
  return biome.history.viewsBySequence[event.sequence]!.ledgers.knownEncounteredEnemyKeys;
}

function finalKnown(biome: ReturnType<typeof evaluatedBiome>['biome']) {
  return knownAt(biome, biome.history.events.at(-1)!);
}

describe('known encountered enemies at encounter completion', () => {
  it('accumulates sequential customized completions and deduplicates repeated names', () => {
    let project = customize(createCompleteFGProject(), fPhase(3), guardAndBrawler);
    project = customize(project, fPhase(5), guardHighlight);
    project = customize(project, fPhase(7), eliteGuard);
    const { biome } = evaluatedBiome(project, 'F');
    const events = biome.history.events;

    expect(knownAt(biome, phaseEvent(events, fPhase(3), 'encounterCompleted'))).toEqual([
      'Brawler',
      'Guard',
    ]);
    expect(knownAt(biome, phaseEvent(events, fPhase(5), 'encounterCompleted'))).toEqual([
      'Brawler',
      'Guard',
    ]);
    expect(knownAt(biome, phaseEvent(events, fPhase(7), 'encounterCompleted'))).toEqual([
      'Brawler',
      'Guard',
      'Guard_Elite',
    ]);
  });

  it('writes at completion, never at preparation or start', () => {
    const project = customize(createCompleteFGProject(), fPhase(3), guardAndBrawler);
    const { biome } = evaluatedBiome(project, 'F');
    const events = biome.history.events;
    const room = biome.history.rooms.find(
      (entry) =>
        entry.origin.kind === 'occurrence' &&
        entry.origin.occurrenceId === goldenFOccurrenceId(3, 1),
    )!;

    expect(room.preparation.ledgers.knownEncounteredEnemyKeys).toEqual([]);
    expect(knownAt(biome, phaseEvent(events, fPhase(3), 'encounterRecorded'))).toEqual([]);
    expect(knownAt(biome, phaseEvent(events, fPhase(3), 'encounterStarted'))).toEqual([]);
    expect(knownAt(biome, phaseEvent(events, fPhase(3), 'encounterCompleted'))).toEqual([
      'Brawler',
      'Guard',
    ]);
  });

  it('records nothing for uncustomized, incomplete or Fig Leaf-skipped encounters', () => {
    expect(finalKnown(evaluatedBiome(createCompleteFGProject(), 'F').biome)).toEqual([]);

    const incomplete = customize(createCompleteFGProject(), fPhase(3), {
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'] }],
    });
    expect(finalKnown(evaluatedBiome(incomplete, 'F').biome)).toEqual([]);

    let skipped = applyProjectCommand(
      customize(createCompleteFGProject(), fPhase(2), guardAndBrawler),
      catalog,
      {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
        keepsakeKey: 'SkipEncounterKeepsake',
      },
    );
    skipped = applyProjectCommand(skipped, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: fPhase(2),
      value: true,
    });
    const { biome } = evaluatedBiome(skipped, 'F');
    const completion = phaseEvent(biome.history.events, fPhase(2), 'encounterCompleted');
    expect(completion).toMatchObject({ execution: 'skippedByFigLeaf' });
    expect(finalKnown(biome)).toEqual([]);
  });

  it('leaves a positive Menace conversion unrecorded without an attested Menace rank', () => {
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'NextBiomeEnemyShrineUpgrade',
      rank: 2,
    });
    project = customize(project, fPhase(3), {
      ...guardAndBrawler,
      menace: [{ waveIndex: 1, conversions: { Guard: { count: 2 } } }],
    });
    project = customize(project, fPhase(5), {
      ...guardHighlight,
      menace: [{ waveIndex: 2, conversions: { Guard: { count: 0 } } }],
    });
    const { biome } = evaluatedBiome(project, 'F');
    const events = biome.history.events;

    expect(knownAt(biome, phaseEvent(events, fPhase(3), 'encounterCompleted'))).toEqual([]);
    expect(knownAt(biome, phaseEvent(events, fPhase(5), 'encounterCompleted'))).toEqual([
      'Brawler',
      'Guard',
    ]);
  });

  it('owns each H cage at its own completion without re-resolving its prepared sibling', () => {
    const occurrence = 'golden-h-combat09';
    // The golden room orders Cage02 before Cage01.
    const first = hCage(occurrence, 'Cage02');
    const second = hCage(occurrence, 'Cage01');
    const pair = (
      typeKeys: readonly [string, string],
    ): AuthoredGeneratedEncounterCustomization => ({
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys, allocations: { [typeKeys[0]]: 268 } }],
    });
    const secondOnly = customize(createGoldenFGHIProject(), second, pair(['Mourner', 'Lamia']));
    const both = customize(secondOnly, first, pair(['BrokenHearted', 'Lovesick']));
    const { biome } = evaluatedBiome(both, 'H');
    const events = biome.history.events;
    const firstCompletion = phaseEvent(events, first, 'encounterCompleted');
    const secondStart = phaseEvent(events, second, 'encounterStarted');
    expect(firstCompletion.sequence).toBeLessThan(secondStart.sequence);

    expect(knownAt(biome, firstCompletion)).toEqual(['BrokenHearted', 'Lovesick']);
    expect(knownAt(biome, secondStart)).toEqual(['BrokenHearted', 'Lovesick']);
    expect(knownAt(biome, phaseEvent(events, second, 'encounterCompleted'))).toEqual([
      'BrokenHearted',
      'Lamia',
      'Lovesick',
      'Mourner',
    ]);
    const secondRecord = (project: ProjectDocument) =>
      phaseEvent(evaluatedBiome(project, 'H').biome.history.events, second, 'encounterRecorded');
    expect(secondRecord(both)).toEqual(secondRecord(secondOnly));
  });

  it('owns each Ship phase at its own completion', () => {
    const phase = (slotKey: string) =>
      createEncounterPhaseAddress(
        oBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-o-combat04') },
        slotKey,
      );
    let project = loadSurfaceNOProject();
    for (const slotKey of ['Intro', 'Combat1']) {
      const value = generatedEncounterSupportForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, project),
        phase(slotKey),
      )?.initialize();
      if (value === undefined) throw new Error(`${slotKey} has no initial composition`);
      project = customize(project, phase(slotKey), value);
    }
    const { biome } = evaluatedBiome(project, 'O');
    const events = biome.history.events;
    const recorded = (slotKey: string) => {
      const event = phaseEvent(events, phase(slotKey), 'encounterRecorded');
      if (event.kind !== 'encounterRecorded') throw new Error('not a record');
      return event.generatedCustomization?.encounteredEnemyKeys;
    };
    expect(recorded('Intro')?.length).toBeGreaterThan(0);
    expect(recorded('Combat1')?.length).toBeGreaterThan(0);

    expect(knownAt(biome, phaseEvent(events, phase('Intro'), 'encounterCompleted'))).toEqual(
      recorded('Intro'),
    );
    expect(knownAt(biome, phaseEvent(events, phase('Combat1'), 'encounterStarted'))).toEqual(
      recorded('Intro'),
    );
    expect(knownAt(biome, phaseEvent(events, phase('Combat1'), 'encounterCompleted'))).toEqual(
      [...new Set([...recorded('Intro')!, ...recorded('Combat1')!])].sort(),
    );
  });

  it('records a declaration-owned fixed seed with its generated members', () => {
    const cage = hCage('golden-h-combat05', 'Cage01');
    const project = customize(
      applyProjectCommand(createGoldenFGHIProject(), catalog, {
        kind: 'SelectEncounter',
        phase: cage,
        encounterKey: 'GeneratedH_Treant2',
      }),
      cage,
      {
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'], allocations: { FogEmitter2: 1 } }],
      },
    );
    const { biome } = evaluatedBiome(project, 'H');
    expect(knownAt(biome, phaseEvent(biome.history.events, cage, 'encounterCompleted'))).toEqual([
      'FogEmitter2',
      'Treant2',
    ]);
  });

  it('removes and restores derived facts through upstream edit, Undo and Redo', () => {
    const edited = applyProjectHistoryCommand(
      createProjectHistory(createCompleteFGProject()),
      catalog,
      {
        kind: 'ReplaceEncounterCustomization',
        phase: fPhase(3),
        decisionKey: 'generatedComposition',
        value: guardAndBrawler,
      },
    );
    expect(finalKnown(evaluatedBiome(edited.present, 'F').biome)).toEqual(['Brawler', 'Guard']);
    const undone = undoProjectHistory(edited);
    expect(finalKnown(evaluatedBiome(undone.present, 'F').biome)).toEqual([]);
    expect(finalKnown(evaluatedBiome(redoProjectHistory(undone).present, 'F').biome)).toEqual([
      'Brawler',
      'Guard',
    ]);
  });
});

describe('known encountered enemy consumers', () => {
  it('captures the set in Run State at later checkpoints and carries it to the next biome', () => {
    const project = customize(createCompleteFGProject(), fPhase(3), guardAndBrawler);
    const route = simulateProject(catalog, project).route;
    const snapshots = route.biomes.flatMap((biome) =>
      biome.authoring === 'complete' && biome.validity === 'valid'
        ? biome.rewards.runStateSnapshots
        : [],
    );
    const at = (occurrenceId: string, checkpoint: string) =>
      snapshots.find((snapshot) => {
        const key = semanticAddressKey(snapshot.owner);
        return key.includes(`"${occurrenceId}"`) && key.includes(`"${checkpoint}"`);
      })?.knownEncounteredEnemyKeys;

    expect(at(goldenFOccurrenceId(3, 1), 'roomEntered')).toEqual([]);
    expect(at(goldenFOccurrenceId(3, 1), 'beforeRoomExit')).toEqual(['Brawler', 'Guard']);
    expect(at(goldenFOccurrenceId(4, 1), 'roomEntered')).toEqual(['Brawler', 'Guard']);
    expect(at(goldenGOccurrenceId(1, 1), 'roomEntered')).toEqual(['Brawler', 'Guard']);
  });

  it('exposes the set to Encounter Definition requirements at later preparation', () => {
    const requirement = {
      kind: 'recordCount',
      record: 'knownEncounteredEnemies',
      keys: ['Guard'],
      range: { min: 1 },
    } as const;
    const definition = catalog.encounterDefinitions.byKey.GeneratedF!;
    const gated = {
      ...catalog,
      encounterDefinitions: {
        ...catalog.encounterDefinitions,
        byKey: {
          ...catalog.encounterDefinitions.byKey,
          GeneratedF: { ...definition, requirements: requirement },
        },
      },
    };
    const project = customize(createCompleteFGProject(), fPhase(3), guardAndBrawler);
    const { biome } = evaluatedBiome(project, 'F');
    if (biome.authoring !== 'complete' || biome.validity !== 'valid')
      throw new Error('F is not valid');
    const prepare = (batch: number) => {
      const occurrenceId = goldenFOccurrenceId(batch, 1);
      const room = biome.snapshot.decisions
        .flatMap((decision) =>
          decision.kind === 'batch' ? decision.targets.map((target) => target.room) : [],
        )
        .find((candidate) => candidate.occurrenceId === occurrenceId);
      const preparation = biome.history.rooms.find(
        (entry) => entry.origin.kind === 'occurrence' && entry.origin.occurrenceId === occurrenceId,
      )?.preparation;
      if (room === undefined || preparation === undefined) throw new Error('missing preparation');
      return prepareRoomEncounterPhases(
        gated,
        room,
        ordinaryPositionFor(catalog, room.origin),
        preparation,
      ).candidates[0]!;
    };

    const before = prepare(3);
    expect(before.selectedPossible).toBe(false);
    expect(before.exclusions).toContainEqual(
      expect.objectContaining({
        encounterKey: 'GeneratedF',
        definitions: [
          expect.objectContaining({
            evaluation: expect.objectContaining({
              kind: 'recordCount',
              record: 'knownEncounteredEnemies',
              actual: 0,
            }),
          }),
        ],
      }),
    );
    expect(prepare(5).selectedPossible).toBe(true);
  });
});

describe('effective encountered enemy identities', () => {
  const policy = (key: string) => {
    const selection = catalog.encounterDefinitions.byKey[key]!.customization!.find(
      (entry) => entry.selection.kind === 'generated',
    )!.selection;
    if (selection.kind !== 'generated') throw new Error(key);
    return selection;
  };
  const context = { biomeDepthCache: 8, biomeEncounterDepth: 8, knownRunBlacklist: [] };
  const withMenace = (count: number): AuthoredGeneratedEncounterCustomization => ({
    kind: 'generated',
    waveCount: 1,
    waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 70 } }],
    menace: [{ waveIndex: 1, conversions: { Guard: { count } } }],
  });
  const identities = (value: AuthoredGeneratedEncounterCustomization, menaceRank = 1) => {
    const source = policy('GeneratedF');
    return encounteredEnemyKeys(
      source,
      assessGeneratedEncounter(source, value, { ...context, menaceRank }).operands!,
    );
  };

  it('excludes a fully replaced source and includes each positive replacement', () => {
    expect(identities(withMenace(0))).toEqual(['Brawler', 'Guard']);
    expect(identities(withMenace(1))).toEqual(['Brawler', 'Guard', 'Guard2']);
    expect(identities(withMenace(14))).toEqual(['Brawler', 'Guard2']);
    expect(identities(withMenace(14), 0)).toEqual(['Brawler', 'Guard']);
  });

  it('includes fixed seeds and retains exact elite and base names', () => {
    const fixed = policy('GeneratedH_Treant2');
    expect(
      encounteredEnemyKeys(
        fixed,
        assessGeneratedEncounter(
          fixed,
          {
            kind: 'generated',
            waveCount: 1,
            waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'], allocations: { FogEmitter2: 1 } }],
          },
          context,
        ).operands!,
      ),
    ).toEqual(['FogEmitter2', 'Treant2']);
    const source = policy('GeneratedF');
    expect(
      encounteredEnemyKeys(source, assessGeneratedEncounter(source, eliteGuard, context).operands!),
    ).toEqual(['Brawler', 'Guard_Elite']);
  });
});

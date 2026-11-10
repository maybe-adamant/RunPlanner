import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  encounterOutcomesForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  loadSurfaceNOPProject,
  pBiome,
  pOccurrenceId,
  reachedPOutdoorIcarusFixture,
} from '@run-planner/test-fixtures/surface';
import { loadNemesisPomSeaStarCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  replaceNemesisRandomEventInteraction,
} from '@run-planner/test-fixtures/underworld';

const pCombat03 = pOccurrenceId('P_Combat03', 1, 1);
const combat = createEncounterPhaseAddress(
  pBiome,
  { kind: 'occurrence', occurrenceId: pCombat03 },
  'Combat',
);

function outcomes(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  return encounterOutcomesForProjectEvaluationAssembly(
    catalog,
    simulateProjectAssembly(catalog, project),
    createOccurrenceAddress(
      createBiomeAddress(project.route.routeKey, biomeKey),
      createOccurrenceId(occurrenceId),
    ),
  );
}

function withKeepsake(keepsakeKey: string): ProjectDocument {
  return applyProjectCommand(loadSurfaceNOPProject(), catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Surface'),
    keepsakeKey,
  });
}

describe('Encounter outcome', () => {
  it('hosts the Aetos wave only while the fight can field it', () => {
    expect(outcomes(loadSurfaceNOPProject(), 'P', pCombat03)).toEqual([
      { phaseKey: 'Combat', choices: ['aetos'] },
    ]);
    // An Aetos already placed this biome leaves a later fight's outcome with nothing to host.
    const fixture = reachedPOutdoorIcarusFixture();
    const placed = applyProjectCommand(fixture.project, catalog, {
      kind: 'ReplaceAetosWave',
      phase: combat,
      value: 2,
    });
    expect(outcomes(placed, 'P', fixture.encounter.owner.occurrenceId)).toEqual([]);
  });

  it('pairs the Gorgon condition with Aetos when the Amulet is pending', () => {
    expect(outcomes(withKeepsake('AthenaEncounterKeepsake'), 'P', pCombat03)).toEqual([
      { phaseKey: 'Combat', choices: ['aetos', 'gorgonCondition'] },
    ]);
  });

  it('has no outcome after a Fig Leaf skip, keeping only an authored value for repair', () => {
    const skipped = applyProjectCommand(withKeepsake('SkipEncounterKeepsake'), catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: { ...combat, phaseKey: 'Intro' },
      value: true,
    });
    const assembly = simulateProjectAssembly(catalog, skipped);
    expect(
      encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, combat),
    ).toMatchObject({ execution: 'skippedByFigLeaf', aetos: { reason: 'skipped', waves: [] } });
    expect(outcomes(skipped, 'P', pCombat03)).toEqual([]);
    const authored = applyProjectCommand(skipped, catalog, {
      kind: 'ReplaceAetosWave',
      phase: combat,
      value: 2,
    });
    expect(outcomes(authored, 'P', pCombat03)).toEqual([
      { phaseKey: 'Combat', choices: ['aetos'] },
    ]);
  });

  it("hosts a Nemesis event's result, alone, as answering her ends it", () => {
    expect(outcomes(loadNemesisPomSeaStarCheckpoint(), 'F', 'golden-f-b5-e1')).toEqual([
      { phaseKey: 'Encounter', choices: ['nemesisEvent'] },
    ]);
  });

  it('hosts nothing for a Nemesis free item or an unchosen event: nothing to answer', () => {
    const room = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: room },
      'Encounter',
    );
    const selected = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisRandomEvent',
    });
    expect(outcomes(selected, 'F', room)).toEqual([]);
    const free = replaceNemesisRandomEventInteraction(
      selected,
      createNemesisRandomEventAddress(phase),
      { kind: 'freeItem' },
      { rewardType: 'HealDrop' },
    );
    expect(outcomes(free, 'F', room)).toEqual([]);
    const contest = replaceNemesisRandomEventInteraction(
      selected,
      createNemesisRandomEventAddress(phase),
      { kind: 'damageContest', result: 'failure' },
      { rewardType: 'RoomRewardConsolationPrize' },
    );
    expect(outcomes(contest, 'F', room)).toEqual([
      { phaseKey: 'Encounter', choices: ['nemesisEvent'] },
    ]);
  });

  it("makes Boss defeated a Boss room's outcome", () => {
    const project = loadSurfaceNOPProject();
    const assembly = simulateProjectAssembly(catalog, project);
    const p = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'P');
    if (p === undefined || !('snapshot' in p)) throw new Error('P is not complete');
    const boss = p.snapshot.fixedRoomLinks?.find(
      (link) => link.target.lifecycleProfileKey === 'BossRoom',
    )?.target;
    if (boss === undefined) throw new Error('P has no Boss room');
    expect(
      boss.roomLifecycleTimeline.boundaries.map((boundary) =>
        'phaseKey' in boundary ? `${boundary.kind}:${boundary.phaseKey}` : boundary.kind,
      ),
    ).toEqual([
      'roomEntered',
      'encounterStart:Encounter',
      'bossDefeated:Encounter',
      'encounterEnd:Encounter',
      'cleanup',
    ]);
    expect(encounterOutcomesForProjectEvaluationAssembly(catalog, assembly, boss.origin)).toEqual(
      [],
    );
  });
});

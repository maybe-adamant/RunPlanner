import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createOccurrenceId,
  semanticAddressKey,
  type BiomeAddress,
  type EncounterPhaseAddress,
  type ProjectDocument,
} from '../../../src/authored-project';
import {
  generatedEncounterSupportForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '../../../src/simulation';
import { nativeRollExclusions } from '../../../src/simulation/encounters/native-roll-exclusions';
import type { ResolvedGeneratedPhase } from '../../../src/simulation/encounters/model';
import { assembleExecutionProduct, compileExecutionPlan } from '../../../src/execution-plan';
import {
  createFreshFileFNativeProject,
  createFreshFileRouteProject,
  freshFileFBiome,
  freshFileHBiome,
} from '@run-planner/test-fixtures/fresh-file';
import {
  createGoldenFGHProject,
  goldenHBiome,
  underworldFogEmitterReservationProject,
} from '@run-planner/test-fixtures/underworld';

const phaseAt = (biome: BiomeAddress, occurrenceId: string, phaseKey = 'Encounter') =>
  createEncounterPhaseAddress(
    biome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId(occurrenceId) },
    phaseKey,
  );

function nativeRollAt(project: ProjectDocument, phase: EncounterPhaseAddress) {
  for (const biome of simulateProject(catalog, project).route.biomes) {
    if (!('roomGeneration' in biome)) continue;
    const entry = biome.roomGeneration.resolvedGenerated.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(phase),
    );
    if (entry !== undefined) return entry;
  }
  throw new Error(`${semanticAddressKey(phase)} is not a reached generated phase`);
}

/** Published exclusions by `occurrenceId/slotKey`, as native ids. */
function publishedExclusions(project: ProjectDocument): ReadonlyMap<string, readonly string[]> {
  const assembly = simulateProjectAssembly(catalog, project);
  expect(assembly.evaluation.status, JSON.stringify(assembly.evaluation.findings)).toBe('valid');
  const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
  return new Map(
    plan.occurrences.flatMap((room) =>
      room.overview.encounterPhases.flatMap((phase) =>
        phase.excludedEnemies === undefined
          ? []
          : [[`${room.id}/${phase.slotKey}`, phase.excludedEnemies.map((enemy) => enemy.nativeId)]],
      ),
    ),
  );
}

/** Golden FGH with a Treant cage whose generated companion is the once-per-run Sorrow-Spiller. */
function withTreantSorrowSpiller(project: ProjectDocument, occurrenceId: string, phaseKey: string) {
  const phase = phaseAt(goldenHBiome, occurrenceId, phaseKey);
  return applyProjectCommand(
    applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'GeneratedH_Treant2',
    }),
    catalog,
    {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'generatedComposition',
      value: {
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'], allocations: { FogEmitter2: 1 } }],
      },
    },
  );
}

describe('native-roll exclusions of generated phases', () => {
  it('publishes an uncustomized fresh composition without a finding', () => {
    const evaluation = simulateProject(catalog, createFreshFileFNativeProject());
    expect(evaluation.status).toBe('valid');
    expect(evaluation.findings).toEqual([]);
  });

  it('excludes exactly the enemies the composition picker excludes as triggering', () => {
    const project = createFreshFileFNativeProject();
    const phase = phaseAt(freshFileFBiome, 'fresh-3-0');
    const entry = nativeRollAt(project, phase);
    expect(entry.customization).toBeUndefined();
    const assessment = generatedEncounterSupportForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, project),
      phase,
    )!.assess({ kind: 'generated', waveCount: 1 });
    expect([...entry.triggerExcludedEnemyKeys].sort()).toEqual(
      [...(assessment.waves[0]!.introductionExcludedKeysByPosition?.[0] ?? [])].sort(),
    );
    expect(entry.triggerExcludedEnemyKeys).toEqual(
      expect.arrayContaining(['Radiator', 'Screamer']),
    );
    expect(publishedExclusions(project).get('fresh-3-0/Encounter')).toEqual(
      entry.triggerExcludedEnemyKeys,
    );
  });

  it('never excludes an enemy native admission already rejects', () => {
    // Below MinDepthBeforeIntros native draws no unintroduced enemy at all.
    expect(
      nativeRollAt(createFreshFileFNativeProject(), phaseAt(freshFileFBiome, 'fresh-1-0'))
        .triggerExcludedEnemyKeys,
    ).toEqual([]);
    expect(publishedExclusions(createFreshFileFNativeProject()).has('fresh-1-0/Encounter')).toBe(
      false,
    );
  });

  it('keeps gated unfinished introductions drawable, in cage-preparation order', () => {
    const phase = phaseAt(freshFileHBiome, 'golden-h-combat02', 'Cage02');
    const project = applyProjectCommand(createFreshFileRouteProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'GeneratedH',
    });
    const excluded = nativeRollAt(project, phase).triggerExcludedEnemyKeys;
    expect(excluded).toEqual(expect.arrayContaining(['Lamia', 'Lovesick']));
    // Cage 1 recorded MournerIntro and Lycanthrope lacks its prerequisites: native keeps them.
    for (const key of ['Mourner', 'Mourner_Elite', 'Lycanthrope', 'Lycanthrope_Elite'])
      expect(excluded).not.toContain(key);
  });

  it('publishes nothing for an introduction suffix', () => {
    const project = createFreshFileRouteProject();
    const suffix = nativeRollAt(project, phaseAt(freshFileFBiome, 'fresh-2-0'));
    expect(suffix.customization).toBeDefined();
    expect(suffix.triggerExcludedEnemyKeys).toEqual([]);
    expect(publishedExclusions(project).has('fresh-2-0/Encounter')).toBe(false);
  });

  it('publishes nothing on a mature route without a later once-per-run composition', () => {
    expect(publishedExclusions(createGoldenFGHProject()).size).toBe(0);
  });

  it('reserves a once-per-run enemy for its later authored composition', () => {
    const published = publishedExclusions(underworldFogEmitterReservationProject());
    expect(Object.fromEntries(published)).toEqual({
      'golden-h-combat02/Cage01': ['FogEmitter2'],
      'golden-h-combat02/Cage02': ['FogEmitter2'],
      'golden-h-combat09/Cage01': ['FogEmitter2'],
      'golden-h-combat09/Cage02': ['FogEmitter2'],
      'golden-h-combat05/Cage01': ['FogEmitter2'],
      'golden-h-combat05/Cage02': ['FogEmitter2'],
    });
  });

  it('reserves nothing for a once-per-run enemy an earlier composition already uses', () => {
    const phase = phaseAt(goldenHBiome, 'golden-h-combat02', 'Cage01');
    const initial = generatedEncounterSupportForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, createGoldenFGHProject()),
      phase,
    )!.initialize()!;
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'generatedComposition',
      value: {
        ...initial,
        waves: initial.waves!.map((wave) => ({
          ...wave,
          typeKeys: [...wave.typeKeys.slice(0, -1), 'FogEmitter2'],
        })),
      },
    });
    expect(publishedExclusions(project).size).toBe(0);
    // Later cages already know the run blacklist, so their native roll cannot draw it.
    expect(
      nativeRollAt(project, phaseAt(goldenHBiome, 'golden-h-combat05', 'Cage01'))
        .oncePerRunEnemyKeys,
    ).toEqual([]);
  });

  it('reserves a once-per-run enemy a later placeholder companion uses', () => {
    // The companion passes native eligibility without entering the run blacklist.
    const published = publishedExclusions(
      withTreantSorrowSpiller(createGoldenFGHProject(), 'golden-h-combat05', 'Cage01'),
    );
    expect(Object.fromEntries(published)).toEqual({
      'golden-h-combat02/Cage01': ['FogEmitter2'],
      'golden-h-combat02/Cage02': ['FogEmitter2'],
      'golden-h-combat09/Cage01': ['FogEmitter2'],
      'golden-h-combat09/Cage02': ['FogEmitter2'],
    });
  });

  it("keeps an authored phase's own companion in its decline list for a later use", () => {
    const published = publishedExclusions(
      withTreantSorrowSpiller(
        underworldFogEmitterReservationProject(),
        'golden-h-combat05',
        'Cage01',
      ),
    );
    expect(published.get('golden-h-combat05/Cage01')).toEqual(['FogEmitter2']);
    expect(published.has('golden-h-combat05/Cage03')).toBe(false);
  });

  it('orders reservations by generation, never reserving for an earlier composition', () => {
    const origin = (phaseKey: string) => phaseAt(goldenHBiome, 'room', phaseKey);
    const phase = (
      phaseKey: string,
      facts: Partial<ResolvedGeneratedPhase> = {},
    ): ResolvedGeneratedPhase => ({
      origin: origin(phaseKey),
      triggerExcludedEnemyKeys: [],
      oncePerRunEnemyKeys: ['FogEmitter2'],
      ...facts,
    });
    const exclusions = nativeRollExclusions([
      phase('A', { triggerExcludedEnemyKeys: ['Lamia'] }),
      phase('B', { oncePerRunEnemyKeys: [] }),
      phase('C', { authoredOncePerRunUses: ['FogEmitter2'] }),
      phase('D'),
    ]);
    expect(exclusions.get(semanticAddressKey(origin('A')))).toEqual(['Lamia', 'FogEmitter2']);
    // Already run-blacklisted or inadmissible here: native cannot draw it.
    expect(exclusions.get(semanticAddressKey(origin('B')))).toEqual([]);
    expect(exclusions.get(semanticAddressKey(origin('C')))).toEqual([]);
    expect(exclusions.get(semanticAddressKey(origin('D')))).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  createOccurrenceId,
  semanticAddressKey,
  type BiomeAddress,
  type ProjectDocument,
} from '../../../src/authored-project';
import {
  encounterPhaseCandidateSupportForProjectEvaluationAssembly,
  generatedEncounterSupportForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '../../../src/simulation';
import {
  admissibleEnemyKeys,
  assessGeneratedEncounter,
  initializeGeneratedEncounter,
  type EncounterGenerationContext,
} from '../../../src/simulation/encounters/generation';
import {
  createFreshFileRouteProject,
  freshFileFBiome,
  freshFileGBiome,
  freshFileGFirstCombatId,
  freshFileHBiome,
} from '@run-planner/test-fixtures/fresh-file';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

function policy(key: string) {
  const value = catalog.encounterDefinitions.byKey[key]?.customization?.find(
    (entry) => entry.selection.kind === 'generated',
  )?.selection;
  if (value?.kind !== 'generated') throw new Error(`Missing generation policy ${key}`);
  return value;
}

/** A fresh-profile contact: nothing completed, the named introductions triggering. */
function fresh(depth: number, triggered: readonly string[]): EncounterGenerationContext {
  return {
    biomeDepthCache: depth,
    biomeEncounterDepth: depth,
    knownRunBlacklist: [],
    introductions: {
      completedEncounterKeys: [],
      triggeredEncounterKeys: triggered,
      minDepthBeforeIntros: 3,
    },
  };
}
const mature = { biomeDepthCache: 4, biomeEncounterDepth: 4, knownRunBlacklist: [] };

describe('enemy introductions in generated compositions', () => {
  it('generates only the mixed suffix at its native share, seeded and without a highlight', () => {
    const intro = policy('RadiatorIntro');
    const value = {
      kind: 'generated' as const,
      waves: [{ waveIndex: 2, typeKeys: ['Guard'], allocations: { Radiator: 70 } }],
    };
    const assessment = assessGeneratedEncounter(intro, value, fresh(4, ['RadiatorIntro']));
    expect(assessment.supported).toBe(true);
    expect(assessment.eligibleHighlightKeys).toEqual([]);
    // (55 + 4 × 15 + 25) × 2 = 280; the two-wave pattern gives the suffix 50%.
    expect(assessment.budget).toEqual({ kind: 'exact', waveBudgets: [140, 140] });
    expect(assessment.waves.map((wave) => wave.waveIndex)).toEqual([2]);
    expect(assessment.waves[0]).toMatchObject({
      seeds: [{ key: 'Radiator', kind: 'template' }],
      additionalTypeCount: { min: 1, max: 1 },
      sampledBudgetKeys: ['Radiator'],
    });
    expect(assessment.operands).toMatchObject({
      waveCount: 2,
      waves: [
        {
          waveIndex: 2,
          typeKeys: ['Radiator', 'Guard'],
          sources: { Radiator: 'template', Guard: 'addition' },
          counts: { Radiator: 10, Guard: 14 },
        },
      ],
    });
    const initialized = initializeGeneratedEncounter(intro, fresh(4, []))!;
    expect(initialized.waves?.map((wave) => wave.waveIndex)).toEqual([2]);
    expect(assessGeneratedEncounter(intro, initialized, fresh(4, [])).operands).toBeDefined();
  });

  it('excludes another unintroduced enemy from a suffix but keeps its own seed', () => {
    const wave = assessGeneratedEncounter(
      policy('RadiatorIntro'),
      { kind: 'generated' },
      fresh(4, ['RadiatorIntro', 'ScreamerIntro']),
    ).waves[0]!;
    expect(wave.activeMemberKeys).toEqual(['Radiator']);
    // RequireCompletedIntro withholds Screamer by admission, not as a trigger.
    expect(wave.eligibleKeysByPosition[0]).not.toContain('Screamer');
    expect(wave.eligibleKeysByPosition[0]).toContain('Guard');
    expect(wave.introductionExcludedKeysByPosition).toEqual([[]]);
  });

  it('excludes an ordinary enemy only where its introduction would trigger', () => {
    const generated = policy('GeneratedF');
    const value = { kind: 'generated' as const, waveCount: 1 };
    const triggering = assessGeneratedEncounter(generated, value, fresh(4, ['RadiatorIntro']));
    const domain = triggering.waves[0]!;
    expect(domain.eligibleKeysByPosition[0]).not.toContain('Radiator');
    expect(domain.introductionExcludedKeysByPosition?.[0]).toEqual(
      expect.arrayContaining(['Radiator', 'Radiator_Elite']),
    );
    // An unfinished introduction whose gate fails here triggers nothing: native keeps the draw.
    expect(domain.eligibleKeysByPosition[0]).toContain('Screamer');
    expect(triggering.introductions?.encounterKeyByEnemyKey).toEqual({
      Radiator: 'RadiatorIntro',
      Radiator_Elite: 'RadiatorIntro',
    });
    expect(admissibleEnemyKeys(generated, fresh(4, ['RadiatorIntro']))).toContain('Radiator');
    // Below MinDepthBeforeIntros native never draws it at all.
    const shallow = assessGeneratedEncounter(generated, value, fresh(2, ['RadiatorIntro']));
    expect(shallow.waves[0]!.eligibleKeysByPosition[0]).not.toContain('Radiator');
    expect(shallow.waves[0]!.introductionExcludedKeysByPosition).toEqual([[]]);
    expect(admissibleEnemyKeys(generated, fresh(2, ['RadiatorIntro']))).not.toContain('Radiator');
    // A mature profile has completed every introduction.
    expect(
      assessGeneratedEncounter(generated, value, mature).waves[0]!.eligibleKeysByPosition[0],
    ).toContain('Radiator');
  });

  it('reports a retained unintroduced enemy with its repair and keeps the value', () => {
    const generated = policy('GeneratedF');
    const value = {
      kind: 'generated' as const,
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Radiator'], allocations: { Guard: 30 } }],
    };
    const issue = (depth: number) =>
      assessGeneratedEncounter(generated, value, fresh(depth, ['RadiatorIntro'])).issues;
    expect(issue(4)).toContainEqual({
      reason: 'introductionRequired',
      key: 'Radiator',
      introductionEncounterKey: 'RadiatorIntro',
      admitted: true,
      waveIndex: 1,
      position: 2,
    });
    expect(issue(2)).toContainEqual(
      expect.objectContaining({ reason: 'introductionRequired', key: 'Radiator', admitted: false }),
    );
    expect(assessGeneratedEncounter(generated, value, mature).supported).toBe(true);
  });

  it('withholds an unintroduced shared enemy that would trigger its introduction', () => {
    const assessment = assessGeneratedEncounter(
      policy('GeneratedF'),
      { kind: 'generated', waveCount: 2, highlightKey: 'Radiator' },
      fresh(4, ['RadiatorIntro']),
    );
    expect(assessment.eligibleHighlightKeys).not.toContain('Radiator');
    expect(assessment.introductions?.excludedHighlightKeys).toContain('Radiator');
    expect(assessment.issues).toContainEqual(
      expect.objectContaining({ reason: 'introductionRequired', key: 'Radiator', admitted: true }),
    );
  });
});

const phaseAt = (biome: BiomeAddress, occurrenceId: string, phaseKey = 'Encounter') =>
  createEncounterPhaseAddress(
    biome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId(occurrenceId) },
    phaseKey,
  );
const support = (project: ProjectDocument, biome: BiomeAddress, id: string, phaseKey?: string) =>
  encounterPhaseCandidateSupportForProjectEvaluationAssembly(
    simulateProjectAssembly(catalog, project),
    phaseAt(biome, id, phaseKey),
  )!;
const findingsAt = (project: ProjectDocument, phase: ReturnType<typeof phaseAt>) =>
  simulateProject(catalog, project).findings.filter(
    (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(phase),
  );

describe('introduction members on a fresh route', () => {
  it('validates the fully composed route with its introductions', () => {
    const evaluation = simulateProject(catalog, createFreshFileRouteProject());
    expect(evaluation.status).toBe('valid');
    expect(evaluation.findings).toEqual([]);
  });

  it('offers an introduction only where its gate passes and a trigger enemy is admissible', () => {
    const route = createFreshFileRouteProject();
    expect(support(route, freshFileFBiome, 'fresh-2-0').candidateEncounterKeys).toEqual(
      expect.arrayContaining(['GeneratedF', 'RadiatorIntro', 'ScreamerIntro']),
    );
    // Below MinDepthBeforeIntros no ordinary F combat can draw a Radiator.
    expect(support(route, freshFileFBiome, 'fresh-1-0').exclusions).toContainEqual({
      encounterKey: 'RadiatorIntro',
      kind: 'introductionUnreachable',
      encounterDefinitionKey: 'RadiatorIntro',
      triggerEnemyKeys: ['Radiator', 'Radiator_Elite'],
    });
    // After RadiatorIntro completes its gate fails, with the completion as evidence.
    expect(support(route, freshFileFBiome, 'fresh-3-0').exclusions).toContainEqual(
      expect.objectContaining({
        encounterKey: 'RadiatorIntro',
        kind: 'requirements',
        definitions: [
          expect.objectContaining({
            evaluation: expect.objectContaining({
              children: expect.arrayContaining([
                expect.objectContaining({
                  kind: 'encounterCompletionCount',
                  satisfied: false,
                  actual: 1,
                }),
              ]),
            }),
          }),
        ],
      }),
    );
    // The forced first G combat is FishmanIntro: no ordinary encounter could draw a Pinhead.
    expect(support(route, freshFileGBiome, freshFileGFirstCombatId).exclusions).toContainEqual({
      encounterKey: 'FishSwarmerIntro',
      kind: 'introductionUnreachable',
      encounterDefinitionKey: 'FishSwarmerIntro',
      triggerEnemyKeys: ['FishSwarmerSquad', 'FishSwarmerSquad_Elite'],
    });
  });

  it('keeps every introduction out of a mature route', () => {
    const mature = support(createGoldenFGHIProject(), goldenFBiome, goldenFOccurrenceId(5, 1));
    // Introduction choices are offered only on Fresh File, so a mature slot has no trace of them.
    expect(mature.candidateEncounterKeys).not.toContain('RadiatorIntro');
    expect(mature.exclusions.map((entry) => entry.encounterKey)).not.toContain('RadiatorIntro');
    expect(() =>
      applyProjectCommand(createGoldenFGHIProject(), catalog, {
        kind: 'SelectEncounter',
        phase: phaseAt(goldenFBiome, goldenFOccurrenceId(5, 1)),
        encounterKey: 'RadiatorIntro',
      }),
    ).toThrow(/not offered on route Underworld/);
  });

  it('keeps repair evidence for an introduction retained on a mature route', () => {
    const phase = phaseAt(goldenFBiome, goldenFOccurrenceId(5, 1));
    const raw = JSON.parse(encodeProjectDocument(createGoldenFGHIProject()));
    const occurrence = raw.route.biomes[0].topology.occurrences.find(
      (entry: { occurrenceId: string }) => entry.occurrenceId === goldenFOccurrenceId(5, 1),
    );
    occurrence.encounters.encounterKeyByPhase.Encounter = 'RadiatorIntro';
    const project = decodeProjectDocument(raw, catalog);
    expect(findingsAt(project, phase)).toEqual([
      expect.objectContaining({ code: 'encounterUnavailable' }),
    ]);
    expect(support(project, goldenFBiome, goldenFOccurrenceId(5, 1)).exclusions).toContainEqual(
      expect.objectContaining({
        encounterKey: 'RadiatorIntro',
        kind: 'requirements',
        definitions: [
          expect.objectContaining({
            evaluation: expect.objectContaining({
              children: expect.arrayContaining([
                expect.objectContaining({ kind: 'routeKeyEquals', satisfied: false }),
              ]),
            }),
          }),
        ],
      }),
    );
  });

  it('evaluates H cages in preparation order against recorded identities', () => {
    const route = createFreshFileRouteProject();
    // Cage 1 recorded MournerIntro, so cage 2 cannot introduce Mourner again.
    const second = support(route, freshFileHBiome, 'golden-h-combat02', 'Cage02');
    expect(second.candidateEncounterKeys).not.toContain('MournerIntro');
    expect(second.candidateEncounterKeys).toContain('LamiaIntro');
    // Lycanthrope needs Mourner, Lamia and Lovesick recorded; Lovesick is cage 1 here.
    expect(
      support(route, freshFileHBiome, 'golden-h-combat09', 'Cage01').exclusions,
    ).toContainEqual(
      expect.objectContaining({ encounterKey: 'LycanthropeIntro', kind: 'requirements' }),
    );
    expect(
      support(route, freshFileHBiome, 'golden-h-combat09', 'Cage02').candidateEncounterKeys,
    ).toContain('LycanthropeIntro');
    // Cage 2 was prepared before cage 1 completed; completion does not re-prepare it.
    const h = simulateProject(catalog, route).route.biomes.find((biome) => biome.biomeKey === 'H')!;
    if (!('history' in h)) throw new Error('H has no history');
    const at = (kind: string, phaseKey: string) =>
      h.history.events.findIndex(
        (event) =>
          event.kind === kind &&
          'phaseKey' in event &&
          event.phaseKey === phaseKey &&
          semanticAddressKey(event.origin).includes('golden-h-combat09'),
      );
    expect(at('encounterRecorded', 'Cage02')).toBeGreaterThan(-1);
    expect(at('encounterRecorded', 'Cage02')).toBeLessThan(at('encounterCompleted', 'Cage01'));
  });

  it('keeps an enemy admissible where its unfinished introduction cannot trigger', () => {
    // Replace cage 2's Lamia introduction with an ordinary composition to query its domain.
    const phase = phaseAt(freshFileHBiome, 'golden-h-combat02', 'Cage02');
    const project = applyProjectCommand(createFreshFileRouteProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'GeneratedH',
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const domain = generatedEncounterSupportForProjectEvaluationAssembly(assembly, phase)!.assess({
      kind: 'generated',
    }).waves[0]!;
    // Mourner occurred in cage 1 and Lycanthrope lacks its prerequisites: both stay drawable.
    expect(domain.eligibleKeysByPosition[0]).toEqual(
      expect.arrayContaining(['Mourner', 'Lycanthrope']),
    );
    // Lamia and Lovesick would still trigger their introductions here.
    expect(domain.introductionExcludedKeysByPosition?.[0]).toEqual(
      expect.arrayContaining(['Lamia', 'Lovesick']),
    );
    expect(findingsAt(project, phase)).toEqual([
      expect.objectContaining({ code: 'encounterCustomizationRequired' }),
    ]);
  });

  it('reports a retained unintroduced enemy and a lapsed introduction, retaining both', () => {
    const route = createFreshFileRouteProject();
    const retain = (occurrenceId: string, enemyKey: string) => {
      const phase = phaseAt(freshFileFBiome, occurrenceId);
      const project = applyProjectCommand(route, catalog, {
        kind: 'ReplaceEncounterCustomization',
        phase,
        decisionKey: 'generatedComposition',
        value: {
          kind: 'generated',
          waveCount: 1,
          waves: [{ waveIndex: 1, typeKeys: ['Guard', enemyKey], allocations: { Guard: 30 } }],
        },
      });
      return findingsAt(project, phase);
    };
    const introduction = (
      enemyKey: string,
      introductionEncounterKey: string,
      admitted: boolean,
    ) => [
      expect.objectContaining({
        code: 'encounterIntroductionRequired',
        evidence: expect.objectContaining({ enemyKey, introductionEncounterKey, admitted }),
      }),
    ];
    // Too shallow for any introduction: native never draws it here.
    expect(retain('fresh-1-0', 'Radiator')).toEqual(
      introduction('Radiator', 'RadiatorIntro', false),
    );
    // After RadiatorIntro: a Screamer would trigger its own introduction instead.
    expect(retain('fresh-3-0', 'Screamer')).toEqual(
      introduction('Screamer', 'ScreamerIntro', true),
    );
    // A second RadiatorIntro after the first completed no longer passes its gate.
    const lapsed = phaseAt(freshFileFBiome, 'fresh-3-0');
    const repeated = applyProjectCommand(route, catalog, {
      kind: 'SelectEncounter',
      phase: lapsed,
      encounterKey: 'RadiatorIntro',
    });
    expect(findingsAt(repeated, lapsed)).toEqual([
      expect.objectContaining({ code: 'encounterUnavailable' }),
    ]);
  });

  it('requires every generated composition on the fresh route', () => {
    const phase = phaseAt(freshFileFBiome, 'fresh-1-0');
    const cleared = applyProjectCommand(createFreshFileRouteProject(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'generatedComposition',
      value: null,
    });
    // A missing composition is required input, not an invalid value.
    const evaluation = simulateProject(catalog, cleared);
    expect(evaluation.status).toBe('incomplete');
    expect(findingsAt(cleared, phase)).toEqual([
      {
        code: 'encounterCustomizationRequired',
        severity: 'error',
        phase: 'encounterResolution',
        origin: phase,
        evidence: { beforeSequence: expect.any(Number), decisionKey: 'generatedComposition' },
      },
    ]);
  });

  it('gates Turtle, Sea-Serpent and Thorn-Weeper by their native profile admission', () => {
    const route = createFreshFileRouteProject();
    const assembly = simulateProjectAssembly(catalog, route);
    const domain = (biome: BiomeAddress, occurrenceId: string, project = assembly) =>
      generatedEncounterSupportForProjectEvaluationAssembly(
        project,
        phaseAt(biome, occurrenceId),
      )!.assess({ kind: 'generated', waveCount: 1 }).waves[0]!;
    const candidates = (occurrenceId: string) =>
      encounterPhaseCandidateSupportForProjectEvaluationAssembly(
        assembly,
        phaseAt(freshFileGBiome, occurrenceId),
      )!;
    // Turtle_Elite keeps TurtleIntro under Elite's depth gate; the ordinary Turtle
    // needs two lifetime G_Intro visits a fresh profile cannot have.
    const early = domain(freshFileGBiome, 'golden-g-b2-e1');
    expect(early.eligibleKeysByPosition[0]).not.toContain('Turtle');
    expect(early.introductionExcludedKeysByPosition?.[0]).toContain('Turtle_Elite');
    expect(candidates('golden-g-b2-e1').candidateEncounterKeys).toContain('TurtleIntro');
    expect(candidates(freshFileGFirstCombatId).exclusions).toContainEqual(
      expect.objectContaining({ encounterKey: 'TurtleIntro', kind: 'introductionUnreachable' }),
    );
    expect(admissibleEnemyKeys(policy('GeneratedG'), fresh(2, ['TurtleIntro']))).not.toContain(
      'Turtle_Elite',
    );
    expect(admissibleEnemyKeys(policy('GeneratedG'), fresh(3, ['TurtleIntro']))).toContain(
      'Turtle_Elite',
    );
    // The ordinary Sea-Serpent waits for MiniBossWaterUnit to complete (golden-g-b6-e1).
    expect(early.eligibleKeysByPosition[0]).not.toContain('WaterUnit');
    expect(domain(freshFileGBiome, 'golden-g-b7-e1').eligibleKeysByPosition[0]).toContain(
      'WaterUnit',
    );
    // Thorn-Weeper needs an earlier MiniBossFogEmitter; this route's F has none.
    expect(domain(freshFileFBiome, 'fresh-3-0').eligibleKeysByPosition[0]).not.toContain(
      'SiegeVine',
    );
    // A mature save satisfies every profile gate.
    const golden = simulateProjectAssembly(catalog, createGoldenFGHIProject());
    expect(
      domain(goldenGBiome, goldenGOccurrenceId(4, 1), golden).eligibleKeysByPosition[0],
    ).toEqual(expect.arrayContaining(['Turtle', 'Turtle_Elite', 'WaterUnit']));
  });

  it('requires a completed ScreamerIntro for the Screamer Fields combat on a fresh route', () => {
    const exclusion = support(
      createFreshFileRouteProject(),
      freshFileHBiome,
      'golden-h-combat09',
      'Cage01',
    ).exclusions.find((entry) => entry.encounterKey === 'GeneratedH_Screamer2');
    expect(JSON.stringify(exclusion)).toContain('"kind":"encounterCompletionCount"');
  });
});

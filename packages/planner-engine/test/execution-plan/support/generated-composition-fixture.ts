import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  type AuthoredGeneratedEncounterCustomization,
  type EncounterPhaseAddress,
  type ProjectDocument,
} from '../../../src/authored-project';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPProject, pOccurrenceId } from '@run-planner/test-fixtures/surface';

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

function fPhase(batchIndex: number): EncounterPhaseAddress {
  return createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(batchIndex, 1) },
    'Encounter',
  );
}

/**
 * Underworld generated compositions under Vow of Fangs and Vow of Menace: a
 * positive Menace conversion, a two-wave highlight, an ordinary Fangs target,
 * and the fixed H Treant cage with its template companion and Fangs.
 */
export function underworldGeneratedCompositionProject(): ProjectDocument {
  let project = createGoldenFGHIProject();
  for (const [vowKey, rank] of [
    ['EnemyEliteShrineUpgrade', 1],
    ['NextBiomeEnemyShrineUpgrade', 2],
  ] as const)
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey,
      rank,
    });
  project = customize(project, fPhase(3), {
    kind: 'generated',
    waveCount: 1,
    waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 50 } }],
    menace: [{ waveIndex: 1, conversions: { Guard: { count: 2 } } }],
  });
  project = customize(project, fPhase(5), {
    kind: 'generated',
    waveCount: 2,
    highlightKey: 'Guard',
    waves: [
      { waveIndex: 1, typeKeys: [] },
      { waveIndex: 2, typeKeys: ['Brawler'], allocations: { Guard: 30 } },
    ],
  });
  project = customize(project, fPhase(7), {
    kind: 'generated',
    waveCount: 1,
    waves: [
      { waveIndex: 1, typeKeys: ['Guard_Elite', 'Brawler'], allocations: { Guard_Elite: 100 } },
    ],
    fangs: { typeKey: 'Guard_Elite', perkKeys: ['Blink'] },
  });
  const cage = createEncounterPhaseAddress(
    createBiomeAddress('Underworld', 'H'),
    { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-combat05') },
    'Cage01',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'SelectEncounter',
    phase: cage,
    encounterKey: 'GeneratedH_Treant2',
  });
  return customize(project, cage, {
    kind: 'generated',
    waveCount: 1,
    waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'], allocations: { FogEmitter2: 1 } }],
    fangs: { typeKey: 'Treant2', perkKeys: ['Blink'] },
  });
}

/** The variable-budget P pre-combat encounter with an authored native base roll. */
export function surfaceGeneratedPreCombatProject(): ProjectDocument {
  return customize(
    loadSurfaceNOPProject(),
    createEncounterPhaseAddress(
      createBiomeAddress('Surface', 'P'),
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat07', 4, 1) },
      'Intro',
    ),
    {
      kind: 'generated',
      waveCount: 1,
      baseRoll: 412,
      waves: [{ waveIndex: 1, typeKeys: ['SentryBot', 'Dragon'], allocations: { SentryBot: 206 } }],
    },
  );
}

import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createOccurrenceId,
  semanticAddressKey,
  type BiomeAddress,
  type ProjectDocument,
} from '../../../src/authored-project';
import {
  encounterCompositionView,
  encounterPhaseAuthoringDomainForRoom,
  generatedEncounterSupportForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '../../../src/simulation';
import {
  createFreshFileRouteProject,
  freshFileFBiome,
} from '@run-planner/test-fixtures/fresh-file';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

/** The view of one prepared phase, optionally with its exact generated assessment. */
function viewAt(project: ProjectDocument, biome: BiomeAddress, occurrenceId: string) {
  const phase = createEncounterPhaseAddress(
    biome,
    { kind: 'occurrence', occurrenceId: createOccurrenceId(occurrenceId) },
    'Encounter',
  );
  const evaluation = simulateProject(catalog, project);
  const history = evaluation.route.biomes.find((entry) => entry.biomeKey === biome.biomeKey);
  if (history === undefined || !('history' in history)) throw new Error('biome has no history');
  const recorded = history.history.events.find(
    (event) =>
      event.kind === 'encounterRecorded' &&
      event.phaseKey === 'Encounter' &&
      semanticAddressKey(event.origin).includes(occurrenceId),
  );
  // A phase stopped before preparation resolves its direct authored identity.
  const prepared =
    recorded?.kind === 'encounterRecorded' ? { Encounter: recorded.encounterKey } : undefined;
  const occurrence = project.route.biomes
    .find((entry) => entry.biomeKey === biome.biomeKey)!
    .topology!.occurrences.find((entry) => entry.occurrenceId === occurrenceId)!;
  const [domain] = encounterPhaseAuthoringDomainForRoom(
    catalog,
    biome,
    catalog.rooms.byKey[occurrence.gameName]!,
    phase.owner,
    occurrence.encounters,
    {
      includeFixedPhases: true,
      ...(prepared === undefined ? {} : { preparedDefinitionKeysBySlot: prepared }),
    },
  );
  const decision = domain!.customization?.find((entry) => entry.selection.kind === 'generated');
  const value = decision?.value?.kind === 'generated' ? decision.value : undefined;
  const assessment =
    value === undefined
      ? undefined
      : generatedEncounterSupportForProjectEvaluationAssembly(
          simulateProjectAssembly(catalog, project),
          phase,
        )?.assess(value);
  return {
    view: encounterCompositionView(catalog, domain!, assessment),
    findings: evaluation.findings
      .filter((finding) => semanticAddressKey(finding.origin) === semanticAddressKey(phase))
      .map((finding) => finding.code),
  };
}

const rows = (view: ReturnType<typeof viewAt>['view']) =>
  view?.waves.map((wave) => ({
    wave: wave.waveIndex,
    source: wave.source,
    editable: wave.editable,
    spawns: wave.spawns.map((spawn) => `${spawn.enemyKey}×${spawn.count ?? '?'}`),
  }));

describe('encounter composition view', () => {
  it('shows every declared wave of a fixed identity read-only', () => {
    const { view } = viewAt(createFreshFileRouteProject(), freshFileFBiome, 'fresh-0-0');
    expect(view).toMatchObject({
      encounterDefinitionKey: 'FIntroFight',
      label: 'Intro combat',
      disposition: { key: 'fixed' },
      waveCount: { min: 4, max: 4, value: 4 },
      editable: false,
      sharedEnemy: false,
      fangs: false,
      menace: false,
    });
    expect(view).not.toHaveProperty('decisionKey');
    expect(rows(view)).toEqual([
      { wave: 1, source: 'fixed', editable: false, spawns: ['Brawler×1'] },
      { wave: 2, source: 'fixed', editable: false, spawns: ['Guard×4'] },
      { wave: 3, source: 'fixed', editable: false, spawns: ['Mage×3'] },
      { wave: 4, source: 'fixed', editable: false, spawns: ['Brawler×1', 'Guard×3', 'Mage×1'] },
    ]);
    expect(view?.waves[0]?.spawns[0]?.label).toBe('Wastrel');
  });

  it('keeps a fixed identity read-only beside a retained removal-only customization', () => {
    const retained = catalog.encounterDefinitions.byKey.GeneratedF!.customization!.find(
      (decision) => decision.selection.kind === 'generated',
    )!;
    const view = encounterCompositionView(catalog, {
      selectedEncounterDefinitionKey: 'FIntroFight',
      customization: [
        {
          key: retained.key,
          selection: retained.selection,
          value: { kind: 'generated', waveCount: 1 },
        },
      ],
    });
    expect(view).toMatchObject({ disposition: { key: 'fixed' }, editable: false });
    expect(view).not.toHaveProperty('decisionKey');
    expect(view?.waves.every((wave) => !wave.editable && wave.source === 'fixed')).toBe(true);
  });

  it('keeps a mixed introduction fixed first wave beside its authored suffix', () => {
    const { view } = viewAt(createFreshFileRouteProject(), freshFileFBiome, 'fresh-2-0');
    expect(view).toMatchObject({
      encounterDefinitionKey: 'RadiatorIntro',
      disposition: { key: 'fixedWavePrefix', fixedWaveCount: 1 },
      decisionKey: 'generatedComposition',
      waveCount: { min: 2, max: 2, value: 2 },
      editable: true,
      sharedEnemy: false,
    });
    const [fixed, suffix] = rows(view)!;
    expect(fixed).toEqual({ wave: 1, source: 'fixed', editable: false, spawns: ['Radiator×5'] });
    expect(suffix).toMatchObject({ wave: 2, source: 'authored', editable: true });
    // The declared template seed opens the suffix with its assessed count.
    expect(suffix?.spawns[0]).toMatch(/^Radiator×\d+$/);
  });

  it('projects an authored mature composition with assessed counts', () => {
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
      'Encounter',
    );
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'generatedComposition',
      value: {
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 9999 } }],
      },
    });
    const { view, findings } = viewAt(project, goldenFBiome, goldenFOccurrenceId(5, 1));
    expect(findings).toEqual([]);
    expect(view).toMatchObject({
      encounterDefinitionKey: 'GeneratedF',
      disposition: { key: 'generated' },
      waveCount: { value: 1 },
      editable: true,
      sharedEnemy: false,
    });
    expect(rows(view)).toEqual([
      { wave: 1, source: 'authored', editable: true, spawns: [expect.any(String), 'Brawler×1'] },
    ]);
    expect(view?.waves[0]?.spawns[0]?.enemyKey).toBe('Guard');
  });

  it('shows native placeholders for an uncustomized phase on mature and fresh routes', () => {
    const mature = viewAt(createCompleteFGProject(), goldenFBiome, goldenFOccurrenceId(5, 1));
    expect(mature.findings).toEqual([]);
    expect(mature.view).toMatchObject({
      encounterDefinitionKey: 'GeneratedF',
      disposition: { key: 'nativeGenerated' },
      decisionKey: 'generatedComposition',
      editable: true,
    });
    // A native wave range has no known count, so no rows exist yet.
    expect(mature.view?.waveCount).not.toHaveProperty('value');
    expect(mature.view?.waves).toEqual([]);

    const phase = createEncounterPhaseAddress(
      freshFileFBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('fresh-2-0') },
      'Encounter',
    );
    const cleared = applyProjectCommand(createFreshFileRouteProject(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'generatedComposition',
      value: null,
    });
    const fresh = viewAt(cleared, freshFileFBiome, 'fresh-2-0');
    expect(fresh.findings).toEqual(['encounterCustomizationRequired']);
    expect(fresh.view).toMatchObject({
      disposition: { key: 'fixedWavePrefix', fixedWaveCount: 1 },
      waveCount: { min: 2, max: 2, value: 2 },
      editable: true,
    });
    // The exact declared wave count yields the native suffix placeholder.
    expect(rows(fresh.view)).toEqual([
      { wave: 1, source: 'fixed', editable: false, spawns: ['Radiator×5'] },
      { wave: 2, source: 'native', editable: true, spawns: [] },
    ]);
  });
});

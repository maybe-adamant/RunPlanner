import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createCompleteFGAnomalyProject,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  applyProjectCommand,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '../../../src/authored-project';
import type { InfiniteRosterSelection } from '../../../src/catalog-schema';
import { assessInfiniteRoster } from '../../../src/simulation/encounters/infinite-roster';
import {
  infiniteRosterSupportForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '../../../src/simulation';
import {
  anomalyRosterPhase,
  anomalyRosterProject,
} from '../../execution-plan/support/anomaly-roster-fixture';

const selection = (() => {
  const decision = catalog.encounterDefinitions.byKey.GeneratedAnomalyB?.customization?.find(
    (entry) => entry.key === 'infiniteRoster',
  );
  if (decision?.selection.kind !== 'infiniteRoster') throw new Error('missing Anomaly roster');
  return decision.selection;
})();

const assess = (typeKeys: readonly string[], biomeDepthCache = 3) =>
  assessInfiniteRoster(selection as InfiniteRosterSelection, typeKeys, { biomeDepthCache });

const elites = selection.choices.filter((choice) => choice.elite).map((choice) => choice.key);

function anomalyEncounters(project: ProjectDocument) {
  return project.route.biomes
    .find((biome) => biome.biomeKey === 'G')!
    .topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === anomalyRosterPhase.owner.occurrenceId,
    )!.encounters;
}

function rosterFindings(project: ProjectDocument) {
  return simulateProject(catalog, project).findings.filter(
    (finding) => finding.code === 'encounterCustomizationUnavailable',
  );
}

function withRawRoster(project: ProjectDocument, raw: unknown): unknown {
  const document = JSON.parse(encodeProjectDocument(project)) as {
    route: {
      biomes: {
        biomeKey: string;
        topology: { occurrences: { occurrenceId: string; encounters: Record<string, unknown> }[] };
      }[];
    };
  };
  document.route.biomes
    .find((biome) => biome.biomeKey === 'G')!
    .topology.occurrences.find(
      (entry) => entry.occurrenceId === anomalyRosterPhase.owner.occurrenceId,
    )!.encounters.customizationByPhase = { Encounter: { infiniteRoster: raw } };
  return document;
}

describe('Anomaly infinite roster assessment', () => {
  it('requires two or three distinct ordered types', () => {
    expect(assess(['BloodlessNaked', 'BloodlessPitcher']).supported).toBe(true);
    expect(assess(['BloodlessNaked', 'BloodlessPitcher', 'SpreadShotUnit']).supported).toBe(true);
    expect(assess(['BloodlessNaked']).issues).toEqual([
      { reason: 'typeCount', actual: 1, allowed: { min: 2, max: 3 } },
    ]);
    expect(
      assess(['BloodlessNaked', 'BloodlessPitcher', 'SpreadShotUnit', 'BloodlessWaveFist']).issues,
    ).toEqual([{ reason: 'typeCount', actual: 4, allowed: { min: 2, max: 3 } }]);
    expect(assess(['BloodlessNaked', 'BloodlessNaked']).issues).toEqual([
      { reason: 'enemyUnavailable', position: 2, key: 'BloodlessNaked' },
    ]);
    // The picker domain stops after the last reachable draw.
    expect(assess(['BloodlessNaked', 'BloodlessPitcher', 'SpreadShotUnit'])).toMatchObject({
      activeMemberKeys: ['BloodlessNaked', 'BloodlessPitcher', 'SpreadShotUnit'],
      eligibleKeysByPosition: { length: 3 },
    });
  });

  it('allows zero or one elite and removes every elite after the first', () => {
    const afterElite = assess(['BloodlessNaked_Elite']).eligibleKeysByPosition[1]!;
    expect(afterElite.some((key) => elites.includes(key))).toBe(false);
    expect(assess(['BloodlessNaked_Elite', 'BloodlessPitcher']).supported).toBe(true);
    expect(assess(['Swarmer_Elite', 'BloodlessPitcher_Elite']).issues).toEqual([
      { reason: 'enemyUnavailable', position: 2, key: 'BloodlessPitcher_Elite' },
    ]);
    expect(assess(['BloodlessPitcher', 'BloodlessNaked', 'Swarmer_Elite']).supported).toBe(true);
  });

  it('gates inherited elites at biome depth three, except the Numbskull elite', () => {
    const shallow = assess([], 2).eligibleKeysByPosition[0]!;
    expect(shallow.filter((key) => elites.includes(key))).toEqual(['Swarmer_Elite']);
    expect(assess([], 3).eligibleKeysByPosition[0]).toEqual(
      selection.choices.map((choice) => choice.key),
    );
    expect(assess(['Swarmer_Elite', 'BloodlessPitcher'], 1).supported).toBe(true);
    expect(assess(['BloodlessNaked_Elite', 'BloodlessPitcher'], 2).issues).toEqual([
      { reason: 'enemyUnavailable', position: 1, key: 'BloodlessNaked_Elite' },
    ]);
    expect(assess(['BloodlessNaked_Elite', 'BloodlessPitcher'], 3).supported).toBe(true);
  });

  it('preserves the directional SpreadShot exclusion in draw order', () => {
    expect(assess(['SpreadShotUnit_Elite', 'SpreadShotUnit']).supported).toBe(true);
    expect(assess(['SpreadShotUnit_Elite']).eligibleKeysByPosition[1]).toContain('SpreadShotUnit');
    expect(assess(['SpreadShotUnit', 'SpreadShotUnit_Elite']).issues).toEqual([
      { reason: 'enemyUnavailable', position: 2, key: 'SpreadShotUnit_Elite' },
    ]);
    expect(assess(['SpreadShotUnit']).eligibleKeysByPosition[1]).not.toContain(
      'SpreadShotUnit_Elite',
    );
  });

  it('mutually excludes the other normal and elite variants in either order', () => {
    for (const family of [
      'BloodlessNaked',
      'BloodlessWaveFist',
      'BloodlessBerserker',
      'BloodlessGrenadier',
      'BloodlessSelfDestruct',
      'BloodlessPitcher',
    ]) {
      expect(assess([family, `${family}_Elite`]).issues).toEqual([
        { reason: 'enemyUnavailable', position: 2, key: `${family}_Elite` },
      ]);
      expect(assess([`${family}_Elite`, family]).issues).toEqual([
        { reason: 'enemyUnavailable', position: 2, key: family },
      ]);
    }
  });
});

describe('Anomaly infinite roster authoring', () => {
  it('persists an ordered roster, resets to absent Default, and round-trips', () => {
    const project = anomalyRosterProject();
    expect(anomalyEncounters(project).customizationByPhase).toEqual({
      Encounter: {
        infiniteRoster: {
          kind: 'infiniteRoster',
          typeKeys: ['SpreadShotUnit_Elite', 'SpreadShotUnit', 'BloodlessPitcher'],
        },
      },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    expect(rosterFindings(project)).toEqual([]);
    expect(simulateProject(catalog, project).route.summary.eligibleForExecutionPlan).toBe(true);

    const reset = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: anomalyRosterPhase,
      decisionKey: 'infiniteRoster',
      value: null,
    });
    expect(anomalyEncounters(reset).customizationByPhase).toBeUndefined();
  });

  it('rejects structurally unrepresentable rosters at the command', () => {
    const project = createCompleteFGAnomalyProject();
    for (const typeKeys of [
      ['BloodlessNaked'],
      ['BloodlessNaked', 'BloodlessNaked'],
      ['BloodlessNaked', 'Swarmer'],
      ['BloodlessNaked', 'BloodlessPitcher', 'SpreadShotUnit', 'BloodlessWaveFist'],
    ])
      expect(() =>
        applyProjectCommand(project, catalog, {
          kind: 'ReplaceEncounterCustomization',
          phase: anomalyRosterPhase,
          decisionKey: 'infiniteRoster',
          value: { kind: 'infiniteRoster', typeKeys },
        }),
      ).toThrow(/outside its declaration domain/);
  });

  it('strictly decodes the persisted shape', () => {
    const project = anomalyRosterProject();
    for (const raw of [
      { kind: 'infiniteRoster' },
      { kind: 'infiniteRoster', typeKeys: 'BloodlessNaked' },
      { kind: 'infiniteRoster', typeKeys: ['BloodlessNaked'] },
      { kind: 'infiniteRoster', typeKeys: ['BloodlessNaked', 'Unknown'] },
      { kind: 'infiniteRoster', typeKeys: ['BloodlessNaked', 'BloodlessPitcher'], counts: {} },
    ])
      expect(() => decodeProjectDocument(withRawRoster(project, raw), catalog)).toThrow();
  });

  it('retains a context-invalid order as a phase-owned repair finding', () => {
    const invalid = anomalyRosterProject(['SpreadShotUnit', 'SpreadShotUnit_Elite']);
    expect(anomalyEncounters(invalid).customizationByPhase).toEqual({
      Encounter: {
        infiniteRoster: {
          kind: 'infiniteRoster',
          typeKeys: ['SpreadShotUnit', 'SpreadShotUnit_Elite'],
        },
      },
    });
    expect(rosterFindings(invalid)).toEqual([
      expect.objectContaining({
        severity: 'error',
        origin: anomalyRosterPhase,
        evidence: expect.objectContaining({ decisionKey: 'infiniteRoster' }),
      }),
    ]);
    expect(simulateProject(catalog, invalid).route.summary.eligibleForExecutionPlan).toBe(false);
    // The exact reached capability still proposes the repair.
    const capability = infiniteRosterSupportForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, invalid),
      anomalyRosterPhase,
    );
    expect(capability?.assess(['SpreadShotUnit_Elite', 'SpreadShotUnit']).supported).toBe(true);
  });

  it('keeps a retained roster silent while its Anomaly door is not taken', () => {
    const invalid = anomalyRosterProject(['SpreadShotUnit', 'SpreadShotUnit_Elite']);
    const dormant = applyProjectCommand(invalid, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenGBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-g-b2-e1'),
      }),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(anomalyEncounters(dormant).customizationByPhase).toEqual(
      anomalyEncounters(invalid).customizationByPhase,
    );
    expect(rosterFindings(dormant)).toEqual([]);
    expect(
      infiniteRosterSupportForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, dormant),
        anomalyRosterPhase,
      ),
    ).toBeUndefined();
  });

  it('assesses a Fig Leaf skip on the non-skippable Anomaly encounter as unavailable', () => {
    const skipped = applyProjectCommand(createCompleteFGAnomalyProject(), catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: anomalyRosterPhase,
      value: true,
    });
    const evaluation = simulateProject(catalog, skipped);
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'figLeafSkipUnavailable', origin: anomalyRosterPhase }),
    );
    expect(evaluation.route.summary.eligibleForExecutionPlan).toBe(false);
  });

  it('retains the roster through an Anomaly map replacement', () => {
    const replaced = applyProjectCommand(anomalyRosterProject(), catalog, {
      kind: 'ReplaceAnomalyMap',
      occurrence: createOccurrenceAddress(goldenGBiome, anomalyRosterPhase.owner.occurrenceId),
      gameName: 'B_Combat05',
    });
    expect(anomalyEncounters(replaced).customizationByPhase).toEqual(
      anomalyEncounters(anomalyRosterProject()).customizationByPhase,
    );
    expect(rosterFindings(replaced)).toEqual([]);
  });
});

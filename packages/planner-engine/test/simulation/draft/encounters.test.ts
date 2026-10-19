import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '../../../src/authored-project';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import { simulateProjectAssembly, type DraftSpec } from '../../../src/simulation';
import { draftEncounters } from '../../../src/simulation/draft/encounters';
import { DEFAULT_DRAFT_BUDGET } from '../../../src/simulation/draft/generator';
import { createDraftRng } from '../../../src/simulation/draft/rng';
import {
  settleDraftCommand,
  settleDraftCommandWithoutNewFinding,
} from '../../../src/simulation/draft/settle';
import { startDraftWalk } from '../../support/draft-walk';
import type { ProjectEvaluationAssembly } from '../../../src/simulation/evaluation/evaluation-products';
import {
  generatedEncounterSupportForProjectEvaluationAssembly,
  reachedEncounterPhasesForProjectEvaluationAssembly,
} from '../../../src/simulation/evaluation/project-evaluation-assembly';

const { startingReward: _startingReward, ...defaultLoadout } = createDefaultRouteLoadout(catalog);
void _startingReward;
const base = createProjectDocument(catalog, {
  projectId: 'u',
  routeKey: 'Underworld',
  configuredBiomeCount: 4,
});
const spec: DraftSpec = {
  loadout: {
    ...defaultLoadout,
    fearRanks: {
      ...defaultLoadout.fearRanks,
      NextBiomeEnemyShrineUpgrade: 2,
      EnemyEliteShrineUpgrade: 2,
    },
  },
  world: {
    godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
    storyNpcByBiome: { F: 'Arachne' },
    fieldNpcsByBiome: {},
  },
  basketTraitKeys: [],
  rackKeepsakeKeys: [null, null, null],
};

/** A walked first biome under Menace 2 and Fangs 2, before its encounters are drafted. */
function walkedFirstBiome(): ProjectEvaluationAssembly {
  const walk = startDraftWalk(base, spec, 3);
  if (!walk.runBiome(0, DEFAULT_DRAFT_BUDGET.maxStepsPerBiome)) throw new Error(walk.failure);
  return walk.assembly;
}

function generatedValues(project: ProjectDocument) {
  return project.route.biomes.flatMap((biome) =>
    (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
      Object.values(occurrence.encounters.customizationByPhase ?? {}).flatMap((decisions) =>
        Object.values(decisions).filter((value) => value.kind === 'generated'),
      ),
    ),
  );
}

describe('draftEncounters', () => {
  const start = walkedFirstBiome();
  const drafted = draftEncounters(catalog, start, 'F', createDraftRng(11));

  it('customizes every reached generated encounter without a new finding', () => {
    expect(drafted.evaluation.findings).toEqual(start.evaluation.findings);
    const phases = reachedEncounterPhasesForProjectEvaluationAssembly(drafted);
    expect(phases.length).toBeGreaterThan(0);
    const occurrences = drafted.project.route.biomes[0]!.topology!.occurrences;
    for (const phase of phases) {
      const decisions = occurrences.find(
        (occurrence) => occurrence.occurrenceId === phase.owner.occurrenceId,
      )!.encounters.customizationByPhase?.[phase.phaseKey];
      const generated = generatedEncounterSupportForProjectEvaluationAssembly(drafted, phase);
      if (generated !== undefined) expect(decisions?.[generated.decisionKey]).toBeDefined();
    }
  });

  it('rolls Fangs and Menace conversions within each source request count', () => {
    let conversions = 0;
    let fangs = 0;
    for (const phase of reachedEncounterPhasesForProjectEvaluationAssembly(drafted)) {
      const capability = generatedEncounterSupportForProjectEvaluationAssembly(drafted, phase);
      if (capability === undefined) continue;
      const value = drafted.project.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === phase.owner.occurrenceId,
      )!.encounters.customizationByPhase![phase.phaseKey]![capability.decisionKey]!;
      if (value.kind !== 'generated') throw new Error('expected a generated value');
      const assessment = capability.assess(value);
      expect(assessment.supported).toBe(true);
      if (value.fangs !== undefined) fangs += 1;
      for (const wave of value.menace ?? [])
        for (const [sourceKey, conversion] of Object.entries(wave.conversions)) {
          const source = assessment.waves
            .find((entry) => entry.waveIndex === wave.waveIndex)
            ?.menaceSources?.find((entry) => entry.sourceKey === sourceKey);
          expect(conversion.count).toBeGreaterThan(0);
          expect(conversion.count).toBeLessThanOrEqual(source!.maximum);
          conversions += conversion.count;
        }
    }
    expect(conversions).toBeGreaterThan(0);
    expect(fangs).toBeGreaterThan(0);
  });

  it('rolls no Menace conversion without the Vow', () => {
    const { fearRanks: _fearRanks, ...rest } = start.project.route.loadout;
    void _fearRanks;
    const unvowed = simulateProjectAssembly(catalog, {
      ...start.project,
      route: {
        ...start.project.route,
        loadout: {
          ...rest,
          fearRanks: { ...defaultLoadout.fearRanks, EnemyEliteShrineUpgrade: 2 },
        },
      },
    });
    const values = generatedValues(
      draftEncounters(catalog, unvowed, 'F', createDraftRng(11)).project,
    );
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(value.kind === 'generated' && value.menace).toBeFalsy();
  });

  it('refuses an edit whose earlier block replaces the frontier finding', () => {
    const phase = reachedEncounterPhasesForProjectEvaluationAssembly(start).find(
      (entry) => generatedEncounterSupportForProjectEvaluationAssembly(start, entry) !== undefined,
    )!;
    const command = {
      kind: 'ReplaceEncounterCustomization' as const,
      phase,
      decisionKey: generatedEncounterSupportForProjectEvaluationAssembly(start, phase)!.decisionKey,
      // Five waves is representable but beyond every declared policy.
      value: { kind: 'generated' as const, waveCount: 5 },
    };
    const settled = settleDraftCommand(catalog, start, command)!;
    expect(settled.evaluation.findings).toHaveLength(start.evaluation.findings.length);
    expect(settled.evaluation.findings).not.toEqual(start.evaluation.findings);
    expect(settleDraftCommandWithoutNewFinding(catalog, start, command)).toBeUndefined();
  });

  it('drafts the same encounters for the same seed', () => {
    expect(draftEncounters(catalog, start, 'F', createDraftRng(11)).project).toEqual(
      drafted.project,
    );
  });
});

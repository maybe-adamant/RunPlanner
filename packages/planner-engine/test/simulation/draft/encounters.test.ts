import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '../../../src/authored-project';
import { createDefaultRouteLoadout } from '../../../src/authored-project/loadout';
import { createProjectDocument } from '../../../src/authored-project/defaults';
import { draftProject, simulateProjectAssembly, type DraftSpec } from '../../../src/simulation';
import {
  DRAFT_FIG_LEAF_SKIP_CHANCE,
  draftEncounterKeepsakeCommands,
  draftEncounters,
} from '../../../src/simulation/draft/encounters';
import { DEFAULT_DRAFT_BUDGET } from '../../../src/simulation/draft/generator';
import { createDraftRng } from '../../../src/simulation/draft/rng';
import {
  settleCommandUnlessRefused,
  settleCommandWithoutNewFinding,
} from '../../../src/simulation/edit-settlement';
import { startDraftWalk } from '../../support/draft-walk';
import type { ProjectEvaluationAssembly } from '../../../src/simulation/evaluation/evaluation-products';
import {
  encounterPhaseFigLeafSupportForProjectEvaluationAssembly,
  encounterPhaseGorgonSupportForProjectEvaluationAssembly,
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  generatedEncounterSupportForProjectEvaluationAssembly,
  reachedEncounterPhasesForProjectEvaluationAssembly,
} from '../../../src/simulation/evaluation/project-evaluation-assembly';
import { draftBasket } from '../../support/draft-basket';

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
  basketByGiver: {},
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
    const settled = settleCommandUnlessRefused(catalog, start, command)!;
    expect(settled.evaluation.findings).toHaveLength(start.evaluation.findings.length);
    expect(settled.evaluation.findings).not.toEqual(start.evaluation.findings);
    expect(settleCommandWithoutNewFinding(catalog, start, command)).toBeUndefined();
  });

  it('drafts the same encounters for the same seed', () => {
    expect(draftEncounters(catalog, start, 'F', createDraftRng(11)).project).toEqual(
      drafted.project,
    );
  });
});

describe('draft encounter keepsakes', () => {
  const phase = createEncounterPhaseAddress(
    createBiomeAddress('Underworld', 'F'),
    { kind: 'occurrence', occurrenceId: createOccurrenceId('F-1') },
    'Encounter',
  );
  const offered = { supported: true };
  const kinds = (figLeaf?: { supported: boolean }, gorgon?: { supported: boolean }, roll = 0) =>
    draftEncounterKeepsakeCommands(phase, figLeaf, gorgon, () => roll).map((c) => c.kind);

  it("skips with Fig Leaf on a hit and otherwise meets Gorgon's trigger where each is offered", () => {
    expect(kinds(offered, offered)).toEqual([
      'ReplaceFigLeafSkip',
      'ReplaceGorgonDeathDefianceCondition',
    ]);
    expect(kinds(offered, offered, 0.99)).toEqual(['ReplaceGorgonDeathDefianceCondition']);
    expect(kinds({ supported: false }, offered)).toEqual(['ReplaceGorgonDeathDefianceCondition']);
    expect(kinds({ supported: false }, { supported: false })).toEqual([]);
    expect(kinds()).toEqual([]);
  });

  it('rolls Fig Leaf at its native chance, and only where it is offered', () => {
    const rng = createDraftRng(5);
    let rolls = 0;
    const random = () => {
      rolls += 1;
      return rng();
    };
    const trials = 4000;
    let hits = 0;
    for (let trial = 0; trial < trials; trial += 1)
      hits += draftEncounterKeepsakeCommands(phase, offered, undefined, random).length;
    expect(Math.abs(hits / trials - DRAFT_FIG_LEAF_SKIP_CHANCE)).toBeLessThan(0.03);
    rolls = 0;
    draftEncounterKeepsakeCommands(phase, { supported: false }, offered, random);
    expect(rolls).toBe(0);
  });

  const skippedPhases = (project: ProjectDocument) =>
    project.route.biomes.flatMap((biome) =>
      (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
        Object.entries(occurrence.encounters.figLeafSkipByPhase)
          .filter(([, skipped]) => skipped)
          .map(([phaseKey]) => ({ biomeKey: biome.biomeKey, occurrence, phaseKey })),
      ),
    );

  it('skips encounters the engine offers Fig Leaf on, within its uses and one per biome', () => {
    const figLeafBase = createProjectDocument(catalog, {
      projectId: 'f',
      routeKey: 'Underworld',
      configuredBiomeCount: 2,
    });
    const figLeafSpec: DraftSpec = {
      ...spec,
      loadout: { ...defaultLoadout, startingKeepsakeKey: 'SkipEncounterKeepsake' },
      rackKeepsakeKeys: [null, null, null],
    };
    let total = 0;
    for (const seed of [1, 2]) {
      const result = draftProject(catalog, figLeafBase, figLeafSpec, seed);
      if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
      const assembly = simulateProjectAssembly(catalog, result.project);
      const skipped = skippedPhases(result.project);
      const uses = Math.max(
        ...reachedEncounterPhasesForProjectEvaluationAssembly(assembly).map(
          (phase) =>
            encounterPhaseFigLeafSupportForProjectEvaluationAssembly(assembly, phase)
              ?.remainingUses ?? 0,
        ),
      );
      expect(skipped.length).toBeLessThanOrEqual(uses);
      expect(new Set(skipped.map((entry) => entry.biomeKey)).size).toBe(skipped.length);
      for (const phase of reachedEncounterPhasesForProjectEvaluationAssembly(assembly)) {
        const status = encounterPhaseSequenceStatusForProjectEvaluationAssembly(assembly, phase);
        const definition =
          catalog.encounterDefinitions.byKey[
            status?.kind === 'active' ? (status.encounterDefinitionKey ?? '') : ''
          ];
        const skip = skipped.some(
          (entry) =>
            entry.occurrence.occurrenceId === phase.owner.occurrenceId &&
            entry.phaseKey === phase.phaseKey,
        );
        if (skip) expect(definition?.canEncounterSkip).toBe(true);
      }
      total += skipped.length;
    }
    expect(total).toBeGreaterThan(0);
  });

  it("meets Gorgon's trigger at the first encounter offering it and takes the basket Athena trait", () => {
    const surface = createProjectDocument(catalog, {
      projectId: 'g',
      routeKey: 'Surface',
      configuredBiomeCount: 2,
    });
    const result = draftProject(
      catalog,
      surface,
      {
        loadout: { ...defaultLoadout, startingKeepsakeKey: 'AthenaEncounterKeepsake' },
        world: {
          godKeys: ['Zeus', 'Hera', 'Demeter', 'Ares'],
          storyNpcByBiome: {},
          fieldNpcsByBiome: {},
        },
        basketByGiver: draftBasket(['InvulnerabilityDashBoon']),
        rackKeepsakeKeys: [null, null, null],
      },
      1,
    );
    if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
    const assembly = simulateProjectAssembly(catalog, result.project);
    const first = reachedEncounterPhasesForProjectEvaluationAssembly(assembly).find(
      (phase) =>
        encounterPhaseGorgonSupportForProjectEvaluationAssembly(assembly, phase)?.supported,
    )!;
    const triggered = result.project.route.biomes.flatMap((biome) =>
      (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
        Object.entries(occurrence.encounters.gorgonResultByPhase ?? {})
          .filter(([, value]) => value.athenaTriggerConditionMet)
          .map(([phaseKey, value]) => ({ occurrenceId: occurrence.occurrenceId, phaseKey, value })),
      ),
    );
    expect(triggered).toEqual([
      {
        occurrenceId: first.owner.occurrenceId,
        phaseKey: first.phaseKey,
        value: expect.objectContaining({
          athenaOffer: expect.objectContaining({
            traitKeys: expect.arrayContaining(['InvulnerabilityDashBoon']),
          }),
        }),
      },
    ]);
    expect(result.report.targets).toContainEqual({
      kind: 'basketTrait',
      key: 'InvulnerabilityDashBoon',
      met: true,
    });
  });

  it("decides a ship room's later combat once reached: a rack Gorgon's Athena and Icarus in Thessaly", () => {
    const surface = createProjectDocument(catalog, {
      projectId: 'o',
      routeKey: 'Surface',
      configuredBiomeCount: 2,
    });
    const result = draftProject(
      catalog,
      surface,
      {
        loadout: defaultLoadout,
        world: {
          godKeys: ['Zeus', 'Hera', 'Demeter', 'Ares'],
          storyNpcByBiome: {},
          fieldNpcsByBiome: { O: ['Icarus'] },
        },
        basketByGiver: draftBasket(['FocusLastStandBoon']),
        rackKeepsakeKeys: ['AthenaEncounterKeepsake', null, null],
      },
      1,
    );
    if (result.kind !== 'drafted') throw new Error(`draft ${result.kind}`);
    const thessaly = result.project.route.biomes.find((biome) => biome.biomeKey === 'O')!;
    const combats = thessaly.topology!.occurrences.filter(
      (occurrence) => occurrence.encounters.encounterKeyByPhase.Combat1 !== undefined,
    );
    expect(
      combats.filter(
        (occurrence) =>
          occurrence.encounters.gorgonResultByPhase?.Combat1?.athenaTriggerConditionMet,
      ),
    ).toHaveLength(1);
    expect(
      combats.some(
        (occurrence) => occurrence.encounters.encounterKeyByPhase.Combat1 === 'IcarusCombatO',
      ),
    ).toBe(true);
    expect(result.report.targets).toEqual(
      expect.arrayContaining([
        { kind: 'basketTrait', key: 'FocusLastStandBoon', met: true },
        { kind: 'fieldNpc', key: 'Icarus', biomeKey: 'O', met: true },
      ]),
    );
  });
});

import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  createIncomingRewardAddress,
  type ProjectDocument,
  type AuthoredGeneratedEncounterCustomization,
} from '../../src/authored-project';
import {
  generatedEncounterSupportForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '../../src/simulation';
import {
  compileExecutionPlan,
  assembleExecutionProduct,
  encodeExecutionPlan,
  decodeExecutionPlan,
} from '../../src/execution-plan';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { generatedEncounter } from '../../src/execution-plan/codec/generated-encounter';
import { targetRewardGenerationCheckpoint } from '../../src/simulation/encounters/generation-preparation';

const phase = createEncounterPhaseAddress(
  goldenFBiome,
  { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
  'Encounter',
);
function replace(project: ProjectDocument, value: AuthoredGeneratedEncounterCustomization | null) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase,
    decisionKey: 'generatedComposition',
    value,
  });
}
function publish(project: ProjectDocument) {
  const assembly = simulateProjectAssembly(catalog, project);
  expect(assembly.evaluation.status, JSON.stringify(assembly.evaluation.findings)).toBe('valid');
  return compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
}
function customization(project: ProjectDocument) {
  return publish(project).occurrences.find((room) => room.id === phase.owner.occurrenceId)?.overview
    .encounterPhases[0]?.customization;
}

describe('generated customization publication', () => {
  it('round trips exact sparse operands without adding acquisition or conformance obligations', () => {
    const base = createGoldenFGHIProject();
    const value = {
      kind: 'generated',
      waveCount: 3,
      highlightKey: 'Guard',
      waves: [
        { waveIndex: 3, typeKeys: ['Brawler', 'Mage'], weights: { Guard: 1, Brawler: 2, Mage: 3 } },
      ],
    } as const;
    const project = replace(base, value);
    const assembly = simulateProjectAssembly(catalog, project);
    expect(
      generatedEncounterSupportForProjectEvaluationAssembly(assembly, phase)?.assess(value)
        .supported,
    ).toBe(true);
    const plan = publish(project);
    const original = publish(base);
    const index = plan.occurrences.findIndex((room) => room.id === phase.owner.occurrenceId);
    expect(plan.occurrences[index]?.overview.encounterPhases[0]?.customization).toEqual([
      {
        kind: 'generated',
        decisionKey: 'generatedComposition',
        waveCount: 3,
        highlight: { choiceKey: 'Guard', nativeId: 'Guard' },
        waves: [
          {
            waveIndex: 3,
            types: [
              { choiceKey: 'Guard', nativeId: 'Guard' },
              { choiceKey: 'Brawler', nativeId: 'Brawler' },
              { choiceKey: 'Mage', nativeId: 'Mage' },
            ],
            shares: [1 / 6, 2 / 6, 3 / 6],
          },
        ],
      },
    ]);
    expect(plan.occurrences[index]?.timeline).toEqual(original.occurrences[index]?.timeline);
    expect(plan.occurrences[index]?.roomExitConformance).toEqual(
      original.occurrences[index]?.roomExitConformance,
    );
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    expect(
      customization(replace(project, { kind: 'generated', waves: value.waves })),
    ).toBeUndefined();
    expect(customization(replace(project, null))).toBeUndefined();
  });

  it('keeps concrete incompatible edits repairable at their phase', () => {
    const project = replace(createGoldenFGHIProject(), {
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Guard_Elite'] }],
    });
    const assembly = simulateProjectAssembly(catalog, project);
    expect(assembly.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'encounterCustomizationUnavailable', origin: phase }),
    );
    const capability = generatedEncounterSupportForProjectEvaluationAssembly(assembly, phase);
    expect(
      capability?.assess({
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'] }],
      }).supported,
    ).toBe(true);
    expect(customization(replace(project, null))).toBeUndefined();
  });

  it('uses earlier reward-generation depth for Trial, not destination entry depth', () => {
    const trialId = goldenFOccurrenceId(8, 1);
    const trialPhase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: trialId },
      'Encounter',
    );
    const base = createGoldenFGHIProject();
    let project = applyProjectCommand(
      { ...base, route: { ...base.route, biomes: base.route.biomes.slice(0, 1) } },
      catalog,
      {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(goldenFBiome, trialId),
        value: {
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'ApolloUpgrade',
            spurnedSource: 'ZeusUpgrade',
          },
        },
      },
    );
    project = authorLegalTraitOffers(project);
    const assembly = simulateProjectAssembly(catalog, project);
    const support = generatedEncounterSupportForProjectEvaluationAssembly(assembly, trialPhase);
    expect(support, JSON.stringify(assembly.evaluation.findings)).toBeDefined();
    const biome = assembly.evaluation.route.biomes[0]!;
    if (biome.authoring !== 'complete' || biome.validity !== 'valid')
      throw new Error('Trial fixture did not reach its checkpoint');
    const view = biome.history.rooms.find(
      (room) => 'occurrenceId' in room.origin && room.origin.occurrenceId === trialId,
    )!;
    const source = targetRewardGenerationCheckpoint(biome.history.rooms, view.origin)!;
    expect(source.sequence).toBeLessThan(view.preparation.sequence);
    expect(source.ledgers.counters.biomeDepthCache).toBe(
      view.preparation.ledgers.counters.biomeDepthCache - 1,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: trialPhase,
      decisionKey: 'generatedComposition',
      value: { kind: 'generated', waveCount: 2, highlightKey: 'Guard' },
    });
    const plan = publish(project);
    expect(
      plan.occurrences.find((room) => room.id === trialId)?.overview.encounterPhases[0],
    ).toMatchObject({
      encounterKey: 'DevotionTestF',
      customization: [{ kind: 'generated', waveCount: 2, highlight: { nativeId: 'Guard' } }],
    });
  });

  it('carries known H blacklist consequences across preparation records, including later cages', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat09');
    const cage1 = createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'H'),
      { kind: 'occurrence', occurrenceId },
      'Cage01',
    );
    const cage2 = createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'H'),
      { kind: 'occurrence', occurrenceId },
      'Cage02',
    );
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: cage1,
      decisionKey: 'generatedComposition',
      value: { kind: 'generated', waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2', 'Lamia'] }] },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const support = generatedEncounterSupportForProjectEvaluationAssembly(assembly, cage2);
    expect(support, JSON.stringify(assembly.evaluation.findings)).toBeDefined();
    expect(
      support?.assess({
        kind: 'generated',
        waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2', 'Lamia'] }],
      }).supported,
    ).toBe(false);
    expect(
      support?.assess({
        kind: 'generated',
        waves: [{ waveIndex: 1, typeKeys: ['Lamia', 'Mourner'] }],
      }).supported,
    ).toBe(true);
  });
});

describe('generated execution decoding', () => {
  const value = {
    decisionKey: 'generatedComposition',
    kind: 'generated',
    waveCount: 3,
    highlight: { choiceKey: 'Guard', nativeId: 'Guard' },
    waves: [
      {
        waveIndex: 3,
        types: [
          { choiceKey: 'Guard', nativeId: 'Guard' },
          { choiceKey: 'Mage', nativeId: 'Mage' },
        ],
        shares: [0.4, 0.6],
      },
    ],
  };
  it('accepts sparse normalized requests and rejects malformed operands', () => {
    expect(generatedEncounter(value, 'test')).toEqual(value);
    for (const malformed of [
      { ...value, waveCount: 6 },
      { ...value, waveCount: 1 },
      { ...value, unsupported: true },
      { ...value, waves: [value.waves[0], value.waves[0]] },
      ...[[0.2, 0.2], [0, 1], [Number.NaN, 1], [0.5]].map((shares) => ({
        ...value,
        waves: [{ ...value.waves[0], shares }],
      })),
      { ...value, waves: [{ ...value.waves[0], waveIndex: 4 }] },
      { ...value, waves: [{ ...value.waves[0], types: [...value.waves[0]!.types].reverse() }] },
    ])
      expect(() => generatedEncounter(malformed, 'test')).toThrow();
  });
});

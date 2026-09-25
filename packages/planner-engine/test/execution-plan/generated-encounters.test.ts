import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  createIncomingRewardAddress,
  createLocalVisitSlotAddress,
  createLocalVisitOrderAddress,
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
  goldenFStartId,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPProject, nBiome, nOccurrenceIds } from '@run-planner/test-fixtures/surface';
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
function initialized(project: ProjectDocument, owner = phase) {
  const assembly = simulateProjectAssembly(catalog, project);
  const capability = generatedEncounterSupportForProjectEvaluationAssembly(assembly, owner);
  const value = capability?.initialize();
  expect(value, JSON.stringify(assembly.evaluation.findings)).toBeDefined();
  return value!;
}

describe('generated customization publication', () => {
  it.each([
    ['OpeningGeneratedF', 'Underworld', goldenFStartId],
    ['OpeningGeneratedN', 'Surface', nOccurrenceIds.opening],
    ['PreHubGeneratedN', 'Surface', nOccurrenceIds.preHub],
    ['GeneratedNSubRoom', 'Surface', createOccurrenceId('surface-n-combat11-sideDoor1')],
    ['GeneratedNSubRoom_Bigger', 'Surface', createOccurrenceId('surface-n-combat09-sideDoor1')],
  ] as const)('authors and publishes %s through its actual room phase', (key, route, id) => {
    const base = route === 'Underworld' ? createGoldenFGHIProject() : loadSurfaceNOPProject();
    let project: ProjectDocument = {
      ...base,
      route: { ...base.route, biomes: base.route.biomes.slice(0, 1) },
    };
    const owner = createEncounterPhaseAddress(
      route === 'Underworld' ? goldenFBiome : nBiome,
      { kind: 'occurrence', occurrenceId: id },
      'Encounter',
    );
    if (key === 'GeneratedNSubRoom_Bigger') {
      const source = createOccurrenceId('surface-n-combat09');
      project = applyProjectCommand(project, catalog, {
        kind: 'SetLocalVisitGeneration',
        slot: createLocalVisitSlotAddress(nBiome, source, 'sideRooms', 'sideDoor1'),
        generation: 'generated',
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, id),
        value: { rewardType: 'MaxHealthDrop' },
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalVisitOrder',
        order: createLocalVisitOrderAddress(nBiome, source, 'sideRooms'),
        occurrenceIds: [id],
      });
    }
    project = authorLegalTraitOffers(project);
    const before = publish(project);
    expect(
      before.occurrences.find((room) => room.id === id)?.overview.encounterPhases[0]?.customization,
    ).toBeUndefined();
    const value = initialized(project, owner);
    expect(value.waveCount).toBe(1);
    const customized = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: owner,
      decisionKey: 'generatedComposition',
      value,
    });
    const plan = publish(customized);
    const phase = plan.occurrences.find((room) => room.id === id)?.overview.encounterPhases[0];
    expect(phase).toMatchObject({
      encounterKey: key,
      customization: [
        expect.objectContaining({
          kind: 'generated',
          waveCount: 1,
          expectedBudget: expect.any(Number),
          waves: expect.any(Array),
        }),
      ],
    });
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    expect(
      publish(
        applyProjectCommand(customized, catalog, {
          kind: 'ReplaceEncounterCustomization',
          phase: owner,
          decisionKey: 'generatedComposition',
          value: null,
        }),
      ),
    ).toEqual(before);
  });
  it('publishes reached source-specific Menace without changing the generated roster or counts', () => {
    const enabled = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'NextBiomeEnemyShrineUpgrade',
      rank: 2,
    });
    const value = {
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 70 } }],
      menace: [{ waveIndex: 1, conversions: { Guard: { count: 2 } } }],
    } as const;
    const plan = publish(replace(enabled, value));
    const published = plan.occurrences.find((room) => room.id === phase.owner.occurrenceId)!
      .overview.encounterPhases[0]!.customization![0]!;
    expect(published).toMatchObject({
      menace: [
        {
          waveIndex: 1,
          conversions: [
            {
              source: { choiceKey: 'Guard', nativeId: 'Guard' },
              count: 2,
              target: { choiceKey: 'Guard2', nativeId: 'Guard2' },
            },
          ],
        },
      ],
      waves: [
        {
          counts: { Guard: 14 },
          types: expect.arrayContaining([expect.objectContaining({ nativeId: 'Guard' })]),
        },
      ],
    });
    expect(generatedEncounter(published, 'test')).toEqual(published);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });
  it('publishes a complete resolved composition without adding acquisition or conformance obligations', () => {
    const base = createGoldenFGHIProject();
    const value = initialized(base);
    const project = replace(base, value);
    const assembly = simulateProjectAssembly(catalog, project);
    const operands = generatedEncounterSupportForProjectEvaluationAssembly(assembly, phase)?.assess(
      value,
    ).operands;
    expect(operands).toBeDefined();
    const plan = publish(project);
    const original = publish(base);
    const index = plan.occurrences.findIndex((room) => room.id === phase.owner.occurrenceId);
    const published = plan.occurrences[index]?.overview.encounterPhases[0]?.customization?.[0];
    expect(published).toMatchObject({ kind: 'generated', decisionKey: 'generatedComposition' });
    if (published?.kind !== 'generated') throw new Error('Generated result was not published');
    expect(published.expectedBudget).toBe(operands!.expectedBudget);
    expect(published.waves).toHaveLength(published.waveCount);
    for (const wave of published.waves) {
      expect(wave.types.length).toBeGreaterThan(0);
      expect(Object.keys(wave.counts).sort()).toEqual(
        wave.types.map((entry) => entry.nativeId).sort(),
      );
      expect(wave.types.every((entry) => entry.source !== undefined)).toBe(true);
    }
    expect(plan.occurrences[index]?.timeline).toEqual(original.occurrences[index]?.timeline);
    expect(plan.occurrences[index]?.roomExitConformance).toEqual(
      original.occurrences[index]?.roomExitConformance,
    );
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    const partial =
      value.waves === undefined
        ? { kind: 'generated' as const }
        : { kind: 'generated' as const, waves: value.waves };
    expect(
      generatedEncounterSupportForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, replace(project, partial)),
        phase,
      )?.assess(partial).operands,
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
    expect(capability?.initialize()).toBeDefined();
    expect(customization(replace(project, null))).toBeUndefined();
  });

  it('publishes an active Fangs override from the reached selected product', () => {
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'EnemyEliteShrineUpgrade',
      rank: 1,
    });
    project = replace(project, {
      kind: 'generated',
      waveCount: 1,
      waves: [
        { waveIndex: 1, typeKeys: ['Guard_Elite', 'Brawler'], allocations: { Guard_Elite: 87.5 } },
      ],
      fangs: { typeKey: 'Guard_Elite', perkKeys: ['Blink'] },
    });
    expect(customization(project)).toContainEqual(
      expect.objectContaining({
        kind: 'generated',
        decisionKey: 'generatedComposition',
        fangs: { type: { choiceKey: 'Guard_Elite', nativeId: 'Guard_Elite' }, perks: ['Blink'] },
      }),
    );
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
      value: initialized(project, trialPhase),
    });
    const plan = publish(project);
    expect(
      plan.occurrences.find((room) => room.id === trialId)?.overview.encounterPhases[0],
    ).toMatchObject({
      encounterKey: 'DevotionTestF',
      customization: [expect.objectContaining({ kind: 'generated', waves: expect.any(Array) })],
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
    const base = createGoldenFGHIProject();
    const project = applyProjectCommand(base, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: cage1,
      decisionKey: 'generatedComposition',
      value: {
        kind: 'generated',
        waves: [
          { waveIndex: 1, typeKeys: ['FogEmitter2', 'Lamia'], allocations: { FogEmitter2: 10 } },
        ],
      },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const support = generatedEncounterSupportForProjectEvaluationAssembly(assembly, cage2);
    expect(support, JSON.stringify(assembly.evaluation.findings)).toBeDefined();
    expect(
      support?.assess({
        kind: 'generated',
        waves: [
          { waveIndex: 1, typeKeys: ['FogEmitter2', 'Lamia'], allocations: { FogEmitter2: 10 } },
        ],
      }).issues,
    ).toContainEqual(expect.objectContaining({ reason: 'enemyUnavailable', key: 'FogEmitter2' }));
    expect(
      support?.assess({
        kind: 'generated',
        waves: [{ waveIndex: 1, typeKeys: ['Lamia', 'Mourner'], allocations: { Lamia: 10 } }],
      }).supported,
    ).toBe(true);
    const published = publish(project)
      .occurrences.find((room) => room.id === occurrenceId)
      ?.overview.encounterPhases.find((entry) => entry.slotKey === 'Cage01')?.customization?.[0];
    expect(published).toMatchObject({
      kind: 'generated',
      waves: [
        expect.objectContaining({
          types: expect.arrayContaining([
            expect.objectContaining({ nativeId: 'FogEmitter2', source: 'addition' }),
          ]),
        }),
      ],
    });
  });

  it('publishes and decodes the fixed H template with its native fixed and template entries', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const cage1 = createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'H'),
      { kind: 'occurrence', occurrenceId },
      'Cage01',
    );
    const selected = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase: cage1,
      encounterKey: 'GeneratedH_Treant2',
    });
    const project = applyProjectCommand(selected, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: cage1,
      decisionKey: 'generatedComposition',
      value: {
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'], allocations: { FogEmitter2: 1 } }],
      },
    });
    const plan = publish(project);
    const decoded = decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)));
    const published = decoded.occurrences
      .find((room) => room.id === occurrenceId)
      ?.overview.encounterPhases.find((entry) => entry.slotKey === 'Cage01')?.customization?.[0];
    expect(published).toMatchObject({
      kind: 'generated',
      waveCount: 1,
      waves: [
        {
          types: [
            { choiceKey: 'Treant2', nativeId: 'Treant2', source: 'fixed' },
            { choiceKey: 'FogEmitter2', nativeId: 'FogEmitter2', source: 'template' },
          ],
          counts: { Treant2: 1, FogEmitter2: 1 },
        },
      ],
    });
  });
});

describe('generated execution decoding', () => {
  const value = {
    decisionKey: 'generatedComposition',
    kind: 'generated',
    expectedBudget: 72.5,
    waveCount: 1,
    waves: [
      {
        waveIndex: 1,
        types: [
          { choiceKey: 'Guard', nativeId: 'Guard', source: 'addition' },
          { choiceKey: 'Mage', nativeId: 'Mage', source: 'addition' },
        ],
        counts: { Guard: 4, Mage: 6 },
      },
    ],
  };
  it('accepts only complete normalized requests and rejects malformed operands', () => {
    expect(generatedEncounter(value, 'test')).toEqual(value);
    expect(
      generatedEncounter(
        {
          ...value,
          fangs: {
            type: { choiceKey: 'Guard', nativeId: 'Guard' },
            perks: [],
          },
        },
        'test',
      ),
    ).toMatchObject({ fangs: { type: { nativeId: 'Guard' }, perks: [] } });
    for (const malformed of [
      { ...value, waveCount: 6 },
      { ...value, baseRoll: 10001 },
      ...[undefined, -1, Number.NaN, Number.POSITIVE_INFINITY, '72.5'].map((expectedBudget) => ({
        ...value,
        expectedBudget,
      })),
      { ...value, unsupported: true },
      { ...value, waves: [value.waves[0], value.waves[0]] },
      ...[null, { Guard: -1 }, { Guard: Number.NaN }, { Unknown: 1 }].map((counts) => ({
        ...value,
        waves: [{ ...value.waves[0], counts }],
      })),
      { ...value, waves: [{ ...value.waves[0], waveIndex: 4 }] },
      {
        ...value,
        waves: [
          { ...value.waves[0], types: [value.waves[0]!.types[0]!, value.waves[0]!.types[0]!] },
        ],
      },
    ])
      expect(() => generatedEncounter(malformed, 'test')).toThrow();
  });
  it('strictly decodes source-bound Menace while omission and explicit zero stay deterministic', () => {
    const source = { choiceKey: 'Guard', nativeId: 'Guard' };
    const target = { choiceKey: 'Guard2', nativeId: 'Guard2' };
    const conversion = { source, target, count: 2 };
    const wave = { waveIndex: 1, conversions: [conversion] };
    for (const menace of [[], [wave], [{ waveIndex: 1, conversions: [{ source, count: 0 }] }]]) {
      expect(generatedEncounter({ ...value, menace }, 'test')).toEqual({ ...value, menace });
    }
    expect(generatedEncounter(value, 'test')).toEqual(value);
    for (const menace of [
      [wave, wave],
      [{ ...wave, waveIndex: 2 }],
      [{ ...wave, conversions: [conversion, conversion] }],
      ...[
        { ...conversion, count: 5 },
        { ...conversion, count: -1 },
        { ...conversion, count: 0.5 },
        { source, count: 1 },
        { ...conversion, source: { ...source, choiceKey: 'Mage' } },
        { ...conversion, source: { choiceKey: 'Unknown', nativeId: 'Unknown' } },
        { ...conversion, extra: true },
      ].map((entry) => [{ ...wave, conversions: [entry] }]),
    ]) {
      expect(() => generatedEncounter({ ...value, menace }, 'test')).toThrow();
    }
  });
});

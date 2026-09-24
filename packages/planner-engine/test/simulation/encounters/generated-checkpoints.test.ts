import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  semanticAddressKey,
  type EncounterPhaseAddress,
  type ProjectDocument,
} from '../../../src/authored-project';
import {
  generatedEncounterSupportForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '../../../src/simulation';
import { assessGeneratedEncounter } from '../../../src/simulation/encounters/generation';
import { targetRewardGenerationCheckpoint } from '../../../src/simulation/encounters/generation-preparation';
import { createGoldenFGHIProject, goldenGBiome } from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';

function customize(project: ProjectDocument, phase: EncounterPhaseAddress) {
  const assembly = simulateProjectAssembly(catalog, project);
  const value = generatedEncounterSupportForProjectEvaluationAssembly(
    assembly,
    phase,
  )?.initialize();
  expect(value, JSON.stringify(assembly.evaluation.findings)).toBeDefined();
  return {
    value: value!,
    project: applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'generatedComposition',
      value: value!,
    }),
  };
}
function completeBiome(project: ProjectDocument, biomeKey: string) {
  const assembly = simulateProjectAssembly(catalog, project);
  const biome = assembly.evaluation.route.biomes.find((entry) => entry.biomeKey === biomeKey);
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid')
    throw new Error(`${biomeKey} did not reach a complete valid result`);
  return { assembly, biome };
}
function emitted(biome: ReturnType<typeof completeBiome>['biome'], phase: EncounterPhaseAddress) {
  return biome.roomGeneration.resolvedGenerated.find(
    (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(phase),
  )?.customization.operands;
}
function generatedPolicy(key: string) {
  const selection = catalog.encounterDefinitions.byKey[key]?.customization?.find(
    (entry) => entry.selection.kind === 'generated',
  )?.selection;
  if (selection?.kind !== 'generated') throw new Error(`Missing generation policy ${key}`);
  return selection;
}

describe('generated budget preparation evidence', () => {
  it('emits reward-prepared Devotion budget and counts from the reward-generation checkpoint', () => {
    const trialId = createOccurrenceId('golden-g-b7-e1');
    const phase = createEncounterPhaseAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: trialId },
      'Encounter',
    );
    const base = createGoldenFGHIProject();
    const project = applyProjectCommand(
      { ...base, route: { ...base.route, biomes: base.route.biomes.slice(0, 2) } },
      catalog,
      {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(goldenGBiome, trialId),
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
    const { project: customized, value: authored } = customize(
      authorLegalTraitOffers(project),
      phase,
    );
    const { assembly, biome } = completeBiome(customized, 'G');
    const room = biome.history.rooms.find(
      (entry) => 'occurrenceId' in entry.origin && entry.origin.occurrenceId === trialId,
    )!;
    const checkpoint = targetRewardGenerationCheckpoint(biome.history.rooms, room.origin)!;
    const rewardCounters = checkpoint.ledgers.counters;
    const entryCounters = room.preparation.ledgers.counters;
    expect(rewardCounters.biomeDepthCache).toBeLessThan(entryCounters.biomeDepthCache);

    const operands = emitted(biome, phase)!;
    const support = generatedEncounterSupportForProjectEvaluationAssembly(assembly, phase)!;
    expect(support.assess(authored).operands).toEqual(operands);
    // DevotionTestG ramps on room depth, so the later room-entry context prices differently.
    const policy = generatedPolicy('DevotionTestG');
    const at = (counters: typeof entryCounters) =>
      assessGeneratedEncounter(policy, authored, {
        biomeDepthCache: counters.biomeDepthCache,
        biomeEncounterDepth: counters.biomeEncounterDepth,
        knownRunBlacklist: [],
      }).operands!;
    expect(operands.expectedBudget).toBe(at(rewardCounters).expectedBudget);
    expect(operands.waves).toEqual(at(rewardCounters).waves);
    expect(operands.expectedBudget).not.toBe(at(entryCounters).expectedBudget);
  });

  it('keeps each H cage priced at its own preparation after an earlier cage starts', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat09');
    const biomeAddress = createBiomeAddress('Underworld', 'H');
    const cage = (slot: string) =>
      createEncounterPhaseAddress(biomeAddress, { kind: 'occurrence', occurrenceId }, slot);
    const first = customize(createGoldenFGHIProject(), cage('Cage01'));
    const second = customize(first.project, cage('Cage02'));
    const values = { Cage01: first.value, Cage02: second.value };
    const { assembly, biome } = completeBiome(second.project, 'H');
    const events = biome.history.events.filter(
      (event) => 'occurrenceId' in event.origin && event.origin.occurrenceId === occurrenceId,
    );
    const starts = events.flatMap((event) =>
      event.kind === 'encounterStarted' ? [{ event, index: events.indexOf(event) }] : [],
    );
    expect(starts.map(({ event }) => event.encounterKey)).toEqual(['GeneratedH', 'GeneratedH']);
    const [earlier, later] = starts;
    expect(
      events
        .slice(earlier!.index, later!.index)
        .some(
          (event) =>
            event.kind === 'encounterDepthAdvanced' && event.phaseKey === earlier!.event.phaseKey,
        ),
    ).toBe(true);
    const laterPhase = later!.event.phaseKey as keyof typeof values;
    const counters = biome.history.rooms.find(
      (entry) => 'occurrenceId' in entry.origin && entry.origin.occurrenceId === occurrenceId,
    )!.preparation.ledgers.counters;
    const emittedFirst = emitted(biome, cage('Cage01'))!;
    const emittedSecond = emitted(biome, cage('Cage02'))!;
    for (const [slot, operands] of [
      ['Cage01', emittedFirst],
      ['Cage02', emittedSecond],
    ] as const) {
      const support = generatedEncounterSupportForProjectEvaluationAssembly(assembly, cage(slot))!;
      expect(support.assess(values[slot]).operands, slot).toEqual(operands);
    }
    // GeneratedH reads encounter depth, which the earlier cage's start has already advanced.
    const repriced = assessGeneratedEncounter(generatedPolicy('GeneratedH'), values[laterPhase], {
      biomeDepthCache: counters.biomeDepthCache,
      biomeEncounterDepth: counters.biomeEncounterDepth + 1,
      knownRunBlacklist: [],
    }).operands;
    expect(emittedSecond.expectedBudget).toBe(emittedFirst.expectedBudget);
    expect(repriced!.expectedBudget).not.toBe(emittedFirst.expectedBudget);
  });
});

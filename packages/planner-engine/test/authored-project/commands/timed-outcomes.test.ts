import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createCompleteFGAnomalyProject,
  createGContractAvailabilityProject,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  createSteadyGrowthOutcomeAddress,
  createTranscendentEmbryoOutcomeAddress,
  decodeProjectDocument,
  encodeProjectDocument,
} from '../../../src/authored-project';

describe.each([
  { gameName: 'C_Boss01', build: () => createGContractAvailabilityProject(true).project },
  { gameName: 'B_Combat01', build: () => createCompleteFGAnomalyProject() },
])('timed outcomes on $gameName hosted in G', ({ gameName, build }) => {
  function fixture() {
    const project = build();
    const room = project.route.biomes
      .find((biome) => biome.biomeKey === 'G')!
      .topology!.occurrences.find((occurrence) => occurrence.gameName === gameName)!;
    const owner = createOccurrenceAddress(goldenGBiome, room.occurrenceId);
    const encounters = (value: typeof project) =>
      value.route.biomes
        .find((biome) => biome.biomeKey === 'G')!
        .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === room.occurrenceId)!
        .encounters;
    return { project, owner, encounters };
  }

  it('sets, replaces, round-trips and independently clears automatic outcomes', () => {
    const { project: initial, owner, encounters } = fixture();
    let project = initial;
    const steady = createSteadyGrowthOutcomeAddress(owner, 'Encounter');
    const embryo = createTranscendentEmbryoOutcomeAddress(owner, 'Encounter');
    for (const targetTraitKey of ['ApolloWeaponBoon', 'ApolloSpecialBoon']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceSteadyGrowthTarget',
        outcome: steady,
        targetTraitKey,
      });
      expect(encounters(project).steadyGrowthTargetByPhase?.Encounter).toBe(targetTraitKey);
    }
    const blessing = { blessingKey: 'ChaosElementalBlessing', blessingValues: {} } as const;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: embryo,
      value: blessing,
    });
    expect(encounters(project).transcendentEmbryoBlessingByPhase?.Encounter).toEqual(blessing);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome: steady,
      targetTraitKey: null,
    });
    expect(encounters(project).steadyGrowthTargetByPhase).toBeUndefined();
    expect(encounters(project).transcendentEmbryoBlessingByPhase?.Encounter).toEqual(blessing);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: embryo,
      value: null,
    });
    expect(encounters(project).transcendentEmbryoBlessingByPhase).toBeUndefined();
  });

  it('still requires an existing occurrence and its declared encounter phase', () => {
    const { project, owner } = fixture();
    for (const { target, phase, error } of [
      { target: owner, phase: 'Combat2', error: /has no encounter phase Combat2/ },
      {
        target: createOccurrenceAddress(goldenGBiome, createOccurrenceId('missing-detour')),
        phase: 'Encounter',
        error: /unknown occurrence missing-detour/,
      },
    ]) {
      expect(() =>
        applyProjectCommand(project, catalog, {
          kind: 'ReplaceSteadyGrowthTarget',
          outcome: createSteadyGrowthOutcomeAddress(target, phase),
          targetTraitKey: 'ApolloWeaponBoon',
        }),
      ).toThrow(error);
      expect(() =>
        applyProjectCommand(project, catalog, {
          kind: 'ReplaceTranscendentEmbryoTransformation',
          outcome: createTranscendentEmbryoOutcomeAddress(target, phase),
          value: { blessingKey: 'ChaosElementalBlessing', blessingValues: {} },
        }),
      ).toThrow(error);
    }
  });
});

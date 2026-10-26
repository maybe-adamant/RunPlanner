import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { nBiome } from '@run-planner/test-fixtures/surface';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createIncomingRewardAddress,
  createProjectHistory,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  createTranscendentEmbryoOutcomeAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  undoProjectHistory,
  type AuthoredTraitOfferTraits,
  type ProjectDocument,
} from '../../../src/authored-project';

const sourceOccurrenceId = createOccurrenceId('surface-n-combat23');
const source = createTraitOfferAddress(
  createIncomingRewardAddress(nBiome, sourceOccurrenceId),
  'source',
);
const start = createRouteStartKeepsakeSelectionAddress('Surface');

function sourceOffer(project: ProjectDocument): AuthoredTraitOfferTraits {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === 'N')!
    .topology!.occurrences.find((candidate) => candidate.occurrenceId === sourceOccurrenceId)!;
  const state = occurrence.state as unknown as {
    readonly reward: { readonly traitOffersByAcquisitionRole: Record<string, unknown> };
  };
  return state.reward.traitOffersByAcquisitionRole.source as AuthoredTraitOfferTraits;
}

describe('Steady Growth targets on their source offer', () => {
  it('sets, replaces, round-trips and clears one cycle without touching the others', () => {
    let project = loadSurfaceScheduledLifecycleCheckpoint();
    const before = sourceOffer(project).steadyGrowthTargets;
    expect(before?.['2']).toBe('ApolloWeaponBoon');
    for (const targetTraitKey of ['ApolloSpecialBoon', 'AresSpecialBoon']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceSteadyGrowthTarget',
        outcome: createSteadyGrowthOutcomeAddress(source, 2),
        targetTraitKey,
      });
      expect(sourceOffer(project).steadyGrowthTargets).toEqual({ ...before, 2: targetTraitKey });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome: createSteadyGrowthOutcomeAddress(source, 9),
      targetTraitKey: 'ApolloWeaponBoon',
    });
    expect(Object.keys(sourceOffer(project).steadyGrowthTargets!)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '9',
    ]);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome: createSteadyGrowthOutcomeAddress(source, 2),
      targetTraitKey: null,
    });
    expect(sourceOffer(project).steadyGrowthTargets?.['2']).toBeUndefined();
    expect(sourceOffer(project).steadyGrowthTargets?.['1']).toBe('ApolloWeaponBoon');
  });

  it('records one target edit as one undoable history step', () => {
    const saved = loadSurfaceScheduledLifecycleCheckpoint();
    const edited = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
      kind: 'ReplaceSteadyGrowthTarget',
      outcome: createSteadyGrowthOutcomeAddress(source, 1),
      targetTraitKey: null,
    });
    expect(sourceOffer(edited.present).steadyGrowthTargets?.['1']).toBeUndefined();
    expect(undoProjectHistory(edited).present).toBe(saved);
  });

  it('drops the field when its last cycle is cleared', () => {
    let project = loadSurfaceScheduledLifecycleCheckpoint();
    for (const cycle of Object.keys(sourceOffer(project).steadyGrowthTargets!))
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceSteadyGrowthTarget',
        outcome: createSteadyGrowthOutcomeAddress(source, Number(cycle)),
        targetTraitKey: null,
      });
    expect('steadyGrowthTargets' in sourceOffer(project)).toBe(false);
  });

  it('keeps the targets through a complete offer edit and removes them with another pick', () => {
    let project = loadSurfaceScheduledLifecycleCheckpoint();
    const offer = sourceOffer(project);
    const { steadyGrowthTargets, ...withoutTargets } = offer;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: source,
      value: withoutTargets,
    });
    expect(sourceOffer(project).steadyGrowthTargets).toEqual(steadyGrowthTargets);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: source,
      selectedOptionKey: 'option2',
    });
    expect('steadyGrowthTargets' in sourceOffer(project)).toBe(false);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceSteadyGrowthTarget',
        outcome: createSteadyGrowthOutcomeAddress(source, 1),
        targetTraitKey: 'ApolloWeaponBoon',
      }),
    ).toThrow(/does not give Steady Growth/);
  });

  it('rejects a malformed cycle, an unknown target and a stored offer without Steady Growth', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    expect(() => createSteadyGrowthOutcomeAddress(source, 0)).toThrow(/positive integer/);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceSteadyGrowthTarget',
        outcome: createSteadyGrowthOutcomeAddress(source, 1),
        targetTraitKey: 'NotATrait',
      }),
    ).toThrow(/unknown trait NotATrait/);
    const encoded = JSON.parse(encodeProjectDocument(project));
    const stored = encoded.route.biomes[0].topology.occurrences.find(
      (candidate: { occurrenceId: string }) => candidate.occurrenceId === sourceOccurrenceId,
    ).state.reward.traitOffersByAcquisitionRole.source;
    stored.selectedOptionKey = 'option2';
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      /steadyGrowthTargets: is supported only by an offer that gives Steady Growth/,
    );
  });
});

describe('Transcendent Embryo blessings on the installing selection', () => {
  it('sets, round-trips and clears one cycle beside the equip result', () => {
    let project = loadSurfaceScheduledLifecycleCheckpoint();
    const before = project.route.loadout.keepsakeEquipResults;
    expect(Object.keys(before?.transcendentEmbryoTransformations ?? {})).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
    const blessing = {
      blessingKey: 'ChaosWeaponBlessing',
      blessingValues: { damageBonus: 0.7 },
    } as const;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: createTranscendentEmbryoOutcomeAddress(start, 3),
      value: blessing,
    });
    expect(project.route.loadout.keepsakeEquipResults).toEqual({
      ...before,
      transcendentEmbryoTransformations: {
        ...before?.transcendentEmbryoTransformations,
        3: blessing,
      },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: createTranscendentEmbryoOutcomeAddress(start, 3),
      value: null,
    });
    expect(
      Object.keys(
        project.route.loadout.keepsakeEquipResults?.transcendentEmbryoTransformations ?? {},
      ),
    ).toEqual(['1', '2', '4']);
    expect(project.route.loadout.keepsakeEquipResults?.transcendentEmbryo).toEqual(
      before?.transcendentEmbryo,
    );
  });
});

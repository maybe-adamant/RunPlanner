import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import {
  loadSurfaceOrdinaryHexPathCheckpoint,
  loadSurfaceSeleneHexPathCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import { nBiome } from '@run-planner/test-fixtures/surface';

import {
  applyAuthoredHexTreeEdit,
  applyProjectCommand,
  createDefaultAuthoredHexTree,
  createHexTreeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createRouteAddress,
  createTraitOfferAddress,
  type AuthoredHexTreeEdit,
  type AuthoredTraitOfferTraits,
  type ProjectDocument,
} from '../../src/authored-project';
import { simulateProject } from '../../src/simulation';

const route = createRouteAddress('Surface');

function editAspect(project: ProjectDocument, ...edits: AuthoredHexTreeEdit[]): ProjectDocument {
  const value = edits.reduce(
    (tree, edit) => applyAuthoredHexTreeEdit(catalog, 'SpellMoonBeamTrait', tree, edit),
    project.route.loadout.aspectHexTree!,
  );
  return applyProjectCommand(project, catalog, { kind: 'ReplaceAspectHexTree', route, value });
}

function firstHexProgress(project: ProjectDocument) {
  const biome = simulateProject(catalog, project).route.biomes[0];
  if (biome === undefined || !('rewards' in biome)) throw new Error('first biome is unassessed');
  return biome.rewards.branches[0]!.state.hexProgress;
}

describe('Hex tree settlement', () => {
  it('installs the authored tree as saved', () => {
    const project = editAspect(loadSurfaceSeleneHexPathCheckpoint(), {
      kind: 'setNode',
      nodeKey: '4:5',
      talentKey: 'MoonBeamPrimaryTalent',
    });
    expect(firstHexProgress(project).tree).toEqual(project.route.loadout.aspectHexTree);
    expect(firstHexProgress(project).tree?.nodes['4:5']).toBe('MoonBeamPrimaryTalent');
    expect(simulateProject(catalog, project).findings).toEqual([]);
  });

  it('settles a saved tree-wide conflict with one tree finding naming its nodes', () => {
    const lung = createDefaultAuthoredHexTree(catalog, 'SpellMoonBeamTrait');
    const project = editAspect(loadSurfaceSeleneHexPathCheckpoint(), {
      kind: 'setNode',
      nodeKey: '4:5',
      talentKey: lung.nodes['4:1']!,
    });
    const evaluation = simulateProject(catalog, project);
    expect(evaluation.status).toBe('invalid');
    expect(evaluation.findings).toEqual([
      expect.objectContaining({
        code: 'hexTalentTreeUnavailable',
        origin: createHexTreeAddress(route),
        evidence: expect.objectContaining({
          nodeKeys: ['4:1', '4:5'],
          violations: [
            { kind: 'repeatedTalent', nodeKeys: ['4:1', '4:5'], talentKey: lung.nodes['4:1'] },
          ],
        }),
      }),
    ]);
    const restored = editAspect(project, {
      kind: 'setNode',
      nodeKey: '4:5',
      talentKey: lung.nodes['4:5']!,
    });
    expect(simulateProject(catalog, restored).findings).toEqual([]);
  });

  it('names only the nodes a draw-sequence conflict involves', () => {
    const saved = loadSurfaceSeleneHexPathCheckpoint();
    const lung = saved.route.loadout.aspectHexTree!;
    // Depth 1 shares a deck with depth 2; a talent dealt at depth 2 cannot also take 1:4.
    const project = editAspect(saved, {
      kind: 'setNode',
      nodeKey: '1:4',
      talentKey: lung.nodes['2:2']!,
    });
    const finding = simulateProject(catalog, project).findings[0];
    expect(finding).toMatchObject({
      code: 'hexTalentTreeUnavailable',
      evidence: { violations: [{ kind: 'repeatableSequence', nodeKeys: ['1:4', '2:2'] }] },
    });
  });

  it('owns a Spell Drop tree finding by its offer', () => {
    const saved = loadSurfaceOrdinaryHexPathCheckpoint();
    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(nBiome, createOccurrenceId('surface-n-combat09')),
      'self',
    );
    const occurrence = saved.route.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === 'surface-n-combat09',
    )!;
    if (occurrence.state.kind !== 'ephyraCombat') throw new Error('Spell Drop room is missing');
    const offer = occurrence.state.reward!.traitOffersByAcquisitionRole
      .self as AuthoredTraitOfferTraits;
    const tree = offer.hexTree!;
    const project = applyProjectCommand(saved, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        ...offer,
        hexTree: { ...tree, nodes: { ...tree.nodes, '4:5': tree.nodes['4:1']! } },
      },
    });
    const evaluation = simulateProject(catalog, project);
    expect(evaluation.status).toBe('invalid');
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'hexTalentTreeUnavailable',
        origin: createHexTreeAddress(trait),
        evidence: expect.objectContaining({ nodeKeys: ['4:1', '4:5'] }),
      }),
    );
    expect(evaluation.issue?.owner).toEqual(trait);
  });
});

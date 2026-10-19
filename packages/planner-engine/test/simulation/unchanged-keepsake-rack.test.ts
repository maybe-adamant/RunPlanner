import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createRoomActionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createFountainRarityOutcomeAddress,
  roomActionKey,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { assembleExecutionProduct } from '@run-planner/engine/execution-plan';
import { candidateArtifactsForProjectEvaluationAssembly } from '../../src/simulation/evaluation/project-evaluation-assembly';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { createCompleteFGProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';

const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');
const rack = createRoomActionAddress(
  goldenFBiome,
  postbossId,
  roomActionKey({ kind: 'interactKeepsakeRack' }),
);

function rackFirst(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'MoveRoomAction',
    action: rack,
    toIndex: 0,
  });
}

function evaluated(project: ProjectDocument) {
  const assembly = simulateProjectAssembly(catalog, project);
  const f = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'F');
  if (f?.authoring !== 'complete' || f.validity !== 'valid')
    throw new Error(`expected a valid F: ${JSON.stringify(f?.findings)}`);
  if (assembly.evaluation.findings.length > 0)
    throw new Error(
      `expected no findings: ${JSON.stringify(assembly.evaluation.findings.map((x) => [x.code, x.origin]))}`,
    );
  const product = assembleExecutionProduct({ assembly, catalog });
  const postboss = product.occurrences.find((occurrence) => occurrence.id === postbossId);
  if (postboss === undefined) throw new Error('expected the published F Postboss');
  return { f, postboss };
}

const rackOwner = semanticAddressKey(rack);
const touchesRack = (dependency: { readonly owner: unknown; readonly afterOwner: unknown }) =>
  [dependency.owner, dependency.afterOwner].some(
    (owner) =>
      (typeof owner === 'string' ? owner : semanticAddressKey(owner as never)) === rackOwner,
  );

describe('an unchanged Postboss rack', () => {
  it('is a ranked row with no effect, transaction, guide row or fence', () => {
    const project = authorLegalTraitOffers(createCompleteFGProject());
    const { f, postboss } = evaluated(project);
    expect(f.history.events.map((event) => event.kind)).not.toContain('keepsakeRackUsed');
    expect(postboss.overview.keepsakeRack).toEqual({});
    expect(postboss.timeline.transactions.map((transaction) => transaction.kind)).not.toContain(
      'keepsakeChange',
    );
    expect(postboss.roomGuide.map((row) => row.key)).not.toContain(rack.actionKey);
    expect(postboss.timeline.dependencies.filter(touchesRack)).toEqual([]);

    const set = evaluated(
      applyProjectCommand(project, catalog, {
        kind: 'ReplacePostbossKeepsake',
        selection: createPostbossKeepsakeSelectionAddress(
          createOccurrenceAddress(goldenFBiome, postbossId),
        ),
        keepsakeKey: 'BossPreDamageKeepsake',
      }),
    );
    expect(set.f.history.events.map((event) => event.kind)).toContain('keepsakeRackUsed');
    expect(set.postboss.timeline.transactions.map((transaction) => transaction.kind)).toContain(
      'keepsakeChange',
    );
  });

  it('placed before a Phial Fountain adds no order dependency or fence', () => {
    let project = applyProjectCommand(authorLegalTraitOffers(createCompleteFGProject()), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'FountainRarityKeepsake',
    });
    project = rackFirst(project);
    const outcome = createFountainRarityOutcomeAddress(
      createRoomActionAddress(goldenFBiome, postbossId, roomActionKey({ kind: 'useFountain' })),
    );
    const targetTraitKey = candidateArtifactsForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, project),
    )
      .biomeAt(goldenFBiome)
      ?.fountainRarity.at(outcome)?.frontiers[0]?.mutationTargetKeys[0];
    if (targetTraitKey === undefined) throw new Error('expected a pending Phial target');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome,
      targetTraitKey,
    });
    const { f, postboss } = evaluated(authorLegalTraitOffers(project));
    expect(f.rewards.timelineFacts.dependencies.filter(touchesRack)).toEqual([]);
    const fountain = postboss.timeline.transactions.find(
      (transaction) => transaction.kind === 'fountainUse',
    );
    expect(fountain).toMatchObject({ aromaticPhialTarget: targetTraitKey });
    expect(postboss.timeline.transactions.map((transaction) => transaction.kind)).not.toContain(
      'keepsakeChange',
    );
    expect(postboss.timeline.dependencies.filter(touchesRack)).toEqual([]);

    // A set rack in the same place does order itself against the Phial fountain.
    const swapped = simulateProjectAssembly(
      catalog,
      applyProjectCommand(project, catalog, {
        kind: 'ReplacePostbossKeepsake',
        selection: createPostbossKeepsakeSelectionAddress(
          createOccurrenceAddress(goldenFBiome, postbossId),
        ),
        keepsakeKey: 'BossPreDamageKeepsake',
      }),
    ).evaluation.route.biomes.find((biome) => biome.biomeKey === 'F');
    if (swapped === undefined || !('rewards' in swapped) || swapped.rewards === undefined)
      throw new Error('expected an assessed F');
    expect(swapped.rewards.timelineFacts.dependencies.filter(touchesRack)).toHaveLength(1);
  });
});

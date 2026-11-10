import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { underworldCheckpointArtifacts } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createUnderworldFWellCheckpoint } from '@run-planner/test-fixtures/underworld';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';
import { catalogFindingLabels, presentFinding } from '@planner/projections/evaluationProjection';

const f = createBiomeAddress('Underworld', 'F');

/** The project with the room's saved action of this kind moved to the front of its order. */
function movedFirst(project: ProjectDocument, occurrenceId: string, kind: string) {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === 'F')
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  const reference = occurrence?.roomActions.order.find((candidate) => candidate.kind === kind);
  if (reference === undefined) throw new Error(`${occurrenceId} saves no ${kind}`);
  return applyProjectCommand(project, catalog, {
    kind: 'MoveRoomAction',
    action: createRoomActionAddress(f, createOccurrenceId(occurrenceId), roomActionKey(reference)),
    toIndex: 0,
  });
}

/** The room's projected Timeline: its refused-move explanations among them. */
function roomActions(project: ProjectDocument, occurrenceId: string) {
  const { evaluation, workspace } = projectStructuredWorkspaceFixture(project);
  const biome = requireWorkspaceBiome(workspace, 'F');
  const room = [...biome.nodes, ...biome.completionOutline].find(
    (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
  );
  if (room?.kind !== 'occurrenceWorkbench' || room.room.roomActions === undefined)
    throw new Error(`${occurrenceId} has no projected Timeline`);
  return { actions: room.room.roomActions, evaluation, workspace };
}

/** The title of the finding the saved order makes, beside the move that order refuses. */
function titleAndRefusal(project: ProjectDocument, occurrenceId: string, kind: string) {
  const { evaluation, workspace } = roomActions(
    movedFirst(project, occurrenceId, kind),
    occurrenceId,
  );
  const finding = evaluation.findings.find(
    (candidate) =>
      candidate.code === 'roomActionOrderUnavailable' &&
      candidate.evidence.reason === 'requiredFirst',
  );
  if (finding === undefined) throw new Error('no required-first finding');
  const refused = roomActions(project, occurrenceId).actions.proposals.find(
    (proposal) =>
      proposal.kind === 'move' && proposal.reference.kind === kind && proposal.toIndex === 0,
  );
  return {
    title: presentFinding(finding, {
      ...catalogFindingLabels(catalog),
      roomAction: workspace.roomActionLabel,
    }).title,
    refusal: refused?.explanations,
  };
}

describe('a required-first finding', () => {
  it('names the Postboss fountain as its refused move does', () => {
    const { title, refusal } = titleAndRefusal(
      createUnderworldFWellCheckpoint(false),
      'golden-f-preboss-shop:postboss',
      'purchaseStygianWellOffer',
    );
    expect(title).not.toMatch(/^A required action/);
    expect(refusal).toEqual([`${title}.`]);
  });

  it('names a required room reward pickup as its refused move does', () => {
    const { title, refusal } = titleAndRefusal(
      underworldCheckpointArtifacts['underworld-f-trait-order-checks'].load(),
      '8bf76f54-d35c-44dc-a243-4e3d1f37300c',
      'purchaseStygianWellOffer',
    );
    expect(title).not.toMatch(/^A required action/);
    expect(refusal).toEqual([`${title}.`]);
  });
});

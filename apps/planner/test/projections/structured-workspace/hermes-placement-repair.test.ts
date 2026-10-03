import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectHistoryCommand,
  createProjectHistory,
  roomActionKey,
  semanticAddressKey,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import { createStaleSurfaceHermesDeliveryPlacement } from '@run-planner/test-fixtures/surface';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

it('routes a loaded stale delivery finding to its bound unplacement repair and restores it with Undo', () => {
  const { project, host, source, entryKey } = createStaleSurfaceHermesDeliveryPlacement();
  const projected = projectStructuredWorkspaceFixture(project);
  const finding = projected.evaluation.findings.find(
    (finding) =>
      finding.code === 'rewardSourceUnavailable' &&
      (finding.evidence as { reason?: string } | undefined)?.reason === 'staleHermesShrineDelivery',
  );
  expect(finding).toBeDefined();
  const node = projected.workspace.route.biomes
    .flatMap((biome) => biome.nodes)
    .find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === host.occurrenceId,
    );
  if (node?.kind !== 'occurrenceWorkbench') throw new Error('delivery host missing');
  const row = node.room.roomActions?.rows.find(
    (row) =>
      row.reference.kind === 'interactAcquisitionEntry' && row.reference.entryKey === entryKey,
  );
  if (row === undefined) throw new Error('retained delivery missing');
  expect(row.placementAssessment).toMatchObject({ kind: 'invalid', source });
  expect(row.rewardPayload).toBeUndefined();
  expect(projected.workspace.focusByOwner.get(semanticAddressKey(finding!.origin))).toMatchObject({
    focusKey: row.marker.focusKey,
    roomTab: 'actions',
  });
  const interaction = projected.workspace.interactions.roomActions.get(semanticAddressKey(host));
  const proposal = interaction?.proposals.find(
    (proposal) => proposal.kind === 'unplace' && roomActionKey(proposal.reference) === row.key,
  );
  if (interaction === undefined || proposal === undefined)
    throw new Error('unplacement binding missing');
  const intent = interaction.intentFor(proposal.key);
  expect(intent.command).toEqual({ kind: 'UnplaceGeneratedDelivery', action: row.address });
  const history = applyProjectHistoryCommand(
    createProjectHistory(project),
    catalog,
    intent.command,
  );
  expect(
    history.present.route.biomes
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((occurrence) => occurrence.occurrenceId === host.occurrenceId)
      ?.roomActions.order.some((reference) => roomActionKey(reference) === row.key),
  ).toBe(false);
  expect(undoProjectHistory(history).present).toBe(project);
  const restored = projectStructuredWorkspaceFixture(undoProjectHistory(history).present);
  expect(
    restored.workspace.interactions.roomActions
      .get(semanticAddressKey(host))
      ?.proposals.some((proposal) => proposal.kind === 'unplace'),
  ).toBe(true);
});

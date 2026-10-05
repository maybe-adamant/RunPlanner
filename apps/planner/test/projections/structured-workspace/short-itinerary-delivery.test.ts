import { expect, it } from 'vitest';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  dreamSingleQOccurrenceIds,
  dreamSingleQShrineDeliveryProject,
} from '@run-planner/test-fixtures/dream';

import { nextRepairSelection } from '@planner/projections/evaluationProjection';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

it('routes a delivery the route ends before to its Shrine purchase control', () => {
  const { evaluation, workspace } = projectStructuredWorkspaceFixture(
    dreamSingleQShrineDeliveryProject(),
  );
  const purchase = createRoomFeatureAddress(
    createOccurrenceAddress(
      createBiomeAddress('Dream', 'Q'),
      dreamSingleQOccurrenceIds.shrineSource,
    ),
    { kind: 'hermesShrineOffer', generationKey: 'initial:first' },
  );
  const issue = evaluation.issue;
  if (issue === undefined) throw new Error('short itinerary published no issue');
  expect(issue.owner).toEqual(purchase);
  expect(issue.reasons.map((reason) => [reason.code, reason.evidence.reason])).toEqual([
    ['rewardSourceUnavailable', 'routeEndsBeforeDelivery'],
  ]);
  const destination = workspace.focusByOwner.get(semanticAddressKey(purchase));
  expect(destination).toMatchObject({
    ownerAddress: purchase,
    biomeKey: 'Q',
    roomTab: 'overview',
  });
  expect(nextRepairSelection(issue, workspace.focusByOwner)).toMatchObject({
    key: issue.regionKey,
    origin: purchase,
    focusAddress: purchase,
    traitDialogTarget: null,
  });
  const shrineRow = workspace.route.biomes
    .find((biome) => biome.biomeKey === 'Q')
    ?.nodes.find(
      (node) =>
        node.kind === 'occurrenceWorkbench' &&
        node.room.occurrenceId === dreamSingleQOccurrenceIds.shrineSource,
    );
  expect(shrineRow).toBeDefined();
});

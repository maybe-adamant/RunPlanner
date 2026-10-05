import { expect, it } from 'vitest';
import { createEchoGoldIAnvilDuplicateProject } from '@run-planner/test-fixtures/underworld';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

it('projects a failing Gold duplicate of an Anvil purchase with its findings routed', () => {
  const { evaluation } = projectStructuredWorkspaceFixture(createEchoGoldIAnvilDuplicateProject());
  expect(evaluation.findings).toContainEqual(
    expect.objectContaining({ code: 'rewardAcquisitionUnavailable' }),
  );
});

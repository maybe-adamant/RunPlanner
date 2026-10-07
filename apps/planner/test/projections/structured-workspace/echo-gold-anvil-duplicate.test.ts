import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  createEchoGoldIAnvilDuplicateProject,
  echoGoldIDuplicateAnvilResult,
  echoGoldIPrebossShopId,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

const duplicateAnvil = createAcquisitionRoleAddress(
  createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenIBiome, echoGoldIPrebossShopId),
      'roomExit',
    ),
    'echoDoubleShopReward',
  ),
  'self',
);

describe('Gold duplicate of an Anvil purchase', () => {
  it('binds its own Anvil result and routes its missing result to that launcher', () => {
    const { evaluation, workspace } = projectStructuredWorkspaceFixture(
      createEchoGoldIAnvilDuplicateProject(),
    );
    const key = semanticAddressKey(duplicateAnvil);
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardMissing',
        origin: duplicateAnvil,
        evidence: expect.objectContaining({ pickupEffect: 'anvilOfFates' }),
      }),
    );
    expect(workspace.focusByOwner.get(key)).toMatchObject({
      focusAddress: duplicateAnvil,
      roomTab: 'actions',
    });
    expect(workspace.findingsByRepairTarget.get(key)).toContainEqual(
      expect.objectContaining({ code: 'rewardMissing' }),
    );
    const anvil = workspace.interactions.acquisitionConversions.get(key)?.anvil;
    expect(anvil).toMatchObject({ contextReached: true, value: null });
    expect(anvil?.removableTraitKeys.length).toBeGreaterThan(0);
    expect(anvil?.intentFor(echoGoldIDuplicateAnvilResult)).toEqual({
      command: {
        kind: 'ReplaceAnvilResult',
        acquisition: duplicateAnvil,
        value: echoGoldIDuplicateAnvilResult,
      },
      focus: { owner: duplicateAnvil, timing: 'after' },
    });
  });

  it('folds a Time Piece finding to the duplicate row and waits the Anvil launcher', () => {
    const { evaluation, workspace } = projectStructuredWorkspaceFixture(
      applyProjectCommand(createEchoGoldIAnvilDuplicateProject(), catalog, {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: duplicateAnvil,
        value: { kind: 'timePiece' },
      }),
    );
    const key = semanticAddressKey(duplicateAnvil);
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'timePieceConversionUnavailable', origin: duplicateAnvil }),
    );
    expect(workspace.focusByOwner.get(key)?.focusAddress).toMatchObject({ kind: 'roomAction' });
    // The pickup outcome picker carries the finding; the waiting Anvil launcher does not.
    expect(workspace.findingsByRepairTarget.has(key)).toBe(false);
    expect(workspace.findingsByRepairTarget.get(`${key}#pickupOutcome`)).toContainEqual(
      expect.objectContaining({ code: 'timePieceConversionUnavailable' }),
    );
    expect(workspace.interactions.acquisitionConversions.get(key)?.anvil).toMatchObject({
      contextReached: false,
      value: null,
    });
  });

  it('projects an authored duplicate result without findings', () => {
    const { evaluation, workspace } = projectStructuredWorkspaceFixture(
      createEchoGoldIAnvilDuplicateProject(echoGoldIDuplicateAnvilResult),
    );
    expect(
      evaluation.findings.filter((finding) =>
        semanticAddressKey(finding.origin).includes('echoDoubleShopReward'),
      ),
    ).toEqual([]);
    expect(
      workspace.interactions.acquisitionConversions.get(semanticAddressKey(duplicateAnvil))?.anvil,
    ).toMatchObject({ contextReached: true, value: echoGoldIDuplicateAnvilResult });
  });
});

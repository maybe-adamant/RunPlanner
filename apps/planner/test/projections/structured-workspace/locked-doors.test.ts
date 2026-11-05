import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import type {
  StructuredWorkspaceProjection,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';

// G_Combat01 can lock its second door; G_Story01 cannot lock.
const HOST = 'golden-g-b1-e1';

function room(
  workspace: StructuredWorkspaceProjection,
  occurrenceId = HOST,
): WorkspaceOccurrenceWorkbenchNode['room'] {
  const node = requireWorkspaceBiome(workspace, 'G').nodes.find(
    (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
      candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
  );
  if (node === undefined) throw new Error(`${occurrenceId} has no room workbench`);
  return node.room;
}

const apply = (project: ProjectDocument, command: ProjectCommand) =>
  applyProjectCommand(project, catalog, command as ProjectCommand);

describe('locked doors in the structured workspace', () => {
  it('offers each lockable door on the Overview and nothing at a room that cannot lock', () => {
    const project = createGoldenFGHIProject();
    const { workspace } = projectStructuredWorkspaceFixture(project);
    const lockedDoors = room(workspace).lockedDoors;
    expect(lockedDoors?.doors).toEqual([{ exitKey: 'exit2', label: 'Door 2', locked: false }]);
    expect(lockedDoors?.lockedAtLeave).toEqual([]);
    expect(room(workspace, 'golden-g-b3-e1').lockedDoors).toBeUndefined();
    const toggle = workspace.interactions.roomObjectEntries
      .get(lockedDoors!.interactionKey)!
      .intentFor('exit2');
    expect(toggle.command).toMatchObject({
      kind: 'ReplaceLockedExit',
      exitKey: 'exit2',
      locked: true,
    });
  });

  it('presses a locked door from the Doors object and customizes its fight on the row', () => {
    const project = createGoldenFGHIProject();
    const locked = apply(project, {
      kind: 'ReplaceLockedExit',
      occurrence: createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, 'G'),
        createOccurrenceId(HOST),
      ),
      exitKey: 'exit2',
      locked: true,
    });
    const lockedWorkspace = projectStructuredWorkspaceFixture(locked).workspace;
    const lockedDoors = room(lockedWorkspace).lockedDoors!;
    expect(lockedDoors.doors[0]).toMatchObject({ locked: true });
    expect(lockedDoors.lockedAtLeave).toEqual(['exit2']);
    expect(lockedDoors.unlocks?.options).toEqual([{ exitKey: 'exit2', label: 'Unlock Door 2' }]);
    // The press is the Doors object's, never a generic Add action.
    const press = lockedWorkspace.interactions.roomObjectEntries
      .get(lockedDoors.unlocks!.interactionKey)!
      .intentFor('exit2');
    expect(press.command).toMatchObject({
      kind: 'InsertRoomAction',
      reference: { kind: 'unlockExit', exitKey: 'exit2' },
    });
    const pressed = apply(locked, press.command);
    const { workspace } = projectStructuredWorkspaceFixture(pressed);
    const summary = room(workspace);
    expect(summary.lockedDoors?.lockedAtLeave).toEqual([]);
    expect(summary.lockedDoors?.unlocks?.options).toEqual([]);
    const row = summary.roomActions!.rows.find((candidate) => candidate.label === 'Unlock Door 2');
    expect(row?.unlockExitEncounter).toMatchObject({
      definitionKey: 'GeneratedG_ExtraDoor',
      customization: [{ key: 'generatedComposition' }],
    });
    const customization = workspace.interactions.unlockExitEncounters.get(
      row!.unlockExitEncounter!.interactionKey,
    );
    expect(customization?.intentFor('generatedComposition', null).command).toMatchObject({
      kind: 'ReplaceUnlockExitCustomization',
      decisionKey: 'generatedComposition',
      value: null,
    });
  });
});

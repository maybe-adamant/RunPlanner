import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createPhantomExitAddress,
  semanticAddressKey,
  type OccurrenceId,
  type PhantomExitState,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  loadSurfaceNOPQProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { presentFinding } from '@planner/projections/evaluationProjection';
import type { WorkspaceRoomSummary } from '@planner/projections/structured-workspace';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

const combat05 = nOccurrenceId('combat05');
const combat02 = nOccurrenceId('combat02');
const miniBoss01 = nOccurrenceId('miniBoss01');
const side = nLocalOccurrenceId('combat05', 'sideDoor1');
const exitOf = (occurrenceId: OccurrenceId) => createPhantomExitAddress(nBiome, occurrenceId);

type Projected = ReturnType<typeof projectStructuredWorkspaceFixture>;

function room(projected: Projected, occurrenceId: OccurrenceId): WorkspaceRoomSummary {
  const biome = projected.workspace.route.biomes.find((candidate) => candidate.biomeKey === 'N');
  const rooms = [
    ...(biome?.nodes ?? []).flatMap((node) =>
      node.kind === 'occurrenceWorkbench' ? [node.room] : [],
    ),
    ...(biome?.rail ?? []).flatMap((entry) =>
      entry.kind === 'hubGroup'
        ? entry.visits.flatMap((visit) => [
            visit.node.room,
            ...visit.sideVisits.map((sideVisit) => sideVisit.node.room),
          ])
        : [],
    ),
  ];
  const found = rooms.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (found === undefined) throw new Error(`missing occurrence ${occurrenceId}`);
  return found;
}

function hiddenDoor(projected: Projected, occurrenceId: OccurrenceId) {
  const control = room(projected, occurrenceId).phantomExit;
  if (control === undefined) throw new Error(`${occurrenceId} has no hidden door`);
  const interaction = projected.workspace.interactions.phantomExits.get(control.interactionKey);
  if (interaction === undefined) throw new Error(`${occurrenceId} hidden door is unbound`);
  return { control, interaction };
}

function pin(project: ProjectDocument, occurrenceId: OccurrenceId, value: PhantomExitState) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplacePhantomExit',
    exit: exitOf(occurrenceId),
    value,
  });
}

describe('hidden return door', () => {
  it('shows a main room the settled exit, with no reward for a no-draw room', () => {
    const projected = projectStructuredWorkspaceFixture(loadSurfaceNOPQProject());
    const { control, interaction } = hiddenDoor(projected, combat05);
    expect(control.room).toEqual({ pinned: false, summary: 'Auto · Preboss' });
    expect(control.reward).toEqual({ pinned: false, summary: 'No reward', locked: 'noDraw' });
    expect(
      projected.workspace.focusByOwner.get(semanticAddressKey(exitOf(combat05))),
    ).toMatchObject({ roomTab: 'doors' });

    const items = interaction.rooms.load().sections.flatMap((section) => section.items);
    expect(items[0]).toMatchObject({ value: null, label: 'Auto · Preboss', selected: true });
    expect(items.find((item) => item.value === 'N_Combat13')).toMatchObject({ disabled: false });
    // The engine turns away the room itself and a Mini-Boss the Hub board already created.
    expect(items.find((item) => item.value === 'N_Combat05')).toMatchObject({
      disabled: true,
      explanations: ['This room.'],
    });
    expect(items.find((item) => item.value === 'N_MiniBoss01')).toMatchObject({
      disabled: true,
      explanations: ['Already created this run.'],
    });
  });

  it('gives a Mini-Boss without side doors the same door', () => {
    const projected = projectStructuredWorkspaceFixture(loadSurfaceNOPQProject());
    expect(hiddenDoor(projected, miniBoss01).control.room.summary).toBe('Auto · Preboss');
  });

  it('shows a side room its settled draw and waits on a pinned room for the reward', () => {
    const projected = projectStructuredWorkspaceFixture(loadSurfaceNOPQProject());
    const { control } = hiddenDoor(projected, side);
    expect(control.room.summary).toBe('Auto · Side Room 01');
    expect(control.reward).toMatchObject({ pinned: false, locked: 'autoRoom' });
    expect(control.reward.summary).toMatch(/^Auto · \S/);
  });

  it('pins the room, then a reward from its own store, and returns both to Auto', async () => {
    let project = loadSurfaceNOPQProject();
    const pinRoom = hiddenDoor(projectStructuredWorkspaceFixture(project), combat05).interaction;
    const roomCommand = pinRoom.roomIntent('N_Combat13').command;
    expect(roomCommand).toEqual({
      kind: 'ReplacePhantomExit',
      exit: exitOf(combat05),
      value: { placeholderRoomGameName: 'N_Combat13', rewardType: null },
    });
    project = applyProjectCommand(project, catalog, roomCommand);

    const roomPinned = hiddenDoor(projectStructuredWorkspaceFixture(project), combat05);
    expect(roomPinned.control.room).toEqual({ pinned: true, summary: 'Combat 13' });
    expect(roomPinned.control.reward.locked).toBeUndefined();
    const rewards = (await roomPinned.interaction.rewards.load()).sections.flatMap(
      (section) => section.items,
    );
    expect(rewards[0]).toMatchObject({ value: null, selected: true });
    expect(rewards[0]!.label).toMatch(/^Auto · /);
    const boon = rewards.find((item) => item.value === 'Boon');
    expect(boon).toMatchObject({ state: 'possible', disabled: false });
    project = applyProjectCommand(
      project,
      catalog,
      roomPinned.interaction.rewardIntent('Boon').command,
    );

    const bothPinned = hiddenDoor(projectStructuredWorkspaceFixture(project), combat05);
    expect(bothPinned.control.reward).toEqual({ pinned: true, summary: 'Boon' });
    // A room whose store offers the pinned reward keeps it; Auto clears both.
    expect(bothPinned.interaction.roomIntent('N_Combat01').command.value).toEqual({
      placeholderRoomGameName: 'N_Combat01',
      rewardType: 'Boon',
    });
    expect(bothPinned.interaction.roomIntent('N_PreBoss01').command.value).toEqual({
      placeholderRoomGameName: 'N_PreBoss01',
      rewardType: null,
    });
    project = applyProjectCommand(
      project,
      catalog,
      bothPinned.interaction.roomIntent(null).command,
    );
    expect(hiddenDoor(projectStructuredWorkspaceFixture(project), combat05).control).toMatchObject({
      room: { pinned: false, summary: 'Auto · Preboss' },
      reward: { pinned: false, locked: 'noDraw' },
    });
  });

  it('routes an unavailable pinned room to the Doors tab under a descriptive title', () => {
    const projected = projectStructuredWorkspaceFixture(
      pin(loadSurfaceNOPQProject(), combat02, {
        placeholderRoomGameName: 'N_MiniBoss01',
        rewardType: null,
      }),
    );
    const finding = projected.evaluation.findings.find(
      (candidate) =>
        candidate.code === 'phantomExitPlaceholderUnavailable' &&
        semanticAddressKey(candidate.origin) === semanticAddressKey(exitOf(combat02)),
    );
    if (finding === undefined) throw new Error('missing hidden door finding');
    expect(presentFinding(finding).title).toBe('Hidden door room unavailable');
    expect(
      projected.workspace.focusByOwner.get(semanticAddressKey(exitOf(combat02))),
    ).toMatchObject({ roomTab: 'doors', ownerAddress: exitOf(combat02) });
    const items = hiddenDoor(projected, combat02)
      .interaction.rooms.load()
      .sections.flatMap((section) => section.items);
    expect(items.find((item) => item.value === 'N_MiniBoss01')).toMatchObject({
      selected: true,
      disabled: true,
    });
  });
});

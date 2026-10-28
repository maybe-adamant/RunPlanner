import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
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
    expect(control).toMatchObject({ pinned: false, summary: 'Preboss · no reward' });
    expect(control.room).toEqual({ summary: 'Preboss' });
    expect(control.reward).toEqual({ summary: 'No reward', locked: 'noDraw' });
    expect(
      projected.workspace.focusByOwner.get(semanticAddressKey(exitOf(combat05))),
    ).toMatchObject({ roomTab: 'doors' });

    // Only real candidates are listed; the settled room is the current one.
    const items = interaction.rooms.load().sections.flatMap((section) => section.items);
    expect(items.some((item) => /^Auto/.test(item.label))).toBe(false);
    expect(items.find((item) => item.value === 'N_PreBoss01')).toMatchObject({ selected: true });
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
    expect(hiddenDoor(projected, miniBoss01).control.summary).toBe('Preboss · no reward');
  });

  it('shows a side room its settled draw and waits on a pinned room for the reward', () => {
    const projected = projectStructuredWorkspaceFixture(loadSurfaceNOPQProject());
    const { control } = hiddenDoor(projected, side);
    expect(control.pinned).toBe(false);
    expect(control.room.summary).toBe('Side Room 01');
    expect(control.reward).toMatchObject({ locked: 'autoRoom' });
    expect(control.reward.summary).not.toMatch(/Auto|No reward/);
    expect(control.summary).toBe(`Side Room 01 · ${control.reward.summary}`);
  });

  it('pins the room, then a reward from its own store, and resets both', async () => {
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
    expect(roomPinned.control.pinned).toBe(true);
    expect(roomPinned.control.room).toEqual({ summary: 'Combat 13' });
    expect(roomPinned.control.reward.locked).toBeUndefined();
    const rewards = (await roomPinned.interaction.rewards.load()).sections.flatMap(
      (section) => section.items,
    );
    // The settled reward is current until one is pinned; there is no Auto entry.
    expect(rewards.some((item) => /^Auto/.test(item.label))).toBe(false);
    expect(rewards.filter((item) => item.selected)).toHaveLength(1);
    expect(rewards.find((item) => item.selected)!.label).toBe(roomPinned.control.reward.summary);
    const boon = rewards.find((item) => item.value === 'Boon');
    expect(boon).toMatchObject({ state: 'possible', disabled: false });
    project = applyProjectCommand(
      project,
      catalog,
      roomPinned.interaction.rewardIntent('Boon').command,
    );

    const bothPinned = hiddenDoor(projectStructuredWorkspaceFixture(project), combat05);
    expect(bothPinned.control.reward).toEqual({ summary: 'Boon' });
    // A room whose store offers the pinned reward keeps it; reset clears both.
    expect(bothPinned.interaction.roomIntent('N_Combat01').command.value).toEqual({
      placeholderRoomGameName: 'N_Combat01',
      rewardType: 'Boon',
    });
    expect(bothPinned.interaction.roomIntent('N_PreBoss01').command.value).toEqual({
      placeholderRoomGameName: 'N_PreBoss01',
      rewardType: null,
    });
    const reset = bothPinned.interaction.resetIntent().command;
    expect(reset.value).toEqual({ placeholderRoomGameName: null, rewardType: null });
    project = applyProjectCommand(project, catalog, reset);
    expect(hiddenDoor(projectStructuredWorkspaceFixture(project), combat05).control).toMatchObject({
      pinned: false,
      summary: 'Preboss · no reward',
      reward: { locked: 'noDraw' },
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

  it('offers an earlier hidden door as the repair for a reward it drew from the pool', () => {
    const unavailableAt = (project: ProjectDocument, occurrenceId: OccurrenceId) => {
      const finding = projectStructuredWorkspaceFixture(project).evaluation.findings.find(
        (candidate) =>
          candidate.code === 'rewardBagEntryUnavailable' &&
          semanticAddressKey(candidate.origin) ===
            semanticAddressKey(createIncomingRewardAddress(nBiome, occurrenceId)),
      );
      if (finding === undefined) throw new Error(`missing pool finding at ${occurrenceId}`);
      return presentFinding(finding);
    };
    // combat05's side exit takes the side-room pool's only AirBoost before combat02's side door.
    const drawn = pin(loadSurfaceNOPQProject(), nLocalOccurrenceId('combat05', 'sideDoor2'), {
      placeholderRoomGameName: 'N_Sub01',
      rewardType: 'AirBoost',
    });
    expect(unavailableAt(drawn, nLocalOccurrenceId('combat02', 'sideDoor2'))).toEqual({
      title: 'Reward unavailable from pool',
      description: 'Or choose a different reward for an earlier hidden return door.',
    });

    const authored = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat05', 'sideDoor2')),
      value: { rewardType: 'MaxManaDropSmall' },
    });
    expect(unavailableAt(authored, nLocalOccurrenceId('combat05', 'sideDoor2'))).toEqual({
      title: 'Reward unavailable from pool',
    });
  });
});

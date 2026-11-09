import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  roomObjectAnchorSlotsForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import type { WorkspaceMarker } from '@planner/projections/structured-workspace';
import { assembleRoomObjectSlots } from '@planner/projections/structured-workspace/assembly/room-object-slots-assembly';
import { bindRoomObjectInteractions } from '@planner/projections/structured-workspace/interactions/room-object-interactions';

const oneSpot = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'H'),
  createOccurrenceId('golden-h-combat05'),
);
const postboss = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('golden-f-preboss-shop:postboss'),
);

const marker = (address: Parameters<typeof semanticAddressKey>[0]) =>
  ({ focusKey: semanticAddressKey(address) }) as unknown as WorkspaceMarker;

function spotsOf(
  project: ProjectDocument,
  owner = oneSpot,
  switchKind?: 'time' | 'perfectClear' | 'elite',
) {
  const assembled = assembleRoomObjectSlots({
    address: owner,
    product: roomObjectAnchorSlotsForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, project),
      owner,
    ),
    switchKind,
    marker,
  });
  if (assembled === undefined) throw new Error('expected anchor spots');
  const interaction = bindRoomObjectInteractions([assembled.requirement]).roomChoices.get(
    assembled.objectSlots.interactionKey,
  )!;
  const commandsOf = (key: string): readonly ProjectCommand[] =>
    interaction.intentFor(key).commands;
  return { ...assembled.objectSlots, commandsOf };
}

const objectOf = (slots: ReturnType<typeof spotsOf>, kind: string) =>
  slots.objects.find((object) => object.object === kind)!;

describe('room objects', () => {
  it('adds an absent object with its own command and keeps a refused one locked', () => {
    const slots = spotsOf(loadUnderworldFGHICheckpoint());
    expect(slots.anchors).toEqual([expect.objectContaining({ number: 1 })]);
    const well = objectOf(slots, 'stygianWell');
    expect(well).toMatchObject({ present: false, fixed: false });
    expect(well.anchor).toBeUndefined();
    expect(slots.commandsOf(well.toggleKey!)).toEqual([
      { kind: 'AddStygianWell', occurrence: oneSpot },
    ]);
    // The switch adds as its first observable type.
    const switchObject = objectOf(slots, 'challengeSwitch');
    expect(slots.commandsOf(switchObject.toggleKey!)).toEqual([
      {
        kind: 'ReplaceChallengeSwitch',
        occurrence: oneSpot,
        variantKey: 'TimeChallengeSwitch_Money',
      },
    ]);
  });

  it('stands a lone unplaced object on its default anchor, then removes it', () => {
    const project = applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
      kind: 'AddStygianWell',
      occurrence: oneSpot,
    });
    const slots = spotsOf(project);
    const [anchor] = slots.anchors;
    const well = objectOf(slots, 'stygianWell');
    expect(well.anchor).toMatchObject({
      defaultAnchorId: anchor!.anchorId,
      choices: [{ anchorId: anchor!.anchorId }],
    });
    expect(anchor).toMatchObject({ occupant: { object: 'stygianWell' }, default: true });
    expect(slots.commandsOf(well.toggleKey!)).toEqual([
      { kind: 'RemoveStygianWell', occurrence: oneSpot },
    ]);
  });

  it('does not offer an anchor another object holds, and returns its own to its default', () => {
    let project = applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
      kind: 'AddStygianWell',
      occurrence: oneSpot,
    });
    const anchorId = spotsOf(project).anchors[0]!.anchorId;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRoomObjectAnchor',
      occurrence: oneSpot,
      object: 'stygianWell',
      anchorId,
    });
    const slots = spotsOf(project);
    expect(slots.anchors[0]?.occupant).toEqual({ object: 'stygianWell' });
    const well = objectOf(slots, 'stygianWell');
    expect(well.anchor).toMatchObject({ anchorId, choices: [{ anchorId: null }] });
    // The only anchor is the Well's: the switch has nowhere to go.
    expect(objectOf(slots, 'challengeSwitch')).toMatchObject({
      present: false,
      lock: { reason: 'refused' },
    });
  });

  it("changes a present switch's type in place", () => {
    const project = applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
      kind: 'ReplaceChallengeSwitch',
      occurrence: oneSpot,
      variantKey: 'TimeChallengeSwitch_Money',
    });
    const switchObject = objectOf(spotsOf(project, oneSpot, 'time'), 'challengeSwitch');
    expect(switchObject).toMatchObject({ present: true, switchKind: 'time' });
    // The observed kind removes it; another observable kind takes its place; a locked one says why.
    expect(switchObject.switchKinds).toMatchObject([
      { switchKind: 'time', toggleKey: switchObject.toggleKey },
      { switchKind: 'perfectClear', toggleKey: 'kind:perfectClear' },
      { switchKind: 'elite', lock: { reason: 'refused' } },
    ]);
  });

  it('pins the Well and stands the Pool on the anchor it leaves', () => {
    const slots = spotsOf(createGoldenFGHIProject(), postboss);
    const well = objectOf(slots, 'stygianWell');
    const pool = objectOf(slots, 'purgingPool');
    expect(well).toMatchObject({ present: true, fixed: true });
    expect(well.anchor).toMatchObject({ choices: [] });
    expect(well.anchor?.pinned).toBeDefined();
    const free = slots.anchors.find((anchor) => anchor.anchorId !== well.anchor?.pinned);
    expect(pool.anchor).toMatchObject({
      defaultAnchorId: free!.anchorId,
      choices: [{ anchorId: free!.anchorId }],
    });
    expect(free).toMatchObject({ occupant: { object: 'purgingPool' }, default: true });
  });
});

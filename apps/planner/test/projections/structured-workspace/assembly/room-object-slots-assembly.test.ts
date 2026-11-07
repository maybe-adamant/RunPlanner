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
import {
  roomObjectAnchorSlotsForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { assembleRoomObjectSlots } from '@planner/projections/structured-workspace/assembly/room-object-slots-assembly';
import { bindRoomObjectInteractions } from '@planner/projections/structured-workspace/interactions/room-object-interactions';

const owner = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'H'),
  createOccurrenceId('golden-h-combat05'),
);

function slotsOf(project: ProjectDocument, switchKind?: 'time' | 'perfectClear' | 'elite') {
  const assembled = assembleRoomObjectSlots({
    address: owner,
    product: roomObjectAnchorSlotsForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, project),
      owner,
    ),
    switchKind,
  });
  if (assembled === undefined) throw new Error('expected anchor slots');
  const interaction = bindRoomObjectInteractions([assembled.requirement]).roomObjectSlots.get(
    assembled.objectSlots.interactionKey,
  )!;
  return { ...assembled.objectSlots, interaction };
}

const held = (choice: { readonly object: string | null; readonly switchKind?: string }) =>
  choice.switchKind === undefined ? choice.object : `${choice.object}:${choice.switchKind}`;

describe('room object slots', () => {
  it('offers an empty spot the Well and each observable switch type', () => {
    const slots = slotsOf(loadUnderworldFGHICheckpoint());
    const [spot] = slots.slots;
    expect(spot?.choices.map(held)).toEqual([
      'stygianWell',
      'challengeSwitch:time',
      'challengeSwitch:perfectClear',
    ]);
    // A type the room cannot roll is listed with its rule.
    expect(spot?.unavailable).toEqual([
      expect.objectContaining({
        object: 'challengeSwitch',
        switchKind: 'elite',
        lock: expect.objectContaining({ reason: 'refused' }),
      }),
    ]);
    const time = spot!.choices.find((choice) => choice.switchKind === 'time')!;
    expect(slots.interaction.intentFor(time.key).commands).toEqual([
      {
        kind: 'ReplaceChallengeSwitch',
        occurrence: owner,
        variantKey: 'TimeChallengeSwitch_Money',
      },
    ]);
  });

  it('replaces the Well with the switch the engine offers, removing it first', () => {
    const project = applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
      kind: 'AddStygianWell',
      occurrence: owner,
    });
    const slots = slotsOf(project);
    const [spot] = slots.slots;
    expect(spot?.occupant).toMatchObject({ object: 'stygianWell', fixed: false });
    expect(spot?.choices.map(held)).toEqual([null, 'challengeSwitch:time']);
    const replace = spot!.choices.find((choice) => choice.object === 'challengeSwitch')!;
    expect(
      slots.interaction
        .intentFor(replace.key)
        .commands.map((command: ProjectCommand) => command.kind),
    ).toEqual(['RemoveStygianWell', 'ReplaceChallengeSwitch']);
  });

  it("changes a present switch's type in place", () => {
    const project = applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
      kind: 'ReplaceChallengeSwitch',
      occurrence: owner,
      variantKey: 'TimeChallengeSwitch_Money',
    });
    const [spot] = slotsOf(project, 'time').slots;
    expect(spot?.occupant).toMatchObject({ object: 'challengeSwitch', switchKind: 'time' });
    expect(spot?.choices.map(held)).toEqual([null, 'stygianWell', 'challengeSwitch:perfectClear']);
  });
});

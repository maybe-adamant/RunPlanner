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

const held = (choice: {
  readonly action: string;
  readonly object: string;
  readonly switchKind?: string;
}) =>
  [
    choice.action,
    choice.object,
    ...(choice.switchKind === undefined ? [] : [choice.switchKind]),
  ].join(':');

describe('room object spots', () => {
  it('places an absent object on the chosen physical anchor', () => {
    const spots = spotsOf(loadUnderworldFGHICheckpoint());
    const [spot] = spots.spots;
    expect(spot).toMatchObject({ number: 1, pinned: false });
    expect(spot?.choices.map(held)).toEqual([
      'place:stygianWell',
      'place:challengeSwitch:time',
      'place:challengeSwitch:perfectClear',
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
    expect(spots.commandsOf(time.key)).toEqual([
      {
        kind: 'ReplaceChallengeSwitch',
        occurrence: oneSpot,
        variantKey: 'TimeChallengeSwitch_Money',
      },
      {
        kind: 'ReplaceRoomObjectAnchor',
        occurrence: oneSpot,
        object: 'challengeSwitch',
        anchorId: spot!.anchorId,
      },
    ]);
  });

  it('lists an object the game places after the spots, moving it onto one or removing it', () => {
    const project = applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
      kind: 'AddStygianWell',
      occurrence: oneSpot,
    });
    const spots = spotsOf(project);
    const [spot] = spots.spots;
    expect(spot?.occupant).toBeUndefined();
    expect(spot?.choices.map(held)).toEqual(['move:stygianWell']);
    const [well] = spots.unplaced;
    expect(well).toMatchObject({ object: 'stygianWell', fixed: false });
    expect(well?.choices.map(held)).toEqual(['move:stygianWell', 'remove:stygianWell']);
    expect(spots.commandsOf(well!.choices[0]!.key)).toEqual([
      {
        kind: 'ReplaceRoomObjectAnchor',
        occurrence: oneSpot,
        object: 'stygianWell',
        anchorId: spot!.anchorId,
      },
    ]);
  });

  it('replaces, returns to the game or removes the object standing on a spot', () => {
    let project = applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
      kind: 'AddStygianWell',
      occurrence: oneSpot,
    });
    const anchorId = spotsOf(project).spots[0]!.anchorId;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRoomObjectAnchor',
      occurrence: oneSpot,
      object: 'stygianWell',
      anchorId,
    });
    const spots = spotsOf(project);
    const [spot] = spots.spots;
    expect(spot?.occupant?.object).toBe('stygianWell');
    expect(spots.unplaced).toEqual([]);
    expect(spot?.choices.map(held)).toEqual([
      'replace:challengeSwitch:time',
      'replace:challengeSwitch:perfectClear',
      'native:stygianWell',
      'remove:stygianWell',
    ]);
    const replace = spot!.choices.find((choice) => choice.switchKind === 'time')!;
    expect(spots.commandsOf(replace.key).map((command) => command.kind)).toEqual([
      'RemoveStygianWell',
      'ReplaceChallengeSwitch',
      'ReplaceRoomObjectAnchor',
    ]);
  });

  it("changes a standing switch's type in place", () => {
    let project = applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
      kind: 'ReplaceChallengeSwitch',
      occurrence: oneSpot,
      variantKey: 'TimeChallengeSwitch_Money',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRoomObjectAnchor',
      occurrence: oneSpot,
      object: 'challengeSwitch',
      anchorId: spotsOf(project).spots[0]!.anchorId,
    });
    const [spot] = spotsOf(project, oneSpot, 'time').spots;
    expect(spot?.occupant).toMatchObject({ object: 'challengeSwitch', switchKind: 'time' });
    expect(spot?.choices.map(held)).toEqual(
      expect.arrayContaining(['retype:challengeSwitch:perfectClear', 'replace:stygianWell']),
    );
  });

  it('keeps the pinned spot for the Well and offers the others to the Pool', () => {
    const spots = spotsOf(createGoldenFGHIProject(), postboss);
    const pinned = spots.spots.find((spot) => spot.pinned)!;
    const free = spots.spots.find((spot) => !spot.pinned)!;
    expect(pinned.occupant).toMatchObject({ object: 'stygianWell', fixed: true });
    expect(pinned.choices).toEqual([]);
    expect(spots.unplaced.map((occupant) => occupant.object)).toEqual(['purgingPool']);
    expect(spots.unplaced[0]!.choices.map((choice) => choice.anchorId)).toEqual([free.anchorId]);
    expect(free.choices.map(held)).toEqual(['move:purgingPool']);
  });
});

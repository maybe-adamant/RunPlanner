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
  roomLayoutAuthoringForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import type { WorkspaceMarker } from '@planner/projections/structured-workspace';
import { assembleRoomLayout } from '@planner/projections/structured-workspace/assembly/room-layout-assembly';
import { bindRoomObjectInteractions } from '@planner/projections/structured-workspace/interactions/room-object-interactions';

const fBiome = createBiomeAddress('Underworld', 'F');
// Its flip rolls, and the entry the previous door allows decides which way.
const rolled = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-b7-e1'));
// The previous door decides both its flip and entry.
const doorDecided = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-b1-e1'));
// Entered only on an unreached branch.
const unreached = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-b2-e2'));

const marker = (address: Parameters<typeof semanticAddressKey>[0]) =>
  ({ focusKey: semanticAddressKey(address) }) as unknown as WorkspaceMarker;

function layoutOf(project: ProjectDocument, address = rolled) {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === address.biomeKey)!
    .topology!.occurrences.find((candidate) => candidate.occurrenceId === address.occurrenceId)!;
  const assembled = assembleRoomLayout({
    address,
    room: catalog.rooms.byKey[occurrence.gameName]!,
    occurrence,
    authoring: roomLayoutAuthoringForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, project),
      address,
    ),
    marker,
  });
  if (assembled === undefined) throw new Error('expected a room layout');
  const interaction = bindRoomObjectInteractions([assembled.requirement]).roomChoices.get(
    assembled.layout.interactionKey,
  )!;
  const commandOf = (key: string): ProjectCommand => interaction.intentFor(key).commands[0]!;
  return { ...assembled.layout, commandOf };
}

describe('room layout', () => {
  it('numbers the entries by ascending HeroStart id', () => {
    const layout = layoutOf(createGoldenFGHIProject());
    const ids = layout.entries.map((entry) => entry.pointId);
    expect(ids).toEqual([...ids].sort((left, right) => left - right));
    expect(layout.entries.map((entry) => entry.number)).toEqual(ids.map((_, index) => index + 1));
  });

  it('offers a rolled flip and each eligible entry with the flip it needs', () => {
    const layout = layoutOf(createGoldenFGHIProject());
    expect(layout.flip.state).toMatchObject({
      kind: 'choice',
      choices: [{ value: false }, { value: true }],
    });
    if (layout.entry.state.kind !== 'choice') throw new Error('expected an entry choice');
    const choices = layout.entry.state.choices;
    expect(choices.map((choice) => choice.flipped)).toEqual([true, false]);
    // Choosing an entry authors the flip it needs with it.
    const flipping = choices.find((choice) => choice.flipped === true)!;
    expect(layout.commandOf(flipping.key)).toEqual({
      kind: 'ReplaceRoomLayout',
      occurrence: rolled,
      layout: { flipped: true, entryStartPointId: flipping.value },
    });
  });

  it('settles the chosen entry and returns it to the game keeping the flip', () => {
    const first = layoutOf(createGoldenFGHIProject());
    if (first.entry.state.kind !== 'choice') throw new Error('expected an entry choice');
    const flipping = first.entry.state.choices.find((choice) => choice.flipped === true)!;
    const project = applyProjectCommand(
      createGoldenFGHIProject(),
      catalog,
      first.commandOf(flipping.key),
    );
    const layout = layoutOf(project);
    expect(layout.flip.state).toMatchObject({ kind: 'choice', value: true });
    if (layout.entry.state.kind !== 'choice') throw new Error('expected an entry choice');
    expect(layout.entry.state.value).toBe(flipping.value);
    const game = layout.entry.state.choices.find((choice) => choice.value === null)!;
    expect(layout.commandOf(game.key)).toEqual({
      kind: 'ReplaceRoomLayout',
      occurrence: rolled,
      layout: { flipped: true },
    });
  });

  it('shows a door-decided flip and entry with nothing to choose', () => {
    const layout = layoutOf(createGoldenFGHIProject(), doorDecided);
    expect(layout.flip.state).toEqual({ kind: 'derived', value: true });
    expect(layout.entry.state).toMatchObject({ kind: 'derived' });
  });

  it('keeps a flip the door decides as a stale value its choice clears', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceRoomLayout',
      occurrence: doorDecided,
      layout: { flipped: false },
    });
    const layout = layoutOf(project, doorDecided);
    if (layout.flip.state.kind !== 'derived') throw new Error('expected a derived flip');
    expect(layout.flip.state.stale?.value).toBe(false);
    expect(layout.commandOf(layout.flip.state.stale!.clearKey)).toEqual({
      kind: 'ReplaceRoomLayout',
      occurrence: doorDecided,
      layout: {},
    });
  });

  it('waits while the room is unreached', () => {
    const layout = layoutOf(createGoldenFGHIProject(), unreached);
    expect(layout.flip.state).toEqual({ kind: 'unreached' });
    expect(layout.entry.state).toEqual({ kind: 'unreached' });
  });
});

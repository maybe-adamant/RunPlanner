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

// Its entries each allow either flip of the roll.
const independent = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-b4-e1'));

function choicesOf(layout: ReturnType<typeof layoutOf>) {
  if (layout.state.kind !== 'choice') throw new Error('expected an entry choice');
  return layout.state.choices;
}

describe('room entry', () => {
  it('numbers the entries by ascending HeroStart id', () => {
    const layout = layoutOf(createGoldenFGHIProject());
    const ids = layout.entries.map((entry) => entry.pointId);
    expect(ids).toEqual([...ids].sort((left, right) => left - right));
    expect(layout.entries.map((entry) => entry.number)).toEqual(ids.map((_, index) => index + 1));
  });

  it('offers each entry of a rolled flip once, with the flip it needs', () => {
    const layout = layoutOf(createGoldenFGHIProject());
    const pairs = choicesOf(layout).map((choice) => choice.pair);
    expect(pairs.map((pair) => pair?.flipped)).toEqual([true, false]);
    expect(layout.state).not.toHaveProperty('value');
    // The game still picks between the two entries.
    expect(layout.entryId).toBeUndefined();
    expect(layout.eligible).toHaveLength(2);
    const flipping = choicesOf(layout).find((choice) => choice.pair?.flipped === true)!;
    expect(layout.commandOf(flipping.key)).toEqual({
      kind: 'ReplaceRoomLayout',
      occurrence: rolled,
      layout: { flipped: true, entryStartPointId: flipping.pair!.pointId },
    });
  });

  it('offers both flips of an entry either flip allows', () => {
    const layout = layoutOf(createGoldenFGHIProject(), independent);
    const pairs = choicesOf(layout).map((choice) => choice.pair!);
    expect(pairs).toHaveLength(4);
    const [first] = layout.eligible;
    expect(pairs.filter((pair) => pair.pointId === first).map((pair) => pair.flipped)).toEqual([
      false,
      true,
    ]);
    const unflipped = choicesOf(layout).find(
      (choice) => choice.pair?.pointId === first && choice.pair?.flipped === false,
    )!;
    expect(layout.commandOf(unflipped.key)).toEqual({
      kind: 'ReplaceRoomLayout',
      occurrence: independent,
      layout: { flipped: false, entryStartPointId: first },
    });
  });

  it('settles a chosen pair and returns the entry and flip to the game together', () => {
    const first = layoutOf(createGoldenFGHIProject());
    const flipping = choicesOf(first).find((choice) => choice.pair?.flipped === true)!;
    const project = applyProjectCommand(
      createGoldenFGHIProject(),
      catalog,
      first.commandOf(flipping.key),
    );
    const layout = layoutOf(project);
    expect(layout.state).toMatchObject({ kind: 'choice', value: flipping.pair });
    expect(layout).toMatchObject({ entryId: flipping.pair!.pointId, flipped: true });
    const game = choicesOf(layout).find((choice) => choice.pair === null)!;
    expect(layout.commandOf(game.key)).toEqual({
      kind: 'ReplaceRoomLayout',
      occurrence: rolled,
      layout: {},
    });
  });

  it('shows a door-decided entry and flip as one settled pair', () => {
    const layout = layoutOf(createGoldenFGHIProject(), doorDecided);
    expect(layout.state).toMatchObject({ kind: 'settled', by: 'door', value: { flipped: true } });
    expect(layout.flipped).toBe(true);
  });

  it('keeps a flip the door decides as a stale value its choice clears', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceRoomLayout',
      occurrence: doorDecided,
      layout: { flipped: false },
    });
    const layout = layoutOf(project, doorDecided);
    if (layout.state.kind !== 'settled') throw new Error('expected a settled entry');
    expect(layout.commandOf(layout.state.stale!.clearKey)).toEqual({
      kind: 'ReplaceRoomLayout',
      occurrence: doorDecided,
      layout: {},
    });
  });

  it('waits while the room is unreached', () => {
    const layout = layoutOf(createGoldenFGHIProject(), unreached);
    expect(layout.state).toEqual({ kind: 'unreached' });
  });
});

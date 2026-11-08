// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBiomeAddress,
  createFieldsSpatialAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import {
  roomObjectAnchorSlotsForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { loadNemesisFieldsCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import type { PlannerApplication } from '@planner/composition/createApplication';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { renderWorkspace } from '@planner-test/support/biome-workbench';

afterEach(() => cleanup());

const fBiome = createBiomeAddress('Underworld', 'F');
const hBiome = createBiomeAddress('Underworld', 'H');

const apply = (project: ProjectDocument, ...commands: readonly ProjectCommand[]) =>
  commands.reduce((current, command) => applyProjectCommand(current, catalog, command), project);

function focusRoom(
  application: PlannerApplication,
  address: ReturnType<typeof createOccurrenceAddress>,
) {
  act(() => {
    application.store.dispatch(semanticOwnerFocused(address));
  });
}

const map = () =>
  screen
    .getAllByRole('region')
    .find((region) => region.getAttribute('aria-label')?.endsWith(' map'))!;
const points = (label: string) =>
  within(map())
    .getAllByRole('img')
    .filter((point) => point.getAttribute('aria-label') === label);
const previewed = () =>
  within(map())
    .getAllByRole('img')
    .filter((point) => point.hasAttribute('data-preview'));
const strip = () => within(map()).getByRole('list', { name: 'Not placed' });
const stripChip = (label: string) => within(strip()).getByRole('listitem', { name: `${label} ?` });

describe('room map items the game places', () => {
  // F_Combat17 has three Chaos points; the gate is left to the game.
  const chaosRoom = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-b4-e1'));
  const chaosProject = () =>
    apply(
      createGoldenFGHIProject(),
      { kind: 'ReplaceOccurrenceRoom', occurrence: chaosRoom, gameName: 'F_Combat17' },
      {
        kind: 'AddChaos',
        additional: createAdditionalExitAddress(fBiome, chaosRoom.occurrenceId, 'chaos'),
        occurrenceId: createOccurrenceId('unplaced-chaos'),
      },
    );

  it('lists an unplaced Chaos gate under the map and rings every point it can take from each of its controls', async () => {
    const { application, user } = renderWorkspace(chaosProject(), 'Underworld', 'F');
    focusRoom(application, chaosRoom);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));

    const candidates = points('Chaos gate position ?');
    expect(candidates).toHaveLength(3);
    expect(previewed()).toEqual([]);

    const chip = stripChip('Chaos Gate');
    fireEvent.pointerEnter(chip);
    expect(previewed()).toEqual(candidates);
    fireEvent.pointerLeave(chip);
    expect(previewed()).toEqual([]);

    const row = screen.getByText('Chaos Gate', { selector: '.room-layout-label' }).parentElement!;
    fireEvent.pointerEnter(row);
    expect(previewed()).toEqual(candidates);
    fireEvent.pointerLeave(row);

    // Pointing at any of them marks the gate's controls.
    fireEvent.pointerEnter(candidates[1]!);
    expect(chip.hasAttribute('data-map-pointed')).toBe(true);
    expect(row.hasAttribute('data-map-pointed')).toBe(true);
    fireEvent.pointerLeave(candidates[1]!);
    expect(chip.hasAttribute('data-map-pointed')).toBe(false);
  });

  it('rings every Chaos candidate from the Leave room picker’s Chaos option', async () => {
    const { application, user } = renderWorkspace(chaosProject(), 'Underworld', 'F');
    focusRoom(application, chaosRoom);
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    expect(stripChip('Chaos Gate')).toBeTruthy();

    const leave = screen.getAllByRole('listitem', { name: 'Leave room' }).at(-1)!;
    await user.click(within(leave).getByRole('button', { name: 'Exit door' }));
    await user.hover(
      within(await screen.findByRole('listbox')).getByRole('option', { name: 'Chaos gate' }),
    );
    expect(previewed()).toEqual(points('Chaos gate position ?'));
  });

  it('lists unplaced Fields slots, each ringing only the free points of its own family', async () => {
    const project = loadNemesisFieldsCheckpoint();
    const room = createOccurrenceAddress(hBiome, createOccurrenceId('golden-h-combat05'));
    const occurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === room.occurrenceId)!;
    if (occurrence.state?.kind !== 'fieldsCombat') throw new Error('expected a Fields room');
    const cageSlot = Object.keys(occurrence.state.spatial.cagePointIdBySlot)[0]!;
    const optionalSlot = Object.keys(occurrence.state.spatial.optionalPointIdBySlot)[0]!;
    const unplaced = apply(
      project,
      {
        kind: 'ReplaceFieldsSpatialPoint',
        spatial: createFieldsSpatialAddress(room, { kind: 'cage', slotKey: cageSlot }),
        pointId: null,
      },
      {
        kind: 'ReplaceFieldsSpatialPoint',
        spatial: createFieldsSpatialAddress(room, { kind: 'optional', slotKey: optionalSlot }),
        pointId: null,
      },
    );
    const { application, user } = renderWorkspace(unplaced, 'Underworld', 'H');
    focusRoom(application, room);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));

    const chips = within(strip()).getAllByRole('listitem');
    expect(chips.map((chip) => chip.dataset.kind)).toEqual(['cage', 'pickup']);
    const cages = points('Fields cage point ?');
    const pickups = points('Fields pickup point ?');
    expect(cages.length).toBeGreaterThan(0);
    expect(pickups.length).toBeGreaterThan(0);

    fireEvent.pointerEnter(chips[0]!);
    expect(previewed()).toEqual(cages);
    fireEvent.pointerLeave(chips[0]!);
    fireEvent.pointerEnter(chips[1]!);
    expect(previewed()).toEqual(pickups);
    fireEvent.pointerLeave(chips[1]!);

    // A free pickup point marks the slot that may take it, not the cage.
    fireEvent.pointerEnter(pickups[0]!);
    expect(chips.map((chip) => chip.hasAttribute('data-map-pointed'))).toEqual([false, true]);
    fireEvent.pointerLeave(pickups[0]!);
  });

  it('lists an object left to the game and rings the free anchors it can take', async () => {
    const room = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-b5-e1'));
    const base = createGoldenFGHIProject();
    const place = roomObjectAnchorSlotsForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, base),
      room,
    )?.objects.find((object) => object.kind === 'challengeSwitch')?.place;
    if (place === undefined) throw new Error('golden-f-b5-e1 cannot hold a switch');
    const { application, user } = renderWorkspace(apply(base, place), 'Underworld', 'F');
    focusRoom(application, room);
    await user.click(screen.getByRole('tab', { name: 'Room Overview' }));

    const [chip, ...others] = within(strip()).getAllByRole('listitem');
    expect(others).toEqual([]);
    expect(chip!.dataset.kind).toBe('anchor');
    const candidates = points('Object spot ?');
    expect(candidates.length).toBeGreaterThan(1);
    fireEvent.pointerEnter(chip!);
    expect(previewed()).toEqual(candidates);
  });
});

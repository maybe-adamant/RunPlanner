// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';
import { hintOf } from '@planner-test/support/hints';

afterEach(cleanup);

const waitingTitle = 'Waits on an earlier choice.';

/** An impossible encounter early in the biome leaves later settings unevaluated. */
function withInvalidEncounter(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  occurrenceId: string,
  encounterKey: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'SelectEncounter',
    phase: createEncounterPhaseAddress(
      createBiomeAddress(routeKey, biomeKey),
      { kind: 'occurrence', occurrenceId: createOccurrenceId(occurrenceId) },
      'Encounter',
    ),
    encounterKey,
  });
}

describe('native settings whose candidate context is unreached, on first render', () => {
  it('disables the ship phase count with the waiting title and keeps its value', () => {
    const shipCount = (project: ProjectDocument) => {
      renderOccurrenceWorkbench(
        project,
        'Surface',
        'O',
        occurrenceById(createOccurrenceId('surface-o-combat04')),
      );
      const select = document.getElementById(
        'room-surface-o-combat04-combat-phase-count',
      ) as HTMLSelectElement;
      return select;
    };
    const reached = shipCount(loadSurfaceNOPQProject());
    const value = reached.value;
    expect(reached.disabled).toBe(false);
    cleanup();
    const waiting = shipCount(
      withInvalidEncounter(
        loadSurfaceNOPQProject(),
        'Surface',
        'N',
        'surface-n-combat05',
        'ArtemisCombatN',
      ),
    );
    expect(waiting.disabled).toBe(true);
    expect(hintOf(waiting)).toBe(waitingTitle);
    expect(waiting.value).toBe(value);
  });

  it('disables side-room generation with the waiting title while the Hub is unevaluated', () => {
    const generation = (project: ProjectDocument) => {
      renderOccurrenceWorkbench(
        project,
        'Surface',
        'N',
        occurrenceById(createOccurrenceId('surface-n-combat02')),
      );
      openRoomTab('Side Rooms');
      return screen.getAllByRole('checkbox', { name: /generation$/ })[0] as HTMLInputElement;
    };
    const reached = generation(loadSurfaceNOPQProject());
    const checked = reached.checked;
    expect(reached.disabled).toBe(false);
    cleanup();
    const waiting = generation(
      withInvalidEncounter(
        loadSurfaceNOPQProject(),
        'Surface',
        'N',
        'surface-n-combat05',
        'ArtemisCombatN',
      ),
    );
    expect(waiting.disabled).toBe(true);
    expect(hintOf(waiting)).toBe(waitingTitle);
    expect(waiting.checked).toBe(checked);
  });

  it('disables Fields positions with the waiting title and keeps the chosen point', () => {
    const positions = (project: ProjectDocument) => {
      renderOccurrenceWorkbench(
        project,
        'Underworld',
        'H',
        occurrenceById(createOccurrenceId('golden-h-combat02')),
      );
      openRoomTab('Room Layout');
      return screen.getAllByRole('radiogroup', { name: /position$/ })[0]!;
    };
    const reached = positions(createGoldenFGHIProject());
    const radios = () => [...reached.querySelectorAll('input')] as HTMLInputElement[];
    const chosen = radios().findIndex((radio) => radio.checked);
    expect(radios().some((radio) => !radio.disabled)).toBe(true);
    cleanup();
    const waiting = positions(
      withInvalidEncounter(
        createGoldenFGHIProject(),
        goldenFBiome.routeKey,
        goldenFBiome.biomeKey,
        goldenFOccurrenceId(1, 1),
        'ArtemisCombatF',
      ),
    );
    const waitingRadios = () => [...waiting.querySelectorAll('input')] as HTMLInputElement[];
    expect(waitingRadios().every((radio) => radio.disabled)).toBe(true);
    expect(waitingRadios().every((radio) => hintOf(radio) === waitingTitle)).toBe(true);
    expect(waitingRadios().findIndex((radio) => radio.checked)).toBe(chosen);
  });

  it('keeps a reward wheel reached at its own frontier and withholds one past the stop', () => {
    const occurrenceId = createOccurrenceId('surface-o-combat04');
    const frontier = (() => {
      const raw = JSON.parse(encodeProjectDocument(loadSurfaceNOPQProject()));
      raw.route.biomes
        .find((biome: { biomeKey: string }) => biome.biomeKey === 'O')
        .topology.occurrences.find(
          (occurrence: { occurrenceId: string }) => occurrence.occurrenceId === occurrenceId,
        ).state.wheels.wheel1.offers.offer1 = null;
      return decodeProjectDocument(raw, catalog);
    })();
    renderOccurrenceWorkbench(frontier, 'Surface', 'O', occurrenceById(occurrenceId));
    openRoomTab('Intro Timeline');
    const count = screen.getByRole('radiogroup', { name: 'Offers' });
    expect(
      within(count)
        .getAllByRole('radio')
        .every((radio) => !(radio as HTMLInputElement).disabled),
    ).toBe(true);
    const upstream = withInvalidEncounter(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      'surface-n-combat05',
      'ArtemisCombatN',
    );
    expect(
      projectStructuredWorkspaceFixture(upstream).workspace.interactions.rewardWheelOfferCounts.get(
        semanticAddressKey({
          kind: 'rewardWheel',
          routeKey: 'Surface',
          biomeKey: 'O',
          occurrenceId,
          wheelKey: 'wheel1',
        }),
      )?.contextReached,
    ).toBe(false);
  });

  it('keeps Hub slots authorable while a later Hub visit is the stop, since they are structural', () => {
    const project = withInvalidEncounter(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      'surface-n-combat05',
      'ArtemisCombatN',
    );
    const slots = [
      ...projectStructuredWorkspaceFixture(project).workspace.interactions.hubSlots.values(),
    ];
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => slot.contextReached)).toBe(true);
  });
});

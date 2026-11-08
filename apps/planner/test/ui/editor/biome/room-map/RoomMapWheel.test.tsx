// @vitest-environment jsdom

import { act, cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { loadSurfaceNOCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { roomMapPosition } from '@planner/projections/roomMapMarkers';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { roomMapCalibrations } from '@planner/ui/room-maps/roomMapCalibration';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';
import { renderWorkspace } from '@planner-test/support/biome-workbench';

afterEach(() => cleanup());

const o = createBiomeAddress('Surface', 'O');
const shipId = createOccurrenceId('surface-o-combat04');
const ship = createOccurrenceAddress(o, shipId);
const wheel = createRewardWheelAddress(o, shipId, 'wheel1');

/** A door-reroll card holder whose N Boss Judgment is drawn, so the run reaches O. */
function cardHolder(): ProjectDocument {
  let project = applyProjectCommand(loadSurfaceNOCheckpoint(), catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: 'Surface' },
    arcanaKeys: ['DoorReroll'],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: {
      kind: 'judgmentArcana',
      routeKey: 'Surface',
      biomeKey: 'N',
      occurrenceId: createOccurrenceId('surface-n-preboss:boss'),
      phaseKey: 'Encounter',
    },
    arcanaKeys: ['ScreenReroll', 'TradeOff', 'StartingGold', 'HealthRegen', 'BonusDodge'],
  });
  return project;
}

function shipRoom(project: ProjectDocument) {
  const projected = projectStructuredWorkspaceFixture(project);
  const node = requireWorkspaceBiome(projected.workspace, 'O').nodes.find(
    (candidate) =>
      candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === shipId,
  );
  if (node?.kind !== 'occurrenceWorkbench' || node.room.workbench.kind !== 'ship')
    throw new Error('the ship room is not projected');
  return { projected, room: node.room, phases: node.room.workbench.phases };
}

/** The ship's wheel point and its two offer spots, as the map places them. */
function wheelSpots(gameName: string) {
  const points = catalog.rooms.byKey[gameName]!.mapPoints!.shipWheel!;
  const calibration = roomMapCalibrations[gameName]!;
  const style = (point: { readonly x: number; readonly y: number }) => {
    const { left, top } = roomMapPosition(point, calibration);
    return { left: `${left}%`, top: `${top}%` };
  };
  return {
    wheel: style(points),
    left: style(points.leftOffer),
    right: style(points.rightOffer),
  };
}

function mapPoints(): HTMLElement[] {
  const map = screen
    .getAllByRole('region')
    .find((region) => region.getAttribute('aria-label')?.endsWith(' map'))!;
  return within(map).getAllByRole('img');
}

const wheelOffers = () => mapPoints().filter((point) => point.hasAttribute('data-wheel'));
const placed = (point: HTMLElement) => ({ left: point.style.left, top: point.style.top });

function timelineRows(): HTMLElement[] {
  const list = screen
    .getAllByRole('list')
    .find((candidate) => candidate.getAttribute('aria-label')?.endsWith(' timeline'))!;
  return [...list.children] as HTMLElement[];
}

function render(project: ProjectDocument) {
  const rendered = renderWorkspace(project, 'Surface', 'O');
  act(() => {
    rendered.application.store.dispatch(semanticOwnerFocused(ship));
  });
  return rendered;
}

describe('room map ship wheel', () => {
  it('puts one offer on the wheel and two on its left and right spots, and the doors in the last phase', async () => {
    const { phases, room } = shipRoom(cardHolder());
    const intro = phases.find((phase) => phase.wheel?.key === 'wheel1')!;
    const spots = wheelSpots(room.gameName);

    const one = render(cardHolder());
    await one.user.click(screen.getByRole('tab', { name: `${intro.label} Timeline` }));
    expect(wheelOffers().map(placed)).toEqual([spots.wheel]);
    expect(mapPoints().some((point) => point.getAttribute('aria-label')?.startsWith('Door'))).toBe(
      false,
    );
    cleanup();

    const two = render(
      applyProjectCommand(cardHolder(), catalog, {
        kind: 'ReplaceRewardWheelOfferCount',
        wheel,
        offerCount: 2,
      }),
    );
    await two.user.click(screen.getByRole('tab', { name: `${intro.label} Timeline` }));
    expect(wheelOffers().map((point) => [point.getAttribute('aria-label'), placed(point)])).toEqual(
      [
        ['L Offer', spots.left],
        ['R Offer', spots.right],
      ],
    );

    const last = phases.at(-1)!;
    await two.user.click(screen.getByRole('tab', { name: `${last.label} Timeline` }));
    expect(wheelOffers()).toEqual([]);
    expect(mapPoints().some((point) => point.getAttribute('aria-label')?.startsWith('Door'))).toBe(
      true,
    );
  });

  it("shows a rerolled offer's new reward from its reroll row on", async () => {
    const base = cardHolder();
    const { phases, projected } = shipRoom(base);
    const intro = phases.find((phase) => phase.wheel?.key === 'wheel1')!;
    const interaction = projected.workspace.interactions.roomRerolls.get(
      intro.wheelRerolls!.interactionKey,
    )!;
    const [targetKey] = interaction
      .targets(undefined)
      .sections.flatMap((section) => section.items)
      .map((item) => item.value);
    const resolver = interaction.pendingReward(targetKey!);
    const rewards = resolver
      .model(await resolver.load(), 'type')
      .sections.flatMap((section) => section.items)
      .filter((item) => !item.disabled && item.value.payload === undefined)
      .map((item) => item.value as ResolvedRewardOffer);
    const first = intro.wheel!.offers[0]!.control.offer;
    const reward = rewards.find((candidate) => candidate.rewardType !== first?.rewardType)!;
    const rerolled = applyProjectCommand(
      base,
      catalog,
      interaction.appendIntent(targetKey!, reward).command,
    );

    const { user } = render(rerolled);
    await user.click(screen.getByRole('tab', { name: `${intro.label} Timeline` }));
    const face = () => wheelOffers()[0]!.querySelector('.room-map-door-face')?.innerHTML;

    await user.click(timelineRows().find((row) => row.hasAttribute('data-doors-open'))!);
    const firstDraw = face();
    const pressRow = timelineRows().find((row) => row.hasAttribute('data-door-press'))!;
    const pressedFace = within(pressRow)
      .getAllByRole('listitem')
      .find((chip) => chip.getAttribute('aria-label')?.startsWith('Offer'))!.innerHTML;
    expect(pressedFace).not.toBe(firstDraw);

    await user.click(pressRow);
    expect(face()).toBe(pressedFace);
    // Pointing at the wheel offer marks the press row's chip that names it.
    await user.hover(wheelOffers()[0]!);
    expect(
      within(pressRow)
        .getAllByRole('listitem')
        .find((chip) => chip.getAttribute('aria-label')?.startsWith('Offer'))!
        .hasAttribute('data-map-pointed'),
    ).toBe(true);
  });
});

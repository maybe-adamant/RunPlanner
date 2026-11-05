import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  createBiomeAddress,
  createHubDecisionAddress,
  type HubDecision,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { hubBoardDrawPositions } from '@run-planner/engine/simulation';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';

import { hubBoardRewardAssignmentOrder } from '../../../../../src/simulation/rewards/biome/generation/hub-board-order';
import { hubBoardProbes } from '../../../../support/hub-board-probe';

/** The Ephyra board doors, each named as the N_Hub door-setup order declares it. */
function ephyraSlots() {
  const progression = catalog.biomeLayouts.byKey.N?.progression;
  if (progression?.kind !== 'hub') throw new Error('missing the Ephyra Hub');
  const setup = catalog.rooms.byKey.N_Hub?.exitDoorSetupOrder ?? [];
  return progression.slots.map((slot) => ({
    ...slot,
    obstacleName: setup.find((door) => door.doorId === slot.physicalDoorId)!.obstacleName,
  }));
}

describe('Hub board reward-assignment order', () => {
  it.each(hubBoardProbes.map((probe, index) => [index, probe] as const))(
    'derives probe board %i from the declared Ephyra doors',
    (_, probe) => {
      const open = ephyraSlots().filter((slot) => probe.insertion.includes(slot.physicalDoorId));
      expect(open).toHaveLength(probe.insertion.length);
      expect(
        [...open]
          .sort((left, right) => left.offeredExitInsertionRank - right.offeredExitInsertionRank)
          .map((slot) => slot.physicalDoorId),
      ).toEqual(probe.insertion);
      // Declaration order is not the insertion order, so the result cannot depend on it.
      expect(
        hubBoardRewardAssignmentOrder([...open].reverse()).map((slot) => slot.physicalDoorId),
      ).toEqual(probe.assignment);
    },
  );

  it('rejects a board that repeats a door', () => {
    const door = {
      physicalDoorId: 560705,
      offeredExitInsertionRank: 0,
      obstacleName: 'EphyraExitDoor',
    };
    expect(() => hubBoardRewardAssignmentOrder([door, door])).toThrow(/repeat/);
  });
});

const hub = createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'hub');

/** The Surface N fixture with its board's open set replaced, in the given authored order. */
function withOpenSlots(hubSlotKeys: readonly string[]): ProjectDocument {
  const project = loadSurfaceNProject();
  const [biome, ...rest] = project.route.biomes;
  const topology = biome!.topology!;
  return {
    ...project,
    route: {
      ...project.route,
      biomes: [
        {
          ...biome!,
          topology: {
            ...topology,
            decisions: topology.decisions.map((decision) =>
              decision.kind === 'hub'
                ? ({
                    ...decision,
                    openTargets: hubSlotKeys.map((hubSlotKey) => ({
                      hubSlotKey,
                      occurrenceId: `open-${hubSlotKey}` as OccurrenceId,
                    })),
                  } satisfies HubDecision)
                : decision,
            ),
          },
        },
        ...rest,
      ],
    },
  };
}

function drawOrder(hubSlotKeys: readonly string[]) {
  const slots = hubBoardDrawPositions(catalog, withOpenSlots(hubSlotKeys), hub)!;
  return slots
    .flatMap((slot) => (slot.open ? [slot] : []))
    .sort((left, right) => left.drawPosition - right.drawPosition)
    .map((slot) => slot.hubSlotKey);
}

describe('Hub board draw positions', () => {
  it('number every open door of a logged board in the order the game drew it', () => {
    const logged = [
      'combat13',
      'combat16',
      'combat14',
      'miniBoss01',
      'combat05',
      'combat10',
      'combat12',
      'combat01',
      'combat11',
    ];
    const slots = hubBoardDrawPositions(catalog, withOpenSlots([...logged].sort()), hub)!;
    expect(drawOrder([...logged].sort())).toEqual(logged);
    expect(slots.find((slot) => slot.hubSlotKey === 'miniBoss01')).toEqual({
      hubSlotKey: 'miniBoss01',
      open: true,
      occurrenceId: 'open-miniBoss01',
      drawPosition: 4,
    });
    // Every other declared slot is closed.
    expect(slots.filter((slot) => !slot.open)).toHaveLength(slots.length - logged.length);
    expect(slots.find((slot) => slot.hubSlotKey === 'combat02')).toEqual({
      hubSlotKey: 'combat02',
      open: false,
    });
  });

  it('number an incomplete board as the user builds it', () => {
    const open = ['combat01', 'combat05', 'combat10', 'miniBoss01'];
    expect(drawOrder(open)).toEqual(['miniBoss01', 'combat10', 'combat05', 'combat01']);
    expect(drawOrder([...open].reverse())).toEqual(drawOrder(open));
    expect(drawOrder([])).toEqual([]);
  });

  it('is undefined for a Hub the project does not author', () => {
    expect(
      hubBoardDrawPositions(
        catalog,
        loadSurfaceNProject(),
        createHubDecisionAddress(createBiomeAddress('Surface', 'N'), 'other'),
      ),
    ).toBeUndefined();
  });
});

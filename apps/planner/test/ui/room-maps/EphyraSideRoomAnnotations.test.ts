import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { ephyraSideRoomAnnotations } from '@planner/ui/room-maps/EphyraSideRoomAnnotations';

describe('Ephyra side-room map annotations', () => {
  it('maps every declared side slot exactly once by parent slot identity', () => {
    const declared = Object.values(catalog.rooms.byKey).flatMap((room) =>
      room.localChildren
        .filter((child) => child.kind === 'fixedRoomSlots')
        .flatMap((child) => child.slots.map((slot) => `${room.gameName}:${slot.slotKey}`)),
    );
    const annotated = ephyraSideRoomAnnotations.map(
      (annotation) => `${annotation.gameName}:${annotation.slotKey}`,
    );

    expect(new Set(annotated)).toHaveLength(annotated.length);
    expect(annotated.slice().sort()).toEqual(declared.slice().sort());
    expect(
      ephyraSideRoomAnnotations.every(
        (annotation) =>
          Number.isInteger(annotation.x) &&
          Number.isInteger(annotation.y) &&
          annotation.x >= 0 &&
          annotation.x <= 2560 &&
          annotation.y >= 0 &&
          annotation.y <= 1440,
      ),
    ).toBe(true);
  });

  it('keeps N_Combat22 slot geometry bound to declaration identity rather than room number', () => {
    expect(
      ephyraSideRoomAnnotations.filter((annotation) => annotation.gameName === 'N_Combat22'),
    ).toEqual([
      { gameName: 'N_Combat22', slotKey: 'sideDoor1', x: 776, y: 492 },
      { gameName: 'N_Combat22', slotKey: 'sideDoor2', x: 2104, y: 584 },
    ]);
  });
});

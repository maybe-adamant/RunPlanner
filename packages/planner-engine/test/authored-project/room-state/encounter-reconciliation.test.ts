import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import { reconcileRoomEncounterState } from '../../../src/authored-project/room-state/encounter-reconciliation';
import { createDefaultRoomEncounterState } from '../../../src/authored-project/room-state/encounter-envelope';
import { room } from '../support/room-state-codec';

describe('encounter reconciliation', () => {
  it('retains exact compatible encounter leaves and resets only an incompatible stable slot', () => {
    const previousRoom = room('P_Combat03');
    const previousDefault = createDefaultRoomEncounterState(catalog, previousRoom);
    const selected = Object.freeze({
      encounterKeyByPhase: Object.freeze({
        ...previousDefault.encounterKeyByPhase,
        Intro: 'P_Combat03_PreCombat01',
        Combat: 'GeneratedP_Large',
      }),
      figLeafSkipByPhase: previousDefault.figLeafSkipByPhase,
    });

    expect(
      reconcileRoomEncounterState(catalog, previousRoom, selected, previousRoom, previousDefault),
    ).toEqual(selected);

    const replacementRoom = room('P_Combat04');
    const replacementDefault = createDefaultRoomEncounterState(catalog, replacementRoom);
    expect(
      reconcileRoomEncounterState(
        catalog,
        previousRoom,
        selected,
        replacementRoom,
        replacementDefault,
      ),
    ).toEqual({
      encounterKeyByPhase: {
        Intro: 'GeneratedP_PreCombat',
        Combat: 'GeneratedP_Large',
      },
      figLeafSkipByPhase: {
        Intro: false,
        Combat: false,
      },
    });
  });
});

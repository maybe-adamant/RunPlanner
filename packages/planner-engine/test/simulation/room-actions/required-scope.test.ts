import { describe, expect, it } from 'vitest';
import { createOccurrenceId } from '../../../src/authored-project/addresses';
import { roomActionKey } from '../../../src/authored-project/room-actions/state';
import type { RoomEventGraph } from '../../../src/authored-project/room-actions/event-graph';

import {
  withRequiredScopes,
  type RoomActionRowFacts,
} from '../../../src/simulation/room-actions/required-scope';
import {
  assembleRoomActionRoster,
  scopeRoomActionRoster,
} from '../../../src/simulation/room-actions/assemble';
import { gateFreeGraphEvents, testGraphEvents } from '../../support/event-graph';
import { boundsForPlacement, type TestRowPlacement } from '../../support/room-action-bounds';

const structure: RoomEventGraph = {
  profileKey: 'FieldsCombatRoom',
  activeEncounterSlotKeys: ['Cage01', 'Cage02'],
  phases: [{ phaseKey: 'Cage01' }, { phaseKey: 'Cage02' }],
  pressFights: [],
  events: testGraphEvents([{ phaseKey: 'Cage01' }, { phaseKey: 'Cage02' }], {
    cages: true,
    generatesOutgoing: false,
  }),
};
/** Two fights in sequence, the first's end effects before the second. */
const sequence: RoomEventGraph = {
  profileKey: 'PCombatRoom',
  activeEncounterSlotKeys: ['Cage01', 'Cage02'],
  phases: [{ phaseKey: 'Cage01' }, { phaseKey: 'Cage02' }],
  pressFights: [],
  events: gateFreeGraphEvents(['Cage01', 'Cage02'], false),
};
function row(
  reference: RoomActionRowFacts['reference'],
  {
    placement = { kind: 'fields' },
    ...overrides
  }: Partial<RoomActionRowFacts> & {
    readonly placement?: TestRowPlacement;
  } = {},
  graph: RoomEventGraph = structure,
): RoomActionRowFacts {
  return {
    bounds: boundsForPlacement(placement, graph),
    reference,
    key: roomActionKey(reference),
    owner: {
      kind: 'occurrence',
      routeKey: 'Underworld',
      biomeKey: 'H',
      occurrenceId: createOccurrenceId('scope'),
    },
    participation: 'required',
    dependencies: [],
    rank: 1,
    stale: false,
    executable: true,
    ...overrides,
  };
}
describe('required action scope', () => {
  it('publishes scope for unplaced required rows and clears it for a dormant phase', () => {
    const cage = row({ kind: 'completeFieldsCage', phaseKey: 'Cage02' });
    const roster = assembleRoomActionRoster({
      owner: {
        kind: 'occurrence',
        routeKey: 'Underworld',
        biomeKey: 'H',
        occurrenceId: createOccurrenceId('scope'),
      },
      order: [],
      eventGraph: structure,
      contributions: [
        {
          reference: cage.reference,
          owner: cage.owner,
          participation: cage.participation,
          bounds: cage.bounds,
          dependencies: cage.dependencies,
        },
      ],
    });
    expect(roster.rows[0]).toMatchObject({ rank: null, requiredScope: 'phase' });
    expect(scopeRoomActionRoster(roster, ['Cage01']).rows[0]).toMatchObject({ stale: true });
    expect(scopeRoomActionRoster(roster, ['Cage01']).rows[0]?.requiredScope).toBeUndefined();
  });
  it("keeps a wheel's pre-combat contact when the room no longer plays its phase", () => {
    const ship: RoomEventGraph = {
      profileKey: 'ShipCombatRoom',
      activeEncounterSlotKeys: ['Intro'],
      phases: [{ phaseKey: 'Intro' }],
      pressFights: [],
      events: testGraphEvents([{ phaseKey: 'Intro' }], { generatesOutgoing: true }),
    };
    const choose = row(
      { kind: 'chooseRewardWheel', wheelKey: 'wheel1' },
      {
        bounds: {
          spawn: { kind: 'wheelsOpen', wheelKey: 'wheel1' },
          enabler: { kind: 'gate', phaseKey: 'Combat1' },
          deadline: { kind: 'encounterStarted', phaseKey: 'Combat1' },
        },
      },
      ship,
    );
    expect(withRequiredScopes([choose], ship)[0]?.contact).toEqual({
      kind: 'beforeWheelChoice',
      wheelKey: 'wheel1',
    });
  });
  it('does not invent a phase obligation in an encounterless lifecycle', () => {
    expect(
      withRequiredScopes(
        [
          row(
            {
              kind: 'interactIncomingReward',
              producerPoint: 'roomReward',
              acquisitionRole: 'primary',
            },
            { placement: { kind: 'beforeCombat' as const } },
          ),
        ],
        {
          profileKey: 'OpeningRoom',
          activeEncounterSlotKeys: [],
          phases: [],
          pressFights: [],
          events: gateFreeGraphEvents([], false),
        },
      )[0]?.requiredScope,
    ).toBe('room');
  });
  it('distinguishes cage rewards from encounter barriers independently of authored rank', () => {
    const athena = row({ kind: 'interactGorgon', phaseKey: 'Cage01' }, { rank: null });
    const cage = row(
      { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
      {
        dependencies: [{ action: athena.reference }],
      },
    );
    const reward = row({ kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' });
    expect(
      withRequiredScopes([reward, cage, athena], structure).map((value) => value.requiredScope),
    ).toEqual(['room', 'phase', 'phase']);
    expect(
      withRequiredScopes([athena, reward, cage], structure).map((value) => value.requiredScope),
    ).toEqual(['phase', 'room', 'phase']);
  });
  it('propagates a phase deadline through generated prerequisites', () => {
    const source = row({ kind: 'interactAcquisitionEntry', siteKey: 'source', entryKey: 'pickup' });
    const child = row(
      { kind: 'interactGorgon', phaseKey: 'Cage01' },
      {
        dependencies: [{ action: source.reference }],
      },
    );
    const cage = row(
      { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
      {
        dependencies: [{ action: child.reference }],
      },
    );
    expect(
      withRequiredScopes([source, child, cage], structure).map((value) => value.requiredScope),
    ).toEqual(['phase', 'phase', 'phase']);
  });
  it.each([
    [{ kind: 'beforeCombat' as const }, 'phase'],
    [{ kind: 'afterCombat' as const }, 'room'],
    [{ kind: 'beforeWheelPhase' as const, wheelKey: 'wheel1' }, 'phase'],
    [{ kind: 'afterWheelPhase' as const, wheelKey: 'wheel1' }, 'phase'],
    [{ kind: 'afterEncounterEnd' as const, phaseKey: 'Cage01' }, 'phase'],
    [{ kind: 'afterEncounterEnd' as const, phaseKey: 'Cage02' }, 'room'],
    [{ kind: 'afterDoorsOpen' as const }, 'room'],
  ] as const)('uses the fixed placement %j', (placement, expected) => {
    expect(
      withRequiredScopes([row({ kind: 'useFountain' }, { placement }, sequence)], sequence)[0]
        ?.requiredScope,
    ).toBe(expected);
  });
  it('does not classify optional or stale actions and drops obsolete scoped deadlines', () => {
    const athena = row({ kind: 'interactGorgon', phaseKey: 'Cage01' }, { requiredScope: 'phase' });
    expect(
      withRequiredScopes(
        [
          athena,
          row(
            { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
            { stale: true, requiredScope: 'phase' },
          ),
          row({ kind: 'useFountain' }, { participation: 'optional' }),
        ],
        structure,
      ).map((value) => value.requiredScope),
    ).toEqual(['room', undefined, undefined]);
  });
});

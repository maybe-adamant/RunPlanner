import { describe, expect, it } from 'vitest';
import { createOccurrenceId } from '../../../src/authored-project/addresses';
import { roomActionKey } from '../../../src/authored-project/room-actions/state';
import type { RoomLifecycleStructure } from '../../../src/authored-project/room-actions/lifecycle-structure';
import type { RoomActionRow } from '../../../src/simulation/room-actions/model';
import { withRequiredScopes } from '../../../src/simulation/room-actions/required-scope';
import {
  assembleRoomActionRoster,
  scopeRoomActionRoster,
} from '../../../src/simulation/room-actions/assemble';

const structure: RoomLifecycleStructure = {
  profileKey: 'FieldsCombatRoom',
  activeEncounterSlotKeys: ['Cage01', 'Cage02'],
  phases: [{ phaseKey: 'Cage01' }, { phaseKey: 'Cage02' }],
  points: [
    { kind: 'roomEntered', key: 'roomEntered' },
    { kind: 'encounterStart', key: 'start1', phaseKey: 'Cage01' },
    { kind: 'encounterEnd', key: 'end1', phaseKey: 'Cage01' },
    { kind: 'encounterStart', key: 'start2', phaseKey: 'Cage02' },
    { kind: 'encounterEnd', key: 'end2', phaseKey: 'Cage02' },
    { kind: 'cleanup', key: 'cleanup' },
  ],
};
function row(
  reference: RoomActionRow['reference'],
  overrides: Partial<RoomActionRow> = {},
): RoomActionRow {
  return {
    reference,
    key: roomActionKey(reference),
    owner: {
      kind: 'occurrence',
      routeKey: 'Underworld',
      biomeKey: 'H',
      occurrenceId: createOccurrenceId('scope'),
    },
    participation: 'required',
    window: { kind: 'fields' },
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
      lifecycleStructure: structure,
      contributions: [
        {
          kind: 'action',
          reference: cage.reference,
          owner: cage.owner,
          participation: cage.participation,
          window: cage.window,
          dependencies: cage.dependencies,
        },
      ],
    });
    expect(roster.rows[0]).toMatchObject({ rank: null, requiredScope: 'phase' });
    expect(scopeRoomActionRoster(roster, ['Cage01']).rows[0]).toMatchObject({ stale: true });
    expect(scopeRoomActionRoster(roster, ['Cage01']).rows[0]?.requiredScope).toBeUndefined();
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
            { window: { kind: 'standard', phase: 'beforeCombat' } },
          ),
        ],
        {
          profileKey: 'OpeningRoom',
          activeEncounterSlotKeys: [],
          phases: [],
          points: [
            { kind: 'roomEntered', key: 'roomEntered' },
            { kind: 'cleanup', key: 'cleanup' },
          ],
        },
      )[0]?.requiredScope,
    ).toBe('room');
  });
  it('distinguishes cage rewards from encounter barriers independently of authored rank', () => {
    const athena = row({ kind: 'interactGorgon', phaseKey: 'Cage01' }, { rank: null });
    const cage = row(
      { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
      {
        dependencies: [{ kind: 'afterAction', action: athena.reference }],
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
        dependencies: [{ kind: 'afterAction', action: source.reference }],
      },
    );
    const cage = row(
      { kind: 'completeFieldsCage', phaseKey: 'Cage02' },
      {
        dependencies: [{ kind: 'afterAction', action: child.reference }],
      },
    );
    expect(
      withRequiredScopes([source, child, cage], structure).map((value) => value.requiredScope),
    ).toEqual(['phase', 'phase', 'phase']);
  });
  it.each([
    [{ kind: 'standard', phase: 'beforeCombat' }, 'phase'],
    [{ kind: 'standard', phase: 'afterCombat' }, 'room'],
    [{ kind: 'shipPreCombat', wheelKey: 'wheel1' }, 'phase'],
    [{ kind: 'shipPostCombat', wheelKey: 'wheel1' }, 'phase'],
    [{ kind: 'encounterEnd', phaseKey: 'Cage01' }, 'phase'],
    [{ kind: 'encounterEnd', phaseKey: 'Cage02' }, 'room'],
    [{ kind: 'postOutgoing' }, 'room'],
  ] as const)('uses the fixed window %j', (window, expected) => {
    expect(
      withRequiredScopes([row({ kind: 'useFountain' }, { window })], structure)[0]?.requiredScope,
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

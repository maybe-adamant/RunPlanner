import { describe, expect, it } from 'vitest';
import { assembleRoomLifecycleTimeline, type RoomActionRoster } from '../../src/simulation';
import { createOccurrenceId, type OccurrenceAddress } from '../../src/authored-project/addresses';
import { roomActionKey } from '../../src/authored-project/room-actions';
import type { RoomActionReference } from '../../src/authored-project/model';
import type { ResolvedEncounterPhase } from '../../src/simulation/encounters';
import type { RoomActionRow, RoomActionWindow } from '../../src/simulation/room-actions';

const owner: OccurrenceAddress = Object.freeze({
  kind: 'occurrence',
  routeKey: 'Underworld',
  biomeKey: 'F',
  occurrenceId: createOccurrenceId('timeline-test'),
});

function roster(overrides: Partial<RoomActionRoster> = {}): RoomActionRoster {
  return Object.freeze({
    rows: Object.freeze([]),
    checkpoints: Object.freeze([
      Object.freeze({
        checkpointKey: 'outgoingGeneration',
        label: 'Outgoing generation',
        window: Object.freeze({ kind: 'standard' as const, phase: 'afterCombat' as const }),
        afterRank: 1,
      }),
      Object.freeze({
        checkpointKey: 'exitUsable',
        label: 'Exit usable',
        window: Object.freeze({ kind: 'standard' as const, phase: 'afterCombat' as const }),
        afterRank: 1,
      }),
    ]),
    issues: Object.freeze([]),
    proposals: Object.freeze([]),
    valid: true,
    ...overrides,
  });
}

const encounter = (slotKey: string): ResolvedEncounterPhase =>
  Object.freeze({
    slotKey,
    envelopeKey: 'test-envelope',
    encounterKey: `${slotKey}-encounter`,
    label: slotKey,
    kind: 'combat',
    countsEncounterDepth: true,
    canEncounterSkip: false,
    blocksFigLeaf: false,
    blocksGorgon: false,
    hostsGorgon: false,
    skipEndEncounterEffects: false,
    figLeafSkip: false,
  });

function rankedRow(
  reference: RoomActionReference,
  window: RoomActionWindow,
  rank: number,
  participation: 'required' | 'optional' = 'required',
): RoomActionRow {
  return Object.freeze({
    reference,
    key: roomActionKey(reference),
    owner,
    participation,
    window,
    dependencies: Object.freeze([]),
    rank,
    stale: false,
    executable: true,
  });
}

describe('room lifecycle timeline', () => {
  it('places standard encounter seams around the existing ranked roster', () => {
    const row = Object.freeze({
      reference: Object.freeze({
        kind: 'interactLocalReward' as const,
        groupKey: 'x',
        slotKey: 'y',
      }),
      key: 'interactLocalReward:x:y',
      owner,
      participation: 'optional' as const,
      window: Object.freeze({ kind: 'standard' as const, phase: 'afterCombat' as const }),
      dependencies: Object.freeze([]),
      rank: 1,
      stale: false,
      executable: true,
    });
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'StandardCombatRoom',
      encounterPhases: Object.freeze([encounter('Combat')]),
      roomActionRoster: roster({ rows: Object.freeze([row]) }),
    });
    expect(timeline.boundaries.map((boundary) => boundary.kind)).toEqual([
      'roomEntered',
      'encounterStart',
      'encounterEnd',
      'outgoingGeneration',
      'cleanup',
    ]);
    expect(timeline.entries.filter((entry) => entry.kind === 'action')).toHaveLength(1);
    expect(timeline.repairRows).toEqual([]);
  });

  it('keeps required pre-combat work before Start and post-combat work after End', () => {
    const before = rankedRow(
      {
        kind: 'interactIncomingReward',
        producerPoint: 'roomEntrance',
        acquisitionRole: 'source',
      },
      { kind: 'standard', phase: 'beforeCombat' },
      1,
    );
    const after = rankedRow(
      {
        kind: 'interactIncomingReward',
        producerPoint: 'roomRewardPickup',
        acquisitionRole: 'source',
      },
      { kind: 'standard', phase: 'afterCombat' },
      2,
    );
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'StandardCombatRoom',
      encounterPhases: Object.freeze([encounter('Combat')]),
      roomActionRoster: roster({ rows: Object.freeze([before, after]) }),
    });
    const keys = timeline.entries.map((entry) =>
      entry.kind === 'action' ? entry.action.key : entry.boundary.kind,
    );
    expect(keys.indexOf(before.key)).toBeLessThan(keys.indexOf('encounterStart'));
    expect(keys.indexOf('encounterStart')).toBeLessThan(keys.indexOf('encounterEnd'));
    expect(keys.indexOf('encounterEnd')).toBeLessThan(keys.indexOf(after.key));
  });

  it('retains unranked rows for repair without changing roster membership', () => {
    const row = Object.freeze({
      reference: Object.freeze({ kind: 'chooseRewardWheel' as const, wheelKey: 'wheel1' }),
      key: 'chooseRewardWheel:wheel1',
      owner,
      participation: 'required' as const,
      window: Object.freeze({ kind: 'shipPreCombat' as const, wheelKey: 'wheel1' }),
      dependencies: Object.freeze([]),
      rank: null,
      stale: false,
      executable: false,
    });
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'ShipCombatRoom',
      encounterPhases: Object.freeze([encounter('Combat1')]),
      roomActionRoster: roster({ rows: Object.freeze([row]) }),
    });
    expect(timeline.repairRows.map((candidate) => candidate.key)).toEqual([
      'chooseRewardWheel:wheel1',
    ]);
    expect(timeline.entries.filter((entry) => entry.kind === 'action')).toHaveLength(0);
  });

  it('keeps an unranked Fields cage in repair without creating a lifecycle cycle', () => {
    const cage = Object.freeze({ kind: 'completeFieldsCage' as const, phaseKey: 'Cage01' });
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'FieldsCombatRoom',
      encounterPhases: Object.freeze([
        Object.freeze({
          ...encounter('Cage01'),
          rewardAttachment: Object.freeze({
            kind: 'localReward' as const,
            key: 'cage1',
            groupKey: 'cages',
            slotKey: 'cage1',
            reward: Object.freeze({
              kind: 'countedChoice' as const,
              storeKeys: Object.freeze(['store']),
              eligibleRewardTypes: Object.freeze([]),
              ineligibleRewardTypes: Object.freeze([]),
              allowedRewardTypes: Object.freeze([]),
              producerLifecycleKey: 'test',
            }),
            defaultStoreKey: 'store',
            offerKeys: Object.freeze(['offer1']),
            offerCount: Object.freeze({ min: 1, max: 1, defaultValue: 1 }),
            picked: 'exactlyOne' as const,
          }),
        }),
      ]),
      roomActionRoster: roster({
        rows: Object.freeze([
          Object.freeze({
            ...rankedRow(cage, { kind: 'fields', phaseKey: 'Cage01' }, 1),
            rank: null,
            executable: false,
          }),
        ]),
        checkpoints: Object.freeze([]),
      }),
    });
    expect(timeline.boundaries.map((boundary) => boundary.kind)).toEqual([
      'roomEntered',
      'cleanup',
    ]);
    expect(timeline.repairRows.map((row) => row.key)).toEqual([roomActionKey(cage)]);
  });

  it('keeps cleanup anchored to active ranked work when a stale row has a later rank', () => {
    const active = rankedRow(
      { kind: 'interactLocalReward', groupKey: 'x', slotKey: 'active' },
      { kind: 'standard', phase: 'afterCombat' },
      1,
    );
    const stale = Object.freeze({
      ...rankedRow(
        { kind: 'interactLocalReward', groupKey: 'x', slotKey: 'stale' },
        { kind: 'standard', phase: 'afterCombat' },
        7,
      ),
      stale: true,
    });
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'StandardCombatRoom',
      encounterPhases: Object.freeze([encounter('Combat')]),
      roomActionRoster: roster({
        rows: Object.freeze([active, stale]),
        checkpoints: Object.freeze([]),
      }),
    });
    expect(timeline.boundaries.find((boundary) => boundary.kind === 'cleanup')).toEqual({
      kind: 'cleanup',
      key: 'cleanup',
    });
    expect(
      timeline.entries.find(
        (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'cleanup',
      ),
    ).toMatchObject({ rank: 1 });
    expect(timeline.repairRows.map((row) => row.key)).toEqual([stale.key]);
  });

  it('derives Fields cage cycles from authored completion order and keeps each cage atomic', () => {
    const cage1 = Object.freeze({ kind: 'completeFieldsCage' as const, phaseKey: 'Cage01' });
    const cage2 = Object.freeze({ kind: 'completeFieldsCage' as const, phaseKey: 'Cage02' });
    const rows = Object.freeze([
      rankedRow(cage2, { kind: 'fields', phaseKey: 'Cage02' }, 1),
      rankedRow(
        { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage2' },
        { kind: 'fields', phaseKey: 'Cage02' },
        2,
        'optional',
      ),
      rankedRow(cage1, { kind: 'fields', phaseKey: 'Cage01' }, 3),
      rankedRow(
        { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' },
        { kind: 'fields', phaseKey: 'Cage01' },
        4,
        'optional',
      ),
    ]);
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'FieldsCombatRoom',
      encounterPhases: Object.freeze([
        encounter('Encounter'),
        Object.freeze({
          ...encounter('Cage01'),
          rewardAttachment: Object.freeze({
            kind: 'localReward' as const,
            groupKey: 'cages',
            slotKey: 'cage1',
          }),
        }),
        Object.freeze({
          ...encounter('Cage02'),
          rewardAttachment: Object.freeze({
            kind: 'localReward' as const,
            groupKey: 'cages',
            slotKey: 'cage2',
          }),
        }),
      ]),
      roomActionRoster: roster({
        rows,
        checkpoints: Object.freeze([
          Object.freeze({
            checkpointKey: 'outgoingGeneration',
            label: 'Outgoing generation',
            window: Object.freeze({ kind: 'fields' as const }),
            afterRank: 4,
          }),
        ]),
      }),
    });
    expect(
      timeline.boundaries.map(
        (boundary) => `${boundary.kind}:${'phaseKey' in boundary ? boundary.phaseKey : ''}`,
      ),
    ).toEqual([
      'roomEntered:',
      'encounterStart:Cage02',
      'encounterEnd:Cage02',
      'encounterStart:Cage01',
      'encounterEnd:Cage01',
      'cleanup:',
      'outgoingGeneration:',
    ]);
    const cage2Start = timeline.entries.findIndex(
      (entry) => entry.kind === 'boundary' && entry.boundary.key === 'encounterStart:Cage02',
    );
    const cage2End = timeline.entries.findIndex(
      (entry) => entry.kind === 'boundary' && entry.boundary.key === 'encounterEnd:Cage02',
    );
    expect(timeline.entries.slice(cage2Start + 1, cage2End)).toEqual([
      expect.objectContaining({
        kind: 'action',
        action: expect.objectContaining({ key: roomActionKey(cage2) }),
      }),
    ]);
    expect(timeline.boundaries.some((boundary) => boundary.kind === 'cleanup')).toBe(true);
    expect(timeline.boundaries.some((boundary) => boundary.kind === ('exitUsable' as never))).toBe(
      false,
    );
  });

  it('places Ship wheel controls at each next phase and emits one final cleanup', () => {
    const choose1 = { kind: 'chooseRewardWheel' as const, wheelKey: 'wheel1' };
    const reward1 = { kind: 'interactWheelReward' as const, wheelKey: 'wheel1' };
    const choose2 = { kind: 'chooseRewardWheel' as const, wheelKey: 'wheel2' };
    const reward2 = { kind: 'interactWheelReward' as const, wheelKey: 'wheel2' };
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'ShipCombatRoom',
      encounterPhases: Object.freeze([
        encounter('Intro'),
        Object.freeze({
          ...encounter('Combat1'),
          rewardAttachment: Object.freeze({
            kind: 'rewardWheel' as const,
            key: 'wheel1',
            reward: Object.freeze({
              kind: 'countedChoice' as const,
              storeKeys: Object.freeze(['store']),
              eligibleRewardTypes: Object.freeze([]),
              ineligibleRewardTypes: Object.freeze([]),
              allowedRewardTypes: Object.freeze([]),
              producerLifecycleKey: 'test',
            }),
            defaultStoreKey: 'store',
            offerKeys: Object.freeze(['offer1']),
            offerCount: Object.freeze({ min: 1, max: 1, defaultValue: 1 }),
            picked: 'exactlyOne' as const,
          }),
        }),
        Object.freeze({
          ...encounter('Combat2'),
          rewardAttachment: Object.freeze({
            kind: 'rewardWheel' as const,
            key: 'wheel2',
            reward: Object.freeze({
              kind: 'countedChoice' as const,
              storeKeys: Object.freeze(['store']),
              eligibleRewardTypes: Object.freeze([]),
              ineligibleRewardTypes: Object.freeze([]),
              allowedRewardTypes: Object.freeze([]),
              producerLifecycleKey: 'test',
            }),
            defaultStoreKey: 'store',
            offerKeys: Object.freeze(['offer1']),
            offerCount: Object.freeze({ min: 1, max: 1, defaultValue: 1 }),
            picked: 'exactlyOne' as const,
          }),
        }),
      ]),
      roomActionRoster: roster({
        rows: Object.freeze([
          rankedRow(choose1, { kind: 'shipPreCombat', wheelKey: 'wheel1' }, 1),
          rankedRow(reward1, { kind: 'shipPostCombat', wheelKey: 'wheel1' }, 2),
          rankedRow(choose2, { kind: 'shipPreCombat', wheelKey: 'wheel2' }, 3),
          rankedRow(reward2, { kind: 'shipPostCombat', wheelKey: 'wheel2' }, 4),
        ]),
        checkpoints: Object.freeze([
          Object.freeze({
            checkpointKey: 'nextPhaseUsable:wheel1',
            label: 'Next phase usable',
            window: Object.freeze({ kind: 'shipPostCombat' as const, wheelKey: 'wheel1' }),
            afterRank: 2,
          }),
          Object.freeze({
            checkpointKey: 'nextPhaseUsable:wheel2',
            label: 'Next phase usable',
            window: Object.freeze({ kind: 'shipPostCombat' as const, wheelKey: 'wheel2' }),
            afterRank: 4,
          }),
          Object.freeze({
            checkpointKey: 'outgoingGeneration',
            label: 'Outgoing generation',
            window: Object.freeze({ kind: 'shipPostCombat' as const, wheelKey: 'wheel2' }),
            afterRank: 4,
          }),
        ]),
      }),
    });

    expect(timeline.boundaries.map((boundary) => boundary.kind)).toEqual([
      'roomEntered',
      'encounterStart',
      'encounterEnd',
      'nextPhase',
      'encounterStart',
      'encounterEnd',
      'nextPhase',
      'encounterStart',
      'encounterEnd',
      'outgoingGeneration',
      'cleanup',
    ]);
    expect(
      timeline.boundaries
        .filter((boundary) => boundary.kind === 'nextPhase')
        .map((boundary) => boundary.wheelKey),
    ).toEqual(['wheel1', 'wheel2']);
    expect(timeline.boundaries.filter((boundary) => boundary.kind === 'cleanup')).toHaveLength(1);
    expect(
      timeline.entries.filter(
        (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'nextPhase',
      )[0],
    ).toMatchObject({
      rank: 1,
      placement: 'before',
    });
    const wheelOnePickup = timeline.entries.findIndex(
      (entry) => entry.kind === 'action' && entry.action.key === roomActionKey(reward1),
    );
    const combatTwoStart = timeline.entries.findIndex(
      (entry) => entry.kind === 'boundary' && entry.boundary.key === 'encounterStart:Combat2',
    );
    const wheelTwoStart = timeline.entries.findIndex(
      (entry) => entry.kind === 'boundary' && entry.boundary.key === 'nextPhase:wheel2',
    );
    const wheelTwoChoice = timeline.entries.findIndex(
      (entry) => entry.kind === 'action' && entry.action.key === roomActionKey(choose2),
    );
    expect(wheelOnePickup).toBeGreaterThanOrEqual(0);
    expect(wheelTwoStart).toBeGreaterThan(wheelOnePickup);
    expect(wheelTwoStart).toBeLessThan(wheelTwoChoice);
    expect(combatTwoStart).toBeGreaterThan(wheelOnePickup);
    expect(wheelTwoChoice).toBeLessThan(combatTwoStart);
    expect(
      timeline.entries.find(
        (entry) => entry.kind === 'boundary' && entry.boundary.key === 'nextPhase:wheel2',
      ),
    ).toMatchObject({ rank: 2, placement: 'after' });
  });

  it('keeps a three-cage Fields permutation atomic with cleanup before outgoing generation', () => {
    const cage = (phaseKey: string) =>
      Object.freeze({ kind: 'completeFieldsCage' as const, phaseKey });
    const reward = (slotKey: string, rank: number) =>
      rankedRow(
        { kind: 'interactLocalReward', groupKey: 'cages', slotKey },
        { kind: 'fields', phaseKey: slotKey },
        rank,
        'optional',
      );
    const cage3 = cage('Cage03');
    const cage1 = cage('Cage01');
    const cage2 = cage('Cage02');
    const rows = Object.freeze([
      rankedRow(cage3, { kind: 'fields', phaseKey: 'Cage03' }, 1),
      reward('cage3', 2),
      rankedRow(cage1, { kind: 'fields', phaseKey: 'Cage01' }, 3),
      reward('cage1', 4),
      rankedRow(cage2, { kind: 'fields', phaseKey: 'Cage02' }, 5),
      reward('cage2', 6),
    ]);
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'FieldsCombatRoom',
      encounterPhases: Object.freeze([
        encounter('Passive'),
        ...['Cage01', 'Cage02', 'Cage03'].map((phaseKey) =>
          Object.freeze({
            ...encounter(phaseKey),
            rewardAttachment: Object.freeze({
              kind: 'localReward' as const,
              groupKey: 'cages',
              slotKey: phaseKey.toLowerCase(),
            }),
          }),
        ),
      ]),
      roomActionRoster: roster({
        rows,
        checkpoints: Object.freeze([
          Object.freeze({
            checkpointKey: 'outgoingGeneration',
            label: 'Outgoing generation',
            window: Object.freeze({ kind: 'fields' as const }),
            afterRank: 6,
          }),
        ]),
      }),
    });
    expect(
      timeline.boundaries.map(
        (boundary) => `${boundary.kind}:${'phaseKey' in boundary ? boundary.phaseKey : ''}`,
      ),
    ).toEqual([
      'roomEntered:',
      'encounterStart:Cage03',
      'encounterEnd:Cage03',
      'encounterStart:Cage01',
      'encounterEnd:Cage01',
      'encounterStart:Cage02',
      'encounterEnd:Cage02',
      'cleanup:',
      'outgoingGeneration:',
    ]);
    for (const [phaseKey, completionKey] of [
      ['Cage03', roomActionKey(cage3)],
      ['Cage01', roomActionKey(cage1)],
      ['Cage02', roomActionKey(cage2)],
    ] as const) {
      const start = timeline.entries.findIndex(
        (entry) => entry.kind === 'boundary' && entry.boundary.key === `encounterStart:${phaseKey}`,
      );
      const end = timeline.entries.findIndex(
        (entry) => entry.kind === 'boundary' && entry.boundary.key === `encounterEnd:${phaseKey}`,
      );
      expect(timeline.entries.slice(start + 1, end)).toEqual([
        expect.objectContaining({
          kind: 'action',
          action: expect.objectContaining({ key: completionKey }),
        }),
      ]);
    }
  });
});

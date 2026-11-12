import { describe, expect, it } from 'vitest';
import {
  appendSteadyGrowthTimelineEffects,
  appendTranscendentEmbryoTimelineEffects,
  assembleRoomLifecycleTimeline as assembleTimeline,
  type RoomActionRoster,
} from '../../src/simulation';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createSteadyGrowthOutcomeAddress,
  createTraitOfferAddress,
  createTranscendentEmbryoOutcomeAddress,
  type OccurrenceAddress,
} from '../../src/authored-project/addresses';
import type { RoomEventGraph } from '../../src/authored-project';
import { roomActionKey } from '../../src/authored-project/room-actions/state';
import type { RoomActionReference } from '../../src/authored-project/model';
import type { ResolvedEncounterPhase } from '../../src/simulation/encounters';
import type { RoomActionRow } from '../../src/simulation/room-actions';
import { withRequiredScopes } from '../../src/simulation/room-actions/required-scope';
import { boundsForPlacement, type TestRowPlacement } from '../support/room-action-bounds';

/** A test row names where it stands; the room's graph gives it bounds, label and phase. */
type TestRow = Omit<RoomActionRow, 'contact' | 'label' | 'bounds'> & {
  readonly placement: TestRowPlacement;
};
type TestRoster = Omit<RoomActionRoster, 'rows'> & { readonly rows: readonly TestRow[] };
import { testGraphEvents } from '../support/event-graph';

const owner: OccurrenceAddress = Object.freeze({
  kind: 'occurrence',
  routeKey: 'Underworld',
  biomeKey: 'F',
  occurrenceId: createOccurrenceId('timeline-test'),
});

const steadyGrowthSource = createTraitOfferAddress(
  createIncomingRewardAddress(createBiomeAddress('Underworld', 'F'), createOccurrenceId('source')),
  'self',
);

/** A reached outcome landing at this test room's encounter end. */
function steadyGrowthAt(phaseKey: string, cycle = 1) {
  return Object.freeze({
    address: createSteadyGrowthOutcomeAddress(steadyGrowthSource, cycle),
    owner,
    phaseKey,
  });
}

function embryoAt(phaseKey: string, cycle = 1) {
  return Object.freeze({
    address: createTranscendentEmbryoOutcomeAddress(
      createRouteStartKeepsakeSelectionAddress('Underworld'),
      cycle,
    ),
    owner,
    phaseKey,
  });
}

function roster(overrides: Partial<TestRoster> = {}): TestRoster {
  return Object.freeze({
    eventGraph: Object.freeze({
      profileKey: 'StandardRewardRoom',
      activeEncounterSlotKeys: Object.freeze([]),
      phases: Object.freeze([]),
      pressFights: [],
      events: Object.freeze(testGraphEvents([], { generatesOutgoing: true })),
    }),
    rows: Object.freeze([]),
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
    advancesHermesShrineDeliveryUses: true,
    canEncounterSkip: false,
    blocksFigLeaf: false,
    blocksGorgon: false,
    hostsGorgon: false,
    skipEndEncounterEffects: false,
    figLeafSkip: false,
  });

function structure(
  profileKey: string,
  encounterPhases: readonly ResolvedEncounterPhase[],
  roomActionRoster: TestRoster,
): RoomEventGraph {
  const declared = encounterPhases
    .filter(
      (phase) =>
        phase.kind !== 'nonCombat' &&
        (profileKey !== 'FieldsCombatRoom' || phase.rewardAttachment?.kind === 'localReward'),
    )
    .map((phase) =>
      Object.freeze({
        phaseKey: phase.slotKey,
        ...(phase.rewardAttachment?.kind === 'rewardWheel'
          ? { rewardWheelKey: phase.rewardAttachment.key }
          : {}),
      }),
    );
  const phases =
    profileKey === 'FieldsCombatRoom'
      ? (() => {
          const byKey = new Map(declared.map((phase) => [phase.phaseKey, phase]));
          const ranked = roomActionRoster.rows.flatMap((row) =>
            row.reference.kind === 'completeFieldsCage' && byKey.has(row.reference.phaseKey)
              ? [byKey.get(row.reference.phaseKey)!]
              : [],
          );
          const rankedKeys = new Set(ranked.map((phase) => phase.phaseKey));
          return [...ranked, ...declared.filter((phase) => !rankedKeys.has(phase.phaseKey))];
        })()
      : declared;
  const events = testGraphEvents(phases, {
    cages: profileKey === 'FieldsCombatRoom',
    generatesOutgoing: true,
    boss: profileKey === 'BossRoom',
  });
  return Object.freeze({
    profileKey,
    activeEncounterSlotKeys: Object.freeze(encounterPhases.map((phase) => phase.slotKey)),
    phases: Object.freeze(phases),
    pressFights: [],
    events: Object.freeze(events),
  });
}

function assembleRoomLifecycleTimeline(input: {
  readonly owner: OccurrenceAddress;
  readonly lifecycleProfileKey: string;
  readonly encounterPhases: readonly ResolvedEncounterPhase[];
  readonly roomActionRoster: TestRoster;
}) {
  const eventGraph = structure(
    input.lifecycleProfileKey,
    input.encounterPhases,
    input.roomActionRoster,
  );
  const rows = withRequiredScopes(
    input.roomActionRoster.rows.map(({ placement, ...row }) =>
      Object.freeze({ ...row, bounds: boundsForPlacement(placement, eventGraph) }),
    ),
    eventGraph,
  );
  return assembleTimeline({
    owner: input.owner,
    roomActionRoster: Object.freeze({ ...input.roomActionRoster, eventGraph, rows }),
  });
}

function rankedRow(
  reference: RoomActionReference,
  placement: TestRowPlacement,
  rank: number,
  participation: 'required' | 'optional' = 'required',
): TestRow {
  return Object.freeze({
    reference,
    key: roomActionKey(reference),
    owner,
    participation,
    placement,
    dependencies: Object.freeze([]),
    rank,
    stale: false,
    executable: true,
  });
}

describe('room lifecycle timeline', () => {
  it('places reached Steady Growth immediately after its encounter end', () => {
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'StandardCombatRoom',
      encounterPhases: Object.freeze([encounter('Combat')]),
      roomActionRoster: roster(),
    });
    const outcome = steadyGrowthAt('Combat');
    const enriched = appendSteadyGrowthTimelineEffects(timeline, [outcome]);
    const entryKinds = enriched.entries.map((entry) => entry.kind);
    const endIndex = enriched.entries.findIndex(
      (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'encounterEnd',
    );
    expect(entryKinds[endIndex + 1]).toBe('automaticEffect');
    expect(enriched.entries[endIndex + 1]).toMatchObject({
      address: outcome.address,
      effect: 'steadyGrowth',
      phaseKey: 'Combat',
    });
  });

  it('keeps Steady Growth before Transcendent Embryo at one encounter end', () => {
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'StandardCombatRoom',
      encounterPhases: Object.freeze([encounter('Combat')]),
      roomActionRoster: roster(),
    });
    const steadyGrowth = steadyGrowthAt('Combat');
    const embryo = embryoAt('Combat');
    const enriched = appendTranscendentEmbryoTimelineEffects(
      appendSteadyGrowthTimelineEffects(timeline, [steadyGrowth]),
      [embryo],
    );
    expect(
      enriched.entries
        .filter((entry) => entry.kind === 'automaticEffect')
        .map((entry) => entry.effect),
    ).toEqual(['steadyGrowth', 'transcendentEmbryo']);
  });

  it('keeps each multi-encounter Steady Growth checkpoint with its own phase', () => {
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'StandardCombatRoom',
      encounterPhases: Object.freeze([encounter('Combat1'), encounter('Combat2')]),
      roomActionRoster: roster(),
    });
    const outcomes = [steadyGrowthAt('Combat1', 1), steadyGrowthAt('Combat2', 2)];
    const enriched = appendSteadyGrowthTimelineEffects(timeline, outcomes);
    const entries = enriched.entries;
    for (const outcome of outcomes) {
      const effectIndex = entries.findIndex(
        (entry) => entry.kind === 'automaticEffect' && entry.address === outcome.address,
      );
      const endIndex = entries.findIndex(
        (entry) =>
          entry.kind === 'boundary' &&
          entry.boundary.kind === 'encounterEnd' &&
          entry.boundary.phaseKey === outcome.phaseKey,
      );
      expect(effectIndex).toBe(endIndex + 1);
    }
  });

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
      placement: Object.freeze({ kind: 'afterCombat' as const }),
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
      'encounterBegun',
      'encounterStarted',
      'encounterEnd',
      'doorsOpened',
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
      { kind: 'beforeCombat' as const },
      1,
    );
    const after = rankedRow(
      {
        kind: 'interactIncomingReward',
        producerPoint: 'roomRewardPickup',
        acquisitionRole: 'source',
      },
      { kind: 'afterCombat' as const },
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
    expect(keys.indexOf(before.key)).toBeLessThan(keys.indexOf('encounterStarted'));
    expect(keys.indexOf('encounterStarted')).toBeLessThan(keys.indexOf('encounterEnd'));
    expect(keys.indexOf('encounterEnd')).toBeLessThan(keys.indexOf(after.key));
  });

  it('keeps the required Boss pickup and matured Shrine delivery in authored action order', () => {
    const collect = rankedRow(
      { kind: 'collectRequiredReward' },
      { kind: 'afterCombat' as const },
      1,
    );
    const delivery = rankedRow(
      {
        kind: 'interactAcquisitionEntry',
        siteKey: 'hermesShrineDelivery',
        entryKey: 'hermesShrineDelivery:test',
        encounterPhaseKey: 'Encounter',
      },
      { kind: 'afterEncounterEnd' as const, phaseKey: 'Encounter' },
      2,
    );
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'BossRoom',
      encounterPhases: Object.freeze([encounter('Encounter')]),
      roomActionRoster: roster({
        rows: Object.freeze([collect, delivery]),
      }),
    });
    const keys = timeline.entries.map((entry) =>
      entry.kind === 'action' ? entry.action.key : entry.boundary.kind,
    );

    expect(keys).toEqual([
      'roomEntered',
      'encounterBegun',
      'encounterStarted',
      'bossDefeated',
      'encounterEnd',
      collect.key,
      delivery.key,
      'doorsOpened',
    ]);
  });

  it('orders Start before End when the only ranked action is an opening pickup before combat', () => {
    const pickup = rankedRow(
      {
        kind: 'interactIncomingReward',
        producerPoint: 'roomRewardPickup',
        acquisitionRole: 'source',
      },
      { kind: 'beforeCombat' as const },
      1,
    );
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'OpeningRewardRoom',
      encounterPhases: Object.freeze([encounter('Encounter')]),
      roomActionRoster: roster({ rows: Object.freeze([pickup]) }),
    });
    const keys = timeline.entries.map((entry) =>
      entry.kind === 'action' ? entry.action.key : entry.boundary.kind,
    );
    expect(keys).toEqual([
      'roomEntered',
      pickup.key,
      'encounterBegun',
      'encounterStarted',
      'encounterEnd',
      'doorsOpened',
    ]);
  });

  it('keeps lifecycle seams structural when authored action ranks contradict their windows', () => {
    const postCombat = rankedRow(
      {
        kind: 'interactIncomingReward',
        producerPoint: 'roomRewardPickup',
        acquisitionRole: 'source',
      },
      { kind: 'afterCombat' as const },
      1,
    );
    const preCombat = rankedRow(
      {
        kind: 'interactIncomingReward',
        producerPoint: 'roomEntrance',
        acquisitionRole: 'source',
      },
      { kind: 'beforeCombat' as const },
      2,
    );
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'StandardRewardRoom',
      encounterPhases: Object.freeze([encounter('Encounter')]),
      roomActionRoster: roster({ rows: Object.freeze([postCombat, preCombat]) }),
    });
    const keys = timeline.entries.map((entry) =>
      entry.kind === 'action' ? entry.action.key : entry.boundary.kind,
    );

    expect(keys.indexOf(postCombat.key)).toBeLessThan(keys.indexOf(preCombat.key));
    expect(keys.indexOf('encounterStarted')).toBeLessThan(keys.indexOf('encounterEnd'));
    expect(
      timeline.entries.filter((entry) => entry.kind === 'action').map((entry) => entry.rank),
    ).toEqual([1, 2]);
  });

  it('retains unranked rows for repair without changing roster membership', () => {
    const row = Object.freeze({
      reference: Object.freeze({ kind: 'chooseRewardWheel' as const, wheelKey: 'wheel1' }),
      key: 'chooseRewardWheel:wheel1',
      owner,
      participation: 'required' as const,
      placement: Object.freeze({ kind: 'beforeWheelPhase' as const, wheelKey: 'wheel1' }),
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

  it('keeps an unranked Fields cage in repair without erasing its rigid lifecycle cycle', () => {
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
      }),
    });
    expect(timeline.boundaries.map((boundary) => boundary.kind)).toEqual([
      'roomEntered',
      'encounterBegun',
      'encounterStarted',
      'encounterEnd',
      'doorsOpened',
    ]);
    expect(timeline.repairRows.map((row) => row.key)).toEqual([roomActionKey(cage)]);
  });

  it('keeps cleanup anchored to active ranked work when a stale row has a later rank', () => {
    const active = rankedRow(
      { kind: 'interactLocalReward', groupKey: 'x', slotKey: 'active' },
      { kind: 'afterCombat' as const },
      1,
    );
    const stale = Object.freeze({
      ...rankedRow(
        { kind: 'interactLocalReward', groupKey: 'x', slotKey: 'stale' },
        { kind: 'afterCombat' as const },
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
      }),
    });
    expect(timeline.boundaries.find((boundary) => boundary.kind === 'doorsOpened')).toMatchObject({
      kind: 'doorsOpened',
      key: 'doorsOpened',
    });
    expect(
      timeline.entries.find(
        (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'doorsOpened',
      ),
    ).toMatchObject({ rank: 1 });
    expect(timeline.repairRows.map((row) => row.key)).toEqual([stale.key]);
  });

  it('places a late optional Fields Artificer pickup after Cleanup while keeping generation internal', () => {
    const cage1 = Object.freeze({ kind: 'completeFieldsCage' as const, phaseKey: 'Cage01' });
    const cage2 = Object.freeze({ kind: 'completeFieldsCage' as const, phaseKey: 'Cage02' });
    const earlyOptional = Object.freeze({
      kind: 'interactLocalReward' as const,
      groupKey: 'optionalRewards',
      slotKey: 'optional1',
    });
    const replacement = Object.freeze({
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'artificer-site',
      entryKey: 'artificer-entry',
    });
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'FieldsCombatRoom',
      encounterPhases: Object.freeze([encounter('Cage01'), encounter('Cage02')]),
      roomActionRoster: roster({
        rows: Object.freeze([
          rankedRow(earlyOptional, { kind: 'fields' }, 1, 'optional'),
          rankedRow(cage1, { kind: 'fields', phaseKey: 'Cage01' }, 2),
          rankedRow(cage2, { kind: 'fields', phaseKey: 'Cage02' }, 3),
          rankedRow(replacement, { kind: 'fields', phaseKey: 'Cage01' }, 4, 'optional'),
        ]),
      }),
    });
    const visible = timeline.entries.map((entry) =>
      entry.kind === 'action' ? entry.action.key : entry.boundary.kind,
    );
    expect(visible.indexOf(roomActionKey(earlyOptional))).toBeLessThan(
      visible.indexOf('doorsOpened'),
    );
    expect(visible.indexOf('doorsOpened')).toBeLessThan(
      visible.indexOf(roomActionKey(replacement)),
    );
    expect(visible).not.toContain('outgoingGeneration');
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
      }),
    });
    expect(
      timeline.boundaries.map(
        (boundary) => `${boundary.kind}:${'phaseKey' in boundary ? boundary.phaseKey : ''}`,
      ),
    ).toEqual([
      'roomEntered:',
      'encounterBegun:Cage02',
      'encounterStarted:Cage02',
      'encounterEnd:Cage02',
      'encounterBegun:Cage01',
      'encounterStarted:Cage01',
      'encounterEnd:Cage01',
      'doorsOpened:',
    ]);
    // The cage's row begins its fight: Encounter, Combat and its end follow it at once.
    const cage2Row = timeline.entries.findIndex(
      (entry) => entry.kind === 'action' && entry.action.key === roomActionKey(cage2),
    );
    expect(
      timeline.entries
        .slice(cage2Row + 1, cage2Row + 4)
        .map((entry) => (entry.kind === 'boundary' ? entry.boundary.key : entry.kind)),
    ).toEqual(['encounterBegun:Cage02', 'encounterStarted:Cage02', 'encounterEnd:Cage02']);
    expect(timeline.boundaries.some((boundary) => boundary.kind === 'doorsOpened')).toBe(true);
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
          rankedRow(choose1, { kind: 'beforeWheelPhase' as const, wheelKey: 'wheel1' }, 1),
          rankedRow(reward1, { kind: 'afterWheelPhase' as const, wheelKey: 'wheel1' }, 2),
          rankedRow(choose2, { kind: 'beforeWheelPhase' as const, wheelKey: 'wheel2' }, 3),
          rankedRow(reward2, { kind: 'afterWheelPhase' as const, wheelKey: 'wheel2' }, 4),
        ]),
      }),
    });

    expect(timeline.boundaries.map((boundary) => boundary.kind)).toEqual([
      'roomEntered',
      'encounterBegun',
      'encounterStarted',
      'encounterEnd',
      'wheelsOpen',
      'encounterBegun',
      'encounterStarted',
      'encounterEnd',
      'wheelsOpen',
      'encounterBegun',
      'encounterStarted',
      'encounterEnd',
      'doorsOpened',
    ]);
    expect(
      timeline.boundaries
        .filter((boundary) => boundary.kind === 'wheelsOpen')
        .map((boundary) => boundary.wheelKey),
    ).toEqual(['wheel1', 'wheel2']);
    expect(timeline.boundaries.filter((boundary) => boundary.kind === 'doorsOpened')).toHaveLength(
      1,
    );
    expect(
      timeline.entries.filter(
        (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'wheelsOpen',
      )[0],
    ).toMatchObject({
      rank: 0,
      placement: 'after',
    });
    const wheelOnePickup = timeline.entries.findIndex(
      (entry) => entry.kind === 'action' && entry.action.key === roomActionKey(reward1),
    );
    const combatTwoStart = timeline.entries.findIndex(
      (entry) => entry.kind === 'boundary' && entry.boundary.key === 'encounterStarted:Combat2',
    );
    const wheelTwoStart = timeline.entries.findIndex(
      (entry) => entry.kind === 'boundary' && entry.boundary.key === 'wheelsOpen:wheel2',
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
        (entry) => entry.kind === 'boundary' && entry.boundary.key === 'wheelsOpen:wheel2',
      ),
    ).toMatchObject({ rank: 2, placement: 'after' });
  });

  it('places Ship automatic effects after each wheel interval and before the next boundary', () => {
    const choose1 = { kind: 'chooseRewardWheel' as const, wheelKey: 'wheel1' };
    const reward1 = { kind: 'interactWheelReward' as const, wheelKey: 'wheel1' };
    const choose2 = { kind: 'chooseRewardWheel' as const, wheelKey: 'wheel2' };
    const reward2 = { kind: 'interactWheelReward' as const, wheelKey: 'wheel2' };
    const wheelPhase = (phaseKey: 'Combat1' | 'Combat2', wheelKey: 'wheel1' | 'wheel2') =>
      Object.freeze({
        ...encounter(phaseKey),
        rewardAttachment: Object.freeze({
          kind: 'rewardWheel' as const,
          key: wheelKey,
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
      });
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'ShipCombatRoom',
      encounterPhases: Object.freeze([
        encounter('Intro'),
        wheelPhase('Combat1', 'wheel1'),
        wheelPhase('Combat2', 'wheel2'),
      ]),
      roomActionRoster: roster({
        rows: Object.freeze([
          rankedRow(choose1, { kind: 'beforeWheelPhase' as const, wheelKey: 'wheel1' }, 1),
          rankedRow(reward1, { kind: 'afterWheelPhase' as const, wheelKey: 'wheel1' }, 2),
          rankedRow(choose2, { kind: 'beforeWheelPhase' as const, wheelKey: 'wheel2' }, 3),
          rankedRow(reward2, { kind: 'afterWheelPhase' as const, wheelKey: 'wheel2' }, 4),
        ]),
      }),
    });
    const steadyGrowth = steadyGrowthAt('Combat1');
    const embryo = embryoAt('Combat2');
    const enriched = appendTranscendentEmbryoTimelineEffects(
      appendSteadyGrowthTimelineEffects(timeline, [steadyGrowth]),
      [embryo],
    );
    const entries = enriched.entries;
    const indexOf = (predicate: (entry: (typeof entries)[number]) => boolean) =>
      entries.findIndex(predicate);
    const wheel1 = indexOf(
      (entry) => entry.kind === 'action' && entry.action.key === roomActionKey(reward1),
    );
    const effect1 = indexOf(
      (entry) => entry.kind === 'automaticEffect' && entry.address === steadyGrowth.address,
    );
    const nextPhase = indexOf(
      (entry) =>
        entry.kind === 'boundary' &&
        entry.boundary.kind === 'wheelsOpen' &&
        entry.boundary.wheelKey === 'wheel2',
    );
    const wheel2 = indexOf(
      (entry) => entry.kind === 'action' && entry.action.key === roomActionKey(reward2),
    );
    const effect2 = indexOf(
      (entry) => entry.kind === 'automaticEffect' && entry.address === embryo.address,
    );
    const cleanup = indexOf(
      (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'doorsOpened',
    );

    expect(effect1).toBe(wheel1 + 1);
    expect(effect1).toBeLessThan(nextPhase);
    expect(effect2).toBe(wheel2 + 1);
    expect(effect2).toBeLessThan(cleanup);
  });

  it('keeps a Ship optional generated pickup after its required end-effect checkpoint', () => {
    const choose = { kind: 'chooseRewardWheel' as const, wheelKey: 'wheel1' };
    const wheel = { kind: 'interactWheelReward' as const, wheelKey: 'wheel1' };
    const generated = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit',
      entryKey: 'clockedTraitGenerated:wheel-child',
      encounterPhaseKey: 'Combat1',
    };
    const timeline = assembleRoomLifecycleTimeline({
      owner,
      lifecycleProfileKey: 'ShipCombatRoom',
      encounterPhases: Object.freeze([
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
      ]),
      roomActionRoster: roster({
        rows: Object.freeze([
          rankedRow(choose, { kind: 'beforeWheelPhase' as const, wheelKey: 'wheel1' }, 1),
          rankedRow(wheel, { kind: 'afterWheelPhase' as const, wheelKey: 'wheel1' }, 2),
          rankedRow(
            generated,
            { kind: 'afterWheelPhase' as const, wheelKey: 'wheel1' },
            3,
            'optional',
          ),
        ]),
      }),
    });
    const steadyGrowth = steadyGrowthAt('Combat1');
    const entries = appendSteadyGrowthTimelineEffects(timeline, [steadyGrowth]).entries;
    const requiredIndex = entries.findIndex(
      (entry) => entry.kind === 'action' && entry.action.key === roomActionKey(wheel),
    );
    const effectIndex = entries.findIndex(
      (entry) => entry.kind === 'automaticEffect' && entry.address === steadyGrowth.address,
    );
    const optionalIndex = entries.findIndex(
      (entry) => entry.kind === 'action' && entry.action.key === roomActionKey(generated),
    );

    expect(effectIndex).toBe(requiredIndex + 1);
    // The doors open right after the last required item; the optional pickup follows them.
    expect(entries[effectIndex + 1]).toMatchObject({
      kind: 'boundary',
      boundary: { kind: 'doorsOpened' },
    });
    expect(optionalIndex).toBe(effectIndex + 2);
  });

  it('keeps a three-cage Fields permutation atomic with one visible Cleanup boundary', () => {
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
      }),
    });
    expect(
      timeline.boundaries.map(
        (boundary) => `${boundary.kind}:${'phaseKey' in boundary ? boundary.phaseKey : ''}`,
      ),
    ).toEqual([
      'roomEntered:',
      'encounterBegun:Cage03',
      'encounterStarted:Cage03',
      'encounterEnd:Cage03',
      'encounterBegun:Cage01',
      'encounterStarted:Cage01',
      'encounterEnd:Cage01',
      'encounterBegun:Cage02',
      'encounterStarted:Cage02',
      'encounterEnd:Cage02',
      'doorsOpened:',
    ]);
    for (const [phaseKey, completionKey] of [
      ['Cage03', roomActionKey(cage3)],
      ['Cage01', roomActionKey(cage1)],
      ['Cage02', roomActionKey(cage2)],
    ] as const) {
      // Each cage's row begins its fight; nothing stands between them and its end.
      const row = timeline.entries.findIndex(
        (entry) => entry.kind === 'action' && entry.action.key === completionKey,
      );
      expect(
        timeline.entries
          .slice(row + 1, row + 4)
          .map((entry) => (entry.kind === 'boundary' ? entry.boundary.key : entry.kind)),
      ).toEqual([
        `encounterBegun:${phaseKey}`,
        `encounterStarted:${phaseKey}`,
        `encounterEnd:${phaseKey}`,
      ]);
    }
  });
});

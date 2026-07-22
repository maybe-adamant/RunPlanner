import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import {
  executeRoomLifecycle,
  LifecycleExecutionContractError,
  type RoomLifecycleExecutionInput,
} from '@run-planner/engine/simulation';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

const origin = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('f-lifecycle-fixture'),
);

function input(overrides: Partial<RoomLifecycleExecutionInput> = {}): RoomLifecycleExecutionInput {
  return {
    origin,
    lifecycleProfileKey: 'StandardRewardRoom',
    encounterProfileKey: 'SingleCountedCombat',
    producer: {
      lifecycleProfileKey: 'RoomReward',
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    },
    counterEffects: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    ...overrides,
  };
}

function inputWithoutProducer(
  overrides: Partial<Omit<RoomLifecycleExecutionInput, 'producer'>> = {},
): RoomLifecycleExecutionInput {
  const executionInput = input(overrides);
  return {
    origin: executionInput.origin,
    lifecycleProfileKey: executionInput.lifecycleProfileKey,
    encounterProfileKey: executionInput.encounterProfileKey,
    counterEffects: executionInput.counterEffects,
  };
}

function eventKinds(executionInput: RoomLifecycleExecutionInput) {
  return executeRoomLifecycle(catalog, executionInput).events.map((event) => event.kind);
}

describe('single-room lifecycle execution', () => {
  it('executes every active Fields encounter phase in declaration order', () => {
    const events = executeRoomLifecycle(
      catalog,
      inputWithoutProducer({
        lifecycleProfileKey: 'FieldsCombatRoom',
        encounterProfileKey: 'H_FieldsCombatCage2',
      }),
    ).events;

    expect(
      events.filter((event) => event.kind === 'encounterStarted').map((event) => event.phaseKey),
    ).toEqual(['Passive', 'Cage01', 'Cage02']);
    expect(
      events
        .filter((event) => event.kind === 'encounterDepthAdvanced')
        .map((event) => event.phaseKey),
    ).toEqual(['Cage01', 'Cage02']);
    expect(
      events.filter((event) => event.kind === 'encounterCompleted').map((event) => event.phaseKey),
    ).toEqual(['Passive', 'Cage01', 'Cage02']);
  });

  it('advances the standard producer role before outgoing generation and commit effects', () => {
    const fragment = executeRoomLifecycle(catalog, input());

    expect(fragment.events.map((event) => event.kind)).toEqual([
      'roomPrepared',
      'roomEntered',
      'encounterStarted',
      'encounterDepthAdvanced',
      'encounterCompleted',
      'producerRoleAdvanced',
      'outgoingGenerationCheckpoint',
      'roomCommitted',
      'roomCountersAdvanced',
      'roomExited',
    ]);
    expect(fragment.events[5]).toMatchObject({
      kind: 'producerRoleAdvanced',
      rewardType: 'Boon',
      role: 'source',
      lifecyclePoint: 'roomRewardPickup',
    });
    expect(fragment.events[8]).toMatchObject({
      kind: 'roomCountersAdvanced',
      biomeDepthCacheDelta: 1,
      roomHistoryOrdinalDelta: 1,
    });
    expect(fragment.events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(fragment.events.every((event) => event.origin === origin)).toBe(true);
    expect(Object.isFrozen(fragment)).toBe(true);
    expect(Object.isFrozen(fragment.events)).toBe(true);
    expect(fragment.events.every(Object.isFrozen)).toBe(true);
  });

  it('composes Devotion role timing from the producer lifecycle declaration', () => {
    const fragment = executeRoomLifecycle(
      catalog,
      input({
        producer: {
          lifecycleProfileKey: 'RoomReward',
          offer: {
            rewardType: 'Devotion',
            payload: {
              kind: 'DevotionPair',
              chosenSource: 'ApolloUpgrade',
              spurnedSource: 'ZeusUpgrade',
            },
          },
        },
      }),
    );
    const roles = fragment.events.filter((event) => event.kind === 'producerRoleAdvanced');

    expect(roles).toEqual([
      expect.objectContaining({
        role: 'chosenSource',
        lifecyclePoint: 'beforeCombat',
      }),
      expect.objectContaining({
        role: 'spurnedSource',
        lifecyclePoint: 'afterCombat',
      }),
    ]);
    expect(fragment.events.indexOf(roles[0]!)).toBeLessThan(
      fragment.events.findIndex((event) => event.kind === 'encounterStarted'),
    );
    expect(fragment.events.indexOf(roles[1]!)).toBeGreaterThan(
      fragment.events.findIndex((event) => event.kind === 'encounterCompleted'),
    );
    expect(fragment.events.indexOf(roles[1]!)).toBeLessThan(
      fragment.events.findIndex((event) => event.kind === 'outgoingGenerationCheckpoint'),
    );
  });

  it('acquires the Ephyra opening reward before its delayed counting encounter', () => {
    const fragment = executeRoomLifecycle(
      catalog,
      input({
        origin: createOccurrenceAddress(
          createBiomeAddress('Surface', 'N'),
          createOccurrenceId('n-opening-lifecycle-fixture'),
        ),
        lifecycleProfileKey: 'EphyraOpeningRoom',
        encounterProfileKey: 'N_Opening',
      }),
    );

    expect(fragment.events.map((event) => event.kind)).toEqual([
      'roomPrepared',
      'roomEntered',
      'producerRoleAdvanced',
      'encounterStarted',
      'encounterDepthAdvanced',
      'encounterCompleted',
      'outgoingGenerationCheckpoint',
      'roomCommitted',
      'roomCountersAdvanced',
      'roomExited',
    ]);
    expect(fragment.events[2]).toMatchObject({
      kind: 'producerRoleAdvanced',
      lifecyclePoint: 'roomRewardPickup',
    });
  });

  it('executes Ephyra Soul Pylon timing between room entry and outgoing generation', () => {
    const fragment = executeRoomLifecycle(
      catalog,
      input({
        origin: createOccurrenceAddress(
          createBiomeAddress('Surface', 'N'),
          createOccurrenceId('n-lifecycle-fixture'),
        ),
        lifecycleProfileKey: 'EphyraMainRoom',
        encounterProfileKey: 'SingleCountedCombat',
        requiredObjects: [
          {
            key: 'SoulPylon',
            spawnTiming: 'roomEntry',
            completionRequirement: 'destroyBeforeExit',
          },
        ],
      }),
    );

    expect(fragment.events.map((event) => event.kind)).toEqual([
      'roomPrepared',
      'roomEntered',
      'requiredObjectSpawned',
      'encounterStarted',
      'encounterDepthAdvanced',
      'encounterCompleted',
      'requiredObjectCompleted',
      'producerRoleAdvanced',
      'outgoingGenerationCheckpoint',
      'roomCommitted',
      'roomCountersAdvanced',
      'roomExited',
    ]);
    expect(fragment.events[2]).toMatchObject({
      kind: 'requiredObjectSpawned',
      objectKey: 'SoulPylon',
      completionRequirement: 'destroyBeforeExit',
    });
    expect(fragment.events[6]).toMatchObject({
      kind: 'requiredObjectCompleted',
      objectKey: 'SoulPylon',
    });
  });

  it('keeps WorldShop outgoing generation before purchases', () => {
    const fragment = executeRoomLifecycle(
      catalog,
      input({
        lifecycleProfileKey: 'WorldShopRoom',
        encounterProfileKey: 'Shop',
        producer: { lifecycleProfileKey: 'RoomReward', offer: { rewardType: 'Shop' } },
      }),
    );

    expect(fragment.events.map((event) => event.kind)).toEqual([
      'roomPrepared',
      'offerPointMaterialized',
      'roomEntered',
      'outgoingGenerationCheckpoint',
      'shopPurchasesApplied',
      'roomCommitted',
      'roomCountersAdvanced',
      'roomExited',
    ]);
    expect(fragment.events[1]).toMatchObject({ offerPoint: 'shopInventory' });
    expect(fragment.events[4]).toMatchObject({ offerPoint: 'shopInventory' });
  });

  it('records entered-store provenance as a commit-time effect', () => {
    const fragment = executeRoomLifecycle(
      catalog,
      input({ enteredRewardStoreKey: 'MetaProgress' }),
    );
    const store = fragment.events.find((event) => event.kind === 'enteredRewardStoreRecorded');

    expect(store).toMatchObject({
      kind: 'enteredRewardStoreRecorded',
      storeKey: 'MetaProgress',
    });
    expect(fragment.events.indexOf(store!)).toBeGreaterThan(
      fragment.events.findIndex((event) => event.kind === 'roomCountersAdvanced'),
    );
    expect(fragment.events.indexOf(store!)).toBeLessThan(
      fragment.events.findIndex((event) => event.kind === 'roomExited'),
    );
  });

  it('omits encounter-depth facts for non-counting terminal and completion encounters', () => {
    const terminalReward = executeRoomLifecycle(
      catalog,
      input({
        lifecycleProfileKey: 'TerminalRewardRoom',
        encounterProfileKey: 'Shop',
      }),
    );
    expect(terminalReward.events.map((event) => event.kind)).not.toContain(
      'encounterDepthAdvanced',
    );
    expect(terminalReward.events.find((event) => event.kind === 'encounterStarted')).toMatchObject({
      phaseKey: 'Shop',
      phaseKind: 'nonCombat',
      baselineEncounterKey: 'Shop',
    });
    expect(
      eventKinds(
        inputWithoutProducer({
          lifecycleProfileKey: 'BossRoom',
          encounterProfileKey: 'F_Boss01',
        }),
      ),
    ).not.toContain('encounterDepthAdvanced');
    expect(
      eventKinds(
        inputWithoutProducer({
          lifecycleProfileKey: 'PostBossRoom',
          encounterProfileKey: 'F_PostBoss01',
        }),
      ),
    ).not.toContain('encounterDepthAdvanced');
  });

  it('omits outgoing generation from terminal profiles and remains deterministic', () => {
    const executionInput = input({
      lifecycleProfileKey: 'TerminalWorldShopRoom',
      encounterProfileKey: 'Shop',
      producer: { lifecycleProfileKey: 'RoomReward', offer: { rewardType: 'Shop' } },
    });
    const first = executeRoomLifecycle(catalog, executionInput);
    const second = executeRoomLifecycle(catalog, executionInput);

    expect(first).toEqual(second);
    expect(first.events.map((event) => event.kind)).not.toContain('outgoingGenerationCheckpoint');
  });

  it('fails unknown and incompatible execution references at the executor boundary', () => {
    const cases: readonly [RoomLifecycleExecutionInput, string][] = [
      [input({ lifecycleProfileKey: 'Missing' }), 'unknown room lifecycle profile Missing'],
      [input({ encounterProfileKey: 'Missing' }), 'unknown encounter profile Missing'],
      [input({ encounterProfileKey: 'Shop' }), 'Shop is incompatible with StandardRewardRoom'],
      [input({ enteredRewardStoreKey: 'Missing' }), 'unknown entered reward store Missing'],
      [inputWithoutProducer(), 'StandardRewardRoom requires a producer'],
      [
        input({
          lifecycleProfileKey: 'EphyraMainRoom',
          encounterProfileKey: 'SingleCountedCombat',
        }),
        'EphyraMainRoom required-object operations do not match lifecycle input',
      ],
      [
        input({ lifecycleProfileKey: 'BossRoom', encounterProfileKey: 'F_Boss01' }),
        'BossRoom does not accept a producer',
      ],
      [
        input({
          producer: {
            lifecycleProfileKey: 'Missing',
            offer: { rewardType: 'Boon' },
          },
        }),
        'Missing is incompatible with StandardRewardRoom',
      ],
      [
        input({
          producer: {
            lifecycleProfileKey: 'RoomReward',
            offer: { rewardType: 'Missing' },
          },
        }),
        'Missing is unsupported by RoomReward',
      ],
    ];

    for (const [executionInput, message] of cases) {
      expect(() => executeRoomLifecycle(catalog, executionInput)).toThrowError(
        new LifecycleExecutionContractError(message),
      );
    }
  });
});

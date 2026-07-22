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
import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from './compiler/createCatalog';
import { declarations, type RawCatalogInput } from './declarations';
import { catalog } from './index';

const origin = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('f-lifecycle-fixture'),
);

function input(overrides: Partial<RoomLifecycleExecutionInput> = {}): RoomLifecycleExecutionInput {
  return {
    origin,
    lifecycleProfileKey: 'StandardRewardRoom',
    encounterProfileKey: 'StandardCombat',
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

function malformedCatalog(value: unknown): RawCatalogInput {
  return value as RawCatalogInput;
}

function eventKinds(executionInput: RoomLifecycleExecutionInput) {
  return executeRoomLifecycle(catalog, executionInput).events.map((event) => event.kind);
}

describe('room lifecycle catalog', () => {
  it('normalizes reusable lifecycle profiles as immutable catalog data', () => {
    expect(catalog.roomLifecycleProfiles.values.map((profile) => profile.key)).toEqual([
      'StandardRewardRoom',
      'RewardlessCombatRoom',
      'EphyraOpeningRoom',
      'EphyraMainRoom',
      'EphyraSideRoom',
      'EphyraHubRoom',
      'ClockworkGoalRoom',
      'RewardlessRoom',
      'DevotionRoom',
      'FieldsCombatRoom',
      'ShipCombatRoom',
      'WorldShopRoom',
      'TerminalRewardRoom',
      'TerminalWorldShopRoom',
      'BossRoom',
      'PostBossRoom',
    ]);
    expect(catalog.roomLifecycleProfiles.byKey.StandardRewardRoom?.producer).toEqual({
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
    });
    expect(catalog.roomLifecycleProfiles.byKey.ClockworkGoalRoom?.producer).toEqual({
      kind: 'none',
    });
    expect(Object.isFrozen(catalog.roomLifecycleProfiles.values)).toBe(true);
    expect(
      Object.isFrozen(catalog.roomLifecycleProfiles.byKey.StandardRewardRoom?.operations),
    ).toBe(true);
  });

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

  it('rejects unknown operation, effect, producer point, and encounter references', () => {
    const base = declarations.roomLifecycleProfiles[0];
    if (base === undefined) {
      throw new Error('standard lifecycle declaration is missing');
    }
    const cases = [
      {
        profile: {
          ...base,
          operations: [{ kind: 'mystery', effects: [] }, ...base.operations.slice(1)],
        },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].operations[0].kind',
          'unknown lifecycle operation mystery',
        ),
      },
      {
        profile: {
          ...base,
          operations: [{ kind: 'prepareRoom', effects: ['mystery'] }, ...base.operations.slice(1)],
        },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].operations[0].effects[0]',
          'unknown lifecycle effect mystery',
        ),
      },
      {
        profile: {
          ...base,
          operations: [
            { kind: 'prepareRoom', effects: ['recordAppearance'] },
            ...base.operations.slice(1),
          ],
        },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].operations[0].effects',
          'prepareRoom requires effects recordPreparation',
        ),
      },
      {
        profile: {
          ...base,
          operations: base.operations.map((operation) =>
            operation.kind === 'advanceProducer' && operation.point === 'beforeCombat'
              ? { ...operation, point: 'mystery' }
              : operation,
          ),
        },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].operations[2].point',
          'unknown producer lifecycle point mystery',
        ),
      },
      {
        profile: { ...base, encounterProfileKeys: ['MissingEncounter'] },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].encounterProfileKeys[0]',
          'unknown encounter profile MissingEncounter',
        ),
      },
      {
        profile: {
          ...base,
          producer: { kind: 'required', lifecycleProfileKeys: ['MissingProducer'] },
        },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].producer.lifecycleProfileKeys[0]',
          'unknown producer lifecycle MissingProducer',
        ),
      },
    ] as const;

    for (const fixture of cases) {
      expect(() =>
        createCatalog(
          malformedCatalog({
            ...declarations,
            roomLifecycleProfiles: [
              fixture.profile,
              ...declarations.roomLifecycleProfiles.slice(1),
            ],
          }),
        ),
      ).toThrowError(fixture.error);
    }
  });

  it('rejects outgoing generation while an encounter phase is active', () => {
    const base = declarations.roomLifecycleProfiles[0];
    const outgoing = base?.operations.find(
      (operation) => operation.kind === 'generateOutgoingBatch',
    );
    if (base === undefined || outgoing === undefined) {
      throw new Error('standard lifecycle declaration is incomplete');
    }

    expect(() =>
      createCatalog({
        ...declarations,
        roomLifecycleProfiles: [
          {
            ...base,
            operations: [...base.operations.slice(0, 4), outgoing, ...base.operations.slice(4)],
          },
          ...declarations.roomLifecycleProfiles.slice(1),
        ],
      }),
    ).toThrowError(
      new CatalogContractError(
        'roomLifecycleProfiles[0].operations[4].kind',
        'generateOutgoingBatch cannot interrupt an active encounter phase',
      ),
    );
  });

  it('rejects required-object timing outside the room-entry and exit-unlock boundary', () => {
    const base = declarations.roomLifecycleProfiles.find(
      (profile) => profile.key === 'EphyraMainRoom',
    );
    if (base === undefined) {
      throw new Error('Ephyra main lifecycle declaration is missing');
    }
    const profileIndex = declarations.roomLifecycleProfiles.indexOf(base);
    const spawnIndex = base.operations.findIndex(
      (operation) => operation.kind === 'spawnRequiredObjects',
    );
    const beforeCombatIndex = base.operations.findIndex(
      (operation) => operation.kind === 'advanceProducer' && operation.point === 'beforeCombat',
    );
    const completionIndex = base.operations.findIndex(
      (operation) => operation.kind === 'completeRequiredObjects',
    );
    const outgoingIndex = base.operations.findIndex(
      (operation) => operation.kind === 'generateOutgoingBatch',
    );
    if (spawnIndex < 0 || beforeCombatIndex < 0 || completionIndex < 0 || outgoingIndex < 0) {
      throw new Error('Ephyra main lifecycle declaration is incomplete');
    }

    const lateSpawn = [...base.operations];
    [lateSpawn[spawnIndex], lateSpawn[beforeCombatIndex]] = [
      lateSpawn[beforeCombatIndex]!,
      lateSpawn[spawnIndex]!,
    ];
    const prematureOutgoing = [...base.operations];
    [prematureOutgoing[completionIndex], prematureOutgoing[outgoingIndex]] = [
      prematureOutgoing[outgoingIndex]!,
      prematureOutgoing[completionIndex]!,
    ];

    const cases = [
      {
        operations: lateSpawn,
        error: new CatalogContractError(
          `roomLifecycleProfiles[${profileIndex}].operations[${beforeCombatIndex}].kind`,
          'required objects must spawn once immediately after room entry',
        ),
      },
      {
        operations: prematureOutgoing,
        error: new CatalogContractError(
          `roomLifecycleProfiles[${profileIndex}].operations[${completionIndex}].kind`,
          'generateOutgoingBatch requires completed required objects',
        ),
      },
    ];

    for (const fixture of cases) {
      expect(() =>
        createCatalog(
          malformedCatalog({
            ...declarations,
            roomLifecycleProfiles: declarations.roomLifecycleProfiles.map((profile) =>
              profile.key === base.key ? { ...base, operations: fixture.operations } : profile,
            ),
          }),
        ),
      ).toThrowError(fixture.error);
    }
  });
});

describe('single-room lifecycle execution', () => {
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
        encounterProfileKey: 'EphyraCombat',
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
    expect(
      eventKinds(
        input({
          lifecycleProfileKey: 'TerminalRewardRoom',
          encounterProfileKey: 'Preboss',
        }),
      ),
    ).not.toContain('encounterDepthAdvanced');
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
      encounterProfileKey: 'Preboss',
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
          encounterProfileKey: 'EphyraCombat',
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

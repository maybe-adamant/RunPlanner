import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  assembleRoomActionRoster,
  executeRoomLifecycle,
  LifecycleExecutionContractError,
  type ResolvedEncounterPhase,
  type RoomActionRosterContribution,
  type RoomLifecycleExecutionInput,
} from '@run-planner/engine/simulation';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

const origin = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('f-lifecycle-fixture'),
);

it('declares the Gate A ordinary producer-point mapping without a room-flat fallback', () => {
  const points = (profileKey: string) =>
    catalog.roomLifecycleProfiles.byKey[profileKey]?.operations.flatMap((operation) =>
      operation.kind === 'advanceProducer' ? [operation.point] : [],
    );

  expect({
    standard: points('StandardRewardRoom'),
    ephyraOpeningAndPreHub: points('EphyraOpeningRoom'),
    devotion: points('DevotionRoom'),
    prebossFree: points('PrebossFreeRewardRoom'),
  }).toEqual({
    standard: ['beforeCombat', 'afterCombat', 'roomRewardPickup'],
    ephyraOpeningAndPreHub: ['roomRewardPickup'],
    devotion: ['beforeCombat', 'afterCombat'],
    prebossFree: ['beforeCombat', 'afterCombat', 'roomRewardPickup'],
  });
});

function phases(
  encounterEnvelopeKey: string,
  encounterKeys: readonly string[],
): readonly ResolvedEncounterPhase[] {
  const envelope = catalog.encounterEnvelopes.byKey[encounterEnvelopeKey];
  if (envelope === undefined) throw new Error(`missing test envelope ${encounterEnvelopeKey}`);
  return Object.freeze(
    encounterKeys.map((encounterKey, index) => {
      const slot = envelope.slots[index];
      const definition = catalog.encounterDefinitions.byKey[encounterKey];
      if (slot === undefined || definition === undefined) {
        throw new Error(`missing test phase ${encounterEnvelopeKey}.${encounterKey}`);
      }
      return Object.freeze({
        slotKey: slot.key,
        envelopeKey: encounterEnvelopeKey,
        encounterKey,
        label: definition.label,
        kind: definition.kind,
        countsEncounterDepth: definition.countsEncounterDepth,
        canEncounterSkip: definition.canEncounterSkip,
        blocksFigLeaf: definition.blocksFigLeaf,
        blocksGorgon: definition.blocksGorgon,
        hostsGorgon: definition.hostsGorgon,
        skipEndEncounterEffects: definition.skipEndEncounterEffects,
        figLeafSkip: false,
        ...(definition.sequenceEffect === undefined
          ? {}
          : { sequenceEffect: definition.sequenceEffect }),
        ...(slot.rewardAttachment === undefined ? {} : { rewardAttachment: slot.rewardAttachment }),
      });
    }),
  );
}

function input(overrides: Partial<RoomLifecycleExecutionInput> = {}): RoomLifecycleExecutionInput {
  return {
    origin,
    lifecycleProfileKey: 'StandardRewardRoom',
    encounterEnvelopeKey: 'SingleEncounter',
    encounterPhases: phases('SingleEncounter', ['GeneratedF']),
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
    encounterEnvelopeKey: executionInput.encounterEnvelopeKey,
    ...(executionInput.encounterPhases === undefined
      ? {}
      : { encounterPhases: executionInput.encounterPhases }),
    ...(executionInput.requiredObjects === undefined
      ? {}
      : { requiredObjects: executionInput.requiredObjects }),
    ...(executionInput.roomActionRoster === undefined
      ? {}
      : { roomActionRoster: executionInput.roomActionRoster }),
    counterEffects: executionInput.counterEffects,
  };
}

function eventKinds(executionInput: RoomLifecycleExecutionInput) {
  return executeRoomLifecycle(catalog, executionInput).events.map((event) => event.kind);
}

function actionRoster(
  actionOrigin: typeof origin,
  order: readonly RoomActionReference[],
  contributions: readonly Omit<
    Extract<RoomActionRosterContribution, { readonly kind: 'action' }>,
    'kind' | 'owner'
  >[],
) {
  return assembleRoomActionRoster({
    owner: actionOrigin,
    order,
    contributions: contributions.map((entry) => ({
      kind: 'action' as const,
      owner: createRoomActionAddress(
        createBiomeAddress(actionOrigin.routeKey, actionOrigin.biomeKey),
        actionOrigin.occurrenceId,
        roomActionKey(entry.reference),
      ),
      ...entry,
    })),
  });
}

describe('single-room lifecycle execution', () => {
  it('advances the standard producer role before outgoing generation and commit effects', () => {
    const fragment = executeRoomLifecycle(catalog, input());

    expect(fragment.events.map((event) => event.kind)).toEqual([
      'roomPrepared',
      'encounterRecorded',
      'roomEntered',
      'producerPointReached',
      'encounterStarted',
      'encounterDepthAdvanced',
      'encounterCompleted',
      'producerPointReached',
      'producerPointReached',
      'producerRoleAdvanced',
      'outgoingGenerationCheckpoint',
      'roomCommitted',
      'roomCountersAdvanced',
      'roomExited',
    ]);
    expect(fragment.events[9]).toMatchObject({
      kind: 'producerRoleAdvanced',
      rewardType: 'Boon',
      role: 'source',
      lifecyclePoint: 'roomRewardPickup',
    });
    expect(fragment.events[12]).toMatchObject({
      kind: 'roomCountersAdvanced',
      biomeDepthCacheDelta: 1,
      roomHistoryOrdinalDelta: 1,
    });
    expect(fragment.events.map((event) => event.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ]);
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
        encounterEnvelopeKey: 'SingleEncounter',
        encounterPhases: phases('SingleEncounter', ['OpeningGeneratedN']),
      }),
    );

    expect(fragment.events.map((event) => event.kind)).toEqual([
      'roomPrepared',
      'encounterRecorded',
      'roomEntered',
      'producerPointReached',
      'producerRoleAdvanced',
      'encounterStarted',
      'encounterDepthAdvanced',
      'encounterCompleted',
      'outgoingGenerationCheckpoint',
      'roomCommitted',
      'roomCountersAdvanced',
      'roomExited',
    ]);
    expect(fragment.events[4]).toMatchObject({
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
        encounterEnvelopeKey: 'SingleEncounter',
        encounterPhases: phases('SingleEncounter', ['GeneratedN']),
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
      'encounterRecorded',
      'roomEntered',
      'requiredObjectSpawned',
      'producerPointReached',
      'encounterStarted',
      'encounterDepthAdvanced',
      'encounterCompleted',
      'requiredObjectCompleted',
      'producerPointReached',
      'producerPointReached',
      'producerRoleAdvanced',
      'outgoingGenerationCheckpoint',
      'roomCommitted',
      'roomCountersAdvanced',
      'roomExited',
    ]);
    expect(fragment.events[3]).toMatchObject({
      kind: 'requiredObjectSpawned',
      objectKey: 'SoulPylon',
      completionRequirement: 'destroyBeforeExit',
    });
    expect(fragment.events[8]).toMatchObject({
      kind: 'requiredObjectCompleted',
      objectKey: 'SoulPylon',
    });
  });

  it('keeps WorldShop outgoing generation before purchases', () => {
    const fragment = executeRoomLifecycle(
      catalog,
      input({
        lifecycleProfileKey: 'WorldShopRoom',
        encounterEnvelopeKey: 'SingleEncounter',
        encounterPhases: phases('SingleEncounter', ['Shop']),
        producer: { lifecycleProfileKey: 'RoomReward', offer: { rewardType: 'Shop' } },
      }),
    );

    expect(fragment.events.map((event) => event.kind)).toEqual([
      'roomPrepared',
      'encounterRecorded',
      'offerPointMaterialized',
      'roomEntered',
      'outgoingGenerationCheckpoint',
      'acquisitionPointReached',
      'roomCommitted',
      'roomCountersAdvanced',
      'roomExited',
    ]);
    expect(fragment.events[2]).toMatchObject({ offerPoint: 'shopInventory' });
    expect(fragment.events[5]).toMatchObject({
      kind: 'acquisitionPointReached',
      point: 'roomExit',
    });
  });

  it('blocks before Wheel 2 when the required Wheel 1 pickup is unranked', () => {
    const shipOrigin = createOccurrenceAddress(
      createBiomeAddress('Surface', 'O'),
      createOccurrenceId('o-unranked-wheel-lifecycle'),
    );
    const choose1 = { kind: 'chooseRewardWheel' as const, wheelKey: 'wheel1' };
    const pickup1 = { kind: 'interactWheelReward' as const, wheelKey: 'wheel1' };
    const choose2 = { kind: 'chooseRewardWheel' as const, wheelKey: 'wheel2' };
    const pickup2 = { kind: 'interactWheelReward' as const, wheelKey: 'wheel2' };
    const roster = actionRoster(
      shipOrigin,
      [choose1, choose2, pickup2],
      [
        {
          reference: choose1,
          participation: 'required',
          window: { kind: 'shipPreCombat', wheelKey: 'wheel1' },
          dependencies: [],
        },
        {
          reference: pickup1,
          participation: 'required',
          window: { kind: 'shipPostCombat', wheelKey: 'wheel1' },
          dependencies: [{ kind: 'afterAction', action: choose1 }],
        },
        {
          reference: choose2,
          participation: 'required',
          window: { kind: 'shipPreCombat', wheelKey: 'wheel2' },
          dependencies: [],
        },
        {
          reference: pickup2,
          participation: 'required',
          window: { kind: 'shipPostCombat', wheelKey: 'wheel2' },
          dependencies: [{ kind: 'afterAction', action: choose2 }],
        },
      ],
    );
    const fragment = executeRoomLifecycle(
      catalog,
      inputWithoutProducer({
        origin: shipOrigin,
        lifecycleProfileKey: 'ShipCombatRoom',
        encounterEnvelopeKey: 'ShipEncounter',
        encounterPhases: phases('ShipEncounter', [
          'GeneratedO_Intro01',
          'GeneratedO',
          'GeneratedO',
        ]),
        offerPointRewardStores: { wheel1: 'MetaProgress', wheel2: 'RunProgress' },
        roomActionRoster: roster,
      }),
    );

    expect(fragment.blockedAt?.actionKey).toBe(roomActionKey(pickup1));
    expect(
      fragment.events
        .filter((event) => event.kind === 'offerPointMaterialized')
        .map((event) => (event.kind === 'offerPointMaterialized' ? event.offerPoint : '')),
    ).toEqual(['wheel1']);
    expect(
      fragment.events.some(
        (event) => event.kind === 'encounterStarted' && event.phaseKey === 'Combat2',
      ),
    ).toBe(false);
  });

  it('requires a same-phase Fields cage before its NPC contact and never lets contact complete combat', () => {
    const fieldsOrigin = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'H'),
      createOccurrenceId('h-cage-contact-lifecycle'),
    );
    const complete = { kind: 'completeFieldsCage' as const, phaseKey: 'Cage01' };
    const contact = { kind: 'interactEncounter' as const, phaseKey: 'Cage01' };
    const contributions = [
      {
        reference: complete,
        participation: 'required' as const,
        window: { kind: 'fields' as const },
        dependencies: [],
      },
      {
        reference: contact,
        participation: 'required' as const,
        window: { kind: 'fields' as const, phaseKey: 'Cage01' },
        dependencies: [{ kind: 'afterAction' as const, action: complete }],
      },
    ];
    const invalid = executeRoomLifecycle(
      catalog,
      inputWithoutProducer({
        origin: fieldsOrigin,
        lifecycleProfileKey: 'FieldsCombatRoom',
        encounterEnvelopeKey: 'FieldsEncounter',
        encounterPhases: phases('FieldsEncounter', ['GeneratedH_Passive', 'GeneratedH']),
        roomActionRoster: actionRoster(fieldsOrigin, [contact, complete], contributions),
      }),
    );
    expect(invalid.blockedAt?.actionKey).toBe(roomActionKey(contact));
    expect(
      invalid.events.some(
        (event) => event.kind === 'encounterStarted' && event.phaseKey === 'Cage01',
      ),
    ).toBe(false);

    const valid = executeRoomLifecycle(
      catalog,
      inputWithoutProducer({
        origin: fieldsOrigin,
        lifecycleProfileKey: 'FieldsCombatRoom',
        encounterEnvelopeKey: 'FieldsEncounter',
        encounterPhases: phases('FieldsEncounter', ['GeneratedH_Passive', 'GeneratedH']),
        roomActionRoster: actionRoster(fieldsOrigin, [complete, contact], contributions),
      }),
    );
    const completionIndex = valid.events.findIndex(
      (event) => event.kind === 'encounterCompleted' && event.phaseKey === 'Cage01',
    );
    const contactIndex = valid.events.findIndex(
      (event) => event.kind === 'encounterInteractionReached' && event.phaseKey === 'Cage01',
    );
    expect(completionIndex).toBeGreaterThanOrEqual(0);
    expect(contactIndex).toBeGreaterThan(completionIndex);
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
        lifecycleProfileKey: 'PrebossFreeRewardRoom',
        encounterEnvelopeKey: 'SingleEncounter',
        encounterPhases: phases('SingleEncounter', ['Shop']),
      }),
    );
    expect(terminalReward.events.map((event) => event.kind)).not.toContain(
      'encounterDepthAdvanced',
    );
    expect(terminalReward.events.find((event) => event.kind === 'encounterStarted')).toMatchObject({
      phaseKey: 'Encounter',
      phaseKind: 'nonCombat',
      encounterKey: 'Shop',
    });
    expect(
      eventKinds(
        inputWithoutProducer({
          lifecycleProfileKey: 'BossRoom',
          encounterEnvelopeKey: 'SingleEncounter',
          encounterPhases: phases('SingleEncounter', ['BossHecate01']),
        }),
      ),
    ).not.toContain('encounterDepthAdvanced');
    expect(
      eventKinds(
        inputWithoutProducer({
          lifecycleProfileKey: 'PostBossRoom',
          encounterEnvelopeKey: 'SingleEncounter',
          encounterPhases: phases('SingleEncounter', ['Empty']),
        }),
      ),
    ).not.toContain('encounterDepthAdvanced');
  });

  it('omits outgoing generation from terminal profiles and remains deterministic', () => {
    const executionInput = input({
      lifecycleProfileKey: 'PrebossShopRoom',
      encounterEnvelopeKey: 'SingleEncounter',
      encounterPhases: phases('SingleEncounter', ['Shop']),
      producer: { lifecycleProfileKey: 'RoomReward', offer: { rewardType: 'Shop' } },
    });
    const first = executeRoomLifecycle(catalog, executionInput);
    const second = executeRoomLifecycle(catalog, executionInput);

    expect(first).toEqual(second);
    expect(first.events.map((event) => event.kind)).not.toContain('outgoingGenerationCheckpoint');
  });

  it.each([
    ['EphyraSideRoom', 'GeneratedF'],
    ['PrebossFreeRewardRoom', 'Shop'],
  ] as const)(
    'keeps a roster-enabled %s on its declaration-owned terminal lifecycle',
    (lifecycleProfileKey, encounterKey) => {
      const pickup = Object.freeze({
        kind: 'interactIncomingReward' as const,
        producerPoint: 'roomRewardPickup',
        acquisitionRole: 'source',
      });
      const fragment = executeRoomLifecycle(
        catalog,
        input({
          lifecycleProfileKey,
          encounterEnvelopeKey: 'SingleEncounter',
          encounterPhases: phases('SingleEncounter', [encounterKey]),
          roomActionRoster: actionRoster(
            origin,
            [pickup],
            [
              {
                reference: pickup,
                participation: 'required',
                window: { kind: 'standard', phase: 'afterCombat' },
                dependencies: [],
              },
            ],
          ),
        }),
      );

      expect(fragment.events.map((event) => event.kind)).not.toContain(
        'outgoingGenerationCheckpoint',
      );
      expect(fragment.events.map((event) => event.kind)).toContain('roomCommitted');
      expect(fragment.events.at(-1)?.kind).toBe('roomExited');
    },
  );

  it('fails unknown and incompatible execution references at the executor boundary', () => {
    const cases: readonly [RoomLifecycleExecutionInput, string][] = [
      [input({ lifecycleProfileKey: 'Missing' }), 'unknown room lifecycle profile Missing'],
      [input({ encounterEnvelopeKey: 'Missing' }), 'unknown encounter envelope Missing'],
      [
        input({ encounterEnvelopeKey: 'EmptyEncounter', encounterPhases: [] }),
        'EmptyEncounter is incompatible with StandardRewardRoom',
      ],
      [input({ enteredRewardStoreKey: 'Missing' }), 'unknown entered reward store Missing'],
      [inputWithoutProducer(), 'StandardRewardRoom requires a producer'],
      [
        input({
          lifecycleProfileKey: 'EphyraMainRoom',
          encounterEnvelopeKey: 'SingleEncounter',
          encounterPhases: phases('SingleEncounter', ['GeneratedN']),
        }),
        'EphyraMainRoom required-object operations do not match lifecycle input',
      ],
      [
        input({
          lifecycleProfileKey: 'BossRoom',
          encounterEnvelopeKey: 'SingleEncounter',
          encounterPhases: phases('SingleEncounter', ['BossHecate01']),
        }),
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

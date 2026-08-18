import { catalog, CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '@run-planner/hades2-catalog/test-support';
import { describe, expect, it } from 'vitest';

function malformedCatalog(value: unknown): RawCatalogInput {
  return value as RawCatalogInput;
}

describe('room lifecycle catalog', () => {
  it.each([
    ['unknown profile', 'MissingLifecycle', /unknown room lifecycle profile/],
    ['incompatible envelope', 'PCombatRoom', /does not support the room encounter envelope/],
  ])('rejects Narcissus room lifecycle with %s', (_name, lifecycleProfileKey, message) => {
    expect(() =>
      createCatalog(
        malformedCatalog({
          ...declarations,
          rooms: declarations.rooms.map((room) =>
            room.gameName === 'G_Story01' ? { ...room, lifecycleProfileKey } : room,
          ),
        }),
      ),
    ).toThrow(message);
  });

  it('normalizes reusable lifecycle profiles as immutable catalog data', () => {
    expect(catalog.roomLifecycleProfiles.values.map((profile) => profile.key)).toEqual([
      'StandardRewardRoom',
      'RewardlessCombatRoom',
      'PCombatRoom',
      'EphyraOpeningRoom',
      'EphyraMainRoom',
      'EphyraSideRoom',
      'EphyraHubRoom',
      'ClockworkGoalRoom',
      'StoryPickupRoom',
      'RewardlessRoom',
      'DevotionRoom',
      'FieldsCombatRoom',
      'ShipCombatRoom',
      'WorldShopRoom',
      'PrebossFreeRewardRoom',
      'PrebossShopRoom',
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

  it('keeps Fields cage encounters on the declaration-owned sequence operation', () => {
    expect(catalog.roomLifecycleProfiles.byKey.FieldsCombatRoom?.operations).toContainEqual({
      kind: 'runEncounterSequence',
      effects: ['recordEncounterStart', 'advanceEncounterDepth', 'recordEncounterCompletion'],
    });
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
          'prepareRoom requires effects recordPreparation, recordEncounter',
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
        profile: { ...base, encounterEnvelopeKeys: ['MissingEncounter'] },
        error: new CatalogContractError(
          'roomLifecycleProfiles[0].encounterEnvelopeKeys[0]',
          'unknown encounter envelope MissingEncounter',
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

  it('rejects duplicate explicit acquisition-point settlement', () => {
    const shopProfile = declarations.roomLifecycleProfiles.find(
      (profile) => profile.key === 'WorldShopRoom',
    );
    if (shopProfile === undefined) {
      throw new Error('World Shop lifecycle declaration is missing');
    }
    const profileIndex = declarations.roomLifecycleProfiles.indexOf(shopProfile);
    const settlementIndex = shopProfile.operations.findIndex(
      (operation) => operation.kind === 'settleAcquisitionPoint',
    );
    if (settlementIndex < 0) {
      throw new Error('World Shop lifecycle declaration has no acquisition-point settlement');
    }
    const settlement = shopProfile.operations[settlementIndex];
    if (settlement?.kind !== 'settleAcquisitionPoint') {
      throw new Error('World Shop lifecycle settlement is malformed');
    }
    const operations = [...shopProfile.operations];
    operations.splice(settlementIndex + 1, 0, settlement);

    expect(() =>
      createCatalog(
        malformedCatalog({
          ...declarations,
          roomLifecycleProfiles: declarations.roomLifecycleProfiles.map((profile) =>
            profile.key === shopProfile.key ? { ...profile, operations } : profile,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `roomLifecycleProfiles[${profileIndex}].operations[${settlementIndex + 1}].point`,
        'duplicates acquisition point roomExit',
      ),
    );
  });

  it('rejects reward encounter sequences without a reward-wheel slot', () => {
    const shipProfile = declarations.roomLifecycleProfiles.find(
      (profile) => profile.key === 'ShipCombatRoom',
    );
    if (shipProfile === undefined) {
      throw new Error('Ship combat lifecycle declaration is missing');
    }
    const profileIndex = declarations.roomLifecycleProfiles.indexOf(shipProfile);

    expect(() =>
      createCatalog(
        malformedCatalog({
          ...declarations,
          roomLifecycleProfiles: declarations.roomLifecycleProfiles.map((profile) =>
            profile.key === 'ShipCombatRoom'
              ? { ...profile, encounterEnvelopeKeys: ['PEncounter'] }
              : profile,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `roomLifecycleProfiles[${profileIndex}].encounterEnvelopeKeys[0]`,
        'PEncounter must expose a reward-wheel slot for runRewardEncounterSequence',
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

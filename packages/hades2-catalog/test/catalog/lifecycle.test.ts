import { catalog, CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '@run-planner/hades2-catalog/test-support';
import { describe, expect, it } from 'vitest';

function malformedCatalog(value: unknown): RawCatalogInput {
  return value as RawCatalogInput;
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

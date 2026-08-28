import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '@run-planner/hades2-catalog/test-support';

import { createCollection } from '../../src/compiler/common';
import { validateRoomLayoutClosure } from '../../src/compiler/room-layout-closure';

function input(): RawCatalogInput {
  return JSON.parse(JSON.stringify(declarations)) as RawCatalogInput;
}

describe('room-layout compiler closure', () => {
  it('closes Preboss policies against complete layout, room, and exit-policy collections', () => {
    const fixture = input();
    expect(() =>
      createCatalog({
        ...fixture,
        rooms: fixture.rooms.map((room) =>
          room.gameName === 'F_PreBoss01'
            ? { ...room, caps: { ...room.caps, maxCreationsPerRoom: 1 } }
            : room,
        ),
      }),
    ).toThrow(CatalogContractError);

    const runCapFixture = input();
    expect(() =>
      createCatalog({
        ...runCapFixture,
        rooms: runCapFixture.rooms.map((room) =>
          room.gameName === 'F_PreBoss01'
            ? { ...room, caps: { ...room.caps, maxCreationsThisRun: 1 } }
            : room,
        ),
      }),
    ).toThrow(CatalogContractError);

    const incompatible = input();
    expect(() =>
      createCatalog({
        ...incompatible,
        rooms: incompatible.rooms.map((room) =>
          room.gameName === 'P_PreBoss01' ? { ...room, structuralTags: ['Outdoor'] } : room,
        ),
      }),
    ).toThrow(CatalogContractError);

    const unreachableFixture = input();
    const countedPolicy = unreachableFixture.rooms.find(
      (room) => room.gameName === 'F_PreBoss01',
    )?.prebossBatchPolicy;
    if (countedPolicy === undefined) throw new Error('missing F Preboss policy');
    expect(() =>
      createCatalog({
        ...unreachableFixture,
        rooms: unreachableFixture.rooms.map((room) =>
          room.gameName === 'O_PreBoss01' ? { ...room, prebossBatchPolicy: countedPolicy } : room,
        ),
      }),
    ).toThrow(CatalogContractError);

    const widenedSourceFixture = input();
    expect(() =>
      createCatalog({
        ...widenedSourceFixture,
        rooms: widenedSourceFixture.rooms.map((room) =>
          room.gameName === 'Q_MiniBoss03'
            ? { ...room, exits: [...room.exits, { index: 2, type: 'TyphonExitDoor' }] }
            : room,
        ),
      }),
    ).toThrow(CatalogContractError);

    const widthOneFixture = input();
    const widthOnePolicy = widthOneFixture.rooms.find(
      (room) => room.gameName === 'O_PreBoss01',
    )?.prebossBatchPolicy;
    if (widthOnePolicy === undefined) throw new Error('missing O Preboss policy');
    expect(() =>
      createCatalog({
        ...widthOneFixture,
        rooms: widthOneFixture.rooms.map((room) =>
          room.gameName === 'F_PreBoss01' ? { ...room, prebossBatchPolicy: widthOnePolicy } : room,
        ),
      }),
    ).toThrow(CatalogContractError);
  });

  it('closes derived-room ownership and Hub reward lookups', () => {
    const catalog = createCatalog(declarations);
    expect(catalog.rooms.byKey.N_Hub?.mode).toEqual({ kind: 'derived', classification: 'hub' });
    expect(catalog.biomeLayouts.byKey.N?.progression).toMatchObject({
      kind: 'hub',
      rewardLookup: { key: 'hubRewardLookup', source: 'allOpenTargetOffers' },
    });

    const wrongLookup = input();
    const n = wrongLookup.biomeLayouts.find((layout) => layout.biomeKey === 'N');
    if (n === undefined || n.progression.kind !== 'hub') throw new Error('missing N Hub fixture');
    (n.progression as unknown as { rewardLookup: { key: string } }).rewardLookup.key =
      'notTheHubLookup';
    expect(() => createCatalog(wrongLookup)).toThrow(CatalogContractError);
  });

  it('rejects orphaned and multiply owned derived rooms after both collections are complete', () => {
    const catalog = createCatalog(declarations);
    const orphan = { ...catalog.rooms.byKey.N_Hub!, gameName: 'N_OrphanHub' };
    const roomsWithOrphan = createCollection(
      [...catalog.rooms.values, orphan],
      'rooms',
      (room) => room.gameName,
      'gameName',
    );
    expect(() =>
      validateRoomLayoutClosure(
        roomsWithOrphan,
        catalog.biomeLayouts,
        catalog.exitCompatibilityPolicies,
      ),
    ).toThrow(
      new CatalogContractError(
        `rooms[${catalog.rooms.values.length}].mode`,
        'N_OrphanHub has no layout owner',
      ),
    );

    const n = catalog.biomeLayouts.byKey.N!;
    const layoutsWithDuplicateOwner = createCollection(
      catalog.biomeLayouts.values.map((layout) =>
        layout.biomeKey === 'N'
          ? {
              ...layout,
              completion: {
                ...layout.completion,
                bossRoomGameName: 'N_Hub',
              },
            }
          : layout,
      ),
      'biomeLayouts',
      (layout) => layout.biomeKey,
      'biomeKey',
    );
    expect(n.progression.kind).toBe('hub');
    expect(() =>
      validateRoomLayoutClosure(
        catalog.rooms,
        layoutsWithDuplicateOwner,
        catalog.exitCompatibilityPolicies,
      ),
    ).toThrow(
      new CatalogContractError(
        'biomeLayouts.N.completion.bossRoomGameName',
        'N_Hub is already owned by biomeLayouts.N.progression.terminal',
      ),
    );
  });
});

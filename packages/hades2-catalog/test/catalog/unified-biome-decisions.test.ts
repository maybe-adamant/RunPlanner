import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '@run-planner/hades2-catalog/test-support';

function input(): RawCatalogInput {
  return JSON.parse(JSON.stringify(declarations)) as RawCatalogInput;
}

describe('unified biome decisions catalog', () => {
  it('normalizes every supported biome through one envelope and schema 9 catalog version', () => {
    const catalog = createCatalog(declarations);
    expect(catalog.version).toBe('0.15.0-unified-biome-decisions');
    expect(catalog.biomeLayouts.values.map((layout) => layout.biomeKey)).toEqual([
      'F',
      'G',
      'P',
      'Q',
      'H',
      'O',
      'I',
      'N',
    ]);
    for (const layout of catalog.biomeLayouts.values) {
      expect(layout).not.toHaveProperty('kind');
      expect(layout).not.toHaveProperty('terminal');
      expect(layout.start.kind === 'authoredChoice' || layout.start.kind === 'fixedAuthored').toBe(
        true,
      );
    }
  });

  it('declares common Preboss policy rather than template or terminal taxonomy', () => {
    const catalog = createCatalog(declarations);
    const takeover = [
      'F_PreBoss01',
      'G_PreBoss01',
      'H_PreBoss01',
      'O_PreBoss01',
      'P_PreBoss01',
      'Q_PreBoss01',
    ];
    for (const gameName of takeover) {
      const room = catalog.rooms.byKey[gameName];
      expect(room?.mode).toEqual({ kind: 'authored', templateKey: 'Preboss' });
      expect(room?.prebossBatchPolicy?.kind).toBe('takeOverNormalDoors');
    }
    expect(catalog.rooms.byKey.F_PreBoss01?.prebossBatchPolicy).toMatchObject({
      kind: 'takeOverNormalDoors',
      remainingOffers: { kind: 'counted' },
    });
    expect(catalog.rooms.byKey.O_PreBoss01?.prebossBatchPolicy).toEqual({
      kind: 'takeOverNormalDoors',
      remainingOffers: { kind: 'none' },
    });
    expect(catalog.rooms.byKey.I_PreBoss02?.prebossBatchPolicy).toEqual({
      kind: 'retainNormalPeers',
    });
    expect(
      catalog.rooms.values.some(
        (room) =>
          room.mode.kind === 'authored' && (room.mode.templateKey as string) === 'ForkedPreboss',
      ),
    ).toBe(false);
    expect(
      catalog.rooms.values.some(
        (room) =>
          room.mode.kind === 'authored' && (room.mode.templateKey as string) === 'ShopPreboss',
      ),
    ).toBe(false);
  });

  it('preserves every F-through-Q start and progression contract in the common envelope', () => {
    const catalog = createCatalog(declarations);
    expect(
      ['F', 'G', 'P', 'Q', 'H', 'O', 'I'].map((biomeKey) => {
        const layout = catalog.biomeLayouts.byKey[biomeKey];
        return {
          biomeKey,
          start: layout?.start,
          progression:
            layout?.progression.kind === 'generated'
              ? {
                  kind: layout.progression.kind,
                  policy: layout.progression.progressionPolicy.kind,
                  batch: layout.progression.batchPolicy.kind,
                  bounds: layout.progression.bounds,
                }
              : layout?.progression,
        };
      }),
    ).toEqual([
      {
        biomeKey: 'F',
        start: {
          kind: 'authoredChoice',
          roomGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'],
        },
        progression: {
          kind: 'generated',
          policy: 'eligibilityDriven',
          batch: 'standard',
          bounds: { maxBatches: 10, maxTargets: 20 },
        },
      },
      {
        biomeKey: 'G',
        start: { kind: 'fixedAuthored', roomGameName: 'G_Intro' },
        progression: {
          kind: 'generated',
          policy: 'eligibilityDriven',
          batch: 'standard',
          bounds: { maxBatches: 7, maxTargets: 21 },
        },
      },
      {
        biomeKey: 'P',
        start: { kind: 'fixedAuthored', roomGameName: 'P_Intro' },
        progression: {
          kind: 'generated',
          policy: 'eligibilityDriven',
          batch: 'standard',
          bounds: { maxBatches: 8, maxTargets: 16 },
        },
      },
      {
        biomeKey: 'Q',
        start: { kind: 'fixedAuthored', roomGameName: 'Q_Intro' },
        progression: {
          kind: 'generated',
          policy: 'staged',
          batch: 'standard',
          bounds: { maxBatches: 6, maxTargets: 8 },
        },
      },
      {
        biomeKey: 'H',
        start: { kind: 'fixedAuthored', roomGameName: 'H_Intro' },
        progression: {
          kind: 'generated',
          policy: 'fixedCount',
          batch: 'fields',
          bounds: { maxBatches: 4, maxTargets: 7 },
        },
      },
      {
        biomeKey: 'O',
        start: { kind: 'fixedAuthored', roomGameName: 'O_Intro' },
        progression: {
          kind: 'generated',
          policy: 'fixedCount',
          batch: 'standard',
          bounds: { maxBatches: 6, maxTargets: 6 },
        },
      },
      {
        biomeKey: 'I',
        start: { kind: 'fixedAuthored', roomGameName: 'I_Intro' },
        progression: {
          kind: 'generated',
          policy: 'eligibilityDriven',
          batch: 'clockwork',
          bounds: { maxBatches: 13, maxTargets: 23 },
        },
      },
    ]);
  });

  it('models N as fixed Opening, linked PreHub, Hub decision, then fixed width-one Preboss handoff', () => {
    const n = createCatalog(declarations).biomeLayouts.byKey.N;
    expect(n).toMatchObject({
      start: { kind: 'fixedAuthored', roomGameName: 'N_Opening01' },
      progression: {
        kind: 'hub',
        hubKey: 'hub',
        linkedExit: { kind: 'linked', exitKey: 'prehub', roomGameName: 'N_PreHub01' },
        completedExit: {
          kind: 'linked',
          exitKey: 'preboss',
          roomGameName: 'N_PreBoss01',
          physicalExit: {
            index: 1,
            type: 'EphyraExitBossDoor',
            compatibilityPolicyKey: 'Unconstrained',
          },
        },
      },
    });
  });

  it('rejects a missing Preboss policy and policy on a non-Preboss room', () => {
    const missing = input();
    const preboss = missing.rooms.find((room) => room.gameName === 'F_PreBoss01');
    if (preboss === undefined) throw new Error('missing F Preboss fixture');
    delete (preboss as { prebossBatchPolicy?: unknown }).prebossBatchPolicy;
    expect(() => createCatalog(missing)).toThrow(CatalogContractError);

    const misplaced = input();
    const combat = misplaced.rooms.find((room) => room.gameName === 'F_Combat01');
    if (combat === undefined) throw new Error('missing F Combat fixture');
    (combat as { prebossBatchPolicy?: unknown }).prebossBatchPolicy = {
      kind: 'takeOverNormalDoors',
      remainingOffers: { kind: 'none' },
    };
    expect(() => createCatalog(misplaced)).toThrow(CatalogContractError);
  });

  it('rejects unknown Preboss and remaining-offer policy discriminants', () => {
    const unknownPolicy = input();
    const outer = unknownPolicy.rooms.find((room) => room.gameName === 'F_PreBoss01');
    if (outer === undefined) throw new Error('missing F Preboss fixture');
    (outer as { prebossBatchPolicy: unknown }).prebossBatchPolicy = {
      kind: 'mystery',
      remainingOffers: { kind: 'none' },
    };
    expect(() => createCatalog(unknownPolicy)).toThrow(CatalogContractError);

    const unknownRemainingOffer = input();
    const inner = unknownRemainingOffer.rooms.find((room) => room.gameName === 'F_PreBoss01');
    if (inner === undefined) throw new Error('missing F Preboss fixture');
    (inner as { prebossBatchPolicy: unknown }).prebossBatchPolicy = {
      kind: 'takeOverNormalDoors',
      remainingOffers: { kind: 'mystery' },
    };
    expect(() => createCatalog(unknownRemainingOffer)).toThrow(CatalogContractError);
  });

  it('rejects a fixed start that is not the declared authored identity', () => {
    const malformed = input();
    const n = malformed.biomeLayouts.find((layout) => layout.biomeKey === 'N');
    if (n === undefined) throw new Error('missing N layout fixture');
    (n as { start: unknown }).start = { kind: 'fixedAuthored', roomGameName: 'N_Combat01' };
    expect(() => createCatalog(malformed)).toThrow(CatalogContractError);
  });

  it('rejects a retained-peer Preboss that omits its one-creation cap', () => {
    const fixture = input();
    const malformed: RawCatalogInput = {
      ...fixture,
      rooms: fixture.rooms.map((room) =>
        room.gameName === 'I_PreBoss02' ? { ...room, caps: { maxAppearancesThisBiome: 1 } } : room,
      ),
    };
    expect(() => createCatalog(malformed)).toThrow(CatalogContractError);
  });

  it('rejects takeover caps, incompatible exits, and width-one policies that cannot fill their sources', () => {
    const capFixture = input();
    expect(() =>
      createCatalog({
        ...capFixture,
        rooms: capFixture.rooms.map((room) =>
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

    const compatibilityFixture = input();
    expect(() =>
      createCatalog({
        ...compatibilityFixture,
        rooms: compatibilityFixture.rooms.map((room) =>
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

    const widthFixture = input();
    expect(() =>
      createCatalog({
        ...widthFixture,
        rooms: widthFixture.rooms.map((room) =>
          room.gameName === 'Q_MiniBoss03'
            ? {
                ...room,
                exits: [...room.exits, { index: 2, type: 'TyphonExitDoor' }],
              }
            : room,
        ),
      }),
    ).toThrow(CatalogContractError);

    const ordinaryWidthFixture = input();
    const widthOnePolicy = ordinaryWidthFixture.rooms.find(
      (room) => room.gameName === 'O_PreBoss01',
    )?.prebossBatchPolicy;
    if (widthOnePolicy === undefined) throw new Error('missing O Preboss policy');
    expect(() =>
      createCatalog({
        ...ordinaryWidthFixture,
        rooms: ordinaryWidthFixture.rooms.map((room) =>
          room.gameName === 'F_PreBoss01' ? { ...room, prebossBatchPolicy: widthOnePolicy } : room,
        ),
      }),
    ).toThrow(CatalogContractError);
  });
});

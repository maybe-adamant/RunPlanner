import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

describe('Fields spatial declarations', () => {
  it('declares the exact Fields optional pickup capacity for every H combat map', () => {
    expect(
      Object.fromEntries(
        Array.from({ length: 15 }, (_, index) => {
          const gameName = `H_Combat${String(index + 1).padStart(2, '0')}`;
          return [
            gameName,
            catalog.rooms.byKey[gameName]?.fieldsOptionalRewards?.optionalRewardCapacity,
          ];
        }),
      ),
    ).toEqual({
      H_Combat01: 4,
      H_Combat02: 3,
      H_Combat03: 4,
      H_Combat04: 4,
      H_Combat05: 4,
      H_Combat06: 4,
      H_Combat07: 3,
      H_Combat08: 3,
      H_Combat09: 2,
      H_Combat10: 4,
      H_Combat11: 2,
      H_Combat12: 3,
      H_Combat13: 2,
      H_Combat14: 2,
      H_Combat15: 2,
    });
  });

  it('declares the reviewed physical point domains for every H combat map', () => {
    expect(
      Object.fromEntries(
        Array.from({ length: 15 }, (_, index) => {
          const gameName = `H_Combat${String(index + 1).padStart(2, '0')}`;
          const spatial = catalog.rooms.byKey[gameName]?.fieldsSpatial;
          return [
            gameName,
            [
              spatial?.entryPairs.length,
              spatial?.cagePointIds.length,
              spatial?.optionalPointIds.length,
            ],
          ];
        }),
      ),
    ).toEqual({
      H_Combat01: [1, 5, 4],
      H_Combat02: [2, 3, 3],
      H_Combat03: [1, 3, 5],
      H_Combat04: [4, 4, 7],
      H_Combat05: [2, 5, 7],
      H_Combat06: [4, 5, 4],
      H_Combat07: [4, 3, 3],
      H_Combat08: [2, 3, 3],
      H_Combat09: [1, 3, 2],
      H_Combat10: [3, 5, 4],
      H_Combat11: [3, 5, 2],
      H_Combat12: [2, 3, 3],
      H_Combat13: [2, 2, 2],
      H_Combat14: [2, 2, 2],
      H_Combat15: [2, 3, 2],
    });
    expect(catalog.rooms.byKey.H_Combat04?.fieldsSpatial?.nemesisExcludedOptionalPointIds).toEqual([
      572886,
    ]);
    expect(catalog.rooms.byKey.H_Combat13?.fieldsSpatial?.cagePointIds).toContain(621502);
    expect(catalog.rooms.byKey.H_Combat13?.fieldsSpatial?.cagePointIds).toHaveLength(2);
  });

  it('declares one spawn-group representative per mapped cage point', () => {
    expect(
      Object.fromEntries(
        Array.from({ length: 15 }, (_, index) => {
          const gameName = `H_Combat${String(index + 1).padStart(2, '0')}`;
          const spatial = catalog.rooms.byKey[gameName]?.fieldsSpatial;
          return [
            gameName,
            Object.fromEntries(
              (spatial?.cageSpawnRepresentatives ?? []).map((entry) => [
                entry.cagePointId,
                entry.spawnPointId,
              ]),
            ),
          ];
        }),
      ),
    ).toEqual({
      H_Combat01: {
        40055: 572726,
        568803: 572967,
        568804: 572815,
        568805: 572761,
        568806: 685585,
      },
      H_Combat02: { 621502: 621276, 622508: 623047, 622860: 623048 },
      H_Combat03: { 40055: 568951, 568938: 568971, 568943: 686963 },
      H_Combat04: { 569103: 686366, 573087: 686471, 573088: 686572, 573089: 686651 },
      H_Combat05: {
        573087: 702788,
        621494: 623688,
        621539: 703038,
        622143: 702790,
        622144: 702789,
      },
      H_Combat06: {
        573087: 623162,
        621502: 622291,
        622316: 623230,
        622317: 623414,
        622318: 623319,
      },
      H_Combat07: { 573087: 621713, 621494: 624900, 621503: 624766 },
      H_Combat08: { 573087: 686172, 621402: 686024, 621428: 685738 },
      H_Combat09: { 621502: 715403, 715348: 715404, 715375: 715402 },
      H_Combat10: {
        624446: 625484,
        624455: 624602,
        624464: 624613,
        624473: 624606,
        624513: 624590,
      },
      H_Combat11: {
        621502: 626466,
        622748: 627301,
        622753: 626489,
        622758: 626473,
        622768: 626453,
      },
      H_Combat12: { 627077: 628297, 627110: 628270, 627112: 628299 },
      // 621502 has no RewardCageSpawnPoints entry and so no spawn group.
      H_Combat13: { 715356: 715598 },
      H_Combat14: { 621502: 621276, 736882: 737002 },
      H_Combat15: { 621502: 737970, 737521: 737969, 737530: 621276 },
    });
  });
});

import { expect, it } from 'vitest';
import { catalog, createCatalog } from '@run-planner/hades2-catalog';
import { cloneCatalogInput } from './support/catalog-input';

// Verified unflipped capture annotations: F preferred + fallback union; G EnemyPoint only.
// Digests witness every native ID and numbered order, without retaining visual metadata.
const captured: Record<string, readonly [number, string]> = {
  F_Combat02: [19, '7e724f8b3abc4bb2'],
  F_Combat03: [21, 'e12ee0a7b501642e'],
  F_Combat04: [22, '956d97404e4c086a'],
  F_Combat05: [25, 'b7135bcc5bdb6c20'],
  F_Combat06: [20, '8bccdb292ee2a6e3'],
  F_Combat07: [19, '5fc05faf40c1212b'],
  F_Combat08: [19, 'b3eaa6db357a9b92'],
  F_Combat09: [18, 'c28fc5451b6da769'],
  F_Combat10: [18, 'ea90d00ed4f11fdb'],
  F_Combat11: [20, 'e9ab30e299225414'],
  F_Combat12: [25, '69acab40e0ab668d'],
  F_Combat13: [28, '2613b414a136b0bc'],
  F_Combat14: [17, '904af2091121ed5b'],
  F_Combat15: [16, 'b1d68e5f428e70b1'],
  F_Combat16: [29, '89bfa32195667caf'],
  F_Combat17: [34, '383adab1ab8446'],
  F_Combat18: [26, 'c1f078eec55b3884'],
  F_Combat19: [38, '84edc75b9e117fe9'],
  F_Combat20: [44, '2d47e454b835191f'],
  F_Combat21: [24, '18ced7f2173f56c5'],
  F_Combat22: [43, 'ac2774150471b9e8'],
  G_Combat01: [11, 'f6ffa720417065f6'],
  G_Combat02: [20, '32568d7f357ef628'],
  G_Combat03: [23, '94cd2005d8f1827f'],
  G_Combat04: [16, '9767549e9ce7c5c9'],
  G_Combat05: [16, '108de92e68537aae'],
  G_Combat06: [29, 'b6ceb87baa8122d0'],
  G_Combat07: [21, '87196cd1a5278129'],
  G_Combat08: [21, 'f63fd1546c609178'],
  G_Combat09: [27, 'cfdb27f721b8958'],
  G_Combat10: [20, 'e9e557a99d628e25'],
  G_Combat11: [23, 'c41b66808b3984e'],
  G_Combat12: [22, 'ceec9632a4e30f2a'],
  G_Combat13: [16, '55ab2df7270e708f'],
  G_Combat14: [37, '3d9255761896b9a6'],
  G_Combat15: [38, '149ead289fe53eff'],
  G_Combat16: [34, '6b477b3d289df393'],
  G_Combat17: [34, 'ec2811f46753ae79'],
  G_Combat18: [18, 'b16060dff889dcad'],
  G_Combat19: [18, 'eb6dfa754ab86799'],
  G_Combat20: [32, 'f887d30ec4dc920d'],
};

function inventoryDigest(ids: readonly number[]): string {
  let hash = 14695981039346656037n;
  for (const char of ids.join(','))
    hash = BigInt.asUintN(64, (hash ^ BigInt(char.charCodeAt(0))) * 1099511628211n);
  return hash.toString(16);
}

it('normalizes all 41 verified room-specific numbered inventories', () => {
  const rooms = catalog.rooms.values.filter((room) => room.cocoonRewardPointIds !== undefined);
  expect(rooms.map((room) => room.gameName).sort()).toEqual(Object.keys(captured).sort());
  for (const room of rooms) {
    const ids = room.cocoonRewardPointIds!;
    expect([ids.length, inventoryDigest(ids)]).toEqual(captured[room.gameName]);
    expect(Object.isFrozen(ids)).toBe(true);
  }
  expect(
    rooms.filter((r) => r.roomSetKey === 'F').flatMap((r) => r.cocoonRewardPointIds!),
  ).toHaveLength(525);
  expect(
    rooms.filter((r) => r.roomSetKey === 'G').flatMap((r) => r.cocoonRewardPointIds!),
  ).toHaveLength(476);
});

it.each([[[]], [[0]], [[1.5]], [[2, 1]], [[1, 1]]])('rejects malformed inventory %j', (ids) => {
  const input = cloneCatalogInput();
  const room = input.rooms.find((room) => room.gameName === 'F_Combat02')!;
  (room as { cocoonRewardPointIds: unknown }).cocoonRewardPointIds = ids;
  expect(() => createCatalog(input)).toThrow(/cocoonRewardPointIds/);
});

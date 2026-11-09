import { challengeSwitchHost } from '../../authored-project/acquisition/challenge-switch';
import type { RoomAnchorObjectKind } from '../../authored-project/addresses';
import { roomObjectAnchorIds } from '../../authored-project/room-layout';
import { routePurgingPool, routeRoomShop } from '../../authored-project/route-profile';
import { stableChoice } from '../../authored-project/stable-hash';
import type { Catalog } from '../../catalog-schema';

/**
 * Native spawn order: each eligible object in turn takes a random free anchor
 * (some Postboss rooms pin the Well's), so order decides capacity.
 */
export const ROOM_ANCHOR_OBJECT_ORDER = Object.freeze([
  'stygianWell',
  'purgingPool',
  'hermesShrine',
  'challengeSwitch',
] as const satisfies readonly RoomAnchorObjectKind[]);

/** A room's anchor objects, each present one with its optional stored anchor. */
export type RoomAnchorObjectLeaves = { readonly gameName: string } & {
  readonly [Kind in RoomAnchorObjectKind]?: { readonly anchorId?: number } | undefined;
};

/** Native can spawn the object in this room on this route; only a hosted object holds an anchor. */
export function roomAnchorObjectHosted(
  catalog: Catalog,
  gameName: string,
  routeKey: string,
  kind: RoomAnchorObjectKind,
): boolean {
  const room = catalog.rooms.byKey[gameName];
  switch (kind) {
    case 'stygianWell': {
      const shop = routeRoomShop(room, routeKey);
      return shop !== undefined && (shop.forced || shop.spawnChance > 0);
    }
    case 'purgingPool':
      return routePurgingPool(room, routeKey) !== undefined;
    case 'hermesShrine': {
      const shop = room?.surfaceShop;
      return shop !== undefined && (shop.forced || shop.spawnChance > 0);
    }
    case 'challengeSwitch':
      return room !== undefined && challengeSwitchHost(catalog, gameName) !== undefined;
  }
}

/**
 * Where a present object stands: its stored anchor (the owner's choice, kept
 * even where it is invalid), the Well's pin, or its stable default.
 */
export interface RoomObjectAnchorPosition {
  readonly anchorId: number;
  readonly source: 'chosen' | 'pinned' | 'default';
}

/**
 * Every present object's anchor. Hosted objects without a stored anchor claim
 * in native order, each taking its stable-default best of the anchors no
 * stored anchor, pin or earlier claim holds; an object past the room's anchor
 * count, or left no free anchor, has none.
 */
export function roomObjectAnchorPositions(
  catalog: Catalog,
  room: RoomAnchorObjectLeaves,
  routeKey: string,
  /** The occurrence's semantic key, which seeds its defaults. */
  ownerKey: string,
): ReadonlyMap<RoomAnchorObjectKind, RoomObjectAnchorPosition> {
  const declaration = catalog.rooms.byKey[room.gameName];
  const anchorCount = declaration?.challengeSwitchAnchorCount ?? 0;
  const anchorIds = declaration === undefined ? [] : roomObjectAnchorIds(declaration);
  const pin = declaration?.mapPoints?.wellAnchorId;
  const positions = new Map<RoomAnchorObjectKind, RoomObjectAnchorPosition>();
  const taken = new Set<number>(pin === undefined ? [] : [pin]);
  for (const kind of ROOM_ANCHOR_OBJECT_ORDER) {
    const anchorId = room[kind]?.anchorId;
    if (anchorId === undefined) continue;
    positions.set(kind, Object.freeze({ anchorId, source: 'chosen' }));
    taken.add(anchorId);
  }
  let held = 0;
  for (const kind of ROOM_ANCHOR_OBJECT_ORDER) {
    if (room[kind] === undefined || !roomAnchorObjectHosted(catalog, room.gameName, routeKey, kind))
      continue;
    const slot = held;
    held += 1;
    if (positions.has(kind) || slot >= anchorCount) continue;
    if (kind === 'stygianWell' && pin !== undefined) {
      positions.set(kind, Object.freeze({ anchorId: pin, source: 'pinned' }));
      continue;
    }
    const anchorId = stableChoice(
      `${ownerKey}|anchor:${kind}`,
      anchorIds.filter((id) => !taken.has(id)),
    );
    if (anchorId === undefined) continue;
    positions.set(kind, Object.freeze({ anchorId, source: 'default' }));
    taken.add(anchorId);
  }
  return positions;
}

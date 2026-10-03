import type { Catalog, RoomDeclaration, RoomKind } from '@run-planner/engine/catalog-schema';
import {
  routeRoomDeclaration,
  type ProjectDocument,
  type TargetAddress,
} from '@run-planner/engine/authored-project';

export const ordinaryRoomCategories = [
  'Combat',
  'Miniboss',
  'Story',
  'Trial',
  'Fountain',
  'Shop',
] as const;
const generatedTargetRoomCategories = Object.freeze([
  ...ordinaryRoomCategories,
  'Preboss',
] as const);

export type OrdinaryRoomCategory = (typeof ordinaryRoomCategories)[number];
export type RoomSelectorCategory = OrdinaryRoomCategory | 'Preboss';

export function roomSelectorCategories(
  catalog: Catalog,
  biomeKey: string,
): readonly RoomSelectorCategory[] {
  const ordinaryPreboss = catalog.rooms.values.some(
    (room) => room.roomSetKey === biomeKey && room.prebossBatchPolicy?.kind === 'retainNormalPeers',
  );
  return ordinaryPreboss ? generatedTargetRoomCategories : ordinaryRoomCategories;
}

export function roomCategoryForKind(kind: RoomKind): RoomSelectorCategory | undefined {
  switch (kind) {
    case 'Combat':
    case 'Miniboss':
    case 'Shop':
    case 'Story':
      return kind;
    case 'Reprieve':
      return 'Fountain';
    case 'Devotion':
      return 'Trial';
    case 'Preboss':
      return 'Preboss';
    case 'Intro':
    case 'Opening':
    case 'PreHub':
    case 'Boss':
    case 'Hub':
    case 'PostBoss':
      return undefined;
  }
  const unhandledKind: never = kind;
  return unhandledKind;
}

export function roomPickerCandidateCategory(biomeKey: string, room: RoomDeclaration): string {
  if (biomeKey === 'P') {
    const indoor = room.structuralTags.includes('Indoor');
    const outdoor = room.structuralTags.includes('Outdoor');
    if (indoor !== outdoor) return indoor ? 'Indoor' : 'Outdoor';
  }
  return roomCategoryForKind(room.kind) ?? room.kind;
}

/** Physical door names are independent of the destination room's structural tags. */
export function olympusExitTypeLabel(
  exitType: string | undefined,
): 'Indoor' | 'Outdoor' | undefined {
  if (exitType === 'OlympusIndoorExitDoor') return 'Indoor';
  if (exitType === 'OlympusOutdoorExitDoor') return 'Outdoor';
  return undefined;
}

/** Picker-only room layout summaries; canonical room labels remain unchanged. */
export function roomPickerCandidateLabel(biomeKey: string, room: RoomDeclaration): string {
  if (biomeKey === 'H' && room.kind === 'Combat') {
    const cages = room.localChildren.find(
      (child) =>
        child.kind === 'boundedRewardSlots' && child.offerRewardCapability === 'fieldsCages',
    );
    if (cages?.kind === 'boundedRewardSlots') return `${room.label} (${cages.rawCapacity} Slots)`;
  }
  if (biomeKey === 'P') {
    const indoorCount = room.exits.filter(
      (exit) => olympusExitTypeLabel(exit.type) === 'Indoor',
    ).length;
    const outdoorCount = room.exits.filter(
      (exit) => olympusExitTypeLabel(exit.type) === 'Outdoor',
    ).length;
    const counts = [
      indoorCount > 0 ? `${indoorCount}I` : '',
      outdoorCount > 0 ? `${outdoorCount}O` : '',
    ]
      .filter(Boolean)
      .join('/');
    return counts === '' ? room.label : `${room.label} (${counts})`;
  }
  if (room.kind !== 'Combat' || (biomeKey !== 'F' && biomeKey !== 'G' && biomeKey !== 'I')) {
    return room.label;
  }
  const doorCount = room.exits.length;
  return `${room.label} (${doorCount} ${doorCount === 1 ? 'Door' : 'Doors'})`;
}

/** The route's realized rooms: a route overlay can change a room's category. */
export function selectRoomsForCategory(
  catalog: Catalog,
  routeKey: string,
  biomeKey: string,
  category: RoomSelectorCategory,
): readonly RoomDeclaration[] {
  return catalog.rooms.values.flatMap((declared) => {
    const room = routeRoomDeclaration(declared, routeKey);
    return room.roomSetKey === biomeKey &&
      room.mode.kind === 'authored' &&
      roomCategoryForKind(room.kind) === category
      ? [room]
      : [];
  });
}

export function selectRoomsForTargetCategory(
  catalog: Catalog,
  _project: ProjectDocument,
  target: TargetAddress,
  category: RoomSelectorCategory,
): readonly RoomDeclaration[] {
  // The picker presents the declaration-owned category domain. The candidate
  // session owns eligibility, caps, physical exits and bounded Hub-entry rules.
  return selectRoomsForCategory(catalog, target.routeKey, target.biomeKey, category);
}

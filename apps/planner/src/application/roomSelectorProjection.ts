import type { Catalog, RoomDeclaration, RoomKind } from '@run-planner/core';

export const ordinaryRoomCategories = ['Combat', 'Miniboss', 'Story', 'Fountain', 'Shop'] as const;

export type OrdinaryRoomCategory = (typeof ordinaryRoomCategories)[number];

export function roomCategoryForKind(kind: RoomKind): OrdinaryRoomCategory | undefined {
  switch (kind) {
    case 'Combat':
    case 'Miniboss':
    case 'Shop':
    case 'Story':
      return kind;
    case 'Reprieve':
      return 'Fountain';
    case 'Intro':
    case 'Opening':
    case 'Preboss':
    case 'Boss':
    case 'Hub':
    case 'PostBoss':
      return undefined;
  }
}

export function selectRoomsForCategory(
  catalog: Catalog,
  biomeStepKey: string,
  category: OrdinaryRoomCategory,
): readonly RoomDeclaration[] {
  return catalog.rooms.values.filter((room) => {
    if (room.biomeStepKey !== biomeStepKey) {
      return false;
    }
    if (room.mode.kind !== 'authored') {
      return false;
    }
    return roomCategoryForKind(room.kind) === category;
  });
}

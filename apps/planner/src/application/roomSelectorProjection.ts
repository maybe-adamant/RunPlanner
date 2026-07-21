import type { Catalog, RoomDeclaration, RoomKind } from '@run-planner/core';

export const ordinaryRoomCategories = ['Combat', 'Miniboss', 'Story', 'Fountain', 'Shop'] as const;
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
  const layout = catalog.biomeLayouts.byKey[biomeKey];
  return layout?.kind === 'LinearBiome' && layout.terminal.kind === 'generatedTarget'
    ? generatedTargetRoomCategories
    : ordinaryRoomCategories;
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
    case 'Preboss':
      return 'Preboss';
    case 'Intro':
    case 'Opening':
    case 'PreHub':
    case 'Boss':
    case 'Devotion':
    case 'Hub':
    case 'PostBoss':
      return undefined;
  }
  const unhandledKind: never = kind;
  return unhandledKind;
}

export function selectRoomsForCategory(
  catalog: Catalog,
  biomeKey: string,
  category: RoomSelectorCategory,
): readonly RoomDeclaration[] {
  return catalog.rooms.values.filter((room) => {
    if (room.biomeKey !== biomeKey) {
      return false;
    }
    if (room.mode.kind !== 'authored') {
      return false;
    }
    return roomCategoryForKind(room.kind) === category;
  });
}

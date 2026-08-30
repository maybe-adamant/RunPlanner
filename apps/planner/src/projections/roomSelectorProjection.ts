import type { Catalog, RoomDeclaration, RoomKind } from '@run-planner/engine/catalog-schema';
import type { ProjectDocument, TargetAddress } from '@run-planner/engine/authored-project';

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

/**
 * F/G/I combat maps mix normal-door widths inside broad room domains. Expose
 * that declaration fact only while the user is choosing a room; canonical
 * room labels remain unchanged everywhere else.
 */
export function roomPickerCandidateLabel(biomeKey: string, room: RoomDeclaration): string {
  if (room.kind !== 'Combat' || (biomeKey !== 'F' && biomeKey !== 'G' && biomeKey !== 'I')) {
    return room.label;
  }
  const doorCount = room.exits.length;
  return `${room.label} (${doorCount} ${doorCount === 1 ? 'Door' : 'Doors'})`;
}

export function selectRoomsForCategory(
  catalog: Catalog,
  biomeKey: string,
  category: RoomSelectorCategory,
): readonly RoomDeclaration[] {
  return catalog.rooms.values.filter((room) => {
    if (room.roomSetKey !== biomeKey) {
      return false;
    }
    if (room.mode.kind !== 'authored') {
      return false;
    }
    return roomCategoryForKind(room.kind) === category;
  });
}

export function selectRoomsForTargetCategory(
  catalog: Catalog,
  _project: ProjectDocument,
  target: TargetAddress,
  category: RoomSelectorCategory,
): readonly RoomDeclaration[] {
  // A staged declaration's semantic ordinal belongs to the engine's selected
  // spine, not to the persisted decision-array position.  The picker presents
  // the declaration-owned category domain and lets the candidate session own
  // stage, eligibility, cap, and physical-exit validation.
  return selectRoomsForCategory(catalog, target.biomeKey, category);
}

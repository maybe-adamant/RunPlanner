import type {
  Catalog,
  ProjectDocument,
  RoomDeclaration,
  RoomKind,
  TargetAddress,
} from '@run-planner/core';

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

export function selectRoomsForTargetCategory(
  catalog: Catalog,
  project: ProjectDocument,
  target: TargetAddress,
  category: RoomSelectorCategory,
): readonly RoomDeclaration[] {
  const rooms = selectRoomsForCategory(catalog, target.biomeKey, category);
  const layout = catalog.biomeLayouts.byKey[target.biomeKey];
  if (layout?.kind !== 'LinearBiome' || layout.continuation.progressionPolicy.kind !== 'staged') {
    return rooms;
  }
  const plan = project.routes
    .find((route) => route.routeKey === target.routeKey)
    ?.biomes.find((biome) => biome.biomeKey === target.biomeKey);
  if (plan?.kind !== 'LinearBiome' || plan.topology === null) {
    throw new Error(`${target.biomeKey} staged selector has no linear topology`);
  }
  const batches = plan.topology.continuations.filter(
    (continuation) => continuation.kind === 'batch',
  );
  const batchIndex = batches.findIndex(
    (continuation) => continuation.parentOccurrenceId === target.parentOccurrenceId,
  );
  const stage = layout.continuation.progressionPolicy.stages[batchIndex];
  if (stage === undefined) {
    throw new Error(`${target.biomeKey} staged selector has no candidate stage ${batchIndex + 1}`);
  }
  const stageRooms = new Set(stage.roomGameNames);
  return rooms.filter((room) => stageRooms.has(room.gameName));
}

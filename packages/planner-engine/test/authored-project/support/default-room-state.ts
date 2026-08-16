import type { Catalog, RoomDeclaration } from '../../../src/catalog-schema';
import type { RoomStateContext } from '../../../src/authored-project/room-state/declaration';
import { createDefaultRoomState } from '../../../src/authored-project/room-state/defaults';

export function testRouteLoadout(catalog: Catalog) {
  const weapon = catalog.weapons.values.find((candidate) =>
    candidate.aspectKeys.includes(candidate.defaultAspectKey),
  );
  if (weapon === undefined) throw new Error('missing test loadout');
  return Object.freeze({
    weaponKey: weapon.key,
    aspectKey: weapon.defaultAspectKey,
  });
}

export function createTestDefaultRoomState(
  catalog: Catalog,
  declaration: RoomDeclaration,
  context: Omit<RoomStateContext, 'loadout'>,
) {
  return createDefaultRoomState(catalog, declaration, {
    ...context,
    ...(declaration.mode.kind === 'authored' &&
    declaration.mode.templateKey === 'FieldsCombat' &&
    context.activeCageCount === undefined
      ? { activeCageCount: 2 }
      : {}),
    loadout: testRouteLoadout(catalog),
  });
}

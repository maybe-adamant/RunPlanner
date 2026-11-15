import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';

/** Whether an encounter's end effects count down the Shrine deliveries in transit. */
export function endEffectsAdvanceDeliveries(
  catalog: Catalog,
  declaration: RoomDeclaration | undefined,
  encounterKey: string | undefined,
): boolean {
  return (
    declaration?.advancesHermesShrineDeliveryUses === true &&
    declaration.ignoreEncounterUses !== true &&
    catalog.encounterDefinitions.byKey[encounterKey ?? '']?.advancesHermesShrineDeliveryUses ===
      true
  );
}

/** Whether a room's end effects advance trait clocks, and whether a clock may mature there. */
export function roomTraitClocks(
  declaration: RoomDeclaration | undefined,
  routeKey: string,
): { readonly advance: boolean; readonly deferMaturity: boolean } {
  return {
    advance: declaration?.skipRoomsPerUpgrade !== true,
    deferMaturity:
      declaration?.skipTimedDropResources === true ||
      (routeKey === 'Dream' && declaration?.skipTimedDropResourcesInDream === true),
  };
}

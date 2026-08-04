import type {
  Catalog,
  EncounterDefinition,
  EncounterEnvelopeSlot,
  EncounterSet,
  EncounterSlotBinding,
  RoomDeclaration,
} from '../../catalog-schema';
import type { RoomEncounterState } from '../model';
import { expectExactKeys, expectRecord, expectString, failProjectDocument } from '../validation';

function requireEnvelope(catalog: Catalog, room: RoomDeclaration, path: string) {
  const envelope = catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey];
  if (envelope === undefined) {
    failProjectDocument(
      path,
      `${room.gameName} references unknown envelope ${room.encounterEnvelopeKey}`,
    );
  }
  return envelope;
}

/**
 * Validates the declaration-level exact slot relation at the authored-state
 * contact. The catalog compiler owns construction closure; this guard keeps a
 * corrupted hand-built catalog from moving selections through a wrong slot.
 */
export function encounterBindingsBySlot(
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): ReadonlyMap<string, EncounterSlotBinding> {
  const envelope = requireEnvelope(catalog, room, path);
  const expectedSlotKeys = envelope.slots.map((slot) => slot.key);
  const bindings = new Map<string, EncounterSlotBinding>();
  for (const binding of room.encounterSlotBindings) {
    if (!expectedSlotKeys.includes(binding.slotKey)) {
      failProjectDocument(path, `${room.gameName} binds unknown encounter slot ${binding.slotKey}`);
    }
    if (bindings.has(binding.slotKey)) {
      failProjectDocument(path, `${room.gameName} binds ${binding.slotKey} more than once`);
    }
    bindings.set(binding.slotKey, binding);
  }
  if (bindings.size !== expectedSlotKeys.length) {
    const missing = expectedSlotKeys.find((slotKey) => !bindings.has(slotKey));
    failProjectDocument(path, `${room.gameName} omits encounter binding ${missing ?? '?'}`);
  }
  return bindings;
}

export function encounterEnvelopeSlots(
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): readonly EncounterEnvelopeSlot[] {
  return requireEnvelope(catalog, room, path).slots;
}

export function encounterSetForBinding(
  catalog: Catalog,
  binding: Extract<EncounterSlotBinding, { readonly kind: 'set' }>,
  path: string,
): EncounterSet {
  const set = catalog.encounterSets.byKey[binding.encounterSetKey];
  if (set === undefined) {
    failProjectDocument(path, `unknown encounter set ${binding.encounterSetKey}`);
  }
  return set;
}

export function encounterDefinitionForKey(
  catalog: Catalog,
  encounterKey: string,
  path: string,
): EncounterDefinition {
  const definition = catalog.encounterDefinitions.byKey[encounterKey];
  if (definition === undefined) {
    failProjectDocument(path, `unknown encounter definition ${encounterKey}`);
  }
  return definition;
}

export function selectedEncounterDefinitionKey(
  catalog: Catalog,
  room: RoomDeclaration,
  encounters: RoomEncounterState,
  slotKey: string,
  path: string,
): string {
  const binding = encounterBindingsBySlot(catalog, room, path).get(slotKey);
  if (binding === undefined) {
    failProjectDocument(path, `${room.gameName} has no encounter slot ${slotKey}`);
  }
  if (binding.kind === 'fixed') {
    if (encounters.encounterKeyByPhase[slotKey] !== undefined) {
      failProjectDocument(path, `${slotKey} is fixed and must not persist an authored selection`);
    }
    encounterDefinitionForKey(catalog, binding.encounterDefinitionKey, path);
    return binding.encounterDefinitionKey;
  }
  const encounterKey = encounters.encounterKeyByPhase[slotKey];
  if (encounterKey === undefined) {
    failProjectDocument(path, `${slotKey} has no authored encounter selection`);
  }
  const set = encounterSetForBinding(catalog, binding, path);
  if (!set.encounterDefinitionKeys.includes(encounterKey)) {
    failProjectDocument(path, `${encounterKey} is not available from ${set.key}`);
  }
  encounterDefinitionForKey(catalog, encounterKey, path);
  return encounterKey;
}

export function createDefaultRoomEncounterState(
  catalog: Catalog,
  room: RoomDeclaration,
  path = `rooms.${room.gameName}.encounters`,
): RoomEncounterState {
  const values: Record<string, string> = {};
  for (const binding of encounterBindingsBySlot(catalog, room, path).values()) {
    if (binding.kind === 'fixed') {
      encounterDefinitionForKey(
        catalog,
        binding.encounterDefinitionKey,
        `${path}.${binding.slotKey}`,
      );
      continue;
    }
    const set = encounterSetForBinding(catalog, binding, `${path}.${binding.slotKey}`);
    if (!set.encounterDefinitionKeys.includes(set.defaultEncounterDefinitionKey)) {
      failProjectDocument(
        `${path}.${binding.slotKey}`,
        `${set.defaultEncounterDefinitionKey} is not a member of ${set.key}`,
      );
    }
    encounterDefinitionForKey(
      catalog,
      set.defaultEncounterDefinitionKey,
      `${path}.${binding.slotKey}`,
    );
    values[binding.slotKey] = set.defaultEncounterDefinitionKey;
  }
  return Object.freeze({ encounterKeyByPhase: Object.freeze(values) });
}

export function decodeRoomEncounterState(
  value: unknown,
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): RoomEncounterState {
  const state = expectRecord(value, path);
  expectExactKeys(state, ['encounterKeyByPhase'], path);
  const rawSelections = expectRecord(state.encounterKeyByPhase, `${path}.encounterKeyByPhase`);
  const bindings = encounterBindingsBySlot(catalog, room, path);
  const selectedSlotKeys = [...bindings.values()]
    .filter(
      (binding): binding is Extract<EncounterSlotBinding, { readonly kind: 'set' }> =>
        binding.kind === 'set',
    )
    .map((binding) => binding.slotKey);
  expectExactKeys(rawSelections, selectedSlotKeys, `${path}.encounterKeyByPhase`);
  const encounterKeyByPhase: Record<string, string> = {};
  for (const slotKey of selectedSlotKeys) {
    const encounterKey = expectString(
      rawSelections[slotKey],
      `${path}.encounterKeyByPhase.${slotKey}`,
    );
    const binding = bindings.get(slotKey);
    if (binding?.kind !== 'set') {
      failProjectDocument(`${path}.encounterKeyByPhase.${slotKey}`, 'has no selectable binding');
    }
    const set = encounterSetForBinding(catalog, binding, `${path}.encounterKeyByPhase.${slotKey}`);
    if (!set.encounterDefinitionKeys.includes(encounterKey)) {
      failProjectDocument(
        `${path}.encounterKeyByPhase.${slotKey}`,
        `${encounterKey} is not a member of ${set.key}`,
      );
    }
    encounterDefinitionForKey(catalog, encounterKey, `${path}.encounterKeyByPhase.${slotKey}`);
    encounterKeyByPhase[slotKey] = encounterKey;
  }
  return Object.freeze({ encounterKeyByPhase: Object.freeze(encounterKeyByPhase) });
}

/**
 * Replacement preserves only an exact stable slot whose retained concrete
 * definition is still legal in the replacement slot's declared set. It never
 * consults current simulation eligibility or repairs a context-invalid choice.
 */
export function reconcileRoomEncounterState(
  catalog: Catalog,
  previousRoom: RoomDeclaration,
  previous: RoomEncounterState,
  replacementRoom: RoomDeclaration,
  replacement: RoomEncounterState,
): RoomEncounterState {
  const previousBindings = encounterBindingsBySlot(
    catalog,
    previousRoom,
    `rooms.${previousRoom.gameName}.encounters`,
  );
  const replacementBindings = encounterBindingsBySlot(
    catalog,
    replacementRoom,
    `rooms.${replacementRoom.gameName}.encounters`,
  );
  const selections: Record<string, string> = {};
  for (const binding of replacementBindings.values()) {
    if (binding.kind !== 'set') continue;
    const fallback = replacement.encounterKeyByPhase[binding.slotKey];
    if (fallback === undefined) {
      failProjectDocument(
        `rooms.${replacementRoom.gameName}.encounters.${binding.slotKey}`,
        'replacement default is missing',
      );
    }
    const previousBinding = previousBindings.get(binding.slotKey);
    const retained = previous.encounterKeyByPhase[binding.slotKey];
    const set = encounterSetForBinding(
      catalog,
      binding,
      `rooms.${replacementRoom.gameName}.encounters.${binding.slotKey}`,
    );
    selections[binding.slotKey] =
      previousBinding?.kind === 'set' &&
      retained !== undefined &&
      set.encounterDefinitionKeys.includes(retained)
        ? retained
        : fallback;
  }
  return Object.freeze({ encounterKeyByPhase: Object.freeze(selections) });
}

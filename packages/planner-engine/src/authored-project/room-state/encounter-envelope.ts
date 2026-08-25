import type {
  Catalog,
  EncounterDefinition,
  EncounterEnvelopeSlot,
  EncounterSet,
  EncounterSlotBinding,
  RoomDeclaration,
} from '../../catalog-schema';
import type { RoomEncounterState } from '../model';
import type { AuthoredTraitOffer } from '../traits';
import { failProjectDocument } from '../validation';

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
  const bindings = encounterBindingsBySlot(catalog, room, path);
  const values: Record<string, string> = {};
  const figLeafSkipByPhase: Record<string, boolean> = {};
  const gorgonResultByPhase: Record<string, import('../model').AuthoredGorgonPhaseResult> = {};
  for (const binding of bindings.values()) {
    figLeafSkipByPhase[binding.slotKey] = false;
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
    if (
      set.encounterDefinitionKeys.some(
        (key) => catalog.encounterDefinitions.byKey[key]?.hostsGorgon === true,
      )
    )
      gorgonResultByPhase[binding.slotKey] = Object.freeze({ athenaTriggerConditionMet: false });
  }
  for (const binding of bindings.values()) {
    const hostsGorgon =
      binding.kind === 'fixed'
        ? catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]?.hostsGorgon === true
        : encounterSetForBinding(
            catalog,
            binding,
            `${path}.${binding.slotKey}`,
          ).encounterDefinitionKeys.some(
            (key) => catalog.encounterDefinitions.byKey[key]?.hostsGorgon === true,
          );
    if (hostsGorgon)
      gorgonResultByPhase[binding.slotKey] ??= Object.freeze({ athenaTriggerConditionMet: false });
  }
  const traitOffersByPhase: Record<string, Record<string, AuthoredTraitOffer | null>> = {};
  for (const binding of bindings.values()) {
    const encounterKey =
      binding.kind === 'fixed' ? binding.encounterDefinitionKey : values[binding.slotKey];
    if (encounterKey === undefined) continue;
    if (catalog.encounterDefinitions.byKey[encounterKey]?.traitOfferProducer !== undefined)
      traitOffersByPhase[binding.slotKey] = { [encounterKey]: null };
  }
  return Object.freeze({
    encounterKeyByPhase: Object.freeze(values),
    figLeafSkipByPhase: Object.freeze(figLeafSkipByPhase),
    gorgonResultByPhase: Object.freeze(gorgonResultByPhase),
    ...(Object.keys(traitOffersByPhase).length === 0
      ? {}
      : { traitOffersByPhase: Object.freeze(traitOffersByPhase) }),
  });
}

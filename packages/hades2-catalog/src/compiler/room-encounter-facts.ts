import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  EncounterSet,
  EncounterSlotBinding,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';

import type { RawEncounterSlotBinding, RawRoomDeclaration } from '../declarations';
import { requireNonEmpty } from './common';
import { fail } from './errors';

export type RoomEncounterFacts = Pick<
  RoomDeclaration,
  'encounterEnvelopeKey' | 'unmodeledEncounterKeys' | 'encounterSlotBindings'
>;

function normalizeEncounterSlotBindings(
  rawBindings: readonly RawEncounterSlotBinding[],
  envelope: EncounterEnvelope,
  definitions: CatalogCollection<EncounterDefinition>,
  sets: CatalogCollection<EncounterSet>,
  path: string,
): readonly EncounterSlotBinding[] {
  const bindings = rawBindings.map((raw, bindingIndex): EncounterSlotBinding => {
    const bindingPath = `${path}[${bindingIndex}]`;
    const receivedKind: unknown = (raw as { readonly kind?: unknown }).kind;
    const slotKey = requireNonEmpty(raw.slotKey, `${bindingPath}.slotKey`);
    if (!envelope.slots.some((slot) => slot.key === slotKey)) {
      fail(`${bindingPath}.slotKey`, `${slotKey} is not a slot in ${envelope.key}`);
    }
    if (raw.kind === 'set') {
      const encounterSetKey = requireNonEmpty(
        raw.encounterSetKey,
        `${bindingPath}.encounterSetKey`,
      );
      if (sets.byKey[encounterSetKey] === undefined) {
        fail(`${bindingPath}.encounterSetKey`, `unknown encounter set ${encounterSetKey}`);
      }
      return Object.freeze({ slotKey, kind: 'set', encounterSetKey });
    }
    if (raw.kind === 'fixed') {
      const encounterDefinitionKey = requireNonEmpty(
        raw.encounterDefinitionKey,
        `${bindingPath}.encounterDefinitionKey`,
      );
      if (definitions.byKey[encounterDefinitionKey] === undefined) {
        fail(
          `${bindingPath}.encounterDefinitionKey`,
          `unknown encounter definition ${encounterDefinitionKey}`,
        );
      }
      return Object.freeze({ slotKey, kind: 'fixed', encounterDefinitionKey });
    }
    fail(`${bindingPath}.kind`, `unknown encounter slot binding ${String(receivedKind)}`);
  });
  const seenSlots = new Set<string>();
  for (const [bindingIndex, binding] of bindings.entries()) {
    if (seenSlots.has(binding.slotKey))
      fail(`${path}[${bindingIndex}].slotKey`, `duplicates slot ${binding.slotKey}`);
    seenSlots.add(binding.slotKey);
  }
  if (bindings.length !== envelope.slots.length)
    fail(path, `must bind every slot in ${envelope.key} exactly once`);
  for (const slot of envelope.slots) {
    if (!seenSlots.has(slot.key)) fail(path, `is missing binding for ${envelope.key}.${slot.key}`);
  }
  return Object.freeze(bindings);
}

/** Normalizes a room's complete encounter envelope and exact slot bindings. */
export function normalizeRoomEncounterFacts(
  room: RawRoomDeclaration,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  encounterSets: CatalogCollection<EncounterSet>,
  path: string,
): RoomEncounterFacts {
  const encounterEnvelopeKey = requireNonEmpty(
    room.encounterEnvelopeKey,
    `${path}.encounterEnvelopeKey`,
  );
  const encounterEnvelope = encounterEnvelopes.byKey[encounterEnvelopeKey];
  if (encounterEnvelope === undefined) {
    fail(`${path}.encounterEnvelopeKey`, `unknown encounter envelope ${encounterEnvelopeKey}`);
  }
  const encounterSlotBindings = normalizeEncounterSlotBindings(
    room.encounterSlotBindings,
    encounterEnvelope,
    encounterDefinitions,
    encounterSets,
    `${path}.encounterSlotBindings`,
  );
  const unmodeledEncounterKeys = (room.unmodeledEncounterKeys ?? []).map((key, index) => {
    const normalized = requireNonEmpty(key, `${path}.unmodeledEncounterKeys[${index}]`);
    const definition = encounterDefinitions.byKey[normalized];
    if (definition === undefined)
      fail(`${path}.unmodeledEncounterKeys[${index}]`, `unknown encounter ${normalized}`);
    if (definition.kind !== 'nonCombat' || definition.countsEncounterDepth) {
      fail(
        `${path}.unmodeledEncounterKeys[${index}]`,
        'must name a non-counting noncombat carrier',
      );
    }
    return normalized;
  });
  if (unmodeledEncounterKeys.length > 0 && encounterEnvelope.slots.length > 0) {
    fail(
      `${path}.unmodeledEncounterKeys`,
      'may only supplement an encounter envelope with no modeled slots',
    );
  }
  if (new Set(unmodeledEncounterKeys).size !== unmodeledEncounterKeys.length) {
    fail(`${path}.unmodeledEncounterKeys`, 'must not contain duplicate encounter keys');
  }
  return Object.freeze({
    encounterEnvelopeKey,
    ...(unmodeledEncounterKeys.length === 0
      ? {}
      : { unmodeledEncounterKeys: Object.freeze(unmodeledEncounterKeys) }),
    encounterSlotBindings,
  });
}

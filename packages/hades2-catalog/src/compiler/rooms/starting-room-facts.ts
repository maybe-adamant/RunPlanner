import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  EntryContextualEncounterRule,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';

import type { RawRoomDeclaration } from '../../declarations';
import { fail } from '../errors';

/** Normalizes the small set of source-backed contextual entry encounter rules. */
export function normalizeEntryContextualEncounterRules(
  room: RawRoomDeclaration,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  path: string,
): Pick<RoomDeclaration, 'entryContextualEncounterRules'> {
  const rawRules = room.entryContextualEncounterRules;
  if (rawRules === undefined) return Object.freeze({});
  const envelope = encounterEnvelopes.byKey[room.encounterEnvelopeKey];
  if (envelope?.slots.length !== 1 || envelope.slots[0]?.key !== 'Encounter') {
    fail(`${path}.entryContextualEncounterRules`, 'requires a single Encounter slot');
  }
  const seen = new Set<string>();
  const rules = rawRules.map((rule, index): EntryContextualEncounterRule => {
    const rulePath = `${path}.entryContextualEncounterRules[${index}]`;
    if (rule.routeKey !== 'Dream') fail(`${rulePath}.routeKey`, 'must be Dream');
    if (rule.position !== 'every' && rule.position !== 'first') {
      fail(`${rulePath}.position`, 'must be every or first');
    }
    if (encounterDefinitions.byKey[rule.encounterDefinitionKey] === undefined) {
      fail(
        `${rulePath}.encounterDefinitionKey`,
        `unknown encounter ${rule.encounterDefinitionKey}`,
      );
    }
    const key = `${rule.routeKey}:${rule.position}`;
    if (seen.has(key)) fail(rulePath, `duplicates contextual rule ${key}`);
    seen.add(key);
    return Object.freeze({ ...rule });
  });
  if (seen.has('Dream:every') && seen.has('Dream:first')) {
    fail(`${path}.entryContextualEncounterRules`, 'cannot overlap Dream every and first rules');
  }
  return Object.freeze({ entryContextualEncounterRules: Object.freeze(rules) });
}

import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

const normalizedBiomeSnapshotHashes = [
  ['F', 'e3d72dc146e2621a'],
  ['G', '9987589ca1de285e'],
  ['H', '79a0b6eb799fca77'],
  ['I', '2fb1b8e4f72da013'],
  ['N', 'ff852838667b64eb'],
  ['O', 'd0ac9c20db94050a'],
  ['P', '3689857bf6ea39ac'],
  ['Q', '3a19ce3c2eddec9c'],
] as const;

function normalizedBiomeSnapshot(biomeKey: string) {
  const rooms = catalog.rooms.values.filter((room) => room.roomSetKey === biomeKey);
  const encounterEnvelopeKeys = [...new Set(rooms.map((room) => room.encounterEnvelopeKey))];
  const encounterSetKeys: string[] = [];
  const encounterDefinitionKeys: string[] = [];
  for (const room of rooms) {
    for (const binding of room.encounterSlotBindings) {
      if (binding.kind === 'fixed') {
        if (!encounterDefinitionKeys.includes(binding.encounterDefinitionKey)) {
          encounterDefinitionKeys.push(binding.encounterDefinitionKey);
        }
        if (
          binding.rivalsEncounterDefinitionKey !== undefined &&
          !encounterDefinitionKeys.includes(binding.rivalsEncounterDefinitionKey)
        ) {
          encounterDefinitionKeys.push(binding.rivalsEncounterDefinitionKey);
        }
        if (
          binding.shadowEncounterDefinitionKey !== undefined &&
          !encounterDefinitionKeys.includes(binding.shadowEncounterDefinitionKey)
        ) {
          encounterDefinitionKeys.push(binding.shadowEncounterDefinitionKey);
        }
        continue;
      }
      if (!encounterSetKeys.includes(binding.encounterSetKey)) {
        encounterSetKeys.push(binding.encounterSetKey);
      }
      const encounterSet = catalog.encounterSets.byKey[binding.encounterSetKey];
      for (const encounterDefinitionKey of encounterSet?.encounterDefinitionKeys ?? []) {
        if (!encounterDefinitionKeys.includes(encounterDefinitionKey)) {
          encounterDefinitionKeys.push(encounterDefinitionKey);
        }
      }
    }
  }
  const exitTypeKeys = [...new Set(rooms.flatMap((room) => room.exits.map((exit) => exit.type)))];
  const exitCompatibilityPolicyKeys = [
    ...new Set(
      exitTypeKeys.map(
        (exitTypeKey) => catalog.exitTypes.byKey[exitTypeKey]?.compatibilityPolicyKey,
      ),
    ),
  ].filter((key): key is string => key !== undefined);
  return {
    layout: catalog.biomeLayouts.byKey[biomeKey],
    // Map points and orientation are generated map facts with their own regeneration witness.
    rooms: rooms.map((room) => ({ ...room, mapPoints: undefined, orientation: undefined })),
    encounterEnvelopes: encounterEnvelopeKeys.map((key) => catalog.encounterEnvelopes.byKey[key]),
    encounterDefinitions: encounterDefinitionKeys.map(
      (key) => catalog.encounterDefinitions.byKey[key],
    ),
    encounterSets: encounterSetKeys.map((key) => catalog.encounterSets.byKey[key]),
    exitTypes: exitTypeKeys.map((key) => catalog.exitTypes.byKey[key]),
    exitCompatibilityPolicies: exitCompatibilityPolicyKeys.map(
      (key) => catalog.exitCompatibilityPolicies.byKey[key],
    ),
  };
}

function snapshotHash(value: unknown): string {
  const serialized = JSON.stringify(value);
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= BigInt(serialized.charCodeAt(index));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

describe('normalized catalog declaration snapshots', () => {
  it.each(normalizedBiomeSnapshotHashes)(
    '%s keeps an exact normalized declaration snapshot',
    (biomeKey, expectedHash) => {
      // This snapshot includes every normalized room, its reward binding,
      // eligibility/force/counter/cap fields, local children and exits, plus
      // the layout, encounter envelopes, slot bindings, definitions, sets,
      // and exit compatibility it references.
      expect(snapshotHash(normalizedBiomeSnapshot(biomeKey))).toBe(expectedHash);
    },
  );
});

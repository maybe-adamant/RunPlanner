import type { Catalog, EncounterEnvelopeSlot, RoomDeclaration } from '../../catalog-schema';
import type { RoomEncounterState } from '../../authored-project/model';
import {
  createEncounterPhaseAddress,
  type EncounterPhaseAddress,
  type BiomeAddress,
} from '../../authored-project/addresses';
import {
  encounterBindingsBySlot,
  encounterEnvelopeSlots,
  encounterSetForBinding,
} from '../../authored-project/room-state/encounters';

/**
 * The authored encounter surface for one active room phase. Set-backed phases
 * expose their declaration choices; fixed phases appear only when their
 * declaration owns an encounter trait offer. Candidate eligibility is
 * deliberately absent: this is the declaration and persisted-selection
 * domain used to keep controls present while evaluation is unavailable.
 */
export interface EncounterPhaseAuthoringDomain {
  readonly origin: EncounterPhaseAddress;
  readonly slotKey: string;
  readonly selectedEncounterKey: string;
  readonly declaredEncounterKeys: readonly string[];
  readonly defaultEncounterKey: string;
}

export type EncounterPhaseAuthoringOwner = EncounterPhaseAddress['owner'];

/**
 * Authored facts that control template-owned phase activation. These are
 * structural facts, not contextual candidate eligibility.
 */
export interface EncounterPhaseAuthoringRoomOptions {
  readonly shipEncounterCount?: 2 | 3;
  readonly fieldsCageRewardCount?: number;
}

function templateSlotActive(
  room: RoomDeclaration,
  slot: EncounterEnvelopeSlot,
  options: EncounterPhaseAuthoringRoomOptions,
): boolean {
  if (slot.activation === 'always') return true;

  if (room.mode.kind === 'authored' && room.mode.templateKey === 'ShipCombat') {
    if (room.encounterEnvelopeKey !== 'ShipEncounter' || slot.key !== 'Combat2') {
      throw new Error(`${room.gameName}.${slot.key} is not a supported ShipCombat phase`);
    }
    if (options.shipEncounterCount === undefined) {
      throw new Error(`${room.gameName}.${slot.key} requires the authored encounter count`);
    }
    return options.shipEncounterCount === 3;
  }

  if (room.mode.kind === 'authored' && room.mode.templateKey === 'FieldsCombat') {
    if (room.encounterEnvelopeKey !== 'FieldsEncounter' || !slot.key.startsWith('Cage')) {
      throw new Error(`${room.gameName}.${slot.key} is not a supported FieldsCombat phase`);
    }
    if (options.fieldsCageRewardCount === undefined) {
      throw new Error(`${room.gameName}.${slot.key} requires the authored Fields cage count`);
    }
    const index = Number(slot.key.slice('Cage'.length));
    if (!Number.isInteger(index) || index <= 0) {
      throw new Error(`${room.gameName}.${slot.key} has no Fields cage ordinal`);
    }
    return index <= options.fieldsCageRewardCount;
  }

  throw new Error(`${room.gameName}.${slot.key} has unsupported template-controlled activation`);
}

/**
 * Resolves the authored encounter controls for one room occurrence or local
 * child. It consults only catalog membership, the persisted selection, and
 * explicit template activation facts; it never evaluates requirements.
 */
export function encounterPhaseAuthoringDomainForRoom(
  catalog: Catalog,
  biome: BiomeAddress,
  room: RoomDeclaration,
  owner: EncounterPhaseAuthoringOwner,
  encounters: RoomEncounterState,
  options: EncounterPhaseAuthoringRoomOptions = {},
): readonly EncounterPhaseAuthoringDomain[] {
  const bindings = encounterBindingsBySlot(catalog, room, room.gameName);
  const slots = new Map(
    encounterEnvelopeSlots(catalog, room, room.gameName).map((slot) => [slot.key, slot]),
  );
  const domains: EncounterPhaseAuthoringDomain[] = [];
  for (const binding of bindings.values()) {
    if (
      binding.kind === 'fixed' &&
      catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]?.traitOfferProducer ===
        undefined
    )
      continue;
    const slot = slots.get(binding.slotKey);
    if (slot === undefined || !templateSlotActive(room, slot, options)) continue;
    const selectedEncounterKey =
      binding.kind === 'fixed'
        ? binding.encounterDefinitionKey
        : encounters.encounterKeyByPhase[binding.slotKey];
    if (selectedEncounterKey === undefined) {
      throw new Error(`${room.gameName}.${binding.slotKey} has no authored encounter selection`);
    }
    const declaredEncounterKeys =
      binding.kind === 'fixed'
        ? [binding.encounterDefinitionKey]
        : encounterSetForBinding(catalog, binding, room.gameName).encounterDefinitionKeys;
    if (!declaredEncounterKeys.includes(selectedEncounterKey)) {
      throw new Error(
        `${room.gameName}.${binding.slotKey} selected ${selectedEncounterKey} outside its declaration`,
      );
    }
    domains.push(
      Object.freeze({
        origin: createEncounterPhaseAddress(biome, owner, binding.slotKey),
        slotKey: binding.slotKey,
        selectedEncounterKey,
        declaredEncounterKeys: Object.freeze([...declaredEncounterKeys]),
        defaultEncounterKey:
          binding.kind === 'fixed'
            ? binding.encounterDefinitionKey
            : encounterSetForBinding(catalog, binding, room.gameName).defaultEncounterDefinitionKey,
      }),
    );
  }
  return Object.freeze(domains);
}

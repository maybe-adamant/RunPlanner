import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { RoomEncounterState } from '../../authored-project/model';
import {
  encounterEnvelopeSlots,
  selectedEncounterDefinitionKey,
} from '../../authored-project/room-state/encounters';
import type { ResolvedEncounterPhase } from './model';

export class EncounterResolutionContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'EncounterResolutionContractError';
  }
}

function fail(detail: string): never {
  throw new EncounterResolutionContractError(detail);
}

/**
 * Resolves a declaration-owned active slot prefix to its exact concrete
 * definitions. Membership and fixed-slot closure are checked at the authored
 * state boundary; this function deliberately does not evaluate dynamic
 * requirements, so an authored-invalid selection remains observable by the
 * later evaluator rather than being replaced here.
 */
export function resolveEncounterPhases(
  catalog: Catalog,
  room: RoomDeclaration,
  encounters: RoomEncounterState,
  activeSlotKeys: readonly string[],
  path: string,
): readonly ResolvedEncounterPhase[] {
  const slots = encounterEnvelopeSlots(catalog, room, path);
  const slotByKey = new Map(slots.map((slot) => [slot.key, slot]));
  const active = new Set(activeSlotKeys);
  if (active.size !== activeSlotKeys.length) {
    return fail(`${room.gameName} repeats an active encounter slot`);
  }
  const expectedPrefix = slots.slice(0, activeSlotKeys.length).map((slot) => slot.key);
  if (
    expectedPrefix.length !== activeSlotKeys.length ||
    expectedPrefix.some((slotKey, index) => slotKey !== activeSlotKeys[index])
  ) {
    return fail(`${room.gameName} selected non-envelope encounter slot order`);
  }
  return Object.freeze(
    activeSlotKeys.map((slotKey) => {
      const slot = slotByKey.get(slotKey);
      if (slot === undefined) return fail(`${room.gameName} has no encounter slot ${slotKey}`);
      const encounterKey = selectedEncounterDefinitionKey(catalog, room, encounters, slotKey, path);
      const definition = catalog.encounterDefinitions.byKey[encounterKey];
      if (definition === undefined) return fail(`${room.gameName} lost encounter ${encounterKey}`);
      return Object.freeze({
        slotKey,
        envelopeKey: room.encounterEnvelopeKey,
        encounterKey: definition.key,
        label: definition.label,
        kind: definition.kind,
        countsEncounterDepth: definition.countsEncounterDepth,
        canEncounterSkip: definition.canEncounterSkip === true,
        blocksFigLeaf: definition.blocksFigLeaf === true,
        blocksGorgon: definition.blocksGorgon === true,
        hostsGorgon: definition.hostsGorgon === true,
        skipEndEncounterEffects: definition.skipEndEncounterEffects === true,
        figLeafSkip: encounters.figLeafSkipByPhase[slotKey] === true,
        ...(definition.sequenceEffect === undefined
          ? {}
          : { sequenceEffect: definition.sequenceEffect }),
        ...(slot.rewardAttachment === undefined ? {} : { rewardAttachment: slot.rewardAttachment }),
      });
    }),
  );
}

export function alwaysActiveEncounterSlotKeys(
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): readonly string[] {
  return Object.freeze(
    encounterEnvelopeSlots(catalog, room, path)
      .filter((slot) => slot.activation === 'always')
      .map((slot) => slot.key),
  );
}

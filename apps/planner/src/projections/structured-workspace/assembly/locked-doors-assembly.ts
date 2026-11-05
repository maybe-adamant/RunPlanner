import {
  createRoomFeatureAddress,
  lockableExitKeys,
  semanticAddressKey,
  type OccurrenceAddress,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  encounterCompositionView,
  type LockedDoorsInteraction,
} from '@run-planner/engine/simulation';

import type { WorkspaceLockedDoors, WorkspaceUnlockExitEncounter } from '../contracts/features';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';
import { projectEncounterComposition } from '../interactions/generated-encounter-projection';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import { projectEncounterCustomizationDecision } from './occurrence-reward-assembly';
import { normalExitOrdinal } from './ordering';

type EntryRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomObjectActions' }
>;

const doorLabel = (exitKey: string) => {
  const ordinal = normalExitOrdinal(exitKey);
  return ordinal === undefined ? 'Door' : `Door ${ordinal}`;
};

/**
 * A lock host's doors as the engine publishes them at its entry: each door
 * that can lock with its toggle, the presses its Doors object can add and the
 * doors still locked at leave. While the room is unreached its doors show
 * their authored locks, waiting. Absent for a room that cannot lock.
 */
export function assembleLockedDoors(input: {
  readonly catalog: Catalog;
  readonly occurrence: RoomOccurrence;
  readonly address: OccurrenceAddress;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly product: LockedDoorsInteraction | undefined;
}):
  | {
      readonly lockedDoors: WorkspaceLockedDoors;
      readonly requirements: readonly EntryRequirement[];
    }
  | undefined {
  const { occurrence, product } = input;
  const exitKeys = lockableExitKeys(input.catalog, occurrence.gameName);
  if (exitKeys.length === 0) return undefined;
  const address = createRoomFeatureAddress(input.address, { kind: 'lockedExits' });
  const interactionKey = semanticAddressKey(address);
  const locked = occurrence.lockedExits ?? [];
  const doors = (product?.doors ?? exitKeys.map((exitKey) => ({ exitKey }))).map((door) =>
    Object.freeze({
      exitKey: door.exitKey,
      label: doorLabel(door.exitKey),
      locked: locked.includes(door.exitKey),
      ...(product === undefined
        ? { lock: 'unreached' as const }
        : 'lock' in door && door.lock !== undefined
          ? { lock: door.lock }
          : {}),
    }),
  );
  const toggles: EntryRequirement = Object.freeze({
    kind: 'roomObjectActions' as const,
    owner: input.address,
    interactionKey,
    options: Object.freeze(
      (product?.doors ?? []).flatMap((door) =>
        door.command === undefined
          ? []
          : [Object.freeze({ key: door.exitKey, command: door.command })],
      ),
    ),
  });
  const unlockKey = `doorUnlocks:${semanticAddressKey(input.address)}`;
  const appendable = (product?.unlocks ?? []).flatMap((unlock) =>
    unlock.append === undefined ? [] : [{ exitKey: unlock.exitKey, command: unlock.append }],
  );
  const unlocks: EntryRequirement = Object.freeze({
    kind: 'roomObjectActions' as const,
    owner: input.address,
    interactionKey: unlockKey,
    options: Object.freeze(
      appendable.map((unlock) => Object.freeze({ key: unlock.exitKey, command: unlock.command })),
    ),
  });
  return Object.freeze({
    lockedDoors: Object.freeze({
      address,
      marker: input.markerDestinations.marker(address),
      interactionKey,
      doors: Object.freeze(doors),
      ...(product?.unlocks === undefined
        ? {}
        : {
            unlocks: Object.freeze({
              interactionKey: unlockKey,
              options: Object.freeze(
                appendable.map((unlock) =>
                  Object.freeze({
                    exitKey: unlock.exitKey,
                    label: `Unlock ${doorLabel(unlock.exitKey)}`,
                  }),
                ),
              ),
            }),
          }),
      lockedAtLeave: product?.lockedAtLeave ?? Object.freeze([]),
    }),
    requirements: Object.freeze([toggles, unlocks]),
  });
}

/** Each pressed door's fight, as the engine prepared it at the press, by its press's action key. */
export function assembleUnlockExitEncounters(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  product: LockedDoorsInteraction | undefined,
): ReadonlyMap<string, WorkspaceUnlockExitEncounter> {
  const encounters = new Map<string, WorkspaceUnlockExitEncounter>();
  for (const unlock of product?.unlocks ?? []) {
    const encounter = unlock.encounter;
    if (encounter === undefined) continue;
    const view = encounterCompositionView(catalog, encounter);
    encounters.set(
      unlock.action.actionKey,
      Object.freeze({
        address: unlock.action,
        interactionKey: semanticAddressKey(unlock.action),
        definitionKey: encounter.selectedEncounterDefinitionKey,
        label: encounter.label,
        ...(encounter.customization.length === 0
          ? {}
          : {
              customization: Object.freeze(
                encounter.customization.map((decision) =>
                  projectEncounterCustomizationDecision(decision, occurrence.gameName),
                ),
              ),
            }),
        ...(view === undefined ? {} : { composition: projectEncounterComposition(view) }),
      }),
    );
  }
  return encounters;
}

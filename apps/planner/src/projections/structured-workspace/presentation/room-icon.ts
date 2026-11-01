import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { encounterNpcKey } from '@planner/projections/encounterPickerProjection';
import type { WorkspaceEncounterPhase, WorkspaceRoomLocal } from '../contract';
import type { WorkspaceRoomIcon } from '../contracts/structure';

/** The encounter a room's icon depicts: its miniboss identity and story NPC. */
export interface WorkspaceRoomIconEncounter {
  readonly encounterDefinitionKey: string;
  readonly npcKey?: string;
}

/**
 * The encounter a room declares outright through its one fixed slot, such as
 * a miniboss or story room; undefined where the room draws its encounter.
 */
export function declaredRoomIconEncounter(
  catalog: Catalog,
  declaration: RoomDeclaration,
): WorkspaceRoomIconEncounter | undefined {
  const [binding, ...rest] = declaration.encounterSlotBindings;
  if (binding?.kind !== 'fixed' || rest.length > 0) return undefined;
  const npcKey = encounterNpcKey(catalog, binding.encounterDefinitionKey);
  return Object.freeze({
    encounterDefinitionKey: binding.encounterDefinitionKey,
    ...(npcKey === undefined ? {} : { npcKey }),
  });
}

/** Classifies a room by its declaration: enemies, no enemies, or its own object or NPC. */
export function workspaceRoomIcon(input: {
  readonly biomeKey: string;
  readonly declaration: RoomDeclaration;
  readonly encounter: WorkspaceRoomIconEncounter | undefined;
  /** The room hosts a shop, whatever its declaration kind. */
  readonly shop: boolean;
}): WorkspaceRoomIcon {
  const { biomeKey, declaration, encounter } = input;
  if (input.shop) return Object.freeze({ kind: 'shop' as const });
  if (declaration.mode.kind === 'authored') {
    if (declaration.mode.templateKey === 'Chaos') return Object.freeze({ kind: 'chaos' as const });
    if (declaration.mode.templateKey === 'ContractBoss')
      return Object.freeze({ kind: 'contract' as const });
  }
  switch (declaration.kind) {
    case 'Shop':
      return Object.freeze({ kind: 'shop' as const });
    case 'Reprieve':
      return Object.freeze({ kind: 'fountain' as const, biomeKey });
    case 'Boss':
      return Object.freeze({ kind: 'boss' as const, biomeKey });
    case 'Miniboss':
      return Object.freeze({
        kind: 'miniboss' as const,
        ...(encounter === undefined
          ? {}
          : { encounterDefinitionKey: encounter.encounterDefinitionKey }),
      });
    case 'Story':
      return Object.freeze({
        kind: 'story' as const,
        ...(encounter?.npcKey === undefined ? {} : { npcKey: encounter.npcKey }),
      });
    case 'Combat':
    case 'Opening':
    case 'Devotion':
      return Object.freeze({ kind: 'combat' as const, biomeKey });
    case 'Intro':
    case 'PreHub':
    case 'Hub':
    case 'Preboss':
    case 'PostBoss':
      return Object.freeze({ kind: 'empty' as const, biomeKey });
  }
}

/** The icon of a room a picker offers by game name, before any occurrence exists. */
export function candidateRoomIcon(
  catalog: Catalog,
  biomeKey: string,
  declaration: RoomDeclaration,
): WorkspaceRoomIcon {
  return workspaceRoomIcon({
    biomeKey,
    declaration,
    encounter: declaredRoomIconEncounter(catalog, declaration),
    // A room whose incoming reward is a shop hosts one before any occurrence exists.
    shop: declaration.incomingReward.kind === 'shop',
  });
}

/** An occurrence's icon: its selected encounter and whether it hosts a shop. */
export function occurrenceRoomIcon(input: {
  readonly biomeKey: string;
  readonly declaration: RoomDeclaration;
  readonly encounterPhases: readonly WorkspaceEncounterPhase[];
  readonly roomLocal: WorkspaceRoomLocal;
}): WorkspaceRoomIcon {
  const encounter = input.encounterPhases[0]?.selectedEncounter;
  return workspaceRoomIcon({
    biomeKey: input.biomeKey,
    declaration: input.declaration,
    encounter:
      encounter === undefined
        ? undefined
        : {
            encounterDefinitionKey: encounter.nativeEncounterDefinitionKey ?? encounter.key,
            ...(encounter.npcKey === undefined ? {} : { npcKey: encounter.npcKey }),
          },
    shop: input.roomLocal.kind === 'shop',
  });
}

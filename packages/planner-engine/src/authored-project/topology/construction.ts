import type { BiomeLayout, Catalog, RoomDeclaration } from '../../catalog-schema';
import { createOccurrenceId } from '../addresses';
import type { BiomeTopology, OccurrenceId, RoomOccurrence, RouteLoadout } from '../model';
import type { RoomOccurrenceRole } from '../room-state/declaration';
import { createDefaultRoomState } from '../room-state/defaults';
import { createDefaultRoomEncounterState } from '../room-state/encounter-envelope';
import { createDefaultRoomActionState } from '../room-actions/state';
import type { ResolvedRoutePosition } from '../route-context';
import { resolveEntryDeclaration } from '../room-state/entry-resolution';
import { startingRewardAcquisitionFrom } from '../room-state/starting-reward';
import { createUnresolvedAcquisitionRewardState } from '../traits/state';

export function defaultOccurrence(
  catalog: Catalog,
  room: RoomDeclaration,
  occurrenceId: OccurrenceId,
  role: RoomOccurrenceRole,
  entryActive: boolean,
  resolvedStoreKey: string | undefined,
  loadout: RouteLoadout,
  activeCageCount?: number,
): RoomOccurrence {
  const state = createDefaultRoomState(catalog, room, {
    role,
    entryActive,
    ...(resolvedStoreKey === undefined ? {} : { resolvedStoreKey }),
    loadout,
    ...(activeCageCount === undefined ? {} : { activeCageCount }),
  });
  const encounters = createDefaultRoomEncounterState(
    catalog,
    room,
    `occurrences.${occurrenceId}.encounters`,
  );
  return Object.freeze({
    occurrenceId,
    gameName: room.gameName,
    state,
    ...(state.kind === 'shop' && state.shop !== undefined
      ? { acquisitionSites: Object.freeze({ roomExit: Object.freeze({}) }) }
      : {}),
    encounters,
    roomActions: createDefaultRoomActionState(room),
    additionalExits: Object.freeze([]),
    ...(room.purgingPool === undefined
      ? {}
      : {
          purgingPool: Object.freeze({
            interacted: false,
            traitKeyBySlot: Object.freeze({ left: null, middle: null, right: null }),
          }),
        }),
    ...(room.surfaceShop?.forced === true
      ? {
          hermesShrine: Object.freeze({
            offerBySlot: Object.freeze({ first: null, secondLeft: null, secondRight: null }),
          }),
        }
      : {}),
    ...(room.roomShop?.forced === true
      ? {
          stygianWell: Object.freeze({
            interacted: false,
            offerKeyBySlot: Object.freeze({ healing: null, secondLeft: null, secondRight: null }),
          }),
        }
      : {}),
  });
}

function declaredStartOccurrenceId(biomeKey: string): OccurrenceId {
  return createOccurrenceId(`${biomeKey}:start`);
}

export function createStartTopology(
  catalog: Catalog,
  room: RoomDeclaration,
  occurrenceId: OccurrenceId,
  loadout: RouteLoadout,
  routePosition: ResolvedRoutePosition,
): BiomeTopology {
  const occurrence = defaultOccurrence(
    catalog,
    room,
    occurrenceId,
    'ordinary',
    true,
    undefined,
    loadout,
  );
  const startingRewardAcquisition =
    routePosition.isFirst && loadout.startingReward !== null
      ? (() => {
          const binding = catalog.runStartReward.incomingReward;
          return startingRewardAcquisitionFrom(
            createUnresolvedAcquisitionRewardState(catalog, loadout.startingReward, {
              kind: 'producerLifecycle',
              key: binding.producerLifecycleKey,
            }),
          );
        })()
      : undefined;
  return Object.freeze({
    startOccurrenceId: occurrenceId,
    occurrences: Object.freeze([
      startingRewardAcquisition === undefined
        ? occurrence
        : Object.freeze({ ...occurrence, startingRewardAcquisition }),
    ]),
    decisions: Object.freeze([]),
    fixedRoomLinks: Object.freeze([]),
  });
}

export function createDefaultStartTopology(
  catalog: Catalog,
  layout: BiomeLayout,
  routePosition: ResolvedRoutePosition,
  loadout: RouteLoadout,
): BiomeTopology | null {
  const gameName =
    layout.start.kind === 'fixedAuthored'
      ? layout.start.roomGameName
      : layout.start.roomGameNames.length === 1
        ? layout.start.roomGameNames[0]
        : undefined;
  if (gameName === undefined) return null;
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) throw new Error(`unknown declared start room ${gameName}`);
  return createStartTopology(
    catalog,
    resolveEntryDeclaration(declaration, routePosition),
    declaredStartOccurrenceId(layout.biomeKey),
    loadout,
    routePosition,
  );
}

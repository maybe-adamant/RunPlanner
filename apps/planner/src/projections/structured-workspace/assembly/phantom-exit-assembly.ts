import {
  createPhantomExitAddress,
  phantomPlaceholderDraw,
  phantomPlaceholderRewardTypes,
  routeRoomDeclaration,
  semanticAddressKey,
  type BiomeAddress,
  type PhantomExitAddress,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { PhantomExitSettlement } from '@run-planner/engine/simulation';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspacePhantomExitControl } from '../contracts/structure';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import { requireWorkspaceRoom } from './catalog-room';

export interface WorkspacePhantomExitAssembly {
  readonly control: WorkspacePhantomExitControl;
  readonly requirement: Extract<
    WorkspaceOccurrenceInteractionRequirement,
    { readonly kind: 'phantomExit' }
  >;
}

function rewardTypeLabel(catalog: Catalog, rewardType: string): string {
  const declared = catalog.rewards.rewardTypes.byKey[rewardType];
  if (declared === undefined)
    throw new StructuredWorkspaceProjectionContractError(
      `phantom exit names unknown reward type ${rewardType}`,
    );
  return declared.label;
}

/**
 * The hidden door a room's first doors unlock fills. Unpinned fields show the
 * engine settlement, and the summary names the settled door; the placeholder candidates and their exclusions are the
 * engine's, and the reward domain is the pinned placeholder's declared store.
 */
export function assemblePhantomExit(input: {
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly occurrence: RoomOccurrence;
  readonly settlement: (owner: PhantomExitAddress) => PhantomExitSettlement | undefined;
}): WorkspacePhantomExitAssembly | undefined {
  const value = input.occurrence.phantomExit;
  if (value === undefined) return undefined;
  const { catalog } = input;
  const address = createPhantomExitAddress(input.biome, input.occurrence.occurrenceId);
  const roomLabel = (gameName: string) =>
    routeRoomDeclaration(requireWorkspaceRoom(catalog, gameName), input.biome.routeKey).label;
  const settled = input.settlement(address);
  const pinnedRoom = value.placeholderRoomGameName;
  const draws =
    settled !== undefined
      ? settled.storeKey !== undefined
      : pinnedRoom === null
        ? undefined
        : phantomPlaceholderDraw(catalog, pinnedRoom) !== undefined;
  const settledReward = settled?.offers[0]?.rewardType;
  const rewardLocked =
    settled === undefined
      ? draws === false
        ? ('noDraw' as const)
        : ('unreached' as const)
      : !draws
        ? ('noDraw' as const)
        : pinnedRoom === null
          ? ('autoRoom' as const)
          : undefined;
  const interactionKey = semanticAddressKey(address);
  const effectiveRoom = pinnedRoom ?? settled?.placeholderRoomGameName;
  const effectiveReward = value.rewardType ?? settledReward;
  const rewardSummary =
    effectiveReward !== undefined
      ? rewardTypeLabel(catalog, effectiveReward)
      : draws === false
        ? 'No reward'
        : 'Automatic';
  const control: WorkspacePhantomExitControl = Object.freeze({
    address,
    interactionKey,
    marker: input.markerDestinations.marker(address),
    pinned: pinnedRoom !== null || value.rewardType !== null,
    ...(settled === undefined
      ? {}
      : {
          summary: `${roomLabel(settled.placeholderRoomGameName)} · ${
            settledReward === undefined ? 'no reward' : rewardTypeLabel(catalog, settledReward)
          }`,
        }),
    room: Object.freeze({
      summary: effectiveRoom === undefined ? 'Automatic' : roomLabel(effectiveRoom),
      ...(settled === undefined ? { locked: 'unreached' as const } : {}),
    }),
    reward: Object.freeze({
      summary: rewardSummary,
      ...(rewardLocked === undefined ? {} : { locked: rewardLocked }),
    }),
  });
  const requirement = Object.freeze({
    kind: 'phantomExit' as const,
    owner: address,
    interactionKey,
    value,
    ...(effectiveRoom === undefined ? {} : { effectiveRoomGameName: effectiveRoom }),
    ...(effectiveReward === undefined ? {} : { effectiveRewardType: effectiveReward }),
    rooms: Object.freeze(
      (settled?.placeholderCandidates ?? []).map((candidate) =>
        Object.freeze({
          gameName: candidate.roomGameName,
          label: roomLabel(candidate.roomGameName),
          ...(candidate.exclusion === undefined ? {} : { exclusion: candidate.exclusion }),
        }),
      ),
    ),
    rewardTypes: Object.freeze(
      pinnedRoom === null
        ? []
        : phantomPlaceholderRewardTypes(catalog, pinnedRoom).map((rewardType) =>
            Object.freeze({ rewardType, label: rewardTypeLabel(catalog, rewardType) }),
          ),
    ),
  });
  return Object.freeze({ control, requirement });
}

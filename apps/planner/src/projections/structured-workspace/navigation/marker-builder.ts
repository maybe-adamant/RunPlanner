import {
  semanticAddressKey,
  type BiomeAddress,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceAssessment,
  type WorkspaceHubTab,
  type WorkspaceInspectorDestination,
  type WorkspaceMarker,
  type WorkspaceRoomTab,
} from '../contract';

/**
 * Family assemblers may publish markers and redirect their own markers into a
 * containing workbench, but they cannot inspect registrations made by another
 * family or occurrence.
 */
export interface WorkspaceMarkerDestinationEmitter {
  marker(address: SemanticAddress, nodeKey?: string): WorkspaceMarker;
  redirect(markers: Iterable<WorkspaceMarker>, nodeKey: string): void;
  redirectTo(marker: WorkspaceMarker, focus: WorkspaceMarker, nodeKey: string): void;
  setHubTab(markers: Iterable<WorkspaceMarker>, tab: WorkspaceHubTab): void;
  setRoomTab(markers: Iterable<WorkspaceMarker>, tab: WorkspaceRoomTab): void;
}

export interface WorkspaceBiomeMarkerDestinationBuilder {
  readonly emitter: WorkspaceMarkerDestinationEmitter;
  destinations(): ReadonlyMap<string, WorkspaceInspectorDestination>;
}

export interface WorkspaceBiomeMarkerDestinationBuilderInput {
  readonly assessmentFor: (address: SemanticAddress) => WorkspaceAssessment;
  readonly biome: BiomeAddress;
  readonly findingCountFor: (address: SemanticAddress) => number;
  readonly routeKey: string;
}

/**
 * Owns the mutable, biome-local preliminary containment map. It remains
 * private to composition until every semantic family has emitted its markers.
 */
export function createWorkspaceBiomeMarkerDestinationBuilder(
  input: WorkspaceBiomeMarkerDestinationBuilderInput,
): WorkspaceBiomeMarkerDestinationBuilder {
  const destinations = new Map<string, WorkspaceInspectorDestination>();

  const requireRegistered = (marker: WorkspaceMarker): WorkspaceInspectorDestination => {
    const destination = destinations.get(marker.focusKey);
    if (destination === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${marker.focusKey} has no registered focus destination`,
      );
    }
    return destination;
  };

  const emitter: WorkspaceMarkerDestinationEmitter = Object.freeze({
    marker(address: SemanticAddress, nodeKey = semanticAddressKey(address)): WorkspaceMarker {
      const focusKey = semanticAddressKey(address);
      const marker = Object.freeze({
        address,
        assessment: input.assessmentFor(address),
        findingCount: input.findingCountFor(address),
        focusKey,
      });
      if (!destinations.has(focusKey)) {
        destinations.set(
          focusKey,
          Object.freeze({
            biomeKey: input.biome.biomeKey,
            focusAddress: address,
            focusKey,
            nodeKey,
            ownerAddress: address,
            region: 'structure',
            routeKey: input.routeKey,
            ...(address.kind === 'traitOffer' ? { traitDialogTarget: address } : {}),
            ...(address.kind === 'traitAcquisitionTarget'
              ? { traitDialogTarget: address.trait }
              : {}),
            ...(address.kind === 'circeResolution' ? { traitDialogTarget: address.trait } : {}),
            ...(address.kind === 'echoPomTarget' ? { traitDialogTarget: address.trait } : {}),
            ...(address.kind === 'echoLastRunBoon' ? { traitDialogTarget: address.trait } : {}),
            ...(address.kind === 'echoLastReward' ? { traitDialogTarget: address.trait } : {}),
            ...(address.kind === 'allTogetherSet' ? { traitDialogTarget: address.trait } : {}),
            ...(address.kind === 'naturalSelectionResult'
              ? { traitDialogTarget: address.trait }
              : {}),
            ...(address.kind === 'levelResolution' ? { levelResolutionDialogTarget: address } : {}),
          }),
        );
      }
      return marker;
    },
    redirect(markers: Iterable<WorkspaceMarker>, nodeKey: string): void {
      for (const marker of markers) {
        const destination = requireRegistered(marker);
        destinations.set(marker.focusKey, Object.freeze({ ...destination, nodeKey }));
      }
    },
    redirectTo(marker: WorkspaceMarker, focus: WorkspaceMarker, nodeKey: string): void {
      const existing = requireRegistered(marker);
      destinations.set(
        marker.focusKey,
        Object.freeze({
          ...existing,
          biomeKey: input.biome.biomeKey,
          focusAddress: focus.address,
          focusKey: focus.focusKey,
          nodeKey,
          ownerAddress: marker.address,
          region: 'structure',
          routeKey: input.routeKey,
        }),
      );
    },
    setHubTab(markers: Iterable<WorkspaceMarker>, tab: WorkspaceHubTab): void {
      for (const marker of markers) {
        const destination = requireRegistered(marker);
        destinations.set(marker.focusKey, Object.freeze({ ...destination, hubTab: tab }));
      }
    },
    setRoomTab(markers: Iterable<WorkspaceMarker>, tab: WorkspaceRoomTab): void {
      for (const marker of markers) {
        const destination = requireRegistered(marker);
        destinations.set(marker.focusKey, Object.freeze({ ...destination, roomTab: tab }));
      }
    },
  });

  return Object.freeze({
    emitter,
    destinations: () => new Map(destinations),
  });
}

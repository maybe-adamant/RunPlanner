import {
  semanticAddressKey,
  type BiomeAddress,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';

import { StructuredWorkspaceProjectionContractError, type WorkspaceAssessment } from '../contract';
import type {
  WorkspaceFindingControl,
  WorkspaceHubTab,
  WorkspaceInspectorDestination,
  WorkspaceMarker,
  WorkspaceRoomTab,
} from '../contracts/navigation';

/**
 * Family assemblers may publish markers and redirect their own markers into a
 * containing workbench, but they cannot inspect registrations made by another
 * family or occurrence.
 */
export interface WorkspaceMarkerDestinationEmitter {
  marker(address: SemanticAddress, nodeKey?: string): WorkspaceMarker;
  redirect(markers: Iterable<WorkspaceMarker>, nodeKey: string): void;
  /**
   * `mark` names the nested owner that carries the finding inside the focus;
   * `markControl` names an addressless control within that owner.
   */
  redirectTo(
    marker: WorkspaceMarker,
    focus: WorkspaceMarker,
    nodeKey: string,
    mark?: WorkspaceMarker,
    markControl?: WorkspaceFindingControl,
  ): void;
  /** Route a nested finding to a visible containing control without opening its leaf dialog. */
  redirectToContext(
    marker: WorkspaceMarker,
    focus: WorkspaceMarker,
    nodeKey: string,
    mark?: WorkspaceMarker,
    markControl?: WorkspaceFindingControl,
  ): void;
  /** Marks one finding code of `marker` on an upstream owner, keeping its navigation. */
  markCodeAt(marker: WorkspaceMarker, code: string, mark: WorkspaceMarker): void;
  setHubTab(markers: Iterable<WorkspaceMarker>, tab: WorkspaceHubTab): void;
  setRoomTab(markers: Iterable<WorkspaceMarker>, tab: WorkspaceRoomTab): void;
  setSideRoomDestination(markers: Iterable<WorkspaceMarker>, slotKey: string): void;
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
    redirectTo(
      marker: WorkspaceMarker,
      focus: WorkspaceMarker,
      nodeKey: string,
      mark?: WorkspaceMarker,
      markControl?: WorkspaceFindingControl,
    ): void {
      const {
        markAddress: _markAddress,
        markControl: _markControl,
        ...existing
      } = requireRegistered(marker);
      void _markAddress;
      void _markControl;
      destinations.set(
        marker.focusKey,
        Object.freeze({
          ...existing,
          biomeKey: input.biome.biomeKey,
          focusAddress: focus.address,
          focusKey: focus.focusKey,
          ...(mark === undefined ? {} : { markAddress: mark.address }),
          ...(mark === undefined || markControl === undefined ? {} : { markControl }),
          nodeKey,
          ownerAddress: marker.address,
          region: 'structure',
          routeKey: input.routeKey,
        }),
      );
    },
    redirectToContext(
      marker: WorkspaceMarker,
      focus: WorkspaceMarker,
      nodeKey: string,
      mark?: WorkspaceMarker,
      markControl?: WorkspaceFindingControl,
    ): void {
      const existing = requireRegistered(marker);
      const {
        levelResolutionDialogTarget: _levelResolutionDialogTarget,
        markAddress: _markAddress,
        markControl: _markControl,
        traitDialogTarget: _traitDialogTarget,
        ...context
      } = existing;
      void _levelResolutionDialogTarget;
      void _markAddress;
      void _markControl;
      void _traitDialogTarget;
      destinations.set(
        marker.focusKey,
        Object.freeze({
          ...context,
          biomeKey: input.biome.biomeKey,
          focusAddress: focus.address,
          focusKey: focus.focusKey,
          ...(mark === undefined ? {} : { markAddress: mark.address }),
          ...(mark === undefined || markControl === undefined ? {} : { markControl }),
          nodeKey,
          ownerAddress: marker.address,
          region: 'structure',
          routeKey: input.routeKey,
        }),
      );
    },
    markCodeAt(marker: WorkspaceMarker, code: string, mark: WorkspaceMarker): void {
      const destination = requireRegistered(marker);
      destinations.set(
        marker.focusKey,
        Object.freeze({
          ...destination,
          markByCode: Object.freeze({ ...destination.markByCode, [code]: mark.address }),
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
    setSideRoomDestination(markers: Iterable<WorkspaceMarker>, slotKey: string): void {
      for (const marker of markers) {
        const destination = requireRegistered(marker);
        destinations.set(
          marker.focusKey,
          Object.freeze({ ...destination, roomTab: 'sideRooms', sideRoomSlotKey: slotKey }),
        );
      }
    },
  });

  return Object.freeze({
    emitter,
    destinations: () => new Map(destinations),
  });
}

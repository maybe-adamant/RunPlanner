import { semanticAddressKey } from '@run-planner/engine/authored-project';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceInspectorDestination,
  type WorkspaceRewardControl,
  type WorkspaceRoomPickerControl,
} from './contract';

/** Composition never silently replaces a separately projected room control. */
export function appendUniqueRoomControls(
  controlsByOwner: Map<string, WorkspaceRoomPickerControl>,
  controls: Iterable<WorkspaceRoomPickerControl>,
): void {
  for (const control of controls) {
    const key = semanticAddressKey(control.address);
    if (controlsByOwner.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected room controls`,
      );
    }
    controlsByOwner.set(key, control);
  }
}

/** Composition never silently replaces a separately projected reward control. */
export function appendUniqueRewardControls(
  controlsByOwner: Map<string, WorkspaceRewardControl>,
  controls: Iterable<WorkspaceRewardControl>,
): void {
  for (const control of controls) {
    const key = semanticAddressKey(control.owner.address);
    if (controlsByOwner.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected reward controls`,
      );
    }
    controlsByOwner.set(key, control);
  }
}

/** Composition never silently replaces a separately projected focus destination. */
export function appendUniqueFocusDestinations(
  destinationsByOwner: Map<string, WorkspaceInspectorDestination>,
  destinations: Iterable<readonly [string, WorkspaceInspectorDestination]>,
): void {
  for (const [key, destination] of destinations) {
    const ownerKey = semanticAddressKey(destination.ownerAddress);
    if (key !== ownerKey) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} focus destination key does not match its semantic owner ${ownerKey}`,
      );
    }
    if (destinationsByOwner.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected focus destinations`,
      );
    }
    destinationsByOwner.set(key, destination);
  }
}

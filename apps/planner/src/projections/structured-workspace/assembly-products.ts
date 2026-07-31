import { semanticAddressKey } from '@run-planner/engine/authored-project';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceInspectorDestination,
  type WorkspaceNode,
  type WorkspaceRewardControl,
  type WorkspaceRoomPickerControl,
} from './contract';

/** Composition rejects duplicate structural identities as each family returns nodes. */
export function appendUniqueWorkspaceNodes(
  nodes: WorkspaceNode[],
  additions: Iterable<WorkspaceNode>,
): void {
  const keys = new Set(nodes.map((node) => node.key));
  for (const node of additions) {
    if (keys.has(node.key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${node.key} has multiple projected workspace nodes`,
      );
    }
    keys.add(node.key);
    nodes.push(node);
  }
}

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

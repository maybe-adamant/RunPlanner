import { type SemanticAddress } from '@run-planner/engine/authored-project';

import type { WorkspaceInteractionCatalog } from '@planner/projections/structured-workspace';
import type { ObservedWorkspaceProducts } from './observed-workspace';
import { workspaceTestOwnerKey } from './test-keys';

type OwnedInteractionMapName = Exclude<
  keyof WorkspaceInteractionCatalog,
  'exitFrontierCapabilities'
>;
type MapValue<T> = T extends ReadonlyMap<string, infer Value> ? Value : never;
export type ObservedOwnedInteraction = MapValue<
  WorkspaceInteractionCatalog[OwnedInteractionMapName]
>;

export function observedInteractionOwnerKey(interaction: ObservedOwnedInteraction): string {
  return workspaceTestOwnerKey(interaction.owner);
}

export function assertExactObservedInteraction(
  interaction: ObservedOwnedInteraction | undefined,
  key: string,
  owner: SemanticAddress | undefined,
  detail: string,
): void {
  if (interaction === undefined) throw new Error(`${detail} has no exact workspace interaction`);
  if (interaction.key !== key) {
    throw new Error(`${detail} has a conflicting workspace interaction key`);
  }
  if (
    owner !== undefined &&
    observedInteractionOwnerKey(interaction) !== workspaceTestOwnerKey(owner)
  ) {
    throw new Error(`${detail} has a conflicting workspace interaction owner`);
  }
}

export function assertExactObservedDestination(
  address: SemanticAddress,
  observed: ObservedWorkspaceProducts,
  detail: string,
  requireMarkerContainment = false,
): void {
  const key = workspaceTestOwnerKey(address);
  const destination = observed.focusByOwner.get(key);
  if (destination === undefined) throw new Error(`${detail} ${key} destination is missing`);
  if (workspaceTestOwnerKey(destination.ownerAddress) !== key) {
    throw new Error(`${detail} ${key} has no exact workspace destination`);
  }
  if (destination.region !== 'structure') {
    throw new Error(`${detail} ${key} does not resolve to a workspace node`);
  }
  const subject = destination.inspectorSubject;
  if (
    subject?.kind !== 'node' ||
    subject.nodeKey !== destination.nodeKey ||
    !observed.nodesByKey.has(destination.nodeKey) ||
    (requireMarkerContainment && !observed.markerNodeKeys.get(key)?.has(destination.nodeKey))
  ) {
    throw new Error(`${detail} ${key} has no exact workspace inspector destination`);
  }
}

export function assertObservedOwner(
  address: SemanticAddress,
  observed: ObservedWorkspaceProducts,
  detail: string,
  requireMarkerContainment = false,
): void {
  if (!observed.markersByOwner.has(workspaceTestOwnerKey(address))) {
    throw new Error(`${detail} has no workspace marker`);
  }
  assertExactObservedDestination(address, observed, detail, requireMarkerContainment);
}

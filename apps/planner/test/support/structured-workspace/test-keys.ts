import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';

/** Shared semantic keys used on both independent and observed test products. */
export function workspaceTestOwnerKey(address: SemanticAddress): string {
  return semanticAddressKey(address);
}

export function workspaceExpectedControlIdentity(kind: string, interactionKey: string): string {
  return `${kind}:${interactionKey}`;
}

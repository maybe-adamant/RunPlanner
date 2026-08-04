import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';

export function semanticOwnerElementId(address: SemanticAddress): string {
  return `semantic-owner-${encodeURIComponent(semanticAddressKey(address))}`;
}

/**
 * Local DOM identity for the editable control owned by a semantic address.
 * This is intentionally distinct from the finding marker's element identity.
 */
export function semanticOwnerControlElementId(address: SemanticAddress): string {
  return `semantic-owner-control-${encodeURIComponent(semanticAddressKey(address))}`;
}

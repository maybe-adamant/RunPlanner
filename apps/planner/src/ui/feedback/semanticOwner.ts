import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';

/**
 * Local DOM identity for the existing control or group owned by a semantic address.
 */
export function semanticOwnerControlElementId(address: SemanticAddress): string {
  return `semantic-owner-control-${encodeURIComponent(semanticAddressKey(address))}`;
}

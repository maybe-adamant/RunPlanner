import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';

export function semanticOwnerElementId(address: SemanticAddress): string {
  return `semantic-owner-${encodeURIComponent(semanticAddressKey(address))}`;
}

import { semanticAddressKey, type SemanticAddress } from '@run-planner/core';

export function semanticOwnerElementId(address: SemanticAddress): string {
  return `semantic-owner-${encodeURIComponent(semanticAddressKey(address))}`;
}

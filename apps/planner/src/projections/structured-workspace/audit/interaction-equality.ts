import { semanticAddressKey } from '@run-planner/engine/authored-project';

import type {
  WorkspaceHubSlotInteraction,
  WorkspaceTakeoverReplacementImpact,
  WorkspaceTopologyRemovalInteraction,
  WorkspaceTopologyRemovalScope,
} from '../contract';

export function sameTopologyRemovalScope(
  actual: WorkspaceTopologyRemovalScope,
  expected: WorkspaceTopologyRemovalScope,
): boolean {
  const same = <T>(left: readonly T[], right: readonly T[]): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);
  return (
    same(
      actual.removedDecisionOwners.map(semanticAddressKey),
      expected.removedDecisionOwners.map(semanticAddressKey),
    ) &&
    same(actual.removedHubDecisionKeys, expected.removedHubDecisionKeys) &&
    same(actual.removedOccurrenceIds, expected.removedOccurrenceIds)
  );
}

export function sameHubSlotClose(
  actual: WorkspaceHubSlotInteraction['close'],
  expected: WorkspaceHubSlotInteraction['close'],
): boolean {
  if (actual === undefined || expected === undefined) return actual === expected;
  return (
    actual.command.kind === expected.command.kind &&
    semanticAddressKey(actual.command.slot) === semanticAddressKey(expected.command.slot) &&
    sameTopologyRemovalScope(actual.impact, expected.impact)
  );
}

export function sameTopologyRemovalInteraction(
  actual: WorkspaceTopologyRemovalInteraction,
  expected: WorkspaceTopologyRemovalInteraction,
): boolean {
  if (
    actual.action !== expected.action ||
    actual.key !== expected.key ||
    semanticAddressKey(actual.owner) !== semanticAddressKey(expected.owner) ||
    !sameTopologyRemovalScope(actual.impact, expected.impact)
  ) {
    return false;
  }
  switch (actual.action) {
    case 'clearTopology':
      return (
        expected.action === 'clearTopology' &&
        semanticAddressKey(actual.command.biome) === semanticAddressKey(expected.command.biome)
      );
    case 'removeExitDecision':
      return (
        expected.action === 'removeExitDecision' &&
        semanticAddressKey(actual.command.decision) ===
          semanticAddressKey(expected.command.decision)
      );
  }
}

export function sameTakeoverReplacementImpact(
  actual: WorkspaceTakeoverReplacementImpact | undefined,
  expected: WorkspaceTakeoverReplacementImpact | undefined,
): boolean {
  if (actual === undefined || expected === undefined) return actual === expected;
  const sameValues = <T>(left: readonly T[], right: readonly T[]): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);
  return (
    actual.command === expected.command &&
    semanticAddressKey(actual.owner) === semanticAddressKey(expected.owner) &&
    sameValues(
      actual.removedDecisionOwners.map(semanticAddressKey),
      expected.removedDecisionOwners.map(semanticAddressKey),
    ) &&
    sameValues(actual.removedOccurrenceIds, expected.removedOccurrenceIds) &&
    sameValues(actual.replacedOccurrenceIds, expected.replacedOccurrenceIds)
  );
}

import type { ExitCompatibilityPolicy, ExitTypeDeclaration } from '@run-planner/core';

export const exitCompatibilityPolicies = [
  {
    key: 'Unconstrained',
    kind: 'unconstrained',
  },
  {
    key: 'TargetOutdoor',
    kind: 'targetHasTag',
    targetTag: 'Outdoor',
  },
  {
    key: 'OutdoorSourceTargetsIndoor',
    kind: 'sourceTagRequiresTargetTag',
    sourceTag: 'Outdoor',
    targetTag: 'Indoor',
  },
] as const satisfies readonly ExitCompatibilityPolicy[];

export const exitTypes = [
  { key: 'ErebusExitDoor', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'OceanusExitDoor', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'OlympusOutdoorExitDoor', compatibilityPolicyKey: 'TargetOutdoor' },
  {
    key: 'OlympusIndoorExitDoor',
    compatibilityPolicyKey: 'OutdoorSourceTargetsIndoor',
  },
] as const satisfies readonly ExitTypeDeclaration[];

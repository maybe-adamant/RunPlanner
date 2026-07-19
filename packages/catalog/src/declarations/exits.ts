import type { ExitCompatibilityPolicy, ExitTypeDeclaration } from '@run-planner/core';

export const exitCompatibilityPolicies = [
  {
    key: 'Unconstrained',
    kind: 'unconstrained',
  },
] as const satisfies readonly ExitCompatibilityPolicy[];

export const exitTypes = [
  { key: 'ErebusExitDoor', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'OceanusExitDoor', compatibilityPolicyKey: 'Unconstrained' },
] as const satisfies readonly ExitTypeDeclaration[];

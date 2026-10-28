import type { ExitCompatibilityPolicy } from '@run-planner/engine/catalog-schema';
import type { RawExitTypeDeclaration } from './exits-types';

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

// allowReroll is the obstacle's AllowReroll, inherited from ExitDoor (true) unless overridden.
export const exitTypes = [
  { key: 'ErebusExitDoor', compatibilityPolicyKey: 'Unconstrained', allowReroll: true },
  { key: 'OceanusExitDoor', compatibilityPolicyKey: 'Unconstrained', allowReroll: true },
  { key: 'OlympusOutdoorExitDoor', compatibilityPolicyKey: 'TargetOutdoor', allowReroll: true },
  {
    key: 'OlympusIndoorExitDoor',
    compatibilityPolicyKey: 'OutdoorSourceTargetsIndoor',
    allowReroll: true,
  },
  { key: 'TyphonExitDoor', compatibilityPolicyKey: 'Unconstrained', allowReroll: false },
  { key: 'FortressMainDoor', compatibilityPolicyKey: 'Unconstrained', allowReroll: false },
  { key: 'FieldsExitDoor', compatibilityPolicyKey: 'Unconstrained', allowReroll: true },
  { key: 'ShipsExitDoor', compatibilityPolicyKey: 'Unconstrained', allowReroll: false },
  // CWTartarusExitDoor.
  { key: 'TartarusExitDoor', compatibilityPolicyKey: 'Unconstrained', allowReroll: true },
  { key: 'N_OpeningDoor', compatibilityPolicyKey: 'Unconstrained', allowReroll: true },
  { key: 'EphyraExitDoor', compatibilityPolicyKey: 'Unconstrained', allowReroll: true },
  { key: 'EphyraExitDoorReturn', compatibilityPolicyKey: 'Unconstrained', allowReroll: false },
  { key: 'EphyraExitBossDoor', compatibilityPolicyKey: 'Unconstrained', allowReroll: true },
  { key: 'N_SubRoomDoor', compatibilityPolicyKey: 'Unconstrained', allowReroll: false },
  {
    key: 'AnomalyAutoExitDoor',
    compatibilityPolicyKey: 'Unconstrained',
    behavior: { kind: 'automaticHostContinuation', rewardPreview: 'hidden' },
    allowReroll: true,
  },
  {
    key: 'ZagContract',
    compatibilityPolicyKey: 'Unconstrained',
    behavior: { kind: 'playerSelected', rewardPreview: 'hidden' },
    // The spawned contract door has its RerollFunctionName cleared.
    allowReroll: false,
  },
  {
    // SecretDoor.
    key: 'ChaosExitDoor',
    compatibilityPolicyKey: 'Unconstrained',
    behavior: { kind: 'playerSelected', rewardPreview: 'hidden' },
    allowReroll: false,
  },
  {
    // SecretExitDoor.
    key: 'ChaosReturnExitDoor',
    compatibilityPolicyKey: 'Unconstrained',
    behavior: { kind: 'playerSelected', rewardPreview: 'visible' },
    allowReroll: true,
  },
] as const satisfies readonly RawExitTypeDeclaration[];

import type { ExitCompatibilityPolicy } from '@run-planner/engine/catalog-schema';
import type { RawExitTypeDeclaration } from './types';

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
  { key: 'TyphonExitDoor', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'FortressMainDoor', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'FieldsExitDoor', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'ShipsExitDoor', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'TartarusExitDoor', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'N_OpeningDoor', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'EphyraExitDoor', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'EphyraExitDoorReturn', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'EphyraExitBossDoor', compatibilityPolicyKey: 'Unconstrained' },
  { key: 'N_SubRoomDoor', compatibilityPolicyKey: 'Unconstrained' },
  {
    key: 'AnomalyAutoExitDoor',
    compatibilityPolicyKey: 'Unconstrained',
    behavior: { kind: 'automaticHostContinuation', rewardPreview: 'hidden' },
  },
  {
    key: 'ZagContract',
    compatibilityPolicyKey: 'Unconstrained',
    behavior: { kind: 'playerSelected', rewardPreview: 'hidden' },
  },
  {
    key: 'ChaosExitDoor',
    compatibilityPolicyKey: 'Unconstrained',
    behavior: { kind: 'playerSelected', rewardPreview: 'hidden' },
  },
  {
    key: 'ChaosReturnExitDoor',
    compatibilityPolicyKey: 'Unconstrained',
    behavior: { kind: 'playerSelected', rewardPreview: 'visible' },
  },
] as const satisfies readonly RawExitTypeDeclaration[];

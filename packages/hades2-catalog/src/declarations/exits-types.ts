import type { ExitBehavior } from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';

export interface RawRoomExitDeclaration {
  readonly index: number;
  readonly type: string;
}

export interface RawExitTypeDeclaration {
  readonly key: string;
  readonly compatibilityPolicyKey: string;
  readonly behavior?: ExitBehavior;
}

export interface RawZagreusContractAdditionalExitDeclaration {
  readonly kind: 'zagreusContract';
  readonly key: 'zagreusContract';
  readonly exitType: string;
  readonly targetRoomGameName: string;
  readonly maxEnteredThisRoute: number;
}

export interface RawChaosAdditionalExitDeclaration {
  readonly kind: 'chaos';
  readonly key: 'chaos';
  readonly exitType: string;
  readonly canHost: boolean;
  readonly canSpawn: boolean;
  readonly requirement?: RequirementExpression;
}

export type RawAdditionalExitDeclaration =
  RawZagreusContractAdditionalExitDeclaration | RawChaosAdditionalExitDeclaration;

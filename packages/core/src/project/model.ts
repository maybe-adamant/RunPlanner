import type { ConcreteReward, RewardPayload } from '../rewards';

export const PROJECT_DOCUMENT_SCHEMA_VERSION = 1 as const;

declare const occurrenceIdBrand: unique symbol;

export type OccurrenceId = string & {
  readonly [occurrenceIdBrand]: 'OccurrenceId';
};

export interface CountedRewardChoice {
  readonly storeKey: string;
  readonly reward: ConcreteReward;
}

export interface ShopOfferState {
  readonly reward: ConcreteReward;
  readonly purchased: boolean;
}

export interface ShopState {
  readonly profileKey: string;
  readonly offers: Readonly<Record<string, ShopOfferState>>;
}

export type AuthoredRoomState =
  | { readonly kind: 'none' }
  | { readonly kind: 'fixed'; readonly payload?: RewardPayload }
  | { readonly kind: 'counted'; readonly choice: CountedRewardChoice }
  | { readonly kind: 'shop'; readonly shop: ShopState }
  | { readonly kind: 'freeReward'; readonly choice: CountedRewardChoice };

export interface RoomOccurrence {
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  readonly state: AuthoredRoomState;
}

export interface LinearTargetReference {
  readonly exitIndex: number;
  readonly occurrenceId: OccurrenceId;
}

export interface LinearBatchContinuation {
  readonly kind: 'batch';
  readonly parentOccurrenceId: OccurrenceId;
  readonly targets: readonly LinearTargetReference[];
  readonly pickedExitIndex: number | null;
}

export interface LinearTerminalContinuation {
  readonly kind: 'terminal';
  readonly parentOccurrenceId: OccurrenceId;
  readonly targets: readonly LinearTargetReference[];
  readonly pickedExitIndex: number | null;
}

export type LinearContinuation = LinearBatchContinuation | LinearTerminalContinuation;

export interface LinearBiomeTopology {
  readonly startOccurrenceId: OccurrenceId;
  readonly occurrences: readonly RoomOccurrence[];
  readonly continuations: readonly LinearContinuation[];
}

export interface LinearBiomePlan {
  readonly kind: 'LinearBiome';
  readonly biomeStepKey: string;
  readonly topology: LinearBiomeTopology | null;
}

export type AuthoredBiomePlan = LinearBiomePlan;

export interface AuthoredRoutePlan {
  readonly routeKey: string;
  readonly biomes: readonly AuthoredBiomePlan[];
}

export interface ProjectDocument {
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION;
  readonly projectId: string;
  readonly name: string;
  readonly catalogVersion: string;
  readonly routes: readonly AuthoredRoutePlan[];
}

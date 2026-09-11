import type {
  AuthoredFieldDescriptor,
  CompletionDescriptor,
  CompletedHubExitDescriptor,
  GeneratedProgressionPolicy,
  HubDecisionDescriptor,
  NormalDoorBatchPolicy,
  OceanusAnomalyReplacementDescriptor,
  RewardStorePolicy,
  SourceRewardStorePolicyOverride,
} from '@run-planner/engine/catalog-schema';

export interface RawGeneratedProgressionDeclaration {
  readonly kind: 'generated';
  readonly anomalyReplacement?: OceanusAnomalyReplacementDescriptor;
  readonly progressionPolicy: GeneratedProgressionPolicy;
  readonly batchPolicy: NormalDoorBatchPolicy;
  readonly rewardStorePolicy: RewardStorePolicy;
  readonly rewardStoreOverrides?: readonly SourceRewardStorePolicyOverride[];
}

export interface RawCompletedHubExitDeclaration extends Omit<
  CompletedHubExitDescriptor,
  'physicalExit'
> {
  readonly physicalExit: {
    readonly index: number;
    readonly type: string;
  };
}

export interface RawHubDecisionDeclaration extends Omit<
  HubDecisionDescriptor,
  'fields' | 'completedExit'
> {
  readonly fields?: readonly AuthoredFieldDescriptor[];
  readonly completedExit: RawCompletedHubExitDeclaration;
}

export type RawProgressionDeclaration =
  RawGeneratedProgressionDeclaration | RawHubDecisionDeclaration;

export interface RawBiomeLayoutDeclaration {
  readonly biomeKey: string;
  readonly initialCounters: {
    readonly biomeDepthCache: number;
    readonly biomeEncounterDepth: number;
  };
  readonly start:
    | {
        readonly kind: 'authoredChoice';
        readonly roomGameNames: readonly [string, ...string[]];
      }
    | { readonly kind: 'fixedAuthored'; readonly roomGameName: string };
  readonly progression: RawProgressionDeclaration;
  readonly chaos?: {
    readonly roomGameNames: readonly [string, ...string[]];
    readonly defaultRoomGameName: string;
    readonly offerSpacingWindow: number;
  };
  readonly completion: CompletionDescriptor;
  readonly fields?: readonly AuthoredFieldDescriptor[];
}

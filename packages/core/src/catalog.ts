import type {
  CountedRewardBinding,
  RewardProducerBinding,
  RewardPayloadDomain,
  RewardPrimitive,
  RewardStore,
  ShopOptionSet,
  ShopProfile,
} from './rewards';
import type { CounterAxis, RequirementExpression } from './requirements';

export interface CatalogCollection<T> {
  readonly values: readonly T[];
  readonly byKey: Readonly<Record<string, T>>;
}

export interface BiomeStepDeclaration {
  readonly key: string;
  readonly biome: string;
}

export interface RouteDeclaration {
  readonly key: string;
  readonly label: string;
  readonly biomeSteps: readonly BiomeStepDeclaration[];
}

export type EncounterPhaseKind = 'combat' | 'miniboss' | 'nonCombat' | 'story';

export interface EncounterPhase {
  readonly key: string;
  readonly kind: EncounterPhaseKind;
  readonly countsEncounterDepth: boolean;
  readonly baselineEncounterKey?: string;
}

export interface EncounterProfile {
  readonly key: string;
  readonly phases: readonly EncounterPhase[];
}

export type RoomKind =
  'Combat' | 'Intro' | 'Miniboss' | 'Opening' | 'Preboss' | 'Reprieve' | 'Shop' | 'Story';

export interface RoomExit {
  readonly index: number;
  readonly targetMode: 'fixedBoss' | 'generated';
  readonly type: string;
}

export interface RoomCounterEffects {
  readonly biomeDepthCache: number;
  readonly roomHistoryOrdinal: number;
}

export interface RoomCaps {
  readonly maxAppearancesThisBiome?: number;
  readonly maxCreationsThisRun?: number;
  readonly maxCreationsPerRoom?: number;
}

export interface RoomForce {
  readonly kind: 'depthWindow';
  readonly axis: CounterAxis;
  readonly start: number;
  readonly deadline: number;
}

export interface ForkedPrebossEntryPolicy {
  readonly kind: 'shopThenFillRemainingExits';
  readonly freeReward: CountedRewardBinding;
  readonly maxFreeRewards: number;
}

export interface RoomDeclaration {
  readonly gameName: string;
  readonly label: string;
  readonly biomeStepKey: string;
  readonly kind: RoomKind;
  readonly templateKey: string;
  readonly exits: readonly RoomExit[];
  readonly incomingReward: RewardProducerBinding;
  readonly entryOfferPolicy?: ForkedPrebossEntryPolicy;
  readonly encounterProfileKey: string;
  readonly counters: RoomCounterEffects;
  readonly caps: RoomCaps;
  readonly eligibility?: RequirementExpression;
  readonly force?: RoomForce;
}

export interface LinearBiomeLayout {
  readonly biomeStepKey: string;
  readonly kind: 'LinearBiome';
  readonly start: {
    readonly mode: 'fixed' | 'oneOf';
    readonly roomGameNames: readonly string[];
  };
  readonly continuation: {
    readonly defaultBatchRuleKey: 'Standard';
  };
  readonly terminal: {
    readonly roomGameName: string;
    readonly transitionRuleKey: 'PrebossEntry';
    readonly exitPolicy: { readonly kind: 'allExitsTerminal' };
  };
  readonly bounds: {
    readonly maxBatches: number;
    readonly maxTargets: number;
  };
}

export type BiomeLayout = LinearBiomeLayout;

export interface Catalog {
  readonly version: string;
  readonly routes: CatalogCollection<RouteDeclaration>;
  readonly rewardPayloadDomains: CatalogCollection<RewardPayloadDomain>;
  readonly rewardPrimitives: CatalogCollection<RewardPrimitive>;
  readonly rewardStores: CatalogCollection<RewardStore>;
  readonly shopOptionSets: CatalogCollection<ShopOptionSet>;
  readonly shopProfiles: CatalogCollection<ShopProfile>;
  readonly encounterProfiles: CatalogCollection<EncounterProfile>;
  readonly rooms: CatalogCollection<RoomDeclaration>;
  readonly biomeLayouts: CatalogCollection<BiomeLayout>;
}

export interface CatalogSummary {
  readonly version: string;
  readonly routeCount: number;
  readonly biomeStepCount: number;
  readonly rewardPrimitiveCount: number;
  readonly roomCount: number;
}

export function summarizeCatalog(catalog: Catalog): CatalogSummary {
  return {
    version: catalog.version,
    routeCount: catalog.routes.values.length,
    biomeStepCount: catalog.routes.values.reduce(
      (count, route) => count + route.biomeSteps.length,
      0,
    ),
    rewardPrimitiveCount: catalog.rewardPrimitives.values.length,
    roomCount: catalog.rooms.values.length,
  };
}

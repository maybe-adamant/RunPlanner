import type { ArcanaActivationRule } from '@run-planner/engine/catalog-schema';

export interface RawArcanaCardDeclaration {
  readonly key: string;
  readonly label: string;
  readonly traitKey: string;
  readonly row: number;
  readonly column: number;
  readonly graspCost: number;
  readonly activation:
    | { readonly kind: 'manual' }
    | { readonly kind: 'automatic'; readonly rule: ArcanaActivationRule };
  readonly permanentRank: 3;
  readonly fatedIncompatible?: boolean;
  readonly randomDrawRequiredCardKeys?: readonly string[];
  readonly postBossActivationCounts?: Readonly<{
    readonly Common: number;
    readonly Rare: number;
    readonly Epic: number;
    readonly Heroic: number;
  }>;
  readonly artificerCapacityByRarity?: Readonly<{
    readonly Common: number;
    readonly Rare: number;
    readonly Epic: number;
    readonly Heroic: number;
  }>;
  readonly boonRarityContributions?: import('@run-planner/engine/catalog-schema').ArcanaCardDeclaration['boonRarityContributions'];
}
export interface RawFearVowDeclaration {
  readonly key: string;
  readonly label: string;
  readonly incrementalFear: readonly number[];
  readonly circeRemovable: boolean;
  readonly effect?:
    | { readonly kind: 'banUnselectedTraits'; readonly count: 2 }
    | {
        readonly kind: 'substituteRoomReward';
        readonly maximumPerBiome: 1;
        readonly qualifyingRewardTypes: readonly ['Boon', 'HermesUpgrade'];
        readonly replacementRewardType: 'RoomRewardConsolationPrize';
      }
    | {
        readonly kind: 'limitStartingGrasp';
        readonly baseCapacity: 30;
        readonly availablePercentByRank: readonly [60, 40, 20, 0];
      };
}

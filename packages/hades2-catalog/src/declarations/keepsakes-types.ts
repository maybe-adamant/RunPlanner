import type {
  KeepsakeRank,
  KeepsakeRankProfile,
  InRunTraitRarity,
} from '@run-planner/engine/catalog-schema';

export interface RawKeepsakeDeclaration {
  readonly key: string;
  readonly label: string;
  readonly rank: 'Epic';
  readonly fatedDisposition: 'neutral' | 'enabling' | 'opposing';
  readonly echoGift:
    | { readonly availability: 'excluded' }
    | {
        readonly availability: 'eligible';
        readonly effect:
          | { readonly kind: 'figLeaf'; readonly schedule: 'oneShot' }
          | { readonly kind: 'experimentalHammer'; readonly schedule: 'oneShotAfterUnequipped' }
          | { readonly kind: 'crystalFigurine'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'concaveStone'; readonly schedule: 'oneShot' }
          | { readonly kind: 'transcendentEmbryo'; readonly schedule: 'oneShot' }
          | { readonly kind: 'callingCard'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'timePiece'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'olympianRewardPressure'; readonly schedule: 'everyBiome' }
          | { readonly kind: 'moonBeam'; readonly schedule: 'oneShotAfterUnequipped' }
          | { readonly kind: 'modeledNeutral'; readonly schedule: 'noModeledEffect' };
      };
  readonly effect?:
    | {
        readonly kind: 'jeweledPom';
        readonly giverKey: string;
        readonly subsequentEligibleTraitLevelsByRank: KeepsakeRankProfile<
          number,
          number,
          number,
          number
        >;
      }
    | {
        readonly kind: 'experimentalHammer';
        readonly giverKey: string;
        readonly qualifyingEncounterUsesByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        readonly kind: 'callingCard';
        readonly rarificationChargesByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        readonly kind: 'timePiece';
        readonly conversionChargesByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        readonly kind: 'figLeaf';
        readonly biomeUsesByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        readonly kind: 'gorgonAmulet';
        readonly uses: 1;
        readonly minimumBiomeDepth: number;
        readonly providerKey: string;
        readonly rarityLevelByRank: KeepsakeRankProfile<
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4
        >;
        readonly naturalEncounterKey: string;
      }
    | {
        readonly kind: 'fountainRarity';
        readonly uses: 1;
        readonly targetRarityLevelByRank: Readonly<{
          Common: 1 | 2 | 3 | 4;
          Rare: 1 | 2 | 3 | 4;
          Epic: 1 | 2 | 3 | 4;
        }>;
        readonly sourceMaxRarityLevel: 1;
      }
    | {
        readonly kind: 'crystalFigurine';
        readonly uses: 1;
        readonly requestedCards: number;
        readonly rarityLevelByRank: KeepsakeRankProfile<
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4,
          1 | 2 | 3 | 4
        >;
      }
    | {
        readonly kind: 'concaveStone';
        readonly uses: 1;
        readonly procSupportByRank: KeepsakeRankProfile<number, number, number, number>;
      }
    | {
        readonly kind: 'transcendentEmbryo';
        readonly source: 'Chaos';
        readonly interval: 8;
        readonly blessingRarityByRank: Readonly<Record<KeepsakeRank, InRunTraitRarity>>;
      }
    | {
        readonly kind: 'olympianRewardPressure';
        readonly priorityRewardType: string;
        readonly providerKey: string;
        readonly providerForceUses: 1;
        readonly providerRarificationUses: 1;
        readonly maximumSourceRarityLevelByRank: Readonly<{
          Common: 1 | 2 | 3;
          Rare: 1 | 2 | 3;
          Epic: 1 | 2 | 3;
        }>;
      }
    | {
        readonly kind: 'moonBeam';
        readonly pathPointsByRank: KeepsakeRankProfile<number, number, number, number>;
        readonly priorityRewardTypes: readonly [string, string, string];
      };
}

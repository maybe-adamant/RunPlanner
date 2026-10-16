import { concaveStoneProcGiver, type Catalog } from '../../../catalog-schema';
import {
  isChaosGodScreenGiver,
  type ReachedTraitOfferEvaluation,
  type TraitScreenExpectation,
} from '../../traits';
import { limitedSwapUses } from '../../traits/offer-domain';
import { concaveStoneRemainingUses } from '../../keepsakes/trait-effects';
import { rarificationUsesForGiver } from '../../keepsakes/reward-effects';

/**
 * The order-sensitive state one selected screen reads when it opens, and the
 * one-use effects its settlement spent when it closed.
 */
export function traitScreenExpectation(
  catalog: Catalog,
  evaluation: Pick<ReachedTraitOfferEvaluation, 'offer' | 'state' | 'screenSpend'>,
): TraitScreenExpectation | undefined {
  const offer = evaluation.offer;
  if (offer.kind === 'chaos') return undefined;
  const giverKey = offer.giverKey;
  const giver = catalog.traitGivers.byKey[giverKey];
  const state = evaluation.state;
  const spend = evaluation.screenSpend;
  // The Spell screen never reaches the boon selection that rolls Concave Stone.
  const stoneUses =
    giver?.providerKind === 'spell' ? undefined : concaveStoneRemainingUses(state.keepsakes);
  const rarifyUses = rarificationUsesForGiver(catalog, state.keepsakes, giverKey);
  const expectation: TraitScreenExpectation = {
    ...(isChaosGodScreenGiver(catalog, giverKey)
      ? {
          hymnUses: limitedSwapUses(state),
          yarnUses: state.stygianWell.yarnUses,
          ...(spend === undefined
            ? {}
            : {
                consumesHymn: spend.hymn,
                consumesYarn: spend.yarn,
                consumesOrdinary: spend.ordinary,
              }),
        }
      : {}),
    ...(stoneUses === undefined
      ? {}
      : {
          concaveStone: Object.freeze({
            uses: stoneUses,
            giverProcs: concaveStoneProcGiver(giver),
          }),
        }),
    ...(rarifyUses === undefined ? {} : { rarifyUses }),
  };
  return Object.keys(expectation).length === 0 ? undefined : Object.freeze(expectation);
}

import type { ArcanaCardDeclaration, FearVowDeclaration } from '@run-planner/engine/catalog-schema';
import type { CatalogCollection, TraitDeclaration } from '@run-planner/engine/catalog-schema';
import type { RawArcanaCardDeclaration, RawFearVowDeclaration } from '../declarations';
import {
  createCollection,
  requireBoolean,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';

export function normalizeArcanaCards(
  raw: readonly RawArcanaCardDeclaration[],
  traits: CatalogCollection<TraitDeclaration>,
): CatalogCollection<ArcanaCardDeclaration> {
  const cells = new Set<string>();
  const values = raw.map((card, index) => {
    const path = `arcanaCards[${index}]`;
    requireNonEmpty(card.label, `${path}.label`);
    requireNonEmpty(card.traitKey, `${path}.traitKey`);
    requirePositiveInteger(card.row, `${path}.row`);
    requirePositiveInteger(card.column, `${path}.column`);
    requireNonNegativeInteger(card.graspCost, `${path}.graspCost`);
    if (card.row > 5 || card.column > 5) fail(path, 'board cell must be within 5-by-5 board');
    const cell = `${card.row}:${card.column}`;
    if (cells.has(cell)) fail(path, `duplicates board cell ${cell}`);
    cells.add(cell);
    if (card.permanentRank !== 3) fail(`${path}.permanentRank`, 'must be rank III');
    const postBossActivationCounts = card.postBossActivationCounts;
    const artificerCapacityByRarity = card.artificerCapacityByRarity;
    const boonRarityContributions = card.boonRarityContributions;
    if (boonRarityContributions !== undefined) {
      if (!['RarityBoost', 'BonusRarity', 'EpicRarityBoost'].includes(card.key))
        fail(`${path}.boonRarityContributions`, 'is not supported for this Arcana card');
      const ranks = ['Common', 'Rare', 'Epic', 'Heroic'] as const;
      const checks = new Set(['Rare', 'Epic', 'Duo', 'Legendary']);
      if (
        Object.keys(boonRarityContributions).some(
          (rank) => !ranks.includes(rank as (typeof ranks)[number]),
        )
      )
        fail(`${path}.boonRarityContributions`, 'must not declare unsupported source ranks');
      if (!ranks.every((rank) => boonRarityContributions[rank] !== undefined))
        fail(`${path}.boonRarityContributions`, 'must declare all four source ranks');
      for (const rank of ranks) {
        if (
          Object.keys(boonRarityContributions[rank]).some(
            (part) => part !== 'additive' && part !== 'multiplicative',
          )
        )
          fail(
            `${path}.boonRarityContributions.${rank}`,
            'must not declare unsupported contribution parts',
          );
        for (const part of ['additive', 'multiplicative'] as const) {
          for (const [check, value] of Object.entries(boonRarityContributions[rank][part] ?? {})) {
            if (!checks.has(check) || typeof value !== 'number' || !Number.isFinite(value))
              fail(`${path}.boonRarityContributions.${rank}.${part}.${check}`, 'must be finite');
          }
        }
      }
    }
    if (card.key === 'CardDraw') {
      if (
        postBossActivationCounts === undefined ||
        Object.keys(postBossActivationCounts).length !== 4
      )
        fail(
          `${path}.postBossActivationCounts`,
          'Judgment must declare Common, Rare, Epic, and Heroic counts',
        );
      requirePositiveInteger(
        postBossActivationCounts.Common,
        `${path}.postBossActivationCounts.Common`,
      );
      requirePositiveInteger(
        postBossActivationCounts.Rare,
        `${path}.postBossActivationCounts.Rare`,
      );
      requirePositiveInteger(
        postBossActivationCounts.Epic,
        `${path}.postBossActivationCounts.Epic`,
      );
      requirePositiveInteger(
        postBossActivationCounts.Heroic,
        `${path}.postBossActivationCounts.Heroic`,
      );
      if (postBossActivationCounts.Rare < postBossActivationCounts.Common)
        fail(`${path}.postBossActivationCounts`, 'Rare count must not be lower than Common');
      if (postBossActivationCounts.Epic < postBossActivationCounts.Rare)
        fail(`${path}.postBossActivationCounts`, 'Epic count must not be lower than Rare');
      if (postBossActivationCounts.Heroic < postBossActivationCounts.Epic)
        fail(`${path}.postBossActivationCounts`, 'Heroic count must not be lower than Epic');
    } else if (postBossActivationCounts !== undefined) {
      fail(
        `${path}.postBossActivationCounts`,
        'only Judgment may declare post-Boss activation counts',
      );
    }
    if (card.key === 'MetaToRunUpgrade') {
      if (
        artificerCapacityByRarity?.Common !== 1 ||
        artificerCapacityByRarity.Rare !== 2 ||
        artificerCapacityByRarity?.Epic !== 3 ||
        artificerCapacityByRarity.Heroic !== 4 ||
        Object.keys(artificerCapacityByRarity).length !== 4
      )
        fail(
          `${path}.artificerCapacityByRarity`,
          'Artificer must declare Common 1, Rare 2, Epic 3, and Heroic 4',
        );
    } else if (artificerCapacityByRarity !== undefined) {
      fail(`${path}.artificerCapacityByRarity`, 'only Artificer may declare conversion capacity');
    }
    if (traits.byKey[card.traitKey] === undefined) {
      fail(`${path}.traitKey`, `unknown trait ${card.traitKey}`);
    }
    const activationKind: unknown = (card.activation as { readonly kind?: unknown }).kind;
    if (activationKind !== 'manual' && activationKind !== 'automatic') {
      fail(`${path}.activation.kind`, `unsupported kind ${String(activationKind)}`);
    }
    if (activationKind === 'manual' && card.graspCost === 0) {
      fail(`${path}.graspCost`, 'manual cards must have a positive Grasp cost');
    }
    if (activationKind === 'automatic' && card.graspCost !== 0) {
      fail(`${path}.graspCost`, 'automatic cards must have zero Grasp cost');
    }
    if (card.activation.kind === 'automatic') {
      const rule = card.activation.rule;
      switch (rule.kind) {
        case 'adjacentActive':
        case 'manualCostsOneThroughFive':
        case 'surroundingCellsActive':
        case 'completeOtherRowOrColumn':
          break;
        case 'manualCostMultiplicityAtMost':
          requirePositiveInteger(rule.maximum, `${path}.activation.rule.maximum`);
          break;
        case 'manualCardCount':
          requireNonNegativeInteger(rule.minimum, `${path}.activation.rule.minimum`);
          requireNonNegativeInteger(rule.maximum, `${path}.activation.rule.maximum`);
          if (rule.minimum > rule.maximum) {
            fail(`${path}.activation.rule`, 'minimum must not exceed maximum');
          }
          break;
        default:
          fail(
            `${path}.activation.rule.kind`,
            `unsupported kind ${String((rule as { readonly kind?: unknown }).kind)}`,
          );
      }
    }
    const activation =
      card.activation.kind === 'manual'
        ? Object.freeze({ kind: 'manual' as const })
        : Object.freeze({
            kind: 'automatic' as const,
            rule: Object.freeze({ ...card.activation.rule }),
          });
    const { boonRarityContributions: _rawBoonRarityContributions, ...normalizedCard } = card;
    void _rawBoonRarityContributions;
    return Object.freeze({
      ...normalizedCard,
      fatedIncompatible: card.fatedIncompatible === true,
      activation,
      ...(postBossActivationCounts === undefined
        ? {}
        : { postBossActivationCounts: Object.freeze({ ...postBossActivationCounts }) }),
      ...(artificerCapacityByRarity === undefined
        ? {}
        : { artificerCapacityByRarity: Object.freeze({ ...artificerCapacityByRarity }) }),
      ...(boonRarityContributions === undefined
        ? {}
        : {
            boonRarityContributions: Object.freeze(
              Object.fromEntries(
                (['Common', 'Rare', 'Epic', 'Heroic'] as const).map((rank) => [
                  rank,
                  Object.freeze({
                    ...(boonRarityContributions[rank].additive === undefined
                      ? {}
                      : { additive: Object.freeze({ ...boonRarityContributions[rank].additive }) }),
                    ...(boonRarityContributions[rank].multiplicative === undefined
                      ? {}
                      : {
                          multiplicative: Object.freeze({
                            ...boonRarityContributions[rank].multiplicative,
                          }),
                        }),
                  }),
                ]),
              ),
            ) as NonNullable<ArcanaCardDeclaration['boonRarityContributions']>,
          }),
    });
  });
  if (values.length !== 25) fail('arcanaCards', 'must declare all 25 cards');
  return createCollection(values, 'arcanaCards', (card) => card.key);
}
export function normalizeFearVows(
  raw: readonly RawFearVowDeclaration[],
): CatalogCollection<FearVowDeclaration> {
  const values = raw.map((vow, index) => {
    const path = `fearVows[${index}]`;
    requireNonEmpty(vow.label, `${path}.label`);
    if (vow.incrementalFear.length === 0)
      fail(`${path}.incrementalFear`, 'must have at least one rank');
    vow.incrementalFear.forEach((point, rank) =>
      requirePositiveInteger(point, `${path}.incrementalFear[${rank}]`),
    );
    requireBoolean(vow.circeRemovable, `${path}.circeRemovable`);
    const isDenial = vow.key === 'BanUnpickedBoonsShrineUpgrade';
    const isForfeit = vow.key === 'BoonSkipShrineUpgrade';
    const isVoid = vow.key === 'LimitGraspShrineUpgrade';
    if (isDenial && vow.effect === undefined)
      fail(`${path}.effect`, 'Vow of Denial must declare banUnselectedTraits');
    if (!isDenial && !isForfeit && !isVoid && vow.effect !== undefined)
      fail(`${path}.effect`, 'only Vow of Denial, Forfeit, or Void may declare an effect');
    if (
      isDenial &&
      vow.effect !== undefined &&
      (vow.effect.kind !== 'banUnselectedTraits' || vow.effect.count !== 2)
    )
      fail(`${path}.effect`, 'must be banUnselectedTraits with count 2');
    if (isForfeit && vow.effect === undefined)
      fail(`${path}.effect`, 'Vow of Forfeit must declare preventOrdinaryRoomAcquisition');
    if (
      isForfeit &&
      (vow.effect?.kind !== 'preventOrdinaryRoomAcquisition' ||
        vow.effect.maximumPerBiome !== 1 ||
        JSON.stringify(vow.effect.qualifyingRewardTypes) !==
          JSON.stringify(['Boon', 'HermesUpgrade']))
    )
      fail(`${path}.effect`, 'must prevent one ordinary Boon or Hermes acquisition per biome');
    if (isVoid && vow.effect === undefined)
      fail(`${path}.effect`, 'Vow of Void must declare limitStartingGrasp');
    if (
      isVoid &&
      (vow.effect?.kind !== 'limitStartingGrasp' ||
        vow.effect.baseCapacity !== 30 ||
        JSON.stringify(vow.effect.availablePercentByRank) !== JSON.stringify([60, 40, 20, 0]))
    )
      fail(`${path}.effect`, 'must limit starting Grasp from 30 by 60, 40, 20, and 0 percent');
    return Object.freeze({
      ...vow,
      incrementalFear: Object.freeze([...vow.incrementalFear]),
      ...(isDenial
        ? { effect: Object.freeze({ kind: 'banUnselectedTraits' as const, count: 2 as const }) }
        : isForfeit
          ? {
              effect: Object.freeze({
                kind: 'preventOrdinaryRoomAcquisition' as const,
                maximumPerBiome: 1 as const,
                qualifyingRewardTypes: Object.freeze(['Boon', 'HermesUpgrade']) as readonly [
                  'Boon',
                  'HermesUpgrade',
                ],
              }),
            }
          : isVoid
            ? {
                effect: Object.freeze({
                  kind: 'limitStartingGrasp' as const,
                  baseCapacity: 30 as const,
                  availablePercentByRank: Object.freeze([60, 40, 20, 0]) as readonly [
                    60,
                    40,
                    20,
                    0,
                  ],
                }),
              }
            : {}),
    });
  });
  if (values.length !== 17) fail('fearVows', 'must declare all 17 Vows');
  return createCollection(values, 'fearVows', (vow) => vow.key);
}

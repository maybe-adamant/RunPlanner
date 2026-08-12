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
    if (card.key === 'CardDraw') {
      if (
        postBossActivationCounts === undefined ||
        Object.keys(postBossActivationCounts).length !== 2
      )
        fail(
          `${path}.postBossActivationCounts`,
          'Judgment must declare only Epic and Heroic counts',
        );
      requirePositiveInteger(
        postBossActivationCounts.Epic,
        `${path}.postBossActivationCounts.Epic`,
      );
      requirePositiveInteger(
        postBossActivationCounts.Heroic,
        `${path}.postBossActivationCounts.Heroic`,
      );
      if (postBossActivationCounts.Heroic < postBossActivationCounts.Epic)
        fail(`${path}.postBossActivationCounts`, 'Heroic count must not be lower than Epic');
    } else if (postBossActivationCounts !== undefined) {
      fail(
        `${path}.postBossActivationCounts`,
        'only Judgment may declare post-Boss activation counts',
      );
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
    return Object.freeze({
      ...card,
      activation,
      ...(postBossActivationCounts === undefined
        ? {}
        : { postBossActivationCounts: Object.freeze({ ...postBossActivationCounts }) }),
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
    return Object.freeze({ ...vow, incrementalFear: Object.freeze([...vow.incrementalFear]) });
  });
  if (values.length !== 17) fail('fearVows', 'must declare all 17 Vows');
  return createCollection(values, 'fearVows', (vow) => vow.key);
}

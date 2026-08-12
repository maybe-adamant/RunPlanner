import type { Catalog } from '../catalog-schema';
import type { RouteLoadout } from './model';
import { ProjectDocumentContractError } from './validation';

export interface DerivedRouteLoadout {
  readonly activeArcanaKeys: readonly string[];
  readonly automaticArcanaKeys: readonly string[];
  readonly fearTotal: number;
}

export function createDefaultRouteLoadout(catalog: Catalog): RouteLoadout {
  const weapon = catalog.weapons.values.find((candidate) =>
    candidate.aspectKeys.includes(candidate.defaultAspectKey),
  );
  if (weapon === undefined) {
    throw new ProjectDocumentContractError('routes', 'catalog has no weapons');
  }
  return Object.freeze({
    weaponKey: weapon.key,
    aspectKey: weapon.defaultAspectKey,
    manualArcanaKeys: Object.freeze([]),
    fearRanks: Object.freeze(
      Object.fromEntries(catalog.fearVows.values.map((vow) => [vow.key, 0])),
    ),
    startingKeepsakeKey: catalog.defaultStartingKeepsakeKey,
  });
}

export function deriveRouteLoadout(catalog: Catalog, loadout: RouteLoadout): DerivedRouteLoadout {
  const cards = catalog.arcanaCards.values;
  const manual = new Set(loadout.manualArcanaKeys);
  const active = new Set(manual);
  const at = (row: number, column: number) =>
    cards.find((card) => card.row === row && card.column === column);
  const enabledAutomatic = (card: (typeof cards)[number]): boolean => {
    if (card.activation.kind !== 'automatic') return false;
    const rule = card.activation.rule;
    if (rule.kind === 'adjacentActive') {
      return [-1, 0, 1].some((row) =>
        [-1, 0, 1].some((column) =>
          row !== 0 || column !== 0
            ? active.has(at(card.row + row, card.column + column)?.key ?? '')
            : false,
        ),
      );
    } else if (rule.kind === 'manualCostsOneThroughFive') {
      return [1, 2, 3, 4, 5].every((cost) =>
        [...manual].some((key) => catalog.arcanaCards.byKey[key]?.graspCost === cost),
      );
    } else if (rule.kind === 'manualCostMultiplicityAtMost') {
      const costs = [...manual]
        .map((key) => catalog.arcanaCards.byKey[key]?.graspCost)
        .filter((cost): cost is number => cost !== undefined);
      return (
        costs.length > 0 &&
        costs.every(
          (cost) => costs.filter((candidate) => candidate === cost).length <= rule.maximum,
        )
      );
    } else if (rule.kind === 'surroundingCellsActive') {
      const surroundingCards = [-1, 0, 1].flatMap((row) =>
        [-1, 0, 1].flatMap((column) => {
          if (row === 0 && column === 0) return [];
          const neighbor = at(card.row + row, card.column + column);
          return neighbor === undefined ? [] : [neighbor];
        }),
      );
      return (
        surroundingCards.length > 0 &&
        surroundingCards.every((neighbor) => active.has(neighbor.key))
      );
    } else if (rule.kind === 'completeOtherRowOrColumn') {
      return (
        [1, 2, 3, 4, 5].some(
          (row) =>
            row !== card.row &&
            [1, 2, 3, 4, 5].every((column) => active.has(at(row, column)?.key ?? '')),
        ) ||
        [1, 2, 3, 4, 5].some(
          (column) =>
            column !== card.column &&
            [1, 2, 3, 4, 5].every((row) => active.has(at(row, column)?.key ?? '')),
        )
      );
    }
    return manual.size >= rule.minimum && manual.size <= rule.maximum;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const card of cards) {
      if (!active.has(card.key) && enabledAutomatic(card)) {
        active.add(card.key);
        changed = true;
      }
    }
  }
  const activeArcanaKeys = cards.filter((card) => active.has(card.key)).map((card) => card.key);
  const fearTotal = catalog.fearVows.values.reduce(
    (total, vow) =>
      total +
      vow.incrementalFear
        .slice(0, loadout.fearRanks[vow.key] ?? 0)
        .reduce((sum, point) => sum + point, 0),
    0,
  );
  return Object.freeze({
    activeArcanaKeys: Object.freeze(activeArcanaKeys),
    automaticArcanaKeys: Object.freeze(activeArcanaKeys.filter((key) => !manual.has(key))),
    fearTotal,
  });
}

import type { Catalog } from '../catalog-schema';
import type { RouteLoadout } from './model';
import { routeInitialProfile } from './route-profile';
import { ProjectDocumentContractError } from './validation';

export interface DerivedRouteLoadout {
  readonly activeArcanaKeys: readonly string[];
  readonly automaticArcanaKeys: readonly string[];
  readonly startingArcanaGrasp: StartingArcanaGraspAssessment;
  readonly fearTotal: number;
}

export interface StartingArcanaGraspAssessment {
  readonly cost: number;
  readonly capacity: number;
  readonly legal: boolean;
}

export function assessStartingArcanaGrasp(
  catalog: Catalog,
  manualArcanaKeys: readonly string[],
  fearRanks: Readonly<Record<string, number>>,
): StartingArcanaGraspAssessment {
  const voidVow = catalog.fearVows.byKey.LimitGraspShrineUpgrade;
  if (voidVow?.effect?.kind !== 'limitStartingGrasp') {
    throw new Error('catalog is missing the Vow of Void starting-Grasp effect');
  }
  const voidRank = fearRanks[voidVow.key];
  if (
    voidRank === undefined ||
    !Number.isInteger(voidRank) ||
    voidRank < 0 ||
    voidRank > voidVow.effect.availablePercentByRank.length
  ) {
    throw new Error(`invalid configured Vow of Void rank ${String(voidRank)}`);
  }
  const seen = new Set<string>();
  const cost = manualArcanaKeys.reduce((total, key) => {
    const card = catalog.arcanaCards.byKey[key];
    if (card === undefined || card.activation.kind !== 'manual' || seen.has(key)) {
      throw new Error(`invalid starting manual Arcana ${key}`);
    }
    seen.add(key);
    return total + card.graspCost;
  }, 0);
  const availablePercent =
    voidRank === 0 ? 100 : voidVow.effect.availablePercentByRank[voidRank - 1];
  if (availablePercent === undefined) {
    throw new Error(`Vow of Void rank ${voidRank} has no available-Grasp percentage`);
  }
  const capacity = Math.floor((voidVow.effect.baseCapacity * availablePercent) / 100);
  return Object.freeze({
    cost,
    capacity,
    legal: cost <= capacity,
  });
}

export interface ManualArcanaToggle {
  readonly key: string;
  readonly selected: boolean;
  /** The manual selection after toggling this card, in catalog order. */
  readonly arcanaKeys: readonly string[];
  readonly grasp: StartingArcanaGraspAssessment;
}

export interface FearVowRankDomain {
  readonly key: string;
  readonly rank: number;
  readonly maximum: number;
  /** Ranks whose starting Grasp capacity still holds the manual selection. */
  readonly legalRanks: readonly number[];
}

export interface RouteLoadoutEditDomain {
  readonly manualArcana: readonly ManualArcanaToggle[];
  readonly fearVows: readonly FearVowRankDomain[];
}

/** The Arcana toggles and Vow ranks the loadout commands accept from this loadout. */
export function routeLoadoutEditDomain(
  catalog: Catalog,
  loadout: Pick<RouteLoadout, 'manualArcanaKeys' | 'fearRanks'>,
): RouteLoadoutEditDomain {
  const manual = new Set(loadout.manualArcanaKeys);
  const manualArcana = catalog.arcanaCards.values
    .filter((card) => card.activation.kind === 'manual')
    .map((card) => {
      const selected = manual.has(card.key);
      const arcanaKeys = Object.freeze(
        catalog.arcanaCards.values
          .filter((candidate) =>
            candidate.key === card.key ? !selected : manual.has(candidate.key),
          )
          .map((candidate) => candidate.key),
      );
      return Object.freeze({
        key: card.key,
        selected,
        arcanaKeys,
        grasp: assessStartingArcanaGrasp(catalog, arcanaKeys, loadout.fearRanks),
      });
    });
  const fearVows = catalog.fearVows.values.map((vow) =>
    Object.freeze({
      key: vow.key,
      rank: loadout.fearRanks[vow.key] ?? 0,
      maximum: vow.incrementalFear.length,
      legalRanks: Object.freeze(
        Array.from({ length: vow.incrementalFear.length + 1 }, (_, rank) => rank).filter(
          (rank) =>
            assessStartingArcanaGrasp(catalog, loadout.manualArcanaKeys, {
              ...loadout.fearRanks,
              [vow.key]: rank,
            }).legal,
        ),
      ),
    }),
  );
  return Object.freeze({
    manualArcana: Object.freeze(manualArcana),
    fearVows: Object.freeze(fearVows),
  });
}

/** A mature save's loadout, whose equipment and keepsake are authored selections. */
export type MatureRouteLoadout = RouteLoadout & {
  readonly weaponKey: string;
  readonly aspectKey: string;
  readonly startingKeepsakeKey: string;
  readonly familiarKey: string;
};

export function createDefaultRouteLoadout(catalog: Catalog): MatureRouteLoadout {
  const weapon = catalog.weapons.values.find((candidate) =>
    candidate.aspectKeys.includes(candidate.defaultAspectKey),
  );
  if (weapon === undefined) {
    throw new ProjectDocumentContractError('catalog.weapons', 'catalog has no weapons');
  }
  return Object.freeze({
    weaponKey: weapon.key,
    aspectKey: weapon.defaultAspectKey,
    startingReward: null,
    manualArcanaKeys: Object.freeze([]),
    fearRanks: zeroFearRanks(catalog),
    startingKeepsakeKey: catalog.defaultStartingKeepsakeKey,
    familiarKey: catalog.defaultFamiliarKey,
  });
}

/** The route's initial loadout; a fresh profile has no selections to default. */
export function createInitialRouteLoadout(catalog: Catalog, routeKey: string): RouteLoadout {
  if (routeInitialProfile(catalog, routeKey).kind === 'matureSave')
    return createDefaultRouteLoadout(catalog);
  return Object.freeze({
    weaponKey: null,
    aspectKey: null,
    startingReward: null,
    manualArcanaKeys: Object.freeze([]),
    fearRanks: zeroFearRanks(catalog),
    startingKeepsakeKey: null,
    familiarKey: null,
  });
}

function zeroFearRanks(catalog: Catalog): Readonly<Record<string, number>> {
  return Object.freeze(Object.fromEntries(catalog.fearVows.values.map((vow) => [vow.key, 0])));
}

export function deriveRouteLoadout(
  catalog: Catalog,
  loadout: Pick<RouteLoadout, 'manualArcanaKeys' | 'fearRanks'>,
): DerivedRouteLoadout {
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
  const startingArcanaGrasp = assessStartingArcanaGrasp(
    catalog,
    loadout.manualArcanaKeys,
    loadout.fearRanks,
  );
  return Object.freeze({
    activeArcanaKeys: Object.freeze(activeArcanaKeys),
    automaticArcanaKeys: Object.freeze(activeArcanaKeys.filter((key) => !manual.has(key))),
    startingArcanaGrasp,
    fearTotal,
  });
}

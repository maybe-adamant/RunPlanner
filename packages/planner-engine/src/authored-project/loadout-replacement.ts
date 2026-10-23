import type { Catalog } from '../catalog-schema';
import { createRouteAddress } from './addresses';
import type { ProjectCommand } from './commands/dispatch';
import { assessStartingArcanaGrasp, type StartingArcanaGraspAssessment } from './loadout';
import type { RouteLoadout } from './model';

/**
 * Replacing a whole Arcana selection or every Vow rank at once: the commands that install it as
 * one transaction, nothing when the loadout already has it, or the starting Grasp it would break.
 */
export type LoadoutReplacement =
  | { readonly kind: 'apply'; readonly commands: readonly ProjectCommand[] }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly grasp: StartingArcanaGraspAssessment };

type ArcanaFearLoadout = Pick<RouteLoadout, 'manualArcanaKeys' | 'fearRanks'>;

/** Replaces the manual Arcana with `arcanaKeys`, kept under the current Vows' starting Grasp. */
export function planManualArcanaReplacement(
  catalog: Catalog,
  routeKey: string,
  loadout: ArcanaFearLoadout,
  arcanaKeys: readonly string[],
): LoadoutReplacement {
  const wanted = new Set(arcanaKeys);
  const ordered = catalog.arcanaCards.values
    .filter((card) => wanted.has(card.key))
    .map((card) => card.key);
  const grasp = assessStartingArcanaGrasp(catalog, ordered, loadout.fearRanks);
  if (!grasp.legal) return Object.freeze({ kind: 'refused', grasp });
  const current = new Set(loadout.manualArcanaKeys);
  if (ordered.length === current.size && ordered.every((key) => current.has(key)))
    return Object.freeze({ kind: 'unchanged' });
  return Object.freeze({
    kind: 'apply',
    commands: Object.freeze([
      Object.freeze({
        kind: 'ReplaceManualArcanaSelection',
        route: createRouteAddress(routeKey),
        arcanaKeys: Object.freeze(ordered),
      }),
    ]),
  });
}

/** Replaces every Vow rank (absent Vows at rank 0), kept above the current Arcana's Grasp cost. */
export function planFearRanksReplacement(
  catalog: Catalog,
  routeKey: string,
  loadout: ArcanaFearLoadout,
  ranks: Readonly<Record<string, number>>,
): LoadoutReplacement {
  const fearRanks = Object.fromEntries(
    catalog.fearVows.values.map((vow) => [vow.key, ranks[vow.key] ?? 0]),
  );
  const grasp = assessStartingArcanaGrasp(catalog, loadout.manualArcanaKeys, fearRanks);
  if (!grasp.legal) return Object.freeze({ kind: 'refused', grasp });
  const route = createRouteAddress(routeKey);
  // Only Vow of Void changes the capacity, and the final ranks hold the Arcana, so every
  // intermediate step does too.
  const commands = catalog.fearVows.values
    .filter((vow) => (loadout.fearRanks[vow.key] ?? 0) !== fearRanks[vow.key])
    .map((vow): ProjectCommand =>
      Object.freeze({
        kind: 'ReplaceFearVowRank',
        route,
        vowKey: vow.key,
        rank: fearRanks[vow.key]!,
      }),
    );
  return commands.length === 0
    ? Object.freeze({ kind: 'unchanged' })
    : Object.freeze({ kind: 'apply', commands: Object.freeze(commands) });
}

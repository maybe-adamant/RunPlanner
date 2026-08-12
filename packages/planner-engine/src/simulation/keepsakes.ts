import type { Catalog } from '../catalog-schema';
import type { ArcanaFearState } from './arcana-fear';

export type FatedStatus = 'Unknown' | 'Fated' | 'Unfated';
export interface KeepsakeHistoryEntry {
  readonly key: string;
  readonly kind: 'start' | 'retain' | 'replace';
}
export interface KeepsakeState {
  readonly currentKey: string;
  readonly history: readonly KeepsakeHistoryEntry[];
  readonly removedKeys: readonly string[];
  readonly fatedStatus: FatedStatus;
}
export type KeepsakeSelectionUnavailableReason =
  'alreadyEquipped' | 'removed' | 'unfatedEnabling' | 'encounterHistory';

/** Exact non-start rack legality; route start intentionally replaces all history. */
export function keepsakeSelectionUnavailableReason(
  catalog: Catalog,
  state: KeepsakeState,
  key: string,
  encounterBlockedKeepsakeKeys: readonly string[] = [],
): KeepsakeSelectionUnavailableReason | undefined {
  if (state.currentKey === key) return 'alreadyEquipped';
  if (state.removedKeys.includes(key)) return 'removed';
  if (
    state.fatedStatus === 'Unfated' &&
    catalog.keepsakes.byKey[key]?.fatedDisposition === 'enabling'
  )
    return 'unfatedEnabling';
  return encounterBlockedKeepsakeKeys.includes(key) ? 'encounterHistory' : undefined;
}

/**
 * This is intentionally a derivation of the explicit branch products, never
 * a second mutable lifecycle. An opposing identity remains historical even
 * after it is removed, matching the run's irreversible Unfated transition.
 */
export function deriveFatedStatus(
  catalog: Catalog,
  keys: readonly string[],
  activeArcanaKeys: readonly string[] = [],
): FatedStatus {
  if (activeArcanaKeys.some((key) => catalog.arcanaCards.byKey[key]?.fatedIncompatible === true))
    return 'Unfated';
  if (keys.some((key) => catalog.keepsakes.byKey[key]?.fatedDisposition === 'opposing'))
    return 'Unfated';
  return keys.some((key) => catalog.keepsakes.byKey[key]?.fatedDisposition === 'enabling')
    ? 'Fated'
    : 'Unknown';
}
export function createKeepsakeState(
  catalog: Catalog,
  key: string,
  arcanaFear?: ArcanaFearState,
): KeepsakeState {
  return Object.freeze({
    currentKey: key,
    history: Object.freeze([{ key, kind: 'start' as const }]),
    removedKeys: Object.freeze([]),
    fatedStatus: deriveFatedStatus(
      catalog,
      [key],
      arcanaFear?.arcana.active.map((card) => card.key),
    ),
  });
}
export function applyKeepsakeDisposition(
  catalog: Catalog,
  state: KeepsakeState,
  disposition:
    { readonly kind: 'retain' } | { readonly kind: 'replace'; readonly keepsakeKey: string },
  arcanaFear: ArcanaFearState,
): KeepsakeState {
  const activeArcanaKeys = arcanaFear.arcana.active.map((card) => card.key);
  if (disposition.kind === 'retain') {
    const history = Object.freeze([
      ...state.history,
      { key: state.currentKey, kind: 'retain' as const },
    ]);
    return Object.freeze({
      ...state,
      history,
      fatedStatus: deriveFatedStatus(
        catalog,
        history.map((entry) => entry.key),
        activeArcanaKeys,
      ),
    });
  }
  // Invalid authored values deliberately remain in the document for repair,
  // but may not create a false chronological run transition.
  const selected = catalog.keepsakes.byKey[disposition.keepsakeKey];
  if (
    selected === undefined ||
    keepsakeSelectionUnavailableReason(catalog, state, disposition.keepsakeKey) !== undefined
  )
    return state;
  const history = Object.freeze([
    ...state.history,
    { key: disposition.keepsakeKey, kind: 'replace' as const },
  ]);
  return Object.freeze({
    currentKey: disposition.keepsakeKey,
    history,
    removedKeys: Object.freeze([...state.removedKeys, state.currentKey]),
    fatedStatus: deriveFatedStatus(
      catalog,
      history.map((entry) => entry.key),
      activeArcanaKeys,
    ),
  });
}

export function refreshKeepsakeFatedStatus(
  catalog: Catalog,
  state: KeepsakeState,
  arcanaFear: ArcanaFearState,
): KeepsakeState {
  const fatedStatus = deriveFatedStatus(
    catalog,
    state.history.map((entry) => entry.key),
    arcanaFear.arcana.active.map((card) => card.key),
  );
  return fatedStatus === state.fatedStatus ? state : Object.freeze({ ...state, fatedStatus });
}

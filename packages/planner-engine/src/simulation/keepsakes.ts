import type { Catalog } from '../catalog-schema';
import type { AuthoredKeepsakeEquipResults } from '../authored-project/model';
import type { ArcanaFearState } from './arcana-fear';
import type { TraitHistoryState } from './traits';
import { assessTraitOption } from './traits';

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
  /** Retained output of the exact Jeweled Pom equip transition. */
  readonly jeweledPom?: {
    readonly grantedTraitKey: string;
    readonly active: boolean;
    readonly levels: number;
    readonly acquisitionIdentity: string;
  };
  /** Exact temporary direct Hammer acquisition, retained after a rack swap. */
  readonly experimentalHammer?: {
    readonly traitKey: string;
    readonly remainingUses: number;
    readonly acquisitionIdentity: string;
    readonly active: boolean;
  };
}

export function jeweledPomEffectForKey(catalog: import('../catalog-schema').Catalog, key: string) {
  const effect = catalog.keepsakes.byKey[key]?.effect;
  return effect?.kind === 'jeweledPom' ? effect : undefined;
}

export function keepsakeEffectByKind<
  K extends NonNullable<import('../catalog-schema').KeepsakeDeclaration['effect']>['kind'],
>(
  catalog: import('../catalog-schema').Catalog,
  kind: K,
):
  | Extract<
      NonNullable<import('../catalog-schema').KeepsakeDeclaration['effect']>,
      { readonly kind: K }
    >
  | undefined {
  return catalog.keepsakes.values.find((keepsake) => keepsake.effect?.kind === kind)?.effect as
    | Extract<
        NonNullable<import('../catalog-schema').KeepsakeDeclaration['effect']>,
        { readonly kind: K }
      >
    | undefined;
}

export function equipJeweledPom(
  state: KeepsakeState,
  grantedTraitKey: string,
  levels: number,
  acquisitionIdentity: string,
): KeepsakeState {
  return Object.freeze({
    ...state,
    jeweledPom: Object.freeze({
      grantedTraitKey,
      active: state.fatedStatus === 'Fated',
      levels,
      acquisitionIdentity,
    }),
  });
}

/** One exact direct Hades acquisition; not an ordinary three-option offer. */
export function assessJeweledPomEquipResult(
  catalog: Catalog,
  result: NonNullable<AuthoredKeepsakeEquipResults['jeweledPom']>,
  before: TraitHistoryState,
  fatedStatus: FatedStatus,
): { readonly legal: boolean; readonly findings: readonly string[] } {
  if (fatedStatus !== 'Fated')
    return Object.freeze({
      legal: false,
      findings: Object.freeze(['keepsakeEquipResultUnavailable']),
    });
  const effect = keepsakeEffectByKind(catalog, 'jeweledPom');
  if (effect === undefined)
    return Object.freeze({
      legal: false,
      findings: Object.freeze(['keepsakeEquipResultUnavailable']),
    });
  const assessment = assessTraitOption(
    catalog,
    result.traitKey,
    before,
    {
      resolvedProviderKey: effect.giverKey,
      ...(result.deathDefianceConditionMet === undefined
        ? {}
        : { deathDefianceConditionMet: result.deathDefianceConditionMet }),
    },
    result.rarity,
  );
  return Object.freeze({
    legal: assessment.legal,
    findings: Object.freeze(assessment.findings.map((finding) => finding.code)),
  });
}

/** One direct rarityless Hammer acquisition, assessed against the captured pre-equip state. */
export function assessExperimentalHammerEquipResult(
  catalog: Catalog,
  result: NonNullable<AuthoredKeepsakeEquipResults['experimentalHammer']>,
  before: TraitHistoryState,
  loadout: { readonly weaponKey: string; readonly aspectKey: string },
): { readonly legal: boolean; readonly findings: readonly string[] } {
  const assessment = assessTraitOption(catalog, result.traitKey, before, loadout);
  const trait = catalog.traits.byKey[result.traitKey];
  return Object.freeze({
    legal: trait?.hammerCompatibility !== undefined && assessment.legal,
    findings: Object.freeze([
      ...(trait?.hammerCompatibility === undefined ? ['keepsakeEquipResultUnavailable'] : []),
      ...assessment.findings.map((finding) => finding.code),
    ]),
  });
}

export function invalidateJeweledPom(state: KeepsakeState): KeepsakeState {
  if (state.jeweledPom === undefined || !state.jeweledPom.active) return state;
  return Object.freeze({
    ...state,
    jeweledPom: Object.freeze({ ...state.jeweledPom, active: false }),
  });
}

export function equipExperimentalHammer(
  state: KeepsakeState,
  traitKey: string,
  remainingUses: number,
  acquisitionIdentity: string,
): KeepsakeState {
  return Object.freeze({
    ...state,
    experimentalHammer: Object.freeze({
      traitKey,
      remainingUses,
      acquisitionIdentity,
      active: true,
    }),
  });
}

/** A qualifying completion consumes exactly one use; expiry is a separate fold event. */
export function advanceExperimentalHammer(state: KeepsakeState): {
  readonly state: KeepsakeState;
  readonly expired?: KeepsakeState['experimentalHammer'];
} {
  const hammer = state.experimentalHammer;
  if (hammer === undefined || !hammer.active) return Object.freeze({ state, expired: undefined });
  const remainingUses = Math.max(0, hammer.remainingUses - 1);
  const nextHammer = Object.freeze({ ...hammer, remainingUses, active: remainingUses > 0 });
  return Object.freeze({
    state: Object.freeze({ ...state, experimentalHammer: nextHammer }),
    ...(remainingUses === 0 ? { expired: nextHammer } : {}),
  });
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
    ...state,
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

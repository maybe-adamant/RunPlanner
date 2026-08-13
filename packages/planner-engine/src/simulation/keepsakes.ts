import type { Catalog } from '../catalog-schema';
import type { AuthoredKeepsakeEquipResults } from '../authored-project/model';
import type { ArcanaFearState } from './arcana-fear';
import type { TraitHistoryState } from './traits';
import { assessTraitOption } from './traits';
import { nextRarity } from './traits';
import { optionIndex, type AuthoredTraitOffer } from '../authored-project/traits';

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
  /** Retained Calling Card ledger; explicit offer actions are its only consumption source. */
  readonly callingCard?: { readonly remainingCharges: number };
  /** Retained Time Piece ledger; conversions consume it in acquisition chronology. */
  readonly timePiece?: { readonly remainingCharges: number };
  /** Fig Leaf total uses and its one-success-per-biome guard. */
  readonly figLeaf?: { readonly remainingUses: number; readonly activatedThisBiome: boolean };
}

export interface FigLeafStateValue {
  readonly remainingUses: number;
  readonly activatedThisBiome: boolean;
}

/** Attest the branch frontier before lifecycle composition can consume it. */
export function attestFigLeafBranchState(
  branches: readonly { readonly keepsakes: KeepsakeState }[],
): FigLeafStateValue | undefined {
  const values = branches.map((branch) => branch.keepsakes.figLeaf);
  const first = values[0];
  if (first === undefined) {
    if (values.some((value) => value !== undefined)) {
      throw new Error('Fig Leaf branch frontier is divergent');
    }
    return undefined;
  }
  if (
    values.some(
      (value) =>
        value === undefined ||
        value.remainingUses !== first.remainingUses ||
        value.activatedThisBiome !== first.activatedThisBiome,
    )
  ) {
    throw new Error('Fig Leaf branch frontier is divergent');
  }
  return Object.freeze({ ...first });
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
  const effect = catalog.keepsakes.byKey[key]?.effect;
  const fatedStatus = deriveFatedStatus(
    catalog,
    [key],
    arcanaFear?.arcana.active.map((card) => card.key),
  );
  return Object.freeze({
    currentKey: key,
    history: Object.freeze([{ key, kind: 'start' as const }]),
    removedKeys: Object.freeze([]),
    fatedStatus,
    ...(effect?.kind === 'callingCard'
      ? {
          callingCard: Object.freeze({
            remainingCharges: fatedStatus === 'Unfated' ? 0 : effect.rarificationCharges,
          }),
        }
      : {}),
    ...(effect?.kind === 'timePiece'
      ? {
          timePiece: Object.freeze({
            remainingCharges: fatedStatus === 'Unfated' ? 0 : effect.conversionCharges,
          }),
        }
      : {}),
    ...(effect?.kind === 'figLeaf'
      ? {
          figLeaf: Object.freeze({
            remainingUses: effect.biomeUses,
            activatedThisBiome: false,
          }),
        }
      : {}),
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
    const fatedStatus = deriveFatedStatus(
      catalog,
      history.map((entry) => entry.key),
      activeArcanaKeys,
    );
    return Object.freeze({
      ...state,
      history,
      fatedStatus,
      ...(fatedStatus === 'Unfated' && state.callingCard !== undefined
        ? { callingCard: Object.freeze({ remainingCharges: 0 }) }
        : {}),
      ...(fatedStatus === 'Unfated' && state.timePiece !== undefined
        ? { timePiece: Object.freeze({ remainingCharges: 0 }) }
        : {}),
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
  const fatedStatus = deriveFatedStatus(
    catalog,
    history.map((entry) => entry.key),
    activeArcanaKeys,
  );
  return Object.freeze({
    ...state,
    currentKey: disposition.keepsakeKey,
    history,
    removedKeys: Object.freeze([...state.removedKeys, state.currentKey]),
    fatedStatus,
    ...(selected.effect?.kind === 'callingCard' && state.callingCard === undefined
      ? { callingCard: Object.freeze({ remainingCharges: selected.effect.rarificationCharges }) }
      : {}),
    ...(selected.effect?.kind === 'timePiece' && state.timePiece === undefined
      ? { timePiece: Object.freeze({ remainingCharges: selected.effect.conversionCharges }) }
      : {}),
    ...(selected.effect?.kind === 'figLeaf' && state.figLeaf === undefined
      ? {
          figLeaf: Object.freeze({
            remainingUses: selected.effect.biomeUses,
            activatedThisBiome: false,
          }),
        }
      : {}),
    ...(fatedStatus === 'Unfated' && state.callingCard !== undefined
      ? { callingCard: Object.freeze({ remainingCharges: 0 }) }
      : {}),
    ...(fatedStatus === 'Unfated' && state.timePiece !== undefined
      ? { timePiece: Object.freeze({ remainingCharges: 0 }) }
      : {}),
  });
}

/** Biome starts reset only Fig Leaf's local opportunity. */
export function beginBiomeKeepsakeState(state: KeepsakeState): KeepsakeState {
  if (state.figLeaf === undefined || !state.figLeaf.activatedThisBiome) return state;
  return Object.freeze({
    ...state,
    figLeaf: Object.freeze({ ...state.figLeaf, activatedThisBiome: false }),
  });
}

/** Consume one total use and close the current biome opportunity. */
export function consumeFigLeafUse(state: KeepsakeState): KeepsakeState {
  const figLeaf = state.figLeaf;
  if (figLeaf === undefined || figLeaf.remainingUses <= 0 || figLeaf.activatedThisBiome)
    return state;
  return Object.freeze({
    ...state,
    figLeaf: Object.freeze({
      remainingUses: figLeaf.remainingUses - 1,
      activatedThisBiome: true,
    }),
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
  if (fatedStatus === state.fatedStatus) return state;
  return Object.freeze({
    ...state,
    fatedStatus,
    ...(fatedStatus === 'Unfated' && state.callingCard !== undefined
      ? { callingCard: Object.freeze({ remainingCharges: 0 }) }
      : {}),
    ...(fatedStatus === 'Unfated' && state.timePiece !== undefined
      ? { timePiece: Object.freeze({ remainingCharges: 0 }) }
      : {}),
  });
}

/** Consume one legal conversion without producing a Gold acquisition. */
export function consumeTimePieceCharge(state: KeepsakeState): KeepsakeState {
  const remaining = state.timePiece?.remainingCharges ?? 0;
  if (state.fatedStatus !== 'Fated' || remaining === 0) return state;
  return Object.freeze({ ...state, timePiece: Object.freeze({ remainingCharges: remaining - 1 }) });
}

/** Replays the persisted row ledger once for every consumer of an offer. */
export function evaluateCallingCardOffer(
  catalog: Catalog,
  state: KeepsakeState,
  offer: AuthoredTraitOffer,
  baseOfferLegal: boolean,
): {
  readonly offer: AuthoredTraitOffer;
  readonly state: KeepsakeState;
  readonly invalidActions: readonly number[];
} {
  if (
    offer.kind !== 'traits' ||
    offer.rarificationActions === undefined ||
    offer.rarificationActions.length === 0
  )
    return Object.freeze({ offer, state, invalidActions: Object.freeze([]) });
  let remaining = state.callingCard?.remainingCharges ?? 0;
  const options = offer.options.map((option) => ({ ...option }));
  const invalidActions: number[] = [];
  for (const [index, key] of offer.rarificationActions.entries()) {
    const option = options[optionIndex(key)];
    const trait = option === undefined ? undefined : catalog.traits.byKey[option.traitKey];
    const next =
      option?.rarity === undefined
        ? undefined
        : nextRarity(catalog, option.traitKey, option.rarity);
    if (
      !baseOfferLegal ||
      state.fatedStatus !== 'Fated' ||
      remaining === 0 ||
      !catalog.traitGivers.byKey[offer.giverKey]?.callingCardMenu ||
      trait === undefined ||
      trait.blockInRunRarify ||
      next === undefined
    ) {
      invalidActions.push(index);
      continue;
    }
    options[optionIndex(key)] = { ...option!, rarity: next };
    remaining -= 1;
  }
  const effective = Object.freeze({
    ...offer,
    options: Object.freeze(options) as typeof offer.options,
  });
  const nextState =
    remaining === (state.callingCard?.remainingCharges ?? 0)
      ? state
      : Object.freeze({ ...state, callingCard: Object.freeze({ remainingCharges: remaining }) });
  return Object.freeze({
    offer: effective,
    state: nextState,
    invalidActions: Object.freeze(invalidActions),
  });
}

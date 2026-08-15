import type { Catalog, KeepsakeRank, TraitRarity } from '../catalog-schema';
import type { AuthoredKeepsakeEquipResults } from '../authored-project/model';
import type { ArcanaFearState } from './arcana-fear';
import type { TraitHistoryState } from './traits';
import { assessTraitOption } from './traits';
import { nextRarity } from './traits';
import {
  optionIndex,
  type AuthoredGorgonAthenaOffer,
  type AuthoredTraitOffer,
} from '../authored-project/traits';

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
  readonly gorgon?:
    | { readonly status: 'pending'; readonly rarity: TraitRarity }
    | { readonly status: 'consumed' | 'expired' };
}

export interface FigLeafStateValue {
  readonly remainingUses: number;
  readonly activatedThisBiome: boolean;
}

export type GorgonLifecycleStatus = 'pending' | 'consumed' | 'expired';

/** Declaration-owned rank bonus derived only from canonical equipped-trait history. */
export function activeKeepsakeRankBonus(catalog: Catalog, traitHistory: TraitHistoryState): 0 | 1 {
  for (const equipped of Object.values(traitHistory.equippedTraits)) {
    const disposition = catalog.traits.byKey[equipped.traitKey]?.selectedDisposition;
    if (disposition?.kind === 'advanceCurrentKeepsake') return disposition.rankBonus;
  }
  return 0;
}

/** Resolves a later ordinary equip without persisting a second Cherished flag. */
export function keepsakeRankForEquip(
  catalog: Catalog,
  key: string,
  traitHistory: TraitHistoryState,
): KeepsakeRank {
  const keepsake = catalog.keepsakes.byKey[key];
  if (keepsake === undefined || activeKeepsakeRankBonus(catalog, traitHistory) === 0)
    return keepsake?.rank ?? 'Epic';
  const effect = keepsake.effect;
  if (effect === undefined) return keepsake.rank;
  switch (effect.kind) {
    case 'jeweledPom':
    case 'experimentalHammer':
    case 'callingCard':
    case 'timePiece':
    case 'figLeaf':
    case 'gorgonAmulet':
      return 'Heroic';
    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
}

/**
 * Applies Cherished Heirloom's acquisition-time reconstruction to the current
 * supported keepsake only. Equip-time products deliberately remain outside
 * this transition: Fig Leaf and Experimental Hammer are explicit no-ops, and
 * missing retained ledgers are never recreated.
 */
export function advanceCurrentKeepsake(
  catalog: Catalog,
  state: KeepsakeState,
  rankBonus: 1,
): KeepsakeState {
  const keepsake = catalog.keepsakes.byKey[state.currentKey];
  const effect = keepsake?.effect;
  if (keepsake === undefined || effect === undefined) return state;
  const advancedRank: KeepsakeRank =
    keepsake.rank === 'Epic' && rankBonus === 1 ? 'Heroic' : keepsake.rank;
  switch (effect.kind) {
    case 'gorgonAmulet':
      return state.gorgon?.status === 'pending'
        ? Object.freeze({
            ...state,
            gorgon: Object.freeze({
              status: 'pending' as const,
              rarity: gorgonRarityForRank(catalog, effect, advancedRank),
            }),
          })
        : state;
    case 'figLeaf':
      return state;
    case 'experimentalHammer':
      return state;
    case 'jeweledPom':
      return state.jeweledPom === undefined
        ? state
        : Object.freeze({
            ...state,
            jeweledPom: Object.freeze({
              ...state.jeweledPom,
              levels: effect.subsequentEligibleTraitLevelsByRank[advancedRank],
            }),
          });
    case 'callingCard':
      return state.callingCard === undefined
        ? state
        : Object.freeze({
            ...state,
            callingCard: Object.freeze({
              remainingCharges:
                state.callingCard.remainingCharges +
                (effect.rarificationChargesByRank[advancedRank] -
                  effect.rarificationChargesByRank[keepsake.rank]),
            }),
          });
    case 'timePiece':
      return state.timePiece === undefined
        ? state
        : Object.freeze({
            ...state,
            timePiece: Object.freeze({
              remainingCharges:
                state.timePiece.remainingCharges +
                (effect.conversionChargesByRank[advancedRank] -
                  effect.conversionChargesByRank[keepsake.rank]),
            }),
          });
    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
}

function gorgonRarityForRank(
  catalog: Catalog,
  effect: Extract<
    NonNullable<import('../catalog-schema').KeepsakeDeclaration['effect']>,
    { readonly kind: 'gorgonAmulet' }
  >,
  rank: KeepsakeRank,
): TraitRarity {
  const rarity = catalog.traitRarityOrder[effect.rarityLevelByRank[rank] - 1];
  if (rarity === undefined) throw new Error(`Gorgon rank ${rank} has no declared rarity`);
  return rarity;
}
export interface GorgonEligibilityInput {
  readonly status: GorgonLifecycleStatus | undefined;
  readonly biomeDepthCache: number;
  readonly minimumBiomeDepth: number;
  readonly roomBlocked: boolean;
  readonly encounterBlocked: boolean;
  readonly figLeafSkipped: boolean;
  readonly deathDefianceConditionMet: boolean;
}
export function assessGorgonEligibility(input: GorgonEligibilityInput): boolean {
  return (
    input.status === 'pending' &&
    input.biomeDepthCache >= input.minimumBiomeDepth &&
    !input.roomBlocked &&
    !input.encounterBlocked &&
    !input.figLeafSkipped &&
    input.deathDefianceConditionMet
  );
}

export interface GorgonCandidateInput {
  readonly status: GorgonLifecycleStatus | undefined;
  readonly naturalAthena: boolean;
  readonly gorgonEligible: boolean;
}

export function assessGorgonChildSettlement(
  catalog: Catalog,
  offer: AuthoredGorgonAthenaOffer | undefined,
): boolean {
  const keepsake = catalog.keepsakes.values.find(
    (candidate) => candidate.effect?.kind === 'gorgonAmulet',
  );
  const effect = keepsake?.effect;
  const giver =
    effect?.kind === 'gorgonAmulet' ? catalog.traitGivers.byKey[effect.providerKey] : undefined;
  return (
    offer !== undefined &&
    offer.traitKeys.length === 3 &&
    new Set(offer.traitKeys).size === 3 &&
    effect?.kind === 'gorgonAmulet' &&
    giver !== undefined &&
    offer.traitKeys.every((traitKey) => giver.traitKeys.includes(traitKey))
  );
}

/** Shared route appearance budget for natural Athena and Gorgon Athena. */
export function assessGorgonCandidate(input: GorgonCandidateInput): {
  readonly naturalPossible: boolean;
  readonly gorgonPossible: boolean;
  readonly nextStatus: GorgonLifecycleStatus | undefined;
} {
  const naturalPossible = input.naturalAthena && input.status !== 'consumed';
  const gorgonPossible = input.gorgonEligible && input.status === 'pending';
  return Object.freeze({
    naturalPossible,
    gorgonPossible,
    nextStatus:
      input.naturalAthena && input.status === 'pending'
        ? 'expired'
        : input.gorgonEligible && input.status === 'pending'
          ? 'consumed'
          : input.status,
  });
}
export function attestGorgonBranchState(
  branches: readonly { readonly keepsakes: KeepsakeState }[],
): GorgonLifecycleStatus | undefined {
  const states = branches.map((branch) => branch.keepsakes.gorgon);
  const values = states.map((state) => state?.status);
  const first = values[0];
  const firstRarity = states[0]?.status === 'pending' ? states[0].rarity : undefined;
  if (
    values.some((value) => value !== first) ||
    states.some((state) =>
      state?.status === 'pending' ? state.rarity !== firstRarity : firstRarity !== undefined,
    )
  )
    throw new Error('Gorgon branch frontier is divergent');
  return first;
}

export function attestPendingGorgonRarity(
  branches: readonly { readonly keepsakes: KeepsakeState }[],
): TraitRarity | undefined {
  const status = attestGorgonBranchState(branches);
  const first = branches[0]?.keepsakes.gorgon;
  return status === 'pending' && first?.status === 'pending' ? first.rarity : undefined;
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
  const keepsake = catalog.keepsakes.byKey[key];
  const effect = keepsake?.effect;
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
    ...(effect?.kind === 'callingCard' && keepsake !== undefined
      ? {
          callingCard: Object.freeze({
            remainingCharges:
              fatedStatus === 'Unfated' ? 0 : effect.rarificationChargesByRank[keepsake.rank],
          }),
        }
      : {}),
    ...(effect?.kind === 'timePiece' && keepsake !== undefined
      ? {
          timePiece: Object.freeze({
            remainingCharges:
              fatedStatus === 'Unfated' ? 0 : effect.conversionChargesByRank[keepsake.rank],
          }),
        }
      : {}),
    ...(effect?.kind === 'figLeaf' && keepsake !== undefined
      ? {
          figLeaf: Object.freeze({
            remainingUses: effect.biomeUsesByRank[keepsake.rank],
            activatedThisBiome: false,
          }),
        }
      : {}),
    ...(effect?.kind === 'gorgonAmulet' && keepsake !== undefined
      ? {
          gorgon: Object.freeze({
            status: 'pending' as const,
            rarity: gorgonRarityForRank(catalog, effect, keepsake.rank),
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
  equippedRank?: KeepsakeRank,
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
  const rank = equippedRank ?? selected.rank;
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
    ...(state.gorgon?.status === 'pending'
      ? { gorgon: Object.freeze({ status: 'expired' as const }) }
      : {}),
    ...(selected.effect?.kind === 'callingCard' && state.callingCard === undefined
      ? {
          callingCard: Object.freeze({
            remainingCharges: selected.effect.rarificationChargesByRank[rank],
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'timePiece' && state.timePiece === undefined
      ? {
          timePiece: Object.freeze({
            remainingCharges: selected.effect.conversionChargesByRank[rank],
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'figLeaf' && state.figLeaf === undefined
      ? {
          figLeaf: Object.freeze({
            remainingUses: selected.effect.biomeUsesByRank[rank],
            activatedThisBiome: false,
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'gorgonAmulet' && state.gorgon === undefined
      ? {
          gorgon: Object.freeze({
            status: 'pending' as const,
            rarity: gorgonRarityForRank(catalog, selected.effect, rank),
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

export function expirePendingGorgon(state: KeepsakeState): KeepsakeState {
  return state.gorgon?.status === 'pending'
    ? Object.freeze({ ...state, gorgon: Object.freeze({ status: 'expired' as const }) })
    : state;
}

export function consumeGorgonAppearance(state: KeepsakeState): KeepsakeState {
  return state.gorgon?.status === 'pending'
    ? Object.freeze({ ...state, gorgon: Object.freeze({ status: 'consumed' as const }) })
    : state;
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

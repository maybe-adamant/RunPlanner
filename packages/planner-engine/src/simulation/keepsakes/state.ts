import type { Catalog, InRunTraitRarity, KeepsakeRank } from '../../catalog-schema';
import type { ArcanaFearState } from '../arcana-fear';
import type { TraitHistoryState } from '../trait-history';

export type FatedStatus = 'Unknown' | 'Fated' | 'Unfated';
export interface KeepsakeHistoryEntry {
  readonly key: string;
  readonly kind: 'start' | 'replace';
  /** The biome number in which this keepsake becomes effective. */
  readonly biomeNumber: number;
}
export interface KeepsakeState {
  readonly currentKey: string;
  readonly history: readonly KeepsakeHistoryEntry[];
  readonly removedKeys: readonly string[];
  readonly fatedStatus: FatedStatus;
  /** Independent active sources for the nine Olympian reward-pressure effects. */
  readonly olympianSources: readonly OlympianProviderSource[];
  readonly nextOlympianAcquisitionOrder: number;
  /** Retained output of the exact Jeweled Pom equip transition. */
  readonly jeweledPom?: {
    readonly grantedTraitKey: string;
    readonly active: boolean;
    readonly levels: number;
    readonly acquisitionIdentity: string;
  };
  /** Exact temporary direct Hammer acquisitions, retained and expired independently. */
  readonly experimentalHammers: readonly {
    readonly traitKey: string;
    readonly remainingUses: number;
    readonly acquisitionIdentity: string;
    readonly active: boolean;
  }[];
  /** Retained Calling Card ledger; explicit offer actions are its only consumption source. */
  readonly callingCard?: { readonly remainingCharges: number };
  /** Retained Time Piece ledger; conversions consume it in acquisition chronology. */
  readonly timePiece?: { readonly remainingCharges: number };
  /** Fig Leaf total uses and its one-success-per-biome guard. */
  readonly figLeaf?: { readonly remainingUses: number; readonly activatedThisBiome: boolean };
  readonly gorgon?:
    | { readonly status: 'pending'; readonly rarityLevel: GorgonRarityLevel }
    | { readonly status: 'consumed' | 'expired' };
  /** Aromatic Phial's one live source use; absent after ordinary replacement. */
  readonly phial?: { readonly status: 'pending' | 'consumed' };
  /** Crystal Figurine source, retaining whether it came from the ordinary slot or Echo. */
  readonly figurine?: {
    readonly origin: 'ordinary' | 'echo';
    readonly status: 'pending' | 'consumed';
    readonly rarity: InRunTraitRarity;
  };
  /** Concave Stone source; Echo replay remains unslotted after consumption. */
  readonly stone?: {
    readonly origin: 'ordinary' | 'echo';
    readonly status: 'pending' | 'consumed';
    readonly rank: KeepsakeRank;
  };
  /** One direct Chaos blessing source and its exact eight-room checkpoint. */
  readonly transcendentEmbryo?: {
    readonly origin: 'ordinary' | 'echo';
    readonly rarity: InRunTraitRarity;
    readonly progress: number;
    readonly markedBlessingKey: string;
    readonly markedBlessingValues: Readonly<Record<string, number>>;
    readonly markedBlessingAcquisitionIdentity: string;
  };
}

export interface OlympianProviderSource {
  readonly keepsakeKey: string;
  readonly providerKey: string;
  readonly origin: 'ordinary' | 'echo';
  readonly acquisitionOrder: number;
  readonly remainingForceUses: 0 | 1;
  readonly remainingRarificationUses: 0 | 1;
  readonly maximumSourceRarityLevel: 1 | 2 | 3;
}

export interface FigLeafStateValue {
  readonly remainingUses: number;
  readonly activatedThisBiome: boolean;
}

export type GorgonLifecycleStatus = 'pending' | 'consumed' | 'expired';
export type GorgonRarityLevel = 1 | 2 | 3 | 4;

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
    case 'fountainRarity':
      return 'Epic';
    case 'crystalFigurine':
      return 'Heroic';
    case 'concaveStone':
      return 'Heroic';
    case 'transcendentEmbryo':
      return 'Heroic';
    case 'olympianRewardPressure':
      // The source declaration deliberately has no Heroic row.
      return 'Epic';
    case 'moonBeam':
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
              rarityLevel: gorgonRarityLevelForRank(effect, advancedRank),
            }),
          })
        : state;
    case 'fountainRarity':
      return state;
    case 'crystalFigurine':
      return state.figurine?.status === 'pending'
        ? Object.freeze({
            ...state,
            figurine: Object.freeze({
              ...state.figurine,
              rarity: figurineRarityForRank(catalog, effect, advancedRank),
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
    case 'concaveStone':
      return state.stone?.status === 'pending'
        ? Object.freeze({
            ...state,
            stone: Object.freeze({ ...state.stone, rank: advancedRank }),
          })
        : state;
    case 'transcendentEmbryo':
      return state.transcendentEmbryo === undefined
        ? state
        : Object.freeze({
            ...state,
            transcendentEmbryo: Object.freeze({
              ...state.transcendentEmbryo,
              rarity: effect.blessingRarityByRank[advancedRank],
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
    case 'olympianRewardPressure':
      return Object.freeze({
        ...state,
        olympianSources: Object.freeze(
          state.olympianSources.map((source) =>
            source.origin !== 'ordinary'
              ? source
              : Object.freeze({ ...source, remainingRarificationUses: 1 as const }),
          ),
        ),
      });
    case 'moonBeam':
      return state;
    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
}

export function gorgonRarityLevelForRank(
  effect: Extract<
    NonNullable<import('../../catalog-schema').KeepsakeDeclaration['effect']>,
    { readonly kind: 'gorgonAmulet' }
  >,
  rank: KeepsakeRank,
): GorgonRarityLevel {
  return effect.rarityLevelByRank[rank];
}

export function figurineRarityForRank(
  catalog: Catalog,
  effect: Extract<
    NonNullable<import('../../catalog-schema').KeepsakeDeclaration['effect']>,
    { readonly kind: 'crystalFigurine' }
  >,
  rank: KeepsakeRank,
): InRunTraitRarity {
  const rarity = catalog.traitRarityOrder[effect.rarityLevelByRank[rank] - 1];
  if (rarity === undefined) throw new Error(`Figurine rank ${rank} has no declared rarity`);
  return rarity;
}

export function jeweledPomEffectForKey(
  catalog: import('../../catalog-schema').Catalog,
  key: string,
) {
  const effect = catalog.keepsakes.byKey[key]?.effect;
  return effect?.kind === 'jeweledPom' ? effect : undefined;
}

export function keepsakeEffectByKind<
  K extends NonNullable<import('../../catalog-schema').KeepsakeDeclaration['effect']>['kind'],
>(
  catalog: import('../../catalog-schema').Catalog,
  kind: K,
):
  | Extract<
      NonNullable<import('../../catalog-schema').KeepsakeDeclaration['effect']>,
      { readonly kind: K }
    >
  | undefined {
  return catalog.keepsakes.values.find((keepsake) => keepsake.effect?.kind === kind)?.effect as
    | Extract<
        NonNullable<import('../../catalog-schema').KeepsakeDeclaration['effect']>,
        { readonly kind: K }
      >
    | undefined;
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
  biomeNumber = 1,
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
    history: Object.freeze([{ key, kind: 'start' as const, biomeNumber }]),
    removedKeys: Object.freeze([]),
    fatedStatus,
    experimentalHammers: Object.freeze([]),
    olympianSources:
      effect?.kind === 'olympianRewardPressure'
        ? Object.freeze([
            Object.freeze({
              keepsakeKey: key,
              providerKey: effect.providerKey,
              origin: 'ordinary' as const,
              acquisitionOrder: 0,
              remainingForceUses: effect.providerForceUses,
              remainingRarificationUses: effect.providerRarificationUses,
              maximumSourceRarityLevel: effect.maximumSourceRarityLevelByRank[keepsake!.rank],
            }),
          ])
        : Object.freeze([]),
    nextOlympianAcquisitionOrder: effect?.kind === 'olympianRewardPressure' ? 1 : 0,
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
            rarityLevel: gorgonRarityLevelForRank(effect, keepsake.rank),
          }),
        }
      : {}),
    ...(effect?.kind === 'fountainRarity'
      ? { phial: Object.freeze({ status: 'pending' as const }) }
      : {}),
    ...(effect?.kind === 'crystalFigurine' && keepsake !== undefined
      ? {
          figurine: Object.freeze({
            origin: 'ordinary' as const,
            status: 'pending' as const,
            rarity: figurineRarityForRank(catalog, effect, keepsake.rank),
          }),
        }
      : {}),
    ...(effect?.kind === 'concaveStone' && keepsake !== undefined
      ? {
          stone: Object.freeze({
            origin: 'ordinary' as const,
            status: 'pending' as const,
            rank: keepsake.rank,
          }),
        }
      : {}),
  });
}
export function applyKeepsakeReplacement(
  catalog: Catalog,
  state: KeepsakeState,
  keepsakeKey: string,
  arcanaFear: ArcanaFearState,
  equippedRank?: KeepsakeRank,
  effectiveBiomeNumber = (state.history.at(-1)?.biomeNumber ?? 0) + 1,
): KeepsakeState {
  const activeArcanaKeys = arcanaFear.arcana.active.map((card) => card.key);
  // Invalid authored values deliberately remain in the document for repair,
  // but may not create a false chronological run transition.
  const selected = catalog.keepsakes.byKey[keepsakeKey];
  if (
    selected === undefined ||
    keepsakeSelectionUnavailableReason(catalog, state, keepsakeKey) !== undefined
  )
    return state;
  const rank = equippedRank ?? selected.rank;
  const history = Object.freeze([
    ...state.history,
    { key: keepsakeKey, kind: 'replace' as const, biomeNumber: effectiveBiomeNumber },
  ]);
  const fatedStatus = deriveFatedStatus(
    catalog,
    history.map((entry) => entry.key),
    activeArcanaKeys,
  );
  const { phial: _phial, figurine: _figurine, ...withoutPhialAndFigurine } = state;
  void _phial;
  void _figurine;
  const stateWithoutTrackedSources =
    state.currentKey === 'UnpickedBoonKeepsake'
      ? (() => {
          const { stone: _stone, ...withoutStone } = withoutPhialAndFigurine;
          void _stone;
          return withoutStone;
        })()
      : withoutPhialAndFigurine;
  const stateWithoutSources =
    state.currentKey === 'RandomBlessingKeepsake'
      ? (() => {
          const { transcendentEmbryo: _transcendentEmbryo, ...withoutTranscendentEmbryo } =
            stateWithoutTrackedSources;
          void _transcendentEmbryo;
          return withoutTranscendentEmbryo;
        })()
      : stateWithoutTrackedSources;
  const withoutOrdinaryOlympian = stateWithoutSources.olympianSources.some(
    (source) => source.origin === 'ordinary',
  )
    ? Object.freeze({
        ...stateWithoutSources,
        olympianSources: Object.freeze(
          stateWithoutSources.olympianSources.filter((source) => source.origin !== 'ordinary'),
        ),
      })
    : stateWithoutSources;
  return Object.freeze({
    ...withoutOrdinaryOlympian,
    currentKey: keepsakeKey,
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
            rarityLevel: gorgonRarityLevelForRank(selected.effect, rank),
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'fountainRarity'
      ? { phial: Object.freeze({ status: 'pending' as const }) }
      : {}),
    ...(selected.effect?.kind === 'crystalFigurine'
      ? {
          figurine: Object.freeze({
            origin: 'ordinary' as const,
            status: 'pending' as const,
            rarity: figurineRarityForRank(catalog, selected.effect, rank),
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'concaveStone'
      ? {
          stone: Object.freeze({
            origin: 'ordinary' as const,
            status: 'pending' as const,
            rank,
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'olympianRewardPressure'
      ? {
          olympianSources: Object.freeze([
            ...(withoutOrdinaryOlympian.olympianSources ?? []),
            Object.freeze({
              keepsakeKey: selected.key,
              providerKey: selected.effect.providerKey,
              origin: 'ordinary' as const,
              acquisitionOrder: state.nextOlympianAcquisitionOrder,
              remainingForceUses: selected.effect.providerForceUses,
              remainingRarificationUses: selected.effect.providerRarificationUses,
              maximumSourceRarityLevel:
                selected.effect.maximumSourceRarityLevelByRank[rank === 'Heroic' ? 'Epic' : rank],
            }),
          ]),
          nextOlympianAcquisitionOrder: state.nextOlympianAcquisitionOrder + 1,
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

export function beginBiomeKeepsakeState(state: KeepsakeState): KeepsakeState {
  if (state.figLeaf === undefined || !state.figLeaf.activatedThisBiome) return state;
  return Object.freeze({
    ...state,
    figLeaf: Object.freeze({ ...state.figLeaf, activatedThisBiome: false }),
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

import type { Catalog, TraitRarity } from '../../catalog-schema';
import {
  optionIndex,
  type AuthoredTraitOffer,
  type TraitOptionKey,
} from '../../authored-project/traits/state';
import { nextRarity } from '../traits/history/upgrades';
import type { KeepsakeState } from './state';

export function applyEchoCallingCardReplay(state: KeepsakeState, charges: number): KeepsakeState {
  return Object.freeze({
    ...state,
    callingCard: Object.freeze({
      remainingCharges: (state.callingCard?.remainingCharges ?? 0) + charges,
    }),
  });
}

export function applyEchoTimePieceReplay(state: KeepsakeState, charges: number): KeepsakeState {
  return Object.freeze({
    ...state,
    timePiece: Object.freeze({
      remainingCharges: (state.timePiece?.remainingCharges ?? 0) + charges,
    }),
  });
}

/** Gift Gift Gift recreates the Common source without occupying the ordinary slot. */
export function applyEchoOlympianRewardPressureReplay(
  catalog: Catalog,
  state: KeepsakeState,
  capturedKeepsakeKey: string,
): KeepsakeState {
  const effect = catalog.keepsakes.byKey[capturedKeepsakeKey]?.effect;
  if (
    effect?.kind !== 'olympianRewardPressure' ||
    state.olympianSources.some((source) => source.origin === 'echo')
  )
    return state;
  return Object.freeze({
    ...state,
    olympianSources: Object.freeze([
      ...state.olympianSources,
      Object.freeze({
        keepsakeKey: capturedKeepsakeKey,
        providerKey: effect.providerKey,
        origin: 'echo' as const,
        acquisitionOrder: state.nextOlympianAcquisitionOrder,
        remainingForceUses: effect.providerForceUses,
        remainingRarificationUses: effect.providerRarificationUses,
        maximumSourceRarityLevel: effect.maximumSourceRarityLevelByRank.Common,
      }),
    ]),
    nextOlympianAcquisitionOrder: state.nextOlympianAcquisitionOrder + 1,
  });
}

/** Every matching non-purchase materialization spends its own active force use. */
export function consumeOlympianProviderMaterialized(
  state: KeepsakeState,
  providerKey: string,
  provenance: 'free' | 'paid',
): KeepsakeState {
  if (provenance === 'paid') return state;
  const previous = state.olympianSources;
  const sources = previous.map((source) =>
    source.providerKey === providerKey && source.remainingForceUses === 1
      ? Object.freeze({ ...source, remainingForceUses: 0 as const })
      : source,
  );
  return sources.some((source, index) => source !== previous[index])
    ? Object.freeze({ ...state, olympianSources: Object.freeze(sources) })
    : state;
}

/** Ordinary setup scans first; Devotion's distinct source loop scans last. */
export function olympianProviderForOffer(
  state: KeepsakeState,
  priorProviderKeys: readonly string[] = [],
  devotion = false,
  interactedProviderKeys: ReadonlySet<string> = new Set(),
): string | undefined {
  const candidates = state.olympianSources.filter(
    (source) =>
      source.remainingForceUses === 1 &&
      !priorProviderKeys.includes(source.providerKey) &&
      (!devotion || interactedProviderKeys.has(source.providerKey)),
  );
  return (devotion ? candidates.at(-1) : candidates[0])?.providerKey;
}

/** Consume one total use and close the current biome opportunity. */
export function consumeTimePieceCharge(state: KeepsakeState): KeepsakeState {
  const remaining = state.timePiece?.remainingCharges ?? 0;
  if (state.fatedStatus !== 'Fated' || remaining === 0) return state;
  return Object.freeze({ ...state, timePiece: Object.freeze({ remainingCharges: remaining - 1 }) });
}

/**
 * Rarify uses this giver's menu reads at open: a live matching Olympian source
 * first, then Calling Card (spendable only while Fated), as offer actions resolve.
 */
export function rarificationUsesForGiver(
  catalog: Catalog,
  state: KeepsakeState,
  giverKey: string,
): number | undefined {
  const providerSources = state.olympianSources.filter((source) => source.providerKey === giverKey);
  if (providerSources.some((source) => source.remainingRarificationUses === 1)) return 1;
  if (
    catalog.traitGivers.byKey[giverKey]?.callingCardMenu === true &&
    state.callingCard !== undefined
  )
    return state.fatedStatus === 'Fated' ? state.callingCard.remainingCharges : 0;
  return providerSources.length > 0 ? 0 : undefined;
}

/** One offer's Rarify ledger replayed over its screens, with the keepsake state it leaves. */
export interface RarificationLedgerEvaluation {
  /** The offer with every screen's rows at their rarity after its clicks. */
  readonly offer: AuthoredTraitOffer;
  readonly state: KeepsakeState;
  /** The final screen's unavailable clicks, by position in its list. */
  readonly invalidActions: readonly number[];
  /** Each earlier screen's unavailable clicks, oldest first; empty without earlier screens. */
  readonly rerolledScreenInvalidActions: readonly (readonly number[])[];
}

/**
 * Replays the persisted Rarify ledger once for every consumer of an offer. A
 * rerolled screen is the same native screen, so the clicks on its earlier
 * screens spend first, oldest first, from the same sources as the final
 * screen's. A non-MultiUse source allows one click per screen session; every
 * such source holds one use, so spending it is that cap.
 */
export function evaluateCallingCardOffer(
  catalog: Catalog,
  state: KeepsakeState,
  offer: AuthoredTraitOffer,
  baseOfferLegal: boolean,
): RarificationLedgerEvaluation {
  const earlier = offer.kind === 'chaos' ? [] : (offer.rerolledScreens ?? []);
  const unchanged = Object.freeze({
    offer,
    state,
    invalidActions: Object.freeze([]),
    rerolledScreenInvalidActions: Object.freeze(earlier.map(() => Object.freeze([]))),
  });
  if (
    offer.kind === 'chaos' ||
    ((offer.kind !== 'traits' || (offer.rarificationActions?.length ?? 0) === 0) &&
      earlier.every((screen) => (screen?.rarificationActions?.length ?? 0) === 0))
  )
    return unchanged;
  let remaining = state.callingCard?.remainingCharges ?? 0;
  let olympianSources = state.olympianSources ?? Object.freeze([]);
  const giverKey = offer.giverKey;
  const replay = <O extends { readonly traitKey: string; readonly rarity?: TraitRarity }>(
    shown: readonly O[],
    actions: readonly TraitOptionKey[],
    rejectedOptionKey: TraitOptionKey | undefined,
  ) => {
    const options = shown.map((option) => ({ ...option }));
    const invalid: number[] = [];
    for (const [index, key] of actions.entries()) {
      const option = options[optionIndex(key)];
      const trait = option === undefined ? undefined : catalog.traits.byKey[option.traitKey];
      const next =
        option?.rarity === undefined
          ? undefined
          : nextRarity(catalog, option.traitKey, option.rarity);
      const rarityLevel =
        option?.rarity === undefined
          ? 0
          : (catalog.traitRarityOrder as readonly string[]).indexOf(option.rarity) + 1;
      // A matching Olympian source owns this action even when its rank cap makes
      // the action unavailable.  Falling through to Calling Card in that case
      // would silently change the source-specific cap into a general upgrade.
      const providerSource = olympianSources.find(
        (source) => source.providerKey === giverKey && source.remainingRarificationUses === 1,
      );
      if (
        baseOfferLegal &&
        providerSource !== undefined &&
        option !== undefined &&
        trait !== undefined &&
        !trait.blockInRunRarify &&
        next !== undefined &&
        rarityLevel <= providerSource.maximumSourceRarityLevel &&
        rejectedOptionKey !== key
      ) {
        options[optionIndex(key)] = { ...option, rarity: next };
        olympianSources = Object.freeze(
          olympianSources
            .map((source) =>
              source === providerSource
                ? Object.freeze({ ...source, remainingRarificationUses: 0 as const })
                : source,
            )
            // An unslotted Gift source is removed only after the nested use is spent.
            .filter((source) => source.origin !== 'echo' || source.remainingRarificationUses > 0),
        );
        continue;
      }
      if (providerSource !== undefined) {
        invalid.push(index);
        continue;
      }
      if (
        !baseOfferLegal ||
        state.fatedStatus !== 'Fated' ||
        remaining === 0 ||
        !catalog.traitGivers.byKey[giverKey]?.callingCardMenu ||
        rejectedOptionKey === key ||
        trait === undefined ||
        trait.blockInRunRarify ||
        next === undefined
      ) {
        invalid.push(index);
        continue;
      }
      options[optionIndex(key)] = { ...option!, rarity: next };
      remaining -= 1;
    }
    return { options: Object.freeze(options.map((option) => Object.freeze(option))), invalid };
  };
  const rerolledScreenInvalidActions: (readonly number[])[] = [];
  const rerolledScreens = earlier.map((screen) => {
    if (screen === null || (screen.rarificationActions?.length ?? 0) === 0) {
      rerolledScreenInvalidActions.push(Object.freeze([]));
      return screen;
    }
    const replayed = replay(
      screen.options,
      screen.rarificationActions ?? [],
      screen.rejectedOptionKey,
    );
    rerolledScreenInvalidActions.push(Object.freeze(replayed.invalid));
    return Object.freeze({ ...screen, options: replayed.options });
  });
  const final =
    offer.kind === 'traits'
      ? replay(offer.options, offer.rarificationActions ?? [], offer.rejectedOptionKey)
      : undefined;
  const effective = Object.freeze({
    ...offer,
    ...(final === undefined || offer.kind !== 'traits'
      ? {}
      : { options: final.options as unknown as typeof offer.options }),
    ...(earlier.length === 0 ? {} : { rerolledScreens: Object.freeze(rerolledScreens) }),
  }) as AuthoredTraitOffer;
  const nextState =
    remaining === (state.callingCard?.remainingCharges ?? 0) &&
    olympianSources === state.olympianSources
      ? state
      : Object.freeze({
          ...state,
          ...(remaining === (state.callingCard?.remainingCharges ?? 0)
            ? {}
            : { callingCard: Object.freeze({ remainingCharges: remaining }) }),
          ...(olympianSources === state.olympianSources ? {} : { olympianSources }),
        });
  return Object.freeze({
    offer: effective,
    state: nextState,
    invalidActions: Object.freeze(final?.invalid ?? []),
    rerolledScreenInvalidActions: Object.freeze(rerolledScreenInvalidActions),
  });
}

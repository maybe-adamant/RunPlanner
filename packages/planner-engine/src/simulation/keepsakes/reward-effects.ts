import type { Catalog } from '../../catalog-schema';
import { optionIndex, type AuthoredTraitOffer } from '../../authored-project/traits';
import { nextRarity } from '../trait-history';
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
  let olympianSources = state.olympianSources ?? Object.freeze([]);
  const options = offer.options.map((option) => ({ ...option }));
  const invalidActions: number[] = [];
  for (const [index, key] of offer.rarificationActions.entries()) {
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
      (source) => source.providerKey === offer.giverKey && source.remainingRarificationUses === 1,
    );
    if (
      baseOfferLegal &&
      providerSource !== undefined &&
      option !== undefined &&
      trait !== undefined &&
      !trait.blockInRunRarify &&
      next !== undefined &&
      rarityLevel <= providerSource.maximumSourceRarityLevel &&
      offer.rejectedOptionKey !== key
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
      invalidActions.push(index);
      continue;
    }
    if (
      !baseOfferLegal ||
      state.fatedStatus !== 'Fated' ||
      remaining === 0 ||
      !catalog.traitGivers.byKey[offer.giverKey]?.callingCardMenu ||
      offer.rejectedOptionKey === key ||
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
    invalidActions: Object.freeze(invalidActions),
  });
}

import type { Catalog, TraitRarity } from '../catalog-schema';
import { deriveRouteLoadout } from '../authored-project/loadout';
import type { RouteLoadout } from '../authored-project/model';
import type { SemanticAddress } from '../authored-project/addresses';

export type ArcanaActivationOrigin = 'manual' | 'automatic' | 'temporary';
export interface ActiveArcanaState {
  readonly key: string;
  readonly origin: ArcanaActivationOrigin;
  readonly rarity: Extract<TraitRarity, 'Epic' | 'Heroic'>;
}
export interface ArcanaState {
  readonly active: readonly ActiveArcanaState[];
}
export interface FearState {
  readonly configuredRanks: Readonly<Record<string, number>>;
  readonly configuredTotal: number;
  readonly disabledVowKeys: readonly string[];
  readonly effectiveRanks: Readonly<Record<string, number>>;
}
export type ArcanaFearEvent =
  | ({
      readonly kind: 'temporaryArcanaActivated';
      readonly arcanaKeys: readonly string[];
    } & ArcanaFearEvidence)
  | ({
      readonly kind: 'arcanaPromoted';
      readonly arcanaKeys: readonly string[];
    } & ArcanaFearEvidence)
  | ({ readonly kind: 'fearVowSuppressed'; readonly vowKey: string } & ArcanaFearEvidence);
export interface ArcanaFearEvidence {
  readonly owner: SemanticAddress;
  readonly sequence: number;
}
export interface ArcanaFearState {
  readonly arcana: ArcanaState;
  readonly fear: FearState;
  readonly events: readonly ArcanaFearEvent[];
}

export type ArcanaTransitionReason =
  | 'staleChronology'
  | 'emptyTargetSet'
  | 'duplicateTarget'
  | 'unknownArcana'
  | 'arcanaAlreadyActive'
  | 'arcanaNotActive'
  | 'arcanaNotEpic';
export type FearTransitionReason =
  'staleChronology' | 'unknownVow' | 'vowNotCirceRemovable' | 'vowNotEffectivelyActive';
export type ArcanaTransitionAssessment =
  | { readonly legal: true; readonly state: ArcanaFearState }
  | {
      readonly legal: false;
      readonly state: ArcanaFearState;
      readonly reason: ArcanaTransitionReason;
    };
export type FearTransitionAssessment =
  | { readonly legal: true; readonly state: ArcanaFearState }
  | {
      readonly legal: false;
      readonly state: ArcanaFearState;
      readonly reason: FearTransitionReason;
    };

function canAppendEvidence(state: ArcanaFearState, evidence: ArcanaFearEvidence): boolean {
  const previous = state.events.at(-1);
  return previous === undefined || evidence.sequence > previous.sequence;
}

/** Seeds route-local state exactly once. Temporary activation never re-runs automatic rules. */
export function createArcanaFearState(catalog: Catalog, loadout: RouteLoadout): ArcanaFearState {
  const derived = deriveRouteLoadout(catalog, loadout);
  const manual = new Set(loadout.manualArcanaKeys);
  return Object.freeze({
    arcana: Object.freeze({
      active: Object.freeze(
        derived.activeArcanaKeys.map((key) =>
          Object.freeze({
            key,
            origin: manual.has(key) ? ('manual' as const) : ('automatic' as const),
            rarity: 'Epic' as const,
          }),
        ),
      ),
    }),
    fear: Object.freeze({
      configuredRanks: Object.freeze({ ...loadout.fearRanks }),
      configuredTotal: derived.fearTotal,
      disabledVowKeys: Object.freeze([]),
      effectiveRanks: Object.freeze({ ...loadout.fearRanks }),
    }),
    events: Object.freeze([]),
  });
}

/** Closed declared-effect transitions; Circe and Judgment ownership arrives in later gates. */
function rejected<T extends ArcanaTransitionReason | FearTransitionReason>(
  state: ArcanaFearState,
  reason: T,
): { readonly legal: false; readonly state: ArcanaFearState; readonly reason: T } {
  return Object.freeze({ legal: false, state, reason });
}

function canonicalArcanaSet(catalog: Catalog, keys: readonly string[]): readonly string[] {
  return Object.freeze(
    [...keys].sort(
      (left, right) =>
        catalog.arcanaCards.values.findIndex((card) => card.key === left) -
        catalog.arcanaCards.values.findIndex((card) => card.key === right),
    ),
  );
}

/** Empty selections are rejected here. Later exhausted-domain effects must opt in with their own policy. */
export function activateTemporaryArcana(
  catalog: Catalog,
  state: ArcanaFearState,
  arcanaKeys: readonly string[],
  evidence: ArcanaFearEvidence,
): ArcanaTransitionAssessment {
  if (!canAppendEvidence(state, evidence)) return rejected(state, 'staleChronology');
  if (arcanaKeys.length === 0) return rejected(state, 'emptyTargetSet');
  if (new Set(arcanaKeys).size !== arcanaKeys.length) return rejected(state, 'duplicateTarget');
  if (arcanaKeys.some((key) => catalog.arcanaCards.byKey[key] === undefined))
    return rejected(state, 'unknownArcana');
  if (arcanaKeys.some((key) => state.arcana.active.some((card) => card.key === key)))
    return rejected(state, 'arcanaAlreadyActive');
  const canonicalKeys = canonicalArcanaSet(catalog, arcanaKeys);
  const active = [
    ...state.arcana.active,
    ...canonicalKeys.map((key) =>
      Object.freeze({ key, origin: 'temporary' as const, rarity: 'Epic' as const }),
    ),
  ].sort(
    (left, right) =>
      catalog.arcanaCards.values.findIndex((card) => card.key === left.key) -
      catalog.arcanaCards.values.findIndex((card) => card.key === right.key),
  );
  return Object.freeze({
    legal: true,
    state: Object.freeze({
      ...state,
      arcana: Object.freeze({ active: Object.freeze(active) }),
      events: Object.freeze([
        ...state.events,
        Object.freeze({
          kind: 'temporaryArcanaActivated' as const,
          arcanaKeys: canonicalKeys,
          ...evidence,
        }),
      ]),
    }),
  });
}
export function promoteArcana(
  catalog: Catalog,
  state: ArcanaFearState,
  arcanaKeys: readonly string[],
  evidence: ArcanaFearEvidence,
): ArcanaTransitionAssessment {
  if (!canAppendEvidence(state, evidence)) return rejected(state, 'staleChronology');
  if (arcanaKeys.length === 0) return rejected(state, 'emptyTargetSet');
  if (new Set(arcanaKeys).size !== arcanaKeys.length) return rejected(state, 'duplicateTarget');
  if (arcanaKeys.some((key) => catalog.arcanaCards.byKey[key] === undefined))
    return rejected(state, 'unknownArcana');
  if (arcanaKeys.some((key) => !state.arcana.active.some((card) => card.key === key)))
    return rejected(state, 'arcanaNotActive');
  if (
    arcanaKeys.some(
      (key) => state.arcana.active.find((card) => card.key === key)?.rarity !== 'Epic',
    )
  )
    return rejected(state, 'arcanaNotEpic');
  const canonicalKeys = canonicalArcanaSet(catalog, arcanaKeys);
  return Object.freeze({
    legal: true,
    state: Object.freeze({
      ...state,
      arcana: Object.freeze({
        active: Object.freeze(
          state.arcana.active.map((candidate) =>
            canonicalKeys.includes(candidate.key)
              ? Object.freeze({ ...candidate, rarity: 'Heroic' as const })
              : candidate,
          ),
        ),
      }),
      events: Object.freeze([
        ...state.events,
        Object.freeze({ kind: 'arcanaPromoted' as const, arcanaKeys: canonicalKeys, ...evidence }),
      ]),
    }),
  });
}
export function suppressFearVow(
  catalog: Catalog,
  state: ArcanaFearState,
  vowKey: string,
  evidence: ArcanaFearEvidence,
): FearTransitionAssessment {
  const vow = catalog.fearVows.byKey[vowKey];
  if (
    vow === undefined ||
    !vow.circeRemovable ||
    state.fear.effectiveRanks[vowKey] === undefined ||
    state.fear.effectiveRanks[vowKey] === 0 ||
    state.fear.disabledVowKeys.includes(vowKey) ||
    !canAppendEvidence(state, evidence)
  )
    return rejected(
      state,
      !canAppendEvidence(state, evidence)
        ? 'staleChronology'
        : vow === undefined
          ? 'unknownVow'
          : !vow.circeRemovable
            ? 'vowNotCirceRemovable'
            : 'vowNotEffectivelyActive',
    );
  const disabledVowKeys = [...state.fear.disabledVowKeys, vowKey].sort(
    (left, right) =>
      catalog.fearVows.values.findIndex((vow) => vow.key === left) -
      catalog.fearVows.values.findIndex((vow) => vow.key === right),
  );
  return Object.freeze({
    legal: true,
    state: Object.freeze({
      ...state,
      fear: Object.freeze({
        ...state.fear,
        disabledVowKeys: Object.freeze(disabledVowKeys),
        effectiveRanks: Object.freeze({ ...state.fear.effectiveRanks, [vowKey]: 0 }),
      }),
      events: Object.freeze([
        ...state.events,
        Object.freeze({ kind: 'fearVowSuppressed' as const, vowKey, ...evidence }),
      ]),
    }),
  });
}

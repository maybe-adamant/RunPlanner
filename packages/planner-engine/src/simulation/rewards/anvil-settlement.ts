import type { Catalog } from '../../catalog-schema';
import type { AuthoredAnvilResult, AuthoredRewardState } from '../../authored-project/model';
import type { ResolvedTraitOfferSource } from '../traits/offer-domain';
import type { SimulationState } from '../state/model';
import { replaceSimulationTraitHistory } from '../state/transitions';
import { assessTraitOption } from '../traits/authoring/assessment';
import type { EquippedTrait } from '../../authored-project/traits/state';

import type { TraitHistoryEvent, TraitHistoryState } from '../traits/history/model';
import type { AcquisitionRoleAddress } from '../../authored-project/addresses';
import type { RewardBranchState } from './branch-primitives';
import { type ResolvedRewardOffer } from '../../reward-kernel';
import { pickupEffectForOffer } from '../../reward-kernel/history';

/** One reason an Anvil result is illegal; `key` is its stable identity and finding code. */
export type AnvilResultIssue =
  | {
      readonly kind:
        | 'resultMissing'
        | 'removedHammerUnavailable'
        | 'exactlyTwoAdditionsRequired'
        | 'additionsMustBeDistinct';
      readonly key: string;
    }
  | { readonly kind: 'additionUnavailable'; readonly key: string; readonly traitKey: string };

export interface AnvilResultAssessment {
  readonly legal: boolean;
  readonly issues: readonly AnvilResultIssue[];
}

function anvilIssue(
  kind: Exclude<AnvilResultIssue['kind'], 'additionUnavailable'>,
): AnvilResultIssue {
  return Object.freeze({ kind, key: kind });
}

function additionUnavailable(traitKey: string): AnvilResultIssue {
  return Object.freeze({
    kind: 'additionUnavailable',
    key: `additionUnavailable:${traitKey}`,
    traitKey,
  });
}

export interface AnvilCandidateCapability {
  /** Exact removal domain; null, removing nothing, only where no permanent Hammer is equipped. */
  readonly removedTraitKeys: readonly (string | null)[];
  readonly addedTraitKeysFor: (
    removedTraitKey: string | null,
    priorAddedTraitKeys: readonly string[],
  ) => readonly string[];
  /** Settlement's assessment of a result at the role's reached state. */
  readonly assess: (result: AuthoredAnvilResult) => AnvilResultAssessment;
}

interface AnvilAcquisitionFrontier {
  readonly address: AcquisitionRoleAddress;
  readonly beforeRole: RewardBranchState | undefined;
  readonly source: {
    readonly offer: ResolvedRewardOffer;
    readonly traitContext?: ResolvedTraitOfferSource | undefined;
    readonly dispositionByAcquisitionRole?: AuthoredRewardState['dispositionByAcquisitionRole'];
  };
}

function hammerKeys(catalog: Catalog, history: TraitHistoryState): readonly string[] {
  return Object.values(history.equippedTraits)
    .filter((trait) => catalog.traits.byKey[trait.traitKey]?.hammerCompatibility !== undefined)
    .map((trait) => trait.traitKey);
}

/** The exact pre-transformation Hammer frontier used by Anvil authoring. */
function anvilHammerCandidates(
  catalog: Catalog,
  history: TraitHistoryState,
  temporaryHammerTraitKeys: ReadonlySet<string> = new Set(),
): readonly string[] {
  return Object.freeze(
    hammerKeys(catalog, history).filter((traitKey) => !temporaryHammerTraitKeys.has(traitKey)),
  );
}

function legalAnvilAdditions(
  catalog: Catalog,
  state: SimulationState,
  source: ResolvedTraitOfferSource,
  temporaryHammerTraitKeys: ReadonlySet<string> = new Set(),
  removedTraitKey: string | null = null,
  preExistingHammerTraitKeys: ReadonlySet<string> = new Set(
    hammerKeys(catalog, state.traitHistory),
  ),
): readonly string[] {
  const excluded = new Set([...preExistingHammerTraitKeys, ...temporaryHammerTraitKeys]);
  if (removedTraitKey !== null) excluded.add(removedTraitKey);
  const weaponUpgrade = catalog.traitGivers.byKey.WeaponUpgrade;
  return Object.freeze(
    (weaponUpgrade?.traitKeys ?? [])
      .filter((traitKey) => !excluded.has(traitKey))
      .filter((traitKey) => assessTraitOption(catalog, traitKey, state, source).legal),
  );
}

function historyAfterRemovingHammer(
  history: TraitHistoryState,
  removedTraitKey: string | null,
): TraitHistoryState {
  if (removedTraitKey === null) return history;
  const equippedTraits = { ...history.equippedTraits };
  delete equippedTraits[removedTraitKey];
  const equippedSlots = Object.fromEntries(
    Object.entries(history.equippedSlots).filter(
      ([, equipped]) => equipped.traitKey !== removedTraitKey,
    ),
  );
  return Object.freeze({
    ...history,
    equippedTraits: Object.freeze(equippedTraits),
    equippedSlots: Object.freeze(equippedSlots),
  });
}

function anvilAdditionCandidates(
  catalog: Catalog,
  state: SimulationState,
  source: ResolvedTraitOfferSource,
  temporaryHammerTraitKeys: ReadonlySet<string> = new Set(),
  removedTraitKey: string | null = null,
  priorAddedTraitKeys: readonly string[] = [],
): readonly string[] {
  const history = state.traitHistory;
  const preExistingHammerTraitKeys = new Set(hammerKeys(catalog, history));
  let preview = historyAfterRemovingHammer(history, removedTraitKey);
  for (const traitKey of priorAddedTraitKeys) {
    const eligible = legalAnvilAdditions(
      catalog,
      replaceSimulationTraitHistory(state, preview),
      source,
      temporaryHammerTraitKeys,
      removedTraitKey,
      preExistingHammerTraitKeys,
    );
    if (!eligible.includes(traitKey)) return Object.freeze([]);
    preview = historyAfterAddingHammer(catalog, preview, traitKey);
  }
  return legalAnvilAdditions(
    catalog,
    replaceSimulationTraitHistory(state, preview),
    source,
    temporaryHammerTraitKeys,
    removedTraitKey,
    preExistingHammerTraitKeys,
  );
}

function historyAfterAddingHammer(
  catalog: Catalog,
  history: TraitHistoryState,
  traitKey: string,
): TraitHistoryState {
  const trait = catalog.traits.byKey[traitKey];
  const giver = catalog.traitGivers.byKey.WeaponUpgrade;
  if (trait === undefined || giver === undefined) return history;
  const equipped: EquippedTrait = Object.freeze({
    traitKey,
    giverKey: giver.key,
    providerKind: giver.providerKind,
    ...(trait.rarityDomain.kind === 'ranked'
      ? { rarity: trait.rarityDomain.equippedRarities[0] }
      : {}),
    hammerRank: 'RankI' as const,
    sourceRole: 'anvilOfFates',
    acquisitionIdentity: `anvil-preview:${traitKey}`,
  });
  return Object.freeze({
    ...history,
    equippedTraits: Object.freeze({ ...history.equippedTraits, [traitKey]: equipped }),
  });
}

export function assessAnvilResult(
  catalog: Catalog,
  state: SimulationState,
  result: AuthoredAnvilResult | null | undefined,
  source: ResolvedTraitOfferSource,
  temporaryHammerTraitKeys: ReadonlySet<string> = new Set(),
): AnvilResultAssessment {
  const removableTraitKeys = anvilHammerCandidates(
    catalog,
    state.traitHistory,
    temporaryHammerTraitKeys,
  );
  const issues: AnvilResultIssue[] = [];
  if (result === undefined || result === null) issues.push(anvilIssue('resultMissing'));
  const removed = result?.removedTraitKey ?? null;
  if (
    removableTraitKeys.length === 0
      ? removed !== null
      : removed === null || !removableTraitKeys.includes(removed)
  ) {
    issues.push(anvilIssue('removedHammerUnavailable'));
  }
  const firstAddedTraitKeys = anvilAdditionCandidates(
    catalog,
    state,
    source,
    temporaryHammerTraitKeys,
    removed,
    [],
  );
  const additions = result?.addedTraitKeys ?? [];
  if (additions.length !== 2) issues.push(anvilIssue('exactlyTwoAdditionsRequired'));
  if (additions.length === 2 && additions[0] === additions[1])
    issues.push(anvilIssue('additionsMustBeDistinct'));
  const first = additions[0];
  if (first !== undefined && !firstAddedTraitKeys.includes(first)) {
    issues.push(additionUnavailable(first));
  }
  const secondAddedTraitKeys = anvilAdditionCandidates(
    catalog,
    state,
    source,
    temporaryHammerTraitKeys,
    removed,
    first === undefined ? [] : [first],
  );
  const second = additions[1];
  if (second !== undefined && !secondAddedTraitKeys.includes(second)) {
    issues.push(additionUnavailable(second));
  }
  return Object.freeze({
    legal: issues.length === 0,
    issues: Object.freeze(issues),
  });
}

/** Adapts the existing acquisition frontier into the three sequential Anvil pickers. */
export function createAnvilCandidateCapability(
  catalog: Catalog,
  frontier: AnvilAcquisitionFrontier,
): AnvilCandidateCapability | undefined {
  const pickupEffect = pickupEffectForOffer(catalog.rewards, frontier.source.offer);
  // A converted pickup is never collected, so its Anvil result does not apply.
  const disposition =
    frontier.source.dispositionByAcquisitionRole?.[frontier.address.acquisitionRole]?.kind ??
    'normal';
  const branch = frontier.beforeRole;
  if (
    branch === undefined ||
    pickupEffect?.role !== frontier.address.acquisitionRole ||
    pickupEffect.effect.kind !== 'anvilOfFates' ||
    disposition !== 'normal'
  )
    return undefined;
  const { state } = branch;
  const source = frontier.source.traitContext ?? Object.freeze({});
  const temporaryHammerTraitKeys = new Set(
    state.keepsakes.experimentalHammers
      .filter((hammer) => hammer.active)
      .map((hammer) => hammer.traitKey),
  );
  const removable = anvilHammerCandidates(catalog, state.traitHistory, temporaryHammerTraitKeys);
  return Object.freeze({
    removedTraitKeys: removable.length === 0 ? Object.freeze([null]) : removable,
    addedTraitKeysFor: (removedTraitKey: string | null, priorAddedTraitKeys: readonly string[]) =>
      anvilAdditionCandidates(
        catalog,
        state,
        source,
        temporaryHammerTraitKeys,
        removedTraitKey,
        priorAddedTraitKeys,
      ),
    assess: (result: AuthoredAnvilResult) =>
      assessAnvilResult(catalog, state, result, source, temporaryHammerTraitKeys),
  });
}

export function anvilTransformationEvent(
  owner: TraitHistoryEvent['owner'],
  acquisitionRole: string,
  sequence: number,
  acquisitionPoint: string,
  result: AuthoredAnvilResult,
): Extract<TraitHistoryEvent, { kind: 'anvilTransformation' }> {
  return Object.freeze({
    kind: 'anvilTransformation' as const,
    owner,
    acquisitionRole,
    sequence,
    acquisitionPoint,
    removedTraitKey: result.removedTraitKey,
    addedTraitKeys: result.addedTraitKeys,
  });
}

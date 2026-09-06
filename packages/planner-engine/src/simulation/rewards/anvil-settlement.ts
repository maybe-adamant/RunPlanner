import type { Catalog } from '../../catalog-schema';
import type { AuthoredAnvilResult } from '../../authored-project/model';
import type { TraitOfferContext } from '../trait-offers';
import { assessTraitOption } from '../trait-authoring-policies';
import type { EquippedTrait } from '../../authored-project/traits';
import {
  createTraitHistoryState,
  type TraitHistoryState,
  type TraitHistoryEvent,
} from '../trait-history';
import type { AcquisitionRoleAddress } from '../../authored-project/addresses';
import type { RewardBranchState } from './branch-primitives';
import { pickupEffectForOffer, type ResolvedRewardOffer } from '../../reward-kernel';

export interface AnvilResultAssessment {
  readonly legal: boolean;
  readonly findings: readonly string[];
}

export interface AnvilCandidateCapability {
  readonly removableTraitKeys: readonly string[];
  readonly addedTraitKeysFor: (
    removedTraitKey: string | null,
    priorAddedTraitKeys: readonly string[],
  ) => readonly string[];
}

interface AnvilAcquisitionFrontier {
  readonly address: AcquisitionRoleAddress;
  readonly branchesBeforeRole: readonly RewardBranchState[];
  readonly source: {
    readonly offer: ResolvedRewardOffer;
    readonly traitContext?: TraitOfferContext | undefined;
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
  history: TraitHistoryState,
  context: TraitOfferContext,
  temporaryHammerTraitKeys: ReadonlySet<string> = new Set(),
  removedTraitKey: string | null = null,
  preExistingHammerTraitKeys: ReadonlySet<string> = new Set(hammerKeys(catalog, history)),
): readonly string[] {
  const excluded = new Set([...preExistingHammerTraitKeys, ...temporaryHammerTraitKeys]);
  if (removedTraitKey !== null) excluded.add(removedTraitKey);
  const weaponUpgrade = catalog.traitGivers.byKey.WeaponUpgrade;
  return Object.freeze(
    (weaponUpgrade?.traitKeys ?? [])
      .filter((traitKey) => !excluded.has(traitKey))
      .filter((traitKey) => assessTraitOption(catalog, traitKey, history, context).legal),
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
  history: TraitHistoryState,
  context: TraitOfferContext,
  temporaryHammerTraitKeys: ReadonlySet<string> = new Set(),
  removedTraitKey: string | null = null,
  priorAddedTraitKeys: readonly string[] = [],
): readonly string[] {
  const preExistingHammerTraitKeys = new Set(hammerKeys(catalog, history));
  let preview = historyAfterRemovingHammer(history, removedTraitKey);
  for (const traitKey of priorAddedTraitKeys) {
    const eligible = legalAnvilAdditions(
      catalog,
      preview,
      context,
      temporaryHammerTraitKeys,
      removedTraitKey,
      preExistingHammerTraitKeys,
    );
    if (!eligible.includes(traitKey)) return Object.freeze([]);
    preview = historyAfterAddingHammer(catalog, preview, traitKey);
  }
  return legalAnvilAdditions(
    catalog,
    preview,
    context,
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
  history: TraitHistoryState,
  result: AuthoredAnvilResult | null | undefined,
  context: TraitOfferContext,
  temporaryHammerTraitKeys: ReadonlySet<string> = new Set(),
): AnvilResultAssessment {
  const removableTraitKeys = anvilHammerCandidates(catalog, history, temporaryHammerTraitKeys);
  const findings: string[] = [];
  if (result === undefined || result === null) findings.push('resultMissing');
  const removed = result?.removedTraitKey ?? null;
  if (
    removableTraitKeys.length === 0
      ? removed !== null
      : removed === null || !removableTraitKeys.includes(removed)
  ) {
    findings.push('removedHammerUnavailable');
  }
  const firstAddedTraitKeys = anvilAdditionCandidates(
    catalog,
    history,
    context,
    temporaryHammerTraitKeys,
    removed,
    [],
  );
  const additions = result?.addedTraitKeys ?? [];
  if (additions.length !== 2) findings.push('exactlyTwoAdditionsRequired');
  if (additions.length === 2 && additions[0] === additions[1])
    findings.push('additionsMustBeDistinct');
  const first = additions[0];
  if (first !== undefined && !firstAddedTraitKeys.includes(first)) {
    findings.push(`additionUnavailable:${first}`);
  }
  const secondAddedTraitKeys = anvilAdditionCandidates(
    catalog,
    history,
    context,
    temporaryHammerTraitKeys,
    removed,
    first === undefined ? [] : [first],
  );
  const second = additions[1];
  if (second !== undefined && !secondAddedTraitKeys.includes(second)) {
    findings.push(`additionUnavailable:${second}`);
  }
  return Object.freeze({
    legal: findings.length === 0,
    findings: Object.freeze(findings),
  });
}

/** Adapts the existing acquisition frontier into the three sequential Anvil pickers. */
export function createAnvilCandidateCapability(
  catalog: Catalog,
  entries: readonly AnvilAcquisitionFrontier[],
): AnvilCandidateCapability | undefined {
  const frontiers = entries
    .filter((entry) => {
      const pickupEffect = pickupEffectForOffer(catalog.rewards, entry.source.offer);
      return (
        pickupEffect?.role === entry.address.acquisitionRole &&
        pickupEffect.effect.kind === 'anvilOfFates'
      );
    })
    .flatMap((entry) =>
      entry.branchesBeforeRole.map((branch) =>
        Object.freeze({
          history: branch.traitHistory ?? createTraitHistoryState(),
          context: entry.source.traitContext ?? Object.freeze({}),
          temporaryHammerTraitKeys: new Set(
            branch.keepsakes.experimentalHammers
              .filter((hammer) => hammer.active)
              .map((hammer) => hammer.traitKey),
          ),
        }),
      ),
    );
  if (frontiers.length === 0) return undefined;
  const intersect = (domains: readonly (readonly string[])[]): readonly string[] =>
    Object.freeze(
      (domains[0] ?? []).filter((traitKey) => domains.every((domain) => domain.includes(traitKey))),
    );
  const removableTraitKeys = intersect(
    frontiers.map(({ history, temporaryHammerTraitKeys }) =>
      anvilHammerCandidates(catalog, history, temporaryHammerTraitKeys),
    ),
  );
  const addedTraitKeysFor = (
    removedTraitKey: string | null,
    priorAddedTraitKeys: readonly string[],
  ) =>
    intersect(
      frontiers.map(({ history, context, temporaryHammerTraitKeys }) =>
        anvilAdditionCandidates(
          catalog,
          history,
          context,
          temporaryHammerTraitKeys,
          removedTraitKey,
          priorAddedTraitKeys,
        ),
      ),
    );
  return Object.freeze({
    removableTraitKeys,
    addedTraitKeysFor,
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

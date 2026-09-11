import type { Catalog, TraitSelectedDisposition } from '../../../catalog-schema';
import type { SemanticAddress } from '../../../authored-project/addresses';
import {
  activateTemporaryArcana,
  circeResolutionDomain,
  promoteArcana,
  suppressFearVow,
} from '../../arcana-fear';
import { refreshKeepsakeFatedStatus } from '../../keepsakes/state';
import { attachTraitHistory, foldTraitHistoryEvents, type TraitHistoryState } from '../../traits';
import type { RewardBranchState } from '../branch-primitives';
import {
  optionIndex,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredTraitOfferTraits,
} from '../../../authored-project/traits';
import { echoLastRunBoonOutcomes } from '../../traits';
import type { EchoLastRunBoonOutcome } from '../../traits/offer-domain';

type EchoBoonChildAssessment =
  | { readonly kind: 'rejected'; readonly rejection: EncounterChildRejection }
  | {
      readonly kind: 'acquisition';
      readonly offer: AuthoredTraitOfferTraits;
      readonly outcome: EchoLastRunBoonOutcome;
      readonly lootHistorySource?: string;
    };

/** Validates Echo's authored rows against the pre-choice history and prepares the selected acquisition. */
export function assessEchoBoonChild(
  catalog: Catalog,
  history: TraitHistoryState,
  child: AuthoredEchoLastRunBoonOffer | undefined,
): EchoBoonChildAssessment {
  const reject = (
    code: EncounterChildRejection['code'],
    detail?: string,
  ): EchoBoonChildAssessment =>
    Object.freeze({
      kind: 'rejected',
      rejection: Object.freeze({ code, ...(detail === undefined ? {} : { detail }) }),
    });
  if (child === undefined) return reject('echoLastRunBoonMissing');
  const selectedChildIndex = optionIndex(child.selectedOptionKey);
  const selectedChild = child.options[selectedChildIndex];
  if (selectedChild === undefined) return reject('echoLastRunBoonMissing');
  const outcomes = echoLastRunBoonOutcomes(catalog, history);
  let outcome: EchoLastRunBoonOutcome | undefined;
  for (const [index, childOption] of child.options.entries()) {
    const rowOutcome = outcomes.find(
      (candidate) =>
        candidate.option.giverKey === childOption.giverKey &&
        candidate.option.traitKey === childOption.traitKey &&
        candidate.option.rarity === childOption.rarity,
    );
    if (rowOutcome === undefined || !rowOutcome.assessment.legal)
      return reject(
        'echoLastRunBoonOptionUnavailable',
        `${childOption.giverKey}:${childOption.traitKey}:${childOption.rarity}`,
      );
    if (index === selectedChildIndex) {
      const targetedAcquisition = catalog.traits.byKey[childOption.traitKey]?.targetedAcquisition;
      if (targetedAcquisition !== undefined) {
        if (childOption.targetTraitKey === undefined)
          return reject('targetedAcquisitionTargetMissing', childOption.traitKey);
        if (!rowOutcome.targetTraitKeys.includes(childOption.targetTraitKey))
          return reject('targetedAcquisitionTargetUnavailable', childOption.targetTraitKey);
      } else if (childOption.targetTraitKey !== undefined) {
        return reject('targetedAcquisitionTargetUnavailable', childOption.targetTraitKey);
      }
      outcome = rowOutcome;
    }
  }
  if (outcome === undefined) return reject('echoLastRunBoonMissing');
  const offer: AuthoredTraitOfferTraits = Object.freeze({
    kind: 'traits',
    giverKey: selectedChild.giverKey,
    options: Object.freeze([
      Object.freeze({
        traitKey: selectedChild.traitKey,
        rarity: outcome.effectiveRarity,
        ...(selectedChild.targetTraitKey === undefined
          ? {}
          : { targetTraitKey: selectedChild.targetTraitKey }),
        ...(selectedChild.allTogetherResult === undefined
          ? {}
          : { allTogetherResult: selectedChild.allTogetherResult }),
        ...(selectedChild.naturalSelectionTargets === undefined
          ? {}
          : { naturalSelectionTargets: selectedChild.naturalSelectionTargets }),
      }),
    ]) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
    rarificationActions: Object.freeze([]),
  });
  const lootHistorySource =
    catalog.echoLastRunBoon.variants.byKey[`${selectedChild.giverKey}:${selectedChild.traitKey}`]
      ?.lootHistorySource;
  return Object.freeze({
    kind: 'acquisition',
    offer,
    outcome,
    ...(lootHistorySource === undefined ? {} : { lootHistorySource }),
  });
}

export interface EncounterChildRejection {
  readonly code: import('../../model').TraitFindingCode;
  readonly detail?: string;
}

/** Assesses Circe's concrete child at the post-outer/pre-effect repair boundary. */
export function assessCirceChild(
  catalog: Catalog,
  branch: RewardBranchState,
  disposition: Extract<TraitSelectedDisposition, { readonly kind: 'circe' }>,
  resolution: import('../../../authored-project/traits').AuthoredCirceResolution | undefined,
): EncounterChildRejection | undefined {
  const domain = circeResolutionDomain(
    catalog,
    branch.arcanaFear,
    disposition.effect,
    branch.keepsakes.fatedStatus,
  );
  if (disposition.effect === 'activateArcana') {
    if (resolution?.kind !== 'activateArcana')
      return Object.freeze({ code: 'circeResolutionMissing' });
    if (resolution.arcanaKeys.length !== domain.requiredCount)
      return Object.freeze({
        code: 'circeResolutionWrongCardinality',
        detail: `${domain.requiredCount}:${resolution.arcanaKeys.length}`,
      });
    return resolution.arcanaKeys.some((key) => !domain.arcanaKeys.includes(key))
      ? Object.freeze({ code: 'circeResolutionTargetUnavailable' })
      : undefined;
  }
  if (disposition.effect === 'promoteArcana') {
    if (resolution?.kind !== 'promoteArcana')
      return Object.freeze({ code: 'circeResolutionMissing' });
    if (resolution.arcanaKeys.length !== domain.requiredCount)
      return Object.freeze({
        code: 'circeResolutionWrongCardinality',
        detail: `${domain.requiredCount}:${resolution.arcanaKeys.length}`,
      });
    return resolution.arcanaKeys.some((key) => !domain.arcanaKeys.includes(key))
      ? Object.freeze({ code: 'circeResolutionTargetUnavailable' })
      : undefined;
  }
  if (!domain.outerAvailable) return Object.freeze({ code: 'circeOptionUnavailable' });
  if (resolution?.kind !== 'disableFear' || resolution.vowKey === null)
    return Object.freeze({ code: 'circeResolutionMissing' });
  return domain.vowKeys.includes(resolution.vowKey)
    ? undefined
    : Object.freeze({ code: 'circeResolutionTargetUnavailable' });
}

/** Applies a previously validated Circe child after its outer acquisition has reached the repair boundary. */
export function settleValidatedCirceChild(
  catalog: Catalog,
  branch: RewardBranchState,
  disposition: Extract<TraitSelectedDisposition, { readonly kind: 'circe' }>,
  resolution: import('../../../authored-project/traits').AuthoredCirceResolution | undefined,
  owner: SemanticAddress,
  sequence: number,
): RewardBranchState {
  const evidence = { owner, sequence };
  if (disposition.effect === 'activateArcana') {
    const domain = circeResolutionDomain(
      catalog,
      branch.arcanaFear,
      disposition.effect,
      branch.keepsakes.fatedStatus,
    );
    if (
      resolution?.kind !== 'activateArcana' ||
      resolution.arcanaKeys.length !== domain.requiredCount ||
      resolution.arcanaKeys.length === 0
    )
      return branch;
    const outcome = activateTemporaryArcana(
      catalog,
      branch.arcanaFear,
      resolution.arcanaKeys,
      evidence,
    );
    return outcome.legal
      ? Object.freeze({
          ...branch,
          arcanaFear: outcome.state,
          keepsakes: refreshKeepsakeFatedStatus(catalog, branch.keepsakes, outcome.state),
        })
      : branch;
  }
  if (disposition.effect === 'promoteArcana') {
    const domain = circeResolutionDomain(
      catalog,
      branch.arcanaFear,
      disposition.effect,
      branch.keepsakes.fatedStatus,
    );
    if (
      resolution?.kind !== 'promoteArcana' ||
      resolution.arcanaKeys.length !== domain.requiredCount
    )
      return branch;
    const outcome = promoteArcana(catalog, branch.arcanaFear, resolution.arcanaKeys, evidence);
    return outcome.legal
      ? Object.freeze({
          ...branch,
          arcanaFear: outcome.state,
          keepsakes: refreshKeepsakeFatedStatus(catalog, branch.keepsakes, outcome.state),
        })
      : branch;
  }
  if (resolution?.kind !== 'disableFear' || resolution.vowKey === null) return branch;
  const outcome = suppressFearVow(catalog, branch.arcanaFear, resolution.vowKey, evidence);
  return outcome.legal ? Object.freeze({ ...branch, arcanaFear: outcome.state }) : branch;
}

/** Echo's Pom child is evaluated against the exact pre-choice target history. */
export function settleEchoPomChild(
  catalog: Catalog,
  branch: RewardBranchState,
  appliedTraitHistory: TraitHistoryState,
  before: TraitHistoryState,
  owner: SemanticAddress,
  acquisitionRole: string,
  sequence: number,
  lifecyclePoint: string,
  sourceTraitKey: string,
  target: string,
): RewardBranchState | undefined {
  const equipped = before.equippedTraits[target];
  if (equipped?.level === undefined) return undefined;
  const traitHistory = foldTraitHistoryEvents(catalog, [
    ...appliedTraitHistory.events,
    Object.freeze({
      kind: 'levelMutation' as const,
      owner,
      acquisitionRole,
      sequence,
      acquisitionPoint: lifecyclePoint,
      sourceTraitKey,
      targetTraitKey: target,
      oldLevel: equipped.level,
      newLevel: equipped.level * 2,
    }),
  ]);
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, traitHistory),
    traitHistory,
  });
}

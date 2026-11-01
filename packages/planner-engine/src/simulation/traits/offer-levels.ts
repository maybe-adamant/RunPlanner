import type { Catalog } from '../../catalog-schema';
import type { AuthoredTraitOption } from '../../authored-project/traits/state';
import type { SimulationState } from '../state/model';
import { aspectIsPerfect } from './equipment-upgrades';
import { isLevelBearingTrait } from './history/upgrades';
import type {
  TraitAssessment,
  TraitAssessmentFinding,
  TraitOfferSourceContext,
} from './offer-domain';

export interface PersephoneLevelRoll {
  /** Stable authored encoding: zero is native zero; positive values encode roll minus one. */
  readonly levelBonus: number;
  readonly roll: number;
  /** Final installed level this roll yields for the option's base level. */
  readonly level: number;
}

function persephoneRollFromLevelBonus(levelBonus: number): number {
  return levelBonus === 0 ? 0 : levelBonus + 1;
}

/** Jeweled Pom adds its levels on top of the roll plus one; a bare roll floors at level 1. */
function levelFromPersephoneRoll(roll: number, pomLevels: number): number {
  return pomLevels > 0 ? roll + pomLevels + 1 : Math.max(1, roll);
}

/**
 * Native outcomes paired with the existing authored encoding, not probability
 * weights. `baseLevel` is the option's published `persephoneBaseLevel`.
 */
export function persephoneLevelRolls(
  maximumBonus: number,
  baseLevel: number,
): readonly PersephoneLevelRoll[] {
  // The roll-zero level is 1 without Jeweled Pom and 1 + its levels with it.
  const pomLevels = baseLevel - 1;
  return Object.freeze(
    Array.from({ length: maximumBonus + 1 }, (_, levelBonus) => {
      const roll = persephoneRollFromLevelBonus(levelBonus);
      return Object.freeze({ levelBonus, roll, level: levelFromPersephoneRoll(roll, pomLevels) });
    }),
  );
}

export interface TraitOfferOptionLevelResolution {
  /** The active authored Persephone contribution domain, when applicable. */
  readonly persephoneLevelBonusMaximum?: number;
  /** Installed level at Persephone roll zero; present with the maximum. */
  readonly persephoneBaseLevel?: number;
  /** Final installed level for a level-bearing option, when one exists. */
  readonly effectiveLevel?: number;
  /** Levels Jeweled Pom adds to a fresh level-bearing row; omitted when it adds none. */
  readonly jeweledPomLevels?: number;
  readonly findings: readonly TraitAssessmentFinding[];
}

export interface TraitOfferOptionLevelResolutionInput {
  readonly catalog: Catalog;
  /** Exact pre-offer snapshot: selected effects on this screen are not included. */
  readonly state: SimulationState;
  readonly source: TraitOfferSourceContext;
  readonly option: AuthoredTraitOption;
  readonly assessment?: TraitAssessment;
}

/**
 * Resolves one frozen trait row's starting/effective level. This is the single
 * arithmetic authority shared by candidate projection and selected settlement.
 * Replacement precedence is intentionally checked before every fresh-offer
 * contribution, matching the source's TraitToReplace path.
 */
export function resolveTraitOfferOptionLevel(
  input: TraitOfferOptionLevelResolutionInput,
): TraitOfferOptionLevelResolution {
  const { catalog, state, source, option, assessment } = input;
  const before = state.traitHistory;
  const keepsakes = state.keepsakes;
  const replacement = assessment?.replacementTransition;
  if (replacement !== undefined) {
    const replaced = before.equippedTraits[replacement.replacedTraitKey];
    return Object.freeze({
      ...(replaced?.level === undefined
        ? {}
        : { effectiveLevel: replaced.level + (replacement.levelBonus ?? 0) }),
      findings: Object.freeze([]),
    });
  }

  if (!isLevelBearingTrait(catalog, option.traitKey))
    return Object.freeze({ findings: Object.freeze([]) });

  const aspectEffect =
    state.equipment.aspectKey === null
      ? undefined
      : catalog.aspects.byKey[state.equipment.aspectKey]?.traitOfferLevelBonus;
  const pomLevels =
    source.stackBoostsSuppressed === true
      ? 0
      : keepsakes.jeweledPom?.active === true
        ? keepsakes.jeweledPom.levels
        : 0;
  if (aspectEffect !== undefined && source.stackBoostsSuppressed !== true) {
    const maximum = aspectIsPerfect(catalog, before)
      ? aspectEffect.upgradedMaximumBonus
      : aspectEffect.maximumBonus;
    const persephoneBaseLevel = levelFromPersephoneRoll(0, pomLevels);
    const pomContribution = pomLevels > 0 ? { jeweledPomLevels: pomLevels } : {};
    const bonus = option.persephoneLevelBonus ?? 0;
    if (!Number.isInteger(bonus) || bonus < 0 || bonus > maximum) {
      return Object.freeze({
        persephoneLevelBonusMaximum: maximum,
        persephoneBaseLevel,
        ...pomContribution,
        findings: Object.freeze([
          {
            code: 'persephoneLevelBonusUnavailable' as const,
            traitKey: option.traitKey,
            detail: `received ${String(bonus)}, expected 0 to ${maximum}`,
          },
        ]),
      });
    }
    return Object.freeze({
      persephoneLevelBonusMaximum: maximum,
      persephoneBaseLevel,
      effectiveLevel: levelFromPersephoneRoll(persephoneRollFromLevelBonus(bonus), pomLevels),
      ...pomContribution,
      findings: Object.freeze([]),
    });
  }
  return Object.freeze({
    effectiveLevel: 1 + pomLevels,
    ...(pomLevels > 0 ? { jeweledPomLevels: pomLevels } : {}),
    findings: Object.freeze([]),
  });
}

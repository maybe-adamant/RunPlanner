import type {
  Catalog,
  ChallengeSwitchHostDeclaration,
  ChallengeSwitchKindDeclaration,
  ChallengeSwitchVariantDeclaration,
  EncounterCustomizationDecision,
} from '../../catalog-schema';
import type {
  AuthoredChallengeSwitch,
  AuthoredEncounterCustomization,
  ChallengeSwitchOutcome,
} from '../model';
import { customizationValueKnown } from '../room-state/encounter-customization';

/** The occurrence-local site holding the pickups a switch's claim spawns. */
export const CHALLENGE_SWITCH_SITE_KEY = 'challengeSwitch';
/** The claim's reward: the variant's reward, the Onion after a PerfectClear hit, or Time gold. */
export const CHALLENGE_SWITCH_REWARD_ENTRY_KEY = 'reward';
/** A claim's bonus Nectar, dropped only when no damage was taken. */
export const CHALLENGE_SWITCH_NECTAR_ENTRY_KEY = 'nectar';

export const CHALLENGE_SWITCH_ACTION = Object.freeze({ kind: 'interactChallengeSwitch' as const });

export function challengeSwitchHost(
  catalog: Catalog,
  gameName: string,
): ChallengeSwitchHostDeclaration | undefined {
  return catalog.challengeSwitches.hosts.byKey[gameName];
}

export interface ResolvedChallengeSwitch {
  readonly variant: ChallengeSwitchVariantDeclaration;
  readonly kind: ChallengeSwitchKindDeclaration;
}

export function resolveChallengeSwitch(
  catalog: Catalog,
  variantKey: string,
): ResolvedChallengeSwitch | undefined {
  const variant = catalog.challengeSwitches.variants.byKey[variantKey];
  const kind =
    variant === undefined ? undefined : catalog.challengeSwitches.kinds.byKey[variant.switchKind];
  return variant === undefined || kind === undefined ? undefined : Object.freeze({ variant, kind });
}

/**
 * The outcomes a kind's fight can end with: a kind whose hit changes its
 * reward (PerfectClear) ends hitless or failed, the others finished; any
 * pressed fight may be left.
 */
export function challengeSwitchOutcomes(
  kind: ChallengeSwitchKindDeclaration,
): readonly ChallengeSwitchOutcome[] {
  return kind.hitRewardType === undefined
    ? Object.freeze(['left', 'finished'] as const)
    : Object.freeze(['left', 'hitless', 'failed'] as const);
}

/** The outcome a newly observed switch starts from: the claim of a clean fight. */
function defaultOutcome(kind: ChallengeSwitchKindDeclaration): ChallengeSwitchOutcome {
  return kind.hitRewardType === undefined ? 'finished' : 'hitless';
}

/** Whether the fight ended so the claim can drop the bonus Nectar (`HandleChallengeLoot`). */
export function challengeSwitchOutcomeDropsNectar(outcome: ChallengeSwitchOutcome): boolean {
  return outcome === 'finished' || outcome === 'hitless';
}

/**
 * The outcome a variant change keeps: the same one where the new kind has it,
 * else the new kind's default; Nectar and gold follow it.
 */
export function challengeSwitchOutcomeForVariant(
  catalog: Catalog,
  current: AuthoredChallengeSwitch,
  variantKey: string,
): Pick<AuthoredChallengeSwitch, 'outcome' | 'nectarDropped' | 'gold'> | undefined {
  const resolved = resolveChallengeSwitch(catalog, variantKey);
  if (resolved === undefined) return undefined;
  const outcome = challengeSwitchOutcomes(resolved.kind).includes(current.outcome)
    ? current.outcome
    : defaultOutcome(resolved.kind);
  return Object.freeze({
    outcome,
    nectarDropped: current.nectarDropped && challengeSwitchOutcomeDropsNectar(outcome),
    ...(resolved.kind.goldReward && outcome === 'finished'
      ? { gold: current.gold ?? catalog.challengeSwitches.gold.defaultValue }
      : {}),
  });
}

/** A newly observed switch of one variant, with the declaration's claim defaults. */
export function defaultChallengeSwitch(
  catalog: Catalog,
  variantKey: string,
): AuthoredChallengeSwitch | undefined {
  const resolved = resolveChallengeSwitch(catalog, variantKey);
  if (resolved === undefined) return undefined;
  return Object.freeze({
    variantKey,
    outcome: defaultOutcome(resolved.kind),
    nectarDropped: false,
    ...(resolved.kind.goldReward ? { gold: catalog.challengeSwitches.gold.defaultValue } : {}),
  });
}

/** The reward and bonus pickups one claim spawns, by entry key. */
export function challengeSwitchClaimPickups(
  catalog: Catalog,
  challengeSwitch: AuthoredChallengeSwitch,
): readonly { readonly key: string; readonly rewardType: string }[] {
  const resolved = resolveChallengeSwitch(catalog, challengeSwitch.variantKey);
  if (resolved === undefined) return Object.freeze([]);
  // A left fight ends early: native never re-arms the switch for a claim.
  if (challengeSwitch.outcome === 'left') return Object.freeze([]);
  const reward =
    challengeSwitch.outcome === 'failed' && resolved.kind.hitRewardType !== undefined
      ? resolved.kind.hitRewardType
      : resolved.variant.rewardType;
  return Object.freeze([
    Object.freeze({ key: CHALLENGE_SWITCH_REWARD_ENTRY_KEY, rewardType: reward }),
    ...(challengeSwitchOutcomeDropsNectar(challengeSwitch.outcome) && challengeSwitch.nectarDropped
      ? [
          Object.freeze({
            key: CHALLENGE_SWITCH_NECTAR_ENTRY_KEY,
            rewardType: catalog.challengeSwitches.bonusReward.rewardType,
          }),
        ]
      : []),
  ]);
}

/**
 * Why a claim outcome cannot be authored: the outcome must be one the kind's
 * fight can end with, the bonus Nectar needs a claim with no damage taken, and
 * only a finished Time switch claims gold, within its decay range.
 */
export function challengeSwitchShapeIssue(
  catalog: Catalog,
  challengeSwitch: AuthoredChallengeSwitch,
): string | undefined {
  const resolved = resolveChallengeSwitch(catalog, challengeSwitch.variantKey);
  if (resolved === undefined) return `unknown challenge switch ${challengeSwitch.variantKey}`;
  if (!challengeSwitchOutcomes(resolved.kind).includes(challengeSwitch.outcome))
    return `${resolved.kind.key} switches cannot end ${challengeSwitch.outcome}`;
  if (challengeSwitch.nectarDropped && !challengeSwitchOutcomeDropsNectar(challengeSwitch.outcome))
    return 'the bonus Nectar drops only on a claim with no damage taken';
  const gold = catalog.challengeSwitches.gold;
  if (resolved.kind.goldReward && challengeSwitch.outcome === 'finished') {
    if (
      challengeSwitch.gold === undefined ||
      !Number.isInteger(challengeSwitch.gold) ||
      challengeSwitch.gold < gold.minimumValue ||
      challengeSwitch.gold > gold.startingValue
    )
      return `gold must be an integer from ${gold.minimumValue} through ${gold.startingValue}`;
  } else if (challengeSwitch.gold !== undefined) return 'only a finished Time switch claims gold';
  const elite = challengeSwitch.elite;
  if (elite !== undefined) {
    if (resolved.kind.key !== 'elite') return 'only an Elite switch pins its elite';
    if (elite.enemyKey.trim().length === 0) return 'the elite needs an enemy';
    if (new Set(elite.attributeKeys).size !== elite.attributeKeys.length)
      return 'the elite repeats an attribute';
    const counts = catalog.challengeSwitches.eliteEncounters.values.map(
      (encounter) => encounter.attributeCount,
    );
    if (elite.attributeKeys.length > Math.max(0, ...counts))
      return 'the elite has more attributes than any Elite switch draws';
  }
  return undefined;
}

/** The encounter an observed switch's kind fields at its host. */
export function challengeSwitchEncounterKey(
  catalog: Catalog,
  gameName: string,
  variantKey: string,
): string | undefined {
  const variant = catalog.challengeSwitches.variants.byKey[variantKey];
  const host = challengeSwitchHost(catalog, gameName);
  return variant === undefined || host === undefined
    ? undefined
    : host.encounterKeyBySwitchKind[variant.switchKind];
}

/** The customization decisions that encounter declares; none for an Elite switch. */
export function challengeSwitchCustomizationDecisions(
  catalog: Catalog,
  gameName: string,
  variantKey: string,
): readonly EncounterCustomizationDecision[] {
  const key = challengeSwitchEncounterKey(catalog, gameName, variantKey);
  return (
    (key === undefined ? undefined : catalog.encounterDefinitions.byKey[key]?.customization) ?? []
  );
}

/** Why one switch encounter decision value cannot be authored at this host. */
export function challengeSwitchCustomizationIssue(
  catalog: Catalog,
  gameName: string,
  variantKey: string,
  decisionKey: string,
  value: AuthoredEncounterCustomization,
): string | undefined {
  const decisions = challengeSwitchCustomizationDecisions(catalog, gameName, variantKey);
  if (!decisions.some((decision) => decision.key === decisionKey))
    return `${decisionKey} is not a declared decision of this switch's encounter`;
  if (!customizationValueKnown(decisions, decisionKey, value))
    return `${decisionKey} is outside its declaration domain`;
  return undefined;
}

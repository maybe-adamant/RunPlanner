import type {
  Catalog,
  ChallengeSwitchHostDeclaration,
  ChallengeSwitchKindDeclaration,
  ChallengeSwitchVariantDeclaration,
} from '../../catalog-schema';
import type { AuthoredChallengeSwitch } from '../model';

/** The occurrence-local site holding the pickups a switch's claim spawns. */
export const CHALLENGE_SWITCH_SITE_KEY = 'challengeSwitch';
/** The claim's reward: the variant's reward, the Onion after a PerfectClear hit, or Time gold. */
export const CHALLENGE_SWITCH_REWARD_ENTRY_KEY = 'reward';
/** A hitless claim's bonus Nectar. */
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

/** A newly observed switch of one variant, with the declaration's claim defaults. */
export function defaultChallengeSwitch(
  catalog: Catalog,
  variantKey: string,
): AuthoredChallengeSwitch | undefined {
  const resolved = resolveChallengeSwitch(catalog, variantKey);
  if (resolved === undefined) return undefined;
  return Object.freeze({
    variantKey,
    hitless: true,
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
  const reward =
    !challengeSwitch.hitless && resolved.kind.hitRewardType !== undefined
      ? resolved.kind.hitRewardType
      : resolved.variant.rewardType;
  return Object.freeze([
    Object.freeze({ key: CHALLENGE_SWITCH_REWARD_ENTRY_KEY, rewardType: reward }),
    ...(challengeSwitch.hitless && challengeSwitch.nectarDropped
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
 * Why a claim outcome cannot be authored: the bonus Nectar needs a hitless
 * claim, and only a Time switch claims gold, within its decay range.
 */
export function challengeSwitchShapeIssue(
  catalog: Catalog,
  challengeSwitch: AuthoredChallengeSwitch,
): string | undefined {
  const resolved = resolveChallengeSwitch(catalog, challengeSwitch.variantKey);
  if (resolved === undefined) return `unknown challenge switch ${challengeSwitch.variantKey}`;
  if (challengeSwitch.nectarDropped && !challengeSwitch.hitless)
    return 'the bonus Nectar drops only on a hitless claim';
  const gold = catalog.challengeSwitches.gold;
  if (resolved.kind.goldReward) {
    if (
      challengeSwitch.gold === undefined ||
      !Number.isInteger(challengeSwitch.gold) ||
      challengeSwitch.gold < gold.minimumValue ||
      challengeSwitch.gold > gold.startingValue
    )
      return `gold must be an integer from ${gold.minimumValue} through ${gold.startingValue}`;
  } else if (challengeSwitch.gold !== undefined) return 'only a Time switch claims gold';
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

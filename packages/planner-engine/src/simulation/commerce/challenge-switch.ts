import type { Catalog, ChallengeSwitchKind } from '../../catalog-schema';
import type { AuthoredChallengeSwitch } from '../../authored-project/model';
import {
  challengeSwitchHost,
  resolveChallengeSwitch,
} from '../../authored-project/acquisition/challenge-switch';
import {
  evaluateRequirement,
  type RequirementEvaluationContext,
} from '../../requirements/evaluator';

/** The room objects that take a `ChallengeSwitchBase` anchor before a switch does. */
export type ChallengeSwitchAnchorOccupant = 'stygianWell' | 'purgingPool' | 'hermesShrine';

/** One native spawn rule an observed switch breaks; the spawn chance is never one. */
export type ChallengeSwitchPlacementIssue =
  | {
      readonly reason: 'biomeDepth';
      readonly biomeDepthCache: number;
      readonly minimumBiomeDepth: number;
    }
  | {
      readonly reason: 'recentSwitch';
      readonly roomsSinceLast: number;
      readonly minimumRoomsSinceLast: number;
    }
  | {
      readonly reason: 'noFreeAnchor';
      readonly anchorCount: number;
      readonly occupants: readonly ChallengeSwitchAnchorOccupant[];
    }
  /** The kind's own gate (Elite: `TalentLegal`, biome depth 3). */
  | { readonly reason: 'kindUnavailable'; readonly switchKind: ChallengeSwitchKind }
  /** The variant's own gate (Pom: an upgradable trait; Path of Stars: `TalentLegal`). */
  | { readonly reason: 'variantUnavailable'; readonly variantKey: string };

export interface ChallengeSwitchEntryFacts {
  readonly biomeDepthCache: number;
  /** The entry ledger, ending with this room's own appearance. */
  readonly appearances: readonly { readonly challengeSwitchPresent?: true }[];
  readonly occupants: readonly ChallengeSwitchAnchorOccupant[];
  readonly requirements: RequirementEvaluationContext;
}

/** Appearances since the latest earlier switch room; undefined when none came before. */
function roomsSinceLastSwitch(
  appearances: ChallengeSwitchEntryFacts['appearances'],
): number | undefined {
  const current = appearances.length - 1;
  for (let index = current - 1; index >= 0; index -= 1)
    if (appearances[index]?.challengeSwitchPresent === true) return current - index;
  return undefined;
}

/**
 * Whether native `HandleSecretSpawns` could have placed this switch on entry:
 * the shared spawn requirements, a free anchor after the Well, Pool and
 * Shrine took theirs, and the kind's and variant's own gates. Each broken rule
 * is one issue; an empty result is an eligible placement.
 */
export function assessChallengeSwitchPlacement(
  catalog: Catalog,
  gameName: string,
  anchorCount: number,
  challengeSwitch: AuthoredChallengeSwitch,
  facts: ChallengeSwitchEntryFacts,
): readonly ChallengeSwitchPlacementIssue[] {
  const switches = catalog.challengeSwitches;
  const resolved = resolveChallengeSwitch(catalog, challengeSwitch.variantKey);
  if (resolved === undefined || challengeSwitchHost(catalog, gameName) === undefined)
    return Object.freeze([]);
  const issues: ChallengeSwitchPlacementIssue[] = [];
  if (facts.biomeDepthCache < switches.minimumBiomeDepth)
    issues.push({
      reason: 'biomeDepth',
      biomeDepthCache: facts.biomeDepthCache,
      minimumBiomeDepth: switches.minimumBiomeDepth,
    });
  const since = roomsSinceLastSwitch(facts.appearances);
  if (since !== undefined && since < switches.minimumRoomsSinceLast)
    issues.push({
      reason: 'recentSwitch',
      roomsSinceLast: since,
      minimumRoomsSinceLast: switches.minimumRoomsSinceLast,
    });
  if (facts.occupants.length >= anchorCount)
    issues.push({
      reason: 'noFreeAnchor',
      anchorCount,
      occupants: Object.freeze([...facts.occupants]),
    });
  const { kind, variant } = resolved;
  if (
    (kind.minimumBiomeDepth !== undefined && facts.biomeDepthCache < kind.minimumBiomeDepth) ||
    (kind.requirement !== undefined && !evaluateRequirement(kind.requirement, facts.requirements))
  )
    issues.push({ reason: 'kindUnavailable', switchKind: kind.key });
  else if (
    variant.requirement !== undefined &&
    !evaluateRequirement(variant.requirement, facts.requirements)
  )
    issues.push({ reason: 'variantUnavailable', variantKey: variant.key });
  return Object.freeze(issues.map((issue) => Object.freeze(issue)));
}

/** The variants of one kind native could roll at this entry, in declaration order. */
export function eligibleChallengeSwitchVariantKeys(
  catalog: Catalog,
  switchKind: ChallengeSwitchKind,
  requirements: RequirementEvaluationContext,
): readonly string[] {
  return Object.freeze(
    catalog.challengeSwitches.variants.values
      .filter(
        (variant) =>
          variant.switchKind === switchKind &&
          (variant.requirement === undefined ||
            evaluateRequirement(variant.requirement, requirements)),
      )
      .map((variant) => variant.key),
  );
}

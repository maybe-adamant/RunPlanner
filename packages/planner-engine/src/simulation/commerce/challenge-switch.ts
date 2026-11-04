import type { Catalog, ChallengeSwitchKind } from '../../catalog-schema';
import type { AuthoredChallengeSwitch } from '../../authored-project/model';
import { resolveChallengeSwitch } from '../../authored-project/acquisition/challenge-switch';
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

/** Why native could not roll one variant at this entry, beside the shared rules. */
export type ChallengeSwitchVariantLock = 'kindUnavailable' | 'variantUnavailable';

/**
 * What native `HandleSecretSpawns` could place at one host's entry: the shared
 * spawn rules this entry breaks (the depth, the spacing and a free anchor after
 * the Well, Pool and Shrine took theirs), and each variant with its own lock.
 * A variant is rollable when no shared rule breaks and it has no lock.
 */
export interface ChallengeSwitchEntryAssessment {
  readonly sharedIssues: readonly Extract<
    ChallengeSwitchPlacementIssue,
    { readonly reason: 'biomeDepth' | 'recentSwitch' | 'noFreeAnchor' }
  >[];
  readonly variants: readonly {
    readonly variantKey: string;
    readonly switchKind: ChallengeSwitchKind;
    readonly lock?: ChallengeSwitchVariantLock;
  }[];
}

export function assessChallengeSwitchEntry(
  catalog: Catalog,
  anchorCount: number,
  facts: ChallengeSwitchEntryFacts,
): ChallengeSwitchEntryAssessment {
  const switches = catalog.challengeSwitches;
  const sharedIssues: ChallengeSwitchEntryAssessment['sharedIssues'][number][] = [];
  if (facts.biomeDepthCache < switches.minimumBiomeDepth)
    sharedIssues.push({
      reason: 'biomeDepth',
      biomeDepthCache: facts.biomeDepthCache,
      minimumBiomeDepth: switches.minimumBiomeDepth,
    });
  const since = roomsSinceLastSwitch(facts.appearances);
  if (since !== undefined && since < switches.minimumRoomsSinceLast)
    sharedIssues.push({
      reason: 'recentSwitch',
      roomsSinceLast: since,
      minimumRoomsSinceLast: switches.minimumRoomsSinceLast,
    });
  if (facts.occupants.length >= anchorCount)
    sharedIssues.push({
      reason: 'noFreeAnchor',
      anchorCount,
      occupants: Object.freeze([...facts.occupants]),
    });
  const kindLocked = new Map(
    switches.kinds.values.map((kind) => [
      kind.key,
      (kind.minimumBiomeDepth !== undefined && facts.biomeDepthCache < kind.minimumBiomeDepth) ||
        (kind.requirement !== undefined &&
          !evaluateRequirement(kind.requirement, facts.requirements)),
    ]),
  );
  return Object.freeze({
    sharedIssues: Object.freeze(sharedIssues.map((issue) => Object.freeze(issue))),
    variants: Object.freeze(
      switches.variants.values.map((variant) => {
        const lock: ChallengeSwitchVariantLock | undefined =
          kindLocked.get(variant.switchKind) === true
            ? 'kindUnavailable'
            : variant.requirement !== undefined &&
                !evaluateRequirement(variant.requirement, facts.requirements)
              ? 'variantUnavailable'
              : undefined;
        return Object.freeze({
          variantKey: variant.key,
          switchKind: variant.switchKind,
          ...(lock === undefined ? {} : { lock }),
        });
      }),
    ),
  });
}

/** Each spawn rule the observed switch breaks at its entry; empty when native could place it. */
export function challengeSwitchPlacementIssues(
  catalog: Catalog,
  assessment: ChallengeSwitchEntryAssessment,
  challengeSwitch: AuthoredChallengeSwitch,
): readonly ChallengeSwitchPlacementIssue[] {
  const resolved = resolveChallengeSwitch(catalog, challengeSwitch.variantKey);
  const variant = assessment.variants.find(
    (candidate) => candidate.variantKey === challengeSwitch.variantKey,
  );
  if (resolved === undefined || variant === undefined) return Object.freeze([]);
  return Object.freeze([
    ...assessment.sharedIssues,
    ...(variant.lock === 'kindUnavailable'
      ? [Object.freeze({ reason: 'kindUnavailable' as const, switchKind: variant.switchKind })]
      : variant.lock === 'variantUnavailable'
        ? [Object.freeze({ reason: 'variantUnavailable' as const, variantKey: variant.variantKey })]
        : []),
  ]);
}

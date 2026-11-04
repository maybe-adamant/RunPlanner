import type {
  Catalog,
  ChallengeSwitchEliteEncounterDeclaration,
  ChallengeSwitchKind,
} from '../../catalog-schema';
import type {
  AuthoredChallengeSwitch,
  AuthoredChallengeSwitchElite,
} from '../../authored-project/model';
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

/** Why a pinned Elite switch elite cannot be what native draws there. */
export type EliteChallengeIssue =
  | { readonly reason: 'enemyNotInSet'; readonly enemyKey: string }
  /** Not among the enemy's options here: unoffered, banned, blocked or another RoomSet's. */
  | { readonly reason: 'attributeUnavailable'; readonly attributeKey: string }
  /** An earlier drawn attribute removed it. */
  | { readonly reason: 'attributeExcluded'; readonly attributeKey: string }
  | { readonly reason: 'tooManyAttributes'; readonly attributeCount: number };

/**
 * The attributes the next forced draw can take for one enemy in one RoomSet,
 * after an ordered prefix (`PickEliteAttributes`): the enemy's options less the
 * encounter's banned ones, its own blocked ones and other RoomSets' ones, less
 * each earlier draw and what it blocks. Empty once the forced count is drawn.
 */
export function eliteChallengeAttributeOptions(
  encounter: ChallengeSwitchEliteEncounterDeclaration,
  enemyKey: string,
  roomSetKey: string,
  prefix: readonly string[],
): readonly string[] {
  const facts = encounter.attributeOptionsByEnemy[enemyKey];
  if (facts === undefined || prefix.length >= encounter.attributeCount) return Object.freeze([]);
  let options = facts.options.filter((key) => {
    const attribute = encounter.attributes[key];
    return (
      attribute !== undefined &&
      !encounter.bannedAttributeKeys.includes(key) &&
      !facts.blockedOptions.includes(key) &&
      (attribute.roomSets === undefined || attribute.roomSets.includes(roomSetKey))
    );
  });
  for (const drawn of prefix)
    options = options.filter(
      (key) => key !== drawn && !(encounter.attributes[drawn]?.excludes ?? []).includes(key),
    );
  return Object.freeze(options);
}

export function assessEliteChallengeChoice(
  encounter: ChallengeSwitchEliteEncounterDeclaration,
  roomSetKey: string,
  elite: AuthoredChallengeSwitchElite,
): readonly EliteChallengeIssue[] {
  if (!encounter.enemies.some((enemy) => enemy.key === elite.enemyKey))
    return Object.freeze([Object.freeze({ reason: 'enemyNotInSet', enemyKey: elite.enemyKey })]);
  const issues: EliteChallengeIssue[] = [];
  if (elite.attributeKeys.length > encounter.attributeCount)
    issues.push({ reason: 'tooManyAttributes', attributeCount: encounter.attributeCount });
  const offered = eliteChallengeAttributeOptions(encounter, elite.enemyKey, roomSetKey, []);
  elite.attributeKeys.slice(0, encounter.attributeCount).forEach((attributeKey, index) => {
    const prefix = elite.attributeKeys.slice(0, index);
    if (!offered.includes(attributeKey))
      issues.push({ reason: 'attributeUnavailable', attributeKey });
    else if (
      !eliteChallengeAttributeOptions(encounter, elite.enemyKey, roomSetKey, prefix).includes(
        attributeKey,
      )
    )
      issues.push({ reason: 'attributeExcluded', attributeKey });
  });
  return Object.freeze(issues.map((issue) => Object.freeze(issue)));
}

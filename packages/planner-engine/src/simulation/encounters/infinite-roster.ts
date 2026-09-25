import type { EncounterPhaseAddress } from '../../authored-project/addresses';
import type { InfiniteRosterSelection } from '../../catalog-schema';
import type { HistoryStateView } from '../history/model';
import type { ResolvedEncounterPhase } from './model';

export interface InfiniteRosterContext {
  readonly biomeDepthCache: number;
}

export type InfiniteRosterIssue =
  | { readonly reason: 'enemyUnavailable'; readonly position: number; readonly key: string }
  | {
      readonly reason: 'typeCount';
      readonly actual: number;
      readonly allowed: { readonly min: number; readonly max: number };
    };

export interface InfiniteRosterAssessment {
  /** A complete ordered roster that native FillEnemyTypes can draw in this order. */
  readonly supported: boolean;
  readonly issues: readonly InfiniteRosterIssue[];
  readonly typeCount: { readonly min: number; readonly max: number };
  /** Legal members in draw order, up to the first unavailable entry. */
  readonly activeMemberKeys: readonly string[];
  /** One domain per reachable draw; later draws depend on the first open one. */
  readonly eligibleKeysByPosition: readonly (readonly string[])[];
}

/** The supported pure query for one reached infinite-roster phase. */
export interface InfiniteRosterCandidateCapability {
  readonly origin: EncounterPhaseAddress;
  readonly decisionKey: string;
  readonly assess: (typeKeys: readonly string[]) => InfiniteRosterAssessment;
}

/**
 * Native FillEnemyTypes filters the pool once, then after each draw removes the
 * drawn type, its BlockEnemyTypes and, at the elite cap, every elite. Exclusions
 * therefore constrain only later draws.
 */
export function assessInfiniteRoster(
  selection: InfiniteRosterSelection,
  typeKeys: readonly string[],
  context: InfiniteRosterContext,
): InfiniteRosterAssessment {
  const issues: InfiniteRosterIssue[] = [];
  let pool = selection.choices.filter(
    (choice) =>
      choice.minimumDepth === undefined ||
      context[choice.minimumDepth.axis] >= choice.minimumDepth.value,
  );
  const members: string[] = [];
  const positions: (readonly string[])[] = [];
  let elites = 0;
  for (let index = 0; index < selection.types.max; index++) {
    positions.push(Object.freeze(pool.map((choice) => choice.key)));
    const key = typeKeys[index];
    if (key === undefined) break;
    const selected = pool.find((choice) => choice.key === key);
    if (selected === undefined) {
      issues.push({ reason: 'enemyUnavailable', position: index + 1, key });
      break;
    }
    members.push(key);
    if (selected.elite) elites++;
    pool = pool.filter(
      (choice) =>
        choice.key !== key &&
        !selected.excludes.includes(choice.key) &&
        !(choice.elite && elites >= selection.maxEliteTypes),
    );
  }
  if (
    issues.length === 0 &&
    (typeKeys.length < selection.types.min || typeKeys.length > selection.types.max)
  )
    issues.push({ reason: 'typeCount', actual: typeKeys.length, allowed: selection.types });
  return Object.freeze({
    supported: issues.length === 0,
    issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    typeCount: selection.types,
    activeMemberKeys: Object.freeze(members),
    eligibleKeysByPosition: Object.freeze(positions),
  });
}

/** Assesses a retained roster at the phase's exact preparation checkpoint. */
export function prepareInfiniteRoster(
  phase: ResolvedEncounterPhase,
  origin: EncounterPhaseAddress,
  preparation: HistoryStateView,
): {
  readonly phase: ResolvedEncounterPhase;
  readonly capability?: InfiniteRosterCandidateCapability;
} {
  const decision = phase.customization?.find((entry) => entry.selection.kind === 'infiniteRoster');
  if (decision?.selection.kind !== 'infiniteRoster') return { phase };
  const selection = decision.selection;
  const context = Object.freeze({
    biomeDepthCache: preparation.ledgers.counters.biomeDepthCache,
  });
  const capability: InfiniteRosterCandidateCapability = Object.freeze({
    origin,
    decisionKey: decision.key,
    assess: (typeKeys: readonly string[]) => assessInfiniteRoster(selection, typeKeys, context),
  });
  if (decision.value?.kind !== 'infiniteRoster' || !decision.valueSupported)
    return { phase, capability };
  if (capability.assess(decision.value.typeKeys).supported) return { phase, capability };
  return {
    capability,
    phase: Object.freeze({
      ...phase,
      customization: Object.freeze(
        phase.customization!.map((entry) =>
          entry === decision ? Object.freeze({ ...entry, valueSupported: false }) : entry,
        ),
      ),
    }),
  };
}

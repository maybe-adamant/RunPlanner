import type {
  AuthoredEncounterCustomization,
  AuthoredGeneratedEncounterCustomization,
} from '../../authored-project/model';
import type {
  EncounterEnemyChoice,
  GeneratedEncounterSelection,
  InfiniteRosterSelection,
} from '../../catalog-schema';
import type { RunRecordEncounter, RunRecordSpawn } from '../../run-record/model';
import type { GeneratedEncounterAssessment, GeneratedEncounterIssue } from './generation';
import type { InfiniteRosterAssessment, InfiniteRosterIssue } from './infinite-roster';

/** Why an observed encounter phase has no authored customization that replays it exactly. */
export type EncounterInverseMismatch =
  | { readonly reason: 'wavesMissing' }
  | { readonly reason: 'waveCount'; readonly actual: number }
  /** A spawn the policy cannot produce at its position, or whose save markers contradict it. */
  | { readonly reason: 'unexpectedSpawn'; readonly waveIndex: number; readonly enemy: string }
  | { readonly reason: 'fixedWave'; readonly waveIndex: number }
  | { readonly reason: 'seed'; readonly waveIndex: number }
  | { readonly reason: 'highlight' }
  | { readonly reason: 'budget'; readonly waveIndex?: number }
  | { readonly reason: 'composition'; readonly issues: readonly GeneratedEncounterIssue[] }
  | { readonly reason: 'counts'; readonly waveIndex: number }
  | {
      readonly reason: 'fangs';
      readonly issue: 'missing' | 'ambiguous' | 'unknownType' | 'unsupported';
    }
  | { readonly reason: 'replay'; readonly waveIndex: number }
  | { readonly reason: 'roster'; readonly issues: readonly InfiniteRosterIssue[] };

export type EncounterInverse<T extends AuthoredEncounterCustomization> =
  | { readonly kind: 'match'; readonly customization: T }
  | { readonly kind: 'noMatch'; readonly mismatch: EncounterInverseMismatch };

/** Native WaveDifficultyPatterns shares (EncounterData.lua). */
const waveShares: Readonly<Record<number, readonly number[]>> = {
  1: [1],
  2: [0.5, 0.5],
  3: [0.3, 0.15, 0.55],
  4: [0.3, 0.1, 0.2, 0.4],
};

function noMatch<T extends AuthoredEncounterCustomization>(
  mismatch: EncounterInverseMismatch,
): EncounterInverse<T> {
  return Object.freeze({ kind: 'noMatch', mismatch: Object.freeze(mismatch) });
}

function sameBudget(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-6 * Math.max(1, Math.abs(left), Math.abs(right));
}

interface CountMember {
  readonly key: string;
  readonly rating: number;
  readonly maxCount?: number;
  readonly sampled: boolean;
  readonly observed: number;
}

/**
 * Sampled requests reproducing one wave's observed FillEnemyCounts result.
 * Each sampled member takes the upper end of its count interval, `count ×
 * rating`; a capped member requests exactly the spare difficulty it spills.
 */
function allocationsFor(
  waveBudget: number,
  fixedCost: number,
  members: readonly CountMember[],
): Readonly<Record<string, number>> | undefined {
  interface State {
    readonly index: number;
    readonly accumulated: number;
    /** Uncapped members so far: position and current count including spills. */
    readonly uncapped: readonly { readonly index: number; readonly count: number }[];
    readonly requests: Readonly<Record<string, number>>;
  }
  // A capped member's spare difficulty spills only into the latest uncapped member.
  const receivesSpill = (index: number) => members[index + 1]?.maxCount !== undefined;
  const visit = (state: State): Readonly<Record<string, number>> | undefined => {
    if (state.index === members.length)
      return state.uncapped.every((entry) => entry.count === members[entry.index]!.observed)
        ? state.requests
        : undefined;
    const member = members[state.index]!;
    const remaining = waveBudget - state.accumulated;
    const upper = Math.max(member.rating, remaining);
    const reachable = (count: number) => count === 1 || remaining > (count - 1) * member.rating;
    const next = (count: number, request: number | undefined, spill: number): State => {
      const uncapped = state.uncapped.map((entry, position) =>
        position === state.uncapped.length - 1 && spill > 0
          ? { index: entry.index, count: entry.count + spill }
          : entry,
      );
      return {
        index: state.index + 1,
        accumulated: state.accumulated + member.rating * count,
        uncapped:
          member.maxCount === undefined ? [...uncapped, { index: state.index, count }] : uncapped,
        requests:
          request === undefined ? state.requests : { ...state.requests, [member.key]: request },
      };
    };
    if (member.maxCount === undefined) {
      const counts = receivesSpill(state.index)
        ? Array.from({ length: member.observed }, (_value, offset) => member.observed - offset)
        : [member.observed];
      for (const count of counts) {
        if (member.sampled) {
          if (!reachable(count)) continue;
          const result = visit(next(count, count * member.rating, 0));
          if (result !== undefined) return result;
        } else if (Math.ceil(upper / member.rating) === count) {
          const result = visit(next(count, undefined, 0));
          if (result !== undefined) return result;
        }
      }
      return undefined;
    }
    const target = state.uncapped.at(-1);
    const deficit = target === undefined ? 0 : members[target.index]!.observed - target.count;
    const capped = (effective: number) => {
      const count = Math.min(Math.ceil(effective / member.rating), member.maxCount!);
      const spare = effective - count * member.rating;
      const targetRating = target === undefined ? undefined : members[target.index]!.rating;
      const spill =
        targetRating !== undefined && spare > targetRating ? Math.ceil(spare / targetRating) : 0;
      return { count, spill };
    };
    if (!member.sampled) {
      const outcome = capped(upper);
      if (outcome.count !== member.observed || outcome.spill > deficit) return undefined;
      return visit(next(outcome.count, undefined, outcome.spill));
    }
    if (member.observed < member.maxCount) {
      if (!reachable(member.observed)) return undefined;
      return visit(next(member.observed, member.observed * member.rating, 0));
    }
    // A spill of one is impossible: native transfers only spare above one target rating.
    const spills = [0, ...Array.from({ length: Math.max(0, deficit - 1) }, (_v, i) => i + 2)];
    for (const spill of spills) {
      const targetRating = target === undefined ? 0 : members[target.index]!.rating;
      const request = member.maxCount * member.rating + spill * targetRating;
      const outcome = capped(Math.max(member.rating, Math.min(request, remaining)));
      if (outcome.count !== member.observed || outcome.spill !== spill) continue;
      const result = visit(next(outcome.count, request, spill));
      if (result !== undefined) return result;
    }
    return undefined;
  };
  return visit({ index: 0, accumulated: fixedCost, uncapped: [], requests: {} });
}

/**
 * Inverts one observed generated encounter phase into the authored generated
 * customization that the forward assessment replays to the same waves, types
 * and counts. `assess` is the phase's exact generation capability. Menace is
 * not inferred: the record keeps raw kills, not conversions.
 */
export function invertGeneratedEncounter(
  policy: GeneratedEncounterSelection,
  assess: (value: AuthoredGeneratedEncounterCustomization) => GeneratedEncounterAssessment,
  observed: RunRecordEncounter,
): EncounterInverse<AuthoredGeneratedEncounterCustomization> {
  const waves = observed.waves ?? [];
  if (waves.length === 0) return noMatch({ reason: 'wavesMissing' });
  const waveCount = waves.length;
  const shares = waveShares[waveCount];
  if (waveCount < policy.waveCount.min || waveCount > policy.waveCount.max || shares === undefined)
    return noMatch({ reason: 'waveCount', actual: waveCount });
  const fixedWaves = policy.fixedWaves ?? [];
  const seeds = policy.generatedSeeds ?? [];
  // Highlight and additions are drawn from the encounter's EnemySet.
  const byNativeId = new Map(policy.choices.map((choice) => [choice.nativeId, choice]));
  const nativeIdByKey = new Map<string, string>();
  for (const choice of [...policy.choices, ...seeds, ...policy.fixedEnemies, ...fixedWaves.flat()])
    nativeIdByKey.set(choice.key, choice.nativeId);
  const declared = (spawn: RunRecordSpawn, choice: EncounterEnemyChoice) =>
    spawn.enemy === choice.nativeId &&
    spawn.generated !== true &&
    spawn.count === (choice.fixedCount ?? 1);

  for (const [index, spawns] of fixedWaves.entries()) {
    const wave = waves[index];
    if (
      wave === undefined ||
      wave.spawns.length !== spawns.length ||
      spawns.some((choice, position) => !declared(wave.spawns[position]!, choice))
    )
      return noMatch({ reason: 'fixedWave', waveIndex: index + 1 });
  }

  // Fixed template spawns, then named seeds, then the shared highlight open each generated wave.
  const usesHighlight = waveCount > 1 && fixedWaves.length === 0;
  const generatedRows: { waveIndex: number; members: string[] }[] = [];
  for (let waveIndex = fixedWaves.length + 1; waveIndex <= waveCount; waveIndex++) {
    const spawns = waves[waveIndex - 1]!.spawns;
    for (const spawn of spawns)
      if (spawn.miniBossShrine === true || spawn.infinite === true || spawn.count === undefined)
        return noMatch({ reason: 'unexpectedSpawn', waveIndex, enemy: spawn.enemy });
    const opening = policy.fixedEnemies.length;
    if (
      spawns.length < opening + seeds.length ||
      policy.fixedEnemies.some((choice, position) => !declared(spawns[position]!, choice)) ||
      seeds.some((choice, position) => spawns[opening + position]!.enemy !== choice.nativeId)
    )
      return noMatch({ reason: 'seed', waveIndex });
    const members: string[] = [];
    for (const spawn of spawns.slice(opening + seeds.length)) {
      const choice = byNativeId.get(spawn.enemy);
      if (choice === undefined || spawn.generated !== true)
        return noMatch({ reason: 'unexpectedSpawn', waveIndex, enemy: spawn.enemy });
      members.push(choice.key);
    }
    generatedRows.push({ waveIndex, members });
  }
  let highlightKey: string | undefined;
  if (usesHighlight) {
    highlightKey = generatedRows[0]?.members[0];
    if (highlightKey === undefined || generatedRows.some((row) => row.members[0] !== highlightKey))
      return noMatch({ reason: 'highlight' });
  }

  const firstGenerated = fixedWaves.length;
  const firstDifficulty = waves[firstGenerated]?.difficulty;
  const observedTotal =
    observed.difficulty ??
    (firstDifficulty === undefined ? undefined : firstDifficulty / shares[firstGenerated]!);
  const base = policy.budget.base;
  let baseRoll: number | undefined;
  if (typeof base !== 'number') {
    const domain = assess({ kind: 'generated' }).budgetDomain;
    if (observedTotal === undefined || domain === undefined) return noMatch({ reason: 'budget' });
    const span = domain.total.max - domain.total.min;
    // Native RandomInt draws an integral base; the total is linear in it above the minimum.
    baseRoll =
      span === 0
        ? base.min
        : Math.round(
            base.min + ((observedTotal - domain.total.min) * (base.max - base.min)) / span,
          );
    if (baseRoll < base.min || baseRoll > base.max) return noMatch({ reason: 'budget' });
  }

  const composed: AuthoredGeneratedEncounterCustomization = {
    kind: 'generated',
    ...(baseRoll === undefined ? {} : { baseRoll }),
    waveCount,
    ...(highlightKey === undefined ? {} : { highlightKey }),
    waves: generatedRows.map((row) => ({
      waveIndex: row.waveIndex,
      typeKeys: usesHighlight ? row.members.slice(1) : row.members,
    })),
  };
  const domain = assess(composed);
  const compositionIssues = domain.issues.filter(
    (issue) => issue.reason !== 'required' && issue.reason !== 'fangs',
  );
  if (compositionIssues.length > 0)
    return noMatch({ reason: 'composition', issues: compositionIssues });
  if (domain.budget?.kind !== 'exact') return noMatch({ reason: 'budget' });
  const waveBudgets = domain.budget.waveBudgets as readonly number[];
  if (observedTotal !== undefined && !sameBudget(waveBudgets[0]! / shares[0]!, observedTotal))
    return noMatch({ reason: 'budget' });
  for (let waveIndex = firstGenerated + 1; waveIndex <= waveCount; waveIndex++) {
    const difficulty = waves[waveIndex - 1]!.difficulty;
    if (difficulty !== undefined && !sameBudget(difficulty, waveBudgets[waveIndex - 1]!))
      return noMatch({ reason: 'budget', waveIndex });
  }

  const choices = new Map([...policy.choices, ...seeds].map((choice) => [choice.key, choice]));
  const fixedCost = policy.fixedEnemies.reduce(
    (sum, enemy) => sum + enemy.difficultyRating * (enemy.fixedCount ?? 1),
    0,
  );
  const allocated: NonNullable<AuthoredGeneratedEncounterCustomization['waves']>[number][] = [];
  for (const row of composed.waves!) {
    const wave = domain.waves.find((entry) => entry.waveIndex === row.waveIndex);
    const generatedKeys = [
      ...seeds.map((seed) => seed.key),
      ...(highlightKey === undefined ? [] : [highlightKey]),
      ...row.typeKeys,
    ];
    const spawns = waves[row.waveIndex - 1]!.spawns.slice(policy.fixedEnemies.length);
    const members = generatedKeys.map((key, position) => {
      const choice = choices.get(key)!;
      return {
        key,
        rating: choice.difficultyRating,
        ...(choice.maxCount === undefined ? {} : { maxCount: choice.maxCount }),
        sampled: wave?.sampledBudgetKeys.includes(key) === true,
        observed: spawns[position]!.count!,
      };
    });
    const allocations = allocationsFor(waveBudgets[row.waveIndex - 1]!, fixedCost, members);
    if (allocations === undefined) return noMatch({ reason: 'counts', waveIndex: row.waveIndex });
    allocated.push({
      ...row,
      ...(Object.keys(allocations).length === 0 ? {} : { allocations }),
    });
  }
  let customization: AuthoredGeneratedEncounterCustomization = { ...composed, waves: allocated };

  const fangEntries = Object.entries(observed.fangs ?? {});
  if (fangEntries.length > 1) return noMatch({ reason: 'fangs', issue: 'ambiguous' });
  const [fangEntry] = fangEntries;
  if (fangEntry !== undefined) {
    const [enemy, perkKeys] = fangEntry;
    const typeKey = [...policy.choices, ...policy.fixedEnemies].find(
      (choice) => choice.nativeId === enemy,
    )?.key;
    if (typeKey === undefined) return noMatch({ reason: 'fangs', issue: 'unknownType' });
    customization = { ...customization, fangs: { typeKey, perkKeys: [...perkKeys] } };
  }

  const replay = assess(customization);
  if (!replay.supported || replay.operands === undefined) {
    const fangs = replay.issues.find((issue) => issue.reason === 'fangs');
    if (fangs !== undefined)
      return noMatch({
        reason: 'fangs',
        issue: fangEntry === undefined ? 'missing' : 'unsupported',
      });
    return noMatch({ reason: 'replay', waveIndex: firstGenerated + 1 });
  }
  if (fangEntry !== undefined && replay.operands.fangs === undefined)
    return noMatch({ reason: 'fangs', issue: 'unsupported' });
  for (const [index, wave] of waves.entries()) {
    const replayed = replay.operands.waves.find((entry) => entry.waveIndex === index + 1);
    if (
      replayed === undefined ||
      replayed.typeKeys.length !== wave.spawns.length ||
      replayed.typeKeys.some(
        (key, position) =>
          nativeIdByKey.get(key) !== wave.spawns[position]!.enemy ||
          replayed.counts[key] !== wave.spawns[position]!.count,
      )
    )
      return noMatch({ reason: 'replay', waveIndex: index + 1 });
  }
  return Object.freeze({ kind: 'match', customization });
}

/**
 * Inverts one observed infinite-spawn phase into its ordered roster, verified
 * by the phase's exact roster assessment.
 */
export function invertInfiniteRoster(
  selection: InfiniteRosterSelection,
  assess: (typeKeys: readonly string[]) => InfiniteRosterAssessment,
  observed: RunRecordEncounter,
): EncounterInverse<{ readonly kind: 'infiniteRoster'; readonly typeKeys: readonly string[] }> {
  const waves = observed.waves ?? [];
  if (waves.length === 0) return noMatch({ reason: 'wavesMissing' });
  if (waves.length !== 1) return noMatch({ reason: 'waveCount', actual: waves.length });
  const typeKeys: string[] = [];
  for (const spawn of waves[0]!.spawns) {
    const choice = selection.choices.find((entry) => entry.nativeId === spawn.enemy);
    if (choice === undefined || spawn.infinite !== true)
      return noMatch({ reason: 'unexpectedSpawn', waveIndex: 1, enemy: spawn.enemy });
    typeKeys.push(choice.key);
  }
  const assessment = assess(typeKeys);
  if (!assessment.supported) return noMatch({ reason: 'roster', issues: assessment.issues });
  return Object.freeze({
    kind: 'match',
    customization: Object.freeze({ kind: 'infiniteRoster', typeKeys: Object.freeze(typeKeys) }),
  });
}

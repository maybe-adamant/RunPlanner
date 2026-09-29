import type { EncounterEnemyChoice, GeneratedEncounterSelection } from '../../catalog-schema';
import type { AuthoredGeneratedEncounterCustomization } from '../../authored-project/model';
import { assessFangs } from './fangs';

export interface EncounterGenerationContext {
  readonly biomeDepthCache: number;
  readonly biomeEncounterDepth: number;
  /** Only consequences of earlier explicit, valid ordinary additions are known. */
  readonly knownRunBlacklist: readonly string[];
  readonly hard?: boolean;
  readonly hordesRank?: number;
  /** Effective Vow of Fangs rank at this exact generation checkpoint. */
  readonly fangsRank?: number;
  readonly menaceRank?: number;
  readonly roomSetKey?: string;
}

export interface GeneratedEncounterOperands {
  /** A published generated encounter is a complete installation request. */
  readonly baseRoll?: number;
  /** Final native DifficultyRating from which the published counts were derived. */
  readonly expectedBudget: number;
  readonly waveCount: number;
  readonly highlightKey?: string;
  readonly fangs?: { readonly typeKey: string; readonly perkKeys: readonly string[] };
  readonly menace: readonly {
    readonly waveIndex: number;
    readonly conversions: readonly {
      readonly sourceKey: string;
      readonly sourceNativeId: string;
      readonly count: number;
      readonly targetNativeId?: string;
    }[];
  }[];
  readonly waves: readonly {
    readonly waveIndex: number;
    /** Complete native roster, including fixed template entries. */
    readonly typeKeys: readonly string[];
    readonly sources: Readonly<Record<string, 'fixed' | 'template' | 'highlight' | 'addition'>>;
    /** Exact native TotalCount requests, in native spawn order. */
    readonly counts: Readonly<Record<string, number>>;
  }[];
}

export interface GeneratedEncounterAssessment {
  readonly supported: boolean;
  readonly issues: readonly GeneratedEncounterIssue[];
  readonly effectiveWaveCount?: number;
  readonly composition: 'active' | 'missingWaveCount' | 'missingHighlight';
  readonly eligibleHighlightKeys: readonly string[];
  readonly fangs?: {
    readonly rank: number;
    readonly active: boolean;
    readonly eligibleTypeKeys: readonly string[];
    readonly perkKeys: readonly string[];
    readonly eligiblePerkKeys: readonly string[];
    readonly next: 'type' | 'perk' | 'finish' | 'unavailable';
    readonly canFinish: boolean;
    readonly issue?: 'typeUnavailable' | 'perkUnavailable' | 'incomplete';
  };
  readonly menace?: { readonly rank: number; readonly active: boolean; readonly blocked: boolean };
  readonly waves: readonly {
    readonly waveIndex: number;
    /** Complete native count, including fixed/template and highlight members. */
    readonly menaceSources?: readonly {
      readonly sourceKey: string;
      readonly maximum: number;
      readonly targetNativeId?: string;
      readonly targetNativeIds?: readonly string[];
    }[];
    readonly typeCount: { readonly min: number; readonly max: number };
    /** Editable generated additions after the declaration-owned seeds. */
    readonly additionalTypeCount: { readonly min: number; readonly max: number };
    readonly seeds: readonly { readonly key: string; readonly kind: 'fixed' | 'highlight' }[];
    /** Seeds and eligible authored additions in native order, up to the first unavailable entry. */
    readonly activeMemberKeys: readonly string[];
    /** A legal native roster can stop below the declared minimum when its pool is exhausted. */
    readonly exhausted: boolean;
    /** One domain per legal editable position; never includes a trailing dead slot. */
    readonly eligibleKeysByPosition: readonly (readonly string[])[];
    /** Equal remaining-budget samples for an explicit authoring action. */
    readonly equalAllocations?: Readonly<Record<string, number>>;
    /** Generated members that use a sampled budget rather than the native remainder. */
    readonly sampledBudgetKeys: readonly string[];
    /** Ordered FillEnemyCounts preview; missing counts require authoring repair. */
    readonly countPreview?: readonly {
      readonly key: string;
      readonly requested?: number;
      /** Native remainder at this unsampled allocation step, before minimums and rounding. */
      readonly remainder?: number;
      readonly effective?: number;
      readonly count?: number;
    }[];
  }[];
  readonly operands?: GeneratedEncounterOperands;
  readonly knownRunBlacklistAdditions: readonly string[];
  readonly budgetDomain?: {
    readonly baseRoll: { readonly min: number; readonly max: number };
    readonly total: { readonly min: number; readonly max: number };
  };
  readonly budget?: {
    readonly kind: 'exact' | 'range';
    readonly waveBudgets:
      readonly number[] | readonly { readonly min: number; readonly max: number }[];
  };
}

export type GeneratedEncounterIssue =
  | {
      readonly reason: 'required';
      readonly field: 'waveCount' | 'baseRoll' | 'highlight' | 'wave' | 'allocations';
      readonly waveIndex?: number;
    }
  | { readonly reason: 'baseRoll'; readonly actual: number }
  | {
      readonly reason: 'waveCount';
      readonly actual: number;
      readonly allowed: { readonly min: number; readonly max: number };
    }
  | { readonly reason: 'highlight'; readonly key: string }
  | {
      readonly reason: 'enemyUnavailable';
      readonly waveIndex: number;
      readonly position: number;
      readonly key: string;
    }
  | {
      readonly reason: 'typeCount';
      readonly waveIndex: number;
      readonly actual: number;
      readonly allowed: { readonly min: number; readonly max: number };
    }
  | {
      readonly reason: 'placeholderCount';
      readonly waveIndex: number;
      readonly actual: number;
      readonly allowed: number;
    }
  | { readonly reason: 'allocationMembers'; readonly waveIndex: number }
  | {
      readonly reason: 'fangs';
      readonly issue: 'typeUnavailable' | 'perkUnavailable' | 'incomplete';
    }
  | {
      readonly reason: 'menace';
      readonly issue: 'countUnavailable' | 'targetRequired' | 'targetUnavailable';
      readonly waveIndex: number;
      readonly key: string;
    };

const wavePatterns: Readonly<Record<number, readonly number[]>> = Object.freeze({
  1: [1],
  2: [0.5, 0.5],
  3: [0.3, 0.15, 0.55],
  4: [0.3, 0.1, 0.2, 0.4],
});

function totalBudget(
  policy: GeneratedEncounterSelection,
  context: EncounterGenerationContext,
  roll: number,
) {
  const depth = context[policy.budget.depthAxis];
  const ramp =
    context.hard === true && policy.budget.hardDepthRamp !== undefined
      ? policy.budget.hardDepthRamp
      : policy.budget.depthRamp;
  const hordes = [1, 1.2, 1.4, 1.6][Math.max(0, Math.min(3, context.hordesRank ?? 0))]!;
  // RunLogic GenerateEncounter: modifier precedes the multiplier; Hordes, then the minimum.
  const rating = (roll + depth * ramp + policy.budget.modifier) * policy.budget.multiplier;
  return Math.max(policy.budget.minimum, rating * hordes);
}

/** All scoped generators use the native multi-wave highlight branch. Fixed
 * templates have one wave; no scoped identity blocks highlight globally. */
export function assessGeneratedEncounter(
  policy: GeneratedEncounterSelection,
  authored: AuthoredGeneratedEncounterCustomization,
  context: EncounterGenerationContext,
): GeneratedEncounterAssessment {
  const issues: GeneratedEncounterIssue[] = [];
  const waveCount =
    authored.waveCount ??
    (policy.waveCount.min === policy.waveCount.max ? policy.waveCount.min : undefined);
  if (
    waveCount !== undefined &&
    (waveCount < policy.waveCount.min || waveCount > policy.waveCount.max)
  )
    issues.push({ reason: 'waveCount', actual: waveCount, allowed: policy.waveCount });
  const possibleHighlight = policy.waveCount.max > 1;
  const selectedBase = authored.baseRoll;
  const base = policy.budget.base;
  const sampledBudgetKeys = (generated: readonly string[]) =>
    generated.filter((_key, index) => policy.fixedEnemies.length + index + 1 !== generated.length);
  // A fixed budget has no authored base-roll contact. Preserve a retained
  // value for a later context without making the currently fixed policy
  // impossible to repair through the only whole-customization reset.
  if (
    selectedBase !== undefined &&
    typeof base !== 'number' &&
    (selectedBase < base.min || selectedBase > base.max)
  )
    issues.push({ reason: 'baseRoll', actual: selectedBase });
  const exactRoll =
    typeof base === 'number'
      ? base
      : selectedBase !== undefined && selectedBase >= base.min && selectedBase <= base.max
        ? selectedBase
        : undefined;
  const expectedBudget =
    exactRoll === undefined ? undefined : totalBudget(policy, context, exactRoll);
  const budget =
    waveCount === undefined || wavePatterns[waveCount] === undefined
      ? undefined
      : expectedBudget !== undefined
        ? Object.freeze({
            kind: 'exact' as const,
            waveBudgets: Object.freeze(
              wavePatterns[waveCount]!.map((share) => expectedBudget * share),
            ),
          })
        : typeof base !== 'number' && selectedBase === undefined
          ? Object.freeze({
              kind: 'range' as const,
              waveBudgets: Object.freeze(
                wavePatterns[waveCount]!.map((share) =>
                  Object.freeze({
                    min: totalBudget(policy, context, base.min) * share,
                    max: totalBudget(policy, context, base.max) * share,
                  }),
                ),
              ),
            })
          : undefined;
  const previewFor = (
    waveIndex: number,
    generated: readonly string[],
  ):
    | readonly {
        readonly key: string;
        readonly requested?: number;
        readonly remainder?: number;
        readonly effective?: number;
        readonly count?: number;
      }[]
    | undefined => {
    if (budget?.kind !== 'exact') return undefined;
    const waveBudget = (budget.waveBudgets as readonly number[])[waveIndex - 1];
    if (waveBudget === undefined) return undefined;
    const row = authored.waves?.find((wave) => wave.waveIndex === waveIndex);
    const result: {
      key: string;
      requested?: number;
      remainder?: number;
      effective?: number;
      count?: number;
    }[] = [];
    let accumulatedDifficulty = 0;
    for (const fixed of policy.fixedEnemies) {
      const count = fixed.fixedCount ?? 1;
      accumulatedDifficulty += fixed.difficultyRating * count;
      result.push({ key: fixed.key, count });
    }
    // FillEnemyCounts compares the full native spawn-table index to the number
    // of generated entries. A missing sampled slice makes both the remaining
    // budget and a later capped redistribution unknown, so never publish a
    // partly exact generated wave.
    const sampledKeys = sampledBudgetKeys(generated);
    const sampled = generated.map((key) => sampledKeys.includes(key));
    if (
      sampled.some(
        (isSampled, index) => isSampled && row?.allocations?.[generated[index]!] === undefined,
      )
    )
      return Object.freeze([
        ...result.map((entry) => Object.freeze(entry)),
        ...generated.map((key) =>
          Object.freeze({
            key,
            ...(row?.allocations?.[key] === undefined ? {} : { requested: row.allocations[key] }),
          }),
        ),
      ]);
    const uncapped: { index: number; count: number; difficultyRating: number }[] = [];
    for (let index = 0; index < generated.length; index++) {
      const key = generated[index]!;
      const enemy = choices.get(key);
      if (enemy === undefined) continue;
      const remaining = waveBudget - accumulatedDifficulty;
      const isSampled = sampled[index]!;
      const requested = row?.allocations?.[key];
      let effective = isSampled ? Math.min(requested!, remaining) : Math.max(0, remaining);
      if (effective < enemy.difficultyRating) effective = enemy.difficultyRating;
      let count = Math.ceil(effective / enemy.difficultyRating);
      if (enemy.maxCount !== undefined) {
        if (count > enemy.maxCount) count = enemy.maxCount;
        const earlier = uncapped.at(-1);
        const spareDifficulty = effective - count * enemy.difficultyRating;
        if (earlier !== undefined && spareDifficulty > earlier.difficultyRating) {
          const additionalCount = Math.ceil(spareDifficulty / earlier.difficultyRating);
          earlier.count += additionalCount;
          const earlierResult = result[earlier.index];
          if (earlierResult !== undefined) earlierResult.count = earlier.count;
        }
      } else
        uncapped.push({ index: result.length, count, difficultyRating: enemy.difficultyRating });
      if (count < 1) count = 1;
      accumulatedDifficulty += enemy.difficultyRating * count;
      result.push({
        key,
        ...(requested === undefined ? {} : { requested }),
        ...(isSampled ? {} : { remainder: Math.max(0, remaining) }),
        effective,
        count,
      });
    }
    return Object.freeze(result.map((entry) => Object.freeze(entry)));
  };
  const usesHighlight = waveCount !== undefined && waveCount > 1;
  const choices = new Map(policy.choices.map((choice) => [choice.key, choice]));
  const runBlacklist = new Set(context.knownRunBlacklist);
  const encounterBlacklist = new Set<string>();
  const knownAdditions = new Set<string>();
  const eligible = (
    choice: EncounterEnemyChoice,
    spawns: readonly EncounterEnemyChoice[],
    count: number,
    blockElites: boolean,
  ) =>
    !runBlacklist.has(choice.key) &&
    !encounterBlacklist.has(choice.key) &&
    !(blockElites && choice.elite) &&
    !(count === 1 && choice.blockSolo) &&
    (choice.minimumDepth === undefined ||
      context[choice.minimumDepth.axis] >= choice.minimumDepth.value) &&
    !spawns.some((spawn) => spawn.key === choice.key || spawn.excludes.includes(choice.key)) &&
    (!choice.elite || spawns.filter((spawn) => spawn.elite).length < policy.maxEliteTypes);
  const eligibleHighlights = possibleHighlight
    ? policy.choices.filter((choice) => eligible(choice, [], 1, policy.blockHighlightElites))
    : [];
  const highlight =
    authored.highlightKey === undefined ? undefined : choices.get(authored.highlightKey);
  // A retained highlight has no native contact in a known one-wave result.
  if (
    ((waveCount === undefined && possibleHighlight) || usesHighlight) &&
    authored.highlightKey !== undefined &&
    !eligibleHighlights.some((choice) => choice.key === authored.highlightKey)
  )
    issues.push({ reason: 'highlight', key: authored.highlightKey });
  const composition =
    waveCount === undefined
      ? 'missingWaveCount'
      : usesHighlight && authored.highlightKey === undefined
        ? 'missingHighlight'
        : 'active';
  const waveDomains: {
    waveIndex: number;
    typeCount: { min: number; max: number };
    additionalTypeCount: { min: number; max: number };
    seeds: readonly { readonly key: string; readonly kind: 'fixed' | 'highlight' }[];
    activeMemberKeys: readonly string[];
    exhausted: boolean;
    eligibleKeysByPosition: readonly (readonly string[])[];
  }[] = [];
  const waves: {
    readonly waveIndex: number;
    readonly typeKeys: readonly string[];
    readonly allocations?: Readonly<Record<string, number>>;
  }[] = [];
  if (
    composition === 'active' &&
    waveCount !== undefined &&
    (!usesHighlight || highlight !== undefined)
  ) {
    if (usesHighlight && highlight !== undefined) encounterBlacklist.add(highlight.key);
    for (let waveIndex = 1; waveIndex <= waveCount; waveIndex++) {
      const row = authored.waves?.find((wave) => wave.waveIndex === waveIndex);
      const max = Math.floor(
        policy.types.max + policy.types.depthRamp * context[policy.types.depthAxis],
      );
      const highlightCount = Math.min(
        waveIndex,
        Math.floor(policy.types.max + policy.types.depthRamp * context.biomeDepthCache),
      );
      const target = policy.types.escalate ? max : usesHighlight ? highlightCount : undefined;
      const minCount = Math.min(target ?? policy.types.min, policy.types.cap);
      const maxCount = Math.min(target ?? max, policy.types.cap);
      const seeds = [
        ...policy.fixedEnemies,
        ...(usesHighlight && highlight !== undefined ? [highlight] : []),
      ];
      const exactSize = seeds.length + (row?.typeKeys.length ?? 0);
      // Random count is fixed by the authored list, within the declared range.
      // A shorter list is assessed at the native minimum and must exhaust it.
      const selectedCount =
        target === undefined ? Math.max(minCount, Math.min(exactSize, maxCount)) : minCount;
      const blockElites = usesHighlight && waveIndex === 1 && policy.blockHighlightElites;
      const positions: (readonly string[])[] = [];
      let pool = policy.choices.filter((choice) =>
        eligible(choice, seeds, selectedCount, blockElites),
      );
      const spawns = [...seeds];
      // Fixed templates retain their native seed and author exactly one generated companion.
      const additionalMin =
        policy.fixedEnemies.length === 0 ? Math.max(0, minCount - seeds.length) : 1;
      const additionalMax =
        policy.fixedEnemies.length === 0 ? Math.max(0, maxCount - seeds.length) : 1;
      const selectedKeys = row?.typeKeys ?? [];
      let exhausted = false;
      for (let index = 0; index < additionalMax; index++) {
        const key = selectedKeys[index];
        const domain = Object.freeze(pool.map((choice) => choice.key));
        positions.push(domain);
        if (key === undefined) {
          exhausted = domain.length === 0;
          // Only the first open slot is reachable. Later slots depend on a choice here.
          break;
        }
        const selected = pool.find((choice) => choice.key === key);
        if (selected === undefined) {
          issues.push({
            reason: 'enemyUnavailable',
            waveIndex,
            position: seeds.length + index + 1,
            key,
          });
          break;
        }
        spawns.push(selected);
        pool = pool.filter(
          (choice) => choice.key !== key && eligible(choice, spawns, selectedCount, blockElites),
        );
        if (policy.fixedEnemies.length === 0) {
          if (selected.blacklistAfterAppearance) {
            runBlacklist.add(key);
            knownAdditions.add(key);
          }
          if (policy.blockTypesAcrossWaves)
            for (const excluded of selected.excludes) encounterBlacklist.add(excluded);
          pool = pool.filter((choice) => {
            const group = choice.group;
            const limit = group === undefined ? undefined : policy.maxTypesPerGroup[group];
            return (
              limit === undefined || spawns.filter((spawn) => spawn.group === group).length < limit
            );
          });
        }
      }
      waveDomains.push({
        waveIndex,
        typeCount: { min: minCount, max: maxCount },
        additionalTypeCount: { min: additionalMin, max: additionalMax },
        seeds: Object.freeze([
          ...policy.fixedEnemies.map((enemy) => ({ key: enemy.key, kind: 'fixed' as const })),
          ...(usesHighlight && highlight !== undefined
            ? [{ key: highlight.key, kind: 'highlight' as const }]
            : []),
        ]),
        activeMemberKeys: Object.freeze(spawns.map((spawn) => spawn.key)),
        exhausted,
        eligibleKeysByPosition: Object.freeze(positions),
        ...(row === undefined
          ? {}
          : {
              countPreview: previewFor(waveIndex, [
                ...(usesHighlight && highlight !== undefined ? [highlight.key] : []),
                ...row.typeKeys,
              ]),
            }),
      });
      if (row === undefined) continue; // Native rosters never become fabricated blacklist facts.
      if (policy.fixedEnemies.length !== 0) {
        if (row.typeKeys.length !== 1)
          issues.push({
            reason: 'placeholderCount',
            waveIndex,
            actual: row.typeKeys.length,
            allowed: 1,
          });
      } else if (exactSize > maxCount || (exactSize < minCount && pool.length > 0))
        issues.push({
          reason: 'typeCount',
          waveIndex,
          actual: exactSize,
          allowed: { min: minCount, max: maxCount },
        });
      const generated = [
        ...(usesHighlight && highlight !== undefined ? [highlight.key] : []),
        ...row.typeKeys,
      ];
      let allocations: Readonly<Record<string, number>> | undefined;
      if (row.allocations !== undefined) {
        const keys = Object.keys(row.allocations);
        if (
          keys.some(
            (key) => !generated.includes(key) || !sampledBudgetKeys(generated).includes(key),
          )
        )
          issues.push({ reason: 'allocationMembers', waveIndex });
        else allocations = Object.freeze({ ...row.allocations });
      }
      waves.push(
        Object.freeze({
          waveIndex,
          typeKeys: Object.freeze(generated),
          ...(allocations === undefined ? {} : { allocations }),
        }),
      );
    }
  }
  const fangs = assessFangs(
    policy,
    authored,
    context.fangsRank ?? 0,
    context.roomSetKey,
    waves.flatMap((wave) => wave.typeKeys),
  );
  const menace = Object.freeze({
    rank: Math.max(0, Math.min(2, context.menaceRank ?? 0)),
    active: (context.menaceRank ?? 0) > 0,
    blocked: policy.blockMenace === true,
  });
  if (authored.fangs !== undefined && fangs.active && fangs.issue !== undefined)
    issues.push({ reason: 'fangs', issue: fangs.issue });
  if (waveCount === undefined) issues.push({ reason: 'required', field: 'waveCount' });
  if (typeof base !== 'number' && selectedBase === undefined)
    issues.push({ reason: 'required', field: 'baseRoll' });
  if (usesHighlight && authored.highlightKey === undefined)
    issues.push({ reason: 'required', field: 'highlight' });
  for (const wave of waveDomains) {
    const row = authored.waves?.find((entry) => entry.waveIndex === wave.waveIndex);
    if (row === undefined)
      issues.push({ reason: 'required', field: 'wave', waveIndex: wave.waveIndex });
    else {
      const keys = [
        ...(usesHighlight && highlight !== undefined ? [highlight.key] : []),
        ...row.typeKeys,
      ];
      if (sampledBudgetKeys(keys).some((key) => row.allocations?.[key] === undefined))
        issues.push({ reason: 'required', field: 'allocations', waveIndex: wave.waveIndex });
    }
  }
  if (
    fangs.active &&
    !policy.blockFangsAttributes &&
    fangs.eligibleTypeKeys.length > 0 &&
    authored.fangs === undefined
  )
    issues.push({ reason: 'fangs', issue: 'incomplete' });
  const completeCounts: (
    | {
        readonly waveIndex: number;
        readonly typeKeys: readonly string[];
        readonly sources: Readonly<Record<string, 'fixed' | 'template' | 'highlight' | 'addition'>>;
        readonly counts: Readonly<Record<string, number>>;
      }
    | undefined
  )[] = waves.map((wave) => {
    const preview = previewFor(wave.waveIndex, wave.typeKeys);
    if (preview === undefined || preview.some((entry) => entry.count === undefined))
      return undefined;
    return Object.freeze({
      waveIndex: wave.waveIndex,
      typeKeys: Object.freeze(preview.map((entry) => entry.key)),
      sources: Object.freeze(
        Object.fromEntries(
          preview.map(
            (entry) =>
              [
                entry.key,
                policy.fixedEnemies.some((fixed) => fixed.key === entry.key)
                  ? 'fixed'
                  : usesHighlight && entry.key === highlight?.key
                    ? 'highlight'
                    : policy.fixedEnemies.length > 0
                      ? 'template'
                      : 'addition',
              ] as const,
          ),
        ),
      ),
      counts: Object.freeze(Object.fromEntries(preview.map((entry) => [entry.key, entry.count!]))),
    });
  });
  const menaceOperands = menace.active
    ? completeCounts.flatMap((wave) => {
        if (wave === undefined) return [];
        const values =
          authored.menace?.find((entry) => entry.waveIndex === wave.waveIndex)?.conversions ?? {};
        return [
          Object.freeze({
            waveIndex: wave.waveIndex,
            conversions: Object.freeze(
              Object.entries(values).flatMap(([key, value]) => {
                const source =
                  choices.get(key) ?? policy.fixedEnemies.find((entry) => entry.key === key);
                // A removed source is dormant retained authorship, like an inactive
                // wave. It becomes assessable again only if that source returns.
                if (source === undefined || wave.counts[key] === undefined) return [];
                const maximum = wave.counts[key];
                const fact = policy.blockMenace
                  ? { kind: 'blocked' as const }
                  : (source?.menace ?? { kind: 'none' as const });
                if (fact.kind === 'blocked' || fact.kind === 'none') return [];
                if (value.count > maximum)
                  issues.push({
                    reason: 'menace',
                    issue: 'countUnavailable',
                    waveIndex: wave.waveIndex,
                    key,
                  });
                if (value.count > 0 && fact.kind === 'random' && value.targetKey === undefined)
                  issues.push({
                    reason: 'menace',
                    issue: 'targetRequired',
                    waveIndex: wave.waveIndex,
                    key,
                  });
                if (
                  value.count > 0 &&
                  value.targetKey !== undefined &&
                  (fact.kind !== 'random' || !fact.targetNativeIds.includes(value.targetKey))
                )
                  issues.push({
                    reason: 'menace',
                    issue: 'targetUnavailable',
                    waveIndex: wave.waveIndex,
                    key,
                  });
                return [
                  Object.freeze({
                    sourceKey: key,
                    sourceNativeId: source.nativeId,
                    count: value.count,
                    ...(fact.kind === 'mapped'
                      ? { targetNativeId: fact.targetNativeId }
                      : value.targetKey === undefined
                        ? {}
                        : { targetNativeId: value.targetKey }),
                  }),
                ];
              }),
            ),
          }),
        ];
      })
    : [];
  const supported = issues.length === 0;
  // Fangs and Menace are retained leaf children. Their stale values keep the
  // composition editable and do not erase exact count/domain products.
  const compositionSupported = issues.every(
    (issue) => issue.reason === 'fangs' || issue.reason === 'menace' || issue.reason === 'required',
  );
  const publishable =
    supported &&
    expectedBudget !== undefined &&
    waveCount !== undefined &&
    completeCounts.length === waveCount &&
    completeCounts.every((wave) => wave !== undefined);
  const operands: GeneratedEncounterOperands | undefined = !publishable
    ? undefined
    : Object.freeze({
        ...(typeof base === 'number' || authored.baseRoll === undefined
          ? {}
          : { baseRoll: authored.baseRoll }),
        expectedBudget,
        // Fixed wave declarations are just as concrete at installation time.
        waveCount,
        ...(authored.highlightKey === undefined || !possibleHighlight || waveCount === 1
          ? {}
          : { highlightKey: authored.highlightKey }),
        ...(authored.fangs === undefined ||
        !fangs.active ||
        fangs.eligibleTypeKeys.length === 0 ||
        fangs.issue !== undefined
          ? {}
          : { fangs: authored.fangs }),
        menace: Object.freeze(menaceOperands),
        waves: Object.freeze(
          completeCounts.filter((wave): wave is NonNullable<typeof wave> => wave !== undefined),
        ),
      });
  return Object.freeze({
    supported,
    issues: Object.freeze(issues.map((entry) => Object.freeze(entry))),
    ...(waveCount === undefined ? {} : { effectiveWaveCount: waveCount }),
    composition,
    eligibleHighlightKeys: Object.freeze(eligibleHighlights.map((choice) => choice.key)),
    fangs,
    menace,
    waves: Object.freeze(
      waveDomains.map((wave) => {
        const generated = waves.find((entry) => entry.waveIndex === wave.waveIndex)?.typeKeys;
        const waveBudget =
          budget?.kind === 'exact'
            ? (budget.waveBudgets as readonly number[])[wave.waveIndex - 1]
            : undefined;
        const fixedCost = policy.fixedEnemies.reduce(
          (sum, enemy) => sum + enemy.difficultyRating * (enemy.fixedCount ?? 1),
          0,
        );
        const equalAllocations =
          !compositionSupported || waveBudget === undefined || !generated?.length
            ? undefined
            : Object.freeze(
                Object.fromEntries(
                  sampledBudgetKeys(generated).map((key) => [
                    key,
                    Math.max(0, waveBudget - fixedCost) / generated.length,
                  ]),
                ),
              );
        return Object.freeze({
          ...wave,
          menaceSources: Object.freeze(
            !menace.active || menace.blocked
              ? []
              : Object.entries(
                  completeCounts.find((entry) => entry?.waveIndex === wave.waveIndex)?.counts ?? {},
                ).flatMap<
                  NonNullable<
                    GeneratedEncounterAssessment['waves'][number]['menaceSources']
                  >[number]
                >(([key, maximum]) => {
                  const fact = (
                    choices.get(key) ?? policy.fixedEnemies.find((entry) => entry.key === key)
                  )?.menace;
                  if (fact?.kind === 'mapped')
                    return [{ sourceKey: key, maximum, targetNativeId: fact.targetNativeId }];
                  if (fact?.kind === 'random')
                    return [{ sourceKey: key, maximum, targetNativeIds: fact.targetNativeIds }];
                  return [];
                }),
          ),
          sampledBudgetKeys: Object.freeze(sampledBudgetKeys(generated ?? [])),
          ...(equalAllocations === undefined ? {} : { equalAllocations }),
          typeCount: Object.freeze(wave.typeCount),
          additionalTypeCount: Object.freeze(wave.additionalTypeCount),
        });
      }),
    ),
    ...(operands === undefined ? {} : { operands }),
    knownRunBlacklistAdditions: Object.freeze(compositionSupported ? [...knownAdditions] : []),
    ...(typeof base === 'number'
      ? {}
      : {
          budgetDomain: Object.freeze({
            baseRoll: Object.freeze({ min: base.min, max: base.max }),
            total: Object.freeze({
              min: totalBudget(policy, context, base.min),
              max: totalBudget(policy, context, base.max),
            }),
          }),
        }),
    ...(budget === undefined ? {} : { budget }),
  });
}

/** Construct only on explicit Customize, using the same ordered candidate domains
 * and final validator as authoring. The finite wave/slot tree backtracks when a
 * locally legal prefix strands a later wave. */
export function initializeGeneratedEncounter(
  policy: GeneratedEncounterSelection,
  context: EncounterGenerationContext,
): AuthoredGeneratedEncounterCustomization | undefined {
  const assess = (value: AuthoredGeneratedEncounterCustomization) =>
    assessGeneratedEncounter(policy, value, context);
  const finish = (
    value: AuthoredGeneratedEncounterCustomization,
  ): AuthoredGeneratedEncounterCustomization | undefined => {
    const assessment = assess(value);
    const budgeted = {
      ...value,
      waves: value.waves!.map((wave) => {
        const allocations = assessment.waves.find(
          (entry) => entry.waveIndex === wave.waveIndex,
        )?.equalAllocations;
        return {
          ...wave,
          ...(allocations === undefined || Object.keys(allocations).length === 0
            ? {}
            : { allocations }),
        };
      }),
    };
    const result = assess(budgeted);
    if (result.supported && result.operands !== undefined) return budgeted;
    if (!result.fangs?.active || policy.blockFangsAttributes) return undefined;
    for (const typeKey of result.fangs.eligibleTypeKeys) {
      let selected = { ...budgeted, fangs: { typeKey, perkKeys: [] as string[] } };
      for (let count = 0; count <= 2; count++) {
        const next = assess(selected);
        if (next.supported && next.operands !== undefined) return selected;
        const perk = next.fangs?.eligiblePerkKeys[0];
        if (perk === undefined) break;
        selected = {
          ...selected,
          fangs: { typeKey, perkKeys: [...selected.fangs.perkKeys, perk] },
        };
      }
    }
    return undefined;
  };
  const visit = (
    value: AuthoredGeneratedEncounterCustomization,
    waveIndex: number,
  ): AuthoredGeneratedEncounterCustomization | undefined => {
    if (waveIndex > value.waveCount!) return finish(value);
    const row = value.waves?.find((entry) => entry.waveIndex === waveIndex);
    if (row === undefined)
      return visit(
        {
          ...value,
          waves: [...(value.waves ?? []), { waveIndex, typeKeys: [] }],
        },
        waveIndex,
      );
    const assessment = assess(value);
    const wave = assessment.waves.find((entry) => entry.waveIndex === waveIndex);
    if (wave === undefined) return undefined;
    if (row.typeKeys.length >= wave.additionalTypeCount.min || wave.exhausted) {
      const result = visit(value, waveIndex + 1);
      if (result !== undefined) return result;
    }
    if (row.typeKeys.length >= wave.additionalTypeCount.max) return undefined;
    for (const key of wave.eligibleKeysByPosition[row.typeKeys.length] ?? []) {
      const result = visit(
        {
          ...value,
          waves: value.waves!.map((entry) =>
            entry === row ? { ...entry, typeKeys: [...entry.typeKeys, key] } : entry,
          ),
        },
        waveIndex,
      );
      if (result !== undefined) return result;
    }
    return undefined;
  };
  for (let waveCount = policy.waveCount.min; waveCount <= policy.waveCount.max; waveCount++) {
    const base: AuthoredGeneratedEncounterCustomization = {
      kind: 'generated',
      waveCount,
      ...(typeof policy.budget.base === 'number' ? {} : { baseRoll: policy.budget.base.min }),
    };
    if (waveCount === 1) {
      const result = visit(base, 1);
      if (result !== undefined) return result;
    } else {
      for (const highlightKey of assess(base).eligibleHighlightKeys) {
        const result = visit({ ...base, highlightKey }, 1);
        if (result !== undefined) return result;
      }
    }
  }
  return undefined;
}

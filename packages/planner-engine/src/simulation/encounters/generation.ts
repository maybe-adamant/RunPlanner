import type { EncounterEnemyChoice, GeneratedEncounterSelection } from '../../catalog-schema';
import type { AuthoredGeneratedEncounterCustomization } from '../../authored-project/model';

export interface EncounterGenerationContext {
  readonly biomeDepthCache: number;
  readonly biomeEncounterDepth: number;
  /** Only consequences of earlier explicit, valid ordinary additions are known. */
  readonly knownRunBlacklist: readonly string[];
}

export interface GeneratedEncounterOperands {
  readonly waveCount?: number;
  readonly highlightKey?: string;
  readonly waves?: readonly {
    readonly waveIndex: number;
    /** Complete generated roster, including highlight, excluding fixed spawns. */
    readonly typeKeys: readonly string[];
    readonly shares?: readonly number[];
  }[];
}

export interface GeneratedEncounterAssessment {
  readonly supported: boolean;
  readonly issues: readonly GeneratedEncounterIssue[];
  readonly effectiveWaveCount?: number;
  readonly composition: 'active' | 'nativeWaveCount' | 'nativeHighlight';
  readonly eligibleHighlightKeys: readonly string[];
  readonly waves: readonly {
    readonly waveIndex: number;
    /** Complete native count, including fixed/template and highlight members. */
    readonly typeCount: { readonly min: number; readonly max: number };
    /** Editable generated additions after the declaration-owned seeds. */
    readonly additionalTypeCount: { readonly min: number; readonly max: number };
    readonly seeds: readonly { readonly key: string; readonly kind: 'fixed' | 'highlight' }[];
    /** A legal native roster can stop below the declared minimum when its pool is exhausted. */
    readonly exhausted: boolean;
    /** One domain per legal editable position; never includes a trailing dead slot. */
    readonly eligibleKeysByPosition: readonly (readonly string[])[];
  }[];
  readonly operands?: GeneratedEncounterOperands;
  readonly knownRunBlacklistAdditions: readonly string[];
}

export type GeneratedEncounterIssue =
  | {
      readonly reason: 'waveCount';
      readonly actual: number;
      readonly allowed: { readonly min: number; readonly max: number };
    }
  | { readonly reason: 'highlight'; readonly key: string }
  | { readonly reason: 'waveOutsideCount'; readonly waveIndex: number; readonly allowed: number }
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
  | { readonly reason: 'weightMembers'; readonly waveIndex: number };

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
      ? 'nativeWaveCount'
      : usesHighlight && authored.highlightKey === undefined
        ? 'nativeHighlight'
        : 'active';
  const waveDomains: {
    waveIndex: number;
    typeCount: { min: number; max: number };
    additionalTypeCount: { min: number; max: number };
    seeds: readonly { readonly key: string; readonly kind: 'fixed' | 'highlight' }[];
    exhausted: boolean;
    eligibleKeysByPosition: readonly (readonly string[])[];
  }[] = [];
  const waves: NonNullable<GeneratedEncounterOperands['waves']>[number][] = [];
  if (
    composition === 'active' &&
    waveCount !== undefined &&
    (!usesHighlight || highlight !== undefined)
  ) {
    if (usesHighlight && highlight !== undefined) encounterBlacklist.add(highlight.key);
    for (const row of authored.waves ?? [])
      if (row.waveIndex > waveCount)
        issues.push({ reason: 'waveOutsideCount', waveIndex: row.waveIndex, allowed: waveCount });
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
        exhausted,
        eligibleKeysByPosition: Object.freeze(positions),
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
      let shares: readonly number[] | undefined;
      if (row.weights !== undefined) {
        const keys = Object.keys(row.weights);
        if (
          generated.length < 2 ||
          keys.length !== generated.length ||
          generated.some((key) => row.weights?.[key] === undefined) ||
          keys.some((key) => !generated.includes(key))
        )
          issues.push({ reason: 'weightMembers', waveIndex });
        else {
          const total = generated.reduce((sum, key) => sum + row.weights![key]!, 0);
          shares = Object.freeze(generated.map((key) => row.weights![key]! / total));
        }
      }
      waves.push(
        Object.freeze({
          waveIndex,
          typeKeys: Object.freeze(generated),
          ...(shares === undefined ? {} : { shares }),
        }),
      );
    }
  }
  const supported = issues.length === 0;
  const operands: GeneratedEncounterOperands = Object.freeze({
    ...(authored.waveCount === undefined ? {} : { waveCount: authored.waveCount }),
    ...(authored.highlightKey === undefined || !possibleHighlight || waveCount === 1
      ? {}
      : { highlightKey: authored.highlightKey }),
    ...(waves.length === 0 ? {} : { waves: Object.freeze(waves) }),
  });
  return Object.freeze({
    supported,
    issues: Object.freeze(issues.map((entry) => Object.freeze(entry))),
    ...(waveCount === undefined ? {} : { effectiveWaveCount: waveCount }),
    composition,
    eligibleHighlightKeys: Object.freeze(eligibleHighlights.map((choice) => choice.key)),
    waves: Object.freeze(
      waveDomains.map((wave) =>
        Object.freeze({
          ...wave,
          typeCount: Object.freeze(wave.typeCount),
          additionalTypeCount: Object.freeze(wave.additionalTypeCount),
        }),
      ),
    ),
    ...(supported && Object.keys(operands).length !== 0 ? { operands } : {}),
    knownRunBlacklistAdditions: Object.freeze(supported ? [...knownAdditions] : []),
  });
}

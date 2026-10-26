import type {
  AuthoredKeepsakeEquipResultValue,
  ProjectCommand,
  SemanticAddress,
} from '../../authored-project';
import type { ProjectCandidateSession } from '../candidates/session';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import {
  acquisitionConversionCandidateForProjectEvaluationAssembly,
  levelResolutionCandidateForProjectEvaluationAssembly,
} from '../evaluation/project-evaluation-assembly';
import type { SemanticFinding } from '../model';

/** What a sampled repair borrows from the walk. */
export interface DraftSampleContext {
  readonly assembly: () => ProjectEvaluationAssembly;
  readonly evaluate: ProjectCandidateSession['evaluate'];
  readonly apply: (command: ProjectCommand) => boolean;
  readonly shuffle: <T>(values: readonly T[]) => T[];
  /** The draft's guard on a trait a keepsake equip result would add, read at the current state. */
  readonly traitGuard: () => (traitKey: string) => boolean;
}

/** Steady Growth's target: a random eligible trait, or the empty no-op. */
export function sampleSteadyGrowth(
  context: DraftSampleContext,
  outcome: Extract<SemanticAddress, { readonly kind: 'steadyGrowthOutcome' }>,
): boolean {
  const probe = context.evaluate({
    kind: 'steadyGrowthOutcome',
    outcome,
    targetTraitKey: undefined,
  });
  if (probe.kind !== 'steadyGrowthOutcome') return false;
  const targets: (string | null)[] = probe.result.emptyNoOp
    ? [null]
    : context.shuffle(probe.result.eligibleTargetKeys);
  for (const targetTraitKey of targets) {
    const evaluation = context.evaluate({ kind: 'steadyGrowthOutcome', outcome, targetTraitKey });
    if (evaluation.kind === 'steadyGrowthOutcome' && !evaluation.result.selectedPossible) continue;
    if (context.apply({ kind: 'ReplaceSteadyGrowthTarget', outcome, targetTraitKey })) return true;
  }
  return false;
}

/** A Phial fountain's target from the finding's eligible traits. */
export function sampleFountainRarity(
  context: DraftSampleContext,
  outcome: Extract<SemanticAddress, { readonly kind: 'fountainRarityOutcome' }>,
  reason: SemanticFinding,
): boolean {
  const keys = reason.evidence['eligibleTargetKeys'];
  if (!Array.isArray(keys)) return false;
  for (const targetTraitKey of context.shuffle(
    keys.filter((k): k is string => typeof k === 'string'),
  )) {
    const evaluation = context.evaluate({ kind: 'fountainRarityOutcome', outcome, targetTraitKey });
    if (evaluation.kind === 'fountainRarityOutcome' && !evaluation.result.selectedPossible)
      continue;
    if (context.apply({ kind: 'ReplaceFountainRarityTarget', outcome, targetTraitKey }))
      return true;
  }
  return false;
}

/**
 * A keepsake's equip result: the player's own choice when it is possible here and its trait
 * the draft allows, else one of the possible ones whose trait the draft allows.
 */
export function sampleKeepsakeEquipResult(
  context: DraftSampleContext,
  result: Extract<SemanticAddress, { readonly kind: 'keepsakeEquipResult' }>,
  preferred?: DraftKeepsakeEquipValue,
): boolean {
  const traitAllowed = context.traitGuard();
  const command = (value: DraftKeepsakeEquipValue) =>
    (result.resultKind === 'jeweledPom'
      ? { kind: 'ReplaceJeweledPomEquipResult', result, value }
      : result.resultKind === 'experimentalHammer'
        ? { kind: 'ReplaceExperimentalHammerEquipResult', result, value }
        : { kind: 'ReplaceTranscendentEmbryoEquipResult', result, value }) as ProjectCommand;
  if (preferred !== undefined && (!('traitKey' in preferred) || traitAllowed(preferred.traitKey))) {
    const own = context.evaluate({ kind: 'keepsakeEquipResult', result, value: preferred });
    if (
      own.kind === 'keepsakeEquipResult' &&
      own.result.selectedPossible &&
      context.apply(command(preferred))
    )
      return true;
  }
  const evaluation = context.evaluate({ kind: 'keepsakeEquipResult', result });
  if (evaluation.kind !== 'keepsakeEquipResult') return false;
  const allowed = evaluation.result.options.filter(
    (option) =>
      option.selectedPossible &&
      (!('traitKey' in option.value) || traitAllowed(option.value.traitKey)),
  );
  for (const option of context.shuffle(allowed))
    if (context.apply(command(option.value))) return true;
  return false;
}

/** One keepsake equip result value: a Jeweled Pom trait, a Hammer pick or an Embryo blessing. */
export type DraftKeepsakeEquipValue = NonNullable<AuthoredKeepsakeEquipResultValue>;

/** Figurine and Judgment: a random set of the required count among inactive Arcana. */
export function sampleArcanaChoice(
  context: DraftSampleContext,
  origin: Extract<SemanticAddress, { readonly kind: 'figurineArcana' | 'judgmentArcana' }>,
): boolean {
  const assess = (arcanaKeys: readonly string[]) => {
    const evaluation =
      origin.kind === 'figurineArcana'
        ? context.evaluate({ kind: 'figurineArcana', figurine: origin, arcanaKeys })
        : context.evaluate({ kind: 'judgmentArcana', judgment: origin, arcanaKeys });
    return evaluation.kind === 'figurineArcana' || evaluation.kind === 'judgmentArcana'
      ? evaluation.result
      : undefined;
  };
  const probe = assess([]);
  if (probe === undefined) return false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const arcanaKeys = context.shuffle(probe.inactiveArcanaKeys).slice(0, probe.requiredCount);
    const result = assess(arcanaKeys);
    if (result === undefined || !result.selectedPossible || result.findings.length > 0) continue;
    if (
      context.apply(
        origin.kind === 'figurineArcana'
          ? { kind: 'ReplaceFigurineArcana', figurine: origin, arcanaKeys }
          : { kind: 'ReplaceJudgmentArcana', judgment: origin, arcanaKeys },
      )
    )
      return true;
  }
  return false;
}

/** A Hex's activated nodes, drawn one at a time from the available ones. */
export function sampleHexActivation(
  context: DraftSampleContext,
  acquisition: Extract<SemanticAddress, { readonly kind: 'acquisitionRole' }>,
): boolean {
  const capability = acquisitionConversionCandidateForProjectEvaluationAssembly(
    context.assembly(),
    acquisition,
  )?.hexActivation;
  if (capability === undefined) return false;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const selectedNodeKeys: string[] = [];
    while (selectedNodeKeys.length < capability.count) {
      const available = capability.availableNodeKeys(selectedNodeKeys);
      if (available.length === 0) break;
      selectedNodeKeys.push(context.shuffle(available)[0]!);
    }
    if (capability.assess(selectedNodeKeys).length > 0) continue;
    if (context.apply({ kind: 'ReplaceHexActivation', acquisition, value: { selectedNodeKeys } }))
      return true;
  }
  return false;
}

/** A Pom-like level resolution: a random target, or a random offered set and pick. */
export function sampleLevelResolution(
  context: DraftSampleContext,
  levelResolution: Extract<SemanticAddress, { readonly kind: 'levelResolution' }>,
): boolean {
  const capability = levelResolutionCandidateForProjectEvaluationAssembly(
    context.assembly(),
    levelResolution,
  );
  if (capability === undefined) return false;
  for (const [branchIndex, branch] of capability.branches.entries()) {
    const targets = context.shuffle(branch.eligibleTargetTraitKeys);
    const offered = targets.slice(0, branch.requiredOfferCount);
    for (const targetTraitKey of branch.effectKind === 'choice' ? offered : targets) {
      const value =
        branch.effectKind === 'random'
          ? ({ kind: 'random', targetTraitKey } as const)
          : ({
              kind: 'choice',
              offeredTraitKeys: offered,
              selectedTraitKey: targetTraitKey,
            } as const);
      if (capability.evaluate(value)[branchIndex]?.supported !== true) continue;
      if (context.apply({ kind: 'ReplaceLevelResolution', levelResolution, value })) return true;
    }
  }
  return false;
}

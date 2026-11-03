import {
  assembleExecutionProduct,
  compileExecutionPlan,
  encodeExecutionPlan,
  ExecutionCompilerError,
} from '@run-planner/engine/execution-plan';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

import { canonicalDigest, sha256, type CanonicalDigest } from './canonical';
import { probeCandidates } from './candidate-probe';
import type { EquivalenceEntry } from './corpus';

export const equivalenceSections = ['simulation', 'plan', 'candidates'] as const;
export type EquivalenceSection = (typeof equivalenceSections)[number];

export interface SectionProduct {
  readonly digest: string;
  /** The canonical tree behind the digest; absent for a plan refusal. */
  readonly canonical?: CanonicalDigest;
}

export type EquivalenceProducts = Readonly<Record<EquivalenceSection, SectionProduct>>;

function planSection(
  entry: EquivalenceEntry,
  assembly: ReturnType<typeof simulateProjectAssembly>,
): SectionProduct {
  try {
    const product = assembleExecutionProduct({
      assembly,
      catalog: entry.catalog,
    });
    // The digest covers the exact wire bytes outside the schema pair and the fingerprint
    // over it; the canonical tree only locates a change.
    const contents = JSON.parse(encodeExecutionPlan(compileExecutionPlan({ product }))) as Record<
      string,
      unknown
    >;
    delete contents.schemaVersion;
    delete contents.schemaRevision;
    delete contents.planFingerprint;
    const encoded = JSON.stringify(contents);
    return { digest: sha256(encoded), canonical: canonicalDigest(contents) };
  } catch (error) {
    if (!(error instanceof ExecutionCompilerError)) throw error;
    return { digest: `refused:${error.code}` };
  }
}

/** Purchase price contexts and gold events are additive gold guidance outside simulation semantics. */
function withoutGoldGuidance(
  evaluation: ReturnType<typeof simulateProjectAssembly>['evaluation'],
): unknown {
  return {
    ...evaluation,
    route: {
      ...evaluation.route,
      biomes: evaluation.route.biomes.map((biome) => {
        if (!('rewards' in biome)) return biome;
        const rewards: Record<string, unknown> = { ...biome.rewards };
        delete rewards.purchasePriceContexts;
        delete rewards.goldEvents;
        return { ...biome, rewards };
      }),
    },
  };
}

type Plain = Readonly<Record<string, unknown>>;
const isPlain = (value: unknown): value is Plain =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Map) &&
  !(value instanceof Set);
const hasKeys = (value: Plain, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);
const exactCount = (count: unknown) => ({ kind: 'exact', count });

/**
 * The recorded baseline predates the single-state frontier: it published each
 * reached state as a one-entry branch list and each Run State bag count as an
 * exact count. This maps current products onto that shape, so the baseline
 * still witnesses unchanged semantics; it goes when the baseline is re-recorded.
 */
function branchListShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(branchListShape);
  if (value instanceof Map)
    return new Map([...value].map(([key, entry]) => [key, branchListShape(entry)]));
  if (value instanceof Set) return new Set([...value].map(branchListShape));
  if (!isPlain(value)) return value;
  // Non-enumerable data properties are part of the digest, so copy descriptors.
  const next: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    Object.defineProperty(next, key, {
      ...descriptor,
      writable: true,
      configurable: true,
      value: branchListShape(descriptor.value),
    });
  }
  if ('frontier' in value && 'validity' in value && 'runStateSnapshots' in value) {
    next.branches = value.frontier === undefined ? [] : [next.frontier];
    delete next.frontier;
  }
  // Nemesis random-event support published its one assessment as a branch list.
  if ('familyKeys' in value && 'traitTradeRewardType' in value) {
    next.branches = next.assessment === undefined ? [] : [next.assessment];
    delete next.assessment;
  }
  // A selected trait offer or Pom published its one assessment as a branch list.
  if ('assessment' in value && value.reached === true && 'chronologicalIndex' in value) {
    next.branches = [next.assessment];
    delete next.assessment;
  }
  // Timed outcomes published their one threshold's facts as branch lists.
  if ('requiredInterval' in value && 'progressBefore' in value && 'phaseKey' in value) {
    next.requiredIntervals = [value.requiredInterval];
    next.progressBefore = [value.progressBefore];
    delete next.requiredInterval;
  }
  if ('transformationRarity' in value && 'progressBefore' in value && 'phaseKey' in value) {
    next.transformationRarities = [value.transformationRarity];
    next.progressBefore = [value.progressBefore];
    delete next.transformationRarity;
  }
  if (
    hasKeys(value, ['origin', 'historySequence', 'state']) ||
    hasKeys(value, ['owner', 'gameName', 'state'])
  ) {
    next.states = [next.state];
    delete next.state;
  }
  if (
    typeof value.remaining === 'number' &&
    ('storeKey' in value ||
      'conditions' in value ||
      'requirement' in value ||
      Object.keys(value).length === 1)
  )
    next.remaining = exactCount(value.remaining);
  return next;
}

const supportList = (support: unknown) => [support !== 'impossible'];
const listOf = (value: unknown) => (value === undefined ? [] : [value]);

/**
 * The recorded candidate baseline published every trait-offer product per
 * reached branch, with branch support lists and agreement flags. Each offer
 * now answers at its one reached state; this maps those single products onto
 * the recorded one-entry lists.
 */
function candidateBranchShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(candidateBranchShape);
  if (!isPlain(value)) return value;
  const next: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    Object.defineProperty(next, key, {
      ...descriptor,
      writable: true,
      configurable: true,
      value: candidateBranchShape(descriptor.value),
    });
  }
  const result = next.result as Record<string, unknown> | undefined;
  if (isPlain(result)) {
    switch (value.kind) {
      case 'traitOffer':
        if ('assessments' in result && 'findings' in result) {
          const shaped: Record<string, unknown> = { ...result };
          shaped.branches = listOf(shaped.state);
          delete shaped.state;
          shaped.callingCard = listOf(shaped.callingCard);
          shaped.concaveStone = listOf(shaped.concaveStone);
          shaped.chaosOfferRules = listOf(shaped.chaosOfferRules);
          next.result = shaped;
        }
        break;
      case 'traitOfferFocusedOption':
        next.result = {
          ...result,
          branches: [{ supported: result.supported, evidence: result.evidence }],
        };
        break;
      case 'traitAcquisitionTarget':
      case 'naturalSelectionResult':
        next.result = { ...result, branchSupport: [result.supported] };
        break;
      case 'latestModelTargetsDomain':
        next.result = { ...result, branchAgreement: true };
        break;
      case 'circeResolutionDomain': {
        const { activeArcana, ...rest } = result;
        next.result = { ...rest, activeArcanaByBranch: [activeArcana], branchAgreement: true };
        break;
      }
      case 'ransomAssessment':
        next.result = { assessments: [result.assessment], branchAgreement: true };
        break;
      case 'steadyGrowthOutcome': {
        const { requiredInterval, ...rest } = result;
        next.result = {
          ...rest,
          requiredIntervals: [requiredInterval],
          branchSupport: [result.selectedPossible],
        };
        break;
      }
      case 'transcendentEmbryoOutcome':
        next.result = { ...result, branchSupport: [result.selectedPossible] };
        break;
      case 'fountainRarityOutcome':
        next.result = {
          ...result,
          branchSupport: (result.mutationTargetKeys as readonly string[]).map(
            () => result.targetRequired,
          ),
        };
        break;
      case 'concaveStone':
        next.result = { branches: listOf(result.stone) };
        break;
    }
  }
  if (
    hasKeys(value, ['value', 'support', 'selected']) ||
    hasKeys(value, ['value', 'support', 'selected', 'reason'])
  )
    next.branchSupport = supportList(value.support);
  if ('option' in value && 'support' in value && 'targetRequired' in value)
    next.branchSupport = supportList(value.support);
  return next;
}

export function equivalenceProducts(entry: EquivalenceEntry): EquivalenceProducts {
  const project = entry.project();
  const assembly = simulateProjectAssembly(entry.catalog, project);
  // `simulateProject` publishes exactly this assembly's evaluation.
  const simulation = canonicalDigest(branchListShape(withoutGoldGuidance(assembly.evaluation)));
  const plan = planSection(entry, assembly);
  const session = createPreparedProjectCandidateSession(entry.catalog, assembly);
  const candidates = canonicalDigest(
    probeCandidates(entry.catalog, project, session).map((record) => ({
      ...record,
      outcome:
        record.probe === 'chaosOfferDomain' && isPlain(record.outcome) && 'value' in record.outcome
          ? { value: listOf(record.outcome.value) }
          : candidateBranchShape(record.outcome),
    })),
  );
  return Object.freeze({
    simulation: { digest: simulation.root, canonical: simulation },
    plan,
    candidates: { digest: candidates.root, canonical: candidates },
  });
}

/** One baseline line: the three section digests in section order. */
export function entryDigest(products: EquivalenceProducts): string {
  return equivalenceSections.map((section) => products[section].digest).join(' ');
}

export function parseEntryDigest(line: string): Readonly<Record<EquivalenceSection, string>> {
  const parts = line.split(' ');
  if (parts.length !== equivalenceSections.length)
    throw new Error(`malformed equivalence baseline line: ${line}`);
  return Object.freeze(
    Object.fromEntries(equivalenceSections.map((section, index) => [section, parts[index]!])),
  ) as Readonly<Record<EquivalenceSection, string>>;
}

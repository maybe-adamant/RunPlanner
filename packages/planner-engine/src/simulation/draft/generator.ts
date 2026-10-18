import type { Catalog } from '../../catalog-schema';
import {
  createRouteAddress,
  type ProjectCommand,
  type ProjectDocument,
} from '../../authored-project';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { simulateProjectAssembly } from '../evaluation/project';
import {
  draftHalfTarget,
  draftReport,
  heldFromGiver,
  latestRunState,
  type DraftReport,
  type DraftSupply,
} from './report';
import { draftLoadoutProject, draftRefusals, type DraftRefusal, type DraftSpec } from './spec';
import { createDraftRng, DraftWalk } from './walk';

export interface DraftBudget {
  /** Wall-clock budget for the whole draft; at least one attempt runs per biome. */
  readonly milliseconds: number;
  /** Attempts per biome, keeping the best by target coverage. */
  readonly attemptsPerBiome: number;
  /** Decisions one biome attempt may take before it is abandoned. */
  readonly maxStepsPerBiome: number;
}

export const DEFAULT_DRAFT_BUDGET: DraftBudget = Object.freeze({
  milliseconds: 60_000,
  attemptsPerBiome: 4,
  maxStepsPerBiome: 600,
});

export type DraftResult =
  | { readonly kind: 'refused'; readonly refusals: readonly DraftRefusal[] }
  | {
      readonly kind: 'failed';
      readonly biomeKey: string;
      readonly reasons: readonly string[];
    }
  | {
      readonly kind: 'drafted';
      /** One semantic command that installs the drafted loadout and biomes. */
      readonly command: Extract<ProjectCommand, { readonly kind: 'ReplaceRoute' }>;
      readonly project: ProjectDocument;
      readonly report: DraftReport;
      readonly attempts: number;
    };

/** Whether the walk holds its half's Hermes and Hammer target after this biome. */
function halfSupply(
  catalog: Catalog,
  walk: DraftWalk,
  biomeIndex: number,
  biomeCount: number,
): readonly { readonly supply: DraftSupply; readonly met: boolean }[] {
  const snapshot = latestRunState(walk.assembly);
  const target = draftHalfTarget(biomeIndex, biomeCount);
  return [
    { supply: 'hermes', met: heldFromGiver(catalog, snapshot, 'Hermes') >= target },
    { supply: 'hammer', met: heldFromGiver(catalog, snapshot, 'WeaponUpgrade') >= target },
  ];
}

function attemptSeed(seed: number, biomeIndex: number, attempt: number): number {
  return (seed * 1_000_003 + biomeIndex * 7_919 + attempt * 104_729) >>> 0;
}

/**
 * Drafts a zero-finding plan for the base project's route inside the spec's
 * world, biome by biome. A biome that dead-ends or misses its own targets is
 * retried from its predecessor, which the biome evaluation cache keeps cheap.
 */
export function draftProject(
  catalog: Catalog,
  base: ProjectDocument,
  spec: DraftSpec,
  seed: number,
  budget: DraftBudget = DEFAULT_DRAFT_BUDGET,
): DraftResult {
  const refusals = draftRefusals(catalog, base, spec.loadout);
  if (refusals.length > 0) return Object.freeze({ kind: 'refused', refusals });
  const deadline = Date.now() + budget.milliseconds;
  let current: ProjectEvaluationAssembly = simulateProjectAssembly(
    catalog,
    draftLoadoutProject(catalog, base, spec.loadout),
  );
  const biomeKeys = current.project.route.biomes.map((biome) => biome.biomeKey);
  let attempts = 0;
  for (const [biomeIndex, biomeKey] of biomeKeys.entries()) {
    let best: { assembly: ProjectEvaluationAssembly; score: number } | undefined;
    const reasons: string[] = [];
    for (let attempt = 0; attempt < budget.attemptsPerBiome; attempt += 1) {
      if (attempt > 0 && Date.now() > deadline) break;
      attempts += 1;
      const walk = new DraftWalk(
        catalog,
        current,
        spec,
        createDraftRng(attemptSeed(seed, biomeIndex, attempt)),
      );
      if (!walk.runBiome(biomeIndex, budget.maxStepsPerBiome)) {
        reasons.push(walk.failure ?? 'unknown');
        continue;
      }
      const report = draftReport(catalog, spec, walk.assembly);
      const halves = halfSupply(catalog, walk, biomeIndex, biomeKeys.length);
      const score = report.met + halves.filter((half) => half.met).length;
      if (best === undefined || score > best.score) best = { assembly: walk.assembly, score };
      const localMet = report.targets.every((target) => target.biomeKey !== biomeKey || target.met);
      // An unmet half target ends the biome only when no decision could take it here.
      if (localMet && halves.every((half) => half.met || !walk.legalSupply.has(half.supply))) break;
    }
    if (best === undefined) return Object.freeze({ kind: 'failed', biomeKey, reasons });
    current = best.assembly;
  }
  const evaluation = current.evaluation;
  if (evaluation.status !== 'valid' || evaluation.findings.length > 0)
    return Object.freeze({
      kind: 'failed',
      biomeKey: biomeKeys.at(-1) ?? '',
      reasons: [`route ${evaluation.status}`],
    });
  const { runModifiers: _runModifiers, ...loadout } = current.project.route.loadout;
  void _runModifiers;
  return Object.freeze({
    kind: 'drafted',
    command: Object.freeze({
      kind: 'ReplaceRoute',
      route: createRouteAddress(base.route.routeKey),
      loadout,
      biomes: current.project.route.biomes,
    }),
    project: current.project,
    report: draftReport(catalog, spec, current),
    attempts,
  });
}

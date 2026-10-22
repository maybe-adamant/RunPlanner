import type { Catalog } from '../../catalog-schema';
import {
  createRouteAddress,
  type ProjectCommand,
  type ProjectDocument,
} from '../../authored-project';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { simulateProjectAssembly } from '../evaluation/project';
import { draftEncounters } from './encounters';
import { draftGodSchedule } from './schedule';
import { draftReport, type DraftReport } from './report';
import { draftRefusals, type DraftRefusal } from './refusals';
import { draftLoadoutProject, type DraftSpec } from './spec';
import { createDraftRng } from './rng';
import { DraftWalk } from './walk';
import { DEFAULT_DRAFT_RETRIES_PER_BIOME } from '../../authored-project/draft-spec';
import { draftWorld } from './world';

/** Attempt counts alone bound the search, so a seed drafts the same route on any machine. */
export interface DraftBudget {
  /**
   * Further attempts per biome after its first success, keeping the best by target coverage;
   * the spec's retries per biome take precedence.
   */
  readonly attemptsPerBiome: number;
  /** Dead-end attempts a biome may take before any succeeds; then the draft fails. */
  readonly maxFailedAttemptsPerBiome: number;
  /** Decisions one biome attempt may take before it is abandoned. */
  readonly maxStepsPerBiome: number;
}

export const DEFAULT_DRAFT_BUDGET: DraftBudget = Object.freeze({
  attemptsPerBiome: DEFAULT_DRAFT_RETRIES_PER_BIOME,
  maxFailedAttemptsPerBiome: 16,
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

/**
 * A met story or field NPC outweighs a basket trait, which also scores as a met scheduled target,
 * so an attempt that visits its NPCs beats one with one more due trait.
 */
const NPC_TARGET_WEIGHT = 3;

function targetWeight(target: DraftReport['targets'][number]): number {
  return target.kind === 'storyNpc' || target.kind === 'fieldNpc' ? NPC_TARGET_WEIGHT : 1;
}

/** An attempt's score: its met targets, NPCs weighted above traits, its met scheduled targets, less wasted Hermes. */
export function draftAttemptScore(
  report: DraftReport,
  scheduled: readonly { readonly met: boolean }[],
  wastedHermes: number,
): number {
  return (
    report.targets.reduce((sum, target) => sum + (target.met ? targetWeight(target) : 0), 0) +
    scheduled.filter((target) => target.met).length -
    wastedHermes
  );
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
  const refusals = draftRefusals(catalog, base, spec);
  if (refusals.length > 0) return Object.freeze({ kind: 'refused', refusals });
  let current: ProjectEvaluationAssembly = simulateProjectAssembly(
    catalog,
    draftLoadoutProject(catalog, base, spec.loadout),
  );
  const biomeKeys = current.project.route.biomes.map((biome) => biome.biomeKey);
  const world = draftWorld(catalog, current.project.route, spec.world, spec.basketTraitKeys);
  const schedule = draftGodSchedule(
    catalog,
    current.project.route,
    spec,
    world,
    createDraftRng((seed * 2_654_435_761) >>> 0),
  );
  let attempts = 0;
  // A Duo declined in a short biome keeps its escalated chance in the next.
  let duoDeclines: ReadonlyMap<string, number> = new Map();
  for (const [biomeIndex, biomeKey] of biomeKeys.entries()) {
    let best:
      | {
          assembly: ProjectEvaluationAssembly;
          duoDeclines: ReadonlyMap<string, number>;
          score: number;
          localMet: boolean;
        }
      | undefined;
    const reasons: string[] = [];
    let afterSuccess = 0;
    let supplyRetried = false;
    for (
      let attempt = 0;
      best === undefined
        ? reasons.length < budget.maxFailedAttemptsPerBiome
        : afterSuccess < (spec.retriesPerBiome ?? budget.attemptsPerBiome);
      attempt += 1
    ) {
      attempts += 1;
      if (best !== undefined) afterSuccess += 1;
      const walk = new DraftWalk(
        catalog,
        current,
        spec,
        createDraftRng(attemptSeed(seed, biomeIndex, attempt)),
        schedule,
        world,
        duoDeclines,
      );
      if (!walk.runBiome(biomeIndex, budget.maxStepsPerBiome)) {
        reasons.push(walk.failure ?? 'unknown');
        continue;
      }
      const report = draftReport(catalog, spec, walk.assembly);
      const scheduled = walk.scheduledTargets();
      const score = draftAttemptScore(report, scheduled, walk.wastedHermes());
      // An NPC basket trait is this biome's own target, like its NPC.
      const localMet = report.targets.every(
        (target) =>
          target.met ||
          (target.kind === 'basketTrait'
            ? world.npcTraitBiomes.get(target.key) !== biomeIndex
            : target.biomeKey !== biomeKey),
      );
      // On a tie, an attempt that meets this biome's own targets wins.
      if (
        best === undefined ||
        score > best.score ||
        (score === best.score && localMet && !best.localMet)
      )
        best = { assembly: walk.assembly, duoDeclines: walk.duoDeclines(), score, localMet };
      // An unmet scheduled Hermes or Hammer some decision could take here earns one retry.
      if (
        localMet &&
        (supplyRetried ||
          scheduled.every(
            (target) =>
              target.met || target.supply === undefined || !walk.legalSupply.has(target.supply),
          ))
      )
        break;
      if (localMet) supplyRetried = true;
    }
    if (best === undefined) return Object.freeze({ kind: 'failed', biomeKey, reasons });
    duoDeclines = best.duoDeclines;
    // Only the chosen attempt's encounters are drafted, before the next biome builds on them.
    current = draftEncounters(
      catalog,
      best.assembly,
      biomeKey,
      createDraftRng((seed * 2_246_822_519 + biomeIndex * 7_919 + 1) >>> 0),
    );
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
      resourcePlacements: current.project.route.resourcePlacements,
    }),
    project: current.project,
    report: draftReport(catalog, spec, current),
    attempts,
  });
}

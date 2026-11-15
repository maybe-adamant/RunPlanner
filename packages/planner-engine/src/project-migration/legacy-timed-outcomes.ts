import type { Catalog } from '../catalog-schema';
import {
  semanticAddressKey,
  type OccurrenceAddress,
  type SteadyGrowthOutcomeAddress,
  type TranscendentEmbryoOutcomeAddress,
} from '../authored-project/addresses';
import type { ProjectCommand } from '../authored-project/commands/types';
import type { ProjectDocument } from '../authored-project/model';
import type { AuthoredTranscendentEmbryoOutcome } from '../authored-project/traits/state';
import { createAuthoringSession } from '../simulation/authoring/session';
import type { SettlementFault } from '../simulation/edit-settlement';
import type { ProjectEvaluationAssembly } from '../simulation/evaluation/evaluation-products';
import { simulateProjectAssembly } from '../simulation/evaluation/project';

/**
 * A Steady Growth target or Transcendent Embryo blessing as a plan saved
 * before schema 99 held it: on the room and encounter phase it landed at.
 */
export type LegacyTimedOutcome = {
  readonly biomeKey: string;
  readonly occurrenceId: string;
  readonly phaseKey: string;
} & (
  | { readonly kind: 'steadyGrowth'; readonly targetTraitKey: string }
  | { readonly kind: 'transcendentEmbryo'; readonly blessing: AuthoredTranscendentEmbryoOutcome }
);

/**
 * Why an old outcome was not put back: no cycle of its kind lands at its
 * encounter, cycles of two sources land there, or the engine refused it there.
 */
export type LegacyTimedOutcomeDropReason = 'unlanded' | 'ambiguous' | 'refused';

export interface LegacyTimedOutcomeRecovery {
  readonly project: ProjectDocument;
  readonly recovered: readonly {
    readonly legacy: LegacyTimedOutcome;
    readonly address: TimedOutcomeAddress;
  }[];
  readonly dropped: readonly {
    readonly legacy: LegacyTimedOutcome;
    readonly reason: LegacyTimedOutcomeDropReason;
  }[];
  /** A settlement fault; the project is then the input, unrecovered. */
  readonly fault?: SettlementFault;
}

type TimedOutcomeAddress = SteadyGrowthOutcomeAddress | TranscendentEmbryoOutcomeAddress;

/** One published cycle: where it lands and the source cycle it settles. */
export interface TimedOutcomeLanding {
  readonly kind: LegacyTimedOutcome['kind'];
  readonly address: TimedOutcomeAddress;
  readonly owner: OccurrenceAddress;
  readonly phaseKey: string;
}

function publishedLandings(assembly: ProjectEvaluationAssembly): readonly TimedOutcomeLanding[] {
  return assembly.evaluation.route.biomes.flatMap((biome) =>
    'rewards' in biome
      ? [
          ...biome.rewards.steadyGrowthOutcomes.map(({ address, owner, phaseKey }) => ({
            kind: 'steadyGrowth' as const,
            address,
            owner,
            phaseKey,
          })),
          ...biome.rewards.transcendentEmbryoOutcomes.map(({ address, owner, phaseKey }) => ({
            kind: 'transcendentEmbryo' as const,
            address,
            owner,
            phaseKey,
          })),
        ]
      : [],
  );
}

/** The distinct source cycles of an old outcome's kind landing at its encounter end. */
export function legacyTimedOutcomeLandings(
  landings: readonly TimedOutcomeLanding[],
  legacy: LegacyTimedOutcome,
): readonly TimedOutcomeAddress[] {
  const addresses = new Map<string, TimedOutcomeAddress>();
  for (const landing of landings)
    if (
      landing.kind === legacy.kind &&
      landing.owner.biomeKey === legacy.biomeKey &&
      landing.owner.occurrenceId === legacy.occurrenceId &&
      landing.phaseKey === legacy.phaseKey
    )
      addresses.set(semanticAddressKey(landing.address), landing.address);
  return [...addresses.values()];
}

const landingsAt = (assembly: ProjectEvaluationAssembly, legacy: LegacyTimedOutcome) =>
  legacyTimedOutcomeLandings(publishedLandings(assembly), legacy);

function recoveryCommand(legacy: LegacyTimedOutcome, address: TimedOutcomeAddress): ProjectCommand {
  return legacy.kind === 'steadyGrowth'
    ? {
        kind: 'ReplaceSteadyGrowthTarget',
        outcome: address as SteadyGrowthOutcomeAddress,
        targetTraitKey: legacy.targetTraitKey,
      }
    : {
        kind: 'ReplaceTranscendentEmbryoTransformation',
        outcome: address as TranscendentEmbryoOutcomeAddress,
        value: legacy.blessing,
      };
}

/**
 * Put each outcome a plan saved before schema 99 held back on the source cycle
 * that lands where it was saved, as the edit authoring it would. Recovering a
 * cycle can let the walk land the next, so it repeats until nothing more lands.
 * An outcome is dropped when no cycle lands there, when cycles of two sources
 * land there as it is recovered, or when the edit is refused or leaves the
 * cycle with its own finding. The schema 102 -> 103 migration runs it on the
 * lifted plan before its upgrade settlement, and again on the settled plan for
 * the outcomes it dropped as unlanded.
 */
export function recoverLegacyTimedOutcomes(options: {
  readonly catalog: Catalog;
  readonly project: ProjectDocument;
  readonly outcomes: readonly LegacyTimedOutcome[];
}): LegacyTimedOutcomeRecovery {
  const { catalog } = options;
  const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
  const session = createAuthoringSession(catalog, evaluate(options.project));
  const pending = [...options.outcomes];
  const recovered: LegacyTimedOutcomeRecovery['recovered'][number][] = [];
  const dropped: LegacyTimedOutcomeRecovery['dropped'][number][] = [];
  const unrecovered = (fault: SettlementFault): LegacyTimedOutcomeRecovery =>
    Object.freeze({
      project: options.project,
      recovered: Object.freeze([]),
      dropped: Object.freeze(
        options.outcomes.map((legacy) => ({ legacy, reason: 'refused' as const })),
      ),
      fault,
    });

  for (;;) {
    const before = session.current();
    const index = pending.findIndex((legacy) => landingsAt(before, legacy).length > 0);
    if (index < 0) break;
    const [legacy] = pending.splice(index, 1) as [LegacyTimedOutcome];
    const landings = landingsAt(before, legacy);
    if (landings.length > 1) {
      dropped.push({ legacy, reason: 'ambiguous' });
      continue;
    }
    const address = landings[0]!;
    const applied = session.apply(recoveryCommand(legacy, address));
    if (applied.kind === 'refused') {
      dropped.push({ legacy, reason: 'refused' });
      continue;
    }
    if (applied.fault !== undefined) return unrecovered(applied.fault);
    // A second source's cycle may land at the same encounter only once the walk passes this one.
    const ambiguous = landingsAt(applied.assembly, legacy).length > 1;
    const key = semanticAddressKey(address);
    const rejected = applied.assembly.evaluation.findings.some(
      (finding) => semanticAddressKey(finding.origin) === key,
    );
    if (ambiguous || rejected) {
      session.restore(before);
      dropped.push({ legacy, reason: ambiguous ? 'ambiguous' : 'refused' });
      continue;
    }
    recovered.push({ legacy, address });
  }
  for (const legacy of pending) dropped.push({ legacy, reason: 'unlanded' });

  return Object.freeze({
    project: session.current().project,
    recovered: Object.freeze(recovered),
    dropped: Object.freeze(dropped),
  });
}

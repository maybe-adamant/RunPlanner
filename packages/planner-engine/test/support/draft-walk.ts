import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '../../src/authored-project';
import { simulateProjectAssembly, type DraftRoute, type DraftSpec } from '../../src/simulation';
import type { ProjectEvaluationAssembly } from '../../src/simulation/evaluation/evaluation-products';
import { createDraftRng } from '../../src/simulation/draft/rng';
import { draftGodSchedule, type DraftGodSchedule } from '../../src/simulation/draft/schedule';
import { draftLoadoutProject } from '../../src/simulation/draft/spec';
import { DraftWalk } from '../../src/simulation/draft/walk';
import { DraftSteering } from '../../src/simulation/draft/steering';
import { createDraftPrerequisites } from '../../src/simulation/draft/prerequisites';
import { draftStartTraits } from '../../src/simulation/draft/basket';
import { draftWorld } from '../../src/simulation/draft/world';

/** The schedule a draft of this route builds from the seed. */
export function draftScheduleFor(
  route: DraftRoute,
  spec: DraftSpec,
  seed: number,
): DraftGodSchedule {
  const world = draftWorld(catalog, route, spec);
  return draftGodSchedule(catalog, route, spec, world, createDraftRng(seed));
}

/**
 * A walk over the base project's drafted loadout, or from `from`; the schedule
 * uses `scheduleSeed`, by default the walk's own seed.
 */
export function startDraftWalk(
  base: ProjectDocument,
  spec: DraftSpec,
  seed: number,
  options: {
    readonly from?: ProjectEvaluationAssembly;
    readonly scheduleSeed?: number;
  } = {},
): DraftWalk {
  const route = base.route;
  const world = draftWorld(catalog, route, spec);
  const schedule = draftGodSchedule(
    catalog,
    route,
    spec,
    world,
    createDraftRng(options.scheduleSeed ?? seed),
  );
  const start =
    options.from ??
    simulateProjectAssembly(catalog, draftLoadoutProject(catalog, base, spec.loadout));
  return new DraftWalk(catalog, start, spec, createDraftRng(seed), schedule, world);
}

/** The walk's steering over the base project's drafted loadout, at its first biome. */
export function draftSteeringFor(base: ProjectDocument, spec: DraftSpec): DraftSteering {
  const world = draftWorld(catalog, base.route, spec);
  const schedule = draftGodSchedule(catalog, base.route, spec, world, createDraftRng(1));
  const assembly = simulateProjectAssembly(
    catalog,
    draftLoadoutProject(catalog, base, spec.loadout),
  );
  const held = draftStartTraits(catalog, base.route, spec.loadout);
  return new DraftSteering(
    catalog,
    spec,
    schedule,
    world,
    createDraftPrerequisites(catalog, spec.basketTraitKeys, held),
    held,
    { assembly: () => assembly, biomeIndex: () => 0 },
  );
}

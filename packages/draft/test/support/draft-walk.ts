import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import {
  prepareRouteStartTraitRequirements,
  simulateProjectAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import type { DraftSpec } from '../../src';
import type { DraftRoute } from '../../src/spec';
import { createDraftRng } from '../../src/rng';
import { draftGodSchedule, type DraftGodSchedule } from '../../src/schedule';
import { draftBasketTraitKeys, draftLoadoutProject } from '../../src/spec';
import { DraftWalk } from '../../src/walk';
import { createAuthoringSession } from '@run-planner/engine/authoring';
import { DraftSteering } from '../../src/steering';
import { createDraftPrerequisites } from '../../src/prerequisites';
import { draftWorld } from '../../src/world';

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
  return new DraftWalk(
    catalog,
    createAuthoringSession(catalog, start),
    spec,
    createDraftRng(seed),
    schedule,
    world,
  );
}

/** The walk's steering over the base project's drafted loadout, at its first biome. */
export function draftSteeringFor(base: ProjectDocument, spec: DraftSpec): DraftSteering {
  const world = draftWorld(catalog, base.route, spec);
  const schedule = draftGodSchedule(catalog, base.route, spec, world, createDraftRng(1));
  const assembly = simulateProjectAssembly(
    catalog,
    draftLoadoutProject(catalog, base, spec.loadout),
  );
  const held = prepareRouteStartTraitRequirements(catalog, base.route, spec.loadout).held;
  return new DraftSteering(
    catalog,
    spec,
    schedule,
    world,
    createDraftPrerequisites(catalog, draftBasketTraitKeys(spec), held),
    held,
    { assembly: () => assembly, biomeIndex: () => 0 },
  );
}

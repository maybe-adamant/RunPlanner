import type { Catalog } from '../../catalog-schema';
import type { ProjectCommand } from '../../authored-project';
import type { AuthoringSession } from '../authoring/session';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { draftGodSchedule } from './schedule';
import type { DraftSpec } from './spec';
import { DraftWalk } from './walk';
import { draftWorld, draftWorldOptions } from './world';

/** A draw that keeps every shuffled domain in its declared order. */
const firstInOrder = () => 1 - 1e-9;

export interface DraftIssueRepairer {
  /**
   * Repairs the session's current assessment issue once with Draft's
   * first-eligible value; the commands applied, or undefined when none settles
   * it and the session is left as it was.
   */
  repairIssue(): readonly ProjectCommand[] | undefined;
}

/**
 * Draft's repair over an unsteered world: every god in the pool, no basket, and
 * every random draw taking its domain's first eligible value. One repairer
 * serves the session's whole authoring, so a value it already tried for an
 * owner is not tried again while the session is still at its own last result.
 */
export function createDraftIssueRepairer(
  catalog: Catalog,
  session: AuthoringSession,
  options: { readonly occurrenceIdPrefix: string },
): DraftIssueRepairer {
  const route = session.current().project.route;
  const loadout = route.loadout;
  const spec: DraftSpec = {
    loadout: {
      weaponKey: loadout.weaponKey,
      aspectKey: loadout.aspectKey,
      familiarKey: loadout.familiarKey,
      manualArcanaKeys: loadout.manualArcanaKeys,
      fearRanks: loadout.fearRanks,
      startingKeepsakeKey: loadout.startingKeepsakeKey,
    },
    world: {
      godKeys: draftWorldOptions(catalog, route).godKeys,
      storyNpcByBiome: {},
      fieldNpcsByBiome: {},
    },
    basketByGiver: {},
    rackKeepsakeKeys: [],
  };
  const world = draftWorld(catalog, route, spec);
  const schedule = draftGodSchedule(catalog, route, spec, world, firstInOrder);
  const walk = new DraftWalk(catalog, session, spec, firstInOrder, schedule, world);
  walk.occurrenceIdPrefix = options.occurrenceIdPrefix;
  let lastResult: ProjectEvaluationAssembly | undefined;
  return {
    repairIssue() {
      const start = session.current();
      // After an outside edit a value this walk once tried may be legal again.
      if (start !== lastResult) walk.forgetTried();
      const before = walk.appliedCommands.length;
      const repaired = walk.repairIssue();
      lastResult = session.current();
      if (!repaired) {
        session.restore(start);
        return undefined;
      }
      return walk.appliedCommands.slice(before);
    },
  };
}

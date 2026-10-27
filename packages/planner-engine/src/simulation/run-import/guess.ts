import type { Catalog } from '../../catalog-schema';
import type { ProjectCommand, ProjectDocument } from '../../authored-project';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { draftGodSchedule } from '../draft/schedule';
import type { DraftSpec } from '../draft/spec';
import { DraftWalk } from '../draft/walk';
import { draftWorld, draftWorldOptions } from '../draft/world';

/** A draw that keeps every shuffled domain in its declared order. */
const firstInOrder = () => 1 - 1e-9;

/**
 * Settles questions the record cannot answer with Draft's repair over an
 * unsteered world: every god in the pool, no basket, and every random draw
 * taking its domain's first eligible value. One walk serves the whole import,
 * so a value it already tried for an owner is not tried again.
 */
export class RunImportGuesser {
  private readonly walk: DraftWalk;

  constructor(catalog: Catalog, project: ProjectDocument, start: ProjectEvaluationAssembly) {
    const route = project.route;
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
    this.walk = new DraftWalk(catalog, start, spec, firstInOrder, schedule, world);
    this.walk.occurrenceIdPrefix = 'guess';
  }

  /** The settled assembly and the commands applied, or undefined when no repair settles the issue. */
  guess(
    assembly: ProjectEvaluationAssembly,
  ):
    | { readonly assembly: ProjectEvaluationAssembly; readonly commands: readonly ProjectCommand[] }
    | undefined {
    this.walk.resume(assembly);
    const before = this.walk.appliedCommands.length;
    if (!this.walk.repairIssue()) return undefined;
    return {
      assembly: this.walk.assembly,
      commands: this.walk.appliedCommands.slice(before),
    };
  }
}

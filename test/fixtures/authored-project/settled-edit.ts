import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  collectRequiredItems,
  settleProjectEdit,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

/** One edit settled as the editor's history settles it, so a swapped room's doors follow it. */
export function settleTestEdit(project: ProjectDocument, command: ProjectCommand): ProjectDocument {
  const evaluate = (document: ProjectDocument) => simulateProjectAssembly(catalog, document);
  return settleProjectEdit({ catalog, before: evaluate(project), command, evaluate }).assembly
    .project;
}

const PLACEMENT_FINDINGS: ReadonlySet<string> = new Set([
  'roomActionPlacementRequired',
  'hermesShrineDeliveryPlacementRequired',
  'echoGoldPickupPlacementRequired',
]);

/** The room an address lies in: the nearest occurrence it names, in its nearest biome. */
function occurrenceOfAddress(address: SemanticAddress): OccurrenceAddress | undefined {
  const queue: {
    readonly node: unknown;
    readonly route: string | undefined;
    readonly biome: string | undefined;
  }[] = [{ node: address, route: undefined, biome: undefined }];
  while (queue.length > 0) {
    const { node, ...context } = queue.shift()!;
    if (typeof node !== 'object' || node === null) continue;
    const fields = node as Readonly<Record<string, unknown>>;
    const route = typeof fields.routeKey === 'string' ? fields.routeKey : context.route;
    const biome = typeof fields.biomeKey === 'string' ? fields.biomeKey : context.biome;
    if (typeof fields.occurrenceId === 'string' && route !== undefined && biome !== undefined)
      return createOccurrenceAddress(
        createBiomeAddress(route, biome),
        createOccurrenceId(fields.occurrenceId),
      );
    for (const child of Object.values(fields)) queue.push({ node: child, route, biome });
  }
  return undefined;
}

/**
 * Collects every required item the plan leaves on the ground, as an owner
 * playing forward would: while the plan's first issue is a room's required
 * placement, Collect all required runs in that room.
 */
export function collectTestRequiredItems(project: ProjectDocument): ProjectDocument {
  const evaluate = (document: ProjectDocument) => simulateProjectAssembly(catalog, document);
  let assembly = evaluate(project);
  for (;;) {
    const reason = assembly.evaluation.issue?.reasons[0];
    const room =
      reason !== undefined && PLACEMENT_FINDINGS.has(reason.code)
        ? occurrenceOfAddress(reason.origin)
        : undefined;
    if (room === undefined) return assembly.project;
    const collected = collectRequiredItems({
      catalog,
      before: assembly,
      occurrence: room,
      evaluate,
    });
    if (collected.fault !== undefined)
      throw new Error(`Collect all required faulted at ${collected.fault.key}`);
    if (collected.commands.length === 0) return collected.assembly.project;
    assembly = collected.assembly;
  }
}

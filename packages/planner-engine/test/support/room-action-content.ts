import { catalog } from '@run-planner/hades2-catalog';
import {
  biomePlanContentSource,
  roomActionItemContent,
  withRoomActionContent,
  type OccurrenceAddress,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';

/**
 * The reference as the engine records it for the item the occurrence holds
 * now: with that item's content, or without while the item is unobserved. An
 * expected row is built with it rather than spelling the content out.
 */
export function withItemContent(
  project: ProjectDocument,
  occurrence: OccurrenceAddress,
  reference: RoomActionReference,
): RoomActionReference {
  const plan = project.route.biomes.find((biome) => biome.biomeKey === occurrence.biomeKey);
  const source = plan === undefined ? undefined : biomePlanContentSource(catalog, project, plan);
  const room = plan?.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
  );
  if (source === undefined || room === undefined)
    throw new Error(`no occurrence ${occurrence.occurrenceId} in ${occurrence.biomeKey}`);
  return withRoomActionContent(reference, roomActionItemContent(source, room, reference));
}

/** Each reference as the engine records it for the occurrence's items now. */
export function withItemContents(
  project: ProjectDocument,
  occurrence: OccurrenceAddress,
  references: readonly RoomActionReference[],
): readonly RoomActionReference[] {
  return references.map((reference) => withItemContent(project, occurrence, reference));
}

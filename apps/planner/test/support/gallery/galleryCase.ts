import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  decodeProjectDocument,
  roomActionKey,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';

/** Where a case opens: one room on its Timeline, or a biome's Hub on one Timeline segment. */
export type GalleryTarget =
  | { readonly kind: 'room'; readonly biomeKey: string; readonly occurrenceId: string }
  | { readonly kind: 'hub'; readonly biomeKey: string; readonly segment?: number };

export type GalleryStep = ProjectCommand | ((project: ProjectDocument) => ProjectCommand);

export interface GalleryCase {
  /** Stable, file-name safe: it names the case's capture. */
  readonly id: string;
  /** The heading shown above the case: what to look at. */
  readonly label: string;
  /** The Timeline rows and states this case shows. */
  readonly shows: readonly string[];
  readonly project: () => ProjectDocument;
  /**
   * Semantic commands applied in order to the built project before it opens; a step given as a
   * function receives the project as the earlier steps left it.
   */
  readonly commands?: readonly GalleryStep[];
  readonly target: GalleryTarget;
  /** A room case also shows the room's Overview under its Timeline, such as its inventories. */
  readonly overview?: true;
  /** A room case opens its Timeline with the door editor expanded. */
  readonly doorsExpanded?: true;
  /** A room case opens the Optional actions picker of this name on its Timeline. */
  readonly openPicker?: string;
}

export function room(biomeKey: string, occurrenceId: string): GalleryTarget {
  return { kind: 'room', biomeKey, occurrenceId };
}

export function hub(biomeKey: string, segment?: number): GalleryTarget {
  return segment === undefined ? { kind: 'hub', biomeKey } : { kind: 'hub', biomeKey, segment };
}

/** The case's project with its commands applied through the engine's command authority. */
export function buildGalleryProject(entry: GalleryCase): ProjectDocument {
  return (entry.commands ?? []).reduce(
    (current, step) =>
      applyProjectCommand(current, catalog, typeof step === 'function' ? step(current) : step),
    entry.project(),
  );
}

/** One occurrence as the project currently authors it. */
export function authoredOccurrence(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
) {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) throw new Error(`${biomeKey} has no occurrence ${occurrenceId}`);
  return occurrence;
}

export function occurrenceAddress(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
) {
  return createOccurrenceAddress(
    createBiomeAddress(project.route.routeKey, biomeKey),
    createOccurrenceId(occurrenceId),
  );
}

/**
 * The project as a save that never placed the room's actions decodes: its required actions
 * stay owed and the Timeline offers to restore them.
 */
export function withoutRoomActionOrder(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
): ProjectDocument {
  return decodeProjectDocument(
    {
      ...project,
      route: {
        ...project.route,
        biomes: project.route.biomes.map((biome) =>
          biome.biomeKey !== biomeKey || biome.topology === null
            ? biome
            : {
                ...biome,
                topology: {
                  ...biome.topology,
                  occurrences: biome.topology.occurrences.map((occurrence) =>
                    occurrence.occurrenceId === occurrenceId
                      ? { ...occurrence, roomActions: { order: [] } }
                      : occurrence,
                  ),
                },
              },
        ),
      },
    },
    catalog,
  );
}

/** Appends one room action at the end of the room's authored order. */
export function appendRoomAction(
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
): GalleryStep {
  return (project) => ({
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(
      createBiomeAddress(project.route.routeKey, biomeKey),
      createOccurrenceId(occurrenceId),
      roomActionKey(reference),
    ),
    reference,
    index: authoredOccurrence(project, biomeKey, occurrenceId).roomActions.order.length,
  });
}

/** The semantic owner the case opens, addressed in the project's own route. */
export function galleryTargetOwner(
  project: ProjectDocument,
  target: GalleryTarget,
): SemanticAddress {
  const biome = createBiomeAddress(project.route.routeKey, target.biomeKey);
  return target.kind === 'room'
    ? createOccurrenceAddress(biome, createOccurrenceId(target.occurrenceId))
    : createHubDecisionAddress(biome, 'hub');
}

/** Cases whose id or label contains the filter, ignoring case; every case without one. */
export function filterGalleryCases(
  cases: readonly GalleryCase[],
  filter: string | null | undefined,
): readonly GalleryCase[] {
  if (filter === null || filter === undefined || filter.trim() === '') return cases;
  const needles = filter
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part !== '');
  return cases.filter((entry) =>
    needles.some(
      (needle) =>
        entry.id.toLowerCase().includes(needle) || entry.label.toLowerCase().includes(needle),
    ),
  );
}

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  decodeProjectDocument,
  roomActionKey,
  type HubAction,
  type OccurrenceId,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { settleTestEdit } from '@run-planner/test-fixtures/shared';

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
  /** The case also shows its room's or Hub's Overview under its Timeline, such as inventories. */
  readonly overview?: true;
  /** A room case opens this room tab in place of its Timeline, such as its Side Rooms. */
  readonly roomTab?: string;
  /** A room case opens its Timeline with the door editor expanded. */
  readonly doorsExpanded?: true;
  /** A room case opens its Not reached yet rows. */
  readonly notReachedExpanded?: true;
  /** A room case opens the verbs of the live thing, or the Leave row picker, of this name on its Timeline. */
  readonly openPicker?: string;
  /** With `openPicker`, the verb whose values the list then shows. */
  readonly openVerb?: string;
  /**
   * A room case shows the `+` of this Timeline gap, or of the last one shown, as a hover does,
   * and with `open` opens its menu.
   */
  readonly gap?: { readonly index?: number; readonly open: boolean };
  /** An Overview case opens its Overview picker of this accessible name. */
  readonly openOverviewPicker?: string;
  /** The case opens its biome as the biome's tab does, not its target. */
  readonly opensBiome?: true;
  /** The case shows the editor header's finding pill above the biome. */
  readonly findingPill?: true;
  /** One edit made once the case opens, as the editor dispatches it, so its announcement shows. */
  readonly edit?: GalleryStep;
}

export function room(biomeKey: string, occurrenceId: string): GalleryTarget {
  return { kind: 'room', biomeKey, occurrenceId };
}

export function hub(biomeKey: string, segment?: number): GalleryTarget {
  return segment === undefined ? { kind: 'hub', biomeKey } : { kind: 'hub', biomeKey, segment };
}

/** The case's project with each of its commands settled as the editor's history settles it. */
export function buildGalleryProject(entry: GalleryCase): ProjectDocument {
  return (entry.commands ?? []).reduce(
    (current, step) => settleTestEdit(current, typeof step === 'function' ? step(current) : step),
    entry.project(),
  );
}

/** A main room's stored side-visit order. */
export function localVisitOrder(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
): readonly OccurrenceId[] {
  const decision = project.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.decisions.find(
      (candidate) =>
        candidate.kind === 'localVisit' && candidate.sourceOccurrenceId === occurrenceId,
    );
  if (decision?.kind !== 'localVisit') throw new Error(`${occurrenceId} has no side visits`);
  return decision.visitOrder;
}

/** A biome's stored Hub action order. */
export function authoredHubActions(
  project: ProjectDocument,
  biomeKey: string,
): readonly HubAction[] {
  const decision = project.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.decisions.find((candidate) => candidate.kind === 'hub');
  if (decision?.kind !== 'hub') throw new Error(`${biomeKey} has no Hub`);
  return decision.actions;
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
 * The project as a save that placed only the room's first `keep` actions decodes: the rest
 * stay owed and the live row offers them.
 */
export function withoutRoomActionOrder(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
  keep = 0,
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
                      ? {
                          ...occurrence,
                          roomActions: { order: occurrence.roomActions.order.slice(0, keep) },
                        }
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

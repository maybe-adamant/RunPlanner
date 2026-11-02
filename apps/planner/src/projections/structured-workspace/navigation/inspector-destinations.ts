import type {
  WorkspaceInspectorDestination,
  WorkspaceInspectorSubject,
} from '../contracts/navigation';
import type { WorkspaceBiome, WorkspaceNode, WorkspaceRailEntry } from '../contracts/structure';

type RailSelectionBiome = Pick<
  WorkspaceBiome,
  'defaultInspectorDestination' | 'frontier' | 'nodes' | 'occurrenceStages' | 'rail'
>;

/** Final workspace products needed to bind exact semantic focus for one biome. */
export interface WorkspaceInspectorDestinationBindingInput {
  readonly biome: WorkspaceBiome;
  readonly destinationsByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
}

function subjectForDefault(biome: RailSelectionBiome): WorkspaceInspectorSubject | undefined {
  const destination = biome.defaultInspectorDestination;
  if (destination === null) return undefined;
  return destination.kind === 'node'
    ? Object.freeze({ kind: 'node' as const, nodeKey: destination.nodeKey })
    : Object.freeze({
        frontierFocusKey: destination.frontierFocusKey,
        kind: 'frontier' as const,
      });
}

function hubNode(
  biome: RailSelectionBiome,
): Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> | undefined {
  return biome.nodes.find(
    (node): node is Extract<WorkspaceNode, { readonly kind: 'hubDecision' }> =>
      node.kind === 'hubDecision',
  );
}

/**
 * Existing assembly already chooses the exact containing node for authored
 * markers. This final presentation stage only handles the non-node frontiers
 * and coarse fallback owners after the complete biome products exist.
 */
function subjectForDestination(
  biome: RailSelectionBiome,
  destination: WorkspaceInspectorDestination,
): WorkspaceInspectorSubject | undefined {
  if (biome.nodes.some((node) => node.key === destination.nodeKey)) {
    return Object.freeze({ kind: 'node' as const, nodeKey: destination.nodeKey });
  }
  const frontier = biome.frontier;
  if (
    (frontier?.kind === 'start' || frontier?.kind === 'exitDecision') &&
    frontier.marker.focusKey === destination.focusKey
  ) {
    if (frontier.kind === 'exitDecision' && frontier.owner.source.kind === 'hubDecision') {
      const hub = hubNode(biome);
      return hub === undefined
        ? subjectForDefault(biome)
        : Object.freeze({ kind: 'node' as const, nodeKey: hub.key });
    }
    return Object.freeze({
      frontierFocusKey: frontier.marker.focusKey,
      kind: 'frontier' as const,
    });
  }
  return subjectForDefault(biome);
}

/** The marker each rendered rail stop focuses when it is chosen, with the stop it selects. */
function railStopClicks(
  rail: readonly WorkspaceRailEntry[],
): readonly { readonly clickKey: string; readonly railKey: string }[] {
  return rail.flatMap((entry) => {
    switch (entry.kind) {
      case 'frontier':
        return [{ clickKey: entry.marker.focusKey, railKey: entry.marker.focusKey }];
      case 'node':
        return [{ clickKey: entry.focusMarker.focusKey, railKey: entry.marker.focusKey }];
      case 'hubGroup':
        return [
          { clickKey: entry.marker.focusKey, railKey: entry.marker.focusKey },
          ...entry.visits.flatMap((visit) => [
            { clickKey: visit.marker.focusKey, railKey: visit.marker.focusKey },
            ...visit.sideVisits.map((sideVisit) => ({
              clickKey: sideVisit.marker.focusKey,
              railKey: sideVisit.marker.focusKey,
            })),
          ]),
        ];
    }
  });
}

function subjectKey(subject: WorkspaceInspectorSubject): string {
  return subject.kind === 'node'
    ? `node:${subject.nodeKey}`
    : `frontier:${subject.frontierFocusKey}`;
}

/** The room the inspector shows for a subject: its occurrence stage, else the subject itself. */
function openedRoomKey(biome: RailSelectionBiome, subject: WorkspaceInspectorSubject): string {
  const stage = biome.occurrenceStages.find((candidate) =>
    subject.kind === 'node'
      ? candidate.sourceOccurrenceNodeKey === subject.nodeKey ||
        (candidate.outgoing.kind === 'authoredDecision' &&
          candidate.outgoing.decisionNodeKey === subject.nodeKey)
      : candidate.outgoing.kind === 'frontier' &&
        candidate.outgoing.frontier.marker.focusKey === subject.frontierFocusKey,
  );
  return stage === undefined ? subjectKey(subject) : `stage:${stage.sourceOccurrenceNodeKey}`;
}

/**
 * Selects the rail stop that opens the room the inspector opens for a subject.
 * Among stops opening that room it prefers the focused marker's (or frontier's) own stop, then
 * the stop opening that exact subject, then the first. A decision with a
 * selected room therefore selects the stop opening its source room, whose Room
 * Doors repair the decision.
 */
export function workspaceRailSelection(
  biome: RailSelectionBiome,
  destinationsByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>,
): (subject: WorkspaceInspectorSubject | undefined, focusKey?: string) => string | undefined {
  const stopByMarker = new Map<string, { readonly railKey: string; readonly room: string }>();
  const railBySubject = new Map<string, string>();
  const railByRoom = new Map<string, string>();
  for (const { clickKey, railKey } of railStopClicks(biome.rail)) {
    const destination = destinationsByOwner.get(clickKey);
    const subject =
      destination === undefined ? undefined : subjectForDestination(biome, destination);
    if (subject === undefined) continue;
    const room = openedRoomKey(biome, subject);
    for (const markerKey of [railKey, clickKey]) {
      if (!stopByMarker.has(markerKey)) stopByMarker.set(markerKey, { railKey, room });
    }
    const exact = subjectKey(subject);
    if (!railBySubject.has(exact)) railBySubject.set(exact, railKey);
    if (!railByRoom.has(room)) railByRoom.set(room, railKey);
  }
  return (subject, focusKey) => {
    if (subject === undefined) return undefined;
    const room = openedRoomKey(biome, subject);
    const focused =
      focusKey ?? (subject.kind === 'frontier' ? subject.frontierFocusKey : undefined);
    const focusedStop = focused === undefined ? undefined : stopByMarker.get(focused);
    if (focusedStop?.room === room) return focusedStop.railKey;
    const exact = railBySubject.get(subjectKey(subject));
    return exact ?? railByRoom.get(room);
  };
}

/**
 * Decorates biome-local exact focus destinations from final, already-published
 * nodes, rail, frontier, and no-focus default products. Each destination
 * selects the rail stop that opens the room its inspector opens. No authored topology,
 * source index, catalog, candidate, or UI-session state is consulted here.
 */
export function bindWorkspaceInspectorDestinations(
  input: WorkspaceInspectorDestinationBindingInput,
): ReadonlyMap<string, WorkspaceInspectorDestination> {
  const selectRail = workspaceRailSelection(input.biome, input.destinationsByOwner);
  const result = new Map<string, WorkspaceInspectorDestination>();
  for (const [ownerKey, destination] of input.destinationsByOwner) {
    const inspectorSubject = subjectForDestination(input.biome, destination);
    const selectedRailKey = selectRail(inspectorSubject, destination.focusKey);
    result.set(
      ownerKey,
      Object.freeze({
        ...destination,
        ...(inspectorSubject === undefined ? {} : { inspectorSubject }),
        ...(selectedRailKey === undefined ? {} : { selectedRailKey }),
      }),
    );
  }
  return result;
}

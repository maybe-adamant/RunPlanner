import type {
  WorkspaceRoomActionProposal,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import type { TimelineReorderPosition } from './useTimelineReorder';

/**
 * Names the destination at an anchor index in the current order, and the row it
 * stands against, without deciding whether it is allowed.
 */
function roomActionDestination(
  rows: readonly WorkspaceRoomActionRow[],
  anchorIndex: number,
  movingRow: WorkspaceRoomActionRow,
): { readonly label: string; readonly row?: string; readonly edge: 'before' | 'after' } {
  const remaining = rows
    .filter((row) => row.rank !== null && row.key !== movingRow.key)
    .sort((left, right) => left.rank! - right.rank!);
  const next = remaining.find((row) => row.rank! - 1 >= anchorIndex);
  if (next !== undefined) return { label: `Before ${next.label}`, row: next.key, edge: 'before' };
  const previous = remaining.at(-1);
  return previous === undefined
    ? { label: 'First action', edge: 'before' }
    : { label: `After ${previous.label}`, row: previous.key, edge: 'after' };
}

/** A lifecycle banner a section starts at, with the order index right after it. */
export interface RoomActionReorderBanner {
  readonly key: string;
  readonly label: string;
  readonly kind: string;
  readonly dropIndex: number;
}

/**
 * A position that starts a section anchors under its banner, as an insertion
 * there does: the Doors open banner when it shares the index, else the first.
 */
function bannerDestination(
  banners: readonly RoomActionReorderBanner[],
  anchorIndex: number,
): { readonly label: string; readonly row: string; readonly edge: 'after' } | undefined {
  const matches = banners.filter(
    (banner) => banner.kind !== 'encounterStart' && banner.dropIndex === anchorIndex,
  );
  const banner = matches.find((candidate) => candidate.kind === 'cleanup') ?? matches[0];
  return banner === undefined
    ? undefined
    : { label: `After ${banner.label}`, row: banner.key, edge: 'after' };
}

/** The row's own place and its move proposals in order; unauthorable ones carry their reason. */
export function roomActionReorderPositions(
  rows: readonly WorkspaceRoomActionRow[],
  row: WorkspaceRoomActionRow,
  proposals: readonly WorkspaceRoomActionProposal[],
  /** The Ship phase holding a row, where the timeline shows one phase at a time. */
  phaseOf?: (rowKey: string) => string | undefined,
  /** The rendered lifecycle banners in order, whose start a moved row can take. */
  banners: readonly RoomActionReorderBanner[] = [],
): readonly TimelineReorderPosition[] {
  const ownPhase = phaseOf?.(row.key);
  if (row.rank === null) return [];
  const own = { at: row.rank - 1, label: row.label, anchor: row.key, edge: 'self' as const };
  const moves = proposals.flatMap((proposal) => {
    if (proposal.kind !== 'move') return [];
    const at = proposal.anchorIndex ?? 0;
    const destination = bannerDestination(banners, at) ?? roomActionDestination(rows, at, row);
    const phase = destination.row === undefined ? undefined : phaseOf?.(destination.row);
    return [
      {
        at,
        move: proposal.key,
        label:
          phase === undefined || phase === ownPhase
            ? destination.label
            : `${destination.label} in ${phase}`,
        ...(proposal.structurallyAuthorable
          ? {}
          : { unavailable: proposal.explanations.join(' ') || 'Not available here.' }),
        anchor: destination.row ?? row.key,
        edge: destination.edge,
      },
    ];
  });
  return [own, ...moves]
    .sort((left, right) => left.at - right.at)
    .map((position) => ({
      move: 'move' in position ? position.move : undefined,
      label: position.label,
      anchor: position.anchor,
      edge: position.edge,
      ...('unavailable' in position && position.unavailable !== undefined
        ? { unavailable: position.unavailable }
        : {}),
    }));
}

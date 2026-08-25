/* eslint-disable react-refresh/only-export-components */

import {
  dropHubBoardRoom,
  moveHubBoardRoom,
  type HubBoardDropTarget,
  type HubBoardMove,
  type HubBoardMoveResult,
  type HubBoardRanking,
  type WorkspaceHubVisitOrderInteraction,
  type WorkspaceHubSlot,
  type WorkspaceMarker,
} from '@planner/projections/structured-workspace';
import { candidateSupport } from '@planner/projections/candidateProjection';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { assessmentLabel } from './HubMembershipBoard';
export interface HubRosterPointerDrag {
  readonly pointerId: number;
  readonly slotKey: string;
  readonly target: HubBoardDropTarget | undefined;
  readonly x: number;
  readonly y: number;
}
export type HubRosterDropState = 'available' | 'unavailable';
export type HubRosterScrollDirection = -1 | 0 | 1;

export function sameSlotKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

export function sameHubBoardDropTarget(
  left: HubBoardDropTarget | undefined,
  right: HubBoardDropTarget | undefined,
): boolean {
  if (left === right) return true;
  if (left === undefined || right === undefined || left.kind !== right.kind) return false;
  if (left.kind === 'nextVisit' || right.kind === 'nextVisit') return true;
  return left.slotKey === right.slotKey;
}

export function hubRosterDropState(
  drag: HubRosterPointerDrag | undefined,
  ranking: HubBoardRanking,
  requiredVisitCount: number,
  target: Exclude<HubBoardDropTarget, { readonly kind: 'nextVisit' }>,
): HubRosterDropState | undefined {
  if (drag === undefined || !sameHubBoardDropTarget(drag.target, target)) return undefined;
  return dropHubBoardRoom(ranking, requiredVisitCount, drag.slotKey, target) === undefined
    ? 'unavailable'
    : 'available';
}

export function hubBoardDropTargetFromElement(
  root: HTMLElement | null,
  x: number,
  y: number,
): HubBoardDropTarget | undefined {
  const element = document.elementFromPoint?.(x, y);
  const nextVisitTarget = element?.closest<HTMLElement>(
    '[data-hub-roster-drop-target="nextVisit"]',
  );
  if (
    nextVisitTarget !== null &&
    nextVisitTarget !== undefined &&
    root?.contains(nextVisitTarget)
  ) {
    return Object.freeze({ kind: 'nextVisit' });
  }
  const card = element?.closest<HTMLElement>('[data-hub-slot-key][data-open="true"]');
  if (card === null || card === undefined || root?.contains(card) !== true) return undefined;
  const slotKey = card.dataset.hubSlotKey;
  if (slotKey === undefined) return undefined;
  const bounds = card.getBoundingClientRect();
  return Object.freeze({
    kind: y < bounds.top + bounds.height / 2 ? 'beforeSlot' : 'afterSlot',
    slotKey,
  });
}

export function hubRosterScrollDirection(
  root: HTMLElement | null,
  clientY: number,
): HubRosterScrollDirection {
  const inspector = root?.closest<HTMLElement>('.biome-inspector');
  const inspectorBounds = inspector?.getBoundingClientRect();
  if (
    inspector !== undefined &&
    inspector !== null &&
    inspectorBounds !== undefined &&
    inspectorBounds.height > 0 &&
    inspector.scrollHeight > inspector.clientHeight
  ) {
    const edge = 44;
    if (clientY < inspectorBounds.top + edge) return -1;
    if (clientY > inspectorBounds.bottom - edge) return 1;
    return 0;
  }

  // Narrow editor layouts deliberately return the inspector to document flow.
  // The grip owns the touch gesture, so use the actual page scrollport instead
  // of depending on native panning that touch-action: none has disabled.
  const documentHeight = document.scrollingElement?.scrollHeight ?? 0;
  if (window.innerHeight <= 0 || documentHeight <= window.innerHeight) return 0;
  const edge = 44;
  if (clientY < edge) return -1;
  if (clientY > window.innerHeight - edge) return 1;
  return 0;
}

export function scrollHubRoster(
  root: HTMLElement | null,
  direction: Exclude<HubRosterScrollDirection, 0>,
): void {
  const inspector = root?.closest<HTMLElement>('.biome-inspector');
  if (
    inspector !== undefined &&
    inspector !== null &&
    inspector.scrollHeight > inspector.clientHeight
  ) {
    inspector.scrollBy?.({ top: direction * 18 });
    return;
  }
  window.scrollBy?.({ top: direction * 18 });
}

export function hubMoveAnnouncement(
  label: string,
  slotKey: string,
  ranking: HubBoardRanking,
  requiredVisitCount: number,
): string {
  const index = ranking.rankedSlotKeys.indexOf(slotKey);
  const visitPosition = ranking.authoredVisitOrder.indexOf(slotKey);
  if (visitPosition !== -1) {
    return `${label} is planned as visit ${visitPosition + 1} of ${requiredVisitCount}.`;
  }
  if (index === -1) return `${label} was removed from the Hub board.`;
  const tailPosition = index - ranking.authoredVisitOrder.length + 1;
  return `${label} is remaining room ${tailPosition} of ${ranking.tailSlotKeys.length}; not in visit order.`;
}

function HubRankAction({
  action,
  actionLabel,
  interaction,
  onApplied,
  requiredVisitCount,
  result,
  symbol,
  slotLabel,
}: {
  readonly action: HubBoardMove;
  readonly actionLabel: string;
  readonly interaction: WorkspaceHubVisitOrderInteraction;
  readonly onApplied: (
    result: HubBoardMoveResult,
    announcement: string,
    action: HubBoardMove,
  ) => void;
  readonly requiredVisitCount: number;
  readonly result: HubBoardMoveResult | undefined;
  readonly symbol: string;
  readonly slotLabel: string;
}) {
  const executeIntent = useCommandIntent();
  const proposal =
    result?.proposedVisitOrder === undefined
      ? undefined
      : interaction.proposalFor(result.proposedVisitOrder);
  const candidates =
    useWorkspaceInteractionController<ReturnType<NonNullable<typeof proposal>['load']>>();
  const state = candidates.observe(proposal);
  const candidate = state.result?.[0];
  const disabled =
    result === undefined ||
    state.pending ||
    (candidate !== undefined && !candidateMayBeAuthored(candidate));
  const apply = (): void => {
    if (result === undefined) return;
    if (proposal !== undefined) {
      const options = state.result ?? candidates.activate(proposal);
      if (!candidateMayBeAuthored(options?.[0])) return;
      const intent = proposal.intent();
      onApplied(
        result,
        hubMoveAnnouncement(slotLabel, action.slotKey, result.ranking, requiredVisitCount),
        action,
      );
      executeIntent(intent);
      return;
    }
    onApplied(
      result,
      hubMoveAnnouncement(slotLabel, action.slotKey, result.ranking, requiredVisitCount),
      action,
    );
  };

  return (
    <button
      aria-busy={state.pending || undefined}
      aria-label={actionLabel}
      className="quiet-action hub-rank-action"
      data-candidate-support={candidateSupport(candidate)}
      data-hub-rank-action={action.kind}
      disabled={disabled}
      onClick={apply}
      onFocus={() => {
        if (proposal !== undefined) candidates.activate(proposal);
      }}
      onPointerDown={() => {
        if (proposal !== undefined) candidates.activate(proposal);
      }}
      title={actionLabel}
      type="button"
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

export function HubRoomOrderControls({
  interaction,
  onApplied,
  ranking,
  requiredVisitCount,
  slot,
}: {
  readonly interaction: WorkspaceHubVisitOrderInteraction;
  readonly onApplied: (
    result: HubBoardMoveResult,
    announcement: string,
    action: HubBoardMove,
  ) => void;
  readonly ranking: HubBoardRanking;
  readonly requiredVisitCount: number;
  readonly slot: WorkspaceHubSlot;
}) {
  const visitPosition = ranking.authoredVisitOrder.indexOf(slot.hubSlotKey);
  const tailPosition = ranking.tailSlotKeys.indexOf(slot.hubSlotKey);
  const authoredVisitCount = ranking.authoredVisitOrder.length;
  const visitState =
    visitPosition === -1
      ? `Remaining room ${tailPosition + 1} of ${ranking.tailSlotKeys.length}; not in visit order`
      : `Planned visit ${visitPosition + 1} of ${requiredVisitCount}`;
  const proposal = (kind: HubBoardMove['kind']): HubBoardMoveResult | undefined =>
    moveHubBoardRoom(
      ranking,
      requiredVisitCount,
      Object.freeze({ kind, slotKey: slot.hubSlotKey }),
    );
  const downKind: HubBoardMove['kind'] =
    visitPosition !== -1 &&
    visitPosition === authoredVisitCount - 1 &&
    authoredVisitCount < requiredVisitCount
      ? 'removeFromVisits'
      : 'moveLater';
  const visitMembershipKind: HubBoardMove['kind'] =
    visitPosition === -1 ? 'addToVisits' : 'removeFromVisits';
  const earlierLabel =
    visitPosition === -1 && tailPosition === 0
      ? authoredVisitCount < requiredVisitCount
        ? `Add ${slot.label} as visit ${authoredVisitCount + 1}`
        : `Move ${slot.label} into visit ${requiredVisitCount}`
      : `Move ${slot.label} earlier`;
  const laterLabel =
    downKind === 'removeFromVisits'
      ? `Remove ${slot.label} from visit order`
      : visitPosition === requiredVisitCount - 1 && authoredVisitCount === requiredVisitCount
        ? `Move ${slot.label} into remaining rooms`
        : `Move ${slot.label} later`;

  return (
    <div
      aria-label={`Visit order controls for ${slot.label}; ${visitState}`}
      className="hub-rank-actions"
      data-visit-position={visitPosition === -1 ? undefined : visitPosition + 1}
      role="group"
    >
      <HubRankAction
        action={Object.freeze({ kind: visitMembershipKind, slotKey: slot.hubSlotKey })}
        actionLabel={
          visitPosition === -1
            ? `Add ${slot.label} to visited rooms`
            : `Remove ${slot.label} from visited rooms`
        }
        interaction={interaction}
        onApplied={onApplied}
        requiredVisitCount={requiredVisitCount}
        result={proposal(visitMembershipKind)}
        symbol={visitPosition === -1 ? '+ Visit' : '− Visit'}
        slotLabel={slot.label}
      />
      <HubRankAction
        action={Object.freeze({ kind: 'moveEarlier', slotKey: slot.hubSlotKey })}
        actionLabel={earlierLabel}
        interaction={interaction}
        onApplied={onApplied}
        requiredVisitCount={requiredVisitCount}
        result={proposal('moveEarlier')}
        symbol="↑"
        slotLabel={slot.label}
      />
      <HubRankAction
        action={Object.freeze({ kind: downKind, slotKey: slot.hubSlotKey })}
        actionLabel={laterLabel}
        interaction={interaction}
        onApplied={onApplied}
        requiredVisitCount={requiredVisitCount}
        result={proposal(downKind)}
        symbol="↓"
        slotLabel={slot.label}
      />
    </div>
  );
}

export function HubNextVisitTarget({
  drag,
  ranking,
  requiredVisitCount,
  visits,
}: {
  readonly drag: HubRosterPointerDrag | undefined;
  readonly ranking: HubBoardRanking;
  readonly requiredVisitCount: number;
  readonly visits: readonly {
    readonly marker: WorkspaceMarker;
    readonly visitPosition: number;
  }[];
}) {
  const nextVisit = visits[0];
  if (nextVisit === undefined) return null;
  const target = Object.freeze({ kind: 'nextVisit' as const });
  const active = sameHubBoardDropTarget(drag?.target, target);
  const available =
    drag === undefined
      ? undefined
      : dropHubBoardRoom(ranking, requiredVisitCount, drag.slotKey, target) !== undefined;
  const laterVisit = nextVisit.visitPosition + 1;
  const completionCopy =
    laterVisit > requiredVisitCount
      ? 'This completes the visit order'
      : `Visits ${laterVisit}\u2013${requiredVisitCount} remain unplanned`;

  return (
    <div
      aria-label={`Visit ${nextVisit.visitPosition} is not planned; ${completionCopy}.`}
      className="hub-next-visit-target"
      data-active={active || undefined}
      data-available={available || undefined}
      data-hub-roster-drop-target="nextVisit"
      role="group"
    >
      <div className="hub-next-visit-copy">
        <span>Drop a room here for Visit {nextVisit.visitPosition}</span>
        <span>{completionCopy}</span>
      </div>
      <div className="hub-next-visit-owner-markers">
        {visits.map((visit) => (
          <span className="hub-next-visit-owner" key={visit.visitPosition}>
            <span className="hub-next-visit-owner-label">Visit {visit.visitPosition}</span>
            <span
              className="hub-next-visit-owner-assessment"
              data-assessment={visit.marker.assessment}
            >
              {assessmentLabel(visit.marker)}
            </span>
            <SemanticOwnerMarker address={visit.marker.address} />
            <span className="visually-hidden"> is not planned.</span>
          </span>
        ))}
      </div>
    </div>
  );
}

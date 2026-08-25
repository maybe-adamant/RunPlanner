import { type PointerEvent as ReactPointerEvent, useLayoutEffect, useRef, useState } from 'react';

import {
  dropHubBoardRoom,
  reconcileHubBoardRanking,
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type HubBoardMove,
  type HubBoardMoveResult,
  type HubBoardRanking,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubVisitOrderInteraction,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { OpenHubRoomCard } from './HubRoomCards';
import {
  HubNextVisitTarget,
  hubBoardDropTargetFromElement,
  hubMoveAnnouncement,
  hubRosterDropState,
  hubRosterScrollDirection,
  sameHubBoardDropTarget,
  sameSlotKeys,
  scrollHubRoster,
  type HubRosterPointerDrag,
  type HubRosterScrollDirection,
} from './HubVisitRanking';

interface PendingHubRankFocus {
  readonly action: HubBoardMove['kind'];
  readonly expectedRanking: HubBoardRanking;
  readonly slotKey: string;
}
interface PendingHubRosterPointerDrag {
  readonly handle: HTMLElement;
  readonly originX: number;
  readonly originY: number;
  readonly pointerId: number;
  readonly slotKey: string;
}

export function HubVisitTimeline({
  focusedRewardOwnerKey,
  interactions,
  node,
}: {
  readonly focusedRewardOwnerKey: string | undefined;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: WorkspaceHubDecisionNode;
}) {
  const executeIntent = useCommandIntent();
  const timelineRegion = useRef<HTMLDivElement>(null);
  const openSlots = node.slots.filter((slot) => slot.open);
  const visitOrderInteraction = requireWorkspaceInteraction(
    interactions.hubVisitOrders,
    workspaceInteractionKey(node.owner),
  );
  const authoredVisitOrder = visitOrderInteraction.selectedHubSlotKeys;
  const declarationOpenSlotKeys = openSlots.map((slot) => slot.hubSlotKey);
  const [retainedTailSlotKeys, setRetainedTailSlotKeys] = useState<readonly string[]>(
    Object.freeze([]),
  );
  const [rankAnnouncement, setRankAnnouncement] = useState('');
  const ranking = reconcileHubBoardRanking({
    authoredVisitOrder,
    declarationOpenSlotKeys,
    retainedTailSlotKeys,
  });
  const rankingStateKey = `${ranking.authoredVisitOrder.join('\u0001')}\u0002${ranking.rankedSlotKeys.join('\u0001')}`;
  const slotsByKey = new Map(openSlots.map((slot) => [slot.hubSlotKey, slot] as const));
  const rankedOpenSlots = ranking.rankedSlotKeys.map((slotKey) => {
    const slot = slotsByKey.get(slotKey);
    if (slot === undefined) {
      throw new Error(`Hub ranking refers to non-open slot ${slotKey}.`);
    }
    return slot;
  });
  const authoredVisitCount = ranking.authoredVisitOrder.length;
  const plannedSlots = rankedOpenSlots.slice(0, authoredVisitCount);
  const remainingSlots = rankedOpenSlots.slice(authoredVisitCount);
  const unplannedVisits = node.visits
    .slice(authoredVisitCount)
    .map((visit, index) =>
      Object.freeze({ marker: visit.marker, visitPosition: authoredVisitCount + index + 1 }),
    );
  const pendingRankFocus = useRef<PendingHubRankFocus | undefined>(undefined);
  const pendingPointerDrag = useRef<PendingHubRosterPointerDrag | undefined>(undefined);
  const activePointerDrag = useRef<HubRosterPointerDrag | undefined>(undefined);
  const pointerAutoScrollDirection = useRef<HubRosterScrollDirection>(0);
  const pointerAutoScrollFrame = useRef<number | undefined>(undefined);
  const [pointerDrag, setPointerDrag] = useState<HubRosterPointerDrag | undefined>(undefined);
  const pointerOrderCandidates =
    useWorkspaceInteractionController<
      ReturnType<ReturnType<WorkspaceHubVisitOrderInteraction['proposalFor']>['load']>
    >();
  const applyRankMove = (
    result: HubBoardMoveResult,
    announcement: string,
    action?: HubBoardMove,
    restoreKeyboardFocus = true,
  ): void => {
    pendingRankFocus.current =
      restoreKeyboardFocus && action !== undefined
        ? Object.freeze({
            action: action.kind,
            expectedRanking: result.ranking,
            slotKey: action.slotKey,
          })
        : undefined;
    setRetainedTailSlotKeys(result.ranking.tailSlotKeys);
    setRankAnnouncement(announcement);
  };
  const stopPointerAutoScroll = (): void => {
    const frame = pointerAutoScrollFrame.current;
    if (frame !== undefined) window.cancelAnimationFrame?.(frame);
    pointerAutoScrollFrame.current = undefined;
    pointerAutoScrollDirection.current = 0;
  };
  const continuePointerAutoScroll = (): void => {
    if (
      pointerAutoScrollFrame.current !== undefined ||
      pointerAutoScrollDirection.current === 0 ||
      typeof window.requestAnimationFrame !== 'function'
    ) {
      return;
    }
    const tick = (): void => {
      pointerAutoScrollFrame.current = undefined;
      const active = activePointerDrag.current;
      const direction = pointerAutoScrollDirection.current;
      if (active === undefined || direction === 0) return;
      scrollHubRoster(timelineRegion.current, direction);
      const target = hubBoardDropTargetFromElement(timelineRegion.current, active.x, active.y);
      if (!sameHubBoardDropTarget(active.target, target)) {
        const next = Object.freeze({ ...active, target });
        activePointerDrag.current = next;
        setPointerDrag(next);
      }
      pointerAutoScrollFrame.current = window.requestAnimationFrame(tick);
    };
    pointerAutoScrollFrame.current = window.requestAnimationFrame(tick);
  };
  const updatePointerAutoScroll = (clientY: number): void => {
    const direction = hubRosterScrollDirection(timelineRegion.current, clientY);
    if (direction === 0) {
      stopPointerAutoScroll();
      return;
    }
    pointerAutoScrollDirection.current = direction;
    continuePointerAutoScroll();
  };
  const clearPointerDrag = (pointerId?: number): void => {
    const pending = pendingPointerDrag.current;
    const active = activePointerDrag.current;
    const activePointerId = active?.pointerId ?? pending?.pointerId;
    if (pointerId !== undefined && activePointerId !== pointerId) return;
    stopPointerAutoScroll();
    pendingPointerDrag.current = undefined;
    activePointerDrag.current = undefined;
    if (pending?.handle.hasPointerCapture?.(pending.pointerId)) {
      pending.handle.releasePointerCapture(pending.pointerId);
    }
    setPointerDrag(undefined);
  };
  const beginPointerDrag = (event: ReactPointerEvent<HTMLSpanElement>, slotKey: string): void => {
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      pendingPointerDrag.current !== undefined ||
      activePointerDrag.current !== undefined
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pendingPointerDrag.current = Object.freeze({
      handle: event.currentTarget,
      originX: event.clientX,
      originY: event.clientY,
      pointerId: event.pointerId,
      slotKey,
    });
  };
  const updatePointerDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pending = pendingPointerDrag.current;
    if (pending === undefined || pending.pointerId !== event.pointerId) return;
    if (activePointerDrag.current === undefined) {
      const distance = Math.hypot(event.clientX - pending.originX, event.clientY - pending.originY);
      if (distance < 6) return;
    }
    const target = hubBoardDropTargetFromElement(
      timelineRegion.current,
      event.clientX,
      event.clientY,
    );
    const next = Object.freeze({
      pointerId: pending.pointerId,
      slotKey: pending.slotKey,
      target,
      x: event.clientX,
      y: event.clientY,
    });
    activePointerDrag.current = next;
    setPointerDrag(next);
    updatePointerAutoScroll(event.clientY);
  };
  const completePointerDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const active = activePointerDrag.current;
    const pending = pendingPointerDrag.current;
    if (
      (active === undefined && pending === undefined) ||
      (active?.pointerId ?? pending?.pointerId) !== event.pointerId
    ) {
      return;
    }
    const target =
      active === undefined
        ? undefined
        : hubBoardDropTargetFromElement(timelineRegion.current, event.clientX, event.clientY);
    clearPointerDrag(event.pointerId);
    if (active === undefined || target === undefined) return;
    const result = dropHubBoardRoom(ranking, node.requiredVisitCount, active.slotKey, target);
    if (result === undefined) return;
    const slot = slotsByKey.get(active.slotKey);
    if (slot === undefined) return;
    const announcement = hubMoveAnnouncement(
      slot.label,
      active.slotKey,
      result.ranking,
      node.requiredVisitCount,
    );
    if (result.proposedVisitOrder === undefined) {
      applyRankMove(result, announcement, undefined, false);
      return;
    }
    const proposal = visitOrderInteraction.proposalFor(result.proposedVisitOrder);
    const options = pointerOrderCandidates.activate(proposal);
    if (!candidateMayBeAuthored(options?.[0])) {
      setRankAnnouncement(`${slot.label} cannot be placed in that visit position.`);
      return;
    }
    applyRankMove(result, announcement, undefined, false);
    executeIntent(proposal.intent());
  };

  useLayoutEffect(() => {
    return () => {
      const frame = pointerAutoScrollFrame.current;
      if (frame !== undefined) window.cancelAnimationFrame?.(frame);
    };
  }, []);

  // A cross-cutoff move changes the card's parent grid, so React correctly
  // remounts its button. Restore keyboard focus to the matching named control
  // only after the exact projected prefix and transient tail agree with the
  // completed move; an intermediate Redux render cannot steal focus.
  useLayoutEffect(() => {
    const pending = pendingRankFocus.current;
    if (pending === undefined) return;
    if (
      !sameSlotKeys(pending.expectedRanking.rankedSlotKeys, ranking.rankedSlotKeys) ||
      !sameSlotKeys(pending.expectedRanking.authoredVisitOrder, ranking.authoredVisitOrder)
    ) {
      return;
    }
    const nextAction =
      pending.action === 'removeFromVisits'
        ? 'addToVisits'
        : pending.action === 'addToVisits'
          ? 'removeFromVisits'
          : pending.action;
    const card = Array.from(
      timelineRegion.current?.querySelectorAll<HTMLElement>('[data-hub-slot-key]') ?? [],
    ).find((element) => element.dataset.hubSlotKey === pending.slotKey);
    const requestedControl = card?.querySelector<HTMLButtonElement>(
      `[data-hub-rank-action="${nextAction}"]`,
    );
    const fallbackControl = Array.from(
      card?.querySelectorAll<HTMLButtonElement>('[data-hub-rank-action]') ?? [],
    ).find((control) => !control.disabled);
    (requestedControl?.disabled === false ? requestedControl : fallbackControl)?.focus({
      preventScroll: true,
    });
    pendingRankFocus.current = undefined;
  }, [ranking, rankingStateKey]);
  return (
    <section className="hub-board" aria-label="Hub visit timeline">
      <div className="owner-markers">
        <h4>Hub visit order</h4>
      </div>
      <p aria-live="polite" className="visually-hidden">
        {rankAnnouncement}
      </p>
      <div
        aria-label="Ranked open Ephyra rooms"
        className="hub-ranked-room-board"
        onLostPointerCapture={(event) => clearPointerDrag(event.pointerId)}
        onPointerCancel={(event) => clearPointerDrag(event.pointerId)}
        onPointerMove={updatePointerDrag}
        onPointerUp={completePointerDrag}
        ref={timelineRegion}
        role="group"
        tabIndex={-1}
      >
        <div aria-label="Planned visit order" className="hub-ranked-visit-prefix">
          {plannedSlots.map((slot, index) => {
            const visit = node.visits[index];
            if (visit === undefined) {
              throw new Error(`Hub visit ${index + 1} is missing from the workspace node.`);
            }
            return (
              <OpenHubRoomCard
                dropAfter={hubRosterDropState(
                  pointerDrag,
                  ranking,
                  node.requiredVisitCount,
                  Object.freeze({ kind: 'afterSlot', slotKey: slot.hubSlotKey }),
                )}
                dropBefore={hubRosterDropState(
                  pointerDrag,
                  ranking,
                  node.requiredVisitCount,
                  Object.freeze({ kind: 'beforeSlot', slotKey: slot.hubSlotKey }),
                )}
                focusedRewardOwnerKey={focusedRewardOwnerKey}
                interactions={interactions}
                key={slot.hubSlotKey}
                onPointerDragStarted={beginPointerDrag}
                onRankMove={applyRankMove}
                pointerDragging={pointerDrag?.slotKey === slot.hubSlotKey}
                ranking={ranking}
                requiredVisitCount={node.requiredVisitCount}
                rewardPresentation="preview"
                showMembership={false}
                slot={slot}
                visitMarker={visit.marker}
                visitOrderInteraction={visitOrderInteraction}
              />
            );
          })}
          {unplannedVisits.length === 0 ? null : (
            <HubNextVisitTarget
              drag={pointerDrag}
              ranking={ranking}
              requiredVisitCount={node.requiredVisitCount}
              visits={unplannedVisits}
            />
          )}
        </div>
        <div aria-label="Visit-order boundary" className="hub-visit-boundary">
          <span>Visit order ends here</span>
          <span>{node.requiredVisitCount} rooms traverse the pylons</span>
        </div>
        <div aria-label="Remaining open rooms" className="hub-ranked-tail">
          {remainingSlots.map((slot) => (
            <OpenHubRoomCard
              dropAfter={hubRosterDropState(
                pointerDrag,
                ranking,
                node.requiredVisitCount,
                Object.freeze({ kind: 'afterSlot', slotKey: slot.hubSlotKey }),
              )}
              dropBefore={hubRosterDropState(
                pointerDrag,
                ranking,
                node.requiredVisitCount,
                Object.freeze({ kind: 'beforeSlot', slotKey: slot.hubSlotKey }),
              )}
              focusedRewardOwnerKey={focusedRewardOwnerKey}
              interactions={interactions}
              key={slot.hubSlotKey}
              onPointerDragStarted={beginPointerDrag}
              onRankMove={applyRankMove}
              pointerDragging={pointerDrag?.slotKey === slot.hubSlotKey}
              ranking={ranking}
              requiredVisitCount={node.requiredVisitCount}
              rewardPresentation="preview"
              showMembership={false}
              slot={slot}
              visitOrderInteraction={visitOrderInteraction}
            />
          ))}
        </div>
        {pointerDrag === undefined ? null : (
          <div
            aria-hidden="true"
            className="hub-roster-drag-preview"
            style={{
              transform: `translate3d(${pointerDrag.x + 14}px, ${pointerDrag.y + 14}px, 0)`,
            }}
          >
            <span>⠿</span>
            {slotsByKey.get(pointerDrag.slotKey)?.label ?? 'Hub room'}
          </div>
        )}
      </div>
    </section>
  );
}

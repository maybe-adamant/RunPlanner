import { type PointerEvent as ReactPointerEvent, useLayoutEffect, useRef, useState } from 'react';

import { semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  dropHubBoardRoom,
  moveHubBoardRoom,
  reconcileHubBoardRanking,
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type HubBoardDropTarget,
  type HubBoardMove,
  type HubBoardMoveResult,
  type HubBoardRanking,
  type WorkspaceAuthoringFrontier,
  type WorkspaceCompletedHubHandoffInteraction,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubSlot,
  type WorkspaceHubSlotInteraction,
  type WorkspaceHubSlotOpeningAttempt,
  type WorkspaceHubVisitOrderInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
} from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { candidateSupport } from '@planner/projections/candidateProjection';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { TraitOfferLauncher } from '../rewards/TraitOfferEditor';
import { DoorRewardEditor } from './DoorRewardEditor';
import { RunStateLauncher } from './RunStateSheet';

interface HubDecisionWorkbenchProps {
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly node: WorkspaceHubDecisionNode;
}

type HubMembershipInput = 'keyboard' | 'pointer';
type HubMembershipSourceRegion = 'closed' | 'open';

interface HubMembershipTransition {
  readonly input: HubMembershipInput;
  readonly slotKey: string;
  readonly source: HubMembershipSourceRegion;
}

interface PendingHubMembershipFocus extends HubMembershipTransition {
  readonly beforeSlots: WorkspaceHubDecisionNode['slots'];
}

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

interface HubRosterPointerDrag {
  readonly pointerId: number;
  readonly slotKey: string;
  readonly target: HubBoardDropTarget | undefined;
  readonly x: number;
  readonly y: number;
}

type HubRosterDropState = 'available' | 'unavailable';
type HubRosterScrollDirection = -1 | 0 | 1;

function domId(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_-]/g, '-');
}

function sameSlotKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function sameHubBoardDropTarget(
  left: HubBoardDropTarget | undefined,
  right: HubBoardDropTarget | undefined,
): boolean {
  if (left === right) return true;
  if (left === undefined || right === undefined || left.kind !== right.kind) return false;
  if (left.kind === 'nextVisit' || right.kind === 'nextVisit') return true;
  return left.slotKey === right.slotKey;
}

function hubRosterDropState(
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

function hubBoardDropTargetFromElement(
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

function hubRosterScrollDirection(
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

function scrollHubRoster(
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

function assessmentLabel(marker: WorkspaceMarker): string {
  switch (marker.assessment) {
    case 'assessed':
      return 'Evaluated';
    case 'blocked':
      return 'Blocked';
    case 'unassessed':
      return 'Not evaluated';
  }
}

function MarkerAssessment({ marker }: { readonly marker: WorkspaceMarker }) {
  if (marker.assessment === 'assessed') return null;

  return (
    <span className="hub-owner-assessment" data-assessment={marker.assessment}>
      {assessmentLabel(marker)}
    </span>
  );
}

function membershipSlotsNearestFirst(
  slots: WorkspaceHubDecisionNode['slots'],
  source: HubMembershipSourceRegion,
  movedSlotKey: string,
): readonly WorkspaceHubSlot[] {
  const movedIndex = slots.findIndex((slot) => slot.hubSlotKey === movedSlotKey);
  if (movedIndex === -1) return [];
  const sourceOpen = source === 'open';
  const sourceSlots = slots.filter((slot) => slot.open === sourceOpen);
  const later = sourceSlots.filter(
    (slot) => slots.findIndex((candidate) => candidate.hubSlotKey === slot.hubSlotKey) > movedIndex,
  );
  const earlier = sourceSlots
    .filter(
      (slot) =>
        slots.findIndex((candidate) => candidate.hubSlotKey === slot.hubSlotKey) < movedIndex,
    )
    .reverse();
  return Object.freeze([...later, ...earlier]);
}

function membershipControlIn(
  region: Element | null | undefined,
  slotKey: string,
): HTMLInputElement | undefined {
  const slot = Array.from(region?.querySelectorAll<HTMLElement>('[data-hub-slot-key]') ?? []).find(
    (element) => element.dataset.hubSlotKey === slotKey,
  );
  const control = slot?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  return control === null || control?.disabled ? undefined : control;
}

function HubSlotMembership({
  interaction,
  onMembershipTransition,
  slot,
}: {
  readonly interaction: WorkspaceHubSlotInteraction;
  readonly onMembershipTransition: (transition: HubMembershipTransition) => void;
  readonly slot: WorkspaceHubSlot;
}) {
  if (slot.open !== interaction.selected) {
    throw new Error('A Hub slot interaction must match its projected membership state.');
  }
  if (interaction.selected && slot.canClose && interaction.close === undefined) {
    throw new Error('A closable Hub slot must retain its CloseHubSlot interaction.');
  }
  const executeIntent = useCommandIntent();
  type OpeningInteraction = Extract<WorkspaceHubSlotInteraction, { readonly selected: false }>;
  type OpeningAttemptRecord = {
    readonly attempt: WorkspaceHubSlotOpeningAttempt;
    readonly interaction: OpeningInteraction;
    readonly interactionVersion: number;
  };
  const [interactionIdentity, setInteractionIdentity] = useState({ interaction, version: 0 });
  const interactionVersion =
    interactionIdentity.interaction === interaction
      ? interactionIdentity.version
      : interactionIdentity.version + 1;
  if (interactionIdentity.interaction !== interaction) {
    setInteractionIdentity(Object.freeze({ interaction, version: interactionVersion }));
  }
  const attemptRef = useRef<OpeningAttemptRecord | undefined>(undefined);
  const membershipInput = useRef<HubMembershipInput>('keyboard');
  const [attemptRecord, setAttemptRecord] = useState<OpeningAttemptRecord | undefined>(undefined);
  const beginAttempt = (): WorkspaceHubSlotOpeningAttempt => {
    if (interaction.selected) {
      throw new Error('An open Hub slot cannot begin another opening attempt.');
    }
    const existing = attemptRef.current;
    if (
      existing?.interaction === interaction &&
      existing.interactionVersion === interactionVersion
    ) {
      return existing.attempt;
    }
    const attempt = interaction.beginOpeningAttempt();
    const record = Object.freeze({ attempt, interaction, interactionVersion });
    attemptRef.current = record;
    setAttemptRecord(record);
    return attempt;
  };
  const cancelAttempt = (): void => {
    if (
      attemptRef.current?.interaction !== interaction ||
      attemptRef.current.interactionVersion !== interactionVersion
    ) {
      return;
    }
    attemptRef.current = undefined;
    setAttemptRecord((record) =>
      record?.interaction === interaction && record.interactionVersion === interactionVersion
        ? undefined
        : record,
    );
  };
  const activeAttempt =
    !interaction.selected &&
    attemptRecord?.interaction === interaction &&
    attemptRecord.interactionVersion === interactionVersion
      ? attemptRecord.attempt
      : undefined;
  const candidates =
    useWorkspaceInteractionController<ReturnType<WorkspaceHubSlotOpeningAttempt['load']>>();
  const candidateInteraction = interaction.selected ? interaction.close : activeAttempt;
  const candidateState = candidates.observe(candidateInteraction);
  const proposedOpen = !slot.open;
  const candidate = candidateState.result?.find((option) => option.value === proposedOpen);
  const structurallyDisabled = slot.open ? !slot.canClose : !slot.canOpen;
  const disabled =
    structurallyDisabled ||
    (interaction.selected && interaction.close === undefined) ||
    (candidate !== undefined && !candidateMayBeAuthored(candidate));

  return (
    <div className="hub-membership-action">
      <label
        className="hub-membership-control"
        data-candidate-support={candidateSupport(candidate)}
        data-opening-attempt={activeAttempt === undefined ? undefined : 'active'}
        onPointerDown={() => {
          membershipInput.current = 'pointer';
          if (disabled) return;
          if (interaction.selected) {
            if (interaction.close !== undefined) candidates.activate(interaction.close);
            return;
          }
          const attempt = beginAttempt();
          candidates.activate(attempt);
        }}
      >
        <input
          aria-busy={candidateState.pending || undefined}
          aria-label={`${slot.label} open`}
          checked={slot.open}
          disabled={disabled}
          onBlur={() => {
            if (!interaction.selected) cancelAttempt();
          }}
          onChange={(event) => {
            const open = event.target.checked;
            const input = membershipInput.current;
            membershipInput.current = 'keyboard';
            const transition = Object.freeze({
              input,
              slotKey: slot.hubSlotKey,
              source: slot.open ? 'open' : 'closed',
            });
            if (open) {
              const attempt = beginAttempt();
              const options = candidateState.result ?? candidates.activate(attempt);
              const option = options?.find((candidate) => candidate.value);
              if (candidateMayBeAuthored(option)) {
                onMembershipTransition(transition);
                executeIntent(attempt.intentFor(true));
              }
              return;
            }
            if (!interaction.selected || interaction.close === undefined) return;
            const options = candidateState.result ?? candidates.activate(interaction.close);
            const option = options?.find((candidate) => !candidate.value);
            if (candidateMayBeAuthored(option)) {
              onMembershipTransition(transition);
              executeIntent(interaction.close.intentFor(false));
            }
          }}
          onFocus={() => {
            if (interaction.selected && interaction.close !== undefined) {
              candidates.activate(interaction.close);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter' || event.key === 'Spacebar') {
              membershipInput.current = 'keyboard';
            }
            if (event.key === 'Escape' && !interaction.selected) cancelAttempt();
          }}
          type="checkbox"
        />
        <span className="hub-membership-control-label">Open</span>
      </label>
    </div>
  );
}

function HubSlotMembershipControl({
  interactions,
  onMembershipTransition,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onMembershipTransition: (transition: HubMembershipTransition) => void;
  readonly slot: WorkspaceHubSlot;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.hubSlots,
    workspaceInteractionKey(slot.marker.address),
  );
  return (
    <HubSlotMembership
      interaction={interaction}
      onMembershipTransition={onMembershipTransition}
      slot={slot}
    />
  );
}

function hubMoveAnnouncement(
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

function HubRoomOrderControls({
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

function HubNextVisitTarget({
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

function OpenHubRoomCard({
  dropAfter,
  dropBefore,
  focusedRewardOwnerKey,
  interactions,
  onMembershipTransition,
  onPointerDragStarted,
  onRankMove,
  pointerDragging,
  ranking,
  requiredVisitCount,
  visitOrderInteraction,
  visitMarker,
  slot,
}: {
  readonly dropAfter: HubRosterDropState | undefined;
  readonly dropBefore: HubRosterDropState | undefined;
  readonly focusedRewardOwnerKey: string | undefined;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onMembershipTransition: (transition: HubMembershipTransition) => void;
  readonly onPointerDragStarted: (
    event: ReactPointerEvent<HTMLSpanElement>,
    slotKey: string,
  ) => void;
  readonly onRankMove: (
    result: HubBoardMoveResult,
    announcement: string,
    action: HubBoardMove,
  ) => void;
  readonly pointerDragging: boolean;
  readonly ranking: HubBoardRanking;
  readonly requiredVisitCount: number;
  readonly slot: WorkspaceHubSlot;
  readonly visitMarker?: WorkspaceMarker;
  readonly visitOrderInteraction: WorkspaceHubVisitOrderInteraction;
}) {
  const dispatch = useAppDispatch();
  const card = useRef<HTMLElement>(null);
  const rewards =
    slot.door?.rewardPreview.kind === 'visible' ? slot.door.rewardPreview.rewards : undefined;
  const reward = rewards?.length === 1 ? rewards[0] : undefined;
  const rewardOwnerKey =
    reward === undefined ? undefined : semanticAddressKey(reward.marker.address);
  const focusedMainReward = rewardOwnerKey === focusedRewardOwnerKey;
  const encounterTraitOffers =
    slot.room?.encounterPhases.flatMap((phase) =>
      phase.traitOffer === undefined ? [] : [phase.traitOffer],
    ) ?? [];
  const canInspectLocalDetail = slot.visited && slot.room !== undefined;
  const visitPosition = ranking.authoredVisitOrder.indexOf(slot.hubSlotKey);
  const showSlotAssessment =
    visitMarker === undefined || visitMarker.assessment !== slot.marker.assessment;

  // A reward owner deliberately resolves to the Hub board. Keep the picker
  // closed, but bring the existing card into view so the returned destination
  // is evident when the board is longer than the inspector viewport. Focusing
  // the existing trigger also gives keyboard users a precise return point
  // without opening the picker.
  useLayoutEffect(() => {
    if (!focusedMainReward) return;
    card.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    card.current
      ?.querySelector<HTMLButtonElement>('.hub-main-reward .contextual-picker-trigger')
      ?.focus({ preventScroll: true });
  }, [focusedMainReward]);

  return (
    <article
      aria-label={`${slot.label} Hub room`}
      className="hub-slot-card hub-open-room-card"
      data-dragging={pointerDragging || undefined}
      data-drop-after={dropAfter}
      data-drop-before={dropBefore}
      data-focused-main-reward={focusedMainReward || undefined}
      data-hub-slot-key={slot.hubSlotKey}
      data-open="true"
      data-visit-position={visitPosition === -1 ? undefined : visitPosition + 1}
      data-visited={slot.room?.entered}
      ref={card}
    >
      <div className="hub-roster-primary">
        <span
          aria-hidden="true"
          className="hub-roster-drag-handle"
          data-hub-roster-drag-handle
          data-dragging={pointerDragging || undefined}
          onPointerDown={(event) => onPointerDragStarted(event, slot.hubSlotKey)}
        >
          ⠿
        </span>
        <span aria-hidden="true" className="hub-roster-rank">
          {visitPosition === -1 ? '—' : visitPosition + 1}
        </span>
        <div className="hub-roster-identity">
          <div className="hub-slot-heading">
            <div className="owner-markers">
              <h3>{slot.label}</h3>
              <SemanticOwnerMarker address={slot.marker.address} />
              {visitMarker === undefined ? null : (
                <SemanticOwnerMarker address={visitMarker.address} />
              )}
            </div>
          </div>
          <div className="hub-slot-meta">
            <div className="hub-slot-state">
              <span className="room-kind">{slot.roomKind}</span>
              {slot.room?.entered ? <span className="neutral-status">Entered</span> : null}
              {visitMarker === undefined ? null : <MarkerAssessment marker={visitMarker} />}
              {showSlotAssessment ? <MarkerAssessment marker={slot.marker} /> : null}
            </div>
            {!canInspectLocalDetail || slot.room === undefined ? null : (
              <button
                aria-label={`Open details for ${slot.label}`}
                className="semantic-focus-link"
                onClick={() => dispatch(semanticOwnerFocused(slot.room!.marker.address))}
                type="button"
              >
                Room details
              </button>
            )}
          </div>
        </div>
        <HubSlotMembershipControl
          interactions={interactions}
          onMembershipTransition={onMembershipTransition}
          slot={slot}
        />
        <HubRoomOrderControls
          interaction={visitOrderInteraction}
          onApplied={onRankMove}
          ranking={ranking}
          requiredVisitCount={requiredVisitCount}
          slot={slot}
        />
      </div>
      {rewards === undefined || rewards.length === 0 || slot.door === undefined ? null : (
        <div
          className="hub-main-reward room-state-with-marker"
          data-focused-main-reward={focusedMainReward || undefined}
          data-hub-main-reward-owner={rewardOwnerKey}
        >
          <DoorRewardEditor
            door={slot.door}
            idPrefix={`hub-${slot.hubSlotKey}`}
            interactions={interactions}
          />
        </div>
      )}
      {encounterTraitOffers.length === 0 ? null : (
        <div className="trait-offer-launchers hub-room-trait-offers">
          {encounterTraitOffers.map((traitOffer) => (
            <TraitOfferLauncher
              control={traitOffer}
              interactions={interactions}
              key={workspaceInteractionKey(traitOffer.address)}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function ClosedHubRoomOption({
  interactions,
  onMembershipTransition,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onMembershipTransition: (transition: HubMembershipTransition) => void;
  readonly slot: WorkspaceHubSlot;
}) {
  return (
    <article
      aria-label={`${slot.label} Hub room`}
      className="hub-closed-room-option"
      data-hub-slot-key={slot.hubSlotKey}
      data-open="false"
    >
      <div className="hub-slot-heading">
        <div className="owner-markers">
          <h3>{slot.label}</h3>
          <SemanticOwnerMarker address={slot.marker.address} />
        </div>
        <HubSlotMembershipControl
          interactions={interactions}
          onMembershipTransition={onMembershipTransition}
          slot={slot}
        />
      </div>
      <div className="hub-slot-meta">
        <div className="hub-slot-state">
          <span className="room-kind">{slot.roomKind}</span>
          <MarkerAssessment marker={slot.marker} />
        </div>
      </div>
    </article>
  );
}

function CompletedHubHandoff({
  interaction,
}: {
  readonly interaction: WorkspaceCompletedHubHandoffInteraction;
}) {
  const executeIntent = useCommandIntent();
  return (
    <section className="takeover-action" data-presentation={interaction.presentation}>
      <div className="owner-markers">
        <h4>Continue to Preboss</h4>
        <SemanticOwnerMarker address={interaction.owner} />
      </div>
      <p className="fixed-room-state">All required Hub visits are complete.</p>
      <button
        className="primary-action"
        onClick={() => executeIntent(interaction.intent())}
        type="button"
      >
        {interaction.label}
      </button>
    </section>
  );
}

/**
 * N-specific composition over the workspace contract.  It consumes only
 * projected board/visit facts and semantic capabilities; no catalog, topology
 * or simulator product is re-read in the React layer.
 */
export function HubDecisionWorkbench({ frontier, interactions, node }: HubDecisionWorkbenchProps) {
  const executeIntent = useCommandIntent();
  const focusedOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const selectedFinding = useAppSelector((state) => state.editorSession.selectedFinding);
  const semanticNavigationRevision = useAppSelector(
    (state) => state.editorSession.semanticNavigationRevision,
  );
  const handoff =
    frontier?.kind === 'exitDecision' && frontier.owner.source.kind === 'hubDecision'
      ? requireWorkspaceInteraction(interactions.takeoverBatches, frontier.interactionKey)
      : undefined;
  if (handoff !== undefined && handoff.presentation !== 'completedHubHandoff') {
    throw new Error('The completed Hub frontier must expose its fixed Preboss handoff.');
  }
  const titleId = `hub-${domId(node.marker.focusKey)}`;
  const openSlots = node.slots.filter((slot) => slot.open);
  const closedSlots = node.slots.filter((slot) => !slot.open);
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
  const removal = requireWorkspaceInteraction(
    interactions.topologyRemovals,
    workspaceInteractionKey(node.owner),
  );
  const closedSlotOwnerKeys = new Set(
    closedSlots.map((slot) => semanticAddressKey(slot.marker.address)),
  );
  const focusedOwnerKey = focusedOwner === null ? undefined : semanticAddressKey(focusedOwner);
  const selectedFindingOwnerKey =
    selectedFinding === null ? undefined : semanticAddressKey(selectedFinding.origin);
  const revealedClosedOwnerKey =
    selectedFindingOwnerKey !== undefined && closedSlotOwnerKeys.has(selectedFindingOwnerKey)
      ? selectedFindingOwnerKey
      : focusedOwnerKey !== undefined && closedSlotOwnerKeys.has(focusedOwnerKey)
        ? focusedOwnerKey
        : undefined;
  const closedRevealSignal =
    revealedClosedOwnerKey === undefined
      ? undefined
      : selectedFindingOwnerKey === revealedClosedOwnerKey
        ? `${revealedClosedOwnerKey}:${semanticNavigationRevision}`
        : revealedClosedOwnerKey;
  const closedDisclosure = useRef<HTMLDetailsElement>(null);
  const openMembershipRegion = useRef<HTMLDivElement>(null);
  const previousClosedReveal = useRef<string | undefined>(undefined);
  const pendingMembershipFocus = useRef<PendingHubMembershipFocus | undefined>(undefined);
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
  const continueKeyboardMembershipAfterTransition = (transition: HubMembershipTransition): void => {
    if (transition.input !== 'keyboard') return;
    pendingMembershipFocus.current = Object.freeze({
      ...transition,
      beforeSlots: node.slots,
    });
  };
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
      scrollHubRoster(openMembershipRegion.current, direction);
      const target = hubBoardDropTargetFromElement(
        openMembershipRegion.current,
        active.x,
        active.y,
      );
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
    const direction = hubRosterScrollDirection(openMembershipRegion.current, clientY);
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
      openMembershipRegion.current,
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
        : hubBoardDropTargetFromElement(openMembershipRegion.current, event.clientX, event.clientY);
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
      openMembershipRegion.current?.querySelectorAll<HTMLElement>('[data-hub-slot-key]') ?? [],
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

  // The marker's own passive focus effect must never run while its native
  // disclosure is closed. Imperatively revealing the local details element in
  // a layout effect retains native open/closed ownership after the reveal.
  useLayoutEffect(() => {
    if (closedRevealSignal === undefined) {
      previousClosedReveal.current = undefined;
      return;
    }
    if (previousClosedReveal.current === closedRevealSignal) return;
    closedDisclosure.current?.setAttribute('open', '');
    previousClosedReveal.current = closedRevealSignal;
  }, [closedRevealSignal]);

  // Membership edits move a checkbox between the open-board and closed-room
  // regions. Pointer changes retain their viewport. Keyboard changes continue
  // in the source batch, instead of focusing the moved room and unexpectedly
  // navigating the user away from the controls they were composing.
  useLayoutEffect(() => {
    const pending = pendingMembershipFocus.current;
    if (pending === undefined) return;
    if (node.slots === pending.beforeSlots) return;
    const slot = node.slots.find((candidate) => candidate.hubSlotKey === pending.slotKey);
    const expectedOpen = pending.source === 'closed';
    if (slot === undefined || slot.open !== expectedOpen) {
      pendingMembershipFocus.current = undefined;
      return;
    }
    const sourceRegion =
      pending.source === 'open' ? openMembershipRegion.current : closedDisclosure.current;
    const control = membershipSlotsNearestFirst(node.slots, pending.source, pending.slotKey)
      .map((candidate) => membershipControlIn(sourceRegion, candidate.hubSlotKey))
      .find((candidate) => candidate !== undefined);
    if (control !== undefined) {
      control.focus({ preventScroll: true });
    } else if (pending.source === 'closed') {
      // At the maximum open count the remaining closed controls cannot open.
      // The disclosure summary is the stable nearby control.
      closedDisclosure.current
        ?.querySelector<HTMLElement>('summary')
        ?.focus({ preventScroll: true });
    } else {
      // When no other open room has an enabled close control, retain a
      // visible, named focus anchor in the open board instead of moving down
      // to the just-closed room.
      openMembershipRegion.current?.focus({ preventScroll: true });
    }
    pendingMembershipFocus.current = undefined;
  }, [node.slots]);

  return (
    <section className="hub-decision-workbench" aria-label="Ephyra Hub">
      <section className="hub-board" aria-labelledby={`${titleId}-board-title`}>
        <header className="decision-heading">
          <div>
            <div className="owner-markers">
              <h3 id={`${titleId}-board-title`}>Hub traversal</h3>
              <SemanticOwnerMarker address={node.owner} />
              {node.runState === undefined ? null : <RunStateLauncher launcher={node.runState} />}
              <SemanticOwnerMarker address={node.openSet.address} />
            </div>
          </div>
          <div className="hub-board-status">
            <span className="neutral-status">
              {node.openSlotCount.current} open · {node.openSlotCount.min}–{node.openSlotCount.max}{' '}
              required
            </span>
            <span className="neutral-status">
              {authoredVisitCount} of {node.requiredVisitCount} planned
            </span>
            <MarkerAssessment marker={node.openSet} />
          </div>
        </header>
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
          ref={openMembershipRegion}
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
                  focusedRewardOwnerKey={focusedOwnerKey}
                  interactions={interactions}
                  key={slot.hubSlotKey}
                  onMembershipTransition={continueKeyboardMembershipAfterTransition}
                  onPointerDragStarted={beginPointerDrag}
                  onRankMove={applyRankMove}
                  pointerDragging={pointerDrag?.slotKey === slot.hubSlotKey}
                  ranking={ranking}
                  requiredVisitCount={node.requiredVisitCount}
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
                focusedRewardOwnerKey={focusedOwnerKey}
                interactions={interactions}
                key={slot.hubSlotKey}
                onMembershipTransition={continueKeyboardMembershipAfterTransition}
                onPointerDragStarted={beginPointerDrag}
                onRankMove={applyRankMove}
                pointerDragging={pointerDrag?.slotKey === slot.hubSlotKey}
                ranking={ranking}
                requiredVisitCount={node.requiredVisitCount}
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
      {handoff === undefined ? null : <CompletedHubHandoff interaction={handoff} />}
      {closedSlots.length === 0 ? null : (
        <details className="hub-closed-room-disclosure" ref={closedDisclosure}>
          <summary>Closed rooms ({closedSlots.length})</summary>
          <div className="hub-closed-room-grid">
            {closedSlots.map((slot) => (
              <ClosedHubRoomOption
                interactions={interactions}
                key={slot.hubSlotKey}
                onMembershipTransition={continueKeyboardMembershipAfterTransition}
                slot={slot}
              />
            ))}
          </div>
        </details>
      )}
      <div className="workbench-action-row">
        <button
          className="danger-action"
          data-command={removal.intent.command.kind}
          onClick={() => executeIntent(removal.intent)}
          type="button"
        >
          Remove Hub
        </button>
      </div>
    </section>
  );
}

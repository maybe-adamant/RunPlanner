import { useLayoutEffect, useRef, useState } from 'react';

import { semanticAddressKey } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceAuthoringFrontier,
  type WorkspaceCompletedHubHandoffInteraction,
  type WorkspaceHubDecisionNode,
  type WorkspaceHubSlot,
  type WorkspaceHubSlotInteraction,
  type WorkspaceHubSlotOpeningAttempt,
  type WorkspaceHubVisit,
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
import { CandidateSelect } from './CandidateSelect';
import {
  hasMeaningfulRoomLocalDetail,
  hubMainRewardPresentation,
} from './hubMainRewardPresentation';
import { RewardControlEditor } from '../rewards/RewardControlEditor';

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

function domId(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_-]/g, '-');
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
        Open
      </label>
    </div>
  );
}

function HubSlotMembershipControl({
  authoring,
  interactions,
  onMembershipTransition,
  slot,
}: {
  readonly authoring: WorkspaceHubDecisionNode['authoring'];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onMembershipTransition: (transition: HubMembershipTransition) => void;
  readonly slot: WorkspaceHubSlot;
}) {
  const interaction =
    authoring === 'authored'
      ? requireWorkspaceInteraction(
          interactions.hubSlots,
          workspaceInteractionKey(slot.marker.address),
        )
      : undefined;
  return interaction === undefined ? null : (
    <HubSlotMembership
      interaction={interaction}
      onMembershipTransition={onMembershipTransition}
      slot={slot}
    />
  );
}

function OpenHubRoomCard({
  authoring,
  focusedRewardOwnerKey,
  interactions,
  onMembershipTransition,
  slot,
}: {
  readonly authoring: WorkspaceHubDecisionNode['authoring'];
  readonly focusedRewardOwnerKey: string | undefined;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onMembershipTransition: (transition: HubMembershipTransition) => void;
  readonly slot: WorkspaceHubSlot;
}) {
  const dispatch = useAppDispatch();
  const card = useRef<HTMLElement>(null);
  const reward = hubMainRewardPresentation(slot.room, interactions);
  const rewardOwnerKey =
    reward === undefined ? undefined : semanticAddressKey(reward.marker.address);
  const focusedMainReward = rewardOwnerKey === focusedRewardOwnerKey;
  const canInspectLocalDetail =
    slot.visited && slot.room !== undefined && hasMeaningfulRoomLocalDetail(slot.room);

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
      data-focused-main-reward={focusedMainReward || undefined}
      data-hub-slot-key={slot.hubSlotKey}
      data-open="true"
      data-visited={slot.visited}
      ref={card}
    >
      <div className="hub-slot-heading">
        <div className="owner-markers">
          <h3>{slot.label}</h3>
          <SemanticOwnerMarker address={slot.marker.address} />
        </div>
        <HubSlotMembershipControl
          authoring={authoring}
          interactions={interactions}
          onMembershipTransition={onMembershipTransition}
          slot={slot}
        />
      </div>
      <div className="hub-slot-meta">
        <div className="hub-slot-state">
          <span className="room-kind">{slot.roomKind}</span>
          {slot.visited ? <span className="neutral-status">Visited</span> : null}
          <MarkerAssessment marker={slot.marker} />
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
      {reward === undefined ? null : (
        <div
          className="hub-main-reward room-state-with-marker"
          data-focused-main-reward={focusedMainReward || undefined}
          data-hub-main-reward-owner={rewardOwnerKey}
        >
          <SemanticOwnerMarker address={reward.marker.address} />
          {reward.control === undefined ? (
            <p className="fixed-room-state">Fixed reward: {reward.summary}</p>
          ) : (
            <RewardControlEditor
              control={reward.control}
              idPrefix={`hub-${slot.hubSlotKey}`}
              interactions={interactions}
            />
          )}
        </div>
      )}
    </article>
  );
}

function ClosedHubRoomOption({
  authoring,
  interactions,
  onMembershipTransition,
  slot,
}: {
  readonly authoring: WorkspaceHubDecisionNode['authoring'];
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
          authoring={authoring}
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

function HubOutlineRoomOption({ slot }: { readonly slot: WorkspaceHubSlot }) {
  return (
    <li className="hub-outline-room-option">
      <div className="owner-markers">
        <span>{slot.label}</span>
        <SemanticOwnerMarker address={slot.marker.address} />
      </div>
      <span className="room-kind">{slot.roomKind}</span>
    </li>
  );
}

function HubVisitRow({
  interactions,
  visit,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly visit: WorkspaceHubVisit;
}) {
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const canChoose = visit.authoring === 'authored' || visit.authoring === 'next';
  const interaction = canChoose
    ? requireWorkspaceInteraction(
        interactions.hubVisits,
        workspaceInteractionKey(visit.marker.address),
      )
    : undefined;
  if (visit.authoring === 'authored' && interaction?.removal === undefined) {
    throw new Error('An authored Hub visit must retain its RemoveHubVisitsFrom interaction.');
  }
  const reward =
    visit.authoring === 'authored'
      ? hubMainRewardPresentation(visit.room, interactions)
      : undefined;
  const label =
    visit.authoring === 'locked'
      ? 'Complete prior visit'
      : visit.authoring === 'next'
        ? 'Choose next room'
        : 'Visited room';

  return (
    <li className="hub-visit-row" data-authoring={visit.authoring}>
      <div className="hub-visit-index">{visit.visitIndex}</div>
      <div className="hub-visit-content">
        <div className="owner-markers">
          <button
            className="semantic-focus-link"
            onClick={() =>
              dispatch(semanticOwnerFocused(visit.room?.marker.address ?? visit.marker.address))
            }
            type="button"
          >
            {visit.room?.label ?? label}
          </button>
          <SemanticOwnerMarker address={visit.marker.address} />
          <MarkerAssessment marker={visit.marker} />
        </div>
        {reward === undefined ? null : <p className="hub-visit-reward">Reward: {reward.summary}</p>}
        {interaction === undefined ? (
          <p className="fixed-room-state">{label}</p>
        ) : (
          <CandidateSelect
            id={`hub-visit-${domId(visit.marker.focusKey)}`}
            interaction={interaction}
            label={`Visit ${visit.visitIndex} room`}
            onReplace={(hubSlotKey) => executeIntent(interaction.intentFor(hubSlotKey))}
            {...(visit.authoring === 'next' ? { placeholder: 'Choose next room' } : {})}
          />
        )}
      </div>
      {interaction?.removal === undefined ? null : (
        <button
          aria-label={`Remove visits from Visit ${visit.visitIndex}`}
          className="danger-action action-compact"
          onClick={() => executeIntent(interaction.removal!)}
          type="button"
        >
          Remove from here
        </button>
      )}
    </li>
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
  const findingNavigationRevision = useAppSelector(
    (state) => state.editorSession.findingNavigationRevision,
  );
  const creation =
    frontier?.kind === 'hubDecision'
      ? requireWorkspaceInteraction(interactions.structural, frontier.interactionKey)
      : undefined;
  const handoff =
    frontier?.kind === 'exitDecision' && frontier.owner.source.kind === 'hubDecision'
      ? requireWorkspaceInteraction(interactions.takeoverBatches, frontier.interactionKey)
      : undefined;
  if (creation !== undefined && creation.action !== 'createHubDecision') {
    throw new Error('The Hub creation frontier must expose a CreateHubDecision interaction.');
  }
  if (handoff !== undefined && handoff.presentation !== 'completedHubHandoff') {
    throw new Error('The completed Hub frontier must expose its fixed Preboss handoff.');
  }
  const titleId = `hub-${domId(node.marker.focusKey)}`;
  const openSlots = node.slots.filter((slot) => slot.open);
  const closedSlots = node.slots.filter((slot) => !slot.open);
  const authoredVisitCount = node.visits.filter((visit) => visit.authoring === 'authored').length;
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
    node.authoring !== 'authored' || revealedClosedOwnerKey === undefined
      ? undefined
      : selectedFindingOwnerKey === revealedClosedOwnerKey
        ? `${revealedClosedOwnerKey}:${findingNavigationRevision}`
        : revealedClosedOwnerKey;
  const closedDisclosure = useRef<HTMLDetailsElement>(null);
  const openMembershipRegion = useRef<HTMLDivElement>(null);
  const previousClosedReveal = useRef<string | undefined>(undefined);
  const pendingMembershipFocus = useRef<PendingHubMembershipFocus | undefined>(undefined);
  const continueKeyboardMembershipAfterTransition = (transition: HubMembershipTransition): void => {
    if (transition.input !== 'keyboard') return;
    pendingMembershipFocus.current = Object.freeze({
      ...transition,
      beforeSlots: node.slots,
    });
  };

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
              <p className="card-kicker">Open Hub rooms</p>
              <SemanticOwnerMarker address={node.owner} />
              <SemanticOwnerMarker address={node.openSet.address} />
            </div>
            <h3 id={`${titleId}-board-title`}>Open Ephyra rooms</h3>
          </div>
          <div className="hub-board-status">
            <span className="neutral-status">
              {node.authoring === 'authored'
                ? `${node.openSlotCount.current} open · ${node.openSlotCount.min}–${node.openSlotCount.max} required`
                : `${node.slots.length} possible`}
            </span>
            <MarkerAssessment marker={node.openSet} />
          </div>
        </header>
        {creation === undefined ? null : (
          <div className="hub-board-action">
            <button
              className="primary-action"
              onClick={() => executeIntent(creation.intent)}
              type="button"
            >
              Set up Hub rooms
            </button>
          </div>
        )}
        {node.authoring === 'authored' ? (
          <div
            aria-label="Open Ephyra rooms"
            className="hub-open-room-grid"
            ref={openMembershipRegion}
            role="group"
            tabIndex={-1}
          >
            {openSlots.map((slot) => (
              <OpenHubRoomCard
                authoring={node.authoring}
                focusedRewardOwnerKey={focusedOwnerKey}
                interactions={interactions}
                key={slot.hubSlotKey}
                onMembershipTransition={continueKeyboardMembershipAfterTransition}
                slot={slot}
              />
            ))}
          </div>
        ) : (
          <details className="hub-outline-room-disclosure">
            <summary>Possible Hub rooms ({node.slots.length})</summary>
            <ul className="hub-outline-room-list">
              {node.slots.map((slot) => (
                <HubOutlineRoomOption key={slot.hubSlotKey} slot={slot} />
              ))}
            </ul>
          </details>
        )}
      </section>
      <section className="hub-visit-timeline" aria-labelledby={`${titleId}-visits-title`}>
        <header className="decision-heading">
          <div>
            <p className="card-kicker">Player traversal</p>
            <h3 id={`${titleId}-visits-title`}>Pylon visit order</h3>
          </div>
          <span className="neutral-status">
            {authoredVisitCount} of {node.requiredVisitCount} planned
          </span>
        </header>
        {node.authoring === 'authored' ? (
          <ol className="hub-visit-list">
            {node.visits.map((visit) => (
              <HubVisitRow interactions={interactions} key={visit.visitIndex} visit={visit} />
            ))}
          </ol>
        ) : (
          <p className="hub-empty-visit-state">
            {creation === undefined
              ? 'Hub visits become available when the route reaches the Hub.'
              : 'Set up Hub rooms to plan six Pylon visits.'}
          </p>
        )}
      </section>
      {handoff === undefined ? null : <CompletedHubHandoff interaction={handoff} />}
      {node.authoring !== 'authored' || closedSlots.length === 0 ? null : (
        <details className="hub-closed-room-disclosure" ref={closedDisclosure}>
          <summary>Closed rooms ({closedSlots.length})</summary>
          <div className="hub-closed-room-grid">
            {closedSlots.map((slot) => (
              <ClosedHubRoomOption
                authoring={node.authoring}
                interactions={interactions}
                key={slot.hubSlotKey}
                onMembershipTransition={continueKeyboardMembershipAfterTransition}
                slot={slot}
              />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

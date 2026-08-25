/* eslint-disable react-refresh/only-export-components */

import { useRef, useState } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceHubSlot,
  type WorkspaceHubSlotInteraction,
  type WorkspaceHubSlotOpeningAttempt,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
} from '@planner/projections/structured-workspace';
import { candidateSupport } from '@planner/projections/candidateProjection';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

export type HubMembershipInput = 'keyboard' | 'pointer';
export type HubMembershipSourceRegion = 'closed' | 'open';

export interface HubMembershipTransition {
  readonly input: HubMembershipInput;
  readonly slotKey: string;
  readonly source: HubMembershipSourceRegion;
}

export function assessmentLabel(marker: WorkspaceMarker): string {
  switch (marker.assessment) {
    case 'assessed':
      return 'Evaluated';
    case 'blocked':
      return 'Blocked';
    case 'unassessed':
      return 'Not evaluated';
  }
}

export function MarkerAssessment({ marker }: { readonly marker: WorkspaceMarker }) {
  if (marker.assessment === 'assessed') return null;
  return (
    <span className="hub-owner-assessment" data-assessment={marker.assessment}>
      {assessmentLabel(marker)}
    </span>
  );
}

export function membershipControlIn(
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
  if (slot.open !== interaction.selected)
    throw new Error('A Hub slot interaction must match its projected membership state.');
  if (interaction.selected && slot.canClose && interaction.close === undefined)
    throw new Error('A closable Hub slot must retain its CloseHubSlot interaction.');
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
  if (interactionIdentity.interaction !== interaction)
    setInteractionIdentity(Object.freeze({ interaction, version: interactionVersion }));
  const attemptRef = useRef<OpeningAttemptRecord | undefined>(undefined);
  const membershipInput = useRef<HubMembershipInput>('keyboard');
  const [attemptRecord, setAttemptRecord] = useState<OpeningAttemptRecord | undefined>(undefined);
  const beginAttempt = (): WorkspaceHubSlotOpeningAttempt => {
    if (interaction.selected)
      throw new Error('An open Hub slot cannot begin another opening attempt.');
    const existing = attemptRef.current;
    if (existing?.interaction === interaction && existing.interactionVersion === interactionVersion)
      return existing.attempt;
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
    )
      return;
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
          candidates.activate(beginAttempt());
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
            if (interaction.selected && interaction.close !== undefined)
              candidates.activate(interaction.close);
          }}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter' || event.key === 'Spacebar')
              membershipInput.current = 'keyboard';
            if (event.key === 'Escape' && !interaction.selected) cancelAttempt();
          }}
          type="checkbox"
        />
        <span className="hub-membership-control-label">Open</span>
      </label>
    </div>
  );
}

export function HubSlotMembershipControl({
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

export function ClosedHubRoomOption({
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
      className="hub-slot-card hub-open-room-card"
      data-hub-card-presentation="overview"
      data-hub-slot-key={slot.hubSlotKey}
      data-open="false"
    >
      <div className="hub-roster-primary">
        <div className="hub-roster-identity">
          <div className="hub-slot-heading">
            <div className="owner-markers">
              <h3>{slot.label}</h3>
              <SemanticOwnerMarker address={slot.marker.address} />
            </div>
          </div>
          <div className="hub-slot-meta">
            <div className="hub-slot-state">
              <span className="room-kind">{slot.roomKind}</span>
              <MarkerAssessment marker={slot.marker} />
            </div>
          </div>
        </div>
        <HubSlotMembershipControl
          interactions={interactions}
          onMembershipTransition={onMembershipTransition}
          slot={slot}
        />
      </div>
      <div className="hub-main-reward hub-overview-reward-slot">
        <p className="fixed-room-state">Open this room to edit its reward.</p>
      </div>
    </article>
  );
}

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
import { candidateSupport } from '@planner/projections/candidates/candidateProjection';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { RoomMapLauncher } from '@planner/ui/room-maps/RoomMapDialog';

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

export function useHubSlotMembership({
  interactions,
  onMembershipTransition,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onMembershipTransition: (transition: HubMembershipTransition) => void;
  readonly slot: WorkspaceHubSlot;
}) {
  const findingTarget = useFindingTarget();
  const interaction = requireWorkspaceInteraction(
    interactions.hubSlots,
    workspaceInteractionKey(slot.marker.address),
  );
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
  const target = findingTarget(slot.marker.address);
  const activate = (input: HubMembershipInput): void => {
    if (disabled || target.inert) return;
    const transition = Object.freeze({
      input,
      slotKey: slot.hubSlotKey,
      source: slot.open ? 'open' : 'closed',
    });
    if (!slot.open) {
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
  };
  const prepare = (): void => {
    if (disabled || target.inert) return;
    if (interaction.selected) {
      if (interaction.close !== undefined) candidates.activate(interaction.close);
      return;
    }
    candidates.activate(beginAttempt());
  };
  return {
    activate,
    cancelAttempt,
    candidateSupport: candidateSupport(candidate),
    disabled: disabled || target.inert,
    openingAttemptActive: activeAttempt !== undefined,
    pending: candidateState.pending,
    prepare,
    target,
  };
}

function HubSlotMembership({
  interactions,
  onMembershipTransition,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onMembershipTransition: (transition: HubMembershipTransition) => void;
  readonly slot: WorkspaceHubSlot;
}) {
  const [membershipInput, setMembershipInput] = useState<HubMembershipInput>('keyboard');
  const membership = useHubSlotMembership({ interactions, onMembershipTransition, slot });
  return (
    <div className="hub-membership-action">
      <label
        className="hub-membership-control"
        data-candidate-support={membership.candidateSupport}
        data-opening-attempt={membership.openingAttemptActive ? 'active' : undefined}
        onPointerDown={() => {
          setMembershipInput('pointer');
          membership.prepare();
        }}
      >
        <input
          {...membership.target}
          aria-busy={membership.pending || undefined}
          aria-label={`${slot.label} open`}
          checked={slot.open}
          disabled={membership.disabled}
          onBlur={() => {
            if (!slot.open) membership.cancelAttempt();
          }}
          onChange={() => {
            membership.activate(membershipInput);
            setMembershipInput('keyboard');
          }}
          onFocus={() => {
            if (slot.open) membership.prepare();
          }}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter' || event.key === 'Spacebar')
              setMembershipInput('keyboard');
            if (event.key === 'Escape' && !slot.open) membership.cancelAttempt();
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
  return (
    <HubSlotMembership
      interactions={interactions}
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
            <h3>{slot.label}</h3>
            <RoomMapLauncher
              gameName={slot.gameName}
              hostId={slot.marker.focusKey}
              label="Map"
              title={slot.label}
            />
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

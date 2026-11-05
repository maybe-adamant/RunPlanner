import { useRef, useState } from 'react';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceHubSlot,
  type WorkspaceHubSlotInteraction,
  type WorkspaceHubSlotOpeningAttempt,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { useAuthoringLocked } from '@planner/ui/feedback/useFindingTarget';
import { candidateMayBeAuthored, candidateWaits } from '@planner/ui/feedback/candidatePresentation';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

/**
 * One board door's bound open or close attempt. Opening lazily begins its
 * attempt, so rendering a door never allocates an occurrence.
 */
export function useHubSlotMembership({
  interactions,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly slot: WorkspaceHubSlot;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.hubSlots,
    workspaceInteractionKey(slot.marker.address),
  );
  if (slot.open !== interaction.selected)
    throw new Error('A Hub slot interaction must match its projected membership state.');
  if (interaction.selected && slot.canClose && interaction.close === undefined)
    throw new Error('A closable Hub slot must retain its CloseHubSlot interaction.');
  const executeIntent = useCommandIntent();
  const locked = useAuthoringLocked(slot.marker.address);
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
  const candidates =
    useWorkspaceInteractionController<ReturnType<WorkspaceHubSlotOpeningAttempt['load']>>();
  const activeAttempt =
    !interaction.selected &&
    attemptRecord?.interaction === interaction &&
    attemptRecord.interactionVersion === interactionVersion
      ? attemptRecord.attempt
      : undefined;
  const candidateState = candidates.observe(
    interaction.selected ? interaction.close : activeAttempt,
  );
  const candidate = candidateState.result?.find((option) => option.value === !slot.open);
  const structurallyDisabled = slot.open ? !slot.canClose : !slot.canOpen;
  const waiting = !interaction.contextReached || candidateWaits(candidate);
  const disabled =
    locked ||
    !interaction.contextReached ||
    structurallyDisabled ||
    (interaction.selected && interaction.close === undefined) ||
    (candidate !== undefined && !candidateMayBeAuthored(candidate));
  const activate = (): void => {
    if (disabled) return;
    if (!slot.open) {
      const attempt = beginAttempt();
      const options = candidateState.result ?? candidates.activate(attempt);
      if (candidateMayBeAuthored(options?.find((option) => option.value)))
        executeIntent(attempt.intentFor(true));
      return;
    }
    if (!interaction.selected || interaction.close === undefined) return;
    const options = candidateState.result ?? candidates.activate(interaction.close);
    if (candidateMayBeAuthored(options?.find((option) => !option.value)))
      executeIntent(interaction.close.intentFor(false));
  };
  const prepare = (): void => {
    if (disabled) return;
    if (interaction.selected) {
      if (interaction.close !== undefined) candidates.activate(interaction.close);
      return;
    }
    candidates.activate(beginAttempt());
  };
  return { activate, disabled, pending: candidateState.pending, prepare, waiting };
}

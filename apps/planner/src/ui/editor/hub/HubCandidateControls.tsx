import type {
  HubSlotAddress,
  HubVisitAddress,
  LocalChildAddress,
  LocalChildGroupAddress,
  SideRoomGeneration,
} from '@run-planner/engine/authored-project';
import { candidateSupport, presentCandidateLabel } from '../../../projections/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  workspaceSideRoomEntryOrderKey,
  type WorkspaceInteractionCatalog,
} from '../../../projections/structuredWorkspace';
import { useWorkspaceInteraction } from '../../controls/useWorkspaceInteraction';
import { candidateSelectState } from '../../feedback/candidatePresentation';

interface HubSlotMembershipProps {
  readonly disabled: boolean;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly open: boolean;
  readonly slotAddress: HubSlotAddress;
  readonly onChange: (open: boolean) => void;
}

export function HubSlotMembership({
  disabled,
  interactions,
  label,
  open,
  onChange,
  slotAddress,
}: HubSlotMembershipProps) {
  const interaction = requireWorkspaceInteraction(
    interactions.hubSlots,
    workspaceInteractionKey(slotAddress),
  );
  const projection = useWorkspaceInteraction(interaction);
  const selected = projection.result?.find((option) => option.value === open);
  return (
    <label className="hub-membership-control" data-candidate-support={candidateSupport(selected)}>
      <input
        aria-label={`${label} open`}
        checked={open}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        onFocus={projection.activate}
        onPointerDown={projection.activate}
        type="checkbox"
      />
      Open
    </label>
  );
}

export function HubVisitControl({
  disabled,
  interactions,
  onReplace,
  placeholder,
  visit,
}: {
  readonly disabled?: boolean;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onReplace: (hubSlotKey: string) => void;
  readonly placeholder?: string;
  readonly visit: HubVisitAddress;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.hubVisits,
    workspaceInteractionKey(visit),
  );
  const projection = useWorkspaceInteraction(interaction);
  const selected = projection.result?.find((option) => option.value === interaction.selected);
  return (
    <select
      {...candidateSelectState(selected)}
      aria-label={`Visit ${visit.visitIndex} room`}
      disabled={disabled}
      onChange={(event) => onReplace(event.target.value)}
      onFocus={projection.activate}
      onPointerDown={projection.activate}
      value={String(interaction.selected ?? '')}
    >
      {interaction.selected === undefined && (
        <option value="">{placeholder ?? 'Choose next room'}</option>
      )}
      {interaction.choices.map((choice) => {
        const option = projection.result?.find((candidate) => candidate.value === choice.value);
        return (
          <option key={choice.value} value={choice.value} {...candidateSelectState(option)}>
            {presentCandidateLabel(choice.label, option)}
          </option>
        );
      })}
    </select>
  );
}

export function SideGenerationControl({
  address,
  entered,
  generation,
  interactions,
  label,
  onReplace,
}: {
  readonly address: LocalChildAddress;
  readonly entered: boolean;
  readonly generation: SideRoomGeneration;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly onReplace: (generation: SideRoomGeneration) => void;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.sideRoomGenerations,
    workspaceInteractionKey(address),
  );
  const projection = useWorkspaceInteraction(interaction);
  const selected = projection.result?.find((option) => option.value === generation);
  return (
    <label className="field-control">
      <span>Generation</span>
      <select
        {...candidateSelectState(selected)}
        aria-label={`${label} generation`}
        onChange={(event) => onReplace(event.target.value as SideRoomGeneration)}
        onFocus={projection.activate}
        onPointerDown={projection.activate}
        value={generation}
      >
        {interaction.choices.map((choice) => {
          const option = projection.result?.find((candidate) => candidate.value === choice.value);
          return (
            <option
              disabled={entered && choice.value === 'notGenerated'}
              key={choice.value}
              value={choice.value}
              {...candidateSelectState(option)}
            >
              {presentCandidateLabel(choice.label, option)}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function SideEntryAction({
  ariaLabel,
  children,
  className,
  disabled,
  group,
  interactions,
  onApply,
  proposedOrder,
}: {
  readonly ariaLabel?: string;
  readonly children: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly group: LocalChildGroupAddress;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onApply: () => void;
  readonly proposedOrder: readonly string[];
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.sideRoomEntryOrders,
    workspaceSideRoomEntryOrderKey(group, proposedOrder),
  );
  const projection = useWorkspaceInteraction(interaction);
  const support = candidateSupport(projection.result?.[0]);
  return (
    <button
      aria-label={ariaLabel}
      className={className}
      data-candidate-support={support}
      disabled={disabled}
      onClick={onApply}
      onFocus={projection.activate}
      onPointerDown={projection.activate}
      type="button"
    >
      {children}
    </button>
  );
}

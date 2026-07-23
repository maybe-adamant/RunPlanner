import {
  type HubSlotAddress,
  type HubVisitAddress,
  type LocalChildAddress,
  type LocalChildGroupAddress,
  type OccurrenceId,
  type SideRoomGeneration,
} from '@run-planner/engine/authored-project';
import { useRef, useState } from 'react';
import { candidateSupport, presentCandidateLabel } from '../../../projections/candidateProjection';
import type { WorkspaceContextualResolver } from '../../../projections/structuredWorkspace';
import { candidateSelectState } from '../../feedback/candidatePresentation';

interface HubSlotMembershipProps {
  readonly candidateOccurrenceId: OccurrenceId;
  readonly contextual: WorkspaceContextualResolver;
  readonly disabled: boolean;
  readonly label: string;
  readonly open: boolean;
  readonly slotAddress: HubSlotAddress;
  readonly onChange: (open: boolean) => void;
}

export function HubSlotMembership({
  candidateOccurrenceId,
  contextual,
  disabled,
  label,
  open,
  onChange,
  slotAddress,
}: HubSlotMembershipProps) {
  type Projection = {
    readonly contextual: WorkspaceContextualResolver;
    readonly open: boolean;
    readonly support: ReturnType<typeof candidateSupport>;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const support =
    projection?.contextual === contextual && projection.open === open
      ? projection.support
      : 'unavailable';
  const activateProjection = () => {
    if (
      support !== 'unavailable' ||
      (projectionRef.current?.contextual === contextual && projectionRef.current.open === open)
    ) {
      return;
    }
    const selected = contextual
      .resolveHubSlots(slotAddress, candidateOccurrenceId, [false, true])
      .find((option) => option.value === open);
    const next = { contextual, open, support: candidateSupport(selected) };
    projectionRef.current = next;
    setProjection(next);
  };

  return (
    <label className="hub-membership-control" data-candidate-support={support}>
      <input
        aria-label={`${label} open`}
        checked={open}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        onFocus={activateProjection}
        onPointerDown={activateProjection}
        type="checkbox"
      />
      Open
    </label>
  );
}

export function HubVisitControl({
  contextual,
  current,
  hubSlotKeys,
  labels,
  onReplace,
  visit,
}: {
  readonly contextual: WorkspaceContextualResolver;
  readonly current: string;
  readonly hubSlotKeys: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly onReplace: (hubSlotKey: string) => void;
  readonly visit: HubVisitAddress;
}) {
  type Projection = {
    readonly contextual: WorkspaceContextualResolver;
    readonly options: ReturnType<WorkspaceContextualResolver['resolveHubVisits']>;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const projected = projection?.contextual === contextual ? projection.options : undefined;
  const activateProjection = () => {
    if (projected !== undefined || projectionRef.current?.contextual === contextual) {
      return;
    }
    const next = {
      contextual,
      options: contextual.resolveHubVisits(visit, hubSlotKeys),
    };
    projectionRef.current = next;
    setProjection(next);
  };
  const selected = projected?.find((option) => option.value === current);

  return (
    <select
      {...candidateSelectState(selected)}
      aria-label={`Visit ${visit.visitIndex} room`}
      onChange={(event) => onReplace(event.target.value)}
      onFocus={activateProjection}
      onPointerDown={activateProjection}
      value={current}
    >
      {hubSlotKeys.map((hubSlotKey) => {
        const option = projected?.find((candidate) => candidate.value === hubSlotKey);
        return (
          <option key={hubSlotKey} value={hubSlotKey} {...candidateSelectState(option)}>
            {presentCandidateLabel(labels[hubSlotKey] ?? hubSlotKey, option)}
          </option>
        );
      })}
    </select>
  );
}

export function SideGenerationControl({
  address,
  contextual,
  entered,
  generation,
  label,
  onReplace,
}: {
  readonly address: LocalChildAddress;
  readonly contextual: WorkspaceContextualResolver;
  readonly entered: boolean;
  readonly generation: SideRoomGeneration;
  readonly label: string;
  readonly onReplace: (generation: SideRoomGeneration) => void;
}) {
  type Projection = {
    readonly contextual: WorkspaceContextualResolver;
    readonly options: ReturnType<WorkspaceContextualResolver['resolveSideRoomGenerations']>;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const projected = projection?.contextual === contextual ? projection.options : undefined;
  const activateProjection = () => {
    if (projected !== undefined || projectionRef.current?.contextual === contextual) {
      return;
    }
    const next = {
      contextual,
      options: contextual.resolveSideRoomGenerations(address, ['generated', 'notGenerated']),
    };
    projectionRef.current = next;
    setProjection(next);
  };
  const selected = projected?.find((option) => option.value === generation);

  return (
    <label className="field-control">
      <span>Generation</span>
      <select
        {...candidateSelectState(selected)}
        aria-label={`${label} generation`}
        onChange={(event) => onReplace(event.target.value as SideRoomGeneration)}
        onFocus={activateProjection}
        onPointerDown={activateProjection}
        value={generation}
      >
        {(['generated', 'notGenerated'] as const).map((value) => {
          const option = projected?.find((candidate) => candidate.value === value);
          return (
            <option
              disabled={entered && value === 'notGenerated'}
              key={value}
              value={value}
              {...candidateSelectState(option)}
            >
              {presentCandidateLabel(value === 'generated' ? 'Generated' : 'Not generated', option)}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function SideEntryAction({
  ariaLabel,
  contextual,
  children,
  className,
  disabled,
  group,
  onApply,
  proposedOrder,
}: {
  readonly ariaLabel?: string;
  readonly contextual: WorkspaceContextualResolver;
  readonly children: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly group: LocalChildGroupAddress;
  readonly onApply: () => void;
  readonly proposedOrder: readonly string[];
}) {
  type Projection = {
    readonly contextual: WorkspaceContextualResolver;
    readonly support: ReturnType<typeof candidateSupport>;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const support = projection?.contextual === contextual ? projection.support : 'unavailable';
  const activateProjection = () => {
    if (support !== 'unavailable' || projectionRef.current?.contextual === contextual) {
      return;
    }
    const candidate = contextual.resolveSideRoomEntryOrders(group, [proposedOrder])[0];
    const next = { contextual, support: candidateSupport(candidate) };
    projectionRef.current = next;
    setProjection(next);
  };

  return (
    <button
      aria-label={ariaLabel}
      className={className}
      data-candidate-support={support}
      disabled={disabled}
      onClick={onApply}
      onFocus={activateProjection}
      onPointerDown={activateProjection}
      type="button"
    >
      {children}
    </button>
  );
}

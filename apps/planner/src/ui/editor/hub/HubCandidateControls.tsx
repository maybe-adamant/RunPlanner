import {
  type HubSlotAddress,
  type HubVisitAddress,
  type LocalChildAddress,
  type LocalChildGroupAddress,
  type OccurrenceId,
  type ProjectDocument,
  type SideRoomGeneration,
} from '@run-planner/engine/authored-project';
import { useRef, useState } from 'react';
import {
  candidateSupport,
  presentCandidateLabel,
  type CandidateProjectionService,
} from '../../../projections/candidateProjection';
import { candidateSelectState } from '../../feedback/candidatePresentation';

interface HubSlotMembershipProps {
  readonly candidateOccurrenceId: OccurrenceId;
  readonly candidateProjection: CandidateProjectionService;
  readonly disabled: boolean;
  readonly label: string;
  readonly open: boolean;
  readonly project: ProjectDocument;
  readonly slotAddress: HubSlotAddress;
  readonly onChange: (open: boolean) => void;
}

export function HubSlotMembership({
  candidateOccurrenceId,
  candidateProjection,
  disabled,
  label,
  open,
  onChange,
  project,
  slotAddress,
}: HubSlotMembershipProps) {
  type Projection = {
    readonly open: boolean;
    readonly project: ProjectDocument;
    readonly support: ReturnType<typeof candidateSupport>;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const support =
    projection?.project === project && projection.open === open
      ? projection.support
      : 'unavailable';
  const activateProjection = () => {
    if (
      support !== 'unavailable' ||
      (projectionRef.current?.project === project && projectionRef.current.open === open)
    ) {
      return;
    }
    const selected = candidateProjection
      .hubSlots(project, slotAddress, candidateOccurrenceId, [false, true])
      .find((option) => option.value === open);
    const next = { open, project, support: candidateSupport(selected) };
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
  candidateProjection,
  current,
  hubSlotKeys,
  labels,
  onReplace,
  project,
  visit,
}: {
  readonly candidateProjection: CandidateProjectionService;
  readonly current: string;
  readonly hubSlotKeys: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly onReplace: (hubSlotKey: string) => void;
  readonly project: ProjectDocument;
  readonly visit: HubVisitAddress;
}) {
  type Projection = {
    readonly options: ReturnType<CandidateProjectionService['hubVisits']>;
    readonly project: ProjectDocument;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const projected = projection?.project === project ? projection.options : undefined;
  const activateProjection = () => {
    if (projected !== undefined || projectionRef.current?.project === project) {
      return;
    }
    const next = {
      options: candidateProjection.hubVisits(project, visit, hubSlotKeys),
      project,
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
  candidateProjection,
  entered,
  generation,
  label,
  onReplace,
  project,
}: {
  readonly address: LocalChildAddress;
  readonly candidateProjection: CandidateProjectionService;
  readonly entered: boolean;
  readonly generation: SideRoomGeneration;
  readonly label: string;
  readonly onReplace: (generation: SideRoomGeneration) => void;
  readonly project: ProjectDocument;
}) {
  type Projection = {
    readonly options: ReturnType<CandidateProjectionService['sideRoomGenerations']>;
    readonly project: ProjectDocument;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const projected = projection?.project === project ? projection.options : undefined;
  const activateProjection = () => {
    if (projected !== undefined || projectionRef.current?.project === project) {
      return;
    }
    const next = {
      options: candidateProjection.sideRoomGenerations(project, address, [
        'generated',
        'notGenerated',
      ]),
      project,
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
  candidateProjection,
  children,
  className,
  disabled,
  group,
  onApply,
  project,
  proposedOrder,
}: {
  readonly ariaLabel?: string;
  readonly candidateProjection: CandidateProjectionService;
  readonly children: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly group: LocalChildGroupAddress;
  readonly onApply: () => void;
  readonly project: ProjectDocument;
  readonly proposedOrder: readonly string[];
}) {
  type Projection = {
    readonly project: ProjectDocument;
    readonly support: ReturnType<typeof candidateSupport>;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const support = projection?.project === project ? projection.support : 'unavailable';
  const activateProjection = () => {
    if (support !== 'unavailable' || projectionRef.current?.project === project) {
      return;
    }
    const candidate = candidateProjection.sideRoomEntryOrders(project, group, [proposedOrder])[0];
    const next = { project, support: candidateSupport(candidate) };
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

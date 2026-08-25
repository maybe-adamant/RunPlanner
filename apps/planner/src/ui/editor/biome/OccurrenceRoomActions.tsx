import { semanticAddressKey, type OccurrenceAddress } from '@run-planner/engine/authored-project';
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  requireWorkspaceInteraction,
  dropRankedPrefixItem,
  reconcileRankedPrefix,
  workspaceInteractionKey,
  type RankedPrefixDropTarget,
  type WorkspaceEncounterPhase,
  type WorkspaceFieldsCageSlotControl,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActions,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomLifecycleTimelineEntry,
  type WorkspaceRewardWheelDescriptor,
  type WorkspaceShipPhasePresentation,
  type WorkspaceSteadyGrowthControl,
  type WorkspaceSteadyGrowthDomain,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { PomResolutionLauncher, RandomTraitTargetPicker } from '../rewards/PomResolutionEditor';
import { TraitOfferLauncher } from '../rewards/TraitOfferEditor';
import { CandidateSelect } from './CandidateSelect';
interface PendingRoomActionPointerDrag {
  readonly actionKey: string;
  readonly handle: HTMLElement;
  readonly originX: number;
  readonly originY: number;
  readonly pointerId: number;
}

interface RoomActionPointerDrag {
  readonly actionKey: string;
  readonly pointerId: number;
  readonly target: RoomActionDropTarget | undefined;
  readonly x: number;
  readonly y: number;
}

type RoomActionDropTarget =
  RankedPrefixDropTarget | { readonly kind: 'position'; readonly toIndex: number };

function sameRoomActionDropTarget(
  left: RoomActionDropTarget | undefined,
  right: RoomActionDropTarget | undefined,
): boolean {
  if (left === right) return true;
  if (left === undefined || right === undefined || left.kind !== right.kind) return false;
  if (left.kind === 'position' || right.kind === 'position') {
    return left.kind === 'position' && right.kind === 'position' && left.toIndex === right.toIndex;
  }
  if (left.kind === 'nextVisit' || right.kind === 'nextVisit') return true;
  return left.slotKey === right.slotKey;
}

function roomActionDropTargetFromPoint(
  root: HTMLElement | null,
  x: number,
  y: number,
): RoomActionDropTarget | undefined {
  const hit = document.elementFromPoint?.(x, y);
  const boundary = hit?.closest<HTMLElement>('[data-room-action-drop-index]');
  if (boundary !== null && boundary !== undefined && root?.contains(boundary) === true) {
    const toIndex = Number(boundary.dataset.roomActionDropIndex);
    if (Number.isInteger(toIndex) && toIndex >= 0) {
      return Object.freeze({ kind: 'position' as const, toIndex });
    }
  }
  const row = hit?.closest<HTMLElement>('[data-room-action-key][data-in-order="true"]');
  if (row === null || row === undefined || root?.contains(row) !== true) return undefined;
  const actionKey = row.dataset.roomActionKey;
  if (actionKey === undefined) return undefined;
  const bounds = row.getBoundingClientRect();
  return Object.freeze({
    kind: y < bounds.top + bounds.height / 2 ? ('beforeSlot' as const) : ('afterSlot' as const),
    slotKey: actionKey,
  });
}

function lifecycleBoundaryLabel(boundary: WorkspaceRoomLifecycleBoundary): string {
  switch (boundary.kind) {
    case 'roomEntered':
      return 'Room entered';
    case 'encounterStart':
      return 'Start encounter';
    case 'encounterEnd':
      return 'End encounter';
    case 'bossDefeated':
      return 'Boss defeated';
    case 'nextPhase':
      return 'Start next phase';
    case 'cleanup':
      return 'Cleanup · Doors open';
  }
}

function lifecycleBoundaryCheckpointKey(boundary: WorkspaceRoomLifecycleBoundary): string {
  switch (boundary.kind) {
    case 'encounterEnd':
      return `combat:${boundary.phaseKey}`;
    case 'nextPhase':
      return `nextPhaseUsable:${boundary.wheelKey}`;
    default:
      return boundary.key;
  }
}

function LifecycleBoundaryRow({
  boundary,
  dropIndex,
  dropState,
  fieldsCageSlot,
  onSelectFieldsCage,
}: {
  readonly boundary: WorkspaceRoomLifecycleBoundary;
  readonly dropIndex: number;
  readonly dropState?: 'available' | 'unavailable';
  readonly fieldsCageSlot?: WorkspaceFieldsCageSlotControl;
  readonly onSelectFieldsCage?: (proposalKey: string) => void;
}) {
  const label =
    fieldsCageSlot === undefined
      ? lifecycleBoundaryLabel(boundary)
      : `Start encounter ${fieldsCageSlot.slotOrdinal}`;
  return (
    <li
      aria-label={label}
      className="room-action-lifecycle-boundary"
      data-drop-position={dropState}
      data-fields-cage-slot={fieldsCageSlot === undefined ? undefined : 'true'}
      data-lifecycle-boundary={boundary.key}
      data-room-action-drop-index={dropIndex}
      {...(fieldsCageSlot === undefined
        ? {}
        : { id: semanticOwnerControlElementId(fieldsCageSlot.owner), tabIndex: -1 })}
    >
      <span aria-hidden="true" className="hub-roster-rank">
        ·
      </span>
      <strong>{label}</strong>
      {fieldsCageSlot === undefined ? null : (
        <label className="fields-cage-slot-control">
          <span className="visually-hidden">Cage for encounter {fieldsCageSlot.slotOrdinal}</span>
          <select
            aria-label={`Cage for encounter ${fieldsCageSlot.slotOrdinal}`}
            onChange={(event) => {
              const choice = fieldsCageSlot.choices.find(
                (candidate) => candidate.value === event.target.value,
              );
              if (choice?.proposalKey !== undefined) onSelectFieldsCage?.(choice.proposalKey);
            }}
            value={fieldsCageSlot.selected}
          >
            {fieldsCageSlot.choices.map((choice) => (
              <option
                disabled={choice.proposalKey === undefined}
                key={choice.value}
                value={choice.value}
              >
                {choice.label}
              </option>
            ))}
          </select>
          <SemanticOwnerMarker address={fieldsCageSlot.marker.address} />
        </label>
      )}
    </li>
  );
}

export function SteadyGrowthEffectRow({
  control,
  interactions,
}: {
  readonly control: WorkspaceSteadyGrowthControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const focusedSemanticOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const semanticNavigationRevision = useAppSelector(
    (state) => state.editorSession.semanticNavigationRevision,
  );
  const [manualOpen, setManualOpen] = useState(false);
  const [closedAtNavigationRevision, setClosedAtNavigationRevision] = useState<number>();
  const interaction = requireWorkspaceInteraction(
    interactions.steadyGrowth,
    workspaceInteractionKey(control.address),
  );
  const loadable = useMemo(
    () => interaction.forTarget(control.targetTraitKey),
    [control.targetTraitKey, interaction],
  );
  const controller = useWorkspaceInteractionController<WorkspaceSteadyGrowthDomain | undefined>();
  const loaded = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  const domain = loaded.result;
  const selected = control.targetTraitKey ?? '';
  const focused =
    focusedSemanticOwner?.kind === 'steadyGrowthOutcome' &&
    semanticAddressKey(focusedSemanticOwner) === semanticAddressKey(control.address);
  const open = manualOpen || (focused && closedAtNavigationRevision !== semanticNavigationRevision);
  const onOpenChange = (nextOpen: boolean): void => {
    setManualOpen(nextOpen);
    if (!nextOpen && focused) setClosedAtNavigationRevision(semanticNavigationRevision);
  };
  return (
    <li
      aria-label="Steady Growth"
      className="room-action-row room-timeline-effect-row"
      data-steady-growth={control.address.phaseKey}
    >
      <div className="owner-markers room-action-identity">
        <span aria-hidden="true" className="hub-roster-rank">
          ·
        </span>
        <strong>Steady Growth</strong>
        {domain?.emptyNoOp === true && control.targetTraitKey === undefined ? (
          <span>No eligible trait (no-op)</span>
        ) : (
          <RandomTraitTargetPicker
            ariaLabel="Steady Growth target"
            id={semanticOwnerControlElementId(control.address)}
            interaction={interaction}
            model={domain?.picker ?? { sections: Object.freeze([]) }}
            onSelect={(target) => executeIntent(interaction.intentFor(target))}
            onOpenChange={onOpenChange}
            open={open}
            selected={selected === '' ? null : selected}
          />
        )}
        {domain?.selectedPossible === false && selected !== '' ? (
          <>
            <span className="finding-badge">Needs repair</span>
            <button
              className="quiet-action"
              onClick={() => executeIntent(interaction.intentFor(null))}
              type="button"
            >
              Clear recorded target
            </button>
          </>
        ) : null}
        <SemanticOwnerMarker address={control.address} />
      </div>
    </li>
  );
}

export function RoomActionsWorkbench({
  actions,
  children,
  encounterPhases,
  idPrefix,
  interactions,
  renderEncounterPhase,
  renderRewardWheel,
  renderRowContent,
  renderBoundaryContent,
  ship,
}: {
  readonly actions?: WorkspaceRoomActions;
  readonly children?: ReactNode;
  readonly encounterPhases?: readonly WorkspaceEncounterPhase[];
  readonly idPrefix?: string;
  readonly interactions: WorkspaceInteractionCatalog;
  /** Encounter/reward owner supplies these leaves without a reverse import. */
  readonly renderEncounterPhase?: (phase: WorkspaceEncounterPhase) => ReactNode;
  readonly renderRewardWheel?: (wheel: WorkspaceRewardWheelDescriptor) => ReactNode;
  /** Consumer-owned leaf editor for one exact shared timeline row. */
  readonly renderRowContent?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  readonly renderBoundaryContent?: (boundary: WorkspaceRoomLifecycleBoundary) => ReactNode;
  readonly ship?: {
    readonly occurrence: OccurrenceAddress;
    readonly phases: readonly WorkspaceShipPhasePresentation[];
    readonly repairRows: readonly WorkspaceRoomActions['rows'][number][];
    readonly phaseKey?: string;
  };
}) {
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const board = useRef<HTMLOListElement | HTMLDivElement>(null);
  const pendingPointerDrag = useRef<PendingRoomActionPointerDrag | undefined>(undefined);
  const activePointerDrag = useRef<RoomActionPointerDrag | undefined>(undefined);
  const [pointerDrag, setPointerDrag] = useState<RoomActionPointerDrag | undefined>(undefined);
  const [announcement, setAnnouncement] = useState('');
  if (actions === undefined && ship === undefined) {
    if (encounterPhases === undefined || idPrefix === undefined) return null;
    return (
      <section aria-label="Room Timeline" className="room-actions-workbench">
        {encounterPhases.map((phase) => (
          <Fragment key={workspaceInteractionKey(phase.address)}>
            {renderEncounterPhase?.(phase)}
          </Fragment>
        ))}
      </section>
    );
  }
  const interaction =
    actions === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.roomActions, actions.interactionKey);
  const rankedKeys =
    actions?.timeline.entries.flatMap((entry) =>
      entry.kind === 'action' ? [entry.actionKey] : [],
    ) ?? [];
  const rankedRows = actions?.rows.filter((row) => rankedKeys.includes(row.key)) ?? [];
  const ranking = reconcileRankedPrefix({
    authoredVisitOrder: rankedKeys,
    declarationOpenSlotKeys: rankedKeys,
  });
  const proposalForMove = (actionKey: string, toIndex: number) => {
    const row = actions?.rows.find((candidate) => candidate.key === actionKey);
    return actions?.proposals.find(
      (proposal) =>
        proposal.kind === 'move' &&
        row?.proposalKeys.includes(proposal.key) === true &&
        proposal.toIndex === toIndex,
    );
  };
  const apply = (proposalKey: string): void => {
    const proposal = interaction?.proposals.find((candidate) => candidate.key === proposalKey);
    if (interaction === undefined || proposal?.structurallyAuthorable !== true) return;
    executeIntent(interaction.intentFor(proposalKey));
  };
  const applyFieldsCageSelection = (proposalKey: string): void => {
    const proposal = interaction?.proposals.find((candidate) => candidate.key === proposalKey);
    if (interaction === undefined || proposal?.kind !== 'move') return;
    executeIntent(interaction.intentFor(proposalKey));
  };
  const proposalForDrop = (
    actionKey: string,
    target: RoomActionDropTarget,
  ): WorkspaceRoomActions['proposals'][number] | undefined => {
    if (target.kind === 'position') return proposalForMove(actionKey, target.toIndex);
    const result = dropRankedPrefixItem(ranking, rankedRows.length, actionKey, target);
    const toIndex = result?.proposedVisitOrder?.indexOf(actionKey);
    return toIndex === undefined || toIndex < 0 ? undefined : proposalForMove(actionKey, toIndex);
  };
  const beginPointerDrag = (event: ReactPointerEvent<HTMLSpanElement>, actionKey: string): void => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pendingPointerDrag.current = Object.freeze({
      actionKey,
      handle: event.currentTarget,
      originX: event.clientX,
      originY: event.clientY,
      pointerId: event.pointerId,
    });
  };
  const clearPointerDrag = (pointerId?: number): void => {
    const pending = pendingPointerDrag.current;
    const active = activePointerDrag.current;
    if (pointerId !== undefined && (active?.pointerId ?? pending?.pointerId) !== pointerId) return;
    if (pending?.handle.hasPointerCapture?.(pending.pointerId)) {
      pending.handle.releasePointerCapture(pending.pointerId);
    }
    pendingPointerDrag.current = undefined;
    activePointerDrag.current = undefined;
    setPointerDrag(undefined);
  };
  const updatePointerDrag = (event: ReactPointerEvent<HTMLElement>): void => {
    const pending = pendingPointerDrag.current;
    if (pending === undefined || pending.pointerId !== event.pointerId) return;
    if (
      activePointerDrag.current === undefined &&
      Math.hypot(event.clientX - pending.originX, event.clientY - pending.originY) < 6
    ) {
      return;
    }
    const next = Object.freeze({
      actionKey: pending.actionKey,
      pointerId: pending.pointerId,
      target: roomActionDropTargetFromPoint(board.current, event.clientX, event.clientY),
      x: event.clientX,
      y: event.clientY,
    });
    activePointerDrag.current = next;
    setPointerDrag(next);
  };
  const completePointerDrag = (event: ReactPointerEvent<HTMLElement>): void => {
    const active = activePointerDrag.current;
    if (active === undefined || active.pointerId !== event.pointerId) {
      clearPointerDrag(event.pointerId);
      return;
    }
    const target = roomActionDropTargetFromPoint(board.current, event.clientX, event.clientY);
    clearPointerDrag(event.pointerId);
    if (target === undefined) return;
    const proposal = proposalForDrop(active.actionKey, target);
    if (proposal?.structurallyAuthorable !== true) return;
    const row = actions?.rows.find((candidate) => candidate.key === active.actionKey);
    setAnnouncement(
      `${row?.label ?? active.actionKey} moved to position ${(proposal.toIndex ?? 0) + 1}.`,
    );
    apply(proposal.key);
  };
  const checkpointRows = (
    afterRank: number,
    checkpoints: WorkspaceRoomActions['checkpoints'] = actions?.checkpoints ?? [],
  ) =>
    checkpoints
      .filter((checkpoint) => checkpoint.key !== 'exitUsable')
      .filter(
        (checkpoint) =>
          actions?.timeline.boundaries.some(
            (boundary) => lifecycleBoundaryCheckpointKey(boundary) === checkpoint.key,
          ) !== true,
      )
      .filter((checkpoint) => checkpoint.afterRank === afterRank)
      .map((checkpoint) => (
        <li className="room-action-checkpoint" key={`checkpoint:${checkpoint.key}`}>
          <span aria-hidden="true" className="hub-roster-rank">
            ·
          </span>
          <strong>{checkpoint.label}</strong>
        </li>
      ));
  const encounterByPhase = new Map(
    (encounterPhases ?? []).map((phase) => [phase.address.phaseKey, phase]),
  );
  const boundarySupplement = (boundary: WorkspaceRoomLifecycleBoundary): ReactNode => {
    if (boundary.kind === 'roomEntered') {
      const phase = encounterPhases?.find(
        (candidate) => candidate.timelineAnchor === 'roomEntered',
      );
      return phase === undefined || idPrefix === undefined
        ? null
        : (renderEncounterPhase?.(phase) ?? null);
    }
    if (boundary.kind === 'encounterStart') {
      const phase = encounterByPhase.get(boundary.phaseKey);
      return phase?.timelineAnchor !== 'encounterStart' || idPrefix === undefined
        ? null
        : (renderEncounterPhase?.(phase) ?? null);
    }
    if (boundary.kind === 'nextPhase' && ship !== undefined) {
      const phase = ship.phases.find((candidate) => candidate.wheel?.key === boundary.wheelKey);
      return phase?.wheel === undefined ? null : (renderRewardWheel?.(phase.wheel) ?? null);
    }
    return null;
  };
  const encounterActionSupplement = (row: WorkspaceRoomActions['rows'][number]): ReactNode => {
    if (row.reference.kind !== 'interactEncounter' || idPrefix === undefined) return null;
    const phase = encounterByPhase.get(row.reference.phaseKey);
    return phase?.timelineAnchor !== 'action' ? null : (renderEncounterPhase?.(phase) ?? null);
  };
  const dropState = (target: RoomActionDropTarget) => {
    if (!sameRoomActionDropTarget(pointerDrag?.target, target)) return undefined;
    return proposalForDrop(pointerDrag!.actionKey, target)?.structurallyAuthorable === true
      ? 'available'
      : 'unavailable';
  };
  const renderBoundary = (
    entry: Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'boundary' }>,
  ) => {
    const target = Object.freeze({
      kind: 'position' as const,
      toIndex: Math.max(0, entry.rank - (entry.placement === 'before' ? 1 : 0)),
    });
    const targetState = dropState(target);
    return (
      <Fragment key={entry.boundary.key}>
        <LifecycleBoundaryRow
          boundary={entry.boundary}
          dropIndex={target.toIndex}
          {...(entry.fieldsCageSlot === undefined
            ? {}
            : {
                fieldsCageSlot: entry.fieldsCageSlot,
                onSelectFieldsCage: applyFieldsCageSelection,
              })}
          {...(targetState === undefined ? {} : { dropState: targetState })}
        />
        {boundarySupplement(entry.boundary)}
        {renderBoundaryContent?.(entry.boundary)}
      </Fragment>
    );
  };
  const renderRow = (
    row: WorkspaceRoomActions['rows'][number],
    checkpoints: WorkspaceRoomActions['checkpoints'] = actions?.checkpoints ?? [],
  ) => {
    if (actions === undefined) return null;
    const proposals = row.proposalKeys.flatMap((key) => {
      const proposal = actions.proposals.find((candidate) => candidate.key === key);
      return proposal === undefined ? [] : [proposal];
    });
    const removable = proposals.find((proposal) => proposal.kind === 'remove');
    const moveEarlier = proposals.find(
      (proposal) =>
        proposal.kind === 'move' && row.rank !== null && proposal.toIndex === row.rank - 2,
    );
    const moveLater = proposals.find(
      (proposal) => proposal.kind === 'move' && row.rank !== null && proposal.toIndex === row.rank,
    );
    const insertions = proposals.filter((proposal) => proposal.kind === 'insert');
    const rewardPayload = row.rewardPayload;
    const artificerOutput = row.artificerOutput;
    const traitControl = row.traitOffer;
    const inlineTraitControls = [
      ...(traitControl === undefined ? [] : [traitControl]),
      ...(rewardPayload?.inlineTraitOffers ?? []),
    ];
    const inlineLevelResolutions = rewardPayload?.inlineLevelResolutions ?? [];
    const rewardPayloadHasVisibleBody =
      rewardPayload !== undefined &&
      (rewardPayload.showOffer ||
        rewardPayload.control.acquisitionOutcome === 'forfeitedByVow' ||
        (rewardPayload.showOwner && rewardPayload.control.marker.findingCount > 0) ||
        (rewardPayload.control.conversions ?? []).some(
          (conversion) =>
            requireWorkspaceInteraction(
              interactions.acquisitionConversions,
              workspaceInteractionKey(conversion.address),
            ).visible,
        ) ||
        artificerOutput !== undefined);
    const wheel = row.wheelPick;
    const canDrag =
      row.rank !== null &&
      rankedRows.length > 1 &&
      proposals.some((proposal) => proposal.kind === 'move');
    const staleShopRemoval = row.stale ? row.shopParticipation : undefined;
    const removalEnabled =
      removable?.structurallyAuthorable === true || staleShopRemoval !== undefined;
    const removalExplanation = removalEnabled
      ? `Remove ${row.label} from the timeline`
      : row.rank === null
        ? 'This action is not currently in the timeline.'
        : row.shopParticipation !== undefined
          ? 'Purchased membership is edited in Room Overview.'
          : row.participation === 'required'
            ? 'Required actions cannot be removed.'
            : 'This action cannot be removed from its current state.';
    const removeRow = (): void => {
      if (removable?.structurallyAuthorable === true) {
        apply(removable.key);
        return;
      }
      if (staleShopRemoval !== undefined) {
        executeIntent(
          requireWorkspaceInteraction(
            interactions.shopPurchaseParticipations,
            staleShopRemoval.interactionKey,
          ).intentFor(false),
        );
      }
    };
    return (
      <Fragment key={row.key}>
        <li
          className="hub-open-room-card room-action-row"
          data-dragging={pointerDrag?.actionKey === row.key || undefined}
          data-drop-after={
            row.rank === null ? undefined : dropState({ kind: 'afterSlot', slotKey: row.key })
          }
          data-drop-before={
            row.rank === null ? undefined : dropState({ kind: 'beforeSlot', slotKey: row.key })
          }
          data-in-order={row.rank === null ? 'false' : 'true'}
          data-room-action-key={row.key}
          id={semanticOwnerControlElementId(row.address)}
          tabIndex={-1}
        >
          <div className="owner-markers room-action-identity">
            {canDrag ? (
              <span
                aria-hidden="true"
                className="hub-roster-drag-handle"
                data-dragging={pointerDrag?.actionKey === row.key || undefined}
                data-room-action-drag-handle
                onPointerDown={(event) => beginPointerDrag(event, row.key)}
              >
                ⠿
              </span>
            ) : null}
            <span aria-hidden="true" className="hub-roster-rank">
              {row.rank ?? '—'}
            </span>
            <strong>{row.label}</strong>
            <SemanticOwnerMarker address={row.address} />
            {row.stale ? <span className="neutral-status">stale</span> : null}
            {row.rank === null && row.participation === 'required' ? (
              <span className="neutral-status">required</span>
            ) : null}
          </div>
          <div className="hub-rank-actions room-action-controls">
            <div className="room-action-inline-editors">
              {renderRowContent?.(row)}
              {inlineTraitControls.map((control) => (
                <TraitOfferLauncher
                  control={control}
                  interactions={interactions}
                  key={workspaceInteractionKey(control.address)}
                />
              ))}
              {inlineLevelResolutions.map((control) => (
                <PomResolutionLauncher
                  control={control}
                  interactions={interactions}
                  key={workspaceInteractionKey(control.address)}
                />
              ))}
            </div>
            {row.rank === null && row.participation === 'required' ? (
              <button
                disabled={insertions.length !== 1 || insertions[0]?.structurallyAuthorable !== true}
                onClick={() => {
                  const restore = insertions[0];
                  if (restore !== undefined) apply(restore.key);
                }}
                type="button"
              >
                Restore required action
              </button>
            ) : row.rank === null ? (
              <label className="field-control field-control-inline room-action-position-control">
                <span>Position</span>
                <select
                  aria-label={`Insert ${row.label}`}
                  onChange={(event) => {
                    apply(event.target.value);
                    event.target.value = '';
                  }}
                  value=""
                >
                  <option disabled value="">
                    Choose
                  </option>
                  {insertions.map((proposal) => (
                    <option
                      disabled={!proposal.structurallyAuthorable}
                      key={proposal.key}
                      value={proposal.key}
                    >
                      {proposal.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                {[
                  { direction: 'earlier' as const, glyph: '↑', proposal: moveEarlier },
                  { direction: 'later' as const, glyph: '↓', proposal: moveLater },
                ].map(({ direction, glyph, proposal }) => (
                  <button
                    aria-label={`Move ${row.label} ${direction}`}
                    className="quiet-action hub-rank-action"
                    disabled={proposal?.structurallyAuthorable !== true}
                    key={direction}
                    onClick={() => {
                      if (proposal !== undefined) apply(proposal.key);
                    }}
                    type="button"
                  >
                    <span aria-hidden="true">{glyph}</span>
                  </button>
                ))}
              </>
            )}
            <button
              aria-label={`Remove ${row.label} from timeline`}
              className={`${removalEnabled ? 'danger-action' : 'quiet-action'} room-action-delete`}
              disabled={!removalEnabled}
              onClick={removeRow}
              title={removalExplanation}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path d="M3.5 4.5h9M6 2.5h4l.5 2h-5l.5-2Zm-1 2 .5 9h5l.5-9M7 7v4M9 7v4" />
              </svg>
            </button>
          </div>
          {row.issues.length === 0 ? null : (
            <ul className="room-action-issues">
              {row.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          {wheel === undefined ? null : (
            <CandidateSelect
              id={`room-action-${row.key}-picked`}
              interaction={requireWorkspaceInteraction(
                interactions.rewardWheelPicks,
                workspaceInteractionKey(wheel),
              )}
              label="Picked offer"
              onReplace={(pickedOfferIndex) =>
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'ReplaceRewardWheelPicked',
                    wheel,
                    pickedOfferIndex,
                  }),
                )
              }
            />
          )}
          {rewardPayload === undefined ? null : (
            <div
              className="acquisition-entry-resolution"
              data-empty={!rewardPayloadHasVisibleBody || undefined}
              {...(rewardPayload.showOwner
                ? {
                    id: semanticOwnerControlElementId(rewardPayload.control.owner.address),
                    tabIndex: -1,
                  }
                : {})}
            >
              {rewardPayload.showOwner ? (
                <SemanticOwnerMarker address={rewardPayload.control.marker.address} />
              ) : null}
              <div className="room-action-outcome-controls">
                <RewardControlEditor
                  control={rewardPayload.control}
                  idPrefix={`room-action-${rewardPayload.control.marker.focusKey}`}
                  interactions={interactions}
                  showAcquisitionChildren
                  showLevelResolutions={false}
                  showOffer={rewardPayload.showOffer}
                  showTraitOffers={false}
                />
                {artificerOutput === undefined ? null : (
                  <div
                    className="room-action-artificer-output"
                    id={semanticOwnerControlElementId(artificerOutput.control.owner.address)}
                    tabIndex={-1}
                  >
                    <SemanticOwnerMarker address={artificerOutput.control.marker.address} />
                    <RewardControlEditor
                      control={artificerOutput.control}
                      idPrefix={`room-action-artificer-${artificerOutput.control.marker.focusKey}`}
                      interactions={interactions}
                      label={artificerOutput.label}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          {encounterActionSupplement(row)}
        </li>
        {row.rank === null ? null : checkpointRows(row.rank, checkpoints)}
      </Fragment>
    );
  };
  const pointerHandlers = {
    onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) =>
      clearPointerDrag(event.pointerId),
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => clearPointerDrag(event.pointerId),
    onPointerMove: updatePointerDrag,
    onPointerUp: completePointerDrag,
  };
  const dragPreview =
    pointerDrag === undefined ? null : (
      <div
        aria-hidden="true"
        className="hub-roster-drag-preview"
        style={{
          transform: `translate3d(${pointerDrag.x + 14}px, ${pointerDrag.y + 14}px, 0)`,
        }}
      >
        <span>⠿</span>
        {actions?.rows.find((row) => row.key === pointerDrag.actionKey)?.label ?? 'Room action'}
      </div>
    );
  if (ship !== undefined) {
    return (
      <section aria-label="Ship combat structure" className="ship-combat-editor">
        <section
          aria-label={actions === undefined ? undefined : 'Room Timeline'}
          className="room-actions-workbench"
        >
          {actions === undefined ? null : <SemanticOwnerMarker address={actions.owner} />}
          <p aria-live="polite" className="visually-hidden">
            {announcement}
          </p>
          <div
            className="ship-phase-list"
            ref={(element) => {
              board.current = element;
            }}
            {...pointerHandlers}
          >
            {ship.phases
              .filter((phase) => ship.phaseKey === undefined || phase.key === ship.phaseKey)
              .map((phase) => {
                const timelineActionRanks = new Set(
                  phase.timeline.flatMap((entry) => (entry.kind === 'action' ? [entry.rank] : [])),
                );
                const renderPhaseTimelineEntry = (
                  entry: WorkspaceRoomLifecycleTimelineEntry,
                ): ReactNode[] => {
                  if (entry.kind === 'boundary') return [renderBoundary(entry)];
                  if (entry.kind === 'automaticEffect') {
                    const control = actions?.steadyGrowth?.find(
                      (candidate) =>
                        workspaceInteractionKey(candidate.address) ===
                        workspaceInteractionKey(entry.address),
                    );
                    return control === undefined
                      ? []
                      : [
                          <SteadyGrowthEffectRow
                            control={control}
                            interactions={interactions}
                            key={workspaceInteractionKey(control.address)}
                          />,
                        ];
                  }
                  const row = actions?.rows.find((candidate) => candidate.key === entry.actionKey);
                  return row === undefined ? [] : [renderRow(row, phase.checkpoints)];
                };
                const trailingCheckpoints = phase.checkpoints.filter(
                  (checkpoint) =>
                    actions?.timeline.boundaries.some(
                      (boundary) => lifecycleBoundaryCheckpointKey(boundary) === checkpoint.key,
                    ) !== true &&
                    checkpoint.afterRank !== 0 &&
                    !timelineActionRanks.has(checkpoint.afterRank),
                );
                return (
                  <section
                    aria-label={`${phase.label} ship phase`}
                    className="ship-phase"
                    key={phase.key}
                  >
                    <div className="local-reward-heading">
                      <h4>{phase.label}</h4>
                    </div>
                    {phase.actionRows.length === 0 &&
                    phase.checkpoints.length === 0 &&
                    phase.timeline.length === 0 ? null : (
                      <>
                        <div className="local-reward-heading ship-phase-actions-heading">
                          <h5>Timeline</h5>
                        </div>
                        <ol aria-label={`${phase.label} timeline`} className="room-action-list">
                          {checkpointRows(0, phase.checkpoints)}
                          {phase.timeline.flatMap(renderPhaseTimelineEntry)}
                          {trailingCheckpoints.map((checkpoint) => (
                            <li
                              className="room-action-checkpoint"
                              key={`checkpoint:${checkpoint.key}`}
                            >
                              <span aria-hidden="true" className="hub-roster-rank">
                                ·
                              </span>
                              <strong>{checkpoint.label}</strong>
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                    {phase.optionalRows.length === 0 ? null : (
                      <section aria-label="Optional actions" className="room-action-optional-pool">
                        <div className="local-reward-heading">
                          <h5>Optional actions</h5>
                        </div>
                        <ol
                          aria-label={`${phase.label} optional actions`}
                          className="room-action-list"
                        >
                          {phase.optionalRows.map((row) => renderRow(row, phase.checkpoints))}
                        </ol>
                      </section>
                    )}
                  </section>
                );
              })}
            {ship.phaseKey !== undefined || ship.repairRows.length === 0 ? null : (
              <section aria-label="Ship action repairs" className="ship-action-repairs">
                <div className="local-reward-heading">
                  <h4>Inactive actions</h4>
                </div>
                <p className="fixed-room-state">
                  These retained actions no longer belong to an active Ship phase. Remove them or
                  restore the phase that owns them.
                </p>
                <ol aria-label="Inactive Ship actions" className="room-action-list">
                  {ship.repairRows.map((row) => renderRow(row, []))}
                </ol>
              </section>
            )}
          </div>
          {dragPreview}
        </section>
      </section>
    );
  }
  if (actions === undefined) return null;
  const actionByKey = new Map(actions.rows.map((row) => [row.key, row]));
  const timelineRows = actions.timeline.entries.flatMap((entry) => {
    if (entry.kind === 'boundary') {
      return [renderBoundary(entry)];
    }
    if (entry.kind === 'automaticEffect') {
      const control = actions.steadyGrowth?.find(
        (candidate) =>
          workspaceInteractionKey(candidate.address) === workspaceInteractionKey(entry.address),
      );
      return control === undefined
        ? []
        : [
            <SteadyGrowthEffectRow
              control={control}
              interactions={interactions}
              key={workspaceInteractionKey(control.address)}
            />,
          ];
    }
    if (entry.presentation === 'fieldsCageAnchor') return [];
    const row = actionByKey.get(entry.actionKey);
    return row === undefined ? [] : [renderRow(row, [])];
  });
  return (
    <section aria-label="Room Timeline" className="room-actions-workbench">
      <header className="local-reward-heading">
        <div className="owner-markers">
          <h4>Room Timeline</h4>
          <SemanticOwnerMarker address={actions.owner} />
        </div>
      </header>
      <p aria-live="polite" className="visually-hidden">
        {announcement}
      </p>
      <ol
        aria-label="Room timeline"
        className="room-action-list"
        {...pointerHandlers}
        ref={(element) => {
          board.current = element;
        }}
      >
        {timelineRows}
        {rankedRows.length === 0 ? checkpointRows(0) : null}
      </ol>
      {children}
      {actions.optionalRows.length === 0 ? null : (
        <section aria-label="Optional actions" className="room-action-optional-pool">
          <div className="local-reward-heading">
            <h5>Optional actions</h5>
          </div>
          <ol aria-label="Optional actions" className="room-action-list">
            {actions.optionalRows.map((row) => renderRow(row))}
          </ol>
        </section>
      )}
      {actions.repairRows.length === 0 ? null : (
        <section aria-label="Timeline repairs" className="room-action-repairs">
          <div className="local-reward-heading">
            <h5>Timeline repairs</h5>
          </div>
          <p className="fixed-room-state">
            These retained actions are not part of the active lifecycle order. Restore or remove
            them explicitly.
          </p>
          <ol aria-label="Timeline repairs" className="room-action-list">
            {actions.repairRows.map((row) => renderRow(row))}
          </ol>
        </section>
      )}
      {dragPreview}
    </section>
  );
}

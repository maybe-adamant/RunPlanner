import { type OccurrenceAddress } from '@run-planner/engine/authored-project';
import {
  Fragment,
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
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActions,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomLifecycleTimelineEntry,
  type WorkspaceRewardWheelDescriptor,
  type WorkspaceShipPhasePresentation,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { CandidateSelect } from './CandidateSelect';
export { SteadyGrowthEffectRow } from './SteadyGrowthEffectRow';
import { SteadyGrowthEffectRow } from './SteadyGrowthEffectRow';
export { TranscendentEmbryoEffectRow } from './TranscendentEmbryoEffectRow';
import { TranscendentEmbryoEffectRow } from './TranscendentEmbryoEffectRow';
import { LifecycleBoundaryRow } from './RoomLifecycleBoundaryRow';
import { RoomActionAcquisitionRow } from './RoomActionAcquisitionRow';
import { RoomActionInlineEditors } from './RoomActionInlineEditors';
import { RoomActionOrderingControls } from './RoomActionOrderingControls';
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

export function RoomActionsWorkbench({
  actions,
  children,
  encounterPhases,
  idPrefix,
  interactions,
  optionalChildren,
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
  /** Room-owned optional interactions that do not exist as authored actions yet. */
  readonly optionalChildren?: ReactNode;
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
  const hasOptionalChildren = optionalChildren !== undefined && optionalChildren !== null;
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
      .filter(
        (checkpoint) =>
          actions?.timeline.suppressedCheckpointKeys.includes(checkpoint.key) !== true,
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
  const renderSupplement = (
    supplement: Extract<
      WorkspaceRoomLifecycleTimelineEntry,
      { readonly kind: 'boundary' | 'action' }
    >['supplement'],
  ): ReactNode => {
    if (supplement === undefined) return null;
    return supplement.kind === 'encounter'
      ? (renderEncounterPhase?.(supplement.phase) ?? null)
      : (renderRewardWheel?.(supplement.wheel) ?? null);
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
    const target = Object.freeze({ kind: 'position' as const, toIndex: entry.dropIndex });
    const targetState = dropState(target);
    return (
      <Fragment key={entry.boundary.key}>
        <LifecycleBoundaryRow
          boundary={entry.boundary}
          dropIndex={entry.dropIndex}
          label={entry.label}
          {...(entry.fieldsCageSlot === undefined
            ? {}
            : {
                fieldsCageSlot: entry.fieldsCageSlot,
                onSelectFieldsCage: applyFieldsCageSelection,
              })}
          {...(targetState === undefined ? {} : { dropState: targetState })}
        />
        {renderSupplement(entry.supplement)}
        {renderBoundaryContent?.(entry.boundary)}
      </Fragment>
    );
  };
  const renderRow = (
    row: WorkspaceRoomActions['rows'][number],
    checkpoints: WorkspaceRoomActions['checkpoints'] = actions?.checkpoints ?? [],
    supplement?: Extract<
      WorkspaceRoomLifecycleTimelineEntry,
      { readonly kind: 'action' }
    >['supplement'],
  ) => {
    if (actions === undefined) return null;
    const proposals = row.proposalKeys.flatMap((key) => {
      const proposal = actions.proposals.find((candidate) => candidate.key === key);
      return proposal === undefined ? [] : [proposal];
    });
    const wheel = row.wheelPick;
    const canDrag =
      row.rank !== null &&
      rankedRows.length > 1 &&
      proposals.some((proposal) => proposal.kind === 'move');
    const staleShopRemoval = row.stale ? row.shopParticipation : undefined;
    const removeRow = (): void => {
      const removable = proposals.find((proposal) => proposal.kind === 'remove');
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
              <RoomActionInlineEditors interactions={interactions} row={row} />
            </div>
            <RoomActionOrderingControls
              onApply={apply}
              onRemove={removeRow}
              proposals={proposals}
              row={row}
            />
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
          <RoomActionAcquisitionRow interactions={interactions} row={row} />
          {renderSupplement(supplement)}
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
                    if (entry.effect === 'steadyGrowth') {
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
                    const control = actions?.transcendentEmbryo?.find(
                      (candidate) =>
                        workspaceInteractionKey(candidate.address) ===
                        workspaceInteractionKey(entry.address),
                    );
                    return control === undefined
                      ? []
                      : [
                          <TranscendentEmbryoEffectRow
                            control={control}
                            interactions={interactions}
                            key={workspaceInteractionKey(control.address)}
                          />,
                        ];
                  }
                  const row = actions?.rows.find((candidate) => candidate.key === entry.actionKey);
                  return row === undefined
                    ? []
                    : [
                        <Fragment key={entry.actionKey}>
                          {renderRow(row, phase.checkpoints, entry.supplement)}
                        </Fragment>,
                      ];
                };
                const trailingCheckpoints = phase.checkpoints.filter(
                  (checkpoint) =>
                    actions?.timeline.suppressedCheckpointKeys.includes(checkpoint.key) !== true &&
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
      if (entry.effect === 'steadyGrowth') {
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
      const control = actions.transcendentEmbryo?.find(
        (candidate) =>
          workspaceInteractionKey(candidate.address) === workspaceInteractionKey(entry.address),
      );
      return control === undefined
        ? []
        : [
            <TranscendentEmbryoEffectRow
              control={control}
              interactions={interactions}
              key={workspaceInteractionKey(control.address)}
            />,
          ];
    }
    if (entry.presentation === 'fieldsCageAnchor') return [];
    const row = actionByKey.get(entry.actionKey);
    return row === undefined
      ? []
      : [<Fragment key={entry.actionKey}>{renderRow(row, [], entry.supplement)}</Fragment>];
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
      {actions.optionalRows.length === 0 && !hasOptionalChildren ? null : (
        <section aria-label="Optional actions" className="room-action-optional-pool">
          <div className="local-reward-heading">
            <h5>Optional actions</h5>
          </div>
          <ol aria-label="Optional actions" className="room-action-list">
            {actions.optionalRows.map((row) => renderRow(row))}
            {optionalChildren}
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

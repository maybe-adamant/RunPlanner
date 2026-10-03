import {
  Fragment,
  useEffect,
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
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
export { SteadyGrowthEffectRow } from './SteadyGrowthEffectRow';
import { SteadyGrowthEffectRow } from './SteadyGrowthEffectRow';
export { TranscendentEmbryoEffectRow } from './TranscendentEmbryoEffectRow';
import { TranscendentEmbryoEffectRow } from './TranscendentEmbryoEffectRow';
import { LifecycleBoundaryRow } from './RoomLifecycleBoundaryRow';
import { FieldsCageOrderControl } from './FieldsCageOrderControl';
import { RoomActionAcquisitionRow } from './RoomActionAcquisitionRow';
import { RoomActionInlineEditors } from './RoomActionInlineEditors';
import { RoomActionOrderingControls } from './RoomActionOrderingControls';
import { roomActionDestinationLabel } from './room-action-placement';
import { NemesisInteractionEditor } from './NemesisEventEditor';
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
  renderRowTrailingContent,
  renderBoundaryContent,
  mode,
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
  /** Consumer-owned controls placed after the shared ordering controls. */
  readonly renderRowTrailingContent?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  readonly renderBoundaryContent?: (boundary: WorkspaceRoomLifecycleBoundary) => ReactNode;
  readonly mode:
    | { readonly kind: 'roomTimeline' }
    | { readonly kind: 'shipPhase'; readonly phase: WorkspaceShipPhasePresentation }
    | {
        readonly kind: 'shipRepairs';
        readonly rows: readonly WorkspaceRoomActions['rows'][number][];
      };
}) {
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  const board = useRef<HTMLOListElement | HTMLDivElement>(null);
  const pendingPointerDrag = useRef<PendingRoomActionPointerDrag | undefined>(undefined);
  const activePointerDrag = useRef<RoomActionPointerDrag | undefined>(undefined);
  const [pointerDrag, setPointerDrag] = useState<RoomActionPointerDrag | undefined>(undefined);
  const dragging = pointerDrag !== undefined;
  const [announcement, setAnnouncement] = useState('');
  const [placementRequest, setPlacementRequest] = useState<{ owner: string; actionKey: string }>();
  const placementTrigger = useRef<HTMLButtonElement | null>(null);
  const pendingPlacementFocus = useRef<{ owner: string; actionKey: string } | undefined>(undefined);
  const placementOwner =
    actions === undefined
      ? ''
      : `${workspaceInteractionKey(actions.owner)}:${mode.kind === 'shipPhase' ? mode.phase.key : mode.kind}`;
  const placingRow =
    placementRequest?.owner === placementOwner
      ? actions?.rows.find(
          (row) => row.key === placementRequest.actionKey && row.rank === null && !row.stale,
        )
      : undefined;
  useEffect(() => {
    const pending = pendingPlacementFocus.current;
    if (pending === undefined) return;
    if (pending.owner !== placementOwner) {
      pendingPlacementFocus.current = undefined;
      return;
    }
    const placed = Array.from(
      board.current?.querySelectorAll<HTMLElement>(
        '[data-room-action-key][data-in-order="true"]',
      ) ?? [],
    ).find((element) => element.dataset.roomActionKey === pending.actionKey);
    if (placed === undefined) return;
    pendingPlacementFocus.current = undefined;
    placed.focus({ preventScroll: true });
    placed.scrollIntoView?.({ block: 'center' });
  }, [actions, placementOwner]);
  const cancelPlacement = (): void => {
    setPlacementRequest(undefined);
    placementTrigger.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (placingRow === undefined) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const overlaySelector =
        '[role="dialog"], [role="alertdialog"], [role="listbox"], .run-state-sheet';
      if (
        event
          .composedPath()
          .some((target) => target instanceof Element && target.matches(overlaySelector)) ||
        document.querySelector(overlaySelector) !== null
      )
        return;
      event.preventDefault();
      setPlacementRequest(undefined);
      placementTrigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [placingRow]);
  const hasOptionalChildren = optionalChildren !== undefined && optionalChildren !== null;
  if (actions === undefined && mode.kind === 'roomTimeline') {
    if (encounterPhases === undefined || idPrefix === undefined) return null;
    return (
      <section aria-label="Room Timeline" className="room-actions-workbench">
        {encounterPhases
          .filter((phase) => phase.editorAnchor !== 'overview')
          .map((phase) => (
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
    if (proposal === undefined) return;
    if (!proposal.structurallyAuthorable) {
      setAnnouncement(`Action not moved. ${proposal.explanations.join(' ')}`);
      return;
    }
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
    if (supplement.kind === 'encounter') return renderEncounterPhase?.(supplement.phase) ?? null;
    if (supplement.kind === 'rewardWheel') return renderRewardWheel?.(supplement.wheel) ?? null;
    const interaction = interactions.nemesisEvents.get(workspaceInteractionKey(supplement.owner));
    return interaction === undefined ? null : (
      <NemesisInteractionEditor interaction={interaction} />
    );
  };
  const dropState = (target: RoomActionDropTarget) => {
    if (!sameRoomActionDropTarget(pointerDrag?.target, target)) return undefined;
    const proposal = proposalForDrop(pointerDrag!.actionKey, target);
    if (proposal === undefined) return undefined;
    return proposal.structurallyAuthorable ? 'available' : 'unavailable';
  };
  const renderedInsertions = new Set<string>();
  const visibleTimeline =
    mode.kind === 'roomTimeline'
      ? (actions?.timeline.entries ?? [])
      : mode.kind === 'shipPhase'
        ? mode.phase.timeline
        : [];
  // A shared action-order position belongs below its Doors open boundary.
  const doorsOpenInsertion = visibleTimeline.find(
    (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'cleanup',
  );
  const renderInsertion = (toIndex: number, key: string): ReactNode => {
    if (placingRow === undefined) return null;
    if (
      doorsOpenInsertion?.kind === 'boundary' &&
      doorsOpenInsertion.dropIndex === toIndex &&
      doorsOpenInsertion.boundary.key !== key
    )
      return null;
    const proposal = actions?.proposals.find(
      (candidate) =>
        candidate.kind === 'insert' &&
        candidate.toIndex === toIndex &&
        placingRow.proposalKeys.includes(candidate.key),
    );
    if (proposal === undefined || renderedInsertions.has(proposal.key)) return null;
    renderedInsertions.add(proposal.key);
    return (
      <li className="room-action-insertion" key={`insert:${key}`}>
        <button
          aria-label={`Add ${placingRow.label} here: ${roomActionDestinationLabel(actions?.rows ?? [], toIndex)}`}
          aria-disabled={!proposal.structurallyAuthorable}
          aria-description={proposal.explanations.join(' ') || undefined}
          className="contextual-picker-trigger room-action-insertion-button"
          title={proposal.structurallyAuthorable ? undefined : proposal.explanations.join(' ')}
          onClick={() => {
            if (!proposal.structurallyAuthorable) return;
            pendingPlacementFocus.current = { owner: placementOwner, actionKey: placingRow.key };
            apply(proposal.key);
            setPlacementRequest(undefined);
            setAnnouncement(`${placingRow.label} added to the timeline.`);
          }}
          type="button"
        >
          {proposal.structurallyAuthorable ? '+ Add action here' : 'Unavailable here'}
        </button>
      </li>
    );
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
          {...(entry.fieldsCage === undefined ? {} : { fieldsCage: entry.fieldsCage })}
          {...(targetState === undefined ? {} : { dropState: targetState })}
        />
        {renderSupplement(entry.supplement)}
        {renderBoundaryContent?.(entry.boundary)}
        {entry.boundary.kind === 'encounterStart'
          ? null
          : renderInsertion(entry.dropIndex, entry.boundary.key)}
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
    const nemesisInteraction =
      supplement?.kind === 'nemesisInteraction'
        ? interactions.nemesisEvents.get(workspaceInteractionKey(supplement.owner))
        : undefined;
    const proposals = row.proposalKeys.flatMap((key) => {
      const proposal = actions.proposals.find((candidate) => candidate.key === key);
      return proposal === undefined ? [] : [proposal];
    });
    const canDrag =
      row.rank !== null &&
      rankedRows.length > 1 &&
      proposals.some((proposal) => proposal.kind === 'move');
    const staleShopRemoval = row.stale ? row.shopParticipation : undefined;
    const placement = row.placement;
    const inlineMysteryBoonOffer =
      row.rewardPayload?.showOffer === true &&
      (row.rewardPayload.control.offer?.rewardType ??
        row.rewardPayload.control.authoringSeed?.rewardType) === 'BlindBoxLoot';
    const actionAccent = row.stale
      ? undefined
      : row.participation === 'optional'
        ? row.participationOwnedByOverview && row.rank !== null
          ? 'room'
          : 'optional'
        : row.requiredScope;
    const removeRow = (): void => {
      const removable = proposals.find(
        (proposal) => proposal.kind === 'remove' || proposal.kind === 'unplace',
      );
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
          data-action-accent={actionAccent}
          // A row title would follow the pointer as a native tooltip during a drag.
          title={
            dragging
              ? undefined
              : actionAccent === 'optional'
                ? 'Optional action'
                : actionAccent === 'phase'
                  ? 'Required in this timeline section, not necessarily as the next action.'
                  : actionAccent === 'room'
                    ? 'Required before leaving the room.'
                    : undefined
          }
          data-dragging={pointerDrag?.actionKey === row.key || undefined}
          data-drop-after={
            row.rank === null ? undefined : dropState({ kind: 'afterSlot', slotKey: row.key })
          }
          data-drop-before={
            row.rank === null ? undefined : dropState({ kind: 'beforeSlot', slotKey: row.key })
          }
          data-in-order={row.rank === null ? 'false' : 'true'}
          data-placing={placingRow?.key === row.key || undefined}
          data-inline-layout={
            nemesisInteraction !== undefined
              ? 'sentence'
              : row.reference.kind === 'interactKeepsakeRack' || row.fountainRarity !== undefined
                ? 'compact'
                : inlineMysteryBoonOffer
                  ? 'mystery-boon'
                  : undefined
          }
          data-room-action-key={row.key}
          {...findingTarget(row.address)}
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
            {nemesisInteraction === undefined ? (
              <strong>{row.label}</strong>
            ) : (
              <NemesisInteractionEditor interaction={nemesisInteraction} />
            )}
            {row.stale ? <span className="neutral-status">stale</span> : null}
            {row.rank === null && row.participation === 'required' ? (
              <span className="neutral-status">required</span>
            ) : null}
          </div>
          <div className="hub-rank-actions room-action-controls">
            <div className="room-action-inline-editors">
              {renderRowContent?.(row)}
              <RoomActionInlineEditors
                inlineRewardOffer={inlineMysteryBoonOffer}
                interactions={interactions}
                row={row}
              />
              {nemesisInteraction === undefined ? renderSupplement(supplement) : null}
              <RoomActionAcquisitionRow
                hideOffer={inlineMysteryBoonOffer}
                interactions={interactions}
                row={row}
              />
            </div>
            <div className="room-action-ordering">
              {placement === undefined ? (
                <RoomActionOrderingControls
                  onApply={apply}
                  onRemove={removeRow}
                  onBeginAdd={(button) => {
                    placementTrigger.current = button;
                    setPlacementRequest({ owner: placementOwner, actionKey: row.key });
                    setAnnouncement(`Choose where to add ${row.label}.`);
                  }}
                  proposals={proposals}
                  row={row}
                  rows={actions.rows}
                  showRemoval={
                    row.reference.kind !== 'interactKeepsakeRack' &&
                    row.reference.kind !== 'interactEris' &&
                    (!row.participationOwnedByOverview || row.stale)
                  }
                />
              ) : (
                <button
                  aria-label={
                    row.participation === 'required'
                      ? placement.command.kind === 'PlaceHermesShrineDelivery'
                        ? 'Restore delivery'
                        : 'Place required pickup'
                      : 'Take pickup'
                  }
                  className="secondary-action action-compact room-action-placement-toggle"
                  onClick={() => executeIntent(placement)}
                  type="button"
                >
                  {placement.command.kind === 'PlaceHermesShrineDelivery'
                    ? 'Restore delivery'
                    : row.participation === 'required'
                      ? 'Place'
                      : 'Take pickup'}
                </button>
              )}
              {renderRowTrailingContent?.(row)}
            </div>
          </div>
        </li>
        {row.rank === null ? null : checkpointRows(row.rank, checkpoints)}
        {row.rank === null ? null : renderInsertion(row.rank, row.key)}
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
  const hoveredProposal =
    pointerDrag?.target === undefined
      ? undefined
      : proposalForDrop(pointerDrag.actionKey, pointerDrag.target);
  const dragPreview =
    pointerDrag === undefined ? null : (
      <div
        aria-hidden="true"
        className="room-action-drag-preview"
        style={{
          transform: `translate3d(calc(${pointerDrag.x + 14}px / var(--app-scale, 1)), calc(${pointerDrag.y + 14}px / var(--app-scale, 1)), 0)`,
        }}
      >
        <div className="room-action-drag-header">
          <span aria-hidden="true">⠿</span>
          <strong>
            {actions?.rows.find((row) => row.key === pointerDrag.actionKey)?.label ?? 'Room action'}
          </strong>
        </div>
        {hoveredProposal === undefined ? null : (
          <span className="room-action-drag-feedback">
            {hoveredProposal.structurallyAuthorable
              ? 'Drop here'
              : `Unavailable: ${hoveredProposal.explanations.join(' ')}`}
          </span>
        )}
      </div>
    );
  const placementNotice =
    placingRow === undefined ? null : (
      <div className="room-action-placement-notice" role="status">
        <span>
          Placing: <strong>{placingRow.label}</strong>
        </span>
        <button className="quiet-action action-compact" onClick={cancelPlacement} type="button">
          Cancel
        </button>
      </div>
    );
  if (mode.kind !== 'roomTimeline') {
    return (
      <section aria-label="Ship combat structure" className="ship-combat-editor">
        <section
          aria-label={actions === undefined ? undefined : 'Room Timeline'}
          className="room-actions-workbench"
          {...(actions === undefined ? {} : findingTarget(actions.owner))}
          tabIndex={-1}
        >
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
            {(mode.kind === 'shipPhase' ? [mode.phase] : []).map((phase) => {
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
                if (entry.presentation !== 'row') return [];
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
                  {phase.actionRows.length === 0 &&
                  phase.checkpoints.length === 0 &&
                  phase.timeline.length === 0 ? null : (
                    <ol aria-label={`${phase.label} timeline`} className="room-action-list">
                      {checkpointRows(0, phase.checkpoints)}
                      {phase.timeline.flatMap(renderPhaseTimelineEntry)}
                      {trailingCheckpoints.map((checkpoint) => (
                        <li className="room-action-checkpoint" key={`checkpoint:${checkpoint.key}`}>
                          <span aria-hidden="true" className="hub-roster-rank">
                            ·
                          </span>
                          <strong>{checkpoint.label}</strong>
                        </li>
                      ))}
                    </ol>
                  )}
                  {phase.unplacedRows.length === 0 ? null : (
                    <section aria-label="Required actions" className="room-action-optional-pool">
                      <div className="local-reward-heading">
                        <h5>Required actions</h5>
                      </div>
                      <ol
                        aria-label={`${phase.label} required actions`}
                        className="room-action-list"
                      >
                        {phase.unplacedRows.map((row) => renderRow(row, phase.checkpoints))}
                      </ol>
                    </section>
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
            {mode.kind !== 'shipRepairs' || mode.rows.length === 0 ? null : (
              <section aria-label="Ship action repairs" className="ship-action-repairs">
                <div className="local-reward-heading">
                  <h4>Inactive actions</h4>
                </div>
                <ol aria-label="Inactive Ship actions" className="room-action-list">
                  {mode.rows.map((row) => renderRow(row, []))}
                </ol>
              </section>
            )}
          </div>
          {dragPreview}
          {placementNotice}
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
    if (entry.presentation !== 'row') return [];
    const row = actionByKey.get(entry.actionKey);
    return row === undefined
      ? []
      : [<Fragment key={entry.actionKey}>{renderRow(row, [], entry.supplement)}</Fragment>];
  });
  return (
    <section
      aria-label="Room Timeline"
      className="room-actions-workbench"
      {...findingTarget(actions.owner)}
      tabIndex={-1}
    >
      <p aria-live="polite" className="visually-hidden">
        {announcement}
      </p>
      {actions.timeline.fieldsCageOrder === undefined || interaction === undefined ? null : (
        <FieldsCageOrderControl
          control={actions.timeline.fieldsCageOrder}
          id={`${idPrefix ?? 'room-actions'}-cage-order`}
          interaction={interaction}
        />
      )}
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
          <ol aria-label="Timeline repairs" className="room-action-list">
            {actions.repairRows.map((row) => renderRow(row))}
          </ol>
        </section>
      )}
      {dragPreview}
      {placementNotice}
    </section>
  );
}

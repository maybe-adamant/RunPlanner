import { semanticAddressKey, type OccurrenceAddress } from '@run-planner/engine/authored-project';
import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { candidateSupport, presentCandidateLabel } from '@planner/projections/candidateProjection';
import {
  requireWorkspaceInteraction,
  dropRankedPrefixItem,
  reconcileRankedPrefix,
  workspaceInteractionKey,
  type RankedPrefixDropTarget,
  type WorkspaceDoorContract,
  type WorkspaceEncounterInteraction,
  type WorkspaceEncounterPhase,
  type WorkspaceInteractionCatalog,
  type WorkspaceLocalVisitDecision,
  type WorkspaceRoomSummary,
  type WorkspaceNaturalChaosSpawnControl,
  type WorkspaceNaturalChaosExitControl,
  type WorkspaceRunStateLauncher,
  type WorkspaceZagreusSpawnControl,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { TraitOfferLauncher } from '../rewards/TraitOfferEditor';
import { CandidateSelect } from './CandidateSelect';
import { RunStateLauncher } from './RunStateSheet';
import { DoorRewardEditor } from './DoorRewardEditor';

const emptyEncounterPicker: import('@planner/projections/contextualPicker').ContextualPickerModel<string> =
  Object.freeze({ sections: Object.freeze([]) });

interface OccurrenceWorkbenchProps {
  readonly incomingDoor?: WorkspaceDoorContract;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit?: WorkspaceLocalVisitDecision;
  /** Hub visits retain their editable main offer on the Hub board. */
  readonly presentation: 'doorTarget' | 'full' | 'hubRoomLocal';
  readonly room: WorkspaceRoomSummary;
  readonly runState?: WorkspaceRunStateLauncher;
}

function LocalVisitOrderSelect({
  interactions,
  localVisit,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly slot: WorkspaceLocalVisitDecision['slots'][number];
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.localVisitOrders,
    slot.order.interactionKey,
  );
  const candidates = useWorkspaceInteraction(interaction);
  const selectedIndex = slot.order.options.findIndex(
    (option) => option.key === slot.order.selectedKey,
  );
  if (selectedIndex < 0) throw new Error(`${slot.label} has no selected local-visit position`);
  const selectedCandidate = candidates.result?.[selectedIndex];
  const replace = (key: string): void => {
    const optionIndex = slot.order.options.findIndex((option) => option.key === key);
    const option = slot.order.options[optionIndex];
    const candidateResults = candidates.result ?? candidates.activate();
    const candidate = candidateResults?.[optionIndex];
    if (option === undefined || !candidateMayBeAuthored(candidate)) return;
    executeIntent(interaction.intentFor(option.proposedOccurrenceIds));
  };
  return (
    <label className="field-control ephyra-side-entry-order">
      <span className="visually-hidden">{slot.label} visit order</span>
      <select
        aria-busy={candidates.pending || undefined}
        data-candidate-support={candidateSupport(selectedCandidate)}
        onChange={(event) => replace(event.target.value)}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        value={slot.order.selectedKey}
      >
        {slot.order.options.map((option, index) => {
          const candidate = candidates.result?.[index];
          const disabled = candidate !== undefined && !candidateMayBeAuthored(candidate);
          return (
            <option
              data-candidate-support={candidateSupport(candidate)}
              disabled={disabled}
              key={option.key}
              value={option.key}
            >
              {presentCandidateLabel(option.label, candidate)}
            </option>
          );
        })}
      </select>
      <SemanticOwnerMarker address={localVisit.order} />
    </label>
  );
}

function LocalVisitSlotRow({
  interactions,
  localVisit,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly slot: WorkspaceLocalVisitDecision['slots'][number];
}) {
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const generation = requireWorkspaceInteraction(
    interactions.localVisitGenerations,
    workspaceInteractionKey(slot.address),
  );
  return (
    <tr className="ephyra-side-grid-row">
      <th scope="row">
        <div className="ephyra-side-room-heading">
          <div className="owner-markers">
            <span>{slot.label}</span>
            <SemanticOwnerMarker address={slot.address} />
          </div>
          <p className="card-kicker">Door {slot.physicalDoorId}</p>
        </div>
        {slot.generation !== 'generated' ? null : (
          <button
            className="quiet-action action-compact"
            onClick={() => dispatch(semanticOwnerFocused(slot.room.address))}
            type="button"
          >
            Open {slot.label}
          </button>
        )}
      </th>
      <td className="ephyra-side-priority">{slot.availabilityRank}</td>
      <td>
        <CandidateSelect
          id={`local-${slot.marker.focusKey}-generation`}
          interaction={generation}
          label={`${slot.label} generation`}
          onReplace={(value) => executeIntent(generation.intentFor(value))}
        />
      </td>
      <td>
        <LocalVisitOrderSelect interactions={interactions} localVisit={localVisit} slot={slot} />
      </td>
      <td>
        {slot.generation !== 'generated' ? null : (
          <DoorRewardEditor
            door={slot.door}
            idPrefix={`local-door-${slot.marker.focusKey}`}
            interactions={interactions}
          />
        )}
      </td>
    </tr>
  );
}

function LocalVisitWorkbench({
  interactions,
  localVisit,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
}) {
  return (
    <section aria-label="Ephyra side rooms" className="ephyra-side-editor">
      <header className="local-reward-heading">
        <div className="owner-markers">
          <h4>Side rooms</h4>
          <SemanticOwnerMarker address={localVisit.address} />
        </div>
        <span className="neutral-status">
          {localVisit.visitOrder.length} visited · {localVisit.slots.length} possible
        </span>
      </header>
      <div className="ephyra-side-grid-scroll">
        <table className="ephyra-side-grid">
          <caption className="visually-hidden">Ephyra side-room generation and visit order</caption>
          <thead>
            <tr>
              <th scope="col">Room</th>
              <th scope="col">Priority</th>
              <th scope="col">Generated</th>
              <th scope="col">Visit order</th>
              <th scope="col">Door reward</th>
            </tr>
          </thead>
          <tbody>
            {localVisit.slots.map((slot) => (
              <LocalVisitSlotRow
                interactions={interactions}
                key={slot.key}
                localVisit={localVisit}
                slot={slot}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function NaturalChaosMapWorkbench({
  control,
  interactions,
}: {
  readonly control: WorkspaceNaturalChaosExitControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.naturalChaosExits,
    workspaceInteractionKey(control.owner),
  );
  return (
    <label className="field-control" htmlFor={`chaos-map-${control.door.room.occurrenceId}`}>
      <span>Map</span>
      <select
        id={`chaos-map-${control.door.room.occurrenceId}`}
        onChange={(event) => executeIntent(interaction.mapIntent(event.target.value))}
        value={control.door.room.gameName}
      >
        {control.mapChoices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function HubRewardContext({ door }: { readonly door?: WorkspaceDoorContract }) {
  const dispatch = useAppDispatch();
  const preview = door?.rewardPreview;
  const reward =
    preview?.kind === 'visible' && preview.rewards.length === 1 ? preview.rewards[0] : undefined;
  if (reward === undefined) return null;

  return (
    <section aria-label="Hub reward" className="hub-reward-context">
      <span className="hub-reward-context-label">Hub reward</span>
      <span className="hub-reward-summary">{reward.summary}</span>
      {reward.control === undefined ? null : (
        <button
          className="quiet-action action-compact"
          onClick={() => dispatch(semanticOwnerFocused(reward.marker.address))}
          type="button"
        >
          Edit Hub reward
        </button>
      )}
    </section>
  );
}

function CustomizableEncounterPhaseControl({
  idPrefix,
  interaction,
  phase,
}: {
  readonly idPrefix: string;
  readonly interaction: WorkspaceEncounterInteraction;
  readonly phase: WorkspaceEncounterPhase;
}) {
  const executeIntent = useCommandIntent();
  const candidates = useWorkspaceInteraction(interaction);
  return (
    <>
      <ContextualPicker
        id={`${idPrefix}-${phase.address.phaseKey}`}
        label="Encounter"
        loading={candidates.pending}
        model={candidates.result ?? emptyEncounterPicker}
        onOpenChange={(open) => {
          if (open) candidates.activate();
        }}
        onSelect={(encounterKey) => executeIntent(interaction.intentFor(encounterKey))}
        placeholder="Choose an encounter"
        triggerLabel={phase.selectedEncounter.label}
      />
      {phase.resettable ? (
        <button
          className="quiet-action action-compact"
          onClick={() => executeIntent(interaction.resetIntent)}
          type="button"
        >
          Reset to default
        </button>
      ) : null}
    </>
  );
}

function EncounterPhaseControl({
  idPrefix,
  interactions,
  phase,
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly phase: WorkspaceEncounterPhase;
}) {
  const executeIntent = useCommandIntent();
  const figLeafInteraction =
    phase.figLeaf === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.figLeafSkips, phase.figLeaf.interactionKey);
  const figLeafControl =
    figLeafInteraction === undefined ? null : (
      <label className="field-control fig-leaf-skip-control">
        <input
          checked={figLeafInteraction.selected}
          disabled={!figLeafInteraction.supported && !figLeafInteraction.selected}
          onChange={(event) => executeIntent(figLeafInteraction.intentFor(event.target.checked))}
          type="checkbox"
        />
        <span>Skip combat with Fig Leaf</span>
      </label>
    );
  const gorgonInteraction =
    phase.gorgonCondition === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.gorgonConditions,
          phase.gorgonCondition.interactionKey,
        );
  const gorgonControl =
    gorgonInteraction === undefined ? null : (
      <label className="field-control gorgon-condition-control">
        <input
          checked={gorgonInteraction.selected}
          disabled={!gorgonInteraction.supported && !gorgonInteraction.selected}
          onChange={(event) => executeIntent(gorgonInteraction.intentFor(event.target.checked))}
          type="checkbox"
        />
        <span>Death Defiance condition met (Gorgon Amulet)</span>
      </label>
    );
  if (!phase.customizable) {
    return (
      <section
        aria-label={`${phase.label} encounter phase`}
        className="encounter-phase-control"
        data-read-only="true"
        id={semanticOwnerControlElementId(phase.address)}
      >
        <div className="local-reward-heading">
          <div className="owner-markers">
            <h4>{phase.label}</h4>
            <SemanticOwnerMarker address={phase.address} />
          </div>
        </div>
        <p className="fixed-room-state">Encounter: {phase.selectedEncounter.label}</p>
        {figLeafControl}
        {gorgonControl}
      </section>
    );
  }
  const interaction = requireWorkspaceInteraction(
    interactions.encounterPhases,
    workspaceInteractionKey(phase.address),
  );
  return (
    <section
      aria-label={`${phase.label} encounter phase`}
      className="encounter-phase-control"
      id={semanticOwnerControlElementId(phase.address)}
    >
      <div className="local-reward-heading">
        <div className="owner-markers">
          <h4>{phase.label}</h4>
          <SemanticOwnerMarker address={phase.address} />
        </div>
      </div>
      <CustomizableEncounterPhaseControl
        idPrefix={idPrefix}
        interaction={interaction}
        phase={phase}
      />
      {figLeafControl}
      {gorgonControl}
    </section>
  );
}

function EncounterWorkbench({
  idPrefix,
  interactions,
  phases,
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly phases: readonly WorkspaceEncounterPhase[];
}) {
  const presentedPhases = phases.filter(
    (phase) =>
      phase.customizable ||
      phase.marker.findingCount > 0 ||
      phase.traitOffer !== undefined ||
      phase.figLeaf !== undefined ||
      phase.gorgonCondition !== undefined ||
      phase.gorgonAthena !== undefined,
  );
  if (presentedPhases.length === 0) return null;
  return (
    <section aria-label="Encounter phases" className="encounter-editor">
      <div className="local-reward-heading">
        <h4>Encounter</h4>
      </div>
      <div className="encounter-phase-list">
        {presentedPhases.map((phase) => (
          <EncounterPhaseControl
            idPrefix={idPrefix}
            interactions={interactions}
            key={workspaceInteractionKey(phase.address)}
            phase={phase}
          />
        ))}
      </div>
    </section>
  );
}

function FieldsWorkbench({
  room,
}: {
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>;
}) {
  const dispatch = useAppDispatch();
  return (
    <div className="fields-room-editor">
      <label className="field-control">
        <span>Optional pickups</span>
        <select
          aria-label="Optional pickups"
          onChange={(event) =>
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceFieldsOptionalRewardCount',
                occurrence: room.owner,
                optionalRewardCount: Number(event.target.value),
              }),
            )
          }
          value={room.optionalRewardCount}
        >
          {room.optionalRewardCountValues.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ShipWorkbench({
  interactions,
  room,
  occurrence,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly occurrence: OccurrenceAddress;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'ship' }>;
}) {
  const dispatch = useAppDispatch();
  const encounter = requireWorkspaceInteraction(
    interactions.shipCombatPhaseCounts,
    workspaceInteractionKey(occurrence),
  );
  const activeWheels = room.wheels.filter((wheel) => wheel.active);

  return (
    <section aria-label="Ship combat structure" className="ship-combat-editor">
      <div className="local-reward-heading">
        <h4>Ship combat</h4>
      </div>
      <CandidateSelect
        id={`room-${occurrence.occurrenceId}-combat-phase-count`}
        interaction={encounter}
        label="Combat phases"
        onReplace={(encounterCount) =>
          dispatch(
            authoredProjectCommandDispatched({
              kind: 'ReplaceShipEncounterCount',
              occurrence,
              encounterCount,
            }),
          )
        }
      />
      <div className="reward-wheel-list">
        {activeWheels.map((wheel) => {
          const store = requireWorkspaceInteraction(
            interactions.rewardWheelStores,
            workspaceInteractionKey(wheel.address),
          );
          const count = requireWorkspaceInteraction(
            interactions.rewardWheelOfferCounts,
            workspaceInteractionKey(wheel.address),
          );
          const idPrefix = `room-${occurrence.occurrenceId}-${wheel.key}`;
          return (
            <section aria-label={wheel.label} className="reward-wheel" key={wheel.key}>
              <div className="local-reward-heading">
                <div className="owner-markers">
                  <h4>{wheel.label}</h4>
                  <SemanticOwnerMarker address={wheel.marker.address} />
                </div>
              </div>
              <div className="reward-wheel-settings">
                <CandidateSelect
                  id={`${idPrefix}-store`}
                  interaction={store}
                  label="Reward pool"
                  onReplace={(storeKey) =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ReplaceRewardWheelStore',
                        wheel: wheel.address,
                        storeKey,
                      }),
                    )
                  }
                />
                <CandidateSelect
                  id={`${idPrefix}-count`}
                  interaction={count}
                  label="Offers"
                  onReplace={(offerCount) =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ReplaceRewardWheelOfferCount',
                        wheel: wheel.address,
                        offerCount,
                      }),
                    )
                  }
                />
              </div>
              <div className="reward-wheel-offers">
                {wheel.offers
                  .filter((offer) => offer.active)
                  .map((offer) => (
                    <section aria-label={offer.label} className="local-reward-slot" key={offer.key}>
                      <div className="local-reward-heading">
                        <div className="owner-markers">
                          <h5>{offer.label}</h5>
                          <SemanticOwnerMarker address={offer.control.marker.address} />
                        </div>
                      </div>
                      <RewardControlEditor
                        control={offer.control}
                        idPrefix={`${idPrefix}-${offer.key}`}
                        interactions={interactions}
                        showAcquisitionChildren={false}
                      />
                    </section>
                  ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function ShopWorkbench({
  interactions,
  occurrence,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly occurrence: OccurrenceAddress;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'shop' }>;
}) {
  const executeIntent = useCommandIntent();
  const conditionInteraction = interactions.shopDeathDefianceConditions.get(
    workspaceInteractionKey(occurrence),
  );
  if (!room.materialized) return null;
  return (
    <div className="shop-editor">
      {conditionInteraction === undefined ? null : (
        <label className="shop-condition-control">
          <input
            checked={conditionInteraction.value}
            onChange={(event) =>
              executeIntent(conditionInteraction.intentFor(event.target.checked))
            }
            type="checkbox"
          />
          Death Defiance condition met
        </label>
      )}
      <div className="shop-table-scroll">
        <table className="shop-offer-table">
          <thead>
            <tr>
              <th scope="col">Offer</th>
            </tr>
          </thead>
          <tbody>
            {room.offers.map((offer) => (
              <Fragment key={offer.key}>
                <tr className="shop-offer" key={`${offer.key}:identity`}>
                  <th scope="row">
                    <div className="owner-markers">
                      <span>{offer.label}</span>
                      <SemanticOwnerMarker address={offer.rewardControl.marker.address} />
                    </div>
                  </th>
                </tr>
                <tr className="shop-offer-reward" key={`${offer.key}:reward`}>
                  <td>
                    <RewardControlEditor
                      control={offer.rewardControl}
                      idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
                      interactions={interactions}
                      showAcquisitionChildren={false}
                    />
                  </td>
                </tr>
              </Fragment>
            ))}
            {room.supplementalOffers.map((offer) =>
              offer.kind === 'travelDealPlaceholder' ||
              offer.kind === 'echoDoubleShopPlaceholder' ? (
                <tr className="shop-offer shop-offer-disabled" key={offer.key}>
                  <th scope="row">
                    {offer.label}: {offer.explanation}
                  </th>
                </tr>
              ) : offer.kind === 'travelDealInvalid' || offer.kind === 'echoDoubleShopInvalid' ? (
                <tr className="shop-offer shop-offer-invalid" key={offer.key}>
                  <th scope="row">
                    <span>{offer.label}</span>
                    <small>{offer.explanation}</small>
                  </th>
                </tr>
              ) : 'rewardControl' in offer ? (
                <Fragment key={offer.key}>
                  <tr className="shop-offer" key={`${offer.key}:identity`}>
                    <th scope="row">
                      <div className="owner-markers">
                        <span>{offer.label}</span>
                        <SemanticOwnerMarker address={offer.rewardControl.marker.address} />
                      </div>
                    </th>
                  </tr>
                  <tr className="shop-offer-reward" key={`${offer.key}:reward`}>
                    <td>
                      <RewardControlEditor
                        control={offer.rewardControl}
                        idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
                        interactions={interactions}
                        showAcquisitionChildren={false}
                      />
                    </td>
                  </tr>
                </Fragment>
              ) : null,
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
  readonly target: RankedPrefixDropTarget | undefined;
  readonly x: number;
  readonly y: number;
}

function sameRoomActionDropTarget(
  left: RankedPrefixDropTarget | undefined,
  right: RankedPrefixDropTarget | undefined,
): boolean {
  if (left === right) return true;
  if (left === undefined || right === undefined || left.kind !== right.kind) return false;
  if (left.kind === 'nextVisit' || right.kind === 'nextVisit') return true;
  return left.slotKey === right.slotKey;
}

function roomActionDropTargetFromPoint(
  root: HTMLElement | null,
  x: number,
  y: number,
): RankedPrefixDropTarget | undefined {
  const row = document
    .elementFromPoint?.(x, y)
    ?.closest<HTMLElement>('[data-room-action-key][data-in-order="true"]');
  if (row === null || row === undefined || root?.contains(row) !== true) return undefined;
  const actionKey = row.dataset.roomActionKey;
  if (actionKey === undefined) return undefined;
  const bounds = row.getBoundingClientRect();
  return Object.freeze({
    kind: y < bounds.top + bounds.height / 2 ? ('beforeSlot' as const) : ('afterSlot' as const),
    slotKey: actionKey,
  });
}

function RoomActionsWorkbench({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: WorkspaceRoomSummary;
}) {
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const board = useRef<HTMLOListElement>(null);
  const pendingPointerDrag = useRef<PendingRoomActionPointerDrag | undefined>(undefined);
  const activePointerDrag = useRef<RoomActionPointerDrag | undefined>(undefined);
  const [pointerDrag, setPointerDrag] = useState<RoomActionPointerDrag | undefined>(undefined);
  const [announcement, setAnnouncement] = useState('');
  const actions = room.roomActions;
  if (actions === undefined) return null;
  const interaction = requireWorkspaceInteraction(interactions.roomActions, actions.interactionKey);
  const rankedRows = actions.rows.filter((row) => row.rank !== null);
  const unrankedRows = actions.rows.filter((row) => row.rank === null);
  const rankedKeys = rankedRows.map((row) => row.key);
  const ranking = reconcileRankedPrefix({
    authoredVisitOrder: rankedKeys,
    declarationOpenSlotKeys: rankedKeys,
  });
  const proposalForMove = (actionKey: string, toIndex: number) => {
    const row = actions.rows.find((candidate) => candidate.key === actionKey);
    return actions.proposals.find(
      (proposal) =>
        proposal.kind === 'move' &&
        row?.proposalKeys.includes(proposal.key) === true &&
        proposal.toIndex === toIndex,
    );
  };
  const apply = (proposalKey: string): void => {
    const proposal = interaction.proposals.find((candidate) => candidate.key === proposalKey);
    if (proposal?.structurallyAuthorable !== true) return;
    executeIntent(interaction.intentFor(proposalKey));
  };
  const proposalForDrop = (
    actionKey: string,
    target: RankedPrefixDropTarget,
  ): (typeof actions.proposals)[number] | undefined => {
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
  const updatePointerDrag = (event: ReactPointerEvent<HTMLOListElement>): void => {
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
  const completePointerDrag = (event: ReactPointerEvent<HTMLOListElement>): void => {
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
    const row = actions.rows.find((candidate) => candidate.key === active.actionKey);
    setAnnouncement(
      `${row?.label ?? active.actionKey} moved to position ${(proposal.toIndex ?? 0) + 1}.`,
    );
    apply(proposal.key);
  };
  const checkpointRows = (afterRank: number) =>
    actions.checkpoints
      .filter((checkpoint) => checkpoint.afterRank === afterRank)
      .map((checkpoint) => (
        <li className="room-action-checkpoint" key={`checkpoint:${checkpoint.key}`}>
          <span aria-hidden="true" className="hub-roster-rank">
            ·
          </span>
          <strong>{checkpoint.label}</strong>
        </li>
      ));
  const renderRow = (row: (typeof actions.rows)[number]) => {
    const proposals = row.proposalKeys.flatMap((key) => {
      const proposal = actions.proposals.find((candidate) => candidate.key === key);
      return proposal === undefined ? [] : [proposal];
    });
    const removable = proposals.find((proposal) => proposal.kind === 'remove');
    const movable = proposals.filter(
      (proposal) =>
        proposal.kind === 'move' &&
        row.rank !== null &&
        (proposal.toIndex === row.rank - 2 || proposal.toIndex === row.rank),
    );
    const insertions = proposals.filter((proposal) => proposal.kind === 'insert');
    const rewardPayload = row.rewardPayload;
    const traitControl = row.traitOffer;
    const wheel = row.wheelPick;
    const canDrag =
      row.rank !== null &&
      rankedRows.length > 1 &&
      proposals.some((proposal) => proposal.kind === 'move');
    const dropState = (target: RankedPrefixDropTarget) => {
      if (!sameRoomActionDropTarget(pointerDrag?.target, target)) return undefined;
      return proposalForDrop(pointerDrag!.actionKey, target)?.structurallyAuthorable === true
        ? 'available'
        : 'unavailable';
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
          <div className="owner-markers">
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
          <div className="hub-rank-actions">
            {row.rank === null ? (
              <label className="field-control">
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
                {movable.map((proposal) => (
                  <button
                    aria-label={`Move ${row.label} ${
                      row.rank !== null && proposal.toIndex === row.rank - 2 ? 'earlier' : 'later'
                    }`}
                    className="quiet-action hub-rank-action"
                    disabled={!proposal.structurallyAuthorable}
                    key={proposal.key}
                    onClick={() => apply(proposal.key)}
                    type="button"
                  >
                    <span aria-hidden="true">
                      {row.rank !== null && proposal.toIndex === row.rank - 2 ? '↑' : '↓'}
                    </span>
                  </button>
                ))}
                {removable === undefined ? null : (
                  <button
                    className="quiet-action action-compact"
                    disabled={!removable.structurallyAuthorable}
                    onClick={() => apply(removable.key)}
                    type="button"
                  >
                    Remove
                  </button>
                )}
              </>
            )}
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
          {traitControl === undefined ? null : (
            <div className="acquisition-entry-resolution">
              <TraitOfferLauncher control={traitControl} interactions={interactions} />
            </div>
          )}
          {rewardPayload === undefined ? null : (
            <div
              className="acquisition-entry-resolution"
              id={semanticOwnerControlElementId(rewardPayload.control.owner.address)}
              tabIndex={-1}
            >
              <RewardControlEditor
                control={rewardPayload.control}
                idPrefix={`room-action-${rewardPayload.control.marker.focusKey}`}
                interactions={interactions}
                showOffer={rewardPayload.showOffer}
              />
            </div>
          )}
        </li>
        {row.rank === null ? null : checkpointRows(row.rank)}
      </Fragment>
    );
  };
  return (
    <section aria-label="Room Actions" className="room-actions-workbench">
      <header className="local-reward-heading">
        <div className="owner-markers">
          <h4>Room Actions</h4>
          <SemanticOwnerMarker address={actions.owner} />
        </div>
      </header>
      <p aria-live="polite" className="visually-hidden">
        {announcement}
      </p>
      <ol
        aria-label="Ranked room action order"
        className="room-action-list"
        onLostPointerCapture={(event) => clearPointerDrag(event.pointerId)}
        onPointerCancel={(event) => clearPointerDrag(event.pointerId)}
        onPointerMove={updatePointerDrag}
        onPointerUp={completePointerDrag}
        ref={board}
      >
        {checkpointRows(0)}
        {rankedRows.map(renderRow)}
        {unrankedRows.length === 0 ? null : (
          <li aria-label="Room-action order boundary" className="hub-visit-boundary">
            <span>Room action order ends here</span>
            <span>{unrankedRows.length} not ordered</span>
          </li>
        )}
        {unrankedRows.map(renderRow)}
      </ol>
      {pointerDrag === undefined ? null : (
        <div
          aria-hidden="true"
          className="hub-roster-drag-preview"
          style={{
            transform: `translate3d(${pointerDrag.x + 14}px, ${pointerDrag.y + 14}px, 0)`,
          }}
        >
          <span>⠿</span>
          {actions.rows.find((row) => row.key === pointerDrag.actionKey)?.label ?? 'Room action'}
        </div>
      )}
    </section>
  );
}

/** The selected Midshop owns only the available spawn affordance. */
function ZagreusSpawnWorkbench({
  control,
  interactions,
}: {
  readonly control: WorkspaceZagreusSpawnControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.zagreusSpawns,
    workspaceInteractionKey(control.owner),
  );
  return (
    <section aria-label="Zagreus contract availability" className="zagreus-contract-workbench">
      <div className="local-reward-heading">
        <div className="owner-markers">
          <h4>Zagreus contract</h4>
          <SemanticOwnerMarker address={control.owner} />
        </div>
      </div>
      <button
        className="quiet-action action-compact"
        data-command="AddZagreusContract"
        onClick={() => executeIntent(interaction.spawnIntent())}
        type="button"
      >
        Add Zagreus contract
      </button>
    </section>
  );
}

/** A selected source exposes only the declared natural-Chaos creation command. */
function NaturalChaosSpawnWorkbench({
  control,
  interactions,
}: {
  readonly control: WorkspaceNaturalChaosSpawnControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.naturalChaosSpawns,
    workspaceInteractionKey(control.owner),
  );
  return (
    <section aria-label="Natural Chaos availability" className="zagreus-contract-workbench">
      <div className="local-reward-heading">
        <div className="owner-markers">
          <h4>Chaos gate</h4>
          <SemanticOwnerMarker address={control.owner} />
        </div>
      </div>
      <button
        className="quiet-action action-compact"
        data-command="AddNaturalChaos"
        onClick={() => executeIntent(interaction.spawnIntent())}
        type="button"
      >
        Add Chaos gate
      </button>
    </section>
  );
}

/**
 * The workspace has already established this is an authored Anomaly and has
 * supplied its closed declaration map domain. These controls intentionally do
 * not ask React to re-evaluate replacement eligibility or reward legality.
 */
function AnomalyMapControl({ room }: { readonly room: WorkspaceRoomSummary }) {
  const dispatch = useAppDispatch();
  const anomaly = room.anomaly;
  if (anomaly === undefined) return null;
  return (
    <label className="field-control" htmlFor={`anomaly-map-${room.occurrenceId}`}>
      <span>Map</span>
      <select
        id={`anomaly-map-${room.occurrenceId}`}
        onChange={(event) =>
          dispatch(
            authoredProjectCommandDispatched({
              gameName: event.target.value,
              kind: 'ReplaceAnomalyMap',
              occurrence: room.address,
            }),
          )
        }
        value={room.gameName}
      >
        {anomaly.mapChoices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AnomalyClearedControl({ room }: { readonly room: WorkspaceRoomSummary }) {
  const dispatch = useAppDispatch();
  const anomaly = room.anomaly;
  if (anomaly === undefined) return null;
  return (
    <label className="anomaly-outcome-control">
      <input
        checked={anomaly.success}
        onChange={(event) =>
          dispatch(
            authoredProjectCommandDispatched({
              kind: 'ReplaceAnomalySuccess',
              occurrence: room.address,
              success: event.target.checked,
            }),
          )
        }
        type="checkbox"
      />
      <span>Cleared</span>
    </label>
  );
}

function RevertAnomalyAction({ room }: { readonly room: WorkspaceRoomSummary }) {
  const dispatch = useAppDispatch();
  const anomaly = room.anomaly;
  if (anomaly === undefined) return null;
  return (
    <div className="anomaly-revert-action">
      <button
        className="danger-action action-compact"
        data-command="RevertAnomaly"
        onClick={() =>
          dispatch(
            authoredProjectCommandDispatched({
              kind: 'RevertAnomaly',
              occurrence: room.address,
            }),
          )
        }
        type="button"
      >
        Restore {anomaly.rememberedRoomLabel}
      </button>
    </div>
  );
}

/** Identity controls stay on the parent door that owns the takeover transition. */
export function AnomalyIdentityControls({ room }: { readonly room: WorkspaceRoomSummary }) {
  if (room.anomaly === undefined) return null;
  return (
    <div className="anomaly-identity-controls">
      <AnomalyMapControl room={room} />
      <RevertAnomalyAction room={room} />
    </div>
  );
}

/**
 * Local disclosure state is intentionally UI-only. Exact semantic focus opens
 * the containing surface without adding navigation or expansion to history.
 */
function RoomCustomizationDisclosure({
  children,
  initiallyOpen,
  room,
}: {
  readonly children: ReactNode;
  readonly initiallyOpen: boolean;
  readonly room: WorkspaceRoomSummary;
}) {
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  const { semanticNavigationRevision, focusedSemanticOwner } = useAppSelector(
    (state) => state.editorSession,
  );
  const focusedOwnerKey =
    focusedSemanticOwner === null ? undefined : semanticAddressKey(focusedSemanticOwner);
  const focusedLocalOwner =
    focusedOwnerKey !== undefined &&
    room.customizationMarkers.some((marker) => marker.focusKey === focusedOwnerKey);

  useLayoutEffect(() => {
    if (disclosureRef.current !== null) disclosureRef.current.open = initiallyOpen;
  }, [initiallyOpen]);

  useLayoutEffect(() => {
    if (focusedLocalOwner && disclosureRef.current !== null) disclosureRef.current.open = true;
  }, [semanticNavigationRevision, focusedLocalOwner, focusedOwnerKey]);

  return (
    <details aria-label="Customize" className="room-customization" ref={disclosureRef}>
      <summary>Customize</summary>
      <div className="room-customization-content">{children}</div>
    </details>
  );
}

/**
 * Renders the complete reward-bearing state for one room offer without
 * introducing a second room card. Ordinary decisions use this directly so
 * room selection, reward selection, and picked state remain one surface.
 */
export function RoomOfferEditor({
  idPrefix,
  incomingDoor,
  interactions,
  presentation,
  room,
}: {
  readonly idPrefix: string;
  readonly incomingDoor?: WorkspaceDoorContract;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly presentation: 'doorTarget' | 'full' | 'hubRoomLocal';
  readonly room: WorkspaceRoomSummary;
}) {
  const state = room.roomLocal;
  const showMainReward = presentation === 'full';
  const visibleIncomingRewards =
    presentation === 'doorTarget' && incomingDoor?.rewardPreview.kind === 'visible'
      ? incomingDoor.rewardPreview.rewards
      : Object.freeze([]);

  return (
    <>
      {presentation === 'hubRoomLocal' ? (
        <HubRewardContext {...(incomingDoor === undefined ? {} : { door: incomingDoor })} />
      ) : null}
      {visibleIncomingRewards.length === 1 ? (
        <p className="fixed-room-state">
          Incoming door reward: {visibleIncomingRewards[0]!.summary}
        </p>
      ) : null}
      {visibleIncomingRewards.length > 1 ? (
        <dl className="fields-batch-summary fixed-room-state">
          {visibleIncomingRewards.map((reward) => (
            <div key={reward.key}>
              <dt>{reward.label}</dt>
              <dd>{reward.summary}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {showMainReward && state.kind === 'none' ? (
        <p className="fixed-room-state">No room reward.</p>
      ) : null}
      {showMainReward && state.kind === 'fixed' ? (
        <div className="room-state-with-marker">
          <SemanticOwnerMarker address={state.marker.address} />
          {state.control === undefined ? (
            <p className="fixed-room-state">Fixed reward: {state.summary}</p>
          ) : (
            <RewardControlEditor
              control={state.control}
              idPrefix={idPrefix}
              interactions={interactions}
              showAcquisitionChildren={false}
            />
          )}
        </div>
      ) : null}
      {showMainReward && state.kind === 'incomingReward' ? (
        <div className="room-state-with-marker">
          <SemanticOwnerMarker address={state.control.marker.address} />
          {state.clockworkReward === 'goal' ? (
            <p className="fixed-room-state">Clockwork Goal</p>
          ) : (
            <>
              {state.clockworkReward === 'nonGoal' ? (
                <p className="fixed-room-state">Clockwork NonGoal</p>
              ) : null}
              <RewardControlEditor
                control={state.control}
                idPrefix={idPrefix}
                interactions={interactions}
                showAcquisitionChildren={false}
              />
            </>
          )}
        </div>
      ) : null}
      <AnomalyClearedControl room={room} />
      {state.kind === 'shop' && !state.materialized ? (
        <p className="fixed-room-state">Shop inventory appears when you select this room.</p>
      ) : null}
      {state.kind === 'shop' && state.materialized ? (
        <ShopWorkbench interactions={interactions} occurrence={room.address} room={state} />
      ) : null}
      {state.kind === 'fields' ? <FieldsWorkbench room={state} /> : null}
      {state.kind === 'ship' ? (
        <ShipWorkbench interactions={interactions} occurrence={room.address} room={state} />
      ) : null}
      <RoomActionsWorkbench interactions={interactions} room={room} />
      {room.hasRoomLocalCustomization ? (
        <RoomCustomizationDisclosure
          initiallyOpen={presentation === 'hubRoomLocal'}
          key={`${presentation}:${semanticAddressKey(room.address)}`}
          room={room}
        >
          <EncounterWorkbench
            idPrefix={idPrefix}
            interactions={interactions}
            phases={room.encounterPhases}
          />
          {state.kind === 'shop' && room.zagreusSpawn?.materialized === true ? (
            <ZagreusSpawnWorkbench control={room.zagreusSpawn} interactions={interactions} />
          ) : null}
          {room.naturalChaosSpawn === undefined ? null : (
            <NaturalChaosSpawnWorkbench
              control={room.naturalChaosSpawn}
              interactions={interactions}
            />
          )}
        </RoomCustomizationDisclosure>
      ) : null}
    </>
  );
}

/** A room-local editor that consumes the structured workspace only. */
export function OccurrenceWorkbench({
  incomingDoor,
  interactions,
  localVisit,
  presentation,
  room,
  runState,
}: OccurrenceWorkbenchProps) {
  const idPrefix = `occurrence-${room.occurrenceId}`;

  return (
    <article className="room-card biome-occurrence-workbench">
      <header className="room-card-heading">
        <div>
          <p className="card-kicker">{room.entered ? 'Entered room' : 'Offered room'}</p>
          <h3>{room.label}</h3>
        </div>
        <div className="owner-markers">
          <span className="room-kind">{room.kind}</span>
          <SemanticOwnerMarker address={room.address} />
          {runState === undefined ? null : <RunStateLauncher launcher={runState} />}
        </div>
      </header>
      <RoomOfferEditor
        idPrefix={idPrefix}
        {...(incomingDoor === undefined ? {} : { incomingDoor })}
        interactions={interactions}
        presentation={presentation}
        room={room}
      />
      {localVisit === undefined ? null : (
        <LocalVisitWorkbench interactions={interactions} localVisit={localVisit} />
      )}
    </article>
  );
}

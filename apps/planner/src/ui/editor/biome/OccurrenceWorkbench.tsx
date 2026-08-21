import type { OccurrenceAddress } from '@run-planner/engine/authored-project';
import {
  Fragment,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
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
  type WorkspaceRoomActions,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomLifecycleTimeline,
  type WorkspaceRoomLifecycleTimelineEntry,
  type WorkspaceRoomFeature,
  type WorkspaceRoomTab,
  type WorkspaceRewardWheelDescriptor,
  type WorkspaceShipPhasePresentation,
  type WorkspaceNaturalChaosExitControl,
  type WorkspaceRunStateLauncher,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
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
  readonly room: WorkspaceRoomSummary;
  readonly runState?: WorkspaceRunStateLauncher;
  readonly initialTab?: WorkspaceRoomTab;
  readonly doors?: ReactNode;
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
    <label
      className="field-control field-control-inline"
      htmlFor={`chaos-map-${control.door.room.occurrenceId}`}
    >
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
        layout="inline"
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

function FieldsWorkbench({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>;
}) {
  const dispatch = useAppDispatch();
  return (
    <section aria-label="Fields setup" className="fields-room-editor">
      <div className="local-reward-heading">
        <h4>Fields setup</h4>
      </div>
      <label className="field-control field-control-inline">
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
      <div className="fields-reward-identities">
        <div className="local-reward-heading">
          <h5>Cage reward identities</h5>
        </div>
        {room.cages.map((cage) => (
          <div className="fields-reward-identity" key={cage.key}>
            <RewardControlEditor
              control={cage.control}
              idPrefix={`fields-${room.owner.occurrenceId}-cage-${cage.key}`}
              interactions={interactions}
              label={cage.label}
              showAcquisitionChildren={false}
            />
          </div>
        ))}
        <div className="local-reward-heading">
          <h5>Optional reward identities</h5>
        </div>
        {room.optionalRewards.map((reward) => (
          <div className="fields-reward-identity" key={reward.key}>
            <RewardControlEditor
              control={reward.control}
              idPrefix={`fields-${room.owner.occurrenceId}-optional-${reward.key}`}
              interactions={interactions}
              label={reward.label}
              showAcquisitionChildren={false}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function RewardWheelWorkbench({
  interactions,
  occurrence,
  wheel,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly occurrence: OccurrenceAddress;
  readonly wheel: WorkspaceRewardWheelDescriptor;
}) {
  const dispatch = useAppDispatch();
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
    <section aria-label={wheel.label} className="reward-wheel">
      <div className="local-reward-heading">
        <div className="owner-markers">
          <h5>{wheel.label}</h5>
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
                  <h6>{offer.label}</h6>
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
  if (!room.materialized) {
    return (
      <section aria-label="Shop inventory and conditions" className="shop-editor">
        <div className="local-reward-heading">
          <h4>Shop inventory and conditions</h4>
        </div>
        <p className="fixed-room-state">Shop inventory appears when you select this room.</p>
      </section>
    );
  }
  return (
    <section aria-label="Shop inventory and conditions" className="shop-editor">
      <div className="local-reward-heading">
        <h4>Shop inventory and conditions</h4>
      </div>
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
                      <label className="purchase-control">
                        <input
                          aria-label={`Purchased ${offer.label}`}
                          checked={offer.participation.purchased}
                          onChange={(event) =>
                            executeIntent(
                              requireWorkspaceInteraction(
                                interactions.shopPurchaseParticipations,
                                offer.participation.interactionKey,
                              ).intentFor(event.target.checked),
                            )
                          }
                          type="checkbox"
                        />
                        Purchased
                      </label>
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
    </section>
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

function lifecycleBoundaryLabel(boundary: WorkspaceRoomLifecycleBoundary): string {
  switch (boundary.kind) {
    case 'roomEntered':
      return 'Room entered';
    case 'encounterStart':
      return 'Start encounter';
    case 'encounterEnd':
      return 'End encounter';
    case 'nextPhase':
      return 'Start next phase';
    case 'outgoingGeneration':
      return 'Outgoing generation';
    case 'cleanup':
      return 'Cleanup';
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

function LifecycleBoundaryRow({ boundary }: { readonly boundary: WorkspaceRoomLifecycleBoundary }) {
  return (
    <li
      aria-label={lifecycleBoundaryLabel(boundary)}
      className="room-action-lifecycle-boundary"
      data-lifecycle-boundary={boundary.key}
    >
      <span aria-hidden="true" className="hub-roster-rank">
        ·
      </span>
      <strong>{lifecycleBoundaryLabel(boundary)}</strong>
    </li>
  );
}

function timelineBoundaryEntries(
  timeline: WorkspaceRoomLifecycleTimeline,
  include: (boundary: WorkspaceRoomLifecycleBoundary) => boolean,
): readonly Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'boundary' }>[] {
  return timeline.entries.filter(
    (entry): entry is Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'boundary' }> =>
      entry.kind === 'boundary' && include(entry.boundary),
  );
}

function RoomActionsWorkbench({
  actions,
  encounterPhases,
  idPrefix,
  interactions,
  ship,
}: {
  readonly actions?: WorkspaceRoomActions;
  readonly encounterPhases?: readonly WorkspaceEncounterPhase[];
  readonly idPrefix?: string;
  readonly interactions: WorkspaceInteractionCatalog;
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
  if (actions === undefined && ship === undefined) return null;
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
    target: RankedPrefixDropTarget,
  ): WorkspaceRoomActions['proposals'][number] | undefined => {
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
      const passive = encounterPhases?.find((phase) => phase.address.phaseKey === 'Passive');
      return passive === undefined || idPrefix === undefined ? null : (
        <EncounterPhaseControl idPrefix={idPrefix} interactions={interactions} phase={passive} />
      );
    }
    if (boundary.kind === 'encounterStart') {
      const phase = encounterByPhase.get(boundary.phaseKey);
      return phase === undefined || idPrefix === undefined ? null : (
        <EncounterPhaseControl idPrefix={idPrefix} interactions={interactions} phase={phase} />
      );
    }
    if (boundary.kind === 'nextPhase' && ship !== undefined) {
      const phase = ship.phases.find((candidate) => candidate.wheel?.key === boundary.wheelKey);
      return phase?.wheel === undefined ? null : (
        <RewardWheelWorkbench
          interactions={interactions}
          occurrence={ship.occurrence}
          wheel={phase.wheel}
        />
      );
    }
    return null;
  };
  const renderBoundary = (
    entry: Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'boundary' }>,
  ) => (
    <Fragment key={entry.boundary.key}>
      <LifecycleBoundaryRow boundary={entry.boundary} />
      {boundarySupplement(entry.boundary)}
    </Fragment>
  );
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
                {row.stale && row.shopParticipation !== undefined ? (
                  <button
                    className="quiet-action action-compact"
                    onClick={() =>
                      executeIntent(
                        requireWorkspaceInteraction(
                          interactions.shopPurchaseParticipations,
                          row.shopParticipation!.interactionKey,
                        ).intentFor(false),
                      )
                    }
                    type="button"
                  >
                    Unmark Purchased
                  </button>
                ) : null}
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
              <SemanticOwnerMarker address={rewardPayload.control.marker.address} />
              <RewardControlEditor
                control={rewardPayload.control}
                idPrefix={`room-action-${rewardPayload.control.marker.focusKey}`}
                interactions={interactions}
                showAcquisitionChildren
                showOffer={rewardPayload.showOffer}
              />
            </div>
          )}
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
          aria-label={actions === undefined ? undefined : 'Room Actions'}
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
                const phaseRankedRows = phase.actionRows.filter((row) => row.rank !== null);
                const phaseUnrankedRows = phase.actionRows.filter((row) => row.rank === null);
                const phaseIndex = ship.phases.findIndex(
                  (candidate) => candidate.key === phase.key,
                );
                const phaseBoundaryEntries =
                  actions === undefined
                    ? []
                    : timelineBoundaryEntries(actions.timeline, (boundary) => {
                        switch (boundary.kind) {
                          case 'roomEntered':
                            return phaseIndex === 0;
                          case 'encounterStart':
                          case 'encounterEnd':
                            return boundary.phaseKey === phase.key;
                          case 'nextPhase':
                            return phase.wheel?.key === boundary.wheelKey;
                          case 'outgoingGeneration':
                          case 'cleanup':
                            return phaseIndex === ship.phases.length - 1;
                        }
                      });
                const phaseBoundariesAt = (rank: number, placement: 'before' | 'after') =>
                  phaseBoundaryEntries
                    .filter((entry) => entry.rank === rank && entry.placement === placement)
                    .map(renderBoundary);
                const matchedCheckpointRanks = new Set(
                  phaseRankedRows.flatMap((row) => (row.rank === null ? [] : [row.rank])),
                );
                const standaloneBoundariesBetween = (lowerRank: number, upperRank: number) =>
                  phaseBoundaryEntries
                    .filter(
                      (entry) =>
                        !matchedCheckpointRanks.has(entry.rank) &&
                        entry.rank > lowerRank &&
                        entry.rank < upperRank,
                    )
                    .map(renderBoundary);
                const trailingCheckpoints = phase.checkpoints.filter(
                  (checkpoint) =>
                    actions?.timeline.boundaries.some(
                      (boundary) => lifecycleBoundaryCheckpointKey(boundary) === checkpoint.key,
                    ) !== true &&
                    checkpoint.afterRank !== 0 &&
                    !matchedCheckpointRanks.has(checkpoint.afterRank),
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
                    phaseBoundaryEntries.length === 0 ? null : (
                      <>
                        <div className="local-reward-heading ship-phase-actions-heading">
                          <h5>Actions</h5>
                        </div>
                        <ol
                          aria-label={`${phase.label} room action order`}
                          className="room-action-list"
                        >
                          {phaseRankedRows.length === 0
                            ? phaseBoundaryEntries.map(renderBoundary)
                            : standaloneBoundariesBetween(
                                Number.NEGATIVE_INFINITY,
                                phaseRankedRows[0]?.rank ?? Number.POSITIVE_INFINITY,
                              )}
                          {checkpointRows(0, phase.checkpoints)}
                          {phaseRankedRows.map((row, index) => (
                            <Fragment key={row.key}>
                              {index === 0
                                ? null
                                : standaloneBoundariesBetween(
                                    phaseRankedRows[index - 1]?.rank ?? Number.NEGATIVE_INFINITY,
                                    row.rank ?? Number.POSITIVE_INFINITY,
                                  )}
                              {phaseBoundariesAt(row.rank!, 'before')}
                              {renderRow(row, phase.checkpoints)}
                              {phaseBoundariesAt(row.rank!, 'after')}
                            </Fragment>
                          ))}
                          {phaseRankedRows.length === 0
                            ? null
                            : standaloneBoundariesBetween(
                                phaseRankedRows.at(-1)?.rank ?? Number.NEGATIVE_INFINITY,
                                Number.POSITIVE_INFINITY,
                              )}
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
                          {phaseUnrankedRows.length === 0 ? null : (
                            <li
                              aria-label="Room-action order boundary"
                              className="hub-visit-boundary"
                            >
                              <span>Room action order ends here</span>
                              <span>{phaseUnrankedRows.length} not ordered</span>
                            </li>
                          )}
                          {phaseUnrankedRows.map((row) => renderRow(row, phase.checkpoints))}
                        </ol>
                      </>
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
    const row = actionByKey.get(entry.actionKey);
    return row === undefined ? [] : [renderRow(row, [])];
  });
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
        {...pointerHandlers}
        ref={(element) => {
          board.current = element;
        }}
      >
        {timelineRows}
        {rankedRows.length === 0 ? checkpointRows(0) : null}
      </ol>
      {actions.repairRows.length === 0 ? null : (
        <section aria-label="Room action repairs" className="room-action-repairs">
          <div className="local-reward-heading">
            <h5>Action repairs</h5>
          </div>
          <p className="fixed-room-state">
            These retained actions are not part of the active lifecycle order. Restore or remove
            them explicitly.
          </p>
          <ol aria-label="Room action repairs" className="room-action-list">
            {actions.repairRows.map((row) => renderRow(row))}
          </ol>
        </section>
      )}
      {dragPreview}
    </section>
  );
}

/** The selected Midshop owns only the available spawn affordance. */
function ZagreusSpawnWorkbench({
  feature,
  interactions,
}: {
  readonly feature: Extract<WorkspaceRoomFeature, { readonly kind: 'zagreusContract' }>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const owner = feature.action === 'add' ? feature.control.owner : feature.owner;
  return (
    <section aria-label="Zagreus contract availability" className="zagreus-contract-workbench">
      <div className="owner-markers">
        {feature.action === 'add' ? (
          <button
            className="quiet-action action-compact"
            data-command="AddZagreusContract"
            onClick={() =>
              executeIntent(
                requireWorkspaceInteraction(
                  interactions.zagreusSpawns,
                  workspaceInteractionKey(owner),
                ).spawnIntent(),
              )
            }
            type="button"
          >
            Add Zagreus contract
          </button>
        ) : (
          <button
            className="danger-action action-compact"
            data-command="RemoveZagreusContract"
            onClick={() =>
              executeIntent(
                requireWorkspaceInteraction(
                  interactions.zagreusContracts,
                  workspaceInteractionKey(owner),
                ).removeIntent,
              )
            }
            type="button"
          >
            Remove Zagreus contract
          </button>
        )}
        {feature.action === 'add' ? <SemanticOwnerMarker address={owner} /> : null}
      </div>
    </section>
  );
}

/** A selected source exposes only the declared natural-Chaos creation command. */
function NaturalChaosSpawnWorkbench({
  feature,
  interactions,
}: {
  readonly feature: Extract<WorkspaceRoomFeature, { readonly kind: 'naturalChaos' }>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const owner = feature.action === 'add' ? feature.control.owner : feature.owner;
  return (
    <section aria-label="Natural Chaos availability" className="zagreus-contract-workbench">
      <div className="owner-markers">
        {feature.action === 'add' ? (
          <button
            className="quiet-action action-compact"
            data-command="AddNaturalChaos"
            onClick={() =>
              executeIntent(
                requireWorkspaceInteraction(
                  interactions.naturalChaosSpawns,
                  workspaceInteractionKey(owner),
                ).spawnIntent(),
              )
            }
            type="button"
          >
            Add Chaos gate
          </button>
        ) : (
          <button
            className="danger-action action-compact"
            data-command="RemoveNaturalChaos"
            onClick={() =>
              executeIntent(
                requireWorkspaceInteraction(
                  interactions.naturalChaosExits,
                  workspaceInteractionKey(owner),
                ).removeIntent,
              )
            }
            type="button"
          >
            Remove Chaos gate
          </button>
        )}
        {feature.action === 'add' ? <SemanticOwnerMarker address={owner} /> : null}
      </div>
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
    <label
      className="field-control field-control-inline"
      htmlFor={`anomaly-map-${room.occurrenceId}`}
    >
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

function RoomFeaturesWorkbench({
  features,
  interactions,
}: {
  readonly features: readonly WorkspaceRoomFeature[];
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  if (features.length === 0) return null;
  return (
    <section aria-label="Room features" className="room-features-workbench">
      <div className="local-reward-heading">
        <h4>Room features</h4>
      </div>
      {features.map((feature) => {
        switch (feature.kind) {
          case 'zagreusContract':
            return (
              <ZagreusSpawnWorkbench
                feature={feature}
                interactions={interactions}
                key={workspaceInteractionKey(
                  feature.action === 'add' ? feature.control.owner : feature.owner,
                )}
              />
            );
          case 'naturalChaos':
            return (
              <NaturalChaosSpawnWorkbench
                feature={feature}
                interactions={interactions}
                key={workspaceInteractionKey(
                  feature.action === 'add' ? feature.control.owner : feature.owner,
                )}
              />
            );
        }
      })}
    </section>
  );
}

function ShipCombatPhaseCountWorkbench({
  occurrence,
  interactions,
}: {
  readonly occurrence: OccurrenceAddress;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const dispatch = useAppDispatch();
  const interaction = requireWorkspaceInteraction(
    interactions.shipCombatPhaseCounts,
    workspaceInteractionKey(occurrence),
  );
  return (
    <section aria-label="Room overview" className="ship-combat-editor">
      <div className="local-reward-heading">
        <h4>Combat phases</h4>
      </div>
      <CandidateSelect
        id={`room-${occurrence.occurrenceId}-combat-phase-count`}
        interaction={interaction}
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
    </section>
  );
}

function DirectRoomWorkbench({
  idPrefix,
  interactions,
  localVisit,
  room,
  view,
  shipPhaseKey,
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit?: WorkspaceLocalVisitDecision;
  readonly room: WorkspaceRoomSummary;
  readonly view: 'overview' | 'actions';
  readonly shipPhaseKey?: string;
}) {
  const workbench = room.workbench;
  switch (workbench.kind) {
    case 'standard':
      return (
        <>
          {view === 'overview' ? (
            <>
              {localVisit === undefined ? null : (
                <LocalVisitWorkbench interactions={interactions} localVisit={localVisit} />
              )}
              <RoomFeaturesWorkbench features={workbench.features} interactions={interactions} />
            </>
          ) : (
            <RoomActionsWorkbench
              {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
              encounterPhases={workbench.encounterPhases}
              idPrefix={idPrefix}
              interactions={interactions}
            />
          )}
        </>
      );
    case 'fields':
      return (
        <>
          {view === 'overview' ? (
            <>
              <FieldsWorkbench interactions={interactions} room={workbench.fields} />
              {localVisit === undefined ? null : (
                <LocalVisitWorkbench interactions={interactions} localVisit={localVisit} />
              )}
              <RoomFeaturesWorkbench features={workbench.features} interactions={interactions} />
            </>
          ) : (
            <RoomActionsWorkbench
              {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
              encounterPhases={workbench.encounterPhases}
              idPrefix={idPrefix}
              interactions={interactions}
            />
          )}
        </>
      );
    case 'shop':
      return (
        <>
          {view === 'overview' ? (
            <>
              <ShopWorkbench
                interactions={interactions}
                occurrence={room.address}
                room={workbench.shop}
              />
              {localVisit === undefined ? null : (
                <LocalVisitWorkbench interactions={interactions} localVisit={localVisit} />
              )}
              <RoomFeaturesWorkbench features={workbench.features} interactions={interactions} />
            </>
          ) : (
            <RoomActionsWorkbench
              {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
              idPrefix={idPrefix}
              interactions={interactions}
            />
          )}
        </>
      );
    case 'ship':
      return (
        <>
          {view === 'overview' ? (
            <>
              <ShipCombatPhaseCountWorkbench
                occurrence={room.address}
                interactions={interactions}
              />
              <RoomFeaturesWorkbench features={workbench.features} interactions={interactions} />
            </>
          ) : (
            <RoomActionsWorkbench
              {...(workbench.roomActions === undefined ? {} : { actions: workbench.roomActions })}
              encounterPhases={room.encounterPhases}
              idPrefix={idPrefix}
              interactions={interactions}
              ship={{
                occurrence: room.address,
                phases: workbench.phases,
                repairRows: workbench.repairRows,
                ...(shipPhaseKey === undefined ? {} : { phaseKey: shipPhaseKey }),
              }}
            />
          )}
        </>
      );
  }
}

function IncomingRewardOverview({
  incomingDoor,
}: {
  readonly incomingDoor: WorkspaceDoorContract | undefined;
}) {
  if (incomingDoor === undefined) return null;
  const preview = incomingDoor.rewardPreview;
  const label =
    preview.kind === 'visible' && preview.rewards.length > 1
      ? 'Incoming Rewards'
      : 'Incoming Reward';
  const summary =
    preview.kind === 'hidden'
      ? 'Hidden'
      : preview.kind === 'none'
        ? 'None'
        : preview.rewards.length === 0
          ? 'None'
          : preview.rewards.map((reward) => reward.summary).join(', ');
  return (
    <section aria-label="Incoming reward" className="room-overview-incoming-reward">
      <span className="room-overview-incoming-label">{label}</span>
      <strong>{summary}</strong>
    </section>
  );
}

/** A room-local editor that consumes the structured workspace only. */
export function OccurrenceWorkbench({
  doors,
  incomingDoor,
  initialTab,
  interactions,
  localVisit,
  room,
  runState,
}: OccurrenceWorkbenchProps) {
  const requestedTab = initialTab ?? 'overview';
  const roomIdentity = workspaceInteractionKey(room.address);
  const [tabState, setTabState] = useState({
    active: requestedTab,
    roomIdentity,
    requested: requestedTab,
  });
  const activeTab =
    tabState.roomIdentity === roomIdentity && tabState.requested === requestedTab
      ? tabState.active
      : requestedTab;
  const setActiveTab = (tab: WorkspaceRoomTab): void =>
    setTabState({ active: tab, roomIdentity, requested: requestedTab });
  const idPrefix = `occurrence-${room.occurrenceId}`;
  const tabId = (tab: WorkspaceRoomTab): string => `${idPrefix}-tab-${tab}`;
  const panelId = `${idPrefix}-panel`;
  const tabRefs = useRef<Partial<Record<WorkspaceRoomTab, HTMLButtonElement | null>>>({});
  const tabOrder: WorkspaceRoomTab[] = [
    'overview',
    ...(room.workbench.kind === 'ship'
      ? room.workbench.phases.map((_phase, index) =>
          index === 0
            ? ('shipIntroActions' as const)
            : index === 1
              ? ('shipCombat1Actions' as const)
              : ('shipCombat2Actions' as const),
        )
      : ['actions' as const]),
    ...(room.workbench.kind === 'ship' && room.workbench.repairRows.length > 0
      ? (['shipInactiveRepair'] as const)
      : []),
    'doors',
  ];
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, tab: WorkspaceRoomTab) => {
    const currentIndex = tabOrder.indexOf(tab);
    if (currentIndex < 0) return;
    let nextIndex: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabOrder.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabOrder.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextTab = tabOrder[nextIndex];
    if (nextTab === undefined) return;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };
  const tabButton = (tab: WorkspaceRoomTab, label: string, key?: string) => (
    <button
      aria-controls={panelId}
      aria-selected={activeTab === tab}
      className="room-workbench-tab"
      id={tabId(tab)}
      key={key ?? tab}
      onClick={() => setActiveTab(tab)}
      onKeyDown={(event) => onTabKeyDown(event, tab)}
      ref={(element) => {
        tabRefs.current[tab] = element;
      }}
      role="tab"
      tabIndex={activeTab === tab ? 0 : -1}
      type="button"
    >
      {label}
    </button>
  );
  const heading = `Entering ${room.label}`;
  const tabRunState = room.runStateByTab[activeTab];

  return (
    <article className="room-card biome-occurrence-workbench">
      <header className="room-card-heading">
        <h3 aria-label={heading}>{heading}</h3>
        <div className="owner-markers">
          <SemanticOwnerMarker address={room.address} />
          {runState === undefined ? null : <RunStateLauncher launcher={runState} />}
        </div>
      </header>
      <nav aria-label="Room workbench" className="room-workbench-tabs" role="tablist">
        {tabButton('overview', 'Room Overview')}
        {room.workbench.kind === 'ship'
          ? room.workbench.phases.map((phase, index) => {
              const tab: WorkspaceRoomTab =
                index === 0
                  ? 'shipIntroActions'
                  : index === 1
                    ? 'shipCombat1Actions'
                    : 'shipCombat2Actions';
              return tabButton(tab, `${phase.label} Actions`, phase.key);
            })
          : tabButton('actions', 'Room Actions')}
        {room.workbench.kind === 'ship' && room.workbench.repairRows.length > 0
          ? tabButton('shipInactiveRepair', 'Inactive Actions')
          : null}
        {tabButton('doors', 'Room Doors')}
      </nav>
      <section
        aria-label={activeTab === 'doors' ? 'Room Doors' : 'Room workbench panel'}
        aria-labelledby={tabId(activeTab)}
        className="room-workbench-panel"
        id={panelId}
        role="tabpanel"
      >
        {tabRunState === undefined ? null : (
          <div className="room-tab-utility-bar">
            <RunStateLauncher launcher={tabRunState} />
          </div>
        )}
        {activeTab === 'overview' ? (
          <>
            <IncomingRewardOverview incomingDoor={incomingDoor} />
            <AnomalyClearedControl room={room} />
            <DirectRoomWorkbench
              idPrefix={idPrefix}
              interactions={interactions}
              {...(localVisit === undefined ? {} : { localVisit })}
              room={room}
              view="overview"
            />
          </>
        ) : activeTab === 'doors' ? (
          (doors ?? <p className="fixed-room-state">No outgoing doors for this room.</p>)
        ) : activeTab === 'shipInactiveRepair' && room.workbench.kind === 'ship' ? (
          <RoomActionsWorkbench
            {...(room.workbench.roomActions === undefined
              ? {}
              : { actions: room.workbench.roomActions })}
            interactions={interactions}
            ship={{
              occurrence: room.address,
              phases: [],
              repairRows: room.workbench.repairRows,
            }}
          />
        ) : room.workbench.kind === 'ship' ? (
          <DirectRoomWorkbench
            idPrefix={idPrefix}
            interactions={interactions}
            room={room}
            {...(() => {
              const shipPhaseKey =
                activeTab === 'shipIntroActions'
                  ? room.workbench.phases[0]?.key
                  : activeTab === 'shipCombat1Actions'
                    ? room.workbench.phases[1]?.key
                    : room.workbench.phases[2]?.key;
              return shipPhaseKey === undefined ? {} : { shipPhaseKey };
            })()}
            view="actions"
          />
        ) : (
          <DirectRoomWorkbench
            idPrefix={idPrefix}
            interactions={interactions}
            room={room}
            view="actions"
          />
        )}
      </section>
    </article>
  );
}

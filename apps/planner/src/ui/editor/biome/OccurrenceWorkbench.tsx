import {
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';
import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react';
import { candidateSupport, presentCandidateLabel } from '@planner/projections/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceCommandIntent,
  type WorkspaceEncounterInteraction,
  type WorkspaceEncounterPhase,
  type WorkspaceInteractionCatalog,
  type WorkspaceEphyraSideRoomDescriptor,
  type WorkspaceEphyraSideRoomGroup,
  type WorkspaceRoomSummary,
  type WorkspaceNaturalChaosSpawnControl,
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
import { ShopPurchaseControl } from '../rooms/ShopPurchaseControl';
import { CandidateSelect } from './CandidateSelect';
import { hubMainRewardPresentation } from './hubMainRewardPresentation';
import { RoomSelector } from './RoomSelector';
import { RunStateLauncher } from './RunStateSheet';

const emptyEncounterPicker: import('@planner/projections/contextualPicker').ContextualPickerModel<string> =
  Object.freeze({ sections: Object.freeze([]) });

interface OccurrenceWorkbenchProps {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly nextDecisionIntent?: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'CreateBatch' }>
  >;
  /** Hub visits retain their editable main offer on the Hub board. */
  readonly presentation: 'full' | 'hubRoomLocal';
  readonly room: WorkspaceRoomSummary;
  readonly runState?: WorkspaceRunStateLauncher;
}

function HubRewardContext({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: WorkspaceRoomSummary;
}) {
  const dispatch = useAppDispatch();
  const context = hubMainRewardPresentation(room, interactions);
  if (context === undefined) return null;

  return (
    <section aria-label="Hub reward" className="hub-reward-context">
      <span className="hub-reward-context-label">Hub reward</span>
      <span className="hub-reward-summary">{context.summary}</span>
      {context.control === undefined ? null : (
        <button
          className="quiet-action action-compact"
          onClick={() => dispatch(semanticOwnerFocused(context.marker.address))}
          type="button"
        >
          Edit Hub reward
        </button>
      )}
    </section>
  );
}

function EphyraSideRoomEntryOrderSelect({
  group,
  interactions,
  side,
}: {
  readonly group: WorkspaceEphyraSideRoomGroup;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly side: WorkspaceEphyraSideRoomDescriptor;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.sideRoomEntryOrders,
    side.entryOrder.interactionKey,
  );
  const candidates = useWorkspaceInteraction(interaction);
  const dispatch = useAppDispatch();
  const selectedIndex = side.entryOrder.options.findIndex(
    (option) => option.key === side.entryOrder.selectedKey,
  );
  if (selectedIndex < 0) {
    throw new Error(`${side.label} has no selected entry-order option`);
  }
  const selectedCandidate = candidates.result?.[selectedIndex];

  const replace = (key: string): void => {
    const optionIndex = side.entryOrder.options.findIndex((option) => option.key === key);
    const option = side.entryOrder.options[optionIndex];
    const candidateResults = candidates.result ?? candidates.activate();
    const candidate = candidateResults?.[optionIndex];
    if (option === undefined || !candidateMayBeAuthored(candidate)) return;
    dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceSideRoomEntryOrder',
        group: group.address,
        enteredSlotKeys: option.proposedEnteredSlotKeys,
      }),
    );
  };
  return (
    <label className="field-control ephyra-side-entry-order">
      <span className="visually-hidden">{side.label} visit order</span>
      <select
        aria-busy={candidates.pending || undefined}
        data-candidate-support={candidateSupport(selectedCandidate)}
        onChange={(event) => replace(event.target.value)}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        value={side.entryOrder.selectedKey}
      >
        {side.entryOrder.options.map((option, index) => {
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
        {phase.traitOffer === undefined ? null : (
          <TraitOfferLauncher control={phase.traitOffer} interactions={interactions} />
        )}
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
      {phase.traitOffer === undefined ? null : (
        <TraitOfferLauncher control={phase.traitOffer} interactions={interactions} />
      )}
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
      phase.customizable || phase.marker.findingCount > 0 || phase.traitOffer !== undefined,
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

function EphyraWorkbench({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'ephyra' }>;
}) {
  const dispatch = useAppDispatch();
  if (room.sideRooms.kind === 'withheld') return null;
  const group = room.sideRooms.group;
  return (
    <section className="ephyra-side-editor" aria-label="Ephyra side rooms">
      <header className="local-reward-heading">
        <div className="owner-markers">
          <h4>Side rooms</h4>
          <SemanticOwnerMarker address={group.address} />
        </div>
        <span className="neutral-status">
          {group.enteredSlotKeys.length} visited · {group.slots.length} possible
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
            </tr>
          </thead>
          <tbody>
            {group.slots.map((side) => {
              const generation = requireWorkspaceInteraction(
                interactions.sideRoomGenerations,
                workspaceInteractionKey(side.address),
              );
              return (
                <tr className="ephyra-side-grid-row" key={side.key}>
                  <th scope="row">
                    <div className="ephyra-side-room-heading">
                      <div className="owner-markers">
                        <span>{side.label}</span>
                        <SemanticOwnerMarker address={side.address} />
                      </div>
                      <p className="card-kicker">Door {side.physicalDoorId}</p>
                    </div>
                    {side.generation !== 'generated' ? null : (
                      <div className="ephyra-side-reward room-state-with-marker">
                        <SemanticOwnerMarker address={side.rewardControl.marker.address} />
                        <RewardControlEditor
                          control={side.rewardControl}
                          idPrefix={`side-${side.marker.focusKey}`}
                          interactions={interactions}
                        />
                      </div>
                    )}
                    <EncounterWorkbench
                      idPrefix={`side-${side.marker.focusKey}`}
                      interactions={interactions}
                      phases={side.encounterPhases}
                    />
                  </th>
                  <td className="ephyra-side-priority">{side.availabilityRank}</td>
                  <td>
                    <CandidateSelect
                      id={`side-${side.marker.focusKey}-generation`}
                      interaction={generation}
                      label={`${side.label} generation`}
                      onReplace={(value) =>
                        dispatch(
                          authoredProjectCommandDispatched({
                            kind: 'ReplaceSideRoomGeneration',
                            sideRoom: side.address,
                            generation: value,
                          }),
                        )
                      }
                    />
                  </td>
                  <td>
                    <EphyraSideRoomEntryOrderSelect
                      group={group}
                      interactions={interactions}
                      side={side}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  const activeCages = room.cages.filter((cage) => cage.active);
  if (activeCages.length === 0) return null;

  return (
    <div aria-label="Fields cage rewards" className="local-reward-editor">
      {activeCages.map((cage) => (
        <section aria-label={cage.label} className="local-reward-slot" key={cage.key}>
          <div className="local-reward-heading">
            <div className="owner-markers">
              <h4>{cage.label}</h4>
              <SemanticOwnerMarker address={cage.control.marker.address} />
            </div>
          </div>
          <RewardControlEditor
            control={cage.control}
            idPrefix={`room-${cage.control.marker.focusKey}`}
            interactions={interactions}
          />
        </section>
      ))}
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
          const picked = requireWorkspaceInteraction(
            interactions.rewardWheelPicks,
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
                <CandidateSelect
                  id={`${idPrefix}-picked`}
                  interaction={picked}
                  label="Picked offer"
                  onReplace={(pickedOfferIndex) =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ReplaceRewardWheelPicked',
                        wheel: wheel.address,
                        pickedOfferIndex,
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
  const dispatch = useAppDispatch();
  if (!room.materialized) return null;
  return (
    <div className="shop-editor">
      <div className="shop-table-scroll">
        <table className="shop-offer-table">
          <thead>
            <tr>
              <th scope="col">Offer</th>
              <th scope="col">Purchased</th>
              <th scope="col">Purchase order</th>
            </tr>
          </thead>
          <tbody>
            {room.offers.map((offer) => (
              <Fragment key={offer.key}>
                <tr className="shop-offer" key={`${offer.key}:purchase`}>
                  <th scope="row">
                    <div className="owner-markers">
                      <span>{offer.label}</span>
                      <SemanticOwnerMarker address={offer.rewardControl.marker.address} />
                    </div>
                  </th>
                  <ShopPurchaseControl
                    address={offer.purchase.address}
                    interactions={interactions}
                    label={offer.label}
                    onChange={(offerKeys) =>
                      dispatch(
                        authoredProjectCommandDispatched({
                          kind: 'ReplaceShopPurchaseOrder',
                          shop: occurrence,
                          offerKeys,
                        }),
                      )
                    }
                    position={offer.purchase.position}
                    positionOptions={offer.purchase.positionOptions}
                    purchased={offer.purchase.purchased}
                    toggleOfferKeys={offer.purchase.toggleOfferKeys}
                  />
                </tr>
                <tr className="shop-offer-reward" key={`${offer.key}:reward`}>
                  <td colSpan={3}>
                    <RewardControlEditor
                      control={offer.rewardControl}
                      idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
                      interactions={interactions}
                    />
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
  interactions,
  presentation,
  room,
}: {
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly presentation: 'full' | 'hubRoomLocal';
  readonly room: WorkspaceRoomSummary;
}) {
  const state = room.roomLocal;
  const showMainReward = presentation === 'full';

  return (
    <>
      {presentation === 'hubRoomLocal' ? (
        <HubRewardContext interactions={interactions} room={room} />
      ) : null}
      <AnomalyMapControl room={room} />
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
              />
            </>
          )}
        </div>
      ) : null}
      {showMainReward && state.kind === 'ephyra' ? (
        <div className="room-state-with-marker">
          <SemanticOwnerMarker address={state.incomingReward.marker.address} />
          <RewardControlEditor
            control={state.incomingReward}
            idPrefix={`ephyra-${state.incomingReward.marker.focusKey}`}
            interactions={interactions}
          />
        </div>
      ) : null}
      <AnomalyClearedControl room={room} />
      {presentation === 'hubRoomLocal' &&
      state.kind === 'ephyra' &&
      state.sideRooms.kind === 'withheld' ? (
        <p className="fixed-room-state">
          Side rooms become available after this room is selected in the visit order.
        </p>
      ) : null}
      {state.kind === 'shop' && !state.materialized ? (
        <p className="fixed-room-state">Shop inventory appears when you select this room.</p>
      ) : null}
      {state.kind === 'shop' && state.materialized ? (
        <ShopWorkbench interactions={interactions} occurrence={room.address} room={state} />
      ) : null}
      {state.kind === 'fields' ? (
        <FieldsWorkbench interactions={interactions} room={state} />
      ) : null}
      {state.kind === 'ship' ? (
        <ShipWorkbench interactions={interactions} occurrence={room.address} room={state} />
      ) : null}
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
          {state.kind === 'ephyra' ? (
            <EphyraWorkbench interactions={interactions} room={state} />
          ) : null}
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
      <RevertAnomalyAction room={room} />
    </>
  );
}

/** A room-local editor that consumes the structured workspace only. */
export function OccurrenceWorkbench({
  interactions,
  nextDecisionIntent,
  presentation,
  room,
  runState,
}: OccurrenceWorkbenchProps) {
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const idPrefix = `occurrence-${room.occurrenceId}`;
  const roomInteraction =
    room.roomPicker === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.rooms,
          workspaceInteractionKey(room.roomPicker.address),
        );

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
      {roomInteraction === undefined ? null : (
        <RoomSelector
          idPrefix={idPrefix}
          interaction={roomInteraction}
          label="Starting room"
          onSelect={(gameName) =>
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceOccurrenceRoom',
                occurrence: room.address,
                gameName,
              }),
            )
          }
        />
      )}
      <RoomOfferEditor
        idPrefix={idPrefix}
        interactions={interactions}
        presentation={presentation}
        room={room}
      />
      {nextDecisionIntent === undefined ? null : (
        <div className="workbench-action-row">
          <button
            className="primary-action"
            data-command={nextDecisionIntent.command.kind}
            onClick={() => executeIntent(nextDecisionIntent)}
            type="button"
          >
            Add next decision
          </button>
        </div>
      )}
    </article>
  );
}

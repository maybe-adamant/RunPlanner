import {
  createAcquisitionSiteAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';
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
  moveRankedPrefixItem,
  reconcileRankedPrefix,
  workspaceInteractionKey,
  type RankedPrefixDropTarget,
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
import {
  useOptionalWorkspaceInteraction,
  useWorkspaceInteraction,
} from '@planner/ui/controls/useWorkspaceInteraction';
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
        {phase.traitOffer === undefined ? null : (
          <TraitOfferLauncher control={phase.traitOffer} interactions={interactions} />
        )}
        {phase.gorgonAthena === undefined ? null : (
          <TraitOfferLauncher control={phase.gorgonAthena} interactions={interactions} />
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
      {figLeafControl}
      {gorgonControl}
      {phase.traitOffer === undefined ? null : (
        <TraitOfferLauncher control={phase.traitOffer} interactions={interactions} />
      )}
      {phase.gorgonAthena === undefined ? null : (
        <TraitOfferLauncher control={phase.gorgonAthena} interactions={interactions} />
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
  const dispatch = useAppDispatch();
  return (
    <div className="fields-room-editor">
      {room.cages.length === 0 ? null : (
        <div aria-label="Fields cage rewards" className="local-reward-editor">
          {room.cages.map((cage) => (
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
      )}
      {room.chronology === undefined ? null : (
        <section aria-label="Fields optional rewards" className="local-reward-editor">
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
          <FieldsOptionalRewardRows
            chronology={room.chronology}
            interactions={interactions}
            room={room}
          />
        </section>
      )}
      {room.chronology === undefined ? null : (
        <FieldsChronologyWorkbench chronology={room.chronology} interactions={interactions} />
      )}
    </div>
  );
}

function FieldsOptionalRewardRows({
  chronology,
  interactions,
  room,
}: {
  readonly chronology: NonNullable<
    Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>['chronology']
  >;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>;
}) {
  const executeIntent = useCommandIntent();
  const chronologyInteraction = requireWorkspaceInteraction(
    interactions.fieldsActionOrders,
    chronology.interactionKey,
  );
  const applyParticipation = (proposalKey: string): void => {
    executeIntent(chronologyInteraction.intentFor(proposalKey));
  };
  return room.optionalRewards.map((reward) => (
    <section aria-label={reward.label} className="local-reward-slot" key={reward.key}>
      <div className="local-reward-heading">
        <div className="owner-markers">
          <h4>{reward.label}</h4>
          <SemanticOwnerMarker address={reward.control.marker.address} />
        </div>
        <label className="purchase-control">
          <input
            aria-label={`Interact with ${reward.label}`}
            checked={reward.interacted}
            onChange={() => applyParticipation(reward.participationProposalKey)}
            type="checkbox"
          />
          Interact
        </label>
      </div>
      <RewardControlEditor
        control={reward.control}
        idPrefix={`room-${reward.control.marker.focusKey}`}
        interactions={interactions}
      />
    </section>
  ));
}

function FieldsChronologyWorkbench({
  chronology,
  interactions,
}: {
  readonly chronology: NonNullable<
    Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>['chronology']
  >;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.fieldsActionOrders,
    chronology.interactionKey,
  );
  const candidates = useWorkspaceInteraction(interaction);
  const executeIntent = useCommandIntent();

  const applyProposal = (proposalKey: string): void => {
    const proposalIndex = interaction.proposals.findIndex(
      (proposal) => proposal.key === proposalKey,
    );
    if (proposalIndex < 0) return;
    const evaluated = candidates.result ?? candidates.activate();
    if (!candidateMayBeAuthored(evaluated?.[proposalIndex])) return;
    executeIntent(interaction.intentFor(proposalKey));
  };
  const applyParticipation = (proposalKey: string): void => {
    executeIntent(interaction.intentFor(proposalKey));
  };

  return (
    <section aria-label="Fields action chronology" className="fields-action-chronology">
      <header className="local-reward-heading">
        <h4>Room action order</h4>
        <span className="neutral-status">Passive occurs first</span>
      </header>
      <ol className="fields-action-list">
        {chronology.rows.map((row) => {
          const proposals = row.proposalKeys.flatMap((proposalKey) => {
            const index = interaction.proposals.findIndex(
              (proposal) => proposal.key === proposalKey,
            );
            const proposal = interaction.proposals[index];
            return proposal === undefined ? [] : [{ index, proposal }];
          });
          return (
            <li className="fields-action-row" key={row.key}>
              <div className="owner-markers">
                <span>{row.label}</span>
                <SemanticOwnerMarker address={row.address} />
                {row.state === 'active' ? null : (
                  <span className="neutral-status">{row.state}</span>
                )}
              </div>
              {row.participationProposalKey === undefined ? (
                <label className="field-control">
                  <span>Change order</span>
                  <select
                    aria-busy={candidates.pending || undefined}
                    onChange={(event) => {
                      applyProposal(event.target.value);
                      event.target.value = '';
                    }}
                    onFocus={candidates.activate}
                    onPointerDown={candidates.activate}
                    value=""
                  >
                    <option disabled value="">
                      Choose an action
                    </option>
                    {proposals.map(({ index, proposal }) => {
                      const candidate = candidates.result?.[index];
                      return (
                        <option
                          data-candidate-support={candidateSupport(candidate)}
                          disabled={candidate !== undefined && !candidateMayBeAuthored(candidate)}
                          key={proposal.key}
                          value={proposal.key}
                        >
                          {presentCandidateLabel(proposal.label, candidate)}
                        </option>
                      );
                    })}
                  </select>
                </label>
              ) : (
                <label className="purchase-control">
                  <input
                    aria-label={`Interact with ${row.label}`}
                    checked={row.state === 'active'}
                    onChange={() => applyParticipation(row.participationProposalKey!)}
                    type="checkbox"
                  />
                  Interact
                </label>
              )}
            </li>
          );
        })}
      </ol>
    </section>
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
              <th className="shop-purchase-membership" scope="col">
                Buy
              </th>
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
                    label={offer.label}
                    onChange={(offerKeys) =>
                      dispatch(
                        authoredProjectCommandDispatched({
                          kind: 'ReplaceAcquisitionOrder',
                          site: createAcquisitionSiteAddress(occurrence, 'roomExit'),
                          entryKeys: offerKeys,
                        }),
                      )
                    }
                    purchased={offer.purchase.purchased}
                    toggleOfferKeys={offer.purchase.toggleOfferKeys}
                  />
                </tr>
                <tr className="shop-offer-reward" key={`${offer.key}:reward`}>
                  <td colSpan={2}>
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
                  <th scope="row">{offer.label}</th>
                  <td>{offer.explanation}</td>
                </tr>
              ) : offer.kind === 'travelDealInvalid' || offer.kind === 'echoDoubleShopInvalid' ? (
                <tr className="shop-offer shop-offer-invalid" key={offer.key}>
                  <th scope="row">
                    <span>{offer.label}</span>
                    <small>{offer.explanation}</small>
                  </th>
                  <ShopPurchaseControl
                    address={offer.purchase.address}
                    label={offer.label}
                    participationLabel={offer.participationLabel}
                    onChange={(offerKeys) =>
                      dispatch(
                        authoredProjectCommandDispatched({
                          kind: 'ReplaceAcquisitionOrder',
                          site: createAcquisitionSiteAddress(occurrence, 'roomExit'),
                          entryKeys: offerKeys,
                        }),
                      )
                    }
                    purchased={true}
                    toggleOfferKeys={offer.purchase.toggleOfferKeys}
                  />
                </tr>
              ) : 'rewardControl' in offer ? (
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
                      label={offer.label}
                      participationLabel={offer.participationLabel}
                      onChange={(offerKeys) =>
                        dispatch(
                          (offer.kind === 'travelDealRefill' ||
                            offer.kind === 'echoDoubleShopReward') &&
                            !offer.materialized &&
                            offerKeys.includes(offer.key)
                            ? authoredProjectCommandDispatched({
                                kind: 'SelectDerivedShopEntry',
                                site: createAcquisitionSiteAddress(occurrence, 'roomExit'),
                                entryKey:
                                  offer.kind === 'travelDealRefill'
                                    ? 'travelDealRefill'
                                    : 'echoDoubleShopReward',
                                entryKeys: offerKeys,
                                sourceOfferKey: offer.sourceOfferKey,
                              })
                            : authoredProjectCommandDispatched({
                                kind: 'ReplaceAcquisitionOrder',
                                site: createAcquisitionSiteAddress(occurrence, 'roomExit'),
                                entryKeys: offerKeys,
                              }),
                        )
                      }
                      purchased={offer.purchase.purchased}
                      toggleOfferKeys={offer.purchase.toggleOfferKeys}
                    />
                  </tr>
                  <tr className="shop-offer-reward" key={`${offer.key}:reward`}>
                    <td colSpan={2}>
                      <RewardControlEditor
                        control={offer.rewardControl}
                        idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
                        interactions={interactions}
                        showAcquisitionChildren={offer.kind === 'echoDoubleShopReward'}
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

interface AcquisitionPointerDrag {
  readonly pointerId: number;
  readonly entryKey: string;
  readonly target: RankedPrefixDropTarget | undefined;
  readonly x: number;
  readonly y: number;
}

interface PendingAcquisitionPointerDrag {
  readonly handle: HTMLElement;
  readonly originX: number;
  readonly originY: number;
  readonly pointerId: number;
  readonly entryKey: string;
}

function sameEntryKeys(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function sameAcquisitionDropTarget(
  left: RankedPrefixDropTarget | undefined,
  right: RankedPrefixDropTarget | undefined,
): boolean {
  if (left === right) return true;
  if (left === undefined || right === undefined || left.kind !== right.kind) return false;
  if (left.kind === 'nextVisit' || right.kind === 'nextVisit') return true;
  return left.slotKey === right.slotKey;
}

function acquisitionDropTargetFromPoint(
  root: HTMLElement | null,
  x: number,
  y: number,
): RankedPrefixDropTarget | undefined {
  const card = document
    .elementFromPoint?.(x, y)
    ?.closest<HTMLElement>('[data-acquisition-entry-key][data-in-order="true"]');
  if (card === null || card === undefined || root?.contains(card) !== true) return undefined;
  const entryKey = card.dataset.acquisitionEntryKey;
  if (entryKey === undefined) return undefined;
  const bounds = card.getBoundingClientRect();
  return Object.freeze({
    kind: y < bounds.top + bounds.height / 2 ? ('beforeSlot' as const) : ('afterSlot' as const),
    slotKey: entryKey,
  });
}

/** One canonical settlement surface, hosted by its producing room. */
export function AcquisitionsWorkbench({
  acquisitions,
  interactions,
}: {
  readonly acquisitions: NonNullable<WorkspaceRoomSummary['acquisitions']>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  if (acquisitions.entries.length === 0) return null;
  return <RankedAcquisitionsWorkbench acquisitions={acquisitions} interactions={interactions} />;
}

function RankedAcquisitionsWorkbench({
  acquisitions,
  interactions,
}: {
  readonly acquisitions: NonNullable<WorkspaceRoomSummary['acquisitions']>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const dispatch = useAppDispatch();
  const board = useRef<HTMLDivElement>(null);
  const pendingPointerDrag = useRef<PendingAcquisitionPointerDrag | undefined>(undefined);
  const activePointerDrag = useRef<AcquisitionPointerDrag | undefined>(undefined);
  const pendingKeyboardFocus = useRef<
    { readonly action: 'moveEarlier' | 'moveLater'; readonly entryKey: string } | undefined
  >(undefined);
  const [pointerDrag, setPointerDrag] = useState<AcquisitionPointerDrag | undefined>(undefined);
  const [announcement, setAnnouncement] = useState('');
  const participantEntries = acquisitions.entries.filter(
    (entry) => entry.participation === undefined || entry.participation.selected,
  );
  const participantKeys = participantEntries.map((entry) => entry.key);
  const participantKeyIdentity = participantKeys.join('\u0001');
  const interaction =
    participantEntries.length < 2
      ? undefined
      : requireWorkspaceInteraction(
          interactions.acquisitionOrders,
          workspaceInteractionKey(acquisitions.site),
        );
  const projection = useOptionalWorkspaceInteraction(interaction);
  const ranking = reconcileRankedPrefix({
    authoredVisitOrder: participantKeys,
    declarationOpenSlotKeys: acquisitions.entries.map((entry) => entry.key),
  });
  const entriesByKey = new Map(acquisitions.entries.map((entry) => [entry.key, entry] as const));
  const orderedEntries = ranking.authoredVisitOrder.flatMap((key) => {
    const entry = entriesByKey.get(key);
    return entry === undefined ? [] : [entry];
  });
  const unselectedEntries = ranking.tailSlotKeys.flatMap((key) => {
    const entry = entriesByKey.get(key);
    return entry === undefined ? [] : [entry];
  });
  const candidateFor = (entryKeys: readonly string[]) =>
    projection.result?.find((option) => sameEntryKeys(option.value, entryKeys));
  const applyOrder = (
    entryKeys: readonly string[],
    nextAnnouncement: string,
    focus?: { readonly action: 'moveEarlier' | 'moveLater'; readonly entryKey: string },
  ): void => {
    const options = projection.result ?? projection.activate();
    const proposal = options?.find((option) => sameEntryKeys(option.value, entryKeys));
    if (!candidateMayBeAuthored(proposal)) return;
    pendingKeyboardFocus.current = focus;
    setAnnouncement(nextAnnouncement);
    dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceAcquisitionOrder',
        site: acquisitions.site,
        entryKeys,
      }),
    );
  };
  const moveResult = (entryKey: string, kind: 'moveEarlier' | 'moveLater') =>
    moveRankedPrefixItem(ranking, acquisitions.entries.length, { kind, slotKey: entryKey });
  const beginPointerDrag = (event: ReactPointerEvent<HTMLSpanElement>, entryKey: string): void => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    projection.activate();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pendingPointerDrag.current = Object.freeze({
      handle: event.currentTarget,
      originX: event.clientX,
      originY: event.clientY,
      pointerId: event.pointerId,
      entryKey,
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
  const updatePointerDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pending = pendingPointerDrag.current;
    if (pending === undefined || pending.pointerId !== event.pointerId) return;
    if (
      activePointerDrag.current === undefined &&
      Math.hypot(event.clientX - pending.originX, event.clientY - pending.originY) < 6
    ) {
      return;
    }
    const next = Object.freeze({
      pointerId: pending.pointerId,
      entryKey: pending.entryKey,
      target: acquisitionDropTargetFromPoint(board.current, event.clientX, event.clientY),
      x: event.clientX,
      y: event.clientY,
    });
    activePointerDrag.current = next;
    setPointerDrag(next);
  };
  const completePointerDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const active = activePointerDrag.current;
    if (active === undefined || active.pointerId !== event.pointerId) {
      clearPointerDrag(event.pointerId);
      return;
    }
    const target = acquisitionDropTargetFromPoint(board.current, event.clientX, event.clientY);
    clearPointerDrag(event.pointerId);
    if (target === undefined) return;
    const result = dropRankedPrefixItem(
      ranking,
      acquisitions.entries.length,
      active.entryKey,
      target,
    );
    const entryKeys = result?.proposedVisitOrder;
    if (entryKeys === undefined || entryKeys.length !== participantKeys.length) return;
    const entry = entriesByKey.get(active.entryKey);
    const position = entryKeys.indexOf(active.entryKey) + 1;
    applyOrder(
      entryKeys,
      `${entry?.label ?? active.entryKey} moved to acquisition ${position} of ${entryKeys.length}.`,
    );
  };

  useLayoutEffect(() => {
    const pending = pendingKeyboardFocus.current;
    if (pending === undefined) return;
    const card = Array.from(
      board.current?.querySelectorAll<HTMLElement>('[data-acquisition-entry-key]') ?? [],
    ).find((element) => element.dataset.acquisitionEntryKey === pending.entryKey);
    const requested = card?.querySelector<HTMLButtonElement>(
      `[data-acquisition-rank-action="${pending.action}"]`,
    );
    const fallback = Array.from(
      card?.querySelectorAll<HTMLButtonElement>('[data-acquisition-rank-action]') ?? [],
    ).find((button) => !button.disabled);
    (requested?.disabled === false ? requested : fallback)?.focus({ preventScroll: true });
    pendingKeyboardFocus.current = undefined;
  }, [participantKeyIdentity]);

  return (
    <section className="acquisitions-workbench">
      <div className="owner-markers">
        <h4>Acquisitions</h4>
        <SemanticOwnerMarker address={acquisitions.marker.address} />
      </div>
      <p aria-live="polite" className="visually-hidden">
        {announcement}
      </p>
      <div
        aria-label="Ranked acquisition order"
        className="hub-ranked-room-board acquisition-ranked-board"
        onLostPointerCapture={(event) => clearPointerDrag(event.pointerId)}
        onPointerCancel={(event) => clearPointerDrag(event.pointerId)}
        onPointerMove={updatePointerDrag}
        onPointerUp={completePointerDrag}
        ref={board}
        role="group"
        tabIndex={-1}
      >
        <div aria-label="Selected acquisition order" className="hub-ranked-visit-prefix">
          {orderedEntries.map((entry, index) => {
            const earlier = moveResult(entry.key, 'moveEarlier')?.proposedVisitOrder;
            const later = moveResult(entry.key, 'moveLater')?.proposedVisitOrder;
            const earlierCandidate = earlier === undefined ? undefined : candidateFor(earlier);
            const laterCandidate = later === undefined ? undefined : candidateFor(later);
            const dropState = (target: RankedPrefixDropTarget) => {
              if (!sameAcquisitionDropTarget(pointerDrag?.target, target)) return undefined;
              const result = dropRankedPrefixItem(
                ranking,
                acquisitions.entries.length,
                pointerDrag!.entryKey,
                target,
              );
              const proposal = result?.proposedVisitOrder;
              return proposal === undefined || proposal.length !== participantKeys.length
                ? 'unavailable'
                : projection.result !== undefined && !candidateMayBeAuthored(candidateFor(proposal))
                  ? 'unavailable'
                  : 'available';
            };
            return (
              <article
                className="hub-open-room-card acquisition-entry"
                data-acquisition-entry-key={entry.key}
                data-dragging={pointerDrag?.entryKey === entry.key || undefined}
                data-drop-after={dropState({ kind: 'afterSlot', slotKey: entry.key })}
                data-drop-before={dropState({ kind: 'beforeSlot', slotKey: entry.key })}
                data-in-order="true"
                id={semanticOwnerControlElementId(entry.address)}
                key={entry.key}
                tabIndex={-1}
              >
                <div className="hub-roster-primary acquisition-entry-primary">
                  <span
                    aria-hidden="true"
                    className="hub-roster-drag-handle"
                    data-acquisition-drag-handle
                    data-dragging={pointerDrag?.entryKey === entry.key || undefined}
                    onPointerDown={(event) => beginPointerDrag(event, entry.key)}
                  >
                    ⠿
                  </span>
                  <span aria-hidden="true" className="hub-roster-rank">
                    {index + 1}
                  </span>
                  <div className="hub-roster-identity acquisition-entry-identity">
                    <div className="owner-markers">
                      <strong>{entry.label}</strong>
                      {entry.rewardControl === undefined ? null : (
                        <SemanticOwnerMarker address={entry.rewardControl.marker.address} />
                      )}
                    </div>
                  </div>
                  {entry.participation === undefined ? (
                    <span />
                  ) : (
                    <PickupParticipationControl
                      entry={entry.address}
                      label={entry.participation.label}
                      selected={entry.participation.selected}
                      toggleEntryKeys={entry.participation.toggleEntryKeys}
                    />
                  )}
                  <div
                    aria-label={`Acquisition order controls for ${entry.label}; Position ${index + 1} of ${orderedEntries.length}`}
                    className="hub-rank-actions"
                    role="group"
                  >
                    <button
                      aria-busy={projection.pending || undefined}
                      aria-label={`Move ${entry.label} earlier`}
                      className="quiet-action hub-rank-action"
                      data-acquisition-rank-action="moveEarlier"
                      data-candidate-support={candidateSupport(earlierCandidate)}
                      disabled={
                        earlier === undefined ||
                        projection.pending ||
                        (projection.result !== undefined &&
                          !candidateMayBeAuthored(earlierCandidate))
                      }
                      onClick={() =>
                        earlier === undefined
                          ? undefined
                          : applyOrder(
                              earlier,
                              `${entry.label} moved to acquisition ${index} of ${orderedEntries.length}.`,
                              { action: 'moveEarlier', entryKey: entry.key },
                            )
                      }
                      onFocus={projection.activate}
                      onPointerDown={projection.activate}
                      title={`Move ${entry.label} earlier`}
                      type="button"
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      aria-busy={projection.pending || undefined}
                      aria-label={`Move ${entry.label} later`}
                      className="quiet-action hub-rank-action"
                      data-acquisition-rank-action="moveLater"
                      data-candidate-support={candidateSupport(laterCandidate)}
                      disabled={
                        later === undefined ||
                        projection.pending ||
                        (projection.result !== undefined && !candidateMayBeAuthored(laterCandidate))
                      }
                      onClick={() =>
                        later === undefined
                          ? undefined
                          : applyOrder(
                              later,
                              `${entry.label} moved to acquisition ${index + 2} of ${orderedEntries.length}.`,
                              { action: 'moveLater', entryKey: entry.key },
                            )
                      }
                      onFocus={projection.activate}
                      onPointerDown={projection.activate}
                      title={`Move ${entry.label} later`}
                      type="button"
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                  </div>
                </div>
                {entry.rewardControl === undefined ? null : (
                  <div className="acquisition-entry-resolution">
                    <RewardControlEditor
                      control={entry.rewardControl}
                      idPrefix={`acquisition-${entry.rewardControl.marker.focusKey}`}
                      interactions={interactions}
                      showOffer={
                        entry.rewardPresentation !== 'resolutionOnly' &&
                        entry.rewardControl.offerEditVisibility === 'visible'
                      }
                      {...(entry.rewardControl.offerEditStartStep === undefined
                        ? {}
                        : { offerStartStep: entry.rewardControl.offerEditStartStep })}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {unselectedEntries.length === 0 ? null : (
          <div aria-label="Acquisition-order boundary" className="hub-visit-boundary">
            <span>Acquisition order ends here</span>
            <span>{unselectedEntries.length} not picked up</span>
          </div>
        )}
        {unselectedEntries.length === 0 ? null : (
          <div aria-label="Unselected acquisitions" className="hub-ranked-tail">
            {unselectedEntries.map((entry) => (
              <article
                className="hub-open-room-card acquisition-entry"
                data-acquisition-entry-key={entry.key}
                data-in-order="false"
                id={semanticOwnerControlElementId(entry.address)}
                key={entry.key}
                tabIndex={-1}
              >
                <div className="hub-roster-primary acquisition-entry-primary">
                  <span aria-hidden="true" className="hub-roster-drag-handle">
                    ·
                  </span>
                  <span aria-hidden="true" className="hub-roster-rank">
                    —
                  </span>
                  <div className="hub-roster-identity acquisition-entry-identity">
                    <div className="owner-markers">
                      <strong>{entry.label}</strong>
                      {entry.rewardControl === undefined ? null : (
                        <SemanticOwnerMarker address={entry.rewardControl.marker.address} />
                      )}
                    </div>
                  </div>
                  {entry.participation === undefined ? null : (
                    <PickupParticipationControl
                      entry={entry.address}
                      label={entry.participation.label}
                      selected={entry.participation.selected}
                      toggleEntryKeys={entry.participation.toggleEntryKeys}
                    />
                  )}
                  <span />
                </div>
                {entry.rewardControl === undefined ? null : (
                  <div className="acquisition-entry-resolution">
                    <RewardControlEditor
                      control={entry.rewardControl}
                      idPrefix={`acquisition-${entry.rewardControl.marker.focusKey}`}
                      interactions={interactions}
                      showOffer={
                        entry.rewardPresentation !== 'resolutionOnly' &&
                        entry.rewardControl.offerEditVisibility === 'visible'
                      }
                      {...(entry.rewardControl.offerEditStartStep === undefined
                        ? {}
                        : { offerStartStep: entry.rewardControl.offerEditStartStep })}
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        {pointerDrag === undefined ? null : (
          <div
            aria-hidden="true"
            className="hub-roster-drag-preview"
            style={{
              transform: `translate3d(${pointerDrag.x + 14}px, ${pointerDrag.y + 14}px, 0)`,
            }}
          >
            <span>⠿</span>
            {entriesByKey.get(pointerDrag.entryKey)?.label ?? 'Acquisition'}
          </div>
        )}
      </div>
    </section>
  );
}

function PickupParticipationControl({
  entry,
  label,
  selected,
  toggleEntryKeys,
}: {
  readonly entry: import('@run-planner/engine/authored-project').AcquisitionEntryAddress;
  readonly label: string;
  readonly selected: boolean;
  readonly toggleEntryKeys: readonly string[];
}) {
  const dispatch = useAppDispatch();
  const apply = () => {
    dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceAcquisitionOrder',
        site: entry.site,
        entryKeys: toggleEntryKeys,
      }),
    );
  };
  return (
    <label className="purchase-control">
      <input
        aria-label={`${label} ${entry.entryKey}`}
        checked={selected}
        onChange={apply}
        type="checkbox"
      />
      {label}
    </label>
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
      {room.acquisitions === undefined ? null : (
        <AcquisitionsWorkbench acquisitions={room.acquisitions} interactions={interactions} />
      )}
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

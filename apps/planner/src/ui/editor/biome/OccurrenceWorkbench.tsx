import type { OccurrenceAddress } from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
  type WorkspaceEphyraSideRoomEntryAction,
  type WorkspaceRewardControl,
  type WorkspaceRoomSummary,
} from '../../../projections/structuredWorkspace';
import { semanticOwnerFocused } from '../../../state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '../../../state/projectWorkspaceSlice';
import { useAppDispatch } from '../../../state/store';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';
import { candidateMayBeAuthored } from '../../feedback/candidatePresentation';
import { useWorkspaceInteraction } from '../../controls/useWorkspaceInteraction';
import { CountedRewardEditor, RewardValueEditor } from '../rewards/RewardEditors';
import { ShopPurchaseControl } from '../rooms/ShopPurchaseControl';
import { CandidateSelect } from './CandidateSelect';
import { RoomSelector } from './RoomSelector';

interface OccurrenceWorkbenchProps {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly nextFrontier?: WorkspaceMarker;
  readonly room: WorkspaceRoomSummary;
}

function replaceReward(
  dispatch: ReturnType<typeof useAppDispatch>,
  control: WorkspaceRewardControl,
  value: ResolvedRewardOffer,
): void {
  switch (control.owner.kind) {
    case 'incomingReward':
      dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceIncomingReward',
          reward: control.owner.address,
          value,
        }),
      );
      return;
    case 'localReward':
      dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceLocalReward',
          reward: control.owner.address,
          value,
        }),
      );
      return;
    case 'rewardWheelOffer':
      dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceRewardWheelOffer',
          offer: control.owner.address,
          value,
        }),
      );
      return;
    case 'shopOffer':
      dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceShopOffer',
          offer: control.owner.address,
          value,
        }),
      );
      return;
  }
}

export function RewardControlEditor({
  control,
  idPrefix,
  interactions,
}: {
  readonly control: WorkspaceRewardControl;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const dispatch = useAppDispatch();
  const onReplace = (value: ResolvedRewardOffer): void => replaceReward(dispatch, control, value);
  return control.kind === 'countedReward' ? (
    <CountedRewardEditor
      candidateOwner={control.owner}
      idPrefix={idPrefix}
      interactions={interactions}
      offer={control.offer}
      onReplace={onReplace}
    />
  ) : (
    <RewardValueEditor
      candidateOwner={control.owner}
      idPrefix={idPrefix}
      interactions={interactions}
      offer={control.offer}
      onReplace={onReplace}
    />
  );
}

function EphyraSideEntryAction({
  action,
  ariaLabel,
  interactions,
  label,
  onApply,
}: {
  readonly action: WorkspaceEphyraSideRoomEntryAction;
  readonly ariaLabel: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly onApply: () => void;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.sideRoomEntryOrders,
    action.interactionKey,
  );
  const candidates = useWorkspaceInteraction(interaction);
  const option = candidates.result?.[0];
  const canApply = candidateMayBeAuthored(option);
  return (
    <button
      aria-busy={candidates.pending || undefined}
      aria-label={
        option !== undefined && !canApply ? `${ariaLabel} unavailable in this state` : ariaLabel
      }
      className={action.kind === 'remove' ? 'danger-action' : undefined}
      data-candidate-support={
        option === undefined
          ? candidates.pending
            ? 'loading'
            : 'unavailable'
          : canApply
            ? 'possible'
            : 'impossible'
      }
      disabled={option !== undefined && !canApply}
      onClick={() => {
        const options = candidates.result ?? candidates.activate();
        const next = options?.[0];
        if (candidateMayBeAuthored(next)) onApply();
      }}
      onFocus={candidates.activate}
      onPointerDown={candidates.activate}
      type="button"
    >
      {label}
    </button>
  );
}

function EphyraWorkbench({
  entered,
  interactions,
  room,
}: {
  readonly entered: boolean;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'ephyra' }>;
}) {
  const dispatch = useAppDispatch();
  const group = room.sideRooms;
  return (
    <>
      <div className="room-state-with-marker">
        <SemanticOwnerMarker address={room.incomingReward.marker.address} />
        <RewardControlEditor
          control={room.incomingReward}
          idPrefix={`ephyra-${room.incomingReward.marker.focusKey}`}
          interactions={interactions}
        />
      </div>
      {!entered ? null : (
        <section className="ephyra-side-editor" aria-label="Ephyra side rooms">
          <header className="local-reward-heading">
            <div className="owner-markers">
              <h4>Side rooms</h4>
              <SemanticOwnerMarker address={group.address} />
            </div>
            <span className="neutral-status">
              {group.enteredSlotKeys.length} entered · {group.slots.length} possible
            </span>
          </header>
          <div className="ephyra-side-list">
            {group.slots.map((side) => {
              const generation = requireWorkspaceInteraction(
                interactions.sideRoomGenerations,
                workspaceInteractionKey(side.address),
              );
              const action = (kind: WorkspaceEphyraSideRoomEntryAction['kind']) =>
                side.entryActions.find((candidate) => candidate.kind === kind);
              const enterOrRemove = action(side.entered ? 'remove' : 'enter');
              const earlier = action('moveEarlier');
              const later = action('moveLater');
              return (
                <article
                  aria-label={side.label}
                  className="ephyra-side-card"
                  data-generated={side.generation === 'generated'}
                  key={side.key}
                >
                  <div className="local-reward-heading">
                    <div>
                      <p className="card-kicker">Door {side.physicalDoorId}</p>
                      <div className="owner-markers">
                        <h4>{side.label}</h4>
                        <SemanticOwnerMarker address={side.address} />
                      </div>
                    </div>
                    <span className="neutral-status">
                      {side.entered ? `Entered ${side.enteredOrdinal}` : 'Not entered'}
                    </span>
                  </div>
                  <div className="ephyra-side-controls">
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
                    {enterOrRemove === undefined ? null : (
                      <EphyraSideEntryAction
                        action={enterOrRemove}
                        interactions={interactions}
                        label={side.entered ? 'Remove From Entry Order' : 'Enter Last'}
                        ariaLabel={`${side.entered ? 'Remove from entry order' : 'Enter last'}: ${side.label}`}
                        onApply={() =>
                          dispatch(
                            authoredProjectCommandDispatched({
                              kind: 'ReplaceSideRoomEntryOrder',
                              group: group.address,
                              enteredSlotKeys: enterOrRemove.proposedEnteredSlotKeys,
                            }),
                          )
                        }
                      />
                    )}
                  </div>
                  {!side.entered || (earlier === undefined && later === undefined) ? null : (
                    <div className="side-order-actions">
                      {earlier === undefined ? null : (
                        <EphyraSideEntryAction
                          action={earlier}
                          interactions={interactions}
                          label="Earlier"
                          ariaLabel={`Move ${side.label} earlier`}
                          onApply={() =>
                            dispatch(
                              authoredProjectCommandDispatched({
                                kind: 'ReplaceSideRoomEntryOrder',
                                group: group.address,
                                enteredSlotKeys: earlier.proposedEnteredSlotKeys,
                              }),
                            )
                          }
                        />
                      )}
                      {later === undefined ? null : (
                        <EphyraSideEntryAction
                          action={later}
                          interactions={interactions}
                          label="Later"
                          ariaLabel={`Move ${side.label} later`}
                          onApply={() =>
                            dispatch(
                              authoredProjectCommandDispatched({
                                kind: 'ReplaceSideRoomEntryOrder',
                                group: group.address,
                                enteredSlotKeys: later.proposedEnteredSlotKeys,
                              }),
                            )
                          }
                        />
                      )}
                    </div>
                  )}
                  <div
                    className="room-state-with-marker"
                    data-active={side.generation === 'generated'}
                  >
                    <SemanticOwnerMarker address={side.rewardControl.marker.address} />
                    <RewardControlEditor
                      control={side.rewardControl}
                      idPrefix={`side-${side.marker.focusKey}`}
                      interactions={interactions}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function FieldsWorkbench({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>;
}) {
  return (
    <div aria-label="Fields cage rewards" className="local-reward-editor">
      {room.cages.map((cage) => (
        <section
          aria-label={cage.label}
          className="local-reward-slot"
          data-active={cage.active}
          key={cage.key}
        >
          <div className="local-reward-heading">
            <div className="owner-markers">
              <h4>{cage.label}</h4>
              <SemanticOwnerMarker address={cage.control.marker.address} />
            </div>
            <span className="neutral-status">{cage.active ? 'Active' : 'Dormant'}</span>
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
    interactions.shipEncounterCounts,
    workspaceInteractionKey(occurrence),
  );

  return (
    <div aria-label="Ship combat encounters" className="ship-combat-editor">
      <CandidateSelect
        id={`room-${occurrence.occurrenceId}-encounter-count`}
        interaction={encounter}
        label="Encounters"
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
        {room.wheels.map((wheel) => {
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
            <section
              aria-label={wheel.label}
              className="reward-wheel"
              data-active={wheel.active}
              key={wheel.key}
            >
              <div className="local-reward-heading">
                <div className="owner-markers">
                  <h4>{wheel.label}</h4>
                  <SemanticOwnerMarker address={wheel.marker.address} />
                </div>
                <span className="neutral-status">{wheel.active ? 'Active' : 'Dormant'}</span>
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
                {wheel.offers.map((offer) => (
                  <section
                    aria-label={offer.label}
                    className="local-reward-slot"
                    data-active={offer.active}
                    key={offer.key}
                  >
                    <div className="local-reward-heading">
                      <div className="owner-markers">
                        <h5>{offer.label}</h5>
                        <SemanticOwnerMarker address={offer.control.marker.address} />
                      </div>
                      <span className="neutral-status">{offer.active ? 'Active' : 'Dormant'}</span>
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
    </div>
  );
}

function ShopWorkbench({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'shop' }>;
}) {
  const dispatch = useAppDispatch();
  if (!room.materialized) {
    return (
      <p className="fixed-room-state">Shop inventory materializes when this room is picked.</p>
    );
  }
  return (
    <div className="shop-editor">
      {room.offers.map((offer) => (
        <section className="shop-offer" key={offer.key}>
          <div className="shop-offer-heading">
            <div className="owner-markers">
              <h4>{offer.label}</h4>
              <SemanticOwnerMarker address={offer.rewardControl.marker.address} />
            </div>
            <ShopPurchaseControl
              address={offer.purchase.address}
              checked={offer.purchase.purchased}
              id={`shop-${offer.purchase.marker.focusKey}-purchased`}
              interactions={interactions}
              onChange={(purchased) =>
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'SetShopPurchase',
                    purchase: offer.purchase.address,
                    purchased,
                  }),
                )
              }
            />
          </div>
          <RewardControlEditor
            control={offer.rewardControl}
            idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
            interactions={interactions}
          />
        </section>
      ))}
    </div>
  );
}

/** A room-local editor that consumes the structured workspace only. */
export function OccurrenceWorkbench({
  interactions,
  nextFrontier,
  room,
}: OccurrenceWorkbenchProps) {
  const dispatch = useAppDispatch();
  const idPrefix = `occurrence-${room.occurrenceId}`;
  const state = room.roomLocal;

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
        </div>
      </header>
      {room.roomPicker === undefined ? null : (
        <RoomSelector
          idPrefix={idPrefix}
          interactions={interactions}
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
          owner={room.roomPicker.address}
        />
      )}
      {state.kind === 'none' ? <p className="fixed-room-state">No room-local reward.</p> : null}
      {state.kind === 'fixed' ? (
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
      {state.kind === 'incomingReward' ? (
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
      {state.kind === 'ephyra' ? (
        <EphyraWorkbench entered={room.entered} interactions={interactions} room={state} />
      ) : null}
      {state.kind === 'fields' ? (
        <FieldsWorkbench interactions={interactions} room={state} />
      ) : null}
      {state.kind === 'ship' ? (
        <ShipWorkbench interactions={interactions} occurrence={room.address} room={state} />
      ) : null}
      {state.kind === 'shop' ? <ShopWorkbench interactions={interactions} room={state} /> : null}
      {room.rewardSummary === undefined ? null : (
        <p className="biome-room-summary">{room.rewardSummary}</p>
      )}
      {nextFrontier === undefined ? null : (
        <button
          className="secondary-action"
          onClick={() => dispatch(semanticOwnerFocused(nextFrontier.address))}
          type="button"
        >
          Move to Next Decision
        </button>
      )}
    </article>
  );
}

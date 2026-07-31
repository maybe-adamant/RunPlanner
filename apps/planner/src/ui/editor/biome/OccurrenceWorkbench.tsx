import type { OccurrenceAddress } from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import { candidateSupport, presentCandidateLabel } from '../../../projections/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceMarker,
  type WorkspaceEphyraSideRoomDescriptor,
  type WorkspaceEphyraSideRoomGroup,
  type WorkspaceRewardControl,
  type WorkspaceRoomSummary,
} from '../../../projections/structured-workspace';
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
  /** Hub visits retain their main offer on the Hub board. */
  readonly presentation: 'full' | 'hubRoomLocal';
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
      <span className="visually-hidden">{side.label} entry order</span>
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

function EphyraWorkbench({
  interactions,
  room,
  showIncomingReward,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'ephyra' }>;
  readonly showIncomingReward: boolean;
}) {
  const dispatch = useAppDispatch();
  const incomingReward = !showIncomingReward ? null : (
    <div className="room-state-with-marker">
      <SemanticOwnerMarker address={room.incomingReward.marker.address} />
      <RewardControlEditor
        control={room.incomingReward}
        idPrefix={`ephyra-${room.incomingReward.marker.focusKey}`}
        interactions={interactions}
      />
    </div>
  );
  if (room.sideRooms.kind === 'withheld') {
    return (
      <>
        {incomingReward}
        {showIncomingReward ? null : (
          <p className="fixed-room-state">
            Side rooms become available after this room is selected in the visit order.
          </p>
        )}
      </>
    );
  }
  const group = room.sideRooms.group;
  return (
    <>
      {incomingReward}
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
        <div className="ephyra-side-grid-scroll">
          <table className="ephyra-side-grid">
            <caption className="visually-hidden">
              Ephyra side-room generation and entry order
            </caption>
            <thead>
              <tr>
                <th scope="col">Side room</th>
                <th scope="col">Generated</th>
                <th scope="col">Entry order</th>
              </tr>
            </thead>
            <tbody>
              {group.slots.map((side) => {
                const generation = requireWorkspaceInteraction(
                  interactions.sideRoomGenerations,
                  workspaceInteractionKey(side.address),
                );
                return (
                  <tr
                    className="ephyra-side-grid-row"
                    data-generated={side.generation === 'generated'}
                    key={side.key}
                  >
                    <th scope="row">
                      <div className="ephyra-side-room-heading">
                        <p className="card-kicker">Door {side.physicalDoorId}</p>
                        <div className="owner-markers">
                          <span>{side.label}</span>
                          <SemanticOwnerMarker address={side.address} />
                        </div>
                      </div>
                      <div className="ephyra-side-reward room-state-with-marker">
                        <SemanticOwnerMarker address={side.rewardControl.marker.address} />
                        <RewardControlEditor
                          control={side.rewardControl}
                          idPrefix={`side-${side.marker.focusKey}`}
                          interactions={interactions}
                        />
                      </div>
                    </th>
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
  const hasRoomLocalDetail =
    state.kind === 'ephyra' ||
    state.kind === 'fields' ||
    state.kind === 'ship' ||
    state.kind === 'shop';

  return (
    <>
      {!showMainReward && !hasRoomLocalDetail ? (
        <p className="fixed-room-state">No additional room details.</p>
      ) : null}
      {showMainReward && state.kind === 'none' ? (
        <p className="fixed-room-state">No room-local reward.</p>
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
      {state.kind === 'ephyra' ? (
        <EphyraWorkbench
          interactions={interactions}
          room={state}
          showIncomingReward={showMainReward}
        />
      ) : null}
      {state.kind === 'fields' ? (
        <FieldsWorkbench interactions={interactions} room={state} />
      ) : null}
      {state.kind === 'ship' ? (
        <ShipWorkbench interactions={interactions} occurrence={room.address} room={state} />
      ) : null}
      {state.kind === 'shop' ? <ShopWorkbench interactions={interactions} room={state} /> : null}
      {!showMainReward || room.rewardSummary === undefined ? null : (
        <p className="biome-room-summary">{room.rewardSummary}</p>
      )}
    </>
  );
}

/** A room-local editor that consumes the structured workspace only. */
export function OccurrenceWorkbench({
  interactions,
  nextFrontier,
  presentation,
  room,
}: OccurrenceWorkbenchProps) {
  const dispatch = useAppDispatch();
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
      <RoomOfferEditor
        idPrefix={idPrefix}
        interactions={interactions}
        presentation={presentation}
        room={room}
      />
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

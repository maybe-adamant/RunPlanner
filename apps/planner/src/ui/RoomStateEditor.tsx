import type {
  BiomeAddress,
  Catalog,
  CountedRewardBinding,
  RoomDeclaration,
  RoomOccurrence,
} from '@run-planner/core';
import {
  createIncomingRewardAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
} from '@run-planner/core';

import { authoredProjectCommandDispatched } from '../application/projectWorkspaceSlice';
import { useAppDispatch } from '../application/store';
import { CountedRewardEditor, RewardValueEditor } from './RewardEditors';
import { SemanticOwnerMarker } from './EvaluationFeedback';

interface RoomStateEditorProps {
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  readonly occurrence: RoomOccurrence;
}

function countedBinding(
  room: RoomDeclaration,
  stateKind: RoomOccurrence['state']['kind'],
): CountedRewardBinding {
  if (stateKind === 'freeReward') {
    if (room.entryOfferPolicy === undefined) {
      throw new Error(`${room.gameName} has no terminal free-reward binding`);
    }
    return room.entryOfferPolicy.freeReward;
  }
  if (room.incomingReward.kind !== 'countedChoice') {
    throw new Error(`${room.gameName} has no counted reward binding`);
  }
  return room.incomingReward;
}

export function RoomStateEditor({ biome, catalog, occurrence }: RoomStateEditorProps) {
  const dispatch = useAppDispatch();
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) {
    throw new Error(`Room declaration ${occurrence.gameName} is missing`);
  }
  const idPrefix = `room-${occurrence.occurrenceId}`;
  const state = occurrence.state;

  if (state.kind === 'none') {
    return <p className="fixed-room-state">No room-local reward.</p>;
  }
  if (state.kind === 'fixed') {
    if (room.incomingReward.kind !== 'fixed') {
      throw new Error(`${room.gameName} has no fixed reward binding`);
    }
    const rewardType = catalog.rewards.rewardTypes.byKey[room.incomingReward.offer.rewardType];
    if (rewardType === undefined) {
      throw new Error(`${room.gameName} fixed reward is missing`);
    }
    return (
      <div className="room-state-with-marker">
        <SemanticOwnerMarker
          address={createIncomingRewardAddress(biome, occurrence.occurrenceId)}
        />
        <p className="fixed-room-state">Fixed reward: {rewardType.label}</p>
      </div>
    );
  }
  if (state.kind === 'counted' || state.kind === 'freeReward') {
    return (
      <div className="room-state-with-marker">
        <SemanticOwnerMarker
          address={createIncomingRewardAddress(biome, occurrence.occurrenceId)}
        />
        <CountedRewardEditor
          binding={countedBinding(room, state.kind)}
          catalog={catalog}
          idPrefix={idPrefix}
          offer={state.offer}
          onReplace={(value) =>
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceIncomingReward',
                reward: createIncomingRewardAddress(biome, occurrence.occurrenceId),
                value,
              }),
            )
          }
        />
      </div>
    );
  }
  if (state.kind === 'fieldsCombat' || state.kind === 'shipCombat') {
    throw new Error(`${room.gameName} ${state.kind} editor is not active`);
  }
  if (state.kind === 'ephyraCombat') {
    throw new Error(`${room.gameName} Ephyra editor is not active`);
  }
  if (state.shop === undefined) {
    return (
      <p className="fixed-room-state">Shop inventory materializes when this room is picked.</p>
    );
  }
  const profile = catalog.rewards.shops.byKey[state.shop.profileKey];
  if (profile === undefined) {
    throw new Error(`Shop profile ${state.shop.profileKey} is missing`);
  }
  return (
    <div className="shop-editor">
      {profile.slots.values.map((slot) => {
        const offerState = state.shop?.offers[slot.key];
        const group = profile.groups.byKey[slot.groupKey];
        if (offerState === undefined || group === undefined) {
          throw new Error(`${profile.key} offer ${slot.key} is incomplete`);
        }
        const offerPrefix = `${idPrefix}-offer-${slot.key}`;
        return (
          <section className="shop-offer" key={slot.key}>
            <div className="shop-offer-heading">
              <div className="owner-markers">
                <h4>{slot.label}</h4>
                <SemanticOwnerMarker
                  address={createShopOfferAddress(biome, occurrence.occurrenceId, slot.key)}
                />
              </div>
              <label className="purchase-control" htmlFor={`${offerPrefix}-purchased`}>
                <SemanticOwnerMarker
                  address={createShopPurchaseAddress(biome, occurrence.occurrenceId, slot.key)}
                />
                <input
                  checked={offerState.purchased}
                  id={`${offerPrefix}-purchased`}
                  onChange={(event) =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'SetShopPurchase',
                        purchase: createShopPurchaseAddress(
                          biome,
                          occurrence.occurrenceId,
                          slot.key,
                        ),
                        purchased: event.target.checked,
                      }),
                    )
                  }
                  type="checkbox"
                />
                Purchased
              </label>
            </div>
            <RewardValueEditor
              catalog={catalog}
              idPrefix={offerPrefix}
              offer={offerState.offer}
              onReplace={(value) =>
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'ReplaceShopOffer',
                    offer: createShopOfferAddress(biome, occurrence.occurrenceId, slot.key),
                    value,
                  }),
                )
              }
              rewardTypes={group.rewardTypes}
            />
          </section>
        );
      })}
    </div>
  );
}

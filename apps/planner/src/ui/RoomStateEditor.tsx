import type {
  BiomeAddress,
  Catalog,
  CountedRewardBinding,
  RoomDeclaration,
  RoomOccurrence,
  ShopPurchaseAddress,
  ProjectDocument,
} from '@run-planner/core';
import {
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
} from '@run-planner/core';
import { useRef, useState } from 'react';

import {
  candidateSupport,
  type CandidateProjectionService,
} from '../application/candidateProjection';
import { authoredProjectCommandDispatched } from '../application/projectWorkspaceSlice';
import { selectPresentProject, useAppDispatch, useAppSelector } from '../application/store';
import { CountedRewardEditor, RewardValueEditor } from './RewardEditors';
import { SemanticOwnerMarker } from './EvaluationFeedback';

interface RoomStateEditorProps {
  readonly activeCageCount?: number;
  readonly biome: BiomeAddress;
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly entryActive?: boolean;
  readonly occurrence: RoomOccurrence;
}

interface ShopPurchaseControlProps {
  readonly address: ShopPurchaseAddress;
  readonly candidateProjection: CandidateProjectionService;
  readonly checked: boolean;
  readonly id: string;
  readonly onChange: (purchased: boolean) => void;
  readonly project: ProjectDocument;
}

function ShopPurchaseControl({
  address,
  candidateProjection,
  checked,
  id,
  onChange,
  project,
}: ShopPurchaseControlProps) {
  type Projection = {
    readonly checked: boolean;
    readonly project: ProjectDocument;
    readonly support: ReturnType<typeof candidateSupport>;
  };
  const projectionRef = useRef<Projection | undefined>(undefined);
  const [projection, setProjection] = useState<Projection>();
  const support =
    projection?.project === project && projection.checked === checked
      ? projection.support
      : 'unavailable';
  const activateProjection = () => {
    if (
      support !== 'unavailable' ||
      (projectionRef.current?.project === project && projectionRef.current.checked === checked)
    ) {
      return;
    }
    const candidate = candidateProjection
      .shopPurchases(project, address, [false, true])
      .find((option) => option.value === checked);
    const next = { checked, project, support: candidateSupport(candidate) };
    projectionRef.current = next;
    setProjection(next);
  };
  return (
    <label className="purchase-control" data-candidate-support={support} htmlFor={id}>
      <SemanticOwnerMarker address={address} />
      <input
        checked={checked}
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        onFocus={activateProjection}
        onPointerDown={activateProjection}
        type="checkbox"
      />
      Purchased
    </label>
  );
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

export function RoomStateEditor({
  activeCageCount,
  biome,
  candidateProjection,
  catalog,
  clockworkReward,
  entryActive,
  occurrence,
}: RoomStateEditorProps) {
  const dispatch = useAppDispatch();
  const project = useAppSelector(selectPresentProject);
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
    const rewardAddress = createIncomingRewardAddress(biome, occurrence.occurrenceId);
    if (state.kind === 'counted' && clockworkReward === 'goal') {
      return (
        <div className="room-state-with-marker clockwork-goal-state">
          <SemanticOwnerMarker address={rewardAddress} />
          <p className="fixed-room-state">Clockwork Goal</p>
        </div>
      );
    }
    return (
      <div className="room-state-with-marker">
        <SemanticOwnerMarker address={rewardAddress} />
        <CountedRewardEditor
          binding={countedBinding(room, state.kind)}
          candidateOwner={{ kind: 'incomingReward', address: rewardAddress }}
          candidateProjection={candidateProjection}
          catalog={catalog}
          idPrefix={idPrefix}
          offer={state.offer}
          onReplace={(value) =>
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceIncomingReward',
                reward: rewardAddress,
                value,
              }),
            )
          }
          project={project}
        />
      </div>
    );
  }
  if (state.kind === 'fieldsCombat') {
    const cages = room.localChildren.find(
      (child) => child.kind === 'boundedRewardSlots' && child.key === 'cages',
    );
    if (cages?.kind !== 'boundedRewardSlots') {
      throw new Error(`${room.gameName} has no bounded Fields cages`);
    }
    if (
      activeCageCount === undefined ||
      activeCageCount < 0 ||
      activeCageCount > cages.slotKeys.length
    ) {
      throw new Error(`${room.gameName} has no valid active Fields cage prefix`);
    }
    return (
      <div className="local-reward-editor" aria-label="Fields cage rewards">
        {cages.slotKeys.map((slotKey, index) => {
          const offer = state.cages[slotKey];
          if (offer === undefined) {
            throw new Error(`${room.gameName} cage ${slotKey} is missing`);
          }
          const address = createLocalRewardAddress(
            biome,
            occurrence.occurrenceId,
            cages.key,
            slotKey,
          );
          const active = index < activeCageCount;
          return (
            <section
              aria-label={`Cage ${index + 1}`}
              className="local-reward-slot"
              data-active={active}
              key={slotKey}
            >
              <div className="local-reward-heading">
                <div className="owner-markers">
                  <h4>Cage {index + 1}</h4>
                  <SemanticOwnerMarker address={address} />
                </div>
                <span className="neutral-status">{active ? 'Active' : 'Dormant'}</span>
              </div>
              <CountedRewardEditor
                binding={cages.reward}
                candidateOwner={{ kind: 'localReward', address }}
                candidateProjection={candidateProjection}
                catalog={catalog}
                idPrefix={`${idPrefix}-${slotKey}`}
                offer={offer}
                onReplace={(value) =>
                  dispatch(
                    authoredProjectCommandDispatched({
                      kind: 'ReplaceLocalReward',
                      reward: address,
                      value,
                    }),
                  )
                }
                project={project}
              />
            </section>
          );
        })}
      </div>
    );
  }
  if (state.kind === 'shipCombat') {
    throw new Error(`${room.gameName} ${state.kind} editor is not active`);
  }
  if (state.kind === 'ephyraCombat') {
    throw new Error(`${room.gameName} Ephyra editor is not active`);
  }
  if (entryActive === false || state.shop === undefined) {
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
        const offerAddress = createShopOfferAddress(biome, occurrence.occurrenceId, slot.key);
        const purchaseAddress = createShopPurchaseAddress(biome, occurrence.occurrenceId, slot.key);
        return (
          <section className="shop-offer" key={slot.key}>
            <div className="shop-offer-heading">
              <div className="owner-markers">
                <h4>{slot.label}</h4>
                <SemanticOwnerMarker address={offerAddress} />
              </div>
              <ShopPurchaseControl
                address={purchaseAddress}
                candidateProjection={candidateProjection}
                checked={offerState.purchased}
                id={`${offerPrefix}-purchased`}
                onChange={(purchased) =>
                  dispatch(
                    authoredProjectCommandDispatched({
                      kind: 'SetShopPurchase',
                      purchase: purchaseAddress,
                      purchased,
                    }),
                  )
                }
                project={project}
              />
            </div>
            <RewardValueEditor
              candidateOwner={{ kind: 'shopOffer', address: offerAddress }}
              candidateProjection={candidateProjection}
              catalog={catalog}
              idPrefix={offerPrefix}
              offer={offerState.offer}
              onReplace={(value) =>
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'ReplaceShopOffer',
                    offer: offerAddress,
                    value,
                  }),
                )
              }
              project={project}
              rewardTypes={group.rewardTypes}
            />
          </section>
        );
      })}
    </div>
  );
}

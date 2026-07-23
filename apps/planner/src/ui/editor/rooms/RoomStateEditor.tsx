import type { BiomeAddress, RoomOccurrence } from '@run-planner/engine/authored-project';
import {
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding } from '@run-planner/engine/reward-kernel';

import {
  presentCandidateLabel,
  type CandidateProjectionService,
} from '../../../projections/candidateProjection';
import type { RewardPickerProjectionService } from '../../../projections/rewardPicker';
import { authoredProjectCommandDispatched } from '../../../state/projectWorkspaceSlice';
import { selectPresentProject, useAppDispatch, useAppSelector } from '../../../state/store';
import { candidateSelectState } from '../../feedback/candidatePresentation';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';
import { CountedRewardEditor } from '../rewards/RewardEditors';
import { FieldsCageReward, ShopOfferEditor } from './RoomStateSections';

interface RoomStateEditorProps {
  readonly activeCageCount?: number;
  readonly biome: BiomeAddress;
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly entryActive?: boolean;
  readonly occurrence: RoomOccurrence;
  readonly rewardPicker: RewardPickerProjectionService;
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
  rewardPicker,
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
  if (state.kind === 'counted' || state.kind === 'freeReward' || state.kind === 'ephyraCombat') {
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
          rewardPicker={rewardPicker}
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
            <FieldsCageReward
              active={active}
              address={address}
              binding={cages.reward}
              candidateProjection={candidateProjection}
              idPrefix={`${idPrefix}-${slotKey}`}
              key={slotKey}
              label={`Cage ${index + 1}`}
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
              rewardPicker={rewardPicker}
            />
          );
        })}
      </div>
    );
  }
  if (state.kind === 'shipCombat') {
    const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
    const wheelDescriptors = profile?.phases.flatMap((phase) =>
      phase.offerPoint === undefined ? [] : [phase.offerPoint],
    );
    if (
      profile?.key !== 'ShipCombat' ||
      wheelDescriptors?.length !== 2 ||
      wheelDescriptors[0]?.key !== 'wheel1' ||
      wheelDescriptors[1]?.key !== 'wheel2'
    ) {
      throw new Error(`${room.gameName} has no complete ShipCombat wheel profile`);
    }
    const occurrenceAddress = createOccurrenceAddress(biome, occurrence.occurrenceId);
    const encounterCounts = candidateProjection.shipEncounterCounts(
      project,
      occurrenceAddress,
      [2, 3],
    );
    const selectedEncounterCount = encounterCounts.find(
      (option) => option.value === state.encounterCount,
    );
    return (
      <div className="ship-combat-editor" aria-label="Ship combat encounters">
        <label className="field-control" htmlFor={`${idPrefix}-encounter-count`}>
          <span>Encounters</span>
          <select
            {...candidateSelectState(selectedEncounterCount)}
            id={`${idPrefix}-encounter-count`}
            onChange={(event) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceShipEncounterCount',
                  occurrence: occurrenceAddress,
                  encounterCount: Number(event.target.value) as 2 | 3,
                }),
              )
            }
            value={String(state.encounterCount)}
          >
            {encounterCounts.map((option) => (
              <option key={option.value} value={option.value} {...candidateSelectState(option)}>
                {presentCandidateLabel(
                  option.value === 2 ? 'Intro + 1 combat' : 'Intro + 2 combats',
                  option,
                )}
              </option>
            ))}
          </select>
        </label>

        <div className="reward-wheel-list">
          {wheelDescriptors.map((descriptor, wheelIndex) => {
            const wheel = state.wheels[descriptor.key];
            if (wheel === undefined) {
              throw new Error(`${room.gameName} is missing ${descriptor.key}`);
            }
            const wheelAddress = createRewardWheelAddress(
              biome,
              occurrence.occurrenceId,
              descriptor.key,
            );
            const active = wheelIndex === 0 || state.encounterCount === 3;
            const offerCounts = candidateProjection.rewardWheelOfferCounts(
              project,
              wheelAddress,
              Array.from(
                { length: descriptor.offerCount.max - descriptor.offerCount.min + 1 },
                (_, index) => descriptor.offerCount.min + index,
              ),
            );
            const stores = candidateProjection.rewardWheelStores(
              project,
              wheelAddress,
              descriptor.reward.storeKeys,
            );
            const picks = candidateProjection.rewardWheelPicks(
              project,
              wheelAddress,
              Array.from({ length: wheel.offerCount }, (_, index) => index + 1),
            );
            return (
              <section
                aria-label={`Reward wheel ${wheelIndex + 1}`}
                className="reward-wheel"
                data-active={active}
                key={descriptor.key}
              >
                <div className="local-reward-heading">
                  <div className="owner-markers">
                    <h4>Reward wheel {wheelIndex + 1}</h4>
                    <SemanticOwnerMarker address={wheelAddress} />
                  </div>
                  <span className="neutral-status">{active ? 'Active' : 'Dormant'}</span>
                </div>
                <div className="reward-wheel-settings">
                  <label className="field-control" htmlFor={`${idPrefix}-${descriptor.key}-store`}>
                    <span>Reward pool</span>
                    <select
                      {...candidateSelectState(
                        stores.find((option) => option.value === wheel.storeKey),
                      )}
                      id={`${idPrefix}-${descriptor.key}-store`}
                      onChange={(event) =>
                        dispatch(
                          authoredProjectCommandDispatched({
                            kind: 'ReplaceRewardWheelStore',
                            wheel: wheelAddress,
                            storeKey: event.target.value,
                          }),
                        )
                      }
                      value={wheel.storeKey}
                    >
                      {stores.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          {...candidateSelectState(option)}
                        >
                          {presentCandidateLabel(option.value, option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-control" htmlFor={`${idPrefix}-${descriptor.key}-count`}>
                    <span>Offers</span>
                    <select
                      {...candidateSelectState(
                        offerCounts.find((option) => option.value === wheel.offerCount),
                      )}
                      id={`${idPrefix}-${descriptor.key}-count`}
                      onChange={(event) =>
                        dispatch(
                          authoredProjectCommandDispatched({
                            kind: 'ReplaceRewardWheelOfferCount',
                            wheel: wheelAddress,
                            offerCount: Number(event.target.value),
                          }),
                        )
                      }
                      value={String(wheel.offerCount)}
                    >
                      {offerCounts.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          {...candidateSelectState(option)}
                        >
                          {presentCandidateLabel(String(option.value), option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-control" htmlFor={`${idPrefix}-${descriptor.key}-pick`}>
                    <span>Picked offer</span>
                    <select
                      {...candidateSelectState(
                        picks.find((option) => option.value === wheel.pickedOfferIndex),
                      )}
                      id={`${idPrefix}-${descriptor.key}-pick`}
                      onChange={(event) =>
                        dispatch(
                          authoredProjectCommandDispatched({
                            kind: 'ReplaceRewardWheelPicked',
                            wheel: wheelAddress,
                            pickedOfferIndex: Number(event.target.value),
                          }),
                        )
                      }
                      value={String(wheel.pickedOfferIndex)}
                    >
                      {picks.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          {...candidateSelectState(option)}
                        >
                          {presentCandidateLabel(`Offer ${option.value}`, option)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="reward-wheel-offers">
                  {descriptor.offerKeys.map((offerKey, offerIndex) => {
                    const offer = wheel.offers[offerKey];
                    if (offer === undefined) {
                      throw new Error(`${room.gameName}.${descriptor.key} is missing ${offerKey}`);
                    }
                    const address = createRewardWheelOfferAddress(
                      biome,
                      occurrence.occurrenceId,
                      descriptor.key,
                      offerKey,
                    );
                    const offerActive = active && offerIndex < wheel.offerCount;
                    return (
                      <section
                        aria-label={`Offer ${offerIndex + 1}`}
                        className="local-reward-slot"
                        data-active={offerActive}
                        key={offerKey}
                      >
                        <div className="local-reward-heading">
                          <div className="owner-markers">
                            <h5>Offer {offerIndex + 1}</h5>
                            <SemanticOwnerMarker address={address} />
                          </div>
                          <span className="neutral-status">
                            {offerActive ? 'Active' : 'Dormant'}
                          </span>
                        </div>
                        <CountedRewardEditor
                          binding={descriptor.reward}
                          candidateOwner={{ kind: 'rewardWheelOffer', address }}
                          candidateProjection={candidateProjection}
                          idPrefix={`${idPrefix}-${descriptor.key}-${offerKey}`}
                          offer={offer}
                          onReplace={(value) =>
                            dispatch(
                              authoredProjectCommandDispatched({
                                kind: 'ReplaceRewardWheelOffer',
                                offer: address,
                                value,
                              }),
                            )
                          }
                          project={project}
                          rewardPicker={rewardPicker}
                        />
                      </section>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
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
          <ShopOfferEditor
            address={offerAddress}
            candidateProjection={candidateProjection}
            idPrefix={offerPrefix}
            key={slot.key}
            label={slot.label}
            offer={offerState.offer}
            onPurchase={(purchased) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'SetShopPurchase',
                  purchase: purchaseAddress,
                  purchased,
                }),
              )
            }
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
            rewardPicker={rewardPicker}
            purchaseAddress={purchaseAddress}
            purchased={offerState.purchased}
            rewardTypes={group.rewardTypes}
          />
        );
      })}
    </div>
  );
}

import type {
  BiomeAddress,
  OccurrenceAddress,
  RewardWheelAddress,
  RoomOccurrence,
} from '@run-planner/engine/authored-project';
import {
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import { presentCandidateLabel } from '../../../projections/candidateProjection';
import type { WorkspaceContextualResolver } from '../../../projections/structuredWorkspace';
import { authoredProjectCommandDispatched } from '../../../state/projectWorkspaceSlice';
import { useAppDispatch } from '../../../state/store';
import { candidateSelectState } from '../../feedback/candidatePresentation';
import { useLazyCandidateOptions } from '../../controls/useLazyCandidateOptions';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';
import { CountedRewardEditor } from '../rewards/RewardEditors';
import { FieldsCageReward, ShopOfferEditor } from './RoomStateSections';

interface RoomStateEditorProps {
  readonly activeCageCount?: number;
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly contextual: WorkspaceContextualResolver;
  readonly entryActive?: boolean;
  readonly occurrence: RoomOccurrence;
}

function ShipEncounterCountControl({
  contextual,
  id,
  occurrence,
  onReplace,
  value,
}: {
  readonly contextual: WorkspaceContextualResolver;
  readonly id: string;
  readonly occurrence: OccurrenceAddress;
  readonly onReplace: (value: 2 | 3) => void;
  readonly value: 2 | 3;
}) {
  const values = [2, 3] as const;
  const candidates = useLazyCandidateOptions(contextual, `ship-encounters:${id}`, () =>
    contextual.resolveShipEncounterCounts(occurrence, values),
  );
  const selected = candidates.options?.find((option) => option.value === value);
  return (
    <label className="field-control" htmlFor={id}>
      <span>Encounters</span>
      <select
        {...candidateSelectState(selected)}
        id={id}
        onChange={(event) => onReplace(Number(event.target.value) as 2 | 3)}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        value={String(value)}
      >
        {values.map((candidateValue) => {
          const option = candidates.options?.find(
            (candidate) => candidate.value === candidateValue,
          );
          return (
            <option key={candidateValue} value={candidateValue} {...candidateSelectState(option)}>
              {presentCandidateLabel(
                candidateValue === 2 ? 'Intro + 1 combat' : 'Intro + 2 combats',
                option,
              )}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function RewardWheelSettings({
  contextual,
  idPrefix,
  onReplaceOfferCount,
  onReplacePicked,
  onReplaceStore,
  offerCount,
  offerCounts,
  pickedOfferIndex,
  storeKey,
  storeKeys,
  wheel,
}: {
  readonly contextual: WorkspaceContextualResolver;
  readonly idPrefix: string;
  readonly offerCount: number;
  readonly offerCounts: readonly number[];
  readonly onReplaceOfferCount: (value: number) => void;
  readonly onReplacePicked: (value: number) => void;
  readonly onReplaceStore: (value: string) => void;
  readonly pickedOfferIndex: number;
  readonly storeKey: string;
  readonly storeKeys: readonly string[];
  readonly wheel: RewardWheelAddress;
}) {
  const pickedValues = Array.from({ length: offerCount }, (_, index) => index + 1);
  const stores = useLazyCandidateOptions(contextual, `wheel-store:${idPrefix}`, () =>
    contextual.resolveRewardWheelStores(wheel, storeKeys),
  );
  const counts = useLazyCandidateOptions(contextual, `wheel-count:${idPrefix}`, () =>
    contextual.resolveRewardWheelOfferCounts(wheel, offerCounts),
  );
  const picks = useLazyCandidateOptions(contextual, `wheel-pick:${idPrefix}`, () =>
    contextual.resolveRewardWheelPicks(wheel, pickedValues),
  );
  return (
    <div className="reward-wheel-settings">
      <label className="field-control" htmlFor={`${idPrefix}-store`}>
        <span>Reward pool</span>
        <select
          {...candidateSelectState(stores.options?.find((option) => option.value === storeKey))}
          id={`${idPrefix}-store`}
          onChange={(event) => onReplaceStore(event.target.value)}
          onFocus={stores.activate}
          onPointerDown={stores.activate}
          value={storeKey}
        >
          {storeKeys.map((candidateValue) => {
            const option = stores.options?.find((candidate) => candidate.value === candidateValue);
            return (
              <option key={candidateValue} value={candidateValue} {...candidateSelectState(option)}>
                {presentCandidateLabel(candidateValue, option)}
              </option>
            );
          })}
        </select>
      </label>
      <label className="field-control" htmlFor={`${idPrefix}-count`}>
        <span>Offers</span>
        <select
          {...candidateSelectState(counts.options?.find((option) => option.value === offerCount))}
          id={`${idPrefix}-count`}
          onChange={(event) => onReplaceOfferCount(Number(event.target.value))}
          onFocus={counts.activate}
          onPointerDown={counts.activate}
          value={String(offerCount)}
        >
          {offerCounts.map((candidateValue) => {
            const option = counts.options?.find((candidate) => candidate.value === candidateValue);
            return (
              <option key={candidateValue} value={candidateValue} {...candidateSelectState(option)}>
                {presentCandidateLabel(String(candidateValue), option)}
              </option>
            );
          })}
        </select>
      </label>
      <label className="field-control" htmlFor={`${idPrefix}-pick`}>
        <span>Picked offer</span>
        <select
          {...candidateSelectState(
            picks.options?.find((option) => option.value === pickedOfferIndex),
          )}
          id={`${idPrefix}-pick`}
          onChange={(event) => onReplacePicked(Number(event.target.value))}
          onFocus={picks.activate}
          onPointerDown={picks.activate}
          value={String(pickedOfferIndex)}
        >
          {pickedValues.map((candidateValue) => {
            const option = picks.options?.find((candidate) => candidate.value === candidateValue);
            return (
              <option key={candidateValue} value={candidateValue} {...candidateSelectState(option)}>
                {presentCandidateLabel(`Offer ${candidateValue}`, option)}
              </option>
            );
          })}
        </select>
      </label>
    </div>
  );
}

export function RoomStateEditor({
  activeCageCount,
  biome,
  catalog,
  clockworkReward,
  contextual,
  entryActive,
  occurrence,
}: RoomStateEditorProps) {
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
          candidateOwner={{ kind: 'incomingReward', address: rewardAddress }}
          contextual={contextual}
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
              contextual={contextual}
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
    return (
      <div className="ship-combat-editor" aria-label="Ship combat encounters">
        <ShipEncounterCountControl
          contextual={contextual}
          id={`${idPrefix}-encounter-count`}
          occurrence={occurrenceAddress}
          onReplace={(encounterCount) =>
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceShipEncounterCount',
                occurrence: occurrenceAddress,
                encounterCount,
              }),
            )
          }
          value={state.encounterCount}
        />

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
            const wheelIdPrefix = `${idPrefix}-${descriptor.key}`;
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
                <RewardWheelSettings
                  contextual={contextual}
                  idPrefix={wheelIdPrefix}
                  offerCount={wheel.offerCount}
                  offerCounts={Array.from(
                    { length: descriptor.offerCount.max - descriptor.offerCount.min + 1 },
                    (_, index) => descriptor.offerCount.min + index,
                  )}
                  onReplaceOfferCount={(offerCount) =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ReplaceRewardWheelOfferCount',
                        wheel: wheelAddress,
                        offerCount,
                      }),
                    )
                  }
                  onReplacePicked={(pickedOfferIndex) =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ReplaceRewardWheelPicked',
                        wheel: wheelAddress,
                        pickedOfferIndex,
                      }),
                    )
                  }
                  onReplaceStore={(storeKey) =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ReplaceRewardWheelStore',
                        wheel: wheelAddress,
                        storeKey,
                      }),
                    )
                  }
                  pickedOfferIndex={wheel.pickedOfferIndex}
                  storeKey={wheel.storeKey}
                  storeKeys={descriptor.reward.storeKeys}
                  wheel={wheelAddress}
                />
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
                          candidateOwner={{ kind: 'rewardWheelOffer', address }}
                          contextual={contextual}
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
            contextual={contextual}
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
            purchaseAddress={purchaseAddress}
            purchased={offerState.purchased}
          />
        );
      })}
    </div>
  );
}

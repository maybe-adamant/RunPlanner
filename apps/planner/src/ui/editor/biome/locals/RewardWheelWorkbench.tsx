import { type OccurrenceAddress } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRewardWheelDescriptor,
  type WorkspaceRoomRerolls,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { useFindingAnchor, useFindingMark } from '@planner/ui/feedback/useFindingTarget';
import {
  candidateMayBeAuthored,
  candidateWaitingHint,
  candidateWaits,
} from '@planner/ui/feedback/candidatePresentation';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { CandidatePicker } from '../CandidatePicker';
import { DoorRow, DoorRowsHeader, RewardPoolLine } from '../DecisionWorkbench';
import { RerolledRewardRepairs, RowReward } from '../DoorRewardEditor';
import { RoomRerolls } from '../RoomRerolls';
import { hintProps } from '@planner/ui/controls/hint';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';
import { LeaveRow } from '../TimelineDoors';

/**
 * One wheel in the doors' language: its pool line and offer count, then its
 * offers as rows of the door table, then its rerolls. The tab names the wheel.
 */
export function RewardWheelWorkbench({
  inTimeline = false,
  interactions,
  occurrence,
  rerolls,
  wheel,
}: {
  /** On its phase's Timeline the wheel shows its offers as first drawn; the pick has its own row. */
  readonly inTimeline?: boolean;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly occurrence: OccurrenceAddress;
  /** The wheel's offer rerolls, appended before the pick. */
  readonly rerolls?: WorkspaceRoomRerolls;
  readonly wheel: WorkspaceRewardWheelDescriptor;
}) {
  const findingAnchor = useFindingAnchor();
  const findingMark = useFindingMark();
  const dispatch = useAppDispatch();
  const store = requireWorkspaceInteraction(
    interactions.rewardWheelStores,
    workspaceInteractionKey(wheel.address),
  );
  const count = requireWorkspaceInteraction(
    interactions.rewardWheelOfferCounts,
    workspaceInteractionKey(wheel.address),
  );
  const pick = requireWorkspaceInteraction(
    interactions.rewardWheelPicks,
    workspaceInteractionKey(wheel.address),
  );
  const pickCandidates = useWorkspaceInteraction(pick);
  const idPrefix = `room-${occurrence.occurrenceId}-${wheel.key}`;
  const replacePick = (pickedOfferIndex: number): void => {
    const candidateResults = pickCandidates.result ?? pickCandidates.activate();
    if (candidateResults === undefined) return;
    const candidate = candidateResults.find((option) => option.value === pickedOfferIndex);
    if (!candidateMayBeAuthored(candidate)) return;
    dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceRewardWheelPicked',
        wheel: wheel.address,
        pickedOfferIndex,
      }),
    );
  };
  const choosesOffer = wheel.offerCount > 1 && !inTimeline;

  return (
    <section
      {...findingAnchor(wheel.marker.address)}
      tabIndex={-1}
      aria-label={wheel.label}
      className="door-workbench"
    >
      <div className="door-body">
        <div className="door-batch">
          <div className="reward-wheel-settings">
            <RewardPoolLine
              label="Reward Pool"
              picker={
                <CandidatePicker
                  id={`${idPrefix}-store`}
                  interaction={store}
                  label="Reward Pool"
                  placeholder="Select pool"
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
              }
            />
            <CandidatePicker
              id={`${idPrefix}-count`}
              interaction={count}
              label="Offers"
              placeholder="Choose"
              searchable={false}
              triggerSize="content"
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
        </div>
        <div
          aria-label="Wheel offers"
          className="door-rows"
          data-columns="offer"
          // The rows stay named articles; their radios group natively by name.
          role="group"
        >
          <DoorRowsHeader identity="Offer" room="" />
          {wheel.offers
            .filter((offer) => offer.active)
            .map((offer, index) => {
              const offerIndex = index + 1;
              const picked = offerIndex === wheel.pickedOfferIndex;
              const pickWaits =
                !pick.contextReached ||
                candidateWaits(
                  pickCandidates.result?.find((option) => option.value === offerIndex),
                );
              return (
                <DoorRow
                  ariaLabel={offer.label}
                  identity={<span className="door-row-number">{offer.label}</span>}
                  key={offer.key}
                  reward={
                    <span className="door-row-rewards">
                      <RowReward
                        first={
                          <RewardControlEditor
                            ariaLabel="Reward"
                            control={offer.control}
                            idPrefix={`${idPrefix}-${offer.key}`}
                            interactions={interactions}
                            label=""
                          />
                        }
                        reward={inTimeline ? {} : offer}
                      />
                    </span>
                  }
                  room={null}
                  secondary={<RerolledRewardRepairs rewards={[offer]} target={offer.label} />}
                  {...(choosesOffer
                    ? {
                        selection: (
                          <input
                            {...(pickWaits ? {} : findingMark(wheel.marker.address, 'wheelChoice'))}
                            aria-label={`Pick ${offer.label} from ${wheel.label}`}
                            checked={picked}
                            disabled={pickWaits || undefined}
                            name={`${idPrefix}-picked-offer`}
                            onChange={() => replacePick(offerIndex)}
                            onFocus={pickCandidates.activate}
                            onPointerDown={pickCandidates.activate}
                            {...hintProps(pickWaits ? candidateWaitingHint : undefined)}
                            type="radio"
                          />
                        ),
                      }
                    : {})}
                  state={{ available: true, picked }}
                />
              );
            })}
        </div>
        {rerolls === undefined || inTimeline ? null : (
          <RoomRerolls interactions={interactions} rerolls={rerolls} />
        )}
      </div>
    </section>
  );
}

/** The phase's last row: which wheel offer is taken, then that offer's reward as it stands. */
export function SelectWheelRow({
  interactions,
  wheel,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly wheel: WorkspaceRewardWheelDescriptor;
}) {
  const findingMark = useFindingMark();
  const dispatch = useAppDispatch();
  const pick = requireWorkspaceInteraction(
    interactions.rewardWheelPicks,
    workspaceInteractionKey(wheel.address),
  );
  const pickCandidates = useWorkspaceInteraction(pick);
  const offers = wheel.offers.filter((offer) => offer.active);
  const chosen = offers[wheel.pickedOfferIndex - 1];
  const chosenReward = chosen === undefined ? null : (chosen.rerolledOffer ?? chosen.control.offer);
  const choices = offers.map((offer, index) => ({
    key: offer.key,
    value: index + 1,
    label: offer.label,
  }));
  return (
    <LeaveRow label="Select wheel">
      <span className="timeline-leave-door">
        {offers.length > 1 ? (
          <ContextualPicker<number>
            ariaLabel={`${wheel.label} offer`}
            findingMark={findingMark(wheel.marker.address, 'wheelChoice')}
            id={`wheel-pick-${wheel.key}`}
            label=""
            {...(pick.contextReached ? {} : { disabledHint: candidateWaitingHint })}
            layout="inline"
            model={declaredChoicesPicker(choices, wheel.pickedOfferIndex)}
            onOpenChange={(open) => {
              if (open) pickCandidates.activate();
            }}
            onSelect={(pickedOfferIndex) => {
              const results = pickCandidates.result ?? pickCandidates.activate();
              const candidate = results?.find((option) => option.value === pickedOfferIndex);
              if (!candidateMayBeAuthored(candidate)) return;
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceRewardWheelPicked',
                  wheel: wheel.address,
                  pickedOfferIndex,
                }),
              );
            }}
            placeholder="Choose an offer"
            searchable={false}
            {...(chosen === undefined ? {} : { triggerLabel: chosen.label })}
            triggerSize="content"
          />
        ) : (
          <span>{chosen?.label ?? 'Offer'}</span>
        )}
        {chosenReward === null ? null : (
          <>
            <span aria-hidden="true">·</span>
            <ArtworkIcon className="artwork-label-icon" source={offerIcon(chosenReward)} />
          </>
        )}
      </span>
    </LeaveRow>
  );
}

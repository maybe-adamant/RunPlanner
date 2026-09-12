import { type OccurrenceAddress } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRewardWheelDescriptor,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { CandidateSelect } from '../CandidateSelect';

export function RewardWheelWorkbench({
  interactions,
  occurrence,
  wheel,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly occurrence: OccurrenceAddress;
  readonly wheel: WorkspaceRewardWheelDescriptor;
}) {
  const findingTarget = useFindingTarget();
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

  return (
    <section
      {...findingTarget(wheel.marker.address)}
      tabIndex={-1}
      aria-label={wheel.label}
      className="reward-wheel"
    >
      <div className="local-reward-heading">
        <h5>{wheel.label}</h5>
      </div>
      <div className="reward-wheel-settings">
        <CandidateSelect
          bindFindingTarget={false}
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
          bindFindingTarget={false}
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
      <div className="reward-wheel-offers" data-active-offer-count={wheel.offerCount}>
        {wheel.offers
          .filter((offer) => offer.active)
          .map((offer, index) => {
            const offerIndex = index + 1;
            const picked = offerIndex === wheel.pickedOfferIndex;
            return (
              <section
                aria-label={offer.label}
                className="exit-row reward-wheel-offer-card"
                data-available="true"
                data-picked={picked || undefined}
                key={offer.key}
              >
                {wheel.offerCount === 1 ? (
                  <div aria-hidden="true" className="exit-marker" />
                ) : (
                  <label className="picked-control">
                    <span className="visually-hidden">{`Pick ${offer.label} from ${wheel.label}`}</span>
                    <input
                      aria-label={`Pick ${offer.label} from ${wheel.label}`}
                      checked={picked}
                      name={`${idPrefix}-picked-offer`}
                      onChange={() => replacePick(offerIndex)}
                      type="radio"
                    />
                  </label>
                )}
                <div className="exit-content">
                  <div className="local-reward-heading">
                    <h6>{offer.label}</h6>
                  </div>
                  <RewardControlEditor
                    control={offer.control}
                    idPrefix={`${idPrefix}-${offer.key}`}
                    interactions={interactions}
                    showAcquisitionChildren={false}
                  />
                </div>
              </section>
            );
          })}
      </div>
    </section>
  );
}

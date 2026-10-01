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
import {
  candidateMayBeAuthored,
  candidateSelectState,
  candidateWaitingTitle,
  candidateWaits,
} from '@planner/ui/feedback/candidatePresentation';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { CandidatePicker } from '../CandidatePicker';

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
  const countCandidates = useWorkspaceInteraction(count);
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
        <CandidatePicker
          bindFindingTarget={false}
          id={`${idPrefix}-store`}
          interaction={store}
          label="Reward pool"
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
        <div className="field-control field-control-inline">
          <span id={`${idPrefix}-count-label`}>Offers</span>
          <div
            className="biome-field-radios"
            role="radiogroup"
            aria-labelledby={`${idPrefix}-count-label`}
          >
            {count.choices.map((choice) => {
              const candidate = countCandidates.result?.find(
                (option) => option.value === choice.value,
              );
              const waiting = !count.contextReached || candidateWaits(candidate);
              const unavailable = candidate !== undefined && !candidateMayBeAuthored(candidate);
              return (
                <label key={choice.value}>
                  <input
                    {...candidateSelectState(candidate)}
                    type="radio"
                    name={`${idPrefix}-count`}
                    checked={count.selected === choice.value}
                    disabled={waiting || unavailable}
                    title={
                      waiting
                        ? candidateWaitingTitle
                        : unavailable
                          ? 'This offer count is unavailable.'
                          : undefined
                    }
                    onFocus={countCandidates.activate}
                    onPointerDown={countCandidates.activate}
                    onChange={() => {
                      const results = countCandidates.result ?? countCandidates.activate();
                      const option = results?.find((entry) => entry.value === choice.value);
                      if (results === undefined || !candidateMayBeAuthored(option)) return;
                      dispatch(
                        authoredProjectCommandDispatched({
                          kind: 'ReplaceRewardWheelOfferCount',
                          wheel: wheel.address,
                          offerCount: choice.value,
                        }),
                      );
                    }}
                  />
                  {choice.value}
                </label>
              );
            })}
          </div>
        </div>
      </div>
      <div className="reward-wheel-offers" data-active-offer-count={wheel.offerCount}>
        {wheel.offers
          .filter((offer) => offer.active)
          .map((offer, index) => {
            const offerIndex = index + 1;
            const picked = offerIndex === wheel.pickedOfferIndex;
            const pickWaits =
              !pick.contextReached ||
              candidateWaits(pickCandidates.result?.find((option) => option.value === offerIndex));
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
                      disabled={pickWaits || undefined}
                      name={`${idPrefix}-picked-offer`}
                      onChange={() => replacePick(offerIndex)}
                      onFocus={pickCandidates.activate}
                      onPointerDown={pickCandidates.activate}
                      title={pickWaits ? candidateWaitingTitle : undefined}
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

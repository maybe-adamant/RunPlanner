import { type OccurrenceAddress } from '@run-planner/engine/authored-project';
import { candidateSupport, presentCandidateLabel } from '@planner/projections/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceEncounterInteraction,
  type WorkspaceEncounterPhase,
  type WorkspaceInteractionCatalog,
  type WorkspaceLocalVisitDecision,
  type WorkspaceRoomActions,
  type WorkspaceRoomSummary,
  type WorkspaceRewardWheelDescriptor,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { candidateMayBeAuthored } from '@planner/ui/feedback/candidatePresentation';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { CandidateSelect } from './CandidateSelect';
import { DoorRewardEditor } from './DoorRewardEditor';
import { NemesisEventEditor } from './NemesisEventEditor';

const emptyEncounterPicker: import('@planner/projections/contextualPicker').ContextualPickerModel<string> =
  Object.freeze({ sections: Object.freeze([]) });
function LocalVisitOrderSelect({
  interactions,
  localVisit,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly slot: WorkspaceLocalVisitDecision['slots'][number];
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.localVisitOrders,
    slot.order.interactionKey,
  );
  const candidates = useWorkspaceInteraction(interaction);
  const selectedIndex = slot.order.options.findIndex(
    (option) => option.key === slot.order.selectedKey,
  );
  if (selectedIndex < 0) throw new Error(`${slot.label} has no selected local-visit position`);
  const selectedCandidate = candidates.result?.[selectedIndex];
  const replace = (key: string): void => {
    const optionIndex = slot.order.options.findIndex((option) => option.key === key);
    const option = slot.order.options[optionIndex];
    const candidateResults = candidates.result ?? candidates.activate();
    const candidate = candidateResults?.[optionIndex];
    if (option === undefined || !candidateMayBeAuthored(candidate)) return;
    executeIntent(interaction.intentFor(option.proposedOccurrenceIds));
  };
  return (
    <label className="field-control ephyra-side-entry-order">
      <span className="visually-hidden">{slot.label} visit order</span>
      <select
        aria-busy={candidates.pending || undefined}
        data-candidate-support={candidateSupport(selectedCandidate)}
        onChange={(event) => replace(event.target.value)}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        value={slot.order.selectedKey}
      >
        {slot.order.options.map((option, index) => {
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
      <SemanticOwnerMarker address={localVisit.order} />
    </label>
  );
}

function LocalVisitSlotRow({
  interactions,
  localVisit,
  slot,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly slot: WorkspaceLocalVisitDecision['slots'][number];
}) {
  const executeIntent = useCommandIntent();
  const generation = requireWorkspaceInteraction(
    interactions.localVisitGenerations,
    workspaceInteractionKey(slot.address),
  );
  return (
    <tr className="ephyra-side-grid-row">
      <th scope="row">
        <div className="owner-markers">
          <span>{slot.label}</span>
          <SemanticOwnerMarker address={slot.address} />
        </div>
      </th>
      <td className="ephyra-side-priority">{slot.availabilityRank}</td>
      <td>
        <CandidateSelect
          id={`local-${slot.marker.focusKey}-generation`}
          interaction={generation}
          label={`${slot.label} generation`}
          onReplace={(value) => executeIntent(generation.intentFor(value))}
        />
      </td>
      <td>
        <LocalVisitOrderSelect interactions={interactions} localVisit={localVisit} slot={slot} />
      </td>
      <td>
        {slot.generation !== 'generated' ? null : (
          <DoorRewardEditor
            door={slot.door}
            idPrefix={`local-door-${slot.marker.focusKey}`}
            interactions={interactions}
          />
        )}
      </td>
    </tr>
  );
}

export function LocalVisitWorkbench({
  interactions,
  localVisit,
  nested = false,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly localVisit: WorkspaceLocalVisitDecision;
  readonly nested?: boolean;
}) {
  return (
    <section aria-label="Ephyra side rooms" className="ephyra-side-editor">
      <header className="local-reward-heading">
        <div className="owner-markers">
          {nested ? null : <h4>Side Rooms</h4>}
          <SemanticOwnerMarker address={localVisit.address} />
        </div>
        <span className="neutral-status">
          {localVisit.visitOrder.length} visited · {localVisit.slots.length} possible
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
              <th scope="col">Door reward</th>
            </tr>
          </thead>
          <tbody>
            {localVisit.slots.map((slot) => (
              <LocalVisitSlotRow
                interactions={interactions}
                key={slot.key}
                localVisit={localVisit}
                slot={slot}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CustomizableEncounterPhaseControl({
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
        layout="inline"
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

export function EncounterPhaseControl({
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
        <span>Death Defiance condition</span>
        <input
          checked={gorgonInteraction.selected}
          disabled={!gorgonInteraction.supported && !gorgonInteraction.selected}
          onChange={(event) => executeIntent(gorgonInteraction.intentFor(event.target.checked))}
          type="checkbox"
        />
      </label>
    );
  const ariaLabel = phase.label.endsWith('encounter')
    ? `${phase.label} phase`
    : `${phase.label} encounter phase`;
  const nemesisEditor =
    phase.nemesisEvent === undefined
      ? null
      : (() => {
          const interaction = interactions.nemesisEvents.get(
            workspaceInteractionKey(phase.nemesisEvent.owner),
          );
          return interaction === undefined ? null : (
            <NemesisEventEditor
              interaction={interaction}
              key={`${interaction.key}:${JSON.stringify(interaction.value)}`}
            />
          );
        })();
  if (!phase.customizable) {
    return (
      <section
        aria-label={ariaLabel}
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
        <div className="encounter-phase-settings">
          <p className="fixed-room-state">Encounter: {phase.selectedEncounter.label}</p>
          {figLeafControl}
          {gorgonControl}
          {nemesisEditor}
        </div>
      </section>
    );
  }
  const interaction = requireWorkspaceInteraction(
    interactions.encounterPhases,
    workspaceInteractionKey(phase.address),
  );
  return (
    <section
      aria-label={ariaLabel}
      className="encounter-phase-control"
      id={semanticOwnerControlElementId(phase.address)}
    >
      <div className="local-reward-heading">
        <div className="owner-markers">
          <h4>{phase.label}</h4>
          <SemanticOwnerMarker address={phase.address} />
        </div>
      </div>
      <div className="encounter-phase-settings">
        <CustomizableEncounterPhaseControl
          idPrefix={idPrefix}
          interaction={interaction}
          phase={phase}
        />
        {figLeafControl}
        {gorgonControl}
        {nemesisEditor}
      </div>
    </section>
  );
}

export function FieldsWorkbench({
  interactions,
  nested = false,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly nested?: boolean;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>;
}) {
  const dispatch = useAppDispatch();
  return (
    <section aria-label="Fields setup" className="fields-room-editor">
      {nested ? null : (
        <div className="local-reward-heading">
          <h4>Fields setup</h4>
        </div>
      )}
      <label className="field-control field-control-inline">
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
      <div className="fields-reward-identities">
        <div className="local-reward-heading">
          <h5>Optional reward identities</h5>
        </div>
        {room.optionalRewards.map((reward) => (
          <div className="fields-reward-identity" key={reward.key}>
            <RewardControlEditor
              control={reward.control}
              idPrefix={`fields-${room.owner.occurrenceId}-optional-${reward.key}`}
              interactions={interactions}
              label={reward.label}
              showAcquisitionChildren={false}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function RewardWheelWorkbench({
  interactions,
  occurrence,
  wheel,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly occurrence: OccurrenceAddress;
  readonly wheel: WorkspaceRewardWheelDescriptor;
}) {
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
    <section aria-label={wheel.label} className="reward-wheel">
      <div className="local-reward-heading">
        <div className="owner-markers">
          <h5>{wheel.label}</h5>
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
                    <div className="owner-markers">
                      <h6>{offer.label}</h6>
                      <SemanticOwnerMarker address={offer.control.marker.address} />
                    </div>
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

export function ShopWorkbench({
  actions,
  interactions,
  room,
}: {
  readonly actions?: WorkspaceRoomActions;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'shop' }>;
}) {
  const executeIntent = useCommandIntent();
  const actionInteraction =
    actions === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.roomActions, actions.interactionKey);
  const toggleSupplementalPurchase = (
    purchase: Extract<
      (typeof room.supplementalOffers)[number],
      { readonly purchase: unknown }
    >['purchase'],
  ): void => {
    const proposal = actions?.proposals.find(
      (candidate) =>
        candidate.kind === (purchase.purchased ? 'remove' : 'insert') &&
        candidate.reference.kind === 'interactAcquisitionEntry' &&
        candidate.reference.siteKey === purchase.reference.siteKey &&
        candidate.reference.entryKey === purchase.reference.entryKey,
    );
    if (proposal?.structurallyAuthorable !== true || actionInteraction === undefined) return;
    executeIntent(actionInteraction.intentFor(proposal.key));
  };
  const supplementalLabel = (kind: (typeof room.supplementalOffers)[number]['kind']): string =>
    kind === 'infernalContractReward'
      ? 'Contract'
      : kind === 'travelDealPlaceholder' ||
          kind === 'travelDealInvalid' ||
          kind === 'travelDealRefill'
        ? 'Travel Deal'
        : 'Echo Gold';
  if (!room.materialized) {
    return (
      <section aria-label="Shop inventory and conditions" className="shop-editor">
        <div className="local-reward-heading">
          <h4>Shop inventory and conditions</h4>
        </div>
        <p className="fixed-room-state">Shop inventory appears when you select this room.</p>
      </section>
    );
  }
  return (
    <section aria-label="Shop inventory and conditions" className="shop-editor">
      <div className="local-reward-heading">
        <h4>Shop inventory and conditions</h4>
      </div>
      <div className="shop-family-offer-list">
        {room.offers.map((offer) => (
          <div className="shop-family-offer-row" key={offer.key}>
            <div className="owner-markers shop-family-item-control">
              <RewardControlEditor
                control={offer.rewardControl}
                idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
                interactions={interactions}
                label={`${offer.label} Item`}
                showAcquisitionChildren={false}
              />
              <SemanticOwnerMarker address={offer.rewardControl.marker.address} />
            </div>
            <label className="shop-family-participation">
              <input
                aria-label={`Purchased ${offer.label}`}
                checked={offer.participation.purchased}
                onChange={(event) =>
                  executeIntent(
                    requireWorkspaceInteraction(
                      interactions.shopPurchaseParticipations,
                      offer.participation.interactionKey,
                    ).intentFor(event.target.checked),
                  )
                }
                type="checkbox"
              />
              Purchased
            </label>
          </div>
        ))}
        {room.supplementalOffers.map((offer) =>
          offer.kind === 'travelDealPlaceholder' || offer.kind === 'echoDoubleShopPlaceholder' ? (
            <div className="shop-family-offer-placeholder" key={offer.key}>
              <strong>{supplementalLabel(offer.kind)}</strong>
              <span>{offer.explanation}</span>
            </div>
          ) : offer.kind === 'travelDealInvalid' || offer.kind === 'echoDoubleShopInvalid' ? (
            <div className="shop-family-offer-row shop-family-offer-invalid" key={offer.key}>
              <div>
                <strong>{supplementalLabel(offer.kind)}</strong>
                <span>{offer.explanation}</span>
              </div>
              <label className="shop-family-participation">
                <input
                  aria-label={`Purchased ${supplementalLabel(offer.kind)}`}
                  checked={offer.purchase.purchased}
                  onChange={() => toggleSupplementalPurchase(offer.purchase)}
                  type="checkbox"
                />
                Purchased
              </label>
            </div>
          ) : 'rewardControl' in offer ? (
            <div className="shop-family-offer-row" key={offer.key}>
              <div className="owner-markers shop-family-item-control">
                <RewardControlEditor
                  control={offer.rewardControl}
                  idPrefix={`shop-${offer.rewardControl.marker.focusKey}`}
                  interactions={interactions}
                  label={`${supplementalLabel(offer.kind)} Item`}
                  showAcquisitionChildren={false}
                />
                <SemanticOwnerMarker address={offer.rewardControl.marker.address} />
              </div>
              <label className="shop-family-participation">
                <input
                  aria-label={`Purchased ${supplementalLabel(offer.kind)}`}
                  checked={offer.purchase.purchased}
                  onChange={() => toggleSupplementalPurchase(offer.purchase)}
                  type="checkbox"
                />
                Purchased
              </label>
            </div>
          ) : null,
        )}
      </div>
    </section>
  );
}

import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceNaturalChaosExitControl,
  type WorkspaceRoomActions,
  type WorkspaceRoomFeature,
  type WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useOptionalWorkspaceInteraction,
  useWorkspaceInteraction,
} from '@planner/ui/controls/useWorkspaceInteraction';

const emptyNullablePicker: ContextualPickerModel<string | null> = Object.freeze({
  sections: Object.freeze([]),
});
const emptyStringPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});
export function NaturalChaosMapWorkbench({
  control,
  interactions,
}: {
  readonly control: WorkspaceNaturalChaosExitControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.naturalChaosExits,
    workspaceInteractionKey(control.owner),
  );
  return (
    <label
      className="field-control field-control-inline"
      htmlFor={`chaos-map-${control.door.room.occurrenceId}`}
    >
      <span>Map</span>
      <select
        id={`chaos-map-${control.door.room.occurrenceId}`}
        onChange={(event) => executeIntent(interaction.mapIntent(event.target.value))}
        value={control.door.room.gameName}
      >
        {control.mapChoices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The selected Midshop owns only the available spawn affordance. */
function ZagreusSpawnWorkbench({
  feature,
  interactions,
}: {
  readonly feature: Extract<WorkspaceRoomFeature, { readonly kind: 'zagreusContract' }>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const owner = feature.action === 'add' ? feature.control.owner : feature.owner;
  return (
    <section aria-label="Zagreus contract availability" className="zagreus-contract-workbench">
      <div className="owner-markers">
        {feature.action === 'add' ? (
          <button
            className="quiet-action action-compact"
            data-command="AddZagreusContract"
            onClick={() =>
              executeIntent(
                requireWorkspaceInteraction(
                  interactions.zagreusSpawns,
                  workspaceInteractionKey(owner),
                ).spawnIntent(),
              )
            }
            type="button"
          >
            Add Zagreus contract
          </button>
        ) : (
          <button
            className="danger-action action-compact"
            data-command="RemoveZagreusContract"
            onClick={() =>
              executeIntent(
                requireWorkspaceInteraction(
                  interactions.zagreusContracts,
                  workspaceInteractionKey(owner),
                ).removeIntent,
              )
            }
            type="button"
          >
            Remove Zagreus contract
          </button>
        )}
        {feature.action === 'add' ? <SemanticOwnerMarker address={owner} /> : null}
      </div>
    </section>
  );
}

/** A selected source exposes only the declared natural-Chaos creation command. */
function NaturalChaosSpawnWorkbench({
  feature,
  interactions,
}: {
  readonly feature: Extract<WorkspaceRoomFeature, { readonly kind: 'naturalChaos' }>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const owner = feature.action === 'add' ? feature.control.owner : feature.owner;
  return (
    <section aria-label="Natural Chaos availability" className="zagreus-contract-workbench">
      <div className="owner-markers">
        {feature.action === 'add' ? (
          <button
            className="quiet-action action-compact"
            data-command="AddNaturalChaos"
            onClick={() =>
              executeIntent(
                requireWorkspaceInteraction(
                  interactions.naturalChaosSpawns,
                  workspaceInteractionKey(owner),
                ).spawnIntent(),
              )
            }
            type="button"
          >
            Add Chaos gate
          </button>
        ) : (
          <button
            className="danger-action action-compact"
            data-command="RemoveNaturalChaos"
            onClick={() =>
              executeIntent(
                requireWorkspaceInteraction(
                  interactions.naturalChaosExits,
                  workspaceInteractionKey(owner),
                ).removeIntent,
              )
            }
            type="button"
          >
            Remove Chaos gate
          </button>
        )}
        {feature.action === 'add' ? <SemanticOwnerMarker address={owner} /> : null}
      </div>
    </section>
  );
}

/**
 * The workspace has already established this is an authored Anomaly and has
 * supplied its closed declaration map domain. These controls intentionally do
 * not ask React to re-evaluate replacement eligibility or reward legality.
 */
function AnomalyMapControl({ room }: { readonly room: WorkspaceRoomSummary }) {
  const dispatch = useAppDispatch();
  const anomaly = room.anomaly;
  if (anomaly === undefined) return null;
  return (
    <label
      className="field-control field-control-inline"
      htmlFor={`anomaly-map-${room.occurrenceId}`}
    >
      <span>Map</span>
      <select
        id={`anomaly-map-${room.occurrenceId}`}
        onChange={(event) =>
          dispatch(
            authoredProjectCommandDispatched({
              gameName: event.target.value,
              kind: 'ReplaceAnomalyMap',
              occurrence: room.address,
            }),
          )
        }
        value={room.gameName}
      >
        {anomaly.mapChoices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AnomalyClearedControl({ room }: { readonly room: WorkspaceRoomSummary }) {
  const dispatch = useAppDispatch();
  const anomaly = room.anomaly;
  if (anomaly === undefined) return null;
  return (
    <label className="anomaly-outcome-control">
      <input
        checked={anomaly.success}
        onChange={(event) =>
          dispatch(
            authoredProjectCommandDispatched({
              kind: 'ReplaceAnomalySuccess',
              occurrence: room.address,
              success: event.target.checked,
            }),
          )
        }
        type="checkbox"
      />
      <span>Cleared</span>
    </label>
  );
}

function RevertAnomalyAction({ room }: { readonly room: WorkspaceRoomSummary }) {
  const dispatch = useAppDispatch();
  const anomaly = room.anomaly;
  if (anomaly === undefined) return null;
  return (
    <div className="anomaly-revert-action">
      <button
        className="danger-action action-compact"
        data-command="RevertAnomaly"
        onClick={() =>
          dispatch(
            authoredProjectCommandDispatched({
              kind: 'RevertAnomaly',
              occurrence: room.address,
            }),
          )
        }
        type="button"
      >
        Restore {anomaly.rememberedRoomLabel}
      </button>
    </div>
  );
}

/** Identity controls stay on the parent door that owns the takeover transition. */
export function AnomalyIdentityControls({ room }: { readonly room: WorkspaceRoomSummary }) {
  if (room.anomaly === undefined) return null;
  return (
    <div className="anomaly-identity-controls">
      <AnomalyMapControl room={room} />
      <RevertAnomalyAction room={room} />
    </div>
  );
}

export function RoomFeaturesWorkbench({
  features,
  interactions,
  roomActions,
}: {
  readonly features: readonly WorkspaceRoomFeature[];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly roomActions?: WorkspaceRoomActions;
}) {
  const executeIntent = useCommandIntent();
  if (features.length === 0) return null;
  return (
    <section aria-label="Room features" className="room-features-workbench">
      <div className="local-reward-heading">
        <h4>Room features</h4>
      </div>
      {features.map((feature) => {
        switch (feature.kind) {
          case 'nemesisEvent': {
            const interaction = requireWorkspaceInteraction(
              interactions.nemesisFeatures,
              feature.interactionKey,
            );
            return (
              <button
                className={
                  feature.action === 'remove'
                    ? 'danger-action action-compact'
                    : 'secondary-action action-compact'
                }
                key={feature.interactionKey}
                onClick={() => executeIntent(interaction.intent)}
                type="button"
              >
                {feature.action === 'add' ? 'Add Nemesis event' : 'Remove Nemesis event'}
              </button>
            );
          }
          case 'zagreusContract':
            return (
              <ZagreusSpawnWorkbench
                feature={feature}
                interactions={interactions}
                key={workspaceInteractionKey(
                  feature.action === 'add' ? feature.control.owner : feature.owner,
                )}
              />
            );
          case 'naturalChaos':
            return (
              <NaturalChaosSpawnWorkbench
                feature={feature}
                interactions={interactions}
                key={workspaceInteractionKey(
                  feature.action === 'add' ? feature.control.owner : feature.owner,
                )}
              />
            );
          case 'stygianWell':
            return (
              <fieldset className="room-purging-pool" key="stygian-well">
                <legend>Stygian Well</legend>
                {feature.presenceInteractionKey === undefined
                  ? null
                  : (() => {
                      const presence = requireWorkspaceInteraction(
                        interactions.stygianWellPresences,
                        feature.presenceInteractionKey,
                      );
                      return (
                        <label>
                          <input
                            aria-label="Stygian Well present"
                            checked={feature.present}
                            disabled={!feature.present && !feature.placementEligible}
                            onChange={(event) =>
                              executeIntent(presence.intentFor(event.target.checked))
                            }
                            type="checkbox"
                          />
                          Well present
                        </label>
                      );
                    })()}
                {feature.interactionKey === undefined
                  ? null
                  : (() => {
                      const interaction = requireWorkspaceInteraction(
                        interactions.stygianWellInteractions,
                        feature.interactionKey,
                      );
                      return (
                        <label>
                          <input
                            aria-label="Interact with Stygian Well"
                            checked={feature.interacted}
                            onChange={(event) =>
                              executeIntent(interaction.intentFor(event.target.checked))
                            }
                            type="checkbox"
                          />
                          Interact
                        </label>
                      );
                    })()}
                {feature.interacted
                  ? feature.slots.map((slot) => (
                      <StygianWellSlotEditor
                        key={slot.generationKey}
                        slot={slot}
                        interactions={interactions}
                      />
                    ))
                  : null}
              </fieldset>
            );
          case 'purgingPool':
            return (() => {
              const poolInteraction = requireWorkspaceInteraction(
                interactions.purgingPoolInteractions,
                feature.interactionKey,
              );
              return (
                <fieldset className="room-purging-pool" key="purging-pool">
                  <legend>Pool of Purging</legend>
                  <label>
                    <input
                      aria-label="Interact with Pool of Purging"
                      checked={feature.interacted}
                      onChange={(event) =>
                        executeIntent(poolInteraction.intentFor(event.target.checked))
                      }
                      type="checkbox"
                    />
                    Interact
                  </label>
                  {feature.interacted
                    ? feature.slots.map((slot) => {
                        const interaction = requireWorkspaceInteraction(
                          interactions.purgingPoolSlots,
                          slot.interactionKey,
                        );
                        return (
                          <div key={slot.key}>
                            {slot.label}
                            <PurgingPoolTraitPicker
                              interaction={interaction}
                              label={slot.label}
                              {...(slot.traitLabel === undefined
                                ? {}
                                : { selectedLabel: slot.traitLabel })}
                              onSelect={(traitKey) =>
                                executeIntent(interaction.intentFor(traitKey))
                              }
                            />
                            {slot.sale === undefined
                              ? null
                              : (() => {
                                  const reference = {
                                    kind: 'sellPurgingPoolTrait' as const,
                                    slotKey: slot.key,
                                  };
                                  const proposal = roomActions?.proposals.find(
                                    (candidate) =>
                                      candidate.reference.kind === reference.kind &&
                                      candidate.reference.slotKey === reference.slotKey &&
                                      candidate.kind === (slot.sale?.sold ? 'remove' : 'insert'),
                                  );
                                  const actionInteraction =
                                    roomActions === undefined
                                      ? undefined
                                      : requireWorkspaceInteraction(
                                          interactions.roomActions,
                                          roomActions.interactionKey,
                                        );
                                  return (
                                    <span>
                                      <input
                                        aria-label={`Sell ${slot.label}`}
                                        checked={slot.sale.sold}
                                        disabled={
                                          proposal?.structurallyAuthorable !== true ||
                                          actionInteraction === undefined
                                        }
                                        onChange={() =>
                                          proposal === undefined || actionInteraction === undefined
                                            ? undefined
                                            : executeIntent(
                                                actionInteraction.intentFor(proposal.key),
                                              )
                                        }
                                        type="checkbox"
                                      />
                                      Sell
                                    </span>
                                  );
                                })()}
                          </div>
                        );
                      })
                    : null}
                </fieldset>
              );
            })();
          case 'hermesShrine':
            return (
              <fieldset className="room-purging-pool" key="hermes-shrine">
                <legend>Hermes Shrine</legend>
                {feature.presenceInteractionKey === undefined
                  ? null
                  : (() => {
                      const presence = requireWorkspaceInteraction(
                        interactions.hermesShrinePresences,
                        feature.presenceInteractionKey,
                      );
                      return (
                        <label>
                          <input
                            aria-label="Hermes Shrine present"
                            checked={feature.present}
                            disabled={!feature.present && !feature.placementEligible}
                            onChange={(event) =>
                              executeIntent(presence.intentFor(event.target.checked))
                            }
                            type="checkbox"
                          />
                          Shrine present
                        </label>
                      );
                    })()}
                {feature.slots.map((slot) => {
                  const offer = requireWorkspaceInteraction(
                    interactions.hermesShrineOffers,
                    slot.offerInteractionKey,
                  );
                  const purchase = requireWorkspaceInteraction(
                    interactions.hermesShrinePurchases,
                    slot.purchaseInteractionKey,
                  );
                  return (
                    <HermesShrineSlotEditor
                      key={slot.key}
                      label={slot.label}
                      {...(slot.rewardLabel === undefined ? {} : { rewardLabel: slot.rewardLabel })}
                      offer={offer}
                      purchase={purchase}
                    />
                  );
                })}
                {feature.travelDealRefill === undefined
                  ? null
                  : (() => {
                      const refill = feature.travelDealRefill;
                      return (
                        <HermesShrineSlotEditor
                          label="Travel Deal refill"
                          {...(refill.rewardLabel === undefined
                            ? {}
                            : { rewardLabel: refill.rewardLabel })}
                          offer={requireWorkspaceInteraction(
                            interactions.hermesShrineOffers,
                            refill.offerInteractionKey,
                          )}
                          purchase={requireWorkspaceInteraction(
                            interactions.hermesShrinePurchases,
                            refill.purchaseInteractionKey,
                          )}
                        />
                      );
                    })()}
              </fieldset>
            );
        }
      })}
    </section>
  );
}

function PurgingPoolTraitPicker({
  interaction,
  label,
  onSelect,
  selectedLabel,
}: {
  readonly interaction: import('@planner/projections/structured-workspace').WorkspacePurgingPoolSlotInteraction;
  readonly label: string;
  readonly onSelect: (traitKey: string | null) => void;
  readonly selectedLabel?: string;
}) {
  const picker = useWorkspaceInteraction(interaction);
  return (
    <ContextualPicker
      id={`${interaction.key}-picker`}
      label={`Pool of Purging ${label}`}
      loading={picker.pending}
      model={picker.result ?? emptyNullablePicker}
      onOpenChange={(open) => {
        if (open) picker.activate();
      }}
      onSelect={onSelect}
      placeholder="Unresolved"
      {...(selectedLabel === undefined ? {} : { triggerLabel: selectedLabel })}
    />
  );
}

function StygianWellSlotEditor({
  slot,
  interactions,
}: {
  readonly slot: Extract<
    import('@planner/projections/structured-workspace').WorkspaceRoomFeature,
    { readonly kind: 'stygianWell' }
  >['slots'][number];
  readonly interactions: import('@planner/projections/structured-workspace').WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const offer = requireWorkspaceInteraction(
    interactions.stygianWellOffers,
    slot.offerInteractionKey,
  );
  const purchase = requireWorkspaceInteraction(
    interactions.stygianWellPurchases,
    slot.purchaseInteractionKey,
  );
  const offerPicker = useWorkspaceInteraction(offer);
  const twist =
    slot.twist === undefined
      ? undefined
      : requireWorkspaceInteraction(
          interactions.stygianWellTwistResults,
          slot.twist.interactionKey,
        );
  const twistPicker = useOptionalWorkspaceInteraction<ContextualPickerModel<string | null>>(twist);
  return (
    <div className="room-purging-pool-slot">
      <ContextualPicker
        id={`${offer.key}-picker`}
        label={`Stygian Well ${slot.label}`}
        loading={offerPicker.pending}
        model={offerPicker.result ?? emptyNullablePicker}
        onOpenChange={(open) => {
          if (open) offerPicker.activate();
        }}
        onSelect={(itemKey) => executeIntent(offer.intentFor(itemKey))}
        placeholder="Unresolved"
        {...(slot.itemLabel === undefined ? {} : { triggerLabel: slot.itemLabel })}
      />
      <label>
        <input
          aria-label={`Purchase Stygian Well ${slot.label}`}
          checked={slot.purchased}
          disabled={slot.itemKey === null}
          onChange={(event) => executeIntent(purchase.intentFor(event.target.checked))}
          type="checkbox"
        />
        Purchase
      </label>
      {twist === undefined ? null : (
        <ContextualPicker
          id={`${twist.key}-picker`}
          label={`Stygian Well ${slot.label} Twist result`}
          loading={twistPicker.pending}
          model={twistPicker.result ?? emptyNullablePicker}
          onOpenChange={(open) => {
            if (open) twistPicker.activate();
          }}
          onSelect={(itemKey) => executeIntent(twist.intentFor(itemKey))}
          placeholder="Unresolved"
          {...(slot.twist!.itemLabel === undefined ? {} : { triggerLabel: slot.twist!.itemLabel })}
        />
      )}
    </div>
  );
}

function HermesShrineSlotEditor({
  label,
  rewardLabel,
  offer,
  purchase,
}: {
  readonly label: string;
  readonly rewardLabel?: string;
  readonly offer: import('@planner/projections/structured-workspace').WorkspaceHermesShrineOfferInteraction;
  readonly purchase: import('@planner/projections/structured-workspace').WorkspaceHermesShrinePurchaseInteraction;
}) {
  const executeIntent = useCommandIntent();
  const offerPicker = useWorkspaceInteraction(offer);
  const current = purchase.purchase;
  return (
    <div className="hermes-shrine-slot">
      <ContextualPicker
        id={`${offer.key}-picker`}
        label={`Hermes Shrine ${label}`}
        loading={offerPicker.pending}
        model={offerPicker.result ?? emptyStringPicker}
        onOpenChange={(open) => {
          if (open) offerPicker.activate();
        }}
        onSelect={(rewardType) => executeIntent(offer.intentFor(rewardType))}
        placeholder="Unresolved"
        {...(rewardLabel === undefined ? {} : { triggerLabel: rewardLabel })}
      />
      <label>
        <input
          aria-label={`Purchase Hermes Shrine ${label}`}
          checked={current !== null}
          disabled={offer.rewardType === null}
          onChange={(event) =>
            executeIntent(
              purchase.intentFor(event.target.checked ? { delay: 2, rushed: false } : null),
            )
          }
          type="checkbox"
        />
        Purchase
      </label>
      {current === null ? null : (
        <>
          <label>
            Delivery delay
            <select
              aria-label={`Hermes Shrine ${label} delivery delay`}
              onChange={(event) =>
                executeIntent(
                  purchase.intentFor({
                    ...current,
                    delay: Number(event.target.value) as 2 | 3 | 4 | 5 | 6 | 7 | 8,
                  }),
                )
              }
              value={current.delay}
            >
              {[2, 3, 4, 5, 6, 7, 8].map((delay) => (
                <option key={delay} value={delay}>
                  {delay}
                </option>
              ))}
            </select>
          </label>
          {purchase.generationKey === 'travelDealRefill' ? null : (
            <label>
              <input
                aria-label={`Rush Hermes Shrine ${label}`}
                checked={current.rushed}
                onChange={(event) =>
                  executeIntent(purchase.intentFor({ ...current, rushed: event.target.checked }))
                }
                type="checkbox"
              />
              Rushed
            </label>
          )}
        </>
      )}
    </div>
  );
}

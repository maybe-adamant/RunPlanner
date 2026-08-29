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
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useOptionalWorkspaceInteraction,
  useWorkspaceInteraction,
} from '@planner/ui/controls/useWorkspaceInteraction';
import type { ReactNode } from 'react';

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
    <label className="room-feature-presence-row">
      <input
        checked={feature.action === 'remove'}
        data-command={feature.action === 'add' ? 'AddZagreusContract' : 'RemoveZagreusContract'}
        disabled={feature.presence.kind === 'optionalAbsent' && !feature.presence.enabled}
        onChange={() =>
          executeIntent(
            feature.action === 'add'
              ? requireWorkspaceInteraction(
                  interactions.zagreusSpawns,
                  workspaceInteractionKey(owner),
                ).spawnIntent()
              : requireWorkspaceInteraction(
                  interactions.zagreusContracts,
                  workspaceInteractionKey(owner),
                ).removeIntent,
          )
        }
        type="checkbox"
      />
      <span>Zagreus Contract</span>
      <span className="owner-markers">
        {feature.action === 'add' ? <SemanticOwnerMarker address={owner} /> : null}
      </span>
    </label>
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
    <label className="room-feature-presence-row">
      <input
        checked={feature.action === 'remove'}
        data-command={feature.action === 'add' ? 'AddNaturalChaos' : 'RemoveNaturalChaos'}
        disabled={
          feature.presence.kind === 'forcedPresent' ||
          (feature.presence.kind === 'optionalAbsent' && !feature.presence.enabled)
        }
        onChange={() =>
          executeIntent(
            feature.action === 'add'
              ? requireWorkspaceInteraction(
                  interactions.naturalChaosSpawns,
                  workspaceInteractionKey(owner),
                ).spawnIntent()
              : requireWorkspaceInteraction(
                  interactions.naturalChaosExits,
                  workspaceInteractionKey(owner),
                ).removeIntent,
          )
        }
        type="checkbox"
      />
      <span>Chaos Gate</span>
      <span className="owner-markers">
        {feature.action === 'add' ? <SemanticOwnerMarker address={owner} /> : null}
      </span>
    </label>
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

function RoomResourceControls({
  interactions,
  room,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly room: WorkspaceRoomSummary;
}) {
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  return (
    <div aria-label="Resources" className="room-feature-action-list" role="region">
      <p className="resource-uniqueness-caption">
        Each successful element outcome can be placed once across the route.
      </p>
      {room.resources?.map((resource) => (
        <div className="room-feature-presence-row" key={resource.family}>
          <label>
            <input
              checked={resource.action === 'remove'}
              disabled={!resource.legal && resource.action !== 'remove'}
              onChange={() =>
                executeIntent(
                  requireWorkspaceInteraction(
                    interactions.resourcePlacements,
                    resource.interactionKey,
                  ).intent,
                )
              }
              type="checkbox"
            />
            <span>{resource.label}</span>
          </label>
          {resource.action === 'move' && resource.currentPlacement !== undefined ? (
            <span className="resource-placement-disclosure">
              Currently placed at{' '}
              <button
                className="semantic-focus-link"
                onClick={() => dispatch(semanticOwnerNavigated(resource.currentPlacement!.address))}
                type="button"
              >
                {resource.currentPlacement.biomeKey} · {resource.currentPlacement.locationLabel}
              </button>
              . Selecting this room moves it here.
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

type RoomFeaturePresence = Exclude<WorkspaceRoomFeature, { readonly kind: 'nemesisEvent' }>;

type RoomFeatureEntry =
  | { readonly kind: 'heading'; readonly key: string; readonly label: string }
  | { readonly kind: 'content'; readonly key: string; readonly content: ReactNode }
  | { readonly kind: 'feature'; readonly key: string; readonly feature: RoomFeaturePresence };

function featureEntries(
  key: string,
  label: string,
  features: readonly RoomFeaturePresence[],
): readonly RoomFeatureEntry[] {
  return features.length === 0
    ? Object.freeze([])
    : Object.freeze([
        Object.freeze({ kind: 'heading' as const, key: `${key}:heading`, label }),
        ...features.map((feature, index) =>
          Object.freeze({ kind: 'feature' as const, key: `${key}:${index}`, feature }),
        ),
      ]);
}

function contentEntries(
  key: string,
  label: string,
  content: ReactNode | undefined,
): readonly RoomFeatureEntry[] {
  return content === undefined
    ? Object.freeze([])
    : Object.freeze([
        Object.freeze({ kind: 'heading' as const, key: `${key}:heading`, label }),
        Object.freeze({ kind: 'content' as const, key: `${key}:content`, content }),
      ]);
}

export function RoomFeaturesWorkbench({
  features,
  interactions,
  roomActions,
  room,
}: {
  readonly features: readonly WorkspaceRoomFeature[];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly roomActions?: WorkspaceRoomActions;
  readonly room: WorkspaceRoomSummary;
}) {
  const executeIntent = useCommandIntent();
  const additionalExits = features.filter(
    (
      feature,
    ): feature is Extract<
      RoomFeaturePresence,
      { readonly kind: 'naturalChaos' | 'zagreusContract' }
    > => feature.kind === 'naturalChaos' || feature.kind === 'zagreusContract',
  );
  const roomObjects = features.filter(
    (
      feature,
    ): feature is Extract<
      RoomFeaturePresence,
      { readonly kind: 'hermesShrine' | 'purgingPool' | 'stygianWell' }
    > =>
      feature.kind === 'hermesShrine' ||
      feature.kind === 'purgingPool' ||
      feature.kind === 'stygianWell',
  );
  const entries: readonly RoomFeatureEntry[] = Object.freeze([
    ...(room.resources === undefined || room.resources.length === 0
      ? []
      : contentEntries(
          'resources',
          'Resources',
          <RoomResourceControls interactions={interactions} room={room} />,
        )),
    ...featureEntries('additional-exits', 'Additional Exits', additionalExits),
    ...featureEntries('room-objects', 'Objects', roomObjects),
  ]);
  if (entries.length === 0) return null;
  return (
    <section aria-label="Room features" className="room-features-workbench">
      <div className="local-reward-heading">
        <h4>Features</h4>
      </div>
      {entries.map((entry) => {
        if (entry.kind === 'heading') {
          return (
            <h5 className="room-feature-category-heading" key={entry.key}>
              {entry.label}
            </h5>
          );
        }
        if (entry.kind === 'content') {
          return (
            <div className="room-feature-category-content" key={entry.key}>
              {entry.content}
            </div>
          );
        }
        const feature = entry.feature;
        switch (feature.kind) {
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
            return (() => {
              const presence =
                feature.presenceInteractionKey === undefined
                  ? undefined
                  : requireWorkspaceInteraction(
                      interactions.stygianWellPresences,
                      feature.presenceInteractionKey,
                    );
              return (
                <fieldset className="room-purging-pool" key="stygian-well">
                  <legend className="visually-hidden">Stygian Well configuration</legend>
                  <label className="room-feature-presence-row">
                    <input
                      aria-label="Stygian Well present"
                      checked={feature.presence.kind !== 'optionalAbsent'}
                      disabled={presence === undefined}
                      onChange={(event) =>
                        presence === undefined
                          ? undefined
                          : executeIntent(presence.intentFor(event.target.checked))
                      }
                      type="checkbox"
                    />
                    <span>Stygian Well</span>
                  </label>
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
            })();
          case 'purgingPool':
            return (() => {
              const poolInteraction = requireWorkspaceInteraction(
                interactions.purgingPoolInteractions,
                feature.interactionKey,
              );
              return (
                <fieldset className="room-purging-pool" key="purging-pool">
                  <legend className="visually-hidden">Pool of Purging configuration</legend>
                  <label className="room-feature-presence-row">
                    <input aria-label="Pool of Purging" checked disabled type="checkbox" />
                    <span>Pool of Purging</span>
                  </label>
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
            return (() => {
              const presence =
                feature.presenceInteractionKey === undefined
                  ? undefined
                  : requireWorkspaceInteraction(
                      interactions.hermesShrinePresences,
                      feature.presenceInteractionKey,
                    );
              return (
                <fieldset className="room-purging-pool" key="hermes-shrine">
                  <legend className="visually-hidden">Hermes Shrine configuration</legend>
                  <label className="room-feature-presence-row">
                    <input
                      aria-label="Hermes Shrine present"
                      checked={feature.presence.kind !== 'optionalAbsent'}
                      disabled={presence === undefined}
                      onChange={(event) =>
                        presence === undefined
                          ? undefined
                          : executeIntent(presence.intentFor(event.target.checked))
                      }
                      type="checkbox"
                    />
                    <span>Hermes Shrine</span>
                  </label>
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
                        {...(slot.rewardLabel === undefined
                          ? {}
                          : { rewardLabel: slot.rewardLabel })}
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
            })();
        }
      })}
    </section>
  );
}

export function RoomEncounterStructureWorkbench({
  children,
  features,
  interactions,
}: {
  readonly children?: ReactNode;
  readonly features: readonly WorkspaceRoomFeature[];
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const encounters = features.filter((feature) => feature.kind === 'nemesisEvent');
  if (children === undefined && encounters.length === 0) return null;
  return (
    <section aria-label="Encounter structure" className="room-structure-workbench">
      <div className="local-reward-heading">
        <h4>Encounters</h4>
      </div>
      {children}
      {encounters.map((feature) => {
        const interaction = requireWorkspaceInteraction(
          interactions.nemesisFeatures,
          feature.interactionKey,
        );
        return (
          <label className="room-feature-presence-row" key={feature.interactionKey}>
            <input
              checked={feature.action === 'remove'}
              onChange={() => executeIntent(interaction.intent)}
              type="checkbox"
            />
            <span>Nemesis Event</span>
          </label>
        );
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

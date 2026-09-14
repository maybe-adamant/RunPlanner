import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActions,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import type { WorkspacePurgingPoolSlotInteraction } from '@planner/projections/structured-workspace';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useOptionalWorkspaceInteraction,
  useWorkspaceInteraction,
} from '@planner/ui/controls/useWorkspaceInteraction';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

const emptyNullablePicker: ContextualPickerModel<string | null> = Object.freeze({
  sections: Object.freeze([]),
});
const emptyStringPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

type InventoryFeature = Extract<
  WorkspaceRoomFeature,
  { readonly kind: 'hermesShrine' | 'purgingPool' | 'stygianWell' }
>;

export function RoomInventoryPanel({
  feature,
  interactions,
  roomActions,
}: {
  readonly feature: InventoryFeature;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly roomActions?: WorkspaceRoomActions;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  switch (feature.kind) {
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
          <fieldset
            {...(feature.inventoryAddress === undefined
              ? {}
              : findingTarget(feature.inventoryAddress))}
            tabIndex={-1}
            className="room-purging-pool"
            key="stygian-well"
          >
            <legend className="visually-hidden">Stygian Well configuration</legend>
            <div className="room-feature-interaction-header">
              <label className="room-feature-presence-row">
                <input
                  {...findingTarget(feature.presenceAddress)}
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
                      <label className="room-feature-interact-toggle">
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
            </div>
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
          <fieldset
            {...findingTarget(feature.inventoryAddress)}
            tabIndex={-1}
            className="room-purging-pool"
            key="purging-pool"
          >
            <legend className="visually-hidden">Pool of Purging configuration</legend>
            <div className="room-feature-interaction-header">
              <label className="room-feature-presence-row">
                <input aria-label="Pool of Purging" checked disabled type="checkbox" />
                <span>Pool of Purging</span>
              </label>
              <label className="room-feature-interact-toggle">
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
            </div>
            {feature.interacted
              ? feature.slots.map((slot) => {
                  const interaction = requireWorkspaceInteraction(
                    interactions.purgingPoolSlots,
                    slot.interactionKey,
                  );
                  return (
                    <div className="shop-family-offer-row" key={slot.key}>
                      <PurgingPoolTraitPicker
                        address={slot.address}
                        interaction={interaction}
                        label={slot.label}
                        {...(slot.traitLabel === undefined
                          ? {}
                          : { selectedLabel: slot.traitLabel })}
                        onSelect={(traitKey) => executeIntent(interaction.intentFor(traitKey))}
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
                              <label className="shop-family-participation">
                                <input
                                  aria-label={`Sold ${slot.label}`}
                                  checked={slot.sale.sold}
                                  disabled={
                                    proposal?.structurallyAuthorable !== true ||
                                    actionInteraction === undefined
                                  }
                                  onChange={() =>
                                    proposal === undefined || actionInteraction === undefined
                                      ? undefined
                                      : executeIntent(actionInteraction.intentFor(proposal.key))
                                  }
                                  type="checkbox"
                                />
                                Sold
                              </label>
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
          <fieldset
            {...(feature.inventoryAddress === undefined
              ? {}
              : findingTarget(feature.inventoryAddress))}
            tabIndex={-1}
            className="room-purging-pool"
            key="hermes-shrine"
          >
            <legend className="visually-hidden">Hermes Shrine configuration</legend>
            <label className="room-feature-presence-row">
              <input
                {...findingTarget(feature.presenceAddress)}
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
                  marker={slot.marker}
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
                      label="Travel Deal"
                      marker={refill.marker}
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
}

function PurgingPoolTraitPicker({
  address,
  interaction,
  label,
  onSelect,
  selectedLabel,
}: {
  readonly address: import('@run-planner/engine/authored-project').SemanticAddress;
  readonly interaction: WorkspacePurgingPoolSlotInteraction;
  readonly label: string;
  readonly onSelect: (traitKey: string | null) => void;
  readonly selectedLabel?: string;
}) {
  const findingTarget = useFindingTarget();
  const picker = useWorkspaceInteraction(interaction);
  return (
    <ContextualPicker
      findingTarget={findingTarget(address)}
      ariaLabel={`Pool of Purging ${label} Item`}
      id={`${interaction.key}-picker`}
      label={`${label} Item`}
      layout="inline"
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
  const findingTarget = useFindingTarget();
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
    <div className="shop-family-offer-row room-purging-pool-slot">
      <ContextualPicker
        findingTarget={findingTarget(slot.address)}
        ariaLabel={`Stygian Well ${slot.label} Item`}
        id={`${offer.key}-picker`}
        label={`${slot.label} Item`}
        layout="inline"
        loading={offerPicker.pending}
        model={offerPicker.result ?? emptyNullablePicker}
        onOpenChange={(open) => {
          if (open) offerPicker.activate();
        }}
        onSelect={(itemKey) => executeIntent(offer.intentFor(itemKey))}
        placeholder="Unresolved"
        {...(slot.itemLabel === undefined ? {} : { triggerLabel: slot.itemLabel })}
      />
      <label className="shop-family-participation">
        <input
          aria-label={`Purchased Stygian Well ${slot.label}`}
          checked={slot.purchased}
          disabled={slot.itemKey === null}
          onChange={(event) => executeIntent(purchase.intentFor(event.target.checked))}
          type="checkbox"
        />
        Purchased
      </label>
      {twist === undefined ? null : (
        <>
          <ContextualPicker
            findingTarget={findingTarget(slot.twist!.address)}
            ariaLabel={`Stygian Well ${slot.label} Twist result`}
            id={`${twist.key}-picker`}
            label={`${slot.label} Twist result`}
            layout="inline"
            loading={twistPicker.pending}
            model={twistPicker.result ?? emptyNullablePicker}
            onOpenChange={(open) => {
              if (open) twistPicker.activate();
            }}
            onSelect={(itemKey) => executeIntent(twist.intentFor(itemKey))}
            placeholder="Unresolved"
            {...(slot.twist!.itemLabel === undefined
              ? {}
              : { triggerLabel: slot.twist!.itemLabel })}
          />
        </>
      )}
    </div>
  );
}

function HermesShrineSlotEditor({
  label,
  marker,
  rewardLabel,
  offer,
  purchase,
}: {
  readonly label: string;
  readonly marker: import('@planner/projections/structured-workspace').WorkspaceMarker;
  readonly rewardLabel?: string;
  readonly offer: import('@planner/projections/structured-workspace').WorkspaceHermesShrineOfferInteraction;
  readonly purchase: import('@planner/projections/structured-workspace').WorkspaceHermesShrinePurchaseInteraction;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const offerPicker = useWorkspaceInteraction(offer);
  const current = purchase.purchase;
  return (
    <div className="shop-family-offer-row hermes-shrine-slot">
      <ContextualPicker
        findingTarget={findingTarget(marker.address)}
        ariaLabel={`Hermes Shrine ${label} Item`}
        id={`${offer.key}-picker`}
        label={`${label} Item`}
        layout="inline"
        loading={offerPicker.pending}
        model={offerPicker.result ?? emptyStringPicker}
        onOpenChange={(open) => {
          if (open) offerPicker.activate();
        }}
        onSelect={(rewardType) => executeIntent(offer.intentFor(rewardType))}
        placeholder="Unresolved"
        {...(rewardLabel === undefined ? {} : { triggerLabel: rewardLabel })}
      />
      <label className="shop-family-participation">
        <input
          aria-label={`Purchased Hermes Shrine ${label}`}
          checked={current !== null}
          disabled={offer.rewardType === null}
          onChange={(event) =>
            executeIntent(
              purchase.intentFor(event.target.checked ? { delay: 2, rushed: false } : null),
            )
          }
          type="checkbox"
        />
        Purchased
      </label>
      <div className="hermes-shrine-purchase-details">
        <label className="hermes-shrine-delay-control">
          Delay
          <select
            aria-label={`Hermes Shrine ${label} delivery delay`}
            disabled={current === null}
            onChange={(event) => {
              if (current === null) return;
              executeIntent(
                purchase.intentFor({
                  ...current,
                  delay: Number(event.target.value) as 2 | 3 | 4 | 5 | 6 | 7 | 8,
                }),
              );
            }}
            value={current?.delay ?? ''}
          >
            {current === null && (
              <option value="" disabled>
                Random
              </option>
            )}
            {[2, 3, 4, 5, 6, 7, 8].map((delay) => (
              <option key={delay} value={delay}>
                {delay}
              </option>
            ))}
          </select>
        </label>
        <label className="shop-family-participation">
          <input
            aria-label={`Rush Hermes Shrine ${label}`}
            checked={current?.rushed ?? false}
            disabled={current === null}
            onChange={(event) => {
              if (current === null) return;
              executeIntent(purchase.intentFor({ ...current, rushed: event.target.checked }));
            }}
            type="checkbox"
          />
          Rushed
        </label>
      </div>
    </div>
  );
}

import { HERMES_SHRINE_DELAYS, type HermesShrineDelay } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import type { WorkspacePurgingPoolSlotInteraction } from '@planner/projections/structured-workspace';
import {
  declaredChoicesPicker,
  type ContextualPickerModel,
} from '@planner/projections/contextual/contextualPicker';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { wellArtwork } from '@planner/ui/artwork/well/wellArtwork';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { useFindingAnchor, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

const wellIcon = (itemKey: string | null): string | undefined =>
  itemKey === null ? undefined : (wellArtwork[itemKey] ?? undefined);

const shrineDelayChoices = Object.freeze(
  HERMES_SHRINE_DELAYS.map((delay) =>
    Object.freeze({ key: String(delay), value: delay, label: String(delay) }),
  ),
);

const emptyNullablePicker: ContextualPickerModel<string | null> = Object.freeze({
  sections: Object.freeze([]),
});
const emptyStringPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

type StygianWellFeature = Extract<WorkspaceRoomFeature, { readonly kind: 'stygianWell' }>;

type InventoryFeature = Extract<
  WorkspaceRoomFeature,
  { readonly kind: 'hermesShrine' | 'purgingPool' | 'stygianWell' }
>;

export function RoomInventoryPanel({
  feature,
  interactions,
}: {
  readonly feature: InventoryFeature;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const findingAnchor = useFindingAnchor();
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
          <fieldset className="room-purging-pool" key="stygian-well">
            <legend className="visually-hidden">Stygian Well configuration</legend>
            <div className="room-feature-interaction-header">
              {presence === undefined && feature.presence.kind !== 'optionalAbsent' ? (
                <FixedObjectHeader object="stygianWell" title="Stygian Well" />
              ) : (
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
                  <ArtworkIcon
                    className="artwork-label-icon"
                    source={roomObjectIcon('stygianWell')}
                  />
                  <span>Stygian Well</span>
                </label>
              )}
            </div>
            {feature.presence.kind === 'optionalAbsent'
              ? null
              : feature.slots.map((slot) => (
                  <StygianWellSlotEditor
                    key={slot.generationKey}
                    slot={slot}
                    interactions={interactions}
                  />
                ))}
          </fieldset>
        );
      })();
    case 'purgingPool':
      return (() => {
        return (
          <fieldset className="room-purging-pool" key="purging-pool">
            <legend className="visually-hidden">Pool of Purging configuration</legend>
            <div className="room-feature-interaction-header">
              <FixedObjectHeader object="purgingPool" title="Pool of Purging" />
            </div>
            {feature.slots.map((slot) => {
              const interaction = requireWorkspaceInteraction(
                interactions.purgingPoolSlots,
                slot.interactionKey,
              );
              return (
                <div className="shop-family-offer-row room-purging-pool-slot" key={slot.key}>
                  <PurgingPoolTraitPicker
                    address={slot.address}
                    interaction={interaction}
                    label={slot.label}
                    traitKey={slot.traitKey}
                    {...(slot.traitLabel === undefined ? {} : { selectedLabel: slot.traitLabel })}
                    onSelect={(traitKey) => executeIntent(interaction.intentFor(traitKey))}
                  />
                </div>
              );
            })}
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
              : findingAnchor(feature.inventoryAddress))}
            tabIndex={-1}
            className="room-purging-pool"
            key="hermes-shrine"
          >
            <legend className="visually-hidden">Hermes Shrine configuration</legend>
            {presence === undefined && feature.presence.kind !== 'optionalAbsent' ? (
              <FixedObjectHeader object="hermesShrine" title="Hermes Shrine" />
            ) : (
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
                <ArtworkIcon
                  className="artwork-label-icon"
                  source={roomObjectIcon('hermesShrine')}
                />
                <span>Hermes Shrine</span>
              </label>
            )}
            {feature.slots.map((slot) => {
              const offer = requireWorkspaceInteraction(
                interactions.hermesShrineOffers,
                slot.offerInteractionKey,
              );
              return (
                <HermesShrineSlotEditor
                  key={slot.key}
                  marker={slot.marker}
                  label={slot.label}
                  rewardType={slot.rewardType}
                  {...(slot.rewardLabel === undefined ? {} : { rewardLabel: slot.rewardLabel })}
                  offer={offer}
                />
              );
            })}
          </fieldset>
        );
      })();
  }
}

/** A room object the room always has here: its name, with nothing to toggle. */
function FixedObjectHeader({
  object,
  title,
}: {
  readonly object: 'hermesShrine' | 'purgingPool' | 'stygianWell';
  readonly title: string;
}) {
  return (
    <div className="room-feature-presence-row">
      <ArtworkIcon className="artwork-label-icon" source={roomObjectIcon(object)} />
      <span>{title}</span>
    </div>
  );
}

function PurgingPoolTraitPicker({
  address,
  interaction,
  label,
  onSelect,
  selectedLabel,
  traitKey,
}: {
  readonly address: import('@run-planner/engine/authored-project').SemanticAddress;
  readonly interaction: WorkspacePurgingPoolSlotInteraction;
  readonly label: string;
  readonly traitKey: string | null;
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
      label={label}
      layout="inline"
      loading={picker.pending}
      model={picker.result ?? emptyNullablePicker}
      onOpenChange={(open) => {
        if (open) picker.activate();
      }}
      onSelect={onSelect}
      placeholder="Unresolved"
      itemIcon={(item) => (item.value === null ? undefined : traitIcon(item.value))}
      triggerIcon={traitKey === null ? undefined : traitIcon(traitKey)}
      {...(selectedLabel === undefined ? {} : { triggerLabel: selectedLabel })}
    />
  );
}

/** One Well inventory slot's item. */
export function StygianWellSlotEditor({
  fieldLabel,
  placeholder = 'Unresolved',
  slot,
  interactions,
}: {
  /** The visible label where the line already names the slot; the accessible name keeps it. */
  readonly fieldLabel?: string;
  /** The empty slot's text; a timeline row asks to pick its item. */
  readonly placeholder?: string;
  readonly slot: Omit<StygianWellFeature['slots'][number], 'key'>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const offer = requireWorkspaceInteraction(
    interactions.stygianWellOffers,
    slot.offerInteractionKey,
  );
  const offerPicker = useWorkspaceInteraction(offer);
  return (
    <div className="shop-family-offer-row room-purging-pool-slot">
      <ContextualPicker
        findingTarget={findingTarget(slot.address)}
        ariaLabel={`Stygian Well ${slot.label} Item`}
        id={`${offer.key}-picker`}
        label={fieldLabel ?? slot.label}
        layout="inline"
        loading={offerPicker.pending}
        model={offerPicker.result ?? emptyNullablePicker}
        onOpenChange={(open) => {
          if (open) offerPicker.activate();
        }}
        onSelect={(itemKey) => executeIntent(offer.intentFor(itemKey))}
        placeholder={placeholder}
        itemIcon={(item) => wellIcon(item.value)}
        triggerIcon={wellIcon(slot.itemKey)}
        {...(slot.itemLabel === undefined ? {} : { triggerLabel: slot.itemLabel })}
      />
    </div>
  );
}

/** One Shrine inventory slot: its item and the delay rolled with it. */
export function HermesShrineSlotEditor({
  fieldLabel,
  placeholder = 'Unresolved',
  label,
  marker,
  rewardLabel,
  rewardType,
  offer,
}: {
  /** The visible label where the line already names the slot; the accessible name keeps it. */
  readonly fieldLabel?: string;
  /** The empty slot's text; a timeline row asks to pick its item. */
  readonly placeholder?: string;
  readonly label: string;
  readonly marker: import('@planner/projections/structured-workspace').WorkspaceMarker;
  readonly rewardLabel?: string;
  readonly rewardType: string | null;
  readonly offer: import('@planner/projections/structured-workspace').WorkspaceHermesShrineOfferInteraction;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const offerPicker = useWorkspaceInteraction(offer);
  return (
    <div className="shop-family-offer-row hermes-shrine-slot">
      <ContextualPicker
        findingTarget={findingTarget(marker.address)}
        ariaLabel={`Hermes Shrine ${label} Item`}
        id={`${offer.key}-picker`}
        label={fieldLabel ?? label}
        layout="inline"
        loading={offerPicker.pending}
        model={offerPicker.result ?? emptyStringPicker}
        onOpenChange={(open) => {
          if (open) offerPicker.activate();
        }}
        onSelect={(selected) => executeIntent(offer.intentFor(selected))}
        placeholder={placeholder}
        itemIcon={(item) => rewardIcon(item.value)}
        triggerIcon={rewardType === null ? undefined : rewardIcon(rewardType)}
        {...(rewardLabel === undefined ? {} : { triggerLabel: rewardLabel })}
      />
      <div className="hermes-shrine-purchase-details">
        <ContextualPicker<HermesShrineDelay>
          ariaLabel={`Hermes Shrine ${label} delivery delay`}
          disabled={offer.delay === null}
          id={`${offer.key}-delay`}
          label="Delay"
          layout="inline"
          model={declaredChoicesPicker(shrineDelayChoices, offer.delay ?? undefined)}
          onSelect={(delay) => executeIntent(offer.delayIntentFor(delay))}
          placeholder="—"
        />
      </div>
    </div>
  );
}

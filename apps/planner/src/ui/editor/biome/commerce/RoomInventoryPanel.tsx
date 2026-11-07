import { HERMES_SHRINE_DELAYS, type HermesShrineDelay } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomFeature,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import type {
  WorkspaceHermesShrineOfferInteraction,
  WorkspaceMarker,
  WorkspacePurgingPoolSlotInteraction,
} from '@planner/projections/structured-workspace';
import {
  declaredChoicesPicker,
  type ContextualPickerModel,
} from '@planner/projections/contextual/contextualPicker';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { wellArtwork } from '@planner/ui/artwork/well/wellArtwork';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import {
  hermesShrineRefusalSentence,
  stygianWellRefusalSentence,
} from '@planner/projections/roomObjectPlacementCopy';
import { hintProps } from '@planner/ui/controls/hint';
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { useFindingAnchor, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { NumberedSlot, NumberedSlots } from '@planner/ui/editor/rewards/NumberedSlots';

/** A disabled presence waits on an earlier choice, or names the rules refusing it. */
const presenceLockHint = (feature: StygianWellFeature | HermesShrineFeature): string | undefined =>
  feature.assessment === 'unassessed'
    ? candidateWaitingHint
    : feature.kind === 'stygianWell'
      ? feature.presenceRefusals?.map(stygianWellRefusalSentence).join(' ')
      : feature.presenceRefusals?.map(hermesShrineRefusalSentence).join(' ');

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
type HermesShrineFeature = Extract<WorkspaceRoomFeature, { readonly kind: 'hermesShrine' }>;

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
          <fieldset className="room-purging-pool room-inventory-line" key="stygian-well">
            <legend className="visually-hidden">Stygian Well configuration</legend>
            {presence === undefined && feature.presence.kind !== 'optionalAbsent' ? (
              <FixedObjectHeader object="stygianWell" title="Stygian Well" />
            ) : (
              <IconToggle
                disabled={presence === undefined}
                disabledHint={presence === undefined ? presenceLockHint(feature) : undefined}
                icon={roomObjectIcon('stygianWell')}
                name="Stygian Well"
                onToggle={(next) => {
                  if (presence !== undefined) executeIntent(presence.intentFor(next));
                }}
                pressed={feature.presence.kind !== 'optionalAbsent'}
                target={findingTarget(feature.presenceAddress)}
              />
            )}
            {feature.presence.kind === 'optionalAbsent' ? null : (
              <NumberedSlots label="Stygian Well slots">
                {feature.slots.map((slot, index) => (
                  <NumberedSlot
                    hint={`Slot ${index + 1}`}
                    key={slot.generationKey}
                    number={index + 1}
                  >
                    <StygianWellSlotPicker fieldLabel="" interactions={interactions} slot={slot} />
                  </NumberedSlot>
                ))}
              </NumberedSlots>
            )}
          </fieldset>
        );
      })();
    case 'purgingPool':
      return (() => {
        return (
          <fieldset className="room-purging-pool room-inventory-line" key="purging-pool">
            <legend className="visually-hidden">Pool of Purging configuration</legend>
            <FixedObjectHeader object="purgingPool" title="Pool of Purging" />
            <NumberedSlots label="Pool of Purging slots">
              {feature.slots.map((slot, index) => {
                const interaction = requireWorkspaceInteraction(
                  interactions.purgingPoolSlots,
                  slot.interactionKey,
                );
                return (
                  <NumberedSlot hint={`Slot ${index + 1}`} key={slot.key} number={index + 1}>
                    <PurgingPoolTraitPicker
                      address={slot.address}
                      interaction={interaction}
                      label={slot.label}
                      traitKey={slot.traitKey}
                      {...(slot.traitLabel === undefined ? {} : { selectedLabel: slot.traitLabel })}
                      onSelect={(traitKey) => executeIntent(interaction.intentFor(traitKey))}
                    />
                  </NumberedSlot>
                );
              })}
            </NumberedSlots>
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
            className="room-purging-pool room-inventory-line"
            key="hermes-shrine"
          >
            <legend className="visually-hidden">Hermes Shrine configuration</legend>
            {presence === undefined && feature.presence.kind !== 'optionalAbsent' ? (
              <FixedObjectHeader object="hermesShrine" title="Hermes Shrine" />
            ) : (
              <IconToggle
                disabled={presence === undefined}
                disabledHint={presence === undefined ? presenceLockHint(feature) : undefined}
                icon={roomObjectIcon('hermesShrine')}
                name="Hermes Shrine"
                onToggle={(next) => {
                  if (presence !== undefined) executeIntent(presence.intentFor(next));
                }}
                pressed={feature.presence.kind !== 'optionalAbsent'}
                target={findingTarget(feature.presenceAddress)}
              />
            )}
            {feature.slots.length === 0 ? null : (
              <NumberedSlots label="Hermes Shrine slots">
                {feature.slots.map((slot, index) => {
                  const offer = requireWorkspaceInteraction(
                    interactions.hermesShrineOffers,
                    slot.offerInteractionKey,
                  );
                  return (
                    <NumberedSlot
                      hint={`Slot ${index + 1}`}
                      key={slot.key}
                      number={index + 1}
                      trailing={<HermesShrineDelayPicker label={slot.label} offer={offer} />}
                    >
                      <HermesShrineItemPicker
                        label={slot.label}
                        marker={slot.marker}
                        offer={offer}
                        rewardType={slot.rewardType}
                        {...(slot.rewardLabel === undefined
                          ? {}
                          : { rewardLabel: slot.rewardLabel })}
                      />
                    </NumberedSlot>
                  );
                })}
              </NumberedSlots>
            )}
          </fieldset>
        );
      })();
  }
}

/** A room object the room always has here: its lit icon, named on hover, with nothing to toggle. */
function FixedObjectHeader({
  object,
  title,
}: {
  readonly object: 'hermesShrine' | 'purgingPool' | 'stygianWell';
  readonly title: string;
}) {
  return (
    <span
      {...hintProps(title, undefined, title)}
      aria-label={title}
      className="room-object-fixed"
      role="img"
    >
      <ArtworkIcon className="artwork-label-icon" source={roomObjectIcon(object)} />
    </span>
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
      label=""
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
      triggerSize="icon"
      triggerUnknown
      {...(selectedLabel === undefined ? {} : { triggerLabel: selectedLabel })}
    />
  );
}

/** One Well inventory slot's item, on a line that needs it chosen. */
export function StygianWellSlotEditor({
  fieldLabel,
  slot,
  interactions,
}: {
  /** The visible label where the line already names the slot; the accessible name keeps it. */
  readonly fieldLabel?: string;
  readonly slot: Omit<StygianWellFeature['slots'][number], 'key'>;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  return (
    <div className="shop-family-offer-row room-purging-pool-slot">
      <StygianWellSlotPicker
        {...(fieldLabel === undefined ? {} : { fieldLabel })}
        interactions={interactions}
        required
        slot={slot}
      />
    </div>
  );
}

/** One Well inventory slot's item as its icon chip, which opens the slot's item list. */
export function StygianWellSlotPicker({
  fieldLabel,
  required = false,
  slot,
  interactions,
}: {
  readonly fieldLabel?: string;
  /** A slot this line needs chosen; otherwise its unrevealed item may stay unknown. */
  readonly required?: boolean;
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
      placeholder={required ? 'Pick' : 'Unresolved'}
      itemIcon={(item) => wellIcon(item.value)}
      triggerIcon={wellIcon(slot.itemKey)}
      triggerSize="icon"
      triggerUnknown={!required}
      {...(slot.itemLabel === undefined ? {} : { triggerLabel: slot.itemLabel })}
    />
  );
}

/** One Shrine slot on a Timeline line: its item and the delay rolled with it. */
export function HermesShrineSlotEditor({
  placeholder = 'Unresolved',
  label,
  marker,
  rewardLabel,
  rewardType,
  offer,
}: {
  /** The empty slot's text; a timeline row asks to pick its item. */
  readonly placeholder?: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly rewardLabel?: string;
  readonly rewardType: string | null;
  readonly offer: WorkspaceHermesShrineOfferInteraction;
}) {
  return (
    <div className="shop-family-offer-row hermes-shrine-slot">
      <HermesShrineItemPicker
        label={label}
        marker={marker}
        offer={offer}
        placeholder={placeholder}
        rewardType={rewardType}
        {...(rewardLabel === undefined ? {} : { rewardLabel })}
      />
      <HermesShrineDelayPicker label={label} offer={offer} />
    </div>
  );
}

/** A Shrine slot's item as its icon chip. */
function HermesShrineItemPicker({
  placeholder = 'Unresolved',
  label,
  marker,
  rewardLabel,
  rewardType,
  offer,
}: {
  readonly placeholder?: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly rewardLabel?: string;
  readonly rewardType: string | null;
  readonly offer: WorkspaceHermesShrineOfferInteraction;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const offerPicker = useWorkspaceInteraction(offer);
  return (
    <ContextualPicker
      findingTarget={findingTarget(marker.address)}
      ariaLabel={`Hermes Shrine ${label} Item`}
      id={`${offer.key}-picker`}
      label=""
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
      triggerSize="icon"
      {...(rewardLabel === undefined ? {} : { triggerLabel: rewardLabel })}
    />
  );
}

/** The rooms until a Shrine slot's item is delivered, as a compact number after its chip. */
function HermesShrineDelayPicker({
  label,
  offer,
}: {
  readonly label: string;
  readonly offer: WorkspaceHermesShrineOfferInteraction;
}) {
  const executeIntent = useCommandIntent();
  return (
    <span className="hermes-shrine-delay">
      <ContextualPicker<HermesShrineDelay>
        ariaLabel={`Hermes Shrine ${label} delivery delay`}
        disabled={offer.delay === null}
        id={`${offer.key}-delay`}
        label=""
        layout="inline"
        model={declaredChoicesPicker(shrineDelayChoices, offer.delay ?? undefined)}
        onSelect={(delay) => executeIntent(offer.delayIntentFor(delay))}
        placeholder="—"
        searchable={false}
        triggerHint="Delivery delay"
        triggerSize="content"
      />
    </span>
  );
}

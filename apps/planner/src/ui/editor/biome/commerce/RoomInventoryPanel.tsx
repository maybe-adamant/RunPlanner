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
import { hintProps } from '@planner/ui/controls/hint';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { useFindingAnchor, useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { NumberedSlot, NumberedSlots } from '@planner/ui/editor/rewards/NumberedSlots';
import { OfferConditionNotices } from '@planner/ui/feedback/OfferConditionNote';

const wellIcon = (itemKey: string | null): string | undefined =>
  itemKey === null ? undefined : (wellArtwork[itemKey] ?? undefined);

const shrineDelayChoices = Object.freeze(
  HERMES_SHRINE_DELAYS.map((delay) =>
    Object.freeze({ key: String(delay), value: delay, label: `${delay} encounters` }),
  ),
);

const emptyStringPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

type StygianWellFeature = Extract<WorkspaceRoomFeature, { readonly kind: 'stygianWell' }>;
type PurgingPoolSlot = Extract<
  WorkspaceRoomFeature,
  { readonly kind: 'purgingPool' }
>['slots'][number];

/** An unreached slot stays blank and read-only until the walk stocks it. */
const waiting = (contextReached: boolean) =>
  contextReached ? {} : { disabledHint: candidateWaitingHint };

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
  const findingAnchor = useFindingAnchor();
  switch (feature.kind) {
    case 'stygianWell':
      return (() => {
        return (
          <fieldset className="room-object-settings" key="stygian-well">
            <legend className="visually-hidden">Stygian Well configuration</legend>
            {feature.presence.kind === 'optionalAbsent' ? null : (
              <NumberedSlots label="Stygian Well slots">
                {feature.slots.map((slot, index) => (
                  <NumberedSlot key={slot.generationKey} number={index + 1}>
                    <StygianWellSlotPicker fieldLabel="" interactions={interactions} slot={slot} />
                  </NumberedSlot>
                ))}
              </NumberedSlots>
            )}
            {feature.presence.kind === 'optionalAbsent' ? null : (
              <OfferConditionNotices
                conditions={feature.slots.map(
                  (slot) =>
                    interactions.stygianWellOffers.get(slot.offerInteractionKey)
                      ?.selectedOfferCondition,
                )}
              />
            )}
          </fieldset>
        );
      })();
    case 'purgingPool':
      return (() => {
        return (
          <fieldset className="room-object-settings" key="purging-pool">
            <legend className="visually-hidden">Pool of Purging configuration</legend>
            <PurgingPoolSlots interactions={interactions} slots={feature.slots} />
          </fieldset>
        );
      })();
    case 'hermesShrine':
      return (() => {
        return (
          <fieldset
            {...(feature.inventoryAddress === undefined
              ? {}
              : findingAnchor(feature.inventoryAddress))}
            tabIndex={-1}
            className="room-object-settings"
            key="hermes-shrine"
          >
            <legend className="visually-hidden">Hermes Shrine configuration</legend>
            {feature.slots.length === 0 ? null : (
              <NumberedSlots label="Hermes Shrine slots">
                {feature.slots.map((slot, index) => {
                  const offer = requireWorkspaceInteraction(
                    interactions.hermesShrineOffers,
                    slot.offerInteractionKey,
                  );
                  return (
                    <NumberedSlot
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
            <OfferConditionNotices
              conditions={feature.slots.map(
                (slot) =>
                  interactions.hermesShrineOffers.get(slot.offerInteractionKey)
                    ?.selectedOfferCondition,
              )}
            />
          </fieldset>
        );
      })();
  }
}

/** A room object the room always has here: its lit icon, named on hover, with nothing to pick. */
export function FixedObjectChip({
  object,
  title,
  target,
}: {
  readonly object: 'hermesShrine' | 'purgingPool' | 'stygianWell';
  readonly title: string;
  readonly target?: import('@planner/ui/feedback/useFindingTarget').FindingTargetProps;
}) {
  return (
    <span
      {...target}
      {...hintProps(title, target?.['aria-description'], title)}
      aria-label={title}
      className="room-object-fixed"
      role="img"
    >
      <ArtworkIcon className="artwork-label-icon" source={roomObjectIcon(object)} />
    </span>
  );
}

/** One Pool list's slots as trait chips: the entry list on the Overview, or the regenerated one. */
export function PurgingPoolSlots({
  interactions,
  label = 'Pool of Purging',
  slots,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  /** Names the list's slots; the Overview's entry list is the Pool's own. */
  readonly label?: string;
  readonly slots: readonly PurgingPoolSlot[];
}) {
  return (
    <NumberedSlots label={`${label} slots`}>
      {slots.map((slot, index) => (
        <NumberedSlot key={slot.key} number={index + 1}>
          <PurgingPoolTraitPicker
            interaction={requireWorkspaceInteraction(
              interactions.purgingPoolSlots,
              slot.interactionKey,
            )}
            label={label}
            slot={slot}
          />
        </NumberedSlot>
      ))}
    </NumberedSlots>
  );
}

function PurgingPoolTraitPicker({
  interaction,
  label,
  slot,
}: {
  readonly interaction: WorkspacePurgingPoolSlotInteraction;
  readonly label: string;
  readonly slot: PurgingPoolSlot;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const picker = useWorkspaceInteraction(interaction);
  return (
    <ContextualPicker
      findingTarget={findingTarget(slot.address)}
      ariaLabel={`${label} ${slot.label} Item`}
      id={`${interaction.key}-picker`}
      label=""
      layout="inline"
      loading={picker.pending}
      model={picker.result ?? emptyStringPicker}
      onOpenChange={(open) => {
        if (open) picker.activate();
      }}
      onSelect={(traitKey) => executeIntent(interaction.intentFor(traitKey))}
      placeholder={slot.label}
      itemIcon={(item) => traitIcon(item.value)}
      triggerIcon={slot.traitKey === null ? undefined : traitIcon(slot.traitKey)}
      triggerSize="icon"
      triggerUnknown
      {...waiting(interaction.contextReached)}
      {...(slot.traitLabel === undefined ? {} : { triggerLabel: slot.traitLabel })}
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
        slot={slot}
      />
    </div>
  );
}

/** One Well inventory slot's item as its icon chip, which opens the slot's item list. */
export function StygianWellSlotPicker({
  fieldLabel,
  slot,
  interactions,
}: {
  readonly fieldLabel?: string;
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
      model={offerPicker.result ?? emptyStringPicker}
      onOpenChange={(open) => {
        if (open) offerPicker.activate();
      }}
      onSelect={(itemKey) => executeIntent(offer.intentFor(itemKey))}
      placeholder={slot.label}
      itemIcon={(item) => wellIcon(item.value)}
      triggerIcon={wellIcon(slot.itemKey)}
      triggerSize="icon"
      triggerUnknown
      {...waiting(offer.contextReached)}
      {...(slot.itemLabel === undefined ? {} : { triggerLabel: slot.itemLabel })}
    />
  );
}

/** One Shrine slot on a Timeline line: its item and the delay rolled with it. */
export function HermesShrineSlotEditor({
  label,
  marker,
  rewardLabel,
  rewardType,
  offer,
}: {
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
        rewardType={rewardType}
        {...(rewardLabel === undefined ? {} : { rewardLabel })}
      />
      <HermesShrineDelayPicker label={label} offer={offer} />
    </div>
  );
}

/** A Shrine slot's item as its icon chip. */
function HermesShrineItemPicker({
  label,
  marker,
  rewardLabel,
  rewardType,
  offer,
}: {
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
      placeholder={label}
      {...waiting(offer.contextReached)}
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
        model={declaredChoicesPicker(
          shrineDelayChoices,
          offer.delay ?? undefined,
          'Delivery delay',
        )}
        onSelect={(delay) => executeIntent(offer.delayIntentFor(delay))}
        placeholder="—"
        searchable={false}
        triggerHint="Delivery delay"
        {...(offer.delay === null ? {} : { triggerLabel: String(offer.delay) })}
        triggerSize="content"
      />
    </span>
  );
}

import type {
  WorkspaceInteractionCatalog,
  WorkspaceRewardControl,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingMark } from '@planner/ui/feedback/useFindingTarget';
import { PomResolutionLauncher } from '../rewards/PomResolutionEditor';
import { AnvilResultLauncher } from '../rewards/AnvilResultEditor';
import { HexActivationLauncher } from '../rewards/HexActivationEditor';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { TraitOfferLauncher } from '../rewards/TraitOfferEditor';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';

/** Pickup outcome and Sea Star controls for one acquisition role of a timeline row. */
function PickupOutcomeControls({
  conversion,
  idPrefix,
  interactions,
  verbOwnsOutcome,
}: {
  /** The row's verb picker already chooses this role's outcome. */
  readonly verbOwnsOutcome: boolean;
  readonly conversion: NonNullable<WorkspaceRewardControl['conversions']>[number];
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const findingMark = useFindingMark();
  const interaction = requireWorkspaceInteraction(
    interactions.acquisitionConversions,
    workspaceInteractionKey(conversion.address),
  );
  if (!interaction.visible) return null;
  // Each control renders only where the engine says it applies or an authored value remains.
  const kind = conversion.value.kind;
  const timePiece = interaction.timePieceSupported || kind === 'timePiece';
  const artificer = interaction.artificerSupported || kind === 'artificer';
  const seaStar = interaction.seaStarSupported || interaction.seaStarProcced;
  if (!seaStar && (verbOwnsOutcome || !(timePiece || artificer))) return null;
  return (
    <div className="reward-acquisition-conversion">
      {!verbOwnsOutcome && (timePiece || artificer) ? (
        <select
          {...findingMark(conversion.address, 'pickupOutcome')}
          aria-label={`Pickup outcome for ${conversion.acquisitionRoleLabel}`}
          className="pickup-outcome-select"
          id={`${idPrefix}-pickup-outcome-${workspaceInteractionKey(conversion.address)}`}
          onChange={(event) => {
            const next = event.target.value;
            if (next === 'normal' || next === 'timePiece' || next === 'artificer')
              executeIntent(interaction.intentFor(Object.freeze({ kind: next })));
          }}
          value={kind}
        >
          <option value="normal">Take</option>
          {timePiece ? <option value="timePiece">Time Piece</option> : null}
          {artificer ? <option value="artificer">Artificer</option> : null}
        </select>
      ) : null}
      {seaStar ? (
        <label className="timeline-checkbox">
          <input
            {...findingMark(conversion.address, 'seaStar')}
            aria-label={`Double Up for ${conversion.acquisitionRoleLabel}`}
            checked={interaction.seaStarProcced}
            onChange={(event) => executeIntent(interaction.seaStarIntentFor(event.target.checked))}
            type="checkbox"
          />
          <span>Double Up</span>
        </label>
      ) : null}
    </div>
  );
}

const conversionVerbs = { timePiece: 'Goldify', artificer: 'Transform' } as const;

/** The role the row's verb decides: one already goldified or transformed, else the first. */
function verbConversion(conversions: WorkspaceRewardControl['conversions']) {
  return conversions?.find((candidate) => candidate.value.kind !== 'normal') ?? conversions?.[0];
}

/**
 * The row's verb. Where the engine lets the pickup be goldified or
 * transformed, the verb is a picker whose trigger reads as the label's text.
 */
export function RoomActionVerb({
  interactions,
  row,
  verb,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly row: WorkspaceRoomActionRow;
  readonly verb: string;
}) {
  const conversion = verbConversion(row.rewardPayload?.control.conversions);
  return conversion === undefined ? (
    <strong>{verb}</strong>
  ) : (
    <ConversionVerbPicker
      conversion={conversion}
      interactions={interactions}
      row={row}
      verb={verb}
    />
  );
}

function ConversionVerbPicker({
  conversion,
  interactions,
  row,
  verb,
}: {
  readonly conversion: NonNullable<WorkspaceRewardControl['conversions']>[number];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly row: WorkspaceRoomActionRow;
  readonly verb: string;
}) {
  const executeIntent = useCommandIntent();
  const findingMark = useFindingMark();
  const interaction = requireWorkspaceInteraction(
    interactions.acquisitionConversions,
    workspaceInteractionKey(conversion.address),
  );
  const kind = conversion.value.kind;
  // Each choice shows only where the engine supports it or an authored value remains.
  const timePiece = interaction.visible && (interaction.timePieceSupported || kind === 'timePiece');
  const artificer = interaction.visible && (interaction.artificerSupported || kind === 'artificer');
  if (!timePiece && !artificer) return <strong>{verb}</strong>;
  const shown = kind === 'timePiece' || kind === 'artificer' ? conversionVerbs[kind] : verb;
  const gold =
    kind === 'timePiece' && row.goldGained !== undefined ? ` · ${row.goldGained.label} gold` : '';
  const name = row.labelParts?.name ?? row.label;
  return (
    <ContextualPicker<'normal' | 'timePiece' | 'artificer'>
      ariaLabel={`How to take ${name}: ${shown}`}
      findingMark={findingMark(conversion.address, 'pickupOutcome')}
      id={`room-action-verb-${workspaceInteractionKey(conversion.address)}`}
      label=""
      layout="inline"
      model={declaredChoicesPicker(
        [
          { key: 'normal', value: 'normal' as const, label: verb },
          ...(timePiece
            ? [
                {
                  key: 'timePiece',
                  value: 'timePiece' as const,
                  label: `Goldify · Time Piece${gold}`,
                },
              ]
            : []),
          ...(artificer
            ? [{ key: 'artificer', value: 'artificer' as const, label: 'Transform · Artificer' }]
            : []),
        ],
        kind,
      )}
      onSelect={(next) => executeIntent(interaction.intentFor(Object.freeze({ kind: next })))}
      placeholder={verb}
      searchable={false}
      triggerLabel={shown}
      triggerSize="content"
    />
  );
}

/** The row's own source picker, standing in its label where the Mystery Boon's name would be. */
export function RoomActionInlineReward({
  row,
  interactions,
}: {
  readonly row: WorkspaceRoomActionRow;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  if (row.rewardPayload === undefined) return null;
  return (
    <div className="room-action-inline-reward">
      <RewardControlEditor
        control={row.rewardPayload.control}
        idPrefix={`room-action-inline-${row.rewardPayload.control.marker.focusKey}`}
        interactions={interactions}
        offerSummaryMode="source"
        {...(row.rewardPayload.control.offerEditStartStep === undefined
          ? {}
          : { offerStartStep: row.rewardPayload.control.offerEditStartStep })}
      />
    </div>
  );
}

/** The row's decisions in slot order: trait, Pom, Anvil and Path of Stars chips, then the pickup outcome and what follows it. */
export function RoomActionInlineEditors({
  row,
  interactions,
}: {
  readonly row: WorkspaceRoomActionRow;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const traitControls = [
    ...(row.traitOffer === undefined ? [] : [row.traitOffer]),
    ...(row.rewardPayload?.inlineTraitOffers ?? []),
  ];
  const payload = row.rewardPayload;
  const levels = payload?.inlineLevelResolutions ?? [];
  const conversions = payload?.control.conversions ?? [];
  const conversionInteractions = conversions.map((control) =>
    requireWorkspaceInteraction(
      interactions.acquisitionConversions,
      workspaceInteractionKey(control.address),
    ),
  );
  const anvilInteractions = conversionInteractions.flatMap((interaction) =>
    interaction.anvil === undefined ? [] : [{ anvil: interaction.anvil, owner: interaction.owner }],
  );
  const hexActivations = conversionInteractions.flatMap((interaction) =>
    interaction.hexActivation === undefined
      ? []
      : [{ hexActivation: interaction.hexActivation, owner: interaction.owner }],
  );
  return (
    <>
      {traitControls.map((control) => (
        <TraitOfferLauncher
          control={control}
          interactions={interactions}
          key={workspaceInteractionKey(control.address)}
        />
      ))}
      {levels.map((control) => (
        <PomResolutionLauncher
          control={control}
          interactions={interactions}
          key={workspaceInteractionKey(control.address)}
        />
      ))}
      {anvilInteractions.map(({ anvil, owner }) => (
        <AnvilResultLauncher
          interaction={anvil}
          key={workspaceInteractionKey(owner)}
          owner={owner}
        />
      ))}
      {hexActivations.map(({ hexActivation, owner }) => (
        <HexActivationLauncher
          interaction={hexActivation}
          key={workspaceInteractionKey(owner)}
          owner={owner}
        />
      ))}
      {payload === undefined
        ? null
        : conversions.map((conversion) => (
            <PickupOutcomeControls
              verbOwnsOutcome={conversion === verbConversion(conversions)}
              conversion={conversion}
              idPrefix={`room-action-${payload.control.marker.focusKey}`}
              interactions={interactions}
              key={workspaceInteractionKey(conversion.address)}
            />
          ))}
      {row.artificerOutput === undefined ? null : (
        <div className="room-action-artificer-output">
          <RewardControlEditor
            control={row.artificerOutput.control}
            idPrefix={`room-action-artificer-${row.artificerOutput.control.marker.focusKey}`}
            interactions={interactions}
            ariaLabel={`Artificer ${row.artificerOutput.label.toLowerCase()}`}
            label=""
            {...(row.artificerOutput.control.offerEditStartStep === undefined
              ? {}
              : { offerStartStep: row.artificerOutput.control.offerEditStartStep })}
          />
        </div>
      )}
      {row.fountainRarity === undefined ? null : (
        <FountainRarityEffectRow control={row.fountainRarity} interactions={interactions} />
      )}
    </>
  );
}

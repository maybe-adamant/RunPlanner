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
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { PomResolutionLauncher } from '../rewards/PomResolutionEditor';
import { AnvilResultLauncher } from '../rewards/AnvilResultEditor';
import { HexActivationLauncher } from '../rewards/HexActivationEditor';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { TraitOfferLauncher } from '../rewards/TraitOfferEditor';
import { ChallengeSwitchOutcomeControls } from './ChallengeSwitchOutcomeControls';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';

/** The Sea Star toggle for one acquisition role of a timeline row: lit when Double Up procs. */
function SeaStarToggle({
  conversion,
  interactions,
  roleNamed,
}: {
  readonly conversion: NonNullable<WorkspaceRewardControl['conversions']>[number];
  readonly interactions: WorkspaceInteractionCatalog;
  /** The row has more than one role, so the toggle names its own. */
  readonly roleNamed: boolean;
}) {
  const executeIntent = useCommandIntent();
  const findingMark = useFindingMark();
  const interaction = requireWorkspaceInteraction(
    interactions.acquisitionConversions,
    workspaceInteractionKey(conversion.address),
  );
  // Sea Star renders only where the engine says it applies or an authored proc remains.
  if (!interaction.visible || !(interaction.seaStarSupported || interaction.seaStarProcced))
    return null;
  return (
    <IconToggle
      icon={traitIcon('DoubleRewardBoon')}
      name={roleNamed ? `Double Up · ${conversion.acquisitionRoleLabel}` : 'Double Up'}
      onToggle={(next) => executeIntent(interaction.seaStarIntentFor(next))}
      pressed={interaction.seaStarProcced}
      target={findingMark(conversion.address, 'seaStar')}
    />
  );
}

type ConversionKind = 'normal' | 'timePiece' | 'artificer';

const conversionVerbs = { timePiece: 'Goldify', artificer: 'Transform' } as const;

/** The role the row's verb shows: one already goldified or transformed, else the first. */
function verbConversion(conversions: WorkspaceRewardControl['conversions']) {
  return conversions?.find((candidate) => candidate.value.kind !== 'normal') ?? conversions?.[0];
}

/**
 * The row's verb. Where the engine lets any of its pickups be goldified or
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
  const conversions = row.rewardPayload?.control.conversions ?? [];
  return conversions.length === 0 ? (
    <strong>{verb}</strong>
  ) : (
    <ConversionVerbPicker
      conversions={conversions}
      interactions={interactions}
      row={row}
      verb={verb}
    />
  );
}

function ConversionVerbPicker({
  conversions,
  interactions,
  row,
  verb,
}: {
  readonly conversions: NonNullable<WorkspaceRewardControl['conversions']>;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly row: WorkspaceRoomActionRow;
  readonly verb: string;
}) {
  const executeIntent = useCommandIntent();
  const findingMark = useFindingMark();
  const roles = conversions.map((conversion) => {
    const interaction = requireWorkspaceInteraction(
      interactions.acquisitionConversions,
      workspaceInteractionKey(conversion.address),
    );
    const kind = conversion.value.kind;
    // Each choice shows only where the engine supports it or an authored value remains.
    return {
      conversion,
      interaction,
      timePiece: interaction.visible && (interaction.timePieceSupported || kind === 'timePiece'),
      artificer: interaction.visible && (interaction.artificerSupported || kind === 'artificer'),
    };
  });
  const convertible = roles.filter((role) => role.timePiece || role.artificer);
  if (convertible.length === 0) return <strong>{verb}</strong>;
  const shownConversion = verbConversion(conversions)!;
  const shownRole = roles.find((role) => role.conversion === shownConversion)!;
  const kind = shownConversion.value.kind;
  const shown = kind === 'timePiece' || kind === 'artificer' ? conversionVerbs[kind] : verb;
  const gold =
    kind === 'timePiece' && row.goldGained !== undefined ? ` · ${row.goldGained.label} gold` : '';
  const name = row.labelParts?.name ?? row.label;
  // A row with several convertible pickups names each choice's own.
  const roleSuffix = (role: (typeof roles)[number]) =>
    convertible.length > 1 ? ` · ${role.conversion.acquisitionRoleLabel}` : '';
  const choiceKey = (role: (typeof roles)[number], next: ConversionKind) =>
    next === 'normal' ? 'normal' : `${workspaceInteractionKey(role.conversion.address)}:${next}`;
  const choices = convertible.flatMap((role) => [
    ...(role.timePiece
      ? [
          {
            key: choiceKey(role, 'timePiece'),
            value: { role, kind: 'timePiece' as const },
            label: `Goldify · Time Piece${role === shownRole ? gold : ''}${roleSuffix(role)}`,
          },
        ]
      : []),
    ...(role.artificer
      ? [
          {
            key: choiceKey(role, 'artificer'),
            value: { role, kind: 'artificer' as const },
            label: `Transform · Artificer${roleSuffix(role)}`,
          },
        ]
      : []),
  ]);
  const selected = kind === 'normal' ? 'normal' : choiceKey(shownRole, kind);
  return (
    <ContextualPicker<string>
      ariaLabel={`How to take ${name}: ${shown}`}
      findingMark={findingMark(shownConversion.address, 'pickupOutcome')}
      id={`room-action-verb-${workspaceInteractionKey(shownConversion.address)}`}
      label=""
      layout="inline"
      model={declaredChoicesPicker(
        [
          { key: 'normal', value: 'normal', label: verb },
          ...choices.map((choice) => ({ key: choice.key, value: choice.key, label: choice.label })),
        ],
        selected,
      )}
      onSelect={(key) => {
        if (key === selected) return;
        // Taking it plainly undoes the shown conversion; a conversion applies to its own pickup.
        const choice = choices.find((candidate) => candidate.key === key);
        const target = choice?.value ?? { role: shownRole, kind: 'normal' as const };
        executeIntent(target.role.interaction.intentFor(Object.freeze({ kind: target.kind })));
      }}
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
        triggerSize="icon"
        {...(row.rewardPayload.control.offerEditStartStep === undefined
          ? {}
          : { offerStartStep: row.rewardPayload.control.offerEditStartStep })}
      />
    </div>
  );
}

/** The Artificer's result after the transformed pickup: an arrow, then its icon chip. */
export function RoomActionArtificerOutput({
  row,
  interactions,
}: {
  readonly row: WorkspaceRoomActionRow;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const output = row.artificerOutput;
  if (output === undefined) return null;
  return (
    <>
      <span aria-hidden="true" className="row-reward-arrow">
        →
      </span>
      <div className="room-action-artificer-output">
        <RewardControlEditor
          control={output.control}
          idPrefix={`room-action-artificer-${output.control.marker.focusKey}`}
          interactions={interactions}
          {...(output.control.offer === null
            ? { ariaLabel: `Artificer ${output.label.toLowerCase()}` }
            : {})}
          label=""
          triggerSize="icon"
          {...(output.control.offerEditStartStep === undefined
            ? {}
            : { offerStartStep: output.control.offerEditStartStep })}
        />
      </div>
    </>
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
            <SeaStarToggle
              conversion={conversion}
              interactions={interactions}
              key={workspaceInteractionKey(conversion.address)}
              roleNamed={conversions.length > 1}
            />
          ))}
      {row.fountainRarity === undefined ? null : (
        <FountainRarityEffectRow control={row.fountainRarity} interactions={interactions} />
      )}
      {row.challengeSwitchOutcome === undefined ? null : (
        <ChallengeSwitchOutcomeControls
          interactions={interactions}
          outcome={row.challengeSwitchOutcome}
        />
      )}
    </>
  );
}

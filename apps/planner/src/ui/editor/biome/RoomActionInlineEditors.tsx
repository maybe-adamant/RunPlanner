import type { AcquisitionDisposition } from '@run-planner/engine/authored-project';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceLiveVerb,
  WorkspaceRewardControl,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingMark } from '@planner/ui/feedback/useFindingTarget';
import { hintProps } from '@planner/ui/controls/hint';
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { PomResolutionLauncher } from '../rewards/PomResolutionEditor';
import { AnvilResultLauncher } from '../rewards/AnvilResultEditor';
import { HexActivationLauncher } from '../rewards/HexActivationEditor';
import { RewardControlEditor } from '../rewards/RewardControlEditor';
import { TraitOfferLauncher } from '../rewards/TraitOfferEditor';
import { ChallengeSwitchOutcomeControls } from './ChallengeSwitchOutcomeControls';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';
import { RowChoice } from './RowChoice';
import { VerbMenu } from './LiveActions';

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

type Conversion = NonNullable<WorkspaceRewardControl['conversions']>[number];

const conversionWords = { timePiece: 'Goldify', artificer: 'Transform' } as const;

/** The role the row's verb shows: one already goldified or transformed, else the first. */
function shownConversion(conversions: readonly Conversion[]): Conversion | undefined {
  return conversions.find((candidate) => candidate.value.kind !== 'normal') ?? conversions[0];
}

/**
 * The row's verb. Where the engine lets any of its pickups be goldified or transformed, the
 * verb opens the shared verb menu, its current way checked; choosing another swaps it in place.
 */
export function RoomActionVerb({
  announce,
  biomeKey,
  interactions,
  row,
  verb,
}: {
  readonly announce: (message: string) => void;
  readonly biomeKey: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly row: WorkspaceRoomActionRow;
  readonly verb: string;
}) {
  const findingMark = useFindingMark();
  const conversions = row.rewardPayload?.control.conversions ?? [];
  const roles = conversions.map((conversion) => {
    const interaction = requireWorkspaceInteraction(
      interactions.acquisitionConversions,
      workspaceInteractionKey(conversion.address),
    );
    const kind = conversion.value.kind;
    // A way shows only where the engine supports it or an authored value remains.
    return {
      conversion,
      interaction,
      timePiece: interaction.visible && (interaction.timePieceSupported || kind === 'timePiece'),
      artificer: interaction.visible && (interaction.artificerSupported || kind === 'artificer'),
    };
  });
  const convertible = roles.filter((role) => role.timePiece || role.artificer);
  const shown = shownConversion(conversions);
  const shownRole = roles.find((role) => role.conversion === shown);
  if (convertible.length === 0 || shown === undefined || shownRole === undefined)
    return <strong>{verb}</strong>;
  const current = shown.value.kind;
  const name = row.labelParts?.name ?? row.label;
  const face = {
    reference: row.reference,
    ...(row.sourceFamily === undefined ? {} : { sourceFamily: row.sourceFamily }),
    ...(row.labelParts?.reward === undefined ? {} : { reward: row.labelParts.reward }),
  };
  /** Taking one role's pickup this way, as one edit; the shown role's own way is current. */
  const way = (
    role: (typeof roles)[number],
    kind: AcquisitionDisposition['kind'],
    label: string,
  ): WorkspaceLiveVerb =>
    Object.freeze({
      ...face,
      key: `${workspaceInteractionKey(role.conversion.address)}:${kind}`,
      label,
      action:
        role === shownRole && kind === current
          ? Object.freeze({ kind: 'current' as const })
          : Object.freeze({
              kind: 'apply' as const,
              intent: Object.freeze({
                commands: Object.freeze([
                  role.interaction.intentFor(Object.freeze({ kind })).command,
                ]),
              }),
              ...(kind === 'artificer'
                ? {
                    opens: Object.freeze({
                      rowKey: row.key,
                      choice: 'artificerReplacement' as const,
                    }),
                  }
                : {}),
            }),
    });
  // A row with several convertible pickups names each way's own.
  const suffix = (role: (typeof roles)[number]) =>
    convertible.length > 1 ? ` · ${role.conversion.acquisitionRoleLabel}` : '';
  const verbs = [
    // Taking it plainly undoes the shown conversion.
    way(shownRole, 'normal', verb),
    ...convertible.flatMap((role) => [
      ...(role.timePiece
        ? [way(role, 'timePiece', `${conversionWords.timePiece}${suffix(role)}`)]
        : []),
      ...(role.artificer
        ? [way(role, 'artificer', `${conversionWords.artificer}${suffix(role)}`)]
        : []),
    ]),
  ];
  const shownLabel = current === 'normal' ? verb : conversionWords[current];
  const mark = findingMark(shown.address, 'pickupOutcome');
  return (
    <VerbMenu
      announce={announce}
      applied={(label) => `${name}: ${label}.`}
      biomeKey={biomeKey}
      interactions={interactions}
      label={name}
      verbs={verbs}
    >
      <button
        {...(mark['data-has-findings'] ? mark : {})}
        {...hintProps(undefined, mark['aria-description'])}
        aria-haspopup="listbox"
        aria-label={`How to take ${name}: ${shownLabel}`}
        className="contextual-picker-trigger room-action-verb"
        type="button"
      >
        {shownLabel}
      </button>
    </VerbMenu>
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
      <RowChoice choice="traitOffer" rowKey={row.key}>
        {traitControls.map((control) => (
          <TraitOfferLauncher
            control={control}
            interactions={interactions}
            key={workspaceInteractionKey(control.address)}
          />
        ))}
      </RowChoice>
      <RowChoice choice="levelResolution" rowKey={row.key}>
        {levels.map((control) => (
          <PomResolutionLauncher
            control={control}
            interactions={interactions}
            key={workspaceInteractionKey(control.address)}
          />
        ))}
      </RowChoice>
      <RowChoice choice="anvilResult" rowKey={row.key}>
        {anvilInteractions.map(({ anvil, owner }) => (
          <AnvilResultLauncher
            interaction={anvil}
            key={workspaceInteractionKey(owner)}
            owner={owner}
          />
        ))}
      </RowChoice>
      <RowChoice choice="hexActivation" rowKey={row.key}>
        {hexActivations.map(({ hexActivation, owner }) => (
          <HexActivationLauncher
            interaction={hexActivation}
            key={workspaceInteractionKey(owner)}
            owner={owner}
          />
        ))}
      </RowChoice>
      {payload === undefined ? null : (
        <RowChoice choice="seaStar" rowKey={row.key}>
          {conversions.map((conversion) => (
            <SeaStarToggle
              conversion={conversion}
              interactions={interactions}
              key={workspaceInteractionKey(conversion.address)}
              roleNamed={conversions.length > 1}
            />
          ))}
        </RowChoice>
      )}
      {row.fountainRarity === undefined ? null : (
        <RowChoice choice="fountainRarity" rowKey={row.key}>
          <FountainRarityEffectRow control={row.fountainRarity} interactions={interactions} />
        </RowChoice>
      )}
      {row.challengeSwitchOutcome === undefined ? null : (
        <RowChoice choice="challengeSwitchOutcome" rowKey={row.key}>
          <ChallengeSwitchOutcomeControls
            interactions={interactions}
            outcome={row.challengeSwitchOutcome}
          />
        </RowChoice>
      )}
    </>
  );
}

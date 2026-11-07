import { useState } from 'react';
import type { ChallengeSwitchKind } from '@run-planner/engine/catalog-schema';
import {
  requireWorkspaceInteraction,
  type WorkspaceChallengeSwitch,
  type WorkspaceChallengeSwitchElite,
  type WorkspaceChallengeSwitchInteraction,
  type WorkspaceChallengeSwitchKindRow,
  type WorkspaceChallengeSwitchLock,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { challengeSwitchRuleSentence } from '@planner/projections/challengeSwitchCopy';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { challengeSwitchIcon, roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { EncounterCustomizationLauncher } from '../locals/EncounterPhaseControl';

const isPlacementFinding = (finding: { readonly code: string }) =>
  finding.code === 'challengeSwitchPlacementUnavailable';
const isCustomizationFinding = (finding: { readonly code: string }) =>
  finding.code === 'challengeSwitchCustomizationUnavailable';
const isEliteFinding = (finding: { readonly code: string }) =>
  finding.code === 'challengeSwitchEliteUnavailable';

function lockHint(lock: WorkspaceChallengeSwitchLock): string {
  return lock.reason === 'unreached' ? candidateWaitingHint : challengeSwitchRuleSentence(lock);
}

/**
 * A host's one switch line: ticking it observes the first type that can be
 * rolled, picking a type observes that one, and unticking clears the switch.
 * The observed switch's reward, encounter and elite follow on the same line.
 */
export function ChallengeSwitchControls({
  interactions,
  observation,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly observation: WorkspaceChallengeSwitch;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.challengeSwitches,
    observation.interactionKey,
  );
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  const row = observation.kinds.find((kind) => kind.selected);
  const firstRollable = observation.kinds.find((kind) => kind.observeVariantKey !== undefined);
  // An observed switch stays clearable whatever its rules say.
  const unavailable =
    row !== undefined || firstRollable !== undefined
      ? undefined
      : observation.kinds.find((kind) => kind.lock !== undefined)?.lock;
  const target =
    row === undefined
      ? undefined
      : findingTarget(
          observation.address,
          semanticOwnerControlElementId(observation.address),
          observation.address,
          isPlacementFinding,
        );
  const idKey = semanticOwnerControlElementId(observation.address);
  return (
    <fieldset className="room-purging-pool challenge-switch">
      <legend className="visually-hidden">Challenge Switch</legend>
      <div className="room-feature-presence-row challenge-switch-row">
        <IconToggle
          disabled={row === undefined && firstRollable === undefined}
          disabledHint={unavailable === undefined ? undefined : lockHint(unavailable)}
          icon={roomObjectIcon('challengeSwitch')}
          name="Challenge Switch"
          onToggle={(next) => {
            if (!next) executeIntent(interaction.observeIntentFor(null));
            else if (firstRollable?.observeVariantKey !== undefined)
              executeIntent(interaction.observeIntentFor(firstRollable.observeVariantKey));
          }}
          pressed={row !== undefined}
          {...(target === undefined ? {} : { target })}
        />
        {row === undefined ? null : (
          <ContextualPicker<ChallengeSwitchKind>
            ariaLabel="Switch type"
            id={`challenge-switch-type-${idKey}`}
            itemIcon={(item) => challengeSwitchIcon(item.value)}
            label=""
            model={declaredChoicesPicker(
              observation.kinds.map((kind) => ({
                key: kind.kind,
                value: kind.kind,
                label: kind.label,
                ...(kind.selected || kind.observeVariantKey !== undefined
                  ? {}
                  : {
                      disabled: true,
                      ...(kind.lock === undefined ? {} : { explanation: lockHint(kind.lock) }),
                    }),
              })),
              row?.kind,
            )}
            onSelect={(kind) => {
              if (kind === row?.kind) return;
              const variantKey = observation.kinds.find(
                (candidate) => candidate.kind === kind,
              )?.observeVariantKey;
              if (variantKey !== undefined) executeIntent(interaction.observeIntentFor(variantKey));
            }}
            placeholder="Type"
            searchable={false}
            triggerIcon={challengeSwitchIcon(row.kind)}
            triggerLabel={row.label}
            triggerSize="icon"
          />
        )}
        {row === undefined ? null : (
          <ChallengeSwitchKindOptions
            interaction={interaction}
            observation={observation}
            row={row}
          />
        )}
      </div>
    </fieldset>
  );
}

function ChallengeSwitchKindOptions({
  interaction,
  observation,
  row,
}: {
  readonly interaction: WorkspaceChallengeSwitchInteraction;
  readonly observation: WorkspaceChallengeSwitch;
  readonly row: WorkspaceChallengeSwitchKindRow;
}) {
  const executeIntent = useCommandIntent();
  const selectedVariant = row.variants.find((variant) => variant.selected);
  return (
    <>
      {row.variants.length < 2 ? null : (
        <ContextualPicker<string>
          ariaLabel={`${row.label} Reward`}
          id={`challenge-switch-${row.kind}-item`}
          label=""
          model={declaredChoicesPicker(
            row.variants.map((variant) => ({
              key: variant.variantKey,
              value: variant.variantKey,
              label: variant.label,
              ...(variant.lock === undefined || variant.selected
                ? {}
                : { disabled: true, explanation: lockHint(variant.lock) }),
            })),
            selectedVariant?.variantKey,
          )}
          itemIcon={(item) =>
            rewardIcon(
              row.variants.find((variant) => variant.variantKey === item.value)?.rewardType ?? '',
            )
          }
          onSelect={(variantKey) => {
            if (variantKey !== selectedVariant?.variantKey)
              executeIntent(interaction.observeIntentFor(variantKey));
          }}
          placeholder="Reward"
          searchable={false}
          triggerSize="icon"
          {...(selectedVariant === undefined
            ? {}
            : {
                triggerIcon: rewardIcon(selectedVariant.rewardType),
                triggerLabel: selectedVariant.label,
              })}
        />
      )}
      {observation.encounter === undefined ? null : (
        <EncounterCustomizationLauncher
          interaction={interaction.customization}
          subject={{
            address: observation.address,
            controlId: `challenge-switch-customization-${semanticOwnerControlElementId(observation.address)}`,
            definitionKey: observation.encounter.definitionKey,
            label: observation.encounter.label,
            identityLabel: `${row.label} encounter`,
            hoverName: observation.encounter.label,
            ...(observation.encounter.customization === undefined
              ? {}
              : { customization: observation.encounter.customization }),
            ...(observation.encounter.composition === undefined
              ? {}
              : { composition: observation.encounter.composition }),
            findingFilter: isCustomizationFinding,
          }}
        />
      )}
      {observation.elite === undefined ? null : (
        <ChallengeSwitchEliteControl
          elite={observation.elite}
          interaction={interaction}
          observation={observation}
        />
      )}
    </>
  );
}

/**
 * The Moon Monument's elite and its forced attributes on one line. The
 * attributes are picked in draw order, each from what the earlier pins leave;
 * Default leaves that draw and the later ones native.
 */
function ChallengeSwitchEliteControl({
  elite,
  interaction,
  observation,
}: {
  readonly elite: WorkspaceChallengeSwitchElite;
  readonly interaction: WorkspaceChallengeSwitchInteraction;
  readonly observation: WorkspaceChallengeSwitch;
}) {
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  const [stage, setStage] = useState<number | undefined>(undefined);
  const pinned = elite.attributes.flatMap((attribute) =>
    attribute.key === undefined ? [] : [attribute.key],
  );
  const id = `challenge-switch-elite-${semanticOwnerControlElementId(observation.address)}`;
  const enemyKey = elite.enemyKey;
  const draw = elite.attributes[stage ?? 0];
  const pinnedLabels = elite.attributes.flatMap((attribute) =>
    attribute.key === undefined ? [] : [attribute.label ?? attribute.key],
  );
  return (
    <>
      <ContextualPicker<string>
        ariaLabel="Elite enemy"
        findingTarget={findingTarget(observation.address, id, observation.address, isEliteFinding)}
        id={id}
        label="Enemy"
        layout="inline"
        model={declaredChoicesPicker(
          [
            { key: 'default', value: '', label: 'Default' },
            ...elite.enemies.map((enemy) => ({
              key: enemy.key,
              value: enemy.key,
              label: enemy.label,
            })),
          ],
          elite.enemyKey ?? '',
        )}
        onSelect={(next) => {
          if (next === (elite.enemyKey ?? '')) return;
          executeIntent(
            interaction.eliteIntentFor(next === '' ? null : { enemyKey: next, attributeKeys: [] }),
          );
        }}
        placeholder="Default"
        triggerLabel={elite.enemyLabel ?? elite.enemyKey ?? 'Default'}
      />
      {enemyKey === undefined || elite.attributes.length === 0 ? null : (
        <ContextualPicker<string>
          ariaLabel="Elite attributes"
          cancelLabel="Cancel"
          choiceLabel={`Attribute ${(stage ?? 0) + 1}`}
          closeOnSelect={false}
          id={`${id}-attributes`}
          label="Attributes"
          layout="inline"
          model={declaredChoicesPicker(
            [
              { key: 'default', value: '', label: 'Default' },
              ...(draw?.key !== undefined && !draw.choices.some((choice) => choice.key === draw.key)
                ? [
                    {
                      key: draw.key,
                      value: draw.key,
                      label: `${draw.label ?? draw.key} (unavailable)`,
                      disabled: true,
                    },
                  ]
                : []),
              ...(draw?.choices ?? []).map((choice) => ({
                key: choice.key,
                value: choice.key,
                label: choice.label,
              })),
            ],
            draw?.key ?? '',
          )}
          onOpenChange={(open) => setStage(open ? 0 : undefined)}
          onSelect={(attributeKey) => {
            const index = stage ?? 0;
            const prefix = pinned.slice(0, index);
            const next = attributeKey === '' ? prefix : [...prefix, attributeKey];
            executeIntent(interaction.eliteIntentFor({ enemyKey, attributeKeys: next }));
            // A later draw follows the earlier pins, so it is offered once they are set.
            setStage(
              attributeKey !== '' && index + 1 < elite.attributes.length ? index + 1 : undefined,
            );
          }}
          open={stage !== undefined}
          placeholder="Default"
          searchable={false}
          triggerLabel={pinnedLabels.length === 0 ? 'Default' : pinnedLabels.join(' + ')}
        />
      )}
    </>
  );
}

import type {
  WorkspaceCommandIntent,
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceKeepsakeSelectionInteraction,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useWorkspaceInteraction,
  useWorkspaceInteractionController,
} from '@planner/ui/controls/useWorkspaceInteraction';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { useLayoutEffect, useState } from 'react';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { TranscendentEmbryoOutcomeFields } from './rewards/TranscendentEmbryoOutcomeFields';

type JeweledPomInteraction = Extract<
  WorkspaceKeepsakeEquipResultInteraction,
  { readonly owner: { readonly resultKind: 'jeweledPom' } }
>;
type ExperimentalHammerInteraction = Extract<
  WorkspaceKeepsakeEquipResultInteraction,
  { readonly owner: { readonly resultKind: 'experimentalHammer' } }
>;
type TranscendentEmbryoInteraction = Extract<
  WorkspaceKeepsakeEquipResultInteraction,
  { readonly owner: { readonly resultKind: 'transcendentEmbryo' } }
>;

const emptyModel: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

function commitEquipResult(
  executeIntent: (intent: WorkspaceCommandIntent) => void,
  interaction: WorkspaceKeepsakeEquipResultInteraction,
  value: string,
): void {
  if (interaction.owner.resultKind === 'experimentalHammer') {
    const typed = interaction as ExperimentalHammerInteraction;
    executeIntent(
      typed.intentFor(
        value === '__exhausted' ? { kind: 'exhausted' } : { kind: 'selected', traitKey: value },
      ),
    );
  } else if (interaction.owner.resultKind === 'jeweledPom') {
    const typed = interaction as JeweledPomInteraction;
    executeIntent(typed.intentFor({ ...(typed.value ?? {}), traitKey: value }));
  } else {
    const typed = interaction as TranscendentEmbryoInteraction;
    executeIntent(typed.intentFor(typed.outcomeFor(value)));
  }
}

export function KeepsakeSelectionPicker({
  disabledTitle,
  id,
  interaction,
  label,
}: {
  readonly disabledTitle?: string;
  readonly id: string;
  readonly interaction: WorkspaceKeepsakeSelectionInteraction;
  readonly label: string;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const projection = useWorkspaceInteraction(interaction);
  return (
    <ContextualPicker
      {...(disabledTitle === undefined ? {} : { disabledTitle })}
      findingTarget={findingTarget(interaction.owner, id)}
      id={id}
      label={label}
      layout="inline"
      loading={projection.pending}
      model={projection.result ?? emptyModel}
      onOpenChange={(open) => {
        if (open) projection.activate();
      }}
      onSelect={(keepsakeKey) => {
        executeIntent(interaction.replaceIntent(keepsakeKey));
      }}
      placeholder={interaction.selectedLabel}
      {...(interaction.selectedLabel === undefined
        ? {}
        : { triggerLabel: interaction.selectedLabel })}
    />
  );
}

export function KeepsakeEquipResultPicker({
  id,
  interaction: requestedInteraction,
  label: labelOverride,
}: {
  readonly id: string;
  readonly interaction: WorkspaceKeepsakeEquipResultInteraction;
  readonly label?: string;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const [interaction, setInteraction] = useState(requestedInteraction);
  const controller =
    useWorkspaceInteractionController<
      ReturnType<WorkspaceKeepsakeEquipResultInteraction['load']>
    >();
  const { pending, result: domain } = controller.observe(interaction);
  useLayoutEffect(() => {
    // Publish the binding and its numeric domain together, without unmounting
    // the slider between consecutive updates during a native drag.
    if (
      requestedInteraction.owner.resultKind === 'transcendentEmbryo' &&
      requestedInteraction.value !== undefined
    ) {
      controller.activate(requestedInteraction);
    }
    // The activated capability and its controlled inputs must commit atomically.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInteraction(requestedInteraction);
  }, [controller, requestedInteraction]);
  const resultKind = interaction.owner.resultKind;
  const embryoValue =
    resultKind === 'transcendentEmbryo'
      ? (interaction as TranscendentEmbryoInteraction).value
      : undefined;
  const label =
    resultKind === 'transcendentEmbryo'
      ? 'Target'
      : (labelOverride ??
        (resultKind === 'experimentalHammer'
          ? 'Experimental Hammer result'
          : 'Jeweled Pom result'));
  const placeholder =
    resultKind === 'experimentalHammer'
      ? 'Choose compatible Hammer'
      : resultKind === 'jeweledPom'
        ? 'Choose Hades trait'
        : 'Choose Chaos blessing';

  return (
    <div
      className={`keepsake-equip-result-control${
        resultKind === 'transcendentEmbryo' ? ' transcendent-embryo-outcome-row' : ''
      }`}
    >
      <ContextualPicker
        findingTarget={findingTarget(interaction.owner, id)}
        id={id}
        label={label}
        layout="inline"
        loading={pending}
        model={domain?.picker ?? emptyModel}
        onOpenChange={(open) => {
          if (open) controller.activate(interaction);
        }}
        onSelect={(value) => commitEquipResult(executeIntent, interaction, value)}
        placeholder={placeholder}
        {...(interaction.selectedLabel === undefined
          ? {}
          : { triggerLabel: interaction.selectedLabel })}
      />
      {domain?.transcendentEmbryoSummary === undefined || embryoValue === undefined ? null : (
        <TranscendentEmbryoOutcomeFields
          onChange={(blessingValues) => {
            const typed = interaction as TranscendentEmbryoInteraction;
            if (typed.value === undefined) return;
            executeIntent(typed.intentFor({ ...typed.value, blessingValues }));
          }}
          operands={domain.transcendentEmbryoSummary.operands}
          rarity={domain.transcendentEmbryoSummary.rarity}
          values={embryoValue.blessingValues}
        />
      )}
    </div>
  );
}

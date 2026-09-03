import type {
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceKeepsakeSelectionInteraction,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import { useLayoutEffect } from 'react';
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
  dispatch: ReturnType<typeof useAppDispatch>,
  interaction: WorkspaceKeepsakeEquipResultInteraction,
  value: string,
): void {
  if (interaction.owner.resultKind === 'experimentalHammer') {
    const typed = interaction as ExperimentalHammerInteraction;
    dispatch(
      authoredProjectCommandDispatched(
        typed.intentFor(
          value === '__exhausted' ? { kind: 'exhausted' } : { kind: 'selected', traitKey: value },
        ).command,
      ),
    );
  } else if (interaction.owner.resultKind === 'jeweledPom') {
    const typed = interaction as JeweledPomInteraction;
    dispatch(
      authoredProjectCommandDispatched(
        typed.intentFor({ ...(typed.value ?? {}), traitKey: value }).command,
      ),
    );
  } else {
    const typed = interaction as TranscendentEmbryoInteraction;
    dispatch(authoredProjectCommandDispatched(typed.intentFor(typed.outcomeFor(value)).command));
  }
}

export function KeepsakeSelectionPicker({
  id,
  interaction,
  label,
}: {
  readonly id: string;
  readonly interaction: WorkspaceKeepsakeSelectionInteraction;
  readonly label: string;
}) {
  const dispatch = useAppDispatch();
  const projection = useWorkspaceInteraction(interaction);
  return (
    <ContextualPicker
      id={id}
      label={label}
      layout="inline"
      loading={projection.pending}
      model={projection.result ?? emptyModel}
      onOpenChange={(open) => {
        if (open) projection.activate();
      }}
      onSelect={(keepsakeKey) => {
        dispatch(authoredProjectCommandDispatched(interaction.replaceIntent(keepsakeKey).command));
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
  interaction,
  label: labelOverride,
}: {
  readonly id: string;
  readonly interaction: WorkspaceKeepsakeEquipResultInteraction;
  readonly label?: string;
}) {
  const dispatch = useAppDispatch();
  const { activate, pending, result: domain } = useWorkspaceInteraction(interaction);
  const resultKind = interaction.owner.resultKind;
  const embryoValue =
    resultKind === 'transcendentEmbryo'
      ? (interaction as TranscendentEmbryoInteraction).value
      : undefined;
  useLayoutEffect(() => {
    if (embryoValue !== undefined) activate();
  }, [activate, embryoValue]);
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
        id={id}
        label={label}
        layout="inline"
        loading={pending}
        model={domain?.picker ?? emptyModel}
        onOpenChange={(open) => {
          if (open) activate();
        }}
        onSelect={(value) => commitEquipResult(dispatch, interaction, value)}
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
            dispatch(
              authoredProjectCommandDispatched(
                typed.intentFor({ ...typed.value, blessingValues }).command,
              ),
            );
          }}
          operands={domain.transcendentEmbryoSummary.operands}
          rarity={domain.transcendentEmbryoSummary.rarity}
          values={embryoValue.blessingValues}
        />
      )}
    </div>
  );
}

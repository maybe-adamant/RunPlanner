import type {
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceKeepsakeSelectionInteraction,
} from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';

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
    dispatch(authoredProjectCommandDispatched(typed.intentFor({ blessingKey: value }).command));
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
        if (keepsakeKey === '') {
          if (interaction.retainIntent !== undefined)
            dispatch(authoredProjectCommandDispatched(interaction.retainIntent().command));
          return;
        }
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
}: {
  readonly id: string;
  readonly interaction: WorkspaceKeepsakeEquipResultInteraction;
}) {
  const dispatch = useAppDispatch();
  const projection = useWorkspaceInteraction(interaction);
  const domain = projection.result;
  const resultKind = interaction.owner.resultKind;
  const label =
    resultKind === 'experimentalHammer'
      ? 'Experimental Hammer result'
      : resultKind === 'jeweledPom'
        ? 'Jeweled Pom result'
        : 'Transcendent Embryo result';
  const placeholder =
    resultKind === 'experimentalHammer'
      ? 'Choose compatible Hammer'
      : resultKind === 'jeweledPom'
        ? 'Choose Hades trait'
        : 'Choose Chaos blessing';

  return (
    <>
      <ContextualPicker
        id={id}
        label={label}
        loading={projection.pending}
        model={domain?.picker ?? emptyModel}
        onOpenChange={(open) => {
          if (open) projection.activate();
        }}
        onSelect={(value) => commitEquipResult(dispatch, interaction, value)}
        placeholder={placeholder}
        {...(interaction.selectedLabel === undefined
          ? {}
          : { triggerLabel: interaction.selectedLabel })}
      />
      {domain?.transcendentEmbryoSummary === undefined ? null : (
        <p className="field-description">
          {domain.transcendentEmbryoSummary.rarity} ·{' '}
          {domain.transcendentEmbryoSummary.operands
            .map((operand) => `${operand.label}: ${operand.value}`)
            .join(', ') || 'No numeric operands'}
        </p>
      )}
    </>
  );
}

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
import { useEffect, useLayoutEffect, useState } from 'react';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { TranscendentEmbryoOutcomeFields } from './rewards/TranscendentEmbryoOutcomeFields';
import {
  KeepsakeLauncher,
  KeepsakeRackDialog,
  type KeepsakeRackEntry,
} from '@planner/ui/controls/keepsakes/KeepsakeRack';

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

/** The rack card that leaves the held keepsake in place. */
const UNCHANGED = '__unchanged';

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

/** A rack launcher whose dialog also holds the held keepsake's equip-result controls. */
export function KeepsakeSelectionLauncher({
  disabledHint,
  equipResults,
  held,
  id,
  interaction,
  label,
  unavailableHint,
}: {
  readonly disabledHint?: string;
  readonly equipResults: readonly WorkspaceKeepsakeEquipResultInteraction[];
  /** The keepsake held arriving at a rack; choosing it leaves the rack unchanged. */
  readonly held?: { readonly key: string; readonly label: string };
  readonly id: string;
  readonly interaction: WorkspaceKeepsakeSelectionInteraction;
  readonly label: string;
  /** Dims keepsakes this slot can't take, with the reason. */
  readonly unavailableHint?: (keepsakeKey: string) => string | undefined;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const projection = useWorkspaceInteraction(interaction);
  const [open, setOpen] = useState(false);
  const { activate } = projection;
  useEffect(() => {
    // A selection replaces the interaction; reload the rack while the dialog stays open.
    if (open) activate();
  }, [activate, open]);
  const shownKey = interaction.selectedKeepsakeKey ?? held?.key;
  const entries = new Map<string, KeepsakeRackEntry>();
  for (const section of projection.result?.sections ?? [])
    for (const item of section.items) {
      if (entries.has(item.value)) continue;
      const refused = unavailableHint?.(item.value);
      // The held keepsake stays choosable: choosing it keeps it.
      const keeps = item.value === held?.key;
      entries.set(item.value, {
        key: item.value,
        label: item.label,
        selected: item.value === shownKey,
        disabled: !keeps && (item.disabled || refused !== undefined),
        hint: refused ?? item.explanation,
      });
    }
  if (held !== undefined && projection.result !== undefined && !entries.has(held.key))
    entries.set(held.key, { ...held, selected: held.key === shownKey, disabled: false });
  // Without a known held keepsake, a Postboss rack offers Unchanged as its own card.
  if (
    held === undefined &&
    interaction.owner.owner !== 'routeStart' &&
    projection.result !== undefined
  )
    entries.set(UNCHANGED, {
      key: UNCHANGED,
      label: 'Unchanged',
      selected: interaction.selectedKeepsakeKey === undefined,
      disabled: false,
    });
  const select = (keepsakeKey: string) => {
    if (keepsakeKey !== held?.key && keepsakeKey !== UNCHANGED)
      executeIntent(interaction.replaceIntent(keepsakeKey));
    else if (interaction.unchangedIntent !== undefined)
      executeIntent(interaction.unchangedIntent());
  };
  const shownLabel =
    interaction.selectedKeepsakeKey === undefined && held !== undefined
      ? `${held.label} (Unchanged)`
      : interaction.selectedLabel;
  const target = equipResults.find((result) => result.value !== undefined)?.selectedLabel;
  return (
    <>
      <KeepsakeLauncher
        findingTarget={findingTarget(
          interaction.owner,
          id,
          interaction.owner,
          undefined,
          equipResults.map((result) => result.owner),
        )}
        {...(disabledHint === undefined ? {} : { disabledHint })}
        id={id}
        keepsakeKey={shownKey}
        label={label}
        onOpen={() => setOpen(true)}
        text={`${shownLabel}${target === undefined ? '' : ` → ${target}`}`}
      />
      {open ? (
        <KeepsakeRackDialog
          detail={equipResults.map((result) => (
            <KeepsakeEquipResultPicker
              id={`${id}-${result.owner.resultKind}`}
              interaction={result}
              key={result.owner.resultKind}
            />
          ))}
          entries={[...entries.values()]}
          loading={projection.pending}
          onClose={() => setOpen(false)}
          onSelect={select}
          returnFocusId={id}
          title={label}
        />
      ) : null}
    </>
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

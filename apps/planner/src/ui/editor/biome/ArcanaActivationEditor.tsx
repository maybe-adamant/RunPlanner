import { useEffect, useState } from 'react';
import type {
  WorkspaceFigurineArcanaInteraction,
  WorkspaceJudgmentArcanaInteraction,
} from '@planner/projections/structured-workspace';
import { ArcanaCard } from '@planner/ui/controls/arcana-fear/ArcanaCard';
import { ArcanaFearDialog } from '@planner/ui/controls/arcana-fear/ArcanaFearDialog';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';

export function ArcanaActivationEditor({
  control,
  title,
  requiredCount,
  onClose,
}: {
  readonly control: WorkspaceJudgmentArcanaInteraction | WorkspaceFigurineArcanaInteraction;
  readonly title: string;
  readonly requiredCount: number;
  readonly onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState(control.value);
  const { activate, result } = useWorkspaceInteraction(control);
  useEffect(() => {
    activate();
  }, [activate]);
  const domain =
    result?.kind === 'judgmentArcana' || result?.kind === 'figurineArcana'
      ? result.result
      : undefined;
  return (
    <ArcanaFearDialog
      title={title}
      kind="arcana"
      onClose={onClose}
      onReset={() => setDraft([])}
      saveDisabled={domain === undefined}
      onSave={() => dispatch(authoredProjectCommandDispatched(control.intentFor(draft).command))}
    >
      <p className="route-loadout-summary">
        Choose {requiredCount} inactive Arcana cards in order.
      </p>
      {domain === undefined ? (
        <p>Loading Arcana…</p>
      ) : (
        <div className="room-judgment-options arcana-board">
          {control.choices.map((choice) => {
            const selected = draft.includes(choice.value);
            return (
              <ArcanaCard
                key={choice.value}
                cardKey={choice.value}
                label={choice.label}
                rarity={domain.activeArcana.find((card) => card.key === choice.value)?.rarity}
                resultRarity={domain.rarity}
                aria-pressed={selected}
                disabled={!selected && !domain.inactiveArcanaKeys.includes(choice.value)}
                selectionOrder={selected ? draft.indexOf(choice.value) + 1 : undefined}
                onClick={() =>
                  setDraft(
                    selected
                      ? draft.filter((key) => key !== choice.value)
                      : [...draft, choice.value],
                  )
                }
              />
            );
          })}
        </div>
      )}
    </ArcanaFearDialog>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type {
  WorkspaceFigurineArcanaInteraction,
  WorkspaceJudgmentArcanaInteraction,
} from '@planner/projections/structured-workspace';
import {
  formatFindingExplanation,
  presentFinding,
  semanticFindingKey,
} from '@planner/projections/evaluationProjection';
import { ArcanaCard } from '@planner/ui/controls/arcana-fear/ArcanaCard';
import {
  EditorDialog,
  EditorDialogDraftActions,
  EditorDialogFeedback,
} from '@planner/ui/controls/EditorDialog';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import {
  useOptionalWorkspaceInteraction,
  useWorkspaceInteraction,
} from '@planner/ui/controls/useWorkspaceInteraction';
import { useFindingFeedbackEntries } from '@planner/ui/feedback/useFindingTarget';

function draftAssessmentLoadable(
  control: WorkspaceJudgmentArcanaInteraction | WorkspaceFigurineArcanaInteraction,
  draft: readonly string[],
): { readonly load: () => ReturnType<typeof control.load> } {
  const load = control.load;
  return Object.freeze({ load: () => load(draft) });
}

export function ArcanaActivationEditor({
  control,
  title,
  requiredCount,
  onClose,
  returnFocusId,
}: {
  readonly control: WorkspaceJudgmentArcanaInteraction | WorkspaceFigurineArcanaInteraction;
  readonly title: string;
  readonly requiredCount: number;
  readonly onClose: () => void;
  /** The launcher that regains focus after the dialog unmounts. */
  readonly returnFocusId?: string;
}) {
  const executeIntent = useCommandIntent();
  const findingEntries = useFindingFeedbackEntries(control.owner);
  // A changed authored draw replaces the draft; a changed context keeps it.
  const valueIdentity = draftValueIdentity(control.value);
  const [draftState, setDraftState] = useState(() => ({
    identity: valueIdentity,
    keys: control.value,
  }));
  const draft = draftState.identity === valueIdentity ? draftState.keys : control.value;
  const setDraft = (keys: readonly string[]): void =>
    setDraftState({ identity: valueIdentity, keys });
  const { activate, result } = useWorkspaceInteraction(control);
  useEffect(() => {
    activate();
  }, [activate]);
  const domain =
    result?.kind === 'judgmentArcana' || result?.kind === 'figurineArcana'
      ? result.result
      : undefined;
  // At rest the region matches the launcher; an edited draft shows its own assessment.
  const atRest = draftValueIdentity(draft) === valueIdentity;
  const draftLoadable = useMemo(
    () => (atRest ? undefined : draftAssessmentLoadable(control, draft)),
    [atRest, control, draft],
  );
  const draftAssessment = useOptionalWorkspaceInteraction(draftLoadable);
  const activateDraftAssessment = draftAssessment.activate;
  useEffect(() => {
    activateDraftAssessment();
    // Activation follows the assessed draft, not each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoadable]);
  const assessed = draftAssessment.result;
  const feedbackEntries = atRest
    ? findingEntries
    : assessed?.kind === 'judgmentArcana' || assessed?.kind === 'figurineArcana'
      ? assessed.result.findings.map(
          (finding) =>
            [
              semanticFindingKey(finding),
              formatFindingExplanation(presentFinding(finding)),
            ] as const,
        )
      : [];
  return (
    <EditorDialog
      eyebrow="Arcana"
      feedback={<EditorDialogFeedback name="Arcana feedback" entries={feedbackEntries} />}
      footer={
        <EditorDialogDraftActions
          onCancel={onClose}
          onSave={() => {
            executeIntent(control.intentFor(draft));
            onClose();
          }}
          saveDisabled={domain === undefined}
          secondary={
            <button className="quiet-action" onClick={() => setDraft([])} type="button">
              Clear
            </button>
          }
        />
      }
      model={{ kind: 'draft', onCancel: onClose }}
      {...(returnFocusId === undefined ? {} : { returnFocusId })}
      size="cards"
      title={title}
    >
      <p className="route-loadout-summary">
        Choose {requiredCount} inactive Arcana cards in order.
      </p>
      <div className="trait-choice-region">
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
      </div>
    </EditorDialog>
  );
}

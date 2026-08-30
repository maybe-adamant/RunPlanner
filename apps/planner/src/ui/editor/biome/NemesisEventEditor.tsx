import type { AuthoredNemesisRandomEventOutcome } from '@run-planner/engine/authored-project';
import type {
  WorkspaceNemesisEventDomain,
  WorkspaceNemesisEventInteraction,
} from '@planner/projections/structured-workspace';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { useState } from 'react';

const emptyTraitPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

export function NemesisEventEditor({
  interaction,
}: {
  readonly interaction: WorkspaceNemesisEventInteraction;
}) {
  const executeIntent = useCommandIntent();
  const [draft, setDraft] = useState<AuthoredNemesisRandomEventOutcome | null>(interaction.value);
  const [rewardType, setRewardType] = useState<string | null>(
    interaction.reward?.rewardType ?? null,
  );
  const candidate = useWorkspaceInteraction(interaction);
  const domain = candidate.result;
  const kind = draft?.kind ?? '';
  const traitTradeDraft = draft?.kind === 'traitTrade' ? draft : undefined;
  const traitPicker =
    traitTradeDraft === undefined
      ? emptyTraitPicker
      : (domain?.traitTradePicker(
          traitTradeDraft.traitKey === '' ? undefined : traitTradeDraft.traitKey,
        ) ?? emptyTraitPicker);
  const traitTriggerLabel = traitPicker.selected?.label ?? (traitTradeDraft?.traitKey || undefined);
  const rewardTypes = withRetained(
    nemesisRewardTypes(domain, draft),
    rewardType ?? interaction.reward?.rewardType,
  );
  const selectedRewardType =
    rewardType !== null && rewardTypes.includes(rewardType) ? rewardType : (rewardTypes[0] ?? null);
  const selectedRewardLabel =
    selectedRewardType === null ? null : interaction.rewardLabelFor(selectedRewardType);
  const missingRequirement = nemesisEventMissingRequirement(draft, selectedRewardType);
  const hasUnsavedChanges =
    !sameNemesisOutcome(draft, interaction.value) ||
    selectedRewardType !== (interaction.reward?.rewardType ?? null);

  const setKind = (next: AuthoredNemesisRandomEventOutcome['kind']): void => {
    setRewardType(null);
    setDraft(defaultNemesisOutcome(domain, next));
  };

  return (
    <section
      aria-label="Nemesis event"
      className="nemesis-event-editor"
      id={semanticOwnerControlElementId(interaction.owner)}
    >
      <div className="local-reward-heading">
        <h4>Nemesis event</h4>
        <SemanticOwnerMarker address={interaction.owner} />
      </div>
      <div className="nemesis-event-fields">
        <label className="field-control">
          <span>Family</span>
          <select
            aria-label="Nemesis family"
            onFocus={candidate.activate}
            onPointerDown={candidate.activate}
            onChange={(event) =>
              setKind(event.target.value as AuthoredNemesisRandomEventOutcome['kind'])
            }
            value={kind ?? ''}
          >
            {draft === null ? <option value="">Choose family</option> : null}
            {withRetained(domain?.familyKeys ?? [], draft?.kind).map((value) => (
              <option key={value} value={value}>
                {nemesisFamilyLabel(value)}
              </option>
            ))}
          </select>
        </label>
        {draft !== null && 'response' in draft ? (
          <label className="field-control">
            <span>Response</span>
            <select
              aria-label="Nemesis response"
              onChange={(event) =>
                setDraft({ ...draft, response: event.target.value as 'accept' | 'decline' })
              }
              value={draft.response}
            >
              {withRetained(responseDomain(domain, draft.kind), draft.response).map((value) => (
                <option key={value} value={value}>
                  {sentenceCase(value)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {draft?.kind === 'damageContest' ? (
          <label className="field-control">
            <span>Result</span>
            <select
              aria-label="Nemesis contest result"
              onChange={(event) =>
                setDraft({
                  kind: 'damageContest',
                  result: event.target.value as 'success' | 'failure',
                })
              }
              value={draft.result}
            >
              {withRetained(domain?.damageContestResults ?? [], draft.result).map((value) => (
                <option key={value} value={value}>
                  {sentenceCase(value)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {draft?.kind === 'traitTrade' ? (
          <ContextualPicker
            ariaLabel="Nemesis trait"
            id="nemesis-trait"
            label="Trait"
            loading={candidate.pending}
            model={traitPicker}
            onOpenChange={(open) => {
              if (open) candidate.activate();
            }}
            onSelect={(traitKey) => setDraft({ ...draft, traitKey })}
            placeholder="Choose a trait"
            {...(traitTriggerLabel === undefined ? {} : { triggerLabel: traitTriggerLabel })}
          />
        ) : null}
        {draft === null ? null : (
          <label className="field-control">
            <span>Reward</span>
            <select
              aria-label="Nemesis reward"
              onChange={(event) => setRewardType(event.target.value)}
              value={selectedRewardType ?? ''}
            >
              {rewardTypes.map((value) => (
                <option key={value} value={value}>
                  {interaction.rewardLabelFor(value)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="fixed-room-state">
        {missingRequirement ?? nemesisOutcomeSummary(draft, selectedRewardLabel)}
      </p>
      <div className="hub-rank-actions">
        <button
          className="primary-action"
          disabled={missingRequirement !== null || !hasUnsavedChanges}
          onClick={() =>
            executeIntent(
              interaction.intentFor(
                draft,
                draft === null || selectedRewardType === null
                  ? null
                  : { rewardType: selectedRewardType },
              ),
            )
          }
          type="button"
        >
          {missingRequirement !== null || hasUnsavedChanges ? 'Save event' : 'Saved'}
        </button>
        <button
          className="quiet-action"
          onClick={() => {
            setDraft(interaction.value);
            setRewardType(interaction.reward?.rewardType ?? null);
          }}
          type="button"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

function nemesisFamilyLabel(kind: AuthoredNemesisRandomEventOutcome['kind']): string {
  switch (kind) {
    case 'freeItem':
      return 'Free item';
    case 'goldTrade':
      return 'Gold trade';
    case 'damageTrade':
      return 'Damage trade';
    case 'traitTrade':
      return 'Trait trade';
    case 'damageContest':
      return 'Damage contest';
  }
}

function sentenceCase(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function nemesisEventMissingRequirement(
  draft: AuthoredNemesisRandomEventOutcome | null,
  rewardType: string | null,
): string | null {
  if (draft === null) return 'Choose an event family.';
  if (draft.kind === 'traitTrade' && draft.traitKey === '') {
    return 'Choose an eligible trait.';
  }
  return rewardType === null ? 'Choose a result.' : null;
}

function sameNemesisOutcome(
  left: AuthoredNemesisRandomEventOutcome | null,
  right: AuthoredNemesisRandomEventOutcome | null,
): boolean {
  if (left === right) return true;
  if (left === null || right === null || left.kind !== right.kind) return false;
  switch (left.kind) {
    case 'freeItem':
      return true;
    case 'goldTrade':
    case 'damageTrade':
      return 'response' in right && left.response === right.response;
    case 'traitTrade':
      return (
        right.kind === 'traitTrade' &&
        left.response === right.response &&
        left.traitKey === right.traitKey
      );
    case 'damageContest':
      return right.kind === 'damageContest' && left.result === right.result;
  }
}

function defaultNemesisOutcome(
  domain: WorkspaceNemesisEventDomain | undefined,
  kind: AuthoredNemesisRandomEventOutcome['kind'],
): AuthoredNemesisRandomEventOutcome {
  switch (kind) {
    case 'freeItem':
      return { kind };
    case 'goldTrade':
      return { kind, response: domain?.goldTradeResponses[0] ?? 'accept' };
    case 'damageTrade':
      return { kind, response: domain?.damageTradeResponses[0] ?? 'accept' };
    case 'traitTrade':
      return {
        kind,
        traitKey: domain?.traitTradeTraitKeys[0] ?? '',
        response: domain?.traitTradeResponses[0] ?? 'accept',
      };
    case 'damageContest':
      return { kind, result: domain?.damageContestResults[0] ?? 'success' };
  }
}

function responseDomain(
  domain: WorkspaceNemesisEventDomain | undefined,
  kind: 'goldTrade' | 'damageTrade' | 'traitTrade',
): readonly ('accept' | 'decline')[] {
  switch (kind) {
    case 'goldTrade':
      return domain?.goldTradeResponses ?? [];
    case 'damageTrade':
      return domain?.damageTradeResponses ?? [];
    case 'traitTrade':
      return domain?.traitTradeResponses ?? [];
  }
}

function withRetained<Value extends string>(
  values: readonly Value[],
  retained: Value | undefined,
): readonly Value[] {
  return retained === undefined || values.includes(retained) ? values : [...values, retained];
}

function nemesisRewardTypes(
  domain: WorkspaceNemesisEventDomain | undefined,
  draft: AuthoredNemesisRandomEventOutcome | null,
): readonly string[] {
  if (draft === null) return [];
  switch (draft.kind) {
    case 'freeItem':
      return domain?.freeItemRewardTypes ?? [];
    case 'goldTrade':
      return domain?.goldTradeRewardTypes ?? [];
    case 'damageTrade':
      return domain?.damageTradeRewardTypes ?? [];
    case 'traitTrade':
      return domain === undefined ? [] : [domain.traitTradeRewardType];
    case 'damageContest':
      return draft.result === 'failure'
        ? domain === undefined
          ? []
          : [domain.damageContestFailureRewardType]
        : (domain?.damageContestSuccessRewardTypes ?? []);
  }
}

function nemesisOutcomeSummary(
  draft: AuthoredNemesisRandomEventOutcome | null,
  rewardLabel: string | null,
): string {
  if (draft === null) return 'Outcome unresolved.';
  if (rewardLabel === null) return 'Choose a result identity.';
  return 'response' in draft && draft.response === 'decline'
    ? `Declined; retained result: ${rewardLabel}.`
    : `Generated result: ${rewardLabel}.`;
}

import type { AuthoredNemesisRandomEventOutcome } from '@run-planner/engine/authored-project';
import type {
  WorkspaceNemesisEventDomain,
  WorkspaceNemesisEventInteraction,
} from '@planner/projections/structured-workspace';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { useState } from 'react';

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
  const rewardTypes = withRetained(
    nemesisRewardTypes(domain, draft),
    rewardType ?? interaction.reward?.rewardType,
  );
  const selectedRewardType =
    rewardType !== null && rewardTypes.includes(rewardType) ? rewardType : (rewardTypes[0] ?? null);

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
              {value.replace(/([A-Z])/g, ' $1')}
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
                {value}
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
                {value}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {draft?.kind === 'traitTrade' ? (
        <label className="field-control">
          <span>Trait</span>
          <select
            aria-label="Nemesis trait"
            onChange={(event) => setDraft({ ...draft, traitKey: event.target.value })}
            value={draft.traitKey}
          >
            {withRetained(domain?.traitTradeTraitKeys ?? [], draft.traitKey).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
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
                {value}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="fixed-room-state">{nemesisOutcomeSummary(draft, selectedRewardType)}</p>
      <div className="hub-rank-actions">
        <button
          disabled={draft !== null && selectedRewardType === null}
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
          Save event
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
  rewardType: string | null,
): string {
  if (draft === null) return 'Outcome unresolved.';
  if (rewardType === null) return 'Choose a result identity.';
  return 'response' in draft && draft.response === 'decline'
    ? `Declined; retained result: ${rewardType}.`
    : `Generated result: ${rewardType}.`;
}

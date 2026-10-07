import {
  semanticAddressKey,
  type AuthoredCirceResolution,
  type AuthoredTraitOfferTraits,
  type CirceResolutionAddress,
} from '@run-planner/engine/authored-project';
import { useState } from 'react';
import type { WorkspaceCirceResolutionDomain } from '@planner/projections/structured-workspace';
import { ArcanaCard } from '@planner/ui/controls/arcana-fear/ArcanaCard';
import { FearCard } from '@planner/ui/controls/arcana-fear/FearCard';
import {
  EditorDialog,
  EditorDialogDraftActions,
  EditorDialogFeedback,
} from '@planner/ui/controls/EditorDialog';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import {
  circeResolutionDialogClosed,
  circeResolutionDialogOpened,
} from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import {
  useFindingFeedbackEntries,
  type FindingTargetProps,
} from '@planner/ui/feedback/useFindingTarget';
import { SelectedOutcomeRow } from './SelectedOutcomeBlock';
import { circeUnavailableMessage } from './traitOfferOptions';

export function TraitOfferCirceResolution({
  address,
  controlId,
  findingTarget,
  domain,
  keyLabel,
  option,
  onSelect,
}: {
  readonly address: CirceResolutionAddress;
  readonly controlId: string;
  readonly findingTarget?: FindingTargetProps;
  readonly domain: WorkspaceCirceResolutionDomain | undefined;
  readonly keyLabel: (key: string) => string;
  readonly option: AuthoredTraitOfferTraits['options'][number];
  readonly onSelect: (resolution: AuthoredCirceResolution) => void;
}) {
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => {
    const target = state.editorSession.circeDialogTarget ?? null;
    return target !== null && semanticAddressKey(target) === semanticAddressKey(address);
  });
  const [draftState, setDraftState] = useState<{
    identity: string;
    title: string;
    kind: 'arcana' | 'fear';
    keys: readonly string[];
  } | null>(null);
  const current = option.circeResolution;
  const currentKeys =
    current === undefined
      ? []
      : current.kind === 'disableFear'
        ? current.vowKeys
        : current.arcanaKeys;
  const fear = domain?.effect === 'disableFear';
  const title = fear
    ? 'Black Night Vow'
    : domain?.effect === 'activateArcana'
      ? 'Red Citrine Arcana'
      : 'Promoted Arcana';
  // A changed outcome or effect replaces the local draft; a changed context keeps it.
  const identity = draftValueIdentity([current ?? null, domain?.effect ?? null]);
  const draft = !open
    ? null
    : draftState?.identity === identity
      ? draftState
      : {
          identity,
          title,
          kind: fear ? ('fear' as const) : ('arcana' as const),
          keys: currentKeys,
        };
  const setDraft = (next: NonNullable<typeof draft>): void => setDraftState(next);
  const close = (): void => {
    setDraftState(null);
    dispatch(circeResolutionDialogClosed());
  };
  const picker = fear ? domain?.vowPicker : domain?.arcanaPicker;
  const unavailable = circeUnavailableMessage(domain);
  const disabled = domain === undefined || unavailable !== undefined;
  const findingEntries = useFindingFeedbackEntries(address);
  const complete = draft?.keys.length === domain?.requiredCount;
  const candidates =
    domain === undefined || draft === null
      ? []
      : (fear
          ? domain.vowPickerFor(draft.keys)
          : domain.arcanaPickerFor(draft.keys)
        ).sections.flatMap((section) => section.items);
  const choices = fear
    ? (picker?.sections.flatMap((section) => section.items) ?? [])
    : (domain?.arcanaCards.map((card) => ({ value: card.key, label: card.label })) ?? []);
  return (
    <>
      <SelectedOutcomeRow label={fear ? 'Suppressed Vows' : 'Arcana'}>
        <button
          {...findingTarget}
          id={controlId}
          className="contextual-picker-trigger"
          type="button"
          aria-label={title}
          aria-invalid={picker?.selected?.disabled || undefined}
          aria-haspopup="dialog"
          disabled={domain === undefined}
          title={domain === undefined ? 'Evaluating this Circe outcome…' : undefined}
          onClick={() => dispatch(circeResolutionDialogOpened(address))}
        >
          <span>
            {currentKeys.length > 0
              ? currentKeys.map(keyLabel).join(' · ')
              : domain === undefined || domain.requiredCount === 0
                ? '—'
                : `Choose ${domain.requiredCount}`}
          </span>
        </button>
      </SelectedOutcomeRow>
      {draft === null ? null : (
        <EditorDialog
          eyebrow="Circe"
          feedback={
            <EditorDialogFeedback
              name="Circe feedback"
              entries={
                unavailable === undefined
                  ? findingEntries
                  : [['unavailable', unavailable], ...findingEntries]
              }
            />
          }
          footer={
            <EditorDialogDraftActions
              onCancel={() => close()}
              onSave={() => {
                if (domain === undefined) return;
                onSelect(
                  domain.effect === 'disableFear'
                    ? { kind: 'disableFear', vowKeys: draft.keys }
                    : { kind: domain.effect, arcanaKeys: draft.keys },
                );
                close();
              }}
              saveDisabled={disabled || !complete}
              secondary={
                <button
                  className="quiet-action"
                  onClick={() => setDraft({ ...draft, keys: [] })}
                  type="button"
                >
                  Clear
                </button>
              }
            />
          }
          model={{ kind: 'draft', onCancel: () => close() }}
          returnFocusId={controlId}
          size="cards"
          title={draft.title}
        >
          <div className="trait-choice-region">
            {domain === undefined ? (
              <p>Loading choices…</p>
            ) : (
              <>
                <p className="route-loadout-summary">
                  Choose {domain.requiredCount}{' '}
                  {fear ? 'Vows to suppress' : 'Arcana cards in order'}. {draft.keys.length}{' '}
                  selected.
                </p>
                <div
                  role="group"
                  aria-label={`${draft.title} cards`}
                  className={fear ? 'fear-rank-list' : 'arcana-board'}
                >
                  {choices.map((choice) => {
                    const selected = draft.keys.includes(choice.value);
                    const candidate = candidates.find((item) => item.value === choice.value);
                    const props = {
                      'aria-pressed': selected,
                      disabled:
                        disabled ||
                        (!selected && (complete || candidate === undefined || candidate.disabled)),
                      title: candidate?.explanation,
                      onClick: () =>
                        setDraft({
                          ...draft,
                          keys: selected
                            ? draft.keys.filter((key) => key !== choice.value)
                            : [...draft.keys, choice.value],
                        }),
                    };
                    return fear ? (
                      <FearCard
                        key={choice.value}
                        {...props}
                        vowKey={choice.value}
                        label={choice.label}
                        aria-label={choice.label}
                      />
                    ) : (
                      <ArcanaCard
                        key={choice.value}
                        {...props}
                        cardKey={choice.value}
                        label={choice.label}
                        rarity={
                          domain.arcanaCards.find((card) => card.key === choice.value)?.rarity
                        }
                        resultRarity={domain.resultRarity}
                        selectionOrder={selected ? draft.keys.indexOf(choice.value) + 1 : undefined}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </EditorDialog>
      )}
    </>
  );
}

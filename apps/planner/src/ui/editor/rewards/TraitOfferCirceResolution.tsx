import type {
  AuthoredCirceResolution,
  AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import { useState } from 'react';
import type { WorkspaceCirceResolutionDomain } from '@planner/projections/structured-workspace';
import { ArcanaCard } from '@planner/ui/controls/arcana-fear/ArcanaCard';
import { FearCard } from '@planner/ui/controls/arcana-fear/FearCard';
import { ArcanaFearDialog } from '@planner/ui/controls/arcana-fear/ArcanaFearDialog';
import type { FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';

export function TraitOfferCirceResolution({
  controlId,
  findingTarget,
  domain,
  option,
  onSelect,
}: {
  readonly controlId: string;
  readonly findingTarget?: FindingTargetProps;
  readonly domain: WorkspaceCirceResolutionDomain | undefined;
  readonly option: AuthoredTraitOfferTraits['options'][number];
  readonly onSelect: (resolution: AuthoredCirceResolution) => void;
}) {
  const [draft, setDraft] = useState<{
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
  const picker = fear ? domain?.vowPicker : domain?.arcanaPicker;
  const labelFor = (key: string) =>
    picker?.sections.flatMap((section) => section.items).find((item) => item.value === key)
      ?.label ?? key;
  const unavailableMessage =
    domain === undefined
      ? undefined
      : !domain.outerAvailable
        ? 'This Circe trait has no available outcome here.'
        : !domain.branchAgreement
          ? 'No outcome is supported across every route branch.'
          : undefined;
  const disabled = domain === undefined || unavailableMessage !== undefined;
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
      <fieldset className="trait-circe-resolution" hidden={domain === undefined}>
        <legend>
          {fear
            ? 'Vows to suppress'
            : domain?.effect === 'activateArcana'
              ? 'Red Citrine Arcana'
              : 'Lapis Arcana'}{' '}
          ({domain?.requiredCount})
        </legend>
        {unavailableMessage === undefined ? null : (
          <p className="feedback-text">{unavailableMessage}</p>
        )}
        <button
          {...findingTarget}
          id={controlId}
          className="contextual-picker-trigger"
          type="button"
          aria-label={title}
          aria-invalid={picker?.selected?.disabled || undefined}
          aria-haspopup="dialog"
          onClick={() => setDraft({ title, kind: fear ? 'fear' : 'arcana', keys: currentKeys })}
        >
          {currentKeys.length === 0 ? title : currentKeys.map(labelFor).join(' · ')}
        </button>
      </fieldset>
      {draft === null ? null : (
        <ArcanaFearDialog
          title={draft.title}
          kind={draft.kind}
          onClose={() => setDraft(null)}
          onReset={() => setDraft({ ...draft, keys: [] })}
          saveDisabled={disabled || !complete}
          onSave={() => {
            if (domain === undefined) return;
            onSelect(
              domain.effect === 'disableFear'
                ? { kind: 'disableFear', vowKeys: draft.keys }
                : { kind: domain.effect, arcanaKeys: draft.keys },
            );
          }}
        >
          {domain === undefined ? (
            <p>Loading choices…</p>
          ) : (
            <>
              <p className="route-loadout-summary">
                Choose {domain.requiredCount} {fear ? 'Vows to suppress' : 'Arcana cards in order'}.{' '}
                {draft.keys.length} selected.
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
                      rarity={domain.arcanaCards.find((card) => card.key === choice.value)?.rarity}
                      resultRarity={domain.resultRarity}
                      selectionOrder={selected ? draft.keys.indexOf(choice.value) + 1 : undefined}
                    />
                  );
                })}
              </div>
            </>
          )}
        </ArcanaFearDialog>
      )}
    </>
  );
}

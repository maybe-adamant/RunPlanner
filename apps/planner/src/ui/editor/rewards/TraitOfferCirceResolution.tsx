import type {
  AuthoredCirceResolution,
  AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import { useState } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { WorkspaceCirceResolutionDomain } from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import type { FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';

function pickerValueLabel<T>(model: ContextualPickerModel<T>, value: T): string | undefined {
  return model.sections
    .flatMap((section) => section.items)
    .find((item) => Object.is(item.value, value))?.label;
}

function CirceMultiSelection({
  applyLabel,
  ariaLabel,
  choiceLabel,
  controlId,
  current,
  disabled,
  emptyLabel,
  findingTarget,
  label,
  picker,
  pickerFor,
  requiredCount,
  onApply,
}: {
  readonly applyLabel: string;
  readonly ariaLabel: string;
  readonly choiceLabel: string;
  readonly controlId: string;
  readonly current: readonly string[];
  readonly disabled: boolean;
  readonly emptyLabel: string;
  readonly findingTarget?: FindingTargetProps;
  readonly label: string;
  readonly picker: ContextualPickerModel<string>;
  readonly pickerFor: (selectedKeys: readonly string[]) => ContextualPickerModel<string>;
  readonly requiredCount: number;
  readonly onApply: (keys: readonly string[]) => void;
}) {
  const [draft, setDraft] = useState<readonly string[]>(current);
  const [open, setOpen] = useState(false);
  const complete = draft.length === requiredCount;
  return (
    <fieldset className="trait-circe-resolution">
      <legend>{`${label} (${requiredCount})`}</legend>
      <p className="trait-outcome-draft">
        {draft.length === 0
          ? emptyLabel
          : draft.map((key) => pickerValueLabel(picker, key) ?? key).join(' · ')}
      </p>
      {requiredCount > 0 || current.length > 0 ? (
        <ContextualPicker
          {...(findingTarget === undefined ? {} : { findingTarget })}
          cancelLabel="Cancel"
          choiceLabel={`${choiceLabel} ${draft.length + 1} of ${requiredCount}`}
          closeOnSelect={false}
          id={controlId}
          label={ariaLabel}
          model={pickerFor(draft)}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (nextOpen && complete) setDraft(Object.freeze([]));
            if (!nextOpen && !complete) setDraft(current);
          }}
          onSelect={(key) => {
            const next = Object.freeze([...draft, key]);
            setDraft(next);
            if (next.length === requiredCount) {
              setOpen(false);
              if (requiredCount === 1) onApply(next);
            }
          }}
          open={open}
          placeholder={`Choose distinct ${choiceLabel}`}
        />
      ) : null}
      <div className="trait-outcome-actions">
        <button
          className="quiet-action action-compact"
          disabled={!complete || disabled}
          onClick={() => onApply(draft)}
          type="button"
        >
          {applyLabel}
        </button>
        <button
          className="quiet-action action-compact"
          onClick={() => {
            setOpen(false);
            setDraft(current);
          }}
          type="button"
        >
          Cancel
        </button>
      </div>
    </fieldset>
  );
}

export function TraitOfferCirceResolution({
  controlId,
  findingTarget,
  domain,
  option,
  onSelect,
}: {
  readonly controlId: string;
  readonly findingTarget?: FindingTargetProps;
  readonly domain: WorkspaceCirceResolutionDomain;
  readonly option: AuthoredTraitOfferTraits['options'][number];
  readonly onSelect: (resolution: AuthoredCirceResolution) => void;
}) {
  const current = option.circeResolution;
  const unavailableMessage = !domain.outerAvailable
    ? 'This Circe trait has no available outcome here.'
    : !domain.branchAgreement
      ? 'No outcome is supported across every route branch.'
      : undefined;
  const disabled = !domain.outerAvailable || !domain.branchAgreement;
  if (domain.effect === 'disableFear') {
    return (
      <>
        {unavailableMessage === undefined ? null : (
          <p className="feedback-text">{unavailableMessage}</p>
        )}
        <CirceMultiSelection
          applyLabel="Apply Black Night outcome"
          ariaLabel="Black Night Vow"
          choiceLabel="Vow"
          controlId={controlId}
          current={current?.kind === 'disableFear' ? current.vowKeys : Object.freeze([])}
          disabled={disabled}
          emptyLabel="No Vows chosen."
          {...(findingTarget === undefined ? {} : { findingTarget })}
          label="Vows to suppress"
          onApply={(vowKeys) => onSelect(Object.freeze({ kind: 'disableFear', vowKeys }))}
          picker={domain.vowPicker}
          pickerFor={domain.vowPickerFor}
          requiredCount={domain.requiredCount}
          key={domain.effect}
        />
      </>
    );
  }
  const selected =
    current?.kind === domain.effect ? current.arcanaKeys : (Object.freeze([]) as readonly string[]);
  if (domain.effect === 'activateArcana' && domain.requiredCount === 0) {
    return (
      <>
        {unavailableMessage === undefined ? null : (
          <p className="feedback-text">{unavailableMessage}</p>
        )}
        {!disabled ? (
          <button
            className="quiet-action action-compact"
            onClick={() =>
              onSelect(Object.freeze({ kind: 'activateArcana', arcanaKeys: Object.freeze([]) }))
            }
            type="button"
          >
            Record no Arcana activation
          </button>
        ) : null}
      </>
    );
  }
  const activation = domain.effect === 'activateArcana';
  return (
    <>
      {unavailableMessage === undefined ? null : (
        <p className="feedback-text">{unavailableMessage}</p>
      )}
      <CirceMultiSelection
        applyLabel={activation ? 'Apply Red Citrine outcome' : 'Apply Lapis outcome'}
        ariaLabel={activation ? 'Red Citrine Arcana' : 'Promoted Arcana'}
        choiceLabel="Arcana"
        controlId={controlId}
        current={selected}
        disabled={disabled}
        emptyLabel="No Arcana chosen."
        {...(findingTarget === undefined ? {} : { findingTarget })}
        label={activation ? 'Red Citrine Arcana' : 'Lapis Arcana'}
        onApply={(arcanaKeys) =>
          onSelect(Object.freeze({ kind: domain.effect, arcanaKeys }) as AuthoredCirceResolution)
        }
        picker={domain.arcanaPicker}
        pickerFor={domain.arcanaPickerFor}
        requiredCount={domain.requiredCount}
        key={domain.effect}
      />
    </>
  );
}

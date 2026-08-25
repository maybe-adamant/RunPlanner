import type {
  AuthoredCirceResolution,
  AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import { useState } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import type { WorkspaceCirceResolutionDomain } from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';

function pickerValueLabel<T>(model: ContextualPickerModel<T>, value: T): string | undefined {
  return model.sections
    .flatMap((section) => section.items)
    .find((item) => Object.is(item.value, value))?.label;
}

export function TraitOfferCirceResolution({
  controlId,
  domain,
  option,
  onSelect,
}: {
  readonly controlId: string;
  readonly domain: WorkspaceCirceResolutionDomain;
  readonly option: AuthoredTraitOfferTraits['options'][number];
  readonly onSelect: (resolution: AuthoredCirceResolution) => void;
}) {
  const current = option.circeResolution;
  const [lapisDraft, setLapisDraft] = useState<readonly string[]>(
    current?.kind === 'promoteArcana' ? current.arcanaKeys : Object.freeze([]),
  );
  const [lapisOpen, setLapisOpen] = useState(false);
  const unavailableMessage = !domain.outerAvailable
    ? 'This Circe trait has no available outcome here.'
    : !domain.branchAgreement
      ? 'No outcome is supported across every route branch.'
      : undefined;
  if (domain.effect === 'disableFear') {
    return (
      <>
        {unavailableMessage === undefined ? null : (
          <p className="feedback-text">{unavailableMessage}</p>
        )}
        <ContextualPicker
          ariaLabel="Black Night Vow"
          id={controlId}
          label="Vow to suppress"
          model={domain.vowPicker}
          onSelect={(vowKey) => onSelect(Object.freeze({ kind: 'disableFear', vowKey }))}
          placeholder="Choose a Vow"
          {...(current?.kind === 'disableFear' && current.vowKey !== null
            ? { triggerLabel: pickerValueLabel(domain.vowPicker, current.vowKey) ?? current.vowKey }
            : {})}
        />
      </>
    );
  }
  const selected =
    current?.kind === domain.effect ? current.arcanaKeys : (Object.freeze([]) as readonly string[]);
  if (domain.effect === 'activateArcana') {
    if (domain.requiredCount === 0) {
      return (
        <>
          {unavailableMessage === undefined ? null : (
            <p className="feedback-text">{unavailableMessage}</p>
          )}
          {selected[0] === undefined ? null : (
            <ContextualPicker
              ariaLabel="Red Citrine Arcana"
              id={controlId}
              label="Authored Arcana"
              model={domain.arcanaPicker}
              onSelect={(arcanaKey) =>
                onSelect(
                  Object.freeze({
                    kind: 'activateArcana',
                    arcanaKeys: Object.freeze([arcanaKey]),
                  }),
                )
              }
              placeholder="No authored Arcana"
              triggerLabel={pickerValueLabel(domain.arcanaPicker, selected[0]) ?? selected[0]}
            />
          )}
          {!domain.outerAvailable || !domain.branchAgreement ? null : (
            <button
              className="quiet-action action-compact"
              onClick={() =>
                onSelect(Object.freeze({ kind: 'activateArcana', arcanaKeys: Object.freeze([]) }))
              }
              type="button"
            >
              Record no Arcana activation
            </button>
          )}
        </>
      );
    }
    return (
      <>
        {unavailableMessage === undefined ? null : (
          <p className="feedback-text">{unavailableMessage}</p>
        )}
        <ContextualPicker
          ariaLabel="Red Citrine Arcana"
          id={controlId}
          label="Arcana to activate"
          model={domain.arcanaPicker}
          onSelect={(arcanaKey) =>
            onSelect(
              Object.freeze({ kind: 'activateArcana', arcanaKeys: Object.freeze([arcanaKey]) }),
            )
          }
          placeholder="Choose Arcana"
          {...(selected[0] === undefined
            ? {}
            : { triggerLabel: pickerValueLabel(domain.arcanaPicker, selected[0]) ?? selected[0] })}
        />
      </>
    );
  }
  const lapisComplete = lapisDraft.length === domain.requiredCount;
  return (
    <fieldset className="trait-circe-resolution">
      <legend>Lapis Arcana ({domain.requiredCount})</legend>
      {unavailableMessage === undefined ? null : (
        <p className="feedback-text">{unavailableMessage}</p>
      )}
      <p className="trait-outcome-draft">
        {lapisDraft.length === 0
          ? 'No Arcana chosen.'
          : lapisDraft.map((key) => pickerValueLabel(domain.arcanaPicker, key) ?? key).join(' · ')}
      </p>
      <ContextualPicker
        cancelLabel="Cancel"
        choiceLabel={`Arcana ${lapisDraft.length + 1} of ${domain.requiredCount}`}
        closeOnSelect={false}
        id={controlId}
        label="Promoted Arcana"
        model={domain.arcanaPickerFor(lapisDraft)}
        onOpenChange={(open) => {
          setLapisOpen(open);
          if (open && lapisComplete) setLapisDraft(Object.freeze([]));
          if (!open && !lapisComplete)
            setLapisDraft(
              current?.kind === 'promoteArcana' ? current.arcanaKeys : Object.freeze([]),
            );
        }}
        onSelect={(arcanaKey) => {
          const next = Object.freeze([...lapisDraft, arcanaKey]);
          setLapisDraft(next);
          if (next.length === domain.requiredCount) setLapisOpen(false);
        }}
        open={lapisOpen}
        placeholder="Choose distinct Arcana"
      />
      <div className="trait-outcome-actions">
        <button
          className="quiet-action action-compact"
          disabled={!lapisComplete || !domain.outerAvailable || !domain.branchAgreement}
          onClick={() => onSelect(Object.freeze({ kind: 'promoteArcana', arcanaKeys: lapisDraft }))}
          type="button"
        >
          Apply Lapis outcome
        </button>
        <button
          className="quiet-action action-compact"
          onClick={() => {
            setLapisOpen(false);
            setLapisDraft(
              current?.kind === 'promoteArcana' ? current.arcanaKeys : Object.freeze([]),
            );
          }}
          type="button"
        >
          Cancel
        </button>
      </div>
    </fieldset>
  );
}

import {
  semanticAddressKey,
  optionIndex,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredAllTogetherResult,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { DirectTraitSetKey, TraitRarity } from '@run-planner/engine/catalog-schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { candidateSupport } from '@planner/projections/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import type { TraitOptionDomainProjection } from '@planner/projections/traitDomainProjection';
import type { AuthoredCirceResolution } from '@run-planner/engine/authored-project';
import { projectTraitOfferFeedback } from '@planner/projections/traitProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceCirceResolutionDomain,
  type WorkspaceEchoPomTargetDomain,
  type WorkspaceEchoLastRunBoonDomain,
  type WorkspaceEchoLastRunBoonTraitIdentity,
  type WorkspaceAllTogetherSetInteraction,
  type WorkspaceAllTogetherSetDomain,
  type WorkspaceTraitOfferInteraction,
  type WorkspaceTraitOfferControl,
} from '@planner/projections/structured-workspace';
import { traitOfferDialogClosed, traitOfferDialogOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

const emptyTraitPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

const emptyRarityPicker: ContextualPickerModel<TraitRarity> = Object.freeze({
  sections: Object.freeze([]),
});

const emptyTargetPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

function rarityLabel(rarity: TraitRarity): string {
  return rarity;
}

function pickerValueLabel<T>(model: ContextualPickerModel<T>, value: T): string | undefined {
  return model.sections
    .flatMap((section) => section.items)
    .find((item) => Object.is(item.value, value))?.label;
}

function AllTogetherSetPicker({
  interaction,
  offer,
  onCancel,
  onSelect,
}: {
  readonly interaction: WorkspaceAllTogetherSetInteraction;
  readonly offer: AuthoredTraitOfferTraits;
  readonly onCancel: () => void;
  readonly onSelect: (value: string | null, label: string) => void;
}) {
  const loadable = useMemo(() => interaction.forOffer(offer), [interaction, offer]);
  const controller = useWorkspaceInteractionController<WorkspaceAllTogetherSetDomain | undefined>();
  const loaded = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  return (
    <ContextualPicker
      cancelLabel="Cancel"
      choiceLabel={`${interaction.control.setKey[0]!.toUpperCase()}${interaction.control.setKey.slice(1)} grant`}
      closeOnSelect={false}
      id={`${semanticOwnerControlElementId(interaction.control.address)}-picker`}
      label="Grant"
      loading={loaded.pending}
      model={loaded.result?.picker ?? { sections: Object.freeze([]) }}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      onSelect={(value) =>
        onSelect(
          value,
          loaded.result === undefined
            ? value === null
              ? 'No grant'
              : value
            : (pickerValueLabel(loaded.result.picker, value) ?? String(value)),
        )
      }
      open={true}
      placeholder="Choose a grant"
    />
  );
}

function AllTogetherOutcomeEditor({
  interactions,
  offer,
  optionIndex: index,
  onSelect,
}: {
  readonly interactions: readonly WorkspaceAllTogetherSetInteraction[];
  readonly offer: AuthoredTraitOfferTraits;
  readonly optionIndex: number;
  readonly onSelect: (result: AuthoredAllTogetherResult) => void;
}) {
  const option = offer.options[index];
  const [draft, setDraft] = useState<Partial<AuthoredAllTogetherResult>>(
    option?.allTogetherResult ?? Object.freeze({}),
  );
  const labelsForControls = () =>
    Object.freeze(
      Object.fromEntries(
        interactions.flatMap((interaction) =>
          interaction.control.valueLabel === undefined
            ? []
            : [[interaction.control.setKey, interaction.control.valueLabel]],
        ),
      ),
    ) as Partial<Record<DirectTraitSetKey, string>>;
  const [draftLabels, setDraftLabels] = useState(labelsForControls);
  const [activeIndex, setActiveIndex] = useState<number>();
  const activeInteraction = activeIndex === undefined ? undefined : interactions[activeIndex];
  const activeSetKey = activeInteraction?.control.setKey;
  const complete =
    interactions.length > 0 &&
    interactions.every((interaction) =>
      Object.prototype.hasOwnProperty.call(draft, interaction.control.setKey),
    );

  const begin = (setIndex = 0): void => {
    setDraft(option?.allTogetherResult ?? Object.freeze({}));
    setDraftLabels(labelsForControls());
    setActiveIndex(setIndex);
  };
  const cancel = (): void => {
    setDraft(option?.allTogetherResult ?? Object.freeze({}));
    setDraftLabels(labelsForControls());
    setActiveIndex(undefined);
  };
  const choose = (value: string | null, label: string): void => {
    if (activeSetKey === undefined) return;
    const next = Object.freeze({ ...draft, [activeSetKey]: value });
    setDraft(next);
    setDraftLabels((current) => Object.freeze({ ...current, [activeSetKey]: label }));
    const nextMissing = interactions.findIndex(
      (interaction) => !Object.prototype.hasOwnProperty.call(next, interaction.control.setKey),
    );
    if (nextMissing < 0) {
      setActiveIndex(undefined);
      onSelect(next as AuthoredAllTogetherResult);
      return;
    }
    setActiveIndex(nextMissing);
  };

  return (
    <fieldset className="trait-selected-outcome-detail">
      <legend>Elemental grants</legend>
      <div className="trait-outcome-summary-list">
        {interactions.map((interaction, setIndex) => {
          const key = interaction.control.setKey;
          const value = draft[key];
          const label = Object.prototype.hasOwnProperty.call(draft, key)
            ? (draftLabels[key] ?? (value === null ? 'No grant' : 'Configured'))
            : 'Unspecified';
          return (
            <button
              className="quiet-action action-compact"
              id={semanticOwnerControlElementId(interaction.control.address)}
              key={key}
              onClick={() => begin(setIndex)}
              type="button"
            >
              {key[0]!.toUpperCase() + key.slice(1)}: {label}
            </button>
          );
        })}
      </div>
      {activeInteraction === undefined ? null : (
        <AllTogetherSetPicker
          interaction={activeInteraction}
          offer={offer}
          onCancel={cancel}
          onSelect={choose}
        />
      )}
      {!complete && activeIndex === undefined ? (
        <button className="quiet-action action-compact" onClick={() => begin()} type="button">
          Choose all grants
        </button>
      ) : null}
    </fieldset>
  );
}

function launcherId(address: TraitOfferAddress): string {
  return `trait-launcher-${semanticAddressKey(address)}`;
}

function traitOfferLoadable(
  interaction: WorkspaceTraitOfferInteraction,
  value: AuthoredTraitOffer,
): { readonly load: () => ReturnType<WorkspaceTraitOfferInteraction['load']> } {
  const loadInteraction = interaction.load;
  return Object.freeze({ load: () => loadInteraction(value) });
}

function traitOfferRevision(interaction: WorkspaceTraitOfferInteraction): string {
  if (interaction.value === null) return `${interaction.giver.key}|unresolved`;
  if (interaction.value.kind === 'fallbackGold') {
    return `${interaction.giver.key}|fallbackGold`;
  }
  return [
    interaction.giver.key,
    interaction.choices.map((choice) => choice.value).join(','),
    interaction.value.options
      .map(
        (option) =>
          `${option.traitKey}:${option.rarity ?? ''}:${option.targetTraitKey ?? ''}:${
            'echoPomTarget' in option ? (option.echoPomTarget ?? 'none') : ''
          }:${'echoLastRunBoon' in option ? JSON.stringify(option.echoLastRunBoon) : ''}:${
            'allTogetherResult' in option ? JSON.stringify(option.allTogetherResult) : ''
          }`,
      )
      .join(','),
    interaction.value.selectedOptionKey,
    interaction.value.deathDefianceConditionMet === true ? 'dd' : 'no-dd',
  ].join('|');
}

interface EchoLastRunBoonDraftRow {
  readonly identity?: WorkspaceEchoLastRunBoonTraitIdentity;
  readonly rarity?: TraitRarity;
  readonly targetTraitKey?: string;
}

function pickerItems<T>(model: ContextualPickerModel<T>) {
  return model.sections.flatMap((section) => section.items);
}

function EchoLastRunBoonChoiceEditor({
  controlId,
  domain,
  value,
  onBack,
  onComplete,
}: {
  readonly controlId: string;
  readonly domain: WorkspaceEchoLastRunBoonDomain;
  readonly value?: AuthoredEchoLastRunBoonOffer;
  readonly onBack: () => void;
  readonly onComplete: (value: AuthoredEchoLastRunBoonOffer) => void;
}) {
  const [rows, setRows] = useState<readonly EchoLastRunBoonDraftRow[]>(() =>
    value === undefined
      ? Object.freeze([Object.freeze({})])
      : Object.freeze(
          value.options.map((option) =>
            Object.freeze({
              identity: Object.freeze({
                giverKey: option.giverKey,
                traitKey: option.traitKey,
              }),
              rarity: option.rarity,
              ...(option.targetTraitKey === undefined
                ? {}
                : { targetTraitKey: option.targetTraitKey }),
            }),
          ),
        ),
  );
  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    value === undefined ? 0 : optionIndex(value.selectedOptionKey),
  );
  const selectedRow = rows[selectedIndex];
  const selectedComplete =
    selectedRow?.identity !== undefined && selectedRow.rarity !== undefined
      ? Object.freeze({
          giverKey: selectedRow.identity.giverKey,
          traitKey: selectedRow.identity.traitKey,
          rarity: selectedRow.rarity,
          ...(selectedRow.targetTraitKey === undefined
            ? {}
            : { targetTraitKey: selectedRow.targetTraitKey }),
        })
      : undefined;
  const selectedNeedsTarget =
    selectedRow?.identity !== undefined && domain.targetRequiredFor(selectedRow.identity);
  const draftSupport = domain.draftSupportFor(rows, selectedIndex);

  const updateRow = (index: number, next: EchoLastRunBoonDraftRow): void => {
    setRows((current) =>
      Object.freeze(current.map((row, rowIndex) => (rowIndex === index ? next : row))),
    );
  };

  return (
    <section className="echo-last-run-choice" aria-label="Boon Boon Boon choice">
      <header className="echo-last-run-choice-header">
        <div>
          <p className="eyebrow">Echo offer &gt; Boon Boon Boon choice</p>
          <h3>Boon Boon Boon choice</h3>
          <p>Choose one to three previous-run outcomes, then select the one Echo grants.</p>
        </div>
        <button className="quiet-action action-compact" onClick={onBack} type="button">
          Back to Echo offer
        </button>
      </header>
      <div className="echo-last-run-options">
        {rows.map((row, index) => {
          const optionKey = OPTION_KEYS[index]!;
          const occupiedTraitKeys = rows.flatMap((other, otherIndex) =>
            otherIndex === index || other.identity === undefined ? [] : [other.identity.traitKey],
          );
          const traitPicker = domain.traitPickerFor(occupiedTraitKeys, row.identity);
          const rarityPicker =
            row.identity === undefined
              ? undefined
              : domain.rarityPickerFor(row.identity, row.rarity);
          const allRarityItems = rarityPicker === undefined ? [] : pickerItems(rarityPicker);
          const rarityItems = allRarityItems.filter((item) => item.state !== 'impossible');
          const selectedRarityUnavailable = allRarityItems.some(
            (item) => item.value === row.rarity && item.state === 'impossible',
          );
          const fixedRarity =
            rarityItems.length === 1 && !selectedRarityUnavailable
              ? rarityItems[0]!.value
              : undefined;
          const effectiveRarity =
            row.identity === undefined || row.rarity === undefined
              ? undefined
              : domain.effectiveRarityFor({
                  giverKey: row.identity.giverKey,
                  traitKey: row.identity.traitKey,
                  rarity: row.rarity,
                });
          return (
            <fieldset className="echo-last-run-option" key={optionKey}>
              <legend>Outcome {index + 1}</legend>
              <ContextualPicker
                ariaLabel={`Boon Boon Boon outcome ${index + 1}`}
                id={index === 0 ? controlId : `${controlId}-${optionKey}`}
                label="Trait"
                model={traitPicker}
                onSelect={(identity) => {
                  const nextRarityPicker = domain.rarityPickerFor(identity);
                  const availableRarities = pickerItems(nextRarityPicker).filter(
                    (item) => item.state !== 'impossible',
                  );
                  updateRow(
                    index,
                    Object.freeze({
                      identity,
                      ...(availableRarities.length === 1
                        ? { rarity: availableRarities[0]!.value }
                        : {}),
                    }),
                  );
                }}
                placeholder="Choose provider and trait"
                {...(row.identity === undefined
                  ? {}
                  : { triggerLabel: domain.labelFor(row.identity) })}
              />
              {row.identity === undefined || rarityPicker === undefined ? null : fixedRarity !==
                undefined ? (
                <p className="trait-selected-outcome-detail">Rarity: {fixedRarity}</p>
              ) : (
                <ContextualPicker
                  ariaLabel={`Boon Boon Boon outcome ${index + 1} rarity`}
                  id={`${controlId}-${optionKey}-rarity`}
                  label="Rarity"
                  model={rarityPicker}
                  onSelect={(rarity) => updateRow(index, Object.freeze({ ...row, rarity }))}
                  placeholder="Choose rarity"
                  {...(row.rarity === undefined ? {} : { triggerLabel: rarityLabel(row.rarity) })}
                />
              )}
              {effectiveRarity === undefined || effectiveRarity === row.rarity ? null : (
                <p className="trait-selected-outcome-detail">Effective rarity: {effectiveRarity}</p>
              )}
              <label>
                <input
                  checked={selectedIndex === index}
                  name="echo-last-run-selected"
                  onChange={() => setSelectedIndex(index)}
                  type="radio"
                />
                Echo grants this outcome
              </label>
              {rows.length === 1 ? null : (
                <button
                  className="quiet-action action-compact"
                  onClick={() => {
                    setRows((current) =>
                      Object.freeze(current.filter((_, rowIndex) => rowIndex !== index)),
                    );
                    setSelectedIndex((current) =>
                      current === index ? 0 : current > index ? current - 1 : current,
                    );
                  }}
                  type="button"
                >
                  Remove outcome
                </button>
              )}
            </fieldset>
          );
        })}
      </div>
      {selectedComplete === undefined || !selectedNeedsTarget ? null : (
        <div className="echo-last-run-target">
          <h4>Selected trait outcome</h4>
          <ContextualPicker
            ariaLabel="Boon Boon Boon selected trait target"
            id={`${controlId}-target`}
            label="Target"
            model={domain.targetPickerFor(selectedComplete)}
            onSelect={(targetTraitKey) =>
              updateRow(selectedIndex, Object.freeze({ ...selectedRow, targetTraitKey }))
            }
            placeholder="Choose an equipped trait"
            {...(selectedRow.targetTraitKey === undefined
              ? {}
              : {
                  triggerLabel:
                    pickerValueLabel(
                      domain.targetPickerFor(selectedComplete),
                      selectedRow.targetTraitKey,
                    ) ?? selectedRow.targetTraitKey,
                })}
          />
        </div>
      )}
      {!draftSupport.canAppend || !rows.every((row) => row.identity && row.rarity) ? null : (
        <button
          className="quiet-action action-compact"
          onClick={() => setRows((current) => Object.freeze([...current, Object.freeze({})]))}
          type="button"
        >
          Add outcome
        </button>
      )}
      <div className="echo-last-run-choice-actions">
        <button
          className="primary-action"
          disabled={!draftSupport.complete}
          onClick={() => {
            if (!draftSupport.complete) return;
            const options = rows.map((row) =>
              Object.freeze({
                giverKey: row.identity!.giverKey,
                traitKey: row.identity!.traitKey,
                rarity: row.rarity!,
                ...(row.targetTraitKey === undefined ? {} : { targetTraitKey: row.targetTraitKey }),
              }),
            ) as unknown as AuthoredEchoLastRunBoonOffer['options'];
            onComplete(
              Object.freeze({
                options: Object.freeze(options),
                selectedOptionKey: OPTION_KEYS[selectedIndex]!,
              }),
            );
          }}
          type="button"
        >
          Save Boon Boon Boon choice
        </button>
        <button className="quiet-action" onClick={onBack} type="button">
          Cancel
        </button>
      </div>
    </section>
  );
}

function LoadedEchoLastRunBoonChoice({
  interaction,
  offer,
  onBack,
  onComplete,
}: {
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly offer: AuthoredTraitOfferTraits;
  readonly onBack: () => void;
  readonly onComplete: (value: AuthoredEchoLastRunBoonOffer) => void;
}) {
  const focusedSemanticOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const optionKey = offer.selectedOptionKey;
  const option = offer.options[optionIndex(optionKey)];
  const child = useMemo(
    () => interaction.optionDomain(offer, optionKey).echoLastRunBoon,
    [interaction, offer, optionKey],
  );
  const loadable = useMemo(() => child?.forOffer(offer), [child, offer]);
  const controller = useWorkspaceInteractionController<
    WorkspaceEchoLastRunBoonDomain | undefined
  >();
  const loaded = controller.observe(loadable);
  useEffect(() => {
    if (loadable !== undefined) controller.activate(loadable);
  }, [controller, loadable]);
  useEffect(() => {
    if (
      loaded.result === undefined ||
      child === undefined ||
      focusedSemanticOwner?.kind !== 'echoLastRunBoon' ||
      semanticAddressKey(focusedSemanticOwner) !== semanticAddressKey(child.control.address)
    )
      return;
    document.getElementById(semanticOwnerControlElementId(child.control.address))?.focus();
  }, [child, focusedSemanticOwner, loaded.result]);
  if (child === undefined || option === undefined) {
    return (
      <section className="echo-last-run-choice" role="status">
        <p>Boon Boon Boon is not active for the selected Echo trait.</p>
        <button className="quiet-action" onClick={onBack} type="button">
          Back to Echo offer
        </button>
      </section>
    );
  }
  if (loaded.result === undefined) {
    return (
      <section className="echo-last-run-choice" role="status">
        <p>{loaded.pending ? 'Evaluating previous-run outcomes…' : 'No outcomes are available.'}</p>
        <button className="quiet-action" onClick={onBack} type="button">
          Back to Echo offer
        </button>
      </section>
    );
  }
  return (
    <EchoLastRunBoonChoiceEditor
      controlId={semanticOwnerControlElementId(child.control.address)}
      domain={loaded.result}
      {...(option.echoLastRunBoon === undefined ? {} : { value: option.echoLastRunBoon })}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}

function replaceOption(
  value: AuthoredTraitOfferTraits,
  index: number,
  next: AuthoredTraitOfferTraits['options'][number],
): AuthoredTraitOfferTraits {
  const options = [...value.options] as AuthoredTraitOfferTraits['options'][number][];
  options[index] = Object.freeze({ ...next });
  return Object.freeze({
    ...value,
    options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
  });
}

function CirceResolutionEditor({
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

function TraitOfferOptionEditor({
  index,
  interaction,
  optionKey,
  effectiveRarity,
  rarifySupported,
  value,
  onUpdate,
}: {
  readonly index: number;
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly optionKey: AuthoredTraitOfferTraits['selectedOptionKey'];
  readonly effectiveRarity?: TraitRarity;
  readonly rarifySupported: boolean;
  readonly value: AuthoredTraitOfferTraits;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
}) {
  const option = value.options[index];
  if (option === undefined) throw new Error(`Trait offer is missing ${optionKey}`);
  const loadable = useMemo(
    () => interaction.optionDomain(value, optionKey),
    [interaction, optionKey, value],
  );
  const controller = useWorkspaceInteractionController<TraitOptionDomainProjection>();
  const loaded = controller.observe(loadable);
  const domain = loaded.result;
  const traitPicker = domain?.traitPicker ?? emptyTraitPicker;
  const rarityPicker = domain?.rarityPickerFor(option.traitKey);
  const hasEditableRarity =
    interaction.rarityEditable &&
    interaction.giver.rarityPolicy.kind === 'selectable' &&
    interaction.rarityEditableFor(option.traitKey);
  const idPrefix = `${semanticAddressKey(interaction.owner)}-${optionKey}`;
  const selectTrait = (traitKey: string): void => {
    const preferred = domain?.preferredOptionFor(traitKey);
    if (preferred === undefined) return;
    onUpdate(
      replaceOption(
        value,
        index,
        preferred.traitKey === option.traitKey
          ? Object.freeze({ ...option, ...preferred })
          : preferred,
      ),
    );
  };
  const selectRarity = (rarity: TraitRarity): void => {
    onUpdate(replaceOption(value, index, { ...option, rarity }));
  };
  return (
    <fieldset className="trait-offer-option" key={optionKey}>
      <legend>{optionKey.replace('option', 'Option ')}</legend>
      <ContextualPicker
        ariaLabel={`${optionKey} trait`}
        id={`${idPrefix}-trait`}
        label="Trait"
        loading={loaded.pending}
        model={traitPicker}
        onOpenChange={(open) => {
          if (open) controller.activate(loadable);
        }}
        onSelect={selectTrait}
        placeholder="Choose a trait"
        triggerLabel={interaction.traitLabel(option.traitKey)}
      />
      {!hasEditableRarity ? (
        option.rarity === undefined ? null : (
          <p className="trait-offer-fixed-rarity">Rarity: {rarityLabel(option.rarity)}</p>
        )
      ) : (
        <ContextualPicker
          ariaLabel={`${optionKey} rarity`}
          id={`${idPrefix}-rarity`}
          label="Rarity"
          loading={loaded.pending}
          model={rarityPicker ?? emptyRarityPicker}
          onOpenChange={(open) => {
            if (open) controller.activate(loadable);
          }}
          onSelect={selectRarity}
          placeholder="Choose a rarity"
          {...(option.rarity === undefined ? {} : { triggerLabel: rarityLabel(option.rarity) })}
        />
      )}
      <button
        disabled={!rarifySupported}
        onClick={() =>
          onUpdate(
            Object.freeze({
              ...value,
              rarificationActions: Object.freeze([...(value.rarificationActions ?? []), optionKey]),
            }),
          )
        }
        type="button"
      >
        Rarify
      </button>
      {effectiveRarity === undefined ? null : <p>Effective rarity: {effectiveRarity}</p>}
      <label className="trait-option-selected">
        <input
          checked={value.selectedOptionKey === optionKey}
          name={`${semanticAddressKey(interaction.owner)}-selected`}
          onChange={() => onUpdate(Object.freeze({ ...value, selectedOptionKey: optionKey }))}
          type="radio"
        />
        Selected
      </label>
    </fieldset>
  );
}

function TraitOfferSelectedOutcomeEditor({
  interaction,
  value,
  onOpenEchoLastRunBoon,
  onUpdate,
}: {
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly value: AuthoredTraitOfferTraits;
  readonly onOpenEchoLastRunBoon: () => void;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
}) {
  const dispatch = useAppDispatch();
  const selectedIndex = optionIndex(value.selectedOptionKey);
  const option = value.options[selectedIndex];
  if (option === undefined) throw new Error(`Trait offer is missing ${value.selectedOptionKey}`);
  const loadable = useMemo(
    () => interaction.optionDomain(value, value.selectedOptionKey),
    [interaction, value],
  );
  const optionController = useWorkspaceInteractionController<TraitOptionDomainProjection>();
  const optionDomain = optionController.observe(loadable);
  const circeLoadable = useMemo(
    () => loadable.circeResolution?.forOffer(value),
    [loadable.circeResolution, value],
  );
  const circeController = useWorkspaceInteractionController<
    WorkspaceCirceResolutionDomain | undefined
  >();
  const circeDomain = circeController.observe(circeLoadable);
  const echoPomLoadable = useMemo(
    () => loadable.echoPomTarget?.forOffer(value),
    [loadable.echoPomTarget, value],
  );
  const echoPomController = useWorkspaceInteractionController<
    WorkspaceEchoPomTargetDomain | undefined
  >();
  const echoPomDomain = echoPomController.observe(echoPomLoadable);
  const echoLastRunLoadable = useMemo(
    () =>
      loadable.echoLastRunBoon === undefined || option.echoLastRunBoon === undefined
        ? undefined
        : loadable.echoLastRunBoon.forOffer(value),
    [loadable.echoLastRunBoon, option.echoLastRunBoon, value],
  );
  const echoLastRunController = useWorkspaceInteractionController<
    WorkspaceEchoLastRunBoonDomain | undefined
  >();
  const echoLastRunDomain = echoLastRunController.observe(echoLastRunLoadable);
  useEffect(() => {
    if (loadable.hasTargetPicker) optionController.activate(loadable);
    if (circeLoadable !== undefined) circeController.activate(circeLoadable);
    if (echoPomLoadable !== undefined) echoPomController.activate(echoPomLoadable);
    if (echoLastRunLoadable !== undefined) echoLastRunController.activate(echoLastRunLoadable);
  }, [
    circeController,
    circeLoadable,
    echoLastRunController,
    echoLastRunLoadable,
    echoPomController,
    echoPomLoadable,
    loadable,
    optionController,
  ]);

  const targetDomain = optionDomain.result;
  const hasOutcome =
    loadable.hasTargetPicker ||
    loadable.circeResolution !== undefined ||
    loadable.echoPomTarget !== undefined ||
    loadable.echoLastRunBoon !== undefined ||
    interaction.echoLastReward !== undefined ||
    loadable.allTogetherSets !== undefined;
  if (!hasOutcome) return null;
  return (
    <section aria-label="Selected trait outcome" className="trait-selected-outcome">
      <h3>Selected trait outcome</h3>
      <p className="trait-selected-outcome-name">{interaction.traitLabel(option.traitKey)}</p>
      {loadable.traitAcquisitionTarget === undefined ? null : (
        <ContextualPicker
          ariaLabel={`${value.selectedOptionKey} acquisition target`}
          id={semanticOwnerControlElementId(loadable.traitAcquisitionTarget.address)}
          label="Target"
          loading={optionDomain.pending}
          model={targetDomain?.targetPicker ?? emptyTargetPicker}
          onSelect={(targetTraitKey) =>
            onUpdate(replaceOption(value, selectedIndex, { ...option, targetTraitKey }))
          }
          placeholder="Choose an equipped trait"
          {...(option.targetTraitKey === undefined
            ? {}
            : { triggerLabel: interaction.traitLabel(option.targetTraitKey) })}
        />
      )}
      {loadable.circeResolution === undefined || circeDomain.result === undefined ? null : (
        <CirceResolutionEditor
          controlId={semanticOwnerControlElementId(loadable.circeResolution.control.address)}
          domain={circeDomain.result}
          option={option}
          onSelect={(resolution) =>
            onUpdate(
              replaceOption(value, selectedIndex, { ...option, circeResolution: resolution }),
            )
          }
        />
      )}
      {loadable.echoPomTarget === undefined || echoPomDomain.result === undefined ? null : (
        <ContextualPicker
          ariaLabel="Pom Pom Pom target"
          id={semanticOwnerControlElementId(loadable.echoPomTarget.control.address)}
          label="Greatest-level target"
          model={echoPomDomain.result.picker}
          onSelect={(echoPomTarget) =>
            onUpdate(replaceOption(value, selectedIndex, { ...option, echoPomTarget }))
          }
          placeholder={
            echoPomDomain.result.emptyNoOpAllowed
              ? 'Choose target or no target'
              : 'Choose a greatest-level trait'
          }
          {...('echoPomTarget' in option && option.echoPomTarget !== undefined
            ? {
                triggerLabel:
                  pickerValueLabel(echoPomDomain.result.picker, option.echoPomTarget) ??
                  String(option.echoPomTarget),
              }
            : {})}
        />
      )}
      {loadable.echoLastRunBoon === undefined ? null : (
        <div
          className="trait-dependent-choice-row"
          id={semanticOwnerControlElementId(loadable.echoLastRunBoon.control.address)}
        >
          <div>
            <h4>Boon Boon Boon choice</h4>
            <p>
              {option.echoLastRunBoon === undefined
                ? 'Choose the boon Echo grants before room chronology continues.'
                : (echoLastRunDomain.result?.summaryFor(option.echoLastRunBoon) ??
                  (echoLastRunDomain.pending
                    ? 'Evaluating Boon Boon Boon choice…'
                    : 'Boon Boon Boon summary unavailable'))}
            </p>
            <p className="trait-selected-outcome-detail">
              Resolved immediately after Echo's outer choice.
            </p>
          </div>
          <button
            className="quiet-action action-compact"
            onClick={onOpenEchoLastRunBoon}
            type="button"
          >
            {option.echoLastRunBoon === undefined ? 'Choose' : 'Edit choice'}
          </button>
        </div>
      )}
      {interaction.echoLastReward === undefined ? null : (
        <fieldset className="trait-circe-resolution">
          <legend>Reward Reward Reward replay</legend>
          <p>Spawns: {interaction.echoLastReward.spawnLabel ?? 'Replay source unavailable'}</p>
          <button
            className="quiet-action"
            onClick={() => {
              const acquisitionEntry = interaction.echoLastReward!.acquisitionEntry;
              dispatch(traitOfferDialogClosed());
              window.setTimeout(() => {
                document.getElementById(semanticOwnerControlElementId(acquisitionEntry))?.focus();
              }, 0);
            }}
            type="button"
          >
            Configure in Acquisitions
          </button>
        </fieldset>
      )}
      {loadable.allTogetherSets === undefined ? null : (
        <AllTogetherOutcomeEditor
          interactions={loadable.allTogetherSets}
          offer={value}
          optionIndex={selectedIndex}
          onSelect={(allTogetherResult) =>
            onUpdate(replaceOption(value, selectedIndex, { ...option, allTogetherResult }))
          }
        />
      )}
    </section>
  );
}

export function TraitOfferLauncher({
  control,
  interactions,
}: {
  readonly control: WorkspaceTraitOfferControl;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const dispatch = useAppDispatch();
  const interaction = requireWorkspaceInteraction(
    interactions.traitOffers,
    workspaceInteractionKey(control.address),
  );
  const selected =
    control.offer?.kind === 'traits'
      ? control.offer.options[OPTION_KEYS.indexOf(control.offer.selectedOptionKey)]
      : undefined;
  const label =
    control.offer === null
      ? 'Choose trait'
      : control.offer.kind === 'fallbackGold'
        ? 'Fallback Gold'
        : selected === undefined
          ? 'Choose trait'
          : (interaction.choices.find((choice) => choice.value === selected.traitKey)?.label ??
            selected.traitKey);
  const rarity = selected?.rarity === undefined ? '' : ` · ${selected.rarity}`;
  return (
    <button
      className="trait-offer-launcher quiet-action action-compact"
      id={launcherId(control.address)}
      onClick={() => dispatch(traitOfferDialogOpened(control.address))}
      type="button"
    >
      Edit Trait: {label}
      {rarity}
    </button>
  );
}

export function TraitOfferEditor({
  address,
  initialView = 'outer',
  interactions,
  onChildCommit,
  onCommit,
  onReset,
}: {
  readonly address: TraitOfferAddress;
  readonly initialView?: 'outer' | 'echoLastRunBoon';
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onChildCommit?: (value: AuthoredTraitOffer) => void;
  readonly onCommit?: (value: AuthoredTraitOffer) => void;
  readonly onReset?: () => void;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.traitOffers,
    workspaceInteractionKey(address),
  );
  const initialValue = interaction.value ?? interaction.traitsStartingDraft?.();
  if (initialValue === undefined) {
    return (
      <div className="trait-offer-editor" role="status">
        This trait offer is not available at the current route frontier.
      </div>
    );
  }
  return (
    <LoadedTraitOfferEditor
      initialValue={initialValue}
      initialView={initialView}
      interaction={interaction}
      key={traitOfferRevision(interaction)}
      {...(onChildCommit === undefined ? {} : { onChildCommit })}
      {...(onCommit === undefined ? {} : { onCommit })}
      {...(onReset === undefined ? {} : { onReset })}
    />
  );
}

function LoadedTraitOfferEditor({
  initialValue,
  initialView,
  interaction,
  onChildCommit,
  onCommit,
  onReset,
}: {
  readonly initialValue: AuthoredTraitOffer;
  readonly initialView: 'outer' | 'echoLastRunBoon';
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly onChildCommit?: (value: AuthoredTraitOffer) => void;
  readonly onCommit?: (value: AuthoredTraitOffer) => void;
  readonly onReset?: () => void;
}) {
  const [value, setValue] = useState<AuthoredTraitOffer>(initialValue);
  const [view, setView] = useState(initialView);
  type TraitOfferCandidates = ReturnType<WorkspaceTraitOfferInteraction['load']>;
  const controller = useWorkspaceInteractionController<TraitOfferCandidates>();
  const [loadable, setLoadable] = useState(() => traitOfferLoadable(interaction, initialValue));
  const loaded = controller.observe(loadable);
  const candidate = loaded.result?.[0];
  const support = candidateSupport(candidate);
  const feedback = projectTraitOfferFeedback(value, candidate, interaction.traitLabel);
  const offerMessage =
    feedback.contextMessage ??
    (support === 'impossible'
      ? 'This offer is unavailable in the current route context.'
      : undefined);
  const hasOptionFeedback = feedback.options.some(
    (option) => option.reasons.length > 0 || option.replacement !== undefined,
  );
  const rarifySupported = (optionKey: AuthoredTraitOfferTraits['selectedOptionKey']): boolean => {
    if (candidate?.evaluation.kind !== 'traitOffer') return false;
    const branches = candidate.evaluation.result.callingCard ?? [];
    return (
      branches.length > 0 &&
      branches.every((branch) => branch.rarifiableOptionKeys.includes(optionKey))
    );
  };
  const effectiveRarity = (
    optionKey: AuthoredTraitOfferTraits['selectedOptionKey'],
  ): TraitRarity | undefined => {
    if (candidate?.evaluation.kind !== 'traitOffer') return undefined;
    const values = (candidate.evaluation.result.callingCard ?? [])
      .map((branch) => branch.effectiveRarities[OPTION_KEYS.indexOf(optionKey)])
      .filter((value): value is TraitRarity => value !== undefined);
    return values.length > 0 && values.every((value) => value === values[0])
      ? values[0]
      : undefined;
  };
  const deathDefianceCondition =
    value.kind === 'traits' ? interaction.deathDefianceCondition : undefined;
  const traitsStartingDraft = useMemo(
    () => (value.kind === 'fallbackGold' ? interaction.traitsStartingDraft?.() : undefined),
    [interaction, value],
  );
  const nextTraitOfferDraft = useMemo(
    () => (value.kind === 'traits' ? interaction.nextOptionalHighTierDraft?.(value) : undefined),
    [interaction, value],
  );
  const previousTraitOfferDraft = useMemo(
    () =>
      value.kind === 'traits' ? interaction.previousOptionalHighTierDraft?.(value) : undefined,
    [interaction, value],
  );
  const previousTraitOfferLoadable = useMemo(
    () =>
      previousTraitOfferDraft === undefined
        ? undefined
        : traitOfferLoadable(interaction, previousTraitOfferDraft),
    [interaction, previousTraitOfferDraft],
  );
  const previousTraitOfferController = useWorkspaceInteractionController<TraitOfferCandidates>();
  const previousTraitOfferLoaded = previousTraitOfferController.observe(previousTraitOfferLoadable);
  const previousTraitOfferSupport = candidateSupport(previousTraitOfferLoaded.result?.[0]);
  const canRemoveOption =
    previousTraitOfferDraft !== undefined &&
    (previousTraitOfferSupport === 'possible' || previousTraitOfferSupport === 'forced');
  const fallbackGoldValue = useMemo(
    () =>
      value.kind !== 'traits' ||
      (interaction.giver.providerKind !== 'olympian' && interaction.giver.providerKind !== 'hermes')
        ? undefined
        : (Object.freeze({
            kind: 'fallbackGold' as const,
            giverKey: value.giverKey,
          }) satisfies AuthoredTraitOffer),
    [interaction.giver.providerKind, value],
  );
  const fallbackGoldLoadable = useMemo(
    () =>
      fallbackGoldValue === undefined
        ? undefined
        : traitOfferLoadable(interaction, fallbackGoldValue),
    [fallbackGoldValue, interaction],
  );
  const fallbackGoldController = useWorkspaceInteractionController<TraitOfferCandidates>();
  const fallbackGoldLoaded = fallbackGoldController.observe(fallbackGoldLoadable);
  const fallbackGoldSupport = candidateSupport(fallbackGoldLoaded.result?.[0]);
  useEffect(() => {
    controller.activate(loadable);
    // Activation is deliberately tied to the opened dialog, not to render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadable]);
  useEffect(() => {
    if (fallbackGoldLoadable !== undefined) fallbackGoldController.activate(fallbackGoldLoadable);
  }, [fallbackGoldController, fallbackGoldLoadable]);
  useEffect(() => {
    if (previousTraitOfferLoadable !== undefined)
      previousTraitOfferController.activate(previousTraitOfferLoadable);
  }, [previousTraitOfferController, previousTraitOfferLoadable]);
  const updateValue = (nextValue: AuthoredTraitOffer): void => {
    const nextLoadable = traitOfferLoadable(interaction, nextValue);
    setValue(nextValue);
    setLoadable(nextLoadable);
    controller.activate(nextLoadable);
  };
  if (view === 'echoLastRunBoon' && value.kind === 'traits') {
    const selectedIndex = optionIndex(value.selectedOptionKey);
    const selected = value.options[selectedIndex];
    return (
      <LoadedEchoLastRunBoonChoice
        interaction={interaction}
        offer={value}
        onBack={() => setView('outer')}
        onComplete={(child) => {
          if (selected === undefined) return;
          const completed = replaceOption(value, selectedIndex, {
            ...selected,
            echoLastRunBoon: child,
          });
          updateValue(completed);
          onChildCommit?.(completed);
          setView('outer');
        }}
      />
    );
  }
  return (
    <div className="trait-offer-editor">
      {value.kind === 'traits' && deathDefianceCondition !== undefined ? (
        <label className="trait-offer-condition">
          <input
            checked={value.deathDefianceConditionMet === true}
            onChange={(event) =>
              updateValue(
                Object.freeze({
                  ...value,
                  deathDefianceConditionMet: event.target.checked,
                }),
              )
            }
            type="checkbox"
          />
          Death Defiance condition met
        </label>
      ) : null}
      {value.kind === 'fallbackGold' ? (
        <section className="trait-offer-fallback">
          <p>Fallback Gold</p>
          <button
            disabled={traitsStartingDraft === undefined}
            onClick={() => {
              if (traitsStartingDraft !== undefined) updateValue(traitsStartingDraft);
            }}
            type="button"
          >
            Return to traits
          </button>
        </section>
      ) : (
        <>
          <div className="trait-offer-options">
            {value.options.map((_, index) => {
              const optionKey = OPTION_KEYS[index]!;
              const optionFeedback = feedback.options[index];
              const rowEffectiveRarity = effectiveRarity(optionKey);
              return (
                <div data-has-findings={(optionFeedback?.reasons.length ?? 0) > 0} key={optionKey}>
                  {rowEffectiveRarity === undefined ? (
                    <TraitOfferOptionEditor
                      index={index}
                      interaction={interaction}
                      onUpdate={updateValue}
                      optionKey={optionKey}
                      rarifySupported={rarifySupported(optionKey)}
                      value={value}
                    />
                  ) : (
                    <TraitOfferOptionEditor
                      effectiveRarity={rowEffectiveRarity}
                      index={index}
                      interaction={interaction}
                      onUpdate={updateValue}
                      optionKey={optionKey}
                      rarifySupported={rarifySupported(optionKey)}
                      value={value}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <TraitOfferSelectedOutcomeEditor
            interaction={interaction}
            onOpenEchoLastRunBoon={() => setView('echoLastRunBoon')}
            onUpdate={updateValue}
            value={value}
          />
          {nextTraitOfferDraft === undefined &&
          !canRemoveOption &&
          (fallbackGoldValue === undefined ||
            (fallbackGoldSupport !== 'possible' && fallbackGoldSupport !== 'forced')) ? null : (
            <div
              aria-label="Offer shape actions"
              className="trait-offer-shape-actions"
              role="group"
            >
              {nextTraitOfferDraft === undefined ? null : (
                <button
                  className="quiet-action action-compact"
                  onClick={() => updateValue(nextTraitOfferDraft)}
                  type="button"
                >
                  Add option
                </button>
              )}
              {!canRemoveOption || previousTraitOfferDraft === undefined ? null : (
                <button
                  className="quiet-action action-compact"
                  onClick={() => updateValue(previousTraitOfferDraft)}
                  type="button"
                >
                  Remove last option
                </button>
              )}
              {fallbackGoldValue === undefined ||
              (fallbackGoldSupport !== 'possible' && fallbackGoldSupport !== 'forced') ? null : (
                <button
                  className="quiet-action action-compact"
                  onClick={() => updateValue(fallbackGoldValue)}
                  type="button"
                >
                  Select Fallback Gold
                </button>
              )}
            </div>
          )}
        </>
      )}
      <section aria-label="Offer feedback" className="trait-offer-feedback" role="status">
        <h3>Offer feedback</h3>
        {!hasOptionFeedback && offerMessage === undefined ? (
          <p className="trait-offer-feedback-empty">No current findings.</p>
        ) : null}
        {feedback.options.map((option, index) =>
          option.reasons.length === 0 && option.replacement === undefined ? null : (
            <div className="trait-offer-feedback-item" key={OPTION_KEYS[index]}>
              <strong>Option {index + 1}</strong>
              {option.reasons.length === 0 ? null : (
                <ul className="trait-option-feedback" aria-label={`${OPTION_KEYS[index]} feedback`}>
                  {option.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              {option.replacement === undefined ? null : (
                <p className="trait-option-replacement">
                  Replaces {option.replacement.replacedTraitLabel} · {option.replacement.oldRarity}{' '}
                  to {option.replacement.requiredRarity}
                </p>
              )}
            </div>
          ),
        )}
        {offerMessage === undefined ? null : <p className="feedback-text">{offerMessage}</p>}
      </section>
      <button
        className="primary-action"
        disabled={support === 'impossible'}
        onClick={() => {
          onCommit?.(value);
        }}
        type="button"
      >
        Save trait offer
      </button>
      {onReset === undefined ? null : (
        <button className="quiet-action" onClick={onReset} type="button">
          Reset to unresolved
        </button>
      )}
    </div>
  );
}

export function TraitOfferDialog({
  interactions,
  target,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly target: TraitOfferAddress;
}) {
  const dispatch = useAppDispatch();
  const executeIntent = useCommandIntent();
  const focusedSemanticOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const interaction = requireWorkspaceInteraction(
    interactions.traitOffers,
    workspaceInteractionKey(target),
  );
  const close = useCallback((): void => {
    dispatch(traitOfferDialogClosed());
    const launcher = document.getElementById(launcherId(target));
    (launcher ?? previousFocusRef.current)?.focus();
  }, [dispatch, target]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const inertSiblings: HTMLElement[] = [];
    const parent = dialog.parentElement;
    const supportsModal = typeof dialog.showModal === 'function';
    if (!supportsModal && parent !== null) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling === dialog || !(sibling instanceof HTMLElement)) continue;
        inertSiblings.push(sibling);
        (sibling as HTMLElement & { inert: boolean }).inert = true;
      }
    }

    if (supportsModal && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // A test DOM may expose showModal without implementing the top layer.
        dialog.setAttribute('open', '');
      }
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }

    const exactControl =
      (focusedSemanticOwner?.kind === 'allTogetherSet' ||
        focusedSemanticOwner?.kind === 'traitAcquisitionTarget' ||
        focusedSemanticOwner?.kind === 'circeResolution' ||
        focusedSemanticOwner?.kind === 'echoPomTarget' ||
        focusedSemanticOwner?.kind === 'echoLastRunBoon') &&
      semanticAddressKey(focusedSemanticOwner.trait) === semanticAddressKey(target)
        ? document.getElementById(semanticOwnerControlElementId(focusedSemanticOwner))
        : null;
    const first = dialog.querySelector<HTMLElement>('select, input, button');
    (exactControl instanceof HTMLElement && dialog.contains(exactControl)
      ? exactControl
      : first
    )?.focus();
    const onCancel = (event: Event): void => {
      event.preventDefault();
      close();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      // Native modal dialogs emit `cancel`; this local fallback only covers
      // DOMs that cannot implement the dialog top layer (for example jsdom).
      // A nested picker handles its own Escape first and prevents the default;
      // preserve the in-progress local draft until a later Escape reaches us.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      close();
    };
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('keydown', onKeyDown);
      for (const sibling of inertSiblings) {
        (sibling as HTMLElement & { inert: boolean }).inert = false;
      }
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, [close, focusedSemanticOwner, target]);
  return (
    <dialog
      aria-labelledby={`trait-offer-dialog-title-${semanticAddressKey(target)}`}
      aria-modal="true"
      className="trait-offer-dialog-backdrop"
      ref={dialogRef}
    >
      <div className="trait-offer-dialog">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Trait offer</p>
            <h2 id={`trait-offer-dialog-title-${semanticAddressKey(target)}`}>
              {interaction.giver.label}
            </h2>
          </div>
          <div className="panel-heading-actions">
            <SemanticOwnerMarker address={target} />
            <button
              aria-label="Close trait offer"
              className="quiet-action"
              onClick={close}
              type="button"
            >
              Close
            </button>
          </div>
        </header>
        <TraitOfferEditor
          address={target}
          initialView={
            focusedSemanticOwner?.kind === 'echoLastRunBoon' &&
            semanticAddressKey(focusedSemanticOwner.trait) === semanticAddressKey(target)
              ? 'echoLastRunBoon'
              : 'outer'
          }
          interactions={interactions}
          key={`${semanticAddressKey(target)}:${traitOfferRevision(interaction)}`}
          onCommit={(value) => {
            executeIntent(interaction.intentFor(value));
            close();
          }}
          onChildCommit={(value) => {
            executeIntent(interaction.intentFor(value));
            dispatch(traitOfferDialogOpened(target));
          }}
          {...(interaction.resetIntent === undefined
            ? {}
            : {
                onReset: () => {
                  executeIntent(interaction.resetIntent!);
                  close();
                },
              })}
        />
      </div>
    </dialog>
  );
}

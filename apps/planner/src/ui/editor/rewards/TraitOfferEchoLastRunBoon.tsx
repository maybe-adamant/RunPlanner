import {
  optionIndex,
  semanticAddressKey,
  type AuthoredAllTogetherResult,
  type AuthoredEchoLastRunBoonOption,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import { useEffect, useMemo, useState } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import type {
  WorkspaceEchoLastRunBoonDomain,
  WorkspaceEchoLastRunBoonCarrierDomain,
  WorkspaceEchoLastRunBoonTraitIdentity,
  WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { useAppSelector } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget, type FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

interface EchoLastRunBoonDraftRow {
  readonly identity?: WorkspaceEchoLastRunBoonTraitIdentity;
  readonly rarity?: TraitRarity;
  readonly targetTraitKey?: string;
  readonly allTogetherResult?: AuthoredAllTogetherResult;
  readonly naturalSelectionTargets?: AuthoredEchoLastRunBoonOption['naturalSelectionTargets'];
}

function rarityLabel(rarity: TraitRarity): string {
  return rarity;
}

function pickerValueLabel<T>(model: ContextualPickerModel<T>, value: T): string | undefined {
  return model.sections
    .flatMap((section) => section.items)
    .find((item) => Object.is(item.value, value))?.label;
}

function pickerItems<T>(model: ContextualPickerModel<T>) {
  return model.sections.flatMap((section) => section.items);
}

function EchoAllTogetherOutcome({
  controlId,
  domain,
  value,
  onComplete,
}: {
  readonly controlId: string;
  readonly domain: Extract<WorkspaceEchoLastRunBoonCarrierDomain, { readonly kind: 'allTogether' }>;
  readonly value?: AuthoredAllTogetherResult;
  readonly onComplete: (value: AuthoredAllTogetherResult) => void;
}) {
  const [draft, setDraft] = useState<Partial<AuthoredAllTogetherResult>>(value ?? {});
  return (
    <fieldset className="trait-selected-outcome-detail" aria-label="Echo All Together outcome">
      <legend>Elemental grants</legend>
      {domain.sets.map((set) => {
        const selected = draft[set.setKey];
        return (
          <ContextualPicker
            ariaLabel={`Echo All Together ${set.setKey} grant`}
            id={`${controlId}-all-together-${set.setKey}`}
            key={set.setKey}
            label={`${set.setKey[0]!.toUpperCase()}${set.setKey.slice(1)}`}
            model={set.picker}
            onSelect={(traitKey) => {
              const next = Object.freeze({ ...draft, [set.setKey]: traitKey });
              setDraft(next);
              if (domain.sets.every((candidate) => Object.hasOwn(next, candidate.setKey)))
                onComplete(next as AuthoredAllTogetherResult);
            }}
            placeholder="Choose a grant"
            {...(Object.hasOwn(draft, set.setKey)
              ? {
                  triggerLabel:
                    pickerValueLabel(set.picker, selected ?? null) ??
                    (selected === null ? 'No grant (set exhausted)' : String(selected)),
                }
              : {})}
          />
        );
      })}
    </fieldset>
  );
}

function EchoNaturalSelectionOutcome({
  controlId,
  domain,
  editing,
  targets,
  onEditingChange,
  onChange,
}: {
  readonly controlId: string;
  readonly domain: Extract<
    WorkspaceEchoLastRunBoonCarrierDomain,
    { readonly kind: 'naturalSelection' }
  >;
  readonly editing: boolean;
  readonly targets: readonly string[];
  readonly onEditingChange: (editing: boolean) => void;
  readonly onChange: (targets: readonly string[] | undefined) => void;
}) {
  useEffect(() => {
    if (domain.complete && editing) onEditingChange(false);
  }, [domain.complete, editing, onEditingChange]);
  return (
    <fieldset className="trait-selected-outcome-detail" aria-label="Echo Natural Selection outcome">
      <legend>Natural Selection targets</legend>
      <p>
        {targets.length === 0
          ? 'Targets unspecified'
          : targets.map((target) => domain.traitLabel(target)).join(' → ')}
      </p>
      {!editing ? (
        <button
          className="quiet-action action-compact"
          onClick={() => {
            onEditingChange(true);
            onChange(undefined);
          }}
          type="button"
        >
          Choose all targets
        </button>
      ) : (
        <ContextualPicker
          ariaLabel="Echo Natural Selection next target"
          closeOnSelect={false}
          id={`${controlId}-natural-selection`}
          label={`Target ${Math.min(targets.length + 1, domain.slotCount)} of ${domain.slotCount}`}
          model={domain.picker}
          onOpenChange={(open) => {
            if (!open) onEditingChange(false);
          }}
          onSelect={(target) => onChange(Object.freeze([...targets, target]))}
          open={true}
          placeholder="Choose an eligible core trait"
        />
      )}
    </fieldset>
  );
}

function EchoLastRunBoonChoiceEditor({
  controlId,
  findingTarget,
  domain,
  value,
  onBack,
  onComplete,
}: {
  readonly controlId: string;
  readonly findingTarget: FindingTargetProps;
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
              ...(option.allTogetherResult === undefined
                ? {}
                : { allTogetherResult: option.allTogetherResult }),
              ...(option.naturalSelectionTargets === undefined
                ? {}
                : { naturalSelectionTargets: option.naturalSelectionTargets }),
            }),
          ),
        ),
  );
  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    value === undefined ? 0 : optionIndex(value.selectedOptionKey),
  );
  const [editingNaturalSelection, setEditingNaturalSelection] = useState(false);
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
          ...(selectedRow.allTogetherResult === undefined
            ? {}
            : { allTogetherResult: selectedRow.allTogetherResult }),
          ...(selectedRow.naturalSelectionTargets === undefined
            ? {}
            : { naturalSelectionTargets: selectedRow.naturalSelectionTargets }),
        })
      : undefined;
  const selectedNeedsTarget =
    selectedRow?.identity !== undefined && domain.targetRequiredFor(selectedRow.identity);
  const draftSupport = domain.draftSupportFor(rows, selectedIndex);
  const selectedCarrierKind =
    selectedRow?.identity === undefined ? undefined : domain.carrierKindFor(selectedRow.identity);
  const carrierReady = selectedComplete !== undefined && selectedCarrierKind !== undefined;
  const carrierLoadable = useMemo(
    () => (carrierReady ? domain.carrierForDraft(rows, selectedIndex) : undefined),
    [carrierReady, domain, rows, selectedIndex],
  );
  const carrierController = useWorkspaceInteractionController<
    WorkspaceEchoLastRunBoonCarrierDomain | undefined
  >();
  const carrierLoaded = carrierController.observe(carrierLoadable);
  useEffect(() => {
    if (carrierLoadable !== undefined) carrierController.activate(carrierLoadable);
  }, [carrierController, carrierLoadable]);
  const carrierComplete =
    selectedCarrierKind === undefined || carrierLoaded.result?.complete === true;

  const updateRow = (index: number, next: EchoLastRunBoonDraftRow): void => {
    setRows((current) =>
      Object.freeze(current.map((row, rowIndex) => (rowIndex === index ? next : row))),
    );
  };

  return (
    <section
      {...findingTarget}
      tabIndex={-1}
      className="echo-last-run-choice"
      aria-label="Boon Boon Boon choice"
    >
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
                id={`${controlId}-${optionKey}`}
                label="Trait"
                model={traitPicker}
                onSelect={(identity) => {
                  setEditingNaturalSelection(false);
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
                  onChange={() => {
                    setEditingNaturalSelection(false);
                    setSelectedIndex(index);
                  }}
                  type="radio"
                />
                Echo grants this outcome
              </label>
              {rows.length === 1 ? null : (
                <button
                  className="quiet-action action-compact"
                  onClick={() => {
                    setEditingNaturalSelection(false);
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
      {selectedCarrierKind === 'allTogether' && carrierLoaded.result?.kind === 'allTogether' ? (
        <EchoAllTogetherOutcome
          controlId={controlId}
          domain={carrierLoaded.result}
          key={`${selectedIndex}:${selectedRow?.identity?.traitKey ?? 'unselected'}`}
          {...(selectedRow?.allTogetherResult === undefined
            ? {}
            : { value: selectedRow.allTogetherResult })}
          onComplete={(allTogetherResult) =>
            updateRow(selectedIndex, Object.freeze({ ...selectedRow, allTogetherResult }))
          }
        />
      ) : null}
      {selectedCarrierKind === 'naturalSelection' &&
      carrierLoaded.result?.kind === 'naturalSelection' &&
      selectedRow !== undefined ? (
        <EchoNaturalSelectionOutcome
          controlId={controlId}
          domain={carrierLoaded.result}
          editing={editingNaturalSelection}
          onEditingChange={setEditingNaturalSelection}
          targets={selectedRow.naturalSelectionTargets ?? Object.freeze([])}
          onChange={(targets) => {
            if (targets === undefined) {
              const { naturalSelectionTargets: _removed, ...remaining } = selectedRow;
              void _removed;
              updateRow(selectedIndex, Object.freeze(remaining));
            } else
              updateRow(
                selectedIndex,
                Object.freeze({
                  ...selectedRow,
                  naturalSelectionTargets:
                    targets as AuthoredEchoLastRunBoonOption['naturalSelectionTargets'],
                }),
              );
          }}
        />
      ) : null}
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
          disabled={!draftSupport.complete || !carrierComplete}
          onClick={() => {
            if (!draftSupport.complete) return;
            const options = rows.map((row) =>
              Object.freeze({
                giverKey: row.identity!.giverKey,
                traitKey: row.identity!.traitKey,
                rarity: row.rarity!,
                ...(row.targetTraitKey === undefined ? {} : { targetTraitKey: row.targetTraitKey }),
                ...(row.allTogetherResult === undefined
                  ? {}
                  : { allTogetherResult: row.allTogetherResult }),
                ...(row.naturalSelectionTargets === undefined
                  ? {}
                  : { naturalSelectionTargets: row.naturalSelectionTargets }),
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

export function LoadedEchoLastRunBoonChoice({
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
  const findingTarget = useFindingTarget();
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
      findingTarget={findingTarget(child.control.address)}
      controlId={semanticOwnerControlElementId(child.control.address)}
      domain={loaded.result}
      {...(option.echoLastRunBoon === undefined ? {} : { value: option.echoLastRunBoon })}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}

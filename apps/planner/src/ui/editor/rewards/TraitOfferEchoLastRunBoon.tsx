import {
  optionIndex,
  semanticAddressKey,
  type AuthoredEchoLastRunBoonOption,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type {
  WorkspaceEchoLastRunBoonDomain,
  WorkspaceEchoLastRunBoonCarrierDomain,
  WorkspaceEchoLastRunBoonDraftRow,
  WorkspaceTraitOfferInteraction,
} from '@planner/projections/structured-workspace';
import { useAppSelector } from '@planner/state/store';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget, type FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { TraitOfferForm, TraitOfferShapeActions } from './TraitOfferForm';
import { TraitOfferOption } from './TraitOfferOption';
import { TraitAcquisitionTargetOutcome } from './TraitOfferSelectedOutcome';
import {
  AllTogetherOutcomeEditor,
  NaturalSelectionOutcomeEditor,
} from './TraitOfferSelectedSpecialOutcomes';

type DraftRow = WorkspaceEchoLastRunBoonDraftRow;

function pickerItems<T>(model: ContextualPickerModel<T>) {
  return model.sections.flatMap((section) => section.items);
}

function rowFromOption({
  giverKey,
  traitKey,
  ...payload
}: AuthoredEchoLastRunBoonOption): DraftRow {
  return Object.freeze({ ...payload, identity: Object.freeze({ giverKey, traitKey }) });
}

function completeRow(row: DraftRow | undefined): AuthoredEchoLastRunBoonOption | undefined {
  if (row?.identity === undefined || row.rarity === undefined) return undefined;
  const { identity, ...payload } = row;
  return Object.freeze({ ...payload, ...identity, rarity: row.rarity });
}

function withNaturalTargets(row: DraftRow, targets: readonly string[]): DraftRow {
  const { naturalSelectionTargets: _previous, ...rest } = row;
  void _previous;
  return Object.freeze({
    ...rest,
    ...(targets.length === 0
      ? {}
      : {
          naturalSelectionTargets: targets as NonNullable<DraftRow['naturalSelectionTargets']>,
        }),
  });
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
  const [rows, setRows] = useState<readonly DraftRow[]>(() =>
    value === undefined
      ? Object.freeze([Object.freeze({})])
      : Object.freeze(value.options.map(rowFromOption)),
  );
  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    value === undefined ? 0 : optionIndex(value.selectedOptionKey),
  );
  const selectedRow = rows[selectedIndex];
  const selectedComplete = useMemo(() => completeRow(selectedRow), [selectedRow]);
  const draftSupport = domain.draftSupportFor(rows, selectedIndex);
  const nextDraft = domain.nextDraft(rows, selectedIndex);
  const previousDraft = domain.previousDraft(rows, selectedIndex);
  const selectedKind =
    selectedRow?.identity === undefined ? undefined : domain.carrierKindFor(selectedRow.identity);
  const carrierLoadable = useMemo(
    () =>
      selectedComplete === undefined || selectedKind === undefined
        ? undefined
        : domain.carrierForDraft(rows, selectedIndex),
    [domain, rows, selectedIndex, selectedComplete, selectedKind],
  );
  const carrierController = useWorkspaceInteractionController<
    WorkspaceEchoLastRunBoonCarrierDomain | undefined
  >();
  const carrierLoaded = carrierController.observe(carrierLoadable);
  useEffect(() => {
    if (carrierLoadable !== undefined) carrierController.activate(carrierLoadable);
  }, [carrierController, carrierLoadable]);
  const carrier = carrierLoaded.result;
  const carrierComplete = selectedKind === undefined || carrier?.complete === true;
  const targetLoadable = useMemo(
    () =>
      selectedComplete === undefined
        ? undefined
        : {
            load: () => ({ targetPicker: domain.targetPickerFor(selectedComplete) }),
          },
    [domain, selectedComplete],
  );
  const allTogetherSets = useMemo(
    () =>
      carrier?.kind !== 'allTogether'
        ? []
        : carrier.sets.map((set) => ({
            controlId: `${controlId}-all-together-${set.setKey}`,
            setKey: set.setKey,
            loadable: { load: () => ({ picker: set.picker }) },
            ...(selectedRow?.allTogetherResult?.[set.setKey] === undefined
              ? {}
              : { value: selectedRow.allTogetherResult[set.setKey] }),
          })),
    [carrier, controlId, selectedRow],
  );
  const naturalLoadableFor = useCallback(
    (targets: readonly string[], retainedTarget?: string) =>
      domain.naturalSelectionForDraft(
        Object.freeze(
          rows.map((row, index) =>
            index === selectedIndex ? withNaturalTargets(row, targets) : row,
          ),
        ),
        selectedIndex,
        retainedTarget,
      ),
    [domain, rows, selectedIndex],
  );

  const updateRow = (index: number, next: DraftRow) =>
    setRows((current) =>
      Object.freeze(current.map((row, rowIndex) => (rowIndex === index ? next : row))),
    );
  const applySize = (draft: NonNullable<typeof nextDraft>) => {
    setRows(draft.rows);
    setSelectedIndex(draft.selectedIndex);
  };
  const selectedPayload = (
    <>
      {selectedComplete === undefined ||
      selectedRow?.identity === undefined ||
      !domain.targetRequiredFor(selectedRow.identity) ||
      targetLoadable === undefined ? null : (
        <TraitAcquisitionTargetOutcome
          controlId={`${controlId}-target`}
          ariaLabel="Boon Boon Boon selected trait target"
          loadable={targetLoadable}
          {...(selectedRow.targetTraitKey === undefined
            ? {}
            : { targetTraitKey: selectedRow.targetTraitKey })}
          traitLabel={(key) =>
            pickerItems(domain.targetPickerFor(selectedComplete)).find((item) => item.value === key)
              ?.label ?? key
          }
          onSelect={(targetTraitKey) =>
            updateRow(selectedIndex, Object.freeze({ ...selectedRow, targetTraitKey }))
          }
        />
      )}
      {selectedKind === 'allTogether' && carrier?.kind === 'allTogether' ? (
        <AllTogetherOutcomeEditor
          key={`${selectedIndex}:${selectedRow?.identity?.traitKey}`}
          sets={allTogetherSets}
          onSelect={(allTogetherResult) =>
            updateRow(selectedIndex, Object.freeze({ ...selectedRow, allTogetherResult }))
          }
        />
      ) : null}
      {selectedKind === 'naturalSelection' &&
      carrier?.kind === 'naturalSelection' &&
      selectedRow !== undefined ? (
        <NaturalSelectionOutcomeEditor
          key={`${selectedIndex}:${selectedRow.identity?.traitKey}`}
          controlId={`${controlId}-natural-selection`}
          initial={selectedRow.naturalSelectionTargets ?? []}
          slotCount={carrier.slotCount}
          traitLabel={carrier.traitLabel}
          loadableFor={naturalLoadableFor}
          onSelect={(targets) => updateRow(selectedIndex, withNaturalTargets(selectedRow, targets))}
        />
      ) : null}
      {selectedKind === undefined || carrier !== undefined ? null : (
        <p className="feedback-text">
          Complete the other Echo rows before editing this outcome. Existing targets are retained.
        </p>
      )}
    </>
  );

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
      <TraitOfferForm
        options={rows.map((row, index) => {
          const traitPicker = domain.traitPickerFor(
            rows.flatMap((other, otherIndex) =>
              otherIndex === index || other.identity === undefined ? [] : [other.identity.traitKey],
            ),
            row.identity,
          );
          const rarityPicker =
            row.identity === undefined
              ? undefined
              : domain.rarityPickerFor(row.identity, row.rarity);
          const rarityItems = rarityPicker === undefined ? [] : pickerItems(rarityPicker);
          const supportedRarities = rarityItems.filter((item) => item.state !== 'impossible');
          const fixedRarity =
            supportedRarities.length === 1 &&
            !rarityItems.some((item) => item.value === row.rarity && item.state === 'impossible')
              ? supportedRarities[0]!.value
              : undefined;
          const complete = completeRow(row);
          const effectiveRarity =
            complete === undefined ? undefined : domain.effectiveRarityFor(complete);
          const effectiveLevel =
            row.identity === undefined ? undefined : domain.effectiveLevelFor(row.identity);
          return (
            <TraitOfferOption
              key={index}
              controlId={`${controlId}-option${index + 1}`}
              legend={`Option ${index + 1}`}
              loading={false}
              traitAriaLabel={`Boon Boon Boon outcome ${index + 1}`}
              traitPicker={traitPicker}
              {...(row.identity === undefined ? {} : { traitLabel: domain.labelFor(row.identity) })}
              onSelectTrait={(identity) => {
                const rarities = pickerItems(domain.rarityPickerFor(identity)).filter(
                  (item) => item.state !== 'impossible',
                );
                updateRow(
                  index,
                  Object.freeze({
                    identity,
                    ...(rarities.length === 1 ? { rarity: rarities[0]!.value } : {}),
                  }),
                );
              }}
              {...(fixedRarity === undefined ? {} : { fixedRarity })}
              {...(rarityPicker === undefined
                ? {}
                : {
                    rarityPicker,
                    onSelectRarity: (rarity) => updateRow(index, Object.freeze({ ...row, rarity })),
                  })}
              rarityAriaLabel={`Boon Boon Boon outcome ${index + 1} rarity`}
              {...(row.rarity === undefined ? {} : { rarityValue: row.rarity })}
              {...(effectiveRarity === undefined ? {} : { effectiveRarity })}
              {...(effectiveLevel === undefined ? {} : { effectiveLevel })}
              selected={selectedIndex === index}
              selectedDisabled={false}
              selectedName={`${controlId}-selected`}
              selectedLabel="Echo grants this outcome"
              onSelectedChange={() => setSelectedIndex(index)}
            />
          );
        })}
        selectedOutcome={selectedPayload}
        shapeActions={
          <TraitOfferShapeActions
            {...(nextDraft === undefined ? {} : { onAdd: () => applySize(nextDraft) })}
            {...(previousDraft === undefined ? {} : { onRemove: () => applySize(previousDraft) })}
          />
        }
        save={{
          disabled: !draftSupport.complete || !carrierComplete,
          label: 'Save Boon Boon Boon choice',
          onClick: () => {
            const completed = domain.completeDraft(rows, selectedIndex);
            if (draftSupport.complete && carrierComplete && completed !== undefined)
              onComplete(completed);
          },
        }}
        reset={
          <button className="quiet-action" onClick={onBack} type="button">
            Cancel
          </button>
        }
      />
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
    () =>
      interaction
        .optionDomain(offer, optionKey)
        .children.find(
          (
            entry,
          ): entry is Extract<
            typeof entry,
            { readonly child: { readonly kind: 'echoLastRunBoon' } }
          > => entry.child.kind === 'echoLastRunBoon',
        ),
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
      semanticAddressKey(focusedSemanticOwner) !== semanticAddressKey(child.child.address)
    )
      return;
    document.getElementById(semanticOwnerControlElementId(child.child.address))?.focus();
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
      findingTarget={findingTarget(child.child.address)}
      controlId={semanticOwnerControlElementId(child.child.address)}
      domain={loaded.result}
      {...(option.echoLastRunBoon === undefined ? {} : { value: option.echoLastRunBoon })}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}

import type { AuthoredAllTogetherResult } from '@run-planner/engine/authored-project';
import type { DirectTraitSetKey } from '@run-planner/engine/catalog-schema';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type {
  WorkspaceAllTogetherSetDomain,
  WorkspaceNaturalSelectionDomain,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import type {
  FindingAnchorProps,
  FindingMarkProps,
  FindingTargetProps,
} from '@planner/ui/feedback/useFindingTarget';
import { SelectedOutcomeRow } from './SelectedOutcomeBlock';

const noTargets: readonly string[] = Object.freeze([]);
const emptyPicker: ContextualPickerModel<never> = Object.freeze({ sections: Object.freeze([]) });

function useLoaded<T>(loadable: { readonly load: () => T | undefined }) {
  const controller = useWorkspaceInteractionController<T | undefined>();
  const loaded = controller.observe(loadable);
  useEffect(() => {
    controller.activate(loadable);
  }, [controller, loadable]);
  return loaded;
}

export interface AllTogetherSetRow {
  readonly controlId: string;
  readonly findingTarget?: FindingTargetProps;
  readonly loadable: { readonly load: () => WorkspaceAllTogetherSetDomain | undefined };
  readonly resultLabel: (result: string | null) => string;
  readonly setKey: DirectTraitSetKey;
}

function AllTogetherSetRowPicker({
  findingMark,
  onSelect,
  row,
  value,
}: {
  readonly findingMark?: FindingMarkProps;
  readonly onSelect: (value: string | null) => void;
  readonly row: AllTogetherSetRow;
  readonly value: string | null | undefined;
}) {
  const loaded = useLoaded(row.loadable);
  const label = `${row.setKey[0]!.toUpperCase()}${row.setKey.slice(1)}`;
  return (
    <ContextualPicker
      {...(row.findingTarget === undefined ? {} : { findingTarget: row.findingTarget })}
      {...(findingMark === undefined ? {} : { findingMark })}
      ariaLabel={`All Together ${label}`}
      id={row.controlId}
      label={label}
      layout="inline"
      loading={loaded.pending}
      model={loaded.result?.picker ?? emptyPicker}
      onSelect={onSelect}
      placeholder="Choose a grant"
      {...(value === undefined ? {} : { triggerLabel: row.resultLabel(value) })}
    />
  );
}

/** One picker row per set; the draft takes the result once every set is chosen. */
export function AllTogetherOutcomeRows({
  authored,
  firstRowMark,
  onSelect,
  rows,
}: {
  readonly authored: AuthoredAllTogetherResult | undefined;
  /** Marks the first set for a finding of the whole group. */
  readonly firstRowMark?: FindingMarkProps;
  readonly onSelect: (result: AuthoredAllTogetherResult) => void;
  readonly rows: readonly AllTogetherSetRow[];
}) {
  // A partial result is not authorable, so unfinished rows wait here until the draft changes.
  const [partial, setPartial] = useState<{
    readonly base: AuthoredAllTogetherResult | undefined;
    readonly values: Partial<AuthoredAllTogetherResult>;
  }>({ base: authored, values: {} });
  const current: Partial<AuthoredAllTogetherResult> =
    authored ?? (partial.base === authored ? partial.values : {});
  const choose = (setKey: DirectTraitSetKey, value: string | null) => {
    const next = Object.freeze({ ...current, [setKey]: value });
    if (rows.every((row) => Object.prototype.hasOwnProperty.call(next, row.setKey)))
      onSelect(next as AuthoredAllTogetherResult);
    else setPartial({ base: authored, values: next });
  };
  return (
    <div aria-label="All Together grants" className="trait-outcome-rows" role="group">
      {rows.map((row, index) => (
        <AllTogetherSetRowPicker
          {...(index === 0 && firstRowMark !== undefined ? { findingMark: firstRowMark } : {})}
          key={row.setKey}
          onSelect={(value) => choose(row.setKey, value)}
          row={row}
          value={current[row.setKey]}
        />
      ))}
    </div>
  );
}

function ordinal(position: number): string {
  const suffix =
    position % 100 >= 11 && position % 100 <= 13
      ? 'th'
      : (['th', 'st', 'nd', 'rd'][position % 10] ?? 'th');
  return `${position}${suffix}`;
}

/**
 * One row per core in the first-pass order. Picks wait here until the engine
 * completes the allocation, which the draft then takes whole.
 */
export function NaturalSelectionOutcomeRows({
  authored,
  controlId,
  findingAnchor,
  firstRowMark,
  loadableFor,
  onClear,
  onSelect,
  traitLabel,
}: {
  readonly authored: readonly string[] | undefined;
  readonly controlId: string;
  /** Navigation lands on the group; its findings mark the first row. */
  readonly findingAnchor?: FindingAnchorProps;
  readonly firstRowMark?: FindingMarkProps;
  readonly loadableFor: (targets: readonly string[]) => {
    readonly load: () => WorkspaceNaturalSelectionDomain | undefined;
  };
  readonly onClear: () => void;
  readonly onSelect: (targets: readonly string[]) => void;
  readonly traitLabel: (traitKey: string) => string;
}) {
  const [local, setLocal] = useState<{
    readonly base: readonly string[] | undefined;
    readonly picks: readonly string[];
  }>({ base: authored, picks: authored ?? [] });
  const picks = useMemo(
    () => (local.base === authored ? local.picks : (authored ?? noTargets)),
    [authored, local],
  );
  const loadable = useMemo(() => loadableFor(picks), [loadableFor, picks]);
  const loaded = useLoaded(loadable);
  const nextController = useWorkspaceInteractionController<
    WorkspaceNaturalSelectionDomain | undefined
  >();
  const domain = loaded.result;
  // One eligible core leaves no choice, so its allocation seeds an unresolved draft.
  const seed =
    authored === undefined &&
    domain?.rows.length === 1 &&
    domain.rows[0]!.forcedTraitKey !== undefined
      ? domain.completedTargets
      : undefined;
  const seeded = useRef<readonly string[] | undefined>(undefined);
  useEffect(() => {
    if (seed === undefined || seeded.current === seed) return;
    seeded.current = seed;
    onSelect(seed);
  }, [onSelect, seed]);
  const choose = (position: number, traitKey: string) => {
    const next = Object.freeze([...picks.slice(0, position), traitKey]);
    const completed = nextController.activate(loadableFor(next))?.completedTargets;
    if (completed !== undefined) {
      onSelect(completed);
      return;
    }
    // A partial first pass is not a plan, so the draft holds no targets meanwhile.
    setLocal({ base: undefined, picks: next });
    if (authored !== undefined) onClear();
  };
  return (
    <div
      {...findingAnchor}
      aria-label="Natural Selection targets"
      className="trait-outcome-rows"
      id={controlId}
      role="group"
      tabIndex={findingAnchor === undefined ? undefined : -1}
    >
      {domain === undefined || domain.rows.length === 0 ? (
        <SelectedOutcomeRow label="Targets">
          <span>
            {loaded.pending
              ? 'Evaluating targets…'
              : picks.length > 0
                ? picks.map(traitLabel).join(' · ')
                : '—'}
          </span>
        </SelectedOutcomeRow>
      ) : null}
      {domain?.rows.map((row, position) => {
        const id = `${controlId}-${position + 1}`;
        const label = ordinal(position + 1);
        if (row.forcedTraitKey !== undefined)
          return (
            <SelectedOutcomeRow key={position} label={label}>
              <span aria-label={`Natural Selection ${label} core`} id={id}>
                {traitLabel(row.forcedTraitKey)}
              </span>
            </SelectedOutcomeRow>
          );
        const target = picks[position];
        return (
          <ContextualPicker
            {...(position === 0 && firstRowMark !== undefined ? { findingMark: firstRowMark } : {})}
            ariaLabel={`Natural Selection ${label} core`}
            id={id}
            key={position}
            label={label}
            layout="inline"
            model={row.picker}
            onSelect={(traitKey: string) => choose(position, traitKey)}
            placeholder="Choose an eligible core trait"
            {...(row.requiresEarlierRow
              ? { disabledHint: `Choose the ${ordinal(position)} core first.` }
              : {})}
            {...(target === undefined || row.requiresEarlierRow
              ? {}
              : { triggerLabel: traitLabel(target) })}
          />
        );
      })}
      {domain?.levelsLabel === undefined ? null : (
        <SelectedOutcomeRow label="Levels">
          <span aria-label="Natural Selection levels">{domain.levelsLabel}</span>
        </SelectedOutcomeRow>
      )}
    </div>
  );
}

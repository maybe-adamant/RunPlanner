import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { useCallback, useEffect, useRef, useState, type ReactElement, type Ref } from 'react';
import type { FindingMarkProps, FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { hintProps } from './hint';

import type {
  ContextualPickerItem,
  ContextualPickerModel,
  ContextualPickerSection,
} from '@planner/projections/contextual/contextualPicker';

interface ContextualPickerProps<T> {
  readonly findingTarget?: FindingTargetProps;
  /** Findings of an owner this picker repairs without being its navigation target. */
  readonly findingMark?: FindingMarkProps;
  readonly ariaLabel?: string;
  readonly cancelLabel?: string;
  readonly choiceLabel?: string;
  readonly closeOnSelect?: boolean;
  readonly disabled?: boolean;
  /** Disables the picker with this hint while still showing its current value. */
  readonly disabledHint?: string;
  readonly id: string;
  readonly label: string;
  readonly layout?: 'inline' | 'stacked';
  readonly loading?: boolean;
  readonly model: ContextualPickerModel<T>;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onSelect: (value: T) => void;
  readonly open?: boolean;
  readonly placeholder: string;
  readonly side?: 'top' | 'bottom';
  readonly triggerLabel?: string;
  /** Hover explanation for the current value of an enabled trigger. */
  readonly triggerHint?: string;
  /** Marks a retained value the current context cannot produce. */
  readonly invalid?: boolean;
  /** Marks a local customization issue this picker repairs. */
  readonly hasIssues?: boolean;
}

function itemValue<T>(item: ContextualPickerItem<T>): string {
  return `${item.label} ${item.key}`;
}

function PickerSection<T>({
  groupRef,
  onSelect,
  section,
}: {
  readonly groupRef?: Ref<HTMLDivElement>;
  readonly onSelect: (item: ContextualPickerItem<T>) => void;
  readonly section: ContextualPickerSection<T>;
}) {
  return (
    <Command.Group heading={section.label} value={section.key} ref={groupRef}>
      {section.items.map((item) => {
        return (
          <Command.Item
            aria-label={item.ariaLabel}
            data-candidate-state={item.state}
            data-selected-value={item.selected}
            disabled={item.disabled}
            key={item.key}
            keywords={[section.label, item.explanation ?? '']}
            onSelect={() => onSelect(item)}
            value={itemValue(item)}
          >
            <span className="contextual-picker-item-indicator" aria-hidden="true">
              {item.selected ? '✓' : item.state === 'forced' ? '!' : ''}
            </span>
            <span className="contextual-picker-item-copy">
              <span className="contextual-picker-item-label">{item.label}</span>
              {item.explanation !== undefined && (
                <span className="contextual-picker-item-explanation">{item.explanation}</span>
              )}
            </span>
            {item.status !== undefined && (
              <span className="contextual-picker-item-state">{item.status}</span>
            )}
          </Command.Item>
        );
      })}
    </Command.Group>
  );
}

function PickerContent<T>({
  cancelLabel,
  choicesLabel,
  loading,
  model,
  onActiveChange,
  onCancel,
  onSelect,
  searchable = true,
  stepLabel,
}: {
  readonly cancelLabel?: string;
  readonly choicesLabel: string;
  readonly loading: boolean;
  readonly model: ContextualPickerModel<T>;
  /** The item under the pointer or keyboard highlight. */
  readonly onActiveChange?: (item: ContextualPickerItem<T> | undefined) => void;
  readonly onCancel: () => void;
  readonly onSelect: (item: ContextualPickerItem<T>) => void;
  /** Without search, the list itself takes focus and the arrow keys. */
  readonly searchable?: boolean;
  readonly stepLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!searchable) root.current?.focus({ preventScroll: true });
    // Focuses once when the list opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const items = model.sections.flatMap((section) => section.items);
  // The highlight is controlled only when its owner follows it; it starts on the first item.
  const [activeValue, setActiveValue] = useState(() =>
    items[0] === undefined ? '' : itemValue(items[0]),
  );
  useEffect(() => {
    onActiveChange?.(items.find((item) => itemValue(item) === activeValue));
    // Reports the initial highlight once; later moves report through cmdk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const collapsibleGroup = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const previousLoading = useRef(loading);
  const collapsible = model.sections.find((section) => section.collapsible);
  const ordinarySections = model.sections.filter((section) => !section.collapsible);

  useEffect(() => {
    if (collapsibleOpen && list.current !== null && collapsibleGroup.current !== null) {
      list.current.scrollTop = collapsibleGroup.current.offsetTop;
    }
  }, [collapsibleOpen]);

  useEffect(() => {
    const loadingFinished = previousLoading.current && !loading;
    previousLoading.current = loading;
    if ((!loading && stepLabel !== undefined) || loadingFinished) {
      input.current?.focus({ preventScroll: true });
    }
  }, [loading, stepLabel]);

  const select = (item: ContextualPickerItem<T>): void => {
    onSelect(item);
    if (!item.disabled) {
      setQuery('');
    }
  };

  return (
    <>
      {stepLabel === undefined ? null : <p className="contextual-picker-step-label">{stepLabel}</p>}
      {loading ? (
        <p className="contextual-picker-loading" role="status">
          Evaluating {choicesLabel.toLowerCase()} choices…
        </p>
      ) : (
        <Command
          label={`${choicesLabel} choices`}
          ref={root}
          shouldFilter={searchable}
          {...(searchable ? {} : { tabIndex: -1 })}
          {...(onActiveChange === undefined
            ? {}
            : {
                value: activeValue,
                onValueChange: (value: string) => {
                  setActiveValue(value);
                  onActiveChange(items.find((item) => itemValue(item) === value.trim()));
                },
              })}
        >
          {searchable ? (
            <Command.Input
              aria-label={`Search ${choicesLabel.toLowerCase()} choices`}
              onValueChange={setQuery}
              placeholder={`Search ${choicesLabel.toLowerCase()}...`}
              ref={input}
              value={query}
            />
          ) : null}
          <Command.List ref={list}>
            {(query !== '' || collapsible === undefined) && (
              <Command.Empty>No matching choices.</Command.Empty>
            )}
            {ordinarySections.map((section) => (
              <PickerSection key={section.key} onSelect={select} section={section} />
            ))}
            {collapsibleOpen && collapsible !== undefined && (
              <PickerSection groupRef={collapsibleGroup} onSelect={select} section={collapsible} />
            )}
          </Command.List>
          {collapsible !== undefined && (
            <button
              aria-expanded={collapsibleOpen}
              className="contextual-picker-disclosure"
              onClick={() => setCollapsibleOpen((value) => !value)}
              type="button"
            >
              <span aria-hidden="true">{collapsibleOpen ? '▾' : '▸'}</span>
              {collapsible.label} ({collapsible.items.length})
            </button>
          )}
        </Command>
      )}
      {cancelLabel === undefined ? null : (
        <button className="contextual-picker-cancel" onClick={onCancel} type="button">
          {cancelLabel}
        </button>
      )}
    </>
  );
}

export function ContextualPicker<T>({
  findingTarget,
  ariaLabel,
  cancelLabel,
  choiceLabel,
  closeOnSelect = true,
  disabled = false,
  disabledHint,
  id,
  label,
  layout = 'stacked',
  loading = false,
  model,
  onOpenChange,
  onSelect,
  open: controlledOpen,
  placeholder,
  side = 'bottom',
  triggerLabel,
  triggerHint,
  invalid = false,
  hasIssues,
  findingMark,
}: ContextualPickerProps<T>) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const captureTrigger = useCallback((node: HTMLButtonElement | null): void => {
    const container = node?.closest<HTMLElement>('dialog') ?? null;
    setPortalContainer((current) => (current === container ? current : container));
  }, []);
  const open = controlledOpen ?? internalOpen;
  const selected = model.selected;
  const choicesLabel = choiceLabel ?? label;
  const authoringLocked = findingTarget?.['data-authoring-locked'] === true;
  const interactionDisabled = disabled || disabledHint !== undefined || authoringLocked;

  function updateOpen(nextOpen: boolean): void {
    if (nextOpen && interactionDisabled) return;
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

  function select(item: ContextualPickerItem<T>): void {
    if (item.disabled) {
      return;
    }
    onSelect(item.value);
    if (closeOnSelect) {
      updateOpen(false);
    }
  }

  return (
    <div
      className={`field-control contextual-picker${layout === 'inline' ? ' field-control-inline' : ''}`}
    >
      <label htmlFor={id}>{label}</label>
      <Popover.Root open={open} onOpenChange={updateOpen}>
        <Popover.Trigger asChild>
          <button
            aria-busy={loading || undefined}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={invalid || selected?.state === 'impossible' || undefined}
            {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
            className="contextual-picker-trigger"
            data-candidate-state={selected?.state ?? 'unspecified'}
            data-has-issues={hasIssues || undefined}
            disabled={interactionDisabled}
            {...findingTarget}
            {...(findingMark === undefined || !findingMark['data-has-findings'] ? {} : findingMark)}
            {...hintProps(
              disabledHint ?? triggerHint,
              findingMark?.['aria-description'] ??
                findingTarget?.['aria-description'] ??
                selected?.explanation,
            )}
            id={id}
            ref={(node) => {
              captureTrigger(node);
              findingTarget?.ref(node);
            }}
            type="button"
          >
            <span>{disabled ? placeholder : (triggerLabel ?? selected?.label ?? placeholder)}</span>
            <span className="contextual-picker-trigger-icon" aria-hidden="true">
              ▾
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal container={portalContainer ?? undefined}>
          <Popover.Content
            align="start"
            className="contextual-picker-popover"
            data-multi-stage={!closeOnSelect || undefined}
            collisionPadding={12}
            side={side}
            sideOffset={6}
          >
            <PickerContent
              {...(cancelLabel === undefined ? {} : { cancelLabel })}
              choicesLabel={choicesLabel}
              key={choiceLabel ?? 'default'}
              loading={loading}
              model={model}
              onCancel={() => updateOpen(false)}
              onSelect={select}
              {...(choiceLabel === undefined ? {} : { stepLabel: choiceLabel })}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

/**
 * The same picker opened from a trigger the caller renders, such as a node on a
 * board; the popover opens to the trigger's right under a heading naming it,
 * flipping or shifting within the caller's collision boundary.
 */
export function ContextualPickerPopover<T>({
  children,
  choiceLabel,
  collisionBoundary,
  heading,
  model,
  onActiveChange,
  onOpenChange,
  onSelect,
  open,
  searchable,
}: {
  /** The trigger element; it keeps its own name, marks and position. */
  readonly children: ReactElement;
  readonly choiceLabel: string;
  /** The element the popover stays within, such as its editor; the viewport when absent. */
  readonly collisionBoundary?: Element | null;
  readonly heading: string;
  readonly model: ContextualPickerModel<T>;
  readonly onActiveChange?: (item: ContextualPickerItem<T> | undefined) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelect: (value: T) => void;
  readonly open: boolean;
  /** Whether the list offers a search box. */
  readonly searchable: boolean;
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const captureTrigger = useCallback((node: HTMLElement | null): void => {
    const container = node?.closest<HTMLElement>('dialog') ?? null;
    setPortalContainer((current) => (current === container ? current : container));
  }, []);
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild ref={captureTrigger}>
        {children}
      </Popover.Trigger>
      <Popover.Portal container={portalContainer ?? undefined}>
        <Popover.Content
          align="start"
          aria-label={heading}
          className="contextual-picker-popover"
          {...(collisionBoundary == null ? {} : { collisionBoundary })}
          collisionPadding={12}
          side="right"
          sideOffset={8}
          sticky="always"
        >
          <p className="contextual-picker-step-label">{heading}</p>
          <PickerContent
            choicesLabel={choiceLabel}
            loading={false}
            model={model}
            {...(onActiveChange === undefined ? {} : { onActiveChange })}
            onCancel={() => onOpenChange(false)}
            onSelect={(item) => {
              if (item.disabled) return;
              onSelect(item.value);
              onOpenChange(false);
            }}
            searchable={searchable}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

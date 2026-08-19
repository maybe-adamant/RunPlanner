import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ContextualPickerItem,
  ContextualPickerModel,
  ContextualPickerSection,
} from '@planner/projections/contextualPicker';

interface ContextualPickerProps<T> {
  readonly ariaLabel?: string;
  readonly cancelLabel?: string;
  readonly choiceLabel?: string;
  readonly closeOnSelect?: boolean;
  readonly disabled?: boolean;
  readonly id: string;
  readonly label: string;
  readonly layout?: 'inline' | 'stacked';
  readonly loading?: boolean;
  readonly model: ContextualPickerModel<T>;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onSelect: (value: T) => void;
  readonly open?: boolean;
  readonly placeholder: string;
  readonly triggerLabel?: string;
}

function PickerSection<T>({
  onSelect,
  section,
}: {
  readonly onSelect: (item: ContextualPickerItem<T>) => void;
  readonly section: ContextualPickerSection<T>;
}) {
  return (
    <Command.Group heading={section.label} value={section.key}>
      {section.items.map((item) => {
        return (
          <Command.Item
            data-candidate-state={item.state}
            data-selected-value={item.selected}
            disabled={item.disabled}
            key={item.key}
            keywords={[section.label, item.explanation ?? '']}
            onSelect={() => onSelect(item)}
            value={`${item.label} ${item.key}`}
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
  onCancel,
  onSelect,
  stepLabel,
}: {
  readonly cancelLabel?: string;
  readonly choicesLabel: string;
  readonly loading: boolean;
  readonly model: ContextualPickerModel<T>;
  readonly onCancel: () => void;
  readonly onSelect: (item: ContextualPickerItem<T>) => void;
  readonly stepLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const previousLoading = useRef(loading);
  const collapsible = model.sections.find((section) => section.collapsible);
  const ordinarySections = model.sections.filter((section) => !section.collapsible);

  useEffect(() => {
    const loadingFinished = previousLoading.current && !loading;
    previousLoading.current = loading;
    if ((!loading && stepLabel !== undefined) || loadingFinished) {
      input.current?.focus();
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
        <Command label={`${choicesLabel} choices`} shouldFilter={true}>
          <Command.Input
            aria-label={`Search ${choicesLabel.toLowerCase()} choices`}
            onValueChange={setQuery}
            placeholder={`Search ${choicesLabel.toLowerCase()}...`}
            ref={input}
            value={query}
          />
          <Command.List>
            {(query !== '' || collapsible === undefined) && (
              <Command.Empty>No matching choices.</Command.Empty>
            )}
            {ordinarySections.map((section) => (
              <PickerSection key={section.key} onSelect={select} section={section} />
            ))}
            {collapsibleOpen && collapsible !== undefined && (
              <PickerSection onSelect={select} section={collapsible} />
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
  ariaLabel,
  cancelLabel,
  choiceLabel,
  closeOnSelect = true,
  disabled = false,
  id,
  label,
  layout = 'stacked',
  loading = false,
  model,
  onOpenChange,
  onSelect,
  open: controlledOpen,
  placeholder,
  triggerLabel,
}: ContextualPickerProps<T>) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const captureTrigger = useCallback((node: HTMLButtonElement | null): void => {
    const container = node?.closest<HTMLElement>('dialog') ?? null;
    setPortalContainer((current) => (current === container ? current : container));
  }, []);
  const open = controlledOpen ?? internalOpen;
  const selected = model.selected;
  const selectedExplanationId =
    selected?.explanation === undefined ? undefined : `${id}-selected-explanation`;
  const choicesLabel = choiceLabel ?? label;

  function updateOpen(nextOpen: boolean): void {
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
            aria-describedby={selectedExplanationId}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={selected?.state === 'impossible' || undefined}
            {...(ariaLabel === undefined ? {} : { 'aria-label': ariaLabel })}
            className="contextual-picker-trigger"
            data-candidate-state={selected?.state ?? 'unspecified'}
            disabled={disabled}
            id={id}
            ref={captureTrigger}
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
            collisionPadding={12}
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
      {selected?.explanation !== undefined && (
        <p
          className="contextual-picker-selected-explanation"
          data-candidate-state={selected.state}
          id={selectedExplanationId}
        >
          {selected.explanation}
        </p>
      )}
    </div>
  );
}

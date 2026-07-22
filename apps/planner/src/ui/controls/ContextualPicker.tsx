import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { useState } from 'react';

import type {
  ContextualPickerItem,
  ContextualPickerModel,
  ContextualPickerSection,
} from '../../projections/contextualPicker';

interface ContextualPickerProps<T> {
  readonly disabled?: boolean;
  readonly id: string;
  readonly label: string;
  readonly model: ContextualPickerModel<T>;
  readonly onSelect: (value: T) => void;
  readonly placeholder: string;
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

export function ContextualPicker<T>({
  disabled = false,
  id,
  label,
  model,
  onSelect,
  placeholder,
}: ContextualPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const selected = model.selected;
  const selectedExplanationId =
    selected?.explanation === undefined ? undefined : `${id}-selected-explanation`;
  const collapsible = model.sections.find((section) => section.collapsible);
  const ordinarySections = model.sections.filter((section) => !section.collapsible);

  function select(item: ContextualPickerItem<T>): void {
    if (item.disabled) {
      return;
    }
    onSelect(item.value);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="field-control contextual-picker">
      <label htmlFor={id}>{label}</label>
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery('');
            setCollapsibleOpen(false);
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            aria-describedby={selectedExplanationId}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={selected?.state === 'impossible' || undefined}
            className="contextual-picker-trigger"
            data-candidate-state={selected?.state ?? 'unspecified'}
            disabled={disabled}
            id={id}
            type="button"
          >
            <span>{disabled ? placeholder : (selected?.label ?? placeholder)}</span>
            <span className="contextual-picker-trigger-icon" aria-hidden="true">
              ▾
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            className="contextual-picker-popover"
            collisionPadding={12}
            sideOffset={6}
          >
            <Command label={`${label} choices`} shouldFilter={true}>
              <Command.Input
                aria-label={`Search ${label.toLowerCase()} choices`}
                onValueChange={setQuery}
                placeholder={`Search ${label.toLowerCase()}...`}
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

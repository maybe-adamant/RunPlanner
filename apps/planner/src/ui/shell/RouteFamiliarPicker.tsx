import type { Catalog } from '@run-planner/engine/catalog-schema';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';

/** The mature profile's starting familiar, with every stat upgrade owned. */
export function RouteFamiliarPicker({
  catalog,
  familiarKey,
  id,
  onSelect,
}: {
  readonly catalog: Catalog;
  readonly familiarKey: string;
  readonly id: string;
  readonly onSelect: (familiarKey: string) => void;
}) {
  const items = catalog.familiars.values.map((choice) => ({
    key: choice.key,
    value: choice.key,
    label: choice.label,
    state: 'possible' as const,
    selected: choice.key === familiarKey,
    disabled: false,
  }));
  return (
    <ContextualPicker
      id={id}
      label="Starting familiar"
      layout="inline"
      model={{
        sections: [
          { key: 'familiars', kind: 'category', label: 'Familiar', collapsible: false, items },
        ],
      }}
      onSelect={onSelect}
      placeholder="Choose a familiar"
      triggerLabel={catalog.familiars.byKey[familiarKey]?.label ?? familiarKey}
    />
  );
}

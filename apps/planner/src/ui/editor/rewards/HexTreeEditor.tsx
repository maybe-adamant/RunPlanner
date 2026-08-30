import type { AuthoredHexTreeConfiguration } from '@run-planner/engine/authored-project';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import { useState } from 'react';

import type { WorkspaceHexTreeDomain } from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

function replaceAt(values: readonly string[], index: number, value: string): readonly string[] {
  return Object.freeze(values.map((current, position) => (position === index ? value : current)));
}

function HexTalentGroupPicker({
  address,
  kind,
  pickerFor,
  selectedKeys,
  onChange,
}: {
  readonly address: SemanticAddress;
  readonly kind: 'Rare' | 'Epic';
  readonly pickerFor: WorkspaceHexTreeDomain['rarePickerFor'];
  readonly selectedKeys: readonly string[];
  readonly onChange: (values: readonly string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [draft, setDraft] = useState(selectedKeys);

  if (selectedKeys.length === 0) {
    return null;
  }

  const activeKeys = open ? draft : selectedKeys;
  const activeSelected = activeKeys[activeIndex] ?? activeKeys[0];
  const picker = pickerFor(activeKeys, activeSelected);
  const selectedLabels = selectedKeys.map(
    (selected) => pickerFor(selectedKeys, selected).selected?.label ?? selected,
  );

  function changeOpen(nextOpen: boolean): void {
    setOpen(nextOpen);
    setActiveIndex(0);
    setDraft(selectedKeys);
  }

  function select(value: string): void {
    const nextDraft = replaceAt(draft, activeIndex, value);
    const nextIndex = activeIndex + 1;
    if (nextIndex === selectedKeys.length) {
      onChange(nextDraft);
      setDraft(nextDraft);
      setActiveIndex(0);
      setOpen(false);
      return;
    }
    setDraft(nextDraft);
    setActiveIndex(nextIndex);
  }

  return (
    <ContextualPicker
      ariaLabel={`${kind} Hex nodes`}
      cancelLabel="Cancel"
      choiceLabel={`${kind} node ${activeIndex + 1} of ${selectedKeys.length}`}
      closeOnSelect={false}
      id={`${semanticOwnerControlElementId(address)}-${kind.toLowerCase()}-nodes`}
      label={`${kind} Nodes`}
      layout="inline"
      model={picker}
      onOpenChange={changeOpen}
      onSelect={select}
      open={open}
      placeholder={`Choose ${kind.toLowerCase()} nodes`}
      triggerLabel={selectedLabels.join(', ')}
    />
  );
}

export function HexTreeEditor({
  domain,
  address,
  transitionFor,
  onChange,
}: {
  readonly domain: WorkspaceHexTreeDomain;
  readonly address: SemanticAddress;
  readonly transitionFor: (
    layoutKey: import('@run-planner/engine/catalog-schema').HexLayoutKey,
  ) => AuthoredHexTreeConfiguration;
  readonly onChange: (value: AuthoredHexTreeConfiguration) => void;
}) {
  const tree = domain.value;
  const layout = tree.layoutKey;
  return (
    <fieldset className="trait-circe-resolution">
      <legend>Hex talent layout</legend>
      <ContextualPicker
        ariaLabel="Hex talent layout"
        id={`${semanticOwnerControlElementId(address)}-layout`}
        label="Layout"
        layout="inline"
        model={domain.layoutPicker}
        onSelect={(layoutKey) => onChange(transitionFor(layoutKey))}
        placeholder="Choose a layout"
        triggerLabel={domain.layoutPicker.selected?.label ?? layout}
      />
      <HexTalentGroupPicker
        address={address}
        key={`${layout}-rare`}
        kind="Rare"
        onChange={(rareTalentKeys) => onChange({ ...tree, rareTalentKeys })}
        pickerFor={domain.rarePickerFor}
        selectedKeys={tree.rareTalentKeys}
      />
      <HexTalentGroupPicker
        address={address}
        key={`${layout}-epic`}
        kind="Epic"
        onChange={(epicTalentKeys) => onChange({ ...tree, epicTalentKeys })}
        pickerFor={domain.epicPickerFor}
        selectedKeys={tree.epicTalentKeys}
      />
      <p className="hex-god-sent">
        <strong>God Sent:</strong> {domain.godSent.olympianTalentLabel}
      </p>
    </fieldset>
  );
}

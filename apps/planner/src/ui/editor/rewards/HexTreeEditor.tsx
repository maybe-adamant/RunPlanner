import type { AuthoredHexTreeConfiguration } from '@run-planner/engine/authored-project';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import type { WorkspaceHexTreeDomain } from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

function replaceAt(values: readonly string[], index: number, value: string): readonly string[] {
  return Object.freeze(values.map((current, position) => (position === index ? value : current)));
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
        model={domain.layoutPicker}
        onSelect={(layoutKey) => onChange(transitionFor(layoutKey))}
        placeholder="Choose a layout"
        triggerLabel={domain.layoutPicker.selected?.label ?? layout}
      />
      <p className="trait-selected-outcome-detail">
        Choose the Rare and Epic identities present in this layout. The linked God Sent talent is
        derived by chronology.
      </p>
      {tree.rareTalentKeys.map((selected, index) => (
        <ContextualPicker
          ariaLabel={`Rare Hex node ${index + 1}`}
          id={`${semanticOwnerControlElementId(address)}-rare-${index + 1}`}
          key={`rare-${index}`}
          label={`Rare node ${index + 1}`}
          model={domain.rarePickerFor(tree.rareTalentKeys, selected)}
          onSelect={(value) =>
            onChange({ ...tree, rareTalentKeys: replaceAt(tree.rareTalentKeys, index, value) })
          }
          placeholder="Choose a Rare node"
          triggerLabel={
            domain.rarePickerFor(tree.rareTalentKeys, selected).selected?.label ?? selected
          }
        />
      ))}
      {tree.epicTalentKeys.map((selected, index) => (
        <ContextualPicker
          ariaLabel={`Epic Hex node ${index + 1}`}
          id={`${semanticOwnerControlElementId(address)}-epic-${index + 1}`}
          key={`epic-${index}`}
          label={`Epic node ${index + 1}`}
          model={domain.epicPickerFor(tree.epicTalentKeys, selected)}
          onSelect={(value) =>
            onChange({ ...tree, epicTalentKeys: replaceAt(tree.epicTalentKeys, index, value) })
          }
          placeholder="Choose an Epic node"
          triggerLabel={
            domain.epicPickerFor(tree.epicTalentKeys, selected).selected?.label ?? selected
          }
        />
      ))}
      <div className="trait-selected-outcome-detail">
        <strong>God Sent</strong>: {domain.godSent.olympianTalentLabel} +{' '}
        {domain.godSent.lineageTalentLabel} ({domain.godSent.providerKey})
      </div>
    </fieldset>
  );
}

import { useState } from 'react';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { aspectArtwork } from '@planner/ui/controls/aspects/aspectArtwork';
import { slotLoadoutLabel } from '@planner/projections/gameSlotSummary';

export function RouteWeaponPicker({
  catalog,
  id,
  weaponKey,
  aspectKey,
  onSelect,
}: {
  readonly catalog: Catalog;
  readonly id: string;
  readonly weaponKey: string;
  readonly aspectKey: string;
  readonly onSelect: (weaponKey: string, aspectKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pendingWeaponKey, setPendingWeaponKey] = useState<string>();
  const pendingWeapon =
    pendingWeaponKey === undefined ? undefined : catalog.weapons.byKey[pendingWeaponKey]!;
  const choices =
    pendingWeapon === undefined
      ? catalog.weapons.values
      : pendingWeapon.aspectKeys.map((key) => catalog.aspects.byKey[key]!);
  const items = choices.map((choice) => ({
    key: choice.key,
    value: choice.key,
    label: choice.label,
    state: 'possible' as const,
    selected: choice.key === (pendingWeapon === undefined ? weaponKey : aspectKey),
    disabled: false,
  }));

  return (
    <ContextualPicker
      id={id}
      label="Starting weapon"
      layout="inline"
      placeholder="Choose weapon and aspect"
      // The closed trigger uses the short form, such as "Staff · Melinoë"; the list keeps full names.
      triggerLabel={slotLoadoutLabel(catalog, weaponKey, aspectKey)}
      triggerIcon={aspectArtwork[aspectKey]}
      // A weapon shows its default aspect's icon.
      itemIcon={(item) =>
        aspectArtwork[
          pendingWeapon === undefined ? catalog.weapons.byKey[item.key]!.defaultAspectKey : item.key
        ]
      }
      triggerSizingLabels={catalog.weapons.values.flatMap((option) =>
        option.aspectKeys.map((key) => slotLoadoutLabel(catalog, option.key, key)),
      )}
      choiceLabel={pendingWeapon === undefined ? 'Weapon' : `${pendingWeapon.label} · Aspect`}
      open={open}
      closeOnSelect={false}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setPendingWeaponKey(undefined);
      }}
      model={{
        sections: [
          {
            key: pendingWeapon === undefined ? 'weapons' : 'aspects',
            kind: 'category',
            label: pendingWeapon === undefined ? 'Weapon' : 'Aspect',
            collapsible: false,
            items,
          },
        ],
      }}
      onSelect={(key) => {
        if (pendingWeapon === undefined) {
          setPendingWeaponKey(key);
          return;
        }
        onSelect(pendingWeapon.key, key);
        setOpen(false);
        setPendingWeaponKey(undefined);
      }}
    />
  );
}

import { useState } from 'react';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';

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
  const weapon = catalog.weapons.byKey[weaponKey]!;
  const aspect = catalog.aspects.byKey[aspectKey]!;
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
      triggerLabel={`${weapon.label} · ${aspect.label}`}
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

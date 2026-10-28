import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';

import { cloneCatalogInput, requireRoom } from './support/catalog-input';

describe('screen reroll declarations', () => {
  it('declares which trait givers offer a natively rerollable screen', () => {
    expect(
      Object.fromEntries(
        catalog.traitGivers.values.map((giver) => [giver.key, giver.screenReroll]),
      ),
    ).toEqual({
      Aphrodite: true,
      Apollo: true,
      Ares: true,
      Demeter: true,
      Hephaestus: true,
      Hera: true,
      Hestia: true,
      Poseidon: true,
      Zeus: true,
      Hermes: true,
      Athena: true,
      Dionysus: true,
      Artemis: true,
      Hades: true,
      Chaos: true,
      Arachne: false,
      Icarus: false,
      Medea: false,
      Narcissus: false,
      Circe: false,
      Echo: false,
      WeaponUpgrade: false,
      SpellDrop: false,
    });
  });

  it('declares the giverless Pom of Power screens and the shop screens', () => {
    expect(
      catalog.rewards.rewardTypes.values
        .filter((rewardType) => rewardType.screenReroll === true)
        .map((rewardType) => rewardType.gameName),
    ).toEqual(['StackUpgrade', 'StackUpgradeBig', 'StackUpgradeTriple']);
    expect(
      Object.fromEntries(catalog.rewards.shops.values.map((shop) => [shop.key, shop.screenReroll])),
    ).toEqual({
      ZagPedestalOptions: false,
      RoomShop: true,
      SurfaceShop: false,
      WorldShop: false,
      I_WorldShop: false,
      Q_WorldShop: false,
    });
  });

  it('requires an explicit screen reroll flag', () => {
    const giverInput = cloneCatalogInput();
    const givers = giverInput.traitCatalog.givers.map((giver) =>
      giver.key === 'Hades' ? { ...giver, screenReroll: undefined } : giver,
    );
    expect(() =>
      createCatalog({
        ...giverInput,
        traitCatalog: { ...giverInput.traitCatalog, givers },
      } as typeof giverInput),
    ).toThrow('screenReroll');
    const shopInput = cloneCatalogInput();
    const shops = shopInput.rewardKernel.shops.map((shop) =>
      shop.key === 'RoomShop' ? { ...shop, screenReroll: 'yes' } : shop,
    );
    expect(() =>
      createCatalog({
        ...shopInput,
        rewardKernel: { ...shopInput.rewardKernel, shops },
      } as typeof shopInput),
    ).toThrow('screenReroll');
    const poolInput = cloneCatalogInput();
    const room = requireRoom(poolInput, 'F_PostBoss01');
    Object.assign(room, { purgingPool: { ...room.purgingPool, screenReroll: undefined } });
    expect(() => createCatalog(poolInput)).toThrow('purgingPool.screenReroll');
  });
});

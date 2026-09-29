import { describe, expect, it } from 'vitest';

import { createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import { cloneCatalogInput, requireRoom } from './support/catalog-input';

function withGIntroHost(host: Record<string, unknown>) {
  const raw = cloneCatalogInput();
  const room = requireRoom(raw, 'G_Intro') as unknown as Record<string, unknown>;
  room.erisHost = { ...(room.erisHost as Record<string, unknown>), ...host };
  return raw;
}

describe('Fresh File Eris declarations', () => {
  const catalog = createCatalog(declarations);

  it('hosts Eris on the three Fresh File biome intros with their gifts', () => {
    const hosts = catalog.rooms.values.flatMap((room) =>
      room.erisHost === undefined ? [] : [[room.gameName, room.erisHost] as const],
    );
    const host = (giftRewardType: string) => ({
      routeKey: 'FreshFile',
      curseTraitKey: 'ErisCurseTrait',
      giftRewardType,
      producerLifecycleKey: 'ErisCursePickup',
    });
    expect(hosts).toEqual([
      ['G_Intro', host('MetaCardPointsCommonDrop')],
      ['H_Intro', host('MemPointsCommonDrop')],
      ['I_Intro', host('MetaCurrencyDrop')],
    ]);
  });

  it('declares the curse as a rarityless trait nobody offers', () => {
    expect(catalog.traits.byKey.ErisCurseTrait?.rarityDomain).toEqual({ kind: 'none' });
    expect(
      catalog.traitGivers.values.filter((giver) => giver.traitKeys.includes('ErisCurseTrait')),
    ).toEqual([]);
  });

  it('rejects a host on an unknown route, with an unsupported gift or a ranked curse', () => {
    expect(() => createCatalog(withGIntroHost({ routeKey: 'Nowhere' }))).toThrow(
      /rooms\[\d+\]\.erisHost\.routeKey: unknown route Nowhere/,
    );
    expect(() => createCatalog(withGIntroHost({ giftRewardType: 'MaxHealthDrop' }))).toThrow(
      /erisHost\.giftRewardType: ErisCursePickup does not produce MaxHealthDrop/,
    );
    expect(() => createCatalog(withGIntroHost({ producerLifecycleKey: 'Missing' }))).toThrow(
      /erisHost\.producerLifecycleKey: unknown producer lifecycle Missing/,
    );
    expect(() => createCatalog(withGIntroHost({ curseTraitKey: 'ApolloWeaponBoon' }))).toThrow(
      /erisHost\.curseTraitKey: ApolloWeaponBoon must be a rarityless trait/,
    );
  });

  it('rejects a host outside an Intro room', () => {
    const raw = cloneCatalogInput();
    const room = requireRoom(raw, 'G_Combat01') as unknown as Record<string, unknown>;
    room.erisHost = {
      routeKey: 'FreshFile',
      curseTraitKey: 'ErisCurseTrait',
      giftRewardType: 'MetaCardPointsCommonDrop',
      producerLifecycleKey: 'ErisCursePickup',
    };
    expect(() => createCatalog(raw)).toThrow(/erisHost: requires an Intro room/);
  });
});

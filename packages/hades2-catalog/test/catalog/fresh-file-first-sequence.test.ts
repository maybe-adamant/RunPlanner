import { describe, expect, it } from 'vitest';

import { createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import { cloneCatalogInput, requireRoom } from './support/catalog-input';

const apolloBoon = {
  rewardType: 'Boon',
  payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
} as const;

type MutableRoom = Record<string, unknown> & { incomingReward: Record<string, unknown> };

function withCombat01(mutate: (room: MutableRoom) => void) {
  const raw = cloneCatalogInput();
  mutate(requireRoom(raw, 'F_Combat01') as unknown as MutableRoom);
  return raw;
}

describe('Fresh File first sequence declarations', () => {
  const catalog = createCatalog(declarations);
  const combat01 = catalog.rooms.byKey.F_Combat01!;

  it('declares FIntroFight as a fixed combat that does not count encounter depth', () => {
    expect(catalog.encounterDefinitions.byKey.FIntroFight).toMatchObject({
      kind: 'combat',
      countsEncounterDepth: false,
      canEncounterSkip: false,
      hostsGorgon: true,
    });
    expect(catalog.encounterDefinitions.byKey.FIntroFight?.customization).toBeUndefined();
  });

  it('resolves F_Combat01 to FIntroFight at the first Fresh File biome only', () => {
    expect(combat01.entryContextualEncounterRules).toEqual([
      { routeKey: 'FreshFile', position: 'first', encounterDefinitionKey: 'FIntroFight' },
    ]);
    expect(combat01.encounterSlotBindings).toEqual([
      { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'GeneratedF' },
    ]);
  });

  it('forces F_Combat01 on Fresh File without replacing its eligibility', () => {
    expect(combat01.force).toEqual({
      kind: 'requirement',
      requirement: { kind: 'routeKeyEquals', routeKey: 'FreshFile' },
    });
    expect(combat01.eligibility).toEqual({
      kind: 'counterRange',
      axis: 'biomeEncounterDepth',
      range: { max: 5 },
    });
  });

  it('declares the Apollo ForcedRewards entry while Apollo is unused on the save', () => {
    expect(combat01.incomingReward).toMatchObject({
      kind: 'countedChoice',
      storeKeys: ['RunProgress'],
      forcedRewards: [
        {
          offer: apolloBoon,
          requirement: {
            kind: 'recordCount',
            record: 'lifetimeGodUseRecord',
            keys: ['ApolloUpgrade'],
            range: { max: 0 },
          },
        },
      ],
    });
    const forced = catalog.rooms.values.filter(
      (room) => room.incomingReward.kind === 'countedChoice' && room.incomingReward.forcedRewards,
    );
    expect(forced.map((room) => room.gameName)).toEqual(['F_Combat01']);
  });

  it('rejects a forced reward outside the producer domain or with an invalid payload', () => {
    const forced = (offer: unknown) =>
      withCombat01((room) => {
        room.incomingReward.forcedRewards = [{ offer }];
      });
    expect(() => createCatalog(forced({ rewardType: 'Devotion' }))).toThrow(
      /forcedRewards\[0\]\.offer\.rewardType.*not allowed/,
    );
    expect(() =>
      createCatalog(
        forced({ rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'Missing' } }),
      ),
    ).toThrow(/forcedRewards\[0\]\.offer\.payload/);
  });

  it('declares the first-run Apollo offer as the Common ForceLootTableFirstRun trio', () => {
    expect(combat01.firstRunOffer).toEqual({
      routeKey: 'FreshFile',
      traitKeys: ['ApolloWeaponBoon', 'ApolloSprintBoon', 'ApolloManaBoon'],
      rarity: 'Common',
    });
    expect(
      catalog.rooms.values
        .filter((room) => room.firstRunOffer !== undefined)
        .map((room) => room.gameName),
    ).toEqual(['F_Combat01']);
  });

  it('rejects a first-run rule on an unknown route, a foreign trait or without a forced boon', () => {
    const rule = (patch: Record<string, unknown>) =>
      withCombat01((room) => {
        room.firstRunOffer = { ...(room.firstRunOffer as object), ...patch };
      });
    expect(() => createCatalog(rule({ routeKey: 'Missing' }))).toThrow(/unknown route Missing/);
    expect(() => createCatalog(rule({ traitKeys: ['ZeusWeaponBoon'] }))).toThrow(
      /Apollo does not give ZeusWeaponBoon/,
    );
    expect(() => createCatalog(rule({ traitKeys: ['ApolloRetaliateBoon'] }))).toThrow(
      /ApolloRetaliateBoon is not a Apollo priority trait/,
    );
    expect(() => createCatalog(rule({ rarity: 'Rare' }))).toThrow(/rarity.*must be Common/);
    expect(() =>
      createCatalog(
        withCombat01((room) => {
          delete room.incomingReward.forcedRewards;
        }),
      ),
    ).toThrow(/requires a forced Boon incoming reward/);
  });
});

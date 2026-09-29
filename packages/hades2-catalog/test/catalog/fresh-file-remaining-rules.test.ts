import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import { cloneCatalogInput, requireRoom } from './support/catalog-input';

type MutableRecord = Record<string, unknown>;

function combatProfile(input: ReturnType<typeof cloneCatalogInput>, setKey: string) {
  const set = input.encounterSets.find((candidate) => candidate.key === setKey);
  const profile = set?.authoringProfiles?.[0] as unknown as
    { resolution: MutableRecord; encounterDefinitionKeys: string[] } | undefined;
  if (profile === undefined) throw new Error(`missing ${setKey} combat choice`);
  return profile;
}

describe('Fresh File remaining-rule declarations', () => {
  const catalog = createCatalog(declarations);

  it('declares the two forced biome intros as fixed-wave combats', () => {
    expect(catalog.encounterDefinitions.byKey.FishmanIntro).toMatchObject({
      kind: 'combat',
      countsEncounterDepth: false,
      canEncounterSkip: false,
      hostsGorgon: true,
      blocksGorgon: false,
    });
    expect(catalog.encounterDefinitions.byKey.ClockworkIntro).toMatchObject({
      kind: 'combat',
      countsEncounterDepth: true,
      canEncounterSkip: false,
      hostsGorgon: false,
      blocksGorgon: true,
    });
    for (const key of ['FishmanIntro', 'ClockworkIntro'])
      expect(catalog.encounterDefinitions.byKey[key]?.customization).toBeUndefined();
  });

  it('keys the first-biome intro by route beside the mature default', () => {
    const resolution = (setKey: string) =>
      catalog.encounterSets.byKey[setKey]!.authoringProfiles[0]!.resolution;
    expect(resolution('GEncountersDefault')).toMatchObject({
      firstBiomeEncounterDefinitionKeyByRoute: { FreshFile: 'FishmanIntro' },
    });
    expect(resolution('GEncountersDefault')).not.toHaveProperty('firstBiomeEncounterDefinitionKey');
    expect(resolution('IEncountersDefault')).toMatchObject({
      firstBiomeEncounterDefinitionKey: 'GeneratedIChronosIntro',
      firstBiomeEncounterDefinitionKeyByRoute: { FreshFile: 'ClockworkIntro' },
    });
    expect(resolution('IEncountersSmaller')).toMatchObject({
      firstBiomeEncounterDefinitionKey: 'GeneratedI_SmallChronosIntro',
      firstBiomeEncounterDefinitionKeyByRoute: { FreshFile: 'ClockworkIntro' },
    });
  });

  it('rejects a route-keyed intro outside the choice or on an undeclared route', () => {
    const outside = cloneCatalogInput();
    const profile = combatProfile(outside, 'GEncountersDefault');
    profile.encounterDefinitionKeys = profile.encounterDefinitionKeys.filter(
      (key) => key !== 'FishmanIntro',
    );
    expect(() => createCatalog(outside)).toThrow(CatalogContractError);
    const unknownRoute = cloneCatalogInput();
    combatProfile(
      unknownRoute,
      'GEncountersDefault',
    ).resolution.firstBiomeEncounterDefinitionKeyByRoute = { Nowhere: 'FishmanIntro' };
    expect(() => createCatalog(unknownRoute)).toThrow(/unknown route Nowhere/);
  });

  it('overlays H_Bridge01 as the WorldShop on Fresh File, keeping its force and caps', () => {
    const bridge = catalog.rooms.byKey.H_Bridge01!;
    expect(bridge).toMatchObject({ kind: 'Story', lifecycleProfileKey: 'StoryPickupRoom' });
    expect(bridge.routeOverlays).toEqual([
      {
        routeKey: 'FreshFile',
        label: 'Shop',
        kind: 'Shop',
        mode: { kind: 'authored', templateKey: 'Shop' },
        incomingReward: {
          kind: 'shop',
          rewardType: 'Shop',
          shopProfileKey: 'WorldShop',
          producerLifecycleKey: 'RoomReward',
        },
        offerRewardBinding: { kind: 'none' },
        encounterSlotBindings: [
          { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'BridgeShop' },
        ],
      },
    ]);
    expect(bridge.force).toEqual({ kind: 'always' });
    expect(bridge.caps).toEqual({ maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 });
    expect(catalog.encounterDefinitions.byKey.BridgeShop).toMatchObject({
      kind: 'nonCombat',
      countsEncounterDepth: false,
      hostsNpcShoppingEvents: true,
    });
  });

  it('rejects an overlay whose realized room breaks a room contract or repeats a route', () => {
    const repeated = cloneCatalogInput();
    const bridge = requireRoom(repeated, 'H_Bridge01') as unknown as {
      routeOverlays: MutableRecord[];
    };
    bridge.routeOverlays = [bridge.routeOverlays[0]!, bridge.routeOverlays[0]!];
    expect(() => createCatalog(repeated)).toThrow(/must name each route once/);
    const unknownEncounter = cloneCatalogInput();
    const overlay = (
      requireRoom(unknownEncounter, 'H_Bridge01') as unknown as {
        routeOverlays: MutableRecord[];
      }
    ).routeOverlays[0]!;
    overlay.encounterSlotBindings = [
      { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'NoSuchEncounter' },
    ];
    expect(() => createCatalog(unknownEncounter)).toThrow(CatalogContractError);
  });

  it('rejects an overlay on an undeclared route or one that changes any other room fact', () => {
    const overlayOf = (input: ReturnType<typeof cloneCatalogInput>) =>
      (requireRoom(input, 'H_Bridge01') as unknown as { routeOverlays: MutableRecord[] })
        .routeOverlays[0]!;
    const unknownRoute = cloneCatalogInput();
    overlayOf(unknownRoute).routeKey = 'Nowhere';
    expect(() => createCatalog(unknownRoute)).toThrow(/unknown route Nowhere/);
    const uncapped = cloneCatalogInput();
    overlayOf(uncapped).caps = { maxAppearancesThisBiome: 2 };
    expect(() => createCatalog(uncapped)).toThrow(
      /may change only the room kind, template, reward binding and encounter/,
    );
  });

  it('excludes Fresh File from every Nectar random-level effect', () => {
    for (const producer of catalog.rewards.producerLifecycles.values) {
      const effect =
        producer.rewardTypes.byKey.GiftDrop?.acquisitionLifecycle[0]?.levelResolutionEffect;
      if (effect === undefined) continue;
      expect(effect, producer.key).toEqual({
        kind: 'randomTargetIfAvailable',
        levelCount: 1,
        excludedRouteKeys: ['FreshFile'],
      });
    }
  });
});

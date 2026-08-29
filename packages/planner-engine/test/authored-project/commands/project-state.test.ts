import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createProjectDocument,
  createProjectHistory,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeFieldAddress,
  createBiomeAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createRouteAddress,
  decodeProjectDocument,
  deriveRouteLoadout,
  encodeProjectDocument,
  hermesShrineDeliveryEntryKey,
  createTraitOfferAddress,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  redoProjectHistory,
  undoProjectHistory,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';

import { fBiome, fProject, iBiome, iProject } from '../support/configured-projects';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';

describe('authored-project project-state commands', () => {
  it('adds and removes an ordinary Shrine shell atomically without admitting forced hosts', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const forcedOccurrence = createOccurrenceAddress(
      oBiome,
      createOccurrenceId('surface-o-preboss:postboss'),
    );
    const seeded = loadSurfaceNOProject();
    expect(
      seeded.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'O')
        ?.topology?.occurrences.some(
          (candidate) => candidate.occurrenceId === forcedOccurrence.occurrenceId,
        ),
    ).toBe(true);
    const occurrenceState = (project: ReturnType<typeof loadSurfaceNOProject>) =>
      project.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'O')
        ?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        );
    const present = applyProjectCommand(seeded, catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence,
      present: true,
    });
    const withShrine = occurrenceState(present);
    expect(withShrine?.hermesShrine?.offerBySlot).toEqual({
      first: null,
      secondLeft: null,
      secondRight: null,
    });
    const offered = applyProjectCommand(present, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence,
      slotKey: 'first',
      value: { rewardType: 'HealBigDrop' },
    });
    const purchased = applyProjectCommand(offered, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence,
      generationKey: 'initial:first',
      purchase: { delay: 2, rushed: false },
    });
    const removed = applyProjectCommand(purchased, catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence,
      present: false,
    });
    const withoutShrine = occurrenceState(removed);
    expect(withoutShrine?.hermesShrine).toBeUndefined();
    expect(
      withoutShrine?.roomActions.order.some(
        (reference) => reference.kind === 'interactAcquisitionEntry',
      ),
    ).toBe(false);
    expect(() =>
      applyProjectCommand(seeded, catalog, {
        kind: 'SetHermesShrinePresence',
        occurrence: forcedOccurrence,
        present: false,
      }),
    ).toThrow(ProjectCommandContractError);
  });

  it('keeps Shrine purchase membership and detail in one semantic command while rejecting malformed input', () => {
    const biome = createBiomeAddress('Surface', 'N');
    const occurrence = createOccurrenceAddress(
      biome,
      createOccurrenceId('surface-n-preboss:postboss'),
    );
    const seeded = loadSurfaceNOProject();
    const offered = applyProjectCommand(seeded, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence,
      slotKey: 'first',
      value: { rewardType: 'HealBigDrop' },
    });
    const purchased = applyProjectCommand(offered, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence,
      generationKey: 'initial:first',
      purchase: { delay: 2, rushed: false },
    });
    const postboss = purchased.routes
      .find((candidate) => candidate.routeKey === 'Surface')
      ?.biomes[0]?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === 'surface-n-preboss:postboss',
      );
    expect(postboss?.hermesShrine?.purchaseBySlot?.first).toEqual({ delay: 2, rushed: false });
    expect(postboss?.roomActions.order).not.toContainEqual(
      expect.objectContaining({ siteKey: 'hermesShrineDelivery' }),
    );
    expect(() =>
      applyProjectCommand(offered, catalog, {
        kind: 'SetHermesShrinePurchase',
        occurrence,
        generationKey: 'bad' as never,
        purchase: { delay: 9 as never, rushed: 'no' as never },
      }),
    ).toThrow(ProjectCommandContractError);
    const refilled = applyProjectCommand(offered, catalog, {
      kind: 'ReplaceHermesShrineTravelDealRefill',
      occurrence,
      // Refill group is prefix-derived. A second-group retained value is
      // structurally editable and candidate evaluation owns its repair.
      value: { rewardType: 'SpellDrop' },
    });
    const refillPurchased = applyProjectCommand(refilled, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence,
      generationKey: 'travelDealRefill',
      purchase: { delay: 2, rushed: false },
    });
    const refillCleared = applyProjectCommand(refillPurchased, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence,
      generationKey: 'travelDealRefill',
      purchase: null,
    });
    const clearedPostboss = refillCleared.routes
      .find((candidate) => candidate.routeKey === 'Surface')
      ?.biomes[0]?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === 'surface-n-preboss:postboss',
      );
    expect(clearedPostboss?.hermesShrine?.travelDealRefill).toMatchObject({
      offer: { rewardType: 'SpellDrop' },
    });
    expect(clearedPostboss?.hermesShrine?.travelDealRefill?.purchase).toBeUndefined();
    expect(clearedPostboss?.roomActions.order).not.toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey: hermesShrineDeliveryEntryKey(occurrence, 'travelDealRefill'),
    });
    expect(() =>
      applyProjectCommand(refilled, catalog, {
        kind: 'SetHermesShrinePurchase',
        occurrence,
        generationKey: 'travelDealRefill',
        purchase: { delay: 2, rushed: true },
      }),
    ).toThrow(ProjectCommandContractError);
    const second = applyProjectCommand(seeded, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence,
      slotKey: 'secondLeft',
      value: { rewardType: 'MaxHealthDrop' },
    });
    expect(
      applyProjectCommand(second, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence,
        slotKey: 'secondRight',
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toBeDefined();
  });

  it('rejects malformed Shrine purchase closure in completion and ordinary persisted rooms', () => {
    const completionBiome = createBiomeAddress('Surface', 'N');
    const completionOccurrence = createOccurrenceAddress(
      completionBiome,
      createOccurrenceId('surface-n-preboss:postboss'),
    );
    const completion = applyProjectCommand(
      applyProjectCommand(loadSurfaceNOProject(), catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: completionOccurrence,
        slotKey: 'first',
        value: { rewardType: 'HealBigDrop' },
      }),
      catalog,
      {
        kind: 'SetHermesShrinePurchase',
        occurrence: completionOccurrence,
        generationKey: 'initial:first',
        purchase: { delay: 2, rushed: true },
      },
    );
    const ordinaryOccurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const ordinary = applyProjectCommand(
      applyProjectCommand(
        applyProjectCommand(loadSurfaceNOProject(), catalog, {
          kind: 'SetHermesShrinePresence',
          occurrence: ordinaryOccurrence,
          present: true,
        }),
        catalog,
        {
          kind: 'ReplaceHermesShrineOffer',
          occurrence: ordinaryOccurrence,
          slotKey: 'first',
          value: { rewardType: 'HealBigDrop' },
        },
      ),
      catalog,
      {
        kind: 'SetHermesShrinePurchase',
        occurrence: ordinaryOccurrence,
        generationKey: 'initial:first',
        purchase: { delay: 2, rushed: true },
      },
    );
    const mutate = (
      document: Record<string, unknown>,
      occurrenceId: string,
      mutateOccurrence: (occurrence: Record<string, unknown>) => void,
    ) => {
      const routes = document.routes as Record<string, unknown>[];
      for (const route of routes) {
        for (const biome of route.biomes as Record<string, unknown>[]) {
          const topology = biome.topology as Record<string, unknown> | null;
          const occurrences =
            (topology?.occurrences as Record<string, unknown>[] | undefined) ?? [];
          const occurrence = occurrences.find(
            (candidate) => candidate.occurrenceId === occurrenceId,
          );
          if (occurrence !== undefined) {
            mutateOccurrence(occurrence);
            return;
          }
        }
      }
      throw new Error(`missing encoded ${occurrenceId}`);
    };
    for (const [name, project, occurrenceId] of [
      ['completion', completion, completionOccurrence.occurrenceId],
      ['ordinary', ordinary, ordinaryOccurrence.occurrenceId],
    ] as const) {
      const detailWithoutAction = JSON.parse(encodeProjectDocument(project)) as Record<
        string,
        unknown
      >;
      mutate(detailWithoutAction, occurrenceId, (occurrence) => {
        (occurrence.roomActions as { order: unknown[] }).order = [];
      });
      expect(() => decodeProjectDocument(detailWithoutAction, catalog), name).toThrow(
        'rushed Shrine purchases must have exactly one matching delivery action',
      );

      const actionWithoutDetail = JSON.parse(encodeProjectDocument(project)) as Record<
        string,
        unknown
      >;
      mutate(actionWithoutDetail, occurrenceId, (occurrence) => {
        delete (occurrence.hermesShrine as Record<string, unknown>).purchaseBySlot;
      });
      expect(() => decodeProjectDocument(actionWithoutDetail, catalog), name).toThrow(
        'rushed Shrine purchases must have exactly one matching delivery action',
      );
    }
    for (const [name, project, occurrenceId] of [
      ['completion', completion, completionOccurrence.occurrenceId],
      ['ordinary', ordinary, ordinaryOccurrence.occurrenceId],
    ] as const) {
      const nullRefillPurchase = JSON.parse(encodeProjectDocument(project)) as Record<
        string,
        unknown
      >;
      mutate(nullRefillPurchase, occurrenceId, (occurrence) => {
        const shrine = occurrence.hermesShrine as Record<string, unknown>;
        shrine.travelDealRefill = {
          offer: null,
          purchase: { delay: 2, rushed: false },
        };
      });
      expect(() => decodeProjectDocument(nullRefillPurchase, catalog), name).toThrow(
        'requires a resolved source offer',
      );
    }
  });

  it('materializes GiftDrop Pom state at rushed Shrine acquisition rather than inventory selection', () => {
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('surface-n-preboss:postboss'),
    );
    const seeded = loadSurfaceNOProject();
    const inventoryAuthored = applyProjectCommand(seeded, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence,
      slotKey: 'first',
      value: { rewardType: 'GiftDrop' },
    });
    const authored = applyProjectCommand(inventoryAuthored, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence,
      generationKey: 'initial:first',
      purchase: { delay: 2, rushed: true },
    });
    const occurrenceState = authored.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes[0]?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
      );
    expect(occurrenceState?.hermesShrine?.offerBySlot.first).toEqual({ rewardType: 'GiftDrop' });
    const entryKey = hermesShrineDeliveryEntryKey(occurrence, 'initial:first');
    expect(occurrenceState?.roomActions.order).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey,
    });
    expect(
      occurrenceState?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey]
        ?.levelResolutionsByAcquisitionRole?.self,
    ).toEqual({
      kind: 'random',
      targetTraitKey: null,
    });
    const roundTripped = decodeProjectDocument(
      JSON.parse(encodeProjectDocument(authored)),
      catalog,
    );
    expect(
      roundTripped.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes[0]?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        )?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey]
        ?.levelResolutionsByAcquisitionRole?.self,
    ).toEqual({ kind: 'random', targetTraitKey: null });
  });

  it('authors a rushed Shrine Mystery Boon source and its hidden trait offer at acquisition', () => {
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('surface-n-preboss:postboss'),
    );
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence,
      slotKey: 'secondLeft',
      value: { rewardType: 'BlindBoxLoot' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence,
      generationKey: 'initial:secondLeft',
      purchase: { delay: 2, rushed: true },
    });
    const entryKey = hermesShrineDeliveryEntryKey(occurrence, 'initial:secondLeft');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(occurrence, 'hermesShrineDelivery'),
      entryKey,
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    const offer: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    };
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(entry, 'hiddenSource'),
      value: offer,
    });

    expect(
      project.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes[0]?.topology?.occurrences.find(
          (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
        )?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey]
        ?.traitOffersByAcquisitionRole.hiddenSource,
    ).toEqual(offer);
  });

  it('does not create completion rooms before a Preboss is selected', () => {
    const withoutRack = {
      ...catalog,
      rooms: {
        ...catalog.rooms,
        byKey: {
          ...catalog.rooms.byKey,
          F_PostBoss01: { ...catalog.rooms.byKey.F_PostBoss01!, hasKeepsakeRack: false },
        },
      },
    };
    const document = createProjectDocument(withoutRack, {
      projectId: 'fountain-without-rack',
      configuredBiomeCounts: { Underworld: 1 },
    });
    expect(document.routes[0]?.biomes[0]?.topology).toBeNull();
  });

  it('keeps Boss declaration on the biome and Postboss selection on the route', () => {
    expect(catalog.biomeLayouts.byKey.F?.completion.bossRoomGameName).toBe('F_Boss01');
    expect(catalog.routes.byKey.Underworld?.postbossRoomGameNames).toEqual([
      'F_PostBoss01',
      'G_PostBoss01',
      'H_PostBoss01',
      null,
    ]);
  });

  it.each([
    [
      0,
      30,
      [
        'ManaOverTime',
        'StatusVulnerability',
        'StartingGold',
        'RarityBoost',
        'LastStand',
        'ScreenReroll',
        'LowManaDamageBonus',
      ],
    ],
    [1, 18, ['ManaOverTime', 'StatusVulnerability', 'StartingGold', 'CastCount']],
    [2, 12, ['StartingGold', 'LastStand', 'CastCount']],
    [3, 6, ['StartingGold', 'ChanneledCast']],
    [4, 0, []],
  ] as const)(
    'accepts exactly %s-rank Void capacity %s and rejects one more starting Grasp',
    (voidRank, capacity, exactSelection) => {
      const route = createRouteAddress('Underworld');
      const configured = applyProjectCommand(fProject(), catalog, {
        kind: 'ReplaceFearVowRank',
        route,
        vowKey: 'LimitGraspShrineUpgrade',
        rank: voidRank,
      });
      const exact = applyProjectCommand(configured, catalog, {
        kind: 'ReplaceManualArcanaSelection',
        route,
        arcanaKeys: exactSelection,
      });
      expect(exact.routes[0]?.loadout.manualArcanaKeys).toHaveLength(exactSelection.length);
      expect(() =>
        applyProjectCommand(exact, catalog, {
          kind: 'ReplaceManualArcanaSelection',
          route,
          arcanaKeys: [...exactSelection, 'HealthRegen'],
        }),
      ).toThrow(`exceeds starting Grasp capacity ${capacity}`);
    },
  );

  it('rejects a Vow of Void rank that would invalidate the retained starting Arcana selection', () => {
    const route = createRouteAddress('Underworld');
    const exactThirty = applyProjectCommand(fProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route,
      arcanaKeys: [
        'ManaOverTime',
        'StatusVulnerability',
        'StartingGold',
        'RarityBoost',
        'LastStand',
        'ScreenReroll',
        'LowManaDamageBonus',
      ],
    });
    expect(() =>
      applyProjectCommand(exactThirty, catalog, {
        kind: 'ReplaceFearVowRank',
        route,
        vowKey: 'LimitGraspShrineUpgrade',
        rank: 1,
      }),
    ).toThrow('manual Arcana cost 30 exceeds starting Grasp capacity 18');
  });

  it('grows and shrinks a route prefix while preserving retained authored biomes', () => {
    const underworld = createRouteAddress('Underworld');
    const authored = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('retained-f-start'),
      gameName: 'F_Opening01',
    });
    const retainedF = authored.routes[0]?.biomes[0];

    const grown = applyProjectCommand(authored, catalog, {
      kind: 'ConfigureRoutePrefix',
      route: underworld,
      configuredBiomeCount: 4,
    });

    expect(grown.routes[0]?.biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G', 'H', 'I']);
    expect(grown.routes[0]?.biomes[0]).toEqual(retainedF);
    for (const biome of grown.routes[0]?.biomes.slice(1) ?? []) {
      expect(biome.topology).toBeNull();
      expect(biome.topology).toBeNull();
    }
    expect(grown.routes[0]?.biomes[3]).toMatchObject({
      biomeKey: 'I',
      state: { maxNonGoalRewards: null },
    });
    expect(
      applyProjectCommand(grown, catalog, {
        kind: 'ConfigureRoutePrefix',
        route: underworld,
        configuredBiomeCount: 4,
      }),
    ).toBe(grown);

    const shrunk = applyProjectCommand(grown, catalog, {
      kind: 'ConfigureRoutePrefix',
      route: underworld,
      configuredBiomeCount: 2,
    });
    expect(shrunk.routes[0]?.biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G']);
    expect(shrunk.routes[0]?.biomes[0]).toEqual(retainedF);
  });

  it('authors Arcana and Fear independently from weapon, aspect, and biome state', () => {
    const route = createRouteAddress('Underworld');
    const original = fProject();
    const withArcana = applyProjectCommand(original, catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route,
      arcanaKeys: ['ChanneledCast', 'CastCount'],
    });
    const withFear = applyProjectCommand(withArcana, catalog, {
      kind: 'ReplaceFearVowRank',
      route,
      vowKey: 'EnemyDamageShrineUpgrade',
      rank: 3,
    });
    const withWeapon = applyProjectCommand(withFear, catalog, {
      kind: 'ReplaceRouteLoadout',
      route,
      weaponKey: 'WeaponDagger',
      aspectKey: 'DaggerBackstabAspect',
    });

    expect(withWeapon.routes[0]?.loadout).toMatchObject({
      weaponKey: 'WeaponDagger',
      aspectKey: 'DaggerBackstabAspect',
      manualArcanaKeys: ['ChanneledCast', 'CastCount'],
      fearRanks: { EnemyDamageShrineUpgrade: 3 },
    });
    expect(withWeapon.routes[0]?.biomes).toEqual(original.routes[0]?.biomes);
    expect(
      applyProjectCommand(withWeapon, catalog, {
        kind: 'ReplaceFearVowRank',
        route,
        vowKey: 'EnemyDamageShrineUpgrade',
        rank: 3,
      }),
    ).toBe(withWeapon);
    expect(
      applyProjectCommand(withWeapon, catalog, {
        kind: 'ReplaceManualArcanaSelection',
        route,
        arcanaKeys: ['CastCount', 'ChanneledCast'],
      }),
    ).toBe(withWeapon);
  });

  it('installs, replaces, and undoes the complete Aspect of Selene Hex tree', () => {
    const route = createRouteAddress('Underworld');
    const selene = applyProjectCommand(fProject(), catalog, {
      kind: 'ReplaceRouteLoadout',
      route,
      weaponKey: 'WeaponSuit',
      aspectKey: 'SuitHexAspect',
    });
    const initialTree = selene.routes[0]!.loadout.aspectHexTree;
    expect(initialTree).toEqual({
      layoutKey: 'Lung',
      rareTalentKeys: ['MoonBeamConsecutiveDamageTalent', 'MoonBeamDefenseTalent'],
      epicTalentKeys: ['MoonBeamTargetTalent'],
    });
    const history = createProjectHistory(selene);
    const changed = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceAspectHexTree',
      route,
      value: {
        layoutKey: 'Maze',
        rareTalentKeys: [
          'MoonBeamPrimaryTalent',
          'MoonBeamConsecutiveDamageTalent',
          'MoonBeamDefenseTalent',
        ],
        epicTalentKeys: ['MoonBeamTargetTalent', 'MoonBeamExBeamBonusTalent'],
      },
    });
    expect(changed.present.routes[0]!.loadout.aspectHexTree?.layoutKey).toBe('Maze');
    expect(undoProjectHistory(changed).present).toBe(history.present);
    expect(redoProjectHistory(changed).present).toBe(changed.present);
    const ordinary = applyProjectCommand(selene, catalog, {
      kind: 'ReplaceRouteLoadout',
      route,
      weaponKey: 'WeaponSuit',
      aspectKey: 'BaseSuitAspect',
    });
    expect(ordinary.routes[0]!.loadout).not.toHaveProperty('aspectHexTree');
    expect(() =>
      applyProjectCommand(ordinary, catalog, {
        kind: 'ReplaceAspectHexTree',
        route,
        value: initialTree!,
      }),
    ).toThrow('supported only by Aspect of Selene');
  });

  it('derives automatic Arcana and cumulative Fear from the complete route loadout', () => {
    const route = createRouteAddress('Underworld');
    let project = fProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route,
      arcanaKeys: ['ChanneledCast', 'HealthRegen', 'LowManaDamageBonus', 'CastCount'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route,
      vowKey: 'EnemyDamageShrineUpgrade',
      rank: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route,
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 4,
    });

    const derived = deriveRouteLoadout(catalog, project.routes[0]!.loadout);
    expect(derived.automaticArcanaKeys).toEqual([
      'SorceryRegenUpgrade',
      'BonusRarity',
      'EpicRarityBoost',
    ]);
    expect(derived.fearTotal).toBe(17);
  });

  it('rejects invalid Arcana and Fear commands at the route owner', () => {
    const route = createRouteAddress('Underworld');
    const project = fProject();
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceManualArcanaSelection',
        route,
        arcanaKeys: ['CardDraw'],
      }),
    ).toThrow(/invalid manual Arcana CardDraw/);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceFearVowRank',
        route,
        vowKey: 'BossDifficultyShrineUpgrade',
        rank: 5,
      }),
    ).toThrow(/invalid Vow rank/);
  });

  it.each([
    [-1, 'configuredBiomeCount must be a non-negative integer'],
    [1.5, 'configuredBiomeCount must be a non-negative integer'],
    [5, 'configuredBiomeCount exceeds the 4-biome route'],
  ])('rejects invalid route-prefix count %s', (configuredBiomeCount, detail) => {
    expect(() =>
      applyProjectCommand(fProject(), catalog, {
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount,
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ConfigureRoutePrefix',
        addressKey: '["route","Underworld"]',
        detail,
      }),
    );
  });

  it('replaces and validates a declaration-owned biome field', () => {
    const field = createBiomeFieldAddress(iBiome, 'maxNonGoalRewards');
    const original = iProject();
    const replaced = applyProjectCommand(original, catalog, {
      kind: 'ReplaceBiomeField',
      field,
      value: 5,
    });

    expect(replaced.routes[0]?.biomes[3]?.state).toEqual({ maxNonGoalRewards: 5 });
    expect(
      applyProjectCommand(replaced, catalog, {
        kind: 'ReplaceBiomeField',
        field,
        value: 5,
      }),
    ).toEqual(replaced);

    expect(() =>
      applyProjectCommand(replaced, catalog, {
        kind: 'ReplaceBiomeField',
        field,
        value: 7,
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceBiomeField',
        addressKey: '["biomeField","Underworld","I","maxNonGoalRewards"]',
        detail: 'ReplaceBiomeField.value: must be between 3 and 6',
      }),
    );
  });

  it('wraps a project-document field failure at the public command boundary', () => {
    const command = {
      kind: 'ReplaceBiomeField' as const,
      field: createBiomeFieldAddress(fBiome, 'unknownField'),
      value: false,
    };

    try {
      applyProjectCommand(fProject(), catalog, command);
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectCommandContractError);
      if (!(error instanceof ProjectCommandContractError)) {
        throw new Error('expected a ProjectCommandContractError', { cause: error });
      }
      expect(error).toMatchObject({
        commandKind: 'ReplaceBiomeField',
        addressKey: '["biomeField","Underworld","F","unknownField"]',
        detail: 'ReplaceBiomeField.value: unknown biome field unknownField',
      });
      expect(error.cause).toBeInstanceOf(ProjectDocumentContractError);
      expect(error.cause).toMatchObject({
        path: 'ReplaceBiomeField.value',
        detail: 'unknown biome field unknownField',
      });
      return;
    }
    throw new Error('expected the invalid biome field command to fail');
  });
});

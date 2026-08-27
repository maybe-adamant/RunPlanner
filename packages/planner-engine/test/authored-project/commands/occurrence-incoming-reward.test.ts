import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  assembleRoomActionDomain,
  createProjectHistory,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createAcquisitionRoleAddress,
  seaStarDuplicateSiteKey,
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  seaStarDuplicateSourceIsActive,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  undoProjectHistory,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import {
  createGoldenFGHProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOProject,
  loadSurfaceNOPQProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceIds,
} from '@run-planner/test-fixtures/surface';

import { createCompleteNProject } from '../support/complete-n-project';
import { nBiome } from '../support/configured-projects';

describe('authored-project incoming reward commands', () => {
  function completePolymorphSpellOffer(): AuthoredTraitOfferTraits {
    return {
      kind: 'traits',
      giverKey: 'SpellDrop',
      options: [
        { traitKey: 'SpellPolymorphTrait' },
        { traitKey: 'SpellMeteorTrait' },
        { traitKey: 'SpellTransformTrait' },
      ],
      selectedOptionKey: 'option1',
      hexTree: {
        layoutKey: 'Lung',
        rareTalentKeys: ['PolymorphBossDamageTalent', 'PolymorphDeathExplodeTalent'],
        epicTalentKeys: ['PolymorphSandwichTalent'],
      },
      rarificationActions: [],
    };
  }

  it('strictly authors a three-choice rarityless SpellDrop self child', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'SpellDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(reward, 'self'),
      value: {
        kind: 'traits',
        giverKey: 'SpellDrop',
        options: [
          { traitKey: 'SpellPolymorphTrait' },
          { traitKey: 'SpellMeteorTrait' },
          { traitKey: 'SpellTransformTrait' },
        ],
        selectedOptionKey: 'option2',
        rarificationActions: [],
      },
    });
    const selectedSpell = project.routes[0]!.biomes.flatMap(
      (biome) => biome.topology?.occurrences ?? [],
    ).find((occurrence) => occurrence.occurrenceId === goldenFOccurrenceId(1, 1))?.state;
    const authoredSpell =
      selectedSpell?.kind === 'counted'
        ? selectedSpell.reward?.traitOffersByAcquisitionRole?.self
        : undefined;
    expect(authoredSpell).toMatchObject({
      kind: 'traits',
      selectedOptionKey: 'option2',
      hexTree: {
        layoutKey: 'Lung',
        rareTalentKeys: ['MeteorVulnerabilityDecalTalent', 'MeteorSlowDecalTalent'],
        epicTalentKeys: ['MeteorInvulnerableChargeTalent'],
      },
    });
    const encoded = encodeProjectDocument(project);
    expect(decodeProjectDocument(JSON.parse(encoded), catalog)).toEqual(project);

    const initial = createProjectHistory(project);
    const changed = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(reward, 'self'),
      value: {
        kind: 'traits',
        giverKey: 'SpellDrop',
        options: [
          { traitKey: 'SpellMeteorTrait' },
          { traitKey: 'SpellTransformTrait' },
          { traitKey: 'SpellLeapTrait' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
    const changedSpell = changed.present.routes[0]!.biomes.flatMap(
      (biome) => biome.topology?.occurrences ?? [],
    ).find((occurrence) => occurrence.occurrenceId === goldenFOccurrenceId(1, 1))?.state;
    const changedOffer =
      changedSpell?.kind === 'counted'
        ? changedSpell.reward?.traitOffersByAcquisitionRole?.self
        : undefined;
    expect(changedOffer).toMatchObject({
      kind: 'traits',
      selectedOptionKey: 'option1',
      hexTree: {
        layoutKey: 'Lung',
        rareTalentKeys: ['MeteorVulnerabilityDecalTalent', 'MeteorSlowDecalTalent'],
        epicTalentKeys: ['MeteorInvulnerableChargeTalent'],
      },
    });
    expect(undoProjectHistory(changed).present).toBe(initial.present);
  });

  it.each([
    [
      'wrong giver',
      'Apollo',
      [
        { traitKey: 'SpellPolymorphTrait' },
        { traitKey: 'SpellMeteorTrait' },
        { traitKey: 'SpellTransformTrait' },
      ],
    ],
    [
      'wrong count',
      'SpellDrop',
      [{ traitKey: 'SpellPolymorphTrait' }, { traitKey: 'SpellMeteorTrait' }],
    ],
    [
      'duplicate option',
      'SpellDrop',
      [
        { traitKey: 'SpellPolymorphTrait' },
        { traitKey: 'SpellPolymorphTrait' },
        { traitKey: 'SpellTransformTrait' },
      ],
    ],
    [
      'out-of-pool spell',
      'SpellDrop',
      [
        { traitKey: 'SpellMoonBeamTrait' },
        { traitKey: 'SpellMeteorTrait' },
        { traitKey: 'SpellTransformTrait' },
      ],
    ],
    [
      'rarity-bearing spell',
      'SpellDrop',
      [
        { traitKey: 'SpellPolymorphTrait', rarity: 'Common' },
        { traitKey: 'SpellMeteorTrait' },
        { traitKey: 'SpellTransformTrait' },
      ],
    ],
  ] as const)('rejects SpellDrop self child with %s', (_label, giverKey, options) => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'SpellDrop' },
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(reward, 'self'),
        value: {
          kind: 'traits',
          giverKey,
          options,
          selectedOptionKey: 'option1',
          rarificationActions: [],
        },
      }),
    ).toThrow();
  });

  const invalidHexOfferMutations: readonly [
    string,
    (offer: AuthoredTraitOfferTraits) => AuthoredTraitOfferTraits,
  ][] = [
    [
      'a Rare identity from another Hex pool',
      (offer) => ({
        ...offer,
        hexTree: {
          ...offer.hexTree!,
          rareTalentKeys: ['MeteorVulnerabilityDecalTalent', 'PolymorphDeathExplodeTalent'],
        },
      }),
    ],
    [
      'a duplicate node identity',
      (offer) => ({
        ...offer,
        hexTree: {
          ...offer.hexTree!,
          rareTalentKeys: ['PolymorphBossDamageTalent', 'PolymorphBossDamageTalent'],
        },
      }),
    ],
    [
      'the wrong Rare cardinality',
      (offer) => ({
        ...offer,
        hexTree: {
          ...offer.hexTree!,
          rareTalentKeys: ['PolymorphBossDamageTalent'],
        },
      }),
    ],
    [
      'a tree for a different selected Spell',
      (offer) => ({
        ...offer,
        options: [
          { traitKey: 'SpellMeteorTrait' },
          { traitKey: 'SpellTransformTrait' },
          { traitKey: 'SpellLeapTrait' },
        ],
      }),
    ],
    [
      'a Hex tree leaked onto a non-spell offer',
      (offer) => ({
        ...offer,
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
      }),
    ],
  ];

  it.each(invalidHexOfferMutations)('rejects malformed selected Hex tree: %s', (_label, mutate) => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'SpellDrop' },
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(reward, 'self'),
        value: mutate(completePolymorphSpellOffer()),
      }),
    ).toThrow();
  });

  it('canonicalizes valid unordered selected Hex nodes to declaration order', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const project = applyProjectCommand(
      applyProjectCommand(createGoldenFGHProject(), catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'SpellDrop' },
      }),
      catalog,
      {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(reward, 'self'),
        value: {
          ...completePolymorphSpellOffer(),
          hexTree: {
            ...completePolymorphSpellOffer().hexTree!,
            rareTalentKeys: ['PolymorphDeathExplodeTalent', 'PolymorphBossDamageTalent'],
          },
        },
      },
    );
    const occurrence = project.routes[0]!.biomes.flatMap(
      (biome) => biome.topology?.occurrences ?? [],
    ).find((candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1));
    const offer = occurrence?.state.kind === 'counted' ? occurrence.state.reward : undefined;
    expect(offer?.traitOffersByAcquisitionRole.self).toMatchObject({
      hexTree: {
        rareTalentKeys: ['PolymorphBossDamageTalent', 'PolymorphDeathExplodeTalent'],
        epicTalentKeys: ['PolymorphSandwichTalent'],
      },
    });
  });

  const apolloOffer = {
    kind: 'traits' as const,
    giverKey: 'Apollo',
    options: [
      { traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const },
      { traitKey: 'ApolloCastBoon', rarity: 'Common' as const },
    ] as const,
    selectedOptionKey: 'option1' as const,
  };

  it('persists one exact Time Piece acquisition-role disposition without rewriting its reward', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(reward, 'source'),
      value: { kind: 'timePiece' },
    });
    const state = project.routes[0]!.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1),
    )?.state;
    if (state?.kind !== 'counted' || state.reward === null)
      throw new Error('expected counted reward');
    expect(state.reward.offer).toEqual({
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    });
    expect(state.reward.dispositionByAcquisitionRole).toEqual({ source: { kind: 'timePiece' } });
  });

  it('authors one source-scoped Sea Star child and removes it again with one Undoable command', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const acquisition = createAcquisitionRoleAddress(reward, 'self');
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'RoomMoneyDrop' },
    });
    const initial = createProjectHistory(project);
    const procced = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition,
      procced: true,
    });
    const occurrence = procced.present.routes[0]!.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1),
    );
    const siteKey = seaStarDuplicateSiteKey(acquisition);
    expect(occurrence?.acquisitionSites?.[siteKey]?.pickupEntries).toHaveProperty(
      SEA_STAR_DUPLICATE_ENTRY_KEY,
    );
    expect(occurrence?.roomActions.order).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey,
      entryKey: SEA_STAR_DUPLICATE_ENTRY_KEY,
    });
    if (occurrence === undefined) throw new Error('Sea Star source occurrence is missing');
    const domain = assembleRoomActionDomain({ catalog, biome: goldenFBiome, occurrence });
    const source = domain.contributions.find(
      (entry) =>
        entry.kind === 'action' &&
        entry.reference.kind === 'interactIncomingReward' &&
        entry.reference.acquisitionRole === 'self',
    );
    const child = domain.contributions.find(
      (entry) =>
        entry.kind === 'action' &&
        entry.reference.kind === 'interactAcquisitionEntry' &&
        entry.reference.siteKey === siteKey,
    );
    expect(child).toMatchObject({
      kind: 'action',
      participation: source?.kind === 'action' ? source.participation : undefined,
      window: source?.kind === 'action' ? source.window : undefined,
      dependencies: [
        {
          kind: 'afterAction',
          action: source?.kind === 'action' ? source.reference : undefined,
        },
      ],
    });
    expect(
      decodeProjectDocument(JSON.parse(encodeProjectDocument(procced.present)), catalog),
    ).toEqual(procced.present);
    const cleared = applyProjectHistoryCommand(procced, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition,
      procced: false,
    });
    expect(
      cleared.present.routes[0]!.biomes[0]!.topology!.occurrences.find(
        (candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1),
      )?.acquisitionSites?.[siteKey],
    ).toBeUndefined();
    expect(undoProjectHistory(cleared).present).toBe(procced.present);
  });

  it('keeps a retained Sea Star child dormant while its parent uses Time Piece', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const acquisition = createAcquisitionRoleAddress(reward, 'self');
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'RoomMoneyDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition,
      procced: true,
    });
    const occurrence = () =>
      project.routes[0]!.biomes[0]!.topology!.occurrences.find(
        (candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1),
      )!;
    const siteKey = seaStarDuplicateSiteKey(acquisition);
    expect(seaStarDuplicateSourceIsActive(catalog, goldenFBiome, occurrence(), siteKey)).toBe(true);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'timePiece' },
    });
    expect(occurrence().acquisitionSites?.[siteKey]).toBeDefined();
    expect(seaStarDuplicateSourceIsActive(catalog, goldenFBiome, occurrence(), siteKey)).toBe(
      false,
    );
  });

  it('keeps a free generated pickup inside a Shop eligible for its own Sea Star child', () => {
    const shop = loadSurfaceNOPQProject()
      .routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'P')
      ?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === pOccurrenceIds.prebossShop,
      );
    const shopState = shop?.state;
    const minorReward =
      shopState?.kind === 'shop' ? shopState.shop?.offers.Minor?.reward : undefined;
    if (shop === undefined || minorReward === undefined)
      throw new Error('nested Shop pickup source is missing');
    const occurrence = createOccurrenceAddress(pBiome, shop.occurrenceId);
    const sourceSiteKey = 'traitGenerated:shop-free-pickup';
    const source = createAcquisitionRoleAddress(
      createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(occurrence, sourceSiteKey),
        'quickBuckGold',
      ),
      'self',
    );
    const duplicateSiteKey = seaStarDuplicateSiteKey(source);
    const nestedFreePickup = Object.freeze({
      ...shop,
      acquisitionSites: Object.freeze({
        ...(shop.acquisitionSites ?? {}),
        [sourceSiteKey]: Object.freeze({
          pickupEntries: Object.freeze({ quickBuckGold: minorReward }),
        }),
        [duplicateSiteKey]: Object.freeze({
          pickupEntries: Object.freeze({
            [SEA_STAR_DUPLICATE_ENTRY_KEY]: minorReward,
          }),
        }),
      }),
      roomActions: Object.freeze({
        order: Object.freeze([
          ...shop.roomActions.order,
          Object.freeze({
            kind: 'interactAcquisitionEntry' as const,
            siteKey: sourceSiteKey,
            entryKey: 'quickBuckGold',
          }),
          Object.freeze({
            kind: 'interactAcquisitionEntry' as const,
            siteKey: duplicateSiteKey,
            entryKey: SEA_STAR_DUPLICATE_ENTRY_KEY,
          }),
        ]),
      }),
    });

    expect(
      seaStarDuplicateSourceIsActive(catalog, pBiome, nestedFreePickup, duplicateSiteKey),
    ).toBe(true);
  });

  it('authors a full Pom Sea Star result as one fresh required acquisition', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const acquisition = createAcquisitionRoleAddress(reward, 'self');
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'StackUpgrade' },
    });
    const source = project.routes[0]!.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1),
    )?.state;
    if (source?.kind !== 'counted' || source.reward === null)
      throw new Error('full Pom source reward is missing');

    const initial = createProjectHistory(project);
    const procced = applyProjectHistoryCommand(initial, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition,
      procced: true,
    });
    const siteKey = seaStarDuplicateSiteKey(acquisition);
    const occurrence = procced.present.routes[0]!.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1),
    );
    if (occurrence === undefined) throw new Error('full Pom source occurrence is missing');
    const duplicate =
      occurrence.acquisitionSites?.[siteKey]?.pickupEntries?.[SEA_STAR_DUPLICATE_ENTRY_KEY];
    if (duplicate === undefined || duplicate === null)
      throw new Error('full Pom Sea Star result is missing');

    // A full Pom is a new required RoomReward acquisition: it does not retain
    // the parent resolution object or any source-specific child state.
    expect(duplicate).toEqual({
      offer: { rewardType: 'StackUpgrade' },
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
      traitOffersByAcquisitionRole: {},
      levelResolutionsByAcquisitionRole: {
        self: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
      },
    });
    expect(duplicate).not.toBe(source.reward);
    expect(duplicate.levelResolutionsByAcquisitionRole).not.toBe(
      source.reward.levelResolutionsByAcquisitionRole,
    );

    const duplicateAddress = createAcquisitionRoleAddress(
      createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
          siteKey,
        ),
        SEA_STAR_DUPLICATE_ENTRY_KEY,
      ),
      'self',
    );
    const domain = assembleRoomActionDomain({ catalog, biome: goldenFBiome, occurrence });
    const child = domain.contributions.find(
      (entry) =>
        entry.kind === 'action' &&
        entry.reference.kind === 'interactAcquisitionEntry' &&
        entry.reference.siteKey === siteKey &&
        entry.reference.entryKey === SEA_STAR_DUPLICATE_ENTRY_KEY,
    );
    expect(child).toMatchObject({
      participation: 'required',
      dependencies: [
        {
          kind: 'afterAction',
          action: {
            kind: 'interactIncomingReward',
            acquisitionRole: 'self',
          },
        },
      ],
    });
    const timePieced = applyProjectCommand(procced.present, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: duplicateAddress,
      value: { kind: 'timePiece' },
    });
    expect(
      timePieced.routes[0]!.biomes[0]!.topology!.occurrences.find(
        (candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1),
      )?.acquisitionSites?.[siteKey]?.pickupEntries?.[SEA_STAR_DUPLICATE_ENTRY_KEY]
        ?.dispositionByAcquisitionRole.self,
    ).toEqual({ kind: 'timePiece' });
    expect(undoProjectHistory(procced).present).toBe(initial.present);
  });

  it('preserves base rarities and the exact ordered Calling Card ledger in one offer command', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const trait = createTraitOfferAddress(reward, 'source');
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'RarifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const next = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
          { traitKey: 'ApolloCastBoon', rarity: 'Epic' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: ['option2', 'option1', 'option2'],
      },
    });
    const saved = next.routes[0]!.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1),
    )?.state;
    const offer =
      saved?.kind === 'counted' ? saved.reward?.traitOffersByAcquisitionRole?.source : undefined;
    if (offer?.kind !== 'traits') throw new Error('Calling Card offer is missing');

    expect(offer.options.map((option) => option.rarity)).toEqual(['Common', 'Rare', 'Epic']);
    expect(offer.rarificationActions).toEqual(['option2', 'option1', 'option2']);
  });

  it('preserves customized trait children when the parent offer is unchanged', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const value = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(reward, 'source'),
      value: apolloOffer,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitSelection',
      trait: createTraitOfferAddress(reward, 'source'),
      selectedOptionKey: 'option2',
    });

    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1));
    const existing =
      occurrence?.state.kind === 'counted'
        ? occurrence.state.reward?.traitOffersByAcquisitionRole?.source
        : undefined;
    if (existing === undefined || existing === null)
      throw new Error('customized trait offer is missing');
    expect(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(reward, 'source'),
        value: existing,
      }),
    ).toBe(project);

    expect(
      applyProjectCommand(project, catalog, { kind: 'ReplaceIncomingReward', reward, value }),
    ).toBe(project);
  });

  it('rejects selecting an unmaterialized sparse trait option', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const trait = createTraitOfferAddress(reward, 'source');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: apolloOffer,
    });
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1));
    const existing =
      occurrence?.state.kind === 'counted'
        ? occurrence.state.reward?.traitOffersByAcquisitionRole?.source
        : undefined;
    if (existing?.kind !== 'traits') throw new Error('missing Apollo trait offer');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: Object.freeze({
        kind: 'traits',
        giverKey: existing.giverKey,
        options: Object.freeze([existing.options[0]!]) as readonly [
          (typeof existing.options)[number],
        ],
        selectedOptionKey: 'option1',
      }),
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitSelection',
        trait,
        selectedOptionKey: 'option3',
      }),
    ).toThrow('selected option is not materialized');
    const fallback = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: Object.freeze({ kind: 'fallbackGold', giverKey: existing.giverKey }),
    });
    expect(() =>
      applyProjectCommand(fallback, catalog, {
        kind: 'ReplaceTraitSelection',
        trait,
        selectedOptionKey: 'option1',
      }),
    ).toThrow('selected option is not materialized');
  });

  it('rejects a persisted Death Defiance field on an unsupported trait owner', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(6, 2));
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(reward, 'source'),
      value: apolloOffer,
    });
    const document = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{
        biomes: Array<{ topology?: { occurrences: Array<Record<string, unknown>> } }>;
      }>;
    };
    const occurrence = document.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.occurrenceId === goldenFOccurrenceId(6, 2));
    if (occurrence === undefined) throw new Error('missing encoded trait owner');
    const state = occurrence.state as {
      reward?: { traitOffersByAcquisitionRole?: Record<string, Record<string, unknown>> };
    };
    const offer = state.reward?.traitOffersByAcquisitionRole?.source;
    if (offer === undefined) throw new Error('missing encoded trait offer');
    offer.deathDefianceConditionMet = true;
    expect(() => decodeProjectDocument(document, catalog)).toThrow(/deathDefianceConditionMet/);
  });

  it('accepts a declaration-owned target and rejects targets on ordinary traits', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'HeraUpgrade' },
      },
    });
    const trait = createTraitOfferAddress(reward, 'source');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        kind: 'traits',
        giverKey: 'Hera',
        options: [
          {
            traitKey: 'BoonDecayBoon',
            rarity: 'Common',
            targetTraitKey: 'ApolloWeaponBoon',
          },
          { traitKey: 'HeraWeaponBoon', rarity: 'Common' },
          { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const occurrence = project.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((candidate) => candidate.occurrenceId === goldenFOccurrenceId(1, 1));
    expect(occurrence?.state).toMatchObject({
      reward: {
        traitOffersByAcquisitionRole: {
          source: {
            options: expect.arrayContaining([
              expect.objectContaining({
                traitKey: 'BoonDecayBoon',
                targetTraitKey: 'ApolloWeaponBoon',
              }),
            ]),
          },
        },
      },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait,
        value: {
          kind: 'traits',
          giverKey: 'Hera',
          options: [
            {
              traitKey: 'HeraWeaponBoon',
              rarity: 'Common',
              targetTraitKey: 'ApolloWeaponBoon',
            },
            { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
            { traitKey: 'HeraCastBoon', rarity: 'Common' },
          ],
          selectedOptionKey: 'option1',
        },
      }),
    ).toThrowError(expect.objectContaining({ commandKind: 'ReplaceTraitOffer' }));
  });

  it('replaces counted and free-reward offers and preserves unchanged document identity', () => {
    const ephyraId = createOccurrenceId('round-trip-n-combat02');
    const reward = createIncomingRewardAddress(nBiome, ephyraId);
    const initial = createCompleteNProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'MaxManaDropBig' },
    });

    expect(
      changed.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === ephyraId)?.state,
    ).toMatchObject({ kind: 'ephyraCombat', reward: { offer: { rewardType: 'MaxManaDropBig' } } });
    expect(
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'MaxManaDropBig' },
      }),
    ).toBe(changed);

    const countedId = goldenFOccurrenceId(1, 1);
    const counted = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, countedId),
      value: { rewardType: 'MetaCurrencyDrop' },
    });
    expect(
      counted.routes[0]?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === countedId,
      )?.state,
    ).toMatchObject({ kind: 'counted', reward: { offer: { rewardType: 'MetaCurrencyDrop' } } });

    const freeId = createOccurrenceId('golden-h-preboss-free');
    const free = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenHBiome, freeId),
      value: { rewardType: 'MaxHealthDrop' },
    });
    expect(
      free.routes[0]?.biomes[2]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === freeId,
      )?.state,
    ).toMatchObject({ kind: 'freeReward', reward: { offer: { rewardType: 'MaxHealthDrop' } } });
  });

  it('replaces only the payload of a declaration-fixed reward', () => {
    const reward = createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion);
    const initial = loadSurfaceNOProject();
    const changed = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AphroditeUpgrade',
          spurnedSource: 'ApolloUpgrade',
        },
      },
    });

    expect(
      changed.routes
        .find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'O')
        ?.topology?.occurrences.find(
          (occurrence) => occurrence.occurrenceId === oOccurrenceIds.devotion,
        )?.state,
    ).toMatchObject({
      kind: 'fixed',
      reward: {
        offer: {
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'AphroditeUpgrade',
            spurnedSource: 'ApolloUpgrade',
          },
        },
      },
    });
    expect(() =>
      applyProjectCommand(changed, catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'WeaponUpgrade' },
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceIncomingReward',
        detail: 'O_Devotion01 has a fixed reward type',
      }),
    );
  });

  it('rejects occurrences without replaceable incoming reward state', () => {
    expect(() =>
      applyProjectCommand(createCompleteNProject(), catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(nBiome, createOccurrenceId('round-trip-n-preboss')),
        value: { rewardType: 'Boon' },
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceIncomingReward',
        detail: 'N_PreBoss01 has no replaceable incoming reward',
      }),
    );
  });
});

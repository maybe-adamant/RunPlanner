import { CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations, type RawCatalogInput } from '@run-planner/hades2-catalog/test-support';
import { describe, expect, it } from 'vitest';

function input(): RawCatalogInput {
  return JSON.parse(JSON.stringify(declarations)) as RawCatalogInput;
}

describe('encounter envelope catalog', () => {
  it('binds the H Bridge Echo story to its provider and NPC presentation', () => {
    const built = createCatalog(declarations);
    expect(built.encounterDefinitions.byKey.Story_Echo_01).toMatchObject({
      key: 'Story_Echo_01',
      kind: 'story',
      npcPresentationKey: 'Echo',
      traitOfferProducer: { kind: 'traitOffer', giverKey: 'Echo' },
    });
    expect(built.rooms.byKey.H_Bridge01?.encounterSlotBindings).toEqual([
      { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'Story_Echo_01' },
    ]);
  });

  it('publishes the complete declaration-owned Gorgon matrix', () => {
    const built = createCatalog(declarations);
    const definitions = built.encounterDefinitions.byKey;
    const positiveKeys = [
      'GeneratedF',
      'GeneratedG',
      'GeneratedH_Passive',
      'GeneratedH_PassiveSmall',
      'GeneratedH',
      'GeneratedH_Treant2',
      'GeneratedH_Screamer2',
      'GeneratedI',
      'GeneratedI_GoalReward',
      'GeneratedI_Small',
      'GeneratedI_Small_GoalReward',
      'OpeningGeneratedN',
      'PreHubGeneratedN',
      'GeneratedN',
      'GeneratedN_Smaller',
      'GeneratedN_Bigger',
      'GeneratedNSubRoom',
      'GeneratedNSubRoom_Bigger',
      'GeneratedO',
      'GeneratedP',
      'GeneratedP_Large',
      'GeneratedQ',
      'GeneratedQ_Islands',
      'GeneratedQ_Large',
    ];
    for (const key of positiveKeys) {
      expect(definitions[key]).toMatchObject({ hostsGorgon: true });
      expect(definitions[key]?.blocksGorgon).not.toBe(true);
    }

    const explicitBlockers = [
      'OpeningGeneratedF',
      'ArtemisCombatF',
      'ArachneCombatF',
      'NemesisCombatF',
      'NemesisRandomEvent',
      'MiniBossTreant',
      'MiniBossFogEmitter',
      'MiniBossAssassin',
      'BossHecate01',
      'ArtemisCombatG',
      'ArachneCombatG',
      'NemesisCombatG',
      'MiniBossWaterUnit',
      'MiniBossCrawler',
      'MiniBossJellyfish',
      'BossScylla01',
      'NemesisCombatH',
      'MiniBossVampire',
      'MiniBossLamia',
      'BossInfestedCerberus01',
      'NemesisCombatI',
      'MiniBossRatCatcher',
      'MiniBossGoldElemental',
      'BossChronos01',
      'ArtemisCombatN',
      'HeraclesCombatN',
      'MiniBossSatyrCrossbow',
      'MiniBossBoar',
      'BossPolyphemus01',
      'GeneratedO_Intro01',
      'HeraclesCombatO',
      'IcarusCombatO',
      'MiniBossCharybdis',
      'MiniBossCaptain',
      'DevotionTestO',
      'BossEris01',
      'AthenaCombatP',
      'HeraclesCombatP',
      'IcarusCombatP',
      'MiniBossTalos',
      'MiniBossDragon',
      'BossPrometheus01',
      'MiniBossBrute',
      'MiniBossStalker',
      'BossTyphonTail01',
      'BossTyphonEye01',
      'BossTyphonHead01',
      'BossZagreus01',
      'GeneratedAnomalyB',
    ];
    const pOpeningAndPreCombat = Object.keys(definitions).filter(
      (key) =>
        key === 'GeneratedP_PreCombat' ||
        key.startsWith('PIntroCombat') ||
        key.startsWith('P_Combat'),
    );
    expect(
      Object.values(definitions)
        .filter((definition) => definition.blocksGorgon === true)
        .map((definition) => definition.key)
        .sort(),
    ).toEqual([...explicitBlockers, ...pOpeningAndPreCombat].sort());

    for (const key of [
      'Empty',
      'Story_Echo_01',
      'Story_Medea_01',
      'Story_Dionysus_01',
      'Story_Dionysus_02',
      'Story_Hades_01',
      'Story_Chronos_01',
    ]) {
      expect(definitions[key]?.hostsGorgon).not.toBe(true);
      expect(definitions[key]?.blocksGorgon).not.toBe(true);
    }

    for (let index = 1; index <= 15; index += 1) {
      const key = `N_Sub${String(index).padStart(2, '0')}`;
      expect(built.rooms.byKey[key]?.blocksGorgon).toBe(true);
    }
    expect(definitions.GeneratedNSubRoom).toMatchObject({ hostsGorgon: true });
    expect(definitions.GeneratedNSubRoom?.blocksGorgon).not.toBe(true);
  });

  it('publishes the declaration-owned Fig Leaf support and blocker matrix', () => {
    const definitions = createCatalog(declarations).encounterDefinitions.byKey;
    for (const key of [
      'GeneratedF',
      'GeneratedG',
      'GeneratedH',
      'GeneratedH_Treant2',
      'GeneratedH_Screamer2',
      'GeneratedI',
      'GeneratedI_GoalReward',
      'GeneratedI_Small',
      'GeneratedI_Small_GoalReward',
      'OpeningGeneratedN',
      'PreHubGeneratedN',
      'GeneratedN',
      'GeneratedO_Intro01',
      'GeneratedO',
      'GeneratedQ',
      'GeneratedQ_Islands',
      'GeneratedQ_Large',
    ]) {
      expect(definitions[key]?.canEncounterSkip).toBe(true);
      expect(definitions[key]?.blocksFigLeaf).toBe(false);
    }
    for (const key of ['GeneratedNSubRoom', 'GeneratedNSubRoom_Bigger']) {
      expect(definitions[key]).toMatchObject({ canEncounterSkip: true, blocksFigLeaf: true });
    }
    expect(definitions.GeneratedP_PreCombat?.skipEndEncounterEffects).toBe(true);
    expect(definitions.GeneratedP?.canEncounterSkip).toBe(false);
    expect(definitions.AthenaCombatP).toMatchObject({
      canEncounterSkip: false,
      blocksFigLeaf: true,
    });
    const positiveUnblockedMinibosses = [
      'MiniBossTreant',
      'MiniBossFogEmitter',
      'MiniBossAssassin',
      'MiniBossWaterUnit',
      'MiniBossJellyfish',
      'MiniBossVampire',
      'MiniBossLamia',
      'MiniBossRatCatcher',
      'MiniBossGoldElemental',
      'MiniBossSatyrCrossbow',
      'MiniBossBoar',
    ];
    for (const key of positiveUnblockedMinibosses) {
      expect(definitions[key]).toMatchObject({ canEncounterSkip: true, blocksFigLeaf: false });
    }
    const positiveBlockedMinibosses = [
      'MiniBossCaptain',
      'MiniBossDragon',
      'MiniBossBrute',
      'MiniBossStalker',
      'BossTyphonTail01',
    ];
    for (const key of positiveBlockedMinibosses) {
      expect(definitions[key]).toMatchObject({ canEncounterSkip: true, blocksFigLeaf: true });
    }
    const blockedMinibosses = ['MiniBossCrawler', 'MiniBossCharybdis', 'BossTyphonEye01'];
    for (const key of blockedMinibosses) {
      expect(definitions[key]).toMatchObject({ canEncounterSkip: false, blocksFigLeaf: true });
    }
    expect(definitions.MiniBossTalos).toMatchObject({
      canEncounterSkip: false,
      blocksFigLeaf: false,
    });
    expect(definitions.BossChronos01?.canEncounterSkip).toBe(false);
  });
  it('closes every room declaration over one envelope and complete slot bindings', () => {
    const catalog = createCatalog(declarations);

    expect(catalog.encounterEnvelopes.values.map((envelope) => envelope.key)).toEqual([
      'EmptyEncounter',
      'SingleEncounter',
      'ShipEncounter',
      'PEncounter',
      'FieldsEncounter',
    ]);
    expect(catalog).not.toHaveProperty('encounterProfiles');

    for (const room of catalog.rooms.values) {
      const envelope = catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey];
      expect(envelope).toBeDefined();
      expect(room.encounterSlotBindings.map((binding) => binding.slotKey)).toEqual(
        envelope?.slots.map((slot) => slot.key),
      );
      for (const binding of room.encounterSlotBindings) {
        if (binding.kind === 'fixed') {
          expect(catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]).toBeDefined();
          continue;
        }
        const encounterSet = catalog.encounterSets.byKey[binding.encounterSetKey];
        expect(encounterSet).toBeDefined();
        expect(encounterSet?.encounterDefinitionKeys).toContain(
          encounterSet?.defaultEncounterDefinitionKey,
        );
      }
    }
  });

  it('binds ordinary support and fixed identities without an envelope-specific baseline', () => {
    const catalog = createCatalog(declarations);

    expect(catalog.rooms.byKey.F_Combat02).toMatchObject({
      encounterEnvelopeKey: 'SingleEncounter',
      encounterSlotBindings: [
        { slotKey: 'Encounter', kind: 'set', encounterSetKey: 'FEncountersDefault' },
      ],
    });
    expect(catalog.rooms.byKey.F_MiniBoss01).toMatchObject({
      encounterEnvelopeKey: 'SingleEncounter',
      encounterSlotBindings: [
        { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'MiniBossTreant' },
      ],
    });
    expect(catalog.rooms.byKey.F_MiniBoss03).toMatchObject({
      label: 'Master-Slicer',
      encounterEnvelopeKey: 'SingleEncounter',
      encounterSlotBindings: [
        { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'MiniBossAssassin' },
      ],
    });
    expect(catalog.rooms.byKey.F_PostBoss01).toMatchObject({
      encounterEnvelopeKey: 'SingleEncounter',
      encounterSlotBindings: [
        { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'Empty' },
      ],
    });
    expect(catalog.encounterDefinitions.byKey).not.toHaveProperty('Story_Chronos_01');
    expect(catalog.encounterSets.byKey.IEncountersDefault).toMatchObject({
      encounterDefinitionKeys: ['GeneratedI', 'GeneratedI_GoalReward', 'NemesisCombatI'],
      defaultEncounterDefinitionKey: 'GeneratedI',
    });
    expect(catalog.encounterSets.byKey.PEncountersDefault).toMatchObject({
      encounterDefinitionKeys: ['GeneratedP', 'GeneratedP_Large', 'AthenaCombatP', 'IcarusCombatP'],
      defaultEncounterDefinitionKey: 'GeneratedP',
    });
    expect(catalog.rooms.byKey.N_Sub09).toMatchObject({
      encounterEnvelopeKey: 'SingleEncounter',
      encounterSlotBindings: [
        {
          slotKey: 'Encounter',
          kind: 'fixed',
          encounterDefinitionKey: 'GeneratedNSubRoom_Bigger',
        },
      ],
    });
    expect(catalog.encounterSets.byKey.NEncountersSubRoomHeavy).toBeUndefined();
    expect(catalog.encounterSets.byKey.FEncountersDefault?.encounterDefinitionKeys).toEqual([
      'GeneratedF',
      'ArtemisCombatF',
      'ArachneCombatF',
      'NemesisCombatF',
      'NemesisRandomEvent',
    ]);
    expect(catalog.encounterSets.byKey.GEncountersDefault?.encounterDefinitionKeys).toEqual([
      'GeneratedG',
      'ArtemisCombatG',
      'ArachneCombatG',
      'NemesisCombatG',
      'NemesisRandomEvent',
    ]);
    expect(catalog.encounterSets.byKey.HEncountersDefault?.encounterDefinitionKeys).toEqual([
      'GeneratedH',
      'GeneratedH_Treant2',
      'GeneratedH_Screamer2',
      'NemesisCombatH',
    ]);
    expect(catalog.encounterSets.byKey.HEncountersPassive?.encounterDefinitionKeys).not.toContain(
      'NemesisCombatH',
    );
    expect(
      catalog.encounterSets.byKey.HEncountersPassiveSmall?.encounterDefinitionKeys,
    ).not.toContain('NemesisCombatH');
    expect(catalog.encounterSets.byKey.IEncountersSmaller?.encounterDefinitionKeys).toContain(
      'NemesisCombatI',
    );
    const nemesisCombatKeys = [
      'NemesisCombatF',
      'NemesisCombatG',
      'NemesisCombatH',
      'NemesisCombatI',
    ];
    const encounterKeysForRoom = (gameName: string) => {
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) throw new Error(`${gameName} declaration is missing`);
      return room.encounterSlotBindings.flatMap((binding) =>
        binding.kind === 'fixed'
          ? [binding.encounterDefinitionKey]
          : (catalog.encounterSets.byKey[binding.encounterSetKey]?.encounterDefinitionKeys ?? []),
      );
    };
    expect(encounterKeysForRoom('H_Bridge01')).not.toContain('NemesisCombatH');
    for (const room of catalog.rooms.values.filter((candidate) => candidate.roomSetKey === 'Q')) {
      for (const encounterKey of nemesisCombatKeys) {
        expect(encounterKeysForRoom(room.gameName)).not.toContain(encounterKey);
      }
    }
    for (const room of catalog.rooms.values.filter(
      (candidate) => candidate.incomingReward.kind === 'shop',
    )) {
      for (const encounterKey of nemesisCombatKeys) {
        expect(encounterKeysForRoom(room.gameName)).not.toContain(encounterKey);
      }
    }
    for (const setKey of ['NEncountersDefault', 'NEncountersSmaller', 'NEncountersBigger']) {
      expect(catalog.encounterSets.byKey[setKey]?.encounterDefinitionKeys).toContain(
        'ArtemisCombatN',
      );
      expect(catalog.encounterSets.byKey[setKey]?.encounterDefinitionKeys).toContain(
        'HeraclesCombatN',
      );
    }
    expect(catalog.encounterSets.byKey.NEncountersSubRoom?.encounterDefinitionKeys).not.toContain(
      'ArtemisCombatN',
    );
    expect(catalog.encounterSets.byKey.NEncountersSubRoom?.encounterDefinitionKeys).not.toContain(
      'HeraclesCombatN',
    );
    expect(catalog.encounterSets.byKey.OEncountersIntros?.encounterDefinitionKeys).toEqual([
      'GeneratedO_Intro01',
      'HeraclesCombatO',
    ]);
    expect(catalog.encounterSets.byKey.OEncountersDefault?.encounterDefinitionKeys).toEqual([
      'GeneratedO',
      'IcarusCombatO',
    ]);
    const pIntroSets = catalog.encounterSets.values.filter((candidate) =>
      /^P(?:Combat(?:0[1-9]|1[0-6])IntroEncounters|EncountersIntros)$/.test(candidate.key),
    );
    expect(pIntroSets).toHaveLength(17);
    for (const set of pIntroSets) {
      expect(set.encounterDefinitionKeys).toContain('HeraclesCombatP');
      expect(set.encounterDefinitionKeys).not.toContain('IcarusCombatP');
      expect(set.encounterDefinitionKeys).not.toContain('AthenaCombatP');
    }
    expect(catalog.encounterSets.byKey.POpeningEncounters?.encounterDefinitionKeys).not.toContain(
      'HeraclesCombatP',
    );
    expect(catalog.encounterDefinitions.byKey.ArtemisCombatF).toMatchObject({
      countsEncounterDepth: true,
      npcPresentationKey: 'Artemis',
      traitOfferProducer: { kind: 'traitOffer', giverKey: 'Artemis' },
    });
    expect(catalog.encounterDefinitions.byKey.ArachneCombatF).toMatchObject({
      countsEncounterDepth: false,
      npcPresentationKey: 'Arachne',
    });
    expect(catalog.encounterDefinitions.byKey.Story_Arachne_01).toMatchObject({
      countsEncounterDepth: false,
      npcPresentationKey: 'Arachne',
      traitOfferProducer: { kind: 'traitOffer', giverKey: 'Arachne' },
    });
    expect(catalog.encounterDefinitions.byKey.Story_Medea_01).toMatchObject({
      countsEncounterDepth: false,
      npcPresentationKey: 'Medea',
      traitOfferProducer: { kind: 'traitOffer', giverKey: 'Medea' },
    });
    expect(catalog.encounterDefinitions.byKey.Story_Hades_01).toMatchObject({
      countsEncounterDepth: false,
      npcPresentationKey: 'Hades',
      traitOfferProducer: { kind: 'traitOffer', giverKey: 'Hades' },
    });
    expect(catalog.encounterDefinitions.byKey.Story_Dionysus_01).toMatchObject({
      countsEncounterDepth: false,
      npcPresentationKey: 'Dionysus',
      traitOfferProducer: { kind: 'traitOffer', giverKey: 'Dionysus' },
    });
    expect(catalog.encounterDefinitions.byKey.HeraclesCombatP).toMatchObject({
      countsEncounterDepth: true,
      npcPresentationKey: 'Heracles',
      sequenceEffect: { kind: 'terminateSuffix' },
    });
    expect(catalog.encounterDefinitions.byKey.IcarusCombatP).toMatchObject({
      countsEncounterDepth: true,
      npcPresentationKey: 'Icarus',
      traitOfferProducer: { kind: 'traitOffer', giverKey: 'Icarus' },
    });
    expect(catalog.encounterDefinitions.byKey.AthenaCombatP).toMatchObject({
      countsEncounterDepth: true,
      npcPresentationKey: 'Athena',
    });
    for (const encounterKey of nemesisCombatKeys) {
      expect(catalog.encounterDefinitions.byKey[encounterKey]).toMatchObject({
        countsEncounterDepth: true,
        npcPresentationKey: 'Nemesis',
      });
    }
    expect(catalog.encounterDefinitions.byKey.NemesisRandomEvent).toMatchObject({
      key: 'NemesisRandomEvent',
      kind: 'nonCombat',
      countsEncounterDepth: false,
      blocksGorgon: true,
      npcPresentationKey: 'Nemesis',
      requiresInteraction: true,
      suppressesIncomingReward: true,
    });
    expect(catalog.encounterDefinitions.byKey).not.toHaveProperty('BridgeNemesisRandomEvent');
    expect(catalog.encounterDefinitions.byKey).not.toHaveProperty('NemesisShopping');
    const artemisRequirements = catalog.encounterDefinitions.byKey.ArtemisCombatF?.requirements;
    if (artemisRequirements?.kind !== 'all') {
      throw new Error('Artemis F requirements are missing');
    }
    expect(artemisRequirements.requirements).toContainEqual({
      kind: 'encounterKeyCount',
      scope: 'route',
      encounterKeys: ['ArtemisCombatF', 'ArtemisCombatG', 'ArtemisCombatN'],
      range: { max: 0 },
    });
    expect(artemisRequirements.requirements).toContainEqual({
      kind: 'previousRoomEncounterKeyCount',
      encounterKeys: [
        'ArtemisCombatF',
        'ArtemisCombatG',
        'ArtemisCombatN',
        'HeraclesCombatN',
        'HeraclesCombatO',
        'HeraclesCombatP',
        'IcarusCombatO',
        'IcarusCombatP',
        'AthenaCombatP',
        'NemesisCombatF',
        'NemesisCombatG',
        'NemesisCombatH',
        'NemesisCombatI',
        'NemesisRandomEvent',
      ],
      roomWindow: 6,
      range: { max: 0 },
    });
    const heraclesPRequirements = catalog.encounterDefinitions.byKey.HeraclesCombatP?.requirements;
    if (heraclesPRequirements?.kind !== 'all') {
      throw new Error('Heracles P requirements are missing');
    }
    expect(heraclesPRequirements.requirements).toContainEqual({
      kind: 'currentRoomStructuralTagsInclude',
      tags: ['Indoor'],
    });
    expect(heraclesPRequirements.requirements).toContainEqual({
      kind: 'previousRoomEncounterKeyCount',
      encounterKeys: ['HeraclesCombatN', 'HeraclesCombatO', 'HeraclesCombatP'],
      roomWindow: 20,
      range: { max: 0 },
    });
    const icarusPRequirements = catalog.encounterDefinitions.byKey.IcarusCombatP?.requirements;
    if (icarusPRequirements?.kind !== 'all') {
      throw new Error('Icarus P requirements are missing');
    }
    expect(icarusPRequirements.requirements).toContainEqual({
      kind: 'currentRoomStructuralTagsInclude',
      tags: ['Outdoor'],
    });
    expect(catalog.encounterDefinitions.byKey.GeneratedP_Large?.requirements).toEqual({
      kind: 'counterRange',
      axis: 'biomeDepthCache',
      range: { min: 9 },
    });
  });

  it('keeps supported field NPC eligibility as exact declaration-owned requirements', () => {
    const catalog = createCatalog(declarations);
    const fieldNpcKeys = [
      'ArtemisCombatF',
      'ArtemisCombatG',
      'ArtemisCombatN',
      'HeraclesCombatN',
      'HeraclesCombatO',
      'HeraclesCombatP',
      'IcarusCombatO',
      'IcarusCombatP',
      'AthenaCombatP',
      'NemesisCombatF',
      'NemesisCombatG',
      'NemesisCombatH',
      'NemesisCombatI',
      'NemesisRandomEvent',
    ];
    const heraclesKeys = ['HeraclesCombatN', 'HeraclesCombatO', 'HeraclesCombatP'];
    const icarusKeys = ['IcarusCombatO', 'IcarusCombatP'];
    const nemesisKeys = [
      'NemesisCombatF',
      'NemesisCombatG',
      'NemesisCombatH',
      'NemesisCombatI',
      'NemesisRandomEvent',
    ];
    const requirementsFor = (key: string) => {
      const requirements = catalog.encounterDefinitions.byKey[key]?.requirements;
      if (requirements?.kind !== 'all') {
        throw new Error(`${key} requirements are missing`);
      }
      return requirements.requirements;
    };
    const heraclesBase = [
      { kind: 'currentRoomRewardExcludes', rewardTypes: ['Devotion'] },
      {
        kind: 'encounterKeyCount',
        scope: 'route',
        encounterKeys: heraclesKeys,
        range: { max: 0 },
      },
      {
        kind: 'previousRoomEncounterKeyCount',
        encounterKeys: heraclesKeys,
        roomWindow: 20,
        range: { max: 0 },
      },
      {
        kind: 'previousRoomEncounterKeyCount',
        encounterKeys: fieldNpcKeys,
        roomWindow: 6,
        range: { max: 0 },
      },
    ];
    expect(requirementsFor('HeraclesCombatN')).toEqual(heraclesBase);
    expect(requirementsFor('HeraclesCombatO')).toEqual(heraclesBase);
    expect(requirementsFor('HeraclesCombatP')).toEqual([
      { kind: 'currentRoomStructuralTagsInclude', tags: ['Indoor'] },
      ...heraclesBase,
    ]);

    const icarusBase = [
      { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 3 } },
      {
        kind: 'currentRoomRewardExcludes',
        rewardTypes: ['Boon', 'SpellDrop', 'Devotion', 'HermesUpgrade', 'WeaponUpgrade'],
      },
      {
        kind: 'encounterKeyCount',
        scope: 'route',
        encounterKeys: icarusKeys,
        range: { max: 0 },
      },
      {
        kind: 'previousRoomEncounterKeyCount',
        encounterKeys: fieldNpcKeys,
        roomWindow: 6,
        range: { max: 0 },
      },
    ];
    expect(requirementsFor('IcarusCombatO')).toEqual(icarusBase);
    expect(requirementsFor('IcarusCombatP')).toEqual([
      icarusBase[0],
      { kind: 'currentRoomStructuralTagsInclude', tags: ['Outdoor'] },
      ...icarusBase.slice(1),
    ]);
    expect(requirementsFor('AthenaCombatP')).toEqual([
      { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
      {
        kind: 'currentRoomRewardExcludes',
        rewardTypes: ['Boon', 'SpellDrop', 'Devotion', 'HermesUpgrade', 'WeaponUpgrade'],
      },
      {
        kind: 'encounterKeyCount',
        scope: 'route',
        encounterKeys: ['AthenaCombatP'],
        range: { max: 0 },
      },
      {
        kind: 'previousRoomEncounterKeyCount',
        encounterKeys: fieldNpcKeys,
        roomWindow: 6,
        range: { max: 0 },
      },
    ]);

    const nemesisBase = [
      {
        kind: 'currentRoomRewardExcludes',
        rewardTypes: [
          'Boon',
          'SpellDrop',
          'Devotion',
          'HermesUpgrade',
          'WeaponUpgrade',
          'StackUpgrade',
          'TalentDrop',
        ],
      },
      {
        kind: 'encounterKeyCount',
        scope: 'route',
        encounterKeys: nemesisKeys,
        range: { max: 0 },
      },
      {
        kind: 'previousRoomEncounterKeyCount',
        encounterKeys: fieldNpcKeys,
        roomWindow: 6,
        range: { max: 0 },
      },
    ];
    for (const encounterKey of ['NemesisCombatF', 'NemesisCombatG', 'NemesisCombatI']) {
      expect(requirementsFor(encounterKey)).toEqual([
        { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
        ...nemesisBase,
      ]);
    }
    expect(requirementsFor('NemesisCombatH')).toEqual([
      { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 1 } },
      ...nemesisBase,
    ]);
  });

  it('keeps all supported fixed slots direct and non-authored', () => {
    const catalog = createCatalog(declarations);
    const fixedTemplates = new Set([
      'Devotion',
      'Fountain',
      'Miniboss',
      'Preboss',
      'Shop',
      'Story',
    ]);
    const fixedRooms = catalog.rooms.values.filter(
      (room) =>
        (room.mode.kind === 'authored' && fixedTemplates.has(room.mode.templateKey)) ||
        (room.mode.kind === 'derived' && room.mode.classification === 'completion'),
    );

    expect(fixedRooms).not.toHaveLength(0);
    for (const room of fixedRooms) {
      expect(room.encounterEnvelopeKey).toBe('SingleEncounter');
      expect(room.encounterSlotBindings).toHaveLength(1);
      expect(room.encounterSlotBindings[0]?.kind).toBe('fixed');
    }
  });

  it('retains the one complete Fields envelope and ordered P and Ship bindings', () => {
    const catalog = createCatalog(declarations);

    expect(catalog.rooms.byKey.H_Combat15?.encounterSlotBindings).toEqual([
      { slotKey: 'Passive', kind: 'set', encounterSetKey: 'HEncountersPassiveSmall' },
      { slotKey: 'Cage01', kind: 'set', encounterSetKey: 'HEncountersDefault' },
      { slotKey: 'Cage02', kind: 'set', encounterSetKey: 'HEncountersDefault' },
      { slotKey: 'Cage03', kind: 'set', encounterSetKey: 'HEncountersDefault' },
    ]);
    expect(catalog.rooms.byKey.O_Combat01?.encounterSlotBindings).toEqual([
      { slotKey: 'Intro', kind: 'set', encounterSetKey: 'OEncountersIntros' },
      { slotKey: 'Combat1', kind: 'set', encounterSetKey: 'OEncountersDefault' },
      { slotKey: 'Combat2', kind: 'set', encounterSetKey: 'OEncountersDefault' },
    ]);
    expect(catalog.rooms.byKey.P_Combat03?.encounterSlotBindings).toEqual([
      { slotKey: 'Intro', kind: 'set', encounterSetKey: 'PCombat03IntroEncounters' },
      { slotKey: 'Combat', kind: 'set', encounterSetKey: 'PEncountersDefault' },
    ]);
    expect(
      catalog.encounterSets.byKey.PCombat03IntroEncounters?.encounterDefinitionKeys,
    ).not.toContain('OlympusIntro');
    expect(catalog.encounterSets.byKey.POpeningEncounters?.encounterDefinitionKeys).toContain(
      'Empty',
    );
    expect(catalog.encounterSets.byKey.POpeningEncounters?.encounterDefinitionKeys).not.toContain(
      'PIntroDreamRunEmpty',
    );
  });

  it('preserves the source-backed Ship Combat2 pre-room encounter-depth gate', () => {
    const catalog = createCatalog(declarations);
    const combat2 = catalog.encounterEnvelopes.byKey.ShipEncounter?.slots.find(
      (slot) => slot.key === 'Combat2',
    );

    expect(combat2).toMatchObject({
      activation: 'templateControlled',
      activationRequirement: {
        kind: 'counterRange',
        axis: 'biomeEncounterDepth',
        range: { min: 2, max: 5 },
      },
    });
  });

  it('rejects a source offer-point override without the ShipCombat wheel source', () => {
    const malformed = input();
    const layoutIndex = malformed.biomeLayouts.findIndex((layout) => layout.biomeKey === 'O');
    const oLayout = malformed.biomeLayouts[layoutIndex];
    if (layoutIndex < 0 || oLayout?.progression.kind !== 'generated') {
      throw new Error('O generated layout fixture is missing');
    }
    (
      oLayout.progression as unknown as {
        rewardStoreOverrides: unknown;
      }
    ).rewardStoreOverrides = [
      {
        sourceRoomTemplateKey: 'Miniboss',
        policy: { kind: 'sourceOfferPoint', selector: 'lastActiveWheel' },
      },
    ];

    expect(() => createCatalog(malformed)).toThrow(
      new CatalogContractError(
        `biomeLayouts[${layoutIndex}].progression.rewardStoreOverrides[0].sourceRoomTemplateKey`,
        'lastActiveWheel requires ShipCombat',
      ),
    );
  });

  it('rejects an incomplete slot binding and an unknown structural requirement slot', () => {
    const incomplete = input();
    const fCombat = incomplete.rooms.find((room) => room.gameName === 'F_Combat02');
    if (fCombat === undefined) throw new Error('missing F Combat 02 fixture');
    (fCombat as unknown as { encounterSlotBindings: unknown[] }).encounterSlotBindings = [];
    expect(() => createCatalog(incomplete)).toThrow(CatalogContractError);

    const unknownSlot = input();
    const oCombatIndex = unknownSlot.rooms.findIndex((room) => room.gameName === 'O_Combat01');
    const oCombat = unknownSlot.rooms[oCombatIndex];
    if (oCombatIndex < 0 || oCombat === undefined) {
      throw new Error('missing O Combat 01 fixture');
    }
    (oCombat as { eligibility: unknown }).eligibility = {
      kind: 'recentEnvelopeSlotCount',
      envelopeKey: 'ShipEncounter',
      slotKey: 'Missing',
      roomWindow: 3,
      range: { max: 2 },
    };
    expect(() => createCatalog(unknownSlot)).toThrow(
      new CatalogContractError(
        `rooms[${oCombatIndex}].eligibility.slotKey`,
        'unknown slot Missing in ShipEncounter',
      ),
    );
  });

  it('closes encounter-history operands over definitions and keeps them definition-owned', () => {
    const unknown = input();
    const generatedIndex = unknown.encounterDefinitions.findIndex(
      (definition) => definition.key === 'GeneratedF',
    );
    if (generatedIndex < 0) throw new Error('GeneratedF declaration is missing');
    (unknown.encounterDefinitions[generatedIndex] as { requirements: unknown }).requirements = {
      kind: 'encounterKeyCount',
      scope: 'route',
      encounterKeys: ['MissingEncounter'],
      range: { max: 0 },
    };
    expect(() => createCatalog(unknown)).toThrow(
      new CatalogContractError(
        `encounterDefinitions[${generatedIndex}].requirements.encounterKeys[0]`,
        'unknown encounter definition MissingEncounter',
      ),
    );

    const wrongContext = input();
    const roomIndex = wrongContext.rooms.findIndex((room) => room.gameName === 'F_Combat02');
    if (roomIndex < 0) throw new Error('F Combat 02 declaration is missing');
    (wrongContext.rooms[roomIndex] as { eligibility: unknown }).eligibility = {
      kind: 'previousRoomEncounterKeyCount',
      encounterKeys: ['GeneratedF'],
      roomWindow: 1,
      range: { max: 0 },
    };
    expect(() => createCatalog(wrongContext)).toThrow(
      new CatalogContractError(
        `rooms[${roomIndex}].eligibility.encounterKeys`,
        'encounter-history requirements are only supported by encounter definitions',
      ),
    );
  });

  it('rejects unknown structural tags in declaration-owned requirements', () => {
    const malformed = input();
    const definitionIndex = malformed.encounterDefinitions.findIndex(
      (definition) => definition.key === 'GeneratedF',
    );
    if (definitionIndex < 0) throw new Error('GeneratedF declaration is missing');
    (malformed.encounterDefinitions[definitionIndex] as { requirements: unknown }).requirements = {
      kind: 'currentRoomStructuralTagsInclude',
      tags: ['Unknown'],
    };

    expect(() => createCatalog(malformed)).toThrow(
      new CatalogContractError(
        `encounterDefinitions[${definitionIndex}].requirements.tags`,
        'unknown room structural tag Unknown',
      ),
    );
  });

  it('closes the one Nemesis random-event descriptor and its F/G/H placement', () => {
    const catalog = createCatalog(declarations);
    expect(catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent).toEqual({
      freeItem: {
        resultRewardTypes: ['EmptyMaxHealthDrop', 'HealDrop', 'LastStandDrop', 'ArmorBoost'],
        conditionalResultRewardType: 'LastStandDrop',
        runtimeOfferRequirement: 'missingLastStand',
        runtimeOfferFallbacks: [
          { preferredRewardType: 'LastStandDrop', fallbackRewardType: 'ArmorBoost' },
          { preferredRewardType: 'ArmorBoost', fallbackRewardType: 'EmptyMaxHealthDrop' },
        ],
        response: 'none',
        pickupRequired: false,
      },
      goldTrade: {
        variants: [
          { rewardType: 'MaxHealthDrop', enteredBiome: { max: 2 }, requirement: 'none' },
          { rewardType: 'MaxHealthDropBig', enteredBiome: { min: 3 }, requirement: 'none' },
          { rewardType: 'MaxManaDrop', enteredBiome: { max: 2 }, requirement: 'none' },
          { rewardType: 'MaxManaDropBig', enteredBiome: { min: 3 }, requirement: 'none' },
          { rewardType: 'StackUpgrade', enteredBiome: { max: 1 }, requirement: 'pomLegal' },
          { rewardType: 'StackUpgradeBig', enteredBiome: { min: 2 }, requirement: 'pomLegal' },
          {
            rewardType: 'WeaponUpgrade',
            enteredBiome: {},
            requirement: 'hammerEarlyOrLate',
          },
        ],
        response: ['accept', 'decline'],
        pickupRequiredOnAccept: true,
      },
      damageTrade: {
        variants: [
          { rewardType: 'MaxHealthDrop', enteredBiome: { max: 2 }, requirement: 'none' },
          { rewardType: 'MaxHealthDropBig', enteredBiome: { min: 3 }, requirement: 'none' },
          { rewardType: 'MaxManaDrop', enteredBiome: { max: 2 }, requirement: 'none' },
          { rewardType: 'MaxManaDropBig', enteredBiome: { min: 3 }, requirement: 'none' },
          { rewardType: 'StackUpgrade', enteredBiome: { max: 1 }, requirement: 'pomLegal' },
          { rewardType: 'StackUpgradeBig', enteredBiome: { min: 2 }, requirement: 'pomLegal' },
          { rewardType: 'RoomMoneyDrop', enteredBiome: { max: 1 }, requirement: 'none' },
          { rewardType: 'RoomMoneyDrop', enteredBiome: { min: 2 }, requirement: 'none' },
          { rewardType: 'TalentDrop', enteredBiome: {}, requirement: 'talentLegal' },
        ],
        response: ['accept', 'decline'],
        pickupRequiredOnAccept: true,
      },
      traitTrade: {
        response: ['accept', 'decline'],
        pickupRequiredOnAccept: true,
        fixedResultRewardType: 'RoomMoneyTripleDrop',
        traitSelection: 'eligibleGodTraitCommonPriority',
      },
      damageContest: {
        successResultRewardTypes: [
          'MaxHealthDrop',
          'MaxManaDrop',
          'StackUpgrade',
          'RoomMoneyDrop',
          'TalentDrop',
        ],
        failureResultRewardType: 'RoomRewardConsolationPrize',
        response: 'none',
        pickupRequired: false,
      },
      hOptionalCapacityReservation: 1,
    });
    expect(catalog.encounterDefinitions.byKey.NemesisRandomEvent).toMatchObject({
      key: 'NemesisRandomEvent',
      kind: 'nonCombat',
      countsEncounterDepth: false,
      requiresInteraction: true,
      suppressesIncomingReward: true,
      nemesisRandomEvent: {
        hOptionalCapacityReservation: 1,
        freeItem: {
          resultRewardTypes: ['EmptyMaxHealthDrop', 'HealDrop', 'LastStandDrop', 'ArmorBoost'],
          conditionalResultRewardType: 'LastStandDrop',
          response: 'none',
          pickupRequired: false,
        },
        traitTrade: {
          response: ['accept', 'decline'],
          fixedResultRewardType: 'RoomMoneyTripleDrop',
          pickupRequiredOnAccept: true,
          traitSelection: 'eligibleGodTraitCommonPriority',
        },
        damageContest: {
          successResultRewardTypes: [
            'MaxHealthDrop',
            'MaxManaDrop',
            'StackUpgrade',
            'RoomMoneyDrop',
            'TalentDrop',
          ],
          failureResultRewardType: 'RoomRewardConsolationPrize',
          response: 'none',
          pickupRequired: false,
        },
      },
      requirements: {
        kind: 'all',
        requirements: [
          { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
          {
            kind: 'currentRoomRewardExcludes',
            rewardTypes: [
              'Boon',
              'SpellDrop',
              'Devotion',
              'HermesUpgrade',
              'WeaponUpgrade',
              'StackUpgrade',
              'TalentDrop',
            ],
          },
          {
            kind: 'encounterKeyCount',
            scope: 'route',
            encounterKeys: [
              'NemesisCombatF',
              'NemesisCombatG',
              'NemesisCombatH',
              'NemesisCombatI',
              'NemesisRandomEvent',
            ],
            range: { max: 0 },
          },
          {
            kind: 'previousRoomEncounterKeyCount',
            encounterKeys: [
              'ArtemisCombatF',
              'ArtemisCombatG',
              'ArtemisCombatN',
              'HeraclesCombatN',
              'HeraclesCombatO',
              'HeraclesCombatP',
              'IcarusCombatO',
              'IcarusCombatP',
              'AthenaCombatP',
              'NemesisCombatF',
              'NemesisCombatG',
              'NemesisCombatH',
              'NemesisCombatI',
              'NemesisRandomEvent',
            ],
            roomWindow: 6,
            range: { max: 0 },
          },
        ],
      },
    });
    expect(
      Object.entries(catalog.encounterSets.byKey)
        .filter(([, set]) => set.encounterDefinitionKeys.includes('NemesisRandomEvent'))
        .map(([key]) => key)
        .sort(),
    ).toEqual([
      'FEncountersDefault',
      'GEncountersDefault',
      'HEncountersPassive',
      'HEncountersPassiveSmall',
    ]);
    expect(catalog.encounterSets.byKey.IEncountersDefault?.encounterDefinitionKeys).not.toContain(
      'NemesisRandomEvent',
    );

    const mutateEvent = (mutate: (event: Record<string, unknown>) => unknown) => {
      const broken = input();
      const index = broken.encounterDefinitions.findIndex(
        (definition) => definition.key === 'NemesisRandomEvent',
      );
      if (index < 0) throw new Error('Nemesis event declaration is missing');
      (broken.encounterDefinitions as unknown as unknown[])[index] = mutate(
        broken.encounterDefinitions[index] as unknown as Record<string, unknown>,
      );
      return broken;
    };
    expect(() =>
      createCatalog(
        mutateEvent((event) => {
          const withoutDescriptor = { ...event };
          delete withoutDescriptor.nemesisRandomEvent;
          return withoutDescriptor;
        }),
      ),
    ).toThrow(CatalogContractError);
    expect(() =>
      createCatalog(
        mutateEvent((event) => ({
          ...event,
          nemesisRandomEvent: {
            ...(event.nemesisRandomEvent as Record<string, unknown>),
            freeItem: {
              ...(event.nemesisRandomEvent as { freeItem: Record<string, unknown> }).freeItem,
              conditionalResultRewardType: 'ArmorBoost',
            },
          },
        })),
      ),
    ).toThrow(CatalogContractError);
    expect(() =>
      createCatalog(
        mutateEvent((event) => ({
          ...event,
          nemesisRandomEvent: {
            ...(event.nemesisRandomEvent as Record<string, unknown>),
            traitTrade: {
              ...(event.nemesisRandomEvent as { traitTrade: Record<string, unknown> }).traitTrade,
              response: ['accept', 'decline', 'other'],
            },
          },
        })),
      ),
    ).toThrow(CatalogContractError);
    expect(() =>
      createCatalog(
        mutateEvent((event) => ({
          ...event,
          nemesisRandomEvent: {
            ...(event.nemesisRandomEvent as Record<string, unknown>),
            hOptionalCapacityReservation: 2,
          },
        })),
      ),
    ).toThrow(CatalogContractError);
    expect(() =>
      createCatalog(mutateEvent((event) => ({ ...event, requiresInteraction: false }))),
    ).toThrow(CatalogContractError);
    // Runtime compiler mutation probes intentionally bypass declaration typing.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const mutatePolicy = (mutate: (policy: Record<string, any>) => unknown) =>
      createCatalog(
        mutateEvent((event) => ({
          ...event,
          nemesisRandomEvent: mutate(
            (event as { nemesisRandomEvent: Record<string, any> }).nemesisRandomEvent,
          ),
        })),
      );
    expect(() =>
      mutatePolicy((policy) => ({
        ...policy,
        damageTrade: {
          ...policy.damageTrade,
          variants: [
            { ...policy.damageTrade.variants[0], damage: { min: 1, max: 2 } },
            ...policy.damageTrade.variants.slice(1),
          ],
        },
      })),
    ).toThrow(CatalogContractError);
    expect(() => mutatePolicy((policy) => ({ ...policy, inventedFamily: {} }))).toThrow(
      CatalogContractError,
    );
    expect(() =>
      mutatePolicy((policy) => ({
        ...policy,
        freeItem: { ...policy.freeItem, unexpected: true },
      })),
    ).toThrow(CatalogContractError);
    expect(() =>
      mutatePolicy((policy) => ({
        ...policy,
        goldTrade: {
          ...policy.goldTrade,
          variants: [
            { ...policy.goldTrade.variants[0], goldPrice: { min: 1, max: 2 } },
            ...policy.goldTrade.variants.slice(1),
          ],
        },
      })),
    ).toThrow(CatalogContractError);
    expect(() =>
      mutatePolicy((policy) => ({
        ...policy,
        damageTrade: {
          ...policy.damageTrade,
          variants: [
            {
              ...policy.damageTrade.variants[0],
              enteredBiome: { ...policy.damageTrade.variants[0].enteredBiome, unexpected: true },
            },
            ...policy.damageTrade.variants.slice(1),
          ],
        },
      })),
    ).toThrow(CatalogContractError);
    expect(() =>
      createCatalog(mutateEvent((event) => ({ ...event, npcPresentationKey: 'Other' }))),
    ).toThrow(CatalogContractError);

    const duplicateDescriptor = mutateEvent((event) => event);
    (duplicateDescriptor.encounterDefinitions as any[])[0] = {
      ...(duplicateDescriptor.encounterDefinitions[0] as any),
      nemesisRandomEvent: (
        duplicateDescriptor.encounterDefinitions.find(
          (entry: any) => entry.key === 'NemesisRandomEvent',
        ) as any
      ).nemesisRandomEvent,
    };
    expect(() => createCatalog(duplicateDescriptor)).toThrow(CatalogContractError);
    const duplicateSuppression = mutateEvent((event) => event);
    (duplicateSuppression.encounterDefinitions as any[])[0] = {
      ...(duplicateSuppression.encounterDefinitions[0] as any),
      suppressesIncomingReward: true,
    };
    expect(() => createCatalog(duplicateSuppression)).toThrow(CatalogContractError);

    const invalidCapability = input();
    const emptyMaxHealth = invalidCapability.rewardKernel.acquisitions.find(
      (acquisition) => acquisition.gameName === 'EmptyMaxHealthDrop',
    );
    if (emptyMaxHealth === undefined) throw new Error('EmptyMaxHealthDrop acquisition is missing');
    (emptyMaxHealth as { canDuplicate: boolean }).canDuplicate = false;
    expect(() => createCatalog(invalidCapability)).toThrow(CatalogContractError);

    const invalidLifecycle = input();
    const lifecycle = invalidLifecycle.rewardKernel.producerLifecycles.find(
      (candidate) => candidate.key === 'NemesisEventPickup',
    );
    const maxHealthOverride = lifecycle?.overrides?.find(
      (candidate) => candidate.rewardType === 'MaxHealthDrop',
    );
    if (maxHealthOverride === undefined)
      throw new Error('Nemesis MaxHealthDrop override is missing');
    (maxHealthOverride as unknown as { acquisitionLifecycle: unknown[] }).acquisitionLifecycle = [
      { role: 'self', lifecyclePoint: 'roomRewardPickup' },
    ];
    expect(() => createCatalog(invalidLifecycle)).toThrow(CatalogContractError);
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const moved = input();
    const fSet = moved.encounterSets.find((set) => set.key === 'FEncountersDefault');
    if (fSet === undefined) throw new Error('F default encounter set is missing');
    (fSet as unknown as { encounterDefinitionKeys: string[] }).encounterDefinitionKeys =
      fSet.encounterDefinitionKeys.filter((key) => key !== 'NemesisRandomEvent');
    expect(() => createCatalog(moved)).toThrow(CatalogContractError);
    const extra = input();
    const iSet = extra.encounterSets.find((set) => set.key === 'IEncountersDefault');
    if (iSet === undefined) throw new Error('I default encounter set is missing');
    (iSet as unknown as { encounterDefinitionKeys: string[] }).encounterDefinitionKeys = [
      ...iSet.encounterDefinitionKeys,
      'NemesisRandomEvent',
    ];
    expect(() => createCatalog(extra)).toThrow(CatalogContractError);
  });
});

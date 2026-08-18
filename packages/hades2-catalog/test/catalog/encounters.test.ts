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
    ]);
    expect(catalog.encounterSets.byKey.GEncountersDefault?.encounterDefinitionKeys).toEqual([
      'GeneratedG',
      'ArtemisCombatG',
      'ArachneCombatG',
      'NemesisCombatG',
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
    expect(catalog.encounterDefinitions.byKey).not.toHaveProperty('NemesisRandomEvent');
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
    ];
    const heraclesKeys = ['HeraclesCombatN', 'HeraclesCombatO', 'HeraclesCombatP'];
    const icarusKeys = ['IcarusCombatO', 'IcarusCombatP'];
    const nemesisKeys = ['NemesisCombatF', 'NemesisCombatG', 'NemesisCombatH', 'NemesisCombatI'];
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
});

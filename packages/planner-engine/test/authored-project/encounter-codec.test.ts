import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createFigurineArcanaAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createIncomingRewardAddress,
  createRoomActionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  roomActionKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  createCompleteFGProject,
  createGoldenFGHProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPProject,
  nOccurrenceIds,
  oOccurrenceIds,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';

import { biome, encoded, occurrence, type JsonRecord } from './support/project-codec-json';

function selections(owner: JsonRecord): JsonRecord {
  return ((owner.encounters as JsonRecord).encounterKeyByPhase ?? {}) as JsonRecord;
}

function figLeafSkips(owner: JsonRecord): JsonRecord {
  return ((owner.encounters as JsonRecord).figLeafSkipByPhase ?? {}) as JsonRecord;
}

function arachneStoryProject(): ProjectDocument {
  const occurrenceId = goldenFOccurrenceId(7, 1);
  const occurrence = createOccurrenceAddress(goldenFBiome, occurrenceId);
  const phase = createTraitOfferAddress(
    createEncounterPhaseAddress(goldenFBiome, { kind: 'occurrence', occurrenceId }, 'Encounter'),
    'selection',
  );
  let story = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence,
    gameName: 'F_Story01',
  });
  story = applyProjectCommand(story, catalog, {
    kind: 'RemoveRoomAction',
    action: createRoomActionAddress(
      goldenFBiome,
      occurrenceId,
      roomActionKey({
        kind: 'interactIncomingReward',
        producerPoint: 'roomRewardPickup',
        acquisitionRole: 'self',
      }),
    ),
  });
  return applyProjectCommand(authorLegalTraitOffers(story), catalog, {
    kind: 'ReplaceTraitSelection',
    trait: phase,
    selectedOptionKey: 'option2',
  });
}

function allTogetherProject(): ProjectDocument {
  const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
  const trait = createTraitOfferAddress(reward, 'source');
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceIncomingReward',
    reward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait,
    value: {
      kind: 'traits',
      giverKey: 'Hera',
      options: [
        {
          traitKey: 'AllElementalBoon',
          rarity: 'Legendary',
          allTogetherResult: {
            earth: 'ElementalDamageBoon',
            fire: 'ElementalBaseDamageBoon',
            air: 'ElementalDamageFloorBoon',
            water: 'ElementalHealthBoon',
          },
        },
        { traitKey: 'HeraManaBoon', rarity: 'Common' },
        { traitKey: 'HeraSprintBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    },
  });
  return project;
}

function allTogetherResult(document: JsonRecord): JsonRecord {
  const state = occurrence(document, 'F', goldenFOccurrenceId(1, 1)).state as JsonRecord;
  const reward = state.reward as JsonRecord;
  const offers = reward.traitOffersByAcquisitionRole as JsonRecord;
  const source = offers.source as JsonRecord;
  const options = source.options as JsonRecord[];
  return options[0]!.allTogetherResult as JsonRecord;
}

function allTogetherOffer(document: JsonRecord): JsonRecord {
  const state = occurrence(document, 'F', goldenFOccurrenceId(1, 1)).state as JsonRecord;
  const reward = state.reward as JsonRecord;
  return (reward.traitOffersByAcquisitionRole as JsonRecord).source as JsonRecord;
}

function arachneStoryOffer(document: JsonRecord): JsonRecord {
  const encounters = occurrence(document, 'F', goldenFOccurrenceId(7, 1)).encounters as JsonRecord;
  const byPhase = encounters.traitOffersByPhase as JsonRecord;
  const byEncounter = byPhase.Encounter as JsonRecord;
  return byEncounter.Story_Arachne_01 as JsonRecord;
}

describe('schema-54 occurrence-owned encounter persistence', () => {
  it('rejects malformed and unowned reserved Nemesis generated acquisition sites', () => {
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
      'Encounter',
    );
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisRandomEvent',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceNemesisRandomEventOutcome',
      event: createNemesisRandomEventAddress(phase),
      value: { kind: 'freeItem' },
      reward: { rewardType: 'ArmorBoost' },
    });
    const direct = encoded(project);
    const encounters = occurrence(direct, 'F', goldenFOccurrenceId(5, 1)).encounters as JsonRecord;
    expect((encounters.nemesisRandomEventByPhase as JsonRecord).Encounter).toEqual({
      kind: 'freeItem',
    });
    const wrapped = encoded(project);
    const wrappedEncounters = occurrence(wrapped, 'F', goldenFOccurrenceId(5, 1))
      .encounters as JsonRecord;
    (wrappedEncounters.nemesisRandomEventByPhase as JsonRecord).Encounter = {
      NemesisRandomEvent: { kind: 'freeItem' },
    };
    expect(() => decodeProjectDocument(wrapped, catalog)).toThrow(
      'Encounter.kind: must be a string',
    );
    for (const [key, value] of [
      ['nemesisGenerated:', {}],
      ['nemesisGenerated:foreign', undefined],
    ] as const) {
      const document = encoded(project);
      const sites = occurrence(document, 'F', goldenFOccurrenceId(5, 1))
        .acquisitionSites as JsonRecord;
      sites[key] = value ?? sites['nemesisGenerated:Encounter'];
      expect(() => decodeProjectDocument(document, catalog)).toThrow('Nemesis');
    }
  });
  it('round-trips the exact top-level and parent-local selections', () => {
    const project = loadSurfaceNOPProject();
    const decoded = decodeProjectDocument(encoded(project), catalog);

    expect(decoded).toEqual(project);
    expect(decoded.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION);
  });

  it('rejects schema-57 Purging Pool documents at the strict Stygian Well boundary', () => {
    const document = encoded(loadSurfaceNOPProject());
    document.schemaVersion = 57;
    document.catalogVersion = '0.39.0-purging-pool';

    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received 57`,
    );
  });

  it('rejects a valid-shaped Shrine shell on a non-host completion room', () => {
    const document = encoded(createCompleteFGProject());
    const underworld = (document.routes as JsonRecord[]).find(
      (route) => route.routeKey === 'Underworld',
    );
    const fBiome = (underworld?.biomes as JsonRecord[]).find((biome) => biome.biomeKey === 'F');
    const postboss = (fBiome?.completionOccurrences as JsonRecord[]).find(
      (completion) => completion.gameName === 'F_PostBoss01',
    );
    if (postboss === undefined) throw new Error('missing F Postboss completion occurrence');
    postboss.hermesShrine = {
      offerBySlot: { first: null, secondLeft: null, secondRight: null },
    };

    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      'hermesShrine: is not a project document field',
    );
  });

  it.each(['infernalContractReward', 'travelDealRefill', 'echoDoubleShopReward'] as const)(
    'rejects reserved initial Shop slot key %s at the schema-54 codec boundary',
    (reservedKey) => {
      const world = catalog.rewards.shops.byKey.WorldShop;
      const first = world?.slots.values[0];
      if (world === undefined || first === undefined) throw new Error('missing World Shop');
      const replacement = Object.freeze({ ...first, key: reservedKey });
      const slotValues = Object.freeze([replacement, ...world.slots.values.slice(1)]);
      const malformedWorld = Object.freeze({
        ...world,
        slots: Object.freeze({
          values: slotValues,
          byKey: Object.freeze(
            Object.fromEntries(slotValues.map((slot) => [slot.key, slot] as const)),
          ),
        }),
      });
      const shopValues = Object.freeze(
        catalog.rewards.shops.values.map((shop) =>
          shop.key === world.key ? malformedWorld : shop,
        ),
      );
      const malformedCatalog: Catalog = Object.freeze({
        ...catalog,
        rewards: Object.freeze({
          ...catalog.rewards,
          shops: Object.freeze({
            values: shopValues,
            byKey: Object.freeze(
              Object.fromEntries(shopValues.map((shop) => [shop.key, shop] as const)),
            ),
          }),
        }),
      });
      const document = encoded(createCompleteFGProject());
      const topology = biome(document, 'Underworld', 'F').topology as JsonRecord;
      const shop = (topology.occurrences as JsonRecord[]).find(
        (candidate) => candidate.gameName === 'F_PreBoss01',
      );
      const state = shop?.state as JsonRecord | undefined;
      const inventory = (state?.shop as JsonRecord | undefined)?.offers as JsonRecord | undefined;
      if (inventory === undefined) throw new Error('missing encoded F Preboss Shop');
      inventory[reservedKey] = inventory.Boon;
      delete inventory.Boon;

      expect(() => decodeProjectDocument(document, malformedCatalog)).toThrow(
        `${reservedKey} is reserved for a supplemental Shop entry`,
      );
    },
  );

  it('rejects legacy source-keyed Gold children and retains a stale stable action for repair', () => {
    const malformed = (entryKey: string, includePayload: boolean) => {
      const document = encoded(createCompleteFGProject());
      const topology = biome(document, 'Underworld', 'F').topology as JsonRecord;
      const shop = (topology.occurrences as JsonRecord[]).find(
        (candidate) => candidate.gameName === 'F_PreBoss01',
      );
      const state = shop?.state as JsonRecord | undefined;
      const offers = (state?.shop as JsonRecord | undefined)?.offers as JsonRecord | undefined;
      const sites = shop?.acquisitionSites as JsonRecord | undefined;
      const roomExit = sites?.roomExit as JsonRecord | undefined;
      if (offers === undefined || roomExit === undefined) throw new Error('missing encoded Shop');
      const roomActions = shop?.roomActions as JsonRecord | undefined;
      if (roomActions === undefined) throw new Error('missing encoded Shop Room Actions');
      roomActions.order = [
        ...((roomActions.order as unknown[]) ?? []),
        { kind: 'interactAcquisitionEntry', siteKey: 'roomExit', entryKey },
      ];
      if (includePayload) {
        roomExit.pickupEntries = {
          ...((roomExit.pickupEntries as JsonRecord | undefined) ?? {}),
          [entryKey]: (offers.Boon as JsonRecord).reward,
        };
      }
      return document;
    };

    expect(() => decodeProjectDocument(malformed('echoDoubleShop:Boon', true), catalog)).toThrow(
      'source-keyed Echo Shop duplicates are not supported',
    );
    const retained = decodeProjectDocument(malformed('echoDoubleShopReward', false), catalog);
    expect(
      retained.routes[0]?.biomes[0]?.topology?.occurrences.find(
        (candidate) => candidate.gameName === 'F_PreBoss01',
      )?.roomActions.order,
    ).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: 'echoDoubleShopReward',
    });
  });

  it('schema-28 round-trips an exact ordered Calling Card ledger, including repeated rows', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const trait = createTraitOfferAddress(reward, 'source');
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'RarifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
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

    const decoded = decodeProjectDocument(encoded(project), catalog);
    expect(decoded).toEqual(project);
    expect(encoded(decoded)).toMatchObject({ schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION });
  });

  it('round-trips one atomically replaced exact All Together map and legal null', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const trait = createTraitOfferAddress(reward, 'source');
    const project = allTogetherProject();
    const offer = allTogetherOffer(encoded(project));
    const first = (offer.options as JsonRecord[])[0]!;
    first.allTogetherResult = {
      earth: 'ElementalOlympianDamageBoon',
      fire: 'ElementalBaseDamageBoon',
      air: 'ElementalDamageFloorBoon',
      water: null,
    };
    const nulled = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: offer as never,
    });
    const decoded = decodeProjectDocument(encoded(nulled), catalog);
    expect(decoded).toEqual(nulled);
    expect(allTogetherResult(encoded(decoded))).toEqual({
      earth: 'ElementalOlympianDamageBoon',
      fire: 'ElementalBaseDamageBoon',
      air: 'ElementalDamageFloorBoon',
      water: null,
    });

    const dormant = applyProjectCommand(nulled, catalog, {
      kind: 'ReplaceTraitSelection',
      trait,
      selectedOptionKey: 'option2',
    });
    const restored = applyProjectCommand(dormant, catalog, {
      kind: 'ReplaceTraitSelection',
      trait,
      selectedOptionKey: 'option1',
    });
    expect(allTogetherResult(encoded(dormant))).toEqual(allTogetherResult(encoded(restored)));
  });

  it.each([
    [
      'missing set',
      (result: JsonRecord): void => {
        delete result.water;
      },
      /water: must be a string/,
    ],
    [
      'extra set',
      (result: JsonRecord): void => {
        result.aether = null;
      },
      /aether: is not a project document field/,
    ],
    [
      'wrong member',
      (result: JsonRecord): void => {
        result.earth = 'ElementalRallyBoon';
      },
      /must be null or one of/,
    ],
    [
      'wrong value shape',
      (result: JsonRecord): void => {
        result.fire = 4;
      },
      /must be a string/,
    ],
  ] as const)('rejects an All Together map with %s', (_label, mutate, message) => {
    const document = encoded(allTogetherProject());
    mutate(allTogetherResult(document));
    expect(() => decodeProjectDocument(document, catalog)).toThrow(message);
  });

  it('accepts omission of an unresolved All Together child in codecs and ReplaceTraitOffer', () => {
    const document = encoded(allTogetherProject());
    delete ((allTogetherOffer(document).options as JsonRecord[])[0] as JsonRecord)
      .allTogetherResult;
    expect(decodeProjectDocument(document, catalog)).toBeDefined();

    const project = allTogetherProject();
    const commandValue = allTogetherOffer(encoded(project));
    delete ((commandValue.options as JsonRecord[])[0] as JsonRecord).allTogetherResult;
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    expect(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(reward, 'source'),
        value: commandValue as never,
      }),
    ).toBeDefined();
  });

  it('round-trips and atomically edits an offer-owned Concave Stone result', () => {
    const project = allTogetherProject();
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const trait = createTraitOfferAddress(reward, 'source');
    const proc = applyProjectCommand(project, catalog, {
      kind: 'ReplaceConcaveStoneResult',
      trait,
      value: { kind: 'proc', optionKey: 'option2' },
    });
    expect((allTogetherOffer(encoded(proc)) as JsonRecord).concaveStoneResult).toEqual({
      kind: 'proc',
      optionKey: 'option2',
    });
    expect(decodeProjectDocument(encoded(proc), catalog)).toEqual(proc);

    const noProc = applyProjectCommand(proc, catalog, {
      kind: 'ReplaceConcaveStoneResult',
      trait,
      value: { kind: 'noProc' },
    });
    expect((allTogetherOffer(encoded(noProc)) as JsonRecord).concaveStoneResult).toEqual({
      kind: 'noProc',
    });
    const cleared = applyProjectCommand(noProc, catalog, {
      kind: 'ReplaceConcaveStoneResult',
      trait,
      value: null,
    });
    expect('concaveStoneResult' in allTogetherOffer(encoded(cleared))).toBe(false);

    const malformed = encoded(proc);
    const result = allTogetherOffer(malformed);
    result.concaveStoneResult = { kind: 'proc', optionKey: 'option1' };
    expect(() => decodeProjectDocument(malformed, catalog)).toThrow(/existing residual option/);
    expect(() =>
      applyProjectCommand(proc, catalog, {
        kind: 'ReplaceConcaveStoneResult',
        trait,
        value: { kind: 'proc', optionKey: 'option1' },
      }),
    ).toThrow(/existing residual option/);
  });

  it('rejects malformed Concave Stone result tags and fields at the strict offer boundary', () => {
    const document = encoded(allTogetherProject());
    const offer = allTogetherOffer(document);
    offer.concaveStoneResult = { kind: 'maybe' };
    expect(() => decodeProjectDocument(document, catalog)).toThrow(/must be noProc or proc/);

    const extra = encoded(allTogetherProject());
    allTogetherOffer(extra).concaveStoneResult = { kind: 'noProc', extra: true };
    expect(() => decodeProjectDocument(extra, catalog)).toThrow(
      /concaveStoneResult\.extra: is not a project document field/,
    );

    const missingOption = encoded(allTogetherProject());
    allTogetherOffer(missingOption).concaveStoneResult = { kind: 'proc' };
    expect(() => decodeProjectDocument(missingOption, catalog)).toThrow(
      /concaveStoneResult\.optionKey: must be a string/,
    );
  });

  it('rejects schema 47 at the strict schema-54 boundary', () => {
    const document = encoded(allTogetherProject());
    document.schemaVersion = 47;
    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received 47`,
    );
  });

  it('rejects schema 35 rather than inventing an All Together child migration', () => {
    const document = encoded(allTogetherProject());
    document.schemaVersion = 35;
    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received 35`,
    );
  });

  it('rejects schema 37 rather than migrating source-keyed Gold chronology', () => {
    const document = encoded(createCompleteFGProject());
    document.schemaVersion = 37;
    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received 37`,
    );
  });

  it('rejects schema 39 rather than inventing Fields optional rewards', () => {
    const document = encoded(createGoldenFGHProject());
    document.schemaVersion = 40;
    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received 40`,
    );
  });

  it('requires an exact persisted acquisition disposition map for every reward role', () => {
    const document = encoded(createCompleteFGProject());
    const reward = (occurrence(document, 'F', goldenFOccurrenceId(1, 1)).state as JsonRecord)
      .reward as JsonRecord;

    delete reward.dispositionByAcquisitionRole;
    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      'dispositionByAcquisitionRole: is required',
    );

    const incomplete = encoded(createCompleteFGProject());
    const incompleteReward = (
      occurrence(incomplete, 'F', goldenFOccurrenceId(1, 1)).state as JsonRecord
    ).reward as JsonRecord;
    incompleteReward.dispositionByAcquisitionRole = {};
    expect(() => decodeProjectDocument(incomplete, catalog)).toThrow('is missing acquisition role');

    const extra = encoded(createCompleteFGProject());
    const extraReward = (occurrence(extra, 'F', goldenFOccurrenceId(1, 1)).state as JsonRecord)
      .reward as JsonRecord;
    (extraReward.dispositionByAcquisitionRole as JsonRecord).unknown = { kind: 'normal' };
    expect(() => decodeProjectDocument(extra, catalog)).toThrow('is not an acquisition role');
  });

  it('rejects every retired source-nested Artificer replacement payload', () => {
    const excluded = encoded(createCompleteFGProject());
    const gift = (occurrence(excluded, 'F', goldenFOccurrenceId(1, 1)).state as JsonRecord)
      .reward as JsonRecord;
    const spell = (occurrence(excluded, 'F', goldenFOccurrenceId(10, 2)).state as JsonRecord)
      .reward as JsonRecord;
    (gift.dispositionByAcquisitionRole as JsonRecord).self = {
      kind: 'artificer',
      replacement: spell,
    };
    expect(() => decodeProjectDocument(excluded, catalog)).toThrow('artificer is intent-only');

    const recursive = encoded(createCompleteFGProject());
    const recursiveGift = (
      occurrence(recursive, 'F', goldenFOccurrenceId(1, 1)).state as JsonRecord
    ).reward as JsonRecord;
    const maxHealth = (occurrence(recursive, 'F', goldenFOccurrenceId(3, 1)).state as JsonRecord)
      .reward as JsonRecord;
    const nested = JSON.parse(JSON.stringify(maxHealth)) as JsonRecord;
    (maxHealth.dispositionByAcquisitionRole as JsonRecord).self = {
      kind: 'artificer',
      replacement: nested,
    };
    (recursiveGift.dispositionByAcquisitionRole as JsonRecord).self = {
      kind: 'artificer',
      replacement: maxHealth,
    };
    expect(() => decodeProjectDocument(recursive, catalog)).toThrow('artificer is intent-only');
  });

  it('round-trips complete Fig Leaf phase maps as immutable nested state', () => {
    const decoded = decodeProjectDocument(encoded(loadSurfaceNOPProject()), catalog);
    const occurrence = decoded.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((plan) => plan.biomeKey === 'P')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === pOccurrenceId('P_Combat03', 1, 1),
      );
    if (occurrence === undefined) throw new Error('missing P occurrence');
    expect(occurrence.encounters.figLeafSkipByPhase).toEqual({ Intro: false, Combat: false });
    expect(Object.isFrozen(occurrence.encounters.figLeafSkipByPhase)).toBe(true);
  });

  it('round-trips a distinct automatic-Boss Figurine map and rejects duplicates', () => {
    const boss = createOccurrenceAddress(goldenFBiome, createOccurrenceId('completion:F:boss'));
    const figurine = createFigurineArcanaAddress(boss, 'Encounter');
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceFigurineArcana',
      figurine,
      arcanaKeys: ['CardDraw', 'CastCount'],
    });
    const document = encoded(project);
    const completion = (
      biome(document, 'Underworld', 'F').completionOccurrences as JsonRecord[]
    ).find((candidate) => candidate.occurrenceId === boss.occurrenceId);
    if (completion === undefined) throw new Error('missing automatic Boss completion');
    expect((completion.encounters as JsonRecord).figurineArcanaKeysByPhase).toEqual({
      Encounter: ['CastCount', 'CardDraw'],
    });
    expect(decodeProjectDocument(document, catalog)).toEqual(project);

    const duplicate = encoded(project);
    const duplicateCompletion = (
      biome(duplicate, 'Underworld', 'F').completionOccurrences as JsonRecord[]
    ).find((candidate) => candidate.occurrenceId === boss.occurrenceId);
    if (duplicateCompletion === undefined) throw new Error('missing automatic Boss completion');
    const encounters = duplicateCompletion.encounters as JsonRecord;
    (encounters.figurineArcanaKeysByPhase as JsonRecord).Encounter = ['CardDraw', 'CardDraw'];
    expect(() => decodeProjectDocument(duplicate, catalog)).toThrow(
      'must contain distinct declared Arcana cards',
    );
  });

  it.each(['option0', 'option4', 'row1'])('rejects malformed Calling Card row key %s', (key) => {
    const document = encoded(arachneStoryProject());
    const state = occurrence(document, 'F', goldenFOccurrenceId(7, 1)).encounters as JsonRecord;
    const offer = ((state.traitOffersByPhase as JsonRecord).Encounter as JsonRecord)
      .Story_Arachne_01 as JsonRecord;
    offer.rarificationActions = [key];

    expect(() => decodeProjectDocument(document, catalog)).toThrow('must name an option row');
  });

  it('round-trips a fixed Arachne Story offer through the encounter codec', () => {
    const project = arachneStoryProject();
    const decoded = decodeProjectDocument(encoded(project), catalog);
    const fixed = decoded.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((plan) => plan.biomeKey === 'F')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === goldenFOccurrenceId(7, 1),
      );

    expect(fixed?.encounters.traitOffersByPhase?.Encounter?.Story_Arachne_01).toMatchObject({
      giverKey: 'Arachne',
      selectedOptionKey: 'option2',
    });
    expect(decoded).toEqual(project);
  });

  it('round-trips absent and explicit Persephone offer contributions at the encounter boundary', () => {
    for (const bonus of [undefined, 0, 5, 8] as const) {
      const document = encoded(arachneStoryProject());
      const option = (arachneStoryOffer(document).options as JsonRecord[])[0]!;
      if (bonus === undefined) delete option.persephoneLevelBonus;
      else option.persephoneLevelBonus = bonus;

      const decoded = decodeProjectDocument(document, catalog);
      const roundTrippedOption = (arachneStoryOffer(encoded(decoded)).options as JsonRecord[])[0]!;
      if (bonus === undefined) expect('persephoneLevelBonus' in roundTrippedOption).toBe(false);
      else expect(roundTrippedOption.persephoneLevelBonus).toBe(bonus);
    }
  });

  it.each([-1, 1.5, 9, '5', null, true] as const)(
    'rejects malformed Persephone offer contribution %s at the encounter boundary',
    (bonus) => {
      const document = encoded(arachneStoryProject());
      const option = (arachneStoryOffer(document).options as JsonRecord[])[0]!;
      option.persephoneLevelBonus = bonus;
      expect(() => decodeProjectDocument(document, catalog)).toThrow(/persephoneLevelBonus/);
    },
  );

  it('requires fixed Story encounter offers to retain their exact triple traits shape', () => {
    const document = encoded(arachneStoryProject());
    const state = occurrence(document, 'F', goldenFOccurrenceId(7, 1)).encounters as JsonRecord;
    const byPhase = state.traitOffersByPhase as JsonRecord;
    const byEncounter = byPhase.Encounter as JsonRecord;
    const offer = byEncounter.Story_Arachne_01 as JsonRecord;
    expect(offer.options as unknown[]).toHaveLength(3);

    (offer.options as unknown[]).pop();
    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      'requires exactly three options',
    );
  });

  it('rejects Fallback Gold for a fixed Story encounter offer', () => {
    const document = encoded(arachneStoryProject());
    const state = occurrence(document, 'F', goldenFOccurrenceId(7, 1)).encounters as JsonRecord;
    const offer = ((state.traitOffersByPhase as JsonRecord).Encounter as JsonRecord)
      .Story_Arachne_01 as JsonRecord;
    for (const key of Object.keys(offer)) delete offer[key];
    offer.kind = 'fallbackGold';
    offer.giverKey = 'Arachne';
    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      'Fallback Gold is not supported by this giver',
    );
  });

  it('rejects a fixed Story offer moved to a different encounter owner', () => {
    const document = encoded(arachneStoryProject());
    const state = occurrence(document, 'F', goldenFOccurrenceId(7, 1));
    const encounters = state.encounters as JsonRecord;
    const offersByPhase = encounters.traitOffersByPhase as JsonRecord;
    const encounterOffers = offersByPhase.Encounter as JsonRecord;
    encounterOffers.Story_Medea_01 = encounterOffers.Story_Arachne_01;
    delete encounterOffers.Story_Arachne_01;

    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      'is not available from this encounter set',
    );
  });

  it('rejects schema 18 rather than inventing a Pom migration', () => {
    const document = encoded(loadSurfaceNOPProject());
    document.schemaVersion = 18;

    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received 18`,
    );
  });

  it('rejects schema 21 rather than inventing a trait-offer migration', () => {
    const document = encoded(loadSurfaceNOPProject());
    document.schemaVersion = 21;

    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received 21`,
    );
  });

  it('rejects schema 29 rather than migrating the generic Gorgon child', () => {
    const document = encoded(loadSurfaceNOPProject());
    document.schemaVersion = 29;

    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received 29`,
    );
  });

  it('rejects schema 30 rather than inventing an Echo Pom target migration', () => {
    const document = encoded(loadSurfaceNOPProject());
    document.schemaVersion = 30;

    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      `expected ${PROJECT_DOCUMENT_SCHEMA_VERSION}, received 30`,
    );
  });

  it.each([
    {
      label: 'a missing top-level encounter state',
      mutate: (document: JsonRecord) => {
        delete occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1)).encounters;
      },
      message: 'encounters: must be an object',
    },
    {
      label: 'a missing pooled phase selection',
      mutate: (document: JsonRecord) => {
        delete selections(occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1))).Intro;
      },
      message: 'encounterKeyByPhase.Intro: must be a string',
    },
    {
      label: 'an extra pooled phase selection',
      mutate: (document: JsonRecord) => {
        selections(occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1))).unexpected =
          'GeneratedP_PreCombat';
      },
      message: 'encounterKeyByPhase.unexpected: is not a project document field',
    },
    {
      label: 'an unknown concrete encounter key',
      mutate: (document: JsonRecord) => {
        selections(occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1))).Intro =
          'UnknownEncounter';
      },
      message: 'UnknownEncounter is not a member of PCombat03IntroEncounters',
    },
    {
      label: 'a known encounter outside the declared set',
      mutate: (document: JsonRecord) => {
        selections(occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1))).Intro =
          'GeneratedP';
      },
      message: 'GeneratedP is not a member of PCombat03IntroEncounters',
    },
    {
      label: 'a redundant fixed-phase selection',
      mutate: (document: JsonRecord) => {
        selections(occurrence(document, 'N', nOccurrenceIds.preHub)).Encounter = 'PreHubGeneratedN';
      },
      message: 'encounterKeyByPhase.Encounter: is not a project document field',
    },
    {
      label: 'a redundant empty-envelope selection',
      mutate: (document: JsonRecord) => {
        selections(occurrence(document, 'O', oOccurrenceIds.intro)).Intro = 'GeneratedO_Intro01';
      },
      message: 'encounterKeyByPhase.Intro: is not a project document field',
    },
    {
      label: 'a missing Fig Leaf phase map',
      mutate: (document: JsonRecord) => {
        delete (
          occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1)).encounters as JsonRecord
        ).figLeafSkipByPhase;
      },
      message: 'figLeafSkipByPhase: must be an object',
    },
    {
      label: 'an extra Fig Leaf phase key',
      mutate: (document: JsonRecord) => {
        figLeafSkips(occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1))).unexpected =
          true;
      },
      message: 'figLeafSkipByPhase.unexpected: is not a project document field',
    },
    {
      label: 'a non-boolean Fig Leaf phase value',
      mutate: (document: JsonRecord) => {
        figLeafSkips(occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1))).Intro = 'true';
      },
      message: 'figLeafSkipByPhase.Intro: must be a boolean',
    },
    {
      label: 'a misplaced Fig Leaf fixed-phase key',
      mutate: (document: JsonRecord) => {
        const skips = figLeafSkips(occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1)));
        delete skips.Intro;
        skips.Encounter = false;
      },
      message: 'figLeafSkipByPhase.Encounter: is not a project document field',
    },
  ])('rejects $label', ({ mutate, message }) => {
    const document = encoded(loadSurfaceNOPProject());
    mutate(document);

    expect(() => decodeProjectDocument(document, catalog)).toThrow(message);
  });
});

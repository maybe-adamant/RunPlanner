import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAllTogetherSetAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createIncomingRewardAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  createCompleteFGProject,
  createGoldenFGHProject,
  createRepresentativeNOPProject,
  goldenFBiome,
  goldenFOccurrenceId,
  nOccurrenceIds,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures';

import { createCompleteNProject } from './support/complete-n-project';

type JsonRecord = Record<string, unknown>;

function encoded(project: ProjectDocument): JsonRecord {
  return JSON.parse(encodeProjectDocument(project)) as JsonRecord;
}

function biome(document: JsonRecord, routeKey: string, biomeKey: string): JsonRecord {
  const routes = document.routes as JsonRecord[];
  const route = routes.find((candidate) => candidate.routeKey === routeKey);
  const plan = (route?.biomes as JsonRecord[] | undefined)?.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  if (plan === undefined) throw new Error(`missing ${routeKey}/${biomeKey}`);
  return plan;
}

function occurrence(document: JsonRecord, biomeKey: string, occurrenceId: string): JsonRecord {
  const topology = biome(
    document,
    biomeKey === 'F' || biomeKey === 'G' || biomeKey === 'H' || biomeKey === 'I'
      ? 'Underworld'
      : 'Surface',
    biomeKey,
  ).topology as JsonRecord;
  const value = (topology.occurrences as JsonRecord[]).find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (value === undefined) throw new Error(`missing ${biomeKey} occurrence ${occurrenceId}`);
  return value;
}

function selections(owner: JsonRecord): JsonRecord {
  return ((owner.encounters as JsonRecord).encounterKeyByPhase ?? {}) as JsonRecord;
}

function figLeafSkips(owner: JsonRecord): JsonRecord {
  return ((owner.encounters as JsonRecord).figLeafSkipByPhase ?? {}) as JsonRecord;
}

function gorgonResults(owner: JsonRecord): JsonRecord {
  return ((owner.encounters as JsonRecord).gorgonResultByPhase ?? {}) as JsonRecord;
}

function sideRoom(document: JsonRecord, occurrenceId: string, slotKey: string): JsonRecord {
  const state = occurrence(document, 'N', occurrenceId).state as JsonRecord;
  const sideRooms = state.sideRooms as JsonRecord;
  const value = sideRooms[slotKey] as JsonRecord | undefined;
  if (value === undefined) throw new Error(`missing ${slotKey}`);
  return value;
}

function arachneStoryProject(): ProjectDocument {
  const occurrenceId = goldenFOccurrenceId(7, 1);
  const occurrence = createOccurrenceAddress(goldenFBiome, occurrenceId);
  const phase = createTraitOfferAddress(
    createEncounterPhaseAddress(goldenFBiome, { kind: 'occurrence', occurrenceId }, 'Encounter'),
    'selection',
  );
  const story = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence,
    gameName: 'F_Story01',
  });
  return applyProjectCommand(story, catalog, {
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

describe('schema-41 occurrence-owned encounter persistence', () => {
  it('round-trips the exact top-level and parent-local selections', () => {
    const project = createRepresentativeNOPProject();
    const decoded = decodeProjectDocument(encoded(project), catalog);

    expect(decoded).toEqual(project);
    expect(decoded.schemaVersion).toBe(41);
  });

  it.each(['infernalContractReward', 'travelDealRefill', 'echoDoubleShopReward'] as const)(
    'rejects reserved initial Shop slot key %s at the schema-41 codec boundary',
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

  it('rejects legacy source-keyed Gold children and an ordered stable child without payload', () => {
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
      roomExit.order = [...((roomExit.order as unknown[]) ?? []), entryKey];
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
    expect(() => decodeProjectDocument(malformed('echoDoubleShopReward', false), catalog)).toThrow(
      'echoDoubleShopReward is not a Shop acquisition entry',
    );
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
    expect(encoded(decoded)).toMatchObject({ schemaVersion: 41 });
  });

  it('round-trips the exact All Together map, legal null, and one semantic set edit', () => {
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const trait = createTraitOfferAddress(reward, 'source');
    const edited = applyProjectCommand(allTogetherProject(), catalog, {
      kind: 'ReplaceAllTogetherSet',
      set: createAllTogetherSetAddress(trait, 'option1', 'earth'),
      value: 'ElementalOlympianDamageBoon',
    });
    const nulled = applyProjectCommand(edited, catalog, {
      kind: 'ReplaceAllTogetherSet',
      set: createAllTogetherSetAddress(trait, 'option1', 'water'),
      value: null,
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

  it('rejects omission of the complete All Together child in codecs and ReplaceTraitOffer', () => {
    const document = encoded(allTogetherProject());
    delete ((allTogetherOffer(document).options as JsonRecord[])[0] as JsonRecord)
      .allTogetherResult;
    expect(() => decodeProjectDocument(document, catalog)).toThrow(
      'allTogetherResult: is required by this trait',
    );

    const project = allTogetherProject();
    const commandValue = allTogetherOffer(encoded(project));
    delete ((commandValue.options as JsonRecord[])[0] as JsonRecord).allTogetherResult;
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTraitOffer',
        trait: createTraitOfferAddress(reward, 'source'),
        value: commandValue as never,
      }),
    ).toThrow('AllElementalBoon requires an All Together result');
  });

  it('rejects schema 35 rather than inventing an All Together child migration', () => {
    const document = encoded(allTogetherProject());
    document.schemaVersion = 35;
    expect(() => decodeProjectDocument(document, catalog)).toThrow('expected 41, received 35');
  });

  it('rejects schema 37 rather than migrating source-keyed Gold chronology', () => {
    const document = encoded(createCompleteFGProject());
    document.schemaVersion = 37;
    expect(() => decodeProjectDocument(document, catalog)).toThrow('expected 41, received 37');
  });

  it('rejects schema 39 rather than inventing Fields optional rewards', () => {
    const document = encoded(createGoldenFGHProject());
    document.schemaVersion = 40;
    expect(() => decodeProjectDocument(document, catalog)).toThrow('expected 41, received 40');
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

  it('rejects excluded and recursive Artificer replacement payloads', () => {
    const excluded = encoded(createCompleteFGProject());
    const gift = (occurrence(excluded, 'F', goldenFOccurrenceId(1, 1)).state as JsonRecord)
      .reward as JsonRecord;
    const spell = (occurrence(excluded, 'F', goldenFOccurrenceId(10, 2)).state as JsonRecord)
      .reward as JsonRecord;
    (gift.dispositionByAcquisitionRole as JsonRecord).self = {
      kind: 'artificer',
      replacement: spell,
    };
    expect(() => decodeProjectDocument(excluded, catalog)).toThrow(
      'must be an Artificer-eligible RunProgress reward',
    );

    const recursive = encoded(createCompleteFGProject());
    const recursiveGift = (
      occurrence(recursive, 'F', goldenFOccurrenceId(1, 1)).state as JsonRecord
    ).reward as JsonRecord;
    const maxHealth = (occurrence(recursive, 'F', goldenFOccurrenceId(3, 1)).state as JsonRecord)
      .reward as JsonRecord;
    const nested = structuredClone(maxHealth);
    (maxHealth.dispositionByAcquisitionRole as JsonRecord).self = {
      kind: 'artificer',
      replacement: nested,
    };
    (recursiveGift.dispositionByAcquisitionRole as JsonRecord).self = {
      kind: 'artificer',
      replacement: maxHealth,
    };
    expect(() => decodeProjectDocument(recursive, catalog)).toThrow(
      'Artificer replacements cannot recurse',
    );
  });

  it('round-trips complete Fig Leaf phase maps as immutable nested state', () => {
    const decoded = decodeProjectDocument(encoded(createRepresentativeNOPProject()), catalog);
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

  it('round-trips a strict Gorgon phase map and rejects malformed or misplaced children', () => {
    const project = createRepresentativeNOPProject();
    const document = encoded(project);
    const state = occurrence(document, 'P', pOccurrenceId('P_Combat03', 1, 1));
    expect(gorgonResults(state)).toEqual({ Combat: { deathDefianceConditionMet: false } });
    const decoded = decodeProjectDocument(document, catalog);
    expect(decoded).toEqual(project);

    const missing = encoded(project);
    delete (occurrence(missing, 'P', pOccurrenceId('P_Combat03', 1, 1)).encounters as JsonRecord)
      .gorgonResultByPhase;
    expect(() => decodeProjectDocument(missing, catalog)).toThrow(
      'gorgonResultByPhase: must be an object',
    );

    const extra = encoded(project);
    gorgonResults(occurrence(extra, 'P', pOccurrenceId('P_Combat03', 1, 1))).Unexpected = {
      deathDefianceConditionMet: false,
    };
    expect(() => decodeProjectDocument(extra, catalog)).toThrow(
      'gorgonResultByPhase.Unexpected: is not a project document field',
    );

    const nonBoolean = encoded(project);
    gorgonResults(occurrence(nonBoolean, 'P', pOccurrenceId('P_Combat03', 1, 1))).Combat = {
      deathDefianceConditionMet: 'true',
    };
    expect(() => decodeProjectDocument(nonBoolean, catalog)).toThrow(
      'deathDefianceConditionMet: must be a boolean',
    );

    const trueWithoutChild = encoded(project);
    gorgonResults(occurrence(trueWithoutChild, 'P', pOccurrenceId('P_Combat03', 1, 1))).Combat = {
      deathDefianceConditionMet: true,
    };
    expect(decodeProjectDocument(trueWithoutChild, catalog)).toBeDefined();

    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat03', 1, 1) },
      'Combat',
    );
    const withOffer = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    const encodedOffer = gorgonResults(
      occurrence(encoded(withOffer), 'P', pOccurrenceId('P_Combat03', 1, 1)),
    ).Combat as JsonRecord;
    expect(encodedOffer.athenaOffer).toEqual({
      traitKeys: ['InvulnerabilityDashBoon', 'RetaliateInvulnerabilityBoon', 'FocusLastStandBoon'],
      selectedOptionKey: 'option1',
    });

    const malformedOffer = encoded(withOffer);
    const offerResult = gorgonResults(
      occurrence(malformedOffer, 'P', pOccurrenceId('P_Combat03', 1, 1)),
    ).Combat as JsonRecord;
    const offer = offerResult.athenaOffer as JsonRecord;
    offer.traitKeys = (offer.traitKeys as unknown[]).slice(0, 1);
    expect(() => decodeProjectDocument(malformedOffer, catalog)).toThrow(
      'must contain exactly three distinct Athena trait identities',
    );

    const duplicateTraits = encoded(withOffer);
    const duplicateResult = gorgonResults(
      occurrence(duplicateTraits, 'P', pOccurrenceId('P_Combat03', 1, 1)),
    ).Combat as JsonRecord;
    (duplicateResult.athenaOffer as JsonRecord).traitKeys = [
      'InvulnerabilityDashBoon',
      'InvulnerabilityDashBoon',
      'FocusLastStandBoon',
    ];
    expect(() => decodeProjectDocument(duplicateTraits, catalog)).toThrow(
      'must contain exactly three distinct Athena trait identities',
    );

    for (const extraField of [
      'giverKey',
      'kind',
      'options',
      'rarificationActions',
      'deathDefianceConditionMet',
    ]) {
      const legacyField = encoded(withOffer);
      const result = gorgonResults(occurrence(legacyField, 'P', pOccurrenceId('P_Combat03', 1, 1)))
        .Combat as JsonRecord;
      (result.athenaOffer as JsonRecord)[extraField] =
        extraField === 'rarificationActions' || extraField === 'options' ? [] : 'legacy';
      expect(() => decodeProjectDocument(legacyField, catalog)).toThrow(
        `athenaOffer.${extraField}: is not a project document field`,
      );
    }
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
    const document = encoded(createRepresentativeNOPProject());
    document.schemaVersion = 18;

    expect(() => decodeProjectDocument(document, catalog)).toThrow('expected 41, received 18');
  });

  it('rejects schema 21 rather than inventing a trait-offer migration', () => {
    const document = encoded(createRepresentativeNOPProject());
    document.schemaVersion = 21;

    expect(() => decodeProjectDocument(document, catalog)).toThrow('expected 41, received 21');
  });

  it('rejects schema 29 rather than migrating the generic Gorgon child', () => {
    const document = encoded(createRepresentativeNOPProject());
    document.schemaVersion = 29;

    expect(() => decodeProjectDocument(document, catalog)).toThrow('expected 41, received 29');
  });

  it('rejects schema 30 rather than inventing an Echo Pom target migration', () => {
    const document = encoded(createRepresentativeNOPProject());
    document.schemaVersion = 30;

    expect(() => decodeProjectDocument(document, catalog)).toThrow('expected 41, received 30');
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
    const document = encoded(createRepresentativeNOPProject());
    mutate(document);

    expect(() => decodeProjectDocument(document, catalog)).toThrow(message);
  });

  it.each([
    {
      label: 'a missing local encounter state',
      mutate: (document: JsonRecord) => {
        delete sideRoom(document, 'round-trip-n-combat02', 'sideDoor1').encounters;
      },
      message: 'sideRooms.sideDoor1.encounters: must be an object',
    },
    {
      label: 'a missing local pooled selection',
      mutate: (document: JsonRecord) => {
        delete selections(sideRoom(document, 'round-trip-n-combat02', 'sideDoor1')).Encounter;
      },
      message: 'encounterKeyByPhase.Encounter: must be a string',
    },
    {
      label: 'an extra local pooled selection',
      mutate: (document: JsonRecord) => {
        selections(sideRoom(document, 'round-trip-n-combat02', 'sideDoor1')).unexpected =
          'GeneratedNSubRoom';
      },
      message: 'encounterKeyByPhase.unexpected: is not a project document field',
    },
    {
      label: 'an unknown local encounter key',
      mutate: (document: JsonRecord) => {
        selections(sideRoom(document, 'round-trip-n-combat02', 'sideDoor1')).Encounter =
          'UnknownEncounter';
      },
      message: 'UnknownEncounter is not a member of NEncountersSubRoom',
    },
    {
      label: 'a known local encounter outside the declared set',
      mutate: (document: JsonRecord) => {
        selections(sideRoom(document, 'round-trip-n-combat02', 'sideDoor1')).Encounter =
          'GeneratedN';
      },
      message: 'GeneratedN is not a member of NEncountersSubRoom',
    },
    {
      label: 'a missing local Fig Leaf phase map',
      mutate: (document: JsonRecord) => {
        delete (sideRoom(document, 'round-trip-n-combat02', 'sideDoor1').encounters as JsonRecord)
          .figLeafSkipByPhase;
      },
      message: 'figLeafSkipByPhase: must be an object',
    },
    {
      label: 'an extra local Fig Leaf phase key',
      mutate: (document: JsonRecord) => {
        figLeafSkips(sideRoom(document, 'round-trip-n-combat02', 'sideDoor1')).unexpected = true;
      },
      message: 'figLeafSkipByPhase.unexpected: is not a project document field',
    },
    {
      label: 'a mutable local Fig Leaf value',
      mutate: (document: JsonRecord) => {
        figLeafSkips(sideRoom(document, 'round-trip-n-combat02', 'sideDoor1')).Encounter = {};
      },
      message: 'figLeafSkipByPhase.Encounter: must be a boolean',
    },
  ])('rejects $label', ({ mutate, message }) => {
    const document = encoded(createCompleteNProject());
    mutate(document);

    expect(() => decodeProjectDocument(document, catalog)).toThrow(message);
  });

  it('requires every local child encounter selection to stay under its parent occurrence', () => {
    const document = encoded(createCompleteNProject());
    const parent = occurrence(document, 'N', 'round-trip-n-combat02');
    const local = sideRoom(document, 'round-trip-n-combat02', 'sideDoor1');

    expect(parent.occurrenceId).toBe(createOccurrenceId('round-trip-n-combat02'));
    expect(selections(local)).toEqual({ Encounter: 'GeneratedNSubRoom' });
  });
});

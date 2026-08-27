#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CURRENT_SCHEMA_VERSION = 63;
const SCHEMA_49_CATALOG_VERSION = '0.27.0-arcana-fear-loadout';
const SCHEMA_50_CATALOG_VERSION = '0.30.0-boon-rarity-ledger';
const SCHEMA_51_CATALOG_VERSION = '0.31.0-chaos-traits';
const SCHEMA_52_INITIAL_CATALOG_VERSION = '0.32.0-run-impacting-traits';
const SCHEMA_52_RUN_IMPACTING_TRAITS_CATALOG_VERSION = '0.32.1-run-impacting-traits';
const SCHEMA_52_GENERATED_TRAIT_PICKUPS_CATALOG_VERSION = '0.33.0-generated-trait-pickups';
const SCHEMA_52_CATALOG_VERSION = '0.34.0-sea-star';
const SCHEMA_53_CATALOG_VERSION = '0.35.0-nemesis-random-events';
const SCHEMA_54_CATALOG_VERSION = '0.36.0-runtime-offer-fallback';
const SCHEMA_55_CATALOG_VERSION = '0.37.0-automatic-completion-occurrences';
const SCHEMA_56_CATALOG_VERSION = '0.38.0-selected-resource-successes';
const SCHEMA_57_CATALOG_VERSION = '0.39.0-purging-pool';
const SCHEMA_58_CATALOG_VERSION = '0.40.0-hermes-shrine';
const SCHEMA_59_CATALOG_VERSION = '0.41.0-stygian-well';
const SCHEMA_60_CATALOG_VERSION = '0.42.0-fountain-rarity';
const SCHEMA_61_CATALOG_VERSION = '0.43.0-crystal-figurine';
const SCHEMA_62_CATALOG_VERSION = '0.44.0-concave-stone';
const SCHEMA_63_CATALOG_VERSION = '0.46.0-vow-forfeit-red-onion';
const COMPLETION_ROOMS_BY_BIOME = {
  F: { boss: 'F_Boss01', postboss: 'F_PostBoss01' },
  G: { boss: 'G_Boss01', postboss: 'G_PostBoss01' },
  H: { boss: 'H_Boss01', postboss: 'H_PostBoss01' },
  I: { boss: 'I_Boss01', postboss: 'I_PostBoss01' },
  N: { boss: 'N_Boss01', postboss: 'N_PostBoss01' },
  O: { boss: 'O_Boss01', postboss: 'O_PostBoss01' },
  P: { boss: 'P_Boss01', postboss: 'P_PostBoss01' },
  Q: { boss: 'Q_Boss01' },
};

const POSTBOSS_ROOM_FEATURES_BY_GAME_NAME = {
  F_PostBoss01: { hasRequiredFountain: true, hasKeepsakeRack: true },
  G_PostBoss01: { hasRequiredFountain: true, hasKeepsakeRack: true },
  H_PostBoss01: { hasRequiredFountain: true, hasKeepsakeRack: true },
  I_PostBoss01: { hasRequiredFountain: false, hasKeepsakeRack: false },
  N_PostBoss01: { hasRequiredFountain: true, hasKeepsakeRack: true },
  O_PostBoss01: { hasRequiredFountain: true, hasKeepsakeRack: true },
  P_PostBoss01: { hasRequiredFountain: true, hasKeepsakeRack: true },
};

const NARCISSUS_PICKUP_KEYS = {
  NarcissusA: ['pom'],
  NarcissusB: ['ashes'],
  NarcissusC: ['currency'],
  NarcissusD: ['psyche', 'maxMana'],
  NarcissusE: ['bones', 'maxHealth'],
  NarcissusG: ['elementalBoost1', 'elementalBoost2'],
  NarcissusH: ['lastStand'],
  NarcissusI: ['mysteryBoon'],
};

function expectRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function visitRecords(value, visitor) {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) visitRecords(item, visitor);
    return;
  }
  visitor(value);
  for (const child of Object.values(value)) visitRecords(child, visitor);
}

function migrate49To50(document) {
  if (document.catalogVersion !== SCHEMA_49_CATALOG_VERSION) {
    throw new Error(
      `schema 49 migration expects catalog ${SCHEMA_49_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }

  let unresolvedSpellDropsAdded = 0;
  visitRecords(document, (record) => {
    const offer = record.offer;
    if (
      offer === null ||
      typeof offer !== 'object' ||
      Array.isArray(offer) ||
      offer.rewardType !== 'SpellDrop'
    ) {
      return;
    }

    const traitOffers = expectRecord(
      record.traitOffersByAcquisitionRole,
      'SpellDrop.traitOffersByAcquisitionRole',
    );
    if (!Object.hasOwn(traitOffers, 'self')) {
      traitOffers.self = null;
      unresolvedSpellDropsAdded += 1;
    }
  });

  document.schemaVersion = 50;
  document.catalogVersion = SCHEMA_50_CATALOG_VERSION;
  return { unresolvedSpellDropsAdded };
}

function migrate50To51(document) {
  if (document.catalogVersion !== SCHEMA_50_CATALOG_VERSION) {
    throw new Error(
      `schema 50 migration expects catalog ${SCHEMA_50_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  let unresolvedTrialUpgradesAdded = 0;
  visitRecords(document, (record) => {
    const offer = record.offer;
    if (
      offer === null ||
      typeof offer !== 'object' ||
      Array.isArray(offer) ||
      offer.rewardType !== 'TrialUpgrade'
    )
      return;
    const traitOffers = expectRecord(
      record.traitOffersByAcquisitionRole,
      'TrialUpgrade.traitOffersByAcquisitionRole',
    );
    if (!Object.hasOwn(traitOffers, 'self')) {
      traitOffers.self = null;
      unresolvedTrialUpgradesAdded += 1;
    }
  });
  document.schemaVersion = 51;
  document.catalogVersion = SCHEMA_51_CATALOG_VERSION;
  return { unresolvedTrialUpgradesAdded };
}

function migrate51To52(document) {
  if (document.catalogVersion !== SCHEMA_51_CATALOG_VERSION) {
    throw new Error(
      `schema 51 migration expects catalog ${SCHEMA_51_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  document.schemaVersion = 52;
  document.catalogVersion = SCHEMA_52_INITIAL_CATALOG_VERSION;
  return {};
}

function traitGeneratedSiteKey(
  routeKey,
  biomeKey,
  occurrenceId,
  phaseKey,
  encounterKey,
  optionKey,
) {
  const encounter = JSON.stringify([
    'encounterPhase',
    routeKey,
    biomeKey,
    { kind: 'occurrence', occurrenceId },
    phaseKey,
  ]);
  const source = JSON.stringify(['traitOffer', routeKey, biomeKey, encounter, encounterKey]);
  return `traitGenerated:${encodeURIComponent(source)}:${optionKey}`;
}

function migrateLegacyNarcissusPickupSites(document) {
  let generatedPickupSitesMoved = 0;
  for (const route of document.routes ?? []) {
    for (const biome of route.biomes ?? []) {
      for (const occurrence of biome.topology?.occurrences ?? []) {
        const roomExitEntries = occurrence.acquisitionSites?.roomExit?.pickupEntries;
        if (roomExitEntries === undefined) continue;
        for (const [phaseKey, offers] of Object.entries(
          occurrence.encounters?.traitOffersByPhase ?? {},
        )) {
          for (const [encounterKey, offer] of Object.entries(offers)) {
            if (offer === null || typeof offer !== 'object' || Array.isArray(offer)) continue;
            const options = offer.options;
            const selectedOptionKey = offer.selectedOptionKey;
            if (!Array.isArray(options) || typeof selectedOptionKey !== 'string') continue;
            const optionIndex = Number(selectedOptionKey.replace('option', '')) - 1;
            const traitKey = options[optionIndex]?.traitKey;
            const pickupKeys = NARCISSUS_PICKUP_KEYS[traitKey];
            if (
              pickupKeys === undefined ||
              !pickupKeys.some((key) => Object.hasOwn(roomExitEntries, key))
            )
              continue;
            const siteKey = traitGeneratedSiteKey(
              route.routeKey,
              biome.biomeKey,
              occurrence.occurrenceId,
              phaseKey,
              encounterKey,
              selectedOptionKey,
            );
            const site = occurrence.acquisitionSites[siteKey] ?? { pickupEntries: {} };
            for (const pickupKey of pickupKeys) {
              if (!Object.hasOwn(roomExitEntries, pickupKey)) continue;
              site.pickupEntries[pickupKey] = roomExitEntries[pickupKey];
              delete roomExitEntries[pickupKey];
            }
            occurrence.acquisitionSites[siteKey] = site;
            generatedPickupSitesMoved += 1;
          }
        }
        if (Object.keys(roomExitEntries).length === 0) delete occurrence.acquisitionSites.roomExit;
      }
    }
  }
  return generatedPickupSitesMoved;
}

function migrateSchema52Catalog(document) {
  const migrations = [];
  if (document.catalogVersion === SCHEMA_52_INITIAL_CATALOG_VERSION) {
    document.catalogVersion = SCHEMA_52_RUN_IMPACTING_TRAITS_CATALOG_VERSION;
    migrations.push(`${SCHEMA_52_INITIAL_CATALOG_VERSION}->${document.catalogVersion}`);
  }
  if (document.catalogVersion === SCHEMA_52_RUN_IMPACTING_TRAITS_CATALOG_VERSION) {
    document.catalogVersion = SCHEMA_52_GENERATED_TRAIT_PICKUPS_CATALOG_VERSION;
    migrations.push(
      `${SCHEMA_52_RUN_IMPACTING_TRAITS_CATALOG_VERSION}->${document.catalogVersion}`,
    );
  }
  if (document.catalogVersion === SCHEMA_52_GENERATED_TRAIT_PICKUPS_CATALOG_VERSION) {
    document.catalogVersion = SCHEMA_52_CATALOG_VERSION;
    migrations.push(
      `${SCHEMA_52_GENERATED_TRAIT_PICKUPS_CATALOG_VERSION}->${document.catalogVersion}`,
    );
  }
  if (document.catalogVersion !== SCHEMA_52_CATALOG_VERSION) {
    throw new Error(
      `schema 52 migration expects catalog ${SCHEMA_52_INITIAL_CATALOG_VERSION}, ${SCHEMA_52_RUN_IMPACTING_TRAITS_CATALOG_VERSION}, ${SCHEMA_52_GENERATED_TRAIT_PICKUPS_CATALOG_VERSION}, or ${SCHEMA_52_CATALOG_VERSION}; received ${String(document.catalogVersion)}`,
    );
  }
  const generatedPickupSitesMoved = migrateLegacyNarcissusPickupSites(document);
  return { migrations, generatedPickupSitesMoved };
}

function migrate52To53(document) {
  const catalogMigration = migrateSchema52Catalog(document);
  document.schemaVersion = 53;
  document.catalogVersion = SCHEMA_53_CATALOG_VERSION;
  return {
    catalogMigrations: catalogMigration.migrations,
    generatedPickupSitesMoved: catalogMigration.generatedPickupSitesMoved,
  };
}

function migrate53To54(document) {
  if (document.catalogVersion !== SCHEMA_53_CATALOG_VERSION) {
    throw new Error(
      `schema 53 migration expects catalog ${SCHEMA_53_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  let gorgonTriggersRenamed = 0;
  for (const route of document.routes ?? []) {
    for (const biome of route.biomes ?? []) {
      for (const occurrence of biome.topology?.occurrences ?? []) {
        for (const result of Object.values(occurrence.encounters?.gorgonResultByPhase ?? {})) {
          if (result === null || typeof result !== 'object' || Array.isArray(result)) continue;
          if (!Object.hasOwn(result, 'deathDefianceConditionMet')) continue;
          result.athenaTriggerConditionMet = result.deathDefianceConditionMet;
          delete result.deathDefianceConditionMet;
          gorgonTriggersRenamed += 1;
        }
      }
    }
  }
  let genericConditionsRemoved = 0;
  visitRecords(document, (record) => {
    if (!Object.hasOwn(record, 'deathDefianceConditionMet')) return;
    delete record.deathDefianceConditionMet;
    genericConditionsRemoved += 1;
  });
  document.schemaVersion = 54;
  document.catalogVersion = SCHEMA_54_CATALOG_VERSION;
  return { gorgonTriggersRenamed, genericConditionsRemoved };
}

function migrate54To55(document) {
  if (document.catalogVersion !== SCHEMA_54_CATALOG_VERSION) {
    throw new Error(
      `schema 54 migration expects catalog ${SCHEMA_54_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  let completionOccurrencesAdded = 0;
  for (const route of document.routes ?? []) {
    for (const biome of route.biomes ?? []) {
      const completion = [];
      const rooms = COMPLETION_ROOMS_BY_BIOME[biome.biomeKey];
      // Earlier generic migration vectors deliberately contain non-biome
      // records. They have no completion sidecars to relocate.
      if (rooms === undefined) continue;
      for (const role of ['boss', 'postboss']) {
        const gameName = rooms[role];
        if (gameName === undefined) continue;
        const occurrence = {
          occurrenceId: `completion:${biome.biomeKey}:${role}`,
          gameName,
          state: { kind: 'none' },
          encounters: {
            encounterKeyByPhase: {},
            figLeafSkipByPhase: { Encounter: false },
            gorgonResultByPhase: {},
          },
          roomActions: { order: [] },
          additionalExits: [],
        };
        if (role === 'boss') {
          if (biome.bossCompletionArcanaKeys !== undefined)
            occurrence.encounters.judgmentArcanaKeysByPhase = {
              Encounter: biome.bossCompletionArcanaKeys,
            };
          if (biome.bossCompletionSteadyGrowthTarget !== undefined)
            occurrence.encounters.steadyGrowthTargetByPhase = {
              Encounter: biome.bossCompletionSteadyGrowthTarget,
            };
        }
        if (role === 'postboss') {
          const features = POSTBOSS_ROOM_FEATURES_BY_GAME_NAME[gameName];
          if (features?.hasKeepsakeRack === true) {
            occurrence.keepsakeRack = {
              disposition: biome.postbossKeepsakeDisposition ?? { kind: 'retain' },
              ...(biome.keepsakeEquipResults === undefined
                ? {}
                : { equipResults: biome.keepsakeEquipResults }),
            };
          }
          occurrence.roomActions =
            biome.postbossRoomActions ??
            (features?.hasRequiredFountain === true
              ? { order: [{ kind: 'useFountain' }] }
              : occurrence.roomActions);
        }
        completion.push(occurrence);
      }
      biome.completionOccurrences = completion;
      delete biome.bossCompletionArcanaKeys;
      delete biome.bossCompletionSteadyGrowthTarget;
      delete biome.postbossKeepsakeDisposition;
      delete biome.postbossRoomActions;
      delete biome.keepsakeEquipResults;
      completionOccurrencesAdded += completion.length;
    }
  }
  document.schemaVersion = 55;
  document.catalogVersion = SCHEMA_55_CATALOG_VERSION;
  return { completionOccurrencesAdded };
}

function migrate55To56(document) {
  if (document.catalogVersion !== SCHEMA_55_CATALOG_VERSION) {
    throw new Error(
      `schema 55 migration expects catalog ${SCHEMA_55_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  let routePlacementsAdded = 0;
  for (const route of document.routes ?? []) {
    route.resourcePlacements = { Pickaxe: null, Exorcism: null, Shovel: null, Fishing: null };
    routePlacementsAdded += 1;
  }
  document.schemaVersion = 56;
  document.catalogVersion = SCHEMA_56_CATALOG_VERSION;
  return { routePlacementsAdded };
}

function migrate56To57(document) {
  if (document.catalogVersion !== SCHEMA_56_CATALOG_VERSION) {
    throw new Error(
      `schema 56 migration expects catalog ${SCHEMA_56_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  let poolsAdded = 0;
  for (const route of document.routes ?? []) {
    for (const biome of route.biomes ?? []) {
      for (const occurrence of biome.completionOccurrences ?? []) {
        if (!['F_PostBoss01', 'G_PostBoss01', 'H_PostBoss01'].includes(occurrence.gameName))
          continue;
        occurrence.purgingPool = {
          interacted: false,
          traitKeyBySlot: { left: null, middle: null, right: null },
        };
        poolsAdded += 1;
      }
    }
  }
  document.schemaVersion = 57;
  document.catalogVersion = SCHEMA_57_CATALOG_VERSION;
  return { poolsAdded };
}

function migrate57To58(document) {
  if (document.catalogVersion !== SCHEMA_57_CATALOG_VERSION) {
    throw new Error(
      `schema 57 migration expects catalog ${SCHEMA_57_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  let shrinesAdded = 0;
  for (const route of document.routes ?? []) {
    if (route.routeKey !== 'Surface') continue;
    for (const biome of route.biomes ?? []) {
      if (!['N', 'O', 'P'].includes(biome.biomeKey)) continue;
      for (const occurrence of biome.completionOccurrences ?? []) {
        if (
          occurrence.occurrenceId !== `completion:${biome.biomeKey}:postboss` ||
          occurrence.gameName !== `${biome.biomeKey}_PostBoss01` ||
          occurrence.hermesShrine !== undefined
        )
          continue;
        occurrence.hermesShrine = {
          offerBySlot: { first: null, secondLeft: null, secondRight: null },
        };
        shrinesAdded += 1;
      }
    }
  }
  document.schemaVersion = 58;
  document.catalogVersion = SCHEMA_58_CATALOG_VERSION;
  return { shrinesAdded };
}

function migrate58To59(document) {
  if (document.catalogVersion !== SCHEMA_58_CATALOG_VERSION) {
    throw new Error(
      `schema 58 migration expects catalog ${SCHEMA_58_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  let wellsAdded = 0;
  for (const route of document.routes ?? []) {
    if (route.routeKey !== 'Underworld') continue;
    for (const biome of route.biomes ?? []) {
      if (!['F', 'G', 'H'].includes(biome.biomeKey)) continue;
      for (const [index, occurrence] of (biome.completionOccurrences ?? []).entries()) {
        if (
          occurrence.occurrenceId !== `completion:${biome.biomeKey}:postboss` ||
          occurrence.gameName !== `${biome.biomeKey}_PostBoss01` ||
          occurrence.stygianWell !== undefined
        )
          continue;
        const { additionalExits, acquisitionSites, keepsakeRack, ...beforeAdditional } = occurrence;
        biome.completionOccurrences[index] = {
          ...beforeAdditional,
          stygianWell: {
            interacted: false,
            offerKeyBySlot: { healing: null, secondLeft: null, secondRight: null },
          },
          additionalExits,
          ...(acquisitionSites === undefined ? {} : { acquisitionSites }),
          ...(keepsakeRack === undefined ? {} : { keepsakeRack }),
        };
        wellsAdded += 1;
      }
    }
  }
  document.schemaVersion = 59;
  document.catalogVersion = SCHEMA_59_CATALOG_VERSION;
  return { wellsAdded };
}

function migrate59To60(document) {
  if (document.catalogVersion !== SCHEMA_59_CATALOG_VERSION) {
    throw new Error(
      `schema 59 migration expects catalog ${SCHEMA_59_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  document.schemaVersion = 60;
  document.catalogVersion = SCHEMA_60_CATALOG_VERSION;
  return {};
}

function migrate60To61(document) {
  if (document.catalogVersion !== SCHEMA_60_CATALOG_VERSION) {
    throw new Error(
      `schema 60 migration expects catalog ${SCHEMA_60_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  document.schemaVersion = 61;
  document.catalogVersion = SCHEMA_61_CATALOG_VERSION;
  return {};
}

function migrate61To62(document) {
  if (document.catalogVersion !== SCHEMA_61_CATALOG_VERSION) {
    throw new Error(
      `schema 61 migration expects catalog ${SCHEMA_61_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  document.schemaVersion = 62;
  document.catalogVersion = SCHEMA_62_CATALOG_VERSION;
  return {};
}

function migrate62To63(document) {
  if (document.catalogVersion !== SCHEMA_62_CATALOG_VERSION) {
    throw new Error(
      `schema 62 migration expects catalog ${SCHEMA_62_CATALOG_VERSION}, received ${String(document.catalogVersion)}`,
    );
  }
  document.schemaVersion = 63;
  document.catalogVersion = SCHEMA_63_CATALOG_VERSION;
  return {};
}

const migrations = new Map([
  [49, migrate49To50],
  [50, migrate50To51],
  [51, migrate51To52],
  [52, migrate52To53],
  [53, migrate53To54],
  [54, migrate54To55],
  [55, migrate55To56],
  [56, migrate56To57],
  [57, migrate57To58],
  [58, migrate58To59],
  [59, migrate59To60],
  [60, migrate60To61],
  [61, migrate61To62],
  [62, migrate62To63],
]);

export function migrateProjectDocument(value, targetVersion = CURRENT_SCHEMA_VERSION) {
  const document = structuredClone(expectRecord(value, 'project document'));
  const sourceVersion = document.schemaVersion;
  if (!Number.isInteger(sourceVersion)) throw new Error('schemaVersion must be an integer');
  if (!Number.isInteger(targetVersion)) throw new Error('target schema must be an integer');
  if (sourceVersion > targetVersion) {
    throw new Error(`cannot migrate schema ${sourceVersion} backwards to ${targetVersion}`);
  }

  const steps = [];
  const changes = {};
  while (document.schemaVersion < targetVersion) {
    const from = document.schemaVersion;
    const migrate = migrations.get(from);
    if (migrate === undefined) {
      throw new Error(`no migration is registered for schema ${from} -> ${from + 1}`);
    }
    const stepChanges = migrate(document);
    if (document.schemaVersion !== from + 1) {
      throw new Error(`schema ${from} migration did not produce schema ${from + 1}`);
    }
    steps.push(`${from}->${from + 1}`);
    changes[`${from}->${from + 1}`] = stepChanges;
  }
  if (document.schemaVersion === 52 && targetVersion === 52) {
    const catalogMigration = migrateSchema52Catalog(document);
    for (const step of catalogMigration.migrations) {
      steps.push(step);
      changes[step] = {};
    }
    if (catalogMigration.generatedPickupSitesMoved > 0) {
      changes['generatedPickupSites'] = {
        moved: catalogMigration.generatedPickupSitesMoved,
      };
    }
  }

  return Object.freeze({
    document,
    sourceVersion,
    targetVersion,
    steps: Object.freeze(steps),
    changes: Object.freeze(changes),
  });
}

function defaultOutputPath(inputPath, targetVersion) {
  const extension = extname(inputPath);
  const stem = basename(inputPath, extension);
  const migratedStem = /-schema\d+$/.test(stem)
    ? stem.replace(/-schema\d+$/, `-schema${targetVersion}`)
    : `${stem}-schema${targetVersion}`;
  return join(dirname(inputPath), `${migratedStem}${extension}`);
}

function usage() {
  return [
    'Usage:',
    '  node schema/migrate-project.js [--target VERSION] [--output FILE | --in-place] INPUT',
    '',
    'Without --output or --in-place, writes a sibling file suffixed with the target schema.',
  ].join('\n');
}

function parseArguments(argv) {
  let targetVersion = CURRENT_SCHEMA_VERSION;
  let outputPath;
  let inPlace = false;
  let inputPath;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--target') {
      const raw = argv[index + 1];
      if (raw === undefined) throw new Error('--target requires a version');
      targetVersion = Number(raw);
      index += 1;
    } else if (argument === '--output') {
      outputPath = argv[index + 1];
      if (outputPath === undefined) throw new Error('--output requires a file');
      index += 1;
    } else if (argument === '--in-place') {
      inPlace = true;
    } else if (argument === '--help' || argument === '-h') {
      return { help: true };
    } else if (argument.startsWith('-')) {
      throw new Error(`unknown option ${argument}`);
    } else if (inputPath === undefined) {
      inputPath = argument;
    } else {
      throw new Error(`unexpected argument ${argument}`);
    }
  }

  if (inputPath === undefined) throw new Error('an input file is required');
  if (inPlace && outputPath !== undefined)
    throw new Error('choose --output or --in-place, not both');
  return { help: false, inputPath, outputPath, inPlace, targetVersion };
}

async function main(argv) {
  const options = parseArguments(argv);
  if (options.help) {
    console.log(usage());
    return;
  }

  const raw = await readFile(options.inputPath, 'utf8');
  const result = migrateProjectDocument(JSON.parse(raw), options.targetVersion);
  const outputPath = options.inPlace
    ? options.inputPath
    : (options.outputPath ?? defaultOutputPath(options.inputPath, options.targetVersion));
  await writeFile(outputPath, `${JSON.stringify(result.document, null, 2)}\n`, 'utf8');

  const detail = result.steps
    .map((step) => {
      const changes = result.changes[step];
      return `${step} (${Object.entries(changes)
        .map(([key, count]) => `${key}: ${count}`)
        .join(', ')})`;
    })
    .join(', ');
  console.log(`Migrated ${options.inputPath}`);
  console.log(`Wrote ${outputPath}`);
  console.log(detail.length === 0 ? `Already at schema ${result.targetVersion}` : detail);
}

const invokedPath = process.argv[1] === undefined ? undefined : pathToFileURL(process.argv[1]).href;
if (invokedPath === import.meta.url) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exitCode = 1;
  });
}

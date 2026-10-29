import { resolveRoutePosition } from '../route-context';
import { assessPublicDreamItinerary } from '../dream-itinerary';
import { dreamItineraryKeptBiomeCount } from '../dream-itinerary-replacement';
import { routeInitialProfile } from '../route-profile';
import type { Catalog } from '../../catalog-schema';
import { createInitialBiomeState, replaceBiomeStateField } from '../biomeState';
import { assessStartingArcanaGrasp } from '../loadout';
import {
  RUN_MODIFIER_DECLARATIONS,
  decodeRunModifiers,
  encodeRunModifiers,
  routeRunModifiers,
  sameRunModifierValue,
} from '../run-modifiers';
import { createDefaultAuthoredHexTree, normalizeAuthoredHexTree } from '../traits/hex-tree';
import { resolveCompletionBoss } from '../completion-boss';
import { createDefaultStartTopology } from '../topology/construction';
import { fixedCompletionOccurrenceId } from '../fixed-room-links';
import { createDefaultRoomState } from '../room-state/defaults';
import { createDefaultRoomEncounterState } from '../room-state/encounter-envelope';
import { reconcileReplacementRoomState } from '../room-state/replacement';
import { reconcileRoomEncounterState } from '../room-state/encounter-reconciliation';
import { createUnresolvedAcquisitionRewardState } from '../traits/state';
import { startingRewardAcquisitionFrom } from '../room-state/starting-reward';
import type { ProjectDocument } from '../model';
import { decodePracticeStart, samePracticeStart } from '../practice-start';
import { decodeDraftSpec, sameDraftSpec } from '../draft-spec';
import { EMPTY_RESOURCE_PLACEMENTS } from '../defaults';
import { normalizeProjectName, PROJECT_NAME_MAX } from '../project-name';

import { failCommand, locateBiome, withBiome } from './contract';
import type { ProjectStateCommand } from './types';

function routeForCommand(
  document: ProjectDocument,
  catalog: Catalog,
  command: Extract<
    ProjectStateCommand,
    | { readonly kind: 'ReplaceStartingReward' }
    | { readonly kind: 'ReplaceRouteLoadout' }
    | { readonly kind: 'ReplaceFamiliar' }
    | { readonly kind: 'ReplaceAspectHexTree' }
    | { readonly kind: 'ReplaceManualArcanaSelection' }
    | { readonly kind: 'ReplaceFearVowRank' }
    | { readonly kind: 'ReplaceStartingKeepsake' }
  >,
) {
  const routeKey =
    command.kind === 'ReplaceStartingKeepsake'
      ? command.selection.routeKey
      : command.kind === 'ReplaceStartingReward'
        ? command.reward.routeKey
        : command.route.routeKey;
  if (document.route.routeKey !== routeKey)
    failCommand(command, `project is missing route ${routeKey}`);
  // A fresh profile's starting loadout is fixed; it has no authored selections.
  if (routeInitialProfile(catalog, routeKey).kind === 'freshFile')
    failCommand(command, 'the Fresh File starting loadout is fixed');
  return { route: document.route };
}

function isSeleneAspect(catalog: Catalog, aspectKey: string | null): boolean {
  return (
    aspectKey !== null &&
    catalog.aspects.byKey[aspectKey]?.startingTrait?.traitKey === 'SpellMoonBeamTrait'
  );
}

/** Placements name hosts in the replaced biomes, so they reset unless the command gives new ones. */
function replaceRoute(
  document: ProjectDocument,
  catalog: Catalog,
  command: Extract<ProjectStateCommand, { readonly kind: 'ReplaceRoute' }>,
): ProjectDocument {
  const route = document.route;
  if (route.routeKey !== command.route.routeKey)
    failCommand(command, `project is missing route ${command.route.routeKey}`);
  if (command.biomes.length === 0 || command.biomes.length > route.itineraryBiomeKeys.length)
    failCommand(command, `must plan 1 to ${route.itineraryBiomeKeys.length} itinerary biomes`);
  command.biomes.forEach((biome, index) => {
    if (biome.biomeKey !== route.itineraryBiomeKeys[index])
      failCommand(command, `biome ${index} must be ${route.itineraryBiomeKeys[index]}`);
  });
  const startingReward = command.loadout.startingReward;
  if (
    startingReward !== null &&
    !catalog.runStartReward.incomingReward.allowedRewardTypes.includes(startingReward.rewardType)
  )
    failCommand(command, 'reward is not allowed by the run-start binding');
  const placements = command.resourcePlacements ?? EMPTY_RESOURCE_PLACEMENTS;
  for (const [family, placement] of Object.entries(placements)) {
    if (placement === null) continue;
    const host = command.biomes
      .find((biome) => biome.biomeKey === placement.biomeKey)
      ?.topology?.occurrences.some(
        (occurrence) => occurrence.occurrenceId === placement.occurrenceId,
      );
    if (host !== true)
      failCommand(command, `${family} placement names no occurrence in the biomes`);
  }
  const runModifiers = route.loadout.runModifiers;
  return Object.freeze({
    ...document,
    route: Object.freeze({
      ...route,
      loadout: Object.freeze({
        ...command.loadout,
        ...(runModifiers === undefined ? {} : { runModifiers }),
      }),
      resourcePlacements: placements,
      biomes: Object.freeze([...command.biomes]),
    }),
  });
}

function configureRoutePrefix(
  document: ProjectDocument,
  catalog: Catalog,
  command: Extract<ProjectStateCommand, { readonly kind: 'ConfigureRoutePrefix' }>,
): ProjectDocument {
  const routeDeclaration = catalog.routes.byKey[command.route.routeKey];
  if (routeDeclaration === undefined) {
    failCommand(command, `unknown route ${command.route.routeKey}`);
  }
  const configuredBiomeCount = command.configuredBiomeCount;
  if (!Number.isInteger(configuredBiomeCount) || configuredBiomeCount < 0) {
    failCommand(command, 'configuredBiomeCount must be a non-negative integer');
  }
  if (configuredBiomeCount > document.route.itineraryBiomeKeys.length) {
    failCommand(
      command,
      `configuredBiomeCount exceeds the ${document.route.itineraryBiomeKeys.length}-biome itinerary`,
    );
  }
  if (document.route.routeKey !== command.route.routeKey) {
    failCommand(command, `project is missing route ${command.route.routeKey}`);
  }
  const route = document.route;
  if (route.biomes.length === configuredBiomeCount) {
    return document;
  }

  const retainedBiomes = route.biomes.slice(0, configuredBiomeCount);
  const addedBiomes = route.itineraryBiomeKeys
    .slice(route.biomes.length, configuredBiomeCount)
    .map((biomeKey) => {
      const layout = catalog.biomeLayouts.byKey[biomeKey];
      if (layout === undefined) {
        failCommand(command, `${biomeKey} has no authored plan initializer`);
      }
      return {
        biomeKey,
        state: createInitialBiomeState(layout),
        topology: createDefaultStartTopology(
          catalog,
          layout,
          resolveRoutePosition(catalog, route, biomeKey),
          route.loadout,
        ),
      };
    });
  const replacement = { ...route, biomes: [...retainedBiomes, ...addedBiomes] };
  return {
    ...document,
    route: replacement,
  };
}

function withoutBiomeKeys<Value>(
  record: Readonly<Record<string, Value>>,
  dropped: ReadonlySet<string>,
): Readonly<Record<string, Value>> {
  return Object.keys(record).some((key) => dropped.has(key))
    ? Object.freeze(Object.fromEntries(Object.entries(record).filter(([key]) => !dropped.has(key))))
    : record;
}

/**
 * Keeps the biomes whose keys match the new itinerary position by position
 * from its start. Every later position is dropped with its authored content
 * and route-level per-biome settings, and fresh default biomes keep the
 * authored prefix as long as before.
 */
function replaceDreamItinerary(
  document: ProjectDocument,
  catalog: Catalog,
  command: Extract<ProjectStateCommand, { readonly kind: 'ReplaceDreamItinerary' }>,
): ProjectDocument {
  const route = document.route;
  if (route.routeKey !== command.route.routeKey)
    failCommand(command, `project is missing route ${command.route.routeKey}`);
  if (catalog.routes.byKey[route.routeKey]?.dreamItinerary === undefined)
    failCommand(command, `${route.routeKey} uses a fixed route order`);
  const itineraryBiomeKeys = command.itineraryBiomeKeys;
  if (!assessPublicDreamItinerary(catalog, itineraryBiomeKeys).legal)
    failCommand(command, 'Dream Dive requires four biomes in a valid route order');
  const keptCount = dreamItineraryKeptBiomeCount(route.itineraryBiomeKeys, itineraryBiomeKeys);
  if (keptCount === itineraryBiomeKeys.length && keptCount === route.itineraryBiomeKeys.length)
    return document;
  const dropped = new Set(route.itineraryBiomeKeys.slice(keptCount));
  const nextRoute = { ...route, itineraryBiomeKeys: Object.freeze([...itineraryBiomeKeys]) };
  const keptBiomes = route.biomes.slice(0, keptCount);
  const freshBiomes = itineraryBiomeKeys
    .slice(keptBiomes.length, route.biomes.length)
    .map((biomeKey) => {
      const layout = catalog.biomeLayouts.byKey[biomeKey];
      if (layout === undefined)
        failCommand(command, `${biomeKey} has no authored plan initializer`);
      return Object.freeze({
        biomeKey,
        state: createInitialBiomeState(layout),
        topology: createDefaultStartTopology(
          catalog,
          layout,
          resolveRoutePosition(catalog, nextRoute, biomeKey),
          route.loadout,
        ),
      });
    });
  const placements = Object.freeze(
    Object.fromEntries(
      Object.entries(route.resourcePlacements).map(([family, placement]) => [
        family,
        placement !== null && dropped.has(placement.biomeKey) ? null : placement,
      ]),
    ),
  ) as typeof route.resourcePlacements;
  const draft = route.draft;
  const godBoonsByBiome =
    draft.godBoonsByBiome === undefined
      ? undefined
      : withoutBiomeKeys(draft.godBoonsByBiome, dropped);
  const { godBoonsByBiome: _previousGodBoons, ...draftRest } = draft;
  void _previousGodBoons;
  const { practiceStart, ...routeRest } = nextRoute;
  return Object.freeze({
    ...document,
    route: Object.freeze({
      ...routeRest,
      ...(practiceStart === undefined || dropped.has(practiceStart.biomeKey)
        ? {}
        : { practiceStart }),
      resourcePlacements: placements,
      draft: Object.freeze({
        ...draftRest,
        storyNpcByBiome: withoutBiomeKeys(draft.storyNpcByBiome, dropped),
        fieldNpcsByBiome: withoutBiomeKeys(draft.fieldNpcsByBiome, dropped),
        rackKeepsakeByBiome: withoutBiomeKeys(draft.rackKeepsakeByBiome, dropped),
        ...(godBoonsByBiome === undefined || Object.keys(godBoonsByBiome).length === 0
          ? {}
          : { godBoonsByBiome }),
      }),
      biomes: Object.freeze([...keptBiomes, ...freshBiomes]),
    }),
  });
}

/** Rivals changes physical fixed Boss declarations without changing topology ownership. */
function reconcileCompletionBosses(
  document: ProjectDocument,
  catalog: Catalog,
  rivalsRank: number,
): ProjectDocument {
  const route = document.route;
  let changed = false;
  const biomes = route.biomes.map((plan) => {
    const topology = plan.topology;
    if (topology === null) return plan;
    const expected = resolveCompletionBoss(
      catalog,
      resolveRoutePosition(catalog, route, plan.biomeKey),
      rivalsRank,
    );
    const occurrences = topology.occurrences.map((occurrence) => {
      const prebossLink = topology.fixedRoomLinks.find(
        (link) => link.targetOccurrenceId === occurrence.occurrenceId,
      );
      if (
        prebossLink === undefined ||
        occurrence.occurrenceId !==
          fixedCompletionOccurrenceId(prebossLink.sourceOccurrenceId, 'boss') ||
        occurrence.gameName === expected.gameName
      ) {
        return occurrence;
      }
      const previous = catalog.rooms.byKey[occurrence.gameName];
      if (previous?.kind !== 'Boss') return occurrence;
      const replacementState = createDefaultRoomState(catalog, expected, {
        routeKey: route.routeKey,
        role: 'ordinary',
        entryActive: true,
        loadout: route.loadout,
      });
      const replacementEncounters = createDefaultRoomEncounterState(
        catalog,
        expected,
        `occurrences.${occurrence.occurrenceId}.encounters`,
      );
      changed = true;
      return Object.freeze({
        ...occurrence,
        gameName: expected.gameName,
        state: reconcileReplacementRoomState(
          catalog,
          previous,
          occurrence.state,
          expected,
          replacementState,
        ),
        encounters: reconcileRoomEncounterState(
          catalog,
          previous,
          occurrence.encounters,
          expected,
          replacementEncounters,
        ),
      });
    });
    if (!occurrences.some((occurrence, index) => occurrence !== topology.occurrences[index]))
      return plan;
    return Object.freeze({
      ...plan,
      topology: Object.freeze({ ...topology, occurrences: Object.freeze(occurrences) }),
    });
  });
  return changed
    ? Object.freeze({
        ...document,
        route: Object.freeze({ ...route, biomes: Object.freeze(biomes) }),
      })
    : document;
}

export function applyProjectStateCommand(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectStateCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'RenameProject': {
      const name = normalizeProjectName(command.name);
      if (name === null)
        failCommand(command, `name must be non-blank and at most ${PROJECT_NAME_MAX} characters`);
      if (name === document.name) return document;
      return Object.freeze({ ...document, name });
    }
    case 'ReplaceStartingReward': {
      const { route } = routeForCommand(document, catalog, command);
      const binding = catalog.runStartReward.incomingReward;
      if (
        command.value !== null &&
        !binding.allowedRewardTypes.includes(command.value.rewardType)
      ) {
        failCommand(command, 'reward is not allowed by the run-start binding');
      }
      if (JSON.stringify(route.loadout.startingReward) === JSON.stringify(command.value))
        return document;
      const firstPlan = route.biomes[0];
      const topology = firstPlan?.topology;
      const start = topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === topology.startOccurrenceId,
      );
      const acquisition =
        command.value === null
          ? undefined
          : (() => {
              const reward = createUnresolvedAcquisitionRewardState(
                catalog,
                command.value,
                {
                  kind: 'producerLifecycle',
                  key: binding.producerLifecycleKey,
                },
                route.routeKey,
              );
              return startingRewardAcquisitionFrom(reward);
            })();
      const biomes: ProjectDocument['route']['biomes'] =
        topology === undefined ||
        topology === null ||
        start === undefined ||
        firstPlan === undefined
          ? route.biomes
          : route.biomes.map((plan, index) =>
              index !== 0
                ? plan
                : Object.freeze({
                    ...plan,
                    topology: Object.freeze({
                      startOccurrenceId: topology.startOccurrenceId,
                      decisions: topology.decisions,
                      fixedRoomLinks: topology.fixedRoomLinks,
                      occurrences: Object.freeze(
                        topology.occurrences.map((occurrence) =>
                          occurrence.occurrenceId !== start.occurrenceId
                            ? occurrence
                            : (() => {
                                const withoutAcquisition = { ...occurrence };
                                delete withoutAcquisition.startingRewardAcquisition;
                                return Object.freeze({
                                  ...withoutAcquisition,
                                  ...(acquisition === undefined
                                    ? {}
                                    : { startingRewardAcquisition: acquisition }),
                                });
                              })(),
                        ),
                      ),
                    }),
                  }),
            );
      return Object.freeze({
        ...document,
        route: Object.freeze({
          ...route,
          loadout: Object.freeze({ ...route.loadout, startingReward: command.value }),
          biomes: Object.freeze(biomes),
        }),
      });
    }
    case 'ConfigureRoutePrefix':
      return configureRoutePrefix(document, catalog, command);
    case 'ReplaceDreamItinerary':
      return replaceDreamItinerary(document, catalog, command);
    case 'ReplaceRoute':
      return replaceRoute(document, catalog, command);
    case 'ReplaceRouteLoadout': {
      const { route } = routeForCommand(document, catalog, command);
      const weapon = catalog.weapons.byKey[command.weaponKey];
      if (weapon === undefined) failCommand(command, `unknown weapon ${command.weaponKey}`);
      if (!weapon.aspectKeys.includes(command.aspectKey)) {
        failCommand(command, `${command.aspectKey} does not belong to ${command.weaponKey}`);
      }
      if (
        route.loadout.weaponKey === command.weaponKey &&
        route.loadout.aspectKey === command.aspectKey &&
        (isSeleneAspect(catalog, command.aspectKey)
          ? route.loadout.aspectHexTree !== undefined
          : route.loadout.aspectHexTree === undefined)
      )
        return document;
      const aspectHexTree = isSeleneAspect(catalog, command.aspectKey)
        ? createDefaultAuthoredHexTree(catalog, 'SpellMoonBeamTrait')
        : undefined;
      const { aspectHexTree: _oldAspectHexTree, ...loadoutWithoutAspectHexTree } = route.loadout;
      void _oldAspectHexTree;
      return {
        ...document,
        route: {
          ...route,
          loadout: {
            ...loadoutWithoutAspectHexTree,
            weaponKey: command.weaponKey,
            aspectKey: command.aspectKey,
            ...(aspectHexTree === undefined ? {} : { aspectHexTree }),
          },
        },
      };
    }
    case 'ReplaceFamiliar': {
      const { route } = routeForCommand(document, catalog, command);
      if (catalog.familiars.byKey[command.familiarKey] === undefined)
        failCommand(command, `unknown familiar ${command.familiarKey}`);
      if (route.loadout.familiarKey === command.familiarKey) return document;
      return {
        ...document,
        route: { ...route, loadout: { ...route.loadout, familiarKey: command.familiarKey } },
      };
    }
    case 'ReplaceAspectHexTree': {
      const { route } = routeForCommand(document, catalog, command);
      if (!isSeleneAspect(catalog, route.loadout.aspectKey))
        failCommand(command, 'Aspect Hex trees are supported only by Aspect of Selene');
      let value;
      try {
        value = normalizeAuthoredHexTree(catalog, 'SpellMoonBeamTrait', command.value);
      } catch (error) {
        failCommand(command, error instanceof Error ? error.message : 'invalid Aspect Hex tree');
      }
      if (JSON.stringify(route.loadout.aspectHexTree) === JSON.stringify(value)) return document;
      return {
        ...document,
        route: { ...route, loadout: { ...route.loadout, aspectHexTree: value } },
      };
    }
    case 'ReplaceStartingKeepsake': {
      const { route } = routeForCommand(document, catalog, command);
      if (catalog.keepsakes.byKey[command.keepsakeKey] === undefined)
        failCommand(command, `unknown keepsake ${command.keepsakeKey}`);
      if (route.loadout.startingKeepsakeKey === command.keepsakeKey) return document;
      return {
        ...document,
        route: {
          ...route,
          loadout: { ...route.loadout, startingKeepsakeKey: command.keepsakeKey },
        },
      };
    }
    case 'ReplaceRunModifiers': {
      if (document.route.routeKey !== command.route.routeKey)
        failCommand(command, `project is missing route ${command.route.routeKey}`);
      const value = decodeRunModifiers(command.value, 'runModifiers');
      const route = document.route;
      const previous = routeRunModifiers(route.loadout);
      if (
        RUN_MODIFIER_DECLARATIONS.every(({ key }) =>
          sameRunModifierValue(previous[key], value[key]),
        )
      )
        return document;
      const encoded = encodeRunModifiers(value);
      const loadout = { ...route.loadout };
      delete loadout.runModifiers;
      return {
        ...document,
        route: {
          ...route,
          loadout: { ...loadout, ...(encoded === undefined ? {} : { runModifiers: encoded }) },
        },
      };
    }
    case 'ReplacePracticeStart': {
      if (document.route.routeKey !== command.route.routeKey)
        failCommand(command, `project is missing route ${command.route.routeKey}`);
      const route = document.route;
      const startPoint =
        command.startPoint === null ? undefined : decodePracticeStart(command.startPoint);
      if (command.startPoint !== null && !samePracticeStart(command.startPoint, startPoint))
        failCommand(command, 'start point is malformed');
      if (samePracticeStart(route.practiceStart, startPoint)) return document;
      const { practiceStart: _previous, ...rest } = route;
      void _previous;
      return {
        ...document,
        route: Object.freeze({
          ...rest,
          ...(startPoint === undefined ? {} : { practiceStart: startPoint }),
        }) as typeof route,
      };
    }
    case 'ReplaceDraftSpec': {
      if (document.route.routeKey !== command.route.routeKey)
        failCommand(command, `project is missing route ${command.route.routeKey}`);
      const draft = decodeDraftSpec(command.draft, catalog, document.route.routeKey);
      if (sameDraftSpec(document.route.draft, draft)) return document;
      return { ...document, route: { ...document.route, draft } };
    }
    case 'ReplaceManualArcanaSelection': {
      const { route } = routeForCommand(document, catalog, command);
      const seen = new Set<string>();
      for (const key of command.arcanaKeys) {
        const card = catalog.arcanaCards.byKey[key];
        if (card === undefined || card.activation.kind !== 'manual' || seen.has(key))
          failCommand(command, `invalid manual Arcana ${key}`);
        seen.add(key);
      }
      const keys = catalog.arcanaCards.values
        .filter((card) => seen.has(card.key))
        .map((card) => card.key);
      const grasp = assessStartingArcanaGrasp(catalog, keys, route.loadout.fearRanks);
      if (!grasp.legal) {
        failCommand(
          command,
          `manual Arcana cost ${grasp.cost} exceeds starting Grasp capacity ${grasp.capacity}`,
        );
      }
      if (
        keys.length === route.loadout.manualArcanaKeys.length &&
        keys.every((key, index) => key === route.loadout.manualArcanaKeys[index])
      ) {
        return document;
      }
      return {
        ...document,
        route: { ...route, loadout: { ...route.loadout, manualArcanaKeys: Object.freeze(keys) } },
      };
    }
    case 'ReplaceFearVowRank': {
      const { route } = routeForCommand(document, catalog, command);
      const vow = catalog.fearVows.byKey[command.vowKey];
      if (
        vow === undefined ||
        !Number.isInteger(command.rank) ||
        command.rank < 0 ||
        command.rank > vow.incrementalFear.length
      )
        failCommand(command, 'invalid Vow rank');
      const fearRanks = Object.freeze({
        ...route.loadout.fearRanks,
        [command.vowKey]: command.rank,
      });
      const grasp = assessStartingArcanaGrasp(catalog, route.loadout.manualArcanaKeys, fearRanks);
      if (!grasp.legal) {
        failCommand(
          command,
          `manual Arcana cost ${grasp.cost} exceeds starting Grasp capacity ${grasp.capacity}`,
        );
      }
      if (route.loadout.fearRanks[command.vowKey] === command.rank) return document;
      const replacement = {
        ...document,
        route: { ...route, loadout: { ...route.loadout, fearRanks } },
      };
      return command.vowKey === 'BossDifficultyShrineUpgrade'
        ? reconcileCompletionBosses(replacement, catalog, command.rank)
        : replacement;
    }
    case 'ReplaceBiomeField': {
      const located = locateBiome(document, catalog, command);
      return withBiome(document, located, {
        ...located.plan,
        state: replaceBiomeStateField(
          located.plan.state,
          located.layout,
          command.field.fieldKey,
          command.value,
          `${command.kind}.value`,
        ),
      });
    }
  }
}

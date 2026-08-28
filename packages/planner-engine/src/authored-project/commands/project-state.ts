import type { Catalog } from '../../catalog-schema';
import { createInitialBiomeState, replaceBiomeStateField } from '../biomeState';
import { assessStartingArcanaGrasp } from '../loadout';
import { createDefaultAuthoredHexTree, normalizeAuthoredHexTree } from '../hex-tree';
import type { ProjectDocument } from '../model';

import { failCommand, locateBiome, withBiome } from './contract';
import type { ProjectStateCommand } from './types';

function routeForCommand(
  document: ProjectDocument,
  command: Extract<
    ProjectStateCommand,
    | { readonly kind: 'ReplaceRouteLoadout' }
    | { readonly kind: 'ReplaceAspectHexTree' }
    | { readonly kind: 'ReplaceManualArcanaSelection' }
    | { readonly kind: 'ReplaceFearVowRank' }
    | { readonly kind: 'ReplaceStartingKeepsake' }
  >,
) {
  const routeIndex = document.routes.findIndex(
    (route) =>
      route.routeKey ===
      (command.kind === 'ReplaceStartingKeepsake'
        ? command.selection.routeKey
        : command.route.routeKey),
  );
  if (routeIndex < 0) failCommand(command, `project is missing route`);
  const route = document.routes[routeIndex];
  if (route === undefined) failCommand(command, `project is missing route`);
  return { route, routeIndex };
}

function isSeleneAspect(catalog: Catalog, aspectKey: string): boolean {
  return catalog.aspects.byKey[aspectKey]?.startingTrait?.traitKey === 'SpellMoonBeamTrait';
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
  if (configuredBiomeCount > routeDeclaration.biomeKeys.length) {
    failCommand(
      command,
      `configuredBiomeCount exceeds the ${routeDeclaration.biomeKeys.length}-biome route`,
    );
  }
  const routeIndex = document.routes.findIndex(
    (route) => route.routeKey === command.route.routeKey,
  );
  if (routeIndex < 0) {
    failCommand(command, `project is missing route ${command.route.routeKey}`);
  }
  const route = document.routes[routeIndex];
  if (route === undefined) {
    failCommand(command, `project is missing route ${command.route.routeKey}`);
  }
  if (route.biomes.length === configuredBiomeCount) {
    return document;
  }

  const retainedBiomes = route.biomes.slice(0, configuredBiomeCount);
  const addedBiomes = routeDeclaration.biomeKeys
    .slice(route.biomes.length, configuredBiomeCount)
    .map((biomeKey) => {
      const layout = catalog.biomeLayouts.byKey[biomeKey];
      if (layout === undefined) {
        failCommand(command, `${biomeKey} has no authored plan initializer`);
      }
      return {
        biomeKey,
        state: createInitialBiomeState(layout),
        topology: null,
      };
    });
  const replacement = { ...route, biomes: [...retainedBiomes, ...addedBiomes] };
  return {
    ...document,
    routes: document.routes.map((candidate, index) =>
      index === routeIndex ? replacement : candidate,
    ),
  };
}

export function applyProjectStateCommand(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectStateCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'ConfigureRoutePrefix':
      return configureRoutePrefix(document, catalog, command);
    case 'ReplaceRouteLoadout': {
      const { route, routeIndex } = routeForCommand(document, command);
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
        routes: document.routes.map((candidate, index) =>
          index === routeIndex
            ? {
                ...candidate,
                loadout: {
                  ...loadoutWithoutAspectHexTree,
                  weaponKey: command.weaponKey,
                  aspectKey: command.aspectKey,
                  ...(aspectHexTree === undefined ? {} : { aspectHexTree }),
                },
              }
            : candidate,
        ),
      };
    }
    case 'ReplaceAspectHexTree': {
      const { route, routeIndex } = routeForCommand(document, command);
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
        routes: document.routes.map((candidate, index) =>
          index === routeIndex
            ? { ...candidate, loadout: { ...route.loadout, aspectHexTree: value } }
            : candidate,
        ),
      };
    }
    case 'ReplaceStartingKeepsake': {
      const { route, routeIndex } = routeForCommand(document, command);
      if (catalog.keepsakes.byKey[command.keepsakeKey] === undefined)
        failCommand(command, `unknown keepsake ${command.keepsakeKey}`);
      if (route.loadout.startingKeepsakeKey === command.keepsakeKey) return document;
      return {
        ...document,
        routes: document.routes.map((candidate, index) =>
          index === routeIndex
            ? {
                ...candidate,
                loadout: {
                  ...route.loadout,
                  startingKeepsakeKey: command.keepsakeKey,
                },
              }
            : candidate,
        ),
      };
    }
    case 'ReplaceManualArcanaSelection': {
      const { route, routeIndex } = routeForCommand(document, command);
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
        routes: document.routes.map((candidate, index) =>
          index === routeIndex
            ? {
                ...candidate,
                loadout: { ...route.loadout, manualArcanaKeys: Object.freeze(keys) },
              }
            : candidate,
        ),
      };
    }
    case 'ReplaceFearVowRank': {
      const { route, routeIndex } = routeForCommand(document, command);
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
      return {
        ...document,
        routes: document.routes.map((candidate, index) =>
          index === routeIndex
            ? {
                ...candidate,
                loadout: {
                  ...route.loadout,
                  fearRanks,
                },
              }
            : candidate,
        ),
      };
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

import type { Catalog } from '../../catalog-schema';
import type { AuthoredKeepsakeEquipResults, ProjectDocument } from '../model';
import { failCommand, locateBiome, requireOccurrence, withBiome } from './contract';
import { updateOccurrence } from './occurrence-mutation';
import type {
  ExperimentalHammerEquipResultCommand,
  KeepsakeCommand,
  KeepsakeEquipResultCommand,
} from './types';

export function applyKeepsakeCommand(
  document: ProjectDocument,
  catalog: Catalog,
  command: KeepsakeCommand | KeepsakeEquipResultCommand | ExperimentalHammerEquipResultCommand,
): ProjectDocument {
  if (command.kind === 'ReplaceExperimentalHammerEquipResult') {
    if (
      command.value.kind === 'selected' &&
      catalog.traits.byKey[command.value.traitKey]?.hammerCompatibility === undefined
    )
      failCommand(command, 'trait is not a Hammer');
    const { selection } = command.result;
    const update = (results: AuthoredKeepsakeEquipResults | undefined) => ({
      ...results,
      experimentalHammer: Object.freeze({ ...command.value }),
    });
    if (selection.kind === 'echoKeepsakeReplay') {
      const route = document.routes.find((candidate) => candidate.routeKey === selection.routeKey);
      const biome = route?.biomes.find((candidate) => candidate.biomeKey === selection.biomeKey);
      if (biome === undefined) failCommand(command, 'unknown Echo keepsake replay biome');
      return {
        ...document,
        routes: document.routes.map((candidate) =>
          candidate.routeKey !== selection.routeKey
            ? candidate
            : {
                ...candidate,
                biomes: candidate.biomes.map((plan) =>
                  plan.biomeKey !== selection.biomeKey
                    ? plan
                    : {
                        ...plan,
                        echoKeepsakeReplayResults: update(plan.echoKeepsakeReplayResults),
                      },
                ),
              },
        ),
      };
    }
    if (selection.owner === 'routeStart') {
      const routeIndex = document.routes.findIndex(
        (route) => route.routeKey === selection.routeKey,
      );
      const route = document.routes[routeIndex];
      if (
        route === undefined ||
        catalog.keepsakes.byKey[route.loadout.startingKeepsakeKey]?.effect?.kind !==
          'experimentalHammer'
      )
        failCommand(command, 'result does not match the current selection');
      return {
        ...document,
        routes: document.routes.map((candidate, index) =>
          index === routeIndex
            ? {
                ...candidate,
                loadout: {
                  ...candidate.loadout,
                  keepsakeEquipResults: update(candidate.loadout.keepsakeEquipResults),
                },
              }
            : candidate,
        ),
      };
    }
    const located = locateBiome(document, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      value: { kind: 'retain' },
    });
    const occurrence = requireOccurrence(located.plan, selection.owner.occurrenceId, command);
    if (
      occurrence.keepsakeRack?.disposition.kind !== 'replace' ||
      catalog.keepsakes.byKey[occurrence.keepsakeRack.disposition.keepsakeKey]?.effect?.kind !==
        'experimentalHammer'
    )
      failCommand(command, 'result does not match the current selection');
    return updateOccurrence(document, located, {
      ...occurrence,
      keepsakeRack: {
        ...occurrence.keepsakeRack!,
        equipResults: update(occurrence.keepsakeRack?.equipResults),
      },
    });
  }
  if (command.kind === 'ReplaceJeweledPomEquipResult') {
    const descriptor = catalog.keepsakes.values.find(
      (keepsake) => keepsake.effect?.kind === command.result.resultKind,
    )?.effect;
    if (descriptor === undefined || descriptor.kind !== 'jeweledPom')
      failCommand(command, `unknown keepsake result ${command.result.resultKind}`);
    if (!catalog.traitGivers.byKey[descriptor.giverKey]?.traitKeys.includes(command.value.traitKey))
      failCommand(
        command,
        `trait ${command.value.traitKey} is not owned by ${descriptor.giverKey}`,
      );
    const trait = catalog.traits.byKey[command.value.traitKey];
    if (trait === undefined) failCommand(command, `unknown trait ${command.value.traitKey}`);
    const rarityPolicy = catalog.traitGivers.byKey[descriptor.giverKey]?.rarityPolicy;
    let completeValue: NonNullable<AuthoredKeepsakeEquipResults['jeweledPom']>;
    if (trait.rarityDomain.kind === 'none') {
      if (rarityPolicy?.kind !== 'none')
        failCommand(command, `${descriptor.giverKey} has inconsistent rarity declarations`);
      if (command.value.rarity !== undefined)
        failCommand(command, `rarityless option ${command.value.traitKey} has no rarity`);
      completeValue = Object.freeze({ traitKey: command.value.traitKey });
    } else {
      if (rarityPolicy?.kind !== 'fixed')
        failCommand(command, `${descriptor.giverKey} must declare one fixed result rarity`);
      if (command.value.rarity !== undefined && command.value.rarity !== rarityPolicy.rarity)
        failCommand(
          command,
          `rarity ${command.value.rarity} does not match ${descriptor.giverKey}'s fixed rarity`,
        );
      completeValue = Object.freeze({ ...command.value, rarity: rarityPolicy.rarity });
    }
    const { selection } = command.result;
    if (selection.kind === 'echoKeepsakeReplay')
      failCommand(command, 'Jeweled Pom is not supported by Echo keepsake replay');
    if (selection.owner === 'routeStart') {
      const routeIndex = document.routes.findIndex(
        (route) => route.routeKey === selection.routeKey,
      );
      const route = document.routes[routeIndex];
      if (route === undefined) failCommand(command, 'unknown route');
      if (route.loadout.startingKeepsakeKey !== descriptorOwnerKey(catalog, descriptor))
        failCommand(command, 'result does not match the current selection');
      return {
        ...document,
        routes: document.routes.map((candidate, index) =>
          index !== routeIndex
            ? candidate
            : {
                ...route,
                loadout: {
                  ...route.loadout,
                  keepsakeEquipResults: {
                    ...route.loadout.keepsakeEquipResults,
                    jeweledPom: completeValue,
                  },
                },
              },
        ),
      };
    }
    const located = locateBiome(document, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      value: { kind: 'retain' },
    });
    const occurrence = requireOccurrence(located.plan, selection.owner.occurrenceId, command);
    if (occurrence.keepsakeRack === undefined)
      failCommand(command, 'biome has no ordinary Postboss rack');
    if (
      occurrence.keepsakeRack.disposition.kind !== 'replace' ||
      occurrence.keepsakeRack.disposition.keepsakeKey !== descriptorOwnerKey(catalog, descriptor)
    )
      failCommand(command, 'result does not match the current selection');
    return updateOccurrence(document, located, {
      ...occurrence,
      keepsakeRack: {
        ...occurrence.keepsakeRack,
        equipResults: { ...occurrence.keepsakeRack.equipResults, jeweledPom: completeValue },
      },
    });
  }
  const located = locateBiome(document, catalog, command);
  if (command.selection.owner.biomeKey !== located.plan.biomeKey)
    failCommand(command, 'selection does not own this Postboss biome');
  const occurrence = requireOccurrence(located.plan, command.selection.owner.occurrenceId, command);
  if (occurrence.keepsakeRack === undefined)
    failCommand(command, 'biome has no ordinary Postboss rack');
  if (
    command.value.kind === 'replace' &&
    catalog.keepsakes.byKey[command.value.keepsakeKey] === undefined
  )
    failCommand(command, `unknown keepsake ${command.value.keepsakeKey}`);
  const rack = Object.freeze({ kind: 'interactKeepsakeRack' as const });
  const existingOrder = occurrence.roomActions.order;
  const nextOrder =
    command.value.kind === 'replace'
      ? existingOrder.some((reference) => reference.kind === 'interactKeepsakeRack')
        ? existingOrder
        : Object.freeze([...existingOrder, rack])
      : Object.freeze(
          existingOrder.filter((reference) => reference.kind !== 'interactKeepsakeRack'),
        );
  return updateOccurrence(document, located, {
    ...occurrence,
    keepsakeRack: Object.freeze({ ...occurrence.keepsakeRack, disposition: command.value }),
    roomActions: Object.freeze({ order: nextOrder }),
  });
}

function descriptorOwnerKey(
  catalog: Catalog,
  descriptor: NonNullable<Catalog['keepsakes']['values'][number]['effect']>,
): string {
  const owner = catalog.keepsakes.values.find((keepsake) => keepsake.effect === descriptor);
  if (owner === undefined) throw new Error('keepsake descriptor has no owner');
  return owner.key;
}

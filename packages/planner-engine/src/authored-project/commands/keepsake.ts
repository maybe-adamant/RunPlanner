import type { Catalog } from '../../catalog-schema';
import { routeHasKeepsakeRack } from '../route-profile';
import type { AuthoredKeepsakeEquipResults, HubDecision, ProjectDocument } from '../model';
import { failCommand, locateBiome, requireOccurrence, requireTopology } from './contract';
import { replaceDecision, updateTopology } from './topology/construction';
import { updateOccurrence } from './occurrence/mutation';
import { roomActionKey } from '../room-actions/key';
import {
  createBiomeAddress,
  type EchoKeepsakeReplayAddress,
  type KeepsakeSelectionAddress,
} from '../addresses';
import { assembleRoomActionDomain } from '../room-actions/domain';
import { resolveRoutePosition } from '../route-context';
import {
  normalizeAuthoredTranscendentEmbryoOutcome,
  type AuthoredTranscendentEmbryoOutcome,
} from '../traits/state';
import type {
  ExperimentalHammerEquipResultCommand,
  TranscendentEmbryoEquipResultCommand,
  TranscendentEmbryoTransformationCommand,
  KeepsakeCommand,
  KeepsakeEquipResultCommand,
  FountainRarityCommand,
} from './types';

export function applyKeepsakeCommand(
  document: ProjectDocument,
  catalog: Catalog,
  command:
    | KeepsakeCommand
    | KeepsakeEquipResultCommand
    | ExperimentalHammerEquipResultCommand
    | FountainRarityCommand
    | TranscendentEmbryoEquipResultCommand
    | TranscendentEmbryoTransformationCommand,
): ProjectDocument {
  if (command.kind === 'ReplaceFountainRarityTarget') {
    if (
      command.targetTraitKey !== null &&
      catalog.traits.byKey[command.targetTraitKey] === undefined
    )
      failCommand(command, `unknown trait ${command.targetTraitKey}`);
    const located = locateBiome(document, catalog, command);
    const action = command.outcome.action;
    if (action.kind === 'hubFountain') {
      const topology = requireTopology(located.plan, command);
      const hub = topology.decisions.find(
        (decision): decision is HubDecision =>
          decision.kind === 'hub' && decision.hubKey === action.hubKey,
      );
      if (
        action.routeKey !== command.outcome.routeKey ||
        action.biomeKey !== command.outcome.biomeKey ||
        hub === undefined ||
        !hub.actions.some((candidate) => candidate.kind === 'useFountain')
      )
        failCommand(command, 'outcome does not own the exact fountain action');
      const { fountainRarityResult, ...withoutOutcome } = hub;
      void fountainRarityResult;
      return updateTopology(
        document,
        located,
        replaceDecision(
          topology,
          Object.freeze(
            command.targetTraitKey === null
              ? withoutOutcome
              : {
                  ...withoutOutcome,
                  fountainRarityResult: Object.freeze({ targetTraitKey: command.targetTraitKey }),
                },
          ),
        ),
      );
    }
    const occurrence = requireOccurrence(located.plan, action.occurrenceId, command);
    const expectedActionKey = roomActionKey({ kind: 'useFountain' });
    const declarationActions = assembleRoomActionDomain({
      catalog,
      biome: createBiomeAddress(command.outcome.routeKey, command.outcome.biomeKey),
      occurrence,
      routePosition: resolveRoutePosition(catalog, document.route, command.outcome.biomeKey),
    }).activeReferences;
    if (
      action.routeKey !== command.outcome.routeKey ||
      action.biomeKey !== command.outcome.biomeKey ||
      action.actionKey !== expectedActionKey ||
      !declarationActions.some((reference) => reference.kind === 'useFountain') ||
      !occurrence.roomActions.order.some(
        (reference) =>
          reference.kind === 'useFountain' && roomActionKey(reference) === action.actionKey,
      )
    )
      failCommand(command, 'outcome does not own the exact fountain action');
    const nextOccurrence =
      command.targetTraitKey === null
        ? (() => {
            const { fountainRarityResult, ...rest } = occurrence;
            void fountainRarityResult;
            return rest;
          })()
        : {
            ...occurrence,
            fountainRarityResult: Object.freeze({ targetTraitKey: command.targetTraitKey }),
          };
    return updateOccurrence(document, located, nextOccurrence);
  }
  if (command.kind === 'ReplaceTranscendentEmbryoTransformation') {
    let outcome = command.value;
    if (outcome !== null) {
      try {
        outcome = normalizeAuthoredTranscendentEmbryoOutcome(catalog, outcome);
      } catch (error) {
        failCommand(
          command,
          error instanceof Error ? error.message : 'transformation has invalid blessing values',
        );
      }
      if (
        catalog.chaos.blessings.byKey[outcome.blessingKey]?.operands.length !== 0 &&
        Object.keys(outcome.blessingValues).length === 0
      )
        failCommand(command, 'transformation must provide complete blessing values');
    }
    const cycle = String(command.outcome.cycle);
    return updateEmbryoEquipResults(
      document,
      catalog,
      command,
      command.outcome.selection,
      (results) => {
        const transformations: Record<string, AuthoredTranscendentEmbryoOutcome> = {
          ...results?.transcendentEmbryoTransformations,
        };
        if (outcome === null) delete transformations[cycle];
        else transformations[cycle] = Object.freeze(outcome);
        const { transcendentEmbryoTransformations: _prior, ...rest } = results ?? {};
        void _prior;
        return Object.keys(transformations).length === 0
          ? rest
          : { ...rest, transcendentEmbryoTransformations: Object.freeze(transformations) };
      },
    );
  }
  if (command.kind === 'ReplaceTranscendentEmbryoEquipResult') {
    let value: NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']>;
    try {
      value = normalizeAuthoredTranscendentEmbryoOutcome(catalog, command.value);
    } catch (error) {
      failCommand(
        command,
        error instanceof Error ? error.message : 'result has invalid blessing values',
      );
    }
    if (
      catalog.chaos.blessings.byKey[value.blessingKey]?.operands.length !== 0 &&
      Object.keys(value.blessingValues).length === 0
    )
      failCommand(command, 'result must provide complete blessing values');
    return updateEmbryoEquipResults(
      document,
      catalog,
      command,
      command.result.selection,
      (results) => ({
        ...results,
        transcendentEmbryo: Object.freeze(value),
      }),
    );
  }
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
      const route = document.route.routeKey === selection.routeKey ? document.route : undefined;
      const biome = route?.biomes.find((candidate) => candidate.biomeKey === selection.biomeKey);
      if (biome === undefined) failCommand(command, 'unknown Echo keepsake replay biome');
      return {
        ...document,
        route: {
          ...route!,
          biomes: route!.biomes.map((plan) =>
            plan.biomeKey !== selection.biomeKey
              ? plan
              : { ...plan, echoKeepsakeReplayResults: update(plan.echoKeepsakeReplayResults) },
          ),
        },
      };
    }
    if (selection.owner === 'routeStart') {
      const route = document.route.routeKey === selection.routeKey ? document.route : undefined;
      if (
        route === undefined ||
        route.loadout.startingKeepsakeKey === null ||
        catalog.keepsakes.byKey[route.loadout.startingKeepsakeKey]?.effect?.kind !==
          'experimentalHammer'
      )
        failCommand(command, 'result does not match the current selection');
      return {
        ...document,
        route: {
          ...route!,
          loadout: {
            ...route!.loadout,
            keepsakeEquipResults: update(route!.loadout.keepsakeEquipResults),
          },
        },
      };
    }
    const located = locateBiome(document, catalog, command);
    const occurrence = requireOccurrence(located.plan, selection.owner.occurrenceId, command);
    if (
      occurrence.keepsakeRack?.keepsakeKey == null ||
      catalog.keepsakes.byKey[occurrence.keepsakeRack.keepsakeKey]?.effect?.kind !==
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
      const route = document.route.routeKey === selection.routeKey ? document.route : undefined;
      if (route === undefined) failCommand(command, 'unknown route');
      if (route.loadout.startingKeepsakeKey !== descriptorOwnerKey(catalog, descriptor))
        failCommand(command, 'result does not match the current selection');
      return {
        ...document,
        route: {
          ...route!,
          loadout: {
            ...route!.loadout,
            keepsakeEquipResults: {
              ...route!.loadout.keepsakeEquipResults,
              jeweledPom: completeValue,
            },
          },
        },
      };
    }
    const located = locateBiome(document, catalog, command);
    const occurrence = requireOccurrence(located.plan, selection.owner.occurrenceId, command);
    if (occurrence.keepsakeRack === undefined)
      failCommand(command, 'biome has no ordinary Postboss rack');
    if (occurrence.keepsakeRack.keepsakeKey !== descriptorOwnerKey(catalog, descriptor))
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
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (
    room === undefined ||
    (room.roomSetKey !== located.layout.biomeKey &&
      room.gameName !== located.routePosition.completion.postbossRoomGameName)
  ) {
    failCommand(command, `${occurrence.gameName} is not this biome's Postboss room`);
  }
  if (!routeHasKeepsakeRack(room, located.routeKey) || occurrence.keepsakeRack === undefined)
    failCommand(command, 'this route has no Postboss rack');
  const keepsakeKey = command.keepsakeKey;
  if (keepsakeKey !== null && catalog.keepsakes.byKey[keepsakeKey] === undefined)
    failCommand(command, `unknown keepsake ${keepsakeKey}`);
  if (occurrence.keepsakeRack.keepsakeKey === keepsakeKey) return document;
  // Each equip result belongs to one keepsake, so a change drops them all; the rank stays.
  return updateOccurrence(document, located, {
    ...occurrence,
    keepsakeRack: Object.freeze({ keepsakeKey }),
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

/** Updates the equip results of the selection that installs the Embryo. */
function updateEmbryoEquipResults(
  document: ProjectDocument,
  catalog: Catalog,
  command: TranscendentEmbryoEquipResultCommand | TranscendentEmbryoTransformationCommand,
  selection: KeepsakeSelectionAddress | EchoKeepsakeReplayAddress,
  update: (results: AuthoredKeepsakeEquipResults | undefined) => AuthoredKeepsakeEquipResults,
): ProjectDocument {
  const embryoKeepsakeKey = catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'transcendentEmbryo',
  )?.key;
  if (embryoKeepsakeKey === undefined) failCommand(command, 'catalog has no Embryo keepsake');
  const unchanged = (
    current: AuthoredKeepsakeEquipResults | undefined,
    next: AuthoredKeepsakeEquipResults,
  ) => JSON.stringify(current ?? {}) === JSON.stringify(next);
  if (selection.kind === 'echoKeepsakeReplay') {
    const route = document.route.routeKey === selection.routeKey ? document.route : undefined;
    const biome = route?.biomes.find((candidate) => candidate.biomeKey === selection.biomeKey);
    if (biome === undefined) failCommand(command, 'unknown Echo keepsake replay biome');
    const next = update(biome.echoKeepsakeReplayResults);
    if (unchanged(biome.echoKeepsakeReplayResults, next)) return document;
    return {
      ...document,
      route: {
        ...route!,
        biomes: route!.biomes.map((plan) =>
          plan.biomeKey !== selection.biomeKey
            ? plan
            : { ...plan, echoKeepsakeReplayResults: next },
        ),
      },
    };
  }
  if (selection.owner === 'routeStart') {
    const route = document.route.routeKey === selection.routeKey ? document.route : undefined;
    if (route === undefined || embryoKeepsakeKey !== route.loadout.startingKeepsakeKey)
      failCommand(command, 'result does not match the current selection');
    const next = update(route.loadout.keepsakeEquipResults);
    if (unchanged(route.loadout.keepsakeEquipResults, next)) return document;
    return {
      ...document,
      route: { ...route, loadout: { ...route.loadout, keepsakeEquipResults: next } },
    };
  }
  const located = locateBiome(document, catalog, command);
  const occurrence = requireOccurrence(located.plan, selection.owner.occurrenceId, command);
  if (
    occurrence.keepsakeRack === undefined ||
    embryoKeepsakeKey !== occurrence.keepsakeRack.keepsakeKey
  )
    failCommand(command, 'result does not match the current selection');
  const next = update(occurrence.keepsakeRack.equipResults);
  if (unchanged(occurrence.keepsakeRack.equipResults, next)) return document;
  return updateOccurrence(document, located, {
    ...occurrence,
    keepsakeRack: { ...occurrence.keepsakeRack, equipResults: next },
  });
}

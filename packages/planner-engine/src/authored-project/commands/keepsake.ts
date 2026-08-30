import type { Catalog } from '../../catalog-schema';
import type { AuthoredKeepsakeEquipResults, ProjectDocument } from '../model';
import { failCommand, locateBiome, requireOccurrence, requireRoom } from './contract';
import { updateOccurrence } from './occurrence-mutation';
import { roomActionKey } from '../room-action-key';
import { createBiomeAddress } from '../addresses';
import { assembleRoomActionDomain } from '../room-action-domain';
import { encounterBindingsBySlot } from '../room-state/encounter-envelope';
import type {
  ExperimentalHammerEquipResultCommand,
  TranscendentEmbryoEquipResultCommand,
  TranscendentEmbryoTransformationCommand,
  KeepsakeCommand,
  RemoveKeepsakeCommand,
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
    | TranscendentEmbryoTransformationCommand
    | RemoveKeepsakeCommand,
): ProjectDocument {
  if (command.kind === 'ReplaceFountainRarityTarget') {
    if (
      command.targetTraitKey !== null &&
      catalog.traits.byKey[command.targetTraitKey] === undefined
    )
      failCommand(command, `unknown trait ${command.targetTraitKey}`);
    const located = locateBiome(document, catalog, command);
    const occurrence = requireOccurrence(
      located.plan,
      command.outcome.action.occurrenceId,
      command,
    );
    const expectedActionKey = roomActionKey({ kind: 'useFountain' });
    const declarationActions = assembleRoomActionDomain({
      catalog,
      biome: createBiomeAddress(command.outcome.routeKey, command.outcome.biomeKey),
      occurrence,
    }).activeReferences;
    if (
      command.outcome.action.kind !== 'roomAction' ||
      command.outcome.action.routeKey !== command.outcome.routeKey ||
      command.outcome.action.biomeKey !== command.outcome.biomeKey ||
      command.outcome.action.actionKey !== expectedActionKey ||
      !declarationActions.some((reference) => reference.kind === 'useFountain') ||
      !occurrence.roomActions.order.some(
        (reference) =>
          reference.kind === 'useFountain' &&
          roomActionKey(reference) === command.outcome.action.actionKey,
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
    if (
      command.blessingKey !== null &&
      (catalog.chaos.blessings.byKey[command.blessingKey] === undefined ||
        catalog.chaos.blessings.byKey[command.blessingKey]?.fixedRarity !== undefined)
    )
      failCommand(command, 'transformation must select an in-run Chaos blessing or null');
    const located = locateBiome(document, catalog, command);
    const occurrence = requireOccurrence(located.plan, command.outcome.owner.occurrenceId, command);
    const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
    if (!encounterBindingsBySlot(catalog, room, room.gameName).has(command.outcome.phaseKey))
      failCommand(command, `${room.gameName} has no encounter phase ${command.outcome.phaseKey}`);
    const current = occurrence.encounters.transcendentEmbryoBlessingByPhase ?? {};
    if (current[command.outcome.phaseKey] === command.blessingKey) return document;
    const next = { ...current };
    if (command.blessingKey === null) delete next[command.outcome.phaseKey];
    else next[command.outcome.phaseKey] = command.blessingKey;
    const encounters =
      Object.keys(next).length === 0
        ? (() => {
            const { transcendentEmbryoBlessingByPhase, ...rest } = occurrence.encounters;
            void transcendentEmbryoBlessingByPhase;
            return rest;
          })()
        : {
            ...occurrence.encounters,
            transcendentEmbryoBlessingByPhase: Object.freeze(next),
          };
    return updateOccurrence(document, located, { ...occurrence, encounters });
  }
  if (command.kind === 'ReplaceTranscendentEmbryoEquipResult') {
    if (
      catalog.chaos.blessings.byKey[command.value.blessingKey] === undefined ||
      catalog.chaos.blessings.byKey[command.value.blessingKey]?.fixedRarity !== undefined
    )
      failCommand(command, 'result must select an in-run Chaos blessing');
    const { selection } = command.result;
    const embryoKeepsakeKey = catalog.keepsakes.values.find(
      (keepsake) => keepsake.effect?.kind === 'transcendentEmbryo',
    )?.key;
    if (embryoKeepsakeKey === undefined) failCommand(command, 'catalog has no Embryo keepsake');
    const update = (results: AuthoredKeepsakeEquipResults | undefined) => ({
      ...results,
      transcendentEmbryo: Object.freeze({ blessingKey: command.value.blessingKey }),
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
      if (route === undefined || embryoKeepsakeKey !== route.loadout.startingKeepsakeKey)
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
      occurrence.keepsakeRack === undefined ||
      embryoKeepsakeKey !== occurrence.keepsakeRack.keepsakeKey
    )
      failCommand(command, 'result does not match the current selection');
    return updateOccurrence(document, located, {
      ...occurrence,
      keepsakeRack: {
        ...occurrence.keepsakeRack,
        equipResults: update(occurrence.keepsakeRack.equipResults),
      },
    });
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
      occurrence.keepsakeRack === undefined ||
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
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  if (!room.hasKeepsakeRack) failCommand(command, 'biome has no ordinary Postboss rack');
  if (command.kind === 'RemovePostbossKeepsake') {
    if (occurrence.keepsakeRack === undefined) return document;
    const nextOrder = occurrence.roomActions.order.filter(
      (reference) => reference.kind !== 'interactKeepsakeRack',
    );
    const { keepsakeRack: _removed, ...withoutRack } = occurrence;
    void _removed;
    return updateOccurrence(document, located, {
      ...withoutRack,
      roomActions: Object.freeze({ order: Object.freeze(nextOrder) }),
    });
  }
  if (catalog.keepsakes.byKey[command.keepsakeKey] === undefined)
    failCommand(command, `unknown keepsake ${command.keepsakeKey}`);
  const rack = Object.freeze({ kind: 'interactKeepsakeRack' as const });
  const existingOrder = occurrence.roomActions.order;
  const nextOrder = existingOrder.some((reference) => reference.kind === 'interactKeepsakeRack')
    ? existingOrder
    : Object.freeze([...existingOrder, rack]);
  return updateOccurrence(document, located, {
    ...occurrence,
    keepsakeRack: Object.freeze({
      ...occurrence.keepsakeRack,
      keepsakeKey: command.keepsakeKey,
    }),
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

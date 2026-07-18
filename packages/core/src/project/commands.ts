import type { Catalog, LinearBiomeLayout, RoomDeclaration } from '../catalog';
import type {
  CountedRewardChoice,
  LinearBiomePlan,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from './model';
import type {
  BiomeAddress,
  ContinuationAddress,
  IncomingRewardAddress,
  OccurrenceAddress,
  PickedAddress,
  SemanticAddress,
  ShopPurchaseAddress,
  TargetAddress,
} from './addresses';
import { semanticAddressKey } from './addresses';
import { decodeProjectDocument } from './codec';
import { createDefaultRoomState, type RoomOccurrenceRole } from './roomState';
import { ProjectDocumentContractError } from './validation';

export type ProjectCommand =
  | {
      readonly kind: 'CreateStart';
      readonly biome: BiomeAddress;
      readonly occurrenceId: OccurrenceId;
      readonly gameName: string;
    }
  | { readonly kind: 'CreateBatch'; readonly continuation: ContinuationAddress }
  | {
      readonly kind: 'CreateTarget';
      readonly target: TargetAddress;
      readonly occurrenceId: OccurrenceId;
      readonly gameName: string;
    }
  | {
      readonly kind: 'SetPicked';
      readonly picked: PickedAddress;
      readonly exitIndex: number;
    }
  | {
      readonly kind: 'ReplaceOccurrenceRoom';
      readonly occurrence: OccurrenceAddress;
      readonly gameName: string;
    }
  | {
      readonly kind: 'ReplaceIncomingReward';
      readonly reward: IncomingRewardAddress;
      readonly choice: CountedRewardChoice;
    }
  | {
      readonly kind: 'SetShopPurchase';
      readonly purchase: ShopPurchaseAddress;
      readonly purchased: boolean;
    };

export class ProjectCommandContractError extends Error {
  readonly commandKind: ProjectCommand['kind'];
  readonly addressKey: string;
  readonly detail: string;

  constructor(
    commandKind: ProjectCommand['kind'],
    address: SemanticAddress,
    detail: string,
    options?: ErrorOptions,
  ) {
    const addressKey = semanticAddressKey(address);
    super(`${commandKind} at ${addressKey}: ${detail}`, options);
    this.name = 'ProjectCommandContractError';
    this.commandKind = commandKind;
    this.addressKey = addressKey;
    this.detail = detail;
  }
}

interface LocatedBiome {
  readonly routeIndex: number;
  readonly biomeIndex: number;
  readonly plan: LinearBiomePlan;
  readonly layout: LinearBiomeLayout;
}

function commandAddress(command: ProjectCommand): SemanticAddress {
  switch (command.kind) {
    case 'CreateStart':
      return command.biome;
    case 'CreateBatch':
      return command.continuation;
    case 'CreateTarget':
      return command.target;
    case 'SetPicked':
      return command.picked;
    case 'ReplaceOccurrenceRoom':
      return command.occurrence;
    case 'ReplaceIncomingReward':
      return command.reward;
    case 'SetShopPurchase':
      return command.purchase;
  }
}

function failCommand(command: ProjectCommand, detail: string): never {
  throw new ProjectCommandContractError(command.kind, commandAddress(command), detail);
}

function locateBiome(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectCommand,
): LocatedBiome {
  const address = commandAddress(command);
  const routeIndex = document.routes.findIndex((route) => route.routeKey === address.routeKey);
  if (routeIndex < 0) {
    failCommand(command, `unknown or unconfigured route ${address.routeKey}`);
  }
  const route = document.routes[routeIndex];
  if (route === undefined) {
    failCommand(command, `missing route ${address.routeKey}`);
  }
  const biomeIndex = route.biomes.findIndex((biome) => biome.biomeStepKey === address.biomeStepKey);
  if (biomeIndex < 0) {
    failCommand(command, `unknown or unconfigured biome ${address.biomeStepKey}`);
  }
  const plan = route.biomes[biomeIndex];
  if (plan === undefined) {
    failCommand(command, `missing biome ${address.biomeStepKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[address.biomeStepKey];
  if (layout === undefined) {
    failCommand(command, `catalog has no layout for ${address.biomeStepKey}`);
  }
  return { routeIndex, biomeIndex, plan, layout };
}

function requireTopology(plan: LinearBiomePlan, command: ProjectCommand) {
  if (plan.topology === null) {
    failCommand(command, 'biome topology has not been started');
  }
  return plan.topology;
}

function requireOccurrence(
  plan: LinearBiomePlan,
  occurrenceId: OccurrenceId,
  command: ProjectCommand,
): RoomOccurrence {
  const topology = requireTopology(plan, command);
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (occurrence === undefined) {
    failCommand(command, `unknown occurrence ${occurrenceId}`);
  }
  return occurrence;
}

function requireRoom(
  catalog: Catalog,
  gameName: string,
  biomeStepKey: string,
  command: ProjectCommand,
): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    failCommand(command, `unknown room ${gameName}`);
  }
  if (room.biomeStepKey !== biomeStepKey) {
    failCommand(command, `${gameName} belongs to ${room.biomeStepKey}`);
  }
  return room;
}

function hasGeneratedExit(room: RoomDeclaration, exitIndex: number): boolean {
  return room.exits.some((exit) => exit.index === exitIndex && exit.targetMode === 'generated');
}

function occurrenceRole(
  plan: LinearBiomePlan,
  occurrenceId: OccurrenceId,
  command: ProjectCommand,
): RoomOccurrenceRole {
  const topology = requireTopology(plan, command);
  if (topology.startOccurrenceId === occurrenceId) {
    return 'ordinary';
  }
  for (const continuation of topology.continuations) {
    const target = continuation.targets.find(
      (candidate) => candidate.occurrenceId === occurrenceId,
    );
    if (target !== undefined) {
      if (continuation.kind === 'terminal') {
        return target.exitIndex === 1 ? 'terminalShop' : 'terminalFreeReward';
      }
      return 'ordinary';
    }
  }
  failCommand(command, `occurrence ${occurrenceId} has no structural owner`);
}

function withBiome(
  document: ProjectDocument,
  located: LocatedBiome,
  plan: LinearBiomePlan,
): ProjectDocument {
  const route = document.routes[located.routeIndex];
  if (route === undefined) {
    throw new Error('located route disappeared');
  }
  const biomes = route.biomes.map((biome, index) => (index === located.biomeIndex ? plan : biome));
  const routes = document.routes.map((candidate, index) =>
    index === located.routeIndex ? { ...route, biomes } : candidate,
  );
  return { ...document, routes };
}

function replaceOccurrence(
  plan: LinearBiomePlan,
  replacement: RoomOccurrence,
  command: ProjectCommand,
): LinearBiomePlan {
  const topology = requireTopology(plan, command);
  return {
    ...plan,
    topology: {
      ...topology,
      occurrences: topology.occurrences.map((occurrence) =>
        occurrence.occurrenceId === replacement.occurrenceId ? replacement : occurrence,
      ),
    },
  };
}

function applyUnchecked(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectCommand,
): ProjectDocument {
  const located = locateBiome(document, catalog, command);
  const { layout, plan } = located;

  switch (command.kind) {
    case 'CreateStart': {
      if (plan.topology !== null) {
        failCommand(command, 'biome topology already has a start');
      }
      const room = requireRoom(catalog, command.gameName, layout.biomeStepKey, command);
      if (!layout.start.roomGameNames.includes(room.gameName)) {
        failCommand(command, `${room.gameName} is not a declared start room`);
      }
      const occurrence = {
        occurrenceId: command.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(catalog, room),
      };
      return withBiome(document, located, {
        ...plan,
        topology: {
          startOccurrenceId: command.occurrenceId,
          occurrences: [occurrence],
          continuations: [],
        },
      });
    }
    case 'CreateBatch': {
      const topology = requireTopology(plan, command);
      requireOccurrence(plan, command.continuation.parentOccurrenceId, command);
      if (
        topology.continuations.some(
          (continuation) =>
            continuation.parentOccurrenceId === command.continuation.parentOccurrenceId,
        )
      ) {
        failCommand(command, 'parent already owns a continuation');
      }
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          continuations: [
            ...topology.continuations,
            {
              kind: 'batch',
              parentOccurrenceId: command.continuation.parentOccurrenceId,
              targets: [],
              pickedExitIndex: null,
            },
          ],
        },
      });
    }
    case 'CreateTarget': {
      const topology = requireTopology(plan, command);
      if (topology.occurrences.some((room) => room.occurrenceId === command.occurrenceId)) {
        failCommand(command, `occurrence ${command.occurrenceId} already exists`);
      }
      const continuation = topology.continuations.find(
        (candidate) => candidate.parentOccurrenceId === command.target.parentOccurrenceId,
      );
      if (continuation?.kind !== 'batch') {
        failCommand(command, 'target parent does not own an ordinary batch');
      }
      if (continuation.targets.some((target) => target.exitIndex === command.target.exitIndex)) {
        failCommand(command, `exit ${command.target.exitIndex} already has a target`);
      }
      const parent = requireOccurrence(plan, command.target.parentOccurrenceId, command);
      const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeStepKey, command);
      if (!hasGeneratedExit(parentRoom, command.target.exitIndex)) {
        failCommand(
          command,
          `exit ${command.target.exitIndex} is unavailable from ${parent.gameName}`,
        );
      }
      const room = requireRoom(catalog, command.gameName, layout.biomeStepKey, command);
      if (room.kind === 'Intro' || room.kind === 'Opening' || room.kind === 'Preboss') {
        failCommand(command, `${room.gameName} cannot be an ordinary generated target`);
      }
      const occurrence = {
        occurrenceId: command.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(catalog, room),
      };
      const updatedContinuation = {
        ...continuation,
        targets: [
          ...continuation.targets,
          { exitIndex: command.target.exitIndex, occurrenceId: command.occurrenceId },
        ],
      };
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          occurrences: [...topology.occurrences, occurrence],
          continuations: topology.continuations.map((candidate) =>
            candidate.parentOccurrenceId === continuation.parentOccurrenceId
              ? updatedContinuation
              : candidate,
          ),
        },
      });
    }
    case 'SetPicked': {
      const topology = requireTopology(plan, command);
      const continuation = topology.continuations.find(
        (candidate) => candidate.parentOccurrenceId === command.picked.parentOccurrenceId,
      );
      if (continuation?.kind !== 'batch') {
        failCommand(command, 'picked parent does not own an ordinary batch');
      }
      const target = continuation.targets.find(
        (candidate) => candidate.exitIndex === command.exitIndex,
      );
      if (target === undefined) {
        failCommand(command, `exit ${command.exitIndex} has no target`);
      }
      const parent = requireOccurrence(plan, command.picked.parentOccurrenceId, command);
      const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeStepKey, command);
      if (!hasGeneratedExit(parentRoom, command.exitIndex)) {
        failCommand(command, `exit ${command.exitIndex} is unavailable from ${parent.gameName}`);
      }
      if (continuation.pickedExitIndex === command.exitIndex) {
        return document;
      }

      let oldPickedOccurrenceId: OccurrenceId | undefined;
      if (continuation.pickedExitIndex !== null) {
        oldPickedOccurrenceId = continuation.targets.find(
          (candidate) => candidate.exitIndex === continuation.pickedExitIndex,
        )?.occurrenceId;
      }
      const continuations = topology.continuations.map((candidate) => {
        if (candidate.parentOccurrenceId === continuation.parentOccurrenceId) {
          return { ...continuation, pickedExitIndex: command.exitIndex };
        }
        if (
          oldPickedOccurrenceId !== undefined &&
          candidate.parentOccurrenceId === oldPickedOccurrenceId
        ) {
          return { ...candidate, parentOccurrenceId: target.occurrenceId };
        }
        return candidate;
      });
      return withBiome(document, located, {
        ...plan,
        topology: { ...topology, continuations },
      });
    }
    case 'ReplaceOccurrenceRoom': {
      const occurrence = requireOccurrence(plan, command.occurrence.occurrenceId, command);
      if (occurrence.gameName === command.gameName) {
        return document;
      }
      const room = requireRoom(catalog, command.gameName, layout.biomeStepKey, command);
      const role = occurrenceRole(plan, occurrence.occurrenceId, command);
      const replacement = {
        occurrenceId: occurrence.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(catalog, room, role),
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
    case 'ReplaceIncomingReward': {
      const occurrence = requireOccurrence(plan, command.reward.occurrenceId, command);
      if (occurrence.state.kind !== 'counted' && occurrence.state.kind !== 'freeReward') {
        failCommand(command, `${occurrence.gameName} has no replaceable counted reward`);
      }
      const replacement = {
        ...occurrence,
        state: { ...occurrence.state, choice: command.choice },
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
    case 'SetShopPurchase': {
      const occurrence = requireOccurrence(plan, command.purchase.occurrenceId, command);
      if (occurrence.state.kind !== 'shop') {
        failCommand(command, `${occurrence.gameName} has no shop purchase state`);
      }
      const offer = occurrence.state.shop.offers[command.purchase.offerKey];
      if (offer === undefined) {
        failCommand(command, `unknown shop offer ${command.purchase.offerKey}`);
      }
      if (typeof command.purchased !== 'boolean') {
        failCommand(command, 'purchased must be a boolean');
      }
      if (offer.purchased === command.purchased) {
        return document;
      }
      const replacement = {
        ...occurrence,
        state: {
          ...occurrence.state,
          shop: {
            ...occurrence.state.shop,
            offers: {
              ...occurrence.state.shop.offers,
              [command.purchase.offerKey]: { ...offer, purchased: command.purchased },
            },
          },
        },
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
  }
}

export function applyProjectCommand(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectCommand,
): ProjectDocument {
  try {
    const proposal = applyUnchecked(document, catalog, command);
    return proposal === document ? document : decodeProjectDocument(proposal, catalog);
  } catch (error) {
    if (error instanceof ProjectCommandContractError) {
      throw error;
    }
    if (error instanceof ProjectDocumentContractError) {
      throw new ProjectCommandContractError(
        command.kind,
        commandAddress(command),
        `${error.path}: ${error.detail}`,
        { cause: error },
      );
    }
    throw error;
  }
}

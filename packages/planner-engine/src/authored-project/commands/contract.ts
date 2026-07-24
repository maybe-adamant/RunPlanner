import type {
  Catalog,
  HubBiomeLayout,
  LinearBiomeLayout,
  RoomDeclaration,
} from '../../catalog-schema';
import type { ResolvedRewardOffer, RewardPayload } from '../../reward-kernel/model';
import type { SemanticAddress } from '../addresses';
import { createProjectAddress, semanticAddressKey } from '../addresses';
import type {
  AuthoredBiomePlan,
  HubBiomePlan,
  LinearBiomePlan,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import { type RoomOccurrenceRole, type RoomStateContext } from '../roomState';

import type { BiomeProjectCommand, ProjectCommand } from './types';

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

interface LocatedBiomeBase {
  readonly routeIndex: number;
  readonly biomeIndex: number;
}

export type LocatedBiome =
  | (LocatedBiomeBase & {
      readonly kind: 'LinearBiome';
      readonly plan: LinearBiomePlan;
      readonly layout: LinearBiomeLayout;
    })
  | (LocatedBiomeBase & {
      readonly kind: 'HubBiome';
      readonly plan: HubBiomePlan;
      readonly layout: HubBiomeLayout;
    });

export function projectCommandAddress(command: ProjectCommand): SemanticAddress {
  switch (command.kind) {
    case 'RenameProject':
      return createProjectAddress();
    case 'ConfigureRoutePrefix':
      return command.route;
    case 'CreateStart':
      return command.biome;
    case 'CreateHubTopology':
      return command.biome;
    case 'OpenHubSlot':
    case 'CloseHubSlot':
      return command.slot;
    case 'AppendHubVisit':
    case 'ReplaceHubVisit':
    case 'RemoveHubVisitsFrom':
      return command.visit;
    case 'ReplaceSideRoomGeneration':
      return command.sideRoom;
    case 'ReplaceSideRoomEntryOrder':
      return command.group;
    case 'ReplaceBiomeField':
      return command.field;
    case 'ReplaceShipEncounterCount':
      return command.occurrence;
    case 'ReplaceRewardWheelOfferCount':
    case 'ReplaceRewardWheelStore':
    case 'ReplaceRewardWheelPicked':
      return command.wheel;
    case 'ReplaceRewardWheelOffer':
      return command.offer;
    case 'CreateBatch':
    case 'ReplaceFieldsCageOutcome':
    case 'CreateTerminalTransition':
    case 'ReconcileExitCapacity':
    case 'ReconcileTerminalExitCapacity':
    case 'RemoveBatch':
    case 'RemoveTerminalTransition':
    case 'ReplaceWithBatch':
    case 'ReplaceWithTerminalTransition':
      return command.continuation;
    case 'ReplaceBatchRewardStore':
      return command.rewardStore;
    case 'CreateTarget':
      return command.target;
    case 'SetPicked':
    case 'SetTerminalPicked':
      return command.picked;
    case 'ClearTopology':
      return command.biome;
    case 'ReplaceOccurrenceRoom':
      return command.occurrence;
    case 'ReplaceIncomingReward':
      return command.reward;
    case 'ReplaceLocalReward':
      return command.reward;
    case 'ReplaceShopOffer':
      return command.offer;
    case 'SetShopPurchase':
      return command.purchase;
  }
}

export function failCommand(command: ProjectCommand, detail: string): never {
  throw new ProjectCommandContractError(command.kind, projectCommandAddress(command), detail);
}

export function locateBiome(
  document: ProjectDocument,
  catalog: Catalog,
  command: BiomeProjectCommand,
): LocatedBiome {
  const address = projectCommandAddress(command);
  if (address.kind === 'project' || address.kind === 'route') {
    throw new Error('route command reached biome command resolution');
  }
  const routeIndex = document.routes.findIndex((route) => route.routeKey === address.routeKey);
  if (routeIndex < 0) {
    failCommand(command, `unknown or unconfigured route ${address.routeKey}`);
  }
  const route = document.routes[routeIndex];
  if (route === undefined) {
    failCommand(command, `missing route ${address.routeKey}`);
  }
  const biomeIndex = route.biomes.findIndex((biome) => biome.biomeKey === address.biomeKey);
  if (biomeIndex < 0) {
    failCommand(command, `unknown or unconfigured biome ${address.biomeKey}`);
  }
  const plan = route.biomes[biomeIndex];
  if (plan === undefined) {
    failCommand(command, `missing biome ${address.biomeKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[address.biomeKey];
  if (layout === undefined) {
    failCommand(command, `catalog has no layout for ${address.biomeKey}`);
  }
  if (layout.kind === 'LinearBiome') {
    if (plan.kind !== 'LinearBiome') {
      failCommand(command, `${address.biomeKey} plan does not match its ${layout.kind} layout`);
    }
    return { kind: 'LinearBiome', routeIndex, biomeIndex, plan, layout };
  }
  if (plan.kind !== 'HubBiome') {
    failCommand(command, `${address.biomeKey} plan does not match its ${layout.kind} layout`);
  }
  return { kind: 'HubBiome', routeIndex, biomeIndex, plan, layout };
}

export function requireTopology(plan: LinearBiomePlan, command: ProjectCommand) {
  if (plan.topology === null) {
    failCommand(command, 'biome topology has not been started');
  }
  return plan.topology;
}

export function requireOccurrence(
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

export function requireRoom(
  catalog: Catalog,
  gameName: string,
  biomeKey: string,
  command: ProjectCommand,
): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    failCommand(command, `unknown room ${gameName}`);
  }
  if (room.biomeKey !== biomeKey) {
    failCommand(command, `${gameName} belongs to ${room.biomeKey}`);
  }
  return room;
}

export function hasGeneratedExit(room: RoomDeclaration, exitIndex: number): boolean {
  return room.exits.some((exit) => exit.index === exitIndex);
}

export function generatedExitIndexes(room: RoomDeclaration): readonly number[] {
  return room.exits.map((exit) => exit.index).sort((left, right) => left - right);
}

export function roomStateContext(
  role: RoomOccurrenceRole,
  resolvedStoreKey: string | undefined,
  entryActive: boolean,
): RoomStateContext {
  return {
    role,
    ...(resolvedStoreKey === undefined ? {} : { resolvedStoreKey }),
    entryActive,
  };
}

export function withBiome(
  document: ProjectDocument,
  located: LocatedBiome,
  plan: AuthoredBiomePlan,
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

function samePayload(left: RewardPayload | undefined, right: RewardPayload | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  if (left.kind === 'BoonSource') {
    return right.kind === 'BoonSource' && left.source === right.source;
  }
  return (
    right.kind === 'DevotionPair' &&
    left.chosenSource === right.chosenSource &&
    left.spurnedSource === right.spurnedSource
  );
}

export function sameOffer(left: ResolvedRewardOffer, right: ResolvedRewardOffer): boolean {
  return left.rewardType === right.rewardType && samePayload(left.payload, right.payload);
}

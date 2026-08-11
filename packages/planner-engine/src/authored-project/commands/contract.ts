import type { BiomeLayout, Catalog, RoomDeclaration } from '../../catalog-schema';
import type { AcquisitionSiteAddress, SemanticAddress } from '../addresses';
import { createProjectAddress, semanticAddressKey } from '../addresses';
import type {
  AuthoredBiomePlan,
  BiomeTopology,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
  AuthoredRoutePlan,
} from '../model';
import type { BiomeOwnedProjectCommand, ProjectCommand } from './types';

export class ProjectCommandContractError extends Error {
  readonly commandKind: ProjectCommand['kind'];
  readonly addressKey: string;
  readonly detail: string;

  constructor(
    commandKind: ProjectCommand['kind'],
    address: SemanticAddress | AcquisitionSiteAddress,
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

export function projectCommandAddress(
  command: ProjectCommand,
): SemanticAddress | AcquisitionSiteAddress {
  switch (command.kind) {
    case 'RenameProject':
      return createProjectAddress();
    case 'ConfigureRoutePrefix':
    case 'ReplaceRouteLoadout':
      return command.route;
    case 'ReplaceBiomeField':
      return command.field;
    case 'CreateStart':
    case 'ClearTopology':
      return command.biome;
    case 'CreateBatch':
    case 'CreateTakeoverBatch':
    case 'ReplaceWithTakeoverBatch':
    case 'ReconcileTakeoverBatch':
    case 'ReconcileBatchExitCapacity':
    case 'RemoveExitDecision':
    case 'ReplaceWithHubDecision':
      return command.decision;
    case 'CreateTarget':
      return command.target;
    case 'SwitchTargetToAnomaly':
      return command.target;
    case 'ReplaceAnomalyMap':
    case 'ReplaceAnomalySuccess':
    case 'RevertAnomaly':
    case 'ReplaceNaturalChaosMap':
      return command.occurrence;
    case 'AddZagreusContract':
    case 'RemoveZagreusContract':
    case 'AddNaturalChaos':
    case 'RemoveNaturalChaos':
      return command.additional;
    case 'RemoveHubDecision':
      return command.hub;
    case 'OpenHubSlot':
    case 'CloseHubSlot':
      return command.slot;
    case 'ReplaceHubVisitOrder':
      return command.hub;
    case 'ReplaceSideRoomGeneration':
      return command.sideRoom;
    case 'ReplaceSideRoomEntryOrder':
      return command.group;
    case 'SetExitSelection':
      return command.selection;
    case 'ReplaceBatchRewardStore':
      return command.rewardStore;
    case 'ReplaceFieldsCageOutcome':
      return command.decision;
    case 'ReplaceOccurrenceRoom':
    case 'ReplaceShipEncounterCount':
      return command.occurrence;
    case 'ReplaceIncomingReward':
      return command.reward;
    case 'ReplaceLocalReward':
      return command.reward;
    case 'ReplaceRewardWheelOfferCount':
    case 'ReplaceRewardWheelStore':
    case 'ReplaceRewardWheelPicked':
      return command.wheel;
    case 'ReplaceRewardWheelOffer':
      return command.offer;
    case 'ReplaceShopOffer':
      return command.offer;
    case 'ReplaceShopDeathDefianceCondition':
      return command.shop;
    case 'ReplaceAcquisitionOrder':
      return command.site;
    case 'SelectEncounter':
    case 'ResetEncounter':
      return command.phase;
    case 'ReplaceTraitOffer':
    case 'ReplaceTraitSelection':
      return command.trait;
    case 'ReplaceLevelResolution':
      return command.levelResolution;
  }
}

export function failCommand(command: ProjectCommand, detail: string): never {
  throw new ProjectCommandContractError(command.kind, projectCommandAddress(command), detail);
}

export interface LocatedBiome {
  readonly routeIndex: number;
  readonly biomeIndex: number;
  readonly loadout: AuthoredRoutePlan['loadout'];
  readonly plan: AuthoredBiomePlan;
  readonly layout: BiomeLayout;
}

export function locateBiome(
  document: ProjectDocument,
  catalog: Catalog,
  command: BiomeOwnedProjectCommand,
): LocatedBiome {
  const address = projectCommandAddress(command);
  if (address.kind === 'project' || address.kind === 'route')
    throw new Error('route command reached biome resolution');
  const routeIndex = document.routes.findIndex((route) => route.routeKey === address.routeKey);
  if (routeIndex < 0) failCommand(command, `unknown or unconfigured route ${address.routeKey}`);
  const route = document.routes[routeIndex];
  if (route === undefined) failCommand(command, `missing route ${address.routeKey}`);
  const biomeIndex = route.biomes.findIndex((biome) => biome.biomeKey === address.biomeKey);
  if (biomeIndex < 0) failCommand(command, `unknown or unconfigured biome ${address.biomeKey}`);
  const plan = route.biomes[biomeIndex];
  if (plan === undefined) failCommand(command, `missing biome ${address.biomeKey}`);
  const layout = catalog.biomeLayouts.byKey[address.biomeKey];
  if (layout === undefined) failCommand(command, `catalog has no layout for ${address.biomeKey}`);
  return { routeIndex, biomeIndex, loadout: route.loadout, plan, layout };
}

export function requireTopology(plan: AuthoredBiomePlan, command: ProjectCommand): BiomeTopology {
  if (plan.topology === null) failCommand(command, 'biome topology has not been started');
  return plan.topology;
}

export function requireOccurrence(
  plan: AuthoredBiomePlan,
  occurrenceId: OccurrenceId,
  command: ProjectCommand,
): RoomOccurrence {
  const occurrence = requireTopology(plan, command).occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (occurrence === undefined) failCommand(command, `unknown occurrence ${occurrenceId}`);
  return occurrence;
}

export function requireRoom(
  catalog: Catalog,
  gameName: string,
  biomeKey: string,
  command: ProjectCommand,
): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) failCommand(command, `unknown room ${gameName}`);
  if (room.roomSetKey !== biomeKey) {
    failCommand(command, `${gameName} belongs to ${room.roomSetKey}`);
  }
  if (room.mode.kind !== 'authored') failCommand(command, `${gameName} is layout-derived`);
  return room;
}

export function withBiome(
  document: ProjectDocument,
  located: LocatedBiome,
  plan: AuthoredBiomePlan,
): ProjectDocument {
  const route = document.routes[located.routeIndex];
  if (route === undefined) throw new Error('located route disappeared');
  const biomes = route.biomes.map((biome, index) => (index === located.biomeIndex ? plan : biome));
  return {
    ...document,
    routes: document.routes.map((candidate, index) =>
      index === located.routeIndex ? { ...route, biomes } : candidate,
    ),
  };
}

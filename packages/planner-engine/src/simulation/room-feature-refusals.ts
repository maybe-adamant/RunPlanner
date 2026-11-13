import type { ResourceFamily } from '../authored-project/model';
import type { ChallengeSwitchPlacementIssue } from './commerce/challenge-switch';
import type { HermesShrinePlacementRefusal } from './commerce/hermes-shrine';
import type { StygianWellPlacementRefusal } from './commerce/stygian-well';
import type { RoomAnchorFullRefusal } from './evaluation/room-object-anchors';

/** The room cannot hold the feature: its declaration hosts none. */
export type NotHostRefusal = {
  readonly reason: 'notHost';
};

/** The room declares the feature, but never on this route. */
export type RouteExcludedRefusal = {
  readonly reason: 'routeExcluded';
};

/** The room has no physical point for the feature (a Chaos gate's `SecretPoint`). */
export type PhysicalCapabilityRefusal = {
  readonly reason: 'physicalCapability';
};

/** The biome offers no room the feature could lead to (no Chaos room). */
export type TargetDomainRefusal = {
  readonly reason: 'targetDomain';
};

/** A declared game requirement, named as the game names it, is not met here. */
export type RequirementUnmetRefusal = {
  readonly reason: 'requirementUnmet';
  readonly requirement: 'SecretDoorRequirements' | 'ZagreusContractRequirement';
};

/** The feature was offered within its spacing window: `rooms` rooms must pass between offers. */
export type OfferSpacingRefusal = {
  readonly reason: 'offerSpacing';
  readonly rooms: number;
};

/** The feature reached its cap: `count` already used of `maximum` per route or biome. */
export type CapReachedRefusal = {
  readonly reason: 'capReached';
  readonly per: 'route' | 'biome';
  readonly count: number;
  readonly maximum: number;
};

/**
 * Another resource success lies within this host's lookback: `rooms` rooms
 * before it for `family`, the same family or another one.
 */
export type ResourceLookbackRefusal = {
  readonly reason: 'resourceLookback';
  readonly family: ResourceFamily;
  readonly scope: 'sameFamily' | 'crossFamily';
  readonly rooms: number;
};

/** The room holds another resource success it has no capacity beside. */
export type RoomCapacityRefusal = {
  readonly reason: 'roomCapacity';
  readonly family: ResourceFamily;
  readonly capacity: 'allTools' | 'simpleComplex';
};

/** Why a Chaos gate cannot spawn in its source room. */
export type ChaosGateRefusal =
  | NotHostRefusal
  | TargetDomainRefusal
  | PhysicalCapabilityRefusal
  | RequirementUnmetRefusal
  | OfferSpacingRefusal;

/** Why a Midshop cannot open its Infernal Contract door. */
export type ZagreusContractRefusal = RequirementUnmetRefusal | CapReachedRefusal;

/** Why a resource success cannot be placed on a host. */
export type ResourcePlacementRefusal =
  | NotHostRefusal
  | RouteExcludedRefusal
  | ResourceLookbackRefusal
  | CapReachedRefusal
  | RoomCapacityRefusal;

/** Why a Pool of Purging cannot stand in a room. */
export type PurgingPoolPlacementRefusal = RouteExcludedRefusal;

/**
 * Why a room feature the owner can switch on cannot appear where it is
 * asked: one typed rule per reason, shared by every toggleable feature.
 */
export type RoomFeatureRefusal =
  | StygianWellPlacementRefusal
  | HermesShrinePlacementRefusal
  | ChallengeSwitchPlacementIssue
  | RoomAnchorFullRefusal
  | ChaosGateRefusal
  | ZagreusContractRefusal
  | ResourcePlacementRefusal
  | PurgingPoolPlacementRefusal;

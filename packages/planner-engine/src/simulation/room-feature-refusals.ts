import type { ResourceFamily } from '../authored-project/model';
import type { ChallengeSwitchPlacementIssue } from './commerce/challenge-switch';
import type { HermesShrinePlacementRefusal } from './commerce/hermes-shrine';
import type { StygianWellPlacementRefusal } from './commerce/stygian-well';
import type { RoomAnchorFullRefusal } from './evaluation/room-object-anchors';

/**
 * Declaration: the room never holds the feature. A toggle never offers it
 * there, so no consumer explains it; findings on authored state still carry it.
 */
export type NotHostRefusal = {
  readonly reason: 'notHost';
};

/** The room declares the feature, but never on this route. */
export type RouteExcludedRefusal = {
  readonly reason: 'routeExcluded';
};

/** Declaration: the room has no physical point for the feature (a Chaos gate's `SecretPoint`). */
export type PhysicalCapabilityRefusal = {
  readonly reason: 'physicalCapability';
};

/** Declaration: the biome offers no room the feature could lead to (no Chaos room). */
export type TargetDomainRefusal = {
  readonly reason: 'targetDomain';
};

/** A declared game requirement, named as the game names it, is not met here. */
export type RequirementUnmetRefusal = {
  readonly reason: 'requirementUnmet';
  readonly requirement: 'SecretDoorRequirements' | 'ZagreusContractRequirement';
};

/** The room's biome depth is past the deepest one the feature appears at. */
export type BiomeDepthCeilingRefusal = {
  readonly reason: 'biomeDepthCeiling';
  readonly biomeDepthCache: number;
  readonly maximumBiomeDepth: number;
};

/**
 * The feature was offered too recently: no offer within `rooms` rooms after
 * the last one (`NoRecentChaosEncounter`, whose `SumPrevRooms` counts the host).
 */
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
 * Another resource spot of `family` lies within a lookback of `rooms` rooms:
 * before this host by this host's rule, or after it by that spot's rule.
 */
export type ResourceLookbackRefusal = {
  readonly reason: 'resourceLookback';
  readonly family: ResourceFamily;
  readonly scope: 'sameFamily' | 'crossFamily';
  readonly order: 'before' | 'after';
  readonly rooms: number;
};

/** The room holds another resource spot it has no capacity beside. */
export type RoomCapacityRefusal = {
  readonly reason: 'roomCapacity';
  readonly family: ResourceFamily;
  readonly capacity: 'allTools' | 'simpleComplex';
};

/** Why a Chaos source room never holds a gate (to a given Chaos room), by its declarations. */
export type ChaosGateHostRefusal = NotHostRefusal | PhysicalCapabilityRefusal | TargetDomainRefusal;

/** Why a Chaos gate cannot spawn in a source room that hosts gates. */
export type ChaosGateRefusal =
  RouteExcludedRefusal | BiomeDepthCeilingRefusal | RequirementUnmetRefusal | OfferSpacingRefusal;

/** Why a Midshop cannot open its Infernal Contract door. */
export type ZagreusContractRefusal =
  RouteExcludedRefusal | RequirementUnmetRefusal | CapReachedRefusal;

/** Why a resource spot cannot be placed on a host. */
export type ResourcePlacementRefusal =
  | NotHostRefusal
  | RouteExcludedRefusal
  | ResourceLookbackRefusal
  | CapReachedRefusal
  | RoomCapacityRefusal;

/** Why a Pool of Purging cannot stand in a room. */
export type PurgingPoolPlacementRefusal = RouteExcludedRefusal;

/**
 * Why a room feature the owner can switch on cannot appear where a toggle
 * offers it: one typed rule per reason, shared by every toggleable feature.
 * Declaration refusals are absent, since a toggle is offered only where the
 * room can hold the feature.
 */
export type RoomFeatureRefusal = Exclude<
  | StygianWellPlacementRefusal
  | HermesShrinePlacementRefusal
  | ChallengeSwitchPlacementIssue
  | RoomAnchorFullRefusal
  | ChaosGateRefusal
  | ZagreusContractRefusal
  | ResourcePlacementRefusal
  | PurgingPoolPlacementRefusal,
  { readonly reason: 'notHost' | 'noAnchor' }
>;

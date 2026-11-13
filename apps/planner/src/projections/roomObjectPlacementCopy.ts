import type { ResourceFamily } from '@run-planner/engine/catalog-schema';
import type { RoomFeatureRefusal } from '@run-planner/engine/simulation';
import { challengeSwitchRuleSentence } from './challengeSwitchCopy';
import { resourceFamilyLabel } from './structured-workspace/assembly/resource-labels';

/** A room feature the owner switches on, as its refusal sentences name it. */
export type RoomFeatureNoun =
  | 'stygianWell'
  | 'hermesShrine'
  | 'purgingPool'
  | 'challengeSwitch'
  | 'chaosGate'
  | 'zagreusContract'
  | { readonly resource: ResourceFamily };

const names: Readonly<
  Record<Exclude<RoomFeatureNoun, object>, { readonly one: string; readonly many: string }>
> = Object.freeze({
  stygianWell: { one: 'Stygian Well', many: 'Wells' },
  hermesShrine: { one: 'Hermes Shrine', many: 'Shrines' },
  purgingPool: { one: 'Pool of Purging', many: 'Pools of Purging' },
  challengeSwitch: { one: 'switch', many: 'Switches' },
  chaosGate: { one: 'Chaos Gate', many: 'Chaos Gates' },
  zagreusContract: { one: 'Zagreus Contract', many: 'Zagreus Contracts' },
});

function nameOf(feature: RoomFeatureNoun): { readonly one: string; readonly many: string } {
  return typeof feature === 'object' ? resourceSpotName(feature.resource) : names[feature];
}

/** A resource family's spot: lowercase mid-sentence, capitalized where a sentence starts. */
function resourceSpotName(family: ResourceFamily): { readonly one: string; readonly many: string } {
  const label = resourceFamilyLabel(family);
  return { one: `${label.toLowerCase()} spot`, many: `${label} spots` };
}

/** The rule refusing a room feature here, as one sentence. */
export function roomFeatureRefusalSentence(
  feature: RoomFeatureNoun,
  refusal: RoomFeatureRefusal,
): string {
  const { one, many } = nameOf(feature);
  switch (refusal.reason) {
    case 'noFreeAnchor':
      return 'The room’s other objects take every spot.';
    case 'biomeDepth':
      return `${many} need biome depth ${refusal.minimumBiomeDepth}; this room is at ${refusal.biomeDepthCache}.`;
    case 'biomeDepthCeiling':
      return `${many} need biome depth ${refusal.maximumBiomeDepth} or less; this room is at ${refusal.biomeDepthCache}.`;
    case 'recentWell':
    case 'recentShrine':
    case 'recentSwitch':
      return `${many} need ${refusal.minimumRoomsSinceLast} rooms between them; this one is ${refusal.roomsSinceLast} after the last.`;
    case 'kindUnavailable':
    case 'variantUnavailable':
    case 'lockedDoors':
      return challengeSwitchRuleSentence(refusal);
    case 'routeExcluded':
      return `This room holds no ${one} on this route.`;
    case 'requirementUnmet':
      return `The game’s requirements for a ${one} aren’t met here.`;
    case 'offerSpacing':
      return `${many} need more than ${refusal.rooms} rooms after the last ${one}.`;
    case 'capReached':
      return refusal.per === 'biome'
        ? `Only one ${one} per biome.`
        : `This run already had ${refusal.count === 1 ? `a ${one}` : `${refusal.count} ${many}`}; no more can appear.`;
    case 'resourceLookback': {
      // The rule is the later spot's: this host's, or the other spot's when it comes after.
      const other = resourceSpotName(refusal.family);
      return refusal.order === 'before'
        ? `${many} need more than ${refusal.rooms} rooms after the last ${other.one}.`
        : `${other.many} need more than ${refusal.rooms} rooms after the last ${one}.`;
    }
    case 'roomCapacity':
      return `This room has no space for a ${one} beside its ${resourceSpotName(refusal.family).one}.`;
  }
}

/** Why an absent room feature cannot be switched on, each rule as one sentence. */
export function roomFeatureRefusalSentences(
  feature: RoomFeatureNoun,
  refusals: readonly RoomFeatureRefusal[],
): readonly string[] {
  return Object.freeze([
    ...new Set(refusals.map((refusal) => roomFeatureRefusalSentence(feature, refusal))),
  ]);
}

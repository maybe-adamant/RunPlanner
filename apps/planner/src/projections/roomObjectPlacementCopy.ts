import type {
  HermesShrinePlacementRefusal,
  StygianWellPlacementRefusal,
} from '@run-planner/engine/simulation';

/** The rule refusing an ordinary Stygian Well here, as one sentence. */
export function stygianWellRefusalSentence(refusal: StygianWellPlacementRefusal): string {
  switch (refusal.reason) {
    case 'notHost':
      return 'This room never holds a Stygian Well.';
    case 'noAnchor':
      return 'This room has no spot for a Stygian Well.';
    case 'biomeDepth':
      return `Wells need biome depth ${refusal.minimumBiomeDepth}; this room is at ${refusal.biomeDepthCache}.`;
    case 'recentWell':
      return `Wells need ${refusal.minimumRoomsSinceLast} rooms between them; this one is ${refusal.roomsSinceLast} after the last.`;
  }
}

/** The rule refusing an ordinary Hermes Shrine here, as one sentence. */
export function hermesShrineRefusalSentence(refusal: HermesShrinePlacementRefusal): string {
  switch (refusal.reason) {
    case 'notHost':
      return 'This room never holds a Hermes Shrine.';
    case 'noAnchor':
      return 'This room has no spot for a Hermes Shrine.';
    case 'biomeDepth':
      return `Shrines need biome depth ${refusal.minimumBiomeDepth}; this room is at ${refusal.biomeDepthCache}.`;
    case 'recentShrine':
      return `Shrines need ${refusal.minimumRoomsSinceLast} rooms between them; this one is ${refusal.roomsSinceLast} after the last.`;
  }
}

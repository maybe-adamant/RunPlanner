import type { ChallengeSwitchPlacementIssue } from '@run-planner/engine/simulation';

/** A native spawn rule a switch breaks, as its finding evidence and lock carry it. */
export type ChallengeSwitchRule = ChallengeSwitchPlacementIssue;

type ChallengeSwitchAnchorOccupant = Extract<
  ChallengeSwitchRule,
  { readonly reason: 'noFreeAnchor' }
>['occupants'][number];

const occupantNames: Readonly<Record<ChallengeSwitchAnchorOccupant, string>> = Object.freeze({
  stygianWell: 'Stygian Well',
  purgingPool: 'Pool of Purging',
  hermesShrine: 'Hermes Shrine',
});

const hexGate = "Needs a Hex whose Path of Stars isn't complete.";

/** The variants whose own gate is not the kind's, by native obstacle name. */
const variantGates: Readonly<Record<string, string>> = Object.freeze({
  PerfectClearChallengeSwitch_Pom: 'Needs a boon a Pom can level.',
  EliteChallengeSwitch_Talent: hexGate,
});

function joined(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The rule a switch breaks, as one sentence. */
export function challengeSwitchRuleSentence(rule: ChallengeSwitchRule): string {
  switch (rule.reason) {
    case 'biomeDepth':
      return `Switches need biome depth ${rule.minimumBiomeDepth}; this room is at ${rule.biomeDepthCache}.`;
    case 'recentSwitch':
      return `Switches need ${rule.minimumRoomsSinceLast} rooms between them; this one is ${rule.roomsSinceLast} after the last.`;
    case 'noFreeAnchor': {
      const names = rule.occupants.map((occupant) => occupantNames[occupant]);
      return names.length > 1
        ? `The ${joined(names)} take every spot.`
        : `The ${names[0] ?? 'room'} takes the only spot.`;
    }
    case 'kindUnavailable':
      return hexGate;
    case 'variantUnavailable':
      return variantGates[rule.variantKey] ?? "This reward can't be rolled here.";
  }
}

/** A placement finding's title, naming the broken rule. */
export function challengeSwitchRuleTitle(rule: ChallengeSwitchRule): string {
  switch (rule.reason) {
    case 'biomeDepth':
      return 'Switch too early in the biome';
    case 'recentSwitch':
      return 'Switch too soon after the last one';
    case 'noFreeAnchor':
      return 'No free spot for the switch';
    case 'kindUnavailable':
      return "Elite Enemy Switch can't appear here";
    case 'variantUnavailable':
      return "This switch reward can't appear here";
  }
}

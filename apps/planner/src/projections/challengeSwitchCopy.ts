import type {
  ChallengeSwitchKind,
  ChallengeSwitchRequirementGate,
} from '@run-planner/engine/catalog-schema';
import type { ChallengeSwitchPlacementIssue } from '@run-planner/engine/simulation';

/** Each switch kind's in-game name. */
const kindLabels: Readonly<Record<ChallengeSwitchKind, string>> = Object.freeze({
  perfectClear: 'Unseen Sigil',
  time: 'Infernal Trove',
  elite: 'Moon Monument',
});

/** A switch kind's in-game name. */
export function challengeSwitchKindLabel(kind: ChallengeSwitchKind): string {
  return kindLabels[kind];
}

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

/** Each native switch requirement as the need it names. */
const requirementSentences: Readonly<Record<ChallengeSwitchRequirementGate, string>> =
  Object.freeze({
    pomLegal: 'Needs a boon a Pom can level.',
    talentLegal: "Needs a Hex whose Path of Stars isn't complete.",
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
      return rule.gate.kind === 'biomeDepth'
        ? `${challengeSwitchKindLabel(rule.switchKind)}s need biome depth ${rule.gate.minimumBiomeDepth}; this room is at ${rule.gate.biomeDepthCache}.`
        : requirementSentences[rule.gate.requirement];
    case 'variantUnavailable':
      return requirementSentences[rule.requirement];
    case 'lockedDoors':
      return 'A room with locked doors never holds a switch.';
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
      return `${challengeSwitchKindLabel(rule.switchKind)} can't appear here`;
    case 'variantUnavailable':
      return "This switch reward can't appear here";
    case 'lockedDoors':
      return 'No switch beside locked doors';
  }
}

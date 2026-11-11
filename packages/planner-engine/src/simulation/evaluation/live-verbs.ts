import {
  createBiomeAddress,
  type AcquisitionRoleAddress,
  type OccurrenceAddress,
  type RewardWheelAddress,
} from '../../authored-project/addresses';
import { authoredAcquisitionSources } from '../../authored-project/acquisition/acquisition-sources';
import type { ProjectCommand } from '../../authored-project/commands/types';
import type {
  AcquisitionDisposition,
  AuthoredRewardState,
  ProjectDocument,
  PurgingPoolSlotKey,
  RoomActionReference,
  RoomOccurrence,
} from '../../authored-project/model';
import type { RerollSurface } from '../../authored-project/rerolls';
import { roomActionKey } from '../../authored-project/room-actions/key';
import { composeStartingReward } from '../../authored-project/room-state/starting-reward';
import { TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../../authored-project/shop';
import type { RoomActionParticipation } from '../room-actions';
import type { ProjectEvaluationAssembly } from './evaluation-products';
import { acquisitionConversionCandidateForProjectEvaluationAssembly } from './project-evaluation-assembly';

/** One distinct interaction a player has with an item. */
export type LiveVerbKind =
  /** Collect a loose pickup, or take the Contract pedestal's item. */
  | 'pickUp'
  /** Collect a pickup converting it to gold with the Time Piece. */
  | 'goldify'
  /** Collect a pickup transforming it with the Artificer. */
  | 'transform'
  /** Buy a World Shop, Travel Deal, Hermes Shrine or Stygian Well item. */
  | 'buy'
  /** Buy a Hermes Shrine item rushed. */
  | 'rush'
  /** Sell a trait at a Pool of Purging. */
  | 'sell'
  /** Press a door, cage or wheel reroll, or reroll a Well's or Pool's list. */
  | 'reroll'
  /** Choose a Ship wheel, which starts its phase's fight. */
  | 'choose'
  /** Talk to an encounter's NPC, the Gorgon's Athena or Eris. */
  | 'talkTo'
  /** Unlock a Fields cage, starting its fight, or press a locked door. */
  | 'unlock'
  /** Use the fountain or the keepsake rack. */
  | 'use'
  /** Press the challenge switch. */
  | 'press';

/**
 * The picker a verb needs. `before`: the picker supplies the verb's commands,
 * which are then absent. `after`: the commands apply as is and the picker
 * then sets the placed row's own outcome, a finding until it is chosen.
 */
export type LiveVerbChoice =
  /** A Pom's level, or the trait a level resolution takes. */
  | { readonly picker: 'levelResolution'; readonly timing: 'after' }
  /** A blank Travel Deal item's value, from the room's object interactions. */
  | { readonly picker: 'travelDealItem'; readonly timing: 'before' }
  /** A press's target and the reward it draws, from the reroll surface. */
  | { readonly picker: 'rerollPress'; readonly timing: 'before'; readonly surface: RerollSurface }
  /** The list a Well or Pool reroll restocks, pinned slot by slot. */
  | { readonly picker: 'stygianWellRoll' | 'purgingPoolRoll'; readonly timing: 'after' }
  /** The trait an unpinned Pool slot sells. */
  | {
      readonly picker: 'purgingPoolSale';
      readonly timing: 'before';
      readonly rollKey: string;
      readonly slotKey: PurgingPoolSlotKey;
    }
  /** The keepsake the rack swaps in; with none chosen the held keepsake stays. */
  | { readonly picker: 'keepsake'; readonly timing: 'after' }
  /** The reward the Artificer's replacement takes. */
  | { readonly picker: 'artificerReplacement'; readonly timing: 'after' };

/** One interaction available on an item at a gap. */
export interface LiveVerb {
  readonly verb: LiveVerbKind;
  readonly participation: RoomActionParticipation;
  /** For a required verb: the last gap at which it may stand. */
  readonly deadline?: number;
  /** The row it stands as or places; absent for a reroll press, whose row the picker creates. */
  readonly reference?: RoomActionReference;
  /** The conversion's acquisition role, for a verb that sets one. */
  readonly acquisition?: AcquisitionRoleAddress;
  /** The row standing at this gap performs this verb: nothing to do. */
  readonly standing?: true;
  /**
   * Performs it at this gap, in order, as one edit. Empty while standing;
   * absent when the picker supplies them.
   */
  readonly commands?: readonly ProjectCommand[];
  /** A required action's default restore position. */
  readonly canonical?: true;
  readonly choice?: LiveVerbChoice;
}

/**
 * What lets the room progress at the frontier, once nothing else required
 * is live there: leaving through its doors, or choosing the next Ship wheel,
 * whose verb stands on that wheel. Leaving is the exit decision, not a row.
 */
export type LiveProgression =
  | { readonly kind: 'leaveRoom' }
  | { readonly kind: 'chooseWheel'; readonly wheel: RewardWheelAddress };

/** The verb a row of this kind performs. */
export function liveVerbKind(reference: RoomActionReference): LiveVerbKind {
  switch (reference.kind) {
    case 'collectRequiredReward':
    case 'interactIncomingReward':
    case 'interactLocalReward':
    case 'interactWheelReward':
    case 'interactInfernalContractPedestal':
      return 'pickUp';
    case 'interactAcquisitionEntry':
      // A Travel Deal refill is a purchase, not spawned loot.
      return reference.siteKey === 'roomExit' && reference.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
        ? 'buy'
        : 'pickUp';
    case 'interactShopOffer':
    case 'purchaseStygianWellOffer':
      return 'buy';
    case 'purchaseHermesShrineOffer':
      return reference.rushed ? 'rush' : 'buy';
    case 'sellPurgingPoolTrait':
      return 'sell';
    case 'reroll':
    case 'rerollStygianWell':
    case 'rerollPurgingPool':
      return 'reroll';
    case 'chooseRewardWheel':
      return 'choose';
    case 'interactEncounter':
    case 'interactGorgon':
    case 'interactEris':
      return 'talkTo';
    case 'completeFieldsCage':
    case 'unlockExit':
      return 'unlock';
    case 'useFountain':
    case 'interactKeepsakeRack':
      return 'use';
    case 'interactChallengeSwitch':
      return 'press';
  }
}

function authoredOccurrence(
  document: ProjectDocument,
  occurrence: OccurrenceAddress,
): RoomOccurrence | undefined {
  return document.route.biomes
    .find((biome) => biome.biomeKey === occurrence.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrence.occurrenceId);
}

/** The run's starting reward, which the route's first room acquires instead of its own. */
function routeStartIncoming(
  document: ProjectDocument,
  occurrence: OccurrenceAddress,
  authored: RoomOccurrence,
): AuthoredRewardState | undefined {
  const first = document.route.biomes[0];
  if (
    first?.biomeKey !== occurrence.biomeKey ||
    first.topology?.startOccurrenceId !== occurrence.occurrenceId
  )
    return undefined;
  return (
    composeStartingReward(
      document.route.loadout.startingReward,
      authored.startingRewardAcquisition,
    ) ?? undefined
  );
}

/** The verb taking an acquisition with each disposition; a normal one is the row's own verb. */
const DISPOSITION_VERBS: readonly (readonly [
  AcquisitionDisposition['kind'],
  LiveVerbKind | null,
])[] = [
  ['normal', null],
  ['timePiece', 'goldify'],
  ['artificer', 'transform'],
];

/**
 * The ways a standing row's one acquisition role can be taken, from the
 * capability the walk captured at that row's contact: the row's own verb
 * (picking it up, buying it), and goldifying or transforming it where the
 * reached state supports that conversion, which a paid item never does, or
 * the row already converts. Undefined when the row acquires no
 * single role the walk reached: its conversions are then unknown.
 */
export function standingDispositionVerbs(
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
  reference: RoomActionReference,
  participation: RoomActionParticipation,
  deadline: number | undefined,
): readonly LiveVerb[] | undefined {
  const authored = authoredOccurrence(assembly.project, occurrence);
  if (authored === undefined) return undefined;
  const key = roomActionKey(reference);
  const sources = authoredAcquisitionSources(
    createBiomeAddress(occurrence.routeKey, occurrence.biomeKey),
    authored,
    routeStartIncoming(assembly.project, occurrence, authored),
  ).filter((source) => source.action !== undefined && roomActionKey(source.action) === key);
  const [source] = sources;
  if (source === undefined || sources.length > 1) return undefined;
  const capability = acquisitionConversionCandidateForProjectEvaluationAssembly(
    assembly,
    source.acquisition,
  );
  if (capability?.timePieceAssessment === undefined) return undefined;
  const supported: Readonly<Record<AcquisitionDisposition['kind'], boolean>> = {
    normal: true,
    timePiece: capability.timePieceAssessment.supported,
    artificer: capability.artificerAssessment?.supported === true,
  };
  const current = source.reward.dispositionByAcquisitionRole[source.acquisition.acquisitionRole];
  const verbs = DISPOSITION_VERBS.flatMap(([kind, verb]): LiveVerb[] => {
    const standing = (current?.kind ?? 'normal') === kind;
    if (!standing && !supported[kind]) return [];
    return [
      Object.freeze({
        verb: verb ?? liveVerbKind(reference),
        participation,
        ...(deadline === undefined ? {} : { deadline }),
        reference,
        acquisition: source.acquisition,
        ...(standing
          ? { standing: true as const, commands: Object.freeze([]) }
          : {
              commands: Object.freeze([
                Object.freeze({
                  kind: 'ReplaceAcquisitionDisposition' as const,
                  acquisition: source.acquisition,
                  value: Object.freeze({ kind }),
                }),
              ]),
            }),
        ...(kind === 'artificer'
          ? {
              choice: Object.freeze({
                picker: 'artificerReplacement' as const,
                timing: 'after' as const,
              }),
            }
          : {}),
      }),
    ];
  });
  return Object.freeze(verbs);
}

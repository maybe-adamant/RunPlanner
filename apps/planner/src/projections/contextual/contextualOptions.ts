import type {
  FindingEvidenceValue,
  ForcePressureLedgerEntry,
  RewardOfferExclusionEvidence,
  ProjectCandidateEvaluation,
  RequirementEvaluationEvidence,
  RoomGenerationExclusionEvidence,
  SemanticFinding,
} from '@run-planner/engine/simulation';
import { routeRoomDeclaration } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { CounterAxis, NumericRange } from '@run-planner/engine/requirements';

import {
  candidateSupport,
  type CandidateOptionProjection,
  type CandidateProjectionEvaluation,
} from '../candidates/candidateProjection';
import { formatFindingSentence, presentFinding } from '../evaluationProjection';
import { inactiveEncounterPhaseMessage, rangeLabel } from '../encounterPickerProjection';
import { roomPickerCandidateCategory } from '../roomSelectorProjection';
import { summarizeRewardOffer } from '../rewards/rewardOfferSummary';
import { biomeFieldLabel } from '../structured-workspace/assembly/biome-field-labels';
import { workspaceRewardStoreLabel } from '../structured-workspace/assembly/reward-labels';

export type ContextualOptionState = 'forced' | 'possible' | 'impossible' | 'unassessed';

export interface CandidateExplanation {
  readonly kind: string;
  readonly message: string;
}

export interface ContextualOption<T> {
  readonly value: T;
  readonly label: string;
  readonly category?: string;
  readonly state: ContextualOptionState;
  readonly selected: boolean;
  /** At most two distinct reasons, most direct first. */
  readonly explanations?: readonly CandidateExplanation[];
}

export interface ContextualOptionPresentation {
  readonly label: string;
  readonly category?: string;
  /** Domain-specific, typed reasons supplied by its application projector. */
  readonly explanations?: readonly CandidateExplanation[];
  readonly selected: boolean;
}

/** A blocked choice shows at most this many reason lines. */
const maxReasons = 2;

/** Distinct reasons in their given order, capped for one picker row. */
export function distinctReasons(
  reasons: readonly CandidateExplanation[],
): readonly CandidateExplanation[] {
  const seen = new Set<string>();
  const kept: CandidateExplanation[] = [];
  for (const reason of reasons) {
    if (seen.has(reason.message)) continue;
    seen.add(reason.message);
    kept.push(reason);
    if (kept.length === maxReasons) break;
  }
  return Object.freeze(kept);
}

export interface ContextualOptionResolver {
  readonly resolve: <T>(
    options: readonly CandidateOptionProjection<T, CandidateProjectionEvaluation>[],
    presentationFor: (
      option: CandidateOptionProjection<T, CandidateProjectionEvaluation>,
    ) => ContextualOptionPresentation,
  ) => readonly ContextualOption<T>[];
}

function biomeName(catalog: Catalog, biomeKey: string): string {
  const biome = catalog.biomes.byKey[biomeKey];
  if (biome === undefined)
    throw new Error(`contextual option references unknown biome ${biomeKey}`);
  return biome.label;
}

function counterLabel(axis: CounterAxis): string {
  switch (axis) {
    case 'biomeDepthCache':
      return 'Biome depth';
    case 'biomeEncounterDepth':
      return 'Encounter depth';
    case 'encounterDepth':
      return 'Route encounter depth';
    case 'enteredBiomes':
      return 'Entered biome count';
    case 'upgradableTraitCount':
      return 'Upgradable trait count';
  }
}

function routeLabel(catalog: Catalog, routeKey: string): string {
  return catalog.routes.byKey[routeKey]?.label ?? routeKey;
}

/** Room labels, realized on the route when the route is known. */
function roomLabels(
  catalog: Catalog,
  gameNames: readonly string[],
  routeKey: string | undefined,
): string {
  return [
    ...new Set(
      gameNames.map((name) =>
        catalog.rooms.byKey[name] === undefined
          ? name
          : routeKey === undefined
            ? catalog.rooms.byKey[name]!.label
            : roomName(catalog, name, routeKey),
      ),
    ),
  ].join(' / ');
}

function rewardTypeLabel(catalog: Catalog, key: string): string {
  return catalog.rewards.rewardTypes.byKey[key]?.label ?? key;
}

function encounterNames(catalog: Catalog, keys: readonly string[]): string {
  return [
    ...new Set(keys.map((key) => catalog.encounterDefinitions.byKey[key]?.label ?? key)),
  ].join(' / ');
}

/**
 * A requirement over most ordinary gods reads as a rule, not a list: "" for all of
 * them, ", not counting Ares" when it leaves a few out, undefined when it is a short list.
 */
function godSetPhrase(catalog: Catalog, keys: readonly string[]): string | undefined {
  const domain = catalog.rewards.payloadDomains.byKey.BoonSource;
  if (domain?.kind !== 'oneOf' || keys.length < 3) return undefined;
  if (!keys.every((key) => domain.values.includes(key))) return undefined;
  const left = domain.values.filter((key) => !keys.includes(key));
  if (left.length > 2) return undefined;
  return left.length === 0
    ? ''
    : `, not counting ${left.map((key) => rewardTypeLabel(catalog, key)).join(' or ')}`;
}

const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

/** The entered-biome counter read as a route position: "from the second biome on". */
function enteredBiomeMessage(range: NumericRange, expected: boolean): string | undefined {
  if (!expected) return undefined;
  const { min, max } = range;
  if (min !== undefined && max === undefined && ordinals[min - 1] !== undefined)
    return `Appears from the ${ordinals[min - 1]} biome on.`;
  if (max !== undefined && (min === undefined || min <= 1))
    return max === 1 ? 'Only in the first biome.' : `Only in the first ${max} biomes.`;
  if (min !== undefined && max !== undefined && ordinals[min - 1] && ordinals[max - 1])
    return min === max
      ? `Only in the ${ordinals[min - 1]} biome.`
      : `Only from the ${ordinals[min - 1]} to the ${ordinals[max - 1]} biome.`;
  return undefined;
}

/** A god's loot key (`ApolloUpgrade`) by its giver's name. */
function lootLabel(catalog: Catalog, key: string): string {
  const giverKey = key.replace(/Upgrade$/, '');
  return catalog.traitGivers.byKey[giverKey]?.label ?? giverKey;
}

function recordMessage(
  catalog: Catalog,
  routeKey: string | undefined,
  evidence: Extract<
    RequirementEvaluationEvidence,
    { readonly kind: 'recordCount' | 'distinctRecordKeyCount' }
  >,
  expected: boolean,
): string {
  const range = expected
    ? rangeLabel(evidence.expected)
    : `outside ${rangeLabel(evidence.expected)}`;
  switch (evidence.record) {
    case 'roomsEntered': {
      const rooms = roomLabels(catalog, evidence.keys, routeKey);
      return expected && evidence.expected.max === 0
        ? `${rooms} was already entered this run.`
        : `${rooms} entered ${times(evidence.actual)} this run; requires ${range}.`;
    }
    case 'lootTypeHistory':
    case 'useRecord':
    case 'biomeUseRecord':
    case 'lifetimeGodUseRecord':
    case 'lifetimeGodPickupRecord': {
      const scope =
        evidence.record === 'biomeUseRecord'
          ? 'in this biome'
          : evidence.record === 'lifetimeGodUseRecord' ||
              evidence.record === 'lifetimeGodPickupRecord'
            ? 'on this save file'
            : 'this run';
      const names = evidence.keys.map(
        (key) => catalog.rewards.rewardTypes.byKey[key]?.label ?? lootLabel(catalog, key),
      );
      const gods = godSetPhrase(catalog, evidence.keys);
      if (gods !== undefined && evidence.record === 'lootTypeHistory' && expected)
        return evidence.kind === 'distinctRecordKeyCount'
          ? `Requires boons from ${rangeLabel(evidence.expected)} different gods this run${gods}; currently ${evidence.actual}.`
          : `Requires ${rangeLabel(evidence.expected)} boons this run${gods}; currently ${evidence.actual}.`;
      if (evidence.kind === 'distinctRecordKeyCount')
        return `Requires rewards from ${range} different gods this run; currently ${evidence.actual}.`;
      // A use limit gates the reward itself, so naming its keys would repeat the choice.
      if (expected && evidence.expected.max === 0)
        return evidence.record === 'biomeUseRecord'
          ? 'Already used in this biome.'
          : `${names.join(' / ')} already used ${scope}.`;
      if (expected && evidence.expected.min === 1 && evidence.expected.max === undefined)
        return `Requires ${names.join(' or ')} used earlier ${scope}.`;
      return `${names.join(' / ')} used ${times(evidence.actual)} ${scope}; requires ${range}.`;
    }
    case 'resourceGains':
      return `${evidence.keys.join(' / ')} gained this run: ${evidence.actual}; requires ${range}.`;
  }
}

/** The failed room conditions, read with the polarity a `not` imposes. */
function requirementMessages(
  catalog: Catalog,
  routeKey: string | undefined,
  evidence: RequirementEvaluationEvidence,
  expected = true,
): readonly string[] {
  if (evidence.satisfied === expected) return [];
  switch (evidence.kind) {
    case 'routeKeyEquals':
      return [
        expected
          ? `Requires the ${routeLabel(catalog, evidence.expected)} route.`
          : `Unavailable on the ${routeLabel(catalog, evidence.expected)} route.`,
      ];
    case 'all':
    case 'any': {
      const children = evidence.children
        .map((child) => requirementMessages(catalog, routeKey, child, expected))
        .filter((messages) => messages.length > 0);
      if ((evidence.kind === 'all') === expected) return [...new Set(children.flat())];
      const alternatives = [
        ...new Set(children.map((messages) => messages.join(' ').replace(/\.$/, ''))),
      ];
      return alternatives.length <= 1
        ? alternatives.map((message) => `${message}.`)
        : [`Requires one of: ${alternatives.join('; or ')}.`];
    }
    case 'not':
      return requirementMessages(catalog, routeKey, evidence.child, !expected);
    case 'counterRange':
      return [
        (evidence.axis === 'enteredBiomes'
          ? enteredBiomeMessage(evidence.expected, expected)
          : undefined) ??
          `${counterLabel(evidence.axis)} is ${evidence.actual}; requires ${expected ? '' : 'outside '}${rangeLabel(evidence.expected)}.`,
      ];
    case 'recordCount':
    case 'distinctRecordKeyCount':
      return [recordMessage(catalog, routeKey, evidence, expected)];
    case 'recentEnvelopeSlotCount':
      return [
        `Requires ${expected ? '' : 'outside '}${rangeLabel(evidence.expected)} matching encounters in the previous ${evidence.roomWindow} rooms; currently ${evidence.actual}.`,
      ];
    case 'minExits':
      return [`This room has ${evidence.actual} doors; requires at least ${evidence.minimum}.`];
    case 'currentBatchTargetCount':
      return [
        `These doors lead to ${evidence.actual} rooms; requires ${expected ? '' : 'outside '}${rangeLabel(evidence.expected)}.`,
      ];
    case 'currentBatchRoomCount':
      return [
        `${evidence.actual} of these doors lead to ${roomLabels(catalog, evidence.roomGameNames, routeKey)}; requires ${expected ? '' : 'outside '}${rangeLabel(evidence.expected)}.`,
      ];
    case 'clockworkGoalsRemaining':
      return [
        `${evidence.actual} Clockwork goals remain; requires ${expected ? '' : 'outside '}${rangeLabel(evidence.expected)}.`,
      ];
    case 'clockworkNonGoalCapacity':
      return [
        `The Clockwork non-goal capacity is exhausted (${evidence.acquired}/${evidence.maximum}).`,
      ];
    case 'encounterKeyCount': {
      const scope = evidence.scope === 'route' ? 'run' : 'biome';
      const names = encounterNames(catalog, evidence.encounterKeys);
      return [
        expected && evidence.expected.max === 0
          ? `${names} already occurred this ${scope}.`
          : `Requires ${expected ? '' : 'outside '}${rangeLabel(evidence.expected)} occurrences of ${names} this ${scope}; currently ${evidence.actual}.`,
      ];
    }
    case 'encounterCompletionCount': {
      const names = encounterNames(catalog, evidence.encounterKeys);
      return [
        expected && evidence.expected.max === 0
          ? `${names} was already completed this run.`
          : expected && evidence.expected.min === 1 && evidence.expected.max === undefined
            ? `Requires ${names} to be completed earlier this run.`
            : `Requires ${expected ? '' : 'outside '}${rangeLabel(evidence.expected)} completions of ${names} this run; currently ${evidence.actual}.`,
      ];
    }
    case 'previousRoomEncounterKeyCount': {
      const names = encounterNames(catalog, evidence.encounterKeys);
      return [
        expected && evidence.expected.max === 0
          ? `${names} occurred within the previous ${evidence.roomWindow} rooms.`
          : `Requires ${expected ? '' : 'outside '}${rangeLabel(evidence.expected)} of ${names} in the previous ${evidence.roomWindow} rooms; currently ${evidence.actual}.`,
      ];
    }
    case 'notInCurrentRoomShopOptions':
      return [
        expected
          ? `This room's Shop already offers ${rewardTypeLabel(catalog, evidence.rewardType)}.`
          : `Requires ${rewardTypeLabel(catalog, evidence.rewardType)} in this room's Shop.`,
      ];
    case 'offeredRewardExcludes':
      return [
        expected
          ? `${rewardTypeLabel(catalog, evidence.rewardType)} was already offered on the doors leading here.`
          : `Requires ${rewardTypeLabel(catalog, evidence.rewardType)} offered on the doors leading here.`,
      ];
    case 'rewardLookupExcludes': {
      const where = evidence.lookupKey === 'hubRewardLookup' ? 'in this Hub' : 'here';
      return [
        expected
          ? `${rewardTypeLabel(catalog, evidence.rewardType)} is already offered ${where}.`
          : `Requires ${rewardTypeLabel(catalog, evidence.rewardType)} offered ${where}.`,
      ];
    }
    case 'minRoomsSinceEvent': {
      const event = evidence.event === 'Devotion' ? 'A Trial' : evidence.event;
      return [
        evidence.actual === null
          ? `Requires ${event.replace(/^A /, 'a ')} earlier this run.`
          : `${event} was ${evidence.actual} rooms ago; requires at least ${evidence.minimum}.`,
      ];
    }
    case 'currentRoomRewardExcludes':
      return [
        expected
          ? `Unavailable with this room's reward: ${evidence.actual === null ? 'none' : rewardTypeLabel(catalog, evidence.actual)}.`
          : `Requires a room reward of ${evidence.rewardTypes.map((key) => rewardTypeLabel(catalog, key)).join(' / ')}.`,
      ];
    case 'currentRoomStructuralTagsInclude':
      return [
        `${expected ? 'Requires' : 'Unavailable in'} ${evidence.expected.join(' / ').toLowerCase()} rooms.`,
      ];
    case 'flagEquals': {
      // The flag's actual value is the opposite of what the condition needs.
      const actual = expected ? !evidence.expected : evidence.expected;
      return [
        evidence.flag === 'pendingSpellDrop'
          ? actual
            ? 'A Spell Drop is already pending.'
            : 'Requires a pending Spell Drop.'
          : actual
            ? 'Every Spell talent is already invested.'
            : 'Requires every Spell talent invested.',
      ];
    }
    case 'equippedAspectEquals': {
      const aspect = catalog.aspects.byKey[evidence.expected]?.label ?? evidence.expected;
      return [expected ? `Requires ${aspect}.` : `Unavailable with ${aspect}.`];
    }
  }
}

/** The room's label as the route realizes it. */
function roomName(catalog: Catalog, gameName: string, routeKey: string): string {
  const room = routeRoomDeclaration(catalog.rooms.byKey[gameName], routeKey);
  if (room === undefined) throw new Error(`contextual option references unknown room ${gameName}`);
  return room.label;
}

function times(count: number): string {
  return count === 1 ? 'once' : `${count} times`;
}

/** Which room category a door offers, when the selected room lies outside them. */
function notCandidateMessage(catalog: Catalog, pressure: ForcePressureLedgerEntry): string {
  const { biomeKey } = pressure.targetOrigin;
  const category = (gameName: string) => {
    const room = catalog.rooms.byKey[gameName];
    return room === undefined ? undefined : roomPickerCandidateCategory(biomeKey, room);
  };
  const offered = new Set(pressure.eligibleRoomGameNames.flatMap((name) => category(name) ?? []));
  const selected = category(pressure.selectedGameName);
  return selected !== undefined && offered.size > 0 && !offered.has(selected)
    ? `This door does not lead to ${selected} rooms.`
    : 'Not one of the rooms this door can offer.';
}

function roomExclusionExplanations(
  catalog: Catalog,
  exclusion: RoomGenerationExclusionEvidence,
  pressure: ForcePressureLedgerEntry,
): readonly CandidateExplanation[] {
  const routeKey = pressure.targetOrigin.routeKey;
  switch (exclusion.kind) {
    case 'notCandidate':
      return [{ kind: 'declaration', message: notCandidateMessage(catalog, pressure) }];
    case 'physicalExitUnavailable':
      return [{ kind: 'exit', message: `Door ${exclusion.exitIndex} is unavailable here.` }];
    case 'exitIncompatible':
      return [
        {
          kind: 'compatibility',
          message: `${roomName(catalog, exclusion.candidateGameName, routeKey)} is incompatible with this door.`,
        },
      ];
    case 'currentRoomRepeat':
      return [{ kind: 'repeat', message: 'The current room cannot immediately repeat.' }];
    case 'forceMinimum':
      return [
        {
          kind: 'counter',
          // Worded like the matching eligibility range so the two de-duplicate.
          message: `${counterLabel(exclusion.axis)} is ${exclusion.actual}; requires at least ${exclusion.minimum}.`,
        },
      ];
    case 'eligibilityRequirement':
      return requirementMessages(catalog, routeKey, exclusion.evaluation).map((message) => ({
        kind: 'requirement',
        message,
      }));
    case 'maxCreationsThisRun':
      return [
        {
          kind: 'cap',
          message: `This room can appear at most ${times(exclusion.maximum)} on this route.`,
        },
      ];
    case 'maxCreationsPerRoom':
      return [
        {
          kind: 'cap',
          message: `This room can appear at most ${times(exclusion.maximum)} among these doors.`,
        },
      ];
    case 'maxAppearancesThisBiome':
      return [
        {
          kind: 'cap',
          message: `This room can appear at most ${times(exclusion.maximum)} in this biome.`,
        },
      ];
    case 'forcedPool': {
      const rooms = exclusion.requiredRoomGameNames.map((name) =>
        roomName(catalog, name, routeKey),
      );
      const subject = rooms.length === 1 ? 'This room must' : 'These rooms must';
      return [{ kind: 'force', message: `${subject} be included here: ${rooms.join(', ')}.` }];
    }
  }
}

type EvidenceRecord = Readonly<Record<string, FindingEvidenceValue>>;

function evidenceRecord(value: FindingEvidenceValue | undefined): EvidenceRecord | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as EvidenceRecord;
}

function numberedLabel(value: string, prefix: string): string {
  const suffix = value.match(/(\d+)$/)?.[1];
  return suffix === undefined ? prefix : `${prefix} ${Number(suffix)}`;
}

function rewardPeerLabel(catalog: Catalog, value: FindingEvidenceValue | undefined): string {
  const origin = evidenceRecord(value);
  if (origin === undefined || typeof origin.kind !== 'string') return 'another offer';
  switch (origin.kind) {
    case 'target':
      return typeof origin.exitKey === 'string'
        ? numberedLabel(origin.exitKey, 'Door')
        : 'another offer';
    case 'rewardWheelOffer':
      return typeof origin.offerKey === 'string'
        ? numberedLabel(origin.offerKey, 'Wheel slot')
        : 'another offer';
    case 'shopOffer':
      return typeof origin.offerKey === 'string'
        ? numberedLabel(origin.offerKey, 'Shop slot')
        : 'another offer';
    case 'localReward':
      return typeof origin.slotKey === 'string'
        ? numberedLabel(origin.slotKey, origin.groupKey === 'cages' ? 'Cage' : 'Side room')
        : 'another offer';
    case 'hubSlot': {
      if (
        typeof origin.routeKey !== 'string' ||
        typeof origin.biomeKey !== 'string' ||
        typeof origin.hubSlotKey !== 'string'
      ) {
        return 'another Hub room';
      }
      const layout = catalog.biomeLayouts.byKey[origin.biomeKey];
      const slot =
        layout?.progression.kind === 'hub'
          ? layout.progression.slots.find((candidate) => candidate.slotKey === origin.hubSlotKey)
          : undefined;
      return slot === undefined
        ? 'another Hub room'
        : roomName(catalog, slot.roomGameName, origin.routeKey);
    }
    default:
      return 'another offer';
  }
}

/** "the Major Reward pool", or "this reward pool" when the pool has no player name. */
function storeLabel(storeKey: string): string {
  const label = workspaceRewardStoreLabel(storeKey);
  return label === storeKey ? 'this reward pool' : `the ${label} pool`;
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function namesList(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** One engine reason a reward offer is impossible, in game words. */
function rewardExclusionMessages(
  catalog: Catalog,
  exclusion: RewardOfferExclusionEvidence,
): readonly string[] {
  switch (exclusion.kind) {
    case 'notInStore':
      return [
        exclusion.storeKey === null
          ? 'Not in this reward pool.'
          : `Not in ${storeLabel(exclusion.storeKey)}.`,
      ];
    case 'notInShop':
      return ['This Shop slot never stocks this item.'];
    case 'offRoute':
      return [`Not offered on the ${routeLabel(catalog, exclusion.routeKey)} route.`];
    case 'rewardTypeFixed':
      return [`This source always gives ${rewardTypeLabel(catalog, exclusion.rewardType)}.`];
    case 'excludedByProducer':
      return ['This source never gives this reward.'];
    case 'forcedReward':
      return [`${summarizeRewardOffer(catalog, exclusion.offer)} must be offered here.`];
    case 'olympianProviderForced':
      return [
        `${catalog.traitGivers.byKey[exclusion.providerKey]?.label ?? rewardTypeLabel(catalog, exclusion.providerKey)} must be the god here.`,
      ];
    case 'priorityRequired':
      return [`${rewardTypeLabel(catalog, exclusion.rewardType)} must be offered first.`];
    case 'peerConflict': {
      const places = [
        ...new Set(
          exclusion.peers.map((peer) =>
            rewardPeerLabel(catalog, peer.origin as unknown as FindingEvidenceValue),
          ),
        ),
      ];
      return [
        places.every((place) => place === 'another offer')
          ? 'This reward conflicts with another offer.'
          : `This reward conflicts with the offer on ${namesList(places.slice(0, 2))}.`,
      ];
    }
    case 'godCap':
      return [
        `This run already has ${exclusion.cap} gods: ${namesList(exclusion.acquiredSources.map((source) => rewardTypeLabel(catalog, source)))}.`,
      ];
    case 'godRequirement':
    case 'entryRequirement':
    case 'shopOptionRequirement':
      return requirementMessages(catalog, undefined, exclusion.evaluation);
    case 'godNotInteracted':
      // World Shop boons come only from gods already picked up on this save file.
      return ['The Shop offers only gods already picked up on this save file.'];
    case 'devotionSourceNotAcquired':
      return [
        `Requires a boon from ${namesList(exclusion.sources.map((source) => rewardTypeLabel(catalog, source)))} earlier this run.`,
      ];
    case 'entriesSpent':
      return [
        `${capitalized(storeLabel(exclusion.storeKey))} has no ${rewardTypeLabel(catalog, exclusion.rewardType)} left.`,
      ];
    case 'shopExcluded':
      return [`The restock leaves out ${rewardTypeLabel(catalog, exclusion.name)}.`];
    case 'contractNotEquipped':
      return [
        `Requires ${catalog.traits.byKey.InfernalContractBoon?.label ?? 'its boon'} equipped.`,
      ];
    case 'storeExhausted':
      return [
        `${capitalized(storeLabel(exclusion.storeKey))} is exhausted, so only ${rewardTypeLabel(catalog, exclusion.fallbackRewardType)} is offered.`,
      ];
  }
}

/** Leads a reason that holds only in some reached branches. */
export const alternativePrefix = 'Depending on earlier rolls: ';

/** Engine reward exclusions; one that holds only in some branches reads as an alternative. */
function rewardExclusionExplanations(
  catalog: Catalog,
  exclusions: readonly RewardOfferExclusionEvidence[],
): readonly CandidateExplanation[] {
  return exclusions.flatMap((exclusion) =>
    rewardExclusionMessages(catalog, exclusion).map((message) => ({
      kind: exclusion.kind,
      message: exclusion.allBranches ? message : `${alternativePrefix}${message}`,
    })),
  );
}

function siblingExplanation(
  catalog: Catalog,
  finding: SemanticFinding,
): CandidateExplanation | undefined {
  const peers = Array.isArray(finding.evidence.priorOffers) ? finding.evidence.priorOffers : [];
  const firstPeer = evidenceRecord(peers[0]);
  if (firstPeer === undefined) return undefined;
  const peer = rewardPeerLabel(catalog, firstPeer.origin);
  return {
    kind: 'sibling',
    message:
      peer === 'another offer'
        ? 'This reward conflicts with another offer.'
        : `This reward conflicts with the offer on ${peer}.`,
  };
}

/** The finding's own presented copy, when the candidate context adds nothing to it. */
function presented(
  kind: CandidateExplanation['kind'],
  finding: SemanticFinding,
): CandidateExplanation {
  return { kind, message: formatFindingSentence(presentFinding(finding)) };
}

function findingExplanation(catalog: Catalog, finding: SemanticFinding): CandidateExplanation {
  const sibling = siblingExplanation(catalog, finding);
  if (sibling !== undefined) return sibling;
  switch (finding.code) {
    case 'traitOfferGenerationUnavailable':
      return { kind: 'trait', message: 'This trait offer cannot occur at the current frontier.' };
    case 'unsupportedSparseTraitOffer':
      return { kind: 'trait', message: 'This provider needs three choices.' };
    case 'encounterCustomizationUnavailable':
      return { kind: 'generic', message: presentFinding(finding).description! };
    case 'encounterIntroductionRequired': {
      const introductionKey = String(finding.evidence.introductionEncounterKey);
      const introduction =
        catalog.encounterDefinitions.byKey[introductionKey]?.label ?? introductionKey;
      return {
        kind: 'generic',
        message:
          finding.evidence.admitted === true
            ? `An enemy here is not introduced yet: select ${introduction} for this encounter, or remove the enemy.`
            : `An enemy here is not introduced yet and cannot appear until ${introduction} is completed; remove it.`,
      };
    }
    case 'fieldsSpatialPointMissing':
      return { kind: 'generic', message: 'Choose a physical point for this active Fields item.' };
    case 'fieldsSpatialPointUnavailable':
      return { kind: 'generic', message: 'Choose a physical point available to this Fields item.' };
    case 'fieldsSpatialPointDuplicate':
      return {
        kind: 'generic',
        message: 'Choose a physical point not used by another active item.',
      };
    case 'resourcePlacementUnavailable':
      return { kind: 'generic', message: 'This selected resource success needs repair.' };
    case 'purgingPoolTraitMissing':
      return { kind: 'trait', message: 'Choose an available trait for this Pool slot.' };
    case 'purgingPoolTraitUnavailable':
      return { kind: 'trait', message: 'Choose a trait currently eligible for the Pool.' };
    case 'purgingPoolTraitDuplicate':
      return { kind: 'trait', message: 'Each Pool slot must name a different trait.' };
    case 'purgingPoolUnavailable':
      return { kind: 'generic', message: 'This route has no usable Pool.' };
    case 'hermesShrinePlacementUnavailable':
      return { kind: 'generic', message: 'This ordinary Shrine is outside its placement window.' };
    case 'hermesShrineDeliveryPlacementRequired':
      return {
        kind: 'acquisition',
        message: 'Restore this missing Shrine delivery at its due room.',
      };
    case 'echoGoldPickupPlacementRequired':
      return {
        kind: 'acquisition',
        message: 'Restore this missing Gold Gold Gold pickup on the Timeline.',
      };
    case 'roomActionOrderUnavailable':
    case 'roomActionPlacementRequired':
      return presented('generic', finding);
    case 'hermesShrineInventoryMissing':
    case 'hermesShrineInventoryWrongGroup':
    case 'hermesShrineInventoryDuplicate':
    case 'hermesShrineInventoryRequirement':
    case 'hermesShrineTravelDealRefillMissing':
    case 'hermesShrineTravelDealRefillUnavailable':
    case 'stygianWellMissing':
    case 'stygianWellWrongGroup':
    case 'stygianWellDuplicate':
    case 'stygianWellPlacementUnavailable':
    case 'stygianWellTravelDealRefillUnavailable':
    case 'stygianWellTwistInvalid':
      return presented('store', finding);
    case 'ixionChaosMissing':
      return {
        kind: 'generic',
        message: "Ixion's Chaos gate belongs on the first room that can offer a Chaos exit.",
      };
    case 'ixionChaosUnavailable':
      return { kind: 'generic', message: 'No pending Ixion effect creates this Chaos gate.' };
    case 'chaosRejectedBlockMissing':
      return { kind: 'trait', message: 'Rejected requires one visible option to be blocked.' };
    case 'chaosRejectedBlockUnavailable':
      return {
        kind: 'trait',
        message: 'The Rejected block must name an unselected visible option.',
      };
    case 'chaosPairUnavailable':
      return {
        kind: 'trait',
        message: 'This Chaos pair needs a prerequisite that is not yet active.',
      };
    case 'callingCardRarificationUnavailable':
      return { kind: 'trait', message: 'Calling Card cannot rarify this option here.' };
    case 'timePieceConversionUnavailable':
      return { kind: 'reward', message: 'Time Piece cannot convert this acquisition here.' };
    case 'artificerConversionUnavailable':
      return { kind: 'reward', message: 'Artificer cannot convert this acquisition here.' };
    case 'seaStarDuplicationUnavailable':
      return { kind: 'reward', message: 'Sea Star cannot duplicate this acquisition here.' };
    case 'artificerReplacementUnavailable':
      return { kind: 'reward', message: 'This Artificer replacement is unavailable here.' };
    case 'targetRoomSupportEmpty':
      return { kind: 'room', message: 'No room can be offered when this door appears.' };
    case 'echoPomTargetMissing':
      return {
        kind: 'trait',
        message: 'Choose a greatest-level trait, or record that no eligible target exists.',
      };
    case 'echoPomNoTargetUnavailable':
      return { kind: 'trait', message: 'A Pom-eligible trait exists, so Echo Pom needs a target.' };
    case 'echoPomTargetUnavailable':
      return { kind: 'trait', message: 'Not a highest-level Pom-eligible trait.' };
    case 'naturalSelectionResultMissing':
      return { kind: 'trait', message: 'Choose the successful Natural Selection level targets.' };
    case 'naturalSelectionResultUnavailable':
      return { kind: 'trait', message: 'Repair this Natural Selection target sequence.' };
    case 'steadyGrowthOutcomeMissing':
      return { kind: 'trait', message: 'Choose the Steady Growth rarity target.' };
    case 'steadyGrowthOutcomeUnavailable':
      return { kind: 'trait', message: 'Choose a trait eligible for a rarity increase.' };
    case 'transcendentEmbryoOutcomeMissing':
      return { kind: 'trait', message: 'Choose the Chaos blessing for Transcendent Embryo.' };
    case 'transcendentEmbryoOutcomeUnavailable':
      return {
        kind: 'trait',
        message: 'Choose a Chaos blessing eligible for Transcendent Embryo.',
      };
    case 'fountainRarityResultMissing':
      return { kind: 'trait', message: 'Choose the Common boon promoted by Aromatic Phial.' };
    case 'fountainRarityResultUnavailable':
      return { kind: 'trait', message: 'Choose a boon currently eligible for Aromatic Phial.' };
    case 'concaveStoneResultMissing':
      return { kind: 'trait', message: 'Choose whether Concave Stone procs on this boon screen.' };
    case 'concaveStoneResultUnavailable':
      return { kind: 'trait', message: 'Choose a supported frozen Concave Stone residual boon.' };
    case 'fieldsOptionalCapacityUnavailable':
      return { kind: 'fields', message: 'Reduce optional rewards to leave room for Nemesis.' };
    case 'nemesisOutcomeMissing':
      return { kind: 'encounter', message: 'Choose the result of this Nemesis event.' };
    case 'nemesisOutcomeUnavailable':
      return { kind: 'encounter', message: 'Choose a Nemesis result legal at this interaction.' };
    case 'echoLastRunBoonMissing':
      return { kind: 'trait', message: 'Choose one to three boons from the previous run.' };
    case 'echoLastRunBoonOptionUnavailable':
      return { kind: 'trait', message: 'Choose a currently eligible previous-run boon outcome.' };
    case 'allTogetherResultMissing':
      return { kind: 'trait', message: 'Choose one direct trait outcome for every element set.' };
    case 'allTogetherResultUnavailable':
      return { kind: 'trait', message: 'Repair the direct trait outcomes for All Together.' };
    case 'hexTalentTreeUnavailable':
    case 'hexActivationMissing':
    case 'hexActivationUnavailable':
      return presented('trait', finding);
    case 'persephoneLevelBonusUnavailable':
      return { kind: 'trait', message: 'Choose an available Persephone roll.' };
    case 'targetRoomUnavailable':
      return 'anomalyReplacement' in finding.evidence
        ? { kind: 'room', message: 'An Anomaly cannot occur here.' }
        : {
            kind: 'room',
            message: 'This room is not among the rooms that can be offered for this door.',
          };
    case 'judgmentOutcomeMissing':
    case 'judgmentOutcomeWrongCardinality':
    case 'judgmentOutcomeTargetUnavailable':
    case 'figurineOutcomeMissing':
    case 'figurineOutcomeWrongCardinality':
    case 'figurineOutcomeTargetUnavailable':
      return presented('generic', finding);
    case 'keepsakeUnavailable':
      return {
        kind: 'generic',
        message: 'Choose a keepsake that remains available at this rack frontier.',
      };
    case 'erisSpawnUnavailable':
      return {
        kind: 'generic',
        message: 'Eris spawns only while her curse is absent; an earlier talk already applied it.',
      };
    case 'keepsakeEquipResultMissing':
    case 'keepsakeEquipResultUnavailable':
      if (
        finding.origin.kind === 'keepsakeEquipResult' &&
        finding.origin.resultKind === 'experimentalHammer'
      ) {
        return {
          kind: 'generic',
          message:
            finding.code === 'keepsakeEquipResultMissing'
              ? 'Choose the Hammer trait granted by Experimental Hammer.'
              : 'Choose a Hammer trait compatible with the active weapon and aspect.',
        };
      }
      return {
        kind: 'generic',
        message:
          finding.code === 'keepsakeEquipResultMissing'
            ? finding.origin.kind === 'keepsakeEquipResult' &&
              finding.origin.resultKind === 'transcendentEmbryo'
              ? 'Choose the Chaos blessing granted by Transcendent Embryo.'
              : 'Choose the Hades trait granted by Jeweled Pom.'
            : finding.origin.kind === 'keepsakeEquipResult' &&
                finding.origin.resultKind === 'transcendentEmbryo'
              ? 'Choose a Chaos blessing eligible when Transcendent Embryo is equipped.'
              : 'Choose a Hades trait eligible when Jeweled Pom is equipped.',
      };
    case 'circeResolutionMissing':
    case 'circeResolutionWrongCardinality':
    case 'circeResolutionTargetUnavailable':
    case 'circeOptionUnavailable':
      return presented('generic', finding);
    case 'traitOfferSelectionUnavailable':
      return presented('trait', finding);
    case 'encounterUnavailable':
      return {
        kind: 'encounter',
        message: 'This encounter cannot occur when this room begins.',
      };
    case 'encounterSlotActivationUnavailable':
      return { kind: 'encounter', message: inactiveEncounterPhaseMessage };
    case 'figLeafSkipUnavailable':
      return {
        kind: 'encounter',
        message: 'Fig Leaf cannot skip another combat in this biome or has no uses left.',
      };
    case 'gorgonConditionUnavailable':
      return { kind: 'encounter', message: 'Gorgon Amulet cannot trigger in this encounter.' };
    case 'aetosAppearanceUnavailable':
      return { kind: 'encounter', message: 'Repair or remove this Aetos appearance in Events.' };
    case 'fieldsCageOutcomeUnavailable':
      return { kind: 'fields', message: 'This Fields door outcome cannot occur at this point.' };
    case 'hubOpenSlotUnavailable':
      return { kind: 'hub', message: 'This Hub room conflicts with the selected open set.' };
    case 'sideRoomGenerationUnavailable':
      return {
        kind: 'sideRoom',
        message: 'This side-room setup is not available with the selected Hub rooms.',
      };
    case 'baseRewardStoreUnavailable':
      return { kind: 'store', message: 'This reward pool is unavailable at this point.' };
    case 'rewardAcquisitionUnavailable':
      return {
        kind: 'acquisition',
        message: 'This reward cannot be acquired here.',
      };
    case 'rewardBagSupportEmpty':
      return {
        kind: 'bag',
        message: 'No available reward pool can offer this reward.',
      };
    case 'rewardBagEntryUnavailable':
      return { kind: 'bag', message: 'This reward is unavailable from the selected reward pool.' };
    case 'rewardPayloadInvalid':
      return { kind: 'payload', message: 'These reward details are not valid.' };
    case 'rewardMissing':
      return { kind: 'reward', message: 'Choose this reward.' };
    case 'traitOfferMissing':
      return { kind: 'trait', message: 'Choose the generated trait offer.' };
    case 'rewardSourceUnavailable':
      return typeof finding.evidence.chosenSource === 'string' &&
        typeof finding.evidence.spurnedSource === 'string'
        ? { kind: 'devotionPair', message: 'This Devotion pair is not supported here.' }
        : { kind: 'boonSource', message: 'This God cannot be offered at this point.' };
    case 'shopOfferUnavailable':
      return { kind: 'shop', message: 'These Shop offers cannot appear together.' };
    case 'shopPurchaseUnavailable':
      return {
        kind: 'shop',
        message: 'This purchase order cannot be completed with the current shop configuration.',
      };
    case 'alreadyEquipped':
      return { kind: 'trait', message: 'This trait is already equipped.' };
    case 'previouslyPicked':
      return { kind: 'trait', message: 'This one-time trait was already picked earlier.' };
    case 'bannedTrait':
      return { kind: 'trait', message: 'This trait was banned by Vow of Denial.' };
    case 'missingPrerequisite':
      return {
        kind: 'trait',
        message: 'The equipped-trait history does not satisfy this prerequisite.',
      };
    case 'negativePrerequisite':
      return { kind: 'trait', message: 'A trait that must be absent is currently equipped.' };
    case 'offerContext':
      return { kind: 'trait', message: 'This trait is blocked by the current offer context.' };
    case 'elementThreshold':
      return { kind: 'trait', message: 'The equipped element totals are too low for this trait.' };
    case 'rarityCount':
      return { kind: 'trait', message: 'The equipped rarity totals do not satisfy this trait.' };
    case 'rarifiableTarget':
      return { kind: 'trait', message: 'No equipped trait can be rarified for this offer.' };
    case 'targetedAcquisitionNoEligibleTarget':
      return { kind: 'trait', message: 'No equipped trait can receive this acquisition.' };
    case 'targetedAcquisitionTargetMissing':
      return { kind: 'trait', message: 'Choose an eligible equipped trait for this acquisition.' };
    case 'targetedAcquisitionTargetUnavailable':
      return { kind: 'trait', message: 'This equipped trait cannot receive the acquisition.' };
    case 'occupiedBoonSlot':
      return { kind: 'trait', message: 'This ordinary boon slot is already occupied.' };
    case 'freshRarityUnavailable':
      return { kind: 'trait', message: 'This rarity is unavailable for a fresh trait offer.' };
    case 'rarityRollUnavailable':
      return {
        kind: 'trait',
        message: 'This fresh boon rarity cannot occur from the reached offer context.',
      };
    case 'replacementUnavailable':
      return { kind: 'trait', message: 'This occupied boon slot cannot be replaced here.' };
    case 'replacementMaximumRarity':
      return { kind: 'trait', message: 'The occupied trait is already at maximum rarity.' };
    case 'replacementRarityMismatch':
      return { kind: 'trait', message: 'The replacement must use the exact promoted rarity.' };
    case 'wrongHammerLoadout':
      return {
        kind: 'trait',
        message: 'This Hammer trait is incompatible with the selected loadout.',
      };
    case 'missingPomTarget':
      return { kind: 'trait', message: 'Choose a trait to receive this Pom.' };
    case 'pomWrongOfferCount':
      return { kind: 'trait', message: 'The Pom must show the required number of targets.' };
    case 'pomSelectedTargetNotOffered':
      return { kind: 'trait', message: 'Choose one of the offered Pom targets.' };
    case 'pomTargetUnavailable':
      return { kind: 'trait', message: 'This trait cannot receive the Pom at this point.' };
    case 'batchRewardStoreMissing':
    case 'batchStateMissing':
    case 'biomeFieldMissing':
    case 'biomeTopologyMissing':
    case 'hubOpenSetIncomplete':
    case 'hubVisitOrderIncomplete':
    case 'pickedTargetMissing':
    case 'targetMissing':
      return { kind: 'structure', message: missingStepMessage(catalog, finding) };
  }
}

/** The earlier authored step a structural finding names, in the biome it belongs to. */
function missingStepMessage(catalog: Catalog, finding: SemanticFinding): string {
  const origin = finding.origin as { readonly routeKey?: string; readonly biomeKey?: string };
  const biome =
    origin.biomeKey !== undefined && catalog.biomes.byKey[origin.biomeKey] !== undefined
      ? biomeName(catalog, origin.biomeKey)
      : undefined;
  const inBiome = biome === undefined ? '' : ` in ${biome}`;
  const parent =
    typeof finding.evidence.parentGameName === 'string' &&
    origin.routeKey !== undefined &&
    catalog.rooms.byKey[finding.evidence.parentGameName] !== undefined
      ? roomName(catalog, finding.evidence.parentGameName, origin.routeKey)
      : undefined;
  const fromParent = parent === undefined ? inBiome : ` from ${parent}`;
  const number = (key: string) =>
    typeof finding.evidence[key] === 'number' ? (finding.evidence[key] as number) : undefined;
  switch (finding.code) {
    case 'batchRewardStoreMissing':
      return `Choose the reward pool for the doors${fromParent} first.`;
    case 'batchStateMissing':
      return `Choose the Fields door roll${fromParent} first.`;
    case 'biomeFieldMissing':
      return typeof finding.evidence.fieldKey === 'string'
        ? `Choose the ${biomeFieldLabel(finding.evidence.fieldKey).toLowerCase()}${inBiome} first.`
        : `Choose the biome setting${inBiome} first.`;
    case 'biomeTopologyMissing':
      return `Create the opening room${inBiome} first.`;
    case 'hubOpenSetIncomplete': {
      const min = number('minimumCount') ?? number('minimumOpenCount');
      const max = number('maximumCount') ?? number('maximumOpenCount');
      const actual = number('actualCount') ?? number('actualOpenCount');
      const range =
        min === undefined || max === undefined ? '' : `${min === max ? min : `${min}–${max}`} `;
      return `Open ${range}Hub rooms${inBiome} first${actual === undefined ? '' : `; ${actual} open`}.`;
    }
    case 'hubVisitOrderIncomplete': {
      const required = number('requiredCount');
      const actual = number('actualCount');
      if (required !== undefined && actual !== undefined && actual >= required)
        return `Use the Hub fountain${inBiome} first.`;
      return required === undefined || actual === undefined
        ? `Plan the Hub visits${inBiome} first.`
        : `Plan ${required} Hub visits${inBiome} first; ${actual} planned.`;
    }
    case 'pickedTargetMissing':
      return finding.evidence.decisionKind === 'hubHandoff'
        ? `Choose the door taken from the Hub${inBiome} first.`
        : `Choose the door taken${inBiome} first.`;
    case 'targetMissing':
      return typeof finding.evidence.exitKey === 'string'
        ? `Choose the room behind ${numberedLabel(finding.evidence.exitKey, 'Door')}${fromParent} first.`
        : `Choose the next room${fromParent} first.`;
    default:
      return formatFindingSentence(presentFinding(finding));
  }
}

function activeFindings(
  evaluation: Exclude<ProjectCandidateEvaluation, { readonly kind: 'unavailable' }>,
): readonly SemanticFinding[] {
  if (evaluation.kind === 'traitOffer') return [];
  return 'findings' in evaluation.result && typeof evaluation.result.findings[0] === 'object'
    ? (evaluation.result.findings as readonly SemanticFinding[])
    : [];
}

/** What an impossible candidate kind means when the engine attaches no finding to it. */
function unexplainedImpossibility(
  catalog: Catalog,
  evaluation: Exclude<ProjectCandidateEvaluation, { readonly kind: 'unavailable' }>,
): CandidateExplanation {
  switch (evaluation.kind) {
    case 'startRoom': {
      const rooms = evaluation.result.supportedGameNames.flatMap(
        (name) => catalog.rooms.byKey[name]?.label ?? [],
      );
      return {
        kind: 'startRoom',
        message:
          rooms.length > 0 && rooms.length <= 3
            ? `This biome starts in ${rooms.join(' or ')}.`
            : 'Not a start room for this biome.',
      };
    }
    case 'roomTarget':
      return { kind: 'room', message: 'Not one of the rooms this door can offer.' };
    case 'batchRewardStore':
      return { kind: 'store', message: 'These doors cannot roll this reward pool.' };
    case 'fieldsCageOutcome':
      return { kind: 'fields', message: 'This Fields door roll cannot occur at this door.' };
    case 'hubSlot':
      return { kind: 'hub', message: 'This Hub room cannot open with the current open set.' };
    case 'hubActionOrder':
      return { kind: 'hub', message: 'This Hub visit cannot come next.' };
    case 'sideRoomGeneration':
      return { kind: 'sideRoom', message: 'This side-room outcome cannot occur here.' };
    case 'sideRoomEntryOrder':
      return { kind: 'sideRoom', message: 'This side room cannot be entered next.' };
    case 'shipEncounterCount':
      return { kind: 'encounter', message: 'This encounter count cannot occur on this ship.' };
    case 'rewardWheelOfferCount':
      return { kind: 'wheel', message: 'This wheel cannot show this many offers.' };
    case 'rewardWheelPicked':
      return { kind: 'wheel', message: 'This wheel offer cannot be picked.' };
    case 'rewardWheelStore':
      return { kind: 'wheel', message: 'This wheel cannot roll this reward pool.' };
    case 'takeoverPrebossBatch':
      return { kind: 'room', message: 'These doors cannot lead to this Preboss room.' };
    case 'hubTerminalTakeover':
      return {
        kind: 'requirement',
        message:
          requirementMessages(
            catalog,
            evaluation.result.source.routeKey,
            evaluation.result.eligibility,
          )[0] ?? 'This Hub cannot take over this door.',
      };
    case 'incomingReward':
    case 'startingReward':
    case 'localReward':
      return { kind: 'reward', message: 'No reward roll here produces this reward.' };
    case 'rewardWheelOffer':
      return { kind: 'reward', message: 'No wheel roll here produces this reward.' };
    case 'shopOffer':
      return { kind: 'shop', message: 'No Shop roll here stocks this item.' };
    case 'acquisitionEntryOffer':
      return { kind: 'reward', message: 'This source cannot produce this reward here.' };
    case 'traitOffer':
      return { kind: 'trait', message: 'No trait offer here can show these choices.' };
    case 'judgmentArcana':
    case 'figurineArcana':
      return { kind: 'arcana', message: 'These cards cannot be drawn here.' };
    case 'keepsakeSelection':
      return { kind: 'keepsake', message: 'This keepsake cannot be equipped here.' };
    case 'keepsakeEquipResult':
      return { kind: 'keepsake', message: 'This keepsake cannot grant this result here.' };
    case 'acquisitionConversion':
      return { kind: 'reward', message: 'No conversion applies to this acquisition.' };
    case 'steadyGrowthOutcome':
      return { kind: 'trait', message: 'This trait cannot gain rarity here.' };
    case 'fountainRarityOutcome':
      return { kind: 'trait', message: 'This boon cannot be promoted here.' };
    case 'transcendentEmbryoOutcome':
      return { kind: 'trait', message: 'This Chaos blessing is not eligible here.' };
    case 'fieldsSpatialPoint':
      return { kind: 'fields', message: 'This point is not available to this Fields item.' };
  }
}

function unavailableExplanation(
  catalog: Catalog,
  evaluation: Extract<ProjectCandidateEvaluation, { readonly kind: 'unavailable' }>,
): CandidateExplanation | undefined {
  switch (evaluation.evidence.kind) {
    case 'authoredPrerequisiteMissing': {
      const label =
        evaluation.evidence.prerequisite.kind === 'batchRewardStore'
          ? 'reward pool'
          : evaluation.evidence.prerequisite.kind === 'fieldsCageOutcome'
            ? 'Fields door roll'
            : 'biome setting';
      return {
        kind: evaluation.evidence.kind,
        message: `Choose the required ${label} before evaluating this option.`,
      };
    }
    case 'coverageNotReached':
      // The "Needs earlier steps" section heading already says this.
      return undefined;
    case 'producerFrontierUnavailable':
      return {
        kind: evaluation.evidence.kind,
        message: 'The current route does not reach this reward yet.',
      };
    case 'targetNotReachable':
      return {
        kind: evaluation.evidence.kind,
        message: 'This door is not reachable in the current route.',
      };
    case 'upstreamIncomplete':
      return {
        kind: evaluation.evidence.kind,
        message: `Finish ${biomeName(catalog, evaluation.evidence.upstreamBiomeKey)} before choices here can be evaluated.`,
      };
    case 'upstreamInvalid':
      return {
        kind: evaluation.evidence.kind,
        message: `Fix ${biomeName(catalog, evaluation.evidence.upstreamBiomeKey)} before choices here can be evaluated.`,
      };
  }
}

/** Failed counter axes a room's eligibility already names. */
function failedCounterAxes(evidence: RequirementEvaluationEvidence): readonly CounterAxis[] {
  if (evidence.satisfied) return [];
  switch (evidence.kind) {
    case 'counterRange':
      return [evidence.axis];
    case 'all':
    case 'any':
      return evidence.children.flatMap(failedCounterAxes);
    default:
      return [];
  }
}

/** A force minimum repeats an eligibility range on the same counter; keep only the range. */
function withoutSubsumedMinimums(
  exclusions: readonly RoomGenerationExclusionEvidence[],
): readonly RoomGenerationExclusionEvidence[] {
  const named = new Set(
    exclusions.flatMap((exclusion) =>
      exclusion.kind === 'eligibilityRequirement' ? failedCounterAxes(exclusion.evaluation) : [],
    ),
  );
  return exclusions.filter(
    (exclusion) => exclusion.kind !== 'forceMinimum' || !named.has(exclusion.axis),
  );
}

/** Findings that only summarize a cause the typed exclusions name exactly. */
const summaryFindingCodes: ReadonlySet<string> = new Set([
  'targetRoomUnavailable',
  'rewardBagEntryUnavailable',
  'rewardBagSupportEmpty',
  'rewardSourceUnavailable',
]);

function rewardOfferExclusions(
  evaluation: Exclude<ProjectCandidateEvaluation, { readonly kind: 'unavailable' }>,
): readonly RewardOfferExclusionEvidence[] {
  switch (evaluation.kind) {
    case 'incomingReward':
    case 'startingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'acquisitionEntryOffer':
      return evaluation.result.exclusions ?? [];
    default:
      return [];
  }
}

/** The reasons for a forced, impossible, or unassessed candidate, most direct first. */
export function explainCandidateEvaluation(
  catalog: Catalog,
  evaluation: ProjectCandidateEvaluation,
): readonly CandidateExplanation[] {
  if (evaluation.kind === 'unavailable') {
    const explanation = unavailableExplanation(catalog, evaluation);
    return explanation === undefined ? [] : [explanation];
  }
  const support = candidateSupport({ value: null, evaluation });
  if (support === 'forced')
    return [{ kind: 'forced', message: 'This option must be included here.' }];
  if (support !== 'impossible') return [];
  const exclusions =
    evaluation.kind === 'roomTarget'
      ? withoutSubsumedMinimums(evaluation.result.pressure.selectedExclusions).flatMap(
          (exclusion) => roomExclusionExplanations(catalog, exclusion, evaluation.result.pressure),
        )
      : rewardExclusionExplanations(catalog, rewardOfferExclusions(evaluation));
  // Typed exclusions already say why; the coarse summary findings would only repeat them.
  const findings = activeFindings(evaluation).filter(
    (finding) =>
      exclusions.length === 0 ||
      !summaryFindingCodes.has(finding.code) ||
      'anomalyReplacement' in finding.evidence,
  );
  const [special, ordinary] = [
    findings.filter((finding) => 'anomalyReplacement' in finding.evidence),
    findings.filter((finding) => !('anomalyReplacement' in finding.evidence)),
  ];
  const reasons = [
    ...special.map((finding) => findingExplanation(catalog, finding)),
    ...exclusions,
    ...ordinary.map((finding) => findingExplanation(catalog, finding)),
  ];
  return distinctReasons(
    reasons.length > 0 ? reasons : [unexplainedImpossibility(catalog, evaluation)],
  );
}

function state(evaluation: CandidateProjectionEvaluation): ContextualOptionState {
  const support = candidateSupport({ value: null, evaluation });
  return support === 'unavailable' ? 'unassessed' : support;
}

function presentationKey(values: readonly ContextualOptionPresentation[]): string {
  return JSON.stringify(values);
}

export function createContextualOptionResolver(catalog: Catalog): ContextualOptionResolver {
  const cache = new WeakMap<
    readonly CandidateOptionProjection<unknown, CandidateProjectionEvaluation>[],
    Map<string, readonly ContextualOption<unknown>[]>
  >();
  return Object.freeze({
    resolve<T>(
      options: readonly CandidateOptionProjection<T, CandidateProjectionEvaluation>[],
      presentationFor: (
        option: CandidateOptionProjection<T, CandidateProjectionEvaluation>,
      ) => ContextualOptionPresentation,
    ): readonly ContextualOption<T>[] {
      const presentation = options.map(presentationFor);
      let byPresentation = cache.get(options);
      if (byPresentation === undefined) {
        byPresentation = new Map();
        cache.set(options, byPresentation);
      }
      const key = presentationKey(presentation);
      const existing = byPresentation.get(key);
      if (existing !== undefined) return existing as readonly ContextualOption<T>[];
      const projected = Object.freeze(
        options.map((option, index) => {
          const display = presentation[index]!;
          const explanations = distinctReasons(
            display.explanations ??
              (option.evaluation.kind === 'encounter' ||
              option.evaluation.kind === 'traitOfferFocusedOption' ||
              option.evaluation.kind === 'traitAcquisitionTarget'
                ? []
                : explainCandidateEvaluation(catalog, option.evaluation)),
          );
          return Object.freeze({
            value: option.value,
            label: display.label,
            ...(display.category === undefined ? {} : { category: display.category }),
            state: state(option.evaluation),
            selected: display.selected,
            ...(explanations.length === 0 ? {} : { explanations }),
          });
        }),
      );
      byPresentation.set(key, projected);
      return projected;
    },
  });
}

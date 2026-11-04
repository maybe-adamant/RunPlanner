import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  type OccurrenceId,
  type ProjectCommand,
  type RoomOccurrence,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import { insertRoomAction, roomActionAddress } from './actions';
import type { RunImportContext } from './import';
import { authoredOccurrence, occurrenceIdOf } from './occurrences';
import { chooseRoomFit, searchRoom } from './room-search';
import { usesLeftByPlan } from './room-uses';
import { wheelAuthoringWaits } from './wheels';

type ChallengeSwitchOutcome = NonNullable<RoomOccurrence['challengeSwitch']>['outcome'];

const INTERACTION = Object.freeze({ kind: 'interactChallengeSwitch' as const });

/** One way a pressed switch's room may have gone: its fight's outcome, or no press at all. */
interface SwitchCandidate {
  readonly outcome: ChallengeSwitchOutcome | 'unpressed';
  readonly nectarDropped: boolean;
}

/**
 * Authors each recorded challenge switch press once its room's pickups have
 * settled: the switch its use names, its interaction and its fight's outcome.
 * A claimed reward, the Onion or the bonus Nectar the plan's other pickups do
 * not explain pins the claim; without one the room's next entry save chooses
 * among a left fight, an unclaimed Time fight and a press that started nothing.
 */
export function importChallengeSwitches(context: RunImportContext): void {
  for (const [roomIndex, room] of context.record.rooms.entries()) {
    const variantKey = Object.keys(room.uses).find(
      (name) => context.catalog.challengeSwitches.variants.byKey[name] !== undefined,
    );
    const used = `challengeSwitch:${roomIndex}`;
    if (variantKey === undefined || context.used.has(used)) continue;
    const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
    const occurrenceId = context.occurrences.occurrenceOf(roomIndex);
    if (!context.entered(occurrenceId)) continue;
    const occurrence = authoredOccurrence(context.assembly().project, biomeKey, occurrenceId);
    // The room's own questions settle its other pickups first; the claim takes what they leave.
    const issue = context.assembly().evaluation.issue?.reasons[0];
    if (
      occurrence === undefined ||
      wheelAuthoringWaits(context, roomIndex) ||
      (issue !== undefined && occurrenceIdOf(issue.origin) === occurrenceId)
    )
      continue;
    context.used.add(used);
    importSwitch(context, biomeKey, occurrence, roomIndex, variantKey);
  }
}

function importSwitch(
  context: RunImportContext,
  biomeKey: string,
  original: RoomOccurrence,
  roomIndex: number,
  variantKey: string,
): void {
  const occurrenceId = original.occurrenceId;
  const address = createOccurrenceAddress(
    createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
  );
  const owner = createRoomFeatureAddress(address, { kind: 'challengeSwitch' });
  const record = { roomIndex, visit: 0 };
  const presence: ProjectCommand = {
    kind: 'ReplaceChallengeSwitch',
    occurrence: address,
    variantKey,
  };
  if (original.challengeSwitch?.variantKey !== variantKey && !context.applyValid(presence)) {
    context.note({
      area: 'challengeSwitch',
      reason: 'refused',
      address: owner,
      applied: presence,
      record,
    });
    return;
  }
  const pinned = claimedOutcome(context, biomeKey, original, roomIndex, variantKey);
  const outcomeCommand = (candidate: SwitchCandidate): ProjectCommand =>
    candidate.outcome === 'unpressed'
      ? presence
      : {
          kind: 'ReplaceChallengeSwitchOutcome',
          occurrence: address,
          outcome: candidate.outcome,
          nectarDropped: candidate.nectarDropped,
        };
  const author = (candidate: SwitchCandidate) =>
    candidate.outcome === 'unpressed' ||
    context.transaction(() => {
      const current = authoredOccurrence(
        context.assembly().project,
        biomeKey,
        occurrenceId,
      )?.challengeSwitch;
      const command = outcomeCommand(candidate);
      // An omitted gold is the engine's default for a finished Time switch.
      const unchanged =
        current?.outcome === candidate.outcome && current.nectarDropped === candidate.nectarDropped;
      return (unchanged || context.apply(command)) && pressSwitch(context, biomeKey, occurrenceId);
    });
  const goldUnrecorded = (candidate: SwitchCandidate) => {
    const kind = switchKind(context, variantKey);
    // The record holds no gold balance; the plan claims the engine's default, before the money multiplier.
    if (kind?.goldReward === true && candidate.outcome === 'finished')
      context.note({
        area: 'challengeSwitch',
        reason: 'notInRecord',
        address: owner,
        applied: outcomeCommand(candidate),
        record,
      });
  };
  if (pinned !== undefined) {
    if (!author(pinned))
      context.note({
        area: 'challengeSwitch',
        reason: 'refused',
        address: owner,
        applied: outcomeCommand(pinned),
        record,
      });
    else goldUnrecorded(pinned);
    return;
  }
  const search = searchRoom(context, {
    roomIndex,
    candidates: unclaimedCandidates(context, roomIndex, variantKey),
    author: (candidate) => (author(candidate) ? candidate : undefined),
    // The room is settled; the candidate answers what it raises until the next entry is reached.
    settles: 'all',
    fingerprint: () =>
      JSON.stringify(
        authoredOccurrence(
          context.assembly().project,
          biomeKey,
          occurrenceId,
        )?.roomActions.order.some((reference) => reference.kind === INTERACTION.kind)
          ? authoredOccurrence(context.assembly().project, biomeKey, occurrenceId)?.challengeSwitch
          : 'unpressed',
      ),
  });
  const fit = chooseRoomFit(search.fits);
  // The record shows the press, not what it started: without an accepted fit only the switch stays.
  if (fit === undefined || !author(fit.chosen.choice)) {
    context.note({ area: 'challengeSwitch', reason: 'notInRecord', address: owner, record });
    return;
  }
  context.note({
    area: 'challengeSwitch',
    reason: 'notInRecord',
    address: owner,
    applied: outcomeCommand(fit.chosen.choice),
    ...(fit.equivalents.length === 0
      ? {}
      : { alternatives: fit.equivalents.map((equivalent) => outcomeCommand(equivalent.choice)) }),
    record,
  });
  goldUnrecorded(fit.chosen.choice);
}

/**
 * Inserts the press at its native position, or last when that position does
 * not run (a Fields room's exits wait for its cage loot): the record does not
 * time the press.
 */
function pressSwitch(context: RunImportContext, biomeKey: string, occurrenceId: string): boolean {
  const key = roomActionKey(INTERACTION);
  const runs = () =>
    !context
      .assembly()
      .evaluation.findings.some(
        (finding) =>
          finding.code === 'roomActionPlacementRequired' &&
          finding.origin.kind === 'roomAction' &&
          finding.origin.occurrenceId === occurrenceId &&
          finding.origin.actionKey === key,
      );
  return (
    context.transaction(
      () => insertRoomAction(context, biomeKey, occurrenceId, INTERACTION) && runs(),
    ) ||
    context.transaction(
      () =>
        context.apply({
          kind: 'InsertRoomAction',
          action: roomActionAddress(context, biomeKey, occurrenceId, INTERACTION),
          reference: INTERACTION,
          index:
            authoredOccurrence(context.assembly().project, biomeKey, occurrenceId)?.roomActions
              .order.length ?? 0,
        }) && runs(),
    )
  );
}

const switchKind = (context: RunImportContext, variantKey: string) => {
  const variant = context.catalog.challengeSwitches.variants.byKey[variantKey];
  return variant === undefined
    ? undefined
    : context.catalog.challengeSwitches.kinds.byKey[variant.switchKind];
};

/**
 * The claim the room's uses pin: a hit reward left over is a failed Perfect
 * Clear, the variant's reward a clean claim, and for a Time switch, which
 * gushes gold, the bonus Nectar alone; the Nectar rides a clean claim.
 */
function claimedOutcome(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
  roomIndex: number,
  variantKey: string,
): SwitchCandidate | undefined {
  const switches = context.catalog.challengeSwitches;
  const variant = switches.variants.byKey[variantKey];
  const kind = switchKind(context, variantKey);
  if (variant === undefined || kind === undefined) return undefined;
  const left = usesLeftByPlan(context, biomeKey, occurrence, roomIndex);
  const leftOver = (name: string) => (left.get(name) ?? 0) > 0;
  const nectar = leftOver(switches.bonusReward.rewardType);
  if (kind.hitRewardType !== undefined && leftOver(kind.hitRewardType))
    return { outcome: 'failed', nectarDropped: false };
  const clean = kind.hitRewardType === undefined ? 'finished' : 'hitless';
  if (kind.goldReward ? nectar : leftOver(variant.rewardType))
    return { outcome: clean, nectarDropped: nectar };
  return undefined;
}

/**
 * A press no claim shows, in canonical order: a fight left before it ended, a
 * finished Time fight (its claim is a second press), and a press refused
 * before the doors opened, which starts nothing.
 */
function unclaimedCandidates(
  context: RunImportContext,
  roomIndex: number,
  variantKey: string,
): readonly SwitchCandidate[] {
  const presses = context.record.rooms[roomIndex]!.uses[variantKey] ?? 0;
  return [
    { outcome: 'left', nectarDropped: false },
    ...(switchKind(context, variantKey)?.goldReward === true && presses >= 2
      ? [{ outcome: 'finished' as const, nectarDropped: false }]
      : []),
    { outcome: 'unpressed', nectarDropped: false },
  ];
}

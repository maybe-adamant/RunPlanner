import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  NEMESIS_RANDOM_EVENT_FAMILIES,
  type NemesisRandomEventAddress,
  type ProjectCommand,
  type SemanticAddress,
} from '../../authored-project';
import { nemesisRandomEventCandidateSupportForProjectEvaluationAssembly } from '../evaluation/project-evaluation-assembly';
import type { SemanticFinding } from '../model';
import type { RunImportContext } from './import';

type Interaction = Extract<
  ProjectCommand,
  { readonly kind: 'ReplaceNemesisRandomEventInteraction' }
>['value'];

/** The event a finding names directly, or through the interaction action of its room. */
function nemesisEventOf(
  context: RunImportContext,
  origin: SemanticAddress,
): NemesisRandomEventAddress | undefined {
  if (origin.kind === 'nemesisRandomEvent') return origin;
  if (origin.kind !== 'roomAction') return undefined;
  const occurrence = context
    .assembly()
    .project.route.biomes.find((biome) => biome.biomeKey === origin.biomeKey)
    ?.topology?.occurrences.find((entry) => entry.occurrenceId === origin.occurrenceId);
  const phaseKey = Object.keys(occurrence?.encounters.nemesisRandomEventByPhase ?? {})[0];
  return phaseKey === undefined
    ? undefined
    : createNemesisRandomEventAddress(
        createEncounterPhaseAddress(
          createBiomeAddress(origin.routeKey, origin.biomeKey),
          { kind: 'occurrence', occurrenceId: origin.occurrenceId },
          phaseKey,
        ),
      );
}

/**
 * Nemesis' random event takes the first family the room admits, then that
 * family's first legal interaction; reading the record's NPC answers is a later
 * import step.
 */
export function guessNemesisEvent(
  context: RunImportContext,
  reason: SemanticFinding,
): readonly ProjectCommand[] | undefined {
  const event = nemesisEventOf(context, reason.origin);
  if (event === undefined) return undefined;
  const support = () =>
    nemesisRandomEventCandidateSupportForProjectEvaluationAssembly(context.assembly(), event);
  if (support() === undefined) {
    for (const family of NEMESIS_RANDOM_EVENT_FAMILIES) {
      const command: ProjectCommand = { kind: 'SelectNemesisRandomEventFamily', event, family };
      if (context.apply(command)) return [command];
    }
    return undefined;
  }
  const current = support()!;
  const branch = current.branches[0];
  const family = context
    .assembly()
    .project.route.biomes.find((biome) => biome.biomeKey === event.biomeKey)
    ?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === event.encounter.owner.occurrenceId,
    )?.encounters.nemesisRandomEventByPhase?.[event.encounter.phaseKey]?.kind;
  if (branch === undefined || family === undefined) return undefined;
  const first = (types: readonly string[]) =>
    types[0] === undefined ? null : { rewardType: types[0] };
  const values: Interaction[] = [];
  switch (family) {
    case 'freeItem':
      values.push({ kind: 'freeItem', reward: first(branch.freeItemRewardTypes) });
      break;
    case 'goldTrade':
      for (const response of current.goldTradeResponses)
        values.push({ kind: 'goldTrade', response, reward: first(branch.goldTradeRewardTypes) });
      break;
    case 'damageTrade':
      for (const response of current.damageTradeResponses)
        values.push({
          kind: 'damageTrade',
          response,
          reward: first(branch.damageTradeRewardTypes),
        });
      break;
    case 'traitTrade':
      for (const response of current.traitTradeResponses)
        values.push({
          kind: 'traitTrade',
          traitKey: branch.traitTradeTraitKeys[0] ?? null,
          response,
          reward: { rewardType: current.traitTradeRewardType },
        });
      break;
    case 'damageContest':
      values.push({
        kind: 'damageContest',
        result: 'failure',
        reward: { rewardType: current.damageContestFailureRewardType },
      });
      break;
  }
  for (const value of values) {
    const command: ProjectCommand = { kind: 'ReplaceNemesisRandomEventInteraction', event, value };
    if (context.apply(command)) return [command];
  }
  return undefined;
}

/**
 * Nemesis's event from the room's record: a free item, a trade or a contest
 * reward is the use the room gained; a trait trade also lost that trait. A gold
 * and a damage trade grant the same items, so an accepted trade names its
 * family only when one of them admits the item; declined trades leave none.
 */
export function answerNemesis(context: RunImportContext, reason: SemanticFinding): boolean {
  if (!reason.code.startsWith('nemesis') && reason.origin.kind !== 'nemesisRandomEvent')
    return false;
  const event = nemesisEventOf(context, reason.origin);
  if (event === undefined) return false;
  const roomIndex = context.occurrences.visitsOf(event.encounter.owner.occurrenceId)[0];
  const room = roomIndex === undefined ? undefined : context.record.rooms[roomIndex];
  if (room === undefined || (room.uses['NPC_Nemesis_01'] ?? 0) === 0) return false;
  // The room's own reward is the one the event suppresses, not its result.
  const used = (type: string) => type !== room.reward?.type && (room.uses[type] ?? 0) > 0;
  const matches: {
    readonly family: string;
    readonly commands: readonly ProjectCommand[];
    readonly traitExact: boolean;
  }[] = [];
  for (const family of NEMESIS_RANDOM_EVENT_FAMILIES) {
    const select: ProjectCommand = { kind: 'SelectNemesisRandomEventFamily', event, family };
    context.transaction(() => {
      if (!context.apply(select)) return false;
      const support = nemesisRandomEventCandidateSupportForProjectEvaluationAssembly(
        context.assembly(),
        event,
      );
      const branch = support?.branches[0];
      if (support === undefined || branch === undefined) return false;
      let value: Interaction | undefined;
      let traitExact = true;
      const first = (types: readonly string[]) => types.find(used);
      switch (family) {
        case 'freeItem': {
          const type = first(branch.freeItemRewardTypes);
          if (type !== undefined) value = { kind: 'freeItem', reward: { rewardType: type } };
          break;
        }
        case 'goldTrade':
        case 'damageTrade': {
          const type = first(
            family === 'goldTrade' ? branch.goldTradeRewardTypes : branch.damageTradeRewardTypes,
          );
          if (type !== undefined)
            value = { kind: family, response: 'accept', reward: { rewardType: type } };
          break;
        }
        case 'traitTrade': {
          // The traded trait is the eligible one the room lost.
          const traded = room.traits.removed.filter((name) =>
            branch.traitTradeTraitKeys.includes(name),
          );
          if (traded[0] !== undefined && used(support.traitTradeRewardType)) {
            traitExact = traded.length === 1;
            value = {
              kind: 'traitTrade',
              traitKey: traded[0],
              response: 'accept',
              reward: { rewardType: support.traitTradeRewardType },
            };
          }
          break;
        }
        case 'damageContest': {
          const type = first([
            support.damageContestFailureRewardType,
            ...branch.damageContestSuccessRewardTypes,
          ]);
          if (type !== undefined)
            value = {
              kind: 'damageContest',
              result: type === support.damageContestFailureRewardType ? 'failure' : 'success',
              reward: { rewardType: type },
            };
          break;
        }
      }
      if (value !== undefined)
        matches.push({
          family,
          commands: [select, { kind: 'ReplaceNemesisRandomEventInteraction', event, value }],
          traitExact,
        });
      // Probing only: the chosen family is applied below.
      return false;
    });
  }
  for (const match of matches) {
    if (!context.transaction(() => match.commands.every((command) => context.apply(command))))
      continue;
    // The event itself is not saved: a unique match is inferred, several leave the family open.
    context.note({
      area: 'npc',
      reason: matches.length > 1 || !match.traitExact ? 'notInRecord' : 'assumption',
      address: event,
      applied: match.commands[1]!,
      record: { roomIndex: roomIndex!, visit: 0 },
    });
    return true;
  }
  context.refuse();
  return false;
}

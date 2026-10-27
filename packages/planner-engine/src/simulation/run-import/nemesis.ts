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

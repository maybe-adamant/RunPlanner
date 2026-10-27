import type {
  AuthoredTraitOffer,
  AuthoredTraitOption,
  TraitOfferAddress,
} from '../../authored-project';
import type { TraitRarity } from '../../catalog-schema';
import type { RunRecordTraitScreen } from '../../run-record/model';
import type { SemanticFinding } from '../model';
import type { RunImportContext } from './import';
import {
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  levelResolutionCandidateForProjectEvaluationAssembly,
} from '../evaluation/project-evaluation-assembly';
import { occurrenceIdOf } from './occurrences';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

function traitsOffer(
  context: RunImportContext,
  screen: RunRecordTraitScreen,
): AuthoredTraitOffer | undefined {
  const giverKey = screenGiver(context, screen);
  const selected = screen.options.findIndex((option) => option.chosen);
  if (giverKey === undefined || selected < 0 || screen.options.length > 3) return undefined;
  const options = screen.options.map((option): AuthoredTraitOption => ({
    traitKey: option.name,
    // Only a ranked trait carries a planner rarity.
    ...(option.rarity !== undefined &&
    context.catalog.traits.byKey[option.name]?.rarityDomain.kind === 'ranked'
      ? { rarity: option.rarity as TraitRarity }
      : {}),
  })) as unknown as readonly [AuthoredTraitOption];
  return { kind: 'traits', giverKey, options, selectedOptionKey: OPTION_KEYS[selected]! };
}

/**
 * The giver a screen's loot names; an NPC screen names its encounter instead,
 * so its giver is the one whose traits hold every option.
 */
function screenGiver(context: RunImportContext, screen: RunRecordTraitScreen): string | undefined {
  const named = context.catalog.traitGiverByAcquisitionGameName[screen.giver];
  if (named !== undefined) return named;
  const holders = context.catalog.traitGivers.values.filter((giver) =>
    screen.options.every((option) => giver.traitKeys.includes(option.name)),
  );
  return holders.length === 1 ? holders[0]!.key : undefined;
}

/** The offer without the unselected rows the engine judged illegal; undefined when none or the pick is. */
function withoutIllegalRows(
  value: AuthoredTraitOffer,
  assessments: readonly { readonly legal: boolean }[],
): AuthoredTraitOffer | undefined {
  if (value.kind !== 'traits') return undefined;
  const selected = OPTION_KEYS.indexOf(value.selectedOptionKey);
  if (assessments[selected]?.legal !== true) return undefined;
  const kept = value.options.filter(
    (_option, index) => index === selected || assessments[index]?.legal === true,
  );
  if (kept.length === value.options.length) return undefined;
  const pick = value.options[selected]!;
  return {
    ...value,
    options: kept as unknown as typeof value.options,
    selectedOptionKey: OPTION_KEYS[kept.indexOf(pick)]!,
  };
}

/** Pom screens, by the loot every level-up screen shares. */
const POM_GIVER = 'StackUpgrade';

/** Answers a Pom's level-up from the next unconsumed level-up screen of its room. */
export function answerLevelResolution(context: RunImportContext, reason: SemanticFinding): boolean {
  if (
    reason.origin.kind !== 'levelResolution' ||
    ![
      'missingPomTarget',
      'pomWrongOfferCount',
      'pomSelectedTargetNotOffered',
      'pomTargetUnavailable',
    ].includes(reason.code)
  )
    return false;
  const levelResolution = reason.origin;
  const occurrenceId = occurrenceIdOf(levelResolution.owner);
  const capability = levelResolutionCandidateForProjectEvaluationAssembly(
    context.assembly(),
    levelResolution,
  );
  if (occurrenceId === undefined || capability === undefined) return false;
  for (const roomIndex of context.occurrences.visitsOf(occurrenceId))
    for (const [position, screen] of context.record.rooms[roomIndex]!.traitScreens.entries()) {
      const key = `screen:${roomIndex}:${position}`;
      const chosen = screen.options.find((option) => option.chosen)?.name;
      if (context.used.has(key) || screen.giver !== POM_GIVER || chosen === undefined) continue;
      for (const [branchIndex, branch] of capability.branches.entries()) {
        const value =
          branch.effectKind === 'random'
            ? ({ kind: 'random', targetTraitKey: chosen } as const)
            : ({
                kind: 'choice',
                offeredTraitKeys: screen.options.map((option) => option.name),
                selectedTraitKey: chosen,
              } as const);
        if (capability.evaluate(value)[branchIndex]?.supported !== true) continue;
        if (context.apply({ kind: 'ReplaceLevelResolution', levelResolution, value })) {
          context.used.add(key);
          return true;
        }
      }
    }
  // A random level-up without a screen leaves only its upgraded trait in the record.
  for (const roomIndex of context.occurrences.visitsOf(occurrenceId))
    for (const [position, upgrade] of context.record.rooms[roomIndex]!.traits.upgraded.entries()) {
      const key = `upgrade:${roomIndex}:${position}`;
      if (context.used.has(key)) continue;
      const value = { kind: 'random', targetTraitKey: upgrade.name } as const;
      const branchIndex = capability.branches.findIndex((branch) => branch.effectKind === 'random');
      if (branchIndex < 0 || capability.evaluate(value)[branchIndex]?.supported !== true) continue;
      if (context.apply({ kind: 'ReplaceLevelResolution', levelResolution, value })) {
        context.used.add(key);
        return true;
      }
    }
  return false;
}

/**
 * The giver an offer's owner names: its room reward's loot (a god boon's
 * source) or its encounter's declared trait producer. Undefined for owners
 * whose giver the record alone must decide.
 */
function ownerGiver(context: RunImportContext, trait: TraitOfferAddress): string | undefined {
  const owner = trait.owner;
  if (owner.kind === 'encounterPhase') {
    const status = encounterPhaseSequenceStatusForProjectEvaluationAssembly(
      context.assembly(),
      owner,
    );
    const definition =
      status?.kind === 'active' && status.encounterDefinitionKey !== undefined
        ? context.catalog.encounterDefinitions.byKey[status.encounterDefinitionKey]
        : undefined;
    return definition?.traitOfferProducer?.giverKey;
  }
  if (owner.kind !== 'incomingReward') return undefined;
  const state = context
    .assembly()
    .project.route.biomes.find((biome) => biome.biomeKey === owner.biomeKey)
    ?.topology?.occurrences.find((entry) => entry.occurrenceId === owner.occurrenceId)?.state;
  const offer = state !== undefined && 'reward' in state ? state.reward?.offer : undefined;
  if (offer === undefined) return undefined;
  const loot =
    offer.payload?.kind === 'BoonSource'
      ? offer.payload.source
      : offer.payload?.kind === 'DevotionPair'
        ? trait.acquisitionRole === 'spurnedSource'
          ? offer.payload.spurnedSource
          : offer.payload.chosenSource
        : offer.rewardType;
  return context.catalog.traitGiverByAcquisitionGameName[loot];
}

/**
 * Answers a trait offer from its room's next unconsumed screen of the owner's
 * giver, in screen order. Where the owner names no giver, the first screen the
 * engine admits is used and the choice reported when the room held several.
 */
export function answerTraitOffer(context: RunImportContext, reason: SemanticFinding): boolean {
  if (reason.code !== 'traitOfferMissing' || reason.origin.kind !== 'traitOffer') return false;
  const trait: TraitOfferAddress = reason.origin;
  const occurrenceId = occurrenceIdOf(trait.owner);
  if (occurrenceId === undefined) return false;
  const giver = ownerGiver(context, trait);
  const screens = context.occurrences.visitsOf(occurrenceId).flatMap((roomIndex) =>
    context.record.rooms[roomIndex]!.traitScreens.flatMap((screen, position) => {
      const key = `screen:${roomIndex}:${position}`;
      return context.used.has(key) ||
        screen.giver === POM_GIVER ||
        (giver !== undefined && screenGiver(context, screen) !== giver)
        ? []
        : [{ screen, key, roomIndex }];
    }),
  );
  const ambiguous =
    giver === undefined && new Set(screens.map((entry) => entry.screen.giver)).size > 1;
  for (const { screen, key, roomIndex } of screens) {
    const record = { roomIndex, visit: 0 };
    const value = traitsOffer(context, screen);
    if (value === undefined) continue;
    const command = { kind: 'ReplaceTraitOffer', trait, value } as const;
    const evaluation = context.candidates().evaluate({ kind: 'traitOffer', trait, value });
    if (evaluation.kind !== 'traitOffer') continue;
    if (evaluation.result.supported && evaluation.result.findings.length === 0) {
      if (!context.apply(command)) continue;
      context.used.add(key);
      if (ambiguous)
        context.note({
          area: 'traitOffer',
          reason: 'assumption',
          address: trait,
          applied: command,
          record,
        });
      return true;
    }
    context.refuse();
    // The engine refuses some unselected rows here; the observed pick keeps the others.
    const reduced = withoutIllegalRows(value, evaluation.result.assessments);
    if (reduced === undefined) continue;
    const retry = context.candidates().evaluate({ kind: 'traitOffer', trait, value: reduced });
    const reducedCommand = { kind: 'ReplaceTraitOffer', trait, value: reduced } as const;
    if (
      retry.kind === 'traitOffer' &&
      retry.result.supported &&
      retry.result.findings.length === 0 &&
      context.apply(reducedCommand)
    ) {
      context.used.add(key);
      context.note({
        area: 'traitOffer',
        reason: 'refused',
        address: trait,
        applied: reducedCommand,
        record,
      });
      return true;
    }
    // A screen tied to its owner is that owner's answer; a later screen is not.
    if (giver !== undefined) return false;
  }
  return false;
}

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
import { chaosOffer } from './features';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

/**
 * A promoting pick's target is the trait its room upgraded at the pick's own
 * acquisition time, else the room's only upgrade.
 */
function promotionTarget(
  context: RunImportContext,
  roomIndex: number,
  traitKey: string,
): string | undefined {
  if (
    context.catalog.traits.byKey[traitKey]?.targetedAcquisition?.kind !== 'promoteGodTraitToHeroic'
  )
    return undefined;
  const traits = context.record.rooms[roomIndex]!.traits;
  const at = traits.acquired.find((trait) => trait.name === traitKey)?.worldTime;
  const timed = traits.upgraded.filter((upgrade) => at !== undefined && upgrade.worldTime === at);
  const upgrades = timed.length > 0 ? timed : traits.upgraded;
  return upgrades.length === 1 ? upgrades[0]!.name : undefined;
}

/** Echo's Pom doubles one boon's level at the pick's own acquisition time. */
function echoPomTarget(
  context: RunImportContext,
  roomIndex: number,
  traitKey: string,
): string | undefined {
  const disposition = context.catalog.traits.byKey[traitKey]?.selectedDisposition;
  if (disposition?.kind !== 'echo' || disposition.effect !== 'doubleLevel') return undefined;
  const traits = context.record.rooms[roomIndex]!.traits;
  const at = traits.acquired.find((trait) => trait.name === traitKey)?.worldTime;
  const doubled = traits.upgraded.filter(
    (upgrade) =>
      (at === undefined || upgrade.worldTime === undefined || upgrade.worldTime === at) &&
      upgrade.from.level !== undefined &&
      upgrade.to.level === upgrade.from.level * 2,
  );
  return doubled.length === 1 ? doubled[0]!.name : undefined;
}

function traitsOffer(
  context: RunImportContext,
  screen: RunRecordTraitScreen,
  roomIndex: number,
): AuthoredTraitOffer | undefined {
  const giverKey = screenGiver(context, screen);
  const selected = screen.options.findIndex((option) => option.chosen);
  if (giverKey === undefined || selected < 0 || screen.options.length > 3) return undefined;
  const options = screen.options.map((option): AuthoredTraitOption => ({
    traitKey: option.name,
    ...(option.chosen && promotionTarget(context, roomIndex, option.name) !== undefined
      ? { targetTraitKey: promotionTarget(context, roomIndex, option.name)! }
      : {}),
    ...(option.chosen && echoPomTarget(context, roomIndex, option.name) !== undefined
      ? { echoPomTarget: echoPomTarget(context, roomIndex, option.name)! }
      : {}),
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

/**
 * The record's rarity changes no screen or acquisition explains, in order: each
 * changes one trait's rarity alone, at a time no trait was acquired.
 */
function unexplainedRarityUpgrades(
  context: RunImportContext,
  fromRoom: number,
): readonly { readonly name: string; readonly roomIndex: number; readonly key: string }[] {
  return context.record.rooms.slice(fromRoom).flatMap((room, offset) => {
    const roomIndex = fromRoom + offset;
    const acquiredAt = new Set(room.traits.acquired.map((trait) => trait.worldTime));
    return room.traits.upgraded.flatMap((upgrade, position) => {
      const shared = room.traits.upgraded.filter(
        (other) => other.worldTime === upgrade.worldTime,
      ).length;
      return upgrade.from.rarity === upgrade.to.rarity ||
        upgrade.worldTime === undefined ||
        acquiredAt.has(upgrade.worldTime) ||
        shared > 1
        ? []
        : [{ name: upgrade.name, roomIndex, key: `upgrade:${roomIndex}:${position}` }];
    });
  });
}

/**
 * Answers a Steady Growth cycle with the record's next unexplained rarity
 * change after the room that installed it.
 */
export function answerSteadyGrowth(context: RunImportContext, reason: SemanticFinding): boolean {
  if (reason.code !== 'steadyGrowthOutcomeMissing' || reason.origin.kind !== 'steadyGrowthOutcome')
    return false;
  const outcome = reason.origin;
  const occurrenceId = occurrenceIdOf(outcome.trait.owner);
  const installed =
    occurrenceId === undefined ? undefined : context.occurrences.visitsOf(occurrenceId)[0];
  if (installed === undefined) return false;
  for (const upgrade of unexplainedRarityUpgrades(context, installed + 1)) {
    if (context.used.has(upgrade.key)) continue;
    if (
      context.applyValid({
        kind: 'ReplaceSteadyGrowthTarget',
        outcome,
        targetTraitKey: upgrade.name,
      })
    ) {
      context.used.add(upgrade.key);
      return true;
    }
    context.refuse();
    return false;
  }
  return false;
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
  if (owner.kind !== 'incomingReward' && owner.kind !== 'localReward') return undefined;
  const state = context
    .assembly()
    .project.route.biomes.find((biome) => biome.biomeKey === owner.biomeKey)
    ?.topology?.occurrences.find((entry) => entry.occurrenceId === owner.occurrenceId)?.state;
  const offer =
    owner.kind === 'localReward'
      ? state?.kind === 'fieldsCombat'
        ? (owner.groupKey === 'cages' ? state.cages : state.optionalRewards)[owner.slotKey]?.offer
        : undefined
      : state !== undefined && 'reward' in state
        ? state.reward?.offer
        : undefined;
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
    if (screenGiver(context, screen) === 'Chaos') {
      if (answerChaosScreen(context, trait, screen, key, roomIndex)) return true;
      if (giver !== undefined) return false;
      continue;
    }
    const value = traitsOffer(context, screen, roomIndex);
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

/**
 * A Chaos screen's pair offer; an unpicked curse the record does not name
 * takes the next candidate the engine admits.
 */
function answerChaosScreen(
  context: RunImportContext,
  trait: TraitOfferAddress,
  screen: RunRecordTraitScreen,
  key: string,
  roomIndex: number,
): boolean {
  const record = { roomIndex, visit: 0 };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const built = chaosOffer(context, screen, roomIndex, attempt);
    if (built === undefined) return false;
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'traitOffer', trait, value: built.value });
    const command = { kind: 'ReplaceTraitOffer', trait, value: built.value } as const;
    if (
      evaluation.kind !== 'traitOffer' ||
      !evaluation.result.supported ||
      evaluation.result.findings.length > 0 ||
      !context.applyValid(command)
    ) {
      // Only an assumed curse can change; a refused recorded pair is final.
      if (built.assumedOptions === 0) break;
      continue;
    }
    context.used.add(key);
    // Rolled magnitudes and unpicked durations are not read from the save.
    context.note({
      area: 'traitOffer',
      reason: 'notInRecord',
      address: trait,
      applied: command,
      record,
    });
    if (built.assumedOptions > 0)
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
  return false;
}

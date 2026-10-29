import type {
  AuthoredTraitOffer,
  AuthoredTraitOption,
  ProjectCommand,
  TraitOfferAddress,
} from '../../authored-project';
import { concaveStoneProcGiver, type TraitRarity } from '../../catalog-schema';
import type { RunRecordTraitScreen } from '../../run-record/model';
import type { SemanticFinding } from '../model';
import type { RunImportContext } from './import';
import {
  encounterPhaseSequenceStatusForProjectEvaluationAssembly,
  levelResolutionCandidateForProjectEvaluationAssembly,
} from '../evaluation/project-evaluation-assembly';
import {
  authoredOccurrence,
  deliveredCageReward,
  deliveredIncomingReward,
  occurrenceIdOf,
} from './occurrences';
import { recordedEntryStates } from './conformance';
import { chaosOffer } from './features';
import { applyScreenRerolls } from './rerolls';
import { rarifyRerolledScreens, takeRarifyCharges, withRarifyClicks } from './rarify';
import { POM_GIVERS } from './vocabulary';
import { rerolledLevelScreensGuess } from '../traits/level-effects';

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

/** The keepsake held at `worldTime` in a record room: the latest swap that preceded it. */
function keepsakeHeldAt(
  context: RunImportContext,
  roomIndex: number,
  worldTime: number,
): string | undefined {
  let held = context.record.loadout.keepsake?.name;
  for (const [index, room] of context.record.rooms.slice(0, roomIndex + 1).entries()) {
    const swap = room.keepsakeSwap;
    if (swap === undefined) continue;
    const swappedAt = room.traits.acquired.find((trait) => trait.name === swap.to)?.worldTime;
    if (index < roomIndex || swappedAt === undefined || swappedAt <= worldTime) held = swap.to;
  }
  return held;
}

/**
 * Concave Stone's extra pick: the game logs no screen for it (`LogUpgradeChoice`
 * is skipped under `DoubleBoonChance`), so it is a trait the room acquired that
 * no screen of the room chose, one of this screen's unpicked options, acquired
 * after this screen's pick and before the room's next pick, while the Stone is held.
 */
function concaveStoneResidual(
  context: RunImportContext,
  screen: RunRecordTraitScreen,
  roomIndex: number,
  giverKey: string,
): number | undefined {
  if (!concaveStoneProcGiver(context.catalog.traitGivers.byKey[giverKey])) return undefined;
  const stone = context.catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'concaveStone',
  )?.key;
  const room = context.record.rooms[roomIndex]!;
  const acquiredAt = (name: string | undefined) =>
    room.traits.acquired.find((trait) => trait.name === name)?.worldTime;
  const pickedAt = acquiredAt(screen.options.find((option) => option.chosen)?.name);
  if (pickedAt === undefined || keepsakeHeldAt(context, roomIndex, pickedAt) !== stone)
    return undefined;
  const chosen = new Set(
    room.traitScreens.flatMap((entry) =>
      entry.options.filter((option) => option.chosen).map((option) => option.name),
    ),
  );
  const nextPick = Math.min(
    ...room.traitScreens
      .map((entry) => acquiredAt(entry.options.find((option) => option.chosen)?.name))
      .filter((at): at is number => at !== undefined && at > pickedAt),
  );
  const residuals = screen.options.flatMap((option, index) => {
    const at = acquiredAt(option.name);
    return !option.chosen &&
      !chosen.has(option.name) &&
      at !== undefined &&
      at >= pickedAt &&
      at < nextPick
      ? [index]
      : [];
  });
  return residuals.length === 1 ? residuals[0] : undefined;
}

function traitsOffer(
  context: RunImportContext,
  screen: RunRecordTraitScreen,
  roomIndex: number,
): AuthoredTraitOffer | undefined {
  const giverKey = screenGiver(context, screen);
  // A screen with nothing left shows the game's single Fallback Gold row.
  if (
    giverKey !== undefined &&
    screen.options.length === 1 &&
    screen.options[0]!.name === 'FallbackGold'
  )
    return { kind: 'fallbackGold', giverKey };
  const selected = screen.options.findIndex((option) => option.chosen);
  if (giverKey === undefined || selected < 0 || screen.options.length > 3) return undefined;
  const residual = concaveStoneResidual(context, screen, roomIndex, giverKey);
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
  return {
    kind: 'traits',
    giverKey,
    options,
    selectedOptionKey: OPTION_KEYS[selected]!,
    ...(residual === undefined
      ? {}
      : { concaveStoneResult: { kind: 'proc', optionKey: OPTION_KEYS[residual]! } }),
  };
}

/** The offer without its Concave Stone result. */
function withoutConcaveStone(value: AuthoredTraitOffer): AuthoredTraitOffer {
  if (value.kind !== 'traits' || value.concaveStoneResult === undefined) return value;
  const { concaveStoneResult: _result, ...rest } = value;
  void _result;
  return rest;
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
  const { concaveStoneResult: stone, rarificationActions: actions, ...rest } = value;
  const residual =
    stone?.kind === 'proc'
      ? kept.indexOf(value.options[OPTION_KEYS.indexOf(stone.optionKey)]!)
      : -1;
  // A click on a dropped row goes with it; the others follow their rows.
  const keptActions = (actions ?? []).flatMap((key) => {
    const at = kept.indexOf(value.options[OPTION_KEYS.indexOf(key)]!);
    return at < 0 ? [] : [OPTION_KEYS[at]!];
  });
  return {
    ...rest,
    ...(actions === undefined ? {} : { rarificationActions: keptActions }),
    options: kept as unknown as typeof value.options,
    selectedOptionKey: OPTION_KEYS[kept.indexOf(pick)]!,
    ...(residual < 0
      ? {}
      : { concaveStoneResult: { kind: 'proc', optionKey: OPTION_KEYS[residual]! } }),
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
      if (context.used.has(key) || !POM_GIVERS.has(screen.giver) || chosen === undefined) continue;
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
          if (value.kind === 'choice')
            applyScreenRerolls(context, roomIndex, position, levelResolution, (count) => {
              const screens = rerolledLevelScreensGuess(
                capability.branches[branchIndex]!.eligibleTargetTraitKeys,
                value.offeredTraitKeys,
                count,
              );
              return screens === undefined
                ? undefined
                : {
                    kind: 'ReplaceLevelResolution',
                    levelResolution,
                    value: { ...value, rerolledScreens: screens },
                  };
            });
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
  // A trait acquired and raised in one room shows only as a level rise between entry saves.
  const branchIndex = capability.branches.findIndex((branch) => branch.effectKind === 'random');
  if (branchIndex < 0) return false;
  const states = recordedEntryStates(context.record);
  for (const roomIndex of context.occurrences.visitsOf(occurrenceId)) {
    const before = states[roomIndex];
    const after = states[roomIndex + 1];
    if (before === undefined || after === undefined) continue;
    const supported = [...after.traits]
      .filter(([name, row]) => {
        const held = before.traits.get(name);
        return (
          !context.used.has(`rise:${roomIndex}:${name}`) &&
          (row.level ?? 1) > (held === undefined ? 0 : (held.level ?? 1))
        );
      })
      .map(([name]) => name)
      .filter(
        (name) =>
          capability.evaluate({ kind: 'random', targetTraitKey: name })[branchIndex]?.supported ===
          true,
      );
    const target = supported[0];
    if (target === undefined) continue;
    const command = {
      kind: 'ReplaceLevelResolution',
      levelResolution,
      value: { kind: 'random', targetTraitKey: target },
    } as const;
    if (!context.apply(command)) continue;
    context.used.add(`rise:${roomIndex}:${target}`);
    // Every other trait held its level, so a sole risen trait is the target.
    if (supported.length > 1)
      context.note({
        area: 'traitOffer',
        reason: 'assumption',
        address: levelResolution,
        applied: command,
        record: { roomIndex, visit: 0 },
      });
    return true;
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
  const occurrence = authoredOccurrence(
    context.assembly().project,
    owner.biomeKey,
    owner.occurrenceId,
  );
  const state = occurrence?.state;
  const offer =
    owner.kind === 'localReward'
      ? state?.kind === 'fieldsCombat'
        ? (owner.groupKey === 'cages'
            ? deliveredCageReward(occurrence!, owner.slotKey)
            : state.optionalRewards[owner.slotKey]
          )?.offer
        : undefined
      : occurrence === undefined
        ? undefined
        : deliveredIncomingReward(occurrence)?.offer;
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

const RARITY_ROLL_CODES: ReadonlySet<string> = new Set([
  'freshRarityUnavailable',
  'rarityRollUnavailable',
]);

/** The offer without its final screen's Rarify clicks. */
function withoutClicks(value: AuthoredTraitOffer): AuthoredTraitOffer {
  return value.kind !== 'traits' || (value.rarificationActions?.length ?? 0) === 0
    ? value
    : { ...value, rarificationActions: [] };
}

/**
 * Hovering a row while a rarify source with uses is held logs it one rarity
 * step high, Rarify clicked or not. Of `rows`, each row no authored click
 * explains is lowered one step where every branch could rarify it from there
 * before any click: the picked row when its acquired trait holds the lower
 * rarity, an unpicked row whose logged rarity alone the engine refuses and
 * whose lower rarity it admits. Returns the corrected offer and the rows lowered.
 */
function withoutHoverRarify(
  context: RunImportContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOffer,
  roomIndex: number,
  rows: 'picked' | 'unpicked',
  clicked: ReadonlySet<number> = new Set(),
): { readonly value: AuthoredTraitOffer; readonly lowered: readonly number[] } | undefined {
  if (value.kind !== 'traits') return undefined;
  const evaluation = context
    .candidates()
    .evaluate({ kind: 'traitOffer', trait, value: withoutClicks(value) });
  if (evaluation.kind !== 'traitOffer') return undefined;
  const order = context.catalog.traitRarityOrder;
  const lower = (rarity: TraitRarity | undefined): TraitRarity | undefined =>
    rarity === undefined ? undefined : order[(order as readonly string[]).indexOf(rarity) - 1];
  const selected = OPTION_KEYS.indexOf(value.selectedOptionKey);
  const acquired = context.record.rooms[roomIndex]!.traits.acquired;
  const lowering = value.options.flatMap((option, index) => {
    const rarity = lower(option.rarity);
    if (rarity === undefined || clicked.has(index) || (index === selected) !== (rows === 'picked'))
      return [];
    if (index !== selected) {
      const findings = evaluation.result.assessments[index]?.findings ?? [];
      return findings.length > 0 && findings.every((finding) => RARITY_ROLL_CODES.has(finding.code))
        ? [index]
        : [];
    }
    const grants = acquired.filter((entry) => entry.name === option.traitKey);
    return grants.length === 1 && grants[0]!.rarity === rarity ? [index] : [];
  });
  if (lowering.length === 0) return undefined;
  const lowered = {
    ...value,
    options: value.options.map((option, index) =>
      lowering.includes(index) ? { ...option, rarity: lower(option.rarity)! } : option,
    ) as unknown as typeof value.options,
  };
  const retry = context
    .candidates()
    .evaluate({ kind: 'traitOffer', trait, value: withoutClicks(lowered) });
  if (retry.kind !== 'traitOffer') return undefined;
  const branches = retry.result.callingCard ?? [];
  const confirmed = lowering.every(
    (index) =>
      branches.length > 0 &&
      branches.every((branch) => branch.rarifiableOptionKeys.includes(OPTION_KEYS[index]!)) &&
      (index === selected || retry.result.assessments[index]?.legal === true),
  );
  return confirmed ? { value: lowered, lowered: lowering } : undefined;
}

/**
 * A screen's rows with its spent Rarify charges and hover corrections: the
 * unpicked rows' hover first, as the hover preceded any click; then the
 * clicks, judged from each row's logged rarity; then the pick's hover where
 * no click explains it. Returns the offer and the unpicked rows lowered with
 * no click to explain them.
 */
function withRarifyAndHover(
  context: RunImportContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOffer,
  roomIndex: number,
  logged: ReadonlyMap<string, string | undefined>,
): { readonly value: AuthoredTraitOffer; readonly lowered: readonly number[] } {
  const unpicked = withoutHoverRarify(context, trait, value, roomIndex, 'unpicked');
  const hovered = unpicked?.value ?? value;
  const clicks = withRarifyClicks(context, trait, hovered, roomIndex, logged);
  const clicked = clicks?.value ?? hovered;
  const picked = withoutHoverRarify(context, trait, clicked, roomIndex, 'picked', clicks?.clicked);
  return {
    value: picked?.value ?? clicked,
    lowered: (unpicked?.lowered ?? []).filter((index) => clicks?.clicked.has(index) !== true),
  };
}

/** The Rarify clicks an applied offer's final screen holds. */
const clickCount = (value: AuthoredTraitOffer) =>
  value.kind === 'traits' ? (value.rarificationActions?.length ?? 0) : 0;

/**
 * Applies a screen's offer, else the offer without the unselected rows the
 * engine refuses, reported, and returns the value applied. The room's spent
 * Rarify charges become clicks on its rows, and a logged row no click
 * explains is corrected for hover. An offer carrying a Concave Stone result
 * is kept only when its extra pick settles without a finding.
 */
function applyScreenOffer(
  context: RunImportContext,
  trait: TraitOfferAddress,
  recorded: AuthoredTraitOffer,
  record: { readonly roomIndex: number; readonly visit: number },
  ambiguous: boolean,
): AuthoredTraitOffer | undefined {
  const stone = recorded.kind === 'traits' && recorded.concaveStoneResult !== undefined;
  const apply = (command: ProjectCommand) => {
    if (!(stone ? context.applyValid(command) : context.apply(command))) return false;
    if (command.kind === 'ReplaceTraitOffer' && command.value.kind === 'traits')
      takeRarifyCharges(
        context,
        record.roomIndex,
        command.value.giverKey,
        clickCount(command.value),
      );
    return true;
  };
  const logged = new Map(
    recorded.kind === 'traits'
      ? recorded.options.map((option) => [option.traitKey, option.rarity] as const)
      : [],
  );
  const corrected = withRarifyAndHover(context, trait, recorded, record.roomIndex, logged);
  const value = corrected.value;
  const evaluation = context.candidates().evaluate({ kind: 'traitOffer', trait, value });
  if (evaluation.kind !== 'traitOffer') return undefined;
  // An unpicked row's rarity lowered from the logged one is an assumption.
  const assumed = ambiguous || corrected.lowered.length > 0;
  const command = { kind: 'ReplaceTraitOffer', trait, value } as const;
  if (evaluation.result.supported && evaluation.result.findings.length === 0) {
    if (!apply(command)) return undefined;
    if (assumed)
      context.note({
        area: 'traitOffer',
        reason: 'assumption',
        address: trait,
        applied: command,
        record,
      });
    return value;
  }
  context.refuse();
  // The engine refuses some unselected rows here; the observed pick keeps the
  // others, whose clicks and hover are judged again once the offer is legal.
  const kept = withoutIllegalRows(recorded, evaluation.result.assessments);
  if (kept === undefined) return undefined;
  const reduced = withRarifyAndHover(context, trait, kept, record.roomIndex, logged).value;
  const retry = context.candidates().evaluate({ kind: 'traitOffer', trait, value: reduced });
  const reducedCommand = { kind: 'ReplaceTraitOffer', trait, value: reduced } as const;
  if (
    retry.kind !== 'traitOffer' ||
    !retry.result.supported ||
    retry.result.findings.length > 0 ||
    !apply(reducedCommand)
  )
    return undefined;
  context.note({
    area: 'traitOffer',
    reason: 'refused',
    address: trait,
    applied: reducedCommand,
    record,
  });
  // Every lowered row is legal in this evaluation, so the reduction keeps it.
  if (corrected.lowered.length > 0)
    context.note({
      area: 'traitOffer',
      reason: 'assumption',
      address: trait,
      applied: reducedCommand,
      record,
    });
  return reduced;
}

/**
 * Authors a screen's recorded rerolls on the final rows just applied, then the
 * room's Rarify charges the final screen could not take on its earlier screens.
 */
function applyTraitScreenRerolls(
  context: RunImportContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOffer,
  roomIndex: number,
  position: number,
): void {
  let rerolled: AuthoredTraitOffer | undefined;
  const applied = applyScreenRerolls(context, roomIndex, position, trait, (count) => {
    const screens = context.candidates().rerolledTraitScreensGuess(trait, value, count);
    rerolled =
      screens === undefined
        ? undefined
        : ({ ...value, rerolledScreens: screens } as AuthoredTraitOffer);
    return rerolled === undefined
      ? undefined
      : { kind: 'ReplaceTraitOffer', trait, value: rerolled };
  });
  if (applied && rerolled !== undefined) rarifyRerolledScreens(context, trait, rerolled, roomIndex);
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
        POM_GIVERS.has(screen.giver) ||
        (giver !== undefined && screenGiver(context, screen) !== giver)
        ? []
        : [{ screen, key, roomIndex, position }];
    }),
  );
  const ambiguous =
    giver === undefined && new Set(screens.map((entry) => entry.screen.giver)).size > 1;
  for (const { screen, key, roomIndex, position } of screens) {
    const record = { roomIndex, visit: 0 };
    if (screenGiver(context, screen) === 'Chaos') {
      if (answerChaosScreen(context, trait, screen, key, roomIndex, position)) return true;
      if (giver !== undefined) return false;
      continue;
    }
    const value = traitsOffer(context, screen, roomIndex);
    if (value === undefined) continue;
    const applied = applyScreenOffer(context, trait, value, record, ambiguous);
    if (applied !== undefined) {
      context.used.add(key);
      applyTraitScreenRerolls(context, trait, applied, roomIndex, position);
      return true;
    }
    // The engine refused the Stone's extra pick; the screen's own pick may still stand.
    const plain = withoutConcaveStone(value);
    const appliedPlain =
      plain === value ? undefined : applyScreenOffer(context, trait, plain, record, ambiguous);
    if (appliedPlain !== undefined) {
      context.used.add(key);
      context.note({ area: 'traitOffer', reason: 'refused', address: trait, record });
      applyTraitScreenRerolls(context, trait, appliedPlain, roomIndex, position);
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
  position: number,
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
    applyTraitScreenRerolls(context, trait, built.value, roomIndex, position);
    // Unpicked durations are never saved.
    context.note({
      area: 'traitOffer',
      reason: 'notInRecord',
      address: trait,
      applied: command,
      record,
    });
    if (built.read === 'refused')
      context.note({
        area: 'traitOffer',
        reason: 'refused',
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

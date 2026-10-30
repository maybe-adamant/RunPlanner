import type {
  AuthoredTraitOffer,
  AuthoredTraitOption,
  ProjectCommand,
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
import {
  awaitMaxHealthRolls,
  completeRecordedCarrierChildren,
  type RecordedCarrierChildReport,
} from './carrier-children';
import { rerolledLevelScreensGuess } from '../traits/level-effects';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

function traitsOffer(
  context: RunImportContext,
  screen: RunRecordTraitScreen,
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
  const options = screen.options.map((option): AuthoredTraitOption => ({
    traitKey: option.name,
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
  };
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
  const { rarificationActions: actions, ...rest } = value;
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

/**
 * Rejected blocks one row of a full god screen and the game logs only the rows
 * left, so a two-row screen under it showed a third, blocked row. That row is
 * any trait the engine admits there beside the shown rows and outside what the
 * room acquired, a name the room banned first (Vow of Denial bans the blocked
 * button too); which trait and where are otherwise never saved and leave the
 * same run state. A screen the engine cannot fill held only its two rows.
 */
function withRejectedRow(
  context: RunImportContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOffer,
  roomIndex: number,
): AuthoredTraitOffer {
  if (value.kind !== 'traits' || value.options.length !== 2) return value;
  const room = context.record.rooms[roomIndex]!;
  const shown = new Set([
    ...value.options.map((option) => option.traitKey),
    ...room.traits.acquired.map((entry) => entry.name),
  ]);
  const banned = new Set(room.bannedTraits ?? []);
  const candidates = (context.catalog.traitGivers.byKey[value.giverKey]?.traitKeys ?? [])
    .filter((traitKey) => !shown.has(traitKey))
    .sort((left, right) => Number(banned.has(right)) - Number(banned.has(left)))
    .flatMap((traitKey): AuthoredTraitOption[] => {
      const domain = context.catalog.traits.byKey[traitKey]?.rarityDomain;
      return domain?.kind === 'ranked'
        ? domain.freshOfferRarities.map((rarity) => ({ traitKey, rarity }))
        : [{ traitKey }];
    });
  for (const row of candidates) {
    const synthesized = {
      ...value,
      options: [...value.options, row] as unknown as typeof value.options,
      rejectedOptionKey: 'option3',
    } as const;
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'traitOffer', trait, value: synthesized });
    if (evaluation.kind !== 'traitOffer') return value;
    const rules = evaluation.result.chaosOfferRules ?? [];
    // Only a screen every branch restricts held a blocked row.
    if (rules.length === 0 || !rules.every((rule) => rule.rejectedBlockRequired)) return value;
    if (evaluation.result.supported && evaluation.result.findings.length === 0) return synthesized;
  }
  return value;
}

const withoutPersephoneBonus = (option: AuthoredTraitOption): AuthoredTraitOption => {
  const { persephoneLevelBonus: _bonus, ...rest } = option;
  void _bonus;
  return rest;
};

/**
 * Aspect of Persephone rolls each row's bonus levels when the screen opens and
 * keeps the roll only on its button. The picked row's bonus is the one the
 * engine says installs the level the record acquired; `refused` when none does.
 */
function withPersephoneLevel(
  context: RunImportContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOffer,
  roomIndex: number,
): { readonly value: AuthoredTraitOffer; readonly refused?: true } {
  if (value.kind !== 'traits') return { value };
  const selected = OPTION_KEYS.indexOf(value.selectedOptionKey);
  const picked = value.options[selected]!;
  const acquired = context.record.rooms[roomIndex]!.traits.acquired.find(
    (entry) => entry.name === picked.traitKey,
  );
  if (acquired === undefined) return { value };
  // The game reads a trait's level as its `StackNum`, one when unset.
  const level = acquired.level ?? 1;
  const levelWith = (bonus: number) => {
    const candidate = {
      ...value,
      options: value.options.map((option, index) =>
        index !== selected
          ? option
          : bonus === 0
            ? withoutPersephoneBonus(option)
            : { ...option, persephoneLevelBonus: bonus },
      ) as unknown as typeof value.options,
    };
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'traitOffer', trait, value: candidate });
    return evaluation.kind !== 'traitOffer'
      ? undefined
      : {
          value: candidate,
          maximum: evaluation.result.persephoneLevelBonusMaximums[selected],
          level: evaluation.result.effectiveLevels[selected],
        };
  };
  const current = levelWith(picked.persephoneLevelBonus ?? 0);
  if (current?.maximum === undefined || current.level === level) return { value };
  for (let bonus = 0; bonus <= current.maximum; bonus += 1) {
    const result = levelWith(bonus);
    if (result?.level === level) return { value: result.value };
  }
  return { value, refused: true };
}

/** The Rarify clicks an applied offer's final screen holds. */
const clickCount = (value: AuthoredTraitOffer) =>
  value.kind === 'traits' ? (value.rarificationActions?.length ?? 0) : 0;

/** The applied offer, or why none was: `stone` when it held a recorded Concave Stone proc. */
type ScreenOfferResult =
  | { readonly applied: AuthoredTraitOffer }
  | { readonly applied?: undefined; readonly stone: boolean };

/** The offer holds a Concave Stone extra pick. */
const stoneProc = (value: AuthoredTraitOffer) =>
  value.kind === 'traits' && value.concaveStoneResult?.kind === 'proc';

/**
 * Applies a screen's offer, else the offer without the unselected rows the
 * engine refuses, reported, and returns the value applied. The room's spent
 * Rarify charges become clicks on its rows, a logged row no click explains is
 * corrected for hover, and the selected outcome's children are answered from
 * the record on the final rows. An offer carrying a Concave Stone extra pick is
 * kept only when the pick settles without a finding.
 */
function applyScreenOffer(
  context: RunImportContext,
  trait: TraitOfferAddress,
  recorded: AuthoredTraitOffer,
  record: { readonly roomIndex: number; readonly visit: number },
  ambiguous: boolean,
  stoneFromRecord = true,
): ScreenOfferResult {
  const apply = (command: ProjectCommand & { readonly kind: 'ReplaceTraitOffer' }) => {
    if (!(stoneProc(command.value) ? context.applyValid(command) : context.apply(command)))
      return false;
    if (command.value.kind === 'traits')
      takeRarifyCharges(
        context,
        record.roomIndex,
        command.value.giverKey,
        clickCount(command.value),
      );
    awaitMaxHealthRolls(context, trait, command.value, record.roomIndex);
    return true;
  };
  const noteChildren = (
    reports: readonly RecordedCarrierChildReport[],
    command: ProjectCommand,
  ) => {
    for (const entry of reports)
      context.note({
        area: 'traitOffer',
        reason: entry.reason,
        address: entry.address,
        applied: command,
        record,
      });
  };
  const logged = new Map(
    recorded.kind === 'traits'
      ? recorded.options.map((option) => [option.traitKey, option.rarity] as const)
      : [],
  );
  const corrected = withRarifyAndHover(context, trait, recorded, record.roomIndex, logged);
  const children = completeRecordedCarrierChildren(
    context,
    trait,
    corrected.value,
    record.roomIndex,
    stoneFromRecord,
  );
  const leveled = withPersephoneLevel(context, trait, children.value, record.roomIndex);
  const value = withRejectedRow(context, trait, leveled.value, record.roomIndex);
  const failed = { stone: stoneProc(value) };
  const evaluation = context.candidates().evaluate({ kind: 'traitOffer', trait, value });
  if (evaluation.kind !== 'traitOffer') return failed;
  // An unpicked row's rarity lowered from the logged one is an assumption.
  const assumed = ambiguous || corrected.lowered.length > 0;
  const command = { kind: 'ReplaceTraitOffer', trait, value } as const;
  if (evaluation.result.supported && evaluation.result.findings.length === 0) {
    if (!apply(command)) return failed;
    if (assumed)
      context.note({
        area: 'traitOffer',
        reason: 'assumption',
        address: trait,
        applied: command,
        record,
      });
    noteChildren(children.reports, command);
    if (leveled.refused === true)
      context.note({
        area: 'traitOffer',
        reason: 'refused',
        address: trait,
        applied: command,
        record,
      });
    return { applied: value };
  }
  context.refuse();
  // The engine refuses some unselected rows here; the observed pick keeps the
  // others, whose clicks, hover and children are judged again once the offer is legal.
  const kept = withoutIllegalRows(recorded, evaluation.result.assessments);
  if (kept === undefined) return failed;
  const reducedChildren = completeRecordedCarrierChildren(
    context,
    trait,
    withRarifyAndHover(context, trait, kept, record.roomIndex, logged).value,
    record.roomIndex,
    stoneFromRecord,
  );
  const reducedLeveled = withPersephoneLevel(
    context,
    trait,
    reducedChildren.value,
    record.roomIndex,
  );
  const reduced = withRejectedRow(context, trait, reducedLeveled.value, record.roomIndex);
  const retry = context.candidates().evaluate({ kind: 'traitOffer', trait, value: reduced });
  const reducedCommand = { kind: 'ReplaceTraitOffer', trait, value: reduced } as const;
  if (
    retry.kind !== 'traitOffer' ||
    !retry.result.supported ||
    retry.result.findings.length > 0 ||
    !apply(reducedCommand)
  )
    return { stone: failed.stone || stoneProc(reduced) };
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
  noteChildren(reducedChildren.reports, reducedCommand);
  if (reducedLeveled.refused === true)
    context.note({
      area: 'traitOffer',
      reason: 'refused',
      address: trait,
      applied: reducedCommand,
      record,
    });
  return { applied: reduced };
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
    const value = traitsOffer(context, screen);
    if (value === undefined) continue;
    const result = applyScreenOffer(context, trait, value, record, ambiguous);
    if (result.applied !== undefined) {
      context.used.add(key);
      applyTraitScreenRerolls(context, trait, result.applied, roomIndex, position);
      return true;
    }
    // The engine refused the Stone's extra pick; the screen's own pick may still stand.
    const plain = result.stone
      ? applyScreenOffer(context, trait, value, record, ambiguous, false).applied
      : undefined;
    if (plain !== undefined) {
      context.used.add(key);
      context.note({ area: 'traitOffer', reason: 'refused', address: trait, record });
      applyTraitScreenRerolls(context, trait, plain, roomIndex, position);
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

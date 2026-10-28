import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createPostbossKeepsakeSelectionAddress,
  type AuthoredExperimentalHammerEquipResult,
  type AuthoredTraitOffer,
  type AuthoredTraitOption,
  type ProjectCommand,
  type RoomActionReference,
  type RoomOccurrence,
  type SemanticAddress,
} from '../../authored-project';
import {
  chaosOperandAuthoringValues,
  chaosOperandsAtRarity,
  type AuthoredChaosTraitOffer,
} from '../../authored-project/traits/state';
import { roomActionDomainForOccurrence } from '../../authored-project/room-actions/defaults';
import type {
  Catalog,
  ChaosNumericOperand,
  HexLayoutKey,
  InRunTraitRarity,
} from '../../catalog-schema';
import type {
  RunRecordSpell,
  RunRecordTraitAcquisition,
  RunRecordTraitScreen,
} from '../../run-record/model';
import { acquisitionConversionCandidateForProjectEvaluationAssembly } from '../evaluation/project-evaluation-assembly';
import type { SemanticFinding } from '../model';
import { insertRoomAction, removeRoomAction } from './actions';
import type { RunImportContext } from './import';
import { occurrenceIdOf } from './occurrences';
import { pickupUseCount } from './vocabulary';

type Origin<K extends SemanticAddress['kind']> = Extract<SemanticAddress, { readonly kind: K }>;

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;
const record = (roomIndex: number) => ({ roomIndex, visit: 0 });

/**
 * Answers the Spell pick, Path of Stars screens, Transcendent Embryo blessings,
 * Jeweled Pom and Experimental Hammer grants and fountain rarity targets from
 * the record.
 */
export function answerFeatures(context: RunImportContext, reason: SemanticFinding): boolean {
  const origin = reason.origin;
  if (reason.code === 'traitOfferMissing' && origin.kind === 'traitOffer')
    return answerSpellOffer(context, origin);
  if (reason.code === 'hexActivationMissing' && origin.kind === 'acquisitionRole')
    return answerHexActivation(context, origin);
  if (
    reason.code === 'keepsakeEquipResultMissing' &&
    origin.kind === 'keepsakeEquipResult' &&
    origin.resultKind === 'transcendentEmbryo'
  )
    return answerEmbryoEquip(context, origin);
  if (reason.code === 'keepsakeEquipResultMissing' && origin.kind === 'keepsakeEquipResult')
    return answerGrantedTrait(context, origin);
  if (
    reason.code === 'transcendentEmbryoOutcomeMissing' &&
    origin.kind === 'transcendentEmbryoOutcome'
  )
    return answerEmbryoTransformation(context, origin);
  if (
    (reason.code === 'fountainRarityResultMissing' ||
      reason.code === 'fountainRarityResultUnavailable') &&
    origin.kind === 'fountainRarityOutcome'
  )
    return answerFountainRarity(context, origin);
  return false;
}

/** The record rooms whose fountain an outcome's fountain action used. */
function fountainRooms(
  context: RunImportContext,
  outcome: Origin<'fountainRarityOutcome'>,
): readonly number[] {
  const usedFountain = (index: number) =>
    Object.keys(context.record.rooms[index]!.uses).some((name) => /Fountain/.test(name));
  const action = outcome.action;
  if (action.kind !== 'hubFountain')
    return context.occurrences.visitsOf(action.occurrenceId).filter(usedFountain);
  const progression = context.catalog.biomeLayouts.byKey[outcome.biomeKey]?.progression;
  if (progression?.kind !== 'hub') return [];
  return context.occurrences.biomeOfRoom.flatMap((biomeKey, index) =>
    biomeKey === outcome.biomeKey &&
    context.record.rooms[index]!.name === progression.restoreRoomGameName &&
    usedFountain(index)
      ? [index]
      : [],
  );
}

/**
 * The Phial's fountain raises one boon's rarity: the trait whose rarity rose
 * in the fountain's room.
 */
function answerFountainRarity(
  context: RunImportContext,
  outcome: Origin<'fountainRarityOutcome'>,
): boolean {
  const roomIndex = fountainRooms(context, outcome)[0];
  if (roomIndex === undefined) return false;
  const raised = context.record.rooms[roomIndex]!.traits.upgraded.filter(
    (upgrade) =>
      upgrade.from.rarity !== undefined &&
      upgrade.to.rarity !== undefined &&
      upgrade.from.rarity !== upgrade.to.rarity,
  );
  if (raised.length !== 1) return false;
  const targetTraitKey = raised[0]!.name;
  const evaluation = context
    .candidates()
    .evaluate({ kind: 'fountainRarityOutcome', outcome, targetTraitKey });
  if (
    evaluation.kind === 'fountainRarityOutcome' &&
    evaluation.result.selectedPossible &&
    context.applyValid({ kind: 'ReplaceFountainRarityTarget', outcome, targetTraitKey })
  )
    return true;
  context.refuse();
  return false;
}

/** The first record room of an occurrence's visits holding a Spell snapshot. */
function spellVisit(
  context: RunImportContext,
  occurrenceId: string,
): { readonly roomIndex: number; readonly spell: RunRecordSpell } | undefined {
  for (const roomIndex of context.occurrences.visitsOf(occurrenceId)) {
    const spell = context.record.rooms[roomIndex]!.spell;
    if (spell !== undefined) return { roomIndex, spell };
  }
  return undefined;
}

/**
 * A Spell snapshot's rolled tree as authored: God Sent nodes hold their native
 * talents and are never authored. Undefined without a declared layout.
 */
export function recordedHexTree(
  catalog: Catalog,
  spellTraitKey: string,
  spell: RunRecordSpell,
):
  | { readonly layoutKey: HexLayoutKey; readonly nodes: Readonly<Record<string, string>> }
  | undefined {
  const layout = catalog.hexes.byKey[spellTraitKey]?.layouts.byKey[spell.layout as HexLayoutKey];
  if (layout === undefined) return undefined;
  return {
    layoutKey: layout.key,
    nodes: Object.fromEntries(
      Object.entries(spell.talents)
        .filter(([node]) => {
          const kind = layout.nodes.byKey[node]?.kind;
          return kind !== 'olympianSpell' && kind !== 'olympianCount';
        })
        .map(([node, talent]) => [node, talent.name]),
    ),
  };
}

/** The Spell snapshot in force before a room: the latest earlier one. */
function spellBefore(context: RunImportContext, roomIndex: number): RunRecordSpell | undefined {
  for (let index = roomIndex - 1; index >= 0; index -= 1) {
    const spell = context.record.rooms[index]!.spell;
    if (spell !== undefined) return spell;
  }
  return undefined;
}

/**
 * A Spell pick is the record's slotted Spell with its rolled talent tree; the
 * screen's other Spells are not saved and take the first ones the engine admits.
 */
function answerSpellOffer(context: RunImportContext, trait: Origin<'traitOffer'>): boolean {
  const occurrenceId = occurrenceIdOf(trait.owner);
  const giver = context.catalog.traitGivers.byKey['SpellDrop'];
  const visit = occurrenceId === undefined ? undefined : spellVisit(context, occurrenceId);
  if (
    giver === undefined ||
    visit === undefined ||
    spellBefore(context, visit.roomIndex) !== undefined
  )
    return false;
  const chosen = giver.traitKeys.find((key) => key === `Spell${visit.spell.name}Trait`);
  const hexTree =
    chosen === undefined ? undefined : recordedHexTree(context.catalog, chosen, visit.spell);
  if (chosen === undefined || hexTree === undefined) return false;
  const position = spellPickPosition(
    context,
    visit.roomIndex,
    giver.selectedOptionPathPointBonuses,
  );
  const others = giver.traitKeys.filter((key) => key !== chosen);
  for (let first = 0; first < others.length; first += 1)
    for (let second = first + 1; second < others.length; second += 1) {
      const keys = [others[first]!, others[second]!];
      keys.splice(position ?? 0, 0, chosen);
      const options = keys.map((traitKey): AuthoredTraitOption => ({
        traitKey,
      })) as unknown as readonly [AuthoredTraitOption, AuthoredTraitOption, AuthoredTraitOption];
      const value: AuthoredTraitOffer = {
        kind: 'traits',
        giverKey: 'SpellDrop',
        options,
        selectedOptionKey: OPTION_KEYS[position ?? 0]!,
        hexTree,
      };
      const evaluation = context.candidates().evaluate({ kind: 'traitOffer', trait, value });
      if (
        evaluation.kind !== 'traitOffer' ||
        !evaluation.result.supported ||
        evaluation.result.findings.length > 0
      )
        continue;
      const command: ProjectCommand = { kind: 'ReplaceTraitOffer', trait, value };
      if (!context.applyValid(command)) continue;
      // The Spell screen's unpicked options are never saved.
      if (position === undefined)
        context.note({
          area: 'pathOfStars',
          reason: 'assumption',
          address: trait,
          applied: command,
          record: record(visit.roomIndex),
        });
      context.note({
        area: 'pathOfStars',
        reason: 'notInRecord',
        address: trait,
        applied: command,
        record: record(visit.roomIndex),
      });
      return true;
    }
  context.refuse();
  return false;
}

/**
 * A Spell screen's position banks its bonus Path points, so the pick's
 * position is the one whose bonus explains how many nodes the first investing
 * room shows beyond the points every drop since the pick granted.
 */
function spellPickPosition(
  context: RunImportContext,
  pickIndex: number,
  bonuses: readonly number[] | undefined,
): number | undefined {
  if (bonuses === undefined) return undefined;
  let points = 0;
  for (let index = pickIndex; index < context.record.rooms.length; index += 1) {
    const room = context.record.rooms[index]!;
    for (const [name, count] of Object.entries(room.uses))
      points += (context.catalog.rewards.acquisitions.byKey[name]?.pathPointGrant ?? 0) * count;
    if (index === pickIndex || room.spell === undefined) continue;
    const invested = Object.values(room.spell.talents).filter((talent) => talent.invested).length;
    if (invested === 0) continue;
    const position = bonuses.indexOf(invested - points);
    return position < 0 ? undefined : position;
  }
  return undefined;
}

/**
 * A Path of Stars screen invests the nodes its room's Spell snapshot newly
 * shows invested; several screens in one room take them in layout order.
 * Without a snapshot, the room's new talents are matched by name.
 */
function answerHexActivation(
  context: RunImportContext,
  acquisition: Origin<'acquisitionRole'>,
): boolean {
  const capability = acquisitionConversionCandidateForProjectEvaluationAssembly(
    context.assembly(),
    acquisition,
  )?.hexActivation;
  const occurrenceId = occurrenceIdOf(acquisition);
  if (capability === undefined || occurrenceId === undefined) return false;
  const visit = spellVisit(context, occurrenceId);
  const roomIndex = visit?.roomIndex ?? context.occurrences.visitsOf(occurrenceId)[0];
  if (roomIndex === undefined) return false;
  const fresh = (node: string) => !context.used.has(`hex:${roomIndex}:${node}`);
  let wanted: string[];
  if (visit !== undefined) {
    const before = spellBefore(context, roomIndex);
    wanted = Object.entries(visit.spell.talents)
      .filter(([node, talent]) => talent.invested && before?.talents[node]?.invested !== true)
      .map(([node]) => node)
      .filter(fresh);
  } else {
    const names = context.record.rooms[roomIndex]!.traits.acquired.map((trait) => trait.name);
    wanted = Object.entries(capability.tree.nodes)
      .filter(([node, talent]) => names.includes(talent) && fresh(node))
      .map(([node]) => node);
  }
  // Each screen spends its own count of nodes, reachable in order.
  const selected: string[] = [];
  while (selected.length < capability.count) {
    const available = capability.availableNodeKeys(selected);
    const next = wanted.find((node) => available.includes(node) && !selected.includes(node));
    if (next === undefined) break;
    selected.push(next);
  }
  const command: ProjectCommand = {
    kind: 'ReplaceHexActivation',
    acquisition,
    value: { selectedNodeKeys: selected },
  };
  if (
    selected.length !== capability.count ||
    capability.assess(selected).length > 0 ||
    !context.applyValid(command)
  ) {
    context.refuse();
    return false;
  }
  for (const node of selected) context.used.add(`hex:${roomIndex}:${node}`);
  if (visit === undefined)
    context.note({
      area: 'pathOfStars',
      reason: 'notInRecord',
      address: acquisition,
      applied: command,
      record: record(roomIndex),
    });
  return true;
}

const isBlessing = (context: RunImportContext, name: string) =>
  context.catalog.chaos.blessings.byKey[name] !== undefined;

/** How a Chaos operand set was read: exact, absent from the record, or off its domain. */
interface SavedChaosValues {
  readonly read: 'exact' | 'notInRecord' | 'refused';
  readonly values: Readonly<Record<string, number>>;
}

/** A saved number as its operand, on the domain's step and inside it. */
function savedOperand(
  relation: NonNullable<ChaosNumericOperand['saveField']>['relation'],
  domain: ChaosNumericOperand,
  saved: number,
): number | undefined {
  const raw = relation === 'deltaFromOne' ? saved - 1 : relation === 'oneMinus' ? 1 - saved : saved;
  const steps = (raw - domain.minimum) / domain.step;
  const index = Math.round(steps);
  if (Math.abs(steps - index) > 1e-6) return undefined;
  const value = Number((domain.minimum + index * domain.step).toFixed(10));
  return value >= domain.minimum && value <= domain.maximum ? value : undefined;
}

/**
 * A Chaos operand set at its rarity's domains, read from a recorded trait's
 * saved values through the catalog's save fields, under `prefix` for a pending
 * blessing. An unsaved or refused set takes the declaration defaults.
 */
function savedChaosValues(
  operands: readonly ChaosNumericOperand[],
  rarity: AuthoredChaosTraitOffer['rarity'] | undefined,
  acquisition: RunRecordTraitAcquisition | undefined,
  prefix?: string,
): SavedChaosValues {
  const domains = rarity === undefined ? operands : chaosOperandsAtRarity(operands, rarity);
  const values: Record<string, number> = {};
  for (const [index, operand] of operands.entries()) {
    const field = operand.saveField;
    const saved =
      field === undefined
        ? undefined
        : acquisition?.savedValues?.[prefix === undefined ? field.path : `${prefix}.${field.path}`];
    if (field === undefined || saved === undefined)
      return { read: 'notInRecord', values: chaosOperandAuthoringValues(operands, rarity) };
    const value = savedOperand(field.relation, domains[index]!, saved);
    if (value === undefined)
      return { read: 'refused', values: chaosOperandAuthoringValues(operands, rarity) };
    values[operand.key] = value;
  }
  return { read: 'exact', values: Object.freeze(values) };
}

/** An Embryo blessing's values at its rarity, read from the acquisition that granted it. */
function embryoBlessingValues(
  context: RunImportContext,
  blessingKey: string,
  rarity: InRunTraitRarity,
  acquisition: RunRecordTraitAcquisition | undefined,
): SavedChaosValues {
  const operands = context.catalog.chaos.blessings.byKey[blessingKey]?.operands ?? [];
  return savedChaosValues(operands, rarity, acquisition);
}

/** Reports a value read that was not exact against the command that applied it. */
function noteRead(
  context: RunImportContext,
  read: SavedChaosValues['read'],
  area: 'embryo' | 'traitOffer',
  address: SemanticAddress,
  applied: ProjectCommand,
  roomIndex: number,
): void {
  if (read !== 'exact')
    context.note({ area, reason: read, address, applied, record: record(roomIndex) });
}

/** The record room where a keepsake selection equipped: its rack, the route start or the biome start. */
function selectionRoom(
  context: RunImportContext,
  selection: Origin<'keepsakeEquipResult'>['selection'],
): number | undefined {
  if (selection.kind === 'echoKeepsakeReplay') {
    const index = context.occurrences.biomeOfRoom.indexOf(selection.biomeKey);
    return index < 0 ? undefined : index;
  }
  if (selection.owner === 'routeStart') return 0;
  return context.occurrences.visitsOf(selection.owner.occurrenceId)[0];
}

/** Embryo's equip blessing is the Chaos blessing gained with the keepsake itself. */
function answerEmbryoEquip(
  context: RunImportContext,
  result: Origin<'keepsakeEquipResult'>,
): boolean {
  const roomIndex = selectionRoom(context, result.selection);
  if (roomIndex === undefined) return false;
  const acquired = context.record.rooms[roomIndex]!.traits.acquired;
  const keepsakeAt = acquired.find(
    (trait) => context.catalog.keepsakes.byKey[trait.name] !== undefined,
  )?.worldTime;
  const blessings = acquired.filter((trait) => isBlessing(context, trait.name));
  const timed = blessings.filter(
    (trait) => keepsakeAt !== undefined && trait.worldTime === keepsakeAt,
  );
  const granted = (timed.length === 1 ? timed : blessings)[0];
  const blessing = granted?.name;
  if (blessing === undefined || (timed.length !== 1 && blessings.length !== 1)) return false;
  const evaluation = context.candidates().evaluate({ kind: 'keepsakeEquipResult', result });
  const option =
    evaluation.kind === 'keepsakeEquipResult'
      ? evaluation.result.options.find(
          (candidate) =>
            candidate.resultKind === 'transcendentEmbryo' &&
            'blessingKey' in candidate.value &&
            candidate.value.blessingKey === blessing,
        )
      : undefined;
  const rarity = option?.transcendentEmbryoSummary?.rarity;
  if (
    option === undefined ||
    rarity === undefined ||
    !('blessingKey' in option.value) ||
    !option.selectedPossible
  ) {
    context.refuse();
    return false;
  }
  const saved = embryoBlessingValues(context, blessing, rarity, granted);
  const command: ProjectCommand = {
    kind: 'ReplaceTranscendentEmbryoEquipResult',
    result: result as typeof result & { readonly resultKind: 'transcendentEmbryo' },
    value: { blessingKey: blessing, blessingValues: saved.values },
  };
  if (!context.applyValid(command)) {
    context.refuse();
    return false;
  }
  noteRead(context, saved.read, 'embryo', result, command, roomIndex);
  return true;
}

/**
 * Jeweled Pom's Hades trait and Experimental Hammer's hammer are granted with
 * the keepsake: among the run's starting traits, or in the bracket of the room
 * whose rack or Echo equips it.
 */
function answerGrantedTrait(
  context: RunImportContext,
  result: Origin<'keepsakeEquipResult'>,
): boolean {
  const atStart = 'owner' in result.selection && result.selection.owner === 'routeStart';
  const roomIndex = atStart ? undefined : selectionRoom(context, result.selection);
  const acquired = atStart
    ? context.record.loadout.startingTraits
    : roomIndex === undefined
      ? undefined
      : context.record.rooms[roomIndex]!.traits.acquired;
  if (acquired === undefined) return false;
  const evaluation = context.candidates().evaluate({ kind: 'keepsakeEquipResult', result });
  if (evaluation.kind !== 'keepsakeEquipResult') return false;
  const options = evaluation.result.options.filter(
    (option) => option.resultKind === result.resultKind,
  );
  const traitOf = (option: (typeof options)[number]) =>
    'traitKey' in option.value ? option.value.traitKey : undefined;
  const offered = new Set(options.map(traitOf));
  const keepsakeAt = acquired.find(
    (trait) => context.catalog.keepsakes.byKey[trait.name] !== undefined,
  )?.worldTime;
  const granted = acquired.filter((trait) => offered.has(trait.name));
  const timed = granted.filter(
    (trait) => keepsakeAt !== undefined && trait.worldTime === keepsakeAt,
  );
  const traitKey = (timed.length === 1 ? timed : granted.length === 1 ? granted : [])[0]?.name;
  // A Hammer equipped with no eligible hammer left grants nothing.
  const option =
    traitKey === undefined
      ? options.find((candidate) => !('traitKey' in candidate.value) && candidate.selectedPossible)
      : options.find((candidate) => traitOf(candidate) === traitKey);
  if (option === undefined) return false;
  const command: ProjectCommand =
    result.resultKind === 'jeweledPom'
      ? {
          kind: 'ReplaceJeweledPomEquipResult',
          result: result as typeof result & { readonly resultKind: 'jeweledPom' },
          value: { traitKey: traitKey! },
        }
      : {
          kind: 'ReplaceExperimentalHammerEquipResult',
          result: result as typeof result & { readonly resultKind: 'experimentalHammer' },
          value: option.value as AuthoredExperimentalHammerEquipResult,
        };
  if (!option.selectedPossible || !context.applyValid(command)) {
    context.refuse();
    return false;
  }
  return true;
}

/**
 * The Embryo's nth transformation is the nth later room that loses one Chaos
 * blessing and gains another outside a Chaos screen.
 */
function answerEmbryoTransformation(
  context: RunImportContext,
  outcome: Origin<'transcendentEmbryoOutcome'>,
): boolean {
  const start = selectionRoom(context, outcome.selection);
  if (start === undefined) return false;
  const swaps = context.record.rooms.flatMap((room, index) => {
    if (index <= start || room.traitScreens.some((screen) => screen.giver === 'TrialUpgrade'))
      return [];
    const gained = room.traits.acquired.filter((trait) => isBlessing(context, trait.name));
    const lost = room.traits.removed.filter((name) => isBlessing(context, name));
    return gained.length === 1 && lost.length === 1
      ? [{ index, blessing: gained[0]!.name, acquisition: gained[0]! }]
      : [];
  });
  const swap = swaps[outcome.cycle - 1];
  if (swap === undefined) return false;
  const evaluation = context
    .candidates()
    .evaluate({ kind: 'transcendentEmbryoOutcome', outcome, value: undefined });
  if (
    evaluation.kind !== 'transcendentEmbryoOutcome' ||
    !evaluation.result.eligibleBlessingKeys.includes(swap.blessing)
  ) {
    context.refuse();
    return false;
  }
  const saved = embryoBlessingValues(
    context,
    swap.blessing,
    evaluation.result.rarity,
    swap.acquisition,
  );
  const command: ProjectCommand = {
    kind: 'ReplaceTranscendentEmbryoTransformation',
    outcome,
    value: { blessingKey: swap.blessing, blessingValues: saved.values },
  };
  if (!context.applyValid(command)) {
    context.refuse();
    return false;
  }
  noteRead(context, saved.read, 'embryo', outcome, command, swap.index);
  return true;
}

/**
 * A Chaos screen as its complete pair offer. The picked curse is the one its
 * room gained; under Vow of Denial the unpicked buttons' curses are the names
 * the room banned. The picked curse's duration is its saved remaining uses and
 * the pair's rolled values its saved fields; unpicked durations are not saved.
 */
export function chaosOffer(
  context: RunImportContext,
  screen: RunRecordTraitScreen,
  roomIndex: number,
  attempt: number,
):
  | {
      readonly value: AuthoredChaosTraitOffer;
      readonly assumedOptions: number;
      readonly read: SavedChaosValues['read'];
    }
  | undefined {
  const room = context.record.rooms[roomIndex]!;
  const curses = context.catalog.chaos.curses;
  const selected = screen.options.findIndex((option) => option.chosen);
  const chosen = screen.options[selected];
  const blessing =
    chosen === undefined ? undefined : context.catalog.chaos.blessings.byKey[chosen.name];
  const picked = room.traits.acquired.filter((trait) => curses.byKey[trait.name] !== undefined);
  if (selected < 0 || selected > 2 || blessing === undefined || picked.length !== 1)
    return undefined;
  const curse = curses.byKey[picked[0]!.name]!;
  // Denial bans the unpicked buttons' curses in button order, up to its ban count.
  const denial = context.catalog.fearVows.byKey['BanUnpickedBoonsShrineUpgrade'];
  const numBans =
    denial?.effect?.kind === 'banUnselectedTraits' &&
    (context.record.loadout.vows[denial.key] ?? 0) > 0
      ? denial.effect.count
      : 0;
  const banned = (room.bannedTraits ?? [])
    .filter((name) => curses.byKey[name] !== undefined && name !== curse.key)
    .slice(0, numBans);
  const unbanned = curses.values
    .map((entry) => entry.key)
    .filter((key) => key !== curse.key && !banned.includes(key));
  // One banned curse belongs to the first unpicked button; several are not saved by button.
  let assumedOptions = banned.length > 1 ? 1 : 0;
  let fallback = attempt;
  const curseOptions = OPTION_KEYS.map((_key, index) => {
    const key =
      index === selected
        ? curse.key
        : (banned.shift() ??
          (assumedOptions++, unbanned[fallback++ % Math.max(1, unbanned.length)]!));
    const duration = curses.byKey[key]!.duration;
    // The picked curse's saved remaining uses are its rolled duration.
    const saved = index === selected ? picked[0]!.remainingUses : undefined;
    return {
      curseKey: key,
      requirementCount:
        saved !== undefined && saved >= duration.minimum && saved <= duration.maximum
          ? saved
          : duration.authoringDefault,
    };
  }) as unknown as AuthoredChaosTraitOffer['curseOptions'];
  const rarity =
    blessing.fixedRarity === 'Legendary'
      ? 'Legendary'
      : curse.semanticTag === 'Barren'
        ? 'Heroic'
        : chosen!.rarity === 'Rare' || chosen!.rarity === 'Epic'
          ? chosen!.rarity
          : 'Common';
  const curseValues = savedChaosValues(curse.operands, undefined, picked[0]);
  const blessingValues = savedChaosValues(
    blessing.operands,
    rarity,
    picked[0],
    context.catalog.chaos.pendingBlessingSavePath,
  );
  const reads = [curseValues.read, blessingValues.read];
  return {
    value: {
      kind: 'chaos',
      giverKey: 'Chaos',
      curseOptions,
      selectedOptionKey: OPTION_KEYS[selected]!,
      selectedCurseValues: curseValues.values,
      blessingKey: blessing.key,
      rarity,
      blessingValues: blessingValues.values,
    },
    assumedOptions,
    read: reads.includes('refused')
      ? 'refused'
      : reads.includes('notInRecord')
        ? 'notInRecord'
        : 'exact',
  };
}

/** Keepsake racks and fountains: optional room actions authored once their room is entered. */
export function importFeatures(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? []) {
      if (!context.pending(occurrence.occurrenceId)) continue;
      const roomIndex = context.occurrences.visitsOf(occurrence.occurrenceId)[0];
      if (roomIndex === undefined) continue;
      importRack(context, biome.biomeKey, occurrence, roomIndex);
      importFountain(context, biome.biomeKey, occurrence, roomIndex);
      importTraitPickups(context, biome.biomeKey, occurrence, roomIndex);
      importSeaStar(context, biome.biomeKey, occurrence, roomIndex);
    }
}

/**
 * Sea Star duplicates counted in a room (`PoseidonDoubleRewardCount`). Which
 * pickups were duplicated is not saved: the room's own reward takes the first,
 * an assumption; any further duplicate is not placed.
 */
function importSeaStar(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
  roomIndex: number,
): void {
  const count = context.record.rooms[roomIndex]!.doubleRewards ?? 0;
  const used = `seaStar:${roomIndex}`;
  if (count === 0 || context.used.has(used)) return;
  const reward = 'reward' in occurrence.state ? occurrence.state.reward : undefined;
  // An unauthored reward is answered later; the duplicate waits for it.
  if (reward === null) return;
  context.used.add(used);
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  const owner = createIncomingRewardAddress(biome, occurrence.occurrenceId);
  let placed = 0;
  for (const role of Object.keys(reward?.dispositionByAcquisitionRole ?? {})) {
    const command: ProjectCommand = {
      kind: 'ReplaceSeaStarResult',
      acquisition: createAcquisitionRoleAddress(owner, role),
      procced: true,
    };
    if (!context.applyValid(command)) continue;
    placed = 1;
    context.note({
      area: 'reward',
      reason: 'assumption',
      address: command.acquisition,
      applied: command,
      record: record(roomIndex),
    });
    context.retractable(
      [command.acquisition],
      { ...command, procced: false },
      {
        area: 'reward',
        reason: 'refused',
        address: command.acquisition,
        record: record(roomIndex),
      },
    );
    break;
  }
  for (let index = placed; index < count; index += 1)
    context.note({
      area: 'reward',
      reason: 'notInRecord',
      address: owner,
      record: record(roomIndex),
    });
}

/**
 * Collects the optional pickups a selected trait drops (Narcissus's gifts), as
 * many of each reward type as the room's uses record picked up.
 */
function importTraitPickups(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
  roomIndex: number,
): void {
  const project = context.assembly().project;
  const host = roomActionDomainForOccurrence(
    project,
    context.catalog,
    createBiomeAddress(project.route.routeKey, biomeKey),
    occurrence.occurrenceId,
  );
  if (host === undefined) return;
  const room = context.record.rooms[roomIndex]!;
  for (const contribution of host.domain.contributions) {
    if (
      contribution.kind !== 'action' ||
      contribution.participation !== 'optional' ||
      contribution.reference.kind !== 'interactAcquisitionEntry' ||
      !contribution.reference.siteKey.startsWith('traitGenerated:')
    )
      continue;
    const reference = contribution.reference;
    const used = `traitPickup:${occurrence.occurrenceId}:${reference.siteKey}:${reference.entryKey}`;
    if (context.used.has(used)) continue;
    const rewardType =
      occurrence.acquisitionSites?.[reference.siteKey]?.pickupEntries?.[reference.entryKey]?.offer
        ?.rewardType;
    if (rewardType === undefined) continue;
    context.used.add(used);
    const budget = `traitPickupUses:${occurrence.occurrenceId}:${rewardType}`;
    const spent = [...context.used].filter((key) => key.startsWith(`${budget}#`)).length;
    if (spent >= pickupUseCount(context.catalog, room, rewardType)) continue;
    context.used.add(`${budget}#${spent}`);
    if (!insertRoomAction(context, biomeKey, occurrence.occurrenceId, reference))
      context.note({
        area: 'reward',
        reason: 'refused',
        address: contribution.owner,
        record: record(roomIndex),
      });
  }
}

function importRack(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
  roomIndex: number,
): void {
  const used = `rack:${occurrence.occurrenceId}`;
  if (occurrence.keepsakeRack === undefined || context.used.has(used)) return;
  context.used.add(used);
  const room = context.record.rooms[roomIndex]!;
  const address = createOccurrenceAddress(
    createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
    occurrence.occurrenceId,
  );
  const selection = createPostbossKeepsakeSelectionAddress(address);
  if (room.keepsakeSwap !== undefined) {
    const command: ProjectCommand = {
      kind: 'ReplacePostbossKeepsake',
      selection,
      keepsakeKey: room.keepsakeSwap.to,
    };
    if (!context.applyValid(command))
      context.note({
        area: 'rack',
        reason: 'refused',
        address: selection,
        record: record(roomIndex),
      });
    return;
  }
  // A rack left untouched has no interaction.
  if (
    (room.uses['GiftRack'] ?? 0) === 0 &&
    !removeRoomAction(context, biomeKey, occurrence.occurrenceId, { kind: 'interactKeepsakeRack' })
  )
    context.note({
      area: 'rack',
      reason: 'refused',
      address: selection,
      record: record(roomIndex),
    });
}

function importFountain(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
  roomIndex: number,
): void {
  const used = `fountain:${occurrence.occurrenceId}`;
  if (context.used.has(used)) return;
  const project = context.assembly().project;
  const reference: RoomActionReference = { kind: 'useFountain' };
  const host = roomActionDomainForOccurrence(
    project,
    context.catalog,
    createBiomeAddress(project.route.routeKey, biomeKey),
    occurrence.occurrenceId,
  );
  const offered = host?.domain.contributions.some(
    (entry) => entry.kind === 'action' && entry.reference.kind === 'useFountain',
  );
  if (offered !== true) return;
  context.used.add(used);
  const room = context.record.rooms[roomIndex]!;
  const usedFountain = Object.keys(room.uses).some((name) => name.startsWith('HealthFountain'));
  const present = occurrence.roomActions.order.some((entry) => entry.kind === 'useFountain');
  if (usedFountain === present) return;
  const applied = usedFountain
    ? insertRoomAction(context, biomeKey, occurrence.occurrenceId, reference)
    : removeRoomAction(context, biomeKey, occurrence.occurrenceId, reference);
  if (!applied)
    context.note({
      area: 'fountain',
      reason: 'refused',
      address: createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, biomeKey),
        occurrence.occurrenceId,
      ),
      record: record(roomIndex),
    });
}

/**
 * Vow of Denial's bans the plan derives against the names the record banned;
 * each one only one side holds is reported where the record banned it.
 */
export function reportDenialBans(context: RunImportContext): void {
  const recorded = new Map<string, number>();
  context.record.rooms.forEach((room, index) => {
    for (const name of room.bannedTraits ?? []) recorded.set(name, index);
  });
  const evaluation = context.assembly().evaluation;
  const last = [...evaluation.route.biomes].reverse().find((biome) => 'rewards' in biome);
  const snapshots = last !== undefined && 'rewards' in last ? last.rewards.runStateSnapshots : [];
  const derived = new Set(snapshots[snapshots.length - 1]?.traits.bannedTraitKeys ?? []);
  for (const [name, roomIndex] of recorded)
    if (!derived.has(name))
      context.note({ area: 'traitOffer', reason: 'refused', record: record(roomIndex) });
  for (const name of derived)
    if (!recorded.has(name)) context.note({ area: 'traitOffer', reason: 'refused' });
}

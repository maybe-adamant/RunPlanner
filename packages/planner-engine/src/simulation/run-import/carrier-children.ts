import {
  discoverAuthoredTraitCarrierChildren,
  optionIndex,
  semanticAddressKey,
  updateAuthoredTraitCarrierChild,
  type AuthoredAllTogetherResult,
  type AuthoredCirceResolution,
  type AuthoredTraitCarrierChild,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type OneToEight,
  type SemanticAddress,
  type TraitOfferAddress,
  type TraitOptionKey,
} from '../../authored-project';
import { authoredTraitOfferAt } from '../../authored-project/commands/trait-offer';
import { traitMaxHealthRollWidth } from '../../authored-project/traits/max-health-roll';
import { concaveStoneProcGiver, type DirectTraitSetKey } from '../../catalog-schema';
import type { RunRecordRoom, RunRecordTraitAcquisition } from '../../run-record/model';
import type { TraitCarrierChildDomainEvaluation } from '../candidates/trait-offer/query';
import {
  completeCarrierChild,
  withoutCarrierChild,
  type DraftCarrierChildContext,
} from '../draft/carrier-children';
import type { SemanticFinding } from '../model';
import { entrySnapshot } from './conformance';
import type { RunImportContext } from './import';
import { occurrenceIdOf } from './occurrences';
import type { RunImportReason, RunImportReportEntry } from './report';

type Child<K extends AuthoredTraitCarrierChild['kind']> = Extract<
  AuthoredTraitCarrierChild,
  { readonly kind: K }
>;

/** One child the record may answer, with the room its screen was in. */
interface ChildQuestion<K extends AuthoredTraitCarrierChild['kind']> {
  readonly context: RunImportContext;
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOfferTraits;
  readonly child: Child<K>;
  readonly room: RunRecordRoom;
  readonly roomIndex: number;
  /** The room's acquisition of the child's own carrier trait. */
  readonly acquisition: RunRecordTraitAcquisition | undefined;
  /** When the room acquired the child's own carrier trait; undefined when the record holds no time. */
  readonly at: number | undefined;
  readonly domain: TraitCarrierChildDomainEvaluation;
  /** Whether the record's Concave Stone extra pick may answer the Stone. */
  readonly stoneFromRecord: boolean;
}

/**
 * The record's answer: the offer with the child written, `refused` when the
 * engine's domain rejects the recorded value, undefined when the record holds
 * none. An answer resting on a tie the record cannot break is `assumed`.
 */
type ChildAnswer =
  { readonly value: AuthoredTraitOfferTraits; readonly assumed?: boolean } | 'refused' | undefined;

/** A child the record did not answer exactly. */
export interface RecordedCarrierChildReport {
  readonly address: SemanticAddress;
  readonly reason: Extract<RunImportReason, 'notInRecord' | 'refused' | 'assumption'>;
}

export interface RecordedCarrierChildren {
  readonly value: AuthoredTraitOffer;
  readonly reports: readonly RecordedCarrierChildReport[];
}

/** Every child an offer can raise is at most a few nested picks deep. */
const MAX_CHILD_PICKS = 16;

const childKey = (child: AuthoredTraitCarrierChild) =>
  `${child.kind}:${semanticAddressKey(child.address)}`;

/** The option a child belongs to: its own row, or the selected row for the Stone and a Hex tree. */
const childOptionKey = (value: AuthoredTraitOfferTraits, child: AuthoredTraitCarrierChild) =>
  child.kind === 'concaveStone' ? value.selectedOptionKey : child.optionKey;

const acquisitionOf = (room: RunRecordRoom, traitKey: string | undefined) =>
  room.traits.acquired.find((trait) => trait.name === traitKey);

const acquiredAt = (room: RunRecordRoom, traitKey: string | undefined) =>
  acquisitionOf(room, traitKey)?.worldTime;

/**
 * Authors every selected-outcome child of a screen's offer from the record,
 * each from what the room acquired at its own carrier's acquisition time and
 * only where the engine's domain admits it. A child the record does not answer,
 * or whose recorded value the engine refuses, takes Draft's first eligible
 * value and is reported.
 */
export function completeRecordedCarrierChildren(
  context: RunImportContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOffer,
  roomIndex: number,
  stoneFromRecord = true,
): RecordedCarrierChildren {
  if (value.kind !== 'traits') return { value, reports: [] };
  const room = context.record.rooms[roomIndex]!;
  const evaluate: DraftCarrierChildContext['evaluate'] = (query) =>
    context.candidates().evaluate(query);
  const fallback: DraftCarrierChildContext = {
    catalog: context.catalog,
    evaluate,
    shuffle: (values) => [...values],
    allowsTrait: () => true,
    prefersTrait: () => false,
    supported: (offer) => {
      const evaluation = context.candidates().evaluate({ kind: 'traitOffer', trait, value: offer });
      return (
        evaluation.kind === 'traitOffer' &&
        evaluation.result.supported &&
        evaluation.result.findings.length === 0
      );
    },
  };
  let current = value;
  const settled = new Set<string>();
  const reports: RecordedCarrierChildReport[] = [];
  for (let pick = 0; pick < MAX_CHILD_PICKS; pick += 1) {
    const child = discoverAuthoredTraitCarrierChildren(context.catalog, trait, current).find(
      (candidate) =>
        !candidate.authoredComplete &&
        candidate.kind !== 'hexTree' &&
        !settled.has(childKey(candidate)),
    );
    if (child === undefined) break;
    const acquisition = acquisitionOf(
      room,
      current.options[optionIndex(childOptionKey(current, child))]?.traitKey,
    );
    const answer = recordedAnswer({
      context,
      trait,
      value: current,
      child,
      room,
      roomIndex,
      acquisition,
      at: acquisition?.worldTime,
      domain: evaluate({ kind: 'traitCarrierChildDomain', trait, value: current, child }),
      stoneFromRecord,
    });
    let next: AuthoredTraitOfferTraits | undefined;
    if (answer !== undefined && answer !== 'refused') {
      next = answer.value;
      if (answer.assumed === true) reports.push({ address: child.address, reason: 'assumption' });
    } else {
      next = completeCarrierChild(fallback, trait, current, child);
      if (answer === 'refused') reports.push({ address: child.address, reason: 'refused' });
      else if (next !== undefined && next !== current)
        reports.push({ address: child.address, reason: 'notInRecord' });
    }
    if (next === undefined || next === current) settled.add(childKey(child));
    else current = next;
  }
  return { value: current, reports };
}

function recordedAnswer(question: ChildQuestion<AuthoredTraitCarrierChild['kind']>): ChildAnswer {
  const child = question.child;
  switch (child.kind) {
    case 'traitAcquisitionTarget':
      return promotionTarget({ ...question, child });
    case 'echoPomTarget':
      return echoPomTarget({ ...question, child });
    case 'concaveStone':
      return concaveStone({ ...question, child });
    case 'latestModelTargets':
      return latestModelTargets({ ...question, child });
    case 'allTogetherSet':
      return allTogether({ ...question, child });
    case 'naturalSelectionResult':
      return naturalSelection({ ...question, child });
    case 'circeResolution':
      return circeResolution({ ...question, child });
    // Boon Boon Boon replays a previous run's boon, which the record does not hold.
    case 'echoLastRunBoon':
    case 'hexTree':
      return undefined;
  }
}

/**
 * A promoting pick's target: the trait the game saved as its `UpgradedTraitName`,
 * else, in an older record, the trait its room upgraded at the pick's own
 * acquisition time. A target already at Heroic shows no upgrade.
 */
function promotionTarget(question: ChildQuestion<'traitAcquisitionTarget'>): ChildAnswer {
  const { context, value, child, room, acquisition, at, domain } = question;
  if (
    domain.kind !== 'traitAcquisitionTargetDomain' ||
    context.catalog.traits.byKey[child.traitKey]?.targetedAcquisition?.kind !==
      'promoteGodTraitToHeroic'
  )
    return undefined;
  const recorded =
    acquisition?.upgradedTrait !== undefined
      ? [acquisition.upgradedTrait]
      : at === undefined
        ? []
        : [
            ...new Set(
              room.traits.upgraded
                .filter((upgrade) => upgrade.worldTime === at)
                .map((upgrade) => upgrade.name),
            ),
          ];
  if (recorded.length === 0) return undefined;
  const supported = recorded.filter((name) =>
    domain.result.candidates.some(
      (candidate) => candidate.result.supported && candidate.result.traitKey === name,
    ),
  );
  if (supported.length === 0) return 'refused';
  return {
    value: updateAuthoredTraitCarrierChild(value, {
      kind: 'traitAcquisitionTarget',
      child,
      targetTraitKey: supported[0]!,
    }),
    assumed: supported.length > 1,
  };
}

/**
 * Latest Model's Hammers: the Hammer traits its room upgraded at the pick's own
 * acquisition time (`UpgradeHammers` re-adds each at its new rarity), taken
 * row by row through the engine's domain.
 */
function latestModelTargets(question: ChildQuestion<'latestModelTargets'>): ChildAnswer {
  const { context, trait, value, child, room, at } = question;
  if (at === undefined) return undefined;
  const recorded = [
    ...new Set(
      room.traits.upgraded
        .filter((upgrade) => upgrade.worldTime === at)
        .map((upgrade) => upgrade.name),
    ),
  ];
  let current = value;
  for (let row = 0; row < 3; row += 1) {
    const domain = context
      .candidates()
      .evaluate({ kind: 'traitCarrierChildDomain', trait, value: current, child });
    if (domain.kind !== 'latestModelTargetsDomain') return undefined;
    const held: readonly string[] =
      current.options[optionIndex(child.optionKey)]?.icarusHammerTargets ?? [];
    if (held.length > 0 && held.length >= domain.result.requiredCount) return { value: current };
    const domainRow = domain.result.rows[held.length];
    if (domainRow === undefined) return undefined;
    const candidates = new Set(
      domain.result.candidates.map((candidate) => candidate.result.traitKey),
    );
    const remaining = recorded.filter((name) => candidates.has(name) && !held.includes(name));
    if (remaining.length === 0) return held.length === 0 ? undefined : 'refused';
    const supported = new Set(
      domain.result.candidates
        .filter((candidate) => candidate.result.supported)
        .map((candidate) => candidate.result.traitKey),
    );
    const traitKey = remaining.find(
      (name) => supported.has(name) && domainRow.availableTargetTraitKeys.includes(name),
    );
    const targets = traitKey === undefined ? undefined : domainRow.valueByTraitKey[traitKey];
    if (targets === undefined) return 'refused';
    current = updateAuthoredTraitCarrierChild(current, {
      kind: 'latestModelTargets',
      child,
      icarusHammerTargets: targets,
    });
  }
  return undefined;
}

/**
 * All Together's sets: each set's trait the room acquired at the pick's own
 * acquisition time (`GrantBoons` grants them together), else none.
 */
function allTogether(question: ChildQuestion<'allTogetherSet'>): ChildAnswer {
  const { context, trait, value, child, room, at } = question;
  const disposition = context.catalog.traits.byKey[child.traitKey]?.selectedDisposition;
  if (disposition?.kind !== 'directTraitSets' || at === undefined) return undefined;
  const granted = new Set(
    room.traits.acquired.filter((entry) => entry.worldTime === at).map((entry) => entry.name),
  );
  const sets = discoverAuthoredTraitCarrierChildren(context.catalog, trait, value).filter(
    (candidate): candidate is Child<'allTogetherSet'> =>
      candidate.kind === 'allTogetherSet' && candidate.optionKey === child.optionKey,
  );
  const result: Partial<Record<DirectTraitSetKey, string | null>> = {};
  for (const set of sets) {
    const members: readonly string[] =
      disposition.sets.find((entry) => entry.key === set.setKey)?.traitKeys ?? [];
    const recorded = members.filter((name) => granted.has(name));
    if (recorded.length > 1) return undefined;
    const answer = recorded[0] ?? null;
    const domain = context
      .candidates()
      .evaluate({ kind: 'traitCarrierChildDomain', trait, value, child: set });
    if (domain.kind !== 'allTogetherSetDomain') return undefined;
    if (
      !domain.result.candidates.some(
        (candidate) => candidate.value === answer && candidate.support !== 'impossible',
      )
    )
      return 'refused';
    result[set.setKey] = answer;
  }
  return {
    value: updateAuthoredTraitCarrierChild(value, {
      kind: 'allTogetherSet',
      child,
      allTogetherResult: Object.freeze(result) as AuthoredAllTogetherResult,
    }),
  };
}

/**
 * Natural Selection's sequence: `DistributeLevels` re-adds each target once
 * per level (`IncreaseTraitLevel`), so its room's upgrades at the pick's own
 * acquisition time give each target's level gain. The game's shuffled order is
 * never saved; any order the engine admits that reaches the same gains is the
 * same run state. Only the first round's order branches; the round robin
 * forces every later target, so the search is bounded by the cores' orders.
 */
function naturalSelection(question: ChildQuestion<'naturalSelectionResult'>): ChildAnswer {
  const { context, trait, value, child, room, at } = question;
  if (question.domain.kind !== 'naturalSelectionResult' || at === undefined) return undefined;
  const remaining = new Map<string, number>();
  for (const upgrade of room.traits.upgraded) {
    const gain = (upgrade.to.level ?? 1) - (upgrade.from.level ?? 1);
    if (upgrade.worldTime === at && gain > 0)
      remaining.set(upgrade.name, (remaining.get(upgrade.name) ?? 0) + gain);
  }
  if (remaining.size === 0) return undefined;
  const search = (
    current: AuthoredTraitOfferTraits,
    targets: readonly string[],
  ): AuthoredTraitOfferTraits | undefined => {
    const domain = context
      .candidates()
      .evaluate({ kind: 'traitCarrierChildDomain', trait, value: current, child });
    if (domain.kind !== 'naturalSelectionResult') return undefined;
    if (targets.length > 0 && domain.result.complete)
      return domain.result.supported && [...remaining.values()].every((left) => left === 0)
        ? current
        : undefined;
    if (targets.length >= child.slotCount) return undefined;
    for (const traitKey of domain.result.nextTargetTraitKeys) {
      const left = remaining.get(traitKey) ?? 0;
      if (left === 0) continue;
      const next = [...targets, traitKey];
      remaining.set(traitKey, left - 1);
      const found = search(
        updateAuthoredTraitCarrierChild(current, {
          kind: 'naturalSelectionResult',
          child,
          targets: Object.freeze(next) as unknown as OneToEight<string>,
        }),
        next,
      );
      remaining.set(traitKey, left);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const found = search(value, []);
  return found === undefined ? 'refused' : { value: found };
}

/**
 * Circe's Arcana. Red Citrine's cards are those its room granted whose traits
 * joined at the pick's own acquisition time (`AddRandomMetaUpgrades`), so a
 * boss room's Judgment and Crystal Figurine cards never answer it; Lapis's are
 * the cards whose traits its room re-added at a higher rarity then
 * (`CirceMetaUpgradeRarity`). Black Night's disabled vows are not saved.
 */
function circeResolution(question: ChildQuestion<'circeResolution'>): ChildAnswer {
  const { context, trait, value, child, room, at, domain } = question;
  if (domain.kind !== 'circeResolutionDomain' || at === undefined) return undefined;
  const { effect, requiredCount, branchAgreement } = domain.result;
  if (effect === 'disableFear' || !branchAgreement) return undefined;
  const cards = context.catalog.arcanaCards.values;
  const recorded =
    effect === 'activateArcana'
      ? (room.grantedArcana ?? []).filter((key) => {
          const traitKey = cards.find((card) => card.key === key)?.traitKey;
          return room.traits.acquired.some(
            (entry) => entry.name === traitKey && entry.worldTime === at,
          );
        })
      : [
          ...new Set(
            room.traits.upgraded
              .filter(
                (upgrade) => upgrade.worldTime === at && upgrade.to.rarity !== upgrade.from.rarity,
              )
              .flatMap((upgrade) =>
                cards.filter((card) => card.traitKey === upgrade.name).map((card) => card.key),
              ),
          ),
        ];
  if (recorded.length === 0 && requiredCount > 0) return undefined;
  if (recorded.length !== requiredCount) return 'refused';
  const written = updateAuthoredTraitCarrierChild(value, {
    kind: 'circeResolution',
    child,
    value: Object.freeze({
      kind: effect,
      arcanaKeys: Object.freeze(recorded),
    }) as AuthoredCirceResolution,
  });
  const assessed = context
    .candidates()
    .evaluate({ kind: 'traitCarrierChildDomain', trait, value: written, child });
  return assessed.kind === 'circeResolutionDomain' &&
    recorded.every((key) =>
      assessed.result.arcanaCandidates.some(
        (candidate) => candidate.value === key && candidate.support !== 'impossible',
      ),
    )
    ? { value: written }
    : 'refused';
}

/**
 * Echo's Pom doubles one boon's level at the pick's own acquisition time; a
 * room that doubled none had no target where the engine allows that.
 */
function echoPomTarget(question: ChildQuestion<'echoPomTarget'>): ChildAnswer {
  const { value, child, room, at, domain } = question;
  if (domain.kind !== 'echoPomTargetDomain') return undefined;
  const doubled = room.traits.upgraded.filter(
    (upgrade) =>
      (at === undefined || upgrade.worldTime === undefined || upgrade.worldTime === at) &&
      upgrade.from.level !== undefined &&
      upgrade.to.level === upgrade.from.level * 2,
  );
  if (doubled.length === 0)
    return question.acquisition !== undefined &&
      domain.result.candidates.some(
        (candidate) => candidate.value === null && candidate.support !== 'impossible',
      )
      ? {
          value: updateAuthoredTraitCarrierChild(value, {
            kind: 'echoPomTarget',
            child,
            value: null,
          }),
        }
      : undefined;
  if (doubled.length !== 1) return undefined;
  const target = doubled[0]!.name;
  return domain.result.candidates.some(
    (candidate) => candidate.value === target && candidate.support !== 'impossible',
  )
    ? {
        value: updateAuthoredTraitCarrierChild(value, {
          kind: 'echoPomTarget',
          child,
          value: target,
        }),
      }
    : 'refused';
}

/**
 * Concave Stone's extra pick: the game logs no screen for it (`LogUpgradeChoice`
 * is skipped under `DoubleBoonChance`), so it is one of the offer's unpicked
 * rows that no screen of the room chose, acquired after this pick and before
 * the room's next pick, while the Stone is held. No such row is no proc.
 */
function concaveStone(question: ChildQuestion<'concaveStone'>): ChildAnswer {
  const { context, value, child, room, roomIndex, at, domain } = question;
  if (domain.kind !== 'concaveStone') return undefined;
  const branches = domain.result.branches;
  const residuals = question.stoneFromRecord
    ? stoneResiduals(context, value, room, roomIndex, at)
    : [];
  if (residuals.length === 0)
    return branches.some((branch) => branch.required) ? undefined : { value };
  const admitted = residuals.filter(
    (optionKey) =>
      branches.length > 0 &&
      branches.every((branch) => branch.residualOptionKeys.includes(optionKey)),
  );
  if (admitted.length === 0) return 'refused';
  return {
    value: updateAuthoredTraitCarrierChild(value, {
      kind: 'concaveStone',
      child,
      value: Object.freeze({ kind: 'proc', optionKey: admitted[0]! }),
    }),
    assumed: residuals.length > 1,
  };
}

function stoneResiduals(
  context: RunImportContext,
  value: AuthoredTraitOfferTraits,
  room: RunRecordRoom,
  roomIndex: number,
  pickedAt: number | undefined,
): readonly TraitOptionKey[] {
  if (!concaveStoneProcGiver(context.catalog.traitGivers.byKey[value.giverKey])) return [];
  const stone = context.catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'concaveStone',
  )?.key;
  if (pickedAt === undefined || keepsakeHeldAt(context, roomIndex, pickedAt) !== stone) return [];
  const chosen = new Set(
    room.traitScreens.flatMap((entry) =>
      entry.options.filter((option) => option.chosen).map((option) => option.name),
    ),
  );
  const nextPick = Math.min(
    ...room.traitScreens
      .map((entry) => acquiredAt(room, entry.options.find((option) => option.chosen)?.name))
      .filter((time): time is number => time !== undefined && time > pickedAt),
  );
  const optionKeys = ['option1', 'option2', 'option3'] as const;
  return value.options.flatMap((option, index) => {
    const time = acquiredAt(room, option.traitKey);
    return optionKeys[index] !== value.selectedOptionKey &&
      !chosen.has(option.traitKey) &&
      time !== undefined &&
      time >= pickedAt &&
      time < nextPick
      ? [optionKeys[index]!]
      : [];
  });
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

/** The offer a child finding belongs to. */
function childTrait(finding: SemanticFinding): TraitOfferAddress | undefined {
  const origin = finding.origin;
  switch (origin.kind) {
    case 'traitAcquisitionTarget':
    case 'allTogetherSet':
    case 'naturalSelectionResult':
    case 'circeResolution':
    case 'echoPomTarget':
    case 'echoLastRunBoon':
      return origin.trait;
    case 'traitOffer':
      return finding.code.startsWith('concaveStoneResult') ? origin : undefined;
    default:
      return undefined;
  }
}

/**
 * Answers a carrier child an earlier change left missing or unavailable on an
 * offer already authored: the child is cleared and answered again from the
 * room whose screen the offer's pick came from.
 */
export function answerCarrierChild(context: RunImportContext, reason: SemanticFinding): boolean {
  const trait = childTrait(reason);
  if (trait === undefined) return false;
  const offer = authoredTraitOfferAt(context.assembly().project, context.catalog, trait);
  const occurrenceId = occurrenceIdOf(trait.owner);
  if (offer?.kind !== 'traits' || occurrenceId === undefined) return false;
  const picked = offer.options[optionIndex(offer.selectedOptionKey)]?.traitKey;
  const visits = context.occurrences.visitsOf(occurrenceId);
  const roomIndex =
    visits.find((index) => acquiredAt(context.record.rooms[index]!, picked) !== undefined) ??
    visits[0];
  if (roomIndex === undefined) return false;
  const cleared = withoutCarrierChild(
    context.catalog,
    trait,
    offer,
    semanticAddressKey(reason.origin),
  );
  const completed = completeRecordedCarrierChildren(context, trait, cleared, roomIndex);
  if (completed.value === offer) return false;
  const command = { kind: 'ReplaceTraitOffer', trait, value: completed.value } as const;
  if (!context.applyValid(command)) return false;
  const record = { roomIndex, visit: 0 };
  for (const entry of completed.reports)
    context.note({
      area: 'traitOffer',
      reason: entry.reason,
      address: entry.address,
      applied: command,
      record,
    });
  return true;
}

/** A picked max-health roll waiting for its room's next entry save. */
export interface MaxHealthRollQuestion {
  readonly trait: TraitOfferAddress;
  readonly optionKey: TraitOptionKey;
  readonly roomIndex: number;
}

/**
 * Registers the applied offer's acquired rows that roll max health (Worry
 * Free): the pick, and a Concave Stone extra pick. Their roll is answered once
 * the room's next entry save is reached.
 */
export function awaitMaxHealthRolls(
  context: RunImportContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOffer,
  roomIndex: number,
): void {
  if (value.kind !== 'traits') return;
  const acquired = [
    value.selectedOptionKey,
    ...(value.concaveStoneResult?.kind === 'proc' ? [value.concaveStoneResult.optionKey] : []),
  ];
  for (const optionKey of acquired) {
    const option = value.options[optionIndex(optionKey)];
    if (
      option === undefined ||
      traitMaxHealthRollWidth(context.catalog, option.traitKey) === undefined
    )
      continue;
    context.maxHealthRolls.set(`${semanticAddressKey(trait)} ${optionKey}`, {
      trait,
      optionKey,
      roomIndex,
    });
  }
}

/**
 * Answers each waiting max-health roll once the plan reaches its room's next
 * entry save: the roll is the save's max-health gain over the room less the
 * plan's gain with the roll at its minimum, kept only where the engine's plan
 * then holds the saved max health. A room with two rolls cannot split its gain.
 */
export function importMaxHealthRolls(context: RunImportContext): void {
  const { record, occurrences } = context;
  const byRoom = new Map<number, number>();
  for (const question of context.maxHealthRolls.values())
    byRoom.set(question.roomIndex, (byRoom.get(question.roomIndex) ?? 0) + 1);
  for (const [key, question] of [...context.maxHealthRolls]) {
    const { trait, optionKey, roomIndex } = question;
    const note = (reason: RunImportReason) => {
      context.maxHealthRolls.delete(key);
      context.note({ area: 'traitOffer', reason, address: trait, record: { roomIndex, visit: 0 } });
    };
    const before = record.rooms[roomIndex]?.entry?.maxHealth;
    const after = record.rooms[roomIndex + 1]?.entry?.maxHealth;
    // The last room has no next entry save, and an older record keeps no max health.
    if (before === undefined || after === undefined || byRoom.get(roomIndex)! > 1) {
      note('notInRecord');
      continue;
    }
    const assembly = context.assembly();
    const exit = entrySnapshot(assembly, occurrences, roomIndex + 1)?.maxStats.maxHealth;
    if (exit === undefined) continue;
    const entry = entrySnapshot(assembly, occurrences, roomIndex)?.maxStats.maxHealth;
    const offer = authoredTraitOfferAt(assembly.project, context.catalog, trait);
    const option = offer?.kind === 'traits' ? offer.options[optionIndex(optionKey)] : undefined;
    const width =
      option === undefined ? undefined : traitMaxHealthRollWidth(context.catalog, option.traitKey);
    if (
      entry === undefined ||
      offer?.kind !== 'traits' ||
      option === undefined ||
      width === undefined
    ) {
      note('notInRecord');
      continue;
    }
    context.maxHealthRolls.delete(key);
    const current = option.maxHealthRoll ?? 0;
    const roll = after - before - (exit - entry) + current;
    if (roll === current) continue;
    if (!Number.isInteger(roll) || roll < 0 || roll > width) {
      note('refused');
      continue;
    }
    const command = {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        ...offer,
        options: offer.options.map((row, index) =>
          index === optionIndex(optionKey) ? { ...row, maxHealthRoll: roll } : row,
        ) as unknown as typeof offer.options,
      },
    } as const;
    const applied = context.transaction(
      () =>
        context.apply(command) &&
        entrySnapshot(context.assembly(), occurrences, roomIndex + 1)?.maxStats.maxHealth === after,
    );
    if (!applied) note('refused');
  }
}

/** Max-health rolls whose room's next entry save the walk never reached, at their default. */
export function unansweredMaxHealthRolls(
  context: RunImportContext,
): readonly RunImportReportEntry[] {
  return [...context.maxHealthRolls.values()].map(({ trait, roomIndex }) => ({
    area: 'traitOffer',
    reason: 'notInRecord',
    address: trait,
    record: { roomIndex, visit: 0 },
  }));
}

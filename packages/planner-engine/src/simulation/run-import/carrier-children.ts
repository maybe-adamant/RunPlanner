import {
  discoverAuthoredTraitCarrierChildren,
  optionIndex,
  semanticAddressKey,
  updateAuthoredTraitCarrierChild,
  type AuthoredTraitCarrierChild,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type SemanticAddress,
  type TraitOfferAddress,
  type TraitOptionKey,
} from '../../authored-project';
import { authoredTraitOfferAt } from '../../authored-project/commands/trait-offer';
import { concaveStoneProcGiver } from '../../catalog-schema';
import type { RunRecordRoom } from '../../run-record/model';
import type { TraitCarrierChildDomainEvaluation } from '../candidates/trait-offer/query';
import {
  completeCarrierChild,
  withoutCarrierChild,
  type DraftCarrierChildContext,
} from '../draft/carrier-children';
import type { SemanticFinding } from '../model';
import type { RunImportContext } from './import';
import { occurrenceIdOf } from './occurrences';
import type { RunImportReason } from './report';

type Child<K extends AuthoredTraitCarrierChild['kind']> = Extract<
  AuthoredTraitCarrierChild,
  { readonly kind: K }
>;

/** One child the record may answer, with the room its screen was in. */
interface ChildQuestion<K extends AuthoredTraitCarrierChild['kind']> {
  readonly context: RunImportContext;
  readonly value: AuthoredTraitOfferTraits;
  readonly child: Child<K>;
  readonly room: RunRecordRoom;
  readonly roomIndex: number;
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

const acquiredAt = (room: RunRecordRoom, traitKey: string | undefined) =>
  room.traits.acquired.find((trait) => trait.name === traitKey)?.worldTime;

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
    const carrier = current.options[optionIndex(childOptionKey(current, child))]?.traitKey;
    const answer = recordedAnswer({
      context,
      value: current,
      child,
      room,
      roomIndex,
      at: acquiredAt(room, carrier),
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
    case 'allTogetherSet':
    case 'naturalSelectionResult':
    case 'circeResolution':
    case 'echoLastRunBoon':
    case 'hexTree':
      return undefined;
  }
}

/** A promoting pick's target is the trait its room upgraded at the pick's own acquisition time. */
function promotionTarget(question: ChildQuestion<'traitAcquisitionTarget'>): ChildAnswer {
  const { context, value, child, room, at, domain } = question;
  if (
    domain.kind !== 'traitAcquisitionTargetDomain' ||
    context.catalog.traits.byKey[child.traitKey]?.targetedAcquisition?.kind !==
      'promoteGodTraitToHeroic' ||
    at === undefined
  )
    return undefined;
  const recorded = [
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

/** Echo's Pom doubles one boon's level at the pick's own acquisition time. */
function echoPomTarget(question: ChildQuestion<'echoPomTarget'>): ChildAnswer {
  const { value, child, room, at, domain } = question;
  if (domain.kind !== 'echoPomTargetDomain') return undefined;
  const doubled = room.traits.upgraded.filter(
    (upgrade) =>
      (at === undefined || upgrade.worldTime === undefined || upgrade.worldTime === at) &&
      upgrade.from.level !== undefined &&
      upgrade.to.level === upgrade.from.level * 2,
  );
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

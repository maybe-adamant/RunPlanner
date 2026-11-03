import { introducesNothing } from './acceptance';
import { orderRoomActions } from './action-order';
import { entrySnapshot } from './conformance';
import type { RunImportContext } from './import';

/*
 * One bounded search over a record room's open choices: each candidate is
 * authored on a probe of the plan, the room's own questions are answered from
 * the record and its actions take their stamped order, and the room is then
 * judged at its next entry save.
 */

/** Candidates one room search authors at most; a search that stops there is reported. */
export const ROOM_SEARCH_LIMIT = 32;

export interface RoomSearchSpec<Candidate, Choice> {
  readonly roomIndex: number;
  /** The candidates in canonical order: declared or native order first. */
  readonly candidates: Iterable<Candidate>;
  /** Authors one candidate; its choice, or undefined when the engine refuses any part of it. */
  readonly author: (candidate: Candidate) => Choice | undefined;
  /** Whether the authored room reproduces the facts the record pins exactly, such as its stores. */
  readonly fits?: () => boolean;
  /** The room's exit state a later room reads; fits sharing it are interchangeable. */
  readonly fingerprint?: () => string;
  /**
   * Rooms the candidate creates whose questions, too, are answered until the
   * next entry is reached; `all` answers any room's.
   */
  readonly settles?: readonly string[] | 'all';
  /** Also authors the optional record facts the walk sweeps, until the room settles. */
  readonly sweep?: boolean;
  readonly limit?: number;
}

export interface RoomFit<Choice> {
  readonly choice: Choice;
  /** The room introduces no difference at its next entry save. */
  readonly accepted: boolean;
  readonly fingerprint: string;
}

export interface RoomSearch<Choice> {
  /** Every fit in canonical order. */
  readonly fits: readonly RoomFit<Choice>[];
  /** Candidates authored. */
  readonly tried: number;
  /** The search stopped at its limit with candidates left. */
  readonly capped: boolean;
}

/** Authors each candidate of a room on a probe and keeps those that fit, judged at the next entry save. */
export function searchRoom<Candidate, Choice>(
  context: RunImportContext,
  spec: RoomSearchSpec<Candidate, Choice>,
): RoomSearch<Choice> {
  const limit = spec.limit ?? ROOM_SEARCH_LIMIT;
  const biomeKey = context.occurrences.biomeOfRoom[spec.roomIndex]!;
  const occurrenceId = context.occurrences.occurrenceOf(spec.roomIndex);
  const settles = spec.settles === 'all' ? undefined : new Set(spec.settles);
  const fits: RoomFit<Choice>[] = [];
  let tried = 0;
  for (const candidate of spec.candidates) {
    if (tried >= limit) return { fits, tried, capped: true };
    tried += 1;
    const fit = context.probe((): RoomFit<Choice> | undefined => {
      let choice: Choice | undefined;
      const placed = context.transaction(() => {
        choice = spec.author(candidate);
        return choice !== undefined;
      });
      if (!placed || choice === undefined) return undefined;
      const settle = () =>
        context.settleQuestions(
          (id) =>
            id === occurrenceId ||
            ((settles === undefined || settles.has(id)) &&
              entrySnapshot(context.assembly(), context.occurrences, spec.roomIndex + 1) ===
                undefined),
        );
      settle();
      for (let before; spec.sweep === true && before !== context.assembly();) {
        before = context.assembly();
        context.sweep();
        settle();
      }
      orderRoomActions(context, biomeKey, occurrenceId);
      if (spec.fits !== undefined && !spec.fits()) return undefined;
      return {
        choice,
        accepted: introducesNothing(context.acceptance(spec.roomIndex)),
        fingerprint: spec.fingerprint?.() ?? '',
      };
    });
    if (fit !== undefined) fits.push(fit);
  }
  return { fits, tried, capped: false };
}

/**
 * The fit to author: the first accepted one in canonical order, or without
 * one the first fit; and the first fit of each other exit state among those
 * equally good, which the record cannot tell apart from it. Undefined without a fit.
 */
export function chooseRoomFit<Choice>(
  fits: readonly RoomFit<Choice>[],
):
  | { readonly chosen: RoomFit<Choice>; readonly equivalents: readonly RoomFit<Choice>[] }
  | undefined {
  const accepted = fits.filter((fit) => fit.accepted);
  const pool = accepted.length > 0 ? accepted : fits;
  const chosen = pool[0];
  if (chosen === undefined) return undefined;
  return {
    chosen,
    equivalents: pool.filter(
      (fit, index) =>
        fit.fingerprint !== chosen.fingerprint &&
        pool.findIndex((first) => first.fingerprint === fit.fingerprint) === index,
    ),
  };
}

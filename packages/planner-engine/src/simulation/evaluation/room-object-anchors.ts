import {
  createBiomeAddress,
  createOccurrenceAddress,
  type OccurrenceAddress,
  type RoomAnchorObjectKind,
} from '../../authored-project/addresses';
import { challengeSwitchHost } from '../../authored-project/acquisition/challenge-switch';
import type { ProjectCommand } from '../../authored-project/commands/types';
import { routePurgingPool, routeRoomShop } from '../../authored-project/route-profile';
import { roomObjectAnchorIds } from '../../authored-project/room-layout';
import type { Catalog, ChallengeSwitchKind } from '../../catalog-schema';
import {
  challengeSwitchKindVariant,
  type ChallengeSwitchPlacementIssue,
} from '../commerce/challenge-switch';
import type { HermesShrineCandidateCapability } from '../commerce/hermes-shrine';
import type { HermesShrinePlacementRefusal } from '../commerce/hermes-shrine';
import type { ChallengeSwitchInteraction } from '../commerce/object-interactions';
import type { PurgingPoolCandidateCapability } from '../commerce/purging-pool';
import type {
  StygianWellCandidateCapability,
  StygianWellPlacementRefusal,
} from '../commerce/stygian-well';
import type { ProjectEvaluationAssembly } from './evaluation-products';
import {
  hermesShrineCandidateForProjectEvaluationAssembly,
  purgingPoolCandidateForProjectEvaluationAssembly,
  roomObjectInteractionsForProjectEvaluationAssembly,
  stygianWellCandidateForProjectEvaluationAssembly,
} from './project-evaluation-assembly';

type CommandOf<Kind extends ProjectCommand['kind']> = Extract<
  ProjectCommand,
  { readonly kind: Kind }
>;

export type { RoomAnchorObjectKind } from '../../authored-project/addresses';

/**
 * Native spawn order: each eligible object in turn takes a random free anchor
 * (some Postboss rooms pin the Well's), so order decides capacity, not position.
 */
export const ROOM_ANCHOR_OBJECT_ORDER = Object.freeze([
  'stygianWell',
  'purgingPool',
  'hermesShrine',
  'challengeSwitch',
] as const satisfies readonly RoomAnchorObjectKind[]);

/** No anchor is left for the object once the present objects before it took theirs. */
export interface RoomAnchorFullRefusal {
  readonly reason: 'noFreeAnchor';
  readonly anchorCount: number;
  /** The present objects holding the anchors, in native order. */
  readonly occupants: readonly RoomAnchorObjectKind[];
}

interface RoomAnchorObjectFacts<
  Kind extends RoomAnchorObjectKind,
  Refusal,
  Candidate,
  Place,
  Remove,
> {
  readonly kind: Kind;
  /** Native can spawn it in this room on this route; only a hosted object holds an anchor. */
  readonly hosted: boolean;
  /** Authored in this room. */
  readonly present: boolean;
  /** Present on entry whatever is authored; no command adds or removes it. */
  readonly fixed: boolean;
  /** The object's place in native spawn order among the room's anchors; absent past them. Not a physical anchor. */
  readonly slotIndex?: number;
  /**
   * Why native could not spawn it here, the anchors included; empty when it
   * can. Undefined while its entry assessment is unreached, and for a Pool
   * the route does not host.
   */
  readonly refusals?: readonly (Refusal | RoomAnchorFullRefusal)[];
  /** Adds the absent object on a free anchor; present only when `refusals` is empty. */
  readonly place?: Place;
  /** Removes the present, unfixed object. */
  readonly remove?: Remove;
  /** The object's existing entry-frontier product; undefined while unreached. */
  readonly candidate?: Candidate;
  /** The physical anchor it is authored on; absent leaves native placement. */
  readonly anchorId?: number;
  /**
   * The one anchor native can give this unauthored object: every other
   * present object stands somewhere and a single anchor is left free.
   */
  readonly derivedAnchorId?: number;
  /**
   * For a present object: each anchor it can be placed on (null returns it to
   * native placement), with the command. A pinned Well and an object with a
   * derived anchor have none.
   */
  readonly anchorChoices?: readonly {
    readonly anchorId: number | null;
    readonly command: CommandOf<'ReplaceRoomObjectAnchor'>;
  }[];
}

export type RoomAnchorObject =
  | RoomAnchorObjectFacts<
      'stygianWell',
      Exclude<StygianWellPlacementRefusal, { readonly reason: 'noAnchor' }>,
      StygianWellCandidateCapability,
      CommandOf<'AddStygianWell'>,
      CommandOf<'RemoveStygianWell'>
    >
  | RoomAnchorObjectFacts<'purgingPool', never, PurgingPoolCandidateCapability, never, never>
  | RoomAnchorObjectFacts<
      'hermesShrine',
      Exclude<HermesShrinePlacementRefusal, { readonly reason: 'noAnchor' }>,
      HermesShrineCandidateCapability,
      CommandOf<'SetHermesShrinePresence'>,
      CommandOf<'SetHermesShrinePresence'>
    >
  | (RoomAnchorObjectFacts<
      'challengeSwitch',
      Exclude<ChallengeSwitchPlacementIssue, { readonly reason: 'noFreeAnchor' }>,
      ChallengeSwitchInteraction,
      CommandOf<'ReplaceChallengeSwitch'>,
      CommandOf<'ReplaceChallengeSwitch'>
    > & {
      /**
       * Each kind, anchors aside: the command observing its default variant
       * when rollable, else its first rollable one; when none is, the rule
       * that locks it (a shared rule, else its first variant's gate). `place`
       * is the first observable kind's. Empty while unreached.
       */
      readonly kinds: readonly {
        readonly switchKind: ChallengeSwitchInteraction['kinds'][number]['switchKind'];
        readonly observe?: CommandOf<'ReplaceChallengeSwitch'>;
        readonly lock?: Exclude<ChallengeSwitchPlacementIssue, { readonly reason: 'noFreeAnchor' }>;
      }[];
    });

/** One choice for a slot: the object it ends up holding, with the commands, in order, that make it so. */
export interface RoomAnchorSlotChoice {
  /** Null clears the slot. */
  readonly kind: RoomAnchorObjectKind | null;
  /** The switch type a `challengeSwitch` choice observes; one choice per observable type. */
  readonly switchKind?: ChallengeSwitchKind;
  /** The anchor the chosen object holds after the edit, by native order. */
  readonly slotIndex?: number;
  /** Empty for the slot's current state; a replacement removes the occupant first. */
  readonly commands: readonly ProjectCommand[];
}

export interface RoomAnchorSlot {
  readonly index: number;
  readonly occupant?: RoomAnchorObjectKind;
  /** The occupant is fixed: the slot offers only its current state. */
  readonly fixed: boolean;
  /**
   * The current state first, then each other state reachable now. An added
   * object takes its native-order anchor, which can renumber the others.
   */
  readonly choices: readonly RoomAnchorSlotChoice[];
}

/**
 * A room's `ChallengeSwitchBase` anchors and the objects native spawns on
 * them: every object this room can hold on its route or holds as authored,
 * in native order, and each anchor slot with its occupant and the choices
 * open to it.
 */
export interface RoomAnchorSlots {
  readonly anchorCount: number;
  /**
   * The room's physical anchors by id, each with the present object authored
   * on it, the Well on its pin or the object derived onto it; the Well pin
   * takes only the Well.
   */
  readonly anchors: readonly {
    readonly anchorId: number;
    readonly pinned: boolean;
    readonly occupant?: RoomAnchorObjectKind;
    /** The occupant is the object's `derivedAnchorId`, not authored. */
    readonly derived?: true;
  }[];
  readonly objects: readonly RoomAnchorObject[];
  readonly slots: readonly RoomAnchorSlot[];
  /**
   * Present objects without an anchor, unhosted or past the anchors native
   * order fills; each carries its existing finding.
   */
  readonly unanchored: readonly RoomAnchorObjectKind[];
}

/** What an object can do here before anchor capacity is applied. */
interface OwnPlacement {
  readonly refusals?: readonly unknown[];
  readonly place?: ProjectCommand;
}

/**
 * The anchor slots of one room occurrence, read from its reached entry
 * products and authored presence; undefined for an unknown occurrence.
 */
export function roomObjectAnchorSlotsForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): RoomAnchorSlots | undefined {
  const project = assembly.project;
  if (occurrence.routeKey !== project.route.routeKey) return undefined;
  const authored = project.route.biomes
    .find((plan) => plan.biomeKey === occurrence.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrence.occurrenceId);
  if (authored === undefined) return undefined;
  const origin = createOccurrenceAddress(
    createBiomeAddress(occurrence.routeKey, occurrence.biomeKey),
    occurrence.occurrenceId,
  );
  const room = catalog.rooms.byKey[authored.gameName];
  const anchorCount = room?.challengeSwitchAnchorCount ?? 0;
  const roomShop = routeRoomShop(room, origin.routeKey);
  const surfaceShop = room?.surfaceShop;

  type Draft = {
    readonly kind: RoomAnchorObjectKind;
    readonly hosted: boolean;
    readonly present: boolean;
    readonly fixed: boolean;
    readonly own: OwnPlacement;
    readonly remove?: ProjectCommand;
    readonly candidate?: unknown;
    readonly extra?: Record<string, unknown>;
  };
  const drafts: Draft[] = [];

  const wellHosted = roomShop !== undefined && (roomShop.forced || roomShop.spawnChance > 0);
  if (wellHosted || authored.stygianWell !== undefined) {
    const candidate = stygianWellCandidateForProjectEvaluationAssembly(assembly, origin);
    const present = authored.stygianWell !== undefined;
    drafts.push({
      kind: 'stygianWell',
      hosted: wellHosted,
      present,
      fixed: wellHosted && roomShop.forced,
      own:
        candidate === undefined
          ? {}
          : {
              refusals: candidate.placementRefusals.filter(
                (refusal) => refusal.reason !== 'noAnchor',
              ),
              place: Object.freeze({ kind: 'AddStygianWell' as const, occurrence: origin }),
            },
      ...(present
        ? { remove: Object.freeze({ kind: 'RemoveStygianWell' as const, occurrence: origin }) }
        : {}),
      candidate,
    });
  }
  const poolHosted = routePurgingPool(room, origin.routeKey) !== undefined;
  // No command removes a retained Pool; clearing its use settles its finding.
  if (poolHosted || authored.purgingPool !== undefined)
    drafts.push({
      kind: 'purgingPool',
      hosted: poolHosted,
      present: authored.purgingPool !== undefined,
      fixed: poolHosted,
      own: {},
      candidate: purgingPoolCandidateForProjectEvaluationAssembly(assembly, origin),
    });
  const shrineHosted =
    surfaceShop !== undefined && (surfaceShop.forced || surfaceShop.spawnChance > 0);
  if (shrineHosted || authored.hermesShrine !== undefined) {
    const candidate = hermesShrineCandidateForProjectEvaluationAssembly(assembly, origin);
    const present = authored.hermesShrine !== undefined;
    const presence = (value: boolean) =>
      Object.freeze({
        kind: 'SetHermesShrinePresence' as const,
        occurrence: origin,
        present: value,
      });
    drafts.push({
      kind: 'hermesShrine',
      hosted: shrineHosted,
      present,
      fixed: shrineHosted && surfaceShop.forced,
      own:
        candidate === undefined
          ? {}
          : {
              refusals: candidate.placementRefusals.filter(
                (refusal) => refusal.reason !== 'noAnchor',
              ),
              place: presence(true),
            },
      ...(present ? { remove: presence(false) } : {}),
      candidate,
    });
  }
  const switchHosted =
    room !== undefined && challengeSwitchHost(catalog, room.gameName) !== undefined;
  type SwitchKindRow = Extract<
    RoomAnchorObject,
    { readonly kind: 'challengeSwitch' }
  >['kinds'][number];
  let switchKinds: readonly SwitchKindRow[] = [];
  if (switchHosted || authored.challengeSwitch !== undefined) {
    const candidate = roomObjectInteractionsForProjectEvaluationAssembly(
      assembly,
      origin,
    )?.challengeSwitch;
    const present = authored.challengeSwitch !== undefined;
    const sharedIssues = (candidate?.sharedIssues ?? []).filter(
      (issue) => issue.reason !== 'noFreeAnchor',
    );
    const kinds = Object.freeze(
      candidate === undefined
        ? []
        : catalog.challengeSwitches.kinds.values.map((kind): SwitchKindRow => {
            const chosen =
              sharedIssues.length > 0
                ? undefined
                : challengeSwitchKindVariant(
                    kind,
                    candidate.variants,
                    (variant) => variant.lock === undefined,
                  );
            const lock =
              chosen === undefined
                ? (sharedIssues[0] ??
                  candidate.variants.find((variant) => variant.switchKind === kind.key)?.issue)
                : undefined;
            return Object.freeze({
              switchKind: kind.key,
              ...(chosen === undefined ? {} : { observe: chosen.command }),
              ...(lock === undefined ? {} : { lock }),
            });
          }),
    );
    switchKinds = kinds;
    const observable = kinds.find((kind) => kind.observe !== undefined)?.observe;
    // With no shared rule broken and no kind observable, each kind's own gate is the refusal.
    const kindLocks = [
      ...new Map(
        candidate === undefined || sharedIssues.length > 0 || observable !== undefined
          ? []
          : candidate.variants.flatMap((variant) =>
              variant.issue === undefined ? [] : [[JSON.stringify(variant.issue), variant.issue]],
            ),
      ).values(),
    ];
    drafts.push({
      kind: 'challengeSwitch',
      hosted: switchHosted,
      present,
      fixed: false,
      own:
        candidate === undefined
          ? {}
          : {
              refusals: sharedIssues.length > 0 ? sharedIssues : kindLocks,
              ...(observable === undefined ? {} : { place: observable }),
            },
      ...(present
        ? {
            remove: Object.freeze({
              kind: 'ReplaceChallengeSwitch' as const,
              occurrence: origin,
              variantKey: null,
            }),
          }
        : {}),
      candidate,
      extra: { kinds },
    });
  }

  // Only hosted objects take anchors; an unhosted present one carries its host refusal.
  const holders = drafts
    .filter((draft) => draft.hosted && draft.present)
    .map((draft) => draft.kind);
  const full = (occupants: readonly RoomAnchorObjectKind[]): RoomAnchorFullRefusal =>
    Object.freeze({
      reason: 'noFreeAnchor',
      anchorCount,
      occupants: Object.freeze([...occupants]),
    });
  const objects = drafts.map((draft) => {
    const before = drafts
      .slice(0, drafts.indexOf(draft))
      .filter((earlier) => earlier.hosted && earlier.present)
      .map((earlier) => earlier.kind);
    const anchored = draft.hosted && draft.present && before.length < anchorCount;
    // A present object holds the anchor after its earlier peers; an absent one needs a spare.
    const anchorRefusal = !draft.hosted
      ? undefined
      : draft.present
        ? before.length >= anchorCount
          ? full(before)
          : undefined
        : holders.length >= anchorCount
          ? full(holders)
          : undefined;
    const refusals = draft.fixed
      ? Object.freeze([])
      : draft.own.refusals === undefined
        ? undefined
        : Object.freeze([
            ...draft.own.refusals,
            ...(anchorRefusal === undefined ? [] : [anchorRefusal]),
          ]);
    return Object.freeze({
      kind: draft.kind,
      hosted: draft.hosted,
      present: draft.present,
      fixed: draft.fixed,
      ...(anchored ? { slotIndex: before.length } : {}),
      ...(refusals === undefined ? {} : { refusals }),
      ...(draft.hosted &&
      !draft.present &&
      !draft.fixed &&
      refusals?.length === 0 &&
      draft.own.place !== undefined
        ? { place: draft.own.place }
        : {}),
      ...(draft.fixed || draft.remove === undefined ? {} : { remove: draft.remove }),
      ...(draft.candidate === undefined ? {} : { candidate: draft.candidate }),
      ...draft.extra,
    }) as RoomAnchorObject;
  });

  const order = (kind: RoomAnchorObjectKind) => ROOM_ANCHOR_OBJECT_ORDER.indexOf(kind);
  // Where an added object lands: after the present objects native places before it.
  const landing = (kind: RoomAnchorObjectKind, removed?: RoomAnchorObjectKind) =>
    holders.filter((holder) => holder !== removed && order(holder) < order(kind)).length;
  // A replacement frees the occupant's anchor, so only the newcomer's own rules apply.
  const replaceable = drafts.filter(
    (draft) =>
      draft.hosted &&
      !draft.present &&
      !draft.fixed &&
      draft.own.place !== undefined &&
      draft.own.refusals?.length === 0,
  );
  const observedSwitchKind =
    authored.challengeSwitch === undefined
      ? undefined
      : catalog.challengeSwitches.variants.byKey[authored.challengeSwitch.variantKey]?.switchKind;
  /** The choices adding `kind` after `prefix`: one per observable type for a switch. */
  const additions = (
    kind: RoomAnchorObjectKind,
    place: ProjectCommand,
    slotIndex: number,
    prefix: readonly ProjectCommand[],
  ): RoomAnchorSlotChoice[] =>
    kind === 'challengeSwitch'
      ? switchKinds.flatMap((row) =>
          row.observe === undefined
            ? []
            : [
                Object.freeze({
                  kind,
                  switchKind: row.switchKind,
                  slotIndex,
                  commands: Object.freeze([...prefix, row.observe]),
                }),
              ],
        )
      : [Object.freeze({ kind, slotIndex, commands: Object.freeze([...prefix, place]) })];
  const slots = Array.from({ length: anchorCount }, (_, index): RoomAnchorSlot => {
    const occupant = objects.find((object) => object.slotIndex === index);
    if (occupant === undefined)
      return Object.freeze({
        index,
        fixed: false,
        choices: Object.freeze([
          Object.freeze({ kind: null, commands: Object.freeze([]) }),
          ...objects.flatMap((object) =>
            object.place === undefined
              ? []
              : additions(object.kind, object.place, landing(object.kind), []),
          ),
        ]),
      });
    const current = Object.freeze({
      kind: occupant.kind,
      ...(occupant.kind === 'challengeSwitch' && observedSwitchKind !== undefined
        ? { switchKind: observedSwitchKind }
        : {}),
      slotIndex: index,
      commands: Object.freeze([]),
    });
    if (occupant.fixed || occupant.remove === undefined)
      return Object.freeze({
        index,
        occupant: occupant.kind,
        fixed: true,
        choices: Object.freeze([current]),
      });
    const remove = occupant.remove;
    // The present switch changes type in place.
    const retyped =
      occupant.kind === 'challengeSwitch'
        ? switchKinds.flatMap((row) =>
            row.observe === undefined || row.switchKind === observedSwitchKind
              ? []
              : [
                  Object.freeze({
                    kind: occupant.kind,
                    switchKind: row.switchKind,
                    slotIndex: index,
                    commands: Object.freeze([row.observe]),
                  }),
                ],
          )
        : [];
    return Object.freeze({
      index,
      occupant: occupant.kind,
      fixed: false,
      choices: Object.freeze([
        current,
        ...retyped,
        Object.freeze({ kind: null, commands: Object.freeze([remove]) }),
        ...replaceable.flatMap((draft) =>
          additions(draft.kind, draft.own.place!, landing(draft.kind, occupant.kind), [remove]),
        ),
      ]),
    });
  });

  const pin = room?.mapPoints?.wellAnchorId;
  const anchorIds = room === undefined ? [] : roomObjectAnchorIds(room);
  const authoredAnchor = (kind: RoomAnchorObjectKind) => authored[kind]?.anchorId;
  const occupantOf = (anchorId: number) =>
    ROOM_ANCHOR_OBJECT_ORDER.find((kind) => authoredAnchor(kind) === anchorId);
  const wellPinned = pin !== undefined && authored.stygianWell !== undefined;
  // Native draws each object's anchor from those left, so the only unplaced
  // object facing a single free anchor has no roll.
  const unplaced = objects.filter(
    (object) =>
      object.hosted &&
      object.present &&
      authoredAnchor(object.kind) === undefined &&
      !(object.kind === 'stygianWell' && wellPinned),
  );
  const freeAnchors = anchorIds.filter(
    (id) => !(wellPinned && id === pin) && occupantOf(id) === undefined,
  );
  const derived =
    unplaced.length === 1 && unplaced[0]!.slotIndex !== undefined && freeAnchors.length === 1
      ? { kind: unplaced[0]!.kind, anchorId: freeAnchors[0]! }
      : undefined;
  const placed = objects.map((object) => {
    const anchorId = authoredAnchor(object.kind);
    if (!object.present) return object;
    const choose = (target: number | null) =>
      Object.freeze({
        anchorId: target,
        command: Object.freeze({
          kind: 'ReplaceRoomObjectAnchor' as const,
          occurrence: origin,
          object: object.kind,
          anchorId: target,
        }),
      });
    const derivedAnchorId = derived?.kind === object.kind ? derived.anchorId : undefined;
    // A pinned Well always stands on its pin; no other object takes it.
    const anchorChoices =
      (object.kind === 'stygianWell' && pin !== undefined) || derivedAnchorId !== undefined
        ? []
        : [
            choose(null),
            ...anchorIds
              .filter((id) => id !== pin && (occupantOf(id) ?? object.kind) === object.kind)
              .map(choose),
          ];
    return Object.freeze({
      ...object,
      ...(anchorId === undefined ? {} : { anchorId }),
      ...(derivedAnchorId === undefined ? {} : { derivedAnchorId }),
      anchorChoices: Object.freeze(anchorChoices),
    }) as RoomAnchorObject;
  });
  return Object.freeze({
    anchorCount,
    anchors: Object.freeze(
      anchorIds.map((anchorId) => {
        const isDerived = derived?.anchorId === anchorId;
        const occupant =
          occupantOf(anchorId) ??
          (anchorId === pin && wellPinned ? 'stygianWell' : undefined) ??
          (isDerived ? derived.kind : undefined);
        return Object.freeze({
          anchorId,
          pinned: anchorId === pin,
          ...(occupant === undefined ? {} : { occupant }),
          ...(isDerived ? { derived: true as const } : {}),
        });
      }),
    ),
    objects: Object.freeze(placed),
    slots: Object.freeze(slots),
    unanchored: Object.freeze(
      objects
        .filter((object) => object.present && object.slotIndex === undefined)
        .map((object) => object.kind),
    ),
  });
}

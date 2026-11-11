import {
  createBiomeAddress,
  createRewardWheelAddress,
  semanticAddressKey,
  type AcquisitionRoleAddress,
  type OccurrenceAddress,
  type RewardWheelAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import { authoredAcquisitionSources } from '../../authored-project/acquisition/acquisition-sources';
import type { ProjectCommand } from '../../authored-project/commands/types';
import type {
  AcquisitionDisposition,
  AuthoredRewardState,
  ProjectDocument,
  PurgingPoolSlotKey,
  RoomActionReference,
  RoomOccurrence,
} from '../../authored-project/model';
import {
  INITIAL_ROLL_KEY,
  featureRerolls,
  rerollActionKind,
} from '../../authored-project/feature-rolls';
import {
  nextRerollId,
  rerollAppendIndex,
  type RerollSurface,
} from '../../authored-project/rerolls';
import { roomActionKey } from '../../authored-project/room-actions/key';
import { composeStartingReward } from '../../authored-project/room-state/starting-reward';
import { TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../../authored-project/shop';
import type { Catalog } from '../../catalog-schema';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { RoomActionParticipation } from '../room-actions';
import type { ProjectEvaluationAssembly } from './evaluation-products';
import {
  liveActionsForProjectEvaluationAssembly,
  type LiveAction,
  type LiveItem,
  type LiveObject,
  type LiveObjectKind,
  type LiveObligation,
  type LivePickup,
} from './live-actions';
import {
  acquisitionConversionCandidateForProjectEvaluationAssembly,
  purgingPoolCandidateForProjectEvaluationAssembly,
  stygianWellCandidateForProjectEvaluationAssembly,
} from './project-evaluation-assembly';
import {
  rerollSpendAllowanceForProjectEvaluationAssembly,
  rerollSurfaceForProjectEvaluationAssembly,
} from './reroll-authoring';
import { authoredRoom, roomWalk } from './spawned-loot';

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

/** One distinct interaction a player has with an item. */
export type LiveVerbKind =
  /** Collect a loose pickup, or take the Contract pedestal's item. */
  | 'pickUp'
  /** Collect a pickup converting it to gold with the Time Piece. */
  | 'goldify'
  /** Collect a pickup transforming it with the Artificer. */
  | 'transform'
  /** Buy a World Shop, Travel Deal, Hermes Shrine or Stygian Well item. */
  | 'buy'
  /** Buy a Hermes Shrine item rushed. */
  | 'rush'
  /** Sell a trait at a Pool of Purging. */
  | 'sell'
  /** Press a door, cage or wheel reroll, or reroll a Well's or Pool's list. */
  | 'reroll'
  /** Choose a Ship wheel, which starts its phase's fight. */
  | 'choose'
  /** Talk to an encounter's NPC, the Gorgon's Athena or Eris. */
  | 'talkTo'
  /** Unlock a Fields cage, starting its fight, or press a locked door. */
  | 'unlock'
  /** Use the fountain or the keepsake rack. */
  | 'use'
  /** Press the challenge switch. */
  | 'press';

/**
 * The picker a verb needs. `before`: the picker supplies the verb's commands,
 * which are then absent. `after`: the commands apply as is and the picker
 * then sets the placed row's own outcome, a finding until it is chosen.
 */
export type LiveVerbChoice =
  /** A Pom's level, or the trait a level resolution takes. */
  | { readonly picker: 'levelResolution'; readonly timing: 'after' }
  /** A blank Travel Deal item's value, from the room's object interactions. */
  | { readonly picker: 'travelDealItem'; readonly timing: 'before' }
  /** A press's target and the reward it draws, from the reroll surface. */
  | { readonly picker: 'rerollPress'; readonly timing: 'before'; readonly surface: RerollSurface }
  /** The list a Well or Pool reroll restocks, pinned slot by slot. */
  | { readonly picker: 'stygianWellRoll' | 'purgingPoolRoll'; readonly timing: 'after' }
  /** The trait an unpinned Pool slot sells: one the list can show there that is still held. */
  | {
      readonly picker: 'purgingPoolSale';
      readonly timing: 'before';
      readonly rollKey: string;
      readonly slotKey: PurgingPoolSlotKey;
      /** Never empty. */
      readonly traitKeys: readonly string[];
    }
  /** The keepsake the rack swaps in; with none chosen the held keepsake stays. */
  | { readonly picker: 'keepsake'; readonly timing: 'after' }
  /** The reward the Artificer's replacement takes. */
  | { readonly picker: 'artificerReplacement'; readonly timing: 'after' };

/** One interaction available on an item at a gap. */
export interface LiveVerb {
  readonly verb: LiveVerbKind;
  readonly participation: RoomActionParticipation;
  /** For a required verb: the last gap at which it may stand. */
  readonly deadline?: number;
  /**
   * The row it stands as or places; absent for a new door, cage or wheel
   * reroll press, whose row id the picker allocates.
   */
  readonly reference?: RoomActionReference;
  /** The conversion's acquisition role, for a verb that sets one. */
  readonly acquisition?: AcquisitionRoleAddress;
  /** The row standing at this gap performs this verb: nothing to do. */
  readonly standing?: true;
  /**
   * Performs it at this gap, in order, as one edit. Empty while standing;
   * absent when the picker supplies them.
   */
  readonly commands?: readonly ProjectCommand[];
  /** A required action's default restore position. */
  readonly canonical?: true;
  readonly choice?: LiveVerbChoice;
}

/**
 * What lets the room progress at the frontier, once nothing else required
 * is live there: leaving through its doors, or choosing the next Ship wheel,
 * whose verb stands on that wheel. Leaving is the exit decision, not a row.
 */
export type LiveProgression =
  | { readonly kind: 'leaveRoom' }
  | { readonly kind: 'chooseWheel'; readonly wheel: RewardWheelAddress };

/** The verb a row of this kind performs. */
export function liveVerbKind(reference: RoomActionReference): LiveVerbKind {
  switch (reference.kind) {
    case 'collectRequiredReward':
    case 'interactIncomingReward':
    case 'interactLocalReward':
    case 'interactWheelReward':
    case 'interactInfernalContractPedestal':
      return 'pickUp';
    case 'interactAcquisitionEntry':
      // A Travel Deal refill is a purchase, not spawned loot.
      return reference.siteKey === 'roomExit' && reference.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
        ? 'buy'
        : 'pickUp';
    case 'interactShopOffer':
    case 'purchaseStygianWellOffer':
      return 'buy';
    case 'purchaseHermesShrineOffer':
      return reference.rushed ? 'rush' : 'buy';
    case 'sellPurgingPoolTrait':
      return 'sell';
    case 'reroll':
    case 'rerollStygianWell':
    case 'rerollPurgingPool':
      return 'reroll';
    case 'chooseRewardWheel':
      return 'choose';
    case 'interactEncounter':
    case 'interactGorgon':
    case 'interactEris':
      return 'talkTo';
    case 'completeFieldsCage':
    case 'unlockExit':
      return 'unlock';
    case 'useFountain':
    case 'interactKeepsakeRack':
      return 'use';
    case 'interactChallengeSwitch':
      return 'press';
  }
}

function authoredOccurrence(
  document: ProjectDocument,
  occurrence: OccurrenceAddress,
): RoomOccurrence | undefined {
  return document.route.biomes
    .find((biome) => biome.biomeKey === occurrence.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrence.occurrenceId);
}

/** The run's starting reward, which the route's first room acquires instead of its own. */
function routeStartIncoming(
  document: ProjectDocument,
  occurrence: OccurrenceAddress,
  authored: RoomOccurrence,
): AuthoredRewardState | undefined {
  const first = document.route.biomes[0];
  if (
    first?.biomeKey !== occurrence.biomeKey ||
    first.topology?.startOccurrenceId !== occurrence.occurrenceId
  )
    return undefined;
  return (
    composeStartingReward(
      document.route.loadout.startingReward,
      authored.startingRewardAcquisition,
    ) ?? undefined
  );
}

/** The verb taking an acquisition with each disposition; a normal one is the row's own verb. */
const DISPOSITION_VERBS: readonly (readonly [
  AcquisitionDisposition['kind'],
  LiveVerbKind | null,
])[] = [
  ['normal', null],
  ['timePiece', 'goldify'],
  ['artificer', 'transform'],
];

/**
 * The ways a standing row's one acquisition role can be taken, from the
 * capability the walk captured at that row's contact: the row's own verb
 * (picking it up, buying it), and goldifying or transforming it where the
 * reached state supports that conversion, which a paid item never does, or
 * the row already converts. Undefined when the row acquires no
 * single role the walk reached: its conversions are then unknown.
 */
function standingDispositionVerbs(
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
  reference: RoomActionReference,
  participation: RoomActionParticipation,
  deadline: number | undefined,
): readonly LiveVerb[] | undefined {
  const authored = authoredOccurrence(assembly.project, occurrence);
  if (authored === undefined) return undefined;
  const key = roomActionKey(reference);
  const sources = authoredAcquisitionSources(
    createBiomeAddress(occurrence.routeKey, occurrence.biomeKey),
    authored,
    routeStartIncoming(assembly.project, occurrence, authored),
  ).filter((source) => source.action !== undefined && roomActionKey(source.action) === key);
  const [source] = sources;
  if (source === undefined || sources.length > 1) return undefined;
  const capability = acquisitionConversionCandidateForProjectEvaluationAssembly(
    assembly,
    source.acquisition,
  );
  if (capability?.timePieceAssessment === undefined) return undefined;
  const supported: Readonly<Record<AcquisitionDisposition['kind'], boolean>> = {
    normal: true,
    timePiece: capability.timePieceAssessment.supported,
    artificer: capability.artificerAssessment?.supported === true,
  };
  const current = source.reward.dispositionByAcquisitionRole[source.acquisition.acquisitionRole];
  const verbs = DISPOSITION_VERBS.flatMap(([kind, verb]): LiveVerb[] => {
    const standing = (current?.kind ?? 'normal') === kind;
    if (!standing && !supported[kind]) return [];
    return [
      Object.freeze({
        verb: verb ?? liveVerbKind(reference),
        participation,
        ...(deadline === undefined ? {} : { deadline }),
        reference,
        acquisition: source.acquisition,
        ...(standing
          ? { standing: true as const, commands: Object.freeze([]) }
          : {
              commands: Object.freeze([
                Object.freeze({
                  kind: 'ReplaceAcquisitionDisposition' as const,
                  acquisition: source.acquisition,
                  value: Object.freeze({ kind }),
                }),
              ]),
            }),
        ...(kind === 'artificer'
          ? {
              choice: Object.freeze({
                picker: 'artificerReplacement' as const,
                timing: 'after' as const,
              }),
            }
          : {}),
      }),
    ];
  });
  return Object.freeze(verbs);
}

/** The outcome a row of this kind takes from its own picker once it stands. */
function rowChoice(reference: RoomActionReference): LiveVerbChoice | undefined {
  switch (reference.kind) {
    case 'interactKeepsakeRack':
      return frozen({ picker: 'keepsake' as const, timing: 'after' as const });
    case 'rerollStygianWell':
      return frozen({ picker: 'stygianWellRoll' as const, timing: 'after' as const });
    case 'rerollPurgingPool':
      return frozen({ picker: 'purgingPoolRoll' as const, timing: 'after' as const });
    default:
      return undefined;
  }
}

/** The verb an action performs, with the item's or action's obligation. */
function actionVerb(action: LiveAction, obligation: LiveObligation): LiveVerb {
  const base = {
    verb: liveVerbKind(action.reference),
    participation: obligation.participation,
    ...(obligation.deadline === undefined ? {} : { deadline: obligation.deadline }),
    reference: action.reference,
  };
  const choice = rowChoice(action.reference);
  const withChoice = choice === undefined ? {} : { choice };
  switch (action.kind) {
    case 'placed':
      return frozen({ ...base, standing: true as const, commands: frozen([]), ...withChoice });
    case 'move':
      return frozen({ ...base, commands: frozen([action.command]), ...withChoice });
    case 'place':
      if (action.needsChoice === 'travelDealItem')
        return frozen({
          ...base,
          choice: frozen({ picker: 'travelDealItem' as const, timing: 'before' as const }),
        });
      return frozen({
        ...base,
        commands: frozen([action.command]),
        ...(action.canonical === true ? { canonical: true as const } : {}),
        ...(action.needsChoice === 'levelResolution'
          ? { choice: frozen({ picker: 'levelResolution' as const, timing: 'after' as const }) }
          : withChoice),
      });
  }
}

/** An object's verb whose row a picker creates or the engine allocates, at the one gap it takes. */
interface ObjectVerb {
  readonly object: LiveObjectKind;
  readonly owner: SemanticAddress;
  readonly gap: number;
  readonly verb: LiveVerb;
}

/**
 * The verbs a room's objects allow whose row is not a roster row yet: a door,
 * cage or wheel reroll press at its surface's append point, and a Well or Pool
 * reroll and an unpinned Pool slot's sale where the room's reached actions
 * end. Each is offered only where its object is reached, a held card enables
 * it and the reroll pool there pays for it, the fixed budget edit settlement
 * enforces.
 */
function objectChoiceVerbs(
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
  room: CanonicalAuthoredRoom,
  orderLength: number,
  frontier: number,
): readonly ObjectVerb[] {
  const biome = createBiomeAddress(occurrence.routeKey, occurrence.biomeKey);
  const verbs: ObjectVerb[] = [];
  const surfaces: {
    readonly object: LiveObjectKind;
    readonly owner: SemanticAddress;
    readonly surface: RerollSurface;
  }[] = [{ object: 'doorRerolls', owner: occurrence, surface: { kind: 'doors', occurrence } }];
  for (const phase of room.roomActionRoster.lifecycleStructure.phases) {
    if (phase.rewardWheelKey === undefined) continue;
    const wheel = createRewardWheelAddress(biome, occurrence.occurrenceId, phase.rewardWheelKey);
    surfaces.push({ object: 'rewardWheel', owner: wheel, surface: { kind: 'rewardWheel', wheel } });
  }
  for (const { object, owner, surface } of surfaces) {
    const settlement = rerollSurfaceForProjectEvaluationAssembly(assembly, surface);
    const gap = rerollAppendIndex(assembly.project, surface);
    if (settlement === undefined || gap === undefined || gap > frontier) continue;
    if (
      !settlement.enabled ||
      settlement.targets.every((target) => target.unavailable !== undefined)
    )
      continue;
    const allowance = rerollSpendAllowanceForProjectEvaluationAssembly(assembly, {
      kind: 'press',
      surface,
    });
    if (allowance.kind !== 'reached' || !allowance.allowed) continue;
    verbs.push(
      frozen({
        object,
        owner,
        gap,
        verb: frozen({
          verb: 'reroll' as const,
          participation: 'optional' as const,
          choice: frozen({ picker: 'rerollPress' as const, timing: 'before' as const, surface }),
        }),
      }),
    );
  }
  // A Well's or Pool's interaction stands where the room's reached actions end.
  if (frontier !== orderLength) return frozen(verbs);
  const order = room.roomActionRoster.rows.flatMap((row) =>
    row.rank === null ? [] : [row.reference],
  );
  const featureReroll = (
    object: 'stygianWell' | 'purgingPool',
    option: { readonly enabled: boolean; readonly available: boolean } | undefined,
  ) => {
    if (option === undefined || !option.enabled || !option.available) return;
    const allowance = rerollSpendAllowanceForProjectEvaluationAssembly(assembly, {
      kind: 'featureReroll',
      occurrence,
      feature: object,
    });
    if (allowance.kind !== 'reached' || !allowance.allowed) return;
    const command: ProjectCommand =
      object === 'stygianWell'
        ? frozen({ kind: 'InsertStygianWellReroll' as const, occurrence, index: orderLength })
        : frozen({ kind: 'InsertPurgingPoolReroll' as const, occurrence, index: orderLength });
    // The command allocates the smallest id the room's rerolls of this object leave free.
    const reference: RoomActionReference = frozen({
      kind: rerollActionKind(object),
      rerollId: nextRerollId(featureRerolls(order, object)),
    });
    verbs.push(
      frozen({
        object,
        owner: occurrence,
        gap: orderLength,
        verb: frozen({
          verb: 'reroll' as const,
          participation: 'optional' as const,
          reference,
          commands: frozen([command]),
          choice: frozen({
            picker:
              object === 'stygianWell'
                ? ('stygianWellRoll' as const)
                : ('purgingPoolRoll' as const),
            timing: 'after' as const,
          }),
        }),
      }),
    );
  };
  featureReroll(
    'stygianWell',
    stygianWellCandidateForProjectEvaluationAssembly(assembly, occurrence)?.interaction?.reroll,
  );
  const poolCapability = purgingPoolCandidateForProjectEvaluationAssembly(assembly, occurrence);
  const pool = poolCapability?.interaction;
  if (pool === undefined) return frozen(verbs);
  featureReroll('purgingPool', pool.reroll);
  // A pinned slot's sale is a roster row. An unpinned one sells a trait its
  // list can show that is still held where the room's actions end.
  const listCandidates =
    pool.rollKey === INITIAL_ROLL_KEY
      ? poolCapability!.candidateTraitKeysBySlot
      : poolCapability!.rolls[pool.rollKey]?.candidateTraitKeysBySlot;
  const held = new Set(Object.values(pool.pendingRoll.candidateTraitKeysBySlot).flat());
  for (const offer of pool.offers) {
    if (offer.traitKey !== null) continue;
    const traitKeys = (listCandidates?.[offer.slotKey] ?? []).filter((key) => held.has(key));
    if (traitKeys.length === 0) continue;
    verbs.push(
      frozen({
        object: 'purgingPool' as const,
        owner: occurrence,
        gap: orderLength,
        verb: frozen({
          verb: 'sell' as const,
          participation: 'optional' as const,
          reference: offer.sale,
          choice: frozen({
            picker: 'purgingPoolSale' as const,
            timing: 'before' as const,
            rollKey: pool.rollKey,
            slotKey: offer.slotKey,
            traitKeys: frozen(traitKeys),
          }),
        }),
      }),
    );
  }
  return frozen(verbs);
}

/** A live item with each interaction it allows at the gap. */
export interface LiveInteractionItem {
  readonly item: LiveItem;
  /**
   * Its actions' verbs, then, on an object, the ones whose row a picker
   * creates or the engine allocates (a reroll press, a Well or Pool reroll,
   * an unpinned Pool sale).
   */
  readonly verbs: readonly LiveVerb[];
}

export interface LiveInteractionGap {
  readonly index: number;
  readonly items: readonly LiveInteractionItem[];
}

/** What a player can do at each gap of one room's action order, verb by verb. */
export interface RoomLiveInteractions {
  readonly owner: OccurrenceAddress;
  readonly frontier: number;
  readonly gaps: readonly LiveInteractionGap[];
  /** What lets the room progress at the frontier once nothing else required is live there. */
  readonly progression?: LiveProgression;
  /** The optional pickups still loose when the room is left, once the walk passes the room. */
  readonly leftBehind?: readonly LivePickup[];
}

/**
 * The live product verb by verb: each live item's interactions at each gap,
 * the room's progression at its frontier and what it leaves behind. Each
 * verb is an edit against the current plan: after one applies, the product
 * is read again, so two verbs offered at one gap never compose. Undefined
 * where the live product is.
 */
export function liveInteractionsForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): RoomLiveInteractions | undefined {
  const live = liveActionsForProjectEvaluationAssembly(catalog, assembly, occurrence);
  const room = authoredRoom(assembly, occurrence);
  if (live === undefined || room === undefined) return undefined;
  const orderLength = room.roomActionRoster.rows.filter((row) => row.rank !== null).length;
  const { frontier } = live;
  const stop = roomWalk(assembly, occurrence).stop;

  /**
   * An action's verbs: a standing row acquiring one reached role offers each
   * way of taking it the walk's capability there supports; any other action
   * performs its one verb.
   */
  const verbsOf = (action: LiveAction, obligation: LiveObligation): readonly LiveVerb[] =>
    (action.kind === 'placed'
      ? standingDispositionVerbs(
          assembly,
          occurrence,
          action.reference,
          obligation.participation,
          obligation.deadline,
        )
      : undefined) ?? [actionVerb(action, obligation)];

  const choiceVerbs = objectChoiceVerbs(assembly, occurrence, room, orderLength, frontier);
  const gaps = live.gaps.map((gap): LiveInteractionGap => {
    const items: LiveInteractionItem[] = gap.items.map((item) =>
      frozen({
        item,
        verbs: frozen(
          item.kind === 'pickup'
            ? item.actions.flatMap((action) => verbsOf(action, item))
            : item.actions.flatMap((action) => verbsOf(action, action)),
        ),
      }),
    );
    const extra = new Map<
      string,
      { object: LiveObjectKind; owner: SemanticAddress; verbs: LiveVerb[] }
    >();
    for (const { object, owner, gap: verbGap, verb } of choiceVerbs) {
      if (verbGap !== gap.index) continue;
      const key = `${object}:${semanticAddressKey(owner)}`;
      const index = items.findIndex(
        ({ item }) =>
          item.kind === 'object' &&
          item.object === object &&
          semanticAddressKey(item.owner) === semanticAddressKey(owner),
      );
      if (index >= 0)
        items[index] = frozen({
          item: items[index]!.item,
          verbs: frozen([...items[index]!.verbs, verb]),
        });
      else {
        const entry = extra.get(key) ?? { object, owner, verbs: [] };
        entry.verbs.push(verb);
        extra.set(key, entry);
      }
    }
    for (const { object, owner, verbs } of extra.values()) {
      const item: LiveObject = frozen({
        kind: 'object' as const,
        object,
        owner,
        actions: frozen([]),
      });
      items.push(frozen({ item, verbs: frozen(verbs) }));
    }
    return frozen({ index: gap.index, items: frozen(items) });
  });

  const atFrontier = gaps[frontier]?.items ?? [];
  /** Each required thing live at the frontier, once: a pickup, or a required verb on an object. */
  const required = new Map<string, { readonly item: LiveItem; readonly verb?: LiveVerb }>();
  for (const { item, verbs } of atFrontier)
    if (item.kind === 'pickup') {
      if (item.participation === 'required') required.set(roomActionKey(item.reference), { item });
    } else
      verbs.forEach((verb, index) => {
        if (verb.participation !== 'required') return;
        const key =
          verb.reference === undefined
            ? `${semanticAddressKey(item.owner)} ${index}`
            : roomActionKey(verb.reference);
        required.set(key, { item, verb });
      });
  const [only] = required.values();
  const passed = frontier === orderLength && (stop === undefined || stop.kind === 'exit');
  const progression: LiveProgression | undefined =
    required.size === 0
      ? passed
        ? frozen({ kind: 'leaveRoom' as const })
        : undefined
      : required.size === 1 &&
          only?.item.kind === 'object' &&
          only.item.owner.kind === 'rewardWheel' &&
          only.verb?.verb === 'choose' &&
          only.verb.standing !== true
        ? frozen({ kind: 'chooseWheel' as const, wheel: only.item.owner })
        : undefined;
  return frozen({
    owner: live.owner,
    frontier,
    gaps: frozen(gaps),
    ...(progression === undefined ? {} : { progression }),
    ...(passed
      ? {
          leftBehind: frozen(
            atFrontier.flatMap(({ item }) =>
              item.kind === 'pickup' && item.participation === 'optional' ? [item] : [],
            ),
          ),
        }
      : {}),
  });
}

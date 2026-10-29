import type {
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  TraitOfferAddress,
  TraitOptionKey,
} from '../../authored-project';
import type { Catalog, TraitRarity } from '../../catalog-schema';
import type { RunRecord } from '../../run-record/model';
import type { EvaluatedTraitOfferCandidate } from '../candidates';
import { advanceCurrentKeepsake } from '../keepsakes/state';
import { entrySnapshot, rarifyCharges, recordedEntryStates } from './conformance';
import type { RunImportContext } from './import';

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;

const spendsByRecord = new WeakMap<RunRecord, Map<number, ReadonlyMap<string, number>>>();

/**
 * Charges the room's own non-click gain adds to each source: the plan's
 * advance of the current keepsake when the room acquires a trait that
 * advances it (Cherished Heirloom), read from the plan's state at the room's
 * entry save. Undefined while the plan has not reached that state.
 */
function rarifyGains(
  context: RunImportContext,
  roomIndex: number,
): ReadonlyMap<string, number> | undefined {
  const { catalog } = context;
  const advance = context.record.rooms[roomIndex]!.traits.acquired.map(
    (entry) => catalog.traits.byKey[entry.name]?.selectedDisposition,
  ).find((disposition) => disposition?.kind === 'advanceCurrentKeepsake');
  if (advance === undefined) return new Map();
  const keepsakes = entrySnapshot(context.assembly(), context.occurrences, roomIndex)?.keepsakes;
  if (keepsakes === undefined) return undefined;
  const advanced = advanceCurrentKeepsake(catalog, keepsakes, advance.rankBonus);
  const gains = new Map<string, number>();
  const key = keepsakes.currentKey;
  if (key !== null) {
    const gain =
      (rarifyCharges(catalog, advanced, key) ?? 0) - (rarifyCharges(catalog, keepsakes, key) ?? 0);
    if (gain > 0) gains.set(key, gain);
  }
  return gains;
}

/**
 * Rarify charges a record room spent, by source trait: its
 * `RarityUpgradeData.Uses` at the room's entry save, plus the room's non-click
 * gain, less the next entry save's. Any other rise (an Echo replay, which
 * shares no room with a screen) is not a spend, a slotted source swapped away
 * leaves its spend unknown, and an unslotted one that vanished spent to zero.
 * Choosing a keepsake that opposes Fated zeroes Calling Card without a click.
 */
function recordedRarifySpends(
  context: RunImportContext,
  roomIndex: number,
): ReadonlyMap<string, number> {
  const { catalog, record } = context;
  let byRoom = spendsByRecord.get(record);
  if (byRoom === undefined) spendsByRecord.set(record, (byRoom = new Map()));
  const cached = byRoom.get(roomIndex);
  if (cached !== undefined) return cached;
  const spent = new Map<string, number>();
  const states = recordedEntryStates(record);
  const before = states[roomIndex];
  const after = states[roomIndex + 1];
  if (before === undefined || after === undefined) return spent;
  const gains = rarifyGains(context, roomIndex);
  if (gains === undefined) return spent;
  const callingCard = catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'callingCard',
  )?.key;
  const room = record.rooms[roomIndex]!;
  for (const [name, row] of before.traits) {
    if (row.rarityUpgradeUses === undefined) continue;
    const held = row.rarityUpgradeUses + (gains.get(name) ?? 0);
    if (held <= 0) continue;
    const next = after.traits.get(name);
    const left =
      next !== undefined
        ? next.rarityUpgradeUses
        : before.keepsake === name && after.keepsake !== name
          ? undefined
          : 0;
    if (left === undefined || left >= held) continue;
    const swap = room.keepsakeSwap;
    if (
      name === callingCard &&
      left === 0 &&
      swap !== undefined &&
      catalog.keepsakes.byKey[swap.to]?.fatedDisposition === 'opposing'
    )
      continue;
    spent.set(name, held - left);
  }
  byRoom.set(roomIndex, spent);
  return spent;
}

/**
 * The sources a screen of `giverKey` spends from, in the order the game
 * resolves them: its god's Olympian keepsake, then Calling Card.
 */
function screenSources(catalog: Catalog, giverKey: string): readonly string[] {
  const olympian = catalog.keepsakes.values
    .filter(
      (keepsake) =>
        keepsake.effect?.kind === 'olympianRewardPressure' &&
        keepsake.effect.providerKey === giverKey,
    )
    .map((keepsake) => keepsake.key);
  const callingCard =
    catalog.traitGivers.byKey[giverKey]?.callingCardMenu === true
      ? catalog.keepsakes.values
          .filter((keepsake) => keepsake.effect?.kind === 'callingCard')
          .map((keepsake) => keepsake.key)
      : [];
  return [...olympian, ...callingCard];
}

const spentKey = (roomIndex: number, source: string, index: number) =>
  `rarify:${roomIndex}:${source}:${index}`;

/** Charges the room spent on this giver's sources that no authored click has taken yet. */
function unplacedCharges(context: RunImportContext, roomIndex: number, giverKey: string): number {
  const spent = recordedRarifySpends(context, roomIndex);
  let charges = 0;
  for (const source of screenSources(context.catalog, giverKey))
    for (let index = 0; index < (spent.get(source) ?? 0); index += 1)
      if (!context.used.has(spentKey(roomIndex, source, index))) charges += 1;
  return charges;
}

/** Marks `count` of the room's charges for this giver as taken by authored clicks. */
export function takeRarifyCharges(
  context: RunImportContext,
  roomIndex: number,
  giverKey: string,
  count: number,
): void {
  const spent = recordedRarifySpends(context, roomIndex);
  let left = count;
  for (const source of screenSources(context.catalog, giverKey))
    for (let index = 0; left > 0 && index < (spent.get(source) ?? 0); index += 1) {
      const key = spentKey(roomIndex, source, index);
      if (context.used.has(key)) continue;
      context.used.add(key);
      left -= 1;
    }
}

function evaluated(
  context: RunImportContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOffer,
): EvaluatedTraitOfferCandidate | undefined {
  const evaluation = context.candidates().evaluate({ kind: 'traitOffer', trait, value });
  return evaluation.kind === 'traitOffer' ? evaluation : undefined;
}

/** Every branch replays every click of the offer. */
function clicksHold(evaluation: EvaluatedTraitOfferCandidate | undefined): boolean {
  const branches = evaluation?.result.callingCard ?? [];
  return (
    branches.length > 0 &&
    branches.every(
      (branch) =>
        branch.invalidActionIndexes.length === 0 &&
        (branch.rerolledScreens ?? []).every((screen) => screen.invalidActionIndexes.length === 0),
    )
  );
}

/** The final screen's Rarify clicks the record's spent charges explain, and the rows they took. */
export interface FinalScreenClicks {
  readonly value: AuthoredTraitOfferTraits;
  readonly clicked: ReadonlySet<number>;
}

/**
 * Authors the room's unplaced Rarify charges as clicks on a final screen: the
 * picked row first, as many clicks as its acquired rarity allows above a
 * legal roll, then each other row in order, every click setting the row's
 * rolled rarity one step further under its logged one (`logged`, by trait).
 * Each placement is kept only where the engine replays it and admits the
 * row's rolled rarity.
 */
export function withRarifyClicks(
  context: RunImportContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOffer,
  roomIndex: number,
  logged: ReadonlyMap<string, string | undefined>,
): FinalScreenClicks | undefined {
  if (value.kind !== 'traits') return undefined;
  let charges = unplacedCharges(context, roomIndex, value.giverKey);
  if (charges === 0) return undefined;
  const order = context.catalog.traitRarityOrder as readonly TraitRarity[];
  const level = (rarity: string | undefined) =>
    rarity === undefined ? -1 : (order as readonly string[]).indexOf(rarity);
  const withClicks = (
    offer: AuthoredTraitOfferTraits,
    row: number,
    rarity: TraitRarity,
    clicks: number,
  ): AuthoredTraitOfferTraits => ({
    ...offer,
    options: offer.options.map((option, index) =>
      index === row ? { ...option, rarity } : option,
    ) as unknown as AuthoredTraitOfferTraits['options'],
    rarificationActions: [
      ...(offer.rarificationActions ?? []),
      ...Array.from({ length: clicks }, () => OPTION_KEYS[row]!),
    ],
  });
  const holds = (offer: AuthoredTraitOfferTraits, row: number) => {
    const evaluation = evaluated(context, trait, offer);
    return clicksHold(evaluation) && evaluation!.result.assessments[row]?.legal === true;
  };
  let current = value;
  const clicked = new Set<number>();
  const selected = OPTION_KEYS.indexOf(value.selectedOptionKey);
  const pick = value.options[selected];
  const grants = context.record.rooms[roomIndex]!.traits.acquired.filter(
    (entry) => entry.name === pick?.traitKey,
  );
  const acquired = grants.length === 1 ? level(grants[0]!.rarity) : -1;
  // A hovered pick logs one step above its acquired rarity.
  const pickLogged = level(logged.get(pick?.traitKey ?? ''));
  if (acquired >= 0 && (pickLogged === acquired || pickLogged === acquired + 1))
    for (let clicks = Math.min(charges, acquired); clicks > 0; clicks -= 1) {
      const attempt = withClicks(current, selected, order[acquired - clicks]!, clicks);
      if (!holds(attempt, selected)) continue;
      current = attempt;
      charges -= clicks;
      clicked.add(selected);
      break;
    }
  for (const [row, option] of value.options.entries()) {
    if (row === selected) continue;
    for (
      let rolled = level(logged.get(option.traitKey)) - 1;
      charges > 0 && rolled >= 0;
      rolled -= 1
    ) {
      const attempt = withClicks(current, row, order[rolled]!, 1);
      if (!holds(attempt, row)) break;
      current = attempt;
      charges -= 1;
      clicked.add(row);
    }
  }
  return clicked.size === 0 ? undefined : { value: current, clicked };
}

/**
 * Authors the room's charges still unplaced after the final screen as clicks
 * on its rerolled-away screens, newest first, each on the first row every
 * branch can rarify there, kept only where the plan stays valid.
 */
export function rarifyRerolledScreens(
  context: RunImportContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOffer,
  roomIndex: number,
): void {
  if (value.kind !== 'traits' || (value.rerolledScreens?.length ?? 0) === 0) return;
  let current: AuthoredTraitOfferTraits = value;
  const screens = value.rerolledScreens!;
  for (let screen = screens.length - 1; screen >= 0; screen -= 1)
    while (unplacedCharges(context, roomIndex, value.giverKey) > 0) {
      const shown = current.rerolledScreens?.[screen];
      const branches = evaluated(context, trait, current)?.result.callingCard ?? [];
      if (shown === null || shown === undefined || branches.length === 0) break;
      const rarifiable = (key: TraitOptionKey) =>
        branches.every((branch) =>
          branch.rerolledScreens?.[screen]?.rarifiableOptionKeys.includes(key),
        );
      const key = OPTION_KEYS.find(rarifiable);
      if (key === undefined) break;
      const next: AuthoredTraitOfferTraits = {
        ...current,
        rerolledScreens: current.rerolledScreens!.map((entry, index) =>
          index === screen && entry !== null
            ? { ...entry, rarificationActions: [...(entry.rarificationActions ?? []), key] }
            : entry,
        ),
      };
      if (!context.applyValid({ kind: 'ReplaceTraitOffer', trait, value: next })) break;
      current = next;
      takeRarifyCharges(context, roomIndex, value.giverKey, 1);
    }
}

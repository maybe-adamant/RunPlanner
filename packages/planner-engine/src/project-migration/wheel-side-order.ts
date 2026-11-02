import type { Catalog } from '../catalog-schema';
import {
  createBiomeAddress,
  createRewardWheelOfferAddress,
  semanticAddressKey,
  type RewardWheelAddress,
  type SemanticAddress,
} from '../authored-project/addresses';
import { decodeProjectDocument } from '../authored-project/codec';
import type { ProjectDocument } from '../authored-project/model';

type RawRecord = Record<string, unknown>;

/** The plan's one blocking assessment stop, as its evaluation publishes it. */
export interface WheelSideOrderBlock {
  readonly kind: 'incomplete' | 'invalid';
  readonly owner: SemanticAddress;
  readonly reasons: readonly { readonly origin: SemanticAddress }[];
}

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

function rawArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function rawShipWheels(document: RawRecord): readonly RawRecord[] {
  return rawArray(rawRecord(document.route)?.biomes).flatMap((biome) =>
    rawArray(rawRecord(rawRecord(biome)?.topology)?.occurrences).flatMap(
      (occurrence): readonly RawRecord[] => {
        const state = rawRecord(rawRecord(occurrence)?.state);
        return state?.kind === 'shipCombat'
          ? Object.values(rawRecord(state.wheels) ?? {}).flatMap((wheel): readonly RawRecord[] => {
              const record = rawRecord(wheel);
              return record === undefined ? [] : [record];
            })
          : [];
      },
    ),
  );
}

const twoOffered = (wheel: RawRecord) =>
  wheel.offerCount === 2 &&
  ['offer1', 'offer2'].every((key) => rawRecord(rawRecord(wheel.offers)?.[key]) !== undefined);

function decodes(document: unknown, catalog: Catalog): ProjectDocument | undefined {
  try {
    return decodeProjectDocument(document, catalog);
  } catch {
    return undefined;
  }
}

function rawWheel(
  document: RawRecord,
  wheel: RewardWheelAddress,
): { readonly occurrence: RawRecord; readonly wheel: RawRecord } | undefined {
  for (const biome of rawArray(rawRecord(document.route)?.biomes)) {
    if (rawRecord(biome)?.biomeKey !== wheel.biomeKey) continue;
    for (const candidate of rawArray(rawRecord(rawRecord(biome)?.topology)?.occurrences)) {
      const occurrence = rawRecord(candidate);
      if (occurrence?.occurrenceId !== wheel.occurrenceId) continue;
      const found = rawRecord(rawRecord(rawRecord(occurrence.state)?.wheels)?.[wheel.wheelKey]);
      return found === undefined ? undefined : { occurrence, wheel: found };
    }
  }
  return undefined;
}

/** The wheels an invalid block names, by their owner and reasons. */
function blockedWheels(block: WheelSideOrderBlock | undefined): readonly RewardWheelAddress[] {
  if (block?.kind !== 'invalid') return [];
  const wheels = new Map<string, RewardWheelAddress>();
  for (const origin of [block.owner, ...block.reasons.map((reason) => reason.origin)]) {
    if (origin.kind !== 'rewardWheelOffer' && origin.kind !== 'rewardWheel') continue;
    const wheel: RewardWheelAddress = Object.freeze({
      kind: 'rewardWheel',
      routeKey: origin.routeKey,
      biomeKey: origin.biomeKey,
      occurrenceId: origin.occurrenceId,
      wheelKey: origin.wheelKey,
    });
    wheels.set(semanticAddressKey(wheel), wheel);
  }
  return [...wheels.values()];
}

/** Every persisted spelling of an address key: bare, JSON-escaped once or twice, URI-encoded. */
function spellings(key: string): readonly string[] {
  const escaped = JSON.stringify(key).slice(1, -1);
  return [key, escaped, JSON.stringify(escaped).slice(1, -1), encodeURIComponent(key)];
}

/**
 * Exchanges a wheel's two offers: their first draws, rerolled rewards and
 * picked index, every reroll target naming one, and every persisted key or
 * value that embeds either offer's address, such as a picked offer's
 * Artificer pickup.
 */
function swapWheelOffers(document: RawRecord, wheel: RewardWheelAddress): RawRecord {
  const biome = createBiomeAddress(wheel.routeKey, wheel.biomeKey);
  const [left, right] = (['offer1', 'offer2'] as const).map((offerKey) =>
    spellings(
      semanticAddressKey(
        createRewardWheelOfferAddress(biome, wheel.occurrenceId, wheel.wheelKey, offerKey),
      ),
    ),
  );
  const counterpart = new Map<string, string>(
    left!.flatMap((spelling, index): [string, string][] => [
      [spelling, right![index]!],
      [right![index]!, spelling],
    ]),
  );
  const pattern = new RegExp(
    [...counterpart.keys()]
      .sort((a, b) => b.length - a.length)
      .map((spelling) => spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|'),
    'g',
  );
  const rewrite = (text: string) => text.replace(pattern, (match) => counterpart.get(match)!);
  const walk = (value: unknown): unknown =>
    typeof value === 'string'
      ? rewrite(value)
      : Array.isArray(value)
        ? value.map(walk)
        : typeof value === 'object' && value !== null
          ? Object.fromEntries(
              Object.entries(value).map(([key, entry]) => [rewrite(key), walk(entry)]),
            )
          : value;
  const copy = walk(document) as RawRecord;
  const swapped = rawWheel(copy, wheel)!;
  const exchange = (record: unknown) => {
    const entries = rawRecord(record);
    if (entries === undefined) return record;
    const { offer1, offer2, ...rest } = entries;
    return {
      ...rest,
      ...(offer2 === undefined ? {} : { offer1: offer2 }),
      ...(offer1 === undefined ? {} : { offer2: offer1 }),
    };
  };
  swapped.wheel.offers = exchange(swapped.wheel.offers);
  if (swapped.wheel.rerolledOffers !== undefined)
    swapped.wheel.rerolledOffers = exchange(swapped.wheel.rerolledOffers);
  if (typeof swapped.wheel.pickedOfferIndex === 'number')
    swapped.wheel.pickedOfferIndex = 3 - swapped.wheel.pickedOfferIndex;
  for (const reference of rawArray(rawRecord(swapped.occurrence.roomActions)?.order)) {
    const target = rawRecord(rawRecord(reference)?.target);
    if (
      rawRecord(reference)?.kind === 'reroll' &&
      target?.kind === 'wheelOffer' &&
      target.wheelKey === wheel.wheelKey &&
      (target.offerKey === 'offer1' || target.offerKey === 'offer2')
    )
      target.offerKey = target.offerKey === 'offer1' ? 'offer2' : 'offer1';
  }
  return copy;
}

/**
 * The game draws a Ship's two wheel offers left then right, and offer 1 is the
 * Left wheel. A plan saved while either draw order was admitted may hold a
 * two-offer wheel valid only the other way round: while the plan's block names
 * such a wheel and exchanging its offers clears that wheel from the block, the
 * exchange is kept. `blockOf` is the plan's evaluated blocking stop. Returns
 * the input itself when nothing changes; a document strict decoding rejects is
 * left for it to reject.
 */
export function exchangeBlockedWheelOffers(
  value: unknown,
  catalog: Catalog,
  blockOf: (project: ProjectDocument) => WheelSideOrderBlock | undefined,
): unknown {
  const document = rawRecord(value);
  if (document === undefined || !rawShipWheels(document).some(twoOffered)) return value;
  const project = decodes(document, catalog);
  if (project === undefined) return value;
  let current = document;
  let block = blockOf(project);
  const tried = new Set<string>();
  for (;;) {
    const wheel = blockedWheels(block).find((candidate) => {
      const raw = rawWheel(current, candidate);
      return (
        raw !== undefined && twoOffered(raw.wheel) && !tried.has(semanticAddressKey(candidate))
      );
    });
    if (wheel === undefined) return current;
    tried.add(semanticAddressKey(wheel));
    const swapped = swapWheelOffers(current, wheel);
    const swappedProject = decodes(swapped, catalog);
    if (swappedProject === undefined) return current;
    const swappedBlock = blockOf(swappedProject);
    const wheelKey = semanticAddressKey(wheel);
    if (blockedWheels(swappedBlock).some((other) => semanticAddressKey(other) === wheelKey))
      return current;
    current = swapped;
    block = swappedBlock;
  }
}

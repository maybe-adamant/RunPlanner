import type { Catalog, HexDeclaration, HexLayoutDeclaration, TraitRarity } from '../catalog-schema';
import {
  createKeepsakeEquipResultAddress,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
} from './addresses';
import { ProjectCommandContractError } from './commands/contract';
import type { ProjectCommand } from './commands/dispatch';
import {
  DRAFT_OPTION_KEYS,
  DRAFT_OPTIONS,
  decodeDraftSpec,
  draftSpecCatalogKeys,
  type DraftOptionDeclaration,
} from './draft-spec';
import { assessPublicDreamItinerary } from './dream-itinerary';
import { assessStartingArcanaGrasp } from './loadout';
import type {
  AuthoredDraftSpec,
  AuthoredKeepsakeEquipResults,
  AuthoredRoutePlan,
  ProjectDocument,
  RouteLoadout,
} from './model';
import { routeInitialProfile } from './route-profile';
import { createDefaultAuthoredHexTree, normalizeAuthoredHexTree } from './traits/hex-tree';
import { hexNodeTalentDomain } from './traits/hex-talent-tree';
import {
  normalizeAuthoredTranscendentEmbryoOutcome,
  type AuthoredHexTreeConfiguration,
} from './traits/state';

/** The loadout choices a draft reads; the starting reward and equip results are generated. */
export type DraftShareLoadout = Pick<
  RouteLoadout,
  | 'weaponKey'
  | 'aspectKey'
  | 'startingKeepsakeKey'
  | 'familiarKey'
  | 'manualArcanaKeys'
  | 'fearRanks'
  | 'aspectHexTree'
  | 'keepsakeEquipResults'
>;

/** Everything a player authors for a draft: its route, "Plan up to", loadout and spec. */
export interface DraftShareInputs {
  readonly routeKey: string;
  readonly itineraryBiomeKeys: readonly string[];
  readonly configuredBiomeCount: number;
  readonly loadout: DraftShareLoadout;
  readonly draft: AuthoredDraftSpec;
}

/**
 * `badLayout`: not a share code at all. `olderVersion`: a code from an earlier code layout.
 * `otherVersion` and `otherFingerprint`: a code from a later code layout or another catalog.
 * `otherRoute`: a code for another route or Dream itinerary. `malformed`: the right layout but
 * contents this catalog rejects.
 */
export type DraftShareCodeRefusal =
  'badLayout' | 'olderVersion' | 'otherVersion' | 'otherFingerprint' | 'otherRoute' | 'malformed';

export type DraftShareCodeDecoding =
  | { readonly ok: true; readonly inputs: DraftShareInputs }
  | { readonly ok: false; readonly refusal: DraftShareCodeRefusal };

const LAYOUT_VERSION = 3;
const FINGERPRINT_CHARS = 3;
/** Crockford base32: no I, L, O or U, read case-insensitively. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SELENE_SPELL = 'SpellMoonBeamTrait';
/** Jeweled Pom rarities a code can carry, in order. */
const POM_RARITIES: readonly TraitRarity[] = [
  'Common',
  'Rare',
  'Epic',
  'Heroic',
  'Legendary',
  'Duo',
];

/** The ordered key lists a code indexes; a code only decodes against the same lists. */
interface ShareLists {
  readonly routeKeys: readonly string[];
  readonly biomeKeys: readonly string[];
  readonly weapons: readonly { readonly key: string; readonly aspectKeys: readonly string[] }[];
  readonly keepsakeKeys: readonly string[];
  readonly familiarKeys: readonly string[];
  readonly manualArcanaKeys: readonly string[];
  readonly vows: readonly { readonly key: string; readonly maximum: number }[];
  readonly godKeys: readonly string[];
  readonly storyNpcKeys: readonly string[];
  readonly fieldNpcKeys: readonly string[];
  readonly traitKeys: readonly string[];
  readonly hex: HexDeclaration | undefined;
  /** In-run Chaos blessings Transcendent Embryo may grant, with their operands in order. */
  readonly blessings: readonly { readonly key: string; readonly operandKeys: readonly string[] }[];
}

function shareLists(catalog: Catalog): ShareLists {
  const keys = draftSpecCatalogKeys(catalog);
  return {
    routeKeys: catalog.routes.values.map((route) => route.key),
    biomeKeys: catalog.biomes.values.map((biome) => biome.key),
    weapons: catalog.weapons.values.map((weapon) => ({
      key: weapon.key,
      aspectKeys: weapon.aspectKeys,
    })),
    keepsakeKeys: catalog.keepsakes.values.map((keepsake) => keepsake.key),
    familiarKeys: catalog.familiars.values.map((familiar) => familiar.key),
    manualArcanaKeys: catalog.arcanaCards.values
      .filter((card) => card.activation.kind === 'manual')
      .map((card) => card.key),
    vows: catalog.fearVows.values.map((vow) => ({
      key: vow.key,
      maximum: vow.incrementalFear.length,
    })),
    godKeys: keys.godKeys,
    storyNpcKeys: keys.storyNpcKeys,
    fieldNpcKeys: keys.fieldNpcKeys,
    traitKeys: catalog.traits.values.map((trait) => trait.key),
    hex: catalog.hexes.byKey[SELENE_SPELL],
    blessings: catalog.chaos.blessings.values
      .filter((blessing) => blessing.fixedRarity === undefined)
      .map((blessing) => ({
        key: blessing.key,
        operandKeys: blessing.operands.map((operand) => operand.key),
      })),
  };
}

const authoredHexNodes = (layout: HexLayoutDeclaration) =>
  layout.nodes.values.filter(
    (node) => node.kind !== 'olympianSpell' && node.kind !== 'olympianCount',
  );

/** Fresh File fixes its loadout, so a code carries none for it. */
const fixedLoadout = (catalog: Catalog, routeKey: string) =>
  routeInitialProfile(catalog, routeKey).kind === 'freshFile';

const isSelene = (catalog: Catalog, aspectKey: string | null) =>
  aspectKey !== null && catalog.aspects.byKey[aspectKey]?.startingTrait?.traitKey === SELENE_SPELL;

function fingerprint(catalog: Catalog, lists: ShareLists): string {
  const dream = catalog.routes.byKey.Dream?.dreamItinerary;
  const parts = [
    lists.routeKeys,
    lists.biomeKeys,
    lists.weapons.map((weapon) => `${weapon.key}:${weapon.aspectKeys.join(',')}`),
    lists.keepsakeKeys,
    lists.familiarKeys,
    lists.manualArcanaKeys,
    lists.vows.map((vow) => `${vow.key}:${vow.maximum}`),
    lists.godKeys,
    lists.storyNpcKeys,
    lists.fieldNpcKeys,
    lists.traitKeys,
    dream === undefined
      ? []
      : [dream.biomeCount, ...dream.initialBiomeKeys, '/', ...dream.laterAdditionalBiomeKeys],
    lists.routeKeys.filter((routeKey) => fixedLoadout(catalog, routeKey)),
    catalog.aspects.values.filter((aspect) => isSelene(catalog, aspect.key)).map((a) => a.key),
    lists.blessings.map((blessing) => `${blessing.key}:${blessing.operandKeys.join(',')}`),
    POM_RARITIES,
    lists.hex?.layouts.values.map((layout) => layout.key) ?? [],
    lists.hex === undefined
      ? []
      : lists.hex.layouts.values.flatMap((layout) =>
          authoredHexNodes(layout).map(
            (node) =>
              `${layout.key}:${node.key}:${hexNodeTalentDomain(lists.hex!, layout.key, node.key).join(',')}`,
          ),
        ),
  ];
  // FNV-1a over the joined lists.
  let hash = 0x811c9dc5;
  for (const char of parts.map((part) => part.join('|')).join('#')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let text = '';
  for (let index = 0; index < FINGERPRINT_CHARS; index += 1)
    text += ALPHABET[(hash >>> (27 - index * 5)) & 31];
  return text;
}

/** Bits to hold an index below `size`. */
const widthFor = (size: number): number => (size <= 1 ? 0 : Math.ceil(Math.log2(size)));

class Malformed extends Error {}

class BitWriter {
  readonly bits: number[] = [];
  write(value: number, width: number): void {
    for (let bit = width - 1; bit >= 0; bit -= 1) this.bits.push(Math.floor(value / 2 ** bit) % 2);
  }
  flag(on: boolean): void {
    this.write(on ? 1 : 0, 1);
  }
  index(list: readonly string[], key: string): void {
    const index = list.indexOf(key);
    if (index < 0) throw new Error(`share code cannot index ${key}`);
    this.write(index, widthFor(list.length));
  }
  /** A length-prefixed unsigned integer up to 32 bits. */
  uint(value: number): void {
    this.write(bitWidth(value), 6);
    this.write(value, bitWidth(value));
  }
  /** A count behind its width, which takes `prefix` bits. */
  count(value: number, prefix: number): void {
    if (bitWidth(value) >= 2 ** prefix) throw new Error(`share code cannot count ${value}`);
    this.write(bitWidth(value), prefix);
    this.write(value, bitWidth(value));
  }
}

/** Bits to hold this unsigned value. */
const bitWidth = (value: number): number => (value === 0 ? 0 : Math.floor(Math.log2(value)) + 1);

class BitReader {
  private position = 0;
  constructor(private readonly bits: readonly number[]) {}
  read(width: number): number {
    if (this.position + width > this.bits.length) throw new Malformed();
    let value = 0;
    for (let bit = 0; bit < width; bit += 1) value = value * 2 + this.bits[this.position++]!;
    return value;
  }
  flag(): boolean {
    return this.read(1) === 1;
  }
  index<T>(list: readonly T[]): T {
    const value = list[this.read(widthFor(list.length))];
    if (value === undefined) throw new Malformed();
    return value;
  }
  uint(): number {
    const width = this.read(6);
    if (width > 32) throw new Malformed();
    return this.read(width);
  }
  count(prefix: number): number {
    return this.read(this.read(prefix));
  }
  /** The next `width` bits as their own reader. */
  slice(width: number): BitReader {
    if (this.position + width > this.bits.length) throw new Malformed();
    this.position += width;
    return new BitReader(this.bits.slice(this.position - width, this.position));
  }
  /** Only the zero padding of the last character may remain. */
  finish(): void {
    const rest = this.bits.slice(this.position);
    if (rest.length >= 5 || rest.some((bit) => bit !== 0)) throw new Malformed();
  }
}

function writeBiomeRecord<T>(
  writer: BitWriter,
  lists: ShareLists,
  record: Readonly<Record<string, T>>,
  writeValue: (value: T) => void,
): void {
  writer.flag(Object.keys(record).length > 0);
  if (Object.keys(record).length === 0) return;
  for (const biomeKey of lists.biomeKeys) {
    writer.flag(Object.hasOwn(record, biomeKey));
    if (Object.hasOwn(record, biomeKey)) writeValue(record[biomeKey]!);
  }
}

function readBiomeRecord<T>(
  reader: BitReader,
  lists: ShareLists,
  readValue: () => T,
): Record<string, T> {
  const record: Record<string, T> = {};
  if (!reader.flag()) return record;
  for (const biomeKey of lists.biomeKeys) if (reader.flag()) record[biomeKey] = readValue();
  return record;
}

const writeKeyList = (
  writer: BitWriter,
  list: readonly string[],
  keys: readonly string[],
): void => {
  writer.write(keys.length, widthFor(list.length + 1));
  for (const key of keys) writer.index(list, key);
};

const readKeyList = (reader: BitReader, list: readonly string[]): string[] =>
  Array.from({ length: reader.read(widthFor(list.length + 1)) }, () => reader.index(list));

const TAG_WIDTH = 5;
/** Width prefixes: option counts stay below 128, payload lengths below 2^15. */
const COUNT_PREFIX = 3;
const LENGTH_PREFIX = 4;

/**
 * The draft: its world in fixed order, then the stored options as tagged entries (a count, then
 * per entry its tag, payload length and payload). A whole number fills its payload.
 */
function writeDraft(writer: BitWriter, lists: ShareLists, draft: AuthoredDraftSpec): void {
  writeKeyList(writer, lists.godKeys, draft.godKeys);
  writeKeyList(writer, lists.traitKeys, draft.basketTraitKeys);
  writeBiomeRecord(writer, lists, draft.storyNpcByBiome, (key) =>
    writer.index(lists.storyNpcKeys, key),
  );
  writeBiomeRecord(writer, lists, draft.fieldNpcsByBiome, (keys) =>
    writeKeyList(writer, lists.fieldNpcKeys, keys),
  );
  writeBiomeRecord(writer, lists, draft.rackKeepsakeByBiome, (key) =>
    writer.index(lists.keepsakeKeys, key),
  );
  writer.uint(draft.seed);
  const stored = DRAFT_OPTION_KEYS.filter((key) => draft[key] !== undefined);
  writer.count(stored.length, COUNT_PREFIX);
  for (const key of stored) {
    const value = draft[key]!;
    const declaration: DraftOptionDeclaration = DRAFT_OPTIONS[key];
    const payload = new BitWriter();
    switch (declaration.kind) {
      case 'flag':
        break;
      case 'integer':
        payload.write(value as number, bitWidth(value as number));
        break;
      case 'choice': {
        const index = declaration.choices.indexOf(value as string);
        payload.write(index, bitWidth(index));
        break;
      }
      case 'perBiome':
        writeBiomeRecord(payload, lists, value as Readonly<Record<string, number>>, (count) =>
          payload.count(count, LENGTH_PREFIX),
        );
        break;
    }
    writer.write(declaration.tag, TAG_WIDTH);
    writer.count(payload.bits.length, LENGTH_PREFIX);
    writer.bits.push(...payload.bits);
  }
}

/** The raw draft fields a code carries; an unknown option tag is skipped, a repeated one ignored. */
function readDraft(reader: BitReader, lists: ShareLists): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    godKeys: readKeyList(reader, lists.godKeys),
    basketTraitKeys: readKeyList(reader, lists.traitKeys),
    storyNpcByBiome: readBiomeRecord(reader, lists, () => reader.index(lists.storyNpcKeys)),
    fieldNpcsByBiome: readBiomeRecord(reader, lists, () => readKeyList(reader, lists.fieldNpcKeys)),
    rackKeepsakeByBiome: readBiomeRecord(reader, lists, () => reader.index(lists.keepsakeKeys)),
    seed: reader.uint(),
  };
  for (let remaining = reader.count(COUNT_PREFIX); remaining > 0; remaining -= 1) {
    const tag = reader.read(TAG_WIDTH);
    const length = reader.count(LENGTH_PREFIX);
    const payload = reader.slice(length);
    const key = DRAFT_OPTION_KEYS.find((option) => DRAFT_OPTIONS[option].tag === tag);
    if (key === undefined || Object.hasOwn(raw, key)) continue;
    const declaration: DraftOptionDeclaration = DRAFT_OPTIONS[key];
    switch (declaration.kind) {
      case 'flag':
        raw[key] = true;
        break;
      case 'integer':
        raw[key] = payload.read(length);
        break;
      case 'choice':
        raw[key] = declaration.choices[payload.read(length)];
        break;
      case 'perBiome':
        raw[key] = readBiomeRecord(payload, lists, () => payload.count(LENGTH_PREFIX));
        break;
    }
  }
  return raw;
}

/** The share code for these inputs: version, fingerprint, then the packed positions in base32. */
export function encodeDraftShareCode(catalog: Catalog, inputs: DraftShareInputs): string {
  const lists = shareLists(catalog);
  const route = catalog.routes.byKey[inputs.routeKey];
  if (route === undefined) throw new Error(`unknown route ${inputs.routeKey}`);
  const writer = new BitWriter();
  writer.index(lists.routeKeys, inputs.routeKey);
  if (route.dreamItinerary !== undefined) {
    writer.write(inputs.itineraryBiomeKeys.length, widthFor(route.dreamItinerary.biomeCount + 1));
    for (const biomeKey of inputs.itineraryBiomeKeys) writer.index(lists.biomeKeys, biomeKey);
  }
  writer.write(inputs.configuredBiomeCount, widthFor(inputs.itineraryBiomeKeys.length + 1));

  if (!fixedLoadout(catalog, inputs.routeKey)) {
    const loadout = inputs.loadout;
    const weaponIndex = lists.weapons.findIndex((weapon) => weapon.key === loadout.weaponKey);
    const weapon = lists.weapons[weaponIndex];
    if (weapon === undefined) throw new Error(`share code cannot index ${loadout.weaponKey}`);
    writer.write(weaponIndex, widthFor(lists.weapons.length));
    writer.index(weapon.aspectKeys, loadout.aspectKey!);
    writer.index(lists.keepsakeKeys, loadout.startingKeepsakeKey!);
    writer.index(lists.familiarKeys, loadout.familiarKey!);
    const manual = new Set(loadout.manualArcanaKeys);
    writer.flag(manual.size > 0);
    if (manual.size > 0) for (const key of lists.manualArcanaKeys) writer.flag(manual.has(key));
    const ranked = lists.vows.some((vow) => (loadout.fearRanks[vow.key] ?? 0) > 0);
    writer.flag(ranked);
    if (ranked)
      for (const vow of lists.vows) {
        const rank = loadout.fearRanks[vow.key] ?? 0;
        writer.flag(rank > 0);
        if (rank > 0) writer.write(rank - 1, widthFor(vow.maximum));
      }
    if (isSelene(catalog, loadout.aspectKey))
      writeHexTree(writer, catalog, lists, loadout.aspectHexTree!);
    writeEquipResults(writer, lists, loadout.keepsakeEquipResults);
  }

  writeDraft(writer, lists, inputs.draft);

  while (writer.bits.length % 5 !== 0) writer.bits.push(0);
  let payload = '';
  for (let index = 0; index < writer.bits.length; index += 5) {
    let value = 0;
    for (let bit = 0; bit < 5; bit += 1) value = value * 2 + writer.bits[index + bit]!;
    payload += ALPHABET[value];
  }
  return `${ALPHABET[LAYOUT_VERSION]}${fingerprint(catalog, lists)}${payload}`;
}

function writeHexTree(
  writer: BitWriter,
  catalog: Catalog,
  lists: ShareLists,
  tree: AuthoredHexTreeConfiguration,
): void {
  const hex = lists.hex!;
  const layoutKeys = hex.layouts.values.map((layout) => layout.key);
  writer.index(layoutKeys, tree.layoutKey);
  const defaultTree = createDefaultAuthoredHexTree(catalog, SELENE_SPELL, tree.layoutKey);
  const layout = hex.layouts.byKey[tree.layoutKey]!;
  const nodes = authoredHexNodes(layout);
  const isDefault = nodes.every((node) => tree.nodes[node.key] === defaultTree.nodes[node.key]);
  writer.flag(isDefault);
  if (isDefault) return;
  for (const node of nodes)
    writer.index(hexNodeTalentDomain(hex, layout.key, node.key), tree.nodes[node.key]!);
}

function readHexTree(
  reader: BitReader,
  catalog: Catalog,
  lists: ShareLists,
): AuthoredHexTreeConfiguration {
  const hex = lists.hex;
  if (hex === undefined) throw new Malformed();
  const layout = reader.index(hex.layouts.values);
  if (reader.flag()) return createDefaultAuthoredHexTree(catalog, SELENE_SPELL, layout.key);
  const nodes = Object.fromEntries(
    authoredHexNodes(layout).map((node) => [
      node.key,
      reader.index(hexNodeTalentDomain(hex, layout.key, node.key)),
    ]),
  );
  try {
    return normalizeAuthoredHexTree(catalog, SELENE_SPELL, { layoutKey: layout.key, nodes });
  } catch {
    throw new Malformed();
  }
}

/**
 * Reads a share code, refusing one from another layout, catalog or route rather than
 * decoding it into other keys. The draft passes the project codec's tolerant draft decode.
 */
export function decodeDraftShareCode(
  catalog: Catalog,
  code: string,
  route?: Pick<AuthoredRoutePlan, 'routeKey' | 'itineraryBiomeKeys'>,
): DraftShareCodeDecoding {
  const refuse = (refusal: DraftShareCodeRefusal): DraftShareCodeDecoding =>
    Object.freeze({ ok: false, refusal });
  const text = code.replace(/[\s-]/g, '').toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0');
  if (text.length <= 1 + FINGERPRINT_CHARS || [...text].some((char) => !ALPHABET.includes(char)))
    return refuse('badLayout');
  const version = ALPHABET.indexOf(text[0]!);
  if (version < LAYOUT_VERSION) return refuse('olderVersion');
  if (version !== LAYOUT_VERSION) return refuse('otherVersion');
  const lists = shareLists(catalog);
  if (text.slice(1, 1 + FINGERPRINT_CHARS) !== fingerprint(catalog, lists))
    return refuse('otherFingerprint');
  const bits = [...text.slice(1 + FINGERPRINT_CHARS)].flatMap((char) => {
    const value = ALPHABET.indexOf(char);
    return [4, 3, 2, 1, 0].map((bit) => (value >> bit) & 1);
  });
  let inputs: DraftShareInputs;
  try {
    inputs = readInputs(new BitReader(bits), catalog, lists);
  } catch (error) {
    if (error instanceof Malformed) return refuse('malformed');
    throw error;
  }
  if (
    route !== undefined &&
    (route.routeKey !== inputs.routeKey ||
      route.itineraryBiomeKeys.join() !== inputs.itineraryBiomeKeys.join())
  )
    return refuse('otherRoute');
  return Object.freeze({ ok: true, inputs });
}

function readInputs(reader: BitReader, catalog: Catalog, lists: ShareLists): DraftShareInputs {
  const routeKey = reader.index(lists.routeKeys);
  const route = catalog.routes.byKey[routeKey]!;
  let itineraryBiomeKeys: readonly string[] = route.biomeKeys;
  if (route.dreamItinerary !== undefined) {
    const count = reader.read(widthFor(route.dreamItinerary.biomeCount + 1));
    itineraryBiomeKeys = Array.from({ length: count }, () => reader.index(lists.biomeKeys));
    const assessment = assessPublicDreamItinerary(catalog, itineraryBiomeKeys);
    if (!assessment.legal || !assessment.complete) throw new Malformed();
  }
  const configuredBiomeCount = reader.read(widthFor(itineraryBiomeKeys.length + 1));
  if (configuredBiomeCount > itineraryBiomeKeys.length) throw new Malformed();

  let loadout: DraftShareLoadout;
  if (fixedLoadout(catalog, routeKey)) {
    loadout = {
      weaponKey: null,
      aspectKey: null,
      startingKeepsakeKey: null,
      familiarKey: null,
      manualArcanaKeys: [],
      fearRanks: Object.fromEntries(lists.vows.map((vow) => [vow.key, 0])),
    };
  } else {
    const weapon = reader.index(lists.weapons);
    const aspectKey = reader.index(weapon.aspectKeys);
    const startingKeepsakeKey = reader.index(lists.keepsakeKeys);
    const familiarKey = reader.index(lists.familiarKeys);
    const manualArcanaKeys = reader.flag()
      ? lists.manualArcanaKeys.filter(() => reader.flag())
      : [];
    const ranked = reader.flag();
    const fearRanks = Object.fromEntries(
      lists.vows.map((vow) => {
        const rank = ranked && reader.flag() ? reader.read(widthFor(vow.maximum)) + 1 : 0;
        if (rank > vow.maximum) throw new Malformed();
        return [vow.key, rank];
      }),
    );
    if (!assessStartingArcanaGrasp(catalog, manualArcanaKeys, fearRanks).legal)
      throw new Malformed();
    loadout = {
      weaponKey: weapon.key,
      aspectKey,
      startingKeepsakeKey,
      familiarKey,
      manualArcanaKeys,
      fearRanks,
      ...(isSelene(catalog, aspectKey)
        ? { aspectHexTree: readHexTree(reader, catalog, lists) }
        : {}),
    };
    const keepsakeEquipResults = readEquipResults(reader, catalog, lists);
    if (keepsakeEquipResults !== undefined) loadout = { ...loadout, keepsakeEquipResults };
  }

  const draft = decodeDraftSpec(readDraft(reader, lists), catalog, routeKey);
  reader.finish();
  return Object.freeze({
    routeKey,
    itineraryBiomeKeys: Object.freeze([...itineraryBiomeKeys]),
    configuredBiomeCount,
    loadout: Object.freeze(loadout),
    draft,
  });
}

/** The project's own draft inputs. */
export function projectDraftShareInputs(project: ProjectDocument): DraftShareInputs {
  const route = project.route;
  const loadout = route.loadout;
  return Object.freeze({
    routeKey: route.routeKey,
    itineraryBiomeKeys: route.itineraryBiomeKeys,
    configuredBiomeCount: route.biomes.length,
    loadout: Object.freeze({
      weaponKey: loadout.weaponKey,
      aspectKey: loadout.aspectKey,
      startingKeepsakeKey: loadout.startingKeepsakeKey,
      familiarKey: loadout.familiarKey,
      manualArcanaKeys: loadout.manualArcanaKeys,
      fearRanks: loadout.fearRanks,
      ...(loadout.aspectHexTree === undefined ? {} : { aspectHexTree: loadout.aspectHexTree }),
      ...(loadout.keepsakeEquipResults === undefined ||
      Object.keys(loadout.keepsakeEquipResults).length === 0
        ? {}
        : { keepsakeEquipResults: loadout.keepsakeEquipResults }),
    }),
    draft: route.draft,
  });
}

/**
 * The commands that install decoded inputs on a project of the same route, applied as one
 * transaction. Arcana clear before the Vows change, so Vow of Void never refuses a step.
 */
export function draftShareCommands(
  catalog: Catalog,
  project: ProjectDocument,
  inputs: DraftShareInputs,
): readonly ProjectCommand[] {
  const route = createRouteAddress(project.route.routeKey);
  if (
    inputs.routeKey !== project.route.routeKey ||
    inputs.itineraryBiomeKeys.join() !== project.route.itineraryBiomeKeys.join()
  )
    throw new ProjectCommandContractError(
      'ReplaceDraftSpec',
      route,
      `share inputs are for route ${inputs.routeKey} ${inputs.itineraryBiomeKeys.join('')}`,
    );
  const loadout = inputs.loadout;
  const commands: ProjectCommand[] = [
    { kind: 'ConfigureRoutePrefix', route, configuredBiomeCount: inputs.configuredBiomeCount },
  ];
  if (!fixedLoadout(catalog, inputs.routeKey)) {
    commands.push(
      { kind: 'ReplaceManualArcanaSelection', route, arcanaKeys: [] },
      ...catalog.fearVows.values.map((vow): ProjectCommand => ({
        kind: 'ReplaceFearVowRank',
        route,
        vowKey: vow.key,
        rank: loadout.fearRanks[vow.key] ?? 0,
      })),
      { kind: 'ReplaceManualArcanaSelection', route, arcanaKeys: loadout.manualArcanaKeys },
      {
        kind: 'ReplaceRouteLoadout',
        route,
        weaponKey: loadout.weaponKey!,
        aspectKey: loadout.aspectKey!,
      },
      ...(loadout.aspectHexTree === undefined
        ? []
        : [{ kind: 'ReplaceAspectHexTree', route, value: loadout.aspectHexTree } as const]),
      { kind: 'ReplaceFamiliar', route, familiarKey: loadout.familiarKey! },
      {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress(project.route.routeKey),
        keepsakeKey: loadout.startingKeepsakeKey!,
      },
      ...equipResultCommands(project.route.routeKey, loadout.keepsakeEquipResults),
    );
  }
  commands.push({ kind: 'ReplaceDraftSpec', route, draft: inputs.draft });
  return Object.freeze(commands);
}

/** The starting keepsake's chosen equip results: a flag, then each kind present. */
function writeEquipResults(
  writer: BitWriter,
  lists: ShareLists,
  results: AuthoredKeepsakeEquipResults | undefined,
): void {
  const pom = results?.jeweledPom;
  const hammer = results?.experimentalHammer;
  const embryo = results?.transcendentEmbryo;
  writer.flag(pom !== undefined || hammer !== undefined || embryo !== undefined);
  if (pom === undefined && hammer === undefined && embryo === undefined) return;
  writer.flag(pom !== undefined);
  if (pom !== undefined) {
    writer.index(lists.traitKeys, pom.traitKey);
    writer.flag(pom.rarity !== undefined);
    if (pom.rarity !== undefined) writer.index(POM_RARITIES, pom.rarity);
  }
  writer.flag(hammer !== undefined);
  if (hammer !== undefined) {
    writer.flag(hammer.kind === 'selected');
    if (hammer.kind === 'selected') writer.index(lists.traitKeys, hammer.traitKey);
  }
  writer.flag(embryo !== undefined);
  if (embryo !== undefined) {
    const index = lists.blessings.findIndex((blessing) => blessing.key === embryo.blessingKey);
    const blessing = lists.blessings[index];
    if (blessing === undefined) throw new Error(`share code cannot index ${embryo.blessingKey}`);
    writer.write(index, widthFor(lists.blessings.length));
    for (const operandKey of blessing.operandKeys) {
      const value = embryo.blessingValues[operandKey];
      writer.flag(value !== undefined);
      if (value === undefined) continue;
      // Thousandths, signed: finer than any declared operand step.
      writer.flag(value < 0);
      writer.uint(Math.round(Math.abs(value) * 1000));
    }
  }
}

function readEquipResults(
  reader: BitReader,
  catalog: Catalog,
  lists: ShareLists,
): AuthoredKeepsakeEquipResults | undefined {
  if (!reader.flag()) return undefined;
  const results: {
    jeweledPom?: NonNullable<AuthoredKeepsakeEquipResults['jeweledPom']>;
    experimentalHammer?: NonNullable<AuthoredKeepsakeEquipResults['experimentalHammer']>;
    transcendentEmbryo?: NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']>;
  } = {};
  if (reader.flag()) {
    const traitKey = reader.index(lists.traitKeys);
    results.jeweledPom = reader.flag()
      ? { traitKey, rarity: reader.index(POM_RARITIES) }
      : { traitKey };
  }
  if (reader.flag())
    results.experimentalHammer = reader.flag()
      ? { kind: 'selected', traitKey: reader.index(lists.traitKeys) }
      : { kind: 'exhausted' };
  if (reader.flag()) {
    const blessing = reader.index(lists.blessings);
    const blessingValues: Record<string, number> = {};
    for (const operandKey of blessing.operandKeys) {
      if (!reader.flag()) continue;
      const negative = reader.flag();
      blessingValues[operandKey] = ((negative ? -1 : 1) * reader.uint()) / 1000;
    }
    try {
      results.transcendentEmbryo = normalizeAuthoredTranscendentEmbryoOutcome(catalog, {
        blessingKey: blessing.key,
        blessingValues,
      });
    } catch {
      throw new Malformed();
    }
  }
  return Object.freeze(results);
}

/** Commands that install the starting keepsake's chosen equip results. */
function equipResultCommands(
  routeKey: string,
  results: AuthoredKeepsakeEquipResults | undefined,
): readonly ProjectCommand[] {
  const selection = createRouteStartKeepsakeSelectionAddress(routeKey);
  const commands: ProjectCommand[] = [];
  if (results?.jeweledPom !== undefined)
    commands.push({
      kind: 'ReplaceJeweledPomEquipResult',
      result: createKeepsakeEquipResultAddress(selection, 'jeweledPom'),
      value: results.jeweledPom,
    });
  if (results?.experimentalHammer !== undefined)
    commands.push({
      kind: 'ReplaceExperimentalHammerEquipResult',
      result: createKeepsakeEquipResultAddress(selection, 'experimentalHammer'),
      value: results.experimentalHammer,
    });
  if (results?.transcendentEmbryo !== undefined)
    commands.push({
      kind: 'ReplaceTranscendentEmbryoEquipResult',
      result: createKeepsakeEquipResultAddress(selection, 'transcendentEmbryo'),
      value: results.transcendentEmbryo,
    });
  return commands;
}

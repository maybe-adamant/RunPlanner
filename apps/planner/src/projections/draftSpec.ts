import type { AuthoredDraftSpec, ProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog, TraitOrdinaryBoonSlot } from '@run-planner/engine/catalog-schema';
import {
  assessDraftBasket,
  draftSourceQueues,
  draftKeepsakeOptions,
  draftOrderRefusals,
  draftWorldOptions,
  type DraftCapUsage,
  type DraftGiverCapUsage,
  type DraftKeepsakeOptions,
  type DraftSpec,
  type DraftTraitAssessment,
  type DraftWorldOptions,
} from '@run-planner/engine/simulation';

/** A Postboss rack slot; a slot without its own choice inherits the previous keepsake. */
export interface DraftRackSlot {
  readonly afterBiomeKey: string;
  readonly keepsakeKeys: readonly string[];
  /** The keepsake held arriving at this rack; choosing it again stores no change. */
  readonly inheritedKeepsakeKey: string | null;
  readonly effectiveKeepsakeKey: string | null;
  /** The slot's own choice, or null to keep the held keepsake. */
  readonly keepsakeKey: string | null;
}

export interface DraftSpecProjection {
  readonly worldOptions: DraftWorldOptions;
  readonly keepsakeOptions: DraftKeepsakeOptions;
  readonly rackSlots: readonly DraftRackSlot[];
  /** Absent while the project's loadout has no weapon, aspect, familiar or keepsake. */
  readonly spec?: DraftSpec;
}

/**
 * The spec a draft runs with: the project's own loadout plus the saved world,
 * basket and racks, kept to the choices the current itinerary still offers.
 */
export function projectDraftSpec(catalog: Catalog, project: ProjectDocument): DraftSpecProjection {
  const route = project.route;
  const draft = route.draft;
  const worldOptions = draftWorldOptions(catalog, route);
  const keepsakeOptions = draftKeepsakeOptions(catalog, route);
  const storyNpcByBiome: Record<string, string> = {};
  const fieldNpcsByBiome: Record<string, readonly string[]> = {};
  for (const biome of worldOptions.biomes) {
    const story = draft.storyNpcByBiome[biome.biomeKey];
    if (story !== undefined && biome.storyNpc?.npcKey === story)
      storyNpcByBiome[biome.biomeKey] = story;
    const fields = (draft.fieldNpcsByBiome[biome.biomeKey] ?? []).filter((npcKey) =>
      biome.fieldNpcs.some((npc) => npc.npcKey === npcKey),
    );
    if (fields.length > 0) fieldNpcsByBiome[biome.biomeKey] = fields;
  }
  const { weaponKey, aspectKey, familiarKey, startingKeepsakeKey } = route.loadout;
  let held = startingKeepsakeKey;
  const rackSlots = keepsakeOptions.rackSlots.map((slot): DraftRackSlot => {
    const chosen = draft.rackKeepsakeByBiome[slot.afterBiomeKey];
    // A saved keepsake the rack does not offer stays, so the engine's refusal blocks the draft.
    const keepsakeKey =
      chosen !== undefined && chosen !== held && catalog.keepsakes.byKey[chosen] !== undefined
        ? chosen
        : null;
    const inheritedKeepsakeKey = held;
    held = keepsakeKey ?? held;
    return Object.freeze({
      ...slot,
      inheritedKeepsakeKey,
      effectiveKeepsakeKey: held,
      keepsakeKey,
    });
  });
  const projection = { worldOptions, keepsakeOptions, rackSlots };
  if (
    weaponKey === null ||
    aspectKey === null ||
    familiarKey === null ||
    startingKeepsakeKey === null
  )
    return Object.freeze(projection);
  return Object.freeze({
    ...projection,
    spec: Object.freeze({
      loadout: {
        weaponKey,
        aspectKey,
        familiarKey,
        startingKeepsakeKey,
        manualArcanaKeys: route.loadout.manualArcanaKeys,
        fearRanks: route.loadout.fearRanks,
        ...(route.loadout.aspectHexTree === undefined
          ? {}
          : { aspectHexTree: route.loadout.aspectHexTree }),
      },
      world: {
        godKeys: draft.godKeys.filter((key) => worldOptions.godKeys.includes(key)),
        storyNpcByBiome,
        fieldNpcsByBiome,
      },
      basketTraitKeys: draft.basketTraitKeys,
      rackKeepsakeKeys: rackSlots.map((slot) => slot.keepsakeKey),
    }),
  });
}

function toggled(values: readonly string[], value: string): readonly string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

export function withDraftGodToggled(draft: AuthoredDraftSpec, godKey: string): AuthoredDraftSpec {
  return { ...draft, godKeys: toggled(draft.godKeys, godKey) };
}

export function withDraftBasketTraitToggled(
  draft: AuthoredDraftSpec,
  traitKey: string,
): AuthoredDraftSpec {
  return { ...draft, basketTraitKeys: toggled(draft.basketTraitKeys, traitKey) };
}

export function withDraftStoryNpcToggled(
  draft: AuthoredDraftSpec,
  biomeKey: string,
  npcKey: string,
): AuthoredDraftSpec {
  const { [biomeKey]: current, ...rest } = draft.storyNpcByBiome;
  return {
    ...draft,
    storyNpcByBiome: current === npcKey ? rest : { ...rest, [biomeKey]: npcKey },
  };
}

/** A field NPC appears once per run, so choosing it in one biome moves it there. */
export function withDraftFieldNpcToggled(
  draft: AuthoredDraftSpec,
  biomeKey: string,
  npcKey: string,
): AuthoredDraftSpec {
  const fieldNpcsByBiome: Record<string, readonly string[]> = {};
  for (const [otherKey, npcKeys] of Object.entries(draft.fieldNpcsByBiome))
    fieldNpcsByBiome[otherKey] =
      otherKey === biomeKey ? npcKeys : npcKeys.filter((key) => key !== npcKey);
  fieldNpcsByBiome[biomeKey] = toggled(draft.fieldNpcsByBiome[biomeKey] ?? [], npcKey);
  return {
    ...draft,
    fieldNpcsByBiome: Object.fromEntries(
      Object.entries(fieldNpcsByBiome).filter(([, npcKeys]) => npcKeys.length > 0),
    ),
  };
}

/** Choosing the keepsake already held at a rack stores no change, so it keeps inheriting. */
export function withDraftRackKeepsake(
  draft: AuthoredDraftSpec,
  slot: Pick<DraftRackSlot, 'afterBiomeKey' | 'inheritedKeepsakeKey'>,
  keepsakeKey: string,
): AuthoredDraftSpec {
  const rackKeepsakeByBiome = { ...draft.rackKeepsakeByBiome };
  if (keepsakeKey === slot.inheritedKeepsakeKey) delete rackKeepsakeByBiome[slot.afterBiomeKey];
  else rackKeepsakeByBiome[slot.afterBiomeKey] = keepsakeKey;
  return { ...draft, rackKeepsakeByBiome };
}

export interface DraftBasketRow {
  readonly traitKey: string;
  readonly label: string;
  readonly inBasket: boolean;
  readonly selectable: boolean;
  /** Present only when the refusal is not visible from the counts. */
  readonly hint?: string;
  /** A selected queued trait's place in its source's acquisition order, from 1. */
  readonly orderNumber?: number;
}

export interface DraftBasketSection {
  readonly key: string;
  readonly label: string;
  readonly cap?: DraftCapUsage;
  readonly rows: readonly DraftBasketRow[];
  readonly subsections: readonly DraftBasketSection[];
}

export interface DraftBasketTab {
  readonly key: 'gods' | 'bonus' | 'npcs';
  readonly label: string;
  readonly cap?: DraftCapUsage;
  readonly sections: readonly DraftBasketSection[];
}

export interface DraftBasketChip {
  readonly traitKey: string;
  readonly label: string;
  /** The engine refuses this basket trait, so the draft cannot start. */
  readonly refused: boolean;
  readonly hint?: string;
  /**
   * A source's queued trait: the basket with it swapped one place earlier or later,
   * absent at an end or where the swap would queue a trait above its prerequisite.
   */
  readonly order?: {
    readonly earlierBasket?: readonly string[];
    readonly laterBasket?: readonly string[];
  };
}

/** Basket chips by god, Hermes and Hammer in acquisition order, then every other basket trait. */
export interface DraftBasketChipGroup {
  readonly key: string;
  readonly label: string;
  /** A god, Hermes or Hammer row, whose chips are in acquisition order. */
  readonly queued: boolean;
  readonly chips: readonly DraftBasketChip[];
  /** Each of this source's traits queued above its prerequisite, as a visible line. */
  readonly orderNotes: readonly string[];
}

/** One cap on the panel's basket summary. */
export interface DraftBasketSummaryCap {
  readonly key: string;
  readonly label: string;
  readonly cap: DraftCapUsage;
}

export interface DraftBasketProjection {
  readonly tabs: readonly DraftBasketTab[];
  /** God boons, each bonus giver, then NPC traits. */
  readonly summary: readonly DraftBasketSummaryCap[];
  readonly chipGroups: readonly DraftBasketChipGroup[];
}

function refusalHint(
  catalog: Catalog,
  refusals: DraftTraitAssessment['refusals'],
): string | undefined {
  const label = (key: string) => catalog.traits.byKey[key]?.label ?? key;
  for (const refusal of refusals)
    switch (refusal.kind) {
      case 'slotTaken':
        return `Slot held by ${label(refusal.traitKey)}.`;
      case 'requirement':
        return refusal.requirementTraitKeys === undefined ||
          refusal.requirementTraitKeys.length === 0
          ? 'Requirements not met by the basket and loadout.'
          : `Needs ${refusal.requirementTraitKeys.map(label).join(' or ')}.`;
      case 'giverNotInWorld':
        return 'Its giver is not in the world.';
      case 'prerequisiteAfter':
        return `Needs ${refusal.traitKeys.map(label).join(' or ')} earlier.`;
      case 'draftIllegal':
      case 'wrongHammerLoadout':
      case 'cap':
      case 'totalCap':
        break;
    }
  return undefined;
}

/** Core slots in their in-game order: Attack, Special, Cast, Sprint, Magick gain. */
const SLOT_ORDER: readonly TraitOrdinaryBoonSlot[] = [
  'Melee',
  'Secondary',
  'Ranged',
  'Rush',
  'Mana',
];

/** Core slots first, then the other boons, then the Legendary. */
function godOrder(
  catalog: Catalog,
  trait: DraftTraitAssessment | undefined,
  traitKey: string,
): number {
  if (trait?.kind === 'legendary') return SLOT_ORDER.length + 1;
  const slot = catalog.traits.byKey[traitKey]?.equipmentSlot;
  const index = slot === undefined ? -1 : (SLOT_ORDER as readonly string[]).indexOf(slot);
  return index === -1 ? SLOT_ORDER.length : index;
}

/**
 * The basket picker: pool gods with one shared Duo section, the always-present
 * Hermes, Hammer and Selene givers, then the selected NPCs. Rows a draft never
 * takes, Duos with a god outside the pool and Hammers for another weapon or
 * aspect are left out unless already in the basket.
 */
export function projectDraftBasket(
  catalog: Catalog,
  project: ProjectDocument,
  spec: DraftSpec,
  worldOptions: DraftWorldOptions,
): DraftBasketProjection {
  const assessment = assessDraftBasket(catalog, project.route, spec);
  const byKey = new Map(assessment.traits.map((trait) => [trait.traitKey, trait]));
  const queues = draftSourceQueues(catalog, spec).filter((queue) => queue.traitKeys.length > 0);
  const orderNumbers = new Map(
    queues.flatMap((queue) => queue.traitKeys.map((key, index) => [key, index + 1] as const)),
  );
  const orderNumber = (traitKey: string) => {
    const number = orderNumbers.get(traitKey);
    return number === undefined ? {} : { orderNumber: number };
  };
  const row = (trait: DraftTraitAssessment): DraftBasketRow => {
    const hint = refusalHint(catalog, trait.refusals);
    return Object.freeze({
      traitKey: trait.traitKey,
      label: catalog.traits.byKey[trait.traitKey]?.label ?? trait.traitKey,
      inBasket: trait.inBasket,
      selectable: trait.selectable,
      ...(hint === undefined ? {} : { hint }),
      ...orderNumber(trait.traitKey),
    });
  };
  const hidden = (trait: DraftTraitAssessment) =>
    trait.refusals.some(
      (refusal) =>
        refusal.kind === 'draftIllegal' ||
        (refusal.kind === 'wrongHammerLoadout' && !trait.inBasket) ||
        (refusal.kind === 'giverNotInWorld' && trait.kind === 'duo' && !trait.inBasket),
    );
  const rowsOf = (traitKeys: readonly string[]): DraftBasketRow[] =>
    traitKeys.flatMap((key) => {
      const trait = byKey.get(key);
      return trait === undefined || hidden(trait) ? [] : [row(trait)];
    });
  const section = (
    key: string,
    label: string,
    rows: readonly DraftBasketRow[],
    cap?: DraftCapUsage,
    subsections: readonly DraftBasketSection[] = [],
  ): DraftBasketSection =>
    Object.freeze({
      key,
      label,
      ...(cap === undefined ? {} : { cap }),
      rows: Object.freeze([...rows]),
      subsections: Object.freeze([...subsections]),
    });
  const caps = assessment.caps;
  const giverCap = (usages: readonly DraftGiverCapUsage[], giverKey: string) =>
    usages.find((usage) => usage.giverKey === giverKey);
  const giverSection = (
    giverKey: string,
    usages: readonly DraftGiverCapUsage[],
  ): DraftBasketSection => {
    const giver = catalog.traitGivers.byKey[giverKey]!;
    return section(giverKey, giver.label, rowsOf(giver.traitKeys), giverCap(usages, giverKey));
  };

  const godSections = spec.world.godKeys.map((godKey) => {
    const giver = catalog.traitGivers.byKey[godKey]!;
    const own = giver.traitKeys
      .filter((key) => byKey.get(key)?.kind !== 'duo')
      .map((key, index) => ({ key, index, order: godOrder(catalog, byKey.get(key), key) }))
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map((entry) => entry.key);
    return section(godKey, giver.label, rowsOf(own), giverCap(caps.poolGods, godKey));
  });
  const duoKeys = [
    ...new Set(
      spec.world.godKeys.flatMap((godKey) =>
        catalog.traitGivers.byKey[godKey]!.traitKeys.filter(
          (key) => byKey.get(key)?.kind === 'duo',
        ),
      ),
    ),
  ];
  const duos = rowsOf(duoKeys);

  const bonus = worldOptions.bonusGiverKeys.map((giverKey) =>
    giverSection(giverKey, caps.providers),
  );

  const story = new Set<string>();
  const field = new Set<string>();
  for (const biome of worldOptions.biomes) {
    const storyNpc = biome.storyNpc;
    if (
      storyNpc?.giverKey !== undefined &&
      spec.world.storyNpcByBiome[biome.biomeKey] === storyNpc.npcKey
    )
      story.add(storyNpc.giverKey);
    for (const npc of biome.fieldNpcs)
      if (
        npc.giverKey !== undefined &&
        spec.world.fieldNpcsByBiome[biome.biomeKey]?.includes(npc.npcKey) === true
      )
        field.add(npc.giverKey);
  }
  const npcSections = [
    ...(story.size === 0
      ? []
      : [
          section(
            'story',
            'Story',
            [],
            undefined,
            [...story].map((k) => giverSection(k, caps.npcs)),
          ),
        ]),
    ...(field.size === 0
      ? []
      : [
          section(
            'field',
            'Field',
            [],
            undefined,
            [...field].map((k) => giverSection(k, caps.npcs)),
          ),
        ]),
  ];

  const tabs: DraftBasketTab[] = [
    {
      key: 'gods',
      label: 'Gods',
      cap: caps.poolGodTotal,
      sections: [...godSections, ...(duos.length === 0 ? [] : [section('duos', 'Duos', duos)])],
    },
    { key: 'bonus', label: 'Bonus', sections: bonus },
    { key: 'npcs', label: 'NPCs', cap: caps.npcTotal, sections: npcSections },
  ];

  const chip = (traitKey: string, order?: DraftBasketChip['order']): DraftBasketChip => {
    const trait = byKey.get(traitKey);
    // An order refusal is a visible note under its god's row, not a hint.
    const hint =
      trait === undefined
        ? undefined
        : refusalHint(
            catalog,
            trait.refusals.filter((refusal) => refusal.kind !== 'prerequisiteAfter'),
          );
    return Object.freeze({
      traitKey,
      label: catalog.traits.byKey[traitKey]?.label ?? traitKey,
      refused: trait === undefined || !trait.selectable,
      ...(hint === undefined ? {} : { hint }),
      ...(order === undefined ? {} : { order: Object.freeze(order) }),
    });
  };
  const swapped = (a: string, b: string) =>
    Object.freeze(spec.basketTraitKeys.map((key) => (key === a ? b : key === b ? a : key)));
  const orderRefusals = draftOrderRefusals(catalog, project.route, spec);
  const current = orderRefusals(spec.basketTraitKeys).size;
  // A move may not add an order refusal; while one stands, any move that adds none is open.
  const legalMove = (basketTraitKeys: readonly string[]) => {
    const after = orderRefusals(basketTraitKeys).size;
    return after === 0 || (current > 0 && after <= current);
  };
  const label = (key: string) => catalog.traits.byKey[key]?.label ?? key;
  const queued = new Set(queues.flatMap((queue) => queue.traitKeys));
  const others = spec.basketTraitKeys.filter((key) => !queued.has(key));
  const chipGroups: DraftBasketChipGroup[] = [
    ...queues.map((queue) =>
      Object.freeze({
        key: queue.giverKey,
        // The Hammer row drops "Daedalus" to fit the table's label column.
        label:
          catalog.traitGivers.byKey[queue.giverKey]?.providerKind === 'hammer'
            ? 'Hammer'
            : (catalog.traitGivers.byKey[queue.giverKey]?.label ?? queue.giverKey),
        queued: true,
        chips: Object.freeze(
          queue.traitKeys.map((traitKey, index, keys) => {
            const earlier =
              keys[index - 1] === undefined ? undefined : swapped(traitKey, keys[index - 1]!);
            const later =
              keys[index + 1] === undefined ? undefined : swapped(traitKey, keys[index + 1]!);
            return chip(traitKey, {
              ...(earlier === undefined || !legalMove(earlier) ? {} : { earlierBasket: earlier }),
              ...(later === undefined || !legalMove(later) ? {} : { laterBasket: later }),
            });
          }),
        ),
        orderNotes: Object.freeze(
          queue.traitKeys.flatMap((traitKey) => {
            const refusal = byKey
              .get(traitKey)
              ?.refusals.find((candidate) => candidate.kind === 'prerequisiteAfter');
            return refusal?.kind === 'prerequisiteAfter'
              ? [`${label(traitKey)} needs ${refusal.traitKeys.map(label).join(' or ')} first.`]
              : [];
          }),
        ),
      }),
    ),
    ...(others.length === 0
      ? []
      : [
          Object.freeze({
            key: 'other',
            label: 'Other',
            queued: false,
            chips: Object.freeze(others.map((key) => chip(key))),
            orderNotes: Object.freeze([]),
          }),
        ]),
  ];
  const summary: DraftBasketSummaryCap[] = [
    { key: 'gods', label: 'God boons', cap: caps.poolGodTotal },
    ...caps.providers.map((usage) => ({
      key: usage.giverKey,
      label:
        usage.providerKind === 'hammer'
          ? 'Hammer'
          : (catalog.traitGivers.byKey[usage.giverKey]?.label ?? usage.giverKey),
      cap: usage,
    })),
    { key: 'npcs', label: 'NPCs', cap: caps.npcTotal },
  ];
  return Object.freeze({
    tabs: Object.freeze(tabs.map((tab) => Object.freeze(tab))),
    summary: Object.freeze(summary),
    chipGroups: Object.freeze(chipGroups),
  });
}

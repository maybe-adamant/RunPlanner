import type {
  CatalogCollection,
  HexDeclaration,
  HexLayoutDeclaration,
  HexLayoutKey,
  HexLayoutNodeDeclaration,
  HexNodeKind,
  HexRepeatableTalentDeclaration,
  KeepsakeDeclaration,
  TraitDeclaration,
  TraitGiverDeclaration,
} from '@run-planner/engine/catalog-schema';

import {
  createCollection,
  freezeUniqueStrings,
  requireArray,
  requireNonEmpty,
  requireNonNegativeInteger,
  requireObject,
  requirePositiveInteger,
} from '../common';
import { fail } from '../errors';
import type { RawHexDeclaration, RawTraitCatalogInput } from '../../declarations/traits/types';

const LAYOUT_KEYS: readonly HexLayoutKey[] = ['Lung', 'Pyramid', 'Maze', 'Nacelle'];
const NODE_KINDS: readonly HexNodeKind[] = [
  'repeatable',
  'keystone',
  'legendary',
  'olympianSpell',
  'olympianCount',
];

function isOlympian(kind: HexNodeKind): boolean {
  return kind === 'olympianSpell' || kind === 'olympianCount';
}

function requireOffset(value: unknown, path: string): number {
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number');
  return value;
}

function normalizeLayout(value: unknown, path: string): HexLayoutDeclaration {
  const layout = requireObject(value, path);
  const key = layout.key;
  if (typeof key !== 'string' || !(LAYOUT_KEYS as readonly string[]).includes(key))
    fail(`${path}.key`, 'must be Lung, Pyramid, Maze, or Nacelle');
  const label = requireNonEmpty(layout.label as string, `${path}.label`);
  const depths = requireArray(layout.structure, `${path}.structure`).map((rawDepth, depthIndex) => {
    const depthPath = `${path}.structure[${depthIndex}]`;
    const entries = requireArray(rawDepth, depthPath);
    if (entries.length === 0) fail(depthPath, 'must declare at least one node');
    return entries.map((rawNode, nodeIndex) => {
      const nodePath = `${depthPath}[${nodeIndex}]`;
      const entry = requireObject(rawNode, nodePath);
      const kind = (entry.kind ?? 'repeatable') as HexNodeKind;
      if (!NODE_KINDS.includes(kind)) fail(`${nodePath}.kind`, 'is not a Hex node kind');
      const linkTo = requireArray(entry.linkTo ?? [], `${nodePath}.linkTo`).map((slot, index) =>
        requireNonNegativeInteger(slot as number, `${nodePath}.linkTo[${index}]`),
      );
      if (new Set(linkTo).size !== linkTo.length) fail(`${nodePath}.linkTo`, 'must be distinct');
      if (entry.bidirectional !== undefined && entry.bidirectional !== true)
        fail(`${nodePath}.bidirectional`, 'must be true when present');
      if (entry.bidirectional === true && linkTo.length === 0)
        fail(`${nodePath}.bidirectional`, 'requires links to the next depth');
      return {
        depth: depthIndex + 1,
        slot: requireNonNegativeInteger(entry.slot as number, `${nodePath}.slot`),
        kind,
        linkTo,
        bidirectional: entry.bidirectional === true,
        gridOffsetX: requireOffset(entry.gridOffsetX, `${nodePath}.gridOffsetX`),
        gridOffsetY: requireOffset(entry.gridOffsetY, `${nodePath}.gridOffsetY`),
        path: nodePath,
      };
    });
  });
  if (depths.length === 0) fail(`${path}.structure`, 'must declare at least one depth');
  for (const [depthIndex, nodes] of depths.entries()) {
    nodes.forEach((node, index) => {
      if (index > 0 && node.slot <= nodes[index - 1]!.slot)
        fail(`${node.path}.slot`, 'slots must ascend within a depth');
      const next = depths[depthIndex + 1];
      for (const slot of node.linkTo)
        if (next?.some((candidate) => candidate.slot === slot) !== true)
          fail(`${node.path}.linkTo`, `references missing node ${depthIndex + 2}:${slot}`);
    });
  }
  const linkFromOf = (depth: number, slot: number) =>
    (depths[depth - 2] ?? []).filter((node) => node.linkTo.includes(slot));
  const nodes = depths.flat().map((node): HexLayoutNodeDeclaration => {
    const backlinks = linkFromOf(node.depth, node.slot);
    if (node.depth > 1 && backlinks.length === 0)
      fail(node.path, 'must be linked from the previous depth');
    if (
      node.depth > 1 &&
      !isOlympian(node.kind) &&
      backlinks.every((source) => isOlympian(source.kind))
    )
      fail(node.path, 'must be reachable without the God Sent pair');
    return Object.freeze({
      key: `${node.depth}:${node.slot}`,
      depth: node.depth,
      slot: node.slot,
      kind: node.kind,
      linkTo: Object.freeze([...node.linkTo]),
      linkFrom: Object.freeze(backlinks.map((source) => source.slot)),
      bidirectional: node.bidirectional,
      gridOffsetX: node.gridOffsetX,
      gridOffsetY: node.gridOffsetY,
    });
  });
  const countOf = (kind: HexNodeKind) => nodes.filter((node) => node.kind === kind).length;
  if (countOf('olympianSpell') !== 1 || countOf('olympianCount') !== 1)
    fail(`${path}.structure`, 'must declare exactly one God Sent pair');
  const rareCount = countOf('keystone');
  const epicCount = countOf('legendary');
  if (rareCount === 0 || epicCount === 0)
    fail(`${path}.structure`, 'must declare Keystone and Legendary nodes');
  return Object.freeze({
    key: key as HexLayoutKey,
    label,
    nodes: createCollection(nodes, `${path}.nodes`, (node) => node.key),
    baseCapacity: nodes.length - 2,
    rareCount,
    epicCount,
  });
}

function normalizeRepeatables(
  value: unknown,
  path: string,
): CatalogCollection<HexRepeatableTalentDeclaration> {
  const talents = requireArray(value, path).map((raw, index) => {
    const talent = requireObject(raw, `${path}[${index}]`);
    return Object.freeze({
      key: requireNonEmpty(talent.key as string, `${path}[${index}].key`),
      label: requireNonEmpty(talent.label as string, `${path}[${index}].label`),
      ...(talent.maxCount === undefined
        ? {}
        : {
            maxCount: requirePositiveInteger(
              talent.maxCount as number,
              `${path}[${index}].maxCount`,
            ),
          }),
    });
  });
  if (!talents.some((talent) => talent.maxCount === undefined))
    fail(path, 'must include a talent without MaxCount so refills never run out');
  return createCollection(talents, path, (talent) => talent.key);
}

export function normalizeHexes(
  raw: RawTraitCatalogInput['hexes'],
): CatalogCollection<HexDeclaration> {
  const declarations = requireArray(raw, 'hexes').map(
    (value, index) => requireObject(value, `hexes[${index}]`) as unknown as RawHexDeclaration,
  );
  const repeatableByKey = new Map<string, HexRepeatableTalentDeclaration>();
  const values = declarations.map((hex, index) => {
    const path = `hexes[${index}]`;
    const layouts = requireArray(hex.layouts, `${path}.layouts`).map((value, layoutIndex) =>
      normalizeLayout(value, `${path}.layouts[${layoutIndex}]`),
    );
    if (
      layouts.length !== LAYOUT_KEYS.length ||
      layouts.some((layout, layoutIndex) => layout.key !== LAYOUT_KEYS[layoutIndex])
    )
      fail(`${path}.layouts`, 'must contain Lung, Pyramid, Maze, and Nacelle in declaration order');
    const normalizeCandidates = (
      rawCandidates: unknown,
      candidatePath: string,
    ): CatalogCollection<{ readonly key: string; readonly label: string }> => {
      const candidates = requireArray(rawCandidates, candidatePath).map((value, candidateIndex) => {
        const candidate = requireObject(value, `${candidatePath}[${candidateIndex}]`);
        return Object.freeze({
          key: requireNonEmpty(candidate.key as string, `${candidatePath}[${candidateIndex}].key`),
          label: requireNonEmpty(
            candidate.label as string,
            `${candidatePath}[${candidateIndex}].label`,
          ),
        });
      });
      const keys = freezeUniqueStrings(
        candidates.map((candidate) => candidate.key),
        `${candidatePath}.keys`,
      );
      if (keys.length !== candidates.length) fail(candidatePath, 'candidate keys must be distinct');
      return createCollection(candidates, candidatePath, (candidate) => candidate.key);
    };
    const rareCandidates = normalizeCandidates(hex.rareCandidates, `${path}.rareCandidates`);
    const epicCandidates = normalizeCandidates(hex.epicCandidates, `${path}.epicCandidates`);
    for (const layout of layouts)
      if (
        rareCandidates.values.length < layout.rareCount ||
        epicCandidates.values.length < layout.epicCount
      )
        fail(path, `must fill every Keystone and Legendary node of ${layout.key}`);
    const repeatableCandidates = normalizeRepeatables(
      hex.repeatableCandidates,
      `${path}.repeatableCandidates`,
    );
    for (const talent of repeatableCandidates.values) {
      const prior = repeatableByKey.get(talent.key);
      if (
        prior !== undefined &&
        (prior.label !== talent.label || prior.maxCount !== talent.maxCount)
      )
        fail(`${path}.repeatableCandidates.${talent.key}`, 'must match its other declarations');
      repeatableByKey.set(talent.key, talent);
    }
    const godSent = requireObject(hex.godSent, `${path}.godSent`);
    if (godSent.capacityDelta !== 2) fail(`${path}.godSent.capacityDelta`, 'must be 2');
    return Object.freeze({
      spellTraitKey: requireNonEmpty(hex.spellTraitKey, `${path}.spellTraitKey`),
      label: requireNonEmpty(hex.label, `${path}.label`),
      layouts: createCollection(layouts, `${path}.layouts`, (layout) => layout.key),
      rareCandidates,
      epicCandidates,
      repeatableCandidates,
      godSent: Object.freeze({
        providerKey: requireNonEmpty(godSent.providerKey as string, `${path}.godSent.providerKey`),
        forceKeepsakeKey: requireNonEmpty(
          godSent.forceKeepsakeKey as string,
          `${path}.godSent.forceKeepsakeKey`,
        ),
        olympianTalentKey: requireNonEmpty(
          godSent.olympianTalentKey as string,
          `${path}.godSent.olympianTalentKey`,
        ),
        olympianTalentLabel: requireNonEmpty(
          godSent.olympianTalentLabel as string,
          `${path}.godSent.olympianTalentLabel`,
        ),
        lineageTalentKey: requireNonEmpty(
          godSent.lineageTalentKey as string,
          `${path}.godSent.lineageTalentKey`,
        ),
        lineageTalentLabel: requireNonEmpty(
          godSent.lineageTalentLabel as string,
          `${path}.godSent.lineageTalentLabel`,
        ),
        capacityDelta: 2 as const,
      }),
    });
  });
  return createCollection(values, 'hexes', (hex) => hex.spellTraitKey, 'spellTraitKey');
}

export function validateHexBindings(input: {
  readonly hexes: CatalogCollection<HexDeclaration>;
  readonly traits: CatalogCollection<TraitDeclaration>;
  readonly givers: CatalogCollection<TraitGiverDeclaration>;
  readonly keepsakes: CatalogCollection<KeepsakeDeclaration>;
}): void {
  const spellGiver = input.givers.byKey.SpellDrop;
  const expectedBindings = {
    SpellPolymorphTrait: ['Zeus', 'ForceZeusBoonKeepsake', 'PolymorphZeusTalent'],
    SpellMeteorTrait: ['Hestia', 'ForceHestiaBoonKeepsake', 'MeteorHestiaTalent'],
    SpellTransformTrait: ['Aphrodite', 'ForceAphroditeBoonKeepsake', 'TransformAphroditeTalent'],
    SpellLeapTrait: ['Hephaestus', 'ForceHephaestusBoonKeepsake', 'LeapHephaestusTalent'],
    SpellLaserTrait: ['Apollo', 'ForceApolloBoonKeepsake', 'LaserApolloTalent'],
    SpellSummonTrait: ['Hera', 'ForceHeraBoonKeepsake', 'SummonHeraTalent'],
    SpellTimeSlowTrait: ['Demeter', 'ForceDemeterBoonKeepsake', 'TimeSlowDemeterTalent'],
    SpellPotionTrait: ['Poseidon', 'ForcePoseidonBoonKeepsake', 'PotionPoseidonTalent'],
    SpellMoonBeamTrait: ['Ares', 'ForceAresBoonKeepsake', 'MoonBeamAresTalent'],
  } as const;
  const expectedSpellKeys = Object.keys(expectedBindings);
  if (
    input.hexes.values.length !== expectedSpellKeys.length ||
    expectedSpellKeys.some((key) => input.hexes.byKey[key] === undefined)
  )
    fail('traitCatalog.hexes', 'must declare exactly one Hex for each of the nine spell traits');
  for (const hex of input.hexes.values) {
    const trait = input.traits.byKey[hex.spellTraitKey];
    if (trait?.equipmentSlot !== 'Spell')
      fail(`traitCatalog.hexes.${hex.spellTraitKey}.spellTraitKey`, 'must reference a Spell trait');
    if (
      spellGiver === undefined ||
      (hex.spellTraitKey !== 'SpellMoonBeamTrait' &&
        !spellGiver.traitKeys.includes(hex.spellTraitKey))
    )
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.spellTraitKey`,
        'must belong to the normal SpellDrop pool unless it is Aspect of Selene Sky Fall',
      );
    const expectedBinding = expectedBindings[hex.spellTraitKey as keyof typeof expectedBindings];
    if (expectedBinding === undefined)
      fail(`traitCatalog.hexes.${hex.spellTraitKey}`, 'has no audited God Sent binding');
    if (hex.godSent.providerKey !== expectedBinding[0])
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.providerKey`,
        `must be ${expectedBinding[0]}`,
      );
    if (hex.godSent.forceKeepsakeKey !== expectedBinding[1])
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.forceKeepsakeKey`,
        `must be ${expectedBinding[1]}`,
      );
    const provider = input.givers.byKey[hex.godSent.providerKey];
    if (provider?.providerKind !== 'olympian')
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.providerKey`,
        'must be an Olympian giver',
      );
    const forceKeepsake = input.keepsakes.byKey[hex.godSent.forceKeepsakeKey];
    if (forceKeepsake === undefined)
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.forceKeepsakeKey`,
        'must reference a declared force-boon keepsake',
      );
    if (
      forceKeepsake.effect?.kind !== 'olympianRewardPressure' ||
      forceKeepsake.effect.providerKey !== hex.godSent.providerKey
    )
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.forceKeepsakeKey`,
        'must reference the matching provider force-keepsake',
      );
    if (hex.godSent.olympianTalentKey !== expectedBinding[2])
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.olympianTalentKey`,
        `must be ${expectedBinding[2]}`,
      );
    const talentKeys = [
      ...hex.rareCandidates.values.map((candidate) => candidate.key),
      ...hex.epicCandidates.values.map((candidate) => candidate.key),
      ...hex.repeatableCandidates.values.map((candidate) => candidate.key),
      hex.godSent.olympianTalentKey,
      hex.godSent.lineageTalentKey,
    ];
    if (new Set(talentKeys).size !== talentKeys.length)
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}`,
        'Hex talent keys must be unique across pools',
      );
  }
}

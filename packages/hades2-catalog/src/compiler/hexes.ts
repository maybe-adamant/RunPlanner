import type {
  CatalogCollection,
  HexDeclaration,
  HexLayoutKey,
} from '@run-planner/engine/catalog-schema';

import {
  createCollection,
  freezeUniqueStrings,
  requireArray,
  requireNonEmpty,
  requireObject,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';
import type { RawHexDeclaration, RawTraitCatalogInput } from '../declarations/traits';

const LAYOUT_KEYS: readonly HexLayoutKey[] = ['Lung', 'Pyramid', 'Maze', 'Nacelle'];
const EXPECTED_LAYOUTS = Object.freeze({
  Lung: Object.freeze({ baseCapacity: 16, rareCount: 2, epicCount: 1 }),
  Pyramid: Object.freeze({ baseCapacity: 18, rareCount: 3, epicCount: 1 }),
  Maze: Object.freeze({ baseCapacity: 22, rareCount: 3, epicCount: 2 }),
  Nacelle: Object.freeze({ baseCapacity: 18, rareCount: 3, epicCount: 2 }),
});

export function normalizeHexes(
  raw: RawTraitCatalogInput['hexes'],
): CatalogCollection<HexDeclaration> {
  const declarations = requireArray(raw, 'hexes').map(
    (value, index) => requireObject(value, `hexes[${index}]`) as unknown as RawHexDeclaration,
  );
  const values = declarations.map((hex, index) => {
    const path = `hexes[${index}]`;
    const layouts = requireArray(hex.layouts, `${path}.layouts`).map((value, layoutIndex) => {
      const layout = requireObject(value, `${path}.layouts[${layoutIndex}]`);
      const key = layout.key;
      if (typeof key !== 'string' || !(LAYOUT_KEYS as readonly string[]).includes(key))
        fail(`${path}.layouts[${layoutIndex}].key`, 'must be Lung, Pyramid, Maze, or Nacelle');
      const expected = EXPECTED_LAYOUTS[key as HexLayoutKey];
      if (expected === undefined) fail(`${path}.layouts[${layoutIndex}].key`, 'unknown layout');
      const label = requireNonEmpty(
        layout.label as string,
        `${path}.layouts[${layoutIndex}].label`,
      );
      const baseCapacity = requirePositiveInteger(
        layout.baseCapacity as number,
        `${path}.layouts[${layoutIndex}].baseCapacity`,
      );
      const rareCount = requirePositiveInteger(
        layout.rareCount as number,
        `${path}.layouts[${layoutIndex}].rareCount`,
      );
      const epicCount = requirePositiveInteger(
        layout.epicCount as number,
        `${path}.layouts[${layoutIndex}].epicCount`,
      );
      if (
        baseCapacity !== expected.baseCapacity ||
        rareCount !== expected.rareCount ||
        epicCount !== expected.epicCount
      )
        fail(`${path}.layouts[${layoutIndex}]`, 'does not match the source layout contract');
      return Object.freeze({
        key: key as HexLayoutKey,
        label,
        baseCapacity,
        rareCount,
        epicCount,
      });
    });
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
    if (rareCandidates.values.length < 3 || epicCandidates.values.length < 2)
      fail(path, 'must provide at least three Rare and two Epic candidates');
    const godSent = requireObject(hex.godSent, `${path}.godSent`);
    if (godSent.capacityDelta !== 2) fail(`${path}.godSent.capacityDelta`, 'must be 2');
    return Object.freeze({
      spellTraitKey: requireNonEmpty(hex.spellTraitKey, `${path}.spellTraitKey`),
      label: requireNonEmpty(hex.label, `${path}.label`),
      layouts: createCollection(layouts, `${path}.layouts`, (layout) => layout.key),
      rareCandidates,
      epicCandidates,
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

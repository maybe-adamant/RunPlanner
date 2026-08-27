import type { Catalog, HexLayoutKey, HexTalentCandidateDeclaration } from '../catalog-schema';

import type { AuthoredHexTreeConfiguration } from './traits';

const LAYOUT_KEYS: readonly HexLayoutKey[] = ['Lung', 'Pyramid', 'Maze', 'Nacelle'];

function hexFor(catalog: Catalog, spellTraitKey: string) {
  const hex = catalog.hexes.byKey[spellTraitKey];
  if (hex === undefined) throw new Error(`unknown Hex spell ${spellTraitKey}`);
  return hex;
}

function candidateKeys(
  candidates: readonly HexTalentCandidateDeclaration[],
  selected: readonly string[],
  count: number,
  kind: 'Rare' | 'Epic',
): readonly string[] {
  if (selected.length !== count)
    throw new Error(`${kind} Hex talent selection requires exactly ${count} identities`);
  if (new Set(selected).size !== selected.length)
    throw new Error(`${kind} Hex talent identities must be unique`);
  const allowed = new Set(candidates.map((candidate) => candidate.key));
  if (selected.some((key) => !allowed.has(key)))
    throw new Error(`${kind} Hex talent selection contains an unknown identity`);
  const selectedSet = new Set(selected);
  return Object.freeze(
    candidates.filter((candidate) => selectedSet.has(candidate.key)).map((c) => c.key),
  );
}

/** Validates and canonicalizes one complete selected-tree value. */
export function normalizeAuthoredHexTree(
  catalog: Catalog,
  spellTraitKey: string,
  value: AuthoredHexTreeConfiguration,
): AuthoredHexTreeConfiguration {
  const hex = hexFor(catalog, spellTraitKey);
  if (!LAYOUT_KEYS.includes(value.layoutKey)) throw new Error('Hex layout is not declared');
  const layout = hex.layouts.byKey[value.layoutKey];
  if (layout === undefined) throw new Error(`Hex layout ${value.layoutKey} is not declared`);
  const rareTalentKeys = candidateKeys(
    hex.rareCandidates.values,
    value.rareTalentKeys,
    layout.rareCount,
    'Rare',
  );
  const epicTalentKeys = candidateKeys(
    hex.epicCandidates.values,
    value.epicTalentKeys,
    layout.epicCount,
    'Epic',
  );
  if (
    new Set([...rareTalentKeys, ...epicTalentKeys]).size !==
    rareTalentKeys.length + epicTalentKeys.length
  )
    throw new Error('Hex Rare and Epic talent identities must be unique across both pools');
  return Object.freeze({ layoutKey: value.layoutKey, rareTalentKeys, epicTalentKeys });
}

/** Declaration-first complete value used at every new Hex ownership boundary. */
export function createDefaultAuthoredHexTree(
  catalog: Catalog,
  spellTraitKey: string,
  layoutKey: HexLayoutKey = 'Lung',
): AuthoredHexTreeConfiguration {
  const hex = hexFor(catalog, spellTraitKey);
  const layout = hex.layouts.byKey[layoutKey];
  if (layout === undefined) throw new Error(`Hex layout ${layoutKey} is not declared`);
  return normalizeAuthoredHexTree(catalog, spellTraitKey, {
    layoutKey,
    rareTalentKeys: hex.rareCandidates.values
      .slice(0, layout.rareCount)
      .map((candidate) => candidate.key),
    epicTalentKeys: hex.epicCandidates.values
      .slice(0, layout.epicCount)
      .map((candidate) => candidate.key),
  });
}

/** Changes layout while retaining legal identities and filling from declarations. */
export function transitionAuthoredHexTreeLayout(
  catalog: Catalog,
  spellTraitKey: string,
  value: AuthoredHexTreeConfiguration,
  layoutKey: HexLayoutKey,
): AuthoredHexTreeConfiguration {
  const hex = hexFor(catalog, spellTraitKey);
  const layout = hex.layouts.byKey[layoutKey];
  if (layout === undefined) throw new Error(`Hex layout ${layoutKey} is not declared`);
  const rareSet = new Set(value.rareTalentKeys);
  const epicSet = new Set(value.epicTalentKeys);
  const rare = hex.rareCandidates.values
    .filter((candidate) => rareSet.has(candidate.key))
    .map((candidate) => candidate.key)
    .slice(0, layout.rareCount);
  const epic = hex.epicCandidates.values
    .filter((candidate) => epicSet.has(candidate.key))
    .map((candidate) => candidate.key)
    .slice(0, layout.epicCount);
  const selected = new Set([...rare, ...epic]);
  for (const candidate of hex.rareCandidates.values) {
    if (rare.length >= layout.rareCount) break;
    if (!selected.has(candidate.key)) {
      rare.push(candidate.key);
      selected.add(candidate.key);
    }
  }
  for (const candidate of hex.epicCandidates.values) {
    if (epic.length >= layout.epicCount) break;
    if (!selected.has(candidate.key)) {
      epic.push(candidate.key);
      selected.add(candidate.key);
    }
  }
  return normalizeAuthoredHexTree(catalog, spellTraitKey, {
    layoutKey,
    rareTalentKeys: rare,
    epicTalentKeys: epic,
  });
}

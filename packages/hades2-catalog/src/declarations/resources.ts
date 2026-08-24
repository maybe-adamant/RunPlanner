import type { ResourcePointSupport } from '@run-planner/engine/catalog-schema';

export const resourceFamilies = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;
export type ResourceFamily = (typeof resourceFamilies)[number];

type ResourceProfile = 'normal' | 'h' | 'n' | 'chaos';

const baseRules = Object.freeze({
  Pickaxe: Object.freeze({
    grantedTraitKey: 'FireEssence',
    element: 'Fire',
    sameFamilyLookback: 4,
    crossFamilyLookback: Object.freeze({ Pickaxe: 0, Exorcism: 1, Shovel: 1, Fishing: 1 }),
  }),
  Exorcism: Object.freeze({
    grantedTraitKey: 'AirEssence',
    element: 'Air',
    sameFamilyLookback: 6,
    crossFamilyLookback: Object.freeze({ Pickaxe: 1, Exorcism: 0, Shovel: 1, Fishing: 1 }),
  }),
  Shovel: Object.freeze({
    grantedTraitKey: 'EarthEssence',
    element: 'Earth',
    sameFamilyLookback: 4,
    crossFamilyLookback: Object.freeze({ Pickaxe: 1, Exorcism: 1, Shovel: 0, Fishing: 1 }),
  }),
  Fishing: Object.freeze({
    grantedTraitKey: 'WaterEssence',
    element: 'Water',
    sameFamilyLookback: 5,
    crossFamilyLookback: Object.freeze({ Pickaxe: 1, Exorcism: 1, Shovel: 1, Fishing: 0 }),
  }),
});
const nLookbacks = { Pickaxe: 12, Exorcism: 16, Shovel: 12, Fishing: 14 } as const;

function support(
  profile: ResourceProfile,
  families: readonly ResourceFamily[],
  options: { readonly ignoresBiomeLimit?: boolean } = {},
): ResourcePointSupport {
  const rules = Object.freeze(
    Object.fromEntries(
      resourceFamilies.map((family) => {
        const base = baseRules[family];
        const sameFamilyLookback =
          profile === 'chaos'
            ? 0
            : profile === 'h'
              ? 2
              : profile === 'n'
                ? nLookbacks[family]
                : base.sameFamilyLookback;
        const crossFamilyLookback =
          profile === 'chaos'
            ? { Pickaxe: 0, Exorcism: 0, Shovel: 0, Fishing: 0 }
            : profile === 'n'
              ? Object.fromEntries(
                  resourceFamilies.map((other) => [other, other === family ? 0 : 3]),
                )
              : base.crossFamilyLookback;
        return [
          family,
          Object.freeze({
            ...base,
            sameFamilyLookback,
            crossFamilyLookback: Object.freeze(crossFamilyLookback),
          }),
        ];
      }),
    ),
  ) as ResourcePointSupport['rules'];
  return Object.freeze({
    families: Object.freeze([...families]),
    capacity: profile === 'chaos' ? 'allTools' : 'simpleComplex',
    rules,
    ...(options.ignoresBiomeLimit ? { ignoresBiomeLimit: true } : {}),
  });
}

export const normalResourcePointSupport = (
  families: readonly ResourceFamily[],
  options?: { readonly ignoresBiomeLimit?: boolean },
) => support('normal', families, options);
export const hResourcePointSupport = (
  families: readonly ResourceFamily[],
  options?: { readonly ignoresBiomeLimit?: boolean },
) => support('h', families, options);
export const nResourcePointSupport = (
  families: readonly ResourceFamily[],
  options?: { readonly ignoresBiomeLimit?: boolean },
) => support('n', families, options);
export const chaosResourcePointSupport = (
  families: readonly ResourceFamily[],
  options?: { readonly ignoresBiomeLimit?: boolean },
) => support('chaos', families, options);

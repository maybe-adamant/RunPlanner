/**
 * Immutable keyed collection shared by normalized catalog products.
 *
 * This contract deliberately lives below both catalog-schema and reward-kernel:
 * neither higher-level product owns the collection shape consumed by the other.
 */
export interface CatalogCollection<T> {
  readonly values: readonly T[];
  readonly byKey: Readonly<Record<string, T>>;
}

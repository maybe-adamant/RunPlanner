/**
 * Deliberately violate one required public-product property after production
 * has constructed a valid workspace. This is the only untyped seam used by
 * omission mutation tests; normal observation remains typed against the
 * public workspace contract.
 */
export function unsafeOmitWorkspaceProperty<T extends object, K extends keyof T>(
  value: T,
  property: K,
): T {
  const malformed = { ...value } as Record<PropertyKey, unknown>;
  Reflect.deleteProperty(malformed, property);
  return malformed as T;
}

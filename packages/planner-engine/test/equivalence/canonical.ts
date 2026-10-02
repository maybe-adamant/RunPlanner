import { createHash } from 'node:crypto';

export class CanonicalizationError extends Error {
  constructor(path: string, detail: string) {
    super(`${path}: ${detail}`);
    this.name = 'CanonicalizationError';
  }
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * A content-addressed canonical form: each distinct object or array is one
 * node whose text is JSON with sorted keys, inline scalars and `{"$ref":hash}`
 * children. The root hash therefore covers the fully expanded value while
 * shared subtrees are hashed once.
 */
export interface CanonicalDigest {
  readonly root: string;
  /** Node text by hash, for every node reachable from the root. */
  readonly nodes: ReadonlyMap<string, string>;
}

type Inline = null | boolean | number | string | { readonly [key: string]: unknown };

const byCodeUnit = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

/** Product keys beginning with `$` are escaped so tags can never collide with data. */
function escapeKey(key: string): string {
  return key.startsWith('$') ? `$${key}` : key;
}

/**
 * Every reachable value is kept, including Map and Set entries (sorted by
 * canonical key) and non-enumerable data properties. A function, accessor,
 * symbol, cycle or class instance fails with its path rather than vanishing
 * the way plain JSON serialization would drop it.
 */
export function canonicalDigest(value: unknown): CanonicalDigest {
  const nodes = new Map<string, string>();
  const hashes = new WeakMap<object, string>();
  const stack = new Set<object>();

  const node = (text: string): { readonly $ref: string } => {
    const hash = sha256(text);
    nodes.set(hash, text);
    return { $ref: hash };
  };

  const inline = (current: unknown, path: string): Inline => {
    switch (typeof current) {
      case 'string':
      case 'boolean':
        return current;
      case 'number':
        if (Number.isNaN(current)) return { $number: 'NaN' };
        if (!Number.isFinite(current)) return { $number: current > 0 ? 'Infinity' : '-Infinity' };
        return Object.is(current, -0) ? { $number: '-0' } : current;
      case 'undefined':
        return { $undefined: true };
      case 'bigint':
        return { $bigint: current.toString() };
      case 'function':
        throw new CanonicalizationError(path, `function ${current.name || '<anonymous>'}`);
      case 'symbol':
        throw new CanonicalizationError(path, 'symbol value');
      case 'object':
        break;
    }
    if (current === null) return null;
    const known = hashes.get(current);
    if (known !== undefined) return { $ref: known };
    if (stack.has(current)) throw new CanonicalizationError(path, 'cycle');
    stack.add(current);
    try {
      const reference = node(JSON.stringify(objectNode(current, path)));
      hashes.set(current, reference.$ref);
      return reference;
    } finally {
      stack.delete(current);
    }
  };

  const sortedByText = (items: readonly (readonly [string, unknown])[]) =>
    [...items].sort(([left], [right]) => byCodeUnit(left, right)).map(([, item]) => item);

  const objectNode = (current: object, path: string): unknown => {
    if (Array.isArray(current)) {
      const items: Inline[] = [];
      for (let index = 0; index < current.length; index += 1)
        items.push(inline(current[index], `${path}[${index}]`));
      return items;
    }
    if (current instanceof Map) {
      const entries = [...current].map(([key, entry], index) => {
        const canonicalKey = inline(key, `${path}<map key ${index}>`);
        const keyText = JSON.stringify(canonicalKey);
        return [keyText, [canonicalKey, inline(entry, `${path}<map ${keyText}>`)]] as const;
      });
      return { $map: sortedByText(entries) };
    }
    if (current instanceof Set) {
      const items = [...current].map((item, index) => {
        const canonicalItem = inline(item, `${path}<set ${index}>`);
        return [JSON.stringify(canonicalItem), canonicalItem] as const;
      });
      return { $set: sortedByText(items) };
    }
    const prototype = Object.getPrototypeOf(current) as { constructor?: { name?: string } } | null;
    if (prototype !== Object.prototype && prototype !== null)
      throw new CanonicalizationError(
        path,
        `instance of ${prototype.constructor?.name ?? 'unknown'}`,
      );
    if (Object.getOwnPropertySymbols(current).length > 0)
      throw new CanonicalizationError(path, 'symbol-keyed property');
    const entries: (readonly [string, Inline])[] = [];
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(current))) {
      if (descriptor.get !== undefined || descriptor.set !== undefined)
        throw new CanonicalizationError(`${path}.${key}`, 'accessor property');
      // A non-enumerable data property is still product data; JSON would drop it.
      const canonicalKey = descriptor.enumerable ? escapeKey(key) : `$hidden:${key}`;
      entries.push([canonicalKey, inline(descriptor.value, `${path}.${key}`)]);
    }
    const result: Record<string, Inline> = {};
    for (const [key, entry] of entries.sort(([left], [right]) => byCodeUnit(left, right)))
      result[key] = entry;
    return result;
  };

  const top = inline(value, '$');
  const root =
    top !== null && typeof top === 'object' && '$ref' in top
      ? String(top.$ref)
      : node(JSON.stringify(top)).$ref;
  return Object.freeze({ root, nodes });
}

/** One line for the root, then one `hash text` line per node. */
export function serializeDigest(digest: CanonicalDigest): string {
  return [digest.root, ...[...digest.nodes].map(([hash, text]) => `${hash} ${text}`)].join('\n');
}

export function parseDigest(text: string): CanonicalDigest {
  const [root, ...lines] = text.split('\n');
  const nodes = new Map<string, string>();
  for (const line of lines) nodes.set(line.slice(0, 64), line.slice(65));
  return Object.freeze({ root: root!, nodes });
}

function isReference(value: unknown): value is { readonly $ref: string } {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { $ref?: unknown }).$ref === 'string'
  );
}

/** The first path at which two canonical digests differ, or undefined when equal. */
export function firstDifference(left: CanonicalDigest, right: CanonicalDigest): string | undefined {
  const resolve = (digest: CanonicalDigest, value: unknown): unknown =>
    isReference(value) ? JSON.parse(digest.nodes.get(value.$ref) ?? 'null') : value;
  const visit = (before: unknown, after: unknown, path: string): string | undefined => {
    if (isReference(before) && isReference(after) && before.$ref === after.$ref) return undefined;
    const leftValue = resolve(left, before);
    const rightValue = resolve(right, after);
    if (
      leftValue === null ||
      rightValue === null ||
      typeof leftValue !== 'object' ||
      typeof rightValue !== 'object' ||
      Array.isArray(leftValue) !== Array.isArray(rightValue)
    )
      return JSON.stringify(leftValue) === JSON.stringify(rightValue) ? undefined : path;
    if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
      const length = Math.max(leftValue.length, rightValue.length);
      for (let index = 0; index < length; index += 1) {
        if (index >= leftValue.length || index >= rightValue.length) return `${path}[${index}]`;
        const found = visit(leftValue[index], rightValue[index], `${path}[${index}]`);
        if (found !== undefined) return found;
      }
      return undefined;
    }
    const leftRecord = leftValue as Record<string, unknown>;
    const rightRecord = rightValue as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].sort(
      byCodeUnit,
    );
    for (const key of keys) {
      const label = key.startsWith('$$') ? key.slice(1) : key;
      if (!(key in leftRecord) || !(key in rightRecord)) return `${path}.${label}`;
      const found = visit(leftRecord[key], rightRecord[key], `${path}.${label}`);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return visit({ $ref: left.root }, { $ref: right.root }, '$');
}

import type { SemanticAddress } from './addresses';
import { semanticAddressKey } from './addresses';

/** Collision-safe source-owned identity for the separately acquired replacement. */
export function artificerReplacementEntryKey(
  source: SemanticAddress | string,
  acquisitionRole: string,
): string {
  const sourceKey = typeof source === 'string' ? source : semanticAddressKey(source);
  return `artificer:${encodeURIComponent(sourceKey)}:${encodeURIComponent(acquisitionRole)}`;
}

export function parseArtificerReplacementEntryKey(
  key: string,
): { readonly sourceKey: string; readonly acquisitionRole: string } | undefined {
  if (!key.startsWith('artificer:')) return undefined;
  const separator = key.lastIndexOf(':');
  if (separator <= 'artificer:'.length) return undefined;
  try {
    return Object.freeze({
      sourceKey: decodeURIComponent(key.slice('artificer:'.length, separator)),
      acquisitionRole: decodeURIComponent(key.slice(separator + 1)),
    });
  } catch {
    return undefined;
  }
}

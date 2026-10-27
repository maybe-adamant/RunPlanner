/**
 * A luabins value. A table whose keys are exactly 1..n in its array part
 * becomes an array; every other table becomes an object with stringified keys.
 */
export type LuaValue = null | boolean | number | string | readonly LuaValue[] | LuaTable;
export interface LuaTable {
  readonly [key: string]: LuaValue;
}

const utf8 = new TextDecoder('utf-8');

/** Decodes a luabins payload into its top-level values. */
export function decodeLuabins(bytes: Uint8Array): readonly LuaValue[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let position = 0;
  const need = (size: number) => {
    if (position + size > bytes.length) throw new Error('luabins payload ends early');
  };
  const u32 = () => {
    need(4);
    const value = view.getUint32(position, true);
    position += 4;
    return value;
  };
  const value = (): LuaValue => {
    need(1);
    const tag = String.fromCharCode(bytes[position++]!);
    switch (tag) {
      case '-':
        return null;
      case '0':
        return false;
      case '1':
        return true;
      case 'N': {
        need(8);
        const number = view.getFloat64(position, true);
        position += 8;
        return number;
      }
      case 'S': {
        const size = u32();
        need(size);
        const text = utf8.decode(bytes.subarray(position, position + size));
        position += size;
        return text;
      }
      case 'T': {
        const arraySize = u32();
        const hashSize = u32();
        const pairs: [LuaValue, LuaValue][] = [];
        for (let index = 0; index < arraySize + hashSize; index += 1)
          pairs.push([value(), value()]);
        if (arraySize > 0 && hashSize === 0 && pairs.every(([key], index) => key === index + 1))
          return Object.freeze(pairs.map(([, entry]) => entry));
        // A prototype-free table keeps keys such as `__proto__` as ordinary entries.
        const table = Object.create(null) as Record<string, LuaValue>;
        for (const [key, entry] of pairs) table[tableKey(key)] = entry;
        return Object.freeze(table);
      }
      default:
        throw new Error(`luabins tag ${JSON.stringify(tag)} at ${position - 1} is unsupported`);
    }
  };
  need(1);
  const count = bytes[position++]!;
  const values: LuaValue[] = [];
  for (let index = 0; index < count; index += 1) values.push(value());
  return Object.freeze(values);
}

function tableKey(key: LuaValue): string {
  if (typeof key === 'string') return key;
  if (typeof key === 'number' || typeof key === 'boolean') return String(key);
  throw new Error('luabins table key must be a string, number or boolean');
}

import { decompressLz4Block } from './lz4Block';
import { decodeLuabins, type LuaTable, type LuaValue } from './luabins';

/** The plain header of a Hades II `SGB1` save. */
export interface SaveHeader {
  readonly version: number;
  /** Unix seconds of the write. */
  readonly timestamp: number;
  readonly location: string;
  /** Equals `#GameState.RunHistory`. */
  readonly runCount: number;
  readonly fear: number;
  readonly displayNames: readonly string[];
  /** Map being left, or the current map. */
  readonly mapName: string;
  /** Map to load next; empty for a PostReward checkpoint. */
  readonly nextMap: string;
}

export interface DecodedSave {
  readonly header: SaveHeader;
  /** The saved globals table (`GameState`, `CurrentRun`, `_worldTime`, ...). */
  readonly globals: LuaTable;
}

export class SaveFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveFileError';
  }
}

const MAGIC = [0x53, 0x47, 0x42, 0x31];
const utf8 = new TextDecoder('utf-8');

/** Adler-32 of `bytes`. */
export function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let start = 0; start < bytes.length; start += 5552) {
    const end = Math.min(start + 5552, bytes.length);
    for (let index = start; index < end; index += 1) {
      a += bytes[index]!;
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** Reads the header and returns it with the raw LZ4 block that follows. */
export function readSaveContainer(bytes: Uint8Array): {
  readonly header: SaveHeader;
  readonly block: Uint8Array;
} {
  if (bytes.length < 20 || MAGIC.some((byte, index) => bytes[index] !== byte))
    throw new SaveFileError('save does not start with SGB1');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) !== adler32(bytes.subarray(8)))
    throw new SaveFileError('save checksum does not match');
  let position = 8;
  const need = (size: number) => {
    if (position + size > bytes.length) throw new SaveFileError('save header ends early');
  };
  const u32 = () => {
    need(4);
    const value = view.getUint32(position, true);
    position += 4;
    return value;
  };
  const text = () => {
    const size = u32();
    need(size);
    const value = utf8.decode(bytes.subarray(position, position + size));
    position += size;
    return value;
  };
  const version = u32();
  const timestamp = u32() + u32() * 2 ** 32;
  const location = text();
  const runCount = u32();
  u32();
  const fear = u32();
  u32();
  u32();
  need(2);
  position += 2;
  const count = u32();
  if (count > 4096) throw new SaveFileError('save display list is too long');
  const displayNames = Array.from({ length: count }, text);
  const mapName = text();
  const nextMap = text();
  const blockLength = u32();
  if (blockLength !== bytes.length - position)
    throw new SaveFileError('save block length does not match the file');
  return {
    header: Object.freeze({
      version,
      timestamp,
      location,
      runCount,
      fear,
      displayNames: Object.freeze(displayNames),
      mapName,
      nextMap,
    }),
    block: bytes.subarray(position),
  };
}

/** Decodes a full save: header check, LZ4 block and luabins globals. */
export function decodeSaveFile(bytes: Uint8Array): DecodedSave {
  const { header, block } = readSaveContainer(bytes);
  let values: readonly LuaValue[];
  try {
    values = decodeLuabins(decompressLz4Block(block));
  } catch (error) {
    throw new SaveFileError(`save payload is malformed: ${(error as Error).message}`);
  }
  const globals = values[0];
  if (
    values.length !== 1 ||
    globals === null ||
    typeof globals !== 'object' ||
    Array.isArray(globals)
  )
    throw new SaveFileError('save payload must hold one globals table');
  return Object.freeze({ header, globals: globals as LuaTable });
}

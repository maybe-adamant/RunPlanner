import { readFileSync } from 'node:fs';

import type { LuaTable, LuaValue } from '@planner/workspace/run-recording/luabins';
import { adler32 } from '@planner/workspace/run-recording/saveFile';

const encoder = new TextEncoder();

class Bytes {
  readonly parts: number[] = [];
  u8(value: number): this {
    this.parts.push(value & 255);
    return this;
  }
  u32(value: number): this {
    for (let shift = 0; shift < 32; shift += 8) this.u8(value >>> shift);
    return this;
  }
  raw(bytes: ArrayLike<number>): this {
    for (let index = 0; index < bytes.length; index += 1) this.u8(bytes[index]!);
    return this;
  }
  text(value: string): this {
    const bytes = encoder.encode(value);
    return this.u32(bytes.length).raw(bytes);
  }
  done(): Uint8Array {
    return Uint8Array.from(this.parts);
  }
}

function luabinsValue(bytes: Bytes, value: LuaValue): void {
  if (value === null) bytes.u8(0x2d);
  else if (value === false) bytes.u8(0x30);
  else if (value === true) bytes.u8(0x31);
  else if (typeof value === 'number') {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value, true);
    bytes.u8(0x4e).raw(new Uint8Array(view.buffer));
  } else if (typeof value === 'string') bytes.u8(0x53).text(value);
  else if (Array.isArray(value)) {
    bytes.u8(0x54).u32(value.length).u32(0);
    (value as readonly LuaValue[]).forEach((entry, index) => {
      luabinsValue(bytes, index + 1);
      luabinsValue(bytes, entry);
    });
  } else {
    const entries = Object.entries(value as LuaTable);
    bytes.u8(0x54).u32(0).u32(entries.length);
    for (const [key, entry] of entries) {
      luabinsValue(bytes, key);
      luabinsValue(bytes, entry);
    }
  }
}

/** One LZ4 sequence holding only literals. */
function literalBlock(payload: Uint8Array): Uint8Array {
  const bytes = new Bytes();
  if (payload.length < 15)
    return bytes
      .u8(payload.length << 4)
      .raw(payload)
      .done();
  bytes.u8(0xf0);
  let rest = payload.length - 15;
  while (rest >= 255) {
    bytes.u8(255);
    rest -= 255;
  }
  return bytes.u8(rest).raw(payload).done();
}

export interface SyntheticSaveHeader {
  readonly version?: number;
  readonly timestamp: number;
  readonly location: string;
  readonly runCount: number;
  readonly fear: number;
  readonly mapName: string;
  readonly nextMap: string;
}

/** An `SGB1` save holding `globals`, as the game writes it but with an uncompressed block. */
export function encodeSyntheticSave(header: SyntheticSaveHeader, globals: LuaTable): Uint8Array {
  const payload = new Bytes().u8(1);
  luabinsValue(payload, globals);
  const block = literalBlock(payload.done());
  const body = new Bytes()
    .u32(header.version ?? 0x00010012)
    .u32(header.timestamp)
    .u32(0)
    .text(header.location)
    .u32(header.runCount)
    .u32(0)
    .u32(header.fear)
    .u32(30)
    .u32(582_358)
    .u8(0)
    .u8(0)
    .u32(0)
    .text(header.mapName)
    .text(header.nextMap)
    .u32(block.length)
    .raw(block)
    .done();
  return new Bytes().raw(encoder.encode('SGB1')).u32(adler32(body)).raw(body).done();
}

interface TrimmedSample {
  readonly header: {
    readonly timestamp: number;
    readonly location: string;
    readonly runs: number;
    readonly shrine: number;
    readonly mapName: string;
    readonly nextMap: string;
  };
  readonly globals: LuaTable;
}

/** A trimmed decoded capture save under `test/workspace/run-recording/samples`, re-encoded. */
export function sampleSaveBytes(
  name: string,
  override: Partial<SyntheticSaveHeader> = {},
  editGlobals: (globals: LuaTable) => LuaTable = (globals) => globals,
): Uint8Array {
  const sample = JSON.parse(
    readFileSync(
      new URL(`../workspace/run-recording/samples/${name}.json`, import.meta.url),
      'utf8',
    ),
  ) as TrimmedSample;
  return encodeSyntheticSave(
    {
      timestamp: sample.header.timestamp,
      location: sample.header.location,
      runCount: sample.header.runs,
      fear: sample.header.shrine,
      mapName: sample.header.mapName,
      nextMap: sample.header.nextMap,
      ...override,
    },
    editGlobals(sample.globals),
  );
}

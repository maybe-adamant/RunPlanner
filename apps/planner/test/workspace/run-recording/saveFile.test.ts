import { describe, expect, it } from 'vitest';

import { decompressLz4Block } from '@planner/workspace/run-recording/lz4Block';
import { decodeLuabins } from '@planner/workspace/run-recording/luabins';
import {
  adler32,
  decodeSaveFile,
  readSaveContainer,
  SaveFileError,
} from '@planner/workspace/run-recording/saveFile';

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
  f64(value: number): this {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value, true);
    for (let index = 0; index < 8; index += 1) this.u8(view.getUint8(index));
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

const luaString = (bytes: Bytes, value: string) => bytes.u8(0x53).text(value);
const luaNumber = (bytes: Bytes, value: number) => bytes.u8(0x4e).f64(value);

/** `{ CurrentRun = { RoomHistory = { "F_Opening01" }, Cleared = true }, _worldTime = 1.5 }` */
function globalsPayload(): Uint8Array {
  const bytes = new Bytes().u8(1).u8(0x54).u32(0).u32(2);
  luaString(bytes, 'CurrentRun');
  bytes.u8(0x54).u32(0).u32(2);
  luaString(bytes, 'RoomHistory');
  bytes.u8(0x54).u32(1).u32(0);
  luaNumber(bytes, 1);
  luaString(bytes, 'F_Opening01');
  luaString(bytes, 'Cleared');
  bytes.u8(0x31);
  luaString(bytes, '_worldTime');
  luaNumber(bytes, 1.5);
  return bytes.done();
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

function save(nextMap: string, block: Uint8Array): Uint8Array {
  const body = new Bytes()
    .u32(0x00010012)
    .u32(1_793_057_328)
    .u32(0)
    .text('Location_BiomeF')
    .u32(1003)
    .u32(0)
    .u32(12)
    .u32(30)
    .u32(582_358)
    .u8(0)
    .u8(0)
    .u32(2)
    .text('WeaponStaffSwing')
    .text('DevSaveName=Run 1004')
    .text('F_Opening01')
    .text(nextMap)
    .u32(block.length)
    .raw(block)
    .done();
  return new Bytes().raw(encoder.encode('SGB1')).u32(adler32(body)).raw(body).done();
}

describe('save file decoding', () => {
  it('computes Adler-32', () => {
    expect(adler32(encoder.encode('Wikipedia'))).toBe(0x11e60398);
    expect(adler32(new Uint8Array())).toBe(1);
  });

  it('decodes a synthetic save into its header and globals', () => {
    const decoded = decodeSaveFile(save('F_Combat01', literalBlock(globalsPayload())));
    expect(decoded.header).toEqual({
      version: 0x00010012,
      timestamp: 1_793_057_328,
      location: 'Location_BiomeF',
      runCount: 1003,
      fear: 12,
      displayNames: ['WeaponStaffSwing', 'DevSaveName=Run 1004'],
      mapName: 'F_Opening01',
      nextMap: 'F_Combat01',
    });
    expect(decoded.globals).toEqual({
      CurrentRun: { RoomHistory: ['F_Opening01'], Cleared: true },
      _worldTime: 1.5,
    });
  });

  it('rejects a damaged container', () => {
    const bytes = save('', literalBlock(globalsPayload()));
    const flipped = bytes.slice();
    flipped[flipped.length - 1] = flipped[flipped.length - 1]! ^ 1;
    expect(() => readSaveContainer(flipped)).toThrow(/checksum/);
    const magic = bytes.slice();
    magic[0] = 0x58;
    expect(() => readSaveContainer(magic)).toThrow(SaveFileError);
    const truncated = save('', literalBlock(globalsPayload()).subarray(0, 4));
    expect(() => decodeSaveFile(truncated)).toThrow(/payload is malformed/);
  });

  it('rejects a block length that disagrees with the file', () => {
    const block = literalBlock(globalsPayload());
    const bytes = save('', block);
    const longer = new Bytes().raw(bytes).u8(0).done();
    const body = longer.subarray(8);
    new DataView(longer.buffer).setUint32(4, adler32(body), true);
    expect(() => readSaveContainer(longer)).toThrow(/block length/);
  });
});

describe('LZ4 block', () => {
  it('copies literals and overlapping matches', () => {
    // "ab" then a match of 6 at offset 2, then the mandatory literal tail "c".
    const block = Uint8Array.from([0x22, 0x61, 0x62, 0x02, 0x00, 0x10, 0x63]);
    expect(new TextDecoder().decode(decompressLz4Block(block))).toBe('ababababc');
  });

  it('reads extended literal lengths and grows its output', () => {
    const payload = encoder.encode('x'.repeat(600));
    expect(decompressLz4Block(literalBlock(payload), 1)).toEqual(payload);
  });

  it('refuses output beyond a save-sized bound', () => {
    // One literal, then a match of offset 1 extended past 64 MB.
    const extensions = Math.ceil((64 * 1024 * 1024) / 255) + 1;
    const block = new Uint8Array(4 + extensions + 1);
    block.set([0x1f, 0x61, 0x01, 0x00]);
    block.fill(255, 4, 4 + extensions);
    block[block.length - 1] = 0;
    const bytes = save('', block);
    expect(() => decodeSaveFile(bytes)).toThrow(SaveFileError);
    expect(() => decodeSaveFile(bytes)).toThrow(/exceeds its bound/);
  });

  it('rejects an offset outside the output', () => {
    expect(() => decompressLz4Block(Uint8Array.from([0x10, 0x61, 0x05, 0x00]))).toThrow(/offset/);
  });
});

describe('luabins', () => {
  it('keeps 1..n tables as arrays and stringifies other keys', () => {
    const bytes = new Bytes().u8(3).u8(0x2d).u8(0x30);
    bytes.u8(0x54).u32(0).u32(3);
    luaNumber(bytes, 2);
    luaString(bytes, 'second');
    luaNumber(bytes, 3);
    luaString(bytes, 'third');
    bytes.u8(0x31);
    luaNumber(bytes, 0.25);
    expect(decodeLuabins(bytes.done())).toEqual([
      null,
      false,
      { '2': 'second', '3': 'third', true: 0.25 },
    ]);
    expect(decodeLuabins(new Bytes().u8(1).u8(0x54).u32(0).u32(0).done())).toEqual([{}]);
  });

  it('keeps a __proto__ key as an ordinary entry', () => {
    const bytes = new Bytes().u8(1).u8(0x54).u32(0).u32(1);
    luaString(bytes, '__proto__');
    luaString(bytes, 'value');
    const [table] = decodeLuabins(bytes.done()) as [Record<string, unknown>];
    expect(Object.keys(table)).toEqual(['__proto__']);
    expect(Object.getOwnPropertyDescriptor(table, '__proto__')?.value).toBe('value');
  });

  it('rejects an unknown tag', () => {
    expect(() => decodeLuabins(Uint8Array.from([1, 0x58]))).toThrow(/tag/);
  });
});

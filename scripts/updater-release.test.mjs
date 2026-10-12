import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  UPDATER_PLATFORMS,
  UPDATER_PUBKEY_PLACEHOLDER,
  updaterManifest,
  updaterPubkey,
} from './updater-release.mjs';

// Shape-only minisign encodings built from random bytes; no signing key exists.
const keyId = randomBytes(8);
const encode = (comment, algorithm, id, payloadBytes, trailer = '') =>
  Buffer.from(
    `untrusted comment: ${comment}\n` +
      `${Buffer.concat([Buffer.from(algorithm, 'latin1'), id, randomBytes(payloadBytes)]).toString('base64')}\n` +
      trailer,
  ).toString('base64');
const pubkey = encode('minisign public key', 'Ed', keyId, 32);
const signature = (id = keyId) =>
  encode('signature from tauri secret key', 'ED', id, 64, 'trusted comment: timestamp:1\nabc\n');
const config = (value) => ({ plugins: { updater: { pubkey: value } } });

describe('updater public key guard', () => {
  it('rejects the committed placeholder, a missing key and a malformed key', () => {
    for (const value of [UPDATER_PUBKEY_PLACEHOLDER, '', undefined]) {
      assert.throws(() => updaterPubkey(config(value)), /placeholder/);
    }
    assert.throws(() => updaterPubkey(config('bm90IGEga2V5')), /not a minisign public key/);
    assert.throws(() => updaterPubkey(config(signature())), /not a minisign public key/);
  });

  it('accepts a minisign public key', () => {
    assert.equal(updaterPubkey(config(pubkey)), pubkey);
  });
});

describe('updater manifest', () => {
  const windows = (sig = signature()) => ({
    asset: 'RunPlanner-1.2.3-windows-x64-setup.exe',
    platform: 'windows-x86_64',
    signature: sig,
  });
  const linux = (sig = signature()) => ({
    asset: 'RunPlanner-1.2.3-linux-x64.AppImage',
    platform: 'linux-x86_64-appimage',
    signature: sig,
  });
  const input = {
    notes: 'Notes',
    pubDate: '2026-09-27T00:00:00.000Z',
    pubkey,
    repository: 'maybe-adamant/RunPlanner',
    version: '1.2.3',
  };
  const download = 'https://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3';

  it('describes the signed Windows installer and Linux AppImage in the Tauri v2 format', () => {
    const windowsSig = signature();
    const linuxSig = signature();
    assert.deepEqual(
      updaterManifest({
        ...input,
        entries: [windows(`${windowsSig}\n`), linux(`${linuxSig}\n`)],
      }),
      {
        version: '1.2.3',
        notes: 'Notes',
        pub_date: '2026-09-27T00:00:00.000Z',
        platforms: {
          'windows-x86_64': {
            signature: windowsSig,
            url: `${download}/RunPlanner-1.2.3-windows-x64-setup.exe`,
          },
          'linux-x86_64-appimage': {
            signature: linuxSig,
            url: `${download}/RunPlanner-1.2.3-linux-x64.AppImage`,
          },
        },
      },
    );
    assert.deepEqual(Object.keys(UPDATER_PLATFORMS), ['windows-x86_64', 'linux-x86_64-appimage']);
  });

  it('rejects a signature from a key the application does not trust on any platform', () => {
    for (const entries of [
      [windows(signature(randomBytes(8))), linux()],
      [windows(), linux(signature(randomBytes(8)))],
    ]) {
      assert.throws(() => updaterManifest({ ...input, entries }), /signed by key .* trusts key/);
    }
  });

  it('rejects missing, unknown, duplicated and mismatched platforms', () => {
    assert.throws(() => updaterManifest({ ...input, entries: [] }), /at least one platform/);
    assert.throws(
      () => updaterManifest({ ...input, entries: [{ ...linux(), platform: 'darwin-aarch64' }] }),
      /not one of/,
    );
    assert.throws(
      () => updaterManifest({ ...input, entries: [windows(), windows()] }),
      /more than once/,
    );
    assert.throws(
      () =>
        updaterManifest({
          ...input,
          entries: [{ ...windows(), asset: 'RunPlanner-1.2.3-linux-x64.AppImage' }],
        }),
      /not a windows-x86_64 updater asset/,
    );
    assert.throws(
      () =>
        updaterManifest({
          ...input,
          entries: [{ ...linux(), asset: 'RunPlanner-1.2.3-linux-x64.deb' }],
        }),
      /not a linux-x86_64-appimage updater asset/,
    );
  });

  it('rejects unstable versions, malformed signatures and unsafe names', () => {
    assert.throws(() => updaterManifest({ ...input, entries: [windows()], version: '1.2.3-rc.1' }));
    assert.throws(
      () => updaterManifest({ ...input, entries: [windows(pubkey)] }),
      /minisign signature/,
    );
    assert.throws(() =>
      updaterManifest({ ...input, entries: [{ ...windows(), asset: '../latest.exe' }] }),
    );
    assert.throws(() =>
      updaterManifest({ ...input, entries: [windows()], repository: 'not a repository' }),
    );
  });
});

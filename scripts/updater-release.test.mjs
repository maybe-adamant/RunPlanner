import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  UPDATER_PLATFORM,
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
  const input = {
    asset: 'RunPlanner-1.2.3-windows-x64-setup.exe',
    notes: 'Notes',
    pubDate: '2026-09-27T00:00:00.000Z',
    pubkey,
    repository: 'maybe-adamant/RunPlanner',
    version: '1.2.3',
  };

  it('describes the signed Windows installer in the Tauri v2 format', () => {
    const sig = signature();
    assert.deepEqual(updaterManifest({ ...input, signature: `${sig}\n` }), {
      version: '1.2.3',
      notes: 'Notes',
      pub_date: '2026-09-27T00:00:00.000Z',
      platforms: {
        [UPDATER_PLATFORM]: {
          signature: sig,
          url: 'https://github.com/maybe-adamant/RunPlanner/releases/download/v1.2.3/RunPlanner-1.2.3-windows-x64-setup.exe',
        },
      },
    });
    assert.equal(UPDATER_PLATFORM, 'windows-x86_64');
  });

  it('rejects a signature from a key the application does not trust', () => {
    assert.throws(
      () => updaterManifest({ ...input, signature: signature(randomBytes(8)) }),
      /signed by key .* trusts key/,
    );
  });

  it('rejects unstable versions, malformed signatures and unsafe asset names', () => {
    assert.throws(() =>
      updaterManifest({ ...input, signature: signature(), version: '1.2.3-rc.1' }),
    );
    assert.throws(() => updaterManifest({ ...input, signature: pubkey }), /minisign signature/);
    assert.throws(() =>
      updaterManifest({ ...input, asset: '../latest.json', signature: signature() }),
    );
  });
});

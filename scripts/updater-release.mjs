// Release-time owner of the updater signing contract: the committed public key
// must be a real minisign key, and latest.json must carry a signature made by
// that key for the uploaded installer.
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import { argv, exit, stderr, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const UPDATER_PUBKEY_PLACEHOLDER = 'RUN_PLANNER_UPDATER_PUBKEY_PLACEHOLDER';
export const UPDATER_PLATFORM = 'windows-x86_64';
const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

// Tauri stores minisign keys and signatures as base64 of the minisign text file.
// Its first non-comment line is base64 of algorithm (2 bytes) + key id (8 bytes) + payload.
function minisignKeyId(encoded, { label, algorithms, payloadBytes }) {
  const line = Buffer.from(encoded.trim(), 'base64')
    .toString('utf8')
    .split(/\r?\n/)
    .find((candidate) => candidate !== '' && !candidate.startsWith('untrusted comment:'));
  const bytes = line === undefined ? Buffer.alloc(0) : Buffer.from(line, 'base64');
  if (
    bytes.length !== 10 + payloadBytes ||
    !algorithms.includes(bytes.subarray(0, 2).toString('latin1'))
  ) {
    throw new Error(`${label} is not a minisign ${label.toLowerCase()}.`);
  }
  return bytes.subarray(2, 10).toString('hex');
}

export function updaterPubkey(tauriConfig) {
  const pubkey = tauriConfig?.plugins?.updater?.pubkey;
  if (typeof pubkey !== 'string' || pubkey === '' || pubkey === UPDATER_PUBKEY_PLACEHOLDER) {
    throw new Error(
      'plugins.updater.pubkey in tauri.conf.json is still the placeholder. ' +
        'Paste the public key generated with `tauri signer generate` before releasing.',
    );
  }
  minisignKeyId(pubkey, { label: 'Public key', algorithms: ['Ed'], payloadBytes: 32 });
  return pubkey;
}

export function updaterManifest({ asset, notes, pubDate, pubkey, repository, signature, version }) {
  if (!STABLE_SEMVER.test(version)) throw new Error(`Version ${version} is not stable SemVer.`);
  const publicKeyId = minisignKeyId(pubkey, {
    label: 'Public key',
    algorithms: ['Ed'],
    payloadBytes: 32,
  });
  const signatureKeyId = minisignKeyId(signature, {
    label: 'Signature',
    algorithms: ['Ed', 'ED'],
    payloadBytes: 64,
  });
  if (signatureKeyId !== publicKeyId) {
    throw new Error(
      `The installer was signed by key ${signatureKeyId}, but tauri.conf.json trusts key ${publicKeyId}.`,
    );
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[\w.-]+$/.test(asset)) {
    throw new Error(`Repository ${repository} or installer asset ${asset} is malformed.`);
  }
  const url = `https://github.com/${repository}/releases/download/v${version}/${asset}`;
  return {
    version,
    notes,
    pub_date: pubDate,
    platforms: { [UPDATER_PLATFORM]: { signature: signature.trim(), url } },
  };
}

function main(args) {
  const [command, ...rest] = args;
  const readConfig = (path) => JSON.parse(readFileSync(path, 'utf8'));
  if (command === 'assert-pubkey') {
    const { positionals } = parseArgs({ args: rest, allowPositionals: true });
    if (positionals.length !== 1) throw new Error('Usage: assert-pubkey <tauri.conf.json>');
    updaterPubkey(readConfig(positionals[0]));
    stdout.write('Updater public key is configured.\n');
    return;
  }
  if (command === 'manifest') {
    const { values } = parseArgs({
      args: rest,
      options: {
        asset: { type: 'string' },
        config: { type: 'string' },
        notes: { type: 'string' },
        out: { type: 'string' },
        repository: { type: 'string' },
        signature: { type: 'string' },
        version: { type: 'string' },
      },
    });
    for (const name of ['asset', 'config', 'notes', 'out', 'repository', 'signature', 'version']) {
      if (values[name] === undefined) throw new Error(`manifest requires --${name}.`);
    }
    const manifest = updaterManifest({
      asset: values.asset,
      notes: readFileSync(values.notes, 'utf8').trim(),
      pubDate: new Date().toISOString(),
      pubkey: updaterPubkey(readConfig(values.config)),
      repository: values.repository,
      signature: readFileSync(values.signature, 'utf8'),
      version: values.version,
    });
    writeFileSync(values.out, `${JSON.stringify(manifest, null, 2)}\n`);
    stdout.write(`Wrote ${values.out} for ${values.version}.\n`);
    return;
  }
  throw new Error('Usage: updater-release.mjs <assert-pubkey|manifest> ...');
}

if (argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(argv.slice(2));
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    exit(1);
  }
}

import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { join } from 'node:path';
import process from 'node:process';

/**
 * Prints the observed enemy-gold payout of generated combat rooms in recorded
 * runs, by payout group, for re-tuning the engine's enemy-gold policy
 * (packages/planner-engine/src/simulation/commerce/gold/enemy-gold-policy.ts):
 * `node scripts/gold-calibration.mjs <raw save folder>...`.
 *
 * Each folder holds one run's saves as a dev build's Record mode keeps them
 * (`NNN-<save file name>`, in arrival order). A room's store is its
 * encounter's `MoneyDropStore` when first saved; kill drops drain it, so the
 * gold its kills paid is the store's fall to the room's last save. The run's
 * `ResourcesGained.Money` over the same saves gives what else the room paid
 * (urns, Medea, rewards). Rooms with a gold multiplier held at any of their
 * saves are skipped. Requires Node 22.18+ or 23.6+.
 */

// The planner's save decoder is TypeScript with extensionless relative imports:
// it needs Node's type stripping and synchronous module hooks (Node 22.18+ or 23.6+).
if (typeof nodeModule.registerHooks !== 'function' || !process.features.typescript) {
  process.stderr.write(
    `gold-calibration.mjs needs Node 22.18+ (module.registerHooks and type stripping); this is ${process.version}\n`,
  );
  process.exit(2);
}
nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier))
        return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});
const { decodeSaveFile } = await import('../apps/planner/src/workspace/run-recording/saveFile.ts');

const folders = process.argv.slice(2);
if (folders.length === 0) {
  process.stderr.write('usage: gold-calibration.mjs <raw save folder>...\n');
  process.exit(2);
}

const MULTIPLIER_TRAITS = ['MoneyMultiplierBoon', 'ChaosMoneyBlessing'];

/** The payout group a generated encounter's gold is tuned by. */
function payoutGroup(roomName, encounterName) {
  if (/^(Opening|PreHub)GeneratedN/.test(encounterName)) return 'N opening';
  if (/^GeneratedH_Passive/.test(encounterName)) return 'H passive';
  if (encounterName === 'GeneratedAnomalyB') return 'Anomaly';
  if (!/Generated/.test(encounterName)) return undefined;
  if (/^(Artemis|Athena|Icarus|Nemesis|Heracles)Combat|^DevotionTest/.test(encounterName))
    return encounterName;
  return /^([A-Z])_/.exec(roomName)?.[1];
}

function savesOf(folder) {
  return readdirSync(folder)
    .flatMap((name) => {
      // `.v.sav` files are the game's validation copies, not saves.
      const match = /^(\d+)-.+(?<!\.v)\.sav$/.exec(name);
      return match === null ? [] : [{ index: Number(match[1]), path: join(folder, name) }];
    })
    .sort((left, right) => left.index - right.index)
    .map(({ path }) => path);
}

/** One row per room visit: its store and gold gained when first and last saved. */
function roomVisits(folder) {
  const visits = [];
  let current;
  for (const path of savesOf(folder)) {
    let globals;
    try {
      globals = decodeSaveFile(new Uint8Array(readFileSync(path))).globals;
    } catch (error) {
      process.stderr.write(`${path}: ${error.message}\n`);
      continue;
    }
    const run = globals.CurrentRun;
    const room = run?.CurrentRoom;
    const encounter = room?.Encounter;
    if (room === undefined || room === null || encounter === undefined || encounter === null)
      continue;
    const key = [room.Name, room.TimesVisited, encounter.Name, run.RunDepthCache].join('|');
    const reading = {
      store: encounter.MoneyDropStore,
      gained: run.ResourcesGained?.Money ?? 0,
    };
    const multiplied = MULTIPLIER_TRAITS.some(
      (trait) => run.Hero?.TraitDictionary?.[trait] !== undefined,
    );
    if (current?.key === key) {
      current.last = reading;
      current.multiplied ||= multiplied;
    } else {
      current = {
        key,
        roomName: room.Name,
        encounterName: encounter.Name,
        multiplied,
        first: reading,
        last: reading,
      };
      visits.push(current);
    }
  }
  return visits;
}

const groups = new Map();
let skipped = 0;
for (const folder of folders) {
  if (!statSync(folder).isDirectory()) {
    process.stderr.write(`${folder}: not a folder\n`);
    process.exit(1);
  }
  for (const visit of roomVisits(folder)) {
    const group = payoutGroup(visit.roomName, visit.encounterName);
    const { first, last } = visit;
    if (group === undefined || typeof first.store !== 'number' || typeof last.store !== 'number')
      continue;
    if (first === last) continue;
    if (visit.multiplied) {
      skipped += 1;
      continue;
    }
    const rows = groups.get(group) ?? [];
    rows.push({
      store: first.store,
      paid: first.store - last.store,
      other: last.gained - first.gained - (first.store - last.store),
    });
    groups.set(group, rows);
  }
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sd = (values) => {
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length);
};
const fixed = (value, digits = 2) => value.toFixed(digits).padStart(7);

process.stdout.write(
  'group                 n   store    paid  fraction  resid SD  overshoot  resid SD   other\n',
);
for (const [group, rows] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
  const store = mean(rows.map((row) => row.store));
  const paid = mean(rows.map((row) => row.paid));
  // Fraction form: paid = f x store; overshoot form: paid = store + o.
  const fraction = paid / store;
  const overshoot = paid - store;
  process.stdout.write(
    `${group.padEnd(18)}${String(rows.length).padStart(4)} ${fixed(store, 1)} ${fixed(paid, 1)}` +
      `  ${fixed(fraction)}  ${fixed(sd(rows.map((row) => row.paid - fraction * row.store)))}` +
      `    ${fixed(overshoot)}  ${fixed(sd(rows.map((row) => row.paid - row.store - overshoot)))}` +
      ` ${fixed(mean(rows.map((row) => row.other)), 1)}\n`,
  );
}
if (skipped > 0) process.stdout.write(`${skipped} rooms skipped for a held gold multiplier\n`);

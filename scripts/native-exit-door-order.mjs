import { readFileSync } from 'node:fs';
import process from 'node:process';

/**
 * Prints `nativeExitDoorOrders` entries from the door-order probe parser's JSON
 * (`{ rooms: { [room]: { order, sharedNames, ... } } }`), for pasting into
 * packages/hades2-catalog/src/declarations/rooms/native-exit-door-order.ts:
 * `node scripts/native-exit-door-order.mjs <parser-output.json>`.
 * Only rooms whose exit doors share an obstacle name are printed.
 */
const [inputPath] = process.argv.slice(2);
if (inputPath === undefined) {
  process.stderr.write('usage: native-exit-door-order.mjs <parser-output.json>\n');
  process.exit(2);
}

const parsed = JSON.parse(readFileSync(inputPath, 'utf8'));
if (typeof parsed?.rooms !== 'object' || parsed.rooms === null) {
  process.stderr.write(`${inputPath}: expected a top-level "rooms" object\n`);
  process.exit(1);
}

/** The parser's `sharedNames` as a yes/no, whatever container it uses. */
function sharesObstacleName(sharedNames) {
  if (Array.isArray(sharedNames)) return sharedNames.length > 0;
  if (typeof sharedNames === 'object' && sharedNames !== null)
    return Object.keys(sharedNames).length > 0;
  return sharedNames === true || (typeof sharedNames === 'number' && sharedNames > 0);
}

let failed = false;
const lines = [];
for (const room of Object.keys(parsed.rooms).sort()) {
  const { order, sharedNames } = parsed.rooms[room] ?? {};
  if (sharedNames === undefined) {
    process.stderr.write(`${room}: no sharedNames; skipped\n`);
    continue;
  }
  if (!sharesObstacleName(sharedNames)) continue;
  if (
    !Array.isArray(order) ||
    order.length < 2 ||
    !order.every((door) => Number.isInteger(door) && door > 0) ||
    new Set(order).size !== order.length
  ) {
    process.stderr.write(`${room}: order must list two or more unique positive door ids\n`);
    failed = true;
    continue;
  }
  lines.push(`  ${room}: [${order.join(', ')}],`);
}
process.stdout.write(lines.length === 0 ? '' : `${lines.join('\n')}\n`);
process.exit(failed ? 1 : 0);

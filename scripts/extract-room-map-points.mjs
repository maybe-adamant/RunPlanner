import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import * as prettier from 'prettier';
import { runnerImport } from 'vite';

/**
 * Regenerates the catalog's room map points and orientation facts from an
 * installed Hades II:
 *
 *   npm run catalog:map-points -- [--game <install or Content dir>]
 *
 * The install defaults to $HADES2_GAME_DIR, then the default Steam path. Every
 * declared catalog room's Content/Maps/bin/<room>.thing_bin is read; exit door
 * obstacle types come from ObstacleData*.lua; Well pins and the orientation
 * facts (entrance side, flip chance, direction flags, forced entries) come from
 * RoomData*.lua with InheritFrom resolved.
 * The output is deterministic: rerunning against the same install changes nothing.
 */

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const declarationsPath = join(repositoryRoot, 'packages/hades2-catalog/src/declarations/rooms');
const mapPointsPath = join(declarationsPath, 'map-points.ts');
const orientationPath = join(declarationsPath, 'orientation.ts');
const defaultGameDirectory = '/mnt/c/Program Files (x86)/Steam/steamapps/common/Hades II';

export function parseArguments(argv, environment = process.env) {
  let game = environment.HADES2_GAME_DIR ?? defaultGameDirectory;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--game' && index + 1 < argv.length) game = argv[(index += 1)];
    else throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
  }
  const content = existsSync(join(game, 'Content')) ? join(game, 'Content') : game;
  if (!existsSync(join(content, 'Maps/bin')) || !existsSync(join(content, 'Scripts')))
    throw new Error(`No Hades II Content (Maps/bin, Scripts) under ${game}`);
  return { content };
}

const printable = /^[\x20-\x7e]+$/;

/** The length-prefixed string `[0x01][u32 length][chars]` that ends exactly at `end`, if any. */
function stringEndingAt(buffer, end) {
  for (let length = 1; length <= 128; length += 1) {
    const start = end - length - 5;
    if (start < 0) return undefined;
    if (buffer[start] === 1 && buffer.readUInt32LE(start + 1) === length) {
      const text = buffer.toString('latin1', start + 5, end);
      if (printable.test(text)) return text;
    }
  }
  return undefined;
}

/**
 * Reads every placed thing of a `.thing_bin` map (magic `SGB1`, u32 version,
 * u32 thing count). Each thing is laid out as
 * `...[groups][13 bytes][u32 id][2 bytes][f32 x][f32 y][0x01][u32 length][obstacle name]...`,
 * its last group name being a length-prefixed string. The scan accepts a name
 * only with that group immediately before its id, and must find exactly the
 * header's thing count with unique ids.
 */
export function readThings(buffer, file) {
  if (buffer.toString('latin1', 0, 4) !== 'SGB1') throw new Error(`${file}: not an SGB1 map`);
  const count = buffer.readUInt32LE(8);
  const things = new Map();
  for (let offset = 27; offset + 5 < buffer.length; offset += 1) {
    if (buffer[offset] !== 1) continue;
    const length = buffer.readUInt32LE(offset + 1);
    if (length < 1 || length > 128 || offset + 5 + length > buffer.length) continue;
    const name = buffer.toString('latin1', offset + 5, offset + 5 + length);
    if (!printable.test(name)) continue;
    const idOffset = offset - 14;
    if (stringEndingAt(buffer, idOffset - 13) === undefined) continue;
    const id = buffer.readUInt32LE(idOffset);
    if (things.has(id)) throw new Error(`${file}: duplicate thing id ${id}`);
    things.set(id, {
      id,
      name,
      x: buffer.readFloatLE(offset - 8),
      y: buffer.readFloatLE(offset - 4),
    });
  }
  if (things.size !== count)
    throw new Error(`${file}: read ${things.size} things, header declares ${count}`);
  return things;
}

/**
 * Top-level entries of Lua data tables: one indent for the key, two for its
 * fields; a field whose table opens on the next line keeps its raw block text.
 */
function readLuaEntries(directory, pattern) {
  const entries = new Map();
  for (const file of readdirSync(directory)
    .filter((name) => pattern.test(name))
    .sort()) {
    const text = readFileSync(join(directory, file), 'latin1')
      .replace(/--\[\[[\s\S]*?\]\]/g, '')
      .replace(/--.*$/gm, '');
    let current;
    let block;
    for (const line of text.split(/\r?\n/)) {
      if (block !== undefined) {
        block.lines.push(line);
        if (/^(?:\t\t| {8})\},?\s*$/.test(line)) {
          current.fields.set(block.field, block.lines.join('\n'));
          block = undefined;
        }
        continue;
      }
      const key = /^(?:\t| {4})([A-Za-z_]\w*)\s*=\s*\{?\s*$/.exec(line);
      if (key !== null) {
        current = entries.get(key[1]) ?? { inheritFrom: [], fields: new Map(), file };
        entries.set(key[1], current);
        continue;
      }
      const field = /^(?:\t\t| {8})([A-Za-z_]\w*)\s*=\s*(.*?),?\s*$/.exec(line);
      if (current === undefined || field === null) continue;
      if (field[1] === 'InheritFrom')
        current.inheritFrom.push(...[...field[2].matchAll(/"([^"]+)"/g)].map((match) => match[1]));
      else if (field[2] === '' || field[2] === '{') block = { field: field[1], lines: [field[2]] };
      else current.fields.set(field[1], field[2]);
    }
  }
  return entries;
}

/**
 * A field resolved through `InheritFrom` (RunData ProcessDataInheritance): the
 * entry's own value wins over its bases, and the string "nil" erases it.
 */
function inheritedField(entries, key, field, seen = new Set()) {
  const entry = entries.get(key);
  if (entry === undefined || seen.has(key)) return undefined;
  seen.add(key);
  if (entry.fields.has(field)) {
    const value = entry.fields.get(field);
    return value === '"nil"' ? undefined : value;
  }
  const values = new Set(
    entry.inheritFrom
      .map((base) => inheritedField(entries, base, field, seen))
      .filter((value) => value !== undefined),
  );
  if (values.size > 1) throw new Error(`${key}.${field} inherits conflicting values`);
  return [...values][0];
}

function inheritsFrom(entries, key, base, seen = new Set()) {
  if (key === base) return true;
  const entry = entries.get(key);
  if (entry === undefined || seen.has(key)) return false;
  seen.add(key);
  return entry.inheritFrom.some((parent) => inheritsFrom(entries, parent, base, seen));
}

const round = (value) => Math.round(value * 100) / 100 + 0;
const point = (thing) => ({ id: thing.id, x: round(thing.x), y: round(thing.y) });
const byId = (left, right) => left.id - right.id;

function thingsNamed(things, name) {
  return [...things.values()].filter((thing) => thing.name === name).sort(byId);
}

function declaredPoints(things, ids, room, family) {
  return [...ids]
    .sort((left, right) => left - right)
    .map((id) => {
      const thing = things.get(id);
      if (thing === undefined)
        throw new Error(`${room}: declared ${family} point ${id} is not on its map`);
      return point(thing);
    });
}

/**
 * The engine's `GetAngleBetween` from one thing to another: degrees in [0, 360),
 * counterclockwise from screen right, map y growing down the screen.
 */
function angleBetween(from, to) {
  const degrees = (Math.atan2(from.y - to.y, to.x - from.x) * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
}

/** The isometric compass of `CardinalEntranceDirection` rooms (RoomLogic, RoomPresentation). */
function cardinalDirection(angle) {
  if (angle > 0 && angle < 90) return 'North';
  if (angle > 90 && angle < 180) return 'West';
  if (angle > 180 && angle < 270) return 'South';
  return 'East';
}

/** LeaveRoom's ExitDirection from a taken door to its nearest HeroExit. */
function exitDirection(angle, orientation) {
  if (orientation.cardinalEntrance) return cardinalDirection(angle);
  return angle < 90 || angle > 270 ? 'Right' : 'Left';
}

/** GatherRoomPresentationObjects' direction from a HeroStart to its paired HeroEnd. */
function entranceDirection(angle, orientation) {
  if (orientation.cardinalEntrance) return cardinalDirection(angle);
  if (orientation.strictLeftRight) {
    if (angle > 0 && angle < 90) return 'Right';
    if (angle > 90 && angle < 180) return 'Left';
    return undefined;
  }
  return angle < 90 || angle > 270 ? 'Right' : 'Left';
}

/** The engine's `GetClosest`; an exact distance tie would make the pick ambiguous. */
function closest(from, candidates, room) {
  const distance = (thing) => Math.hypot(thing.x - from.x, thing.y - from.y);
  const ranked = [...candidates].sort((left, right) => distance(left) - distance(right));
  if (ranked.length > 1 && distance(ranked[0]) === distance(ranked[1]))
    throw new Error(`${room}: things ${ranked[0].id} and ${ranked[1].id} tie nearest ${from.id}`);
  return ranked[0];
}

const luaString = (value) => (value === undefined ? undefined : /^"(.*)"$/.exec(value)?.[1]);

function luaNumber(value, path) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${path}: ${value} is not a number`);
  return number;
}

function luaBoolean(value, path) {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error(`${path}: ${value} is not a boolean`);
}

/** `OnUseSetRunData`: the next room's forced entry per exit door obstacle name. */
function nextRoomEntries(block, room) {
  if (block === undefined) return undefined;
  const entries = [...block.matchAll(/(\w+)\s*=\s*\{([^{}]*)\}/g)].map(([, obstacleName, body]) => {
    const fields = new Map([...body.matchAll(/(\w+)\s*=\s*([^,\s]+)/g)].map((m) => [m[1], m[2]]));
    const keys = [...fields.keys()].sort().join(',');
    if (keys !== 'NextHeroEndPoint,NextHeroStartPoint')
      throw new Error(`${room}.OnUseSetRunData.${obstacleName}: unsupported fields ${keys}`);
    return {
      obstacleName,
      startPointId: luaNumber(fields.get('NextHeroStartPoint'), room),
      endPointId: luaNumber(fields.get('NextHeroEndPoint'), room),
    };
  });
  if (entries.length === 0) throw new Error(`${room}.OnUseSetRunData: no entries read`);
  return entries.sort((left, right) => (left.obstacleName < right.obstacleName ? -1 : 1));
}

const entranceDirections = new Set(['Left', 'Right', 'LeftRight']);

/** The room's resolved RoomData orientation facts; absent fields keep their native defaults. */
export function readRoomOrientation(roomData, room) {
  const field = (name) => inheritedField(roomData, room, name);
  if (!roomData.has(room)) throw new Error(`${room}: no RoomData entry`);
  const entrance = field('EntranceDirection');
  const direction = luaString(entrance);
  if (entrance !== undefined && !entranceDirections.has(direction))
    throw new Error(`${room}.EntranceDirection: unsupported ${entrance}`);
  const flipChance = luaNumber(field('FlipHorizontalChance'), `${room}.FlipHorizontalChance`);
  const start = luaNumber(field('HeroStartPoint'), `${room}.HeroStartPoint`);
  const end = luaNumber(field('HeroEndPoint'), `${room}.HeroEndPoint`);
  if ((start === undefined) !== (end === undefined))
    throw new Error(`${room}: HeroStartPoint and HeroEndPoint must be declared together`);
  for (const unsupported of [
    'Flipped',
    'NextHeroStartPoint',
    'NextHeroEndPoint',
    'DebugHeroStartPoint',
  ])
    if (field(unsupported) !== undefined) throw new Error(`${room}.${unsupported}: not modelled`);
  const nextEntries = nextRoomEntries(field('OnUseSetRunData'), room);
  return {
    ...(direction === undefined ? {} : { entranceDirection: direction }),
    ...(flipChance === undefined ? {} : { flipChance }),
    ignoresExitDirection: luaBoolean(field('IgnoreExitDirection'), `${room}.IgnoreExitDirection`),
    cardinalEntrance: luaBoolean(
      field('CardinalEntranceDirection'),
      `${room}.CardinalEntranceDirection`,
    ),
    strictLeftRight: luaBoolean(field('StrictLeftRight'), `${room}.StrictLeftRight`),
    ...(start === undefined ? {} : { entry: { startPointId: start, endPointId: end } }),
    ...(nextEntries === undefined ? {} : { nextRoomEntries: nextEntries }),
  };
}

export function extractRoomMapPoints(content, declarations) {
  const scripts = join(content, 'Scripts');
  const obstacles = readLuaEntries(scripts, /^ObstacleData\w*\.lua$/);
  const doorNames = new Set(
    [...obstacles.keys()].filter((key) => inheritsFrom(obstacles, key, 'ExitDoor')),
  );
  const roomData = readLuaEntries(scripts, /^RoomData\w*\.lua$/);
  const rooms = [...declarations.rooms].sort((left, right) =>
    left.gameName < right.gameName ? -1 : left.gameName > right.gameName ? 1 : 0,
  );
  const result = {};
  const orientations = {};
  for (const room of rooms) {
    const file = join(content, 'Maps/bin', `${room.gameName}.thing_bin`);
    const things = readThings(readFileSync(file), room.gameName);
    const orientation = readRoomOrientation(roomData, room.gameName);
    orientations[room.gameName] = orientation;
    const heroExits = thingsNamed(things, 'HeroExit');
    const heroStarts = thingsNamed(things, 'HeroStart');
    const heroEnds = thingsNamed(things, 'HeroEnd');
    const challengeSwitchAnchors = thingsNamed(things, 'ChallengeSwitchBase').map(point);
    const wellPin = inheritedField(roomData, room.gameName, 'WellShopChallengeBaseId');
    const wellAnchorId = wellPin === undefined ? undefined : Number(wellPin);
    if (wellAnchorId !== undefined && !challengeSwitchAnchors.some((a) => a.id === wellAnchorId))
      throw new Error(`${room.gameName}: Well pin ${wellAnchorId} is not a ChallengeSwitchBase`);
    const spatial = room.fieldsSpatial;
    result[room.gameName] = {
      exitDoors: [...things.values()]
        .filter((thing) => doorNames.has(thing.name))
        .sort(byId)
        .map((thing) => {
          const heroExit =
            heroExits.length === 0 ? undefined : closest(thing, heroExits, room.gameName);
          return {
            id: thing.id,
            obstacleName: thing.name,
            x: point(thing).x,
            y: point(thing).y,
            ...(heroExit === undefined
              ? {}
              : {
                  heroExitId: heroExit.id,
                  exitDirection: exitDirection(angleBetween(thing, heroExit), orientation),
                }),
          };
        }),
      heroStarts: heroStarts.map(point),
      heroEnds: heroEnds.map(point),
      heroExits: heroExits.map(point),
      entryPairs:
        heroEnds.length === 0
          ? []
          : heroStarts.map((start) => {
              const end = closest(start, heroEnds, room.gameName);
              const direction = entranceDirection(angleBetween(start, end), orientation);
              return {
                startPointId: start.id,
                endPointId: end.id,
                ...(direction === undefined ? {} : { direction }),
              };
            }),
      secretPoints: thingsNamed(things, 'SecretPoint').map(point),
      challengeSwitchAnchors,
      ...(wellAnchorId === undefined ? {} : { wellAnchorId }),
      ...(spatial === undefined
        ? {}
        : {
            fieldsCagePoints: declaredPoints(things, spatial.cagePointIds, room.gameName, 'cage'),
            fieldsOptionalPoints: declaredPoints(
              things,
              spatial.optionalPointIds,
              room.gameName,
              'optional',
            ),
          }),
      ...(room.cocoonRewardPointIds === undefined
        ? {}
        : {
            cocoonRewardPoints: declaredPoints(
              things,
              room.cocoonRewardPointIds,
              room.gameName,
              'cocoon',
            ),
          }),
    };
  }
  return { mapPoints: result, orientations };
}

async function format(source, path) {
  const options = await prettier.resolveConfig(path);
  return prettier.format(source, { ...options, filepath: path });
}

export function renderMapPointsModule(roomMapPoints) {
  return format(
    `// Generated by scripts/extract-room-map-points.mjs from Content/Maps/bin/<room>.thing_bin,
// ObstacleData*.lua (exit door types) and RoomData*.lua (WellShopChallengeBaseId and the
// direction flags naming entry pairs and door exits); do not edit.
import type { RoomMapPoints } from '@run-planner/engine/catalog-schema';

/** Each declared room's map points, by room game name. */
export const roomMapPoints: Readonly<Record<string, RoomMapPoints>> = ${JSON.stringify(roomMapPoints)};
`,
    mapPointsPath,
  );
}

export function renderOrientationModule(roomOrientations) {
  return format(
    `// Generated by scripts/extract-room-map-points.mjs from RoomData*.lua with InheritFrom
// resolved; do not edit.
import type { RoomOrientation } from '@run-planner/engine/catalog-schema';

/** Each declared room's orientation facts, by room game name. */
export const roomOrientations: Readonly<Record<string, RoomOrientation>> = ${JSON.stringify(roomOrientations)};
`,
    orientationPath,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
  const { module } = await runnerImport(
    join(repositoryRoot, 'packages/hades2-catalog/src/declarations/index.ts'),
  );
  const { mapPoints, orientations } = extractRoomMapPoints(options.content, module.declarations);
  writeFileSync(mapPointsPath, await renderMapPointsModule(mapPoints));
  writeFileSync(orientationPath, await renderOrientationModule(orientations));
  process.stdout.write(
    `Wrote ${Object.keys(mapPoints).length} rooms to ${relative(repositoryRoot, mapPointsPath)} and ${relative(repositoryRoot, orientationPath)}\n`,
  );
}

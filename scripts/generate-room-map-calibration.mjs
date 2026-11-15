import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import * as prettier from 'prettier';

/**
 * Regenerates the planner's room-map calibration from the checked-in capture
 * records, after first replacing their rooms from any new capture manifests:
 *
 *   npm run planner:room-map-calibration -- [--skip <room>]... [<manifest.json>...]
 *
 * The checked-in records keep only the fields this script reads; images, points
 * and tiles stay with the capture tooling.
 *
 * Each manifest entry is one clean room capture with its RCMAP record; the Shop
 * capture (`shopVariant`) of a room that may hold a shop or a free reward is keyed
 * `<room>_Shop`, while a shop-only room's capture keeps the room's name. A room
 * may appear in only one new manifest, and `--skip` leaves out a captured room the
 * planner does not package. A world
 * point lands at image pixel centre + scale * (world - camera target), where
 * scale is the applied zoom times the render width over the 1920-wide UI.
 *
 * A stitched entry carries its own calibration instead of a camera record:
 * pixel = (pixelX, pixelY) + scale * (world - (worldX, worldY)). Its image is
 * packaged no wider than `packagedWidth`, so the calibration is scaled with it.
 */

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(repositoryRoot, 'apps/planner/src/ui/room-maps/roomMapCalibration.ts');
const capturesPath = join(repositoryRoot, 'scripts/data/room-map-captures.json');

const round = (value) => Math.round(value * 1e4) / 1e4;

/** The widest packaged room image; wider stitched captures are downscaled to it. */
const packagedWidth = 2560;

function stitchedCalibration(calibration) {
  const factor = Math.min(1, packagedWidth / calibration.width);
  const width = Math.round(calibration.width * factor);
  const height = Math.round(calibration.height * factor);
  const scale = calibration.scale * factor;
  return {
    width,
    height,
    targetX: round(calibration.worldX + (width / 2 - calibration.pixelX * factor) / scale),
    targetY: round(calibration.worldY + (height / 2 - calibration.pixelY * factor) / scale),
    scale: round(scale),
  };
}

/**
 * Rooms that always hold their shop: their only image is the Shop capture, so a
 * `shopVariant` record names the room itself, never a `<room>_Shop` variant.
 */
const shopOnlyRooms = new Set([
  'I_PreBoss01',
  'I_PreBoss02',
  'N_PreBoss01',
  'O_PreBoss01',
  'Q_PreBoss01',
]);

export function calibrationEntries(manifest) {
  return Object.entries(manifest)
    .map(([room, entry]) => {
      const record = entry.rcmap;
      // A room that may hold a shop or a free reward keys its Shop capture `<room>_Shop`.
      const imageRoom =
        record?.shopVariant === true && !shopOnlyRooms.has(record.room)
          ? `${record.room}_Shop`
          : record?.room;
      if (imageRoom !== room) throw new Error(`${room}: manifest record names ${imageRoom}`);
      if (record.flipped !== false) throw new Error(`${room}: capture is flipped`);
      if (entry.stitched === true) {
        if (entry.calibration === undefined)
          throw new Error(`${room}: stitched without calibration`);
        return [room, stitchedCalibration(entry.calibration)];
      }
      const width = record.screen.renderWidth;
      const height = record.screen.renderHeight;
      return [
        room,
        {
          width,
          height,
          targetX: round(record.camera.targetX),
          targetY: round(record.camera.targetY),
          scale: round((record.zoom.applied * width) / 1920),
        },
      ];
    })
    .sort(([left], [right]) => left.localeCompare(right));
}

/** The capture fields the calibration reads. */
export function captureRecord(entry) {
  const { room, shopVariant, flipped } = entry.rcmap;
  const identity = { room, ...(shopVariant === true ? { shopVariant } : {}), flipped };
  if (entry.stitched === true) {
    const { width, height, scale, pixelX, pixelY, worldX, worldY } = entry.calibration;
    return {
      stitched: true,
      calibration: { width, height, scale, pixelX, pixelY, worldX, worldY },
      rcmap: identity,
    };
  }
  const { renderWidth, renderHeight } = entry.rcmap.screen;
  const { targetX, targetY } = entry.rcmap.camera;
  return {
    rcmap: {
      ...identity,
      screen: { renderWidth, renderHeight },
      camera: { targetX, targetY },
      zoom: { applied: entry.rcmap.zoom.applied },
    },
  };
}

/** Merges the manifests' rooms; a room captured in two manifests is ambiguous. */
export function mergeManifests(manifests, skipped = []) {
  const merged = {};
  for (const [path, manifest] of manifests) {
    for (const [room, entry] of Object.entries(manifest)) {
      if (Object.hasOwn(merged, room)) throw new Error(`${room}: captured again in ${path}`);
      merged[room] = entry;
    }
  }
  for (const room of skipped) {
    if (!Object.hasOwn(merged, room)) throw new Error(`${room}: skipped but not captured`);
    delete merged[room];
  }
  return merged;
}

function parseArguments(argv) {
  const skipped = [];
  const manifestPaths = [];
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--skip') {
      const room = argv[++index];
      if (room === undefined) throw new Error('--skip needs a room');
      skipped.push(room);
    } else manifestPaths.push(argv[index]);
  }
  if (manifestPaths.length === 0 && skipped.length > 0) throw new Error('--skip needs a manifest');
  return { skipped, manifestPaths };
}

async function main(argv) {
  const { skipped, manifestPaths } = parseArguments(argv);
  const captures = JSON.parse(readFileSync(capturesPath, 'utf8'));
  if (manifestPaths.length > 0) {
    const recaptured = mergeManifests(
      manifestPaths.map((path) => [path, JSON.parse(readFileSync(path, 'utf8'))]),
      skipped,
    );
    calibrationEntries(recaptured);
    for (const [room, entry] of Object.entries(recaptured)) captures[room] = captureRecord(entry);
    const sorted = Object.fromEntries(
      Object.entries(captures).sort(([left], [right]) => left.localeCompare(right)),
    );
    writeFileSync(
      capturesPath,
      await prettier.format(JSON.stringify(sorted), {
        ...((await prettier.resolveConfig(capturesPath)) ?? {}),
        filepath: capturesPath,
      }),
    );
  }
  const entries = calibrationEntries(captures);
  const source = `// Generated by scripts/generate-room-map-calibration.mjs from the clean capture manifests.

import type { RoomMapCalibration } from '@planner/projections/roomMapMarkers';

/** Each calibrated room image: its size and the camera that captured it. */
export const roomMapCalibrations: Readonly<Record<string, RoomMapCalibration>> = Object.freeze(${JSON.stringify(
    Object.fromEntries(entries),
  )});
`;
  const options = (await prettier.resolveConfig(outputPath)) ?? {};
  writeFileSync(outputPath, await prettier.format(source, { ...options, filepath: outputPath }));
  process.stdout.write(`Wrote ${entries.length} room calibrations to ${outputPath}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

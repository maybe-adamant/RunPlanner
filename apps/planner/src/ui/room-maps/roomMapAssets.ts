import type { RoomMapCalibration } from '@planner/projections/roomMapMarkers';

import { roomMapCalibrations } from './roomMapCalibration';

export interface RoomMapAsset {
  readonly gameName: string;
  /** The image's own name: the game name, suffixed `_Shop` for a Preboss's Shop variant. */
  readonly imageName: string;
  readonly isPlaceholder: boolean;
  readonly src: string;
}

/** A Preboss's Shop variant: Charon and his stall stand on the same terrain and points. */
const shopVariantSuffix = '_Shop';

const assetModules = import.meta.glob<string>('./assets/**/*.{avif,jpeg,jpg,png,svg,webp}', {
  eager: true,
  import: 'default',
  query: '?url',
});

function roomMapAssetFromModule(path: string, src: string): RoomMapAsset {
  const match = /\/([^/]+)\.(avif|jpeg|jpg|png|svg|webp)$/.exec(path);
  if (match === null) throw new Error(`Unsupported room-map asset path: ${path}`);
  const [, imageName, extension] = match;
  if (imageName === undefined || extension === undefined) {
    throw new Error(`Room-map asset path has no game name: ${path}`);
  }
  return Object.freeze({
    gameName: imageName.endsWith(shopVariantSuffix)
      ? imageName.slice(0, -shopVariantSuffix.length)
      : imageName,
    imageName,
    isPlaceholder: extension === 'svg',
    src,
  });
}

/**
 * Vite resolves this static module set at build time. Asset filenames retain
 * the game room name, so replacing one image requires no source-code change.
 */
const allRoomMapAssets = Object.entries(assetModules)
  .map(([path, src]) => roomMapAssetFromModule(path, src))
  .sort((left, right) => left.imageName.localeCompare(right.imageName));

/** Each room's own map. */
export const roomMapAssets = Object.freeze(
  allRoomMapAssets.filter((asset) => asset.imageName === asset.gameName),
);

/** The Preboss Shop variants, each beside its room's free-reward map. */
export const roomMapShopAssets = Object.freeze(
  allRoomMapAssets.filter((asset) => asset.imageName !== asset.gameName),
);

const roomMapAssetsByImageName = new Map(allRoomMapAssets.map((asset) => [asset.imageName, asset]));

export function roomMapAssetFor(gameName: string): RoomMapAsset | undefined {
  return roomMapAssetsByImageName.get(gameName);
}

/**
 * The image an occurrence's map shows, with the camera that captured it: a
 * room holding a shop shows its Shop variant where one is captured, else the
 * room's own map.
 */
export function roomMapImageFor(
  gameName: string,
  shop: boolean,
):
  | { readonly asset: RoomMapAsset | undefined; readonly calibration: RoomMapCalibration }
  | undefined {
  const variantName = `${gameName}${shopVariantSuffix}`;
  const variant = shop ? roomMapAssetsByImageName.get(variantName) : undefined;
  const variantCalibration = roomMapCalibrations[variantName];
  if (variant !== undefined && variantCalibration !== undefined)
    return { asset: variant, calibration: variantCalibration };
  const calibration = roomMapCalibrations[gameName];
  return calibration === undefined
    ? undefined
    : { asset: roomMapAssetsByImageName.get(gameName), calibration };
}

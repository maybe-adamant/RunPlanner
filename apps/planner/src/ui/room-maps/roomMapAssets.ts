export interface RoomMapAsset {
  readonly gameName: string;
  readonly isPlaceholder: boolean;
  readonly src: string;
}

const assetModules = import.meta.glob<string>('./assets/**/*.{avif,jpeg,jpg,png,svg,webp}', {
  eager: true,
  import: 'default',
  query: '?url',
});

function roomMapAssetFromModule(path: string, src: string): RoomMapAsset {
  const match = /\/([^/]+)\.(avif|jpeg|jpg|png|svg|webp)$/.exec(path);
  if (match === null) throw new Error(`Unsupported room-map asset path: ${path}`);
  const [, gameName, extension] = match;
  if (gameName === undefined || extension === undefined) {
    throw new Error(`Room-map asset path has no game name: ${path}`);
  }
  return Object.freeze({
    gameName,
    isPlaceholder: extension === 'svg',
    src,
  });
}

/**
 * Vite resolves this static module set at build time. Asset filenames retain
 * the game room name, so replacing one image requires no source-code change.
 */
export const roomMapAssets = Object.freeze(
  Object.entries(assetModules)
    .map(([path, src]) => roomMapAssetFromModule(path, src))
    .sort((left, right) => left.gameName.localeCompare(right.gameName)),
);

const roomMapAssetsByGameName = new Map(roomMapAssets.map((asset) => [asset.gameName, asset]));

export function roomMapAssetFor(gameName: string): RoomMapAsset | undefined {
  return roomMapAssetsByGameName.get(gameName);
}

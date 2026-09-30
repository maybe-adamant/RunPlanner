import type { RoomMapAsset } from '../roomMapAssets';
import { cocoonMapAnnotations } from './cocoonMapAnnotations';

const modules = import.meta.glob<string>('./assets/**/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

/** Deliberately separate from ordinary entry/exit room-map discovery. */
export const cocoonMapAssets: readonly RoomMapAsset[] = Object.freeze(
  Object.entries(modules).map(([path, src]) =>
    Object.freeze({
      gameName: path
        .split('/')
        .at(-1)!
        .replace(/\.webp$/, ''),
      isPlaceholder: false,
      src,
    }),
  ),
);

export function cocoonMapFor(gameName: string) {
  const asset = cocoonMapAssets.find((candidate) => candidate.gameName === gameName);
  const annotations = cocoonMapAnnotations[gameName];
  return asset === undefined || annotations === undefined ? undefined : { asset, annotations };
}

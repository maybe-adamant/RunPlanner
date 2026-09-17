# Room map assets

`assets/` contains one image for each declared game room, resolved by
`roomMapAssets.ts` through Vite. Browser and desktop builds package the same
files; no game installation, external asset folder or network service is needed.

To replace a map, retain its game-name basename (for example `H_Combat02`).
Supported extensions are `avif`, `jpeg`, `jpg`, `png`, `svg` and `webp`; SVG is
reserved for placeholders. When replacing a placeholder with a screenshot,
remove the old SVG so there is exactly one asset for that room. Image dimensions
may change: the shared viewport fits the replacement automatically. No authored
plan, schema or engine change is needed.

Export new screenshots as WebP at quality 90, preserving their source resolution.
Keep original PNG captures outside the repository, and do not re-encode existing
WebPs unless replacing them from a source image. For example:

```sh
convert source.png -quality 90 -define webp:method=6 -define webp:lossless=false RoomName.webp
```

Fields annotations belong in the image itself and identify Entry, Cage, Optional,
and Exit positions. Stitch split captures and verify the full room's markers
before exporting the final image; never use one half as the complete map.

`N_Hub.webp` is a clean background. `HubMapAnnotations.tsx` owns the door positions
shared by read-only inspection and both interactive Hub maps. When replacing
this image, align those coordinates to the new capture rather than baking labels
into it. Individual main and side rooms keep their own images.
Main-room side-door annotations are baked into their images: cyan circles identify
the destination side-room number, not door priority or visit order.

After a swap, run the asset test and check the viewer:

```sh
npm exec vitest run -- apps/planner/test/ui/room-maps/roomMapAssets.test.ts
```

The test owns declaration coverage, uniqueness and deliberate placeholder
expectations. Update those expectations when supplying a previously missing
image; use Fit/zoom and the production build to verify the new asset renders.

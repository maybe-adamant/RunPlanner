# Room map assets

`assets/` contains one image for each declared game room, resolved by
`roomMapAssets.ts` through Vite. Browser and desktop builds package the same
files; no game installation, external asset folder or network service is needed.

Maps are grouped into `F/`, `G/`, `H/`, `I/`, `N/`, `O/`, `P/`, and `Q/` biome
folders. `G/Anomaly/` contains the `B_Combat` maps; `Special/` contains the shared
`Chaos`, `C_Boss` and Dream Postboss maps. Asset discovery is recursive and room identity comes
from the filename, not its folder.

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

F, G, H, I, P, Q, the `B_Combat` anomalies and the `Special/` rooms are clean
captures: `roomMapCalibration.ts` records each image's capture camera and the
editor draws their points from the catalog's map points. Regenerate it from the
capture manifests with `npm run planner:room-map-calibration` whenever one of
those images is replaced; an image without calibration shows no points.

A room too large for one screen is stitched from tiles; its manifest entry
carries the stitched image's own calibration. Package it at most 2560 wide
(`-resize '2560x1440>'` before the WebP options above); the script scales its
calibration to match.

On the remaining maps, annotations are baked into the image. Fields annotations
identify Entry, Cage, Optional, and Exit positions. Stitch split captures and verify the full room's markers
before exporting the final image; never use one half as the complete map.

`N_Hub.webp` is a clean background. `HubMapAnnotations.tsx` owns the door positions
shared by read-only inspection and both interactive Hub maps, and the fountain
position shared by both interactive maps. When replacing
this image, align those coordinates to the new capture rather than baking labels
into it. Individual main and side rooms keep their own images.
Main-room side-door annotations are baked into their images: yellow circles identify
the destination side-room number, not door priority or visit order.

`EphyraSideRoomAnnotations.ts` owns the illustrative status-label geometry for those
painted circles on the 16 Ephyra parent maps. Its values are normalized from the
640 × 360 capture annotation inventory into the packaged 2560 × 1440 image space
and bind declaration slot keys, not painted destination numbers or visit positions.
The Side Rooms editor adds non-interactive status labels only; it must
not duplicate the baked numbers or read the external capture directory at runtime.
Its integrity test checks the complete, unique correspondence with declared local
slots.

Baked map legends include only categories present: Entry (blue), Exit (red),
Chaos (purple), Cage (cyan), Optional and Side (yellow). Circle sizes are
uniform within each category on a map; numbers retain a consistent font size.
The Hub uses its own room-quality categories, with an orange fountain marker.

Hub reward icons are separate transparent editor assets, mapped from structured
reward identity. They are not room-map files and do not participate in room
asset discovery or declaration coverage.

Cocoon reward selection draws the room's catalog cocoon points on its calibrated
map; the engine supplies the room's legal IDs and numbered order. The asset test
checks that every cocoon host is calibrated.

After a swap, run the asset test and check the viewer:

```sh
npm exec vitest run -- apps/planner/test/ui/room-maps/roomMapAssets.test.ts
```

The test owns declaration coverage, uniqueness and deliberate placeholder
expectations. Update those expectations when supplying a previously missing
image; use Fit/zoom and the production build to verify the new asset renders.

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

A room that holds either a shop or a free reward (the F, G, H and P Prebosses,
`H_Bridge01`) has a second image, `<room>_Shop` (Charon and his empty item pads
on the same terrain), shown for an occurrence whose room holds a shop; it has
its own calibration and the room's points. A room that always holds a shop
(Shop rooms, the I, N, O and Q Prebosses) has only its own image, captured with
the shop and its pads empty.

An entry the capture leaves out of frame (the Q Preboss's, far below) is drawn
at the frame's edge with an arrow toward it.

Every map is a clean capture: `roomMapCalibration.ts` records each image's capture camera and the
editor draws their points from the catalog's map points. Regenerate it from the
capture manifests with `npm run planner:room-map-calibration` whenever one of
those images is replaced; an image without calibration shows no points.

A room too large for one screen is stitched from tiles; its manifest entry
carries the stitched image's own calibration. Package it at most 2560 wide
(`-resize '2560x1440>'` before the WebP options above); the script scales its
calibration to match.

A Ship's wheel is a catalog map point too: each phase a wheel follows shows its
offers there (one on the wheel, two on its left and right spots), and the last
phase shows the exit doors.

World Shop items stand on the room's catalog Shop points (its `LootPoint`s,
ascending by ObjectId): the engine pairs the k-th stocked item, empty slots
left out, with the k-th point, and a Travel Deal refill takes its bought
item's point. The Contract pedestal's item stands on its RoomData pedestal
point.

Ephyra side doors and Hub board doors are catalog map doors too: a side door
stands at its local slot's physical door, each Hub slot at its door on the
`N_Hub` map. Only the Hub board's quality rating of each slot's room is
planner-owned, keyed by Hub slot.

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

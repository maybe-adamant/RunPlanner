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

Annotations belong in the image itself. `N_Hub.png` is the annotated board;
individual main and side rooms keep their own images or placeholders. Fields
positions still require in-game annotation work. `H_Combat01` and `H_Combat05`
remain placeholders until their split source captures are supplied as combined
images; neither half is silently used as the complete map.

After a swap, run the asset test and check the viewer:

```sh
npm exec vitest run -- apps/planner/test/ui/room-maps/roomMapAssets.test.ts
```

The test owns declaration coverage, uniqueness and deliberate placeholder
expectations. Update those expectations when supplying a previously missing
image; use Fit/zoom and the production build to verify the new asset renders.

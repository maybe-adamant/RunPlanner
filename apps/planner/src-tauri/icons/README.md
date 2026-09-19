# Run Planner icons

These supplied assets contain size-specific artwork, not simple resizes:

- 128px and larger: full composition with fourteen equations.
- 48–96px: enlarged head with six equations.
- 32px and smaller: enlarged head without equations.

Preserve the supplied variants. Do not regenerate this set with `tauri icon`,
which would flatten the variants into resizes of a single image.

`tauri.conf.json` lists the desktop icons, including the additional Linux PNG
sizes. The ICO contains the Windows size variants; the ICNS contains the macOS
artwork. The Square/Store PNGs are reserved for Windows Store packaging.
Portable builds remain unbundled.

The browser favicon uses the supplied 16px and 32px PNGs directly through Vite.
The game companion's root `icon.png` is a byte-for-byte copy of `256x256.png`;
its deployment tools stage that root icon into the module's `src/` directory.
